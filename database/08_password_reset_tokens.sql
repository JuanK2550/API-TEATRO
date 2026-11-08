-- ========================================
-- API_TEATRO · Recuperación autorizada por un administrador
-- ========================================
-- Cuando alguien pierde el acceso, un administrador emite un token temporal
-- que esa persona usa una sola vez para poner una contraseña nueva.
--
-- Se guarda el hash del token, no el token. Si alguien llegara a leer esta
-- tabla, encontraría hashes inservibles: con el hash no se puede restablecer
-- nada, porque el endpoint compara contra el hash de lo que le envían. La
-- fecha de expiración limita la vigencia y la de uso impide reutilizarlo.
--
-- administrador_id deja constancia de quién autorizó cada recuperación. Es lo
-- más parecido a una auditoría que tiene el proyecto.

BEGIN;

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- La cuenta que recupera el acceso. Si se borra, sus tokens se van con ella.
    usuario_id BIGINT NOT NULL
        REFERENCES public.usuarios(id) ON DELETE CASCADE,

    -- Quién lo autorizó. Sin ON DELETE CASCADE a propósito: borrar a un
    -- administrador no debe borrar el rastro de lo que autorizó.
    administrador_id BIGINT NOT NULL
        REFERENCES public.usuarios(id),

    -- SHA-256 en hexadecimal: 64 caracteres exactos.
    token_hash VARCHAR(64) NOT NULL UNIQUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion TIMESTAMPTZ NOT NULL,
    fecha_uso TIMESTAMPTZ,

    CONSTRAINT ck_reset_expiracion
        CHECK (fecha_expiracion > fecha_creacion),

    CONSTRAINT ck_reset_uso
        CHECK (fecha_uso IS NULL OR fecha_uso >= fecha_creacion),

    CONSTRAINT ck_reset_token_hash
        CHECK (token_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_reset_usuario
    ON public.password_reset_tokens(usuario_id);

CREATE INDEX IF NOT EXISTS idx_reset_expiracion
    ON public.password_reset_tokens(fecha_expiracion);

-- ========================================
-- Seguridad de filas y permisos
-- ========================================
-- Aquí está la diferencia con el proyecto de referencia, y es la que decide si
-- la tabla funciona o no. Allí el pool se conecta con el dueño de las tablas,
-- que se salta RLS, así que basta con revocar a los roles públicos. En el
-- teatro la API entra con api_teatro, que no es dueño y no omite RLS: sin un
-- GRANT y una política no vería ni una fila.
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.password_reset_tokens
    FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON SEQUENCE public.password_reset_tokens_id_seq
    FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.password_reset_tokens TO api_teatro;

GRANT USAGE, SELECT
    ON SEQUENCE public.password_reset_tokens_id_seq TO api_teatro;

DROP POLICY IF EXISTS api_teatro_total ON public.password_reset_tokens;
CREATE POLICY api_teatro_total ON public.password_reset_tokens
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

COMMIT;
