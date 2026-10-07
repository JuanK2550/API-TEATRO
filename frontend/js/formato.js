// ========================================
// Piezas compartidas por las vistas
// ========================================
export const PALABRA_ESTADO = {
  en_venta: "En venta",
  programada: "Programada",
  agotada: "Agotada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada"
};

// Los porcentajes son los mismos de PORCENTAJES_DESCUENTO en
// src/services/boletas.service.js. La API expone qué descuentos habilita cada
// función, pero no cuánto descuenta cada uno, así que la tabla se repite aquí.
export const PORCENTAJE_DESCUENTO = {
  ninguno: 0,
  estudiante: 0.2,
  infantil: 0.5,
  adultoMayor: 0.3
};

export const NOMBRE_DESCUENTO = {
  ninguno: "Sin descuento",
  estudiante: "Estudiante",
  infantil: "Infantil",
  adultoMayor: "Adulto mayor"
};

export const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

export const porcentaje = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 0
});

export const diaLargo = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

// Las fechas vienen como YYYY-MM-DD: se arman a mano para que no las corra la
// zona horaria del navegador.
export const aFecha = (fecha, hora = "00:00") => {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  return new Date(anio, mes - 1, dia, h, m);
};

export const esFutura = (funcion) =>
  aFecha(funcion.fecha, funcion.hora) >= new Date();

export const precioDesde = (funcion) =>
  funcion.tarifas.reduce((menor, t) => Math.min(menor, t.precio), Infinity);

// Cada evento de la programación tiene su propia fotografía, para que la
// cartelera no repita la misma imagen tres veces. La clave es el id del evento,
// que es lo que la API garantiza estable.
const FOTO_POR_EVENTO = {
  1: { archivo: "afiche-obra", alt: "Tres actores en silueta sobre un telón rojo iluminado" },
  2: { archivo: "afiche-concierto", alt: "Violinistas de una orquesta tocando durante un concierto" },
  3: { archivo: "afiche-cine", alt: "Proyector de cine encendido en una sala a oscuras" },
  4: { archivo: "afiche-institucional", alt: "Público asistiendo a un acto en un auditorio" },
  5: { archivo: "afiche-musica-joven", alt: "Músico en el escenario entre luces y humo" },
  6: { archivo: "afiche-ballet", alt: "Bailarina en movimiento con falda larga sobre fondo oscuro" },
  7: { archivo: "afiche-jazz", alt: "Saxofones de una big band iluminados en el escenario" },
  8: { archivo: "afiche-infantil", alt: "Mesa con colores y materiales de un taller infantil" },
  9: { archivo: "afiche-cine-mudo", alt: "Claqueta de cine sostenida a contraluz" },
  10: { archivo: "afiche-musica-joven", alt: "Músico en el escenario entre luces y humo" },
  11: { archivo: "afiche-foro", alt: "Micrófono en primer plano frente a un público reunido" }
};

// Si un evento nuevo todavía no tiene foto propia, cae en la de su tipo.
export const fotoDeEvento = (evento) =>
  FOTO_POR_EVENTO[evento.id] || FOTO_POR_TIPO[evento.tipo] || FOTO_POR_TIPO.obra;

// Cada tipo de evento tiene su afiche: una fotografía que se reconoce de un
// vistazo, a todo color.
export const FOTO_POR_TIPO = {
  obra: {
    archivo: "afiche-obra",
    alt: "Tres actores en silueta sobre un telón rojo iluminado"
  },
  concierto: {
    archivo: "afiche-concierto",
    alt: "Violinistas de una orquesta tocando durante un concierto"
  },
  cine: {
    archivo: "afiche-cine",
    alt: "Proyector de cine encendido en una sala a oscuras"
  },
  institucional: {
    archivo: "afiche-institucional",
    alt: "Público asistiendo a un acto en un auditorio"
  }
};

// Las fotografías de la sala, para la portada y la franja.
export const FOTOS_DEL_TEATRO = [
  { archivo: "sala-roja", alt: "Sala del teatro con sus butacas rojas y el telón al fondo" },
  { archivo: "escenario-azul", alt: "Escenario iluminado por focos azules durante una función" },
  { archivo: "teatro-lleno", alt: "Teatro lleno visto desde el patio de butacas" },
  { archivo: "telon-rojo", alt: "Telón rojo de terciopelo iluminado desde el escenario" },
  { archivo: "cine-penumbra", alt: "Sala de cine en penumbra con la escalera iluminada" },
  { archivo: "publico-sala", alt: "Público sentado en la sala durante una función" }
];

// ========================================
// Fotografía a todo color
// El velo solo oscurece donde se apoya el texto
// ========================================
export const figura = (foto, { viva = false, ancho = "100vw" } = {}) => {
  const fig = elemento("figure", viva ? "foto foto--viva" : "foto");
  const img = elemento("img");
  img.src = `imagenes/${foto.archivo}.webp`;
  img.srcset = `imagenes/${foto.archivo}-900.webp 900w, imagenes/${foto.archivo}.webp 1800w`;
  img.sizes = ancho;
  img.width = 1800;
  img.height = 1200;
  img.alt = foto.alt;
  img.loading = "lazy";
  img.decoding = "async";
  fig.appendChild(img);
  return fig;
};

