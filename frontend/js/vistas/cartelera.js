// ========================================
// Cartelera
// Carrusel de destacadas, tarjetas, franja del teatro y el programa por días
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
  figura,
  fotoDeEvento,
  FOTOS_DEL_TEATRO,
  icono,
  pesos,
  precioDesde,
  revelarAlEntrar
} from "../formato.js";

const ESTADOS_EN_CARTEL = ["en_venta", "programada", "agotada"];
const PASO_CARRUSEL = 6000;

// Una obra puede tener varias funciones en cartel. En el carrusel y en las
// tarjetas se muestra solo la más próxima de cada una: repetir el mismo título
// con la misma foto llena la pantalla sin decir nada nuevo. El programa por
// días, más abajo, sí las lista todas, que para eso es el programa.
const unaPorEvento = (programa) => {
  const vistos = new Set();
  return programa.filter((f) => {
    if (vistos.has(f.eventoId)) return false;
    vistos.add(f.eventoId);
    return true;
  });
};

// ========================================
// Carrusel de portada
// Pasa solo, se detiene al pasar el mouse o al enfocarlo
// ========================================
const carrusel = (destacadas, porId) => {
  const caja = elemento("section", "carrusel");
  caja.setAttribute("aria-roledescription", "carrusel");
  caja.setAttribute("aria-label", "Funciones destacadas");

  const laminas = destacadas.map((funcion, i) => {
    const evento = porId.get(funcion.eventoId);
    const lamina = elemento("article", "lamina");
    lamina.setAttribute("aria-roledescription", "diapositiva");
    lamina.setAttribute("aria-label", `${i + 1} de ${destacadas.length}: ${evento.titulo}`);
    if (i !== 0) lamina.setAttribute("aria-hidden", "true");
    lamina.dataset.activa = String(i === 0);

    lamina.appendChild(figura(fotoDeEvento(evento), { viva: true }));
    lamina.appendChild(elemento("div", "lamina__velo"));

    const texto = elemento("div", "lamina__texto");
    texto.appendChild(chipEstado(funcion.estado));

    const titulo = elemento("h2", "lamina__titulo", evento.titulo);
    if (i === 0) titulo.id = "proxima-funcion";
    texto.appendChild(titulo);

    const ficha = elemento("p", "ficha");
    [
      diaLargo.format(aFecha(funcion.fecha, funcion.hora)),
      `${funcion.hora} h`,
      `${evento.duracionMinutos} minutos`,
      evento.clasificacionEdad
    ].forEach((d) => ficha.appendChild(elemento("span", "ficha__dato", d)));
    texto.appendChild(ficha);

    const cierre = elemento("div", "lamina__cierre");
    cierre.appendChild(
      enlaceBoton(
        funcion.estado === "en_venta" ? "Elegir butaca" : "Ver función",
        `#/funcion/${funcion.id}`
      )
    );
    const precio = elemento("p", "precio");
    precio.appendChild(elemento("span", "precio__rotulo", "Desde"));
    precio.appendChild(
      elemento("span", "precio__cifra", pesos.format(precioDesde(funcion)))
    );
    cierre.appendChild(precio);
    texto.appendChild(cierre);

    lamina.appendChild(texto);
    caja.appendChild(lamina);
    return lamina;
  });

  if (destacadas.length < 2) return caja;

  let actual = 0;
  let reloj = null;

  const mostrar = (siguiente) => {
    laminas[actual].dataset.activa = "false";
    laminas[actual].setAttribute("aria-hidden", "true");
    actual = (siguiente + laminas.length) % laminas.length;
    laminas[actual].dataset.activa = "true";
    laminas[actual].removeAttribute("aria-hidden");
    puntos.forEach((p, i) => p.setAttribute("aria-pressed", String(i === actual)));
  };

  const parar = () => {
    if (reloj) clearInterval(reloj);
    reloj = null;
  };

  // Con movimiento reducido no pasa sola: solo con las flechas o los puntos.
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");

  const andar = () => {
    parar();
    if (quieto.matches) return;
    reloj = setInterval(() => mostrar(actual + 1), PASO_CARRUSEL);
  };

  const mando = elemento("div", "carrusel__mando");

  const flecha = (nombre, etiqueta, salto) => {
    const b = elemento("button", `carrusel__flecha carrusel__flecha--${nombre}`);
    b.type = "button";
    b.setAttribute("aria-label", etiqueta);
    b.appendChild(icono(nombre === "antes" ? "atras" : "flecha"));
    b.addEventListener("click", () => {
      mostrar(actual + salto);
      andar();
    });
    return b;
  };

  const puntos = destacadas.map((funcion, i) => {
    const p = elemento("button", "carrusel__punto");
    p.type = "button";
    p.setAttribute(
      "aria-label",
      `Ver ${porId.get(funcion.eventoId).titulo}, ${i + 1} de ${destacadas.length}`
    );
    p.setAttribute("aria-pressed", String(i === 0));
    p.addEventListener("click", () => {
      mostrar(i);
      andar();
    });
    return p;
  });

  const fila = elemento("div", "carrusel__puntos");
  puntos.forEach((p) => fila.appendChild(p));

  mando.appendChild(flecha("antes", "Función anterior", -1));
  mando.appendChild(fila);
  mando.appendChild(flecha("despues", "Función siguiente", 1));
  caja.appendChild(mando);

  // Se detiene con el puntero encima y mientras algo suyo tenga el foco.
  caja.addEventListener("pointerenter", parar);
  caja.addEventListener("pointerleave", andar);
  caja.addEventListener("focusin", parar);
  caja.addEventListener("focusout", (e) => {
    if (!caja.contains(e.relatedTarget)) andar();
  });

  // Si la vista se va, el reloj se va con ella.
  const vigilante = new MutationObserver(() => {
    if (!caja.isConnected) {
      parar();
      vigilante.disconnect();
    }
  });
  vigilante.observe(document.querySelector("#vista"), { childList: true });

  quieto.addEventListener("change", andar);
  andar();

  return caja;
};

