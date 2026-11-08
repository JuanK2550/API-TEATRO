-- ========================================
-- API_TEATRO · Códigos de recuperación
-- ========================================
-- Ocho códigos de un solo uso que la persona genera estando autenticada y
-- guarda por su cuenta. Sirven para recobrar el acceso sin depender de que
-- haya un administrador disponible.
--
-- Igual que con los tokens, se guarda solo el hash. La diferencia con una
-- contraseña es la entropía: un código son 128 bits aleatorios, así que SHA-256
-- basta y no hace falta bcrypt, que existe para resistir fuerza bruta sobre
-- secretos que elige una persona.

BEGIN;

CREATE TABLE IF NOT EXISTS public.codigos_recuperacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    usuario_id BIGINT NOT NULL
        REFERENCES public.usuarios(id) ON DELETE CASCADE,

    -- SHA-256 en hexadecimal: 64 caracteres exactos.
    codigo_hash VARCHAR(64) NOT NULL UNIQUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_uso TIMESTAMPTZ,

    CONSTRAINT ck_codigos_fecha_uso
        CHECK (fecha_uso IS NULL OR fecha_uso >= fecha_creacion),

    CONSTRAINT ck_codigos_hash
        CHECK (codigo_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_codigos_usuario
    ON public.codigos_recuperacion(usuario_id);

-- ========================================
-- Seguridad de filas y permisos
-- ========================================
-- Mismo motivo que en 08: api_teatro no es dueño ni omite RLS, así que la
-- tabla necesita su GRANT y su política para que la API pueda usarla.
ALTER TABLE public.codigos_recuperacion ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.codigos_recuperacion
    FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON SEQUENCE public.codigos_recuperacion_id_seq
    FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.codigos_recuperacion TO api_teatro;

GRANT USAGE, SELECT
    ON SEQUENCE public.codigos_recuperacion_id_seq TO api_teatro;

DROP POLICY IF EXISTS api_teatro_total ON public.codigos_recuperacion;
CREATE POLICY api_teatro_total ON public.codigos_recuperacion
    FOR ALL TO api_teatro USING (TRUE) WITH CHECK (TRUE);

COMMIT;
