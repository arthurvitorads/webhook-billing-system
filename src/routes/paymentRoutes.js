const express = require("express");
const { randomUUID } = require("node:crypto");
const {
  pagamentoIdValido,
  statusValidos,
  valorValido,
} = require("../validation");

module.exports = function paymentRoutes(store) {
  const router = express.Router();

  router.post("/", async (req, res) => {
    const { cliente, valor } = req.body ?? {};
    const nome = typeof cliente === "string" ? cliente.trim() : "";
    if (!nome || Array.from(nome).length > 255 || !valorValido(valor)) {
      return res.status(400).json({
        erro: "Informe um cliente de até 255 caracteres e um valor de 0,01 a 99999999,99 com até duas casas decimais.",
      });
    }

    const pagamento = await store.criarPagamento(nome, valor);
    res
      .location(`/pagamentos/${pagamento.id}`)
      .status(201)
      .json({ mensagem: "Pagamento criado", pagamento });
  });

  router.get("/", async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !statusValidos.has(status)) {
      return res.status(400).json({ erro: "Filtro de status inválido." });
    }

    res.json(await store.listarPagamentos(status));
  });

  router.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (!pagamentoIdValido(id)) {
      return res
        .status(400)
        .json({ erro: "Identificador de pagamento inválido." });
    }

    const pagamento = await store.buscarPagamento(id.toLowerCase());
    if (!pagamento)
      return res.status(404).json({ erro: "Pagamento não encontrado." });
    res.json(pagamento);
  });

  router.post("/:id/pagar", async (req, res) => {
    const { id } = req.params;
    if (!pagamentoIdValido(id)) {
      return res
        .status(400)
        .json({ erro: "Identificador de pagamento inválido." });
    }

    const resultado = await store.atualizarPagamento(
      id.toLowerCase(),
      "approved",
      randomUUID(),
      {
        apenasPendente: true,
      },
    );
    if (!resultado)
      return res.status(404).json({ erro: "Pagamento não encontrado." });
    if (resultado.indisponivel) {
      return res
        .status(409)
        .json({ erro: "Esta cobrança já não está pendente." });
    }
    res.json({
      mensagem: "Pagamento simulado com sucesso.",
      pagamento: resultado.pagamento,
    });
  });

  return router;
};
