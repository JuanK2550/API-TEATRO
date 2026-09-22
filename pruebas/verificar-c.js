// ========================================
// Configuración
// Carga el .env del proyecto y añade la X-API-Key a cada petición
// ========================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const CLAVE_API = process.env.API_KEY_POSTMAN;
const fetchSinClave = globalThis.fetch;
globalThis.fetch = (url, opciones = {}) =>
  fetchSinClave(url, {
    ...opciones,
    headers: { ...(opciones.headers || {}), "X-API-Key": CLAVE_API }
  });

// Casos 32 a 35: seguridad de transporte. El caso 33 agota el límite de
// peticiones, así que se ejecuta el último de todos.
const BASE = "http://localhost:3000";
const casos = [];

const registrar = (numero, descripcion, peticion, esperado, obtenido, ok, nota) => {
  casos.push({ numero, descripcion, peticion, esperado, obtenido, ok, nota });
};

const principal = async () => {
  // ---------- 32: cuerpo mayor de 10kb ----------
  // express.json está configurado con limit: "10kb".
  const relleno = "x".repeat(12 * 1024);
  const cuerpoGrande = JSON.stringify({
    nombre: "Asistente Con Nombre Enorme",
    documento: "1234567",
    email: "grande@correo.com",
    telefono: "3001234567",
    fechaNacimiento: "1990-01-01",
    relleno
  });

  const respuesta32 = await fetch(`${BASE}/api/asistentes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: cuerpoGrande
  });
  let cuerpo32 = null;
  try {
    cuerpo32 = await respuesta32.json();
  } catch {
    cuerpo32 = null;
  }
  registrar(
    32,
    "Cuerpo JSON de 12kb contra el límite de 10kb",
    `POST /api/asistentes (${(cuerpoGrande.length / 1024).toFixed(1)}kb)`,
    413,
    respuesta32.status,
    respuesta32.status === 413,
    cuerpo32 && cuerpo32.mensaje ? cuerpo32.mensaje : "sin cuerpo JSON"
  );

  // Comprobación adicional: el cambio no debe convertir en 413 otros
  // errores de parseo. Un JSON mal formado sigue siendo 400.
  const respuestaMal = await fetch(`${BASE}/api/asistentes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{esto no es json"
  });
  let cuerpoMal = null;
  try {
    cuerpoMal = await respuestaMal.json();
  } catch {
    cuerpoMal = null;
  }
  registrar(
    32,
    "JSON mal formado sigue siendo 400, no 413 ni 500",
    "POST /api/asistentes con cuerpo inválido",
    400,
    respuestaMal.status,
    respuestaMal.status === 400,
    cuerpoMal && cuerpoMal.mensaje ? cuerpoMal.mensaje : "sin cuerpo JSON"
  );

  // ---------- 34: cabecera X-Powered-By ----------
  const rutas34 = ["/", "/api/asistentes", "/api/boletas/9999", "/api/eventos", "/openapi.json"];
  const conCabecera = [];
  for (const ruta of rutas34) {
    const r = await fetch(BASE + ruta);
    if (r.headers.get("x-powered-by")) conCabecera.push(ruta);
  }
  registrar(
    34,
    "X-Powered-By ausente en todas las respuestas",
    `GET en ${rutas34.length} rutas distintas`,
    "ausente",
    conCabecera.length === 0 ? "ausente" : `presente en ${conCabecera.join(", ")}`,
    conCabecera.length === 0,
    `revisadas: ${rutas34.join(", ")}`
  );

  // ---------- 35: error interno sin stack trace ----------
  // Se provoca un 500 real contra el middleware manejarError del proyecto.
  const express = require("express");
  const { manejarError, rutaNoEncontrada } = require("../src/middlewares/errores.middleware");

  const consolaOriginal = console.error;
  let registradoEnServidor = "";
  console.error = (...args) => {
    registradoEnServidor += args.map((a) => (a && a.stack ? a.stack : String(a))).join(" ");
  };

  const appPrueba = express();
  appPrueba.get("/revienta", () => {
    const error = new Error("Fallo interno simulado con datos sensibles: contraseña=secreta");
    error.detalleInterno = "ruta interna C:/servidor/config/credenciales.json";
    throw error;
  });
  appPrueba.use(rutaNoEncontrada);
  appPrueba.use(manejarError);

  const servidor = appPrueba.listen(3099);
  await new Promise((r) => servidor.once("listening", r));

  const respuesta35 = await fetch("http://localhost:3099/revienta");
  const texto35 = await respuesta35.text();
  servidor.close();
  console.error = consolaOriginal;

  const filtra =
    !/stack|at Object|at Layer|\.js:\d+|contraseña|secreta|credenciales|detalleInterno|Fallo interno simulado/i.test(
      texto35
    );
  const registraEnConsola = /Fallo interno simulado/.test(registradoEnServidor);

  registrar(
    35,
    "Error interno: 500 genérico, sin stack ni datos sensibles",
    "GET /revienta contra manejarError real (puerto 3099)",
    500,
    respuesta35.status,
    respuesta35.status === 500 && filtra && registraEnConsola,
    `cuerpo: ${texto35} | oculta el detalle: ${filtra} | lo registra en consola: ${registraEnConsola}`
  );

  // ---------- 33: límite de peticiones ----------
  // Va el último porque a partir de aquí toda /api responde 429.
  let primer429 = null;
  let peticiones = 0;
  for (let i = 1; i <= 130; i += 1) {
    const r = await fetch(`${BASE}/api/eventos`);
    peticiones = i;
    if (r.status === 429) {
      primer429 = i;
      break;
    }
  }
  registrar(
    33,
    "Superar el límite de 100 peticiones cada 15 minutos en /api",
    `GET /api/eventos repetido (${peticiones} peticiones)`,
    429,
    primer429 ? 429 : 200,
    primer429 !== null,
    primer429 ? `primer 429 en la petición número ${primer429}` : "nunca respondió 429"
  );

  // La raíz no está bajo /api, así que no debe verse afectada.
  const raiz = await fetch(`${BASE}/`);
  registrar(
    33,
    "La raíz sigue respondiendo pese al límite en /api",
    "GET /",
    200,
    raiz.status,
    raiz.status === 200,
    "el limitador solo cubre /api"
  );

  casos.sort((a, b) => a.numero - b.numero);
  console.log(JSON.stringify(casos));
};

principal().catch((error) => {
  console.error("ERROR:", error);
  process.exit(1);
});
