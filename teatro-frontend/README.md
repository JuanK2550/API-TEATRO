# Teatro Maldonado · la interfaz en React

La interfaz del Teatro Maldonado de Tunja: la cartelera pública y, tras iniciar
sesión, un panel para cada rol. Es una aplicación de página única (SPA) que
consume la API REST del proyecto: no se conecta a PostgreSQL ni guarda ninguna
credencial del servidor. Es la única interfaz del proyecto: la Sala, la anterior,
se retiró y lo que aportaba —cartelera, registro y plano de butacas— está aquí.

```text
Navegador → React + Vite (localhost:5173)
          → fetch · HTTP JSON + JWT
          → Express (localhost:3000)
          → rutas → middlewares → controladores → servicios
          → pg.Pool + TLS → PostgreSQL (Supabase)
```

**Pila:** React 19, Vite 8, React Router 7 y Bootstrap 5.3. ESLint 10 para el
análisis estático.

## Arranque

Con la API en marcha en otra terminal (`npm run dev` en la raíz del proyecto):

```powershell
cd teatro-frontend
copy .env.example .env
npm ci
npm run lint
npm run build
npm run dev
```

La cartelera queda en <http://localhost:5173> y el panel en
<http://localhost:5173/panel>. `npm run preview` sirve el build en
<http://localhost:4173> con las cabeceras de seguridad de producción.

El backend solo responde a los orígenes de `ALLOWED_ORIGIN`. Para el desarrollo
basta `http://localhost:5173`, que es además su valor por defecto; el origen donde se publique
el panel tiene que añadirse ahí, o el navegador bloqueará las respuestas.

### Variables

| Variable | Valor por defecto | Para qué |
| -------- | ----------------- | -------- |
| `VITE_API_URL` | `http://localhost:3000` | Dirección de la API |

Todo lo que empieza por `VITE_` termina dentro del JavaScript que descarga el
navegador. Aquí **nunca** va una API Key, un `JWT_SECRET`, una contraseña ni una
cadena de conexión.

## Roles y módulos

| Quién | Qué ve |
| ----- | ------ |
| **Cualquiera, sin cuenta** | La cartelera (`/`), la ficha de cada evento con sus funciones y precios (`/evento/:id`), el registro y la recuperación de acceso |
| **Administrador** | Inicio con indicadores, usuarios y roles, eventos y funciones, asistentes, localidades, boletas, recuperación administrativa, códigos de recuperación y cambio de contraseña |
| **Taquilla** | Inicio, agenda de funciones en calendario, control de boletas (cobrar, vender en taquilla, registrar la entrada), mi perfil, códigos y contraseña |
| **Asistente** | Inicio, mis boletas (comprar, pago simulado, cancelar), mi perfil, seguridad de la cuenta y contraseña |

El menú y las rutas se ordenan por rol, pero **no son la seguridad**: el backend
vuelve a comprobar token, rol y propiedad en cada petición. Abrir a mano
`/panel/usuarios` con una cuenta de taquilla devuelve al inicio, y aunque se
forzara la petición, la API respondería 403.

## Anatomía

| Ruta | Responsabilidad |
| ---- | --------------- |
| `index.html` | Documento raíz y nodo de montaje |
| `src/main.jsx` | Punto de entrada: monta `App` e importa Bootstrap y los estilos |
| `src/App.jsx` | Rutas de la SPA, cada módulo protegido por rol |
| `src/index.css`, `src/App.css` | Tokens de diseño, fuentes y estructura del panel |
| `src/assets/` | Fotografías y fuentes con su licencia OFL |
| `src/pages/` | Cartelera, ficha de evento, acceso, registro, panel y las dos pantallas de recuperación |
| `src/components/` | Módulos de gestión y piezas compartidas |
| `src/context/AuthContext.jsx` | Sesión: inicio, cierre, caducidad del JWT y revocación |
| `src/context/auth-context.js` | Definición del contexto |
| `src/hooks/useAuth.js` | Acceso a la sesión desde los componentes |
| `src/hooks/useDashboardData.js` | Datos del inicio, según el rol |
| `src/hooks/useDatos.js` | Carga con cancelación y recarga |
| `src/services/api.js` | Inicio de sesión |
| `src/services/seguridad.service.js` | El único `fetch` del panel, y las rutas de cuenta y recuperación |
| `src/services/*.service.js` | Funciones HTTP por recurso |
| `src/services/sesion-expirada.js` | Aviso de sesión inválida sin acoplar los servicios a React |
| `src/components/RutaProtegida.jsx` | Ordena la navegación por sesión y rol; no sustituye al backend |
| `src/components/SitioPublico.jsx` | Cabecera y pie de la parte pública |
| `src/components/PlanoButacas.jsx` | Plano de una localidad: una parada de tabulación y flechas para moverse |
| `src/utils/afiches.js` | El afiche de cada evento, y el de su tipo para los nuevos |
| `CREDITOS-IMAGENES.md` | Autoría y origen de cada fotografía |
| `vite.config.js` | Plugin de React, CSP del build y cabeceras de seguridad |
| `eslint.config.js` | Reglas de análisis estático, incluidas las de hooks |

## Seguridad del cliente

- **Sin API Key.** El navegador no tiene ninguna: el catálogo es público, lo
  personal va con JWT y las dos rutas de restablecimiento las protege el propio
  secreto de un solo uso.
- **La sesión vive en `sessionStorage`**, no en `localStorage`: muere al cerrar
  la pestaña y no la comparten otras. Al recargar se confirma con
  `GET /api/auth/perfil`; si el servidor responde 401 —token caducado, revocado
  o cuenta desactivada— la sesión se cierra y la pantalla de acceso explica por
  qué.
- **Nada se escribe como HTML.** Ningún `dangerouslySetInnerHTML` ni `innerHTML`:
  React escapa todo el texto que llega de la API.
- **Sin estilos en línea.** Los gráficos son SVG con atributos, de modo que la
  CSP del build puede ser `style-src 'self'` a secas.
- **Política de contenido.** El build lleva una CSP en `<meta>`, y `vite preview`
  la envía además como cabecera con `frame-ancestors 'none'`, junto a
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` y `Cross-Origin-Opener-Policy`.
- **La cartelera se pide sin token**, aunque haya sesión: siempre la vista del
  público, nunca la del mostrador.
- **El plano solo sabe qué butacas están tomadas**: usa la ruta de ocupación,
  que no dice de quién es cada una.
- **El precio nunca sale del navegador.** Comprar o vender envía solo función,
  localidad, butaca y descuento; el precio que se ve antes es una previsión, y
  el definitivo lo calcula el servidor.
