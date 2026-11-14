import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import RutaProtegida from "./components/RutaProtegida";
import SitioPublico from "./components/SitioPublico";
import CarteleraPage from "./pages/CarteleraPage";
import EventoPage from "./pages/EventoPage";
import RegistroPage from "./pages/RegistroPage";
import LoginPage from "./pages/LoginPage";
import RecuperarPasswordPage from "./pages/RecuperarPasswordPage";
import RestablecerTokenPage from "./pages/RestablecerTokenPage";
import DashboardPage from "./pages/DashboardPage";
import InicioPanel from "./components/InicioPanel";
import GestionUsuarios from "./components/GestionUsuarios";
import ProgramacionTeatro from "./components/ProgramacionTeatro";
import GestionAsistentes from "./components/GestionAsistentes";
import GestionLocalidades from "./components/GestionLocalidades";
import GestionBoletas from "./components/GestionBoletas";
import CalendarioFunciones from "./components/CalendarioFunciones";
import ControlBoletas from "./components/ControlBoletas";
import MisBoletas from "./components/MisBoletas";
import PerfilPropio from "./components/PerfilPropio";
import RecuperacionAdministrativa from "./components/RecuperacionAdministrativa";
import CodigosRecuperacion from "./components/CodigosRecuperacion";
import CambiarPassword from "./components/CambiarPassword";
import { MODULOS } from "./navegacion";
import "./App.css";

// ========================================
// Qué componente abre cada módulo
// ========================================
const VISTAS = {
  usuarios: <GestionUsuarios />,
  programacion: <ProgramacionTeatro />,
  asistentes: <GestionAsistentes />,
  localidades: <GestionLocalidades />,
  boletas: <GestionBoletas />,
  agenda: <CalendarioFunciones />,
  control: <ControlBoletas />,
  misBoletas: <MisBoletas />,
  miPerfil: <PerfilPropio />,
  recuperacion: <RecuperacionAdministrativa />,
  codigos: <CodigosRecuperacion />,
  password: <CambiarPassword />
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SitioPublico />}>
            <Route index element={<CarteleraPage />} />
            <Route path="/evento/:id" element={<EventoPage />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegistroPage />} />
          <Route path="/recuperar-password" element={<RecuperarPasswordPage />} />
          <Route path="/restablecer-token" element={<RestablecerTokenPage />} />

          <Route element={<RutaProtegida />}>
            <Route path="/panel" element={<DashboardPage />}>
              <Route index element={<InicioPanel />} />
              {Object.entries(MODULOS).map(([clave, modulo]) => (
                <Route key={clave} element={<RutaProtegida rolesPermitidos={modulo.roles} />}>
                  <Route path={modulo.ruta} element={VISTAS[clave]} />
                </Route>
              ))}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
