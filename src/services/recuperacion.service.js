// ========================================
// Importaciones
// ========================================
const crypto = require("node:crypto");

const { enTransaccion } = require("../config/database");
const {
  generarPasswordHash,
  verificarPassword
} = require("../utils/password.util");

// ========================================
// Configuración
// ========================================
const MINUTOS_DE_VIGENCIA = 15;
const BYTES_DEL_TOKEN = 32;

// ========================================
// Huella del token
// Se guarda el hash, nunca el token
// ========================================
// Un token son 32 bytes aleatorios: adivinarlo es inviable, así que no hace
// falta bcrypt. Lo que importa es que la tabla no contenga el valor con el que
// se restablece una contraseña, y para eso SHA-256 basta.
const huella = (token) =>
  crypto.createHash("sha256").update(token, "utf8").digest("hex");

// ========================================
// Generar una recuperación
// La autoriza un administrador para la cuenta de otra persona
// ========================================
const generarRecuperacion = async (usuarioId, administradorId) =>
  enTransaccion(async (consultar) => {
    // FOR UPDATE serializa dos recuperaciones simultáneas de la misma cuenta.
    const { rows } = await consultar(
      "SELECT id, activo FROM public.usuarios WHERE id = $1 FOR UPDATE",
      [usuarioId]
    );

    if (!rows[0] || !rows[0].activo) return { estado: "NO_ENCONTRADO" };

    // Solo un token vigente por cuenta: emitir uno nuevo anula los anteriores.
    await consultar(
      `UPDATE public.password_reset_tokens
       SET fecha_uso = NOW()
       WHERE usuario_id = $1 AND fecha_uso IS NULL`,
      [usuarioId]
    );

    const token = crypto.randomBytes(BYTES_DEL_TOKEN).toString("hex");

    const guardado = await consultar(
      `INSERT INTO public.password_reset_tokens
         (usuario_id, administrador_id, token_hash, fecha_expiracion)
       VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))
       RETURNING fecha_expiracion`,
      [usuarioId, administradorId, huella(token), MINUTOS_DE_VIGENCIA]
    );

    return {
      estado: "OK",
      token,
      expiraEn: guardado.rows[0].fecha_expiracion
    };
  });

// ========================================
// Restablecer con el token
// Consume el token y sube la versión de sesión
// ========================================
const restablecerPassword = async (token, passwordNueva) => {
  // El hash de bcrypt se calcula antes de abrir la transacción: tarda, y
  // mantener la fila bloqueada mientras tanto retrasaría a cualquier otra.
  const passwordHash = await generarPasswordHash(passwordNueva);

  return enTransaccion(async (consultar) => {
    const { rows } = await consultar(
      `SELECT t.id,
              t.usuario_id,
              t.fecha_expiracion,
              t.fecha_uso,
              u.activo,
              u.password_hash
       FROM public.password_reset_tokens t
       JOIN public.usuarios u ON u.id = t.usuario_id
       WHERE t.token_hash = $1
       FOR UPDATE OF t, u`,
      [huella(token)]
    );

    const registro = rows[0];

    // Un token que no existe, ya usado, vencido o de una cuenta desactivada se
    // responde igual: no se le dice al cliente cuál de las cuatro cosas pasó.
    const vencido =
      registro && new Date(registro.fecha_expiracion).getTime() <= Date.now();

    if (!registro || registro.fecha_uso || !registro.activo || vencido) {
      return { estado: "TOKEN_INVALIDO" };
    }

    if (await verificarPassword(passwordNueva, registro.password_hash)) {
      return { estado: "MISMA_CLAVE" };
    }

    await consultar(
      `UPDATE public.usuarios
       SET password_hash = $1, version_sesion = version_sesion + 1
       WHERE id = $2`,
      [passwordHash, registro.usuario_id]
    );

    await consultar(
      `UPDATE public.password_reset_tokens
       SET fecha_uso = NOW()
       WHERE usuario_id = $1 AND fecha_uso IS NULL`,
      [registro.usuario_id]
    );

    // Recuperar el acceso invalida también los códigos de respaldo: quien haya
    // perdido la cuenta no debe conservar otra vía de entrada.
    await consultar(
      `UPDATE public.codigos_recuperacion
       SET fecha_uso = NOW()
       WHERE usuario_id = $1 AND fecha_uso IS NULL`,
      [registro.usuario_id]
    );

    return { estado: "OK" };
  });
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  generarRecuperacion,
  restablecerPassword
};
