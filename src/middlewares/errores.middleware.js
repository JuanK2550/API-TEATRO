// ========================================
// Ruta no encontrada
// Se monta al final: si ningún router respondió, la petición llega aquí
// ========================================
const rutaNoEncontrada = (req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
};

// ========================================
// Mensajes de los errores de cliente
// express.json rechaza el cuerpo con su propio código 4xx
// ========================================
const MENSAJES_CLIENTE = {
  400: "El cuerpo de la petición no es un JSON válido",
  413: "El cuerpo de la petición supera el tamaño permitido",
  415: "La codificación del contenido de la petición no es compatible"
};

// ========================================
// Código de error del cliente
// Devuelve el código 4xx que trae el error, o null si no lo trae
// ========================================
const codigoDeCliente = (error) => {
  const codigo = Number(error.status || error.statusCode);
  return Number.isInteger(codigo) && codigo >= 400 && codigo < 500 ? codigo : null;
};

// ========================================
// Manejar error
// Registra el detalle en consola y devuelve al cliente un mensaje genérico
// ========================================
const manejarError = (error, req, res, next) => {
  const codigoCliente = codigoDeCliente(error);

  if (codigoCliente) {
    console.warn(
      `Petición rechazada: ${codigoCliente} en ${req.method} ${req.originalUrl}`
    );

    return res.status(codigoCliente).json({
      mensaje: MENSAJES_CLIENTE[codigoCliente] || "Petición inválida"
    });
  }

  console.error("Error no controlado:", error);

  res.status(500).json({ mensaje: "Error interno del servidor" });
};

// ========================================
// Exportaciones
// ========================================
module.exports = { rutaNoEncontrada, manejarError };
