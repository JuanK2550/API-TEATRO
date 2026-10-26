// ========================================
// Bootstrap del primer administrador
// ========================================
// Crea la cuenta administradora inicial, una sola vez y de forma explícita:
//
//   npm run seed:admin
//
// Arrancar la API no lo ejecuta. Son dos cosas distintas: montar el teatro y
// entregar la primera llave maestra.
//
// No imprime el correo, la contraseña ni la cadena de conexión.
require("dotenv").config();

const usuariosService = require("../src/services/usuarios.service");
const { cerrarPool } = require("../src/config/database");

// ========================================
// Validación de las variables del entorno
// Se comprueba aquí y en el service: el script falla antes de conectar
// ========================================
const LONGITUD_MINIMA_PASSWORD = 12;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validarConfiguracion = () => {
  const nombre = process.env.ADMIN_NOMBRE?.trim();
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!nombre || !email || !password) {
    throw new Error("Faltan ADMIN_NOMBRE, ADMIN_EMAIL o ADMIN_PASSWORD");
  }

  if (password.length < LONGITUD_MINIMA_PASSWORD) {
    throw new Error(
      `ADMIN_PASSWORD debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`
    );
  }

  if (!FORMATO_EMAIL.test(email)) {
    throw new Error("ADMIN_EMAIL no tiene un formato válido");
  }
};

// ========================================
// Principal
// ========================================
const principal = async () => {
  try {
    validarConfiguracion();

    console.log("Iniciando bootstrap administrativo…");

    const resultado = await usuariosService.crearAdministradorInicial();

    if (resultado.creado) {
      console.log("Administrador inicial creado correctamente.");
      console.log("ID del administrador:", resultado.usuario.id);
    } else {
      console.log("Ya existe una cuenta administradora.");
      console.log("No se realizaron modificaciones.");
    }

    console.log("Bootstrap finalizado correctamente.");
  } catch (error) {
    console.error("Error en bootstrap administrativo:", error.message);
    process.exitCode = 1;
  } finally {
    try {
      await cerrarPool();
    } catch (error) {
      console.error("No se pudo cerrar el pool:", error.message);
      process.exitCode = 1;
    }
  }
};

principal();
