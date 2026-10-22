-- ========================================
-- API_TEATRO · Roles de negocio y seguridad inicial
-- ========================================
-- Siembra los tres roles del teatro, activa Row Level Security en las nueve
-- tablas y retira el acceso directo de los roles de API de Supabase.

BEGIN;

-- ========================================
-- Los tres roles del teatro
-- ========================================
INSERT INTO public.roles
    (nombre, descripcion)
VALUES
    (
        'administrador',
        'Gestiona la programación, las localidades, los usuarios y la boletería'
    ),
    (
        'taquilla',
        'Atiende al público: vende boletas y consulta las de cualquier asistente'
    ),
    (
        'asistente',
        'Compra sus boletas y consulta solo las suyas'
    );

-- ========================================
-- Row Level Security en las nueve tablas
-- ========================================
-- Se activa desde el principio, antes de escribir ninguna política. Con RLS
-- habilitado y sin políticas, nadie lee nada por la vía directa: es el estado
-- seguro por defecto. Las políticas se diseñarán al integrar Supabase Auth.
ALTER TABLE public.roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localidades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcion_tarifas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcion_descuentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistentes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletas            ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Sin acceso directo para los roles de API
-- ========================================
-- anon, authenticated y service_role son los roles con los que entra la API de
-- datos de Supabase. La API_TEATRO no pasa por ahí: se conecta con su propio
-- usuario de PostgreSQL. Quitarles el permiso evita que una tabla quede
-- expuesta por descuido mientras no existan las políticas.
--
-- service_role importa más que los otros dos: es el rol de la clave de
-- servicio, se salta RLS por diseño, y Supabase le concede todo sobre cada
-- objeto nuevo de public. Quien tuviera esa clave podría leer y escribir las
-- nueve tablas por PostgREST sin pasar por la API ni por sus reglas.
REVOKE ALL ON TABLE
    public.roles,
    public.usuarios,
    public.eventos,
    public.localidades,
    public.funciones,
    public.funcion_tarifas,
    public.funcion_descuentos,
    public.asistentes,
    public.boletas
FROM anon, authenticated, service_role;

COMMIT;
