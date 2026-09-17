// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");
const localidadesService = require("../services/localidades.service");

// ========================================
// Lectura del cuerpo
// ========================================
// matchedData devuelve solo los campos declarados en el validador, por lo que
// cualquier campo extra enviado por el cliente se descarta. Es la protección
// contra Mass Assignment: nunca se lee req.body directamente. Por eso los
// campos capacidad y activa, que no están declarados, jamás llegan al service.
const leerDatos = (req) => matchedData(req, { locations: ["body"] });

// ========================================
// GET todas
// ========================================
const obtenerLocalidades = (req, res) => {
  res.status(200).json(localidadesService.obtenerLocalidades());
};

// ========================================
// GET por id
// ========================================
const obtenerLocalidadPorId = (req, res) => {
  const localidad = localidadesService.obtenerLocalidadPorId(req.params.id);

  if (!localidad) {
    return res.status(404).json({ mensaje: "Localidad no encontrada" });
  }

  res.status(200).json(localidad);
};

// ========================================
// POST
// El código y el orden no se pueden repetir
// ========================================
const crearLocalidad = (req, res) => {
  const datos = leerDatos(req);

  if (localidadesService.buscarLocalidadPorCodigo(datos.codigo)) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe una localidad con ese código" });
  }

  if (localidadesService.buscarLocalidadPorOrden(datos.orden)) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe una localidad con ese orden" });
  }

  const localidad = localidadesService.crearLocalidad(datos);

  res
    .status(201)
    .json({ mensaje: "Localidad creada correctamente", localidad });
};

// ========================================
// PUT
// ========================================
const actualizarLocalidad = (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  if (!localidadesService.obtenerLocalidadPorId(id)) {
    return res.status(404).json({ mensaje: "Localidad no encontrada" });
  }

  if (localidadesService.buscarLocalidadPorCodigo(datos.codigo, id)) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe otra localidad con ese código" });
  }

  if (localidadesService.buscarLocalidadPorOrden(datos.orden, id)) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe otra localidad con ese orden" });
  }

  const localidad = localidadesService.actualizarLocalidad(id, datos);

  res
    .status(200)
    .json({ mensaje: "Localidad actualizada correctamente", localidad });
};

// ========================================
// PATCH
// ========================================
const actualizarLocalidadParcial = (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  if (Object.keys(datos).length === 0) {
    return res
      .status(400)
      .json({ mensaje: "Debe enviar al menos un campo para actualizar" });
  }

  if (!localidadesService.obtenerLocalidadPorId(id)) {
    return res.status(404).json({ mensaje: "Localidad no encontrada" });
  }

  if (
    datos.codigo &&
    localidadesService.buscarLocalidadPorCodigo(datos.codigo, id)
  ) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe otra localidad con ese código" });
  }

  if (
    datos.orden &&
    localidadesService.buscarLocalidadPorOrden(datos.orden, id)
  ) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe otra localidad con ese orden" });
  }

  const localidad = localidadesService.actualizarLocalidadParcial(id, datos);

  res
    .status(200)
    .json({ mensaje: "Localidad actualizada correctamente", localidad });
};

// ========================================
// PATCH estado
// Único endpoint que activa o desactiva una localidad
// ========================================
const cambiarEstadoLocalidad = (req, res) => {
  const { activa } = leerDatos(req);
  const localidad = localidadesService.cambiarEstadoLocalidad(
    req.params.id,
    activa
  );

  if (!localidad) {
    return res.status(404).json({ mensaje: "Localidad no encontrada" });
  }

  res.status(200).json({
    mensaje: activa
      ? "Localidad activada correctamente"
      : "Localidad desactivada correctamente",
    localidad
  });
};

// ========================================
// DELETE
// ========================================
const eliminarLocalidad = (req, res) => {
  const localidad = localidadesService.eliminarLocalidad(req.params.id);

  if (!localidad) {
    return res.status(404).json({ mensaje: "Localidad no encontrada" });
  }

  res.status(200).json({ mensaje: "Localidad eliminada correctamente" });
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerLocalidades,
  obtenerLocalidadPorId,
  crearLocalidad,
  actualizarLocalidad,
  actualizarLocalidadParcial,
  cambiarEstadoLocalidad,
  eliminarLocalidad
};
