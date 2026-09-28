# Laboratorio 8 — Bloque 4B: control del rol y escalada de privilegios

## El problema

Al terminar el Lab 7 dejamos una puerta abierta y la anotamos como pendiente:
cualquiera con una API Key válida podía registrarse como administrador. Bastaba
con mandar el rol en el cuerpo de la petición.

```json
{
  "nombre": "Usuario Ataque",
  "email": "ataque@teatro.com",
  "password": "ClaveSegura2026!",
  "rol": "administrador"
}
```

Hoy el daño es cero, porque el rol todavía no da acceso a nada. Pero el bloque
siguiente va a hacer que el rol decida permisos, y ese día esta puerta pasa a
ser grave. La cerramos antes de que importe.

En el fallo colaboraban dos capas:

- **El validador** declaraba `body("rol").isIn(ROLES)`, así que el rol era un
  campo válido del contrato y `matchedData` lo dejaba pasar.
- **El service** hacía `rol: datos.rol`, o sea que se fiaba de lo que llegaba.

Cliente controla el rol + service confía en el rol = escalada de privilegios.

Arreglamos las dos, no una. Si solo quitáramos la validación, el service
seguiría leyendo `datos.rol` y guardaría `undefined`. Si solo arregláramos el
service, el rol seguiría siendo un campo aceptado del contrato. Cada capa tiene
que ser correcta por su cuenta.

## Primera defensa: el validador

En `src/middlewares/auth.validator.js` quitamos entero el bloque de
`body("rol")`. `validarRegistro` quedó con tres reglas: `nombre`, `email` y
`password`. `validarLogin` no se tocó.

Al quitarlo, la importación de `ROLES` quedaba sin usar y también la quitamos,
para no dejar un `require` muerto.

`ROLES` sigue viviendo en `usuarios.service.js` y sigue exportándose. Ya no
sirve para validar la entrada, pero es la lista de roles que existen en el
sistema y el bloque siguiente la va a necesitar para decidir permisos. Es una
constante del dominio, no una pieza del validador.

## Segunda defensa: el service

En `src/services/usuarios.service.js` la línea `rol: datos.rol` pasó a ser un
rol fijo. En el teatro es `asistente`, el menos privilegiado de los tres: el
que compra boletas. Es el equivalente de `paciente` en el hospital del
laboratorio de referencia.

No lo escribimos como cadena suelta, sino como constante junto a `ROLES`:

```js
const ROLES = ["administrador", "taquilla", "asistente"];
const ROL_POR_DEFECTO = "asistente";
```

Y en `crearUsuario`:

```js
    passwordHash,
    // ========================================
    // Valores controlados por el servidor
    // El cliente no puede fijar su rol ni activarse a sí mismo
    // ========================================
    rol: ROL_POR_DEFECTO,
    activo: true
```

`activo: true` ya estaba forzado desde el Lab 7; ahora el rol lo acompaña.

El usuario se sigue construyendo campo por campo, con un objeto literal. Nunca
con `...datos`. Eso es allowlisting: solo entra lo que nombramos.

## El controller no se tocó

`auth.controller.js` no cambió ni una línea, y eso es buena señal. Ya leía el
cuerpo con `matchedData(req, { locations: ["body"] })` y ya le pasaba los datos
al service.

Cada capa tiene su pregunta:

| Capa | Pregunta |
| ---- | -------- |
| Validador | ¿Qué datos acepto? |
| Controller | ¿Qué operación hago? |
| Service | ¿Cómo construyo y guardo el usuario? |

El cambio era de entrada y de persistencia, así que solo cambiaron las dos
puntas.

## Swagger

En `src/routes/auth.routes.js`, el schema `RegistroUsuario` perdió la propiedad
`rol` y `rol` salió de `required`. Quedan `nombre`, `email` y `password`, los
tres obligatorios.

La descripción del endpoint dice ahora, con todas las letras, que el rol lo
asigna el servidor y que un `rol` enviado se ignora.

Si el schema siguiera anunciando `rol`, estaríamos documentando una entrada que
el servidor ya descarta. Así el spec sirve también como documentación de la
seguridad: quien lo lea sabe, sin mirar el código, que ese campo no es suyo.

`LoginUsuario`, `UsuarioPublico` y `RespuestaUsuario` no cambiaron.
`UsuarioPublico` sigue devolviendo `rol`, porque el rol sí sale en la respuesta
aunque no entre en la petición: lo dice el servidor.

`src/docs/swagger.js` no se tocó. El tag Autenticación ya estaba desde el Lab 7.

[Captura] Swagger: el schema de `POST /api/auth/registro`, donde se ve que solo
pide nombre, email y password, con la descripción que dice que el rol lo asigna
el servidor.

## Por qué responde 201 y no 400

Mandar `"rol": "administrador"` no da error. Da 201, y el usuario queda como
asistente.

No es un descuido. La entrada se filtra por lista blanca: el validador declara
los campos que aceptamos y `matchedData` devuelve solo esos. Lo demás se
descarta sin discutir, así que la petición es válida y se procesa.

Una lista negra tendría que ir nombrando cada campo peligroso uno por uno, y
siempre se queda corta: basta olvidar uno. La lista blanca frena también los
campos que todavía no existen. Por eso el `"permisos": ["DELETE_ALL", "ADMIN"]`
de la prueba se cayó solo, sin que nadie lo hubiera previsto.

Enviar un atributo no significa tener autorización para controlarlo.

## Atacando nuestra propia API

Con el servidor reiniciado, probamos nueve casos contra los dos endpoints.

