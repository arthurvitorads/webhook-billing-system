const criar = document.querySelector("#criar");
const lista = document.querySelector("#lista");
const filtro = document.querySelector("#filtro");
const limpar = document.querySelector("#limpar");
const mensagem = document.querySelector("#mensagem");
const erro = document.querySelector("#erro");
const listaMensagem = document.querySelector("#lista-mensagem");
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const statusEmPortugues = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};
const chaveNotificacoes = "notificacoes-limpas";
let notificacoes = [];
let consultaAtual = 0;
let listaAnterior;
let avisosAnteriores;

async function requisitar(url, dados) {
  const resposta = await fetch(
    url,
    dados && {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    },
  );
  const corpo = await resposta.json();
  if (!resposta.ok)
    throw new Error(corpo.erro || "Não foi possível concluir a operação.");
  return corpo;
}

function descricao(pagamento) {
  return `${pagamento.cliente} · ${moeda.format(pagamento.valor)} · ${statusEmPortugues[pagamento.status]}`;
}

async function executar(botao, acao) {
  botao.disabled = true;
  mensagem.textContent = "";
  erro.hidden = true;
  try {
    mensagem.textContent = await acao();
  } catch (falha) {
    erro.textContent = falha.message;
    erro.hidden = false;
  } finally {
    await carregarLista();
    botao.disabled = false;
  }
}

function itemPagamento(pagamento) {
  const item = document.createElement("li");
  item.textContent = descricao(pagamento);
  if (!criar) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Pagar";
    botao.addEventListener("click", () =>
      executar(botao, async () => {
        const resposta = await requisitar(
          `/pagamentos/${encodeURIComponent(pagamento.id)}/pagar`,
          {},
        );
        return resposta.mensagem;
      }),
    );
    item.append(botao);
  }
  return item;
}

async function carregarLista() {
  const consulta = ++consultaAtual;
  const status = filtro ? filtro.value : "pending";
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  try {
    const pagamentos = await requisitar(`/pagamentos${query}`);
    if (consulta !== consultaAtual) return;
    listaMensagem.textContent = pagamentos.length
      ? ""
      : "Nenhuma cobrança encontrada.";
    const conteudo = JSON.stringify(pagamentos);
    if (conteudo === listaAnterior) return;
    listaAnterior = conteudo;
    lista.replaceChildren(...pagamentos.map(itemPagamento));
  } catch (falha) {
    if (consulta === consultaAtual) listaMensagem.textContent = falha.message;
  }
}

function mostrarNotificacoes() {
  const limpas = new Set(
    JSON.parse(localStorage.getItem(chaveNotificacoes) || "[]"),
  );
  const visiveis = notificacoes.filter((aviso) => !limpas.has(aviso.eventoId));
  limpar.disabled = !visiveis.length;
  document.querySelector("#notificacoes-mensagem").textContent = visiveis.length
    ? ""
    : "Nenhuma notificação.";
  const conteudo = JSON.stringify(visiveis);
  if (conteudo === avisosAnteriores) return;
  avisosAnteriores = conteudo;
  document.querySelector("#notificacoes").replaceChildren(
    ...visiveis.map((aviso) => {
      const item = document.createElement("li");
      const texto = document.createElement("span");
      const horario = document.createElement("small");
      texto.textContent =
        aviso.status === "approved"
          ? `Pagamento recebido · ${descricao(aviso)}`
          : descricao(aviso);
      horario.textContent = dataHora.format(new Date(aviso.processadoEm));
      item.append(texto, horario);
      return item;
    }),
  );
}

async function carregarNotificacoes() {
  try {
    notificacoes = await requisitar("/notificacoes");
    mostrarNotificacoes();
  } catch (falha) {
    document.querySelector("#notificacoes-mensagem").textContent =
      falha.message;
  }
}

if (criar) {
  criar.addEventListener("submit", (evento) => {
    evento.preventDefault();
    executar(criar.querySelector("button"), async () => {
      await requisitar("/pagamentos", {
        cliente: criar.elements.cliente.value,
        valor: Number(criar.elements.valor.value),
      });
      criar.reset();
      return "Cobrança criada.";
    });
  });

  filtro.addEventListener("change", carregarLista);
  limpar.addEventListener("click", () => {
    localStorage.setItem(
      chaveNotificacoes,
      JSON.stringify(notificacoes.map((aviso) => aviso.eventoId)),
    );
    mostrarNotificacoes();
  });
}

async function atualizar() {
  await Promise.all([carregarLista(), criar && carregarNotificacoes()]);
  setTimeout(atualizar, 2500);
}

atualizar();
