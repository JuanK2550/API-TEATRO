import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { actualizarAsistente, crearAsistente, listarAsistentes } from "../services/asistentes.service";
import { coincide, formatearFecha, hoyComoTexto } from "../utils/formato";
import EstadoInsignia from "./EstadoInsignia";
import Aviso from "./Aviso";

const VACIO = { nombre: "", documento: "", email: "", telefono: "", fechaNacimiento: "" };

// ========================================
// Asistentes
// ========================================
export default function GestionAsistentes() {
  const { token } = useAuth();
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback((signal) => listarAsistentes(token, signal), [token]);
  const { datos, error, cargando, recargar } = useDatos(cargar);

  const visibles = useMemo(
    () => (datos ?? []).filter((a) => !busqueda || coincide(`${a.nombre} ${a.documento} ${a.email}`, busqueda)),
    [datos, busqueda]
  );

  const campo = (nombre) => (e) => setFormulario((a) => ({ ...a, [nombre]: e.target.value }));

  async function guardar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setMensaje(null);
    const cuerpo = {
      nombre: formulario.nombre,
      documento: formulario.documento,
      email: formulario.email,
      telefono: formulario.telefono,
      fechaNacimiento: formulario.fechaNacimiento
    };
    try {
      if (formulario.id) await actualizarAsistente(formulario.id, cuerpo, token);
      else await crearAsistente(cuerpo, token);
      setMensaje({ tipo: "exito", texto: formulario.id ? "Ficha actualizada." : "Asistente registrado." });
      setFormulario(null);
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="tarjeta modulo" aria-labelledby="asistentes-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="asistentes-titulo">Asistentes</h2>
          <p>Fichas de quienes compran boletas. El documento y el correo son únicos.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-primary" type="button" onClick={() => setFormulario({ ...VACIO })}>
            Nuevo asistente
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={recargar} disabled={cargando}>
            Actualizar
          </button>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {formulario && (
        <form className="formulario-panel" onSubmit={guardar}>
          <h3>{formulario.id ? "Editar ficha" : "Nuevo asistente"}</h3>
          <div className="formulario-rejilla">
            <div>
              <label className="form-label" htmlFor="asistente-nombre">Nombre completo</label>
              <input id="asistente-nombre" className="form-control" required value={formulario.nombre} onChange={campo("nombre")} />
            </div>
            <div>
              <label className="form-label" htmlFor="asistente-documento">Documento</label>
              <input id="asistente-documento" className="form-control" inputMode="numeric" required value={formulario.documento} onChange={campo("documento")} />
            </div>
            <div>
              <label className="form-label" htmlFor="asistente-email">Correo</label>
              <input id="asistente-email" className="form-control" type="email" required value={formulario.email} onChange={campo("email")} />
            </div>
            <div>
              <label className="form-label" htmlFor="asistente-telefono">Teléfono</label>
              <input id="asistente-telefono" className="form-control" type="tel" inputMode="numeric" required value={formulario.telefono} onChange={campo("telefono")} />
            </div>
            <div>
              <label className="form-label" htmlFor="asistente-nacimiento">Fecha de nacimiento</label>
              <input id="asistente-nacimiento" className="form-control" type="date" max={hoyComoTexto()} required value={formulario.fechaNacimiento} onChange={campo("fechaNacimiento")} />
            </div>
          </div>
          <div className="formulario-botones">
            <button className="btn btn-primary" type="submit" disabled={ocupado}>
              {ocupado ? "Guardando…" : "Guardar ficha"}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => setFormulario(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="filtros" role="search">
        <div>
          <label className="form-label" htmlFor="asistentes-buscar">Buscar por nombre, documento o correo</label>
          <input id="asistentes-buscar" className="form-control" type="search" placeholder="Buscar asistentes" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      {error && <Aviso mensaje={{ tipo: "error", texto: error }} />}

      <div className="tabla-contenedor">
        <table className="table table-hover">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Documento</th>
              <th scope="col">Correo</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Nacimiento</th>
              <th scope="col">Cuenta</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((a) => (
              <tr key={a.id}>
                <td>{a.nombre}</td>
                <td className="cifra">{a.documento}</td>
                <td className="text-break">{a.email}</td>
                <td className="cifra">{a.telefono}</td>
                <td className="cifra">{formatearFecha(a.fechaNacimiento)}</td>
                <td>
                  <EstadoInsignia estado={a.usuarioId ? "activo" : "inactivo"} texto={a.usuarioId ? "Vinculada" : "Sin cuenta"} />
                </td>
                <td>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    onClick={() => setFormulario({ ...VACIO, ...a, fechaNacimiento: String(a.fechaNacimiento).slice(0, 10) })}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && visibles.length === 0 && <p className="vacio">No hay asistentes que coincidan.</p>}
      </div>
      <div className="tabla-pie">
        <span>{cargando ? "Consultando…" : `${visibles.length} de ${(datos ?? []).length} asistentes`}</span>
      </div>
    </section>
  );
}
