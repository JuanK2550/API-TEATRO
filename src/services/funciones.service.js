// ========================================
// Importaciones
// ========================================
const { consultar, enTransaccion } = require("../config/database");

// ========================================
// Máquina de estados
// Toda función nace programada; finalizada y cancelada son terminales
// ========================================
// La tabla vive en el código y no en la base: es una regla de negocio sobre
// qué cambio se permite, no una restricción sobre qué valores existen. Los
// valores sí los vigila el CHECK de la columna estado.
const ESTADO_INICIAL = "programada";

const TRANSICIONES = {
  programada: ["en_venta", "cancelada"],
  en_venta: ["agotada", "en_curso", "cancelada"],
  agotada: ["en_curso", "cancelada"],
  en_curso: ["finalizada"],
  finalizada: [],
  cancelada: []
};

const ESTADOS = Object.keys(TRANSICIONES);

const ESTADOS_NO_MODIFICABLES = ["en_curso", "finalizada", "cancelada"];

// ========================================
// Transición permitida
// ========================================
const esTransicionPermitida = (estadoActual, estadoNuevo) =>
  (TRANSICIONES[estadoActual] || []).includes(estadoNuevo);

// ========================================
// Estado modificable
// ========================================
const esEstadoModificable = (estado) => !ESTADOS_NO_MODIFICABLES.includes(estado);

// ========================================
// De fila de PostgreSQL a objeto de la API
// ========================================
// La API siempre ha devuelto la función con sus tarifas y sus descuentos
// dentro. En la base viven en dos tablas aparte, así que la consulta las
// vuelve a armar con json_agg y aquí solo se renombra.
// PostgreSQL devuelve TIME como "19:00:00" y la API siempre ha dicho "19:00",
// que es además el formato que exige el validador. Los segundos se recortan
// aquí, en la frontera, para que ni los controladores ni la Sala se enteren de
// que el tipo de la columna trae más precisión de la que el teatro usa.
const aHoraCorta = (hora) =>
  typeof hora === "string" ? hora.slice(0, 5) : hora;

const aFuncion = (fila) =>
  fila
    ? {
        id: fila.id,
        eventoId: fila.evento_id,
        fecha: fila.fecha,
        hora: aHoraCorta(fila.hora),
        estado: fila.estado,
        tarifas: fila.tarifas || [],
        descuentosHabilitados: fila.descuentos || []
      }
    : null;

// Las tarifas salen ordenadas por localidad para que tarifas[0] sea siempre la
// misma, como ocurría con el arreglo en memoria.
const SELECCION = `
  SELECT f.id,
         f.evento_id,
         f.fecha,
         f.hora,
         f.estado,
         COALESCE((
           SELECT json_agg(
                    json_build_object('localidadId', t.localidad_id, 'precio', t.precio)
                    ORDER BY t.localidad_id
                  )
           FROM public.funcion_tarifas t
           WHERE t.funcion_id = f.id
         ), '[]'::json) AS tarifas,
         COALESCE((
           SELECT json_agg(d.tipo ORDER BY d.tipo)
           FROM public.funcion_descuentos d
           WHERE d.funcion_id = f.id
         ), '[]'::json) AS descuentos
  FROM public.funciones f
`;

// ========================================
// Escribir las tarifas y los descuentos de una función
// Se reemplazan por completo, igual que hacía el arreglo
// ========================================
// Deja cada tarifa con sus dos campos válidos: es la protección contra Mass
// Assignment dentro de un array, que aquí además queda sellada porque la
// inserción solo nombra dos columnas.
const escribirHijas = async (ejecutar, funcionId, tarifas, descuentos) => {
  if (tarifas) {
    await ejecutar(`DELETE FROM public.funcion_tarifas WHERE funcion_id = $1`, [
      funcionId
    ]);

    for (const tarifa of tarifas) {
      await ejecutar(
        `INSERT INTO public.funcion_tarifas (funcion_id, localidad_id, precio)
         VALUES ($1, $2, $3)`,
        [funcionId, Number(tarifa.localidadId), Number(tarifa.precio)]
      );
    }
  }

  if (descuentos) {
    await ejecutar(`DELETE FROM public.funcion_descuentos WHERE funcion_id = $1`, [
      funcionId
    ]);

    for (const tipo of descuentos) {
      await ejecutar(
        `INSERT INTO public.funcion_descuentos (funcion_id, tipo) VALUES ($1, $2)`,
        [funcionId, tipo]
      );
    }
  }
};

