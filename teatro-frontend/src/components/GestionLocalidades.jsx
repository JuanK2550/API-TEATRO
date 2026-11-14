import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { actualizarLocalidad, cambiarEstadoLocalidad, crearLocalidad, listarLocalidades } from "../services/localidades.service";
import { coincide } from "../utils/formato";
import EstadoInsignia from "./EstadoInsignia";
import Aviso from "./Aviso";

const VACIO = { codigo: "", nombre: "", orden: "", filas: "", butacasPorFila: "" };

// ========================================
// Localidades
// ========================================
export default function GestionLocalidades() {
  const { token } = useAuth();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback((signal) => listarLocalidades(token, signal), [token]);
  const { datos, error, cargando, recargar } = useDatos(cargar);

  const visibles = useMemo(
    () =>
      (datos ?? [])
        .filter((l) => (!busqueda || coincide(`${l.codigo} ${l.nombre}`, busqueda)) && (!estado || String(l.activa) === estado))
        .sort((a, b) => a.orden - b.orden),
    [datos, busqueda, estado]
  );

  const campo = (nombre) => (e) => setFormulario((a) => ({ ...a, [nombre]: e.target.value }));
  const capacidadPrevista = formulario ? Number(formulario.filas) * Number(formulario.butacasPorFila) || 0 : 0;

  async function guardar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setMensaje(null);
    const cuerpo = {
      codigo: formulario.codigo,
      nombre: formulario.nombre,
      orden: Number(formulario.orden),
      filas: Number(formulario.filas),
      butacasPorFila: Number(formulario.butacasPorFila)
    };
    try {
      if (formulario.id) await actualizarLocalidad(formulario.id, cuerpo, token);
      else await crearLocalidad(cuerpo, token);
      setMensaje({ tipo: "exito", texto: formulario.id ? "Localidad actualizada." : "Localidad creada y activa." });
      setFormulario(null);
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    } finally {
      setOcupado(false);
    }
  }

  async function alternar(l) {
    if (l.activa && !window.confirm(`¿Desactivar ${l.nombre}? Dejará de venderse en las funciones nuevas.`)) return;
    setMensaje(null);
    try {
      await cambiarEstadoLocalidad(l.id, !l.activa, token);
      setMensaje({ tipo: "exito", texto: `${l.nombre} ${l.activa ? "desactivada" : "activada"}.` });
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    }
  }

  return (
    <section className="tarjeta modulo" aria-labelledby="localidades-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="localidades-titulo">Localidades</h2>
          <p>Zonas de la sala. El orden 1 es la más cercana al escenario; la capacidad la calcula el servidor.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-primary" type="button" onClick={() => setFormulario({ ...VACIO })}>
            Nueva localidad
          </button>
          <button className="btn btn-outline-secondary" type="button" onClick={recargar} disabled={cargando}>
            Actualizar
          </button>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      {formulario && (
        <form className="formulario-panel" onSubmit={guardar}>
          <h3>{formulario.id ? "Editar localidad" : "Nueva localidad"}</h3>
          <div className="formulario-rejilla">
            <div>
              <label className="form-label" htmlFor="localidad-codigo">Código</label>
              <input id="localidad-codigo" className="form-control codigo" required value={formulario.codigo} onChange={campo("codigo")} />
            </div>
            <div>
              <label className="form-label" htmlFor="localidad-nombre">Nombre</label>
              <input id="localidad-nombre" className="form-control" required value={formulario.nombre} onChange={campo("nombre")} />
            </div>
            <div>
              <label className="form-label" htmlFor="localidad-orden">Orden (cercanía)</label>
              <input id="localidad-orden" className="form-control" type="number" min={1} required value={formulario.orden} onChange={campo("orden")} />
            </div>
            <div>
              <label className="form-label" htmlFor="localidad-filas">Filas</label>
              <input id="localidad-filas" className="form-control" type="number" min={1} required value={formulario.filas} onChange={campo("filas")} />
            </div>
            <div>
              <label className="form-label" htmlFor="localidad-butacas">Butacas por fila</label>
              <input id="localidad-butacas" className="form-control" type="number" min={1} required value={formulario.butacasPorFila} onChange={campo("butacasPorFila")} />
            </div>
          </div>
          <p className="form-text mb-0 mt-2" aria-live="polite">
            Capacidad que calculará el servidor: <strong className="cifra">{capacidadPrevista}</strong> butacas.
          </p>
          <div className="formulario-botones">
            <button className="btn btn-primary" type="submit" disabled={ocupado}>
              {ocupado ? "Guardando…" : "Guardar localidad"}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => setFormulario(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="filtros" role="search">
        <div>
          <label className="form-label" htmlFor="localidades-buscar">Buscar por código o nombre</label>
          <input id="localidades-buscar" className="form-control" type="search" placeholder="Ej.: BAL" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="localidades-estado">Estado</label>
          <select id="localidades-estado" className="form-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todas</option>
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
              <th scope="col">Orden</th>
              <th scope="col">Código</th>
              <th scope="col">Nombre</th>
              <th scope="col">Filas × butacas</th>
              <th scope="col">Capacidad</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr key={l.id}>
                <td className="cifra">{l.orden}</td>
                <td className="codigo">{l.codigo}</td>
                <td>{l.nombre}</td>
                <td className="cifra">
                  {l.filas} × {l.butacasPorFila}
                </td>
                <td className="cifra">{l.capacidad}</td>
                <td>
                  <EstadoInsignia estado={l.activa ? "activo" : "inactivo"} texto={l.activa ? "Activa" : "Inactiva"} />
                </td>
                <td>
                  <div className="tabla-acciones">
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setFormulario({ ...l })}>
                      Editar
                    </button>
                    <button className={`btn btn-sm ${l.activa ? "btn-outline-primary" : "btn-outline-secondary"}`} type="button" onClick={() => alternar(l)}>
                      {l.activa ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && visibles.length === 0 && <p className="vacio">No hay localidades que coincidan.</p>}
      </div>
    </section>
  );
}
