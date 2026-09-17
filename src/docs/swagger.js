// ========================================
// Importaciones
// ========================================
const swaggerJsdoc = require("swagger-jsdoc");

// ========================================
// Definición base
// ========================================
// Los schemas transversales viven aquí, no en un archivo de rutas concreto,
// porque los cinco recursos los referencian. Los schemas propios de cada
// recurso se declaran en los comentarios @openapi de sus routes.
const definicion = {
  openapi: "3.0.3",
  info: {
    title: "API Teatro Maldonado Segura",
    version: "1.0.0",
    description:
      "API REST para la programación de funciones y la venta de boletería del " +
      "Teatro Maldonado de Tunja. Gestiona asistentes, eventos, localidades de " +
      "la sala, funciones con su agenda y tarifas, y las boletas vendidas. " +
      "Aplica prácticas seguras: cabeceras de seguridad con helmet, CORS " +
      "restringido a un origen, límite de peticiones, cuerpos acotados a 10kb, " +
      "validación de entrada con express-validator y protección contra Mass " +
      "Assignment leyendo siempre los datos con matchedData. Los campos " +
      "calculados por el servidor, como el precio y el código de una boleta o " +
      "el estado de una función, nunca se aceptan del cliente. Documentación " +
      "OpenAPI 3.0.3 generada con swagger-jsdoc.",
    contact: {
      name: "Teatro Maldonado de Tunja"
    }
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Servidor local"
    }
  ],
  tags: [
    {
      name: "Asistentes",
      description:
        "Personas registradas que pueden comprar boletas. El documento y el correo son únicos."
    },
    {
      name: "Eventos",
      description:
        "Espectáculos del teatro: obras, conciertos, cine e institucionales. Un evento puede tener varias funciones."
    },
    {
      name: "Localidades",
      description:
        "Zonas de la única sala del teatro. Su capacidad la calcula el servidor y el orden indica la cercanía al escenario."
    },
    {
      name: "Funciones",
      description:
        "Presentaciones de un evento en una fecha y hora concretas, con sus tarifas por localidad y su máquina de estados."
    },
    {
      name: "Boletas",
      description:
        "Venta de boletería. El precio, el código y el estado los administra la API, nunca el cliente."
    }
  ],
  components: {
    schemas: {
      Mensaje: {
        type: "object",
        description: "Respuesta de confirmación sin cuerpo de recurso.",
        properties: {
          mensaje: {
            type: "string",
            example: "Boleta eliminada correctamente"
          }
        }
      },
      Error: {
        type: "object",
        description: "Forma única de todas las respuestas de error de la API.",
        properties: {
          mensaje: {
            type: "string",
            example: "Boleta no encontrada"
          }
        }
      },
      ErrorValidacion: {
        type: "object",
        description:
          "Error de validación de entrada, con el detalle por campo que devuelve express-validator.",
        properties: {
          mensaje: {
            type: "string",
            example: "Datos de entrada inválidos"
          },
          errores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                campo: {
                  type: "string",
                  example: "email"
                },
                mensaje: {
                  type: "string",
                  example: "El email no tiene un formato válido"
                }
              }
            }
          }
        }
      }
    }
  }
};

// ========================================
// Generación del spec
// ========================================
// swagger-jsdoc lee los bloques @openapi de los archivos de rutas y los
// fusiona con la definición base. La ruta es relativa al directorio desde el
// que se arranca el proceso, que siempre es la raíz del proyecto.
const swaggerSpec = swaggerJsdoc({
  definition: definicion,
  apis: ["./src/routes/*.js"]
});

// ========================================
// Exportaciones
// ========================================
module.exports = swaggerSpec;
