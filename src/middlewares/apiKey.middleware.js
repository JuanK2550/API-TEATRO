// ========================================
// Importaciones
// ========================================
const { buscarClientePorApiKey } = require("../services/apiKeys.service");

// ========================================
// Validación de la API Key
// 401 si no se reconoce la clave; 403 si se reconoce pero está deshabilitada
// ========================================
const validarApiKey = (req, res, next) => {
  const apiKeyRecibida = req.get("X-API-Key");

  if (!apiKeyRecibida) {
    return res.status(401).json({ mensaje: "API Key requerida" });
  }

  const cliente = buscarClientePorApiKey(apiKeyRecibida);

  if (!cliente) {
    return res.status(401).json({ mensaje: "API Key inválida" });
  }

  if (!cliente.activa) {
    return res.status(403).json({ mensaje: "API Key deshabilitada" });
  }

  req.clienteApi = { id: cliente.id, nombre: cliente.cliente };

  next();
};

// ========================================
// Exportaciones
// ========================================
module.exports = validarApiKey;
