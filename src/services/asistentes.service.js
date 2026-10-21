// ========================================
// Importaciones
// ========================================
const { consultar } = require("../config/database");

// ========================================
// De fila de PostgreSQL a objeto de la API
// ========================================
const aAsistente = (fila) =>
  fila
    ? {
        id: fila.id,
        nombre: fila.nombre,
        documento: fila.documento,
        email: fila.email,
        telefono: fila.telefono,
        fechaNacimiento: fila.fecha_nacimiento,
        usuarioId: fila.usuario_id
      }
    : null;

const COLUMNAS = `
  id, nombre, documento, email, telefono, fecha_nacimiento, usuario_id
`;

// ========================================
// Obtener todos
// ========================================
const obtenerAsistentes = async () => {
  const { rows } = await consultar(`
    SELECT ${COLUMNAS}
    FROM public.asistentes
    ORDER BY id
  `);

  return rows.map(aAsistente);
};

// ========================================
// Obtener por id
// ========================================
const obtenerAsistentePorId = async (id) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM public.asistentes WHERE id = $1`,
    [Number(id)]
  );

  return aAsistente(rows[0]);
};

// ========================================
// Buscar por documento
// idExcluido evita que un registro choque consigo mismo al actualizarse
// ========================================
const buscarAsistentePorDocumento = async (documento, idExcluido = null) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS}
     FROM public.asistentes
     WHERE documento = $1
       AND ($2::bigint IS NULL OR id <> $2)`,
    [documento, idExcluido === null ? null : Number(idExcluido)]
  );

  return aAsistente(rows[0]);
};

// ========================================
// Buscar por usuario
// Qué asistente corresponde a una cuenta
// ========================================
const buscarAsistentePorUsuario = async (usuarioId) => {
  if (usuarioId === null || usuarioId === undefined) return null;

  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM public.asistentes WHERE usuario_id = $1`,
    [Number(usuarioId)]
  );

  return aAsistente(rows[0]);
};

// ========================================
// Crear
// usuarioId lo pone el controlador, nunca el cliente
// ========================================
// El vínculo con la cuenta sale del JWT o se queda en null: es la diferencia
// entre un asistente que se identifica solo y uno que registró la taquilla.
const crearAsistente = async (datos, usuarioId = null) => {
  const { rows } = await consultar(
    `INSERT INTO public.asistentes
       (nombre, documento, email, telefono, fecha_nacimiento, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNAS}`,
    [
      datos.nombre,
      datos.documento,
      datos.email,
      datos.telefono,
      datos.fechaNacimiento,
      usuarioId === null || usuarioId === undefined ? null : Number(usuarioId)
    ]
  );

  return aAsistente(rows[0]);
};

// ========================================
// Actualizar completo
// Reemplaza todos los campos y conserva el id
// ========================================
// El vínculo con la cuenta se fija si llega y se conserva si no: nunca se
// borra por omisión, porque editar un nombre no debe desvincular una cuenta.
const actualizarAsistente = async (id, datos) => {
  const { rows } = await consultar(
    `UPDATE public.asistentes
     SET nombre = $2,
         documento = $3,
         email = $4,
         telefono = $5,
         fecha_nacimiento = $6,
         usuario_id = COALESCE($7, usuario_id)
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      Number(id),
      datos.nombre,
      datos.documento,
      datos.email,
      datos.telefono,
      datos.fechaNacimiento,
      datos.usuarioId ?? null
    ]
  );

  return aAsistente(rows[0]);
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor
// ========================================
const actualizarAsistenteParcial = async (id, datos) => {
  const { rows } = await consultar(
    `UPDATE public.asistentes
     SET nombre = COALESCE($2, nombre),
         documento = COALESCE($3, documento),
         email = COALESCE($4, email),
         telefono = COALESCE($5, telefono),
         fecha_nacimiento = COALESCE($6, fecha_nacimiento),
         usuario_id = COALESCE($7, usuario_id)
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      Number(id),
      datos.nombre ?? null,
      datos.documento ?? null,
      datos.email ?? null,
      datos.telefono ?? null,
      datos.fechaNacimiento ?? null,
      datos.usuarioId ?? null
    ]
  );

  return aAsistente(rows[0]);
};

// ========================================
// Eliminar
// ========================================
const eliminarAsistente = async (id) => {
  const { rows } = await consultar(
    `DELETE FROM public.asistentes
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [Number(id)]
  );

  return aAsistente(rows[0]);
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerAsistentes,
  obtenerAsistentePorId,
  buscarAsistentePorDocumento,
  buscarAsistentePorUsuario,
  crearAsistente,
  actualizarAsistente,
  actualizarAsistenteParcial,
  eliminarAsistente
};
