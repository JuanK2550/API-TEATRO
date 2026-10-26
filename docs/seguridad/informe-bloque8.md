# Bloque 8 — Validación integral de la API

Dos cosas en un bloque: separar la creación del primer administrador del
arranque del servicio, y comprobar una por una las 53 pruebas del laboratorio
contra la API en marcha.

El resultado está al final de cada sección, pero conviene adelantarlo: **53 de
53 aprobadas, ninguna fallida**, y un fallo real de seguridad encontrado y
corregido en el camino.

---

## 1. El bootstrap, antes y después

Hasta este bloque, `src/app.js` sembraba la cuenta del administrador antes de
abrir el puerto. Parecía cómodo y tenía un agujero.

### El fallo del `ADMIN_EMAIL`

`crearAdministradorInicial()` comprobaba si existía un usuario **con ese
correo**, no si existía **algún administrador**:

```js
const existente = await obtenerUsuarioPorEmail(email);
if (existente) return existente;
```

Como el bootstrap corría en cada `npm start`, bastaba editar una línea del
`.env` y reiniciar para tener una segunda cuenta administradora. Se comprobó
contra la base, no sobre el papel:

| Ejecución | `ADMIN_EMAIL` | Administradores |
| --------- | ------------- | --------------- |
| Primera | el del `.env` | 1 |
| Segunda | el mismo | 1 |
| Tercera | **cambiado** | **2** |

Quien pudiera escribir en el `.env` y reiniciar el servicio se concedía una
cuenta de administrador sin pasar por ningún endpoint, sin dejar rastro en los
logs de la API y sin que RBAC interviniera.

### Las diez reglas del 7.5.1

| # | Regla | Antes | Ahora |
| - | ----- | ----- | ----- |
| 1 | Exige las tres variables `ADMIN_*` | sí | sí |
| 2 | Contraseña de 12 o más caracteres y correo con formato | no | sí |
| 3 | Hash con `generarPasswordHash()` | sí | sí |
| 4 | Transacción y `pg_advisory_xact_lock(7505, 1)` | no | sí |
| 5 | Si existe **cualquier** administrador, no toca nada | **no** | sí |
| 6 | No eleva privilegios de una cuenta de otro rol | no | sí |
| 7 | Exige el rol `administrador` activo | parcial | sí |
| 8 | `COMMIT` / `ROLLBACK` y libera el cliente | no | sí |
| 9 | Informa del resultado y cierra el pool | no | sí |
| 10 | No reinicia contraseñas ni crea administradores extra | parcial | sí |

La regla 5 es la que cierra el agujero: la comprobación pasó a ser por rol y
alcanza a cualquier administrador, **incluso inactivo**. Reactivar una cuenta
desactivada es trabajo administrativo, no del bootstrap.

La regla 6 es la que impide lo contrario: si el correo del bootstrap ya
pertenece a otra cuenta, el script se niega en lugar de convertirla en
administradora.

### Por qué un script y no el arranque

Montar el teatro y entregar la primera llave maestra son dos operaciones
distintas, y la segunda no debe repetirse en cada despliegue. `app.js` ya no
importa el service de usuarios ni sabe nada de cuentas: solo abre el puerto.

`database.js` ganó `cerrarPool()`, tres líneas que un script suelto necesita
para terminar: sin ellas el proceso hace su trabajo y se queda vivo, con el pool
esperando consultas que no llegan. `consultar()`, `enTransaccion()` y el TLS
verificado quedaron intactos.

---

## 2. Cómo se ejecuta

```bash
node scripts/preparar-base.js --reiniciar   # esquema, RLS, semilla y vistas
npm run seed:admin                          # el primer administrador
npm start                                   # solo abre el puerto
```

`npm start` y `npm run dev` **no crean ninguna cuenta**. Comprobado: con la base
en cero usuarios, arrancar la API la deja en cero.

El seed no se añadió a `start` ni a `dev` a propósito. Un bootstrap que se
ejecuta solo en cada publicación es un bootstrap que nadie vigila.

Las baterías de pruebas necesitaban ese paso intermedio, porque antes el
administrador aparecía porque lo creaba `app.js`. `pruebas/correr.sh` recoge el
flujo completo y lo repite por batería, sobre una base recién sembrada.

---

## 3. Las tres matrices

