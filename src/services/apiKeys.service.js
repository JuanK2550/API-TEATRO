// ========================================
// Importaciones
// ========================================
const apiKeys = require("../data/apiKeys");
const { generarHash, compararSeguro } = require("../utils/crypto.util");

// ========================================
// Buscar cliente mediante API Key
// Compara hashes: la clave original nunca se recupera
// ========================================
const buscarClientePorApiKey = (apiKey) => {
  const hashRecibido = generarHash(apiKey);

  for (const registro of apiKeys) {
    if (compararSeguro(hashRecibido, registro.hash)) return registro;
  }

  return null;
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  buscarClientePorApiKey
};
