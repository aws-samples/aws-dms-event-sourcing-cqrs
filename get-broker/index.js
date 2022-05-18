const AWS = require("aws-sdk");
const kafka = new AWS.Kafka();
const axios = require("axios");

const getBrokers = () => {
  const brokerParams = { ClusterArn: process.env.MSK_ENDPOINT };
  return new Promise((resolve, reject) => {
    kafka.getBootstrapBrokers(brokerParams, function (err, data) {
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
    const responseData = { Broker: broker["BootstrapBrokerString"] };
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
