// ========================================
// Aviso de sesión inválida
// Los servicios avisan sin depender de React
// ========================================
// El proveedor de autenticación escucha este evento y solo cierra la sesión si
// el token que falló es el de la sesión vigente: una respuesta tardía de una
// sesión anterior no puede echar al usuario actual.
export const EVENTO_SESION_INVALIDA = "teatro:sesion-invalida";

export function notificarSesionInvalida(respuesta, datos, token) {
  if (respuesta.status !== 401 || !token) return;

  window.dispatchEvent(
    new CustomEvent(EVENTO_SESION_INVALIDA, {
      detail: { token, motivo: datos?.mensaje || "Sesión no válida" }
    })
  );
}

// ========================================
// Aviso para la pantalla de acceso
// Explica por qué se cerró la sesión, una sola vez
// ========================================
const CLAVE_AVISO = "teatro_aviso_sesion";

export function guardarAvisoDeSesion(mensaje) {
  try {
    sessionStorage.setItem(CLAVE_AVISO, mensaje);
  } catch {
    /* sin almacenamiento, el aviso simplemente no se muestra */
  }
}

export function borrarAvisoDeSesion() {
  try {
    sessionStorage.removeItem(CLAVE_AVISO);
  } catch {
    /* nada que borrar */
  }
}

// Solo lee: borrarlo es trabajo de un efecto, porque React puede llamar dos
// veces al inicializador de estado en modo estricto.
export function leerAvisoDeSesion() {
  try {
    return sessionStorage.getItem(CLAVE_AVISO);
  } catch {
    return null;
  }
}
