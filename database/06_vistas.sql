-- ========================================
-- API_TEATRO · Vistas de consulta
-- ========================================
-- Las nueve tablas están normalizadas, que es lo correcto para guardar, pero
-- incómodo para mirar: para entender una boleta hay que cruzar cinco tablas.
-- Estas vistas hacen ese cruce una vez y quedan guardadas, así que en el Table
-- Editor de Supabase se ven como si fueran tablas.
--
-- Son de solo lectura y no cambian nada del modelo: la API sigue consultando
-- las tablas. Existen para revisar los datos y para las evidencias.

BEGIN;

-- ========================================
-- LA PROGRAMACIÓN
-- Cada función con su evento, sus precios y cuánto se ha vendido
-- ========================================
CREATE OR REPLACE VIEW public.v_programacion AS
SELECT
    f.id                AS funcion_id,
    e.titulo            AS evento,
    e.tipo,
    e.clasificacion_edad,
    e.duracion_minutos,
    f.fecha,
    TO_CHAR(f.hora, 'HH24:MI') AS hora,
    f.estado,

    -- Los precios de esa función, de la localidad más cercana al escenario
    -- a la más lejana.
    (
        SELECT STRING_AGG(
                   l.codigo || ': $' || TO_CHAR(t.precio, 'FM999G999'),
                   '  ·  ' ORDER BY l.orden
               )
        FROM public.funcion_tarifas t
        JOIN public.localidades l ON l.id = t.localidad_id
        WHERE t.funcion_id = f.id
    ) AS tarifas,

    (
        SELECT STRING_AGG(d.tipo, ', ' ORDER BY d.tipo)
        FROM public.funcion_descuentos d
        WHERE d.funcion_id = f.id
    ) AS descuentos,

    -- Una boleta cancelada libera su butaca, así que no cuenta como vendida.
    (
        SELECT COUNT(*)
        FROM public.boletas b
        WHERE b.funcion_id = f.id AND b.estado <> 'cancelada'
    ) AS boletas_vendidas,

    (
        SELECT COALESCE(SUM(b.precio), 0)
        FROM public.boletas b
        WHERE b.funcion_id = f.id AND b.estado <> 'cancelada'
    ) AS recaudo

FROM public.funciones f
JOIN public.eventos e ON e.id = f.evento_id
ORDER BY f.fecha, f.hora;

-- ========================================
-- LA BOLETERÍA
-- Cada boleta con quién la compró, a qué va y dónde se sienta
-- ========================================
CREATE OR REPLACE VIEW public.v_boletas AS
SELECT
    b.codigo,
    b.estado,
    a.nombre            AS asistente,
    a.documento,
    e.titulo            AS evento,
    f.fecha,
    TO_CHAR(f.hora, 'HH24:MI') AS hora,
    l.nombre            AS localidad,
    'Fila ' || b.fila || ', butaca ' || b.numero AS butaca,
    b.tipo_descuento    AS descuento,
    b.precio,

    -- De qué cuenta salió, si salió de alguna. Los asistentes que registró la
    -- taquilla no tienen usuario detrás.
    u.email             AS cuenta,
    r.nombre            AS rol_de_la_cuenta

FROM public.boletas b
JOIN public.asistentes a  ON a.id = b.asistente_id
JOIN public.funciones f   ON f.id = b.funcion_id
JOIN public.eventos e     ON e.id = f.evento_id
JOIN public.localidades l ON l.id = b.localidad_id
LEFT JOIN public.usuarios u ON u.id = a.usuario_id
LEFT JOIN public.roles r    ON r.id = u.rol_id
ORDER BY b.id;

-- ========================================
-- Permisos
-- ========================================
-- El rol de la aplicación puede leerlas. Una vista hereda las políticas RLS de
-- las tablas que consulta, así que no abre ninguna puerta nueva.
GRANT SELECT ON public.v_programacion, public.v_boletas TO api_teatro;

COMMIT;
