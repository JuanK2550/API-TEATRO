// ========================================
// El límite de peticiones de login y registro
// ========================================
// Va en una batería aparte por el mismo motivo que verificar-c.js: hay que
// correrla con el límite real. Las demás baterías lo suben por entorno, porque
// hacen decenas de inicios de sesión legítimos y si no se agotarían la cuota.
//
// Desde el bloque 11 estas dos rutas son públicas. Antes la API Key frenaba a
// quien las golpeara en serie; ahora el límite es la única barrera contra
// probar contraseñas o crear cuentas en masa, así que conviene demostrarlo.
require("dotenv").config();

// No se carga sesion.js: aquí no hace falta administrador, y su fetch
// parcheado inyectaría credenciales que estas rutas ya no piden.
const BASE = "http://localhost:3000";

let total = 0;
let correctas = 0;

const comprobar = (descripcion, condicion, detalle) => {
  total += 1;
  if (condicion) {
    correctas += 1;
    console.log(`  ok    ${descripcion}`);
  } else {
    console.log(`  FALLA ${descripcion}${detalle ? `  -> ${detalle}` : ""}`);
  }
};

const pedir = async (ruta, cuerpo) => {
  const respuesta = await fetch(BASE + ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo)
  });
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }
  return { estado: respuesta.status, datos };
};

const principal = async () => {
  const limite = Number(process.env.RATE_LIMIT_ACCESO_MAX) || 10;

  if (limite > 50) {
    console.log(
      `  Esta batería necesita el límite real. RATE_LIMIT_ACCESO_MAX vale ${limite}.`
    );
    console.log("  Ejecútela sin esa variable o con su valor de servicio.");
    process.exitCode = 1;
    return;
  }

  console.log(`  Límite configurado: ${limite} peticiones por ventana\n`);

  // ---------- login ----------
  const intentos = [];
  for (let i = 0; i < limite + 3; i += 1) {
    const r = await pedir("/api/auth/login", {
      email: "nadie@teatro.com",
      password: "NoExisteEstaClave1"
    });
    intentos.push(r.estado);
  }

  const primeros = intentos.slice(0, limite);
  const ultimos = intentos.slice(limite);

  comprobar(
    `Los primeros ${limite} intentos pasan al validador`,
    primeros.every((e) => e === 401),
    `códigos: ${[...new Set(primeros)].join(", ")}`
  );

  comprobar(
    "Pasado el límite, el login responde 429",
    ultimos.every((e) => e === 429),
    `códigos: ${[...new Set(ultimos)].join(", ")}`
  );

  const bloqueado = await pedir("/api/auth/login", {
    email: "nadie@teatro.com",
    password: "NoExisteEstaClave1"
  });
  comprobar(
    "Y el mensaje avisa de que son demasiados intentos",
    bloqueado.datos && /Demasiados intentos/.test(bloqueado.datos.mensaje),
    bloqueado.datos && bloqueado.datos.mensaje
  );

  // ---------- registro ----------
  // Comparte el mismo limitador, así que ya debería estar cerrado.
  const registro = await pedir("/api/auth/registro", {
    nombre: "Quien Sea",
    email: `acceso.${Date.now()}@teatro.com`,
    password: "RegistroDePrueba2026"
  });
  comprobar(
    "El registro comparte el límite con el login",
    registro.estado === 429,
    `respondió ${registro.estado}`
  );

  // ---------- el catálogo no está limitado por esta cuenta ----------
  const catalogo = await fetch(`${BASE}/api/eventos`);
  comprobar(
    "El catálogo sigue respondiendo: el límite es solo del acceso",
    catalogo.status === 200,
    `respondió ${catalogo.status}`
  );

  console.log(
    `\n  Total: ${total} pruebas | Correctas: ${correctas} | Fallidas: ${total - correctas}`
  );

  if (correctas !== total) process.exitCode = 1;
};

principal().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
