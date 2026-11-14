import { useMemo } from "react";
import EstadoInsignia from "./EstadoInsignia";
import { BarrasPorMes, EstadosEnBarras } from "./Graficos";
import {
  ETIQUETAS_ESTADO,
  contarPorMes,
  formatearFecha,
  formatearPesos,
  hoyComoTexto,
  indexarPorId
} from "../utils/formato";

const ESTADOS_BOLETA = ["reservada", "pagada", "usada", "cancelada"];
const ESTADOS_FUNCION = ["programada", "en_venta", "agotada", "en_curso", "finalizada", "cancelada"];
const FUNCION_VIGENTE = (f) => !["finalizada", "cancelada"].includes(f.estado);

const contar = (lista, estados) => {
  const conteo = Object.fromEntries(estados.map((estado) => [estado, 0]));
  for (const item of lista) if (item.estado in conteo) conteo[item.estado] += 1;
  return conteo;
};

const sumarDias = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

// ========================================
// Cálculo de lo que muestra cada rol
// ========================================
function calcular(rol, datos) {
  const hoy = hoyComoTexto();
  const funciones = Array.isArray(datos.funciones) ? datos.funciones : [];
  const eventos = indexarPorId(datos.eventos);
  const tituloDe = (f) => eventos.get(f?.eventoId)?.titulo ?? `Evento ${f?.eventoId}`;

  const proximasFunciones = funciones
    .filter((f) => f.fecha >= hoy && FUNCION_VIGENTE(f))
    .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    .slice(0, 6)
    .map((f) => ({ id: f.id, fecha: f.fecha, hora: f.hora, titulo: tituloDe(f), estado: f.estado }));

  if (rol === "administrador") {
    const r = datos.resumen?.resumen;
    return {
      indicadores: [
        ["Ingresos cobrados (boletas pagadas y usadas)", r ? formatearPesos(r.ingresos) : null, true],
        ["Boletas", r?.boletas],
        ["Funciones", r?.funciones],
        ["Eventos", r?.eventos],
        ["Asistentes", r?.asistentes],
        ["Usuarios", r?.usuarios]
      ],
      conteo: datos.resumen?.boletasPorEstado ?? null,
      tituloConteo: "Boletas por estado",
      serie: datos.resumen?.boletasPorMes ?? null,
      tituloSerie: "Boletas vendidas por mes de función",
      unidad: "boletas",
      tabla: "funciones",
      filas: proximasFunciones
    };
  }

  if (rol === "taquilla") {
    const semana = sumarDias(7);
    return {
      indicadores: [
        ["Funciones en venta", funciones.filter((f) => f.estado === "en_venta").length, true],
        ["Funciones hoy", funciones.filter((f) => f.fecha === hoy && FUNCION_VIGENTE(f)).length],
        ["Próximos 7 días", funciones.filter((f) => f.fecha >= hoy && f.fecha <= semana && FUNCION_VIGENTE(f)).length],
        ["Eventos en cartelera", [...eventos.values()].filter((e) => e.activo).length]
      ],
      conteo: contar(funciones, ESTADOS_FUNCION),
      tituloConteo: "Funciones por estado",
      serie: contarPorMes(funciones.filter(FUNCION_VIGENTE).map((f) => f.fecha)),
      tituloSerie: "Funciones vigentes por mes",
      unidad: "funciones",
      tabla: "funciones",
      filas: proximasFunciones
    };
  }

  const boletas = Array.isArray(datos.boletas) ? datos.boletas : [];
  const funcionesPorId = indexarPorId(funciones);
  const localidades = indexarPorId(datos.localidades);
  const vivas = boletas.filter((b) => b.estado !== "cancelada");

  return {
    indicadores: [
      ["Mis boletas", vivas.length, true],
      ["Por pagar", boletas.filter((b) => b.estado === "reservada").length],
      ["Pagadas", boletas.filter((b) => b.estado === "pagada").length],
      ["Usadas", boletas.filter((b) => b.estado === "usada").length]
    ],
    conteo: contar(boletas, ESTADOS_BOLETA),
    tituloConteo: "Mis boletas por estado",
    serie: contarPorMes(vivas.map((b) => funcionesPorId.get(b.funcionId)?.fecha).filter(Boolean)),
    tituloSerie: "Mis boletas por mes de función",
    unidad: "boletas",
    tabla: "boletas",
    filas: boletas
      .filter((b) => ["reservada", "pagada"].includes(b.estado))
      .map((b) => {
        const f = funcionesPorId.get(b.funcionId);
        return {
          id: b.id,
          fecha: f?.fecha ?? "",
          hora: f?.hora ?? "",
          titulo: f ? tituloDe(f) : `Función ${b.funcionId}`,
          lugar: `${localidades.get(b.localidadId)?.nombre ?? "Localidad"} · fila ${b.fila}, butaca ${b.numero}`,
          estado: b.estado
        };
      })
      .filter((fila) => !fila.fecha || fila.fecha >= hoy)
      .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
      .slice(0, 6)
  };
}

