// ========================================
// Autorizar roles
// Responde a "¿tu rol puede hacer esta operación?"
// ========================================
// Va siempre después de autenticarJWT, que es quien deja req.usuario. La
// distinción entre los dos códigos es la del bloque: 401 es "no sé quién eres",
// 403 es "sé quién eres y no te corresponde".
const autorizarRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    // ========================================
    // Debe existir usuario autenticado
    // ========================================
    if (!req.usuario) {
      return res.status(401).json({ mensaje: "Usuario no autenticado" });
    }

    // ========================================
    // Verificar rol
    // ========================================
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: "No tiene permisos para realizar esta operación"
      });
    }

    next();
  };
};

// ========================================
// Exportaciones
// ========================================
module.exports = autorizarRoles;
