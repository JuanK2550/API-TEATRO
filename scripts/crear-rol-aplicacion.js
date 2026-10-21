// ========================================
// Crear el rol de aplicación y sus políticas
// ========================================
// Ejecuta database/05_rol_aplicacion.sql y le asigna una contraseña al rol
// api_teatro. Después imprime la cadena de conexión que hay que poner en el
// .env, con la contraseña oculta.
//
//   node scripts/crear-rol-aplicacion.js
//
// Hay que conectarse como el dueño de las tablas, así que usa DATABASE_URL_ADMIN
// si existe y, si no, DATABASE_URL.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

require("dotenv").config();

const { Pool } = require("pg");

const RAIZ = path.resolve(__dirname, "..");
const SQL = path.join(RAIZ, "database", "05_rol_aplicacion.sql");

const cadenaAdmin = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

if (!cadenaAdmin) {
  console.error("Falta DATABASE_URL (o DATABASE_URL_ADMIN) en el .env");
  process.exit(1);
}

// El mismo criterio de TLS que src/config/database.js: la autoridad propia si
// está descargada, las de Node si no, y la verificación siempre activa.
const rutaCertificado = path.join(RAIZ, "certs", "prod-ca-2021.crt");
const ssl = { rejectUnauthorized: true };
if (fs.existsSync(rutaCertificado)) {
  ssl.ca = fs.readFileSync(rutaCertificado, "utf8");
}

// ========================================
// Contraseña del rol
// ========================================
// Se genera aquí y se imprime una sola vez. No se guarda en ningún archivo del
// repositorio: quien la necesite la copia al .env en ese momento.
const generarPassword = () =>
  crypto.randomBytes(24).toString("base64url");

const principal = async () => {
  const pool = new Pool({ connectionString: cadenaAdmin, ssl, max: 2 });

  try {
    const quien = await pool.query("SELECT current_user AS u");
    console.log(`Conectado como ${quien.rows[0].u}\n`);

    console.log("Ejecutando database/05_rol_aplicacion.sql…");
    await pool.query(fs.readFileSync(SQL, "utf8"));
    console.log("  rol y políticas creados\n");

    const password = generarPassword();

    // La contraseña se pasa como literal porque ALTER ROLE no admite
    // parámetros. Se escapa con el formato de cadena de PostgreSQL.
    const escapada = password.replace(/'/g, "''");
    await pool.query(`ALTER ROLE api_teatro LOGIN PASSWORD '${escapada}'`);
    console.log("Contraseña asignada al rol api_teatro.\n");

    // ========================================
    // Comprobaciones
    // ========================================
    const privilegios = await pool.query(`
      SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin
      FROM pg_roles WHERE rolname = 'api_teatro'
    `);
    console.log("Privilegios del rol:");
    console.table(privilegios.rows);

    const politicas = await pool.query(`
      SELECT tablename, policyname, roles::text, cmd
      FROM pg_policies WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    console.log(`Políticas RLS: ${politicas.rowCount}`);

    const concedidos = await pool.query(`
      SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS permisos
      FROM information_schema.role_table_grants
      WHERE grantee = 'api_teatro' AND table_schema = 'public'
      GROUP BY table_name ORDER BY table_name
    `);
    console.table(concedidos.rows);

    // ========================================
    // La cadena para el .env
    // ========================================
    const url = new URL(cadenaAdmin);
    const usuarioAdmin = decodeURIComponent(url.username);
    // En los endpoints de pooler el usuario lleva el id del proyecto detrás.
    const sufijo = usuarioAdmin.includes(".")
      ? "." + usuarioAdmin.split(".").slice(1).join(".")
      : "";
    const usuarioApp = "api_teatro" + sufijo;

    url.username = encodeURIComponent(usuarioApp);
    url.password = encodeURIComponent(password);

    console.log("\n========================================");
    console.log("Pon estas dos líneas en el .env:");
    console.log("========================================\n");
    console.log("# La que usa la API: solo puede leer y escribir datos.");
    console.log(`DATABASE_URL=${url.toString()}`);
    console.log("");
    console.log("# La del dueño, solo para crear o reiniciar la base.");
    console.log(`DATABASE_URL_ADMIN=${cadenaAdmin}`);
    console.log("\n(La contraseña del rol se muestra una sola vez.)");
  } catch (error) {
    console.error("\nError:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

principal();
