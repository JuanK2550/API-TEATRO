// ========================================
// Pruebas del módulo final: el panel en React y su backend
// ========================================
// Cubren lo que el panel necesita y antes no existía: el resumen del inicio,
// la gestión de cuentas y la búsqueda para la recuperación administrativa;
// además, que el navegador pueda restablecer sin API Key y que CORS admita
// el origen de Vite y ningún otro. No imprime tokens ni contraseñas: las
// cuentas de prueba nacen con claves aleatorias y se retiran al terminar.
require("dotenv").config();

// sesion.js sustituye el fetch global e inyecta el token del administrador;
// aquí hacen falta peticiones sin credenciales, así que se guarda el auténtico.
const fetchReal = globalThis.fetch;

const crypto = require("node:crypto");
const { entrarComoAdministrador } = require("./sesion");
const { consultar, cerrarPool } = require("../src/config/database");
const usuariosService = require("../src/services/usuarios.service");

const BASE = "http://localhost:3000";
const ORIGEN_PANEL = "http://localhost:5173";
const SELLO = Date.now().toString(36);

const resultados = [];

// ========================================
// Utilidades
// ========================================
const pedir = async (metodo, ruta, { token, cuerpo, origen } = {}) => {
  const cabeceras = {};
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
  if (origen) cabeceras.Origin = origen;

  const respuesta = await fetchReal(BASE + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
  });

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }
  return { estado: respuesta.status, datos, cabeceras: respuesta.headers };
};

const prueba = (descripcion, esperado, real, extra) => {
  const esperados = Array.isArray(esperado) ? esperado : [esperado];
  const ok = esperados.includes(real) && (!extra || extra.ok !== false);
  resultados.push({ numero: resultados.length + 1, descripcion, esperado: esperados.join(" o "), real, ok, nota: extra?.nota ?? null });
  console.log(
    `  ${ok ? "ok   " : "FALLA"} ${String(resultados.length).padStart(2)}. ${descripcion.slice(0, 64).padEnd(64)} ${real}` +
      (extra?.nota ? `\n          ${extra.nota}` : "")
  );
};

const claveAleatoria = () => crypto.randomBytes(18).toString("base64url");

const filaDe = async (id) => {
  const { rows } = await consultar(
    `SELECT u.activo, u.version_sesion, u.email, r.nombre AS rol
     FROM public.usuarios u JOIN public.roles r ON r.id = u.rol_id WHERE u.id = $1`,
    [id]
  );
  return rows[0] ?? null;
};

const CAMPOS_PROHIBIDOS = ["password", "passwordHash", "password_hash", "versionSesion", "version_sesion", "token_hash", "codigo_hash"];
const llevaCampoProhibido = (valor) => CAMPOS_PROHIBIDOS.some((campo) => JSON.stringify(valor).includes(`"${campo}"`));

