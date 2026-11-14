import { useCallback, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { crearMiFicha, editarMiFicha, miFichaDeAsistente } from "../services/asistentes.service";
import { ETIQUETAS_ROL, formatearFecha, hoyComoTexto } from "../utils/formato";
import Aviso from "./Aviso";

const VACIO = { nombre: "", documento: "", email: "", telefono: "", fechaNacimiento: "" };

// ========================================
// Mi perfil
// La cuenta, y para el asistente su ficha
// ========================================
export default function PerfilPropio() {
  const { usuario, token } = useAuth();
  const esAsistente = usuario?.rol === "asistente";
  const [formulario, setFormulario] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(
    (signal) => (esAsistente ? miFichaDeAsistente(token, signal) : Promise.resolve(null)),
    [esAsistente, token]
  );
  const { datos: ficha, error, cargando, recargar } = useDatos(cargar);

  const campo = (nombre) => (e) => setFormulario((a) => ({ ...a, [nombre]: e.target.value }));

  async function guardar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setMensaje(null);
    try {
      if (ficha) {
        const { nombre, email, telefono, fechaNacimiento } = formulario;
        await editarMiFicha({ nombre, email, telefono, fechaNacimiento }, token);
      } else {
        await crearMiFicha(formulario, token);
      }
      setMensaje({ tipo: "exito", texto: ficha ? "Tus datos se actualizaron." : "Tus datos quedaron guardados. Ya puedes comprar boletas." });
      setFormulario(null);
      recargar();
    } catch (fallo) {
      setMensaje({ tipo: "error", texto: fallo.message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="tarjeta modulo" aria-labelledby="perfil-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="perfil-titulo">Mi perfil</h2>
          <p>Los datos de tu cuenta. El rol lo asigna el servidor y no se cambia desde aquí.</p>
        </div>
      </div>

      <Aviso mensaje={mensaje} alCerrar={() => setMensaje(null)} />

      <div className="paneles-dobles mt-0">
        <article className="panel-dato border rounded-3">
          <h3>Cuenta</h3>
          <dl className="mb-0">
            <dt>Nombre</dt>
            <dd>{usuario?.nombre}</dd>
            <dt>Correo de acceso</dt>
            <dd className="text-break">{usuario?.email}</dd>
            <dt>Rol</dt>
            <dd className="mb-0">{ETIQUETAS_ROL[usuario?.rol] ?? usuario?.rol}</dd>
          </dl>
        </article>

        {esAsistente && (
          <article className="panel-dato border rounded-3">
            <h3>Datos de asistente</h3>
            {error && <Aviso mensaje={{ tipo: "error", texto: error }} />}
            {cargando ? (
              <p className="texto-secundario mb-0">Cargando…</p>
            ) : ficha ? (
              <>
                <dl>
                  <dt>Documento</dt>
                  <dd className="cifra">{ficha.documento}</dd>
                  <dt>Correo de contacto</dt>
                  <dd className="text-break">{ficha.email}</dd>
                  <dt>Teléfono</dt>
                  <dd className="cifra">{ficha.telefono}</dd>
                  <dt>Nacimiento</dt>
                  <dd className="cifra">{formatearFecha(ficha.fechaNacimiento)}</dd>
                </dl>
                {!formulario && (
                  <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setFormulario({ ...VACIO, ...ficha, fechaNacimiento: String(ficha.fechaNacimiento).slice(0, 10) })}>
                    Editar mis datos
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="texto-secundario">Todavía no tienes datos de asistente. Los necesitas para comprar boletas.</p>
                {!formulario && (
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => setFormulario({ ...VACIO, nombre: usuario?.nombre ?? "", email: usuario?.email ?? "" })}>
                    Completar mis datos
                  </button>
                )}
              </>
            )}
          </article>
        )}
      </div>

      {formulario && (
        <form className="formulario-panel mt-3" onSubmit={guardar}>
          <h3>{ficha ? "Editar mis datos" : "Completar mis datos"}</h3>
          <div className="formulario-rejilla">
            <div>
              <label className="form-label" htmlFor="perfil-nombre">Nombre completo</label>
              <input id="perfil-nombre" className="form-control" required value={formulario.nombre} onChange={campo("nombre")} />
            </div>
            <div>
              <label className="form-label" htmlFor="perfil-documento">Documento</label>
              <input
                id="perfil-documento"
                className="form-control"
                inputMode="numeric"
                required
                readOnly={Boolean(ficha)}
                aria-describedby={ficha ? "perfil-documento-ayuda" : undefined}
                value={formulario.documento}
                onChange={campo("documento")}
              />
              {ficha && <div id="perfil-documento-ayuda" className="form-text">El documento no se cambia.</div>}
            </div>
            <div>
              <label className="form-label" htmlFor="perfil-email">Correo de contacto</label>
              <input id="perfil-email" className="form-control" type="email" required value={formulario.email} onChange={campo("email")} />
            </div>
            <div>
              <label className="form-label" htmlFor="perfil-telefono">Teléfono</label>
              <input id="perfil-telefono" className="form-control" type="tel" inputMode="numeric" required value={formulario.telefono} onChange={campo("telefono")} />
            </div>
            <div>
              <label className="form-label" htmlFor="perfil-nacimiento">Fecha de nacimiento</label>
              <input id="perfil-nacimiento" className="form-control" type="date" max={hoyComoTexto()} required value={formulario.fechaNacimiento} onChange={campo("fechaNacimiento")} />
            </div>
          </div>
          <div className="formulario-botones">
            <button className="btn btn-primary" type="submit" disabled={ocupado}>
              {ocupado ? "Guardando…" : "Guardar"}
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => setFormulario(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
