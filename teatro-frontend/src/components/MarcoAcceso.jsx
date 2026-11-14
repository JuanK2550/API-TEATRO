import butacas from "../assets/butacas-vacias-900.webp";

// ========================================
// Marco de las pantallas sin sesión
// ========================================
export default function MarcoAcceso({ titulo, descripcion, children }) {
  return (
    <div className="acceso">
      <div className="acceso-foto">
        <img src={butacas} alt="" width="900" height="600" />
        <div className="acceso-foto-texto">
          <p>Teatro Maldonado · Tunja</p>
          <h2>La sala se prepara antes de que se abra el telón.</h2>
        </div>
      </div>
      <main className="acceso-lado">
        <section className="tarjeta acceso-tarjeta" aria-labelledby="acceso-titulo">
          <span className="panel-marca-sello" aria-hidden="true">TM</span>
          <h1 id="acceso-titulo">{titulo}</h1>
          <p>{descripcion}</p>
          {children}
          <p className="acceso-pie">Panel del teatro · React + Vite + Bootstrap · JWT</p>
        </section>
      </main>
    </div>
  );
}
