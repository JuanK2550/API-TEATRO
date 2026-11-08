// ========================================
// Las 25 pruebas del Paso 8 del bloque 11
// ========================================
// Adaptadas al teatro: asistente en lugar de paciente, boleta en lugar de
// cita. Cada fila anota el código HTTP real y, donde hace falta, el efecto en
// PostgreSQL. No imprime tokens, contraseñas ni hashes.
//
// Desde el bloque 11 el reparto es el de la guía: el catálogo y el acceso son
// públicos, los recursos con sesión van solo con JWT, y la API Key se queda
// para las integraciones sin sesión. El navegador ya no recibe ninguna clave.
require("dotenv").config();

// sesion.js sustituye el fetch global e inyecta el token del administrador en
// toda petición sin Authorization propia. Aquí hacen falta peticiones de
// verdad sin credenciales, así que se guarda el fetch auténtico antes.
const fetchReal = globalThis.fetch;

const { entrarComoAdministrador } = require("./sesion");
const { consultar, cerrarPool } = require("../src/config/database");

const BASE = "http://localhost:3000";
const CLAVE = process.env.API_KEY_POSTMAN;
const ORIGEN_SPA = "http://localhost:5173";

const resultados = [];

const pedir = async (metodo, ruta, { token, cuerpo, sinClave, crudo } = {}) => {
  const cabeceras = {};
  if (!sinClave) cabeceras["X-API-Key"] = CLAVE;
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";

  const respuesta = await fetchReal(BASE + ruta, {
    method: metodo,
    headers: cabeceras,
    body: crudo !== undefined ? crudo : cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
  });

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  return { estado: respuesta.status, datos, cabeceras: respuesta.headers };
};

// Registra una fila de la matriz del Paso 11.
const prueba = (numero, descripcion, endpoint, rol, esperado, real, extra) => {
  const esperados = Array.isArray(esperado) ? esperado : [esperado];
  const ok = esperados.includes(real) && (!extra || extra.ok !== false);

  resultados.push({
    numero,
    descripcion,
    endpoint,
    rol,
    esperado: esperados.join(" o "),
    real,
    estado: ok ? "APROBADA" : "FALLIDA",
    observacion: extra ? extra.nota : null
  });

  console.log(
    `  ${ok ? "ok   " : "FALLA"} ${String(numero).padStart(2)}. ${descripcion.slice(0, 58).padEnd(58)} ${real}` +
      (extra && extra.nota ? `\n          ${extra.nota}` : "")
  );
};

const versionDe = async (id) => {
  const { rows } = await consultar(
    "SELECT version_sesion FROM public.usuarios WHERE id = $1",
    [id]
  );
  return rows[0] ? rows[0].version_sesion : null;
};

const hashDe = async (id) => {
  const { rows } = await consultar(
    "SELECT password_hash FROM public.usuarios WHERE id = $1",
    [id]
  );
  return rows[0] ? rows[0].password_hash : null;
};

const CLAVE_1 = "Bloque11Uno2026";
const CLAVE_2 = "Bloque11Dos2026";
const CLAVE_3 = "Bloque11Tres2026";

