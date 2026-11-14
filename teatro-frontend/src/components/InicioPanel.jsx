import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDashboardData } from "../hooks/useDashboardData";
import ResumenTeatro from "./ResumenTeatro";
import Icono from "./Icono";
import { MENU_POR_ROL, MODULOS } from "../navegacion";
import { ETIQUETAS_ROL } from "../utils/formato";

// ========================================
// Inicio del panel
// ========================================
export default function InicioPanel() {
  const { usuario, token } = useAuth();
  const { datos, errores, cargando, actualizar } = useDashboardData(token, usuario?.rol);
  const accesos = (MENU_POR_ROL[usuario?.rol] ?? [])
    .map((clave) => MODULOS[clave])
    .filter((modulo) => !["codigos-recuperacion", "cambiar-password"].includes(modulo.ruta));

  return (
    <>
      <ResumenTeatro rol={usuario?.rol} datos={datos} errores={errores} cargando={cargando} actualizar={actualizar} />

      <div className="paneles-dobles">
        <section className="tarjeta panel-dato" aria-labelledby="cuenta-titulo">
          <h3 id="cuenta-titulo">Tu cuenta</h3>
          <dl className="mb-0">
            <dt>Nombre</dt>
            <dd>{usuario?.nombre}</dd>
            <dt>Correo</dt>
            <dd className="text-break">{usuario?.email}</dd>
            <dt>Rol</dt>
            <dd>{ETIQUETAS_ROL[usuario?.rol] ?? usuario?.rol}</dd>
            <dt>Sesión</dt>
            <dd className="mb-0">Activa en esta pestaña; se cierra al cerrarla</dd>
          </dl>
        </section>
        <section className="tarjeta panel-dato" aria-labelledby="accesos-titulo">
          <h3 id="accesos-titulo">Accesos rápidos</h3>
          <div className="d-grid gap-2">
            {accesos.map((modulo) => (
              <Link key={modulo.ruta} to={`/panel/${modulo.ruta}`} className="btn btn-outline-secondary text-start d-flex align-items-center gap-2">
                <span className="acceso-rapido-icono">
                  <Icono nombre={modulo.icono} />
                </span>
                {modulo.titulo}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
