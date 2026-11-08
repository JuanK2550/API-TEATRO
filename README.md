# API_TEATRO — Teatro Maldonado de Tunja

API REST para programar funciones y vender boletería en el Teatro Maldonado de
Tunja. Hecha con Node.js y Express, con los datos en PostgreSQL sobre Supabase
y documentada con OpenAPI 3.0.3.

## Objetivo y contexto

El teatro programa obras, conciertos, cine y actos institucionales en una sala
única, con localidades a distintas distancias del escenario. La API gestiona el
flujo completo, desde el catálogo de eventos hasta la validación de la boleta en
la puerta. El precio, el código y el estado de las boletas los calcula el
servidor. Es un trabajo académico; los datos viven en una base PostgreSQL
alojada en Supabase. El acceso a `/api` va por capas: la cartelera se lee sin
credenciales, lo que pertenece a alguien exige un JWT, y la API Key se quedó
donde todavía significa algo, las integraciones que no corren en un navegador.

## Cómo se construyó · recorrido por los bloques

El proyecto creció por laboratorios, y cada uno dejó algo en pie. La tabla dice
qué añadió cada bloque y en qué archivos vive hoy, para poder ir del enunciado
al código sin buscar.

| Bloque | Qué añadió | Dónde vive |
| ------ | ---------- | ---------- |
| Base (fases 1 a 9) | Los cinco recursos, las reglas de negocio, las máquinas de estado y la documentación OpenAPI | [`src/routes/`](src/routes/), [`src/services/`](src/services/), [`src/docs/swagger.js`](src/docs/swagger.js) |
| Lab. 5 · Integridad referencial y API Key | Relaciones que no se rompen y la primera credencial: `X-API-Key` | [`apiKey.middleware.js`](src/middlewares/apiKey.middleware.js) |
| Lab. 6 · Múltiples clientes | Varios clientes registrados y las claves guardadas como hash SHA-256, nunca en claro | [`src/data/apiKeys.js`](src/data/apiKeys.js), [`crypto.util.js`](src/utils/crypto.util.js) |
| Lab. 7 · Usuarios, hashing y salting | Cuentas con contraseña bajo bcrypt, cost 12 y sal por contraseña | [`password.util.js`](src/utils/password.util.js), [`usuarios.service.js`](src/services/usuarios.service.js) |
| Lab. 8 · Control del rol | El rol lo asigna el servidor; el administrador inicial se siembra desde el entorno | [`usuarios.controller.js`](src/controllers/usuarios.controller.js) |
| Lab. 9 · Sesión con JWT | Token HS256 con caducidad y algoritmo fijo al firmar y al verificar | [`jwt.util.js`](src/utils/jwt.util.js), [`auth.middleware.js`](src/middlewares/auth.middleware.js) |
| La Sala · frontend | Interfaz sin framework: nada se escribe como HTML, sesión en memoria y su propia política de contenido | [`frontend/`](frontend/) |
| Lab. 10 · Autorización | RBAC con `autorizarRoles` y las guardas de propiedad que cierran el IDOR/BOLA | [`roles.middleware.js`](src/middlewares/roles.middleware.js), [`propiedad.middleware.js`](src/middlewares/propiedad.middleware.js) |
| Bloque 7 · Persistencia | PostgreSQL en Supabase con TLS verificado, rol de privilegio mínimo y RLS en todas las tablas | [`database/`](database/), [`src/config/database.js`](src/config/database.js) |
| Bloque 8 · Validación integral | El bootstrap del administrador separado del arranque y la tanda completa de pruebas | [`scripts/`](scripts/), [`pruebas/`](pruebas/) |
| Bloque 11 · Recuperación y credenciales | Versión de sesión para revocar tokens, recuperación administrativa, códigos de respaldo y el reparto de credenciales que saca la API Key del navegador | [`recuperacion.service.js`](src/services/recuperacion.service.js), [`codigosRecuperacion.service.js`](src/services/codigosRecuperacion.service.js), [`publico.middleware.js`](src/middlewares/publico.middleware.js) |

Cada bloque tiene su informe escrito en [`docs/seguridad/`](docs/seguridad/) y
su PDF de entrega en [`docs/entregas/`](docs/entregas/).

## Recursos

| Recurso | Qué representa |
| ------- | -------------- |
| **Asistentes** | Personas que compran boletas. Documento y email únicos. |
| **Eventos** | Espectáculos: obra, concierto, cine o institucional. Pueden desactivarse. |
| **Localidades** | Zonas de la sala (Platea Preferencial, Platea General, Balcón). El `orden` indica la cercanía al escenario: 1 es la más cercana. |
| **Funciones** | Presentación de un evento en una fecha y hora, con tarifas por localidad, descuentos habilitados y estado. |
| **Boletas** | Venta de una butaca a un asistente para una función. El servidor calcula el precio, genera el código y controla el estado. |

## Relaciones

```
   ┌────────────┐
   │  EVENTOS   │
   └─────┬──────┘
         │ 1
         │
         │ N
   ┌─────┴──────┐        tarifas        ┌──────────────┐
   │  FUNCIONES │◄─────────────────────►│ LOCALIDADES  │
   └─────┬──────┘   (precio por zona)   └──────┬───────┘
         │ 1                                   │ 1
         │                                     │
         │ N                                   │ N
   ┌─────┴──────────────────────────────────────┴───────┐
   │                     BOLETAS                        │
   └────────────────────────┬───────────────────────────┘
                            │ N
                            │
                            │ 1
                     ┌──────┴───────┐
                     │  ASISTENTES  │
                     └──────────────┘
```

## Reglas de negocio

**Agenda**
- No puede haber dos funciones con la misma fecha y hora (sala única).
- Una función cancelada libera su franja.
- No se programan funciones con fecha pasada ni de eventos inactivos.

**Tarifas y precios**
- Cada función tiene tarifa para todas las localidades activas, sin duplicados.
- Cada localidad de las tarifas debe existir y estar activa.
- A menor `orden`, precio estrictamente mayor. Se comparan todos los pares de localidades.
- El precio de la boleta es la tarifa de su localidad menos el descuento, redondeado a entero.
- Descuentos: `ninguno` 0 %, `estudiante` 20 %, `infantil` 50 %, `adultoMayor` 30 %.
- El descuento aplicado debe estar habilitado en la función.

**Venta**
- La combinación función + localidad + fila + número es única.
- Una boleta cancelada libera su butaca.
- Solo se venden boletas de funciones `en_venta`.
- La butaca debe existir dentro de la localidad.
- No se supera el aforo de la localidad en una función.
- Máximo 6 boletas no canceladas por asistente y función.
- `documento` y `email` de asistente únicos; `codigo` y `orden` de localidad únicos.
- `capacidad` = `filas × butacasPorFila`, calculada por el servidor.

**Estados**

```
Funciones: programada → en_venta, cancelada
           en_venta   → agotada, en_curso, cancelada
           agotada    → en_curso, cancelada
           en_curso   → finalizada
Boletas:   reservada  → pagada, cancelada
           pagada     → usada, cancelada
```

- `finalizada`, `cancelada` y `usada` son estados terminales.
- Pasar una función a `en_venta` exige tarifas completas y coherentes.
- Una boleta solo pasa a `usada` si la función está `en_curso`.
- No se modifican funciones `en_curso`, `finalizada` ni `cancelada`.
- Solo se modifican boletas `reservada`; solo se eliminan `reservada` o `cancelada`.

## Integridad referencial

Ningún `DELETE` puede dejar registros huérfanos, igual que haría una base de
datos con `FOREIGN KEY ... ON DELETE RESTRICT`.

| Recurso | No se elimina si | Respuesta |
| ------- | ---------------- | --------- |
| Asistente | Tiene boletas | 409 |
| Evento | Tiene funciones | 409 |
| Localidad | Tiene boletas, o aparece en las tarifas de alguna función | 409 |
| Función | Tiene boletas | 409 |

Cada `DELETE` comprueba primero que el recurso exista (404), después sus
relaciones (409) y solo entonces borra (200). El id inválido lo rechaza antes
el validador con un 400.

**Una boleta cancelada sigue bloqueando el borrado.** Cancelar y eliminar no
son lo mismo: la cancelación libera la butaca para que se pueda revender, pero
la boleta permanece como registro histórico y sigue apuntando a su función, su
localidad y su asistente. Si se borrara cualquiera de los tres, esa referencia
quedaría rota. Por eso las comprobaciones de integridad cuentan **todas** las
boletas, sin mirar su estado, mientras que la regla de reventa de butacas sí
distingue las canceladas.

## Medidas de seguridad

| Medida | Implementación |
| ------ | -------------- |
| API Key | Cabecera `X-API-Key` en las rutas de integración; cuatro clientes registrados, claves guardadas como hash SHA-256 |
| Contraseñas | Usuarios con bcrypt, cost 12 y sal por contraseña; nunca se guardan ni se devuelven en claro |
| JWT | Token firmado con HS256 y caducidad; algoritmo fijo al firmar y al verificar |
| Autorización por rol | `autorizarRoles` en 36 endpoints: 401 sin sesión, 403 si el rol no corresponde |
| Propiedad del dato | Tres guardas en `propiedad.middleware.js`: un asistente solo ve y toca lo suyo |
| Revocación de sesión | `version_sesion` en el token y en la base: cambiar la contraseña invalida todos los tokens anteriores |
| Recuperación de acceso | Token administrativo de 15 minutos y ocho códigos de respaldo, los dos de un solo uso y guardados como hash SHA-256 |
| Catálogo público | Las nueve lecturas de cartelera no piden credenciales, no muestran datos de nadie y ocultan lo inactivo |
| Persistencia | PostgreSQL en Supabase, con TLS y certificado verificado; las reglas críticas también como restricciones de la base |
| Privilegio mínimo en la base | La API se conecta con `api_teatro`: sin superusuario, sin `BYPASSRLS` y sin poder crear ni borrar tablas |
| Row Level Security | Activo en las once tablas, con once políticas solo para el rol de la aplicación: cualquier otro rol ve cero filas |
| Salvaguarda de la base | `preparar-base.js` compara una huella del host y del usuario antes de abrir la conexión; si no es la del teatro, aborta sin ejecutar nada |
| helmet | Cabeceras de seguridad en todas las respuestas |
| `x-powered-by` | Deshabilitado con `app.disable("x-powered-by")` |
| CORS | Lista de orígenes desde `ALLOWED_ORIGIN`, separados por comas; métodos GET, POST, PUT, PATCH, DELETE |
| Rate limiting | Tres límites por IP cada 15 min: 100 en todo `/api` (`RATE_LIMIT_MAX`), 10 en login y registro (`RATE_LIMIT_ACCESO_MAX`) y 10 en las rutas de recuperación (`RATE_LIMIT_RECUPERACION_MAX`) |
| Límite del cuerpo | `express.json({ limit: "10kb" })` |
| express-validator | Tipos, rangos, formatos y listas blancas en `tipo`, `clasificacionEdad`, `tipoDescuento` y estados; textos sin `<` ni `>` |
| Mass Assignment | Los controllers leen solo `matchedData`, nunca `req.body` |
| Campos del servidor | `precio`, `codigo` y `estado` de boletas; `estado` de funciones; `activo` de eventos; `activa` y `capacidad` de localidades; `rol`, `activo` y `version_sesion` de usuarios |
| Manejo de errores | Mensajes genéricos `{ mensaje }`; el detalle solo se registra en consola |

