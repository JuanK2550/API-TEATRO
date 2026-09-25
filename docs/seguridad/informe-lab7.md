# Laboratorio 7 — Bloque 4: usuarios, hashing y salting

## El problema

Con el Lab 6 la API ya sabía **qué aplicación** hacía cada petición: Postman, la
taquilla o la aplicación móvil, según la API Key. Pero no sabía **qué persona**
estaba detrás. Si la taquilla vendía una boleta, la API sabía que fue la
taquilla, no quién estaba en el mostrador.

En este laboratorio agregamos usuarios con correo y contraseña, y dos endpoints:
`POST /api/auth/registro` y `POST /api/auth/login`.

## Por qué bcrypt y no SHA-256

En el Lab 6 guardamos las API Keys con SHA-256 y ahí funciona: una clave de 32
bytes aleatorios no se adivina probando, hay demasiadas combinaciones.

Una contraseña escrita por una persona es otra cosa. `Teatro2026`, `Clave123`,
el nombre del perro. Se repiten y hay listas con millones de ellas. Con SHA-256,
que es rapidísimo, alguien que robe la base de datos puede probar millones de
contraseñas por segundo hasta dar con la que produce ese hash.

bcrypt está hecho para eso:

- Es **lento a propósito**. El *cost* fija cuánto trabajo cuesta cada cálculo.
  Nosotros usamos 12. Para el servidor son milisegundos; para quien prueba
  millones de contraseñas, es la diferencia entre horas y años.
- Trae la **sal incorporada**. No hay que guardarla en otra columna: viene
  dentro del hash.

## Qué es la sal

Sin sal, la misma contraseña siempre da el mismo hash. Si dos usuarios usan
`ClaveSegura2026!`, en la base de datos se ve el mismo valor repetido, y quien
lo robe sabe que son iguales. Además puede usar tablas ya calculadas con los
hashes de las contraseñas más comunes.

La sal es un valor aleatorio distinto para cada contraseña, que se mezcla antes
de calcular el hash. Mismo texto, sal distinta, hash distinto.

Lo comprobamos como pide el laboratorio. Pusimos un `console.log` temporal en
`crearUsuario` y registramos dos usuarios con la **misma** contraseña
(`ClaveSegura2026!`) y distinto correo. Esto salió por consola:

```
Hash generado: $2b$12$G61xBWswYeOKByjv4wgud.Wj4.4JdJ18nttqaJdVoWI4TlpzYwnUK
Hash generado: $2b$12$f9qHoA75MMvVG7Yf.dBJ2uou1cyMzTmUMBERv8nCYkOAWI0rgjWj6
```

Los dos empiezan igual, con `$2b$12$`: `$2b$` es la variante de bcrypt y `12` el
cost. A partir de ahí son distintos. Los 22 caracteres siguientes son la sal:

```
G61xBWswYeOKByjv4wgud.
f9qHoA75MMvVG7Yf.dBJ2u
```

Misma contraseña, sal distinta, hash distinto. Después quitamos el
`console.log`: los registros normales del servidor no tienen por qué contener
hashes de credenciales.

[Captura] La consola del servidor con las dos líneas "Hash generado".

[Captura] El `package.json` con bcrypt, o la terminal con `npm install bcrypt` y
`npm list bcrypt`.

## Las capas nuevas

**`src/utils/password.util.js`**
Tiene `generarPasswordHash` y `verificarPassword`, con `SALT_ROUNDS = 12`. Las
dos son `async` porque bcrypt es lento a propósito: si fueran síncronas,
bloquearían el servidor en cada registro y cada login.

**`src/data/usuarios.js`**
El array de usuarios. Arranca vacío, sin ningún usuario de ejemplo: el primero
se crea desde el endpoint de registro.

**`src/services/usuarios.service.js`**
`obtenerUsuarioPorEmail`, `obtenerUsuarioPorId`, `crearUsuario` y
`verificarCredenciales`. El service hashea la contraseña y fija `activo: true`;
ese campo no viene del cliente.

