import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// ========================================
// Política de contenido del build
// Solo al compilar: en desarrollo Vite inyecta estilos en línea
// ========================================
const directivasCsp = (api) => [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${api}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
];

const politicaDeContenido = (api) => ({
  name: "politica-de-contenido",
  apply: "build",
  transformIndexHtml(html) {
    return html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${directivasCsp(api).join("; ")}" />`
    );
  }
});

// ========================================
// Cabeceras de seguridad
// frame-ancestors solo funciona en cabecera, nunca en <meta>
// ========================================
const CABECERAS_COMUNES = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin"
};

// ========================================
// Configuración
// ========================================
export default defineConfig(({ mode }) => {
  const entorno = loadEnv(mode, process.cwd(), "VITE_");
  const api = entorno.VITE_API_URL || "";

  return {
    plugins: [react(), politicaDeContenido(api)],
    server: {
      port: 5173,
      strictPort: true,
      headers: { ...CABECERAS_COMUNES, "X-Frame-Options": "DENY" }
    },
    preview: {
      port: 4173,
      strictPort: true,
      headers: {
        ...CABECERAS_COMUNES,
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": [...directivasCsp(api), "frame-ancestors 'none'"].join("; ")
      }
    }
  };
});
