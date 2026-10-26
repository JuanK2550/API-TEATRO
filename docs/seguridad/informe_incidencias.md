# Registro de incidencias — Laboratorio 8

Sección 9.1 del `README_BLOQUE_8.md`.

| Incidencia | Prueba | Resultado observado | Causa confirmada | Corrección | Reprueba |
| ---------- | ------ | ------------------- | ---------------- | ---------- | -------- |
| — | — | — | — | — | — |

## Resultado

Ninguna prueba resultó FALLIDA, así que no se abrió ninguna incidencia y
no hubo correcciones de código.

Las 53 pruebas quedaron APROBADAS. BA08 y BA09 estuvieron BLOQUEADAS mientras no
hubo una base de datos aislada —una prueba bloqueada no es una incidencia, es una
precondición ausente— y se ejecutaron en cuanto se dispuso del proyecto de
Supabase independiente.

## Observaciones de la ejecución

Dos cosas que conviene dejar por escrito, porque afectan a cómo se leen los
resultados:

1. **P07 no se puede evaluar por el código HTTP.** El registro público responde
   201 aunque el cuerpo pida `rol: "administrador"`. Solo la consulta a
   PostgreSQL demuestra que la cuenta quedó como `asistente`. Si esta prueba se
   diera por buena mirando el 201, se estaría aprobando justo lo contrario de lo
   que comprueba.

2. **P35 responde 401, no 403.** El README advierte que el código depende del
   middleware configurado. En el teatro `apiKey.middleware.js` distingue tres
   casos: ausente 401, inválida 401 y deshabilitada 403. El esperado se tomó del
   comportamiento real, no de la guía del hospital.

---

*API_TEATRO · Laboratorio 8*