**`src/middlewares/auth.validator.js`**
Las reglas de los dos endpoints. La contraseña va de 10 a 72 caracteres: bcrypt
solo procesa 72 bytes, y lo que pase de ahí se ignoraría sin avisar. Los roles
salen de la constante `ROLES` del service, para no escribirlos dos veces.

**`src/controllers/auth.controller.js`**
`registrar` y `login`, las dos `async` con `try/catch` y `next(error)`, porque
un error dentro de una promesa no lo recoge Express solo.

**`src/routes/auth.routes.js`**
Las dos rutas con su documentación OpenAPI, bajo el tag Autenticación.

Los tres roles del teatro son `administrador`, `taquilla` y `asistente`.

## El passwordHash nunca sale

El usuario guardado en memoria es así:

```
{ id, nombre, email, passwordHash, rol, activo }
```

Las respuestas **no devuelven ese objeto**. El controller las arma campo por
campo: en el registro `id`, `nombre`, `email`, `rol` y `activo`; en el login los
cuatro primeros. Si devolviéramos el usuario completo, el `passwordHash` saldría
sin que nadie se diera cuenta.

Un hash no es la contraseña, pero tampoco es público: quien lo tenga puede
ponerse a probar contraseñas contra él por su cuenta, sin límite de intentos y
sin que la API se entere.

Lo comprobamos revisando las respuestas del registro y del login: no aparece
`password`, ni `passwordHash`, ni nada que empiece por `$2b$`.

[Captura] Swagger o Postman: la respuesta 201 del registro, donde se ve que no
hay contraseña ni hash.

## El 401 dice siempre lo mismo

En el login, `verificarCredenciales` devuelve `null` en dos casos: cuando el
correo no existe y cuando la contraseña no coincide. El controller responde lo
mismo en los dos:

```json
{ "mensaje": "Credenciales inválidas" }
```

No decimos "ese usuario no existe" ni "la contraseña es incorrecta". Si lo
hiciéramos, cualquiera podría ir probando correos uno por uno y quedarse con los
que responden distinto. Esa lista de correos registrados ya es información útil
para atacar: sirve para dirigir intentos de contraseña o correos de engaño.

[Captura] Postman o Swagger: los dos 401, el de contraseña incorrecta y el de
usuario inexistente, con el mismo mensaje.

## Los dos niveles

El registro y el login están bajo `/api`, y `validarApiKey` cubre todo `/api`.
Así que **también exigen la cabecera `X-API-Key`**. Sin ella responden 401 "API
Key requerida" y no llegan al controlador.

Quedan dos niveles, uno encima del otro:

| Nivel | Pregunta | Credencial |
| ----- | -------- | ---------- |
| Cliente | ¿Qué aplicación consume la API? | `X-API-Key` |
| Usuario | ¿Qué persona está usándola? | correo + contraseña |

Una aplicación autorizada puede pedir; una persona registrada puede
identificarse. Son cosas distintas y conviven.

## Checkpoint 4A

| Prueba | Esperado | Obtenido | Pasa |
| ------ | -------- | -------- | ---- |
| Registro válido | 201 | 201 | Sí |
| Email duplicado | 409 | 409 | Sí |
| Login correcto | 200 | 200 | Sí |
| Password incorrecto | 401 | 401 | Sí |
| Usuario inexistente | 401 | 401, mismo mensaje | Sí |
| Password de menos de 10 caracteres | 400 | 400 | Sí |
| Dos passwords iguales | Hashes diferentes | Diferentes | Sí |
| `passwordHash` en la respuesta | Nunca | No aparece | Sí |
| Mass assignment | Bloqueado | Bloqueado | Sí |
| Reiniciar Node | Los usuarios desaparecen | Desaparecen | Sí |

En la prueba de mass assignment mandamos esto al registro:

