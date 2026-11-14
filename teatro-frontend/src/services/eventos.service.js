import { consultarRecurso, crearRecurso, modificarRecurso, reemplazarRecurso } from "./recursos.service";

// ========================================
// Eventos
// El campo activo solo cambia por su ruta de estado
// ========================================
export const listarEventos = (token, signal) => consultarRecurso("/api/eventos", token, signal);
export const crearEvento = (datos, token) => crearRecurso("/api/eventos", datos, token);
export const actualizarEvento = (id, datos, token) => reemplazarRecurso(`/api/eventos/${id}`, datos, token);
export const cambiarEstadoEvento = (id, activo, token) =>
  modificarRecurso(`/api/eventos/${id}/estado`, { activo }, token);
export const obtenerEvento = (id, token, signal) => consultarRecurso(`/api/eventos/${id}`, token, signal);
