// ========================================
// Importaciones
// ========================================
const { consultar } = require("../config/database");

// ========================================
// De fila de PostgreSQL a objeto de la API
// ========================================
const aEvento = (fila) =>
  fila
    ? {
        id: fila.id,
        titulo: fila.titulo,
        tipo: fila.tipo,
        descripcion: fila.descripcion,
        duracionMinutos: fila.duracion_minutos,
        clasificacionEdad: fila.clasificacion_edad,
        activo: fila.activo
      }
    : null;

const COLUMNAS = `
  id, titulo, tipo, descripcion, duracion_minutos, clasificacion_edad, activo
`;

// ========================================
// Obtener todos
// ========================================
const obtenerEventos = async () => {
  const { rows } = await consultar(`
    SELECT ${COLUMNAS}
    FROM public.eventos
    ORDER BY id
  `);

  return rows.map(aEvento);
};

// ========================================
// Obtener por id
// ========================================
const obtenerEventoPorId = async (id) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM public.eventos WHERE id = $1`,
    [Number(id)]
  );

  return aEvento(rows[0]);
};

// ========================================
// Crear
// Todo evento nace activo
// ========================================
const crearEvento = async (datos) => {
  const { rows } = await consultar(
    `INSERT INTO public.eventos
       (titulo, tipo, descripcion, duracion_minutos, clasificacion_edad, activo)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING ${COLUMNAS}`,
    [
      datos.titulo,
      datos.tipo,
      datos.descripcion,
      Number(datos.duracionMinutos),
      datos.clasificacionEdad
    ]
  );

  return aEvento(rows[0]);
};

// ========================================
// Actualizar completo
// Conserva el id y el campo activo
// ========================================
const actualizarEvento = async (id, datos) => {
  const { rows } = await consultar(
    `UPDATE public.eventos
     SET titulo = $2,
         tipo = $3,
         descripcion = $4,
         duracion_minutos = $5,
         clasificacion_edad = $6
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      Number(id),
      datos.titulo,
      datos.tipo,
      datos.descripcion,
      Number(datos.duracionMinutos),
      datos.clasificacionEdad
    ]
  );

  return aEvento(rows[0]);
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor
// ========================================
const actualizarEventoParcial = async (id, datos) => {
  const { rows } = await consultar(
    `UPDATE public.eventos
     SET titulo = COALESCE($2, titulo),
         tipo = COALESCE($3, tipo),
         descripcion = COALESCE($4, descripcion),
         duracion_minutos = COALESCE($5, duracion_minutos),
         clasificacion_edad = COALESCE($6, clasificacion_edad)
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      Number(id),
      datos.titulo ?? null,
      datos.tipo ?? null,
      datos.descripcion ?? null,
      datos.duracionMinutos ?? null,
      datos.clasificacionEdad ?? null
    ]
  );

  return aEvento(rows[0]);
};

// ========================================
// Cambiar estado
// Único punto donde se modifica el campo activo
// ========================================
const cambiarEstadoEvento = async (id, activo) => {
  const { rows } = await consultar(
    `UPDATE public.eventos
     SET activo = $2
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [Number(id), activo]
  );

  return aEvento(rows[0]);
};

// ========================================
// Eliminar
// ========================================
const eliminarEvento = async (id) => {
  const { rows } = await consultar(
    `DELETE FROM public.eventos
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [Number(id)]
  );

  return aEvento(rows[0]);
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
