const express = require("express");
const path = require("node:path");
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

function criarApp({ store, webhookToken }) {
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.use("/pagamentos", paymentRoutes(store));
  app.use("/webhook", webhookRoutes(store, webhookToken));
  app.get("/notificacoes", async (req, res) => {
    res.json(await store.listarNotificacoes());
  });

  app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada." }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ erro: "JSON inválido." });
    }
    if (error.type === "entity.too.large") {
      return res
        .status(413)
        .json({ erro: "Corpo da requisição excede 16 KB." });
    }
    if (error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ erro: "Requisição inválida." });
    }
    console.error(
      "Erro ao processar a requisição:",
      error.code || error.message,
    );
    res.status(500).json({ erro: "Não foi possível processar a requisição." });
  });

  return app;
}

module.exports = { criarApp };
