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
// Exportaciones
// ========================================
module.exports = {
  ROLES,
  ROL_POR_DEFECTO,
  obtenerUsuarioPorEmail,
  obtenerUsuarioPorId,
  crearUsuario,
  verificarCredenciales
};
