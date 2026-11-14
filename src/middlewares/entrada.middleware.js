// ========================================
// Rechazo del carácter nulo
// PostgreSQL no admite \u0000 en un texto: sin este filtro llegaba como un 500
// ========================================
const NULO = "\u0000";
const PROFUNDIDAD_MAXIMA = 20;

const contieneNulo = (valor, profundidad = 0) => {
  if (typeof valor === "string") return valor.includes(NULO);
  if (valor === null || typeof valor !== "object" || profundidad > PROFUNDIDAD_MAXIMA) return false;

  return Object.entries(valor).some(
    ([clave, interior]) => clave.includes(NULO) || contieneNulo(interior, profundidad + 1)
  );
};

const rutaConNulo = (ruta) => {
  try {
    return decodeURIComponent(ruta).includes(NULO);
  } catch {
    return false;
  }
};

// ========================================
// Middleware
// ========================================
const rechazarCaracterNulo = (req, res, next) => {
  if (contieneNulo(req.body) || contieneNulo(req.query) || rutaConNulo(req.path)) {
    console.warn(`Petición rechazada: carácter nulo en ${req.method} ${req.path}`);
    return res.status(400).json({ mensaje: "La petición contiene un carácter nulo, que no se admite" });
  }

  next();
};

// ========================================
// Exportaciones
// ========================================
module.exports = { rechazarCaracterNulo };
