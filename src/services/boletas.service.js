// ========================================
// Importaciones
// ========================================
const { consultar } = require("../config/database");

// ========================================
// Descuentos
// Única fuente de los porcentajes
// ========================================
const PORCENTAJES_DESCUENTO = {
  ninguno: 0,
  estudiante: 0.2,
  infantil: 0.5,
  adultoMayor: 0.3
};

const TIPOS_DESCUENTO = Object.keys(PORCENTAJES_DESCUENTO);
const DESCUENTO_POR_DEFECTO = "ninguno";

// ========================================
// Límites de venta
// ========================================
const LIMITE_BOLETAS_POR_ASISTENTE = 6;

// ========================================
// Máquina de estados
// Toda boleta nace reservada; usada y cancelada son terminales
// ========================================
const ESTADO_INICIAL = "reservada";

const TRANSICIONES = {
  reservada: ["pagada", "cancelada"],
  pagada: ["usada", "cancelada"],
  usada: [],
  cancelada: []
};

const ESTADOS = Object.keys(TRANSICIONES);

const ESTADOS_MODIFICABLES = ["reservada"];
const ESTADOS_ELIMINABLES = ["reservada", "cancelada"];

// ========================================
// Transición permitida
// ========================================
const esTransicionPermitida = (estadoActual, estadoNuevo) =>
  (TRANSICIONES[estadoActual] || []).includes(estadoNuevo);

// ========================================
// Boleta modificable
// ========================================
const esBoletaModificable = (estado) => ESTADOS_MODIFICABLES.includes(estado);

// ========================================
// Boleta eliminable
// ========================================
const esBoletaEliminable = (estado) => ESTADOS_ELIMINABLES.includes(estado);

// ========================================
// De fila de PostgreSQL a objeto de la API
// ========================================
const aBoleta = (fila) =>
  fila
    ? {
        id: fila.id,
        asistenteId: fila.asistente_id,
        funcionId: fila.funcion_id,
        localidadId: fila.localidad_id,
        fila: fila.fila,
        numero: fila.numero,
        tipoDescuento: fila.tipo_descuento,
        precio: fila.precio,
        codigo: fila.codigo,
        estado: fila.estado
      }
    : null;

const COLUMNAS = `
  id, asistente_id, funcion_id, localidad_id, fila, numero,
  tipo_descuento, precio, codigo, estado
`;

// Una boleta cancelada libera la butaca y deja de contar para los límites.
const VIVA = `estado <> 'cancelada'`;

// ========================================
// Obtener todas
// ========================================
const obtenerBoletas = async () => {
  const { rows } = await consultar(`
    SELECT ${COLUMNAS} FROM public.boletas ORDER BY id
  `);

  return rows.map(aBoleta);
};

// ========================================
// Obtener por id
// ========================================
const obtenerBoletaPorId = async (id) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM public.boletas WHERE id = $1`,
    [Number(id)]
  );

  return aBoleta(rows[0]);
};

// ========================================
// Obtener por función
// ========================================
const obtenerBoletasPorFuncion = async (funcionId) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM public.boletas WHERE funcion_id = $1 ORDER BY id`,
    [Number(funcionId)]
  );

  return rows.map(aBoleta);
};