// ========================================
// Resumen del inicio
// ========================================
export default function ResumenTeatro({ rol, datos, errores, cargando, actualizar }) {
  const vista = useMemo(() => calcular(rol, datos), [rol, datos]);
  const primerError = Object.values(errores)[0];

  return (
    <section aria-labelledby="indicadores-titulo">
      <div className="indicadores-cabecera">
        <h2 id="indicadores-titulo">Indicadores en tiempo real</h2>
        <button className="btn btn-outline-secondary btn-sm" type="button" disabled={cargando} onClick={actualizar}>
          {cargando ? "Consultando…" : "Actualizar datos"}
        </button>
      </div>

      {primerError && !cargando && (
        <div className="aviso aviso-error" role="alert">
          Parte de los datos no se pudo cargar: {primerError}
        </div>
      )}

      <div className="indicadores">
        {vista.indicadores.map(([titulo, valor, destacado]) => (
          <article key={titulo} className={`tarjeta indicador ${destacado ? "indicador-destacado" : ""}`}>
            <strong>{cargando ? "…" : (valor ?? "—")}</strong>
            <span>{titulo}</span>
          </article>
        ))}
      </div>

      <div className="paneles-dobles">
        <article className="tarjeta panel-dato">
          <h3>{vista.tituloConteo}</h3>
          {vista.conteo ? (
            <EstadosEnBarras conteo={vista.conteo} etiquetas={ETIQUETAS_ESTADO} descripcion={vista.tituloConteo} />
          ) : (
            <p className="texto-secundario mb-0">{cargando ? "Cargando…" : "Sin datos disponibles."}</p>
          )}
        </article>
        <article className="tarjeta panel-dato">
          <h3>{vista.tituloSerie}</h3>
          {vista.serie ? (
            <BarrasPorMes serie={vista.serie} unidad={vista.unidad} />
          ) : (
            <p className="texto-secundario mb-0">{cargando ? "Cargando…" : "Sin datos disponibles."}</p>
          )}
        </article>
      </div>

      <article className="tarjeta panel-dato mt-3">
        <h3>{vista.tabla === "boletas" ? "Mis próximas funciones" : "Próximas funciones"}</h3>
        {vista.filas.length === 0 ? (
          <p className="texto-secundario mb-0">
            {cargando ? "Cargando…" : vista.tabla === "boletas" ? "No tienes boletas para funciones próximas." : "No hay funciones próximas programadas."}
          </p>
        ) : (
          <div className="tabla-contenedor">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Hora</th>
                  <th scope="col">Evento</th>
                  {vista.tabla === "boletas" && <th scope="col">Ubicación</th>}
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {vista.filas.map((fila) => (
                  <tr key={fila.id}>
                    <td className="cifra">{fila.fecha ? formatearFecha(fila.fecha) : "—"}</td>
                    <td className="cifra">{fila.hora || "—"}</td>
                    <td>{fila.titulo}</td>
                    {vista.tabla === "boletas" && <td>{fila.lugar}</td>}
                    <td>
                      <EstadoInsignia estado={fila.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="texto-secundario mt-2 mb-0">Solo se muestra lo que el servidor autoriza para tu cuenta.</p>
      </article>
    </section>
  );
}
