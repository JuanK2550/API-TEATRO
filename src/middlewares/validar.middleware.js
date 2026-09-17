// ========================================
// Importaciones
// ========================================
const { validationResult } = require("express-validator");

// ========================================
// Validar
// Corta la petición con 400 si alguna cadena de validación acumuló errores
// ========================================
const validar = (req, res, next) => {
  const errores = validationResult(req);

  if (!errores.isEmpty()) {
    return res.status(400).json({
      mensaje: "Datos de entrada inválidos",
      errores: errores.array().map((error) => ({
        campo: error.path,
        mensaje: error.msg
      }))
    });
  }

  next();
};

// ========================================
// Exportaciones
// ========================================
module.exports = { validar };
