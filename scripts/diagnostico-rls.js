// ========================================
// Diagnóstico de Row Level Security
// ========================================
// Responde a una pregunta que no se puede contestar mirando el esquema: con
// qué rol llega de verdad la API a PostgreSQL, y si ese rol se salta las
// políticas.
//
//   node scripts/diagnostico-rls.js
//
// Tener RLS activado no basta. Si la conexión usa el dueño de las tablas o un
// rol con BYPASSRLS, las políticas no se evalúan y la seguridad de filas es
// decorativa. Este script lo comprueba contra la base real.
//
// No imprime el host, la cadena de conexión ni credencial alguna.
require("dotenv").config();

const { consultar, cerrarPool } = require("../src/config/database");

// ========================================
// Principal
// ========================================
const principal = async () => {
  try {
    const identidad = await consultar(
      `SELECT
         current_user                AS usuario_sql,
         session_user                AS usuario_sesion,
         (SELECT rolsuper      FROM pg_roles WHERE rolname = current_user) AS es_superusuario,
         (SELECT rolbypassrls  FROM pg_roles WHERE rolname = current_user) AS puede_omitir_rls`
    );

    const fila = identidad.rows[0];

    console.log("Conexión de la API");
    console.log(`  usuario SQL        ${fila.usuario_sql}`);
    console.log(`  usuario de sesión  ${fila.usuario_sesion}`);
    console.log(`  superusuario       ${fila.es_superusuario}`);
    console.log(`  omite RLS          ${fila.puede_omitir_rls}`);

    const tablas = await consultar(
      `SELECT c.relname AS tabla,
              c.relrowsecurity AS rls,
              pg_get_userbyid(c.relowner) = current_user AS es_dueno,
              (SELECT COUNT(*)::int FROM pg_policies p
                WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas
       FROM pg_class c
       WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
       ORDER BY c.relname`
    );

    console.log("\nTablas");
    console.log("  tabla                 RLS     dueño   políticas");
    for (const t of tablas.rows) {
      console.log(
        `  ${t.tabla.padEnd(22)}${String(t.rls).padEnd(8)}${String(t.es_dueno).padEnd(8)}${t.politicas}`
      );
    }

    // El veredicto, que es lo único que importa de todo lo anterior.
    const seAplica =
      !fila.es_superusuario &&
      !fila.puede_omitir_rls &&
      tablas.rows.every((t) => t.rls && !t.es_dueno && t.politicas > 0);

    console.log(
      `\n${
        seAplica
          ? "RLS SE APLICA a esta conexión: el rol no es dueño, no omite RLS y cada tabla tiene política."
          : "RLS NO SE APLICA a esta conexión: revisa el usuario, BYPASSRLS, la propiedad de las tablas y las políticas."
      }`
    );

    if (!seAplica) process.exitCode = 1;
  } catch (error) {
    console.error("Error en el diagnóstico:", error.message);
    process.exitCode = 1;
  } finally {
    await cerrarPool();
  }
};

principal();
