import { useState } from "react";
import GestionEventos from "./GestionEventos";
import GestionFunciones from "./GestionFunciones";

// ========================================
// Eventos y funciones
// ========================================
const PESTANAS = [
  { clave: "eventos", texto: "Eventos" },
  { clave: "funciones", texto: "Funciones" }
];

export default function ProgramacionTeatro() {
  const [activa, setActiva] = useState("eventos");

  return (
    <>
      <div className="pestanas" role="tablist" aria-label="Programación">
        {PESTANAS.map(({ clave, texto }) => (
          <button
            key={clave}
            id={`pestana-${clave}`}
            type="button"
            role="tab"
            aria-selected={activa === clave}
            aria-controls={`panel-${clave}`}
            onClick={() => setActiva(clave)}
          >
            {texto}
          </button>
        ))}
      </div>
      <div id={`panel-${activa}`} role="tabpanel" aria-labelledby={`pestana-${activa}`}>
        {activa === "eventos" ? <GestionEventos /> : <GestionFunciones />}
      </div>
    </>
  );
}
