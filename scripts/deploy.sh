#!/usr/bin/env bash
# blocks-os :: inception scan + deploy
#
# Raw-code deploy: client is built with npm/vite into server/Api/wwwroot, the
# server is built with `dotnet publish` and run by systemd. No container image
# is built, pushed or pulled for the application itself.
#
# Usage:
#   scripts/deploy.sh [--stages all|secret,sca,sast,dast,deploy,graphify]
#                     [--ref <sha>] [--no-pull] [--wait] [--jobs N]
#
# Exit codes:
#   0  all selected stages passed
#   1  at least one stage failed
#  75  another scan/deploy already holds the lock (skipped, not a failure)
#
# Concurrency: a single non-blocking flock guards the whole script, so a CI run
# and a manual run can never build at the same time. Callers that must wait
# instead of skipping can pass --wait.

set -uo pipefail
export HOME="${HOME:-/root}"

SVC=os
PORT=5002
REPO=/opt/blocks/code/blocks-$SVC
SEC=/opt/blocks/security
SONAR=http://127.0.0.1:9000
DT=http://127.0.0.1:8081
DD=http://127.0.0.1:8083
SHIELD_DATA=/var/www/trufflehog-explorer/data
LOCKFILE=/var/lock/blocks-$SVC-deploy.lock

export PATH="$PATH:$HOME/.dotnet/tools"
[ -f /opt/blocks/secrets/scan.env ] && . /opt/blocks/secrets/scan.env

# ---------------------------------------------------------------------------
# single-flight lock (re-exec self under flock, before touching the args)
# ---------------------------------------------------------------------------
if [ -z "${_DEPLOY_LOCKED:-}" ]; then
  mkdir -p "$(dirname "$LOCKFILE")"
  export _DEPLOY_LOCKED=1
  case " $* " in
    *" --wait "*) exec flock -w 1800 "$LOCKFILE" "$0" "$@" ;;
    # -E 75: exit 75 (and only 75) when the lock is already held, so the caller
    # can tell "skipped, someone else is building" from "the build failed".
    *)            exec flock -n -E 75 "$LOCKFILE" "$0" "$@" ;;
  esac
fi

# ---------------------------------------------------------------------------
# args
# ---------------------------------------------------------------------------
STAGES="all"
REF=""
DO_PULL=1
LOCK_WAIT=0
# Cap build parallelism. The box also runs SonarQube, Dependency-Track,
# DefectDojo, Mongo and ~20 service processes; letting MSBuild/vite grab all
# 16 cores is what made concurrent runs thrash.
JOBS="${DEPLOY_JOBS:-4}"

while [ $# -gt 0 ]; do
  case "$1" in
    --stages)  STAGES="${2:-all}"; shift 2 ;;
    --ref)     REF="${2:-}";       shift 2 ;;
    --jobs)    JOBS="${2:-4}";     shift 2 ;;
    --no-pull) DO_PULL=0;          shift ;;
    --wait)    LOCK_WAIT=1;        shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# resource limits for everything below
# ---------------------------------------------------------------------------
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
export MSBUILDDISABLENODEREUSE=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
BUILD_ARGS="-m:$JOBS -nodeReuse:false"
renice -n 10 -p $$ >/dev/null 2>&1
ionice -c3 -p $$   >/dev/null 2>&1

# Never leave build daemons resident after we exit. `dotnet build-server
# shutdown` is scoped to this machine's SDK daemons and is safe to call while
# other repos build; a blind `pkill MSBuild` is not.
cleanup() {
  dotnet build-server shutdown >/dev/null 2>&1
}
trap cleanup EXIT

START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FAIL=0
REDACT='s#(squ_[A-Za-z0-9]+|odt_[A-Za-z0-9_-]+|Token [A-Za-z0-9]+|password=[^ &"]*|//[^:@/]+:[^@/]+@)#[redacted]#g'

want(){
  case ",$STAGES," in
    ,all,|,All,|,ALL,) return 0 ;;
    *",$1,"*)          return 0 ;;
    *)                 return 1 ;;
  esac
}

# Kill a process and everything it spawned (dotnet/npm/docker children).
kill_tree(){
  local pid="$1" sig="${2:-TERM}" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child" "$sig"; done
  kill "-$sig" "$pid" 2>/dev/null
}

# Run a shell function with a wall-clock ceiling. `timeout(1)` cannot wrap a
# shell function, so we fork it and watchdog the subshell's whole process tree.
# Returns 124 on timeout, otherwise the function's own exit code.
run_with_timeout(){
  local tmo="$1"; shift
  local fired; fired="$(mktemp)"
  "$@" &
  local pid=$!
  (
    sleep "$tmo"
    kill -0 "$pid" 2>/dev/null || exit 0
    echo timeout > "$fired"
    kill_tree "$pid" TERM
    sleep 30
    kill_tree "$pid" KILL
  ) &
  local wd=$!
  local rc=0
  wait "$pid" || rc=$?
  kill_tree "$wd" KILL >/dev/null 2>&1
  wait "$wd" 2>/dev/null
  [ -s "$fired" ] && rc=124
  rm -f "$fired"
  return "$rc"
}

