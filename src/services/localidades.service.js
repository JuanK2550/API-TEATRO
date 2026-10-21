// ========================================
// Importaciones
// ========================================
const { consultar } = require("../config/database");

// ========================================
// De fila de PostgreSQL a objeto de la API
// ========================================
// La base usa snake_case y la API camelCase. El mapeo vive aquí, en el único
// punto que habla con la base, para que ni los controladores ni las respuestas
// cambien de forma por haber migrado.
const aLocalidad = (fila) =>
  fila
    ? {
        id: fila.id,
        codigo: fila.codigo,
        nombre: fila.nombre,
        orden: fila.orden,
        filas: fila.filas,
        butacasPorFila: fila.butacas_por_fila,
        capacidad: fila.capacidad,
        activa: fila.activa
      }
    : null;

// capacidad es columna generada: se lee, nunca se escribe.
const COLUMNAS = `
  id, codigo, nombre, orden, filas, butacas_por_fila, capacidad, activa
`;

// ========================================
// Obtener todas
// ========================================
const obtenerLocalidades = async () => {
  const { rows } = await consultar(`
    SELECT ${COLUMNAS}
    FROM public.localidades
    ORDER BY id
  `);

  return rows.map(aLocalidad);
};

// ========================================
// Obtener por id
// ========================================
const obtenerLocalidadPorId = async (id) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM public.localidades WHERE id = $1`,
    [Number(id)]
  );

  return aLocalidad(rows[0]);
};

// ========================================
// Buscar por código
// idExcluido evita que un registro choque consigo mismo al actualizarse
// ========================================
const buscarLocalidadPorCodigo = async (codigo, idExcluido = null) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS}
     FROM public.localidades
     WHERE codigo = $1
       AND ($2::bigint IS NULL OR id <> $2)`,
    [codigo, idExcluido === null ? null : Number(idExcluido)]
  );

  return aLocalidad(rows[0]);
};

// ========================================
// Buscar por orden
// Dos localidades no pueden estar a la misma distancia del escenario
// ========================================
const buscarLocalidadPorOrden = async (orden, idExcluido = null) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS}
     FROM public.localidades
     WHERE orden = $1
       AND ($2::bigint IS NULL OR id <> $2)`,
    [Number(orden), idExcluido === null ? null : Number(idExcluido)]
  );

  return aLocalidad(rows[0]);
};

// ========================================
// Crear
// La localidad nace activa y la capacidad la calcula la base
// ========================================
const crearLocalidad = async (datos) => {
  const { rows } = await consultar(
    `INSERT INTO public.localidades
       (codigo, nombre, orden, filas, butacas_por_fila, activa)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING ${COLUMNAS}`,
    [
      datos.codigo,
      datos.nombre,
      Number(datos.orden),
      Number(datos.filas),
      Number(datos.butacasPorFila)
    ]
  );

  return aLocalidad(rows[0]);
};

// ========================================
// Actualizar completo
// Conserva el id y el campo activa
// ========================================
const actualizarLocalidad = async (id, datos) => {
  const { rows } = await consultar(
    `UPDATE public.localidades
     SET codigo = $2,
         nombre = $3,
         orden = $4,
         filas = $5,
         butacas_por_fila = $6
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      Number(id),
      datos.codigo,
      datos.nombre,
      Number(datos.orden),
      Number(datos.filas),
      Number(datos.butacasPorFila)
    ]
  );

  return aLocalidad(rows[0]);
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor
// ========================================
// COALESCE hace en SQL lo mismo que hacía ?? en memoria: si el parámetro llega
// nulo, se queda el valor de la columna.
const actualizarLocalidadParcial = async (id, datos) => {
  const { rows } = await consultar(
    `UPDATE public.localidades
     SET codigo = COALESCE($2, codigo),
         nombre = COALESCE($3, nombre),
         orden = COALESCE($4, orden),
         filas = COALESCE($5, filas),
         butacas_por_fila = COALESCE($6, butacas_por_fila)
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      Number(id),
      datos.codigo ?? null,
      datos.nombre ?? null,
      datos.orden ?? null,
      datos.filas ?? null,
      datos.butacasPorFila ?? null
    ]
  );

  return aLocalidad(rows[0]);
};

// ========================================
// Cambiar estado
// Único punto donde se modifica el campo activa
// ========================================
const cambiarEstadoLocalidad = async (id, activa) => {
  const { rows } = await consultar(
    `UPDATE public.localidades
     SET activa = $2
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [Number(id), activa]
  );

  return aLocalidad(rows[0]);
};

// ========================================
// Eliminar
// ========================================
const eliminarLocalidad = async (id) => {
  const { rows } = await consultar(
    `DELETE FROM public.localidades
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [Number(id)]
  );

  return aLocalidad(rows[0]);
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerLocalidades,
  obtenerLocalidadPorId,
  buscarLocalidadPorCodigo,
  buscarLocalidadPorOrden,
  crearLocalidad,
  actualizarLocalidad,
  actualizarLocalidadParcial,
  cambiarEstadoLocalidad,
  eliminarLocalidad
};
