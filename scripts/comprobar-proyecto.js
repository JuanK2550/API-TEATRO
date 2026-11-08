// ========================================
// Salvaguarda: ¿esta cadena es la del teatro?
// ========================================
// Reiniciar una base borra sus tablas. Una cadena de conexión no dice a qué
// proyecto pertenece, así que basta con pegar la equivocada en el .env para
// arrasar la base de otro. Ya pasó una vez, en sentido contrario: los scripts
// de otro esquema se ejecutaron contra el proyecto del teatro.
//
// Esto compara la huella del host y del usuario contra la que se registró, y
// sale con código 1 si no coinciden. No imprime la cadena, ni el host, ni la
// referencia del proyecto: solo las huellas.
//
//   node scripts/comprobar-proyecto.js            # comprueba
//   node scripts/comprobar-proyecto.js --registrar # registra la actual
require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ARCHIVO = path.resolve(__dirname, "..", "database", "huella-proyecto.json");

// ========================================
// La huella
// ========================================
// Del host y del usuario, no de la contraseña: así rotar la contraseña no
// invalida la huella, pero cambiar de proyecto sí.
const huellaDe = (cadena) => {
  const u = new URL(cadena);
  const material = `${u.hostname}|${decodeURIComponent(u.username || "")}`;
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 16);
};

// ========================================
// La comprobación, para usarla desde otro script
// ========================================
// Devuelve la huella si coincide y lanza si no. preparar-base.js la llama
// antes de abrir siquiera la conexión: comprobar después del primer DROP no
// serviría de nada.
const exigirProyectoDelTeatro = () => {
  const cadena = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

  if (!cadena) {
    throw new Error("Falta DATABASE_URL_ADMIN (o DATABASE_URL) en el .env");
  }

  let huella;
  try {
    huella = huellaDe(cadena);
  } catch {
    throw new Error("La cadena de conexión no tiene un formato válido");
  }

  if (!fs.existsSync(ARCHIVO)) {
    throw new Error(
      "No hay huella registrada. Ejecute: node scripts/comprobar-proyecto.js --registrar"
    );
  }

  const esperada = JSON.parse(fs.readFileSync(ARCHIVO, "utf8")).huella;

  if (huella !== esperada) {
    throw new Error(
      [
        "La conexión no es la del proyecto del teatro.",
        `  huella esperada  ${esperada}`,
        `  huella de ahora  ${huella}`,
        "Revise DATABASE_URL_ADMIN antes de tocar la base."
      ].join("\n")
    );
  }

  return huella;
};

const principal = () => {
  const cadena = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

  if (!cadena) {
    console.error("Falta DATABASE_URL_ADMIN (o DATABASE_URL) en el .env");
    process.exit(1);
  }

  let huella;
  try {
    huella = huellaDe(cadena);
  } catch {
    console.error("La cadena de conexión no tiene un formato válido");
    process.exit(1);
  }

  if (process.argv.includes("--registrar")) {
    fs.writeFileSync(
      ARCHIVO,
      JSON.stringify({ proyecto: "API_TEATRO", huella }, null, 2) + "\n",
      "utf8"
    );
    console.log(`Huella registrada: ${huella}`);
    return;
  }

  if (!fs.existsSync(ARCHIVO)) {
    console.error("No hay huella registrada. Ejecute:");
    console.error("  node scripts/comprobar-proyecto.js --registrar");
    process.exit(1);
  }

  const esperada = JSON.parse(fs.readFileSync(ARCHIVO, "utf8")).huella;

  if (huella !== esperada) {
    console.error("ABORTADO: la conexión no es la del proyecto del teatro.");
    console.error(`  huella esperada  ${esperada}`);
    console.error(`  huella de ahora  ${huella}`);
    console.error("Revise DATABASE_URL_ADMIN antes de reiniciar nada.");
    process.exit(1);
  }

  console.log(`Proyecto del teatro confirmado (huella ${huella})`);
};

// ========================================
// Exportaciones
// ========================================
module.exports = { exigirProyectoDelTeatro, huellaDe };

// Solo se ejecuta cuando se invoca como script, no al importarlo.
if (require.main === module) principal();
