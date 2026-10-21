// ========================================
// Preparar la base de datos en Supabase
// ========================================
// Ejecuta los cuatro scripts de database/ en orden y comprueba el resultado,
// sin pasar por el SQL Editor del panel.
//
//   node scripts/preparar-base.js            # crea el esquema y lo verifica
//   node scripts/preparar-base.js --reiniciar # borra todo y vuelve a empezar
//
// No imprime la cadena de conexión ni ninguna credencial.
const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

const { Pool } = require("pg");

// ========================================
// Esta tarea necesita al dueño de las tablas
// ========================================
// Crear y borrar tablas es DDL, y el rol de la aplicación no puede hacerlo a
// propósito: ese es justamente el punto de tener dos credenciales separadas.
// Por eso aquí se usa DATABASE_URL_ADMIN cuando existe.
const cadena = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

if (!cadena) {
  console.error("Falta DATABASE_URL_ADMIN (o DATABASE_URL) en el .env");
  process.exit(1);
}

const rutaCertificado = path.resolve(__dirname, "..", "certs", "prod-ca-2021.crt");
const hayCertificadoPropio = fs.existsSync(rutaCertificado);

const ssl = { rejectUnauthorized: true };
if (hayCertificadoPropio) ssl.ca = fs.readFileSync(rutaCertificado, "utf8");

const pool = new Pool({ connectionString: cadena, ssl, max: 3 });

const consultar = (sql, parametros = []) => pool.query(sql, parametros);

const DIRECTORIO = path.resolve(__dirname, "..", "database");

const PASOS = [
  { archivo: "01_esquema_teatro.sql", que: "nueve tablas, índices y restricciones" },
  { archivo: "02_roles_seguridad.sql", que: "tres roles, RLS y REVOKE" },
  { archivo: "04_datos_semilla.sql", que: "los datos semilla" },
  { archivo: "05_rol_aplicacion.sql", que: "el rol api_teatro y sus políticas" }
];

const TABLAS = [
  "roles",
  "usuarios",
  "eventos",
  "localidades",
  "funciones",
  "funcion_tarifas",
  "funcion_descuentos",
  "asistentes",
  "boletas"
];

const leer = (archivo) => fs.readFileSync(path.join(DIRECTORIO, archivo), "utf8");

// ========================================
// Dejar la base vacía
// Solo con --reiniciar, y nunca toca el esquema auth
// ========================================
const reiniciar = async () => {
  console.log("Borrando las tablas del esquema public…");
  for (const t of [...TABLAS].reverse()) {
    await consultar(`DROP TABLE IF EXISTS public.${t} CASCADE`);
  }
  console.log("  listo\n");
};

// ========================================
// ¿Ya está creado el esquema?
// ========================================
const tablasExistentes = async () => {
  const r = await consultar(
    `SELECT c.relname
     FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind = 'r'
       AND c.relname = ANY($1)`,
    [TABLAS]
  );
  return r.rows.map((x) => x.relname);
};

// ========================================
// Comprobaciones finales
// ========================================
const verificar = async () => {
  const problemas = [];

  const tablas = await tablasExistentes();
  const faltan = TABLAS.filter((t) => !tablas.includes(t));
  if (faltan.length > 0) problemas.push(`faltan tablas: ${faltan.join(", ")}`);

  const rls = await consultar(
    `SELECT relname, relrowsecurity
     FROM pg_class
     WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)`,
    [TABLAS]
  );
  const sinRls = rls.rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
  if (sinRls.length > 0) problemas.push(`sin RLS: ${sinRls.join(", ")}`);

  const roles = await consultar(`SELECT nombre FROM public.roles ORDER BY id`);
  const esperados = ["administrador", "taquilla", "asistente"];
  const nombres = roles.rows.map((r) => r.nombre);
  if (esperados.some((r) => !nombres.includes(r))) {
    problemas.push(`roles incompletos: ${nombres.join(", ") || "ninguno"}`);
  }

  const indices = await consultar(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND indexname IN ('uq_funciones_sala', 'uq_boletas_butaca')`
  );
  if (indices.rows.length !== 2) {
    problemas.push("faltan los índices únicos de sala o de butaca");
  }

  // Conteos, uno por tabla
  const filas = [];
  for (const t of TABLAS) {
    const n = await consultar(`SELECT COUNT(*)::int AS n FROM public.${t}`);
    filas.push({ tabla: t, filas: n.rows[0].n });
  }

  return { problemas, filas, roles: nombres };
};

// ========================================
// Principal
// ========================================
const principal = async () => {
  const quiereReiniciar = process.argv.includes("--reiniciar");

  try {
    const identidad = await consultar(
      `SELECT current_database() AS base, current_user AS usuario`
    );
    const cifrado = await consultar(
      `SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()`
    );

    console.log("Conectado a Supabase");
    console.log(`  base        ${identidad.rows[0].base}`);
    console.log(`  usuario     ${identidad.rows[0].usuario}`);
    console.log(`  cifrado TLS ${cifrado.rows[0] && cifrado.rows[0].ssl ? "sí" : "no"}`);
    console.log(
      `  autoridad   ${hayCertificadoPropio ? "certs/prod-ca-2021.crt" : "las que trae Node"}\n`
    );

    if (quiereReiniciar) await reiniciar();

    const yaHay = await tablasExistentes();
    if (yaHay.length > 0 && !quiereReiniciar) {
      console.log(`Ya existen ${yaHay.length} de las ${TABLAS.length} tablas.`);
      console.log("Los scripts 01 y 04 no se pueden repetir sobre una base con datos.");
      console.log("Para empezar de cero:  node scripts/preparar-base.js --reiniciar\n");
      console.log("Verificando lo que hay…\n");
      // El rol y sus políticas sí se pueden rehacer sin tocar los datos: el
      // script 05 es idempotente.
      await consultar(leer("05_rol_aplicacion.sql"));
    } else {
      for (const paso of PASOS) {
        process.stdout.write(`${paso.archivo.padEnd(26)} ${paso.que}… `);
        await consultar(leer(paso.archivo));
        console.log("listo");
      }
      console.log("");
    }

    const { problemas, filas, roles } = await verificar();

    console.log("Roles:", roles.join(", "));
    console.table(filas);

    if (problemas.length > 0) {
      console.error("\nProblemas:");
      problemas.forEach((p) => console.error("  -", p));
      process.exitCode = 1;
      return;
    }

    console.log("\nBase de datos lista: 9 tablas, 3 roles, RLS en todas.");
  } catch (error) {
    console.error("\nError:", error.message);
    if (/password|autenticación|authentication/i.test(error.message)) {
      console.error("Revisa la contraseña dentro de DATABASE_URL en el .env.");
    }
    if (/self[- ]signed|certificate/i.test(error.message)) {
      console.error(
        "Descarga el certificado de Supabase a certs/prod-ca-2021.crt, o usa el endpoint de pooler."
      );
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

principal();
