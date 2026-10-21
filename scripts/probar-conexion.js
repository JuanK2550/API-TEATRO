// ========================================
// Prueba de conectividad con Supabase PostgreSQL
// ========================================
// Comprueba, sin tocar ningún dato, que la cadena de conexión, el certificado
// y los permisos funcionan. Se ejecuta desde la raíz del proyecto:
//
//   node scripts/probar-conexion.js
//
// No imprime la cadena de conexión ni ninguna credencial.
const { pool, consultar } = require("../src/config/database");

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

const probarConexion = async () => {
  try {
    console.log("Conectando con Supabase…\n");

    // ========================================
    // Quién somos y contra qué base
    // ========================================
    const identidad = await consultar(`
      SELECT
        current_database() AS base_datos,
        current_user       AS usuario,
        NOW()              AS fecha_servidor
    `);
    console.table(identidad.rows);

    // ========================================
    // El cifrado está activo de verdad
    // ========================================
    // No basta con pedir TLS: esta vista dice si la conexión actual lo usa.
    const cifrado = await consultar(`
      SELECT ssl, version AS protocolo
      FROM pg_stat_ssl
      WHERE pid = pg_backend_pid()
    `);
    console.log("Cifrado de la conexión:");
    console.table(cifrado.rows);

    // ========================================
    // Los tres roles del teatro
    // ========================================
    const roles = await consultar(`
      SELECT id, nombre, activo
      FROM public.roles
      ORDER BY id
    `);
    console.log("Roles registrados:");
    console.table(roles.rows);

    // ========================================
    // Las nueve tablas y cuántas filas tiene cada una
    // ========================================
    const conteos = await consultar(
      `
      SELECT
        c.relname AS tabla,
        c.relrowsecurity AS rls,
        (SELECT COUNT(*) FROM public.roles)              AS _ignorar
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname = ANY($1)
      ORDER BY c.relname
      `,
      [TABLAS]
    );

    const filas = [];
    for (const t of conteos.rows) {
      // El nombre de la tabla viene de la lista fija de arriba, no del
      // usuario, así que interpolarlo aquí no abre ninguna inyección.
      const n = await consultar(`SELECT COUNT(*)::int AS n FROM public.${t.tabla}`);
      filas.push({ tabla: t.tabla, rls: t.rls, filas: n.rows[0].n });
    }
    console.log("Tablas:");
    console.table(filas);

    const faltan = TABLAS.filter((t) => !filas.some((f) => f.tabla === t));
    if (faltan.length > 0) {
      console.error("Faltan tablas:", faltan.join(", "));
      process.exitCode = 1;
      return;
    }

    const sinRls = filas.filter((f) => !f.rls).map((f) => f.tabla);
    if (sinRls.length > 0) {
      console.error("Sin Row Level Security:", sinRls.join(", "));
      process.exitCode = 1;
      return;
    }

    console.log("\nConexión PostgreSQL correcta: 9 tablas, RLS en todas.");
  } catch (error) {
    console.error("Error de conexión:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

probarConexion();
