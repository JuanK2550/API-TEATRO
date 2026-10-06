// ========================================
// Sala
// Una sola página con vistas: el JWT nunca sale de memoria
// ========================================
// Si cada pantalla fuera un HTML aparte, cada salto recargaría el documento y
// borraría el token. Por eso la navegación cambia la vista sin recargar.
import * as api from "../js/api.js";
import { elemento, icono } from "./formato.js";
import * as cartelera from "./vistas/cartelera.js";
import * as evento from "./vistas/evento.js";
import * as funcion from "./vistas/funcion.js";
import * as entrar from "./vistas/entrar.js";
import * as butacas from "./vistas/butacas.js";
import * as boleta from "./vistas/boleta.js";
import * as misBoletas from "./vistas/misboletas.js";

const RUTAS = [
  { patron: /^\/?$/, vista: cartelera, titulo: "Cartelera" },
  { patron: /^\/evento\/(\d+)$/, vista: evento, titulo: "Evento", claves: ["id"] },
  {
    patron: /^\/funcion\/(\d+)\/butacas$/,
    vista: butacas,
    titulo: "Plano de sala",
    claves: ["id"]
  },
  { patron: /^\/funcion\/(\d+)$/, vista: funcion, titulo: "Función", claves: ["id"] },
  { patron: /^\/boleta\/(\d+)$/, vista: boleta, titulo: "Boleta", claves: ["id"] },
  { patron: /^\/mis-boletas$/, vista: misBoletas, titulo: "Mis boletas" },
  { patron: /^\/entrar$/, vista: entrar, titulo: "Entrar" }
];

const vista = document.querySelector("#vista");
let contextoSiguiente = null;

// La recarga borra la sesión. Si la había, se explica una sola vez.
let hayQueExplicarLaRecarga = api.huboSesion() && !api.usuarioActual();

// ========================================
// Dónde estamos
// El enlace de la sección actual se marca y se nota
// ========================================
const marcarSeccion = () => {
  const actual = location.hash || "#/";
  document.querySelectorAll(".marquesina__enlaces a").forEach((enlace) => {
    const suyo = enlace.getAttribute("href");
    const aqui = suyo === "#/" ? actual === "#/" : actual.startsWith(suyo);
    if (aqui) enlace.setAttribute("aria-current", "page");
    else enlace.removeAttribute("aria-current");
  });
};

// ========================================
// Sesión visible en la marquesina
// ========================================
const pintarSesion = (usuario) => {
  const caja = document.querySelector("#sesion");
  caja.textContent = "";

  if (!usuario) {
    const enlace = elemento("a", "", "Entrar");
    enlace.href = "#/entrar";
    caja.appendChild(enlace);
    return;
  }

  const nombre = elemento("a", "", usuario.nombre.split(" ")[0]);
  nombre.href = "#/entrar";
  nombre.title = `${usuario.nombre} · ${usuario.rol}`;
  caja.appendChild(nombre);

  const boletas = elemento("a", "", "Mis boletas");
  boletas.href = "#/mis-boletas";
  caja.appendChild(boletas);

  marcarSeccion();
};

// ========================================
// Aviso de recarga
// La sesión no sobrevive a recargar la página, y se dice
// ========================================
const explicarLaRecarga = () => {
  if (!hayQueExplicarLaRecarga) return;
  hayQueExplicarLaRecarga = false;

  const nota = elemento("div", "franja");
  nota.setAttribute("role", "status");
  nota.appendChild(
    elemento(
      "p",
      "franja__texto",
      "Por seguridad, la sesión no se guarda al recargar la página. Vuelve a entrar."
    )
  );

  const volver = elemento("button", "boton boton--texto", "Entrar de nuevo");
  volver.type = "button";
  volver.addEventListener("click", () => {
    contextoSiguiente = { volverA: location.hash || "#/" };
    location.hash = "#/entrar";
  });
  nota.appendChild(volver);

  vista.prepend(nota);
};

// ========================================
// Token vencido: de vuelta a entrar, con el aviso
// ========================================
export const sesionVencida = (volverA) => {
  contextoSiguiente = {
    aviso: "Tu sesión venció, inicia sesión de nuevo.",
    volverA: volverA || location.hash || "#/"
  };
  location.hash = "#/entrar";
};

// ========================================
// Enrutado
// ========================================
const resolver = (ruta) => {
  for (const candidata of RUTAS) {
    const coincidencia = ruta.match(candidata.patron);
    if (!coincidencia) continue;
    const parametros = {};
    (candidata.claves || []).forEach((clave, i) => {
      parametros[clave] = coincidencia[i + 1];
    });
    return { ...candidata, parametros };
  }
  return null;
};

const pintar = async () => {
  const ruta = location.hash.replace(/^#/, "") || "/";
  const encontrada = resolver(ruta);
  const contexto = contextoSiguiente;
  contextoSiguiente = null;

  vista.textContent = "";

  if (!encontrada) {
    const caja = elemento("section", "pliego");
    caja.appendChild(elemento("h2", "pliego__titulo", "Esa página no existe"));
    caja.appendChild(
      elemento("p", "pliego__entrada", `La dirección ${ruta} no corresponde a ninguna pantalla de la Sala.`)
    );
    const volver = elemento("a", "boton boton--fantasma", "Ir a la cartelera");
    volver.href = "#/";
    volver.appendChild(icono("flecha"));
    caja.appendChild(volver);
    vista.appendChild(caja);
    document.title = "Teatro Maldonado · No encontrado";
    return;
  }

  document.title = `Teatro Maldonado · ${encontrada.titulo}`;

  try {
    await encontrada.vista.render(vista, encontrada.parametros, contexto);
  } catch (error) {
    if (error && error.tokenExpirado) {
      sesionVencida(ruta);
      return;
    }
    throw error;
  }

  marcarSeccion();
  explicarLaRecarga();

  // Tras cambiar de vista, el foco vuelve al contenido para quien navega con
  // teclado o lector de pantalla.
  vista.focus({ preventScroll: true });
  if (!location.hash.includes("#/evento") || !location.hash.includes("#/funcion")) {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
};

// ========================================
// Telón: se abre una vez por sesión
// ========================================
// En modo privado el almacenamiento puede fallar: el telón se abre igual.
const recordarTelon = {
  yaSeAbrio: () => {
    try {
      return sessionStorage.getItem("telon-abierto") === "si";
    } catch {
      return false;
    }
  },
  anotar: () => {
    try {
      sessionStorage.setItem("telon-abierto", "si");
    } catch {
      /* sin almacenamiento, el telón se abrirá otra vez */
    }
  }
};

const abrirTelon = () => {
  const telon = document.querySelector(".telon");
  if (!telon) return;

  if (recordarTelon.yaSeAbrio()) {
    telon.classList.add("telon--guardado");
    return;
  }

  requestAnimationFrame(() => {
    telon.classList.add("telon--abierto");
    recordarTelon.anotar();
    setTimeout(() => telon.classList.add("telon--guardado"), 700);
  });
};

api.alCambiarSesion(pintarSesion);
window.addEventListener("hashchange", pintar);

abrirTelon();
pintar();