| Matriz | Filas | APROBADAS | FALLIDAS | BLOQUEADAS |
| ------ | ----- | --------- | -------- | ---------- |
| P01–P36 · funcionales, integración y persistencia | 36 | 36 | 0 | 0 |
| SEG-01–SEG-08 · seguridad complementaria | 8 | 8 | 0 | 0 |
| BA01–BA09 · bootstrap del administrador | 9 | 9 | 0 | 0 |
| **Total** | **53** | **53** | **0** | **0** |

### El escenario

Cuatro identidades con token propio: administrador, asistente A, asistente B y
una cuenta de taquilla. Cada asistente con su `usuarioId`, su perfil en
`asistentes` y al menos una boleta. **Ningún id se dio por supuesto**: todos se
leyeron de PostgreSQL después de montar el escenario, como exige la sección 4
del enunciado.

### Dos pruebas que no se pueden leer por el código HTTP

**P07** — pedir `rol: "administrador"` en el registro público devuelve **201**.
Si la prueba se diera por buena mirando ese 201, se estaría aprobando justo lo
contrario de lo que comprueba. Lo que la resuelve es la consulta:

```sql
SELECT r.nombre AS rol
FROM public.usuarios u
INNER JOIN public.roles r ON r.id = u.rol_id
WHERE LOWER(u.email) = LOWER('<el correo registrado>');
```

Devuelve `asistente`. El validador no declara el campo `rol`, así que
`matchedData` lo descarta antes de llegar al service: la misma protección contra
Mass Assignment que el resto del proyecto.

**P34** — un 403 por falta de API Key no demuestra BOLA. La prueba se ejecutó
con la API Key válida y el JWT de un asistente distinto del dueño de la boleta,
y además se revisó que el cuerpo de la respuesta no filtrara nada.

### En las SEG se revisó el cuerpo, no solo el código

Un 200 correcto puede traer datos ajenos. En SEG-03, `/api/boletas/mias`
devolvió dos boletas y **ninguna de otro asistente**. En SEG-02, SEG-05 y SEG-06
se comprobó que el cuerpo no trajera ni el código ni el listado ajeno.

---

## 4. Diferencias con la matriz del hospital

La correspondencia es: **asistente** por paciente, **boleta** por cita,
**localidad** por consultorio y **taquilla** por médico, solo como rol.

| ID | Diferencia y por qué |
| -- | -------------------- |
| P15–P21 | El teatro no tiene una tabla de perfiles equivalente a `medicos`: `taquilla` es un rol sobre `usuarios`, sin recursos propios. Se conservó la **forma** de las pruebas sobre `funciones`, que es el recurso con clave ajena activa, regla de unicidad, listado por esa clave y borrado protegido. |
| P18 | En el hospital asocia un usuario a un perfil de médico. El mecanismo equivalente del teatro es que el administrador cree la cuenta de taquilla con `POST /api/usuarios`, y responde **201**. |
| P19 | El hospital devuelve 409 al asociar un usuario de otro rol. El teatro responde **400**, porque el rol se valida por lista blanca en el validador, antes de llegar al service. Es una diferencia de capa, no de criterio. |
| P27 | «Médico inexistente» se traduce a «función inexistente»: la misma clase de error de referencia, con el mismo 400. |
| P28 | «Médico inactivo» se traduce al estado de la función: solo una función `en_venta` admite boletas. |
| P29–P30 | «Médico ocupado» y «consultorio ocupado» se traducen a las dos reglas de aforo del teatro: butaca ya vendida y butaca fuera del aforo de la localidad. |
| P35 | El teatro responde **401** («API Key requerida»), no 403. El enunciado pide verificar el código configurado, y este es el real: `apiKey.middleware.js` distingue ausente 401, inválida 401 y deshabilitada 403. |
| SEG-04–SEG-07 | El hospital prueba que un médico no vea la agenda de otro. En el teatro no hay agenda de taquilla. Las cuatro filas se reorientaron a comprobar los límites reales de ese rol —no tiene boletas propias, no ve la boletería completa y no ejecuta operaciones administrativas— en lugar de inventar un 403 sobre un recurso que no existe. |

Ninguna fila se dio por aprobada con evidencias de bloques anteriores. P34 y P36
se volvieron a ejecutar, aunque ya estuvieran demostradas.

---

## 5. BA08 y BA09: por qué hicieron falta dos bases

Las dos exigen una base **sin administradores**, y el enunciado prohíbe
expresamente borrar administradores o vaciar tablas de la base de trabajo para
simular el primer arranque. Se ejecutaron en un proyecto de Supabase
independiente.

### La salvaguarda

