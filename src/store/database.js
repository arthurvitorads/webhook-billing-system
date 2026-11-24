const mysql = require("mysql2/promise");

let connectionPromise;

function getConnection() {
    if (!connectionPromise) {
        connectionPromise = mysql.createConnection({
            host: process.env.MYSQL_HOST,
            port: Number(process.env.MYSQL_PORT || 3306),
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE
        });
    }

    return connectionPromise;
}

async function executar(sql, valores) {
    const connection = await getConnection();
    return connection.execute(sql, valores);
}

module.exports = { executar };
