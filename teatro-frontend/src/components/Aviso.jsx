// ========================================
// Aviso de resultado
// Los errores interrumpen al lector de pantalla; los éxitos, no
// ========================================
export default function Aviso({ mensaje, alCerrar }) {
  if (!mensaje) return null;
  const esError = mensaje.tipo === "error";

  return (
    <div className={`aviso aviso-${mensaje.tipo}`} role={esError ? "alert" : "status"}>
      <span className="flex-grow-1">{mensaje.texto}</span>
      {alCerrar && (
        <button type="button" className="btn-close btn-sm" aria-label="Cerrar aviso" onClick={alCerrar} />
      )}
    </div>
  );
}
