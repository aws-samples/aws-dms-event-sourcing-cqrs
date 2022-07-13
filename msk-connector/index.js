const AWS = require("aws-sdk");
const kafkaconnect = new AWS.KafkaConnect();
const kafka = new AWS.Kafka();
const axios = require("axios");

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const waitForConnectorCreation = (retries, connectorArn) => {
  var params = {
    connectorArn,
  };
  return new Promise((resolve, reject) => {
    kafkaconnect.describeConnector(params, async function (err, data) {
      console.log(data);
      if (err || retries === 20) reject(err);
      else {
        if (data["connectorState"] === "RUNNING") resolve(data);
        if (data["connectorState"] === "FAILED") reject(data);
        else {
          await sleep(retries * 10000);
          retries++;
          await waitForConnectorCreation(retries, connectorArn)
            .then(function () {
              resolve(data);
            })
            .catch(function (e) {
              console.log(e);
              reject(data);
            });
        }
      }
    });
  });
};

const getBrokers = () => {
  const mskArn = process.env.MSK_ENDPOINT;
  const brokerParams = { ClusterArn: mskArn };
  return new Promise((resolve, reject) => {
    kafka.getBootstrapBrokers(brokerParams, function (err, data) {
      console.log(data);
      if (err) reject(err);
      else resolve(data);
    });
  });
};

const createConnector = (brokerConn, plugin) => {
  var params = {
    capacity: {
      provisionedCapacity: {
        mcuCount: "2",
        workerCount: "2",
      },
    },
    connectorConfiguration: {
      "connector.class": "io.confluent.connect.s3.S3SinkConnector",
      "s3.region": process.env.REGION,
      "flush.size": "1",
      "schema.compatibility": "NONE",
      "tasks.max": "2",
      topics: "salesorder",
      "key.converter.schemas.enable": "false",
      "format.class": "io.confluent.connect.s3.format.json.JsonFormat",
      "partitioner.class":
        "io.confluent.connect.storage.partitioner.DefaultPartitioner",
      "value.converter.schemas.enable": "false",
      "value.converter": "org.apache.kafka.connect.json.JsonConverter",
      "storage.class": "io.confluent.connect.s3.storage.S3Storage",
      "s3.bucket.name": process.env.BUCKET_NAME,
      "key.converter": "org.apache.kafka.connect.storage.StringConverter",
    },
    connectorName: "kafka-connect-s3-connector",
    kafkaCluster: {
      apacheKafkaCluster: {
        bootstrapServers: brokerConn,
        vpc: {
          subnets: [process.env.SUBNET_A, process.env.SUBNET_B],
          securityGroups: [process.env.SECURITY_GROUP],
        },
      },
    },
    kafkaClusterClientAuthentication: {
      authenticationType: "NONE",
    },
    kafkaClusterEncryptionInTransit: {
      encryptionType: "PLAINTEXT",
    },
    kafkaConnectVersion: "2.7.1",
    plugins: [
      {
        customPlugin: {
          customPluginArn: plugin,
          revision: 1,
        },
      },
    ],
    serviceExecutionRoleArn: process.env.ROLE_NAME,
    logDelivery: {
      workerLogDelivery: {
        cloudWatchLogs: {
          enabled: true,
          logGroup: process.env.LOG_GROUP,
        },
        firehose: {
          enabled: false,
        },
        s3: {
          enabled: false,
        },
      },
    },
  };
  return new Promise((resolve, reject) => {
    kafkaconnect.createConnector(params, function (err, data) {
      console.log(data);
      if (err) reject(err);
      else resolve(data);
    });
  });
};

exports.lambda_handler = async (event, context) => {
  console.log(event);
  if (event.RequestType == "Delete") {
    await sendResponse(event, context, "SUCCESS");
    return;
  }

  try {
    const broker = await getBrokers();
    const brokerConn = broker["BootstrapBrokerString"];

    // Create the MSK Connect Connector
    const connector = await createConnector(brokerConn, process.env.PLUGIN_ARN);
    await waitForConnectorCreation(0, connector["connectorArn"]);
    const responseData = { ConnectorArn: connector["connectorArn"] };
    await sendResponse(event, context, "SUCCESS", responseData);
  } catch (e) {
    console.log(e);
    await sendResponse(event, context, "FAILED");
  }
};

async function sendResponse(
  event,
  context,
  responseStatus,
  responseData,
  physicalResourceId
) {
  var reason =
    responseStatus == "FAILED"
      ? "See the details in CloudWatch Log Stream: " + context.logStreamName
      : undefined;

  var responseBody = JSON.stringify({
    StackId: event.StackId,
    RequestId: event.RequestId,
    Status: responseStatus,
    Reason: reason,
    PhysicalResourceId: physicalResourceId || context.logStreamName,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  });

  var responseOptions = {
    headers: {
      "Content-Type": "",
      "Content-Length": responseBody.length,
    },
  };

  console.log("Response body:\n", responseBody);

  try {
    await axios.put(event.ResponseURL, responseBody, responseOptions);
    console.log("Success");
  } catch (e) {
    console.log("Error:");
    console.log(e);

    throw new Error("Could not send CloudFormation response");
  }
}
