import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// ========================================
// Ruta protegida
// Ordena la navegación; la seguridad real la aplica el backend
// ========================================
export default function RutaProtegida({ rolesPermitidos }) {
  const { autenticado, usuario, verificando, salidaVoluntaria } = useAuth();
  const location = useLocation();

  if (verificando) {
    return (
      <main className="pantalla-espera" role="status">
        Verificando sesión…
      </main>
    );
  }
  if (!autenticado) {
    const volverA = salidaVoluntaria ? undefined : { volverA: location.pathname + location.search };
    return <Navigate to="/login" replace state={volverA} />;
  }
  if (rolesPermitidos && !rolesPermitidos.includes(usuario?.rol)) {
    return <Navigate to="/panel" replace />;
  }
  return <Outlet />;
}