export const elemento = (etiqueta, clase, texto) => {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
};

const TRAZOS = {
  flecha: "M5 12h13M13 6l6 6-6 6",
  atras: "M19 12H6M11 18l-6-6 6-6",
  reloj: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  salir: "M16 17l5-5-5-5M21 12H9M12 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6",
  alerta: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
};

export const icono = (nombre) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icono");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const trazo = document.createElementNS("http://www.w3.org/2000/svg", "path");
  trazo.setAttribute("d", TRAZOS[nombre]);
  svg.appendChild(trazo);
  return svg;
};

// El color nunca va solo: cada estado lleva su palabra y su forma.
export const chipEstado = (estado) =>
  elemento("span", `estado estado--${estado}`, PALABRA_ESTADO[estado] || estado);

export const enlaceBoton = (texto, destino, clase = "boton") => {
  const enlace = elemento("a", clase, texto);
  enlace.href = destino;
  enlace.appendChild(icono("flecha"));
  return enlace;
};

// ========================================
// Aparecer al llegar al scroll
// Una sola vez por elemento
// ========================================
// Con movimiento reducido no se observa nada: los elementos se quedan visibles
// desde el principio y no hay nada que esperar.
export const revelarAlEntrar = (elementos) => {
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lista = [...elementos];

  if (quieto || !("IntersectionObserver" in window)) {
    lista.forEach((n) => n.classList.add("revelado"));
    return;
  }

  const vigia = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add("revelado");
        vigia.unobserve(entrada.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );

  lista.forEach((n) => {
    n.classList.add("por-revelar");
    vigia.observe(n);
  });

  // Red de seguridad: pase lo que pase, a los 2,5 segundos todo está visible.
  // Que una sección quede escondida porque un observador no disparó es un
  // fallo mucho peor que perderse la animación.
  setTimeout(() => {
    lista.forEach((n) => n.classList.add("revelado"));
    vigia.disconnect();
  }, 2500);
};

// ========================================
// Estados de la página
// ========================================
export const cargando = (que) => {
  const caja = elemento("div", "esqueleto");
  caja.setAttribute("aria-live", "polite");
  caja.setAttribute("aria-busy", "true");
  caja.appendChild(elemento("p", "a-fondo", `Cargando ${que}`));
  for (let i = 0; i < 3; i += 1) caja.appendChild(elemento("div", "esqueleto__linea"));
  return caja;
};

export const aviso = (titulo, cuerpo, accion) => {
  const caja = elemento("div", "aviso");
  caja.appendChild(elemento("h3", "aviso__titulo", titulo));
  caja.appendChild(elemento("p", "aviso__cuerpo", cuerpo));
  if (accion) caja.appendChild(accion);
  return caja;
};

// ========================================
// Un error de la API contado en palabras
// ========================================
// ========================================
// Resumen de errores de un formulario
// Enlaza cada problema con su campo y recibe el foco
// ========================================
// El error de cada campo se queda donde está: el resumen no lo reemplaza, lo
// acompaña, porque con cinco campos malos a la vez no se ven todos de un
// vistazo.
export const resumenDeErrores = (titulo, problemas) => {
  const caja = elemento("div", "resumen-error");
  caja.setAttribute("role", "alert");
  caja.tabIndex = -1;

  const cabeza = elemento("p", "resumen-error__titulo");
  cabeza.appendChild(icono("alerta"));
  cabeza.appendChild(document.createTextNode(titulo));
  caja.appendChild(cabeza);

  if (problemas.length > 0) {
    const lista = elemento("ul", "resumen-error__lista");
    problemas.forEach(({ id, mensaje }) => {
      const item = elemento("li");
      if (id) {
        const enlace = elemento("a", "", mensaje);
        enlace.href = `#${id}`;
        enlace.addEventListener("click", (e) => {
          e.preventDefault();
          const campo = document.getElementById(id);
          if (campo) campo.focus();
        });
        item.appendChild(enlace);
      } else {
        item.textContent = mensaje;
      }
      lista.appendChild(item);
    });
    caja.appendChild(lista);
  }

  return caja;
};

export const avisoDeError = (error) => {
  if (error && error.status === 401) {
    return aviso(
      "La aplicación no pudo identificarse",
      "El servidor rechazó la API Key de la aplicación web. Revisa que API_KEY_WEB esté en el .env y reinicia el servidor."
    );
  }

  if (error && error.status === 404) {
    return aviso(
      "No encontramos eso",
      "El enlace apunta a algo que ya no está en cartel.",
      enlaceBoton("Volver a la cartelera", "#/", "boton boton--fantasma")
    );
  }

  return aviso(
    "No se pudo cargar",
    `${error.message}. Comprueba que la API esté corriendo en este mismo servidor.`
  );
};
