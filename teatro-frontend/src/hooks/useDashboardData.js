import { useCallback } from "react";
import { useDatos } from "./useDatos";
import { solicitudSegura } from "../services/seguridad.service";
import { listarFunciones } from "../services/funciones.service";
import { listarEventos } from "../services/eventos.service";
import { listarLocalidades } from "../services/localidades.service";
import { misBoletas } from "../services/boletas.service";

// ========================================
// Qué consulta el inicio de cada rol
// Cada rol pide solo lo que su backend le deja ver
// ========================================
const CONSULTAS_POR_ROL = {
  administrador: {
    resumen: (token, signal) => solicitudSegura("/api/estadisticas/resumen", { token, signal }),
    funciones: listarFunciones,
    eventos: listarEventos
  },
  taquilla: {
    funciones: listarFunciones,
    eventos: listarEventos,
    localidades: listarLocalidades
  },
  asistente: {
    boletas: misBoletas,
    funciones: listarFunciones,
    eventos: listarEventos,
    localidades: listarLocalidades
  }
};

// ========================================
// Datos del inicio del panel
// Un fallo parcial no tumba el resto: cada bloque guarda su error
// ========================================
export function useDashboardData(token, rol) {
  const cargar = useCallback(
    async (signal) => {
      const consultas = CONSULTAS_POR_ROL[rol] ?? {};
      const claves = Object.keys(consultas);
      const resultados = await Promise.allSettled(claves.map((clave) => consultas[clave](token, signal)));

      const datos = {};
      const errores = {};
      resultados.forEach((resultado, i) => {
        if (resultado.status === "fulfilled") datos[claves[i]] = resultado.value;
        else errores[claves[i]] = resultado.reason?.message || "Error al consultar";
      });
      return { datos, errores };
    },
    [token, rol]
  );

  const { datos, cargando, recargar } = useDatos(cargar);
  return { datos: datos?.datos ?? {}, errores: datos?.errores ?? {}, cargando, actualizar: recargar };
}
