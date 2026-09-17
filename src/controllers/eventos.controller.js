// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");
const eventosService = require("../services/eventos.service");

// ========================================
// Lectura del cuerpo
// ========================================
// matchedData devuelve solo los campos declarados en el validador, por lo que
// cualquier campo extra enviado por el cliente se descarta. Es la protección
// contra Mass Assignment: nunca se lee req.body directamente. Por eso el
// campo activo, que no está declarado, jamás llega hasta el service.
const leerDatos = (req) => matchedData(req, { locations: ["body"] });

// ========================================
// GET todos
// ========================================
const obtenerEventos = (req, res) => {
  res.status(200).json(eventosService.obtenerEventos());
};

// ========================================
// GET por id
// ========================================
const obtenerEventoPorId = (req, res) => {
  const evento = eventosService.obtenerEventoPorId(req.params.id);

  if (!evento) {
    return res.status(404).json({ mensaje: "Evento no encontrado" });
  }

  res.status(200).json(evento);
};

// ========================================
// POST
// El evento siempre nace activo
// ========================================
const crearEvento = (req, res) => {
  const datos = leerDatos(req);
  const evento = eventosService.crearEvento(datos);

  res.status(201).json({ mensaje: "Evento creado correctamente", evento });
};

// ========================================
// PUT
// ========================================
const actualizarEvento = (req, res) => {
  const datos = leerDatos(req);
  const evento = eventosService.actualizarEvento(req.params.id, datos);

  if (!evento) {
    return res.status(404).json({ mensaje: "Evento no encontrado" });
  }

  res.status(200).json({ mensaje: "Evento actualizado correctamente", evento });
};

// ========================================
// PATCH
// ========================================
const actualizarEventoParcial = (req, res) => {
  const datos = leerDatos(req);

  if (Object.keys(datos).length === 0) {
    return res
      .status(400)
      .json({ mensaje: "Debe enviar al menos un campo para actualizar" });
  }

  const evento = eventosService.actualizarEventoParcial(req.params.id, datos);

  if (!evento) {
    return res.status(404).json({ mensaje: "Evento no encontrado" });
  }

  res.status(200).json({ mensaje: "Evento actualizado correctamente", evento });
};

// ========================================
// PATCH estado
// Único endpoint que activa o desactiva un evento
// ========================================
const cambiarEstadoEvento = (req, res) => {
  const { activo } = leerDatos(req);
  const evento = eventosService.cambiarEstadoEvento(req.params.id, activo);

  if (!evento) {
    return res.status(404).json({ mensaje: "Evento no encontrado" });
  }

  res.status(200).json({
    mensaje: activo
      ? "Evento activado correctamente"
      : "Evento desactivado correctamente",
    evento
  });
};

// ========================================
// DELETE
// ========================================
const eliminarEvento = (req, res) => {
  const evento = eventosService.eliminarEvento(req.params.id);

  if (!evento) {
    return res.status(404).json({ mensaje: "Evento no encontrado" });
  }

  res.status(200).json({ mensaje: "Evento eliminado correctamente" });
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerEventos,
  obtenerEventoPorId,
  crearEvento,
  actualizarEvento,
  actualizarEventoParcial,
  cambiarEstadoEvento,
  eliminarEvento
};
