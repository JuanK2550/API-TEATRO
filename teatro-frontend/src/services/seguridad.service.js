import { notificarSesionInvalida } from "./sesion-expirada";

const API_URL = import.meta.env.VITE_API_URL;

// ========================================
// Petición a la API
// Único punto del panel que llama a fetch
// ========================================
// Nunca envía una API Key: el navegador no tiene ninguna. Lo que identifica a
// la persona es el JWT, y solo cuando hay sesión.
export async function solicitudSegura(ruta, { token, method = "GET", body, signal } = {}) {
  let respuesta;

  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal,
      cache: "no-store"
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("No fue posible conectar con la API del teatro.", { cause: error });
  }

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    notificarSesionInvalida(respuesta, datos, token);

    // El validador de la API devuelve cada error como { campo, mensaje }.
    const detalle = Array.isArray(datos.errores)
      ? datos.errores.map((item) => item.mensaje).filter(Boolean).join(". ")
      : "";

    const error = new Error(
      respuesta.status === 429
        ? "Demasiados intentos. Espera unos minutos antes de volver a intentar."
        : detalle || datos.mensaje || `Error HTTP ${respuesta.status}`
    );
    error.status = respuesta.status;
    throw error;
  }

  return datos;
}

// ========================================
// Cuenta propia
// ========================================
export const cambiarPassword = (datos, token) =>
  solicitudSegura("/api/auth/cambiar-password", { token, method: "PATCH", body: datos });

export const estadoCodigos = (token, signal) =>
  solicitudSegura("/api/auth/codigos-recuperacion/estado", { token, signal });

export const generarCodigos = (passwordActual, token) =>
  solicitudSegura("/api/auth/codigos-recuperacion", {
    token,
    method: "POST",
    body: { passwordActual }
  });

export const regenerarCodigos = (passwordActual, token) =>
  solicitudSegura("/api/auth/codigos-recuperacion/regenerar", {
    token,
    method: "POST",
    body: { passwordActual }
  });

// ========================================
// Recuperación sin sesión
// Las protege el propio secreto de un solo uso
// ========================================
export const restablecerConCodigo = (datos) =>
  solicitudSegura("/api/auth/restablecer-con-codigo", { method: "POST", body: datos });

export const restablecerConTokenAdmin = (datos) =>
  solicitudSegura("/api/auth/restablecer-password", { method: "POST", body: datos });

// ========================================
// Recuperación administrativa
// ========================================
export const buscarUsuariosRecuperacion = (texto, token, signal) =>
  solicitudSegura(`/api/usuarios/busqueda-recuperacion?q=${encodeURIComponent(texto)}`, {
    token,
    signal
  });

export const generarTokenRecuperacionAdmin = (usuarioId, token) =>
  solicitudSegura(`/api/auth/recuperacion/${encodeURIComponent(usuarioId)}`, {
    token,
    method: "POST"
  });