Antes de ejecutar nada, el script compara el host de la cadena de pruebas con el
de la de trabajo y **aborta si coinciden**. BA08 y BA09 borran administradores:
si por un error de configuración las dos cadenas apuntaran al mismo proyecto, el
daño sería exactamente el que se quería evitar. La comprobación no cuesta nada y
convierte un error de copiar y pegar en un mensaje en lugar de un desastre.

En ese proyecto se montaron los scripts **01, 02 y 04** —esquema, RLS y datos
semilla—. El 05 y el 06 se omitieron porque crean el rol `api_teatro` y le
conceden permisos, y el bootstrap solo necesita `roles` y `usuarios`.

### Resultados

| ID | Comprobación | Resultado |
| -- | ------------ | --------- |
| BA08 | 0 administradores → `seed:admin` → 1 | 1, con `id` 1. Repetir el comando lo deja en 1 |
| BA09 | Base sin administradores, correo ya usado por un asistente | Rechazado, **salida 1**. La cuenta sigue siendo `asistente`, administradores en 0 |

BA09 es la prueba que justifica la regla 6. Sin ella, escribir en el `.env` el
correo de un asistente y correr el bootstrap le habría dado privilegios de
administrador.

### El TLS del pooler

La base de pruebas usa el Session pooler, y ahí `pg_stat_ssl` informa `false`.
No es un fallo: el pooler termina el TLS, así que PostgreSQL ve el tramo
interno. El tramo que importa —cliente hasta el pooler— se comprobó en el socket:
cifrado, certificado validado contra la autoridad de Supabase, TLS 1.3. Y se
comprobó en los dos sentidos: **sin** el certificado la conexión se rechaza con
*self-signed certificate in certificate chain*. La verificación es real, no una
opción apagada.

---

## 6. Diagnóstico de Row Level Security

`scripts/diagnostico-rls.js` responde lo que el esquema no dice: con qué rol
llega la API a PostgreSQL y si ese rol se salta las políticas.

| Propiedad | Valor |
| --------- | ----- |
| Usuario SQL | `api_teatro` |
| Superusuario | false |
| Omite RLS (`rolbypassrls`) | **false** |
| Tablas con RLS activo | 9 de 9 |
| Tablas de las que el rol es dueño | 0 |
| Tablas con política | 9 de 9 |

Tener RLS activado no basta. Si la conexión usa el dueño de las tablas o un rol
con `BYPASSRLS`, las políticas no se evalúan y la seguridad de filas es
decorativa. En el laboratorio del hospital esa es justamente la situación; aquí
el script confirma lo contrario, y sale con código 1 si alguna de las seis
condiciones deja de cumplirse.

---

## 7. Lo que este bloque no resuelve

- **No hay auditoría.** El bootstrap registra qué hizo en su salida, pero no
  queda constancia en la base de quién creó la primera cuenta ni cuándo.
- **El bootstrap no recupera accesos.** No reinicia contraseñas ni reactiva
  cuentas. Si se pierde el acceso administrativo hace falta un procedimiento
  aparte, que no está escrito.
- **No hay `superadministrador`.** `crearUsuarioAdministrativo()` permite crear
  cuentas `taquilla` y `administrador`, así que un administrador puede crear
  otros administradores. Separar un rol por encima haría esa concesión más
  restrictiva; no se implementó.
- **Las `ADMIN_*` siguen en el `.env`.** Lo correcto en un despliegue real es
  retirarlas una vez creada la cuenta, y suministrarlas desde un gestor de
  secretos cuando haga falta. Aquí se comprobó que la API arranca sin ellas
  (BA05) y que el script se niega a correr sin ellas (BA07), que es la mitad del
  camino.
- **El bloqueo asesor solo coordina este bootstrap.** `pg_advisory_xact_lock`
  serializa ejecuciones que usan esa misma clave. No protege otros endpoints o
  scripts que inserten administradores: esos dependen de su propia autorización.

---

## 8. Evidencias

Quince tarjetas con la salida real de cada bloque de pruebas, más el escenario,
P07 con su consulta, P36 con el reinicio, BA08, BA09 y el diagnóstico de RLS.
Ninguna muestra tokens completos, API Keys, contraseñas, hashes, hosts ni
cadenas de conexión.

El registro de incidencias está en
[`informe_incidencias.md`](informe_incidencias.md): ninguna prueba resultó
FALLIDA, así que no se abrió ninguna y no hubo correcciones de código durante la
ejecución.

---

*API_TEATRO · Bloque 8 · Validación integral de la API*