**Autenticación por API Key.** Hasta el bloque 11 la cabecera `X-API-Key` era
obligatoria en todo `/api`. Hoy la exigen solo las rutas de integración, las que
no tienen detrás a una persona con sesión; el reparto completo está en
[Qué credencial pide cada ruta](#qué-credencial-pide-cada-ruta). Donde se exige,
la clave se lee solo de la cabecera, nunca de la query string, porque las URLs
quedan guardadas en historiales, registros del servidor y proxies.

Hay cuatro clientes registrados en `src/data/apiKeys.js`, dos de ellos activos:

| id | Cliente | Variable | Estado |
| -- | ------- | -------- | ------ |
| 1 | Postman Laboratorio | `API_KEY_POSTMAN` | Activa |
| 2 | Taquilla del Teatro | `API_KEY_TAQUILLA` | Activa |
| 3 | Aplicación Móvil | `API_KEY_MOVIL` | Deshabilitada |
| 4 | Aplicación Web | `API_KEY_WEB` | **Desactivada** desde el bloque 11 |

Las claves **no se guardan en claro**. Al arrancar, el servidor calcula el hash
SHA-256 de cada una y solo conserva ese hash. En cada petición calcula el hash
de la clave recibida y lo compara con los registrados. La clave original nunca
se recupera ni hace falta recuperarla.

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| No envía la cabecera | 401 | API Key requerida |
| La clave no corresponde a ningún cliente | 401 | API Key inválida |
| La clave es de un cliente deshabilitado | 403 | API Key deshabilitada |
| La clave es de un cliente activo | 200 | La petición sigue su curso |

401 quiere decir que no se reconoce la clave. 403 quiere decir que se reconoce,
se sabe de qué cliente es, pero ese cliente no tiene permitido pasar.

Si la petición pasa, el middleware deja en `req.clienteApi` el `id` y el
`nombre` del cliente. `GET /api/seguridad/cliente` lo devuelve: la URL es la
misma para todos y la respuesta cambia según la clave enviada.

Un fallo de configuración impide que el servidor arranque. Si falta alguna de
las tres variables, `src/data/apiKeys.js` lanza "Faltan variables de entorno
para las API Keys" al cargarse y el proceso termina. El error aparece al
arrancar, no con la primera petición.

La comparación de hashes usa `crypto.timingSafeEqual` y no `===`. Una comparación normal
de cadenas se detiene en el primer carácter distinto, así que tarda un poco más
cuantos más caracteres iniciales acierte el atacante; midiendo esos tiempos se
puede deducir la clave carácter a carácter. `timingSafeEqual` compara siempre
todos los bytes, en tiempo constante. Antes se comprueba que ambas claves midan
lo mismo, porque esa función exige buffers del mismo tamaño.

Esto autentica al **cliente** que consume la API, no a una persona. Quién es la
persona lo dice el apartado siguiente.

### Autenticación de usuarios

`POST /api/auth/registro` crea un usuario y `POST /api/auth/login` comprueba sus
credenciales. Las dos rutas están bajo `/api`, así que además exigen la API Key:
la clave dice qué aplicación pide y el correo con la contraseña dicen qué
persona.

Roles: `administrador`, `taquilla` y `asistente`.

**El rol lo asigna el servidor.** El registro solo acepta `nombre`, `email` y
`password`, los tres obligatorios. `rol` no forma parte del contrato: todo
usuario creado por el registro público nace como `asistente`, el rol con menos
privilegios. Si la petición envía `"rol": "administrador"`, la respuesta sigue
siendo 201 y el usuario queda como `asistente`.

No responde 400 porque la entrada se filtra por lista blanca: `matchedData`
conserva solo los campos declarados en el validador y descarta el resto sin
discutir. Una lista negra tendría que ir nombrando cada campo peligroso uno por
uno, y siempre se queda corta; la lista blanca también frena los campos que
todavía no existen. Por eso un `"permisos": ["DELETE_ALL", "ADMIN"]` se cae solo,
sin que nadie lo hubiera previsto. Mandar un campo no da derecho a controlarlo.

Además el service no copia lo que llega: arma el usuario campo por campo y fija
`rol` y `activo` por su cuenta. Son dos capas independientes, y cada una basta
por sí sola.

**La contraseña nunca se guarda.** Se guarda su hash, calculado con bcrypt y
cost 12. bcrypt genera una **sal distinta para cada contraseña** y la incluye
dentro del hash, así que no hace falta guardarla aparte. Dos usuarios con la
misma contraseña quedan con hashes distintos:

```
$2b$12$<sal A, 22 caracteres><resultado A>
$2b$12$<sal B, 22 caracteres><resultado B>
```

`$2b$` es la variante de bcrypt, `12$` el cost y lo que sigue son la sal y el
resultado. Un cost alto hace cada comprobación deliberadamente lenta, que es lo
que encarece probar contraseñas en masa. Por eso se usa bcrypt y no SHA-256:
las API Keys son aleatorias, pero una contraseña escrita por una persona se
adivina probando.

**Ni la contraseña ni su hash salen nunca en una respuesta.** Los controllers
arman la respuesta campo por campo: `id`, `nombre`, `email`, `rol` y, en el
registro, `activo`.

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| Registro correcto | 201 | Usuario registrado correctamente |
| El correo ya está registrado | 409 | Ya existe un usuario con ese correo electrónico |
| Login correcto | 200 | Autenticación correcta |
| Correo desconocido **o** contraseña incorrecta | 401 | Credenciales inválidas |
| Usuario deshabilitado | 403 | Usuario deshabilitado |

El 401 **no distingue** si falló el correo o la contraseña, a propósito. Con un
mensaje del tipo "ese usuario no existe", cualquiera podría averiguar qué
correos están registrados probándolos uno por uno, y esa lista ya es
información útil para un atacante.

### Sesión con JWT

El login, además del usuario, devuelve un **token JWT** en el campo `token`.
Ese token se manda en las siguientes peticiones en la cabecera
`Authorization: Bearer <token>`, y es lo que identifica a la persona.

**Qué lleva el token**: `sub` con el id del usuario, `email`, `rol`, `vs` con la
versión de sesión, `iat` (cuándo se emitió) y `exp` (cuándo caduca). **Qué no
lleva**: la contraseña ni su hash, ni ningún otro dato del usuario.

Se firma con **HS256**, fijado en el código al firmar y al verificar. Al
verificar solo se acepta ese algoritmo, en lugar de fiarse del que anuncia el
propio token: un token que llegue diciendo `"alg": "none"` se rechaza.

**Firmar no es cifrar.** El contenido del token va en base64, así que cualquiera
que lo tenga puede leerlo; de hecho `jwt.decode` lo lee sin la clave. Lo que
impide la firma es **modificarlo**: si alguien cambia el rol dentro del payload,
la firma deja de cuadrar y la API responde 401. Por eso en el token no va nada
que deba permanecer secreto, y por eso nunca se decide nada con `decode`, solo
con `verify`.

Las credenciales del proyecto, cada una en su sitio:

| Credencial | Qué responde | Dónde viaja |
| ---------- | ------------ | ----------- |
| `X-API-Key` | Qué aplicación consume la API | Cabecera, en las rutas de integración |
| email + contraseña | Quién dice ser la persona | Cuerpo de `POST /api/auth/login` |
| JWT | Sesión temporal de esa persona | Cabecera `Authorization: Bearer` |
| `rol` dentro del token | Base de la autorización que vendrá | Dentro del JWT |

`GET /api/auth/perfil` devuelve quién es el usuario y, si la petición llevaba
clave, qué cliente la hizo. Hasta el bloque 11 exigía **las dos credenciales a
la vez**; ahora basta el JWT, porque es lo que identifica a la persona, y
`clienteApi` aparece solo cuando hay clave que informar. Siguen siendo
independientes: el mismo token usado desde dos aplicaciones distintas devuelve
el mismo `usuario` y distinto `clienteApi`.

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| Sin cabecera `Authorization` | 401 | Token de autenticación requerido |
| Sin `Bearer` delante, u otro esquema | 401 | Formato de token inválido |
| Token caducado | 401 | Token expirado |
| Firma incorrecta, payload alterado o `alg: none` | 401 | Token inválido |

### Revocar una sesión · la versión de sesión

Un JWT es válido porque la firma cuadra, no porque el servidor lo recuerde. Esa
es su ventaja —no hace falta guardar sesiones— y también su problema: hasta el
bloque 11 un token robado servía hasta su `exp`, aunque la víctima cambiara la
contraseña. Cambiarla cerraba la puerta de entrada y dejaba las llaves repartidas.

La solución es un contador. Cada usuario tiene `version_sesion` en la base, que
empieza en cero y **solo sube**. El token se emite con ese valor en el claim
`vs`, y en cada petición autenticada `auth.middleware.js` consulta el usuario y
compara:

| Comprobación | Si falla |
| ------------ | -------- |
| El usuario existe y sigue activo | 401 · Cuenta no disponible |
| `vs` del token = `version_sesion` de la base | 401 · Sesión revocada |

Tres operaciones suben el contador, y las tres significan lo mismo: «esta
contraseña ya no es la de antes».

- `PATCH /api/auth/cambiar-password`, el propio usuario.
- `POST /api/auth/restablecer-password`, con un token de recuperación.
- `POST /api/auth/restablecer-con-codigo`, con un código de respaldo.

El efecto es inmediato y alcanza a **todos** los tokens anteriores, también al
de la terminal donde se hizo el cambio. No hay lista de tokens revocados que
mantener: basta un entero por usuario.

El precio es una consulta por petición autenticada, que es exactamente lo que un
JWT prometía evitar. Se paga a propósito: un token que no se puede revocar no es
una sesión, es una llave sin cerradura. Y de la misma consulta sale el **rol
actual**, no el que se copió en el token al emitirlo, así que degradar a un
usuario también surte efecto en la siguiente petición.

### Recuperar el acceso cuando no hay contraseña

Quien olvida la contraseña no puede entrar, y sin entrar no puede cambiarla. Hay
dos caminos, y ninguno manda nada por correo: el proyecto no tiene servidor de
correo, y fingir que lo tiene sería inventar la mitad del mecanismo.

**1 · Recuperación administrativa.** Un administrador emite un token para una
cuenta con `POST /api/auth/recuperacion/:usuarioId`, y lo entrega por el canal
que corresponda. El token:

- vive **15 minutos**;
- sirve **una sola vez**, y el segundo intento responde 400;
- se guarda como **hash SHA-256**, así que la tabla no contiene nada reutilizable;
- queda registrado con quién lo emitió, y ese rastro no se borra si luego se
  elimina al administrador.

Con él, `POST /api/auth/restablecer-password` fija la contraseña nueva y sube la
versión de sesión.

**2 · Códigos de respaldo.** `POST /api/auth/codigos-recuperacion` genera un lote
de **ocho** códigos de un solo uso, que se devuelven **una única vez**: después
solo quedan sus hashes. `POST /api/auth/restablecer-con-codigo` canjea uno por
una contraseña nueva, y gastar uno deja los otros siete en pie.
`GET /api/auth/codigos-recuperacion/estado` dice cuántos quedan sin revelarlos, y
`/regenerar` emite un lote nuevo invalidando el anterior por completo.

Las dos tablas nuevas, `password_reset_tokens` y `codigos_recuperacion`, se
crearon con el mismo criterio que el resto: RLS activo, privilegios revocados a
los roles públicos y una política solo para `api_teatro`. Las rutas llevan su
propio límite de peticiones, `RATE_LIMIT_RECUPERACION_MAX`, porque un código de
ocho caracteres se puede adivinar a fuerza de intentos y el límite general de
100 por ventana es demasiado holgado para eso.

### Autorización: roles y permisos

El token dice quién es la persona y qué rol tiene. La autorización decide qué
puede hacer con él, y son **dos preguntas distintas**:

1. **¿Puede tu rol hacer esta operación?** La responde `autorizarRoles`.
2. **¿Puedes hacerla sobre este registro?** La responden las guardas de
   propiedad de `src/middlewares/propiedad.middleware.js`.

Pasar solo la primera es el agujero que la OWASP llama **BOLA**: un asistente
tiene permiso para leer boletas, pero no las de otra persona.

El orden de cada ruta protegida es siempre el mismo, y no es intercambiable:

```
autenticarJWT -> autorizarRoles -> validadores -> validar -> guarda de propiedad -> controller
```

`autenticarJWT` va primero porque es quien deja `req.usuario`: al revés, el
control de rol se ejecuta sin saber quién pregunta y devuelve 401 donde debía
devolver 403. Y la guarda de propiedad va después de `validar` porque lee el
cuerpo con `matchedData`, que solo tiene contenido cuando la validación corrió.

| Código | Significa |
| ------ | --------- |
| 401 | No sé quién eres. Falta el token, es inválido, está revocado, o la API Key es incorrecta |
| 403 | Sé quién eres y esto no te corresponde |

#### Quién puede hacer qué

Son 55 endpoints en 33 rutas: 41 exigen sesión, 3 solo la API Key y 11 son
públicas.

| Método | Ruta | Quién |
| ------ | ---- | ----- |
| GET | `/api/eventos`, `/api/localidades`, `/api/funciones` y sus consultas | **público** |
| POST, PUT, PATCH, DELETE | eventos, localidades y funciones | administrador |
| GET | `/api/asistentes`, `/api/asistentes/:id` | administrador, taquilla |
| POST | `/api/asistentes` | administrador, taquilla |
| PUT, PATCH, DELETE | `/api/asistentes/:id` | administrador |
| GET, POST, PATCH | `/api/asistentes/mio` | asistente |
| GET | `/api/boletas` | administrador |
| GET | `/api/boletas/mias` | asistente |
| GET | `/api/boletas/asistente/:asistenteId` | administrador, taquilla, asistente **si es el suyo** |
| GET | `/api/boletas/funcion/:funcionId` | administrador, taquilla |
| GET | `/api/boletas/:id` | administrador, taquilla, asistente **si es suya** |
| POST | `/api/boletas` | administrador, taquilla, asistente |
| PUT, PATCH | `/api/boletas/:id` | administrador, taquilla |
| PATCH | `/api/boletas/:id/estado` | administrador, taquilla, asistente **si es suya** |
| DELETE | `/api/boletas/:id` | administrador |
| POST | `/api/usuarios` | administrador |
| POST | `/api/auth/registro`, `/api/auth/login` | público |
| GET | `/api/auth/perfil` | cualquier sesión |

**La cartelera sigue pública** a propósito: un teatro publica su programación.
Pedir sesión para consultar un cartel no añadiría seguridad, solo estorbaría.

#### El asistente solo ve y toca lo suyo

Las tres guardas comparten una sola pieza, y es lo que de verdad cierra el
IDOR:

```js
const asistenteDelToken = (req) =>
  asistentesService.buscarAsistentePorUsuario(req.usuario.id);
```

El asistente propio se resuelve **desde `req.usuario.id`**, que lo puso
`autenticarJWT` al verificar la firma. Nunca desde el cuerpo, la dirección o
una cabecera: el id del token viene firmado por el servidor y cualquier otro id
lo escribe el cliente.

| Guarda | Ruta | Qué decide |
| ------ | ---- | ---------- |
| `autorizarAsistentePropio` | `GET /api/boletas/asistente/:asistenteId` | El asistente solo si el id es el suyo |
| `autorizarAccesoBoleta` | `GET /api/boletas/:id` | El asistente solo si la boleta es suya |
| `autorizarCambioEstadoBoleta` | `PATCH /api/boletas/:id/estado` | Igual, y limita al dueño a `pagada` y `cancelada` |

Además, **`POST /api/boletas` ignora el `asistenteId` del cuerpo cuando compra
un asistente**: la boleta sale a nombre del asistente de su cuenta. Sin esto,
cambiar un número bastaría para emitir una boleta a nombre de otra persona y
gastarle su límite de seis. La taquilla y la administración sí lo indican,
porque venden para quien tienen delante.

Un asistente pidiendo un `asistenteId` que no existe recibe **403, no 404**. Si
el código dependiera de que el id existiera, la diferencia entre las dos
respuestas diría cuántos asistentes hay registrados.

#### Estados de una boleta, por rol

| Estado | Quién lo puede pedir |
| ------ | -------------------- |
| `pagada` | el dueño, taquilla, administrador |
| `cancelada` | el dueño, taquilla, administrador |
| `usada` | taquilla, administrador |

Pagar y cancelar son del dueño: el pago lo hace quien compra y la cancelación
es un derecho de quien compró. Marcar `usada` no, porque eso ocurre cuando el
público entra a la sala y lo hace quien revisa en la puerta.

**El permiso no deroga la máquina de estados.** Que la taquilla pueda pedir
`usada` no significa que pueda: sigue haciendo falta que la función esté
`en_curso`, y si no lo está recibe 409, no 403. Son dos controles distintos y
se distinguen en el código de respuesta.

### El administrador inicial

Crear administradores es una operación administrativa, y las operaciones
administrativas exigen un administrador. Con la base de datos vacía no hay
ninguno. El registro público no sirve, porque fuerza el rol `asistente`, y
abrirle una excepción —"si no hay usuarios, el primero es administrador"—
sería regalar el sistema a quien llegue primero.

Se rompe **sembrando** el primer administrador desde el entorno. Las variables
van en el `.env`:

| Variable | Para qué |
| -------- | -------- |
| `ADMIN_NOMBRE` | Nombre de la cuenta sembrada |
| `ADMIN_EMAIL` | Correo con el que entra |
| `ADMIN_PASSWORD` | Su contraseña |

`crearAdministradorInicial()` corre **antes** de `app.listen`. Si la cuenta ya
existe la devuelve sin tocarla, así que reiniciar no duplica nada ni reescribe
la contraseña. Si faltan las variables, avisa y el servidor arranca igual.

La contraseña **vive solo en el `.env`**, que está en `.gitignore`. En
`.env.example` va el marcador `REEMPLAZAR_CON_PASSWORD_SEGURO`. Y **no se
imprime**: el log dice `Administrador inicial creado` y nada más. Un registro
con la contraseña del administrador es tan grave como escribirla en el código,
porque los registros se copian, se comparten para pedir ayuda y se suben a
sistemas de monitoreo.

### Gestión de usuarios · `POST /api/usuarios`

Reservada al rol **administrador**. Es el único camino por el que se otorgan
los roles `taquilla` y `administrador`: el registro público crea siempre
asistentes.

```json
{
  "nombre": "Taquilla Teatro",
  "email": "taquilla@teatro.com",
  "password": "ClaveSegura2026!",
  "rol": "taquilla"
}
```

| Situación | Código | Mensaje |
| --------- | ------ | ------- |
| Usuario creado | 201 | Usuario creado correctamente |
| Rol fuera de la lista blanca | 400 | Datos de entrada inválidos |
| Sin token, o token inválido | 401 | Token de autenticación requerido |
| El rol no es administrador | 403 | No tiene permisos para realizar esta operación |
| El correo ya está registrado | 409 | Ya existe un usuario con ese correo electrónico |

El `rol` llega en el cuerpo pero pasa por una **lista blanca de dos valores**,
`["taquilla", "administrador"]`. Cualquier otro es 400, incluidos `asistente`
—que se obtiene registrándose— y `superadmin`, que no existe.

`crearUsuarioAdministrativo()` va **aparte** de `crearUsuario()`, y no es la
misma función con el rol opcional. Si lo fuera, el día que alguien la llamara
desde una ruta nueva sin limpiar el cuerpo, el rol del cliente entraría: un
olvido se convertiría en una escalada de privilegios. Separadas, el registro
público **no tiene** forma de asignar un rol.

`id`, `activo` y `passwordHash` no se declaran en el validador, así que
`matchedData` los descarta, y el service arma el usuario campo por campo.

### El `usuarioId` solo lo asigna el administrador

El vínculo entre una cuenta y un asistente es el campo `usuarioId`. Lo puede
enviar **solo el administrador**, en `POST /api/asistentes`, `PUT` y `PATCH`.

| Situación | Código |
| --------- | ------ |
| Un rol distinto de administrador lo envía | 403 |
| El usuario no existe | 400 |
| La cuenta no tiene el rol `asistente` | 409 |
| La cuenta ya está asociada a otro asistente | 409 |

**El 403 va antes del 400 y del 409.** Si se comprobara primero si el usuario
existe, la taquilla podría enumerar ids probándolos uno por uno: el 400 ("no
existe") y el 409 ("ya está asociado") son respuestas distintas entre sí, y
esa diferencia ya es información. Primero se decide si el rol puede preguntar.

Y el campo **da 403 en vez de ignorarse en silencio**, al contrario que el
`rol` del registro. No es una contradicción: el `rol` no es parte del contrato
del registro y no se declara, mientras que el `usuarioId` **sí** es un campo
legítimo para el administrador. Descartarlo callando devolvería 201 mintiendo,
diciendo "asistente creado correctamente" sin haber hecho el vínculo que se
pidió. La regla: un campo que nadie puede fijar no se declara; un campo que
solo algunos pueden fijar se declara y se controla por rol.

`PATCH /api/asistentes/mio` deja que un asistente edite su propio perfil **sin
id en la dirección**: la identidad sale del token, así que no hay ningún número
que cambiar para editar a otra persona. Por esa ruta el `usuarioId` también da
403, porque enviarlo sería intentar ligarse a otra cuenta.

## Persistencia · PostgreSQL en Supabase

Hasta el bloque 7 los datos vivían en arreglos de `src/data/`, así que reiniciar
Node devolvía todo a la semilla. Hoy viven en **once tablas** normalizadas de
PostgreSQL: `roles`, `usuarios`, `asistentes`, `eventos`, `localidades`,
`funciones`, `funcion_tarifas`, `funcion_descuentos`, `boletas`,
`password_reset_tokens` y `codigos_recuperacion`. El contrato de la API no
cambió al migrar, y el frontend no necesitó un solo ajuste.

**Sin ORM.** Los services escriben SQL y son los únicos que consultan la base,
siempre con consultas parametrizadas y a través del pool de
[`src/config/database.js`](src/config/database.js). Los identificadores los
genera la base con `GENERATED ALWAYS AS IDENTITY`, no el código.

**TLS verificado.** El pool conecta con `rejectUnauthorized: true` contra el
certificado de `certs/`, que no se versiona. Verificar el certificado es lo que
distingue cifrar de cifrar *con quien se cree*: sin esa comprobación, un
intermediario puede presentar el suyo.

**Dos credenciales, y la diferencia importa.**

| Variable | Rol | Para qué |
| -------- | --- | -------- |
| `DATABASE_URL` | `api_teatro` | La API. Sin superusuario, sin `BYPASSRLS` y sin poder crear ni borrar tablas |
| `DATABASE_URL_ADMIN` | el dueño de las tablas | Solo los scripts de esquema de [`database/`](database/) |

Conectándose como dueño de las tablas, PostgreSQL **ignora las políticas RLS**.
Por eso la API nunca usa `DATABASE_URL_ADMIN`: si lo hiciera, toda la capa de
RLS sería decorativa.

**Row Level Security** está activo en las once tablas, con once políticas que
nombran solo a `api_teatro`. Cualquier otro rol —`anon`, `authenticated`,
`service_role` o uno futuro— ve cero filas, no un error. Las dos vistas,
`v_programacion` y `v_boletas`, se crearon con `security_invoker = true`: sin
esa opción una vista consulta las tablas con los permisos de su dueño, que es
justo el atajo que RLS pretende cerrar.

**La base es la última línea de defensa.** Las reglas críticas no viven solo en
el código: `uq_funciones_sala` y `uq_boletas_butaca` son índices únicos
parciales que impiden programar dos funciones en la misma franja o vender dos
veces la misma butaca, incluso si dos peticiones simultáneas pasaran la
comprobación del service. `manejarError` traduce ese `23505` al 409 que le
corresponde.

**La salvaguarda de la huella.** `scripts/preparar-base.js --reiniciar` borra y
recrea el esquema, y una cadena de conexión no dice a qué proyecto pertenece:
basta pegar la equivocada en el `.env` para arrasar otra base. Ya pasó una vez.
Ahora el script compara una huella SHA-256 del host y del usuario con la
registrada en `database/huella-proyecto.json` **antes de abrir la conexión**, y
aborta con código 1 si no coinciden. Comprobarlo después del primer `DROP` no
serviría de nada.

Lo único que sigue en memoria es `src/data/apiKeys.js`: los clientes
registrados no se gestionan por la API.

## Frontend · La Sala

`frontend/` es la cara pública de la API: la taquilla que ve el espectador.
La sirve el mismo Express, así que no hay un segundo servidor ni un segundo
despliegue.

### Cómo arrancarla

No tiene arranque propio. Con el `.env` configurado:

```bash
npm start          # o npm run dev
```

y se abre <http://localhost:3000/sala>. `GET /` sigue devolviendo
`{"mensaje":"API Teatro funcionando"}`: la Sala vive en `/sala` justamente para
no ocupar la raíz de la API.

HTML, CSS y JavaScript con módulos ES, **sin framework y sin paso de
compilación**: no añade ninguna dependencia al proyecto ni ningún artefacto que
construir. Lo que está en `frontend/` es exactamente lo que llega al navegador.

### Las vistas

Una sola página con un enrutador por `hash`. Es deliberado: si cada pantalla
fuera un HTML aparte, cada salto recargaría el documento y borraría el token.

| Ruta | Qué es |
| ---- | ------ |
| `#/` | Cartelera: la próxima función en venta ocupa el primer viewport, debajo el programa por jornadas con filtros por tipo |
| `#/evento/:id` | Ficha del evento y todas sus funciones con su estado |
| `#/funcion/:id` | Cuadro de tarifas por cercanía al escenario y descuentos habilitados |
| `#/funcion/:id/butacas` | Plano de la sala, elección de butaca y compra |
| `#/boleta/:id` | El talón emitido, con el pago simulado |
| `#/mis-boletas` | Las boletas de la cuenta, con cancelar |
| `#/entrar` | Entrar, crear cuenta y, con sesión abierta, el perfil |

### Dirección de diseño

El teatro, no un panel de administración. Fondo granate de telón, oro y luz
cálida de escenario; un telón que se abre al entrar; las butacas dibujadas a
escala real de la sala (100 + 200 + 150); la boleta como un talón troquelado con
su colilla.

Tres tipografías con un trabajo cada una: **Archivo Black** para los carteles,
**Libre Franklin** para leer y **Courier Prime** para los datos (horas, precios,
códigos), que así quedan alineados en columna.

Las tres tipografías y las cinco fotografías están descargadas dentro de
`frontend/`, con su licencia OFL y los créditos en
[`frontend/CREDITOS-IMAGENES.md`](frontend/CREDITOS-IMAGENES.md). **No se pide
nada a ningún CDN**, que es lo que permite darle a la Sala una política de
contenido más estricta que la del resto del servidor.

El color nunca va solo: cada estado lleva su palabra, y en el plano la butaca
ocupada además cambia de forma.

### La clave web se retiró, y por qué

Durante varios bloques `GET /sala/config.js` entregaba al navegador la clave
del cliente «Aplicación Web», leída del `.env` en cada petición. Nunca estuvo
escrita en el repositorio, pero eso no la volvía secreta: el navegador tenía
que mandarla en cada llamada, así que cualquiera la veía en el inspector.

El bloque 11 deshizo esa contradicción. La Sala ya no envía ninguna clave:
navega el catálogo sin credenciales —no hay nada privado en él— y todo lo
demás va con el JWT de quien inició sesión. `config.js` devuelve solo la ruta
base:

```js
window.TEATRO_CONFIG = {"api":"/api"};
```

Y el cliente 4 quedó **desactivado** en `src/data/apiKeys.js`. No es que
estorbe: es que esa clave estuvo a la vista durante meses y hay que darla por
conocida. Una clave quemada no se guarda por si acaso, se retira. Si algún día
hace falta un cliente web con sesión propia, se registra uno nuevo con otra
clave; esta no se reactiva.

Comprobado: con esa clave, `GET /api/seguridad/cliente` y las dos rutas de
restablecimiento responden **403 «API Key deshabilitada»**, mientras un cliente
activo sigue entrando con 200.

### La sesión vive en memoria

La sesión del usuario vive **solo en memoria**: el JWT no se guarda en
`localStorage` ni en `sessionStorage`, así que recargar la página cierra la
sesión. Es deliberado: lo que se guarda en el navegador sobrevive a la pestaña y
queda expuesto a cualquier script de la página.

Cuando esto pasa, la Sala lo dice en lugar de dejar al usuario a oscuras: si
hubo sesión en la pestaña, tras recargar aparece el aviso *"Por seguridad, la
sesión no se guarda al recargar la página. Vuelve a entrar."*, con un botón que
lleva a entrar y devuelve a la pantalla donde estaba.

#### Lo único que la Sala guarda en el navegador

Dos marcas, las dos en **`sessionStorage`**, que es el almacenamiento que muere
al cerrar la pestaña. Ninguna de las dos guarda un dato de la persona:

| Clave | Valor | Para qué |
| ----- | ----- | -------- |
| `telon-abierto` | `"si"` | Que el telón se abra una sola vez por sesión y no en cada vista |
| `hubo-sesion` | `"si"` | Saber, tras una recarga, que hay que explicar por qué se cerró la sesión |

Son un sí o nada: no hay token, ni correo, ni documento, ni id. Se comprobó en
el navegador que, con una sesión abierta y una compra hecha, el almacenamiento
queda así:

```
sessionStorage  {"telon-abierto":"si","hubo-sesion":"si"}
localStorage    {}
cookies         (ninguna)
IndexedDB       (ninguna base)
```

Las dos lecturas y las dos escrituras van dentro de `try/catch`: en modo
privado el almacenamiento puede fallar y la Sala tiene que seguir funcionando.
Al cerrar sesión, `hubo-sesion` se borra.

### La compra y la minimización de datos

El plano de butacas necesita saber qué asientos están tomados, y nada más. Por
eso se añadió `GET /api/funciones/:id/ocupacion`, que devuelve solo
`[{ localidadId, fila, numero }]` de las boletas no canceladas.

La alternativa era `GET /api/boletas/funcion/:id`, que ya existía, pero devuelve
las boletas completas: el `codigo` y el `asistenteId` de cada comprador
quedarían a la vista de cualquiera que abriera las herramientas del navegador.
Es **minimización de datos**: el endpoint entrega lo mínimo que el plano
necesita para funcionar.

### El asistente se liga a la cuenta

Comprar exige haber entrado. Quién es la persona lo resuelve el servidor a
partir del JWT, no un dato escrito en un formulario:

| Endpoint | Qué hace |
| -------- | -------- |
| `GET /api/asistentes/mio` | Devuelve los datos de asistente de la cuenta del token, o 404 si todavía no tiene |
| `POST /api/asistentes/mio` | Los crea y los liga a esa cuenta. Solo hace falta la primera vez |
| `GET /api/boletas/mias` | Las boletas de esa cuenta, sin ningún id en la dirección |

El campo `usuarioId` **lo pone el servidor desde el token**: no está declarado
en ningún validador, así que `matchedData` lo descarta aunque el cliente lo
mande. Hay una prueba que lo comprueba enviando `usuarioId: 9999`.

Esto resuelve el problema que tenía la versión anterior. Antes, la Sala hacía
`POST /api/asistentes` con el documento escrito a mano: quien ya había comprado
recibía un 409 y se quedaba **sin poder comprar**, porque la única salida
habría sido descargar la lista de asistentes —que expondría documentos, correos
y teléfonos de todo el mundo— o preguntar *"¿existe el documento X?"*, que es un
oráculo para enumerar documentos. Con el vínculo a la cuenta no hay que
preguntar nada: la segunda compra no pide ni el documento.

Un documento sigue sin poder repetirse. Si alguien intenta reclamar uno que ya
está registrado a otra persona, la respuesta es 409 y su cuenta se queda sin
asistente.

La primera vez que una cuenta entra al plano, `GET /api/asistentes/mio` responde
**404 y eso es lo correcto**: el recurso todavía no existe. La Sala lo trata como
"aún no hay datos" y muestra el formulario. El navegador, en cambio, apunta todo
código distinto de 2xx en su consola, así que al abrir las herramientas se ve una
línea `404 (Not Found)` que **no es un fallo**. Se mantiene el 404 en lugar de
cambiarlo a 204 porque el 404 es el código que describe la situación y además
lleva un mensaje explicativo; silenciar la consola a costa de un código menos
preciso sería arreglar la herramienta, no el programa.

El asistente resuelto se guarda **solo en memoria**, igual que el token.

La ocupación **no se guarda en caché**: se pide al entrar al plano y otra vez
cuando la API responde 409 porque la butaca se ocupó en el intervalo. El resto
de las listas (cartelera, funciones, localidades y tarifas) sí se guardan
mientras dure la sesión, para no gastar el límite de 100 peticiones cada 15
minutos.

Al confirmar, la Sala envía únicamente `asistenteId`, `funcionId`,
`localidadId`, `fila`, `numero` y `tipoDescuento`. **Nunca manda `precio`,
`codigo` ni `estado`**: los pone el servidor. El panel de resumen rotula su
cifra como *"precio estimado"* precisamente porque el precio definitivo es el
que devuelve la API, y es ese el que se imprime en el talón.

El botón **"Pago simulado"** está rotulado como simulación y explicado en la
propia pantalla: no hay pasarela de pago ni se envían datos a ningún banco, solo
hace `PATCH /api/boletas/:id/estado` con `{ "estado": "pagada" }`.

### Nada se escribe como HTML

La Sala **no usa `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`
ni `eval`** en ninguna parte: una búsqueda sobre `frontend/` no devuelve ni una
coincidencia. Todo el texto que viene de la API —títulos, descripciones,
nombres, mensajes de error— entra con `textContent` o `createTextNode`, que no
interpretan marcado.

Tampoco se construye ninguna dirección con datos de la API: los `href` son rutas
internas con un id numérico y las fotografías salen de una lista fija por tipo de
evento.

Se comprobó con una carga real guardada en el evento 1, con caracteres que el
validador sí acepta porque no llevan `<` ni `>`:

```
titulo:      Bernarda " onmouseover="alert(1)
descripcion: &lt;img src=x onerror=alert(1)&gt; javascript:alert(2) ${alert(3)} ...
```

La API la guardó tal cual y la Sala la mostró **como texto**: cero nodos
inyectados, cero enlaces `javascript:`, cero diálogos, cero errores de consola.
El detalle está en
[`docs/seguridad/sast-semgrep-frontend.txt`](docs/seguridad/sast-semgrep-frontend.txt).

La defensa que cuenta no es el filtro de entrada que quita `<` y `>`, sino que
la salida nunca se trata como HTML: aunque un día entrara una carga completa por
otra vía, se vería como texto.

### La Sala tiene su propia política de contenido

El `helmet()` global deja `style-src 'self' https: 'unsafe-inline'`, que es su
valor por defecto. **Swagger UI lo necesita**: se comprobó que `/api-docs`
escribe 3 bloques `<style>` y 4 atributos `style`, así que quitarlo para todo el
servidor rompería la documentación navegable.

La Sala no escribe ninguno, así que `/sala` monta su propia
`helmet.contentSecurityPolicy` antes de servir nada, y esa cabecera reemplaza a
la global solo en esas peticiones:

| Directiva | Resto del servidor | `/sala` |
| --------- | ------------------ | ------- |
| `style-src` | `'self' https: 'unsafe-inline'` | **`'self'`** |
| `font-src` | `'self' https: data:` | **`'self'`** |
| `img-src` | `'self' data:` | **`'self'`** |
| `script-src` | `'self'` | `'self'` |
| `script-src-attr` | `'none'` | `'none'` |

Las tipografías y las fotografías están dentro del proyecto, así que `https:` y
`data:` no hacían falta. Comprobado en el navegador: la Sala carga sus 2 hojas
de estilo con 230 reglas, sus 4 tipografías y sus fotografías **sin una sola
violación de CSP**, y `/api-docs` sigue pintando sus 46 operaciones.

### El movimiento

Siete animaciones, todas con un motivo: el telón que se abre una vez por
sesión, la entrada escalonada de la cartelera, la butaca al pulsarla y el
anillo de luz al elegirla, el panel de resumen, el paso siguiente de la compra,
la boleta que entra desde abajo al emitirse y el sello que cambia de estado.

Las reglas que siguen todas:

- **Solo `transform` y `opacity`.** No se anima ninguna propiedad que obligue al
  navegador a recalcular la disposición de la página.
- **Las salidas duran dos tercios de las entradas** (`--entra: 240ms`,
  `--sale: 150ms`): esperar a que algo se vaya se siente lento.
- **El realce al pasar por encima vive dentro de `@media (hover: hover)`**, para
  que en una pantalla táctil no se quede pegado después del toque.
- **El teclado no anima nada**: el foco aparece de golpe.
- **Al filtrar la cartelera no entra nada**: la lista ya estaba en pantalla y
  verla aparecer con cada toque cansa. El escalonado es solo de la primera
  pintada y se corta en el sexto elemento.
- **La sección actual se marca** con `aria-current="page"` en la marquesina.
- **Los formularios con varios campos llevan un resumen de errores** al
  principio, con un enlace a cada campo que falla, que recibe el foco al enviar
  y no reemplaza al error que va bajo cada campo.
- **No se pide dos veces lo mismo**: el nombre y el correo de la cuenta vienen
  puestos en el formulario del asistente.
- **`prefers-reduced-motion: reduce` quita el desplazamiento y deja el
  fundido.** Se comprobó en el navegador con la preferencia activada: el telón
  pasa a un fundido, y la butaca, el anillo y el panel se quedan en
  `transform: none` sin perder la transición de opacidad.

Medido en el navegador: la Sala queda lista en **268 ms** con 63 kB y dos
peticiones a la API; elegir una butaca cuesta **0,34 ms de media y 0,8 ms en el
peor caso**, con los fotogramas en 16,5 ms de media, así que el plano de 450
butacas no se traba; y pintar el plano entero toma unos **33 ms**.

### Limitaciones de la Sala

| Limitación | Qué significa |
| ---------- | ------------- |
| **IDOR en las rutas antiguas** | `GET /api/boletas/asistente/:id` y `PATCH /api/boletas/:id/estado` no comprueban de quién es la boleta. La Sala ya no las usa —pide `GET /api/boletas/mias`, que resuelve el asistente desde el token—, pero siguen publicadas para la taquilla y para las pruebas de los laboratorios anteriores. Se cierra en el laboratorio de autorización |
| **El pago es simulado** | No hay pasarela ni cobro. El botón solo cambia el estado a `pagada`, y lo dice en pantalla |
| **La sesión se pierde al recargar** | Es el precio de no guardar el token en el navegador. La Sala lo explica con un aviso y devuelve a la pantalla donde se estaba |
| **La API Key viaja al navegador** | Identifica a la aplicación, no la protege. Evitarlo exigiría un proxy en el servidor |


**Mejora futura: la cookie `httpOnly`.** Hoy el token vive en una variable de
JavaScript. Lo correcto en producción sería que el servidor lo entregara en una
cookie `httpOnly; Secure; SameSite=Strict`, que el navegador manda sola y que
**ningún script de la página puede leer**, ni siquiera uno inyectado. Eso
cerraría del todo el robo de token por XSS y además sobreviviría a la recarga,
que es la molestia que hoy tiene la Sala. Exige HTTPS y añadir protección
anti-CSRF, porque una cookie se envía también en peticiones de otros sitios; por
eso queda fuera del alcance de esta entrega.

## Qué credencial pide cada ruta

Tres capas, y cada una por un motivo distinto.

| Capa | Rutas | Por qué |
| ---- | ----- | ------- |
| **Público** | `POST /api/auth/login`, `POST /api/auth/registro` y las nueve lecturas del catálogo | No contienen un solo dato personal, y quien entra o se registra todavía no tiene credenciales |
| **Solo JWT** | `/api/auth/perfil`, `/cambiar-password`, `/recuperacion/{id}`, `/codigos-recuperacion*`, y todo lo de asistentes, boletas, usuarios y las escrituras del catálogo | Lo que es de alguien necesita saber quién pregunta |
| **Solo API Key** | `/api/seguridad/cliente`, `/api/auth/restablecer-password`, `/api/auth/restablecer-con-codigo` | Integraciones sin sesión que no corren en un navegador |

Las nueve lecturas públicas son `GET` de `/api/eventos`, `/api/funciones` y
`/api/localidades`, con sus variantes por id, más las tarifas y la ocupación de
una función. Es la cartelera del teatro: títulos, fechas, horas, precios y qué
butacas quedan libres. Lo mismo que cualquier taquilla enseña en la calle.

Con tres límites, que no son adorno:

- **La ocupación no dice de quién es cada butaca.** Devuelve `localidadId`,
  `fila` y `numero`, y nada más: ni el asistente, ni la boleta, ni su código.
- **Lo inactivo no se anuncia.** Un evento desactivado no sale en la lista y
  responde 404 por id; una función solo aparece en `en_venta`, `agotada` o
  `en_curso`. Al mostrador se le enseña todo, porque lo administra.
- **Las escrituras siguen exigiendo JWT de administrador**, sin excepción.

Lo decide `sesionOpcional`, un middleware que reconoce el token si viene y
nunca responde 401. En una ruta pública un token caducado no es un error: se
ignora y la petición sigue como anónima.

Queda pendiente decidir qué hacer con `/restablecer-password` y
`/restablecer-con-codigo` cuando exista una interfaz de página única. Hoy piden
API Key porque quien las usa perdió el acceso y no tiene JWT, y nadie las llama
desde el navegador. Abrirlas ahora sería aflojar una puerta sin motivo.

## Instalación y ejecución

Requisitos: Node.js 18 o superior (probado en 24.15.0) y npm.

```bash
npm install
cp .env.example .env

node scripts/preparar-base.js --reiniciar   # esquema, RLS, semilla y vistas
npm run seed:admin                          # crea el primer administrador

npm run dev     # desarrollo (nodemon)
npm start       # producción
```

Los comandos se ejecutan desde la raíz del proyecto. El servidor queda en
`http://localhost:3000`.

**`npm start` y `npm run dev` no crean ninguna cuenta.** El primer administrador
se crea solo con `npm run seed:admin`, un paso explícito que se ejecuta una vez
al instalar. Montar el servicio y entregar la primera llave maestra son dos
operaciones distintas, y la segunda no debe repetirse en cada despliegue.

El bootstrap es idempotente: si ya existe cualquier cuenta con rol
`administrador`, no inserta ni modifica nada. Tampoco convierte en administradora
una cuenta de otro rol, aunque se le pase su correo. El detalle está en
[`docs/seguridad/informe-bloque8.md`](docs/seguridad/informe-bloque8.md).

| Variable | Por defecto | Uso |
| -------- | ----------- | --- |
| `PORT` | `3000` | Puerto |
| `ALLOWED_ORIGIN` | `http://localhost:3000` | Orígenes permitidos por CORS, separados por comas |
| `RATE_LIMIT_MAX` | `100` | Peticiones por ventana de 15 min en todo `/api` |
| `RATE_LIMIT_ACCESO_MAX` | `10` | Intentos de login y registro por ventana |
| `RATE_LIMIT_RECUPERACION_MAX` | `10` | Intentos en las rutas de recuperación |
| `API_KEY_POSTMAN` | sin valor | Clave del cliente Postman Laboratorio |
| `API_KEY_TAQUILLA` | sin valor | Clave del cliente Taquilla del Teatro |
| `API_KEY_WEB` | sin valor | Clave del cliente Aplicación Web, **desactivado** desde el bloque 11 |
| `API_KEY_MOVIL` | sin valor | Clave del cliente Aplicación Móvil (deshabilitado) |
| `JWT_SECRET` | sin valor | Clave con la que se firman y verifican los JWT |
| `JWT_EXPIRES_IN` | `1h` | Cuánto dura un token |
| `ADMIN_NOMBRE` | sin valor | Nombre del primer administrador. **Solo lo usa `seed:admin`** |
| `ADMIN_EMAIL` | sin valor | Su correo |
| `ADMIN_PASSWORD` | sin valor | Su contraseña, de 12 caracteres o más. **Solo vive aquí y nunca se imprime** |
| `DATABASE_URL` | sin valor | Conexión de la API: rol `api_teatro`, solo datos |
| `DATABASE_URL_ADMIN` | sin valor | Conexión del dueño, solo para crear o reiniciar la base |
| `DATABASE_URL_PRUEBAS_ADMIN` | sin valor | Opcional. Proyecto **aparte** para las pruebas BA08 y BA09 |

`.env` está en `.gitignore`; `.env.example` es la plantilla y nunca lleva las
claves reales: solo trae marcadores. **Cada integrante genera su propio
`JWT_SECRET` en su `.env`**, igual que sus API Keys y la contraseña del
administrador. Las tres API Keys son obligatorias: sin ellas el servidor no
arranca.

En `.env.example` las tres variables del administrador van con marcador, el
correo incluido:

```
ADMIN_NOMBRE=REEMPLAZAR_CON_EL_NOMBRE_DEL_ADMINISTRADOR
ADMIN_EMAIL=REEMPLAZAR_CON_UN_CORREO_REAL_Y_NO_PUBLICADO
ADMIN_PASSWORD=REEMPLAZAR_CON_PASSWORD_SEGURO_DE_12_O_MAS
```

El correo lleva marcador por el mismo motivo que la contraseña: es la mitad de
unas credenciales. Un ejemplo que parece utilizable acaba copiado tal cual, y
entonces la dirección del administrador queda publicada en el repositorio.

Genera cada API Key con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Y el `JWT_SECRET`, más largo, con:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

La contraseña del administrador se escribe a mano en el `.env` y no se comparte
por ningún otro canal. Al arrancar, el servidor imprime `Administrador inicial
creado` la primera vez y nada más: ni el correo ni la contraseña aparecen en el
log.

Para probar desde Swagger UI hay que pulsar **Authorize**, arriba a la derecha,
y pegar una de las claves activas. Sin ese paso todos los endpoints responden
401. En ese mismo diálogo se pega el token del login para las rutas que además
piden `BearerAuth`.

## Estructura

```
API_TEATRO/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── certs/                       # certificado TLS de Supabase (no se versiona)
├── database/                    # esquema SQL, roles, semilla y verificación
├── scripts/                     # preparar-base.js, probar-conexion.js y comprobar-proyecto.js
├── docs/entregas/                # informes de entrega en PDF
├── docs/seguridad/               # salidas de las herramientas e informes por laboratorio
├── frontend/                     # la Sala, servida en /sala
│   ├── index.html
│   ├── favicon.svg
│   ├── CREDITOS-IMAGENES.md
│   ├── css/
│   │   ├── tokens.css            # tipografías, color, ritmo y curvas
│   │   └── sala.css
│   ├── fuentes/                  # woff2 locales con su licencia OFL
│   ├── imagenes/                 # fotografías en WebP, dos anchos cada una
│   └── js/
│       ├── api.js                # cliente de la API y sesión en memoria
│       ├── formato.js            # piezas compartidas por las vistas
│       ├── sala.js               # enrutado por hash
│       └── vistas/
│           ├── cartelera.js
│           ├── evento.js
│           ├── funcion.js
│           ├── butacas.js        # plano de sala y compra
│           ├── boleta.js         # talón emitido y pago simulado
│           ├── misboletas.js
│           └── entrar.js
├── pruebas/                      # scripts de prueba contra el servidor
│   ├── correr.sh                 # lanza las doce baterías y suma el total
│   ├── pruebas.js
│   ├── pruebas-funciones.js
│   ├── pruebas-boletas.js
│   ├── pruebas-limites.js
│   ├── pruebas-cuenta.js
│   ├── pruebas-autorizacion.js
│   ├── pruebas-recuperacion.js
│   ├── pruebas-bloque11.js
│   ├── pruebas-acceso.js         # los tres límites de peticiones
│   ├── sesion.js                 # API Key y token del administrador
│   ├── verificar-a.js
│   ├── verificar-b.js
│   └── verificar-c.js
└── src/
    ├── app.js
    ├── config/
    │   └── database.js           # pool de PostgreSQL con TLS
    ├── controllers/
    │   ├── asistentes.controller.js
    │   ├── auth.controller.js
    │   ├── boletas.controller.js
    │   ├── eventos.controller.js
    │   ├── funciones.controller.js
    │   ├── localidades.controller.js
    │   └── usuarios.controller.js
    ├── data/
    │   └── apiKeys.js            # lo único que no vive en PostgreSQL
    ├── docs/
    │   └── swagger.js
    ├── middlewares/
    │   ├── apiKey.middleware.js
    │   ├── asistentes.validator.js
    │   ├── auth.middleware.js
    │   ├── auth.validator.js
    │   ├── boletas.validator.js
    │   ├── errores.middleware.js
    │   ├── eventos.validator.js
    │   ├── funciones.validator.js
    │   ├── localidades.validator.js
    │   ├── propiedad.middleware.js   # guardas de propiedad (IDOR/BOLA)
    │   ├── publico.middleware.js     # sesión opcional y filtros del catálogo
    │   ├── roles.middleware.js       # autorizarRoles
    │   ├── usuarios.validator.js
    │   └── validar.middleware.js
    ├── routes/
    │   ├── asistentes.routes.js
    │   ├── auth.routes.js
    │   ├── boletas.routes.js
    │   ├── eventos.routes.js
    │   ├── funciones.routes.js
    │   ├── localidades.routes.js
    │   ├── seguridad.routes.js
    │   └── usuarios.routes.js
    ├── services/
    │   ├── apiKeys.service.js
    │   ├── asistentes.service.js
    │   ├── boletas.service.js
    │   ├── codigosRecuperacion.service.js
    │   ├── eventos.service.js
    │   ├── funciones.service.js
    │   ├── localidades.service.js
    │   ├── recuperacion.service.js
    │   └── usuarios.service.js
    └── utils/
        ├── crypto.util.js            # SHA-256 para las API Keys
        ├── jwt.util.js               # firma y verificación de los JWT
        └── password.util.js          # bcrypt para las contraseñas
```

Flujo: `routes → validadores → controllers → services → base de datos`. Los
controllers no acceden a los datos: los services son los únicos que consultan
PostgreSQL, siempre con consultas parametrizadas y a través del pool de
[`src/config/database.js`](src/config/database.js). La excepción es
`apiKeys.service.js`, que sigue leyendo `src/data/apiKeys.js` porque los
clientes registrados no se gestionan por la API.

## Endpoints

55 endpoints en 33 rutas, con 37 schemas. El reparto que declara Swagger: **41**
exigen el JWT, **3** la API Key y **11** no piden credenciales. Hasta el bloque
11 los endpoints con sesión llevaban `ApiKeyAuth` y `BearerAuth` en el mismo
objeto, porque hacían falta las dos a la vez; ahora cada uno declara solo lo que
de verdad exige. Swagger UI:
<http://localhost:3000/api-docs> · OpenAPI:
<http://localhost:3000/openapi.json>

La columna **Quién** repite la tabla de
[Autorización: roles y permisos](#autorización-roles-y-permisos).

**Generales**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/` | Estado de la API |
| GET | `/api-docs` | Swagger UI |
| GET | `/openapi.json` | Definición OpenAPI 3.0.3 |

**Asistentes**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/asistentes` | Lista los asistentes |
| GET | `/api/asistentes/mio` | Datos de asistente de la cuenta del token |
| POST | `/api/asistentes/mio` | Los crea y los liga a esa cuenta |
| PATCH | `/api/asistentes/mio` | El asistente edita su propio perfil, sin id en la dirección |
| GET | `/api/asistentes/:id` | Obtiene un asistente |
| POST | `/api/asistentes` | Crea un asistente |
| PUT | `/api/asistentes/:id` | Reemplaza un asistente |
| PATCH | `/api/asistentes/:id` | Actualiza parcialmente un asistente |
| DELETE | `/api/asistentes/:id` | Elimina un asistente |

**Eventos**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/eventos` | Lista los eventos |
| GET | `/api/eventos/:id` | Obtiene un evento |
| POST | `/api/eventos` | Crea un evento activo |
| PUT | `/api/eventos/:id` | Reemplaza un evento, conserva `activo` |
| PATCH | `/api/eventos/:id` | Actualiza parcialmente un evento |
| PATCH | `/api/eventos/:id/estado` | Activa o desactiva un evento |
| DELETE | `/api/eventos/:id` | Elimina un evento |

**Localidades**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/localidades` | Lista las localidades |
| GET | `/api/localidades/:id` | Obtiene una localidad |
| POST | `/api/localidades` | Crea una localidad y calcula su capacidad |
| PUT | `/api/localidades/:id` | Reemplaza una localidad y recalcula su capacidad |
| PATCH | `/api/localidades/:id` | Actualiza parcialmente una localidad |
| PATCH | `/api/localidades/:id/estado` | Activa o desactiva una localidad |
| DELETE | `/api/localidades/:id` | Elimina una localidad |

**Funciones**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/funciones` | Lista las funciones |
| GET | `/api/funciones/evento/:eventoId` | Funciones de un evento |
| GET | `/api/funciones/:id` | Obtiene una función |
| GET | `/api/funciones/:id/tarifas` | Tarifas ordenadas por cercanía y descuentos habilitados |
| GET | `/api/funciones/:id/ocupacion` | Butacas tomadas, solo `localidadId`, `fila` y `numero` |
| POST | `/api/funciones` | Crea una función en estado `programada` |
| PUT | `/api/funciones/:id` | Reemplaza una función, conserva el estado |
| PATCH | `/api/funciones/:id` | Actualiza parcialmente una función |
| PATCH | `/api/funciones/:id/estado` | Cambia el estado de una función |
| DELETE | `/api/funciones/:id` | Elimina una función sin boletas vendidas |

**Boletas**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/boletas` | Lista las boletas |
| GET | `/api/boletas/mias` | Boletas de la cuenta del token |
| GET | `/api/boletas/asistente/:asistenteId` | Boletas de un asistente |
| GET | `/api/boletas/funcion/:funcionId` | Boletas de una función |
| GET | `/api/boletas/:id` | Obtiene una boleta |
| POST | `/api/boletas` | Vende una boleta; el servidor calcula precio y código |
| PUT | `/api/boletas/:id` | Reemplaza una boleta reservada y recalcula el precio |
| PATCH | `/api/boletas/:id` | Actualiza parcialmente una boleta reservada |
| PATCH | `/api/boletas/:id/estado` | Cambia el estado de una boleta |
| DELETE | `/api/boletas/:id` | Elimina una boleta reservada o cancelada |

**Seguridad**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| GET | `/api/seguridad/cliente` | Devuelve el cliente dueño de la API Key enviada |

**Usuarios**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| POST | `/api/usuarios` | Crea una cuenta de `taquilla` o de `administrador`. Solo el administrador |

**Autenticación**

| Método | Ruta | Descripción |
| ------ | ---- | ----------- |
| POST | `/api/auth/registro` | Registra un usuario como `asistente`; la contraseña se guarda con bcrypt |
| POST | `/api/auth/login` | Comprueba email y contraseña y devuelve un JWT |
| GET | `/api/auth/perfil` | Devuelve el usuario del JWT y, si llegó clave, su cliente |
| PATCH | `/api/auth/cambiar-password` | Cambia la propia contraseña y revoca las sesiones anteriores |
| POST | `/api/auth/recuperacion/:usuarioId` | El administrador emite un token de 15 minutos para una cuenta |
| POST | `/api/auth/restablecer-password` | Canjea ese token por una contraseña nueva, una sola vez |
| POST | `/api/auth/codigos-recuperacion` | Genera ocho códigos de un solo uso; se muestran una única vez |
| GET | `/api/auth/codigos-recuperacion/estado` | Cuántos códigos quedan, sin revelarlos |
| POST | `/api/auth/codigos-recuperacion/regenerar` | Lote nuevo; invalida el anterior por completo |
| POST | `/api/auth/restablecer-con-codigo` | Canjea un código de respaldo por una contraseña nueva |

## Análisis de seguridad

Las capturas de cada prueba están en los informes PDF de
[`docs/entregas/`](docs/entregas/). En [`docs/seguridad/`](docs/seguridad/) están
las salidas de las herramientas, una por laboratorio, y el informe escrito de
cada bloque:

| Informe | Tema |
| ------- | ---- |
| [`informe-lab5.md`](docs/seguridad/informe-lab5.md) | Integridad referencial y API Key |
| [`informe-lab6.md`](docs/seguridad/informe-lab6.md) | Múltiples clientes con API Keys como hash |
| [`informe-lab7.md`](docs/seguridad/informe-lab7.md) | Usuarios, hashing y salting con bcrypt |
| [`informe-lab8.md`](docs/seguridad/informe-lab8.md) | Control del rol y escalada de privilegios |
| [`informe-lab9.md`](docs/seguridad/informe-lab9.md) | Autenticación con JWT |
| [`informe-frontend.md`](docs/seguridad/informe-frontend.md) | La Sala: XSS, minimización de datos y sesión en memoria |
| [`informe-lab10.md`](docs/seguridad/informe-lab10.md) | Autorización, RBAC e IDOR/BOLA |
| [`informe-bloque7.md`](docs/seguridad/informe-bloque7.md) | Supabase y PostgreSQL: persistencia, rol de privilegio mínimo y RLS |
| [`informe-bloque8.md`](docs/seguridad/informe-bloque8.md) | Validación integral: bootstrap separado y las 53 pruebas del laboratorio |
| [`informe-bloque11.md`](docs/seguridad/informe-bloque11.md) | Recuperación de acceso, versión de sesión y reparto de credenciales |

| Técnica | Herramienta | Alcance | Resultado |
| ------- | ----------- | ------- | --------- |
| SCA | `npm audit` | 159 paquetes | 0 vulnerabilidades |
| SAST | Semgrep 1.172.0 | 73 reglas, 43 archivos | 0 hallazgos |
| SAST manual | Revisión de código | `src/` completo | 2 hallazgos, corregidos |
| DAST | OWASP ZAP 2.17.0 | 39 URLs, Active Scan sobre `/api` | 2 alertas, ambas falsos positivos |
| SCA, cierre del frontend | `npm audit --omit=dev` | lo que se despliega | 0 vulnerabilidades |
| SAST, cierre del frontend | Semgrep con `p/javascript`, `p/nodejs`, `p/owasp-top-ten` y `p/xss` | 74 reglas, 61 archivos de `src/` y `frontend/` | 0 hallazgos |
| XSS manual | Carga guardada en un evento desde la API | Cartelera y ficha del evento | Se muestra como texto; 0 nodos inyectados |
| SCA, Lab 10 | `npm audit` | 159 paquetes, incluidas las de desarrollo | 3 altas, todas de `nodemon` |
| SCA, Lab 10 | `npm audit --omit=dev` | 136 paquetes, lo que se despliega | 0 vulnerabilidades |
| SAST, Lab 10 | Semgrep 1.179.0 con `p/javascript`, `p/nodejs` y `p/owasp-top-ten` | 74 reglas, 66 archivos de `src/` y `frontend/` | 0 hallazgos |
| IDOR manual | Asistente A y B con boletas propias | `/boletas/asistente/:id`, `/boletas/:id`, `/estado` | Ajenas 403; propias 200 |
| SCA, Bloque 8 | `npm audit` y `npm audit --omit=dev` | todas las dependencias | 0 vulnerabilidades |
| SAST, Bloque 8 | Semgrep con `p/javascript`, `p/nodejs` y `p/owasp-top-ten` | 76 reglas, 78 archivos de `src/`, `scripts/`, `frontend/` y `pruebas/` | 0 hallazgos |
| SCA, Bloque 11 | `npm audit` | todas las dependencias | 4 moderadas, todas en `glob` y `minimatch` |
| SCA, Bloque 11 | `npm audit --omit=dev` | lo que se despliega | 3 moderadas, por la misma vía |
| SAST, Bloque 11 | Semgrep con `p/javascript`, `p/nodejs` y `p/owasp-top-ten` | 76 reglas, 85 archivos | 0 hallazgos |

**SCA.** Sin vulnerabilidades. `npm audit fix` no modificó el
`package-lock.json`. Aviso de obsolescencia, sin vulnerabilidad asociada, en
`glob@11.1.0` (dependencia transitiva de `swagger-jsdoc`).

**SCA en el Lab 10: tres vulnerabilidades altas, y por qué no se arreglan.**
Son nuevas, y hasta este laboratorio siempre reportamos cero. No vienen del
código ni de ninguna dependencia de la API: vienen de `braces`, que entra por
`chokidar`, que entra por `nodemon`, la única dependencia de desarrollo. Es una
denegación de servicio por agotamiento de pila con patrones muy anidados. Con
`--omit=dev`, que es lo que corre en producción, el resultado es **0 sobre 136
paquetes**. No se arregla porque el arreglo es peor: `npm audit fix --force`
instala `nodemon@1.14.10`, de 2018, con sus propios problemas. Preferimos dejar
constancia del hallazgo, acotado a desarrollo, antes que empeorar el proyecto
para que una tabla diga cero.

**SCA en el Bloque 11: cuatro moderadas, y por qué tampoco se arreglan.** Están
en `glob` y en `minimatch`, que entran por `swagger-jsdoc` y por `nodemon`. El
bloque 11 no añadió ninguna dependencia: todo lo nuevo usa `crypto` de Node, `pg`
y `express-rate-limit`, que ya estaban. No se arreglan por dos razones. La
primera es que la única corrección que ofrece npm es **degradar** `swagger-jsdoc`
de 6.3.0 a 6.2.8, una versión anterior, cambiando un aviso por el riesgo real de
romper el spec. La segunda es que ninguna es alcanzable desde una petición: los
dos paquetes resuelven patrones de rutas de archivos, y el único patrón del
proyecto es la constante `apis: ["./src/routes/*.js"]`, evaluada una vez al
arrancar. Si algún día un patrón saliera de la entrada del usuario, la
valoración cambiaría.

**Nota de ejecución de Semgrep.** En el equipo de desarrollo, Smart App Control
de Windows bloquea `semgrep-core.exe` (evento 3077 de CodeIntegrity). El
escaneo del Lab 10 se hizo con la imagen oficial, que ejecuta el mismo análisis
en Linux, sin desactivar ninguna protección del equipo:

```bash
docker run --rm -v "$(pwd):/src" -w /src semgrep/semgrep \
  semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/ frontend/
```

**SAST.** Semgrep con `p/javascript`, `p/nodejs` y `p/owasp-top-ten`. La revisión
manual comprobó el uso de `req.body`, concatenaciones de entrada, secretos, fugas
en errores y endpoints sin validación. Un barrido de 419 peticiones hostiles no
produjo ningún 5xx ni fuga de stack trace.

**DAST.** Escaneo del 16/09/2026 importando `openapi.json`, con
`RATE_LIMIT_MAX=100000` solo durante el escaneo. 41 % de respuestas 2xx, 58 %
4xx y ningún 5xx. La regla DOM XSS no se ejecutó porque no aplica a una API que
devuelve JSON.

### Hallazgos

| ID | Hallazgo | Corrección | Verificación |
| -- | -------- | ---------- | ------------ |
| SEC-01 | Un cuerpo mayor de 10 kb devolvía 500 en vez de 413 | `manejarError` respeta el código 4xx de los errores de `express.json` (413, 400, 415) con mensaje fijo | 12 kb → 413; JSON mal formado → 400 |
| SAST-01 | `nombre`, `titulo` y `descripcion` aceptaban HTML | Validación `.matches(/^[^<>]*$/)` en los campos de texto libre | `<img src=x onerror=...>` → 400; nombres con tildes y apóstrofos → 201 |
| SAST-02 | Las peticiones rechazadas se registraban como `Error no controlado` | Errores 4xx con `console.warn` (código, método y ruta); 5xx con `console.error` | Barrido repetido: 0 errores, 45 avisos |
| DAST-01 | Path Traversal (High, confianza Low) en `PUT /api/eventos/{id}` | Falso positivo: la diferencia de respuesta viene de la validación; la API no accede al sistema de archivos | `../../../../etc/passwd` → 400 |
| DAST-02 | User Agent Fuzzer (Informational) en `POST /api/eventos` | Falso positivo: cada POST crea un id distinto | GET con 3 User-Agent → mismo cuerpo |

### Pruebas automatizadas

| Suite | Comprobaciones |
| ----- | -------------- |
| Asistentes, eventos y localidades | 57 |
| Funciones, incluida la ocupación del plano | 58 |
| Boletas | 55 |
| Límites de venta y regresión | 22 |
| Asistente ligado a la cuenta | 22 |
| Autorización, RBAC e IDOR/BOLA | 104 |
| Recuperación de acceso y códigos de respaldo | 44 |
| Versión de sesión y reparto de credenciales | 35 |
| Los tres límites de peticiones | 5 |
| Checklist de seguridad (35 casos) | 38 |
| **Total** | **440, 0 fallos** |

## Pruebas

Los scripts de `pruebas/` lanzan peticiones reales contra el servidor y
comparan el código de respuesta y el cuerpo con lo esperado. No usan ninguna
librería de test: son scripts de Node con `fetch`.

| Script | Qué cubre | Comprobaciones |
| ------ | --------- | -------------- |
| `pruebas.js` | CRUD de asistentes, eventos y localidades: validaciones, unicidad, estados y campos calculados | 57 |
| `pruebas-funciones.js` | Funciones: las ocho reglas de negocio, el cuadro de tarifas, la ocupación y la máquina de estados | 58 |
| `pruebas-boletas.js` | Boletas: precio y código calculados por el servidor, butaca única, descuentos y estados | 55 |
| `pruebas-limites.js` | Aforo, límite de 6 boletas por asistente y borrado protegido de funciones | 22 |
| `pruebas-cuenta.js` | Asistente ligado a la cuenta: token obligatorio, aislamiento entre cuentas, edición del perfil propio y Mass Assignment de `usuarioId` | 22 |
| `pruebas-autorizacion.js` | Autorización: los tres roles, el administrador inicial, la lista blanca del rol, el IDOR de boletas con dos asistentes y las 30 pruebas obligatorias del laboratorio | 104 |
| `pruebas-recuperacion.js` | Recuperación: token administrativo de un solo uso, caducidad, los ocho códigos de respaldo, el canje y la regeneración del lote | 44 |
| `pruebas-bloque11.js` | Versión de sesión, revocación al cambiar la contraseña y el reparto de credenciales: catálogo público, ocupación sin datos ajenos y escrituras cerradas | 35 |
| `pruebas-acceso.js` | Los tres límites de peticiones: `/api`, login y registro, y las rutas de recuperación | 5 |
| `verificar-a.js` | Casos 1 a 16 del checklist: validación de entrada y Mass Assignment | 16 |
| `verificar-b.js` | Casos 17 a 31: reglas de negocio e integridad | 16 |
| `verificar-c.js` | Casos 32 a 35: cuerpo grande, límite de peticiones, cabeceras y error interno sin stack | 6 |

### Cómo ejecutarlos

Con el `.env` configurado y el servidor en marcha en otra terminal:

```bash
npm run dev                    # terminal 1
node pruebas/pruebas.js        # terminal 2
```

Para la tanda completa hay un lanzador que reinicia la base, corre las doce
baterías en orden y suma el total. Comprueba la huella del proyecto antes de
borrar nada, y termina con código 1 si alguna prueba falla:

```bash
bash pruebas/correr.sh
```

`pruebas/sesion.js` centraliza la identidad: carga el `.env` con dotenv, envía
la cabecera `X-API-Key` en todas las peticiones y entra como el administrador
del `.env` cuando la batería necesita escribir. Ni la clave ni la contraseña
están escritas en el código de las pruebas.

Por eso las baterías necesitan `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el `.env`:
sin el administrador inicial no hay con qué crear un evento.

Dos avisos:

- Las pruebas crean y borran registros, y desde la migración a PostgreSQL esos
  cambios **sobreviven al reinicio del servidor**. Para partir siempre de los
  datos semilla hay que reiniciar la base antes de cada script:

```bash
node scripts/preparar-base.js --reiniciar
```

  Reiniciar Node ya no basta: ese era justamente el objetivo del bloque 7.
- Salvo `verificar-c.js` y `pruebas-acceso.js`, los scripts superan los límites
  por ventana y chocan con ellos. Se lanzan con los tres subidos:

```bash
RATE_LIMIT_MAX=100000 RATE_LIMIT_ACCESO_MAX=100000 \
RATE_LIMIT_RECUPERACION_MAX=100000 npm run dev
```

`verificar-c.js` y `pruebas-acceso.js` son la excepción: comprueban
precisamente que los límites salten, y necesitan los valores de servicio. Eso
es lo que hace `correr.sh`, que arranca el servidor con los valores que cada
batería necesita.

## Limitaciones conocidas

- Los clientes de la API Key son lo único que queda en memoria. Deshabilitar o
  añadir uno exige editar `src/data/apiKeys.js` y reiniciar; no hay endpoint
  para gestionarlos. El resto de los datos vive en PostgreSQL.
- Por el registro público no se puede crear un administrador, ni siquiera a
  propósito. El primero sale de `crearAdministradorInicial()`, que lo siembra
  desde el `.env` al arrancar; los demás, de `POST /api/usuarios`.
- `JWT_SECRET` se comprueba cuando se usa, no al arrancar. Si falta, el servidor
  arranca igual y falla al primer login, con un 500.
- Revocar una sesión exige cambiar la contraseña. Desde el bloque 11 eso
  invalida todos los tokens anteriores, y una cuenta desactivada deja de pasar
  en la siguiente petición, pero no hay un endpoint de «cerrar mis otras
  sesiones» que suba la versión sin tocar la contraseña.
- La revocación cuesta una consulta por petición autenticada, que es justo lo
  que un JWT prometía evitar. Se paga a propósito, y en una base con más carga
  sería el primer sitio donde mirar una caché corta.
- Las cuatro vulnerabilidades moderadas de `npm audit` están en `glob` y
  `minimatch`, por `swagger-jsdoc` y `nodemon`. Ninguna es alcanzable desde una
  petición, y el único arreglo que ofrece npm es degradar `swagger-jsdoc`.
- `POST /api/auth/restablecer-password` y `/restablecer-con-codigo` siguen
  pidiendo API Key. Quien las usa perdió el acceso y no tiene JWT, y hoy nadie
  las llama desde el navegador; cuando exista una interfaz de página única habrá
  que decidir qué credencial les corresponde.
- `GET /api/boletas/:id` responde 404 antes de mirar el rol, así que cualquier
  sesión puede distinguir una boleta inexistente de una ajena. Es la decisión
  de la guía del laboratorio y se mantuvo, pero lo coherente con el resto sería
  responder 403 también ahí, como ya se hace en
  `GET /api/boletas/asistente/:asistenteId`.
- La taquilla no puede cambiar el estado de una función. Pasar una a `en_curso`
  o a `finalizada` es trabajo de sala y no de programación, pero hoy exige un
  administrador. Hacerlo bien pide un control por transición, no por endpoint.
- No se puede quitar un vínculo `usuarioId`: se puede asignar y reasignar, pero
  no dejar un asistente sin cuenta, porque el `PUT` conserva el valor cuando no
  llega en lugar de borrarlo. Es deliberado: anular el vínculo por omisión
  convertiría cualquier edición de un nombre en una desvinculación silenciosa.
- Los asistentes de la semilla siguen con `usuarioId: null` y solo el
  administrador los puede asociar a una cuenta. Es deliberado: dejar que
  cualquiera reclame un documento ajeno sería justo el agujero que se quería
  evitar.
- No hay registro de auditoría. Un administrador puede crear usuarios y asociar
  cuentas, pero no queda constancia de quién lo hizo ni cuándo.
- Sin HTTPS: `Strict-Transport-Security` solo tiene efecto sobre TLS.
- Concurrencia: las comprobaciones de negocio y la escritura ocurren en dos
  consultas distintas, así que dos peticiones simultáneas podrían pasar ambas
  la comprobación. Quien impide el duplicado es la base: `uq_boletas_butaca` y
  `uq_funciones_sala` hacen que la segunda escritura falle en lugar de vender
  dos veces la misma butaca, y `manejarError` traduce ese `23505` al 409 que
  le corresponde. Sigue siendo una red y no una reserva: la butaca no se
  bloquea mientras el cliente decide.

## Documentación de entregas — Lab. No.5, No.6, No.7, No.8, No.9, No.10 y Bloques 7, 8 y 11

- [Pruebas SCA + SAST + DAST y levantamiento de la API](docs/entregas/LEVANTAMIENTO%20DE%20LA%20API%20MAS%20PRUEBAS.pdf)
- [Laboratorio 5: integridad referencial y API Keys](docs/entregas/Integridad%20referencial%20%2B%20API%20Keys.pdf)
- [Laboratorio 6: múltiples clientes y API Keys como hash](docs/entregas/M%C3%BAltiples%20clientes%20%2B%20API%20Keys%20almacenadas%20como%20hash.pdf)
- [Laboratorio 7: usuarios, hashing y salting](docs/entregas/Usuarios%20%2B%20Hashing%20%2B%20Salting%20%C2%B7%20API_TEATRO.pdf)
- [Laboratorio 8: control del rol y escalada de privilegios](docs/entregas/Control%20del%20rol%20y%20prevenci%C3%B3n%20de%20escalada%20de%20privilegios%20%C2%B7%20API_TEATRO.pdf)
- [Laboratorio 9: autenticación con JWT](docs/entregas/Autenticaci%C3%B3n%20con%20JWT%20-%20API_TEATRO.pdf)
- [Laboratorio 10: autorización segura, RBAC e IDOR/BOLA](docs/entregas/Autorizaci%C3%B3n%20Segura%20en%20APIs%20REST%20-%20API%20-%20TEATRO.pdf)
- [Bloque 7: Supabase, PostgreSQL y persistencia segura](docs/entregas/Bloque%207%20-%20Supabase%20y%20PostgreSQL%20-%20persistencia%20segura%20-%20API_TEATRO.pdf)
- [Bloque 8: bootstrap del administrador y validación integral](docs/entregas/BLOQUE%208%20-%20bootstrap%20validacion%20API_TEATRO.pdf)
- [Bloque 11: recuperación de acceso y reparto de credenciales](docs/entregas/Bloque11%20-%20Recuperacion%20-%20Credenciales%20-%20API_TEATRO.pdf)

## Integrantes

- Juan Sebastián Bonilla León
- Juan Camilo Calderón Delgado
- Silvana Sofia Siza Soriano
- Cristian Emanuel Hernández Araque
- Cristian Rodrigo Amaya Torres
