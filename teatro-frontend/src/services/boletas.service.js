import { consultarRecurso, crearRecurso, modificarRecurso } from "./recursos.service";

// ========================================
// Boletas
// Precio, código y estado los pone siempre el servidor
// ========================================
export const listarBoletas = (token, signal) => consultarRecurso("/api/boletas", token, signal);
export const boletasDeFuncion = (funcionId, token, signal) =>
  consultarRecurso(`/api/boletas/funcion/${funcionId}`, token, signal);

// Comprar: solo los campos del cliente. Nunca precio, código ni estado.
// El asistenteId lo exige el validador; cuando compra un asistente, el
// servidor lo ignora y usa el de su token.
export const comprarBoleta = ({ asistenteId, funcionId, localidadId, fila, numero, tipoDescuento }, token) =>
  crearRecurso("/api/boletas", { asistenteId, funcionId, localidadId, fila, numero, tipoDescuento }, token);

export const cambiarEstadoBoleta = (id, estado, token) =>
  modificarRecurso(`/api/boletas/${id}/estado`, { estado }, token);

// ========================================
// Mis boletas
// Sin ficha de asistente la API responde 403: para el panel es una lista vacía
// ========================================
export async function misBoletas(token, signal) {
  try {
    return await consultarRecurso("/api/boletas/mias", token, signal);
  } catch (error) {
    if (error.status === 403) return [];
    throw error;
  }
}

// ========================================
// Transiciones que la API acepta
// ========================================
export const TRANSICIONES_BOLETA = {
  reservada: ["pagada", "cancelada"],
  pagada: ["usada", "cancelada"],
  usada: [],
  cancelada: []
};
