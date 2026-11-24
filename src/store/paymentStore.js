const { randomUUID } = require("node:crypto");

const selecionar = `
    SELECT p.id, p.cliente, p.valor, p.status, p.criado_em AS criadoEm,
           (SELECT MAX(e.processado_em) FROM eventos_pagamento e
            WHERE e.pagamento_id = p.id) AS atualizadoEm
    FROM pagamentos p`;

function formatar({ atualizadoEm, ...pagamento }) {
  if (atualizadoEm) pagamento.atualizadoEm = atualizadoEm;
  return pagamento;
}

function criarStore(pool) {
  async function buscarPagamento(id, executor = pool) {
    const [linhas] = await executor.execute(selecionar + " WHERE p.id = ?", [
      id,
    ]);
    return linhas.length ? formatar(linhas[0]) : null;
  }

  async function criarPagamento(cliente, valor) {
    const id = randomUUID();
    await pool.execute(
      `INSERT INTO pagamentos (id, cliente, valor, status, criado_em)
             VALUES (?, ?, ?, 'pending', UTC_TIMESTAMP(3))`,
      [id, cliente, valor],
    );
    return buscarPagamento(id);
  }

  async function listarPagamentos(status) {
    const filtro = status ? " WHERE p.status = ?" : "";
    const [linhas] = await pool.execute(
      selecionar + filtro + " ORDER BY p.criado_em DESC, p.id DESC",
      status ? [status] : [],
    );
    return linhas.map(formatar);
  }

  async function listarNotificacoes() {
    const [linhas] = await pool.execute(
      `SELECT CONVERT(e.id USING utf8mb4) AS eventoId, p.id AS pagamentoId,
                    p.cliente, p.valor, e.status, e.processado_em AS processadoEm
             FROM eventos_pagamento e JOIN pagamentos p ON p.id = e.pagamento_id
             ORDER BY e.processado_em DESC, e.id DESC LIMIT 100`,
    );
    return linhas;
  }

  async function atualizarPagamento(
    id,
    status,
    eventoId,
    { apenasPendente = false } = {},
  ) {
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      // O bloqueio serializa eventos distintos para a mesma cobrança.
      const [linhas] = await conexao.execute(
        "SELECT status FROM pagamentos WHERE id = ? FOR UPDATE",
        [id],
      );
      if (!linhas.length) {
        await conexao.rollback();
        return null;
      }
      if (apenasPendente && linhas[0].status !== "pending") {
        await conexao.rollback();
        return { indisponivel: true };
      }

      try {
        await conexao.execute(
          `INSERT INTO eventos_pagamento (id, pagamento_id, status, processado_em)
                     VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
          [eventoId, id, status],
        );
      } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") throw error;
        await conexao.rollback();
        return { duplicado: true };
      }

      await conexao.execute("UPDATE pagamentos SET status = ? WHERE id = ?", [
        status,
        id,
      ]);
      const pagamento = await buscarPagamento(id, conexao);
      await conexao.commit();
      return { pagamento };
    } catch (error) {
      await conexao.rollback();
      throw error;
    } finally {
      conexao.release();
    }
  }

  return {
    criarPagamento,
    buscarPagamento,
    listarPagamentos,
    listarNotificacoes,
    atualizarPagamento,
  };
}

module.exports = { criarStore };
