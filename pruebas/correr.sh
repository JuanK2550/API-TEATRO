#!/usr/bin/env bash
# ========================================
# Lanzador de las baterías de pruebas
# ========================================
# Cada batería corre sobre una base recién sembrada. Hace falta desde que los
# datos persisten: reiniciar Node ya no devuelve los datos semilla.
#
#   bash pruebas/correr.sh            # las nueve baterías
#   bash pruebas/correr.sh pruebas.js # una sola
#
# El flujo por batería es:
#
#   preparar-base --reiniciar  ->  npm run seed:admin  ->  arrancar  ->  batería
#
# El seed va aquí y no dentro de npm start: arrancar el servicio no debe crear
# cuentas. Por eso las pruebas lo invocan de forma explícita, igual que lo haría
# un operador al instalar.
set -u

cd "$(dirname "$0")/.." || exit 1

REGISTRO="${TMPDIR:-/tmp}/api-teatro-pruebas.log"

# verificar-c comprueba el límite de peticiones, así que necesita el valor real.
# Las demás lo superarían y recibirían 429 donde esperan otra cosa.
LIMITE_ALTO=100000

BATERIAS=(
  pruebas.js
  pruebas-funciones.js
  pruebas-boletas.js
  pruebas-limites.js
  pruebas-cuenta.js
  pruebas-autorizacion.js
  verificar-a.js
  verificar-b.js
  verificar-c.js
)

if [ "$#" -gt 0 ]; then BATERIAS=("$@"); fi

total=0
correctas=0
fallidas=0

for bateria in "${BATERIAS[@]}"; do
  taskkill //F //IM node.exe > /dev/null 2>&1
  node scripts/preparar-base.js --reiniciar > /dev/null 2>&1 || {
    echo "  $bateria: no se pudo preparar la base"; continue
  }
  node scripts/crear-admin.js > /dev/null 2>&1 || {
    echo "  $bateria: el bootstrap del administrador falló"; continue
  }

  if [ "$bateria" = "verificar-c.js" ]; then
    node src/app.js > "$REGISTRO" 2>&1 &
  else
    RATE_LIMIT_MAX=$LIMITE_ALTO node src/app.js > "$REGISTRO" 2>&1 &
  fi
  until curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; do sleep 1; done

  salida=$(node "pruebas/$bateria" 2>&1)

  # Las baterías numeradas imprimen un total; verificar-* devuelve JSON.
  linea=$(echo "$salida" | grep -E "Total:.*Correctas:.*Fallidas:" | tail -1)
  if [ -n "$linea" ]; then
    t=$(echo "$linea" | sed -n 's/.*Total: \([0-9]*\).*/\1/p')
    c=$(echo "$linea" | sed -n 's/.*Correctas: \([0-9]*\).*/\1/p')
    f=$(echo "$linea" | sed -n 's/.*Fallidas: \([0-9]*\).*/\1/p')
  else
    leido=$(echo "$salida" | grep '^\[' | node -e '
      let s = "";
      process.stdin.on("data", (d) => (s += d)).on("end", () => {
        try {
          const r = JSON.parse(s.trim());
          console.log(r.length + " " + r.filter((x) => x.ok).length);
        } catch {
          console.log("0 0");
        }
      });')
    t=$(echo "$leido" | cut -d" " -f1)
    c=$(echo "$leido" | cut -d" " -f2)
    f=$((t - c))
  fi

  printf "  %-26s Total: %s | Correctas: %s | Fallidas: %s\n" "$bateria" "$t" "$c" "$f"
  total=$((total + t)); correctas=$((correctas + c)); fallidas=$((fallidas + f))
done

taskkill //F //IM node.exe > /dev/null 2>&1

echo "  ---------------------------------------------------------"
printf "  %-26s Total: %s | Correctas: %s | Fallidas: %s\n" "TODAS" "$total" "$correctas" "$fallidas"

[ "$fallidas" -eq 0 ] && [ "$total" -gt 0 ]
