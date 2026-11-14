import { LONGITUD_MAXIMA, LONGITUD_MINIMA } from "../utils/password";

// ========================================
// Contraseña nueva y su confirmación
// ========================================
export default function CamposPasswordNueva({ prefijo, etiqueta = "Nueva contraseña", nueva, confirmacion, alCambiarNueva, alCambiarConfirmacion }) {
  const noCoinciden = confirmacion.length > 0 && nueva !== confirmacion;

  return (
    <>
      <div className="mb-3">
        <label className="form-label" htmlFor={`${prefijo}-nueva`}>{etiqueta}</label>
        <input
          id={`${prefijo}-nueva`}
          className="form-control"
          type="password"
          autoComplete="new-password"
          minLength={LONGITUD_MINIMA}
          maxLength={LONGITUD_MAXIMA}
          required
          aria-describedby={`${prefijo}-nueva-ayuda`}
          value={nueva}
          onChange={(e) => alCambiarNueva(e.target.value)}
        />
        <div id={`${prefijo}-nueva-ayuda`} className="form-text">
          Entre {LONGITUD_MINIMA} y {LONGITUD_MAXIMA} caracteres. Una frase larga es más segura que una palabra con símbolos.
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor={`${prefijo}-confirmar`}>Confirmar contraseña</label>
        <input
          id={`${prefijo}-confirmar`}
          className={`form-control ${noCoinciden ? "is-invalid" : ""}`}
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={noCoinciden}
          aria-describedby={noCoinciden ? `${prefijo}-confirmar-error` : undefined}
          value={confirmacion}
          onChange={(e) => alCambiarConfirmacion(e.target.value)}
        />
        {noCoinciden && (
          <div id={`${prefijo}-confirmar-error`} className="invalid-feedback">
            No coincide con la contraseña nueva.
          </div>
        )}
      </div>
    </>
  );
}
