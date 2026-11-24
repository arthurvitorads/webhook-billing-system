# Cobranças demonstrativas

Aplicação didática em Node.js, Express e MySQL para criar, consultar e acompanhar cobranças. A interface simula notificações de pagamento. Nenhuma cobrança movimenta dinheiro ou gera um QR Code PIX pagável.

## Instalação

Requisitos: Node.js 22 LTS, npm e MySQL 8 local em execução.

1. Na pasta do projeto, instale as dependências.

   ```powershell
   npm ci
   if (!(Test-Path .env)) { Copy-Item .env.example .env }
   ```

2. Crie o banco e as tabelas. Se estiver usando uma conta sem senha local, omita `-p`. Você também pode executar os mesmos comandos SQL pelo MySQL Workbench.

   ```powershell
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS billing CHARACTER SET utf8mb4"
   mysql -u root -p billing -e "source database.sql"
   ```

   Se a tabela `pagamentos` da aula já existir, execute `database.sql` no mesmo banco para adicionar a tabela de eventos e manter os registros existentes.

3. Edite o arquivo `.env`.

   | Variável | Configuração |
   | --- | --- |
   | `PORT` | Porta HTTP. Padrão `5000`. |
   | `WEBHOOK_TOKEN` | Obrigatório. Defina um segredo local, por exemplo `token-demo-local` para o exercício. |
   | `DB_HOST` | Host do MySQL. Padrão `localhost`. |
   | `DB_PORT` | Porta do MySQL. Padrão `3306`. |
   | `DB_USER` | Usuário do banco. Padrão `root`. |
   | `DB_PASSWORD` | Senha desse usuário. Deixe vazio se a conta estiver sem senha. |
   | `DB_NAME` | Nome do banco. Padrão `billing`. |

4. Inicie o servidor com `npm start` e abra `http://127.0.0.1:5000`. O servidor escuta apenas na interface local. Em **Cadastro**, preencha o formulário e clique em **Cobrar**. Em **Pagamentos**, clique em **Pagar** na cobrança pendente. Ao voltar ao cadastro, o histórico já mostra o status **Aprovado** e o aviso aparece em **Notificações de pagamento**. Se as duas páginas estiverem abertas, as listas se atualizam automaticamente. **Limpar notificações** oculta os avisos atuais neste navegador e preserva o histórico no MySQL.

## API

| Método e rota | Entrada | Retorno de sucesso |
| --- | --- | --- |
| `POST /pagamentos` | JSON com `cliente` e `valor` numérico, positivo e com até duas casas decimais | `201`, objeto com `mensagem` e `pagamento` |
| `GET /pagamentos` | Filtro opcional `?status=approved` | `200`, lista de cobranças, mais recentes primeiro |
| `GET /pagamentos/:id` | UUID da cobrança | `200`, objeto da cobrança |
| `POST /pagamentos/:id/pagar` | UUID de uma cobrança pendente | `200`, cobrança aprovada e notificação registrada. Retorna `409` se a cobrança já mudou de status. |
| `GET /notificacoes` | Sem parâmetros | `200`, até 100 eventos recentes com os dados da cobrança |
| `POST /webhook/pagamento` | Cabeçalho `x-webhook-token` e JSON com `pagamentoId`, `status` e `eventoId` | `200`, cobrança atualizada ou `duplicado: true` |
| `POST /webhook/simulacao` | JSON com `pagamentoId` e `status`. A rota local gera um ID de evento. | `200`, cobrança atualizada |

Toda cobrança começa com `pending`. Os status aceitos são `pending`, `approved`, `rejected` e `cancelled`. O `eventoId` deve ser único para cada novo evento, tem limite de 128 caracteres e distingue maiúsculas de minúsculas. Reenvie o mesmo ID para simular uma reentrega. O MySQL registra o evento e atualiza a cobrança na mesma transação. Reentregas não alteram o status.

Os erros retornam JSON com o campo `erro`. A API usa `400` para dados ou JSON inválidos, `401` para token ausente ou inválido, `404` para cobrança ou rota inexistente, `413` para corpo acima de 16 KB e `500` para falhas internas.

### Exemplos no PowerShell

```powershell
$api = 'http://127.0.0.1:5000'
$headers = @{ 'x-webhook-token' = 'token-demo-local' } # Use o valor do seu .env

# Criar e consultar
$cobranca = Invoke-RestMethod -Method Post -Uri "$api/pagamentos" -ContentType 'application/json' -Body '{"cliente":"Ana Silva","valor":50.25}'
$id = $cobranca.pagamento.id
Invoke-RestMethod "$api/pagamentos/$id"
Invoke-RestMethod "$api/pagamentos"
Invoke-RestMethod "$api/pagamentos?status=pending"

# Processar e reenviar o mesmo evento
$evento = @{ pagamentoId = $id; status = 'approved'; eventoId = [guid]::NewGuid().ToString() } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$api/webhook/pagamento" -Headers $headers -ContentType 'application/json' -Body $evento
Invoke-RestMethod -Method Post -Uri "$api/webhook/pagamento" -Headers $headers -ContentType 'application/json' -Body $evento

# Simular uma atualização de status
$simulacao = @{ pagamentoId = $id; status = 'cancelled' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$api/webhook/simulacao" -ContentType 'application/json' -Body $simulacao
Invoke-RestMethod "$api/pagamentos?status=cancelled"
Invoke-RestMethod "$api/notificacoes"

# Pagar uma nova cobrança pendente, como na página Pagamentos
$pendente = Invoke-RestMethod -Method Post -Uri "$api/pagamentos" -ContentType 'application/json' -Body '{"cliente":"Bruno","valor":25}'
Invoke-RestMethod -Method Post -Uri "$api/pagamentos/$($pendente.pagamento.id)/pagar"
```

## Testes com Cypress

Com o MySQL e o servidor em execução, abra outro terminal na pasta do projeto e rode `npm test`. O Cypress abre o navegador, executa os testes e mantém a janela aberta para você conferir cada passo. Feche a janela para encerrar o comando. O Cypress lê a porta e o token do `.env`. Os testes de interface cobrem o cadastro, o pagamento entre as duas páginas, a validação do formulário, a recuperação após uma falha e a chegada de novos avisos depois de limpar as notificações. A suíte também testa diretamente a API.

Os testes criam cobranças no MySQL. Se quiser isolar esses dados, crie um banco como `billing_test`, aplique `database.sql` nele e ajuste `DB_NAME` antes de iniciar o servidor de teste.

Para conferir a persistência, execute os exemplos até o primeiro envio do evento, pare o servidor com `Ctrl+C` e rode `npm start` novamente. No terminal que guarda `$id` e `$evento`, consulte a cobrança e reenvie aquele mesmo evento. A consulta deve retornar `approved` e o webhook deve devolver `duplicado: true`.

## Formatação

Execute `npm run format` para formatar os arquivos de `src/` com o Prettier.
