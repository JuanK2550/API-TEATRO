// ========================================
// Importaciones
// ========================================
const fs = require("node:fs");
const path = require("node:path");
const { Pool, types } = require("pg");

require("dotenv").config();

// ========================================
// Los BIGINT vuelven como número, no como texto
// ========================================
// pg devuelve int8 en texto por defecto, porque un BIGINT puede superar lo que
// un number de JavaScript representa sin perder precisión. Aquí los ids son
// contadores que no van a acercarse a ese límite, y devolverlos como texto
// rompería tanto las comparaciones del código como el JSON de la API, que
// siempre ha dicho "id": 1 y no "id": "1".
types.setTypeParser(types.builtins.INT8, (valor) => Number(valor));

// ========================================
// Las fechas y las horas vuelven como texto
// ========================================
// pg convierte DATE y TIME a objetos Date de JavaScript, que al serializarse
// se vuelven "1995-03-14T00:00:00.000Z" y arrastran una zona horaria que aquí
// no significa nada: la fecha de una función es la del teatro, no un instante
// universal. La API siempre ha devuelto "1995-03-14" y "19:00", así que estos
// dos tipos se dejan tal como los manda PostgreSQL.
types.setTypeParser(types.builtins.DATE, (valor) => valor);
types.setTypeParser(types.builtins.TIME, (valor) => valor);

// ========================================
// La cadena de conexión vive solo en el .env
// ========================================
// Si falta, el servidor no arranca. Es deliberado: preferimos no arrancar a
// arrancar sin base y descubrirlo en la primera petición de un usuario.
if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en el archivo .env");
}

// ========================================
// Certificado de la autoridad de Supabase
// ========================================
// TLS cifra el tráfico entre Node y PostgreSQL. Con rejectUnauthorized en true
// Node además comprueba que el servidor al otro lado sea de verdad el nuestro.
// Cifrar sin verificar la identidad no protege de un intermediario, así que
// rejectUnauthorized queda en true siempre y no hay interruptor para apagarlo.
//
// De dónde sale la autoridad que firma esa comprobación:
//   1. certs/prod-ca-2021.crt, si está descargado. Es lo que pide el
//      laboratorio y lo que hace falta para el endpoint directo, cuyo
//      certificado no encadena con ninguna autoridad pública.
//   2. Si no está, las autoridades que ya trae Node. Sirve para los endpoints
//      de pooler, que sí usan un certificado público.
//
// Lo que NUNCA se hace es poner rejectUnauthorized en false: eso haría que la
// conexión funcionara contra un intermediario tan bien como contra Supabase.
const rutaCertificado = path.resolve(
  __dirname,
  "..",
  "..",
  "certs",
  "prod-ca-2021.crt"
);

const hayCertificadoPropio = fs.existsSync(rutaCertificado);

const ssl = {
  rejectUnauthorized: true
};

if (hayCertificadoPropio) {
  ssl.ca = fs.readFileSync(rutaCertificado, "utf8");
}

// ========================================
// Pool de conexiones
// ========================================
// Un pool y no una conexión por petición: abrir una conexión TLS cuesta, y el
// plan gratuito de Supabase limita cuántas puede haber a la vez.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl,

  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// ========================================
// Errores de conexiones inactivas
// ========================================
// Una conexión del pool puede caerse mientras nadie la usa. Sin este oyente,
// ese error llegaría a process y tumbaría el servidor.
pool.on("error", (error) => {
  console.error("Error en conexión PostgreSQL inactiva:", error.message);
});

// ========================================
// Consultar
// Los parámetros van siempre separados del SQL
// ========================================
// pg sustituye $1, $2… del lado del servidor, así que el valor nunca se
// concatena en la consulta. Es la protección contra inyección SQL, y es el
// motivo por el que en este proyecto no se arma SQL con plantillas.
const consultar = (sql, parametros = []) => pool.query(sql, parametros);

// ========================================
// Transacción
// Varias escrituras que valen todas o ninguna
// ========================================
// Guardar una función es escribir en tres tablas: funciones, funcion_tarifas y
// funcion_descuentos. Sin transacción, un fallo a mitad dejaría una función sin
// tarifas, que es un estado que las reglas del teatro no admiten.
//
// La función que se recibe trabaja con su propio cliente, no con el pool: todas
// sus consultas tienen que ir por la misma conexión para estar dentro de la
// misma transacción.
const enTransaccion = async (trabajo) => {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");
    const resultado = await trabajo((sql, parametros = []) =>
      cliente.query(sql, parametros)
    );
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
};

// ========================================
// Cierre controlado de conexiones
// Lo necesitan los scripts sueltos, no el servidor
// ========================================
// Sin esto un script termina su trabajo y el proceso se queda vivo, porque el
// pool mantiene conexiones abiertas esperando más consultas.
const cerrarPool = async () => {
  await pool.end();
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  pool,
  consultar,
  enTransaccion,
  cerrarPool,
  hayCertificadoPropio
};
