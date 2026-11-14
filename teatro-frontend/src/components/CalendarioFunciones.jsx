import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useDatos } from "../hooks/useDatos";
import { listarFunciones } from "../services/funciones.service";
import { listarEventos } from "../services/eventos.service";
import { aFechaLocal, aTextoFecha, etiquetaEstado, formatearFechaLarga, hoyComoTexto, indexarPorId, mayusculaInicial } from "../utils/formato";
import EstadoInsignia from "./EstadoInsignia";
import Icono from "./Icono";
import Aviso from "./Aviso";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MES = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const CORTA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
const VISTAS = [
  { clave: "mes", texto: "Mes" },
  { clave: "semana", texto: "Semana" },
  { clave: "dia", texto: "Día" }
];

const lunesDe = (fecha) => {
  const lunes = new Date(fecha);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return lunes;
};

const sumar = (fecha, dias) => {
  const nueva = new Date(fecha);
  nueva.setDate(nueva.getDate() + dias);
  return nueva;
};

// ========================================
// Días que muestra cada vista
// ========================================
function diasDeLaVista(vista, referencia) {
  if (vista === "dia") return [referencia];
  if (vista === "semana") return Array.from({ length: 7 }, (_, i) => sumar(lunesDe(referencia), i));

  const primero = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const inicio = lunesDe(primero);
  const ultimo = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  const semanas = Math.ceil(((ultimo - inicio) / 86400000 + 1) / 7);
  return Array.from({ length: semanas * 7 }, (_, i) => sumar(inicio, i));
}

function tituloDeLaVista(vista, referencia, dias) {
  if (vista === "mes") return mayusculaInicial(MES.format(referencia));
  if (vista === "dia") return formatearFechaLarga(referencia);
  return `${CORTA.format(dias[0])} – ${CORTA.format(dias[6])} ${dias[6].getFullYear()}`;
}

