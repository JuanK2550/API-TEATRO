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
  crearAsistente,
  actualizarAsistente,
  actualizarAsistenteParcial,
  eliminarAsistente
};