# step <name> <timeout-seconds> <function>
step(){
  local name="$1" tmo="$2"; shift 2
  local log; log="$(mktemp)"
  local rc=0
  run_with_timeout "$tmo" "$@" >"$log" 2>&1 || rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "OK   - $name"
  elif [ "$rc" -eq 124 ]; then
    echo "FAIL - $name (timed out after ${tmo}s)"
    sed -E "$REDACT" "$log" | tail -20 | sed 's/^/       /'
    FAIL=1
  else
    echo "FAIL - $name"
    sed -E "$REDACT" "$log" | tail -20 | sed 's/^/       /'
    FAIL=1
  fi
  rm -f "$log"
}

# stage <key> <name> <timeout> <fn>
stage(){
  local key="$1" name="$2" tmo="$3" fn="$4"
  if want "$key"; then
    step "$name" "$tmo" "$fn"
  else
    echo "SKIP - $name (not selected)"
  fi
}

# ---------------------------------------------------------------------------
# stages
# ---------------------------------------------------------------------------
pull(){
  git -C "$REPO" fetch --prune origin inception || return 1
  git -C "$REPO" checkout -f inception          || return 1
  if [ -n "$REF" ]; then
    # Deploy exactly the commit CI was triggered for, when it is on inception.
    if git -C "$REPO" merge-base --is-ancestor "$REF" origin/inception 2>/dev/null; then
      git -C "$REPO" reset --hard "$REF" || return 1
      return 0
    fi
    echo "note: $REF is not on origin/inception (newer push?) - deploying origin/inception tip"
  fi
  git -C "$REPO" reset --hard origin/inception
}

secret(){
  trufflehog git "file://$REPO" --json --no-update > "$SEC/secrets/blocks-$SVC.trufflehog.json" 2>/dev/null
  python3 "$SEC/th_transform.py" "$SVC" < "$SEC/secrets/blocks-$SVC.trufflehog.json" > "$SEC/secrets/blocks-$SVC.gh.json"
  cp "$SEC/secrets/blocks-$SVC.gh.json" "$SHIELD_DATA/blocks-$SVC.trufflehog.json"
}

sca(){
  trivy fs --quiet --format cyclonedx --output "$SEC/sbom/blocks-$SVC.cdx.json" "$REPO"
  sed -E 's/"specVersion"[[:space:]]*:[[:space:]]*"1\.7"/"specVersion": "1.6"/' \
    "$SEC/sbom/blocks-$SVC.cdx.json" > "$SEC/sbom/blocks-$SVC.16.cdx.json"
  curl -fsS -X POST "$DT/api/v1/bom" -H "X-Api-Key: $DT_API_KEY" \
    -F autoCreate=true -F projectName="blocks-$SVC" -F projectVersion=inception \
    -F "bom=@$SEC/sbom/blocks-$SVC.16.cdx.json" -o /dev/null
}

sast(){
  cd "$REPO" || return 1
  local sln; sln="$(ls server/*.sln server/*.slnx 2>/dev/null | head -1)"
  [ -n "$sln" ] || { echo "no solution file under server/"; return 1; }
  dotnet sonarscanner begin /k:"blocks-$SVC" \
    /d:sonar.host.url="$SONAR" /d:sonar.login="$SONAR_TOKEN" \
    /d:sonar.scanner.scanAll=true \
    /d:sonar.exclusions="**/node_modules/**,**/dist/**,**/wwwroot/**,**/bin/**,**/obj/**" || return 1
  # shellcheck disable=SC2086
  dotnet build "$sln" -c Release --nologo -v q $BUILD_ARGS || return 1
  dotnet sonarscanner end /d:sonar.login="$SONAR_TOKEN"
}

dast(){
  mkdir -p "$SEC/dast"; chmod 777 "$SEC/dast"
  docker run --rm --cpus 2 --memory 2g -v "$SEC/dast:/zap/wrk:rw" \
    zaproxy/zap-stable zap-baseline.py \
    -t "https://inception-$SVC.blocksdevelopers.com" -x "zap-$SVC.xml" -I
  curl -fsS -X POST "$DD/api/v2/import-scan/" -H "Authorization: Token $DD_TOKEN" \
    -F "scan_type=ZAP Scan" -F "product_type_name=Blocks Inception" \
    -F "product_name=blocks-$SVC" -F "engagement_name=DAST-inception" \
    -F auto_create_context=true -F active=true -F verified=false -F minimum_severity=Info \
    -F "file=@$SEC/dast/zap-$SVC.xml" -o /dev/null
}

