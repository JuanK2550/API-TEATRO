-- ========================================
-- API_TEATRO · Rol de la aplicación y políticas RLS
-- ========================================
-- Hasta aquí la API se conectaba como `postgres`: dueño de las tablas, con
-- permiso para crear y borrar objetos y con rolbypassrls en true. Eso tiene dos
-- consecuencias que conviene decir claro:
--
--   1. Si la cadena de conexión se filtra, quien la tenga puede hacer DROP
--      TABLE, no solo leer datos.
--   2. Row Level Security queda desactivado de hecho, porque el dueño de una
--      tabla y un rol con BYPASSRLS no pasan por las políticas. Escribirlas sin
--      cambiar esto sería teatro: aparecerían en el informe sin filtrar nada.
--
-- Este script crea un rol de aplicación con lo mínimo, le da una política
-- explícita y deja a todos los demás fuera.
--
-- Se ejecuta DESPUÉS de 01 y 02. Requiere conectarse como el dueño.
-- La contraseña se pasa por parámetro para no escribirla aquí:
--
--   node scripts/crear-rol-aplicacion.js

BEGIN;

-- ========================================
-- El rol de la aplicación
-- ========================================
-- NOLOGIN se cambia al asignarle contraseña desde el guion. No hereda nada de
-- postgres: empieza sin ningún privilegio sobre nada.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_teatro') THEN
        CREATE ROLE api_teatro NOLOGIN;
    END IF;
END
$$;

-- ========================================
-- Lo mínimo para trabajar
-- ========================================
-- Ver el esquema y usar las secuencias de los id. Nada de CREATE: el rol de la
-- aplicación no crea ni borra tablas, porque la aplicación nunca lo hace.
GRANT USAGE ON SCHEMA public TO api_teatro;

REVOKE CREATE ON SCHEMA public FROM api_teatro;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.roles,
    public.usuarios,
    public.eventos,
    public.localidades,
    public.funciones,
    public.funcion_tarifas,
    public.funcion_descuentos,
    public.asistentes,
    public.boletas
TO api_teatro;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_teatro;

-- Los roles del teatro no se tocan desde la aplicación: se siembran una vez y
-- se quedan. Solo lectura.
REVOKE INSERT, UPDATE, DELETE ON public.roles FROM api_teatro;

-- ========================================
-- RLS que de verdad se aplica
-- ========================================
-- api_teatro no es el dueño de las tablas, así que las políticas SÍ le afectan.
-- Con RLS habilitado y sin una política que le permita algo, no vería ni una
-- fila: ese es el punto de partida, y por eso la política de abajo es
-- necesaria para que la API funcione, no decorativa.
DROP POLICY IF EXISTS api_teatro_total ON public.roles;
CREATE POLICY api_teatro_total ON public.roles
    FOR SELECT TO api_teatro USING (TRUE);

DROP POLICY IF EXISTS api_teatro_total ON public.usuarios;
CREATE POLICY api_teatro_total ON public.usuarios
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS api_teatro_total ON public.eventos;
CREATE POLICY api_teatro_total ON public.eventos
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS api_teatro_total ON public.localidades;
CREATE POLICY api_teatro_total ON public.localidades
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS api_teatro_total ON public.funciones;
CREATE POLICY api_teatro_total ON public.funciones
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS api_teatro_total ON public.funcion_tarifas;
CREATE POLICY api_teatro_total ON public.funcion_tarifas
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS api_teatro_total ON public.funcion_descuentos;
CREATE POLICY api_teatro_total ON public.funcion_descuentos
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS api_teatro_total ON public.asistentes;
CREATE POLICY api_teatro_total ON public.asistentes
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS api_teatro_total ON public.boletas;
CREATE POLICY api_teatro_total ON public.boletas
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

-- ========================================
-- Por qué la política dice TRUE
-- ========================================
-- Porque quién puede ver qué fila lo decide Express: autorizarRoles mira el rol
-- del JWT y las tres guardas de propiedad.middleware.js comprueban que la
-- boleta o el asistente sean de quien pregunta. La API necesita poder leer
-- cualquier fila para poder responder "403, esa no es tuya".
--
-- Para que la política pudiera decir "solo las filas de este usuario", la base
-- tendría que saber quién es el usuario, y hoy esa identidad vive en nuestro
-- JWT, no en la sesión de PostgreSQL. Llevarla ahí es el paso siguiente, y es
-- lo que hará falta cuando se integre Supabase Auth: entonces estas políticas
-- se reescriben con auth.uid() y pasan a filtrar de verdad.
--
-- Lo que esta política SÍ consigue hoy: que anon, authenticated y cualquier
-- rol futuro no vean nada aunque alguien les conceda un GRANT por descuido,
-- porque RLS niega por defecto a quien no tiene política.

COMMIT;
