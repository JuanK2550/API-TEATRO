// ========================================
// Gráficos en SVG
// Sin estilos en línea: la CSP del build no admite style-src 'unsafe-inline'
// ========================================
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function EstadosEnBarras({ conteo, etiquetas, descripcion }) {
  const maximo = Math.max(1, ...Object.values(conteo));

  return (
    <ul className="lista-estados" aria-label={descripcion}>
      {Object.entries(conteo).map(([estado, total]) => (
        <li key={estado}>
          <span className={`estado estado-${estado}`}>{etiquetas[estado] ?? estado}</span>
          <svg className="barra-estado" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <rect className={`relleno-${estado}`} x="0" y="0" height="10" width={(total / maximo) * 100} rx="5" />
          </svg>
          <strong>{total}</strong>
        </li>
      ))}
    </ul>
  );
}

export function BarrasPorMes({ serie, unidad }) {
  if (!serie.length) return <p className="texto-secundario mb-0">Todavía no hay {unidad} con fecha.</p>;

  const ancho = 520;
  const alto = 200;
  const base = alto - 28;
  const maximo = Math.max(1, ...serie.map(({ total }) => total));
  const paso = ancho / serie.length;
  const barra = Math.min(56, paso * 0.55);

  return (
    <svg className="grafico-mes" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`${unidad} por mes: ${serie.map(({ mes, total }) => `${mes} ${total}`).join(", ")}`}>
      <line className="base" x1="0" y1={base} x2={ancho} y2={base} />
      {serie.map(({ mes, total }, i) => {
        const altura = Math.max(4, (total / maximo) * (base - 26));
        const x = i * paso + (paso - barra) / 2;
        return (
          <g key={mes}>
            <rect className="barra" x={x} y={base - altura} width={barra} height={altura} rx="5" />
            <text className="valor" x={x + barra / 2} y={base - altura - 7} textAnchor="middle">
              {total}
            </text>
            <text className="etiqueta" x={x + barra / 2} y={alto - 8} textAnchor="middle">
              {MESES[Number(mes.slice(5, 7)) - 1]} {mes.slice(2, 4)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
