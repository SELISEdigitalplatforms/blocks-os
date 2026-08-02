#!/usr/bin/env bash
# blocks-os :: inception deploy (DEPLOY ONLY)
#
# Raw-code deploy: the client is built with npm/vite into server/Api/wwwroot,
# the server is built with `dotnet publish` and run by systemd. No container
# image is built, pushed or pulled.
#
# Scanning does NOT happen here. SAST, SCA, DAST and the TruffleHog history
# scan all run on GitHub-hosted runners and publish to the inception-*
# portals - keeping them off this box is what stopped the CPU/RAM choke.
#
# Usage:
#   scripts/deploy.sh [--ref <sha>] [--no-pull] [--wait] [--jobs N]
#                     [--skip-client] [--skip-graphify]
#
# Exit codes:
#   0  deploy succeeded
#   1  deploy failed
#  75  another deploy already holds the lock (skipped, not a failure)

set -uo pipefail
export HOME="${HOME:-/root}"

SVC=os
PORT=5002
REPO=/opt/blocks/code/blocks-$SVC
LOCKFILE=/var/lock/blocks-$SVC-deploy.lock
export PATH="$PATH:$HOME/.dotnet/tools"

# ---------------------------------------------------------------------------
# args
# ---------------------------------------------------------------------------
REF=""
DO_PULL=1
DO_CLIENT=1
DO_GRAPHIFY=1
LOCK_WAIT=0
# Cap build parallelism: this box also runs SonarQube, Dependency-Track,
# DefectDojo, Mongo and ~20 service processes.
JOBS="${DEPLOY_JOBS:-4}"

while [ $# -gt 0 ]; do
  case "$1" in
    --ref)           REF="${2:-}";   shift 2 ;;
    --jobs)          JOBS="${2:-4}"; shift 2 ;;
    --no-pull)       DO_PULL=0;      shift ;;
    --wait)          LOCK_WAIT=1;    shift ;;
    --skip-client)   DO_CLIENT=0;    shift ;;
    --skip-graphify) DO_GRAPHIFY=0;  shift ;;
    -h|--help)       sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# single-flight lock
#
# The lock is held on a known fd (9) by THIS process only. Every child is
# spawned with 9>&- so nothing else can inherit it - otherwise a hard-killed
# run leaves an orphaned child holding the lock and wedges every later deploy.
# ---------------------------------------------------------------------------
mkdir -p "$(dirname "$LOCKFILE")"
exec 9>"$LOCKFILE" || { echo "cannot open $LOCKFILE" >&2; exit 1; }
if [ "$LOCK_WAIT" -eq 1 ]; then
  flock -w 1800 9 || { echo "timed out waiting for the deploy lock"; exit 75; }
else
  flock -n 9 || {
    echo "SKIP: another blocks-$SVC deploy is already running (lock: $LOCKFILE)"
    exit 75
  }
fi

# ---------------------------------------------------------------------------
# resource limits
# ---------------------------------------------------------------------------
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
export MSBUILDDISABLENODEREUSE=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=3072}"
BUILD_ARGS="-m:$JOBS -nodeReuse:false"
renice -n 10 -p $$ >/dev/null 2>&1
ionice -c3 -p $$   >/dev/null 2>&1

# Never leave build daemons resident. Scoped to the SDK's own daemons, unlike a
# blind `pkill MSBuild` which would hit other repos building on this box.
trap 'dotnet build-server shutdown >/dev/null 2>&1' EXIT

START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FAIL=0

# step <name> <function>
#
# No internal watchdog: a self-managed timeout needs a recursive process-tree
# killer, and that is exactly the kind of thing that can fork-bomb the box.
# The GitHub job timeout bounds the whole run instead.
step(){
  local name="$1"; shift
  local log; log="$(mktemp)"
  local rc=0
  "$@" >"$log" 2>&1 || rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "OK   - $name"
  else
    echo "FAIL - $name"
    tail -25 "$log" | sed 's/^/       /'
    FAIL=1
  fi
  rm -f "$log"
}

# ---------------------------------------------------------------------------
# steps
# ---------------------------------------------------------------------------
pull(){
  git -C "$REPO" fetch --prune origin inception || return 1
  git -C "$REPO" checkout -f inception          || return 1
  if [ -n "$REF" ]; then
    # Deploy exactly the commit CI was triggered for, when it is still on the branch.
    if git -C "$REPO" merge-base --is-ancestor "$REF" origin/inception 2>/dev/null; then
      git -C "$REPO" reset --hard "$REF" || return 1
      return 0
    fi
    echo "note: $REF is not on origin/inception (newer push?) - deploying branch tip"
  fi
  git -C "$REPO" reset --hard origin/inception

}

# Client: vite build straight into server/Api/wwwroot (see client/vite.config.ts),
# then published with the API and served by it - no separate node process.
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
  [ "$r1a" = "$r0a" ] || { echo "api crash-looped after restart (restarts $r0a->$r1a)";    return 1; }
  [ "$r1w" = "$r0w" ] || { echo "worker crash-looped after restart (restarts $r0w->$r1w)"; return 1; }
}

# Confirm the running app actually serves the freshly built client.
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
  if [ "$DO_CLIENT" -eq 1 ]; then build_client || return 1; else echo "client build skipped"; fi
  build_server     || return 1
  restart_services || return 1
  smoke
}

# graphify knowledge graph - best-effort, never fails the deploy.
graphify(){
  export PATH="$HOME/.local/bin:$PATH"
  (
    set +e
    if command -v graphify >/dev/null 2>&1; then
      cd "$REPO" || exit 0
      graphify install --platform codex --project
      graphify extract "$REPO" --code-only
    else
      echo "graphify not installed - skipping graph build (deploy unaffected)"
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
echo "blocks-$SVC deploy | jobs=$JOBS ref=${REF:-origin/inception}"
echo "--------------------------------------------------"

if [ "$DO_PULL" -eq 1 ]; then
  step "pull inception" pull
  [ "$FAIL" -eq 0 ] || { echo "RESULT: FAILURE - could not update working tree"; exit 1; }
else
  echo "SKIP - pull inception (--no-pull)"
fi

step "deploy (client build + api/worker + restart)" deploy
[ "$DO_GRAPHIFY" -eq 1 ] && step "graphify (code graph)" graphify

echo "--------------------------------------------------"
status
echo "--------------------------------------------------"
END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
if [ "$FAIL" -eq 0 ]; then echo "RESULT: SUCCESS"; else echo "RESULT: FAILURE - see FAIL step(s) above"; fi
echo "commit:  $(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo n/a)"
echo "started: $START"
echo "ended:   $END"
exit "$FAIL"