// ========================================
// Obtener por asistente
// ========================================
const obtenerBoletasPorAsistente = async (asistenteId) => {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM public.boletas WHERE asistente_id = $1 ORDER BY id`,
    [Number(asistenteId)]
  );

  return rows.map(aBoleta);
};

// ========================================
// Existen boletas activas de una función
// La usa funciones.controller.js para proteger el borrado
// ========================================
const existenBoletasActivasDeFuncion = async (funcionId) => {
  const { rows } = await consultar(
    `SELECT 1 FROM public.boletas WHERE funcion_id = $1 AND ${VIVA} LIMIT 1`,
    [Number(funcionId)]
  );

  return rows.length > 0;
};

// ========================================
// Ocupación de una función
// Solo la butaca: ni el código, ni el precio, ni quién la compró
// ========================================
// Minimización de datos: el plano de sala solo necesita saber qué butacas están
// tomadas. Devolver la boleta entera expondría el documento del comprador y el
// código de su boleta a cualquiera que abriera el navegador. Por eso la
// consulta nombra tres columnas y no un asterisco.
const obtenerOcupacionDeFuncion = async (funcionId) => {
  const { rows } = await consultar(
    `SELECT localidad_id, fila, numero
     FROM public.boletas
     WHERE funcion_id = $1 AND ${VIVA}
     ORDER BY localidad_id, fila, numero`,
    [Number(funcionId)]
  );

  return rows.map((f) => ({
    localidadId: f.localidad_id,
    fila: f.fila,
    numero: f.numero
  }));
};

// ========================================
// Butaca ocupada
// boletaIdExcluir evita que una boleta choque consigo misma al actualizarse
// ========================================
// La base tiene el mismo criterio como índice único parcial. Esta consulta
// existe para poder responder 409 con un mensaje propio en vez de dejar que el
// error de PostgreSQL salga como un 500.
const butacaOcupada = async (
  funcionId,
  localidadId,
  fila,
  numero,
  boletaIdExcluir = null
) => {
  const { rows } = await consultar(
    `SELECT 1
     FROM public.boletas
     WHERE funcion_id = $1
       AND localidad_id = $2
       AND fila = $3
       AND numero = $4
       AND ${VIVA}
       AND ($5::bigint IS NULL OR id <> $5)
     LIMIT 1`,
    [
      Number(funcionId),
      Number(localidadId),
      Number(fila),
      Number(numero),
      boletaIdExcluir === null ? null : Number(boletaIdExcluir)
    ]
  );

  return rows.length > 0;
};

// ========================================
// Contar por función y localidad
// ========================================
const contarBoletasPorFuncionYLocalidad = async (
  funcionId,
  localidadId,
  boletaIdExcluir = null
) => {
  const { rows } = await consultar(
    `SELECT COUNT(*)::int AS n
     FROM public.boletas
     WHERE funcion_id = $1
       AND localidad_id = $2
       AND ${VIVA}
       AND ($3::bigint IS NULL OR id <> $3)`,
    [
      Number(funcionId),
      Number(localidadId),
      boletaIdExcluir === null ? null : Number(boletaIdExcluir)
    ]
  );

  return rows[0].n;
};

// ========================================
// Contar por asistente y función
// ========================================
const contarBoletasPorAsistenteYFuncion = async (
  asistenteId,
  funcionId,
  boletaIdExcluir = null
) => {
  const { rows } = await consultar(
    `SELECT COUNT(*)::int AS n
     FROM public.boletas
     WHERE asistente_id = $1
       AND funcion_id = $2
       AND ${VIVA}
       AND ($3::bigint IS NULL OR id <> $3)`,
    [
      Number(asistenteId),
      Number(funcionId),
      boletaIdExcluir === null ? null : Number(boletaIdExcluir)
    ]
  );

  return rows[0].n;
};

// ========================================
// Cálculo del precio
// ========================================
// El precio JAMÁS proviene del cliente. Siempre se calcula aquí a partir de
// la tarifa registrada en la función y el porcentaje del descuento.
const calcularPrecio = (funcion, localidadId, tipoDescuento) => {
  const tarifa = funcion.tarifas.find(
    (t) => t.localidadId === Number(localidadId)
  );

  if (!tarifa) return null;

  const porcentaje = PORCENTAJES_DESCUENTO[tipoDescuento] ?? 0;

  return Math.round(tarifa.precio * (1 - porcentaje));
};

// ========================================
// Generación del código
// Formato BOL-<año>-<consecutivo de 4 dígitos>, único
// ========================================
// El consecutivo sale del mayor emitido ese año, que ahora pregunta la base en
// lugar de recorrer un arreglo. El bucle sigue estando porque entre leer el
// máximo e insertar puede colarse otra venta: si el código ya existe, se prueba
// el siguiente.
const generarCodigo = async () => {
  const anio = new Date().getFullYear();
  const prefijo = `BOL-${anio}-`;

  const { rows } = await consultar(
    `SELECT COALESCE(MAX(SUBSTRING(codigo FROM 10)::int), 0) AS maximo
     FROM public.boletas
     WHERE codigo LIKE $1`,
    [`${prefijo}%`]
  );

  let siguiente = rows[0].maximo + 1;
  let codigo = prefijo + String(siguiente).padStart(4, "0");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows: existe } = await consultar(
      `SELECT 1 FROM public.boletas WHERE codigo = $1 LIMIT 1`,
      [codigo]
    );

    if (existe.length === 0) return codigo;

    siguiente += 1;
    codigo = prefijo + String(siguiente).padStart(4, "0");
  }
};

// ========================================
// Crear
// ========================================
// El cliente nunca envía precio, codigo ni estado: los tres los administra
// el servidor. Toda boleta nace reservada.
const crearBoleta = async (datos, funcion) => {
  const tipoDescuento = datos.tipoDescuento ?? DESCUENTO_POR_DEFECTO;
  const codigo = await generarCodigo();

  const { rows } = await consultar(
    `INSERT INTO public.boletas
       (asistente_id, funcion_id, localidad_id, fila, numero,
        tipo_descuento, precio, codigo, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${COLUMNAS}`,
    [
      Number(datos.asistenteId),
      Number(datos.funcionId),
      Number(datos.localidadId),
      Number(datos.fila),
      Number(datos.numero),
      tipoDescuento,
      calcularPrecio(funcion, datos.localidadId, tipoDescuento),
      codigo,
      ESTADO_INICIAL
    ]
  );

  return aBoleta(rows[0]);
};

// ========================================
// Actualizar completo
// Conserva el id, el codigo y el estado, y recalcula el precio
// ========================================
const actualizarBoleta = async (id, datos, funcion) => {
  const tipoDescuento = datos.tipoDescuento ?? DESCUENTO_POR_DEFECTO;

  const { rows } = await consultar(
    `UPDATE public.boletas
     SET asistente_id = $2,
         funcion_id = $3,
         localidad_id = $4,
         fila = $5,
         numero = $6,
         tipo_descuento = $7,
         precio = $8
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      Number(id),
      Number(datos.asistenteId),
      Number(datos.funcionId),
      Number(datos.localidadId),
      Number(datos.fila),
      Number(datos.numero),
      tipoDescuento,
      calcularPrecio(funcion, datos.localidadId, tipoDescuento)
    ]
  );

  return aBoleta(rows[0]);
};

