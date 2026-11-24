const express = require("express");

const { criarPagamento, buscarPagamento } = require("../store/paymentStore");

const router = express.Router();

router.post("/", async (req, res) => {
    const {cliente, valor} = req.body ?? {};
    if(typeof cliente !== "string" || !cliente.trim() ||
        typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0){
        return res.status(400).json({
            erro: "informe o cliente e valor maior que zero."
        });
    }

    try {
        const pagamento = await criarPagamento(cliente.trim(), valor);
        return res.status(201).json({
            mensagem: "Pagamento criado",
            pagamento
        });
    } catch (error) {
        console.error("Erro ao salvar pagamento no MySQL:", error);
        return res.status(500).json({
            erro: "Não foi possível salvar o pagamento."
        });
    }
})

router.get("/:id", (req, res) => {
    const pagamento = buscarPagamento(req.params.id);
    if(!pagamento){
        return res.status(404).json({error: "Pagamento não encontrado"});
    }
    res.json(pagamento)
})


module.exports = router;
