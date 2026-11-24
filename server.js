require("dotenv").config({ quiet: true });

const { criarApp } = require("./src/app");
const { criarPool } = require("./src/store/database");
const { criarStore } = require("./src/store/paymentStore");

const webhookToken = process.env.WEBHOOK_TOKEN;
if (!webhookToken?.trim()) {
    console.error("Defina WEBHOOK_TOKEN no arquivo .env.");
    process.exit(1);
}

const pool = criarPool();
const app = criarApp({ store: criarStore(pool), webhookToken });
const port = Number(process.env.PORT || 5000);

app.listen(port, "127.0.0.1", () => {
    console.log(`Servidor rodando em http://127.0.0.1:${port}`);
});
