// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");
const asistentesService = require("../services/asistentes.service");
const boletasService = require("../services/boletas.service");

// ========================================
// Lectura del cuerpo
// ========================================
// matchedData devuelve solo los campos declarados en el validador, por lo que
// cualquier campo extra enviado por el cliente se descarta. Es la protección
// contra Mass Assignment: nunca se lee req.body directamente.
const leerDatos = (req) => matchedData(req, { locations: ["body"] });

// ========================================
// GET todos
// ========================================
const obtenerAsistentes = (req, res) => {
  res.status(200).json(asistentesService.obtenerAsistentes());
};

// ========================================
// GET por id
// ========================================
const obtenerAsistentePorId = (req, res) => {
  const asistente = asistentesService.obtenerAsistentePorId(req.params.id);

  if (!asistente) {
    return res.status(404).json({ mensaje: "Asistente no encontrado" });
  }

  res.status(200).json(asistente);
};

// ========================================
// GET /mio
// Los datos de asistente de quien presenta el token
// ========================================
// El id no viaja en la dirección: sale del token. Así nadie puede pedir los
// datos de otra persona cambiando un número, y la Sala no necesita preguntar
// si un documento existe.
const obtenerMiAsistente = (req, res) => {
  const asistente = asistentesService.buscarAsistentePorUsuario(req.usuario.id);

  if (!asistente) {
    return res
      .status(404)
      .json({ mensaje: "Tu cuenta todavía no tiene datos de asistente" });
  }

  res.status(200).json(asistente);
};

// ========================================
// POST /mio
// Liga unos datos de asistente a la cuenta del token
// ========================================
const crearMiAsistente = (req, res) => {
  const datos = leerDatos(req);

  if (asistentesService.buscarAsistentePorUsuario(req.usuario.id)) {
    return res
      .status(409)
      .json({ mensaje: "Tu cuenta ya tiene datos de asistente" });
  }

  if (asistentesService.buscarAsistentePorDocumento(datos.documento)) {
    return res
      .status(409)
      .json({ mensaje: "Ese documento ya está registrado en el teatro" });
  }

  const asistente = asistentesService.crearAsistente(datos, req.usuario.id);

  res.status(201).json({ mensaje: "Asistente creado correctamente", asistente });
};

// ========================================
// POST
// El documento no se puede repetir
// ========================================
const crearAsistente = (req, res) => {
  const datos = leerDatos(req);

  if (asistentesService.buscarAsistentePorDocumento(datos.documento)) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe un asistente con ese documento" });
  }

  const asistente = asistentesService.crearAsistente(datos);

  res.status(201).json({ mensaje: "Asistente creado correctamente", asistente });
};

// ========================================
// PUT
// ========================================
const actualizarAsistente = (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  if (!asistentesService.obtenerAsistentePorId(id)) {
    return res.status(404).json({ mensaje: "Asistente no encontrado" });
  }

  if (asistentesService.buscarAsistentePorDocumento(datos.documento, id)) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe otro asistente con ese documento" });
  }

  const asistente = asistentesService.actualizarAsistente(id, datos);

  res
    .status(200)
    .json({ mensaje: "Asistente actualizado correctamente", asistente });
};

// ========================================
// PATCH
// ========================================
const actualizarAsistenteParcial = (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  if (Object.keys(datos).length === 0) {
    return res
      .status(400)
      .json({ mensaje: "Debe enviar al menos un campo para actualizar" });
  }

  if (!asistentesService.obtenerAsistentePorId(id)) {
    return res.status(404).json({ mensaje: "Asistente no encontrado" });
  }

  if (
    datos.documento &&
    asistentesService.buscarAsistentePorDocumento(datos.documento, id)
  ) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe otro asistente con ese documento" });
  }

  const asistente = asistentesService.actualizarAsistenteParcial(id, datos);

  res
    .status(200)
    .json({ mensaje: "Asistente actualizado correctamente", asistente });
};

// ========================================
// DELETE
// Un asistente con boletas asociadas no se elimina
// ========================================
const eliminarAsistente = (req, res) => {
  const { id } = req.params;

  if (!asistentesService.obtenerAsistentePorId(id)) {
    return res.status(404).json({ mensaje: "Asistente no encontrado" });
  }

  if (boletasService.asistenteTieneBoletas(id)) {
    return res.status(409).json({
      mensaje: "No se puede eliminar el asistente porque tiene boletas asociadas"
    });
  }

  asistentesService.eliminarAsistente(id);

  res.status(200).json({ mensaje: "Asistente eliminado correctamente" });
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerAsistentes,
  obtenerAsistentePorId,
  obtenerMiAsistente,
  crearMiAsistente,
  crearAsistente,
  actualizarAsistente,
  actualizarAsistenteParcial,
  eliminarAsistente
};