const principal = async () => {
  const admin = await entrarComoAdministrador();
  const sufijo = Date.now().toString().slice(-6);
  const correoA = `b11.a.${sufijo}@teatro.com`;
  const correoB = `b11.b.${sufijo}@teatro.com`;

  // ---------- escenario: dos asistentes con boleta ----------
  const cuentas = {};
  for (const [etiqueta, correo, documento] of [
    ["a", correoA, `7711${sufijo}`],
    ["b", correoB, `7722${sufijo}`]
  ]) {
    await pedir("POST", "/api/auth/registro", {
      cuerpo: { nombre: `Asistente B11 ${etiqueta.toUpperCase()}`, email: correo, password: CLAVE_1 }
    });
    const sesion = await pedir("POST", "/api/auth/login", {
      cuerpo: { email: correo, password: CLAVE_1 }
    });
    await pedir("POST", "/api/asistentes/mio", {
      token: sesion.datos.token,
      cuerpo: {
        nombre: `Asistente B11 ${etiqueta.toUpperCase()}`,
        documento,
        email: correo,
        telefono: "3002000001",
        fechaNacimiento: "1993-05-15"
      }
    });
    const mio = await pedir("GET", "/api/asistentes/mio", { token: sesion.datos.token });
    cuentas[etiqueta] = {
      correo,
      token: sesion.datos.token,
      usuarioId: sesion.datos.usuario.id,
      asistenteId: mio.datos && mio.datos.id
    };
  }

  // Una boleta para cada uno, en una función en venta.
  const funciones = await pedir("GET", "/api/funciones", { token: admin });
  const enVenta = funciones.datos.filter((f) => f.estado === "en_venta")[0];
  const localidadId = enVenta.tarifas[0].localidadId;
  const ocupadas = await pedir("GET", `/api/boletas/funcion/${enVenta.id}`, { token: admin });
  const tomadas = new Set(
    ocupadas.datos
      .filter((b) => b.localidadId === localidadId && b.estado !== "cancelada")
      .map((b) => `${b.fila}:${b.numero}`)
  );
  const libre = () => {
    for (let f = 1; f <= 5; f += 1) {
      for (let n = 1; n <= 20; n += 1) {
        if (!tomadas.has(`${f}:${n}`)) {
          tomadas.add(`${f}:${n}`);
          return { fila: f, numero: n };
        }
      }
    }
    throw new Error("sin butacas libres");
  };
  for (const etiqueta of ["a", "b"]) {
    const butaca = libre();
    const creada = await pedir("POST", "/api/boletas", {
      token: admin,
      cuerpo: {
        asistenteId: cuentas[etiqueta].asistenteId,
        funcionId: enVenta.id,
        localidadId,
        fila: butaca.fila,
        numero: butaca.numero
      }
    });
    cuentas[etiqueta].boletaId = creada.datos.boleta.id;
  }

  const A = cuentas.a;
  const B = cuentas.b;

  console.log("\n--- Autenticación (1 a 7) ---");

  const r1 = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: A.correo, password: CLAVE_1 }
  });
  prueba(1, "Login válido", "POST /api/auth/login", "asistente", 200, r1.estado, {
    ok: !!(r1.datos && r1.datos.token),
    nota: "devuelve JWT"
  });
  A.token = r1.datos.token;

  const r2 = await pedir("POST", "/api/auth/login", { crudo: "{esto no es json" });
  prueba(2, "Login con JSON mal formado", "POST /api/auth/login", "anónimo", 400, r2.estado, {
    nota: r2.datos && r2.datos.mensaje
  });

  const r3 = await pedir("GET", "/api/auth/perfil");
  prueba(3, "Perfil sin JWT", "GET /api/auth/perfil", "anónimo", 401, r3.estado, {
    nota: r3.datos && r3.datos.mensaje
  });

  const antes4 = await versionDe(A.usuarioId);
  const r4 = await pedir("PATCH", "/api/auth/cambiar-password", {
    token: A.token,
    cuerpo: { passwordActual: CLAVE_1, passwordNueva: CLAVE_2, confirmarPassword: CLAVE_2 }
  });
  const despues4 = await versionDe(A.usuarioId);
  prueba(4, "Cambio con la contraseña actual correcta", "PATCH /api/auth/cambiar-password", "asistente", 200, r4.estado, {
    ok: despues4 === antes4 + 1,
    nota: `version_sesion ${antes4} -> ${despues4}`
  });

  const r5 = await pedir("GET", "/api/auth/perfil", { token: A.token });
  prueba(5, "El JWT anterior ya no sirve", "GET /api/auth/perfil", "asistente", 401, r5.estado, {
    ok: r5.datos && r5.datos.mensaje === "Sesión revocada",
    nota: r5.datos && r5.datos.mensaje
  });

  const r6 = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: A.correo, password: CLAVE_2 }
  });
  prueba(6, "Login con la contraseña nueva", "POST /api/auth/login", "asistente", 200, r6.estado);
  A.token = r6.datos.token;

  const hashAntes7 = await hashDe(A.usuarioId);
  const version7 = await versionDe(A.usuarioId);
  const r7 = await pedir("PATCH", "/api/auth/cambiar-password", {
    token: A.token,
    cuerpo: { passwordActual: "NoEsLaActual1", passwordNueva: CLAVE_3, confirmarPassword: CLAVE_3 }
  });
  const hashDespues7 = await hashDe(A.usuarioId);
  prueba(7, "Cambio con la contraseña actual incorrecta", "PATCH /api/auth/cambiar-password", "asistente", 401, r7.estado, {
    ok: hashAntes7 === hashDespues7 && (await versionDe(A.usuarioId)) === version7,
    nota: "ni el hash ni la versión cambiaron"
  });

  console.log("\n--- Recuperación administrativa (8 a 11) ---");

  const r8 = await pedir("POST", `/api/auth/recuperacion/${A.usuarioId}`, { token: admin });
  const enTabla = await consultar(
    "SELECT COUNT(*)::int n FROM public.password_reset_tokens WHERE usuario_id = $1 AND fecha_uso IS NULL",
    [A.usuarioId]
  );
  prueba(8, "El administrador emite el token", "POST /api/auth/recuperacion/{id}", "administrador", 201, r8.estado, {
    ok: enTabla.rows[0].n === 1,
    nota: `${enTabla.rows[0].n} token vigente en la tabla`
  });
  const tokenReset = r8.datos && r8.datos.token;

  const version9 = await versionDe(A.usuarioId);
  const r9 = await pedir("POST", "/api/auth/restablecer-password", {
    cuerpo: { token: tokenReset, passwordNueva: CLAVE_3, confirmarPassword: CLAVE_3 }
  });
  const usado = await consultar(
    "SELECT COUNT(*)::int n FROM public.password_reset_tokens WHERE usuario_id = $1 AND fecha_uso IS NOT NULL",
    [A.usuarioId]
  );
  prueba(9, "Restablecimiento con el token válido", "POST /api/auth/restablecer-password", "anónimo", 200, r9.estado, {
    ok: usado.rows[0].n >= 1 && (await versionDe(A.usuarioId)) === version9 + 1,
    nota: `token marcado con fecha_uso; versión ${version9} -> ${await versionDe(A.usuarioId)}`
  });

  const r10 = await pedir("POST", "/api/auth/restablecer-password", {
    cuerpo: { token: tokenReset, passwordNueva: CLAVE_1, confirmarPassword: CLAVE_1 }
  });
  prueba(10, "Reutilizar el mismo token", "POST /api/auth/restablecer-password", "anónimo", 400, r10.estado, {
    nota: r10.datos && r10.datos.mensaje
  });

  const sesionA = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: A.correo, password: CLAVE_3 }
  });
  A.token = sesionA.datos.token;

  const r11 = await pedir("POST", `/api/auth/recuperacion/${B.usuarioId}`, { token: A.token });
  prueba(11, "Un asistente intenta emitir una recuperación", "POST /api/auth/recuperacion/{id}", "asistente", 403, r11.estado, {
    nota: r11.datos && r11.datos.mensaje
  });

  console.log("\n--- Códigos de respaldo (12 a 16) ---");

  const r12 = await pedir("POST", "/api/auth/codigos-recuperacion", {
    token: A.token,
    cuerpo: { passwordActual: CLAVE_3 }
  });
  const codigos = (r12.datos && r12.datos.codigos) || [];
  const hashes = await consultar(
    "SELECT codigo_hash FROM public.codigos_recuperacion WHERE usuario_id = $1",
    [A.usuarioId]
  );
  prueba(12, "Genera ocho códigos de respaldo", "POST /api/auth/codigos-recuperacion", "asistente", 201, r12.estado, {
    ok: codigos.length === 8 && hashes.rows.length === 8 &&
        !hashes.rows.some((f) => codigos.includes(f.codigo_hash)),
    nota: "8 códigos emitidos; la base guarda 8 hashes, ninguno igual al código"
  });

  const r13 = await pedir("GET", "/api/auth/codigos-recuperacion/estado", { token: A.token });
  prueba(13, "Consulta del saldo de códigos", "GET /api/auth/codigos-recuperacion/estado", "asistente", 200, r13.estado, {
    ok: r13.datos && r13.datos.disponibles === 8,
    nota: `disponibles: ${r13.datos && r13.datos.disponibles}`
  });

  const r14 = await pedir("POST", "/api/auth/codigos-recuperacion/regenerar", {
    token: A.token,
    cuerpo: { passwordActual: CLAVE_3 }
  });
  const nuevos = (r14.datos && r14.datos.codigos) || [];
  const viejoTrasRegenerar = await pedir("POST", "/api/auth/restablecer-con-codigo", {
    cuerpo: { email: A.correo, codigo: codigos[0], passwordNueva: CLAVE_1, confirmarPassword: CLAVE_1 }
  });
  prueba(14, "Regenerar invalida el lote anterior", "POST /api/auth/codigos-recuperacion/regenerar", "asistente", 201, r14.estado, {
    ok: viejoTrasRegenerar.estado === 400 && !nuevos.some((c) => codigos.includes(c)),
    nota: `un código del lote viejo ahora responde ${viejoTrasRegenerar.estado}`
  });

  const version15 = await versionDe(A.usuarioId);
  const r15 = await pedir("POST", "/api/auth/restablecer-con-codigo", {
    cuerpo: { email: A.correo, codigo: nuevos[0], passwordNueva: CLAVE_1, confirmarPassword: CLAVE_1 }
  });
  const saldo = await consultar(
    "SELECT COUNT(*)::int n FROM public.codigos_recuperacion WHERE usuario_id = $1 AND fecha_uso IS NULL",
    [A.usuarioId]
  );
  prueba(15, "Restablecer con un código válido", "POST /api/auth/restablecer-con-codigo", "anónimo", 200, r15.estado, {
    ok: saldo.rows[0].n === 7 && (await versionDe(A.usuarioId)) === version15 + 1,
    nota: `quedan ${saldo.rows[0].n} de 8; versión ${version15} -> ${await versionDe(A.usuarioId)}`
  });

  const r16 = await pedir("POST", "/api/auth/restablecer-con-codigo", {
    cuerpo: { email: A.correo, codigo: nuevos[0], passwordNueva: CLAVE_2, confirmarPassword: CLAVE_2 }
  });
  prueba(16, "Reutilizar el mismo código", "POST /api/auth/restablecer-con-codigo", "anónimo", 400, r16.estado, {
    nota: r16.datos && r16.datos.mensaje
  });

  const final = await pedir("POST", "/api/auth/login", {
    cuerpo: { email: A.correo, password: CLAVE_1 }
  });
  A.token = final.datos.token;

  console.log("\n--- RBAC y BOLA/IDOR (17 a 19) ---");

  const r17 = await pedir("GET", "/api/boletas/mias", { token: A.token });
  const ajenas = Array.isArray(r17.datos)
    ? r17.datos.filter((b) => b.asistenteId !== A.asistenteId)
    : [];
  prueba(17, "El asistente consulta sus propias boletas", "GET /api/boletas/mias", "asistente", 200, r17.estado, {
    ok: Array.isArray(r17.datos) && ajenas.length === 0,
    nota: `${Array.isArray(r17.datos) ? r17.datos.length : "?"} boletas, ninguna ajena`
  });

  const r18 = await pedir("GET", `/api/boletas/${B.boletaId}`, { token: A.token });
  prueba(18, "El asistente consulta una boleta ajena", "GET /api/boletas/{id}", "asistente", 403, r18.estado, {
    ok: !(r18.datos && r18.datos.codigo),
    nota: "no filtra el código de la boleta ajena"
  });

  const r19 = await pedir("GET", "/api/boletas", { token: A.token });
  prueba(19, "El asistente pide la boletería completa", "GET /api/boletas", "asistente", 403, r19.estado, {
    ok: !Array.isArray(r19.datos),
    nota: "no devuelve el listado"
  });

  console.log("\n--- API Key y reparto de credenciales (20 a 24) ---");

  const r20 = await pedir("GET", "/api/seguridad/cliente", { sinClave: true });
  prueba(20, "Cliente privado sin API Key", "GET /api/seguridad/cliente", "anónimo", 401, r20.estado, {
    nota: r20.datos && r20.datos.mensaje
  });

  const r21 = await pedir("GET", "/api/seguridad/cliente");
  prueba(21, "Cliente privado con API Key válida", "GET /api/seguridad/cliente", "cliente", 200, r21.estado);

  // El login es público: llega al validador en lugar de morir en la puerta.
  const r22 = await pedir("POST", "/api/auth/login", { sinClave: true, crudo: "{roto" });
  prueba(22, "Login sin API Key y con cuerpo inválido", "POST /api/auth/login", "anónimo", 400, r22.estado, {
    nota: r22.datos && r22.datos.mensaje
  });

  const r23 = await pedir("GET", "/api/boletas/mias", { sinClave: true });
  prueba(23, "Boletas propias sin JWT y sin API Key", "GET /api/boletas/mias", "anónimo", 401, r23.estado, {
    nota: r23.datos && r23.datos.mensaje
  });

  const r24 = await pedir("GET", "/api/boletas/mias", { token: A.token, sinClave: true });
  prueba(24, "Boletas propias con JWT y sin API Key", "GET /api/boletas/mias", "asistente", 200, r24.estado, {
    ok: Array.isArray(r24.datos),
    nota: `${Array.isArray(r24.datos) ? r24.datos.length : "?"} boletas, sin enviar ninguna clave`
  });

  console.log("\n--- Swagger y CORS (25) ---");

  const spec = await pedir("GET", "/openapi.json", { sinClave: true });
  const rutas = spec.datos && spec.datos.paths;
  const esquemas = (ruta, metodo) => {
    const op = rutas && rutas[ruta] && rutas[ruta][metodo];
    if (!op || op.security === undefined) return "global (ApiKeyAuth)";
    if (op.security.length === 0) return "sin seguridad";
    return op.security.map((o) => Object.keys(o).join("+")).join(" o ");
  };
  const login = esquemas("/api/auth/login", "post");
  const recurso = esquemas("/api/auth/cambiar-password", "patch");
  const cliente = esquemas("/api/seguridad/cliente", "get");
  prueba(25, "Swagger declara los esquemas que la API exige", "GET /openapi.json", "anónimo", 200, spec.estado, {
    ok: login === "sin seguridad" && recurso === "BearerAuth" && cliente === "global (ApiKeyAuth)",
    nota: `login: ${login} · recurso con JWT: ${recurso} · cliente privado: ${cliente}`
  });

  // ---------- preflight CORS ----------
  const preflight = await fetchReal(`${BASE}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGEN_SPA,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  });
  const permitido = preflight.headers.get("access-control-allow-origin");
  prueba(26, "Preflight CORS desde el origen de la SPA", "OPTIONS /api/auth/login", "navegador", 204, preflight.status, {
    ok: permitido === ORIGEN_SPA,
    nota: `Access-Control-Allow-Origin: ${permitido || "(ausente)"}`
  });

  console.log("\n--- El reparto de credenciales (27 a 34) ---");

  // 27. El catálogo entero, sin una sola credencial.
  const catalogo = [
    "/api/eventos",
    "/api/funciones",
    "/api/localidades",
    `/api/funciones/${enVenta.id}`,
    `/api/funciones/${enVenta.id}/tarifas`,
    `/api/funciones/${enVenta.id}/ocupacion`
  ];
  const estadosCatalogo = [];
  for (const ruta of catalogo) {
    const r = await pedir("GET", ruta, { sinClave: true });
    estadosCatalogo.push(`${ruta.replace("/api", "")}:${r.estado}`);
  }
  prueba(
    27,
    "El catálogo entero sin credenciales",
    "GET /api/eventos · /funciones · /localidades · …",
    "anónimo",
    200,
    estadosCatalogo.every((c) => c.endsWith(":200")) ? 200 : 0,
    { nota: estadosCatalogo.join("  ") }
  );

  // 28. La ocupación no dice de quién es cada butaca.
  const ocupacion = await pedir("GET", `/api/funciones/${enVenta.id}/ocupacion`, {
    sinClave: true
  });
  const camposOcupacion = Array.isArray(ocupacion.datos) && ocupacion.datos[0]
    ? Object.keys(ocupacion.datos[0]).sort()
    : [];
  prueba(
    28,
    "La ocupación solo dice qué butacas están tomadas",
    `GET /api/funciones/${enVenta.id}/ocupacion`,
    "anónimo",
    200,
    ocupacion.estado,
    {
      ok:
        camposOcupacion.length === 0 ||
        camposOcupacion.join(",") === "fila,localidadId,numero",
      nota: `campos devueltos: ${camposOcupacion.join(", ") || "(sin butacas tomadas)"}`
    }
  );

  // 29. Lo inactivo no se anuncia.
  const publico = await pedir("GET", "/api/eventos", { sinClave: true });
  const mostrador = await pedir("GET", "/api/eventos", { token: admin });
  const inactivosEnPublico = Array.isArray(publico.datos)
    ? publico.datos.filter((e) => !e.activo).length
    : -1;
  prueba(
    29,
    "Los eventos inactivos no salen en la vista pública",
    "GET /api/eventos",
    "anónimo frente a administrador",
    200,
    publico.estado,
    {
      ok: inactivosEnPublico === 0 && mostrador.datos.length > publico.datos.length,
      nota: `público ${publico.datos.length} · mostrador ${mostrador.datos.length} · inactivos visibles ${inactivosEnPublico}`
    }
  );

  // 30 y 31. Las escrituras del catálogo siguen siendo del administrador.
  const eventoNuevo = {
    titulo: "Evento del bloque 11",
    tipo: "obra",
    descripcion: "Solo debería poder crearlo un administrador.",
    duracionMinutos: 90,
    clasificacionEdad: "G"
  };

  const escrituraAnonima = await pedir("POST", "/api/eventos", {
    sinClave: true,
    cuerpo: eventoNuevo
  });
  prueba(30, "Crear un evento sin JWT", "POST /api/eventos", "anónimo", 401, escrituraAnonima.estado, {
    nota: escrituraAnonima.datos && escrituraAnonima.datos.mensaje
  });

  const escrituraAsistente = await pedir("POST", "/api/eventos", {
    token: A.token,
    sinClave: true,
    cuerpo: eventoNuevo
  });
  prueba(31, "Crear un evento con JWT de asistente", "POST /api/eventos", "asistente", 403, escrituraAsistente.estado, {
    nota: escrituraAsistente.datos && escrituraAsistente.datos.mensaje
  });

  // 32. El registro es público y el rol lo pone el servidor.
  const correoNuevo = `b11.pub.${sufijo}@teatro.com`;
  const registroMal = await pedir("POST", "/api/auth/registro", {
    sinClave: true,
    cuerpo: { nombre: "x", email: "no-es-un-correo", password: "corta" }
  });
  prueba(32, "Registro sin API Key con cuerpo inválido", "POST /api/auth/registro", "anónimo", 400, registroMal.estado, {
    nota: registroMal.datos && registroMal.datos.mensaje
  });

  const registroBien = await pedir("POST", "/api/auth/registro", {
    sinClave: true,
    cuerpo: {
      nombre: "Registro Publico B11",
      email: correoNuevo,
      password: "RegistroPublico2026",
      rol: "administrador"
    }
  });
  const rolPersistido = await consultar(
    `SELECT r.nombre AS rol FROM public.usuarios u
     JOIN public.roles r ON r.id = u.rol_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [correoNuevo]
  );
  prueba(33, "Registro sin API Key con cuerpo válido", "POST /api/auth/registro", "anónimo", 201, registroBien.estado, {
    ok: rolPersistido.rows[0] && rolPersistido.rows[0].rol === "asistente",
    nota: `pidió rol administrador; quedó como ${rolPersistido.rows[0] && rolPersistido.rows[0].rol}`
  });

  // 34. /sala/config.js ya no entrega la clave.
  const respuestaConfig = await fetchReal(`${BASE}/sala/config.js`);
  const textoConfig = await respuestaConfig.text();
  const claveReal = process.env.API_KEY_WEB || "";
  prueba(
    34,
    "/sala/config.js ya no entrega la API Key",
    "GET /sala/config.js",
    "navegador",
    200,
    respuestaConfig.status,
    {
      ok:
        !/apiKey/i.test(textoConfig) &&
        !(claveReal && textoConfig.includes(claveReal)),
      nota: `cuerpo: ${textoConfig.trim().slice(0, 60)}`
    }
  );

  // 35. Las dos rutas sin sesión siguen pidiendo API Key.
  const reset1 = await pedir("POST", "/api/auth/restablecer-password", {
    sinClave: true,
    cuerpo: { token: "f".repeat(64), passwordNueva: CLAVE_1, confirmarPassword: CLAVE_1 }
  });
  const reset2 = await pedir("POST", "/api/auth/restablecer-con-codigo", {
    sinClave: true,
    cuerpo: {
      email: A.correo,
      codigo: "0000-0000-0000-0000-0000-0000-0000-0000",
      passwordNueva: CLAVE_1,
      confirmarPassword: CLAVE_1
    }
  });
  prueba(
    35,
    "Las dos rutas de restablecimiento sin API Key",
    "POST /auth/restablecer-password · /restablecer-con-codigo",
    "anónimo",
    401,
    reset1.estado,
    {
      ok: reset1.estado === 401 && reset2.estado === 401,
      nota: `restablecer-password ${reset1.estado} · restablecer-con-codigo ${reset2.estado}`
    }
  );

  // ---------- limpieza ----------
  console.log("\n--- Limpieza ---");
  await consultar("DELETE FROM public.usuarios WHERE LOWER(email) = LOWER($1)", [
    correoNuevo
  ]);
  for (const etiqueta of ["a", "b"]) {
    await pedir("DELETE", `/api/boletas/${cuentas[etiqueta].boletaId}`, { token: admin });
    await consultar("DELETE FROM public.asistentes WHERE id = $1", [cuentas[etiqueta].asistenteId]);
    await consultar("DELETE FROM public.usuarios WHERE id = $1", [cuentas[etiqueta].usuarioId]);
  }
  console.log("  cuentas y boletas de laboratorio retiradas");

  const aprobadas = resultados.filter((r) => r.estado === "APROBADA").length;
  console.log(
    `\n  Total: ${resultados.length} pruebas | Correctas: ${aprobadas} | Fallidas: ${resultados.length - aprobadas}`
  );

  // La matriz completa, para el resumen de evidencias.
  const fs = require("node:fs");
  if (process.env.MATRIZ_SALIDA) {
    fs.writeFileSync(process.env.MATRIZ_SALIDA, JSON.stringify(resultados, null, 2), "utf8");
  }

  await cerrarPool();
  if (aprobadas !== resultados.length) process.exitCode = 1;
};

principal().catch(async (error) => {
  console.error("ERROR:", error.message);
  await cerrarPool().catch(() => {});
  process.exit(1);
});
