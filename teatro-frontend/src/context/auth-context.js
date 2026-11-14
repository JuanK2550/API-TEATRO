import { createContext } from "react";

// ========================================
// Contexto de autenticación
// Separado del proveedor para que la recarga en caliente funcione
// ========================================
export const AuthContext = createContext(null);
