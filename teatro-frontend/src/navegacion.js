// ========================================
// Módulos del panel por rol
// Ordena el menú; el backend vuelve a decidir en cada petición
// ========================================
export const MODULOS = {
  usuarios: { ruta: "usuarios", titulo: "Usuarios y roles", icono: "usuarios", roles: ["administrador"] },
  programacion: { ruta: "programacion", titulo: "Eventos y funciones", icono: "programacion", roles: ["administrador"] },
  asistentes: { ruta: "asistentes", titulo: "Asistentes", icono: "asistentes", roles: ["administrador"] },
  localidades: { ruta: "localidades", titulo: "Localidades", icono: "localidades", roles: ["administrador"] },
  boletas: { ruta: "boletas", titulo: "Boletas", icono: "boletas", roles: ["administrador"] },
  agenda: { ruta: "agenda", titulo: "Agenda de funciones", icono: "agenda", roles: ["taquilla"] },
  control: { ruta: "control-boletas", titulo: "Control de boletas", icono: "puerta", roles: ["taquilla"] },
  misBoletas: { ruta: "mis-boletas", titulo: "Mis boletas", icono: "boletas", roles: ["asistente"] },
  miPerfil: { ruta: "mi-perfil", titulo: "Mi perfil", icono: "perfil", roles: ["taquilla", "asistente"] },
  recuperacion: { ruta: "recuperacion-administrativa", titulo: "Recuperación administrativa", icono: "llave", roles: ["administrador"] },
  codigos: { ruta: "codigos-recuperacion", titulo: "Códigos de recuperación", icono: "escudo", roles: ["administrador", "taquilla", "asistente"] },
  password: { ruta: "cambiar-password", titulo: "Cambiar mi contraseña", icono: "candado", roles: ["administrador", "taquilla", "asistente"] }
};

export const MENU_POR_ROL = {
  administrador: ["usuarios", "programacion", "asistentes", "localidades", "boletas", "recuperacion", "codigos", "password"],
  taquilla: ["agenda", "control", "miPerfil", "codigos", "password"],
  asistente: ["misBoletas", "miPerfil", "codigos", "password"]
};

export const PRESENTACION_POR_ROL = {
  administrador: { titulo: "Panel administrativo", descripcion: "Programación, venta, cuentas y seguridad del teatro." },
  taquilla: { titulo: "Panel de taquilla", descripcion: "Agenda de funciones y control de boletas en la puerta." },
  asistente: { titulo: "Mi espacio en el teatro", descripcion: "Tus boletas, tus datos y la seguridad de tu cuenta." }
};

export const moduloPorRuta = (ruta) => Object.values(MODULOS).find((modulo) => modulo.ruta === ruta) ?? null;
