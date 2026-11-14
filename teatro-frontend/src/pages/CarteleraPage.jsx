import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDatos } from "../hooks/useDatos";
import { listarEventos } from "../services/eventos.service";
import { listarFunciones } from "../services/funciones.service";
import { aficheDe } from "../utils/afiches";
import { ETIQUETAS_TIPO_EVENTO, formatearFecha, formatearPesos, hoyComoTexto } from "../utils/formato";
import salaRoja from "../assets/sala-roja-900.webp";

const TIPOS = ["", "obra", "concierto", "cine", "institucional"];

// ========================================
// Cartelera pública
// Se consulta sin token: siempre la vista del público, nunca la del mostrador
// ========================================
export default function CarteleraPage() {
  const [tipo, setTipo] = useState("");

  const cargar = useCallback(async (signal) => {
    const [eventos, funciones] = await Promise.all([listarEventos(undefined, signal), listarFunciones(undefined, signal)]);
    return { eventos, funciones };
  }, []);
  const { datos, error, cargando } = useDatos(cargar);

  // Cada evento con su próxima función y su precio más bajo entre las que están a la venta.
  const cartelera = useMemo(() => {
    const hoy = hoyComoTexto();
    return (datos?.eventos ?? [])
      .map((evento) => {
        const funciones = (datos?.funciones ?? [])
          .filter((f) => f.eventoId === evento.id && f.fecha >= hoy)
          .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
        const precios = funciones.filter((f) => f.estado === "en_venta").flatMap((f) => f.tarifas.map((t) => t.precio));
        return { evento, proxima: funciones[0], cuantas: funciones.length, desde: precios.length ? Math.min(...precios) : null };
      })
      .filter(({ proxima }) => proxima)
      .sort((a, b) => `${a.proxima.fecha} ${a.proxima.hora}`.localeCompare(`${b.proxima.fecha} ${b.proxima.hora}`));
  }, [datos]);

  const visibles = cartelera.filter(({ evento }) => !tipo || evento.tipo === tipo);
  const enVenta = (datos?.funciones ?? []).filter((f) => f.estado === "en_venta").length;

  return (
    <>
      <section className="portada">
        <img src={salaRoja} alt="" width="900" height="600" />
        <div className="portada-texto">
          <p className="portada-antetitulo">Teatro Maldonado · Tunja</p>
          <h1>La cartelera de la temporada</h1>
          <p>
            Obras, conciertos, cine y actos institucionales en una sala única.
            {!cargando && ` ${enVenta} función${enVenta === 1 ? "" : "es"} a la venta ahora.`}
          </p>
        </div>
      </section>

      <section className="cartelera" aria-labelledby="cartelera-titulo">
        <div className="cartelera-cabecera">
          <h2 id="cartelera-titulo">Programación</h2>
          <div className="filtro-tipos" role="group" aria-label="Filtrar por tipo">
            {TIPOS.map((valor) => (
              <button key={valor || "todos"} type="button" aria-pressed={tipo === valor} onClick={() => setTipo(valor)}>
                {valor ? ETIQUETAS_TIPO_EVENTO[valor] : "Todo"}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="aviso aviso-error" role="alert">No fue posible cargar la cartelera: {error}</div>}
        {cargando && <p className="texto-secundario">Cargando la cartelera…</p>}
        {!cargando && !error && visibles.length === 0 && (
          <p className="vacio">No hay funciones próximas{tipo ? " de este tipo" : ""} por ahora.</p>
        )}

        <div className="cartelera-rejilla">
          {visibles.map(({ evento, proxima, cuantas, desde }) => {
            const afiche = aficheDe(evento);
            return (
              <article key={evento.id} className="tarjeta-evento">
                <Link to={`/evento/${evento.id}`} className="tarjeta-evento-enlace">
                  <div className="tarjeta-evento-foto">
                    <img src={afiche.src} alt={afiche.alt} width="900" height="600" loading="lazy" decoding="async" />
                    <span className="tarjeta-evento-tipo">{ETIQUETAS_TIPO_EVENTO[evento.tipo] ?? evento.tipo}</span>
                  </div>
                  <div className="tarjeta-evento-cuerpo">
                    <h3>{evento.titulo}</h3>
                    <p className="texto-secundario mb-2">
                      {formatearFecha(proxima.fecha)} · {proxima.hora}
                      {cuantas > 1 && ` · ${cuantas} funciones`}
                    </p>
                    <p className="tarjeta-evento-pie">
                      <span>{evento.clasificacionEdad === "G" ? "Todo público" : evento.clasificacionEdad} · {evento.duracionMinutos} min</span>
                      <strong>{desde !== null ? `Desde ${formatearPesos(desde)}` : "Sin entradas a la venta"}</strong>
                    </p>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
