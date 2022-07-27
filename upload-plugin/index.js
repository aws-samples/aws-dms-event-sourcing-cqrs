// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require("aws-sdk");
const fs = require("fs");
const https = require("follow-redirects").https;
const s3 = new AWS.S3();
const axios = require("axios");

const uploadFile = async (fileName, accountId) => {
  const fileContent = fs.readFileSync(fileName);
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ExpectedBucketOwner: accountId,
  };
  return new Promise((resolve, reject) => {
    s3.upload(params, function (err, data) {
      console.log(data);
      if (err) reject(err);
      else resolve(data);
    });
  });
};

const downloadFile = (fileName) => {
  return new Promise((resolve, reject) => {
    https
      .get(fileName, (res) => {
        const file = fs.createWriteStream(`/tmp/kafka-connect.zip`);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log(`File downloaded!`);
          resolve(res);
        });
      })
      .on("error", (err) => {
        reject(err);
        console.log("Error: ", err.message);
      });
  });
};

exports.lambda_handler = async (event, context) => {
  if (event.RequestType == "Delete") {
    await sendResponse(event, context, "SUCCESS");
    return;
  }

  const accountId = context.invokedFunctionArn.split(":")[4];

  try {
    // Download connector code & stage in S3 bucket
    await downloadFile(
      `https://d1i4a15mxbxib1.cloudfront.net/api/plugins/confluentinc/kafka-connect-s3/versions/10.0.5/confluentinc-kafka-connect-s3-10.0.5.zip`
    );
    await uploadFile("/tmp/kafka-connect.zip", accountId);
    await sendResponse(event, context, "SUCCESS");
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