**Registro normal**, sin mandar rol:

```json
{
  "mensaje": "Usuario registrado correctamente",
  "usuario": {
    "id": 1,
    "nombre": "Asistente Teatro",
    "email": "asistente@teatro.com",
    "rol": "asistente",
    "activo": true
  }
}
```

El cliente nunca dijo `rol: asistente`. Lo decidió el servidor.

**Intento de escalada**, mandando rol de administrador, `activo: false` y
`esSuperAdmin: true`. La respuesta fue 201, pero con esto dentro:

```json
{
  "id": 2,
  "nombre": "Usuario Ataque",
  "email": "ataque@teatro.com",
  "rol": "asistente",
  "activo": true
}
```

| El atacante pidió | El servidor guardó |
| ----------------- | ------------------ |
| `rol: administrador` | `rol: asistente` |
| `activo: false` | `activo: true` |
| `esSuperAdmin: true` | Ni siquiera existe |

**Mass assignment completo.** Mandamos todo lo que se nos ocurrió:

```json
{
  "nombre": "Ataque Mass Assignment",
  "email": "mass@teatro.com",
  "password": "ClaveSegura2026!",
  "id": 9999,
  "rol": "administrador",
  "activo": false,
  "passwordHash": "HASH_CONTROLADO",
  "esSuperAdmin": true,
  "permisos": ["DELETE_ALL", "ADMIN"]
}
```

El usuario quedó con `id: 3`, `rol: asistente` y `activo: true`. El `id`, el
`rol`, el `activo`, el `passwordHash`, el `esSuperAdmin` y los `permisos` se
ignoraron como entrada.

[Captura] Postman o Swagger: el registro pidiendo `rol: "administrador"` y la
respuesta 201 con `rol: "asistente"`.

[Captura] El registro con todos los campos de más y su respuesta.

## Checkpoint del Bloque 4B

| Prueba | Esperado | Obtenido | Estado |
| ------ | -------- | -------- | ------ |
| Registro sin rol | 201 + rol asistente | 201 + rol asistente | OK |
| Registro pidiendo rol administrador | 201 + rol asistente | 201 + rol asistente | OK |
| Enviar `activo: false` | Se mantiene `true` | `activo: true` | OK |
| Enviar `passwordHash` falso | Campo ignorado | Ignorado | OK |
| Enviar `esSuperAdmin: true` | Campo ignorado | Ignorado | OK |
| Login con credenciales correctas | 200 | 200 | OK |
| Login con credenciales incorrectas | 401 | 401 | OK |

Dos pruebas más, fuera de la tabla del laboratorio:

| Prueba | Esperado | Obtenido | Estado |
| ------ | -------- | -------- | ------ |
| Enviar `id: 9999` | Id asignado por el servidor | `id: 3` | OK |
| Enviar `permisos: [...]` | Campo ignorado | Ignorado | OK |

[Captura] Los dos logins, el correcto con 200 y el incorrecto con 401.

## Semgrep y npm audit

Repetimos las dos herramientas.

```bash
semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/
npm audit
```

| Herramienta | Lab 7 | Lab 8 |
| ----------- | ----- | ----- |
| Semgrep: archivos escaneados | 41 | 41 |
| Semgrep: hallazgos | 0 | 0 |
| `npm audit` | 0 vulnerabilidades | 0 vulnerabilidades |

Los números cuadran y era lo esperado: en este laboratorio no creamos ningún
archivo, solo modificamos tres, y no instalamos nada. `package.json` y
`package-lock.json` no cambiaron. bcrypt sigue siendo la única dependencia
añadida en todo el semestre.

La API mantiene 41 endpoints en 21 rutas, 34 schemas y 7 tags: esta fase no
añade endpoints, solo cambia el contenido del schema `RegistroUsuario`. No hay
referencias rotas en el spec.

Las 224 pruebas automatizadas siguen pasando. Ninguna se rompió, porque son
anteriores al Lab 7 y no tocan `/api/auth`.

Salidas guardadas en `sast-semgrep-lab8.txt` y `sca-npm-audit-lab8.txt`.

## Lo que este laboratorio no resuelve

**Ahora no se puede crear un administrador de ninguna forma.** Cerramos la
puerta por completo, y eso incluye la puerta legítima. Por el registro público
todos los usuarios nacen asistentes, y no hay ninguna operación que permita
crear un usuario con otro rol. Falta esa operación administrativa, y para
hacerla bien hacen falta JWT y control de rol, que es el bloque siguiente. El
primer administrador tendrá que salir de un proceso controlado de inicialización
o seed cuando haya base de datos, nunca del registro.

**El rol sigue sin dar ni quitar acceso.** Un asistente autenticado puede llamar
exactamente a los mismos endpoints que llamaría un administrador. El rol se
guarda y se devuelve, pero todavía no decide nada.

**Sigue sin haber token.** El login confirma las credenciales y ahí se acaba: no
deja sesión abierta, así que el resto de la API sigue sin saber qué persona está
detrás de cada petición.

## Repositorio

https://github.com/JuanK2550/API-TEATRO

| Commit | Contenido |
| ------ | --------- |
| `6d78b73` Lab 8: control del rol y prevención de escalada de privilegios | `auth.validator.js`, `usuarios.service.js`, `auth.routes.js` y el README |
| `c686a8c` docs: evidencias del Lab 8 | Las salidas de Semgrep y npm audit |

Antes de subir comprobamos que el `.env` siguiera fuera del repositorio, que
ninguna de las tres API Keys apareciera en los archivos a subir y que no
quedaran hashes de bcrypt en el README.
