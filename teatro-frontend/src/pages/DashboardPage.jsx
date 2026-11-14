import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Icono from "../components/Icono";
import { MENU_POR_ROL, MODULOS, PRESENTACION_POR_ROL, moduloPorRuta } from "../navegacion";
import { ETIQUETAS_ROL } from "../utils/formato";
import escenario from "../assets/escenario-luces-900.webp";

// ========================================
// Marco del panel
// Cada módulo se abre en su propia ruta dentro de este marco
// ========================================
export default function DashboardPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const rol = usuario?.rol;
  const presentacion = PRESENTACION_POR_ROL[rol] ?? PRESENTACION_POR_ROL.asistente;
  const menu = (MENU_POR_ROL[rol] ?? []).map((clave) => MODULOS[clave]);
  const nombre = usuario?.nombre || "Usuario";
  const moduloActual = moduloPorRuta(location.pathname.replace(/^\/panel\/?/, ""));

  // Primero se sale del panel y después se cierra la sesión: al revés, la ruta
  // protegida guardaría esta página como destino del siguiente que entre.
  function cerrarSesion() {
    navigate("/login", { replace: true });
    logout();
  }

  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <div className="panel">
      {menuAbierto && <button className="panel-velo" type="button" aria-label="Cerrar menú" onClick={cerrarMenu} />}

      <aside className={`panel-lateral ${menuAbierto ? "abierto" : ""}`} aria-label="Menú del panel">
        <div className="panel-marca">
          <span className="panel-marca-sello" aria-hidden="true">TM</span>
          <span className="panel-marca-texto">
            <strong>Teatro Maldonado</strong>
            <small>Panel de gestión</small>
          </span>
        </div>

        <div className="panel-menu-etiqueta">Menú principal</div>
        <nav className="panel-menu" aria-label="Navegación principal">
          <NavLink to="/panel" end onClick={cerrarMenu}>
            <Icono nombre="inicio" />
            Inicio
          </NavLink>
          {menu.map((modulo) => (
            <NavLink key={modulo.ruta} to={`/panel/${modulo.ruta}`} onClick={cerrarMenu}>
              <Icono nombre={modulo.icono} />
              {modulo.titulo}
            </NavLink>
          ))}
        </nav>

        <div className="panel-lateral-pie">
          <NavLink to="/" className="panel-lateral-enlace">
            <Icono nombre="cartelera" />
            Ver la cartelera
          </NavLink>
          <button type="button" onClick={cerrarSesion}>
            <Icono nombre="salir" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="panel-principal">
        <header className="panel-superior">
          <button className="panel-abrir-menu" type="button" aria-label="Abrir menú" aria-expanded={menuAbierto} onClick={() => setMenuAbierto(true)}>
            <Icono nombre="menu" />
          </button>
          <nav className="panel-superior-ruta" aria-label="Ruta actual">
            <span>Inicio</span>
            <span aria-hidden="true">/</span>
            <strong>{moduloActual?.titulo ?? presentacion.titulo}</strong>
          </nav>
          <div className="panel-usuario">
            <span className="panel-avatar" aria-hidden="true">{nombre.charAt(0).toUpperCase()}</span>
            <span className="panel-usuario-texto">
              <strong>{nombre}</strong>
              <small>{ETIQUETAS_ROL[rol] ?? rol}</small>
            </span>
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={cerrarSesion}>
              Salir
            </button>
          </div>
        </header>

        <main className="panel-contenido" id="contenido">
          <section className="panel-telon" aria-label="Bienvenida">
            <div className="panel-telon-texto">
              <p>Bienvenido,</p>
              <h1>{nombre}</h1>
              <p>{presentacion.descripcion}</p>
              <span className="panel-rol">Rol: {ETIQUETAS_ROL[rol] ?? rol}</span>
            </div>
            <div className="panel-telon-foto">
              <img src={escenario} alt="" width="900" height="600" />
            </div>
          </section>

          <Outlet />

          <footer className="panel-pie">Teatro Maldonado · Tunja, Boyacá</footer>
        </main>
      </div>
    </div>
  );
}
