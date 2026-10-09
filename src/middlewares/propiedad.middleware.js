// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");

const asistentesService = require("../services/asistentes.service");
const boletasService = require("../services/boletas.service");

// ========================================
// Roles que ven la boletería completa
// ========================================
// Quien atiende el mostrador necesita ver las boletas de cualquiera para
// atender a quien tiene delante. El asistente solo ve las suyas.
const ROLES_DE_MOSTRADOR = ["administrador", "taquilla"];

// ========================================
// Estados que el dueño de una boleta puede fijar
// usada queda para el mostrador: se marca en la puerta, no desde el móvil
// ========================================
const ESTADOS_DEL_DUENO = ["pagada", "cancelada"];

const MENSAJE_SIN_ASISTENTE = "El usuario no tiene un asistente asociado";
const MENSAJE_AJENO = "No tiene permisos para acceder a este recurso";

// ========================================
// El asistente de quien presenta el token
// Se resuelve desde req.usuario.id, nunca desde el cuerpo ni la dirección
// ========================================
// Es la diferencia entre autorizar y confiar: el id del JWT viene firmado por
// el servidor, cualquier otro id lo escribe el cliente.
const asistenteDelToken = (req) =>
  asistentesService.buscarAsistentePorUsuario(req.usuario.id);

// ========================================
// Autorizar el acceso a los datos de un asistente
// Para GET /api/boletas/asistente/:asistenteId
// ========================================
const autorizarAsistentePropio = (req, res, next) => {
  if (ROLES_DE_MOSTRADOR.includes(req.usuario.rol)) return next();

  const propio = asistenteDelToken(req);

  if (!propio) {
    return res.status(403).json({ mensaje: MENSAJE_SIN_ASISTENTE });
  }

  // El 403 llega antes que el 404 del controlador a propósito: si respondiera
  // 404 para los ids que no existen y 403 para los ajenos, la diferencia entre
  // las dos respuestas diría cuántos asistentes hay registrados.
  if (propio.id !== Number(req.params.asistenteId)) {
    return res.status(403).json({ mensaje: MENSAJE_AJENO });
  }

  next();
};

// ========================================
// Autorizar el acceso a una boleta
// Para GET /api/boletas/:id
// ========================================
const autorizarAccesoBoleta = (req, res, next) => {
  const boleta = boletasService.obtenerBoletaPorId(req.params.id);

  if (!boleta) {
    return res.status(404).json({ mensaje: "Boleta no encontrada" });
  }

  if (ROLES_DE_MOSTRADOR.includes(req.usuario.rol)) return next();

  const propio = asistenteDelToken(req);

  if (!propio) {
    return res.status(403).json({ mensaje: MENSAJE_SIN_ASISTENTE });
  }

  if (boleta.asistenteId !== propio.id) {
    return res.status(403).json({ mensaje: MENSAJE_AJENO });
  }

  req.boleta = boleta;

  next();
};

// ========================================
// Autorizar el cambio de estado de una boleta
// Para PATCH /api/boletas/:id/estado
// ========================================
// Esta guarda decide si el rol puede pedir ese estado sobre esa boleta. Lo que
// no decide es si el cambio es legal: la máquina de estados sigue mandando y
// responde 409 en el controlador. Son dos preguntas distintas y se responden
// por separado.
const autorizarCambioEstadoBoleta = (req, res, next) => {
  const boleta = boletasService.obtenerBoletaPorId(req.params.id);

  if (!boleta) {
    return res.status(404).json({ mensaje: "Boleta no encontrada" });
  }

  if (ROLES_DE_MOSTRADOR.includes(req.usuario.rol)) return next();

  const propio = asistenteDelToken(req);

  if (!propio) {
    return res.status(403).json({ mensaje: MENSAJE_SIN_ASISTENTE });
  }

  if (boleta.asistenteId !== propio.id) {
    return res.status(403).json({ mensaje: MENSAJE_AJENO });
  }

  const { estado } = matchedData(req, { locations: ["body"] });

  if (!ESTADOS_DEL_DUENO.includes(estado)) {
    return res.status(403).json({
      mensaje: `No tiene permisos para cambiar una boleta al estado ${estado}`
    });
  }

  req.boleta = boleta;

  next();
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  autorizarAsistentePropio,
  autorizarAccesoBoleta,
  autorizarCambioEstadoBoleta
};
