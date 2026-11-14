// ========================================
// Importaciones
// ========================================
const { consultar } = require("../config/database");

// ========================================
// Constantes
// ========================================
const ESTADOS_BOLETA = ["reservada", "pagada", "usada", "cancelada"];
const MESES_EN_LA_SERIE = 6;

// ========================================
// Resumen del teatro para el panel administrativo
// Solo totales agregados, sin un dato personal
// ========================================
const obtenerResumen = async () => {
  const totales = await consultar(`
    SELECT
      (SELECT COUNT(*)::int FROM public.usuarios)    AS usuarios,
      (SELECT COUNT(*)::int FROM public.eventos)     AS eventos,
      (SELECT COUNT(*)::int FROM public.funciones)   AS funciones,
      (SELECT COUNT(*)::int FROM public.localidades) AS localidades,
      (SELECT COUNT(*)::int FROM public.asistentes)  AS asistentes,
      (SELECT COUNT(*)::int FROM public.boletas)     AS boletas,
      (SELECT COALESCE(SUM(precio), 0)::bigint
         FROM public.boletas
         WHERE estado IN ('pagada', 'usada'))        AS ingresos
  `);

  const porEstado = await consultar(`
    SELECT estado, COUNT(*)::int AS total
    FROM public.boletas
    GROUP BY estado
  `);

  const porMes = await consultar(
    `SELECT TO_CHAR(f.fecha, 'YYYY-MM') AS mes, COUNT(*)::int AS total
     FROM public.boletas b
     JOIN public.funciones f ON f.id = b.funcion_id
     WHERE b.estado <> 'cancelada'
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT $1`,
    [MESES_EN_LA_SERIE]
  );

  const boletasPorEstado = Object.fromEntries(ESTADOS_BOLETA.map((estado) => [estado, 0]));
  for (const { estado, total } of porEstado.rows) boletasPorEstado[estado] = total;

  const fila = totales.rows[0];

  return {
    resumen: { ...fila, ingresos: Number(fila.ingresos) },
    boletasPorEstado,
    boletasPorMes: porMes.rows.reverse()
  };
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  obtenerResumen
};
