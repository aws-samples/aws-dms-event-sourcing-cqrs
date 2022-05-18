// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require("aws-sdk");
const kafkaconnect = new AWS.KafkaConnect();
const axios = require("axios");

const createPlugin = () => {
  var params = {
    contentType: "ZIP",
    location: {
      s3Location: {
        bucketArn: process.env.BUCKET_ARN,
        fileKey: "/tmp/kafka-connect.zip",
      },
    },
    name: "msks3",
  };
  return new Promise((resolve, reject) => {
    kafkaconnect.createCustomPlugin(params, function (err, data) {
      console.log(data);
      if (err) reject(err);
      else resolve(data);
    });
  });
};

const deletePlugin = (arn) => {
  var params = {
    customPluginArn: arn,
  };
  return new Promise((resolve, reject) => {
    kafkaconnect.deleteCustomPlugin(params, function (err, data) {
      console.log(data);
      if (err) reject(err);
      else resolve(data);
    });
  });
};

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const waitForPluginCreation = (retries, customPluginArn) => {
  var params = {
    customPluginArn,
  };
  return new Promise((resolve, reject) => {
    kafkaconnect.describeCustomPlugin(params, async function (err, data) {
      console.log(data);
      if (err || retries === 20) reject(err);
      else {
        if (data["customPluginState"] === "ACTIVE") resolve(data);
        else {
          await sleep(retries * 1000);
          retries++;
          await waitForPluginCreation(retries, customPluginArn);
          resolve(data);
        }
      }
    });
  });
};

exports.lambda_handler = async (event, context) => {
  console.log(event);
  if (event.RequestType == "Delete") {
    await deletePlugin(event.PhysicalResourceId);
    await sendResponse(event, context, "SUCCESS");
    return;
  }

  try {
    // Create the Custom Plugin for the connector
    const plugin = await createPlugin();
    await waitForPluginCreation(0, plugin["customPluginArn"]);
    const responseData = { PluginArn: plugin["customPluginArn"] };
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
