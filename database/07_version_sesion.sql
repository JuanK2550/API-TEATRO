-- ========================================
-- API_TEATRO · Versión de sesión
-- ========================================
-- Un JWT firmado es válido hasta que expira: el servidor no lo guarda y no
-- puede retirarlo. Si alguien cambia su contraseña porque sospecha que se la
-- robaron, el token que el ladrón ya tiene sigue funcionando hasta una hora
-- después. Esta columna cierra esa ventana.
--
-- Cada token lleva dentro la versión de sesión de su dueño. Al cambiar o
-- restablecer la contraseña, la versión sube en uno y todos los tokens
-- emitidos antes dejan de coincidir: el middleware los rechaza.
--
-- No toca las cuentas ni sus contraseñas: solo agrega la columna, con valor
-- cero para las que ya existen.

BEGIN;

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS version_sesion INTEGER NOT NULL DEFAULT 0;

-- Una versión nunca retrocede ni es negativa.
ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS ck_usuarios_version_sesion;

ALTER TABLE public.usuarios
    ADD CONSTRAINT ck_usuarios_version_sesion
        CHECK (version_sesion >= 0);

COMMIT;
