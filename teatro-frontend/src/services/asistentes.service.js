import { consultarRecurso, crearRecurso, modificarRecurso, reemplazarRecurso } from "./recursos.service";
import { solicitudSegura } from "./seguridad.service";

// ========================================
// Asistentes
// ========================================
export const listarAsistentes = (token, signal) => consultarRecurso("/api/asistentes", token, signal);
export const crearAsistente = (datos, token) => crearRecurso("/api/asistentes", datos, token);
export const actualizarAsistente = (id, datos, token) => reemplazarRecurso(`/api/asistentes/${id}`, datos, token);

// ========================================
// Ficha propia
// Un 404 no es un error: la cuenta todavía no tiene ficha
// ========================================
export async function miFichaDeAsistente(token, signal) {
  try {
    return await solicitudSegura("/api/asistentes/mio", { token, signal });
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export const crearMiFicha = (datos, token) => crearRecurso("/api/asistentes/mio", datos, token);
export const editarMiFicha = (datos, token) => modificarRecurso("/api/asistentes/mio", datos, token);
