import { consultarRecurso, crearRecurso, modificarRecurso } from "./recursos.service";

// ========================================
// Funciones
// El estado nunca viaja al crear: toda función nace programada
// ========================================
export const listarFunciones = (token, signal) => consultarRecurso("/api/funciones", token, signal);
export const tarifasDeFuncion = (id, token, signal) => consultarRecurso(`/api/funciones/${id}/tarifas`, token, signal);
export const ocupacionDeFuncion = (id, token, signal) => consultarRecurso(`/api/funciones/${id}/ocupacion`, token, signal);
export const crearFuncion = (datos, token) => crearRecurso("/api/funciones", datos, token);
export const cambiarEstadoFuncion = (id, estado, token) =>
  modificarRecurso(`/api/funciones/${id}/estado`, { estado }, token);

// ========================================
// Transiciones que la API acepta
// Se usan para ofrecer solo botones que pueden funcionar
// ========================================
export const TRANSICIONES_FUNCION = {
  programada: ["en_venta", "cancelada"],
  en_venta: ["agotada", "en_curso", "cancelada"],
  agotada: ["en_curso", "cancelada"],
  en_curso: ["finalizada"],
  finalizada: [],
  cancelada: []
};

// ========================================
// Funciones de un evento
// ========================================
export const funcionesDeEvento = (eventoId, token, signal) =>
  consultarRecurso(`/api/funciones/evento/${eventoId}`, token, signal);
