import { etiquetaEstado } from "../utils/formato";

// ========================================
// Insignia de estado
// El color acompaña al texto, nunca lo sustituye
// ========================================
export default function EstadoInsignia({ estado, texto }) {
  return <span className={`estado estado-${estado}`}>{texto ?? etiquetaEstado(estado)}</span>;
}
