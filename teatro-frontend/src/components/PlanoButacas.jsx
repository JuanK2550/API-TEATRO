import { useRef } from "react";

const MOVIMIENTOS = {
  ArrowRight: [0, 1],
  ArrowLeft: [0, -1],
  ArrowDown: [1, 0],
  ArrowUp: [-1, 0]
};

// ========================================
// Plano de una localidad
// Una sola parada de tabulación: dentro se navega con las flechas
// ========================================
export default function PlanoButacas({ localidad, ocupadas, fila, numero, alElegir }) {
  const contenedor = useRef(null);
  const filas = Array.from({ length: localidad.filas }, (_, i) => i + 1);
  const butacas = Array.from({ length: localidad.butacasPorFila }, (_, i) => i + 1);
  const ocupada = (f, n) => ocupadas.has(`${f}-${n}`);

  // La butaca que recibe el foco al entrar: la elegida, o la primera libre.
  let enfocable = fila && numero ? [fila, numero] : null;
  if (!enfocable) {
    for (const f of filas) {
      const libre = butacas.find((n) => !ocupada(f, n));
      if (libre) {
        enfocable = [f, libre];
        break;
      }
    }
  }

  function mover(evento) {
    const paso = MOVIMIENTOS[evento.key];
    const actual = evento.target.closest("[data-fila]");
    if (!paso || !actual) return;
    evento.preventDefault();
    const f = Math.min(Math.max(Number(actual.dataset.fila) + paso[0], 1), localidad.filas);
    const n = Math.min(Math.max(Number(actual.dataset.numero) + paso[1], 1), localidad.butacasPorFila);
    contenedor.current?.querySelector(`[data-fila="${f}"][data-numero="${n}"]`)?.focus();
  }

  const libres = filas.length * butacas.length - ocupadas.size;

  return (
    <div className="plano">
      <div className="plano-escenario" aria-hidden="true">Escenario</div>
      <div
        ref={contenedor}
        className="plano-butacas"
        role="group"
        aria-label={`Plano de ${localidad.nombre}: ${libres} butacas libres. Usa las flechas para moverte.`}
        onKeyDown={mover}
      >
        {filas.map((f) => (
          <div key={f} className="plano-fila">
            <span className="plano-rotulo" aria-hidden="true">{f}</span>
            {butacas.map((n) => {
              const tomada = ocupada(f, n);
              const elegida = f === fila && n === numero;
              const primera = enfocable && enfocable[0] === f && enfocable[1] === n;
              return (
                <button
                  key={n}
                  type="button"
                  className={`butaca${tomada ? " ocupada" : ""}${elegida ? " elegida" : ""}`}
                  data-fila={f}
                  data-numero={n}
                  tabIndex={primera ? 0 : -1}
                  aria-disabled={tomada}
                  aria-pressed={elegida}
                  aria-label={`Fila ${f}, butaca ${n}${tomada ? ", ocupada" : ""}`}
                  onClick={() => !tomada && alElegir(f, n)}
                />
              );
            })}
            <span className="plano-rotulo" aria-hidden="true">{f}</span>
          </div>
        ))}
      </div>
      <ul className="plano-leyenda" aria-hidden="true">
        <li><span className="butaca" /> Libre</li>
        <li><span className="butaca elegida" /> Tu elección</li>
        <li><span className="butaca ocupada" /> Ocupada</li>
      </ul>
    </div>
  );
}
