function criarPagamento() {
    return cy.request("POST", "/pagamentos", { cliente: "Ana Silva", valor: 50.25 })
        .then(({ status, body, headers }) => {
            expect(status).to.equal(201);
            expect(headers.location).to.equal(`/pagamentos/${body.pagamento.id}`);
            expect(body.pagamento).to.include({ cliente: "Ana Silva", valor: 50.25, status: "pending" });
            return body.pagamento.id;
        });
}

function notificar(body, token) {
    return cy.request({
        method: "POST",
        url: "/webhook/pagamento",
        headers: token === undefined ? {} : { "x-webhook-token": token },
        body,
        failOnStatusCode: false,
        log: false
    });
}

describe("Cobranças demonstrativas", () => {
    it("cria, consulta pelo ID e lista com filtro", () => {
        criarPagamento().then(id => {
            cy.request(`/pagamentos/${id}`).its("body").should("include", { id, status: "pending" });
            cy.request("/pagamentos").its("body").then(pagamentos => {
                expect(pagamentos.map(pagamento => pagamento.id)).to.include(id);
            });
            cy.request("/pagamentos?status=pending").its("body").then(pagamentos => {
                expect(pagamentos.map(pagamento => pagamento.id)).to.include(id);
                expect(pagamentos.every(pagamento => pagamento.status === "pending")).to.equal(true);
            });
        });
    });

    it("atualiza o status e ignora uma reentrega do mesmo evento", () => {
        cy.env(["webhookToken"]).then(({ webhookToken }) => {
            criarPagamento().then(pagamentoId => {
                const evento = { pagamentoId, status: "approved", eventoId: `evento-${pagamentoId}` };
                notificar(evento, webhookToken).then(({ status, body }) => {
                    expect(status).to.equal(200);
                    expect(body.pagamento).to.include({ id: pagamentoId, status: "approved" });
                    expect(body.pagamento.atualizadoEm).to.be.a("string");
                });
                notificar({ ...evento, status: "rejected" }, webhookToken).then(({ status, body }) => {
                    expect(status).to.equal(200);
                    expect(body.duplicado).to.equal(true);
                });
                cy.request(`/pagamentos/${pagamentoId}`).its("body.status").should("eq", "approved");
                cy.request("/pagamentos?status=rejected").its("body").then(pagamentos => {
                    expect(pagamentos.map(pagamento => pagamento.id)).not.to.include(pagamentoId);
                });
            });
        });
    });

    it("recusa dados inválidos e retorna 404 para um ID inexistente", () => {
        cy.request({
            method: "POST",
            url: "/pagamentos",
            body: { cliente: "Ana Silva", valor: 0.001 },
            failOnStatusCode: false
        }).its("status").should("eq", 400);
        cy.request({
            method: "POST",
            url: "/pagamentos",
            headers: { "content-type": "application/json" },
            body: "{",
            failOnStatusCode: false
        }).its("status").should("eq", 400);
        cy.request({ url: "/pagamentos?status=outro", failOnStatusCode: false })
            .its("status").should("eq", 400);
        cy.request({ url: "/pagamentos/abc", failOnStatusCode: false })
            .its("status").should("eq", 400);
        cy.request({
            url: "/pagamentos/00000000-0000-0000-0000-000000000000",
            failOnStatusCode: false
        }).its("status").should("eq", 404);

        cy.env(["webhookToken"]).then(({ webhookToken }) => {
            notificar({ pagamentoId: "abc", status: "approved", eventoId: "evento" }, webhookToken)
                .its("status").should("eq", 400);
            notificar({
                pagamentoId: "00000000-0000-0000-0000-000000000000",
                status: "approved",
                eventoId: "evento-sem-cobranca"
            }, webhookToken).its("status").should("eq", 404);
            criarPagamento().then(pagamentoId => {
                notificar({ pagamentoId, status: "outro", eventoId: "evento" }, webhookToken)
                    .its("status").should("eq", 400);
                notificar({ pagamentoId, status: "approved", eventoId: "" }, webhookToken)
                    .its("status").should("eq", 400);
            });
        });
    });

    it("recusa token inválido e preserva o status da cobrança", () => {
        criarPagamento().then(pagamentoId => {
            notificar({ pagamentoId, status: "approved", eventoId: `evento-${pagamentoId}` })
                .its("status").should("eq", 401);
            cy.env(["webhookToken"]).then(({ webhookToken }) => {
                notificar(
                    { pagamentoId, status: "approved", eventoId: `evento-${pagamentoId}` },
                    `${webhookToken}-invalido`
                ).its("status").should("eq", 401);
            });
            cy.request(`/pagamentos/${pagamentoId}`).its("body.status").should("eq", "pending");
        });
    });

    it("cadastra, paga na outra página e limpa a notificação", () => {
        const cliente = `Cliente Cypress ${Date.now()}`;
        cy.visit("/");
        cy.get('input[name="cliente"]').type(cliente);
        cy.get('input[name="valor"]').type("12.50");
        cy.contains("button", "Cobrar").click();
        cy.get("#mensagem").should("have.text", "Cobrança criada.");
        cy.contains("#lista li", cliente).should("contain", "Pendente");
        cy.contains("a", "Pagamentos").click();
        cy.contains("#lista li", cliente).contains("button", "Pagar").click();
        cy.get("#mensagem").should("have.text", "Pagamento simulado com sucesso.");
        cy.contains("#lista li", cliente).should("not.exist");
        cy.contains("a", "Cadastro").click();
        cy.contains("#lista li", cliente).should("contain", "Aprovado");
        cy.contains("#notificacoes li", cliente).should("contain", "Pagamento recebido");
        cy.contains("button", "Limpar notificações").click();
        cy.get("#notificacoes").should("be.empty");
        cy.reload();
        cy.get("#notificacoes-mensagem").should("have.text", "Nenhuma notificação.");
        cy.contains("#lista li", cliente).should("contain", "Aprovado");
    });

    it("valida o formulário de cobrança no navegador", () => {
        cy.visit("/");
        cy.contains("button", "Cobrar").click();
        cy.get('input[name="cliente"]').should("match", ":invalid").type("Cliente inválido");
        cy.get('input[name="valor"]').type("0");
        cy.contains("button", "Cobrar").click();
        cy.get('input[name="valor"]').should("match", ":invalid");
        cy.contains("#lista li", "Cliente inválido").should("not.exist");
    });

    it("mostra a falha da API e permite cobrar novamente", () => {
        const cliente = `Cliente nova tentativa ${Date.now()}`;
        cy.intercept({ method: "POST", pathname: "/pagamentos", times: 1 }, {
            statusCode: 500,
            body: { erro: "Não foi possível processar a requisição." }
        });
        cy.visit("/");
        cy.get('input[name="cliente"]').type(cliente);
        cy.get('input[name="valor"]').type("18");
        cy.contains("button", "Cobrar").click();
        cy.get("#erro").should("be.visible").and("contain", "Não foi possível");
        cy.get('input[name="cliente"]').should("have.value", cliente);
        cy.contains("button", "Cobrar").click();
        cy.get("#mensagem").should("have.text", "Cobrança criada.");
        cy.get("#erro").should("not.be.visible");
        cy.contains("#lista li", cliente).should("contain", "Pendente");
    });

    it("recebe uma nova notificação no cadastro aberto após limpar os avisos", () => {
        const cliente = `Cliente atualização automática ${Date.now()}`;
        criarPagamento().then(id => cy.request("POST", `/pagamentos/${id}/pagar`, {}));
        cy.request("POST", "/pagamentos", { cliente, valor: 28 }).then(({ body }) => {
            const id = body.pagamento.id;
            cy.visit("/");
            cy.contains("#lista li", cliente).should("contain", "Pendente");
            cy.contains("button", "Limpar notificações").click();
            cy.get("#notificacoes").should("be.empty");
            cy.request("POST", `/pagamentos/${id}/pagar`, {});
            cy.contains("#notificacoes li", cliente).should("contain", "Pagamento recebido");
            cy.contains("#lista li", cliente).should("contain", "Aprovado");
        });
    });
});
