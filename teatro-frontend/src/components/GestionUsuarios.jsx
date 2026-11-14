import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { actualizarUsuario, cambiarEstadoUsuario, crearUsuario, listarUsuarios } from "../services/usuarios.service";
import { ETIQUETAS_ROL, formatearFecha } from "../utils/formato";
import { LONGITUD_MINIMA } from "../utils/password";
import EstadoInsignia from "./EstadoInsignia";
import Aviso from "./Aviso";

const VACIO = { nombre: "", email: "", password: "", rol: "taquilla" };

// ========================================
// Usuarios y roles
// ========================================
export default function GestionUsuarios() {
  const { token, usuario: yo } = useAuth();
  const [texto, setTexto] = useState("");
  const [filtros, setFiltros] = useState({ q: "", rol: "", activo: "", pagina: 1 });
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // La búsqueda espera a que se deje de escribir para no pedir en cada tecla.
  useEffect(() => {
    const espera = setTimeout(() => {
      setFiltros((actual) => (actual.q === texto ? actual : { ...actual, q: texto, pagina: 1 }));
    }, 350);
    return () => clearTimeout(espera);
  }, [texto]);

  const cargar = useCallback((signal) => listarUsuarios(filtros, token, signal), [filtros, token]);
  const { datos, error, cargando, recargar } = useDatos(cargar);
  const usuarios = datos?.usuarios ?? [];
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.porPagina)) : 1;

  const cambiarFiltro = (campo) => (e) => setFiltros((actual) => ({ ...actual, [campo]: e.target.value, pagina: 1 }));
  const cambiarCampo = (campo) => (e) => setFormulario((actual) => ({ ...actual, [campo]: e.target.value }));

  async function guardar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setMensaje(null);
    try {
      if (formulario.id) {
        await actualizarUsuario(formulario.id, { nombre: formulario.nombre, email: formulario.email }, token);
        setMensaje({ tipo: "exito", texto: "Cuenta actualizada correctamente." });
      } else {
        await crearUsuario(
          { nombre: formulario.nombre, email: formulario.email, password: formulario.password, rol: formulario.rol },
          token
        );
        setMensaje({ tipo: "exito", texto: `Cuenta de ${ETIQUETAS_ROL[formulario.rol].toLowerCase()} creada correctamente.` });
      }
      setFormulario(null);
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    } finally {
      setOcupado(false);
    }
  }

  async function alternarEstado(cuenta) {
    const accion = cuenta.activo ? "desactivar" : "activar";
    const aviso = cuenta.activo ? " Sus sesiones abiertas se cerrarán en la siguiente petición." : "";
    if (!window.confirm(`¿Seguro que quieres ${accion} la cuenta de ${cuenta.nombre}?${aviso}`)) return;

    setMensaje(null);
    try {
      const respuesta = await cambiarEstadoUsuario(cuenta.id, !cuenta.activo, token);
      setMensaje({ tipo: "exito", texto: respuesta.mensaje });
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    }
  }

  return (
    <section className="tarjeta modulo" aria-labelledby="usuarios-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="usuarios-titulo">Usuarios y roles</h2>
          <p>Cuentas del teatro. Aquí se crean las de taquilla y administración; los asistentes se registran solos.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-primary" type="button" onClick={() => setFormulario({ ...VACIO })}>
            Crear cuenta
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={recargar} disabled={cargando}>
            Actualizar
          </button>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {formulario && (
        <form className="formulario-panel" onSubmit={guardar}>
          <h3>{formulario.id ? `Editar a ${formulario.nombreOriginal}` : "Nueva cuenta"}</h3>
          <div className="formulario-rejilla">
            <div>
              <label className="form-label" htmlFor="usuario-nombre">Nombre</label>
              <input id="usuario-nombre" className="form-control" required minLength={3} maxLength={100} value={formulario.nombre} onChange={cambiarCampo("nombre")} />
            </div>
            <div>
              <label className="form-label" htmlFor="usuario-email">Correo</label>
              <input id="usuario-email" className="form-control" type="email" required value={formulario.email} onChange={cambiarCampo("email")} />
            </div>
            {!formulario.id && (
              <>
                <div>
                  <label className="form-label" htmlFor="usuario-password">Contraseña inicial</label>
                  <input
                    id="usuario-password"
                    className="form-control"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={LONGITUD_MINIMA}
                    aria-describedby="usuario-password-ayuda"
                    value={formulario.password}
                    onChange={cambiarCampo("password")}
                  />
                  <div id="usuario-password-ayuda" className="form-text">Mínimo {LONGITUD_MINIMA} caracteres. Entrégala por un canal privado.</div>
                </div>
                <div>
                  <label className="form-label" htmlFor="usuario-rol">Rol</label>
                  <select id="usuario-rol" className="form-select" value={formulario.rol} onChange={cambiarCampo("rol")}>
                    <option value="taquilla">Taquilla</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </div>
              </>
            )}
          </div>
          {formulario.id && <p className="form-text mb-0 mt-2">El rol y la contraseña no se cambian desde aquí.</p>}
          <div className="formulario-botones">
            <button className="btn btn-primary" type="submit" disabled={ocupado}>
              {ocupado ? "Guardando…" : formulario.id ? "Guardar cambios" : "Crear cuenta"}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => setFormulario(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="filtros" role="search">
        <div>
          <label className="form-label" htmlFor="usuarios-buscar">Nombre o correo</label>
          <input id="usuarios-buscar" className="form-control" type="search" placeholder="Buscar cuentas" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="usuarios-rol">Rol</label>
          <select id="usuarios-rol" className="form-select" value={filtros.rol} onChange={cambiarFiltro("rol")}>
            <option value="">Todos</option>
            <option value="administrador">Administrador</option>
            <option value="taquilla">Taquilla</option>
            <option value="asistente">Asistente</option>
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="usuarios-estado">Estado</label>
          <select id="usuarios-estado" className="form-select" value={filtros.activo} onChange={cambiarFiltro("activo")}>
            <option value="">Todos</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
        </div>
      </div>

      {error && <Aviso mensaje={{ tipo: "error", texto: error }} />}

      <div className="tabla-contenedor">
        <table className="table table-hover">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Correo</th>
              <th scope="col">Rol</th>
              <th scope="col">Alta</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((cuenta) => (
              <tr key={cuenta.id}>
                <td>
                  {cuenta.nombre}
                  {cuenta.id === yo?.id && <span className="texto-secundario"> · tú</span>}
                </td>
                <td className="text-break">{cuenta.email}</td>
                <td>{ETIQUETAS_ROL[cuenta.rol] ?? cuenta.rol}</td>
                <td className="cifra">{formatearFecha(cuenta.fechaRegistro)}</td>
                <td>
                  <EstadoInsignia estado={cuenta.activo ? "activo" : "inactivo"} texto={cuenta.activo ? "Activa" : "Inactiva"} />
                </td>
                <td>
                  <div className="tabla-acciones">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      onClick={() => setFormulario({ id: cuenta.id, nombre: cuenta.nombre, email: cuenta.email, nombreOriginal: cuenta.nombre })}
                    >
                      Editar
                    </button>
                    {cuenta.id !== yo?.id && (
                      <button className={`btn btn-sm ${cuenta.activo ? "btn-outline-primary" : "btn-outline-secondary"}`} type="button" onClick={() => alternarEstado(cuenta)}>
                        {cuenta.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && usuarios.length === 0 && <p className="vacio">No hay cuentas que coincidan con los filtros.</p>}
      </div>

      <div className="tabla-pie">
        <span>
          {cargando ? "Consultando…" : `${datos?.total ?? 0} cuenta(s) · página ${filtros.pagina} de ${paginas}`}
        </span>
        <span className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" type="button" disabled={filtros.pagina <= 1 || cargando} onClick={() => setFiltros((a) => ({ ...a, pagina: a.pagina - 1 }))}>
            Anterior
          </button>
          <button className="btn btn-outline-secondary btn-sm" type="button" disabled={filtros.pagina >= paginas || cargando} onClick={() => setFiltros((a) => ({ ...a, pagina: a.pagina + 1 }))}>
            Siguiente
          </button>
        </span>
      </div>
    </section>
  );
}
