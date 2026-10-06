// ========================================
// Cartelera
// La próxima función en venta ocupa el primer viewport
// ========================================
import * as api from "../api.js";
import {
  aFecha,
  aviso,
  avisoDeError,
  cargando,
  chipEstado,
  diaLargo,
  elemento,
  enlaceBoton,
  esFutura,
  pesos,
  precioDesde
} from "../formato.js";

const ESTADOS_EN_CARTEL = ["en_venta", "programada", "agotada"];

const cabecera = (funcion, evento) => {
  const seccion = elemento("section", "funcion-cabeza");
  seccion.setAttribute("aria-labelledby", "proxima-funcion");

  const foto = elemento("figure", "duotono");
  const img = elemento("img");
  img.src = "imagenes/sala-telon-cerrado.webp";
  img.srcset =
    "imagenes/sala-telon-cerrado-900.webp 900w, imagenes/sala-telon-cerrado.webp 1800w";
  img.sizes = "100vw";
  img.width = 1800;
  img.height = 1200;
  img.alt =
    "Sala vacía del teatro con filas de butacas rojas frente al telón cerrado";
  foto.appendChild(img);
  seccion.appendChild(foto);
  seccion.appendChild(elemento("div", "funcion-cabeza__velo"));

  const texto = elemento("div", "funcion-cabeza__texto");
  const titulo = elemento("h2", "funcion-cabeza__titulo", evento.titulo);
  titulo.id = "proxima-funcion";
  texto.appendChild(titulo);

  const ficha = elemento("p", "ficha");
  const cuando = aFecha(funcion.fecha, funcion.hora);
  [
    diaLargo.format(cuando),
    `${funcion.hora} h`,
    `${evento.duracionMinutos} minutos`,
    evento.clasificacionEdad
  ].forEach((dato) => ficha.appendChild(elemento("span", "ficha__dato", dato)));
  texto.appendChild(ficha);

  const cierre = elemento("div", "funcion-cabeza__cierre");
  cierre.appendChild(enlaceBoton("Elegir butaca", `#/funcion/${funcion.id}`));

  const precio = elemento("p", "precio");
  precio.appendChild(elemento("span", "precio__rotulo", "Desde"));
  precio.appendChild(
    elemento("span", "precio__cifra", pesos.format(precioDesde(funcion)))
  );
  cierre.appendChild(precio);
  texto.appendChild(cierre);

  seccion.appendChild(texto);
  return seccion;
};

// Al filtrar no se anima nada: la lista ya estaba en pantalla y verla entrar
// otra vez con cada toque cansa. El escalonado es solo de la primera pintada,
// y se corta en el sexto elemento para que el último no espere.
const fila = (funcion, evento, orden, conEntrada) => {
  const item = elemento("li", conEntrada ? "funcion funcion--entra" : "funcion");
  if (conEntrada) item.style.animationDelay = `${Math.min(orden, 6) * 40}ms`;

  item.appendChild(elemento("p", "funcion__hora", funcion.hora));

  const centro = elemento("div");
  const obra = elemento("h3", "funcion__obra");
  const enlace = elemento("a", "", evento.titulo);
  enlace.href = `#/evento/${evento.id}`;
  obra.appendChild(enlace);
  centro.appendChild(obra);
  centro.appendChild(
    elemento(
      "p",
      "funcion__ficha",
      `${evento.tipo} · ${evento.duracionMinutos} min · ${evento.clasificacionEdad}`
    )
  );
  item.appendChild(centro);

  const cierre = elemento("div", "funcion__cierre");
  cierre.appendChild(chipEstado(funcion.estado));

  if (funcion.estado === "en_venta") {
    cierre.appendChild(enlaceBoton("Elegir butaca", `#/funcion/${funcion.id}`));
  } else {
    const precio = elemento("p", "precio");
    precio.appendChild(elemento("span", "precio__rotulo", "Desde"));
    precio.appendChild(
      elemento("span", "precio__cifra", pesos.format(precioDesde(funcion)))
    );
    cierre.appendChild(precio);
  }

  item.appendChild(cierre);
  return item;
};

