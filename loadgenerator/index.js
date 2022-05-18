// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const pg = require("pg");
const client = new pg.Client({
  host: process.env.SERVER,
  port: 5432,
  user: process.env.USER,
  password: process.env.PWORD,
  database: "postgres",
});
const init = async (toConnect) => {
  return await toConnect.connect();
};
const clientInit = init(client);

exports.lambda_handler = async (event, context, callback) => {
  let stmt =
    "CREATE TABLE IF NOT EXISTS salesorder (sales_order_id INTEGER GENERATED ALWAYS AS IDENTITY, subtotal DECIMAL(19, 4), order_date TIMESTAMP DEFAULT NOW());";
  await clientInit;
  await client.query(stmt);

  stmt = "INSERT INTO salesorder(subtotal) values ($1);";
  const args = [(Math.random() * 100).toFixed(2)];
  await client.query(stmt, args);

  return {
    statusCode: 200,
  };
};
