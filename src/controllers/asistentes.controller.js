// ========================================
// Importaciones
// ========================================
const { matchedData } = require("express-validator");
const asistentesService = require("../services/asistentes.service");
const boletasService = require("../services/boletas.service");
const usuariosService = require("../services/usuarios.service");

// ========================================
// Lectura del cuerpo
// ========================================
// matchedData devuelve solo los campos declarados en el validador, por lo que
// cualquier campo extra enviado por el cliente se descarta. Es la protección
// contra Mass Assignment: nunca se lee req.body directamente.
const leerDatos = (req) => matchedData(req, { locations: ["body"] });

// ========================================
// Validar la asociación con una cuenta
// Devuelve null o { status, mensaje }, con status como código HTTP
// ========================================
// El 403 va primero a propósito. Si se comprobara antes si el usuario existe,
// la taquilla podría averiguar qué ids de usuario hay probándolos uno por uno:
// el 400 y el 409 son respuestas distintas del 403, y esa diferencia ya es
// información. Primero se decide si el rol puede preguntar, y solo después se
// mira el dato.
const validarAsociacionUsuario = async (datos, rol, asistenteIdExcluir = null) => {
  if (datos.usuarioId === undefined) return null;

  if (rol !== "administrador") {
    return {
      status: 403,
      mensaje: "Solo un administrador puede asociar un asistente a una cuenta"
    };
  }

  const usuario = await usuariosService.obtenerUsuarioPorId(datos.usuarioId);

  if (!usuario) {
    return { status: 400, mensaje: "El usuario asociado no existe" };
  }

  if (usuario.rol !== "asistente") {
    return {
      status: 409,
      mensaje: "Solo una cuenta con el rol asistente se puede asociar a un asistente"
    };
  }

  const yaAsociado = await asistentesService.buscarAsistentePorUsuario(
    datos.usuarioId
  );

  if (yaAsociado && yaAsociado.id !== Number(asistenteIdExcluir)) {
    return {
      status: 409,
      mensaje: "Ese usuario ya está asociado a otro asistente"
    };
  }

  return null;
};

// ========================================
// GET todos
// ========================================
const obtenerAsistentes = async (req, res) => {
  res.status(200).json(await asistentesService.obtenerAsistentes());
};

