const express = require("express");
const { randomUUID, timingSafeEqual } = require("node:crypto");
const { pagamentoIdValido, statusValidos } = require("../validation");

function tokenValido(recebido, esperado) {
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

module.exports = function webhookRoutes(store, webhookToken) {
  const router = express.Router();

  async function processar(res, { pagamentoId, status, eventoId }) {
    if (
      !pagamentoIdValido(pagamentoId) ||
      !statusValidos.has(status) ||
      typeof eventoId !== "string" ||
      !eventoId ||
      eventoId !== eventoId.trim() ||
      Array.from(eventoId).length > 128
    ) {
      return res.status(400).json({
        erro: "Informe um UUID de pagamento, um status válido e um ID de evento de até 128 caracteres sem espaços nas pontas.",
      });
    }

    const resultado = await store.atualizarPagamento(
      pagamentoId.toLowerCase(),
      status,
      eventoId,
    );
    if (!resultado)
      return res.status(404).json({ erro: "Pagamento não encontrado." });
    if (resultado.duplicado) {
      return res.json({ mensagem: "Evento já processado", duplicado: true });
    }
    res.json({
      mensagem: "Webhook processado",
      pagamento: resultado.pagamento,
    });
  }

  router.post("/pagamento", (req, res) => {
    if (!tokenValido(req.get("x-webhook-token"), webhookToken)) {
      return res.status(401).json({ erro: "Token do webhook inválido." });
    }

    return processar(res, req.body ?? {});
  });

  // A interface usa o mesmo processamento sem receber o token do webhook.
  router.post("/simulacao", (req, res) => {
    const { pagamentoId, status } = req.body ?? {};
    return processar(res, { pagamentoId, status, eventoId: randomUUID() });
  });

  return router;
};
