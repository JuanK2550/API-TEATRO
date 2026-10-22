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
// Choques de unicidad de PostgreSQL
// La última línea de defensa cuando dos peticiones compiten
// ========================================
// Los controllers comprueban la unicidad antes de escribir, pero comprobar y
// escribir son dos consultas: entre una y otra cabe otra petición. Quien
// impide de verdad el duplicado es el índice único, y su error llega aquí.
// Sin esta traducción el perdedor de la carrera recibiría un 500, cuando lo
// ocurrido es un conflicto del cliente.
const MENSAJES_UNICIDAD = {
  uq_funciones_sala: "Ya existe una función programada en esa fecha y hora",
  uq_boletas_butaca: "La butaca ya está ocupada en esta función",
  asistentes_documento_key: "Ya existe un asistente con ese documento",
  asistentes_email_key: "Ya existe un asistente con ese correo electrónico",
  asistentes_usuario_id_key: "Ese usuario ya está asociado a otro asistente",
  localidades_codigo_key: "Ya existe una localidad con ese código",
  localidades_orden_key: "Ya existe una localidad con ese orden",
  usuarios_email_key: "Ya existe un usuario con ese correo electrónico",
  boletas_codigo_key: "Ya existe una boleta con ese código"
};

const CODIGO_UNICIDAD = "23505";

// ========================================
// Manejar error
// Registra el detalle en consola y devuelve al cliente un mensaje genérico
// ========================================
const manejarError = (error, req, res, next) => {
  if (error && error.code === CODIGO_UNICIDAD) {
    console.warn(
      `Conflicto de unicidad: ${error.constraint || "sin restricción"} en ${req.method} ${req.originalUrl}`
    );

    return res.status(409).json({
      mensaje:
        MENSAJES_UNICIDAD[error.constraint] ||
        "El registro entra en conflicto con otro que ya existe"
    });
  }

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