// Vuelve a leer la función completa dentro de la misma transacción.
const leerCompleta = async (ejecutar, id) => {
  const { rows } = await ejecutar(`${SELECCION} WHERE f.id = $1`, [Number(id)]);
  return aFuncion(rows[0]);
};

// ========================================
// Obtener todas
// ========================================
const obtenerFunciones = async () => {
  const { rows } = await consultar(`${SELECCION} ORDER BY f.id`);
  return rows.map(aFuncion);
};

// ========================================
// Obtener por id
// ========================================
const obtenerFuncionPorId = async (id) => {
  const { rows } = await consultar(`${SELECCION} WHERE f.id = $1`, [Number(id)]);
  return aFuncion(rows[0]);
};

// ========================================
// Obtener por evento
// ========================================
const obtenerFuncionesPorEvento = async (eventoId) => {
  const { rows } = await consultar(
    `${SELECCION} WHERE f.evento_id = $1 ORDER BY f.id`,
    [Number(eventoId)]
  );

  return rows.map(aFuncion);
};

// ========================================
// Conflicto de agenda
// La sala es única: una función cancelada libera su franja
// ========================================
// La misma condición existe como índice único parcial en la base. Aquí se
// consulta para poder responder 409 con un mensaje propio, en vez de dejar que
// el error de PostgreSQL llegue como un 500.
const funcionTieneConflicto = async (fecha, hora, funcionIdExcluir = null) => {
  const { rows } = await consultar(
    `SELECT 1
     FROM public.funciones
     WHERE fecha = $1
       AND hora = $2
       AND estado <> 'cancelada'
       AND ($3::bigint IS NULL OR id <> $3)
     LIMIT 1`,
    [fecha, hora, funcionIdExcluir === null ? null : Number(funcionIdExcluir)]
  );

  return rows.length > 0;
};

// ========================================
// Obtener tarifas
// Los precios con los datos de cada localidad, ordenados por cercanía
// ========================================
const obtenerTarifasDeFuncion = async (id) => {
  const funcion = await obtenerFuncionPorId(id);
  if (!funcion) return null;

  const { rows } = await consultar(
    `SELECT t.localidad_id,
            l.codigo,
            l.nombre,
            l.orden,
            l.activa,
            t.precio
     FROM public.funcion_tarifas t
     JOIN public.localidades l ON l.id = t.localidad_id
     WHERE t.funcion_id = $1
     ORDER BY l.orden`,
    [Number(id)]
  );

  return {
    funcionId: funcion.id,
    eventoId: funcion.eventoId,
    fecha: funcion.fecha,
    hora: funcion.hora,
    estado: funcion.estado,
    tarifas: rows.map((f) => ({
      localidadId: f.localidad_id,
      codigo: f.codigo,
      nombre: f.nombre,
      orden: f.orden,
      activa: f.activa,
      precio: f.precio
    })),
    descuentosHabilitados: funcion.descuentosHabilitados
  };
};

