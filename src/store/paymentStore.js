const crypto = require("node:crypto");
const { executar } = require("./database");

const pagamentos = new Map();
const eventosProcessados = new Set();

async function criarPagamento(cliente, valor){
    const pagamento = {
        id: crypto.randomUUID(),
        cliente,
        valor,
        status: "pending",
        criadoEm: new Date().toISOString()
    }

    await executar(
        `INSERT INTO pagamentos (id, cliente, valor, status, criado_em)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
        [pagamento.id, pagamento.cliente, pagamento.valor, pagamento.status]
    );

    pagamentos.set(pagamento.id, pagamento);
    return pagamento;
}

function buscarPagamento(id){
    return pagamentos.get(id);
}

function eventoJaFoiProcessado(id){
    return eventosProcessados.has(id)
}

function atualizarPagamento(id, status, eventoId){
    const pagamento = buscarPagamento(id);
    if(!pagamento){
        return null
    }
    eventosProcessados.add(eventoId);
    pagamento.status = status;
    pagamento.atualizadoEm = new Date().toISOString();

    return pagamento;
}

module.exports = {
    criarPagamento,
    buscarPagamento,
    eventoJaFoiProcessado,
    atualizarPagamento
}   