```json
{
  "nombre": "Usuario Ataque",
  "email": "ataque@teatro.com",
  "password": "ClaveSegura2026!",
  "rol": "asistente",
  "activo": false,
  "esSuperAdmin": true,
  "passwordHash": "HASH_FALSO",
  "id": 999
}
```

El usuario quedó con `id: 3` y `activo: true`, sin `esSuperAdmin` y sin el
`passwordHash` enviado. `matchedData` descarta todo lo que no está declarado en
el validador, y el service vuelve a fijar `activo` por su cuenta. Son dos
defensas para lo mismo.

[Captura] El registro con los campos de más y la respuesta, donde se ve que no
se colaron.

## Los usuarios viven en memoria

`const usuarios = []` está en memoria, igual que el resto de los datos del
proyecto. Al reiniciar el servidor desaparecen.

Lo comprobamos: con el usuario recién registrado, el login daba **200**. Paramos
el servidor, lo levantamos otra vez y el mismo login dio **401 "Credenciales
inválidas"**. No hay base de datos todavía.

## Un detalle de `normalizeEmail`

Los dos validadores usan `normalizeEmail()`. Lo usamos para que el correo se
guarde siempre en minúsculas, pero hace algo más de lo que esperábamos: en
Gmail también **quita los puntos** del nombre, porque para Gmail son el mismo
buzón.

Lo probamos:

| Enviado | Guardado |
| ------- | -------- |
| `Juan.Perez@GMAIL.com` | `juanperez@gmail.com` |
| `juan.perez@teatro.com` | `juan.perez@teatro.com` |
| `ADMIN@Teatro.com` | `admin@teatro.com` |

Con dominios que no son Gmail solo cambia las mayúsculas. Lo dejamos así porque
es lo que indica el laboratorio, pero hay que saberlo: el correo guardado puede
no ser idéntico al que escribió la persona.

## Semgrep y npm audit

Repetimos las dos herramientas después de instalar bcrypt, que es la primera
dependencia nueva desde el principio del proyecto.

```bash
npm install bcrypt
npm audit
npm list bcrypt
semgrep --config p/javascript --config p/nodejs --config p/owasp-top-ten src/
```

| Herramienta | Alcance | Resultado |
| ----------- | ------- | --------- |
| `npm install bcrypt` | — | 3 paquetes añadidos |
| `npm audit` | 146 paquetes | 0 vulnerabilidades |
| `npm list bcrypt` | — | `bcrypt@6.0.0` |
| Semgrep 1.172.0 | 73 reglas, 41 archivos | 0 hallazgos |

El proyecto pasó de 143 a 146 paquetes. bcrypt es un módulo nativo, pero se
instaló sin compilar nada: npm bajó el binario ya preparado para Windows.

Salidas guardadas en `sast-semgrep-lab7.txt` y `sca-npm-audit-lab7.txt`.

La API quedó con 41 endpoints en 21 rutas, y las 224 pruebas de los laboratorios
anteriores siguen pasando.

## Lo que falta

**No hay token.** El login solo responde si las credenciales son correctas. No
deja ninguna sesión abierta: la siguiente petición no sabe quién la hace, y el
resto de la API sigue sin enterarse de qué usuario está detrás. Para eso hace
falta un JWT.

**No hay permisos por rol.** El usuario tiene `administrador`, `taquilla` o
`asistente`, pero ese rol todavía no decide nada. Cualquier cliente con una API
Key activa puede usar todos los endpoints.

Las dos cosas van en el bloque siguiente.

## Repositorio

https://github.com/JuanK2550/API-TEATRO

| Commit | Contenido |
| ------ | --------- |
| `098e76b` Añadir usuarios con contraseña usando bcrypt | Las capas nuevas, `app.js`, `swagger.js`, `package.json` y el README |
| `d24cd27` docs: evidencias del Lab 7 | Las salidas de Semgrep y npm audit |

Antes de subir comprobamos que el `.env` no estuviera en el repositorio, que
ninguna de las tres API Keys apareciera en ningún archivo y que no quedara
ningún `console.log` con hashes.