// ========================================
// Actualizar parcial
// Los campos que no llegan conservan su valor y el precio se recalcula
// ========================================
// El precio se recalcula siempre, no solo cuando llega la localidad o el
// descuento: cambiar cualquiera de los dos cambia lo que vale la boleta, y
// recalcularlo con los valores finales evita tener que adivinar cuál cambió.
const actualizarBoletaParcial = async (id, datos, funcion) => {
  const actual = await obtenerBoletaPorId(id);
  if (!actual) return null;

  const localidadId = datos.localidadId ?? actual.localidadId;
  const tipoDescuento = datos.tipoDescuento ?? actual.tipoDescuento;

  const { rows } = await consultar(
    `UPDATE public.boletas
     SET asistente_id = COALESCE($2, asistente_id),
         funcion_id = COALESCE($3, funcion_id),
         localidad_id = $4,
         fila = COALESCE($5, fila),
         numero = COALESCE($6, numero),
         tipo_descuento = $7,
         precio = $8
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [
      Number(id),
      datos.asistenteId ?? null,
      datos.funcionId ?? null,
      Number(localidadId),
      datos.fila ?? null,
      datos.numero ?? null,
      tipoDescuento,
      calcularPrecio(funcion, localidadId, tipoDescuento)
    ]
  );

  return aBoleta(rows[0]);
};

// ========================================
// Cambiar estado
// Único punto donde se modifica el estado
// ========================================
const cambiarEstadoBoleta = async (id, estado) => {
  const { rows } = await consultar(
    `UPDATE public.boletas
     SET estado = $2
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [Number(id), estado]
  );

  return aBoleta(rows[0]);
};

// ========================================
// Eliminar
// ========================================
const eliminarBoleta = async (id) => {
  const { rows } = await consultar(
    `DELETE FROM public.boletas WHERE id = $1 RETURNING ${COLUMNAS}`,
    [Number(id)]
  );

  return aBoleta(rows[0]);
};

// ========================================
// Integridad referencial
// Cuentan todas las boletas, incluidas las canceladas
// ========================================
const existeAlguna = async (columna, valor) => {
  const { rows } = await consultar(
    `SELECT 1 FROM public.boletas WHERE ${columna} = $1 LIMIT 1`,
    [Number(valor)]
  );

  return rows.length > 0;
};

const asistenteTieneBoletas = (asistenteId) =>
  existeAlguna("asistente_id", asistenteId);

const funcionTieneBoletas = (funcionId) => existeAlguna("funcion_id", funcionId);

const localidadTieneBoletas = (localidadId) =>
  existeAlguna("localidad_id", localidadId);

// ========================================
// Exportaciones
// ========================================
module.exports = {
  PORCENTAJES_DESCUENTO,
  TIPOS_DESCUENTO,
  DESCUENTO_POR_DEFECTO,
  LIMITE_BOLETAS_POR_ASISTENTE,
  ESTADOS,
  ESTADO_INICIAL,
  TRANSICIONES,
  esTransicionPermitida,
  esBoletaModificable,
  esBoletaEliminable,
  obtenerBoletas,
  obtenerBoletaPorId,
  obtenerBoletasPorFuncion,
  obtenerBoletasPorAsistente,
  existenBoletasActivasDeFuncion,
  obtenerOcupacionDeFuncion,
  butacaOcupada,
  contarBoletasPorFuncionYLocalidad,
  contarBoletasPorAsistenteYFuncion,
  calcularPrecio,
  generarCodigo,
  crearBoleta,
  actualizarBoleta,
  actualizarBoletaParcial,
  cambiarEstadoBoleta,
  eliminarBoleta,
  asistenteTieneBoletas,
  funcionTieneBoletas,
  localidadTieneBoletas
};
