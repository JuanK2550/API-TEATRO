// ========================================
// Importaciones
// ========================================
const usuarios = require("../data/usuarios");
const {
  generarPasswordHash,
  verificarPassword
} = require("../utils/password.util");

// ========================================
// Roles del sistema
// Todo registro nace con el rol menos privilegiado
// ========================================
const ROLES = ["administrador", "taquilla", "asistente"];
const ROL_POR_DEFECTO = "asistente";

// ========================================
// Obtener usuario por email
// El email es único, comparado siempre en minúsculas
// ========================================
const obtenerUsuarioPorEmail = (email) =>
  usuarios.find(
    (usuario) => usuario.email.toLowerCase() === email.toLowerCase()
  );

// ========================================
// Obtener usuario por id
// ========================================
const obtenerUsuarioPorId = (id) =>
  usuarios.find((usuario) => usuario.id === Number(id));

// ========================================
// Crear usuario
// La contraseña se guarda solo como hash
// ========================================
// El objeto se arma campo por campo, nunca con spread de datos: solo entra lo
// que se nombra aquí.
const crearUsuario = async (datos) => {
  const passwordHash = await generarPasswordHash(datos.password);

  const nuevoUsuario = {
    id:
      usuarios.length > 0
        ? Math.max(...usuarios.map((usuario) => usuario.id)) + 1
        : 1,
    nombre: datos.nombre,
    email: datos.email.toLowerCase(),
    passwordHash,
    // ========================================
    // Valores controlados por el servidor
    // El cliente no puede fijar su rol ni activarse a sí mismo
    // ========================================
    rol: ROL_POR_DEFECTO,
    activo: true
  };

  usuarios.push(nuevoUsuario);

  return nuevoUsuario;
};

// ========================================
// Verificar credenciales
// Devuelve null tanto si el email no existe como si la contraseña no coincide
// ========================================
const verificarCredenciales = async (email, password) => {
  const usuario = obtenerUsuarioPorEmail(email);

  if (!usuario) return null;

  const passwordValida = await verificarPassword(
    password,
    usuario.passwordHash
  );

  if (!passwordValida) return null;

  return usuario;
};

// ========================================
// Administrador inicial
// Sin él nadie podría crear el primer administrador
// ========================================
// El problema es de arranque: las operaciones administrativas exigen un
// administrador, y crear administradores es una operación administrativa. Se
// rompe sembrando uno desde el entorno al levantar el servidor.
//
// Las credenciales viven solo en el .env. Aquí no se imprime el correo ni la
// contraseña: un log con la contraseña del administrador es tan grave como
// escribirla en el código, porque los registros se copian, se comparten y se
// suben a sistemas de monitoreo.
const crearAdministradorInicial = async () => {
  const nombre = process.env.ADMIN_NOMBRE;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!nombre || !email || !password) {
    console.warn(
      "Administrador inicial no configurado: faltan ADMIN_NOMBRE, ADMIN_EMAIL o ADMIN_PASSWORD"
    );
    return null;
  }

  const existente = obtenerUsuarioPorEmail(email);
  if (existente) return existente;

  const passwordHash = await generarPasswordHash(password);

  const administrador = {
    id:
      usuarios.length > 0
        ? Math.max(...usuarios.map((usuario) => usuario.id)) + 1
        : 1,
    nombre,
    email: email.toLowerCase(),
    passwordHash,
    // ========================================
    // Valores controlados por el servidor
    // ========================================
    rol: "administrador",
    activo: true
  };

  usuarios.push(administrador);

  console.log("Administrador inicial creado");

  return administrador;
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
  ROLES,
  ROL_POR_DEFECTO,
  obtenerUsuarioPorEmail,
  obtenerUsuarioPorId,
  crearUsuario,
  verificarCredenciales,
  crearAdministradorInicial
};
