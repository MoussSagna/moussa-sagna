#!/bin/zsh
# Rend le Plan 01 (bandeau rouge) frame par frame avec Chrome headless.
#   ./render.sh <dossier_de_sortie> [frames|sheet|report]
# Chrome headless écrit sa sortie puis ne se ferme pas toujours : on attend le fichier, puis on le tue.
set -eu
HERE="${0:A:h}"
OUT="${1:?dossier de sortie requis}"
MODE="${2:-frames}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT
URL="file://${HERE// /%20}/ribbon.html"
FLAGS=(--headless=new --disable-gpu --no-first-run --no-default-browser-check --hide-scrollbars
       --force-device-scale-factor=1 --window-size=1536,1024 --user-data-dir="$PROFILE"
       --default-background-color=000000ff)
mkdir -p "$OUT"

# run_until <fichier attendu> <motif grep ou ''> <args chrome...>
run_until() {
  local file="$1" pattern="$2"; shift 2
  [[ "$file" == /dev/null ]] || rm -f "$file"
  "$CHROME" $FLAGS "$@" > "$PROFILE/stdout" 2>/dev/null &
  local pid=$! n=0
  while (( n < 600 )) && kill -0 $pid 2>/dev/null; do
    if [[ -n "$pattern" ]]; then grep -q "$pattern" "$PROFILE/stdout" 2>/dev/null && break
    elif [[ -s "$file" ]]; then sleep 0.4; break; fi
    sleep 0.1; n=$((n+1))
  done
  kill -9 $pid 2>/dev/null || true
  wait $pid 2>/dev/null || true
}

case "$MODE" in
  report) run_until /dev/null REPORT_END --dump-dom "$URL?report=1"
          sed -n 's/.*REPORT_BEGIN\(.*\)REPORT_END.*/\1/p' "$PROFILE/stdout" | head -1 ;;
  sheet)  run_until "$OUT/preview.png" '' --screenshot="$OUT/preview.png" "$URL?sheet=1" ;;
  frames)
    for n in {1..24}; do
      f="$(printf '%02d' $n)"
      run_until "$OUT/frame_$f.png" '' --screenshot="$OUT/frame_$f.png" "$URL?f=$n"
      [[ -s "$OUT/frame_$f.png" ]] && echo "frame_$f.png" || { echo "ECHEC frame_$f.png" >&2; exit 1; }
    done ;;
esac