// ========================================
// Principal
// ========================================
const principal = async () => {
  console.log("\n=== Módulo final: panel React + backend ===\n");
  const admin = await entrarComoAdministrador();
  const yo = (await pedir("GET", "/api/auth/perfil", { token: admin })).datos.usuario.id;

  // Cuentas de laboratorio con claves que nadie ve.
  const taquilla = { nombre: `Taquilla Panel ${SELLO}`, email: `taquilla.panel.${SELLO}@teatro.test`, password: claveAleatoria() };
  const asistente = { nombre: `Asistente Panel ${SELLO}`, email: `asistente.panel.${SELLO}@teatro.test`, password: claveAleatoria() };

  const creada = await pedir("POST", "/api/usuarios", { token: admin, cuerpo: { ...taquilla, rol: "taquilla" } });
  taquilla.id = creada.datos?.usuario?.id;
  const registrada = await pedir("POST", "/api/auth/registro", { cuerpo: asistente });
  asistente.id = registrada.datos?.usuario?.id;
  if (!taquilla.id || !asistente.id) throw new Error("No se pudieron crear las cuentas de laboratorio");

  const entrar = async (c) => (await pedir("POST", "/api/auth/login", { cuerpo: { email: c.email, password: c.password } })).datos?.token;
  taquilla.token = await entrar(taquilla);
  asistente.token = await entrar(asistente);

  // ---------- Acceso ----------
  console.log("-- Acceso desde el panel");
  const claveMala = await pedir("POST", "/api/auth/login", { cuerpo: { email: taquilla.email, password: claveAleatoria() } });
  prueba("Login con la contraseña incorrecta: 401 y sin token", 401, claveMala.estado, {
    ok: !claveMala.datos?.token,
    nota: claveMala.datos?.mensaje
  });
  const correoAusente = await pedir("POST", "/api/auth/login", { cuerpo: { email: `nadie.${SELLO}@teatro.test`, password: claveAleatoria() } });
  prueba("Mismo mensaje que con un correo inexistente: no enumera cuentas", 401, correoAusente.estado, {
    ok: correoAusente.datos?.mensaje === claveMala.datos?.mensaje,
    nota: `«${claveMala.datos?.mensaje}» · «${correoAusente.datos?.mensaje}»`
  });

  // ---------- Resumen del panel ----------
  console.log("-- Resumen del panel (/api/estadisticas/resumen)");
  const resumen = await pedir("GET", "/api/estadisticas/resumen", { token: admin });
  const claves = ["usuarios", "eventos", "funciones", "localidades", "asistentes", "boletas", "ingresos"];
  prueba("El administrador recibe el resumen con sus siete cifras", 200, resumen.estado, {
    ok: claves.every((k) => Number.isInteger(resumen.datos?.resumen?.[k])),
    nota: `cifras: ${claves.filter((k) => Number.isInteger(resumen.datos?.resumen?.[k])).length} de 7`
  });

  const sinPersonas = !/@|"nombre"|"documento"|"email"/.test(JSON.stringify(resumen.datos));
  prueba("El resumen no contiene un solo dato personal", 200, resumen.estado, { ok: sinPersonas, nota: sinPersonas ? "ni correos, ni nombres, ni documentos" : "aparece un dato personal" });

  const { rows: suma } = await consultar("SELECT COALESCE(SUM(precio),0)::bigint AS total FROM public.boletas WHERE estado IN ('pagada','usada')");
  prueba("Los ingresos coinciden con la suma en PostgreSQL", 200, resumen.estado, {
    ok: Number(suma[0].total) === resumen.datos?.resumen?.ingresos,
    nota: `API ${resumen.datos?.resumen?.ingresos} · base ${suma[0].total}`
  });

  prueba("Sin token: 401", 401, (await pedir("GET", "/api/estadisticas/resumen")).estado);
  prueba("Con token de taquilla: 403", 403, (await pedir("GET", "/api/estadisticas/resumen", { token: taquilla.token })).estado);
  prueba("Con token de asistente: 403", 403, (await pedir("GET", "/api/estadisticas/resumen", { token: asistente.token })).estado);

  // ---------- Listado de cuentas ----------
  console.log("-- Listado de cuentas (GET /api/usuarios)");
  const listado = await pedir("GET", "/api/usuarios", { token: admin });
  prueba("El administrador lista las cuentas, paginadas de 20 en 20", 200, listado.estado, {
    ok: Array.isArray(listado.datos?.usuarios) && listado.datos.porPagina === 20 && Number.isInteger(listado.datos.total)
  });
  prueba("Ninguna ficha lleva hash, contraseña ni versión de sesión", 200, listado.estado, { ok: !llevaCampoProhibido(listado.datos) });

  const soloTaquilla = await pedir("GET", "/api/usuarios?rol=taquilla", { token: admin });
  prueba("El filtro por rol devuelve solo ese rol", 200, soloTaquilla.estado, {
    ok: soloTaquilla.datos?.usuarios?.length > 0 && soloTaquilla.datos.usuarios.every((u) => u.rol === "taquilla")
  });

  const comodin = await pedir("GET", `/api/usuarios?q=${encodeURIComponent("%")}`, { token: admin });
  prueba("Un % en la búsqueda es texto, no un comodín", 200, comodin.estado, {
    ok: comodin.datos?.total === 0,
    nota: `coincidencias: ${comodin.datos?.total} (ningún nombre ni correo contiene %)`
  });

  prueba("Un rol fuera de la lista blanca: 400", 400, (await pedir("GET", "/api/usuarios?rol=superadmin", { token: admin })).estado);
  prueba("activo distinto de true o false: 400", 400, (await pedir("GET", "/api/usuarios?activo=quizas", { token: admin })).estado);
  prueba("Página 0: 400", 400, (await pedir("GET", "/api/usuarios?pagina=0", { token: admin })).estado);
  prueba("La taquilla no lista cuentas: 403", 403, (await pedir("GET", "/api/usuarios", { token: taquilla.token })).estado);

  // ---------- Búsqueda para la recuperación ----------
  console.log("-- Búsqueda para la recuperación administrativa");
  prueba("Menos de dos caracteres: 400", 400, (await pedir("GET", "/api/usuarios/busqueda-recuperacion?q=a", { token: admin })).estado);
  const hallada = await pedir("GET", `/api/usuarios/busqueda-recuperacion?q=${encodeURIComponent(taquilla.email)}`, { token: admin });
  const camposHallados = Object.keys(hallada.datos?.usuarios?.[0] ?? {}).sort().join(",");
  prueba("Devuelve solo id, nombre, correo y rol", 200, hallada.estado, {
    ok: camposHallados === "email,id,nombre,rol",
    nota: `campos: ${camposHallados}`
  });
  prueba("El asistente no puede buscar cuentas: 403", 403, (await pedir("GET", "/api/usuarios/busqueda-recuperacion?q=te", { token: asistente.token })).estado);

  // ---------- Edición ----------
  console.log("-- Edición de nombre y correo (PUT /api/usuarios/:id)");
  const editada = await pedir("PUT", `/api/usuarios/${taquilla.id}`, {
    token: admin,
    cuerpo: { nombre: `${taquilla.nombre} Norte`, email: taquilla.email, rol: "administrador", activo: false }
  });
  const trasEditar = await filaDe(taquilla.id);
  prueba("Edita el nombre e ignora rol y activo colados en el cuerpo", 200, editada.estado, {
    ok: trasEditar.rol === "taquilla" && trasEditar.activo === true,
    nota: `en la base: rol ${trasEditar.rol}, activo ${trasEditar.activo}`
  });
  const correoAdmin = (await filaDe(yo)).email;
  prueba("Un correo que ya usa otra cuenta: 409", 409, (await pedir("PUT", `/api/usuarios/${taquilla.id}`, { token: admin, cuerpo: { nombre: "Taquilla Choque", email: correoAdmin } })).estado);
  prueba("Una cuenta que no existe: 404", 404, (await pedir("PUT", "/api/usuarios/999999", { token: admin, cuerpo: { nombre: "Nadie Nunca", email: `nadie.${SELLO}@teatro.test` } })).estado);
  prueba("El asistente no edita cuentas: 403", 403, (await pedir("PUT", `/api/usuarios/${taquilla.id}`, { token: asistente.token, cuerpo: { nombre: "Intento Ajeno", email: taquilla.email } })).estado);

  // ---------- Estado ----------
  console.log("-- Activar y desactivar (PATCH /api/usuarios/:id/estado)");
  prueba("Nadie puede desactivarse a sí mismo: 409", 409, (await pedir("PATCH", `/api/usuarios/${yo}/estado`, { token: admin, cuerpo: { activo: false } })).estado);
  prueba('activo como texto "false": 400', 400, (await pedir("PATCH", `/api/usuarios/${taquilla.id}/estado`, { token: admin, cuerpo: { activo: "false" } })).estado);

  const antes = (await filaDe(taquilla.id)).version_sesion;
  const desactivada = await pedir("PATCH", `/api/usuarios/${taquilla.id}/estado`, { token: admin, cuerpo: { activo: false } });
  const despues = await filaDe(taquilla.id);
  prueba("Desactivar sube la versión de sesión", 200, desactivada.estado, {
    ok: despues.activo === false && despues.version_sesion === antes + 1,
    nota: `version_sesion ${antes} -> ${despues.version_sesion}`
  });
  const tokenViejo = await pedir("GET", "/api/auth/perfil", { token: taquilla.token });
  prueba("El token de la cuenta desactivada deja de servir: 401", 401, tokenViejo.estado, { nota: tokenViejo.datos?.mensaje });
  const loginInactivo = await pedir("POST", "/api/auth/login", { cuerpo: { email: taquilla.email, password: taquilla.password } });
  prueba("La cuenta desactivada no puede entrar: 403", 403, loginInactivo.estado, { nota: loginInactivo.datos?.mensaje });

  await pedir("PATCH", `/api/usuarios/${taquilla.id}/estado`, { token: admin, cuerpo: { activo: true } });
  const antesRepetir = (await filaDe(taquilla.id)).version_sesion;
  const repetida = await pedir("PATCH", `/api/usuarios/${taquilla.id}/estado`, { token: admin, cuerpo: { activo: true } });
  prueba("Repetir el mismo estado no toca la versión de sesión", 200, repetida.estado, {
    ok: (await filaDe(taquilla.id)).version_sesion === antesRepetir
  });

  // La regla del último administrador solo se alcanza en una carrera entre
  // dos administradores, así que se prueba en el service: con un único
  // administrador activo, otro solicitante no puede desactivarlo.
  const { rows: activos } = await consultar(
    "SELECT COUNT(*)::int AS n FROM public.usuarios u JOIN public.roles r ON r.id = u.rol_id WHERE r.nombre = 'administrador' AND u.activo"
  );
  const ultimo = await usuariosService.cambiarEstadoUsuario(yo, false, -1);
  prueba("El último administrador activo no se puede desactivar", "ULTIMO_ADMINISTRADOR", ultimo.estado, {
    ok: activos[0].n === 1 && (await filaDe(yo)).activo === true,
    nota: `administradores activos: ${activos[0].n}; sigue activo: ${(await filaDe(yo)).activo}`
  });

  // ---------- Recuperación sin API Key ----------
  console.log("-- Recuperación desde el navegador, sin API Key");
  const conCodigo = await pedir("POST", "/api/auth/restablecer-con-codigo", { cuerpo: {} });
  prueba("restablecer-con-codigo sin clave llega al validador: 400", 400, conCodigo.estado);
  const tokenFalso = await pedir("POST", "/api/auth/restablecer-password", {
    cuerpo: { token: "a".repeat(64), passwordNueva: claveAleatoria(), confirmarPassword: "x" }
  });
  prueba("restablecer-password sin clave llega al validador: 400", 400, tokenFalso.estado);
  prueba("/api/seguridad/cliente sigue exigiendo la clave: 401", 401, (await pedir("GET", "/api/seguridad/cliente")).estado);

  const emitido = await pedir("POST", `/api/auth/recuperacion/${asistente.id}`, { token: admin });
  const nueva = claveAleatoria();
  const canje = await pedir("POST", "/api/auth/restablecer-password", {
    cuerpo: { token: emitido.datos?.token, passwordNueva: nueva, confirmarPassword: nueva }
  });
  prueba("El flujo completo del panel: token del admin, canje sin clave", 200, canje.estado);
  prueba("El token anterior del asistente queda revocado: 401", 401, (await pedir("GET", "/api/auth/perfil", { token: asistente.token })).estado);
  const otra = claveAleatoria();
  const reuso = await pedir("POST", "/api/auth/restablecer-password", {
    cuerpo: { token: emitido.datos?.token, passwordNueva: otra, confirmarPassword: otra }
  });
  prueba("El token de recuperación no se reutiliza: 400", 400, reuso.estado, {
    ok: /utilizado|inválido/i.test(reuso.datos?.mensaje ?? ""),
    nota: reuso.datos?.mensaje
  });

  // ---------- Carácter nulo ----------
  // Hallazgo del DAST autenticado: un \u0000 llegaba hasta PostgreSQL, que lo
  // rechaza en un texto, y la API respondía 500.
  console.log("-- Carácter nulo en la entrada (hallazgo del DAST)");
  const nuloConsulta = await pedir("GET", "/api/usuarios?q=a%00b", { token: admin });
  prueba("Un carácter nulo en la búsqueda: 400, no 500", 400, nuloConsulta.estado, { nota: nuloConsulta.datos?.mensaje });
  prueba("Lo mismo en la búsqueda para la recuperación", 400, (await pedir("GET", "/api/usuarios/busqueda-recuperacion?q=ab%00c", { token: admin })).estado);
  const nuloCuerpo = await pedir("POST", "/api/auth/registro", {
    cuerpo: { nombre: "Nu\u0000lo Prueba", email: `nulo.${SELLO}@teatro.test`, password: claveAleatoria() }
  });
  const { rows: nulos } = await consultar("SELECT COUNT(*)::int AS n FROM public.usuarios WHERE email = $1", [`nulo.${SELLO}@teatro.test`]);
  prueba("Un carácter nulo en el cuerpo del registro: 400, y no se crea nada", 400, nuloCuerpo.estado, {
    ok: nulos[0].n === 0,
    nota: `cuentas creadas: ${nulos[0].n}`
  });

  // ---------- CORS ----------
  console.log("-- CORS");
  const delPanel = await pedir("GET", "/api/eventos", { origen: ORIGEN_PANEL });
  prueba("El origen del panel recibe Access-Control-Allow-Origin", 200, delPanel.estado, {
    ok: delPanel.cabeceras.get("access-control-allow-origin") === ORIGEN_PANEL
  });
  const ajeno = await pedir("GET", "/api/eventos", { origen: "http://evil.example" });
  prueba("Un origen ajeno no lo recibe", 200, ajeno.estado, { ok: !ajeno.cabeceras.get("access-control-allow-origin") });

  // ---------- Swagger ----------
  console.log("-- Contrato en Swagger");
  const spec = (await pedir("GET", "/openapi.json")).datos;
  const rutasNuevas = ["/api/estadisticas/resumen", "/api/usuarios/busqueda-recuperacion", "/api/usuarios/{id}", "/api/usuarios/{id}/estado"];
  prueba("Documenta las rutas nuevas", 200, 200, { ok: rutasNuevas.every((r) => spec.paths[r]), nota: `${rutasNuevas.filter((r) => spec.paths[r]).length} de ${rutasNuevas.length}` });
  const sinClave = ["/api/auth/restablecer-password", "/api/auth/restablecer-con-codigo"].every(
    (r) => JSON.stringify(spec.paths[r].post.security) === "[]"
  );
  prueba("Declara las dos de restablecimiento sin credencial", 200, 200, { ok: sinClave });

  // ---------- Limpieza ----------
  await consultar("DELETE FROM public.usuarios WHERE id = ANY($1::bigint[])", [[taquilla.id, asistente.id]]);
  console.log("\n  cuentas de laboratorio retiradas");

  const correctas = resultados.filter((r) => r.ok).length;
  console.log(`\n  Total: ${resultados.length} pruebas | Correctas: ${correctas} | Fallidas: ${resultados.length - correctas}`);

  if (process.env.MATRIZ_SALIDA) {
    require("node:fs").writeFileSync(process.env.MATRIZ_SALIDA, JSON.stringify(resultados, null, 2), "utf8");
  }

  await cerrarPool();
  if (correctas !== resultados.length) process.exitCode = 1;
};

principal().catch(async (error) => {
  console.error("ERROR:", error.message);
  await cerrarPool().catch(() => {});
  process.exit(1);
});
