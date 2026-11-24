const statusValidos = new Set(["pending", "approved", "rejected", "cancelled"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const valorMonetario = /^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/;

function pagamentoIdValido(id) {
  return typeof id === "string" && id.length === 36 && uuid.test(id);
}

function valorValido(valor) {
  return (
    typeof valor === "number" && valor > 0 && valorMonetario.test(String(valor))
  );
}

module.exports = { statusValidos, pagamentoIdValido, valorValido };