// ========================================
// Crear
// El estado lo administra la API: toda función nace programada
// ========================================
const crearFuncion = async (datos) =>
  enTransaccion(async (ejecutar) => {
    const { rows } = await ejecutar(
      `INSERT INTO public.funciones (evento_id, fecha, hora, estado)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [Number(datos.eventoId), datos.fecha, datos.hora, ESTADO_INICIAL]
    );

    const id = rows[0].id;

    await escribirHijas(
      ejecutar,
      id,
      datos.tarifas,
      datos.descuentosHabilitados ?? []
    );

    return leerCompleta(ejecutar, id);
  });

// ========================================
// Actualizar completo
// Conserva el id y el estado
// ========================================
const actualizarFuncion = async (id, datos) =>
  enTransaccion(async (ejecutar) => {
    const { rowCount } = await ejecutar(
      `UPDATE public.funciones
       SET evento_id = $2, fecha = $3, hora = $4
       WHERE id = $1`,
      [Number(id), Number(datos.eventoId), datos.fecha, datos.hora]
    );

    if (rowCount === 0) return null;

    await escribirHijas(
      ejecutar,
      Number(id),
      datos.tarifas,
      datos.descuentosHabilitados ?? []
    );

    return leerCompleta(ejecutar, id);
  });

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor
// ========================================
const actualizarFuncionParcial = async (id, datos) =>
  enTransaccion(async (ejecutar) => {
    const { rowCount } = await ejecutar(
      `UPDATE public.funciones
       SET evento_id = COALESCE($2, evento_id),
           fecha = COALESCE($3, fecha),
           hora = COALESCE($4, hora)
       WHERE id = $1`,
      [
        Number(id),
        datos.eventoId ?? null,
        datos.fecha ?? null,
        datos.hora ?? null
      ]
    );

    if (rowCount === 0) return null;

    // Solo se reemplazan las hijas que llegaron: undefined conserva lo que hay.
    await escribirHijas(
      ejecutar,
      Number(id),
      datos.tarifas,
      datos.descuentosHabilitados
    );

    return leerCompleta(ejecutar, id);
  });

// ========================================
// Cambiar estado
// Único punto donde se modifica el estado
// ========================================
// La fila actualizada se devuelve desde el propio RETURNING, no releyendo la
// tabla: en PostgreSQL, un SELECT que acompaña a un WITH que modifica datos
// trabaja sobre la foto anterior y devolvería el estado viejo. Las tarifas y
// los descuentos sí se pueden consultar aparte, porque el UPDATE no los toca.
const cambiarEstadoFuncion = async (id, estado) => {
  const { rows } = await consultar(
    `WITH cambiada AS (
       UPDATE public.funciones
       SET estado = $2
       WHERE id = $1
       RETURNING id, evento_id, fecha, hora, estado
     )
     SELECT c.id,
            c.evento_id,
            c.fecha,
            c.hora,
            c.estado,
            COALESCE((
              SELECT json_agg(
                       json_build_object('localidadId', t.localidad_id, 'precio', t.precio)
                       ORDER BY t.localidad_id
                     )
              FROM public.funcion_tarifas t
              WHERE t.funcion_id = c.id
            ), '[]'::json) AS tarifas,
            COALESCE((
              SELECT json_agg(d.tipo ORDER BY d.tipo)
              FROM public.funcion_descuentos d
              WHERE d.funcion_id = c.id
            ), '[]'::json) AS descuentos
     FROM cambiada c`,
    [Number(id), estado]
  );

  return aFuncion(rows[0]);
};

// ========================================
// Eliminar
// ========================================
// Las tarifas y los descuentos se van con ella: su clave foránea es ON DELETE
// CASCADE, porque sin su función no significan nada.
const eliminarFuncion = async (id) => {
  const funcion = await obtenerFuncionPorId(id);
  if (!funcion) return null;

  await consultar(`DELETE FROM public.funciones WHERE id = $1`, [Number(id)]);

  return funcion;
};

// ========================================
// Integridad referencial
// Cuentan todas las funciones, sea cual sea su estado
// ========================================
const eventoTieneFunciones = async (eventoId) => {
  const { rows } = await consultar(
    `SELECT 1 FROM public.funciones WHERE evento_id = $1 LIMIT 1`,
    [Number(eventoId)]
  );

  return rows.length > 0;
};

const localidadTieneTarifas = async (localidadId) => {
  const { rows } = await consultar(
    `SELECT 1 FROM public.funcion_tarifas WHERE localidad_id = $1 LIMIT 1`,
    [Number(localidadId)]
  );

  return rows.length > 0;
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  ESTADOS,
  ESTADO_INICIAL,
  TRANSICIONES,
  esTransicionPermitida,
  esEstadoModificable,
  obtenerFunciones,
  obtenerFuncionPorId,
  obtenerFuncionesPorEvento,
  obtenerTarifasDeFuncion,
  funcionTieneConflicto,
  eventoTieneFunciones,
  localidadTieneTarifas,
  crearFuncion,
  actualizarFuncion,
  actualizarFuncionParcial,
  cambiarEstadoFuncion,
  eliminarFuncion
};
