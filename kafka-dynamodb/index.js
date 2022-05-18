// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();
const table = process.env.TABLE_NAME;

exports.lambda_handler = function (event, context) {
  for (let key in event.records) {
    event.records[key].map((record) => {
      try {
        const msg = JSON.parse(Buffer.from(record.value, "base64").toString());

        const putParams = {
          TableName: table,
          Item: {
            sales_order_id: msg.data.sales_order_id.toString(),
            subtotal: msg.data.subtotal,
            order_date: msg.data.order_date,
          },
        };

        docClient.put(putParams, function (err, data) {
          if (err) {
            console.log("Unable to add item:", err);
          } else {
            console.log("Added item.");
          }
        });
      } catch (e) {
        console.log("Unable to add item:", e);
      }
    });
  }
};
