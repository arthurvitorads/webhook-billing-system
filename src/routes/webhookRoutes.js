const express = require("express");

const {
    buscarPagamento,
    eventoJaFoiProcessado,
    atualizarPagamento
} = require("../store/paymentStore");

const router = express.Router();
const webhookToken = process.env.WEBHOOK_TOKEN || "new-token";
const statusValidos = ["approved", "reject", "cancelled"];

router.post("/pagamento", (req, res) => {
    const tokenRecebido = req.get("x-webhook-token");
    if(tokenRecebido !== webhookToken){
        return res.status(401).json({erro: "Token do webhook invalido"})
    }


    const { pagamentoId, status, eventoId } = req.body ?? {};

    if (typeof pagamentoId !== "string" || !pagamentoId.trim() ||
        typeof status !== "string" || !statusValidos.includes(status) ||
        typeof eventoId !== "string" || !eventoId.trim()) {
        return res.status(400).json({
            erro: "informe pagamentoId, um status válido e eventoId."
        });
    }

    if (eventoJaFoiProcessado(eventoId)) {
        return res.status(200).json({
            mensagem: "Evento já processado",
            duplicado: true
        });
    }

    if (!buscarPagamento(pagamentoId)) {
        return res.status(404).json({ erro: "Pagamento não encontrado" });
    }

    const pagamento = atualizarPagamento(pagamentoId, status, eventoId);
    return res.status(200).json({
        mensagem: "Webhook processado",
        pagamento
    });
})

module.exports = router;