// ========================================
// GET por id
// ========================================
const obtenerAsistentePorId = async (req, res) => {
  const asistente = await asistentesService.obtenerAsistentePorId(req.params.id);

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
const obtenerMiAsistente = async (req, res) => {
  const asistente = await asistentesService.buscarAsistentePorUsuario(req.usuario.id);

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
const crearMiAsistente = async (req, res) => {
  const datos = leerDatos(req);

  // Aquí el vínculo sale del token, así que enviarlo en el cuerpo es intentar
  // ligarse a otra cuenta: se responde 403 en vez de descartarlo en silencio.
  const problema = await validarAsociacionUsuario(datos, req.usuario.rol);
  if (problema) {
    return res.status(problema.status).json({ mensaje: problema.mensaje });
  }

  if (await asistentesService.buscarAsistentePorUsuario(req.usuario.id)) {
    return res
      .status(409)
      .json({ mensaje: "Tu cuenta ya tiene datos de asistente" });
  }

  if (await asistentesService.buscarAsistentePorDocumento(datos.documento)) {
    return res
      .status(409)
      .json({ mensaje: "Ese documento ya está registrado en el teatro" });
  }

  const asistente = await asistentesService.crearAsistente(datos, req.usuario.id);

  res.status(201).json({ mensaje: "Asistente creado correctamente", asistente });
};

// ========================================
// PATCH /mio
// El asistente edita sus propios datos, sin id en la dirección
// ========================================
// La identidad sale del token, igual que en GET y POST /mio: no hay ningún id
// que cambiar para editar a otra persona. El usuarioId no se puede tocar por
// aquí, porque es el vínculo con la cuenta y no un dato de la persona.
const actualizarMiAsistente = async (req, res) => {
  const datos = leerDatos(req);

  const problema = await validarAsociacionUsuario(datos, req.usuario.rol);
  if (problema) {
    return res.status(problema.status).json({ mensaje: problema.mensaje });
  }

  if (Object.keys(datos).length === 0) {
    return res
      .status(400)
      .json({ mensaje: "Debe enviar al menos un campo para actualizar" });
  }

  const propio = await asistentesService.buscarAsistentePorUsuario(req.usuario.id);

  if (!propio) {
    return res
      .status(404)
      .json({ mensaje: "Tu cuenta todavía no tiene datos de asistente" });
  }

  if (
    datos.documento &&
    await asistentesService.buscarAsistentePorDocumento(datos.documento, propio.id)
  ) {
    return res
      .status(409)
      .json({ mensaje: "Ese documento ya está registrado en el teatro" });
  }

  const asistente = await asistentesService.actualizarAsistenteParcial(
    propio.id,
    datos
  );

  res
    .status(200)
    .json({ mensaje: "Asistente actualizado correctamente", asistente });
};

// ========================================
// POST
// El documento no se puede repetir
// ========================================
const crearAsistente = async (req, res) => {
  const datos = leerDatos(req);

  const problema = await validarAsociacionUsuario(datos, req.usuario.rol);
  if (problema) {
    return res.status(problema.status).json({ mensaje: problema.mensaje });
  }

  if (await asistentesService.buscarAsistentePorDocumento(datos.documento)) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe un asistente con ese documento" });
  }

  const asistente = await asistentesService.crearAsistente(
    datos,
    datos.usuarioId ?? null
  );

  res.status(201).json({ mensaje: "Asistente creado correctamente", asistente });
};

// ========================================
// PUT
// ========================================
const actualizarAsistente = async (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  const problema = await validarAsociacionUsuario(datos, req.usuario.rol, id);
  if (problema) {
    return res.status(problema.status).json({ mensaje: problema.mensaje });
  }

  if (!await asistentesService.obtenerAsistentePorId(id)) {
    return res.status(404).json({ mensaje: "Asistente no encontrado" });
  }

  if (await asistentesService.buscarAsistentePorDocumento(datos.documento, id)) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe otro asistente con ese documento" });
  }

  const asistente = await asistentesService.actualizarAsistente(id, datos);

  res
    .status(200)
    .json({ mensaje: "Asistente actualizado correctamente", asistente });
};

// ========================================
// PATCH
// ========================================
const actualizarAsistenteParcial = async (req, res) => {
  const { id } = req.params;
  const datos = leerDatos(req);

  const problema = await validarAsociacionUsuario(datos, req.usuario.rol, id);
  if (problema) {
    return res.status(problema.status).json({ mensaje: problema.mensaje });
  }

  if (Object.keys(datos).length === 0) {
    return res
      .status(400)
      .json({ mensaje: "Debe enviar al menos un campo para actualizar" });
  }

  if (!await asistentesService.obtenerAsistentePorId(id)) {
    return res.status(404).json({ mensaje: "Asistente no encontrado" });
  }

  if (
    datos.documento &&
    await asistentesService.buscarAsistentePorDocumento(datos.documento, id)
  ) {
    return res
      .status(409)
      .json({ mensaje: "Ya existe otro asistente con ese documento" });
  }

  const asistente = await asistentesService.actualizarAsistenteParcial(id, datos);

  res
    .status(200)
    .json({ mensaje: "Asistente actualizado correctamente", asistente });
};

// ========================================
// DELETE
// Un asistente con boletas asociadas no se elimina
// ========================================
const eliminarAsistente = async (req, res) => {
  const { id } = req.params;

  if (!await asistentesService.obtenerAsistentePorId(id)) {
    return res.status(404).json({ mensaje: "Asistente no encontrado" });
  }

  if (await boletasService.asistenteTieneBoletas(id)) {
    return res.status(409).json({
      mensaje: "No se puede eliminar el asistente porque tiene boletas asociadas"
    });
  }

  await asistentesService.eliminarAsistente(id);

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
  actualizarMiAsistente,
  crearAsistente,
  actualizarAsistente,
  actualizarAsistenteParcial,
  eliminarAsistente
};