// ========================================
// Tarjeta de función
// ========================================
const tarjeta = (funcion, evento) => {
  const item = elemento("li", "tarjeta");

  const enlace = elemento("a", "tarjeta__enlace");
  enlace.href = `#/funcion/${funcion.id}`;
  enlace.setAttribute(
    "aria-label",
    `${evento.titulo}, ${diaLargo.format(aFecha(funcion.fecha))} a las ${funcion.hora}`
  );

  const marco = elemento("div", "tarjeta__marco");
  marco.appendChild(figura(fotoDeEvento(evento), { ancho: "(max-width: 60rem) 100vw, 24rem" }));
  marco.appendChild(elemento("div", "tarjeta__velo"));
  marco.appendChild(chipEstado(funcion.estado));
  enlace.appendChild(marco);

  const cuerpo = elemento("div", "tarjeta__cuerpo");
  cuerpo.appendChild(
    elemento("p", "tarjeta__cuando", `${diaLargo.format(aFecha(funcion.fecha))} · ${funcion.hora} h`)
  );
  cuerpo.appendChild(elemento("h3", "tarjeta__titulo", evento.titulo));
  cuerpo.appendChild(
    elemento("p", "tarjeta__ficha", `${evento.tipo} · ${evento.duracionMinutos} min · ${evento.clasificacionEdad}`)
  );

  const pie = elemento("div", "tarjeta__pie");
  const precio = elemento("p", "precio");
  precio.appendChild(elemento("span", "precio__rotulo", "Desde"));
  precio.appendChild(elemento("span", "precio__cifra", pesos.format(precioDesde(funcion))));
  pie.appendChild(precio);
  pie.appendChild(
    elemento("span", "tarjeta__accion", funcion.estado === "en_venta" ? "Elegir butaca" : "Ver función")
  );
  pie.querySelector(".tarjeta__accion").appendChild(icono("flecha"));
  cuerpo.appendChild(pie);

  enlace.appendChild(cuerpo);
  item.appendChild(enlace);
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

// Al filtrar no se anima nada: la lista ya estaba en pantalla y verla entrar
// otra vez con cada toque cansa. El escalonado es solo de la primera pintada,
// y se corta en el sexto elemento para que el último no espere.
const fila = (funcion, evento, orden, conEntrada) => {
  const item = elemento("li", conEntrada ? "funcion funcion--entra" : "funcion");
  if (conEntrada) item.style.animationDelay = `${Math.min(orden, 6) * 40}ms`;

  item.appendChild(elemento("p", "funcion__hora", funcion.hora));

  const centro = elemento("div");
  const obra = elemento("h4", "funcion__obra");
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

// ========================================
// Franja de fotografías del teatro
// ========================================
const franjaDeFotos = () => {
  const caja = elemento("section", "franja-fotos");
  caja.setAttribute("aria-label", "La sala por dentro");

  FOTOS_DEL_TEATRO.slice(0, 4).forEach((foto) => {
    const marco = elemento("div", "franja-fotos__marco");
    marco.appendChild(figura(foto, { ancho: "(max-width: 60rem) 50vw, 25vw" }));
    caja.appendChild(marco);
  });

  return caja;
};

// ========================================
// Sobre la sala
// ========================================
const sobreLaSala = () => {
  const caja = elemento("section", "sobre");

  const marco = elemento("div", "sobre__foto");
  marco.appendChild(
    figura(FOTOS_DEL_TEATRO[2], { ancho: "(max-width: 60rem) 100vw, 40rem" })
  );
  caja.appendChild(marco);

  const texto = elemento("div", "sobre__texto");
  texto.appendChild(elemento("p", "pliego__rotulo", "Vive el teatro"));
  texto.appendChild(elemento("h2", "sobre__titulo", "Una sala, tres maneras de verla"));
  texto.appendChild(
    elemento(
      "p",
      "sobre__cuerpo",
      "El Teatro Maldonado de Tunja tiene una sola sala y la programa entera: obras, conciertos, cine y actos institucionales. Quien compra escoge butaca en el plano, no una zona genérica."
    )
  );

  const datos = elemento("dl", "sobre__datos");
  [
    ["450", "butacas en total"],
    ["3", "localidades, de la platea al balcón"],
    ["Calle 20", "en el centro de Tunja"]
  ].forEach(([cifra, que]) => {
    datos.appendChild(elemento("dt", "", cifra));
    datos.appendChild(elemento("dd", "", que));
  });
  texto.appendChild(datos);

  caja.appendChild(texto);
  return caja;
};

// ========================================
// Vista
// ========================================
export const render = async (vista) => {
  const cargador = elemento("section", "pliego");
  cargador.appendChild(cargando("la cartelera"));
  vista.appendChild(cargador);

  try {
    const [eventos, funciones] = await Promise.all([api.eventos(), api.funciones()]);
    const porId = new Map(eventos.map((e) => [e.id, e]));

    const programa = funciones
      .filter(
        (f) => ESTADOS_EN_CARTEL.includes(f.estado) && esFutura(f) && porId.has(f.eventoId)
      )
      .sort((a, b) => aFecha(a.fecha, a.hora) - aFecha(b.fecha, b.hora));

    vista.textContent = "";

    if (programa.length === 0) {
      const vacio = elemento("section", "pliego");
      vacio.appendChild(elemento("h2", "pliego__titulo", "Toda la cartelera"));
      vacio.appendChild(
        aviso(
          "No hay funciones en cartel",
          "Todavía no hay funciones programadas con fecha futura. Vuelve pronto."
        )
      );
      vista.appendChild(vacio);
      return;
    }

    // ---------- Portada ----------
    const destacadas = unaPorEvento(programa);
    vista.appendChild(carrusel(destacadas.slice(0, 4), porId));

    // ---------- Próximas funciones, en tarjetas ----------
    const proximas = elemento("section", "proximas");
    proximas.appendChild(elemento("p", "pliego__rotulo", "Lo que viene"));
    proximas.appendChild(elemento("h2", "proximas__titulo", "Próximas funciones"));

    const rejilla = elemento("ul", "tarjetas");
    destacadas.slice(0, 6).forEach((f) => rejilla.appendChild(tarjeta(f, porId.get(f.eventoId))));
    proximas.appendChild(rejilla);
    vista.appendChild(proximas);

    // ---------- Franja de fotos ----------
    vista.appendChild(franjaDeFotos());

    // ---------- Programa completo ----------
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

    const tiposPresentes = ["obra", "concierto", "cine", "institucional"].filter(
      (tipo) => programa.some((f) => porId.get(f.eventoId).tipo === tipo)
    );

    if (tiposPresentes.length > 1) {
      lista.appendChild(
        filtros(tiposPresentes, (tipo) =>
          pintarPrograma(
            cuerpo,
            tipo === "todo"
              ? programa
              : programa.filter((f) => porId.get(f.eventoId).tipo === tipo),
            porId
          )
        )
      );
    }

    lista.appendChild(cuerpo);
    pintarPrograma(cuerpo, programa, porId, true);
    vista.appendChild(lista);

    // ---------- Sobre la sala ----------
    vista.appendChild(sobreLaSala());

    revelarAlEntrar(vista.querySelectorAll(".proximas, .franja-fotos, .cartelera, .sobre"));
  } catch (error) {
    vista.textContent = "";
    const caja = elemento("section", "pliego");
    caja.appendChild(avisoDeError(error));
    vista.appendChild(caja);
  }
};