// ========================================
// Programa agrupado por jornada
// ========================================
const pintarPrograma = (cuerpo, programa, porId, conEntrada = false) => {
  cuerpo.textContent = "";

  if (programa.length === 0) {
    cuerpo.appendChild(
      aviso(
        "Nada de ese tipo en cartel",
        "No hay funciones futuras de esa clase. Prueba con otro tipo o vuelve a ver toda la cartelera."
      )
    );
    return;
  }

  let jornada = null;
  let fechaActual = null;

  programa.forEach((funcion, orden) => {
    if (funcion.fecha !== fechaActual) {
      fechaActual = funcion.fecha;
      jornada = elemento("section", "jornada");
      jornada.appendChild(
        elemento("h3", "jornada__fecha", diaLargo.format(aFecha(funcion.fecha)))
      );
      jornada.appendChild(elemento("ul"));
      cuerpo.appendChild(jornada);
    }
    jornada
      .querySelector("ul")
      .appendChild(fila(funcion, porId.get(funcion.eventoId), orden, conEntrada));
  });
};

// ========================================
// Filtros por tipo de evento
// Filtran lo ya descargado: no cuestan una petición más
// ========================================
const NOMBRE_TIPO = {
  todo: "Todo",
  obra: "Obras",
  concierto: "Conciertos",
  cine: "Cine",
  institucional: "Institucional"
};

const filtros = (tiposPresentes, alElegir) => {
  const caja = elemento("div", "filtros");
  caja.setAttribute("role", "group");
  caja.setAttribute("aria-label", "Filtrar la cartelera por tipo");

  ["todo", ...tiposPresentes].forEach((tipo, i) => {
    const boton = elemento("button", "filtro", NOMBRE_TIPO[tipo] || tipo);
    boton.type = "button";
    boton.setAttribute("aria-pressed", String(i === 0));
    boton.addEventListener("click", () => {
      caja.querySelectorAll(".filtro").forEach((b) =>
        b.setAttribute("aria-pressed", "false")
      );
      boton.setAttribute("aria-pressed", "true");
      alElegir(tipo);
    });
    caja.appendChild(boton);
  });

  return caja;
};

export const render = async (vista) => {
  const lista = elemento("section", "cartelera");
  lista.id = "cartelera";
  const titulo = elemento("h2", "cartelera__titulo", "Toda la cartelera");
  titulo.id = "titulo-cartelera";
  lista.setAttribute("aria-labelledby", "titulo-cartelera");
  lista.appendChild(titulo);
  lista.appendChild(
    elemento(
      "p",
      "cartelera__nota",
      "Obras, conciertos, cine y actos institucionales en la sala de la calle 20. Solo las funciones en venta permiten escoger butaca; las demás muestran en qué estado están."
    )
  );
  const cuerpo = elemento("div");
  cuerpo.appendChild(cargando("la cartelera"));
  lista.appendChild(cuerpo);
  vista.appendChild(lista);

  try {
    const [eventos, funciones] = await Promise.all([api.eventos(), api.funciones()]);
    const porId = new Map(eventos.map((e) => [e.id, e]));

    const programa = funciones
      .filter(
        (f) => ESTADOS_EN_CARTEL.includes(f.estado) && esFutura(f) && porId.has(f.eventoId)
      )
      .sort((a, b) => aFecha(a.fecha, a.hora) - aFecha(b.fecha, b.hora));

    cuerpo.textContent = "";

    if (programa.length === 0) {
      cuerpo.appendChild(
        aviso(
          "No hay funciones en cartel",
          "Todavía no hay funciones programadas con fecha futura. Vuelve pronto."
        )
      );
      return;
    }

    const enVenta = programa.find((f) => f.estado === "en_venta");
    if (enVenta) vista.prepend(cabecera(enVenta, porId.get(enVenta.eventoId)));

    const tiposPresentes = ["obra", "concierto", "cine", "institucional"].filter(
      (tipo) => programa.some((f) => porId.get(f.eventoId).tipo === tipo)
    );

    if (tiposPresentes.length > 1) {
      lista.insertBefore(
        filtros(tiposPresentes, (tipo) =>
          pintarPrograma(
            cuerpo,
            tipo === "todo"
              ? programa
              : programa.filter((f) => porId.get(f.eventoId).tipo === tipo),
            porId
          )
        ),
        cuerpo
      );
    }

    pintarPrograma(cuerpo, programa, porId, true);
  } catch (error) {
    cuerpo.textContent = "";
    cuerpo.appendChild(avisoDeError(error));
  }
};
