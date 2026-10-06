---
version: 1
slug: "frontend-index-html"
primary_target: "frontend/index.html"
related_targets: ["frontend"]
---

Alcance: Sala, la cara pública de API_TEATRO (pantallas 1 a 7: cartelera, evento,
función y tarifas, plano de sala, boleta emitida, mis boletas, acceso). La Tramoya
(taquilla, puerta, programación, tarifas, localidades) queda fuera hasta que la API
tenga autorización por rol. Modo del visitante: Persuade en cartelera y evento,
Operate desde la función en adelante.

Público: alguien de Tunja que quiere ir al teatro, casi siempre desde el teléfono,
de noche, decidiendo entre salir o no. Tarea: encontrar una función en venta,
escoger butaca y quedarse con una boleta. Pruebas disponibles: los eventos, las
funciones con su estado, el cuadro de tarifas por localidad y el aforo real de la
sala (Platea Preferencial 5x20, Platea General 10x20, Balcón 6x25). Restricciones:
sin framework ni build, servido por el mismo Express, CSP de helmet sin relajar,
fuentes y fotos locales, JWT solo en memoria.

## Direction contract

THESIS: una sala de teatro vista desde la butaca, no un catálogo de tarjetas. La
cartelera se lee como la cartelera impresa del teatro y el plano de aforo es la
pantalla principal, no un paso intermedio. Refusa la rejilla de tarjetas iguales
con gradiente y badge, que es lo que esta categoría publica por defecto.

OWN-WORLD: fondo de telón drenado (#58101A sobre #3D0A12), filetes y numeración en
oro viejo #C8A24A, texto en marfil #F4ECDC, luz de escena #FFD9A0 solo para lo
seleccionado. Tipos de cartel: Archivo Black en títulos, Libre Franklin en interfaz,
Courier Prime en códigos, filas, butacas y horas. Filete de oro de 1px como única
división; sin sombras de tarjeta; radios 12-16px solo en controles.

STORY: el visitante entiende en el primer viewport que hay función y cuándo; cree
que quedan butacas porque ve la sala, no porque se lo digan; y hace una cosa, elegir
su butaca. Los estados de la función (programada, en venta, agotada, cancelada) se
muestran con su palabra, nunca solo con color.

FIRST VIEWPORT: a sangre, la próxima función en venta ocupa la pantalla: foto del
escenario tratada en duotono telón/oro al 100% de ancho, el título en Archivo Black
a escala de cartel (clamp 2.75rem a 5.5rem) sobre el borde inferior de la foto,
debajo y en Courier Prime la fecha, la hora y la duración separadas por filetes de
oro, y a la derecha el precio desde y el botón "Elegir butaca". La cartelera completa
empieza justo debajo del pliegue, en lista densa, no en rejilla de tarjetas.

FORM: telón y tramoya fusionado con el plano de sala grabado y la boleta troquelada.
Primero de mi lista de siete mundos. Dirección fijada por el usuario, aprobada
explícitamente, sin sorteo de concept-seed (seed key: n/a, pinned).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