# Client: raw vite build straight into server/Api/wwwroot (see client/vite.config.ts).
# It is then published with the API and served by it - no separate node process,
# no container.
build_client(){
  [ -d "$REPO/client" ] || { echo "no client/ directory - skipping"; return 0; }
  cd "$REPO/client" || return 1
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund --prefer-offline || return 1
  else
    npm install --no-audit --no-fund || return 1
  fi
  npm run build || return 1
  [ -f "$REPO/server/Api/wwwroot/index.html" ] \
    || { echo "client build produced no wwwroot/index.html"; return 1; }
}

build_server(){
  # shellcheck disable=SC2086
  dotnet publish "$REPO/server/Api/Api.csproj"       -c Release -o "$REPO/builds/api"    --nologo $BUILD_ARGS || return 1
  # shellcheck disable=SC2086
  dotnet publish "$REPO/server/Worker/Worker.csproj" -c Release -o "$REPO/builds/worker" --nologo $BUILD_ARGS || return 1
}

restart_services(){
  local r0a r0w r1a r1w
  r0a=$(systemctl show "blocks-$SVC-api"    -p NRestarts --value)
  r0w=$(systemctl show "blocks-$SVC-worker" -p NRestarts --value)
  systemctl restart "blocks-$SVC-api" "blocks-$SVC-worker" || return 1
  sleep 10
  r1a=$(systemctl show "blocks-$SVC-api"    -p NRestarts --value)
  r1w=$(systemctl show "blocks-$SVC-worker" -p NRestarts --value)
  systemctl is-active --quiet "blocks-$SVC-api"    || { echo "api not active after restart";    return 1; }
  systemctl is-active --quiet "blocks-$SVC-worker" || { echo "worker not active after restart"; return 1; }
  [ "$r1a" = "$r0a" ] || { echo "api crash-looped after restart (restarts $r0a->$r1a)";       return 1; }
  [ "$r1w" = "$r0w" ] || { echo "worker crash-looped after restart (restarts $r0w->$r1w)";    return 1; }
}

# Verify the running app actually serves the freshly built client.
smoke(){
  local i code
  for i in $(seq 1 20); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/" || true)
    case "$code" in
      200|204|301|302|401|403) echo "http $code from 127.0.0.1:$PORT (attempt $i)"; return 0 ;;
    esac
    sleep 3
  done
  echo "no healthy response from 127.0.0.1:$PORT (last code: ${code:-none})"
  return 1
}

deploy(){
  build_client   || return 1
  build_server   || return 1
  restart_services || return 1
  smoke
}

# graphify knowledge graph - best-effort, never fails the deploy.
graphify(){
  export PATH="$HOME/.local/bin:$PATH"
  (
    set +e
    if ! command -v graphify >/dev/null 2>&1; then
      command -v pipx >/dev/null 2>&1 || {
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq && apt-get install -y -qq pipx
      }
      pipx install graphifyy
    fi
    if command -v graphify >/dev/null 2>&1; then
      cd "$REPO" || exit 0
      graphify install --platform codex --project
      graphify extract "$REPO" --code-only
    else
      echo "graphify unavailable - skipping graph build (deploy unaffected)"
    fi
  ) </dev/null >/tmp/graphify-$SVC.log 2>&1
  return 0
}

status(){
  echo "=== service status (latest build) ==="
  for u in "blocks-$SVC-api" "blocks-$SVC-worker"; do
    local st sub since nr
    st=$(systemctl is-active "$u" 2>/dev/null)
    sub=$(systemctl show "$u" -p SubState --value 2>/dev/null)
    since=$(systemctl show "$u" -p ActiveEnterTimestamp --value 2>/dev/null)
    nr=$(systemctl show "$u" -p NRestarts --value 2>/dev/null)
    printf "  %-22s %s (%s) since %s | restarts=%s\n" "$u" "$st" "$sub" "${since:-n/a}" "$nr"
  done
}

# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------
echo "blocks-$SVC inception pipeline | stages=$STAGES jobs=$JOBS ref=${REF:-origin/inception}"
echo "--------------------------------------------------"

if [ "$DO_PULL" -eq 1 ]; then
  step "pull inception" 300 pull
  [ "$FAIL" -eq 0 ] || { echo "RESULT: FAILURE - could not update working tree"; exit 1; }
else
  echo "SKIP - pull inception (--no-pull)"
fi

stage secret   "secret scan (trufflehog -> shield)"    900  secret
stage sca      "sca scan (trivy -> dependency-track)"  900  sca
stage sast     "sast scan (sonarqube)"                 2400 sast
stage dast     "dast scan (zap -> defectdojo)"         1800 dast
stage deploy   "deploy (client build + api/worker + restart)" 2400 deploy
stage graphify "graphify (code graph)"                 1200 graphify

echo "--------------------------------------------------"
status
echo "--------------------------------------------------"
END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
if [ "$FAIL" -eq 0 ]; then echo "RESULT: SUCCESS - all selected stages passed"; else echo "RESULT: FAILURE - see FAIL step(s) above"; fi
echo "commit:  $(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo n/a)"
echo "started: $START"
echo "ended:   $END"
exit "$FAIL"
