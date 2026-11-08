// ========================================
// Pruebas del bloque 11
// Versión de sesión, recuperación administrativa y códigos de respaldo
// ========================================
// Cada prueba comprueba el código HTTP y, donde importa, el efecto real en
// PostgreSQL: un 200 no demuestra que la versión de sesión subiera.
require("dotenv").config();

// sesion.js sustituye el fetch global para inyectar el token del administrador
// en toda petición que no traiga Authorization propia. Aquí hace falta lo
// contrario —poder preguntar de verdad sin credenciales—, así que se guarda el
// fetch auténtico ANTES de cargar ese módulo.
const fetchReal = globalThis.fetch;

const { entrarComoAdministrador } = require("./sesion");
const { consultar, cerrarPool } = require("../src/config/database");

const BASE = "http://localhost:3000";
const CLAVE = process.env.API_KEY_POSTMAN;

let total = 0;
let correctas = 0;

const pedir = async (metodo, ruta, { token, cuerpo, sinClave } = {}) => {
  const cabeceras = {};
  if (!sinClave) cabeceras["X-API-Key"] = CLAVE;
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (cuerpo) cabeceras["Content-Type"] = "application/json";

  const respuesta = await fetchReal(BASE + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  return { estado: respuesta.status, datos };
};

const comprobar = (descripcion, condicion, detalle) => {
  total += 1;
  if (condicion) {
    correctas += 1;
    console.log(`  ok    ${descripcion}`);
  } else {
    console.log(`  FALLA ${descripcion}${detalle ? `  -> ${detalle}` : ""}`);
  }
};

const versionDe = async (usuarioId) => {
  const { rows } = await consultar(
    "SELECT version_sesion FROM public.usuarios WHERE id = $1",
    [usuarioId]
  );
  return rows[0] ? rows[0].version_sesion : null;
};

// Contraseñas de laboratorio. Cumplen la regla de la API: doce caracteres o
// más, con mayúscula, minúscula y número.
const CLAVE_1 = "RecuperaUno2026";
const CLAVE_2 = "RecuperaDos2026";
const CLAVE_3 = "RecuperaTres2026";

const principal = async () => {
  const admin = await entrarComoAdministrador();
  const sufijo = Date.now().toString().slice(-6);
  const correo = `lab11.${sufijo}@teatro.com`;

  // ---------- cuenta de trabajo ----------
  await pedir("POST", "/api/auth/registro", {
    cuerpo: { nombre: "Cuenta Lab11", email: correo, password: CLAVE_1 }
  });
  const primera = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: correo, password: CLAVE_1 }
  });
  comprobar("Login de la cuenta nueva", primera.estado === 200, `HTTP ${primera.estado}`);

  const { rows } = await consultar(
    "SELECT id FROM public.usuarios WHERE LOWER(email) = LOWER($1)",
    [correo]
  );
  const usuarioId = rows[0].id;
  let token = primera.datos.token;

  console.log("\n--- Versión de sesión y cambio de contraseña ---");

  comprobar("La cuenta nace con versión 0", (await versionDe(usuarioId)) === 0);

  const sinActual = await pedir("PATCH", "/api/auth/cambiar-password", {
    token,
    cuerpo: { passwordNueva: CLAVE_2, confirmarPassword: CLAVE_2 }
  });
  comprobar("Sin la contraseña actual: 400", sinActual.estado === 400, `HTTP ${sinActual.estado}`);

  const corta = await pedir("PATCH", "/api/auth/cambiar-password", {
    token,
    cuerpo: { passwordActual: CLAVE_1, passwordNueva: "corta1A", confirmarPassword: "corta1A" }
  });
  comprobar("Contraseña nueva demasiado corta: 400", corta.estado === 400, `HTTP ${corta.estado}`);

  const sinNumero = await pedir("PATCH", "/api/auth/cambiar-password", {
    token,
    cuerpo: {
      passwordActual: CLAVE_1,
      passwordNueva: "SinNumerosAqui",
      confirmarPassword: "SinNumerosAqui"
    }
  });
  comprobar("Contraseña sin número: 400", sinNumero.estado === 400, `HTTP ${sinNumero.estado}`);

  const noCoincide = await pedir("PATCH", "/api/auth/cambiar-password", {
    token,
    cuerpo: { passwordActual: CLAVE_1, passwordNueva: CLAVE_2, confirmarPassword: CLAVE_3 }
  });
  comprobar("La confirmación no coincide: 400", noCoincide.estado === 400, `HTTP ${noCoincide.estado}`);

  const actualMal = await pedir("PATCH", "/api/auth/cambiar-password", {
    token,
    cuerpo: { passwordActual: "NoEsLaActual1", passwordNueva: CLAVE_2, confirmarPassword: CLAVE_2 }
  });
  comprobar("Contraseña actual incorrecta: 401", actualMal.estado === 401, `HTTP ${actualMal.estado}`);
  comprobar("Un intento fallido no sube la versión", (await versionDe(usuarioId)) === 0);

  const repetida = await pedir("PATCH", "/api/auth/cambiar-password", {
    token,
    cuerpo: { passwordActual: CLAVE_1, passwordNueva: CLAVE_1, confirmarPassword: CLAVE_1 }
  });
  comprobar("La nueva no puede ser la misma: 400", repetida.estado === 400, `HTTP ${repetida.estado}`);

  const cambio = await pedir("PATCH", "/api/auth/cambiar-password", {
    token,
    cuerpo: { passwordActual: CLAVE_1, passwordNueva: CLAVE_2, confirmarPassword: CLAVE_2 }
  });
  comprobar("Cambio correcto: 200", cambio.estado === 200, `HTTP ${cambio.estado}`);
  comprobar("La versión de sesión subió a 1", (await versionDe(usuarioId)) === 1);

  // Esta es la prueba central del bloque: el token de antes ya no sirve.
  const tokenViejo = await pedir("GET", "/api/auth/perfil", { token });
  comprobar(
    "El token anterior queda revocado: 401",
    tokenViejo.estado === 401,
    `HTTP ${tokenViejo.estado}`
  );
  comprobar(
    "Y el mensaje lo dice",
    tokenViejo.datos && tokenViejo.datos.mensaje === "Sesión revocada",
    tokenViejo.datos && tokenViejo.datos.mensaje
  );

  const vieja = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: correo, password: CLAVE_1 }
  });
  comprobar("La contraseña anterior ya no entra: 401", vieja.estado === 401, `HTTP ${vieja.estado}`);

  const nueva = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: correo, password: CLAVE_2 }
  });
  comprobar("La contraseña nueva entra: 200", nueva.estado === 200, `HTTP ${nueva.estado}`);
  token = nueva.datos.token;

  const perfilNuevo = await pedir("GET", "/api/auth/perfil", { token });
  comprobar("El token nuevo sí vale: 200", perfilNuevo.estado === 200, `HTTP ${perfilNuevo.estado}`);

  console.log("\n--- Recuperación autorizada por un administrador ---");

  const sinSesion = await pedir("POST", `/api/auth/recuperacion/${usuarioId}`);
  comprobar("Sin JWT: 401", sinSesion.estado === 401, `HTTP ${sinSesion.estado}`);

  const noAdmin = await pedir("POST", `/api/auth/recuperacion/${usuarioId}`, { token });
  comprobar("Con un rol que no es administrador: 403", noAdmin.estado === 403, `HTTP ${noAdmin.estado}`);

  const inexistente = await pedir("POST", "/api/auth/recuperacion/999999", { token: admin });
  comprobar("Cuenta inexistente: 404", inexistente.estado === 404, `HTTP ${inexistente.estado}`);

  const emision = await pedir("POST", `/api/auth/recuperacion/${usuarioId}`, { token: admin });
  comprobar("El administrador emite el token: 201", emision.estado === 201, `HTTP ${emision.estado}`);
  const tokenReset = emision.datos && emision.datos.token;
  comprobar(
    "El token son 64 caracteres hexadecimales",
    typeof tokenReset === "string" && /^[a-f0-9]{64}$/.test(tokenReset)
  );

  const guardado = await consultar(
    `SELECT token_hash, administrador_id, fecha_uso
     FROM public.password_reset_tokens WHERE usuario_id = $1 ORDER BY id DESC LIMIT 1`,
    [usuarioId]
  );
  comprobar(
    "La base guarda el hash, no el token",
    guardado.rows[0] && guardado.rows[0].token_hash !== tokenReset
  );
  comprobar(
    "Queda registrado quién lo autorizó",
    guardado.rows[0] && Number(guardado.rows[0].administrador_id) > 0
  );

  const tokenFalso = await pedir("POST", "/api/auth/restablecer-password", {
    cuerpo: { token: "f".repeat(64), passwordNueva: CLAVE_3, confirmarPassword: CLAVE_3 }
  });
  comprobar("Un token inventado: 400", tokenFalso.estado === 400, `HTTP ${tokenFalso.estado}`);

  const restablecer = await pedir("POST", "/api/auth/restablecer-password", {
    cuerpo: { token: tokenReset, passwordNueva: CLAVE_3, confirmarPassword: CLAVE_3 }
  });
  comprobar("Restablecer con el token: 200", restablecer.estado === 200, `HTTP ${restablecer.estado}`);
  comprobar("La versión subió a 2", (await versionDe(usuarioId)) === 2);

  const reutilizar = await pedir("POST", "/api/auth/restablecer-password", {
    cuerpo: { token: tokenReset, passwordNueva: CLAVE_1, confirmarPassword: CLAVE_1 }
  });
  comprobar("El mismo token no sirve dos veces: 400", reutilizar.estado === 400, `HTTP ${reutilizar.estado}`);

  const tras = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: correo, password: CLAVE_3 }
  });
  comprobar("Entra con la contraseña restablecida: 200", tras.estado === 200, `HTTP ${tras.estado}`);
  token = tras.datos.token;

  console.log("\n--- Códigos de respaldo ---");

  const sinClaveActual = await pedir("POST", "/api/auth/codigos-recuperacion", {
    token,
    cuerpo: { passwordActual: "NoEsLaActual1" }
  });
  comprobar("Reautenticación incorrecta: 401", sinClaveActual.estado === 401, `HTTP ${sinClaveActual.estado}`);

  const lote = await pedir("POST", "/api/auth/codigos-recuperacion", {
    token,
    cuerpo: { passwordActual: CLAVE_3 }
  });
  comprobar("Genera el lote: 201", lote.estado === 201, `HTTP ${lote.estado}`);
  const codigos = (lote.datos && lote.datos.codigos) || [];
  comprobar("Son ocho códigos", codigos.length === 8, `fueron ${codigos.length}`);
  comprobar(
    "Con el formato esperado",
    codigos.every((c) => /^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/.test(c))
  );
  comprobar("Y todos distintos", new Set(codigos).size === 8);

  const enBase = await consultar(
    "SELECT codigo_hash FROM public.codigos_recuperacion WHERE usuario_id = $1",
    [usuarioId]
  );
  comprobar(
    "La base guarda hashes, no los códigos",
    enBase.rows.length === 8 &&
      !enBase.rows.some((f) => codigos.includes(f.codigo_hash))
  );

  const estado1 = await pedir("GET", "/api/auth/codigos-recuperacion/estado", { token });
  comprobar("Quedan ocho disponibles", estado1.datos && estado1.datos.disponibles === 8,
    estado1.datos && String(estado1.datos.disponibles));

  const codigoMalo = await pedir("POST", "/api/auth/restablecer-con-codigo", {
    cuerpo: {
      email: correo,
      codigo: "0000-0000-0000-0000-0000-0000-0000-0000",
      passwordNueva: CLAVE_1,
      confirmarPassword: CLAVE_1
    }
  });
  comprobar("Un código que no existe: 400", codigoMalo.estado === 400, `HTTP ${codigoMalo.estado}`);

  const conCodigo = await pedir("POST", "/api/auth/restablecer-con-codigo", {
    cuerpo: {
      email: correo,
      codigo: codigos[0],
      passwordNueva: CLAVE_1,
      confirmarPassword: CLAVE_1
    }
  });
  comprobar("Restablecer con un código: 200", conCodigo.estado === 200, `HTTP ${conCodigo.estado}`);
  comprobar("La versión subió a 3", (await versionDe(usuarioId)) === 3);

  const repetir = await pedir("POST", "/api/auth/restablecer-con-codigo", {
    cuerpo: {
      email: correo,
      codigo: codigos[0],
      passwordNueva: CLAVE_2,
      confirmarPassword: CLAVE_2
    }
  });
  comprobar("El mismo código no sirve dos veces: 400", repetir.estado === 400, `HTTP ${repetir.estado}`);

  const ultima = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: correo, password: CLAVE_1 }
  });
  token = ultima.datos.token;

  const estado2 = await pedir("GET", "/api/auth/codigos-recuperacion/estado", { token });
  comprobar(
    "Quedan siete: solo se gastó el usado",
    estado2.datos && estado2.datos.disponibles === 7,
    estado2.datos && String(estado2.datos.disponibles)
  );

  const regenerado = await pedir("POST", "/api/auth/codigos-recuperacion/regenerar", {
    token,
    cuerpo: { passwordActual: CLAVE_1 }
  });
  comprobar("Regenerar el lote: 201", regenerado.estado === 201, `HTTP ${regenerado.estado}`);

  const nuevos = (regenerado.datos && regenerado.datos.codigos) || [];
  comprobar("Los nuevos son otros", !nuevos.some((c) => codigos.includes(c)));

  const viejoTrasRegenerar = await pedir("POST", "/api/auth/restablecer-con-codigo", {
    cuerpo: {
      email: correo,
      codigo: codigos[1],
      passwordNueva: CLAVE_2,
      confirmarPassword: CLAVE_2
    }
  });
  comprobar(
    "Un código del lote anterior ya no vale: 400",
    viejoTrasRegenerar.estado === 400,
    `HTTP ${viejoTrasRegenerar.estado}`
  );

  console.log("\n--- Limpieza ---");
  await consultar("DELETE FROM public.usuarios WHERE id = $1", [usuarioId]);
  const quedan = await consultar(
    `SELECT (SELECT COUNT(*)::int FROM public.password_reset_tokens WHERE usuario_id = $1) t,
            (SELECT COUNT(*)::int FROM public.codigos_recuperacion WHERE usuario_id = $1) c`,
    [usuarioId]
  );
  comprobar(
    "Al borrar la cuenta se van sus tokens y códigos",
    quedan.rows[0].t === 0 && quedan.rows[0].c === 0
  );

  console.log(
    `\n  Total: ${total} pruebas | Correctas: ${correctas} | Fallidas: ${total - correctas}`
  );

  await cerrarPool();
  if (correctas !== total) process.exitCode = 1;
};

principal().catch(async (error) => {
  console.error("ERROR:", error.message);
  await cerrarPool().catch(() => {});
  process.exit(1);
});
