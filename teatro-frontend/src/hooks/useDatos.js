import { useCallback, useEffect, useState } from "react";

// ========================================
// Carga de datos con cancelación y recarga
// El cargador debe venir de useCallback para no pedir en cada render
// ========================================
export function useDatos(cargar) {
  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState({ datos: null, error: "", cargando: true });

  useEffect(() => {
    const controlador = new AbortController();

    cargar(controlador.signal)
      .then((datos) => {
        if (!controlador.signal.aborted) setEstado({ datos, error: "", cargando: false });
      })
      .catch((error) => {
        if (controlador.signal.aborted || error.name === "AbortError") return;
        setEstado((actual) => ({ ...actual, error: error.message, cargando: false }));
      });

    return () => controlador.abort();
  }, [cargar, version]);

  const recargar = useCallback(() => {
    setEstado((actual) => ({ ...actual, cargando: true }));
    setVersion((v) => v + 1);
  }, []);

  return { ...estado, recargar };
}
