const mysql = require("mysql2/promise");

function criarPool(
  database = process.env.DB_NAME || process.env.MYSQL_DATABASE || "billing",
) {
  return mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.DB_USER || process.env.MYSQL_USER || "root",
    password: process.env.DB_PASSWORD ?? process.env.MYSQL_PASSWORD,
    database,
    timezone: "Z",
    decimalNumbers: true,
  });
}

module.exports = { criarPool };
