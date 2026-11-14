import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// ========================================
// Marco del sitio público
// La cartelera y las fichas se leen sin cuenta
// ========================================
export default function SitioPublico() {
  const { autenticado, usuario } = useAuth();

  return (
    <div className="sitio">
      <header className="sitio-cabecera">
        <Link to="/" className="sitio-marca">
          <span className="panel-marca-sello" aria-hidden="true">TM</span>
          <span className="panel-marca-texto">
            <strong>Teatro Maldonado</strong>
            <small>Tunja</small>
          </span>
        </Link>
        <nav className="sitio-navegacion" aria-label="Sitio">
          <NavLink to="/" end>Cartelera</NavLink>
        </nav>
        <div className="sitio-acciones">
          {autenticado ? (
            <Link className="btn btn-primary btn-sm" to="/panel">
              {usuario?.rol === "asistente" ? "Mis boletas" : "Ir al panel"}
            </Link>
          ) : (
            <>
              <Link className="btn btn-outline-claro btn-sm" to="/login">Entrar</Link>
              <Link className="btn btn-primary btn-sm" to="/registro">Crear cuenta</Link>
            </>
          )}
        </div>
      </header>

      <main id="contenido">
        <Outlet />
      </main>

      <footer className="sitio-pie">
        <p>Teatro Maldonado · Tunja, Boyacá · Sala única con tres localidades</p>
        <p className="texto-secundario mb-0">Las compras de esta demostración son simuladas: no se cobra nada.</p>
      </footer>
    </div>
  );
}
