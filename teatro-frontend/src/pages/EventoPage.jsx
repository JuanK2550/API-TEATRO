import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { obtenerEvento } from "../services/eventos.service";
import { funcionesDeEvento } from "../services/funciones.service";
import { listarLocalidades } from "../services/localidades.service";
import { aficheDe } from "../utils/afiches";
import EstadoInsignia from "../components/EstadoInsignia";
import { ETIQUETAS_DESCUENTO, ETIQUETAS_TIPO_EVENTO, formatearFechaLarga, aFechaLocal, formatearPesos, hoyComoTexto, indexarPorId } from "../utils/formato";

// ========================================
// A dónde lleva «Comprar» según quién mira
// ========================================
function destinoDeCompra(usuario, funcionId) {
  if (usuario?.rol === "taquilla") return { ruta: `/panel/control-boletas?funcion=${funcionId}`, texto: "Vender en taquilla" };
  if (usuario?.rol === "administrador") return { ruta: "/panel/boletas", texto: "Ver boletas" };
  return { ruta: `/panel/mis-boletas?funcion=${funcionId}`, texto: "Comprar" };
}

// ========================================
// Ficha pública de un evento
// ========================================
export default function EventoPage() {
  const { id } = useParams();
  const { usuario } = useAuth();

  const cargar = useCallback(
    async (signal) => {
      const [evento, funciones, localidades] = await Promise.all([
        obtenerEvento(id, undefined, signal),
        funcionesDeEvento(id, undefined, signal),
        listarLocalidades(undefined, signal)
      ]);
      return { evento, funciones, localidades };
    },
    [id]
  );
  const { datos, error, cargando } = useDatos(cargar);

  const localidades = useMemo(() => indexarPorId(datos?.localidades), [datos]);
  const funciones = useMemo(() => {
    const hoy = hoyComoTexto();
    return (datos?.funciones ?? [])
      .filter((f) => f.fecha >= hoy)
      .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  }, [datos]);

  if (cargando) return <p className="ficha texto-secundario">Cargando…</p>;
  if (error) {
    return (
      <section className="ficha">
        <div className="aviso aviso-error" role="alert">Este evento no está en la cartelera.</div>
        <Link to="/">Volver a la cartelera</Link>
      </section>
    );
  }

  const { evento } = datos;
  const afiche = aficheDe(evento);

  return (
    <article className="ficha">
      <Link to="/" className="ficha-volver">← Cartelera</Link>

      <div className="ficha-cabecera">
        <img src={afiche.src} alt={afiche.alt} width="900" height="600" />
        <div>
          <p className="portada-antetitulo">{ETIQUETAS_TIPO_EVENTO[evento.tipo] ?? evento.tipo}</p>
          <h1>{evento.titulo}</h1>
          <p className="ficha-datos">
            {evento.clasificacionEdad === "G" ? "Todo público" : `Mayores de ${evento.clasificacionEdad.replace("+", "")} años`} · {evento.duracionMinutos} minutos
          </p>
          <p>{evento.descripcion}</p>
        </div>
      </div>

      <section aria-labelledby="funciones-titulo">
        <h2 id="funciones-titulo">Funciones</h2>
        {funciones.length === 0 && <p className="vacio">No hay funciones próximas de este evento.</p>}
        {funciones.map((f) => {
          const compra = destinoDeCompra(usuario, f.id);
          return (
            <div key={f.id} className="tarjeta funcion-publica">
              <div className="funcion-publica-cuando">
                <strong>{formatearFechaLarga(aFechaLocal(f.fecha))}</strong>
                <span className="funcion-fila-hora">{f.hora}</span>
                <EstadoInsignia estado={f.estado} />
              </div>
              <ul className="funcion-publica-precios" aria-label="Precios por localidad">
                {[...f.tarifas]
                  .sort((a, b) => (localidades.get(a.localidadId)?.orden ?? 0) - (localidades.get(b.localidadId)?.orden ?? 0))
                  .map((t) => (
                    <li key={t.localidadId}>
                      <span>{localidades.get(t.localidadId)?.nombre ?? "Localidad"}</span>
                      <strong className="cifra">{formatearPesos(t.precio)}</strong>
                    </li>
                  ))}
              </ul>
              <div className="funcion-publica-accion">
                {f.descuentosHabilitados.length > 0 && (
                  <p className="texto-secundario mb-2">
                    Descuentos: {f.descuentosHabilitados.map((d) => ETIQUETAS_DESCUENTO[d] ?? d).join(", ")}
                  </p>
                )}
                {f.estado === "en_venta" ? (
                  <Link className="btn btn-primary" to={compra.ruta}>{compra.texto}</Link>
                ) : (
                  <span className="texto-secundario">No hay venta para esta función.</span>
                )}
              </div>
            </div>
          );
        })}
        {!usuario && funciones.some((f) => f.estado === "en_venta") && (
          <p className="texto-secundario mt-3">
            Para comprar necesitas una cuenta: <Link to="/registro">créala en un minuto</Link> o <Link to="/login">entra</Link>.
          </p>
        )}
      </section>
    </article>
  );
}