// ========================================
// Agenda de funciones
// ========================================
export default function CalendarioFunciones() {
  const { token } = useAuth();
  const [vista, setVista] = useState("mes");
  const [referenciaElegida, setReferencia] = useState(null);
  const [seleccionElegida, setSeleccion] = useState(null);
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);

  const cargar = useCallback(
    async (signal) => {
      const [funciones, eventos] = await Promise.all([listarFunciones(token, signal), listarEventos(token, signal)]);
      return { funciones, eventos };
    },
    [token]
  );
  const { datos, error, cargando, recargar } = useDatos(cargar);
  const eventos = useMemo(() => indexarPorId(datos?.eventos), [datos]);

  const porDia = useMemo(() => {
    const mapa = new Map();
    for (const f of datos?.funciones ?? []) {
      if (!mostrarCanceladas && f.estado === "cancelada") continue;
      if (!mapa.has(f.fecha)) mapa.set(f.fecha, []);
      mapa.get(f.fecha).push(f);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.hora.localeCompare(b.hora));
    return mapa;
  }, [datos, mostrarCanceladas]);

  // Sin elección, la agenda se abre en la próxima función: abrirla en un mes
  // vacío obligaría a buscarla a mano.
  const hoy = hoyComoTexto();
  const proxima = [...porDia.keys()].filter((fecha) => fecha >= hoy).sort()[0] ?? hoy;
  const referencia = referenciaElegida ?? aFechaLocal(proxima);
  const seleccion = seleccionElegida ?? proxima;

  const dias = diasDeLaVista(vista, referencia);
  const delDia = porDia.get(seleccion) ?? [];

  function mover(sentido) {
    const nueva = new Date(referencia);
    if (vista === "mes") nueva.setMonth(nueva.getMonth() + sentido, 1);
    else nueva.setDate(nueva.getDate() + sentido * (vista === "semana" ? 7 : 1));
    setReferencia(nueva);
    if (vista === "dia") setSeleccion(aTextoFecha(nueva));
  }

  function irAHoy() {
    setReferencia(new Date());
    setSeleccion(hoy);
  }

  return (
    <section className="tarjeta modulo" aria-labelledby="agenda-titulo">
      <div className="modulo-cabecera">
        <div>
          <h2 id="agenda-titulo">Agenda de funciones</h2>
          <p>La programación de la sala. Elige un día para ver sus funciones y abrir su control de boletas.</p>
        </div>
        <div className="modulo-acciones">
          <button className="btn btn-outline-secondary" type="button" onClick={recargar} disabled={cargando}>
            Actualizar
          </button>
        </div>
      </div>

      {error && <Aviso mensaje={{ tipo: "error", texto: error }} />}

      <div className="calendario-cabecera">
        <div className="calendario-navegacion">
          <button className="btn btn-outline-secondary btn-sm" type="button" aria-label="Anterior" onClick={() => mover(-1)}>
            <Icono nombre="izquierda" />
          </button>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={irAHoy}>
            Hoy
          </button>
          <button className="btn btn-outline-secondary btn-sm" type="button" aria-label="Siguiente" onClick={() => mover(1)}>
            <Icono nombre="derecha" />
          </button>
        </div>
        <h3 aria-live="polite">{tituloDeLaVista(vista, referencia, dias)}</h3>
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div className="form-check mb-0">
            <input id="agenda-canceladas" className="form-check-input" type="checkbox" checked={mostrarCanceladas} onChange={(e) => setMostrarCanceladas(e.target.checked)} />
            <label className="form-check-label" htmlFor="agenda-canceladas">Mostrar canceladas</label>
          </div>
          <div className="calendario-vistas" role="group" aria-label="Vista">
            {VISTAS.map(({ clave, texto }) => (
              <button key={clave} type="button" className="btn btn-outline-secondary btn-sm" aria-pressed={vista === clave} onClick={() => setVista(clave)}>
                {texto}
              </button>
            ))}
          </div>
        </div>
      </div>

      {vista !== "dia" && (
        <div className="calendario-rejilla">
          {DIAS.map((dia) => (
            <div key={dia} className="calendario-dia-nombre" aria-hidden="true">
              {dia}
            </div>
          ))}
          {dias.map((fecha) => {
            const texto = aTextoFecha(fecha);
            const funciones = porDia.get(texto) ?? [];
            const fuera = vista === "mes" && fecha.getMonth() !== referencia.getMonth();
            return (
              <button
                key={texto}
                type="button"
                className={`calendario-celda ${fuera ? "fuera-de-mes" : ""} ${texto === hoy ? "hoy" : ""}`}
                aria-pressed={texto === seleccion}
                aria-label={`${formatearFechaLarga(fecha)}: ${funciones.length === 0 ? "sin funciones" : funciones.length === 1 ? "1 función" : `${funciones.length} funciones`}`}
                onClick={() => setSeleccion(texto)}
              >
                <span className="calendario-numero">{fecha.getDate()}</span>
                {funciones.slice(0, 2).map((f) => (
                  <span key={f.id} className={`calendario-evento estado-${f.estado}`}>
                    {f.hora} · {eventos.get(f.eventoId)?.titulo ?? "Función"}
                  </span>
                ))}
                {funciones.length > 2 && <span className="calendario-mas">+{funciones.length - 2} más</span>}
                {funciones.length > 0 && funciones.length <= 2 && <span className="calendario-mas d-sm-none">{funciones.length}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className={vista === "dia" ? "" : "calendario-detalle"}>
        <h4>
          {formatearFechaLarga(aFechaLocal(seleccion))} · {delDia.length === 1 ? "1 función" : `${delDia.length} funciones`}
        </h4>
        {delDia.length === 0 ? (
          <p className="texto-secundario mb-0">{cargando ? "Cargando…" : "No hay funciones este día."}</p>
        ) : (
          delDia.map((f) => (
            <div key={f.id} className="funcion-fila">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <span className="funcion-fila-hora">{f.hora}</span>
                <span>
                  <strong>{eventos.get(f.eventoId)?.titulo ?? `Evento ${f.eventoId}`}</strong>
                  <span className="d-block texto-secundario">{etiquetaEstado(f.estado)}</span>
                </span>
              </div>
              <div className="d-flex align-items-center gap-2">
                <EstadoInsignia estado={f.estado} />
                {!["cancelada", "finalizada"].includes(f.estado) && (
                  <Link className="btn btn-outline-secondary btn-sm" to={`/panel/control-boletas?funcion=${f.id}`}>
                    Ver boletas
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
