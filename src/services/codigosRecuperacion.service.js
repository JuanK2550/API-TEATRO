// ========================================
// Importaciones
// ========================================
const crypto = require("node:crypto");

const { consultar, enTransaccion } = require("../config/database");
const {
  generarPasswordHash,
  verificarPassword
} = require("../utils/password.util");

// ========================================
// Configuración
// ========================================
const CODIGOS_POR_LOTE = 8;
const BYTES_POR_CODIGO = 16;

// ========================================
// Forma de un código
// Ocho grupos de cuatro, separados por guiones
// ========================================
// Los guiones son para que una persona pueda copiarlo a mano sin perderse. Al
// guardarlo y al compararlo se quitan, así que da igual cómo lo escriba quien
// lo usa: con guiones o sin ellos, en mayúsculas o en minúsculas.
const normalizar = (codigo) => codigo.replace(/-/g, "").toUpperCase();

const huella = (codigo) =>
  crypto.createHash("sha256").update(normalizar(codigo)).digest("hex");

const codigoNuevo = () =>
  crypto
    .randomBytes(BYTES_POR_CODIGO)
    .toString("hex")
    .toUpperCase()
    .match(/.{1,4}/g)
    .join("-");

// ========================================
// Generar el lote
// Exige la contraseña actual: es una reautenticación
// ========================================
// Tener el token no basta para pedir los códigos. Si alguien se sentara en una
// sesión abierta, podría llevarse ocho llaves permanentes de la cuenta; pedir
// la contraseña otra vez cierra esa puerta.
const generar = async (usuarioId, passwordActual) =>
  enTransaccion(async (consulta) => {
    const { rows } = await consulta(
      `SELECT id, activo, password_hash
       FROM public.usuarios
       WHERE id = $1
       FOR UPDATE`,
      [usuarioId]
    );

    const usuario = rows[0];

    if (
      !usuario ||
      !usuario.activo ||
      !(await verificarPassword(passwordActual, usuario.password_hash))
    ) {
      return { estado: "NO_AUTORIZADO" };
    }

    // Regenerar sustituye el lote entero: los códigos anteriores desaparecen.
    await consulta(
      "DELETE FROM public.codigos_recuperacion WHERE usuario_id = $1",
      [usuarioId]
    );

    const codigos = Array.from({ length: CODIGOS_POR_LOTE }, codigoNuevo);

    for (const codigo of codigos) {
      await consulta(
        `INSERT INTO public.codigos_recuperacion (usuario_id, codigo_hash)
         VALUES ($1, $2)`,
        [usuarioId, huella(codigo)]
      );
    }

    // Es la única vez que los códigos existen en claro. A partir de aquí la
    // base solo guarda sus hashes.
    return { estado: "OK", codigos };
  });

// ========================================
// Cuántos quedan sin usar
// ========================================
const disponibles = async (usuarioId) => {
  const { rows } = await consultar(
    `SELECT COUNT(*)::int AS disponibles
     FROM public.codigos_recuperacion
     WHERE usuario_id = $1 AND fecha_uso IS NULL`,
    [usuarioId]
  );

  return rows[0].disponibles;
};

// ========================================
// Restablecer con un código
// Lo consume y sube la versión de sesión
// ========================================
const restablecer = async (email, codigo, passwordNueva) => {
  const passwordHash = await generarPasswordHash(passwordNueva);

  return enTransaccion(async (consulta) => {
    // Se bloquea primero la cuenta y después el código, el mismo orden que usa
    // la generación: así dos operaciones simultáneas no se bloquean entre sí.
    const cuenta = await consulta(
      `SELECT id, activo, password_hash
       FROM public.usuarios
       WHERE LOWER(email) = LOWER($1)
       FOR UPDATE`,
      [email]
    );

    const usuario = cuenta.rows[0];

    if (!usuario || !usuario.activo) return { estado: "INVALIDO" };

    const encontrado = await consulta(
      `SELECT id
       FROM public.codigos_recuperacion
       WHERE usuario_id = $1 AND codigo_hash = $2 AND fecha_uso IS NULL
       FOR UPDATE`,
      [usuario.id, huella(codigo)]
    );

    if (!encontrado.rows[0]) return { estado: "INVALIDO" };

    if (await verificarPassword(passwordNueva, usuario.password_hash)) {
      return { estado: "MISMA_CLAVE" };
    }

    await consulta(
      `UPDATE public.usuarios
       SET password_hash = $1, version_sesion = version_sesion + 1
       WHERE id = $2`,
      [passwordHash, usuario.id]
    );

    // Solo se gasta el código usado: los otros siete siguen sirviendo.
    await consulta(
      "UPDATE public.codigos_recuperacion SET fecha_uso = NOW() WHERE id = $1",
      [encontrado.rows[0].id]
    );

    // Un token administrativo emitido antes deja de servir: la persona ya
    // recuperó el acceso por su cuenta.
    await consulta(
      `UPDATE public.password_reset_tokens
       SET fecha_uso = NOW()
       WHERE usuario_id = $1 AND fecha_uso IS NULL`,
      [usuario.id]
    );

    return { estado: "OK" };
  });
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  generar,
  disponibles,
  restablecer
};
