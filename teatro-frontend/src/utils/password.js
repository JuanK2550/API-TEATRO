// ========================================
// Reglas de la contraseña nueva
// Las mismas que exige la API: de 12 a 72 caracteres
// ========================================
export const LONGITUD_MINIMA = 12;
export const LONGITUD_MAXIMA = 72;

export function problemaPasswordNueva(nueva, confirmacion) {
  if (nueva.length < LONGITUD_MINIMA) return `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`;
  if (nueva.length > LONGITUD_MAXIMA) return `La contraseña admite como máximo ${LONGITUD_MAXIMA} caracteres.`;
  if (nueva !== confirmacion) return "Las dos contraseñas no coinciden.";
  return "";
}
