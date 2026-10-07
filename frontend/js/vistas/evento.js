// ========================================
// Evento
// Ficha completa y todas sus funciones, con su estado
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
  fotoDeEvento,
  icono,
  pesos,
  precioDesde
} from "../formato.js";

const portada = (evento) => {
  const foto = fotoDeEvento(evento);

  const seccion = elemento("section", "portada");
  const figura = elemento("figure", "foto foto--viva");
  const img = elemento("img");
  img.src = `imagenes/${foto.archivo}.webp`;
  img.srcset = `imagenes/${foto.archivo}-900.webp 900w, imagenes/${foto.archivo}.webp 1800w`;
  img.sizes = "100vw";
  img.width = 1800;
  img.height = 1200;
  img.alt = foto.alt;
  figura.appendChild(img);
  seccion.appendChild(figura);
  seccion.appendChild(elemento("div", "funcion-cabeza__velo"));

  const texto = elemento("div", "portada__texto");
  const volver = elemento("a", "volver", "Cartelera");
  volver.href = "#/";
  volver.prepend(icono("atras"));
  texto.appendChild(volver);

  const titulo = elemento("h2", "portada__titulo", evento.titulo);
  titulo.id = "titulo-evento";
  texto.appendChild(titulo);

  const ficha = elemento("p", "ficha");
  [
    evento.tipo,
    `${evento.duracionMinutos} minutos`,
    `Clasificación ${evento.clasificacionEdad}`
  ].forEach((dato) => ficha.appendChild(elemento("span", "ficha__dato", dato)));
  texto.appendChild(ficha);

  seccion.appendChild(texto);
  return seccion;
};

const filaFuncion = (funcion, orden) => {
  const item = elemento("li", "funcion funcion--entra");
  item.style.animationDelay = `${Math.min(orden, 6) * 40}ms`;

  const cuando = elemento("div");
  cuando.appendChild(
    elemento("p", "funcion__hora", funcion.hora)
  );
  cuando.appendChild(
    elemento("p", "funcion__ficha", diaLargo.format(aFecha(funcion.fecha)))
  );
  item.appendChild(cuando);

  const precio = elemento("p", "precio");
  precio.appendChild(elemento("span", "precio__rotulo", "Desde"));
  precio.appendChild(
    elemento("span", "precio__cifra", pesos.format(precioDesde(funcion)))
  );
  item.appendChild(precio);

  const cierre = elemento("div", "funcion__cierre");
  cierre.appendChild(chipEstado(funcion.estado));
  cierre.appendChild(
    enlaceBoton(
      funcion.estado === "en_venta" ? "Elegir butaca" : "Ver función",
      `#/funcion/${funcion.id}`,
      funcion.estado === "en_venta" ? "boton" : "boton boton--fantasma"
    )
  );
  item.appendChild(cierre);

  return item;
};

export const render = async (vista, parametros) => {
  const cuerpo = elemento("section", "pliego");
  cuerpo.appendChild(cargando("el evento"));
  vista.appendChild(cuerpo);

  try {
    const evento = await api.evento(parametros.id);
    const funciones = (await api.funcionesDeEvento(evento.id)).sort(
      (a, b) => aFecha(a.fecha, a.hora) - aFecha(b.fecha, b.hora)
    );

    vista.textContent = "";
    vista.appendChild(portada(evento));

    const pliego = elemento("section", "pliego");
    pliego.setAttribute("aria-labelledby", "titulo-evento");

    pliego.appendChild(elemento("p", "pliego__entrada", evento.descripcion));

    if (!evento.activo) {
      pliego.appendChild(
        aviso(
          "Evento fuera de programación",
          "Este evento está inactivo: no admite funciones nuevas. Las que ya estaban programadas siguen abajo."
        )
      );
    }

    const titulo = elemento("h3", "cartelera__titulo pliego__seccion", "Funciones");
    pliego.appendChild(titulo);

    const futuras = funciones.filter(esFutura);
    const pasadas = funciones.filter((f) => !esFutura(f));

    if (funciones.length === 0) {
      pliego.appendChild(
        aviso(
          "Sin funciones programadas",
          "Este evento todavía no tiene funciones en la agenda de la sala."
        )
      );
    } else {
      const lista = elemento("ul", "funciones-evento");
      futuras.forEach((f, orden) => lista.appendChild(filaFuncion(f, orden)));
      pliego.appendChild(lista);

      if (pasadas.length > 0) {
        pliego.appendChild(
          elemento(
            "p",
            "pliego__nota",
            `${pasadas.length} función${pasadas.length === 1 ? "" : "es"} ya ${
              pasadas.length === 1 ? "pasó" : "pasaron"
            }: ${pasadas
              .map((f) => `${diaLargo.format(aFecha(f.fecha))} (${f.estado})`)
              .join("; ")}.`
          )
        );
      }
    }

    vista.appendChild(pliego);
  } catch (error) {
    cuerpo.textContent = "";
    cuerpo.appendChild(avisoDeError(error));
  }
};
