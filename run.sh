#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CLIENT_DIR="$SCRIPT_DIR/client"
E2E_DIR="$SCRIPT_DIR/e2e"
SERVER_DIR="$SCRIPT_DIR/server"
SOLUTION="$SERVER_DIR/BlocksOS.sln"
API_PROJECT="$SCRIPT_DIR/server/Api/Api.csproj"
WORKER_PROJECT="$SCRIPT_DIR/server/Worker/Worker.csproj"
WWWROOT_DIR="$SCRIPT_DIR/server/Api/wwwroot"

API_PORT=5000
FRONTEND_PORT=4000

# Ensure SSL vars are explicitly in scope for Vite
export OS_SSL_CERT="${OS_SSL_CERT:-}"
export OS_SSL_KEY="${OS_SSL_KEY:-}"

API_PID=""
WORKER_PID=""

usage() {
cat <<EOF
Usage: $0 [OPTION]

Options:
  -a, --all         Build frontend + run API + Worker
  -b, --backend     Run .NET API
  -w, --worker      Run .NET Worker
  -f, --frontend    Run frontend dev server
  -k, --kill-port   Kill API port ($API_PORT)
  -n, --npm         Run npm command inside client/
  -h, --help        Show help

Tests:
  -tf, --test-fe    Frontend unit tests (client/: build + vitest)
  -te, --test-e2e   End-to-end tests (e2e/: playwright)
  -tb, --test-be    Backend unit tests (server/: clean + build + dotnet test)
  -ta, --test-all   Frontend unit + backend unit + e2e

Env:
  SKIP_BUILD=1      Skip the client build step in --test-fe

Examples:
  $0 -a
  $0 -b
  $0 -f
  $0 -k
  $0 -tf
  $0 -tb
  $0 -te
EOF
exit 1
}

# ---------- PORT CLEANUP ----------
free_port() {
    local PORT=$1

    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids="$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)"

        if [ -n "$pids" ]; then
            echo "Port $PORT in use by: $pids — killing..."
            for pid in $pids; do
                kill "$pid" 2>/dev/null || true
            done
            sleep 1
        fi
    else
        local pids
        pids="$(netstat -ano 2>/dev/null | grep ":$PORT" | awk '{print $5}' | sort -u || true)"

        if [ -n "$pids" ]; then
            echo "Port $PORT in use by: $pids — killing..."
            for pid in $pids; do
                taskkill //PID "$pid" //F >/dev/null 2>&1 || true
            done
        fi
    fi
}

# ---------- CLEANUP ----------
cleanup() {
    echo "Shutting down..."

    [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
    [ -n "${WORKER_PID:-}" ] && kill "$WORKER_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# ---------- FRONTEND ----------
run_frontend() {
    echo "Starting frontend..."

    if [ ! -d "$CLIENT_DIR/node_modules" ]; then
        echo "Installing dependencies..."
        (cd "$CLIENT_DIR" && npm clean-install)
    fi

    free_port $FRONTEND_PORT

    cd "$CLIENT_DIR" && npm run dev
}

build_frontend() {
    echo "Building frontend..."

    pushd "$CLIENT_DIR" > /dev/null
    npm install
    npm run build
    popd > /dev/null

    mkdir -p "$WWWROOT_DIR"

    if [ -d "$CLIENT_DIR/dist" ]; then
        echo "Syncing dist → wwwroot..."
        if command -v rsync >/dev/null 2>&1; then
            rsync -a --delete "$CLIENT_DIR/dist/" "$WWWROOT_DIR/"
        else
            rm -rf "$WWWROOT_DIR"/*
            cp -r "$CLIENT_DIR/dist/"* "$WWWROOT_DIR/"
        fi
    fi
}

# ---------- BACKEND ----------
# HTTPS is driven by the machine env vars OS_SSL_CERT / OS_SSL_KEY.
# Both set + both files present -> HTTPS on $API_PORT; otherwise -> HTTP (fallback).
configure_backend_tls() {
    if [ -n "${OS_SSL_CERT:-}" ] && [ -n "${OS_SSL_KEY:-}" ] \
       && [ -f "$OS_SSL_CERT" ] && [ -f "$OS_SSL_KEY" ]; then
        export Kestrel__Certificates__Default__Path="$OS_SSL_CERT"
        export Kestrel__Certificates__Default__KeyPath="$OS_SSL_KEY"
        export ASPNETCORE_URLS="https://0.0.0.0:$API_PORT"
        echo "Backend TLS: HTTPS on $API_PORT"
    else
        export ASPNETCORE_URLS="http://0.0.0.0:$API_PORT"
        echo "Backend TLS: cert env not set/found — HTTP on $API_PORT"
    fi
}

run_backend() {
    configure_backend_tls
    echo "Running .NET API on port $API_PORT..."
    # Pass the URL on the command line: it has higher precedence than the
    # launchSettings.json applicationUrl, which would otherwise override
    # the ASPNETCORE_URLS we exported above.
    dotnet run --project "$API_PROJECT" -- --urls "$ASPNETCORE_URLS"
}

run_worker() {
    echo "Running .NET Worker..."
    dotnet run --project "$WORKER_PROJECT"
}

# ---------- TESTS ----------
ensure_node_modules() {
    local dir=$1
    if [ ! -d "$dir/node_modules" ]; then
        echo "Installing dependencies in $(basename "$dir")..."
        (cd "$dir" && npm clean-install)
    fi
}

# Vitest does not read dist/, so the build is only a TypeScript gate.
# Skip it with SKIP_BUILD=1 for a faster loop.
test_frontend() {
    echo "=== Frontend unit tests ==="

    ensure_node_modules "$CLIENT_DIR"

    if [ "${SKIP_BUILD:-0}" = "1" ]; then
        echo "SKIP_BUILD=1 — skipping client build."
    else
        (cd "$CLIENT_DIR" && npm run build)
    fi

    (cd "$CLIENT_DIR" && npm run test)
}

# Playwright starts the app itself (webServer: run.sh -b) and needs e2e/.env.e2e.
test_e2e() {
    echo "=== E2E tests ==="

    if [ ! -f "$E2E_DIR/.env.e2e" ]; then
        echo "Missing $E2E_DIR/.env.e2e — copy .env.e2e.example and set E2E_BASE_URL + credentials."
        exit 1
    fi

    ensure_node_modules "$E2E_DIR"

    (cd "$E2E_DIR" && npx playwright install --no-shell chromium)
    (cd "$E2E_DIR" && npm run test)
}

test_backend() {
    echo "=== Backend unit tests ==="

    dotnet clean "$SOLUTION"
    dotnet build "$SOLUTION"
    dotnet test "$SOLUTION" --no-build
}

test_all() {
    test_frontend
    test_backend
    test_e2e
}

# ---------- MAIN ----------
if [ $# -eq 0 ]; then
    usage
fi

case "$1" in

    -k|--kill-port)
        free_port $API_PORT
        echo "Port $API_PORT cleared."
        ;;

    -f|--frontend)
        run_frontend
        ;;

    -b|--backend)
        free_port $API_PORT
        (cd "$SCRIPT_DIR" && run_backend) &
        API_PID=$!
        wait $API_PID
        ;;

    -w|--worker)
        (cd "$SCRIPT_DIR" && run_worker)
        ;;

    -a|--all)
        free_port $API_PORT

        build_frontend

        echo "Starting services..."

        (cd "$SCRIPT_DIR" && run_backend) &
        API_PID=$!

        (cd "$SCRIPT_DIR" && run_worker) &
        WORKER_PID=$!

        wait $API_PID $WORKER_PID
        ;;

    -tf|--test-fe)
        test_frontend
        ;;

    -te|--test-e2e)
        test_e2e
        ;;

    -tb|--test-be)
        test_backend
        ;;

    -ta|--test-all)
        test_all
        ;;

    -n|--npm)
        shift
        [ $# -eq 0 ] && echo "Usage: $0 -n <args>" && exit 1
        (cd "$CLIENT_DIR" && npm "$@")
        ;;

    -h|--help)
        usage
        ;;

    *)
        usage
        ;;

esac





# #!/bin/bash
# set -euo pipefail

# SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# CLIENT_DIR="$SCRIPT_DIR/client"
# API_PROJECT="$SCRIPT_DIR/server/Api/Api.csproj"
# WORKER_PROJECT="$SCRIPT_DIR/server/Worker/Worker.csproj"
# WWWROOT_DIR="$SCRIPT_DIR/server/Api/wwwroot"

# API_PORT=5000
# FRONTEND_PORT=4000

# CERT_DIR="$SCRIPT_DIR/../local_ssl_certificate/os"
# export OS_SSL_CERT="${OS_SSL_CERT:-$CERT_DIR/dev-os.blocksdevelopers.com.pem}"
# export OS_SSL_KEY="${OS_SSL_KEY:-$CERT_DIR/dev-os.blocksdevelopers.com-key.pem}"
# export OS_SSL_PFX="${OS_SSL_PFX:-$CERT_DIR/dev-os.pfx}"
# export OS_SSL_PFX_PASSWORD="${OS_SSL_PFX_PASSWORD:-12345}"

# API_PID=""
# WORKER_PID=""

# usage() {
# cat <<EOF
# Usage: $0 [OPTION]

# Options:
#   -a, --all         Build frontend + run API + Worker
#   -b, --backend     Run .NET API
#   -w, --worker      Run .NET Worker
#   -f, --frontend    Run frontend dev server
#   -k, --kill-port   Kill API port ($API_PORT)
#   -n, --npm         Run npm command inside client/
#   -h, --help        Show help

# Examples:
#   $0 -a
#   $0 -b
#   $0 -f
#   $0 -k
# EOF
# exit "${1:-1}"
# }

# # ---------- PORT CLEANUP ----------
# free_port() {
#     local PORT=$1

#     if command -v lsof >/dev/null 2>&1; then
#         local pids
#         pids="$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)"

#         if [ -n "$pids" ]; then
#             echo "Port $PORT in use by: $pids — killing..."
#             for pid in $pids; do
#                 kill "$pid" 2>/dev/null || true
#             done
#             sleep 1
#         fi
#     else
#         local pids
#         pids="$(netstat -ano 2>/dev/null | grep ":$PORT" | awk '{print $5}' | sort -u || true)"

#         if [ -n "$pids" ]; then
#             echo "Port $PORT in use by: $pids — killing..."
#             for pid in $pids; do
#                 taskkill //PID "$pid" //F >/dev/null 2>&1 || true
#             done
#         fi
#     fi
# }

# # ---------- CLEANUP ----------
# cleanup() {
#     if [ -z "${API_PID:-}" ] && [ -z "${WORKER_PID:-}" ]; then
#         return
#     fi

#     echo "Shutting down..."

#     [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
#     [ -n "${WORKER_PID:-}" ] && kill "$WORKER_PID" 2>/dev/null || true
# }

# trap cleanup EXIT INT TERM

# load_repo_env() {
#     if [ -f "$SCRIPT_DIR/.env" ]; then
#         set -a
#         # shellcheck disable=SC1091
#         source "$SCRIPT_DIR/.env"
#         set +a
#     fi
# }

# # ---------- FRONTEND ----------
# run_frontend() {
#     echo "Starting frontend..."

#     if [ ! -d "$CLIENT_DIR/node_modules" ]; then
#         echo "Installing dependencies..."
#         (cd "$CLIENT_DIR" && npm clean-install)
#     fi

#     free_port $FRONTEND_PORT

#     local resolved_ip
#     resolved_ip="$(getent ahostsv4 dev-os.blocksdevelopers.com 2>/dev/null | awk 'NR==1 {print $1}' || true)"
#     if [ "$resolved_ip" = "127.0.0.1" ]; then
#         (cd "$CLIENT_DIR" && npm run dev)
#     else
#         echo "dev-os.blocksdevelopers.com does not resolve to 127.0.0.1 (got: ${resolved_ip:-none})."
#         echo "Add to /etc/hosts: 127.0.0.1 dev-os.blocksdevelopers.com"
#         echo "Starting Vite on 127.0.0.1:$FRONTEND_PORT instead..."
#         (cd "$CLIENT_DIR" && npm exec vite -- --port "$FRONTEND_PORT" --host 127.0.0.1)
#     fi
# }

# build_frontend() {
#     echo "Building frontend..."

#     pushd "$CLIENT_DIR" > /dev/null
#     npm install
#     npm run build
#     popd > /dev/null

#     mkdir -p "$WWWROOT_DIR"

#     if [ -d "$CLIENT_DIR/dist" ]; then
#         echo "Syncing dist → wwwroot..."
#         if command -v rsync >/dev/null 2>&1; then
#             rsync -a --delete "$CLIENT_DIR/dist/" "$WWWROOT_DIR/"
#         else
#             rm -rf "$WWWROOT_DIR"/*
#             cp -r "$CLIENT_DIR/dist/"* "$WWWROOT_DIR/"
#         fi
#     fi
# }

# # ---------- BACKEND ----------
# # Kestrel cannot load mkcert PEM key pairs reliably — use dev-os.pfx for the API.
# configure_backend_tls() {
#     if [ -f "$OS_SSL_PFX" ]; then
#         export Kestrel__Endpoints__Https__Certificate__Path="$(cd "$(dirname "$OS_SSL_PFX")" && pwd)/$(basename "$OS_SSL_PFX")"
#         export Kestrel__Endpoints__Https__Certificate__Password="$OS_SSL_PFX_PASSWORD"
#         unset Kestrel__Endpoints__Https__Certificate__KeyPath
#         echo "Backend TLS: PFX certificate ($Kestrel__Endpoints__Https__Certificate__Path)"
#         return
#     fi

#     echo "Backend TLS: no certificate found under $CERT_DIR"
#     echo "Run: $CERT_DIR/setup.sh"
#     exit 1
# }

# run_backend() {
#     load_repo_env
#     configure_backend_tls

#     export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
#     export BLOCKS_VAULT_TYPE="${BLOCKS_VAULT_TYPE:-Azure}"
#     export ProdVaultUrl="${ProdVaultUrl:-https://blocks-keyvault-dev.vault.azure.net/}"

#     echo "Running .NET API on https://dev-os.blocksdevelopers.com:$API_PORT ..."
#     dotnet run --project "$API_PROJECT" --launch-profile Api
# }

# run_worker() {
#     load_repo_env
#     export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
#     export BLOCKS_VAULT_TYPE="${BLOCKS_VAULT_TYPE:-Azure}"
#     export ProdVaultUrl="${ProdVaultUrl:-https://blocks-keyvault-dev.vault.azure.net/}"

#     echo "Running .NET Worker..."
#     dotnet run --project "$WORKER_PROJECT"
# }

# # ---------- MAIN ----------
# if [ $# -eq 0 ]; then
#     usage
# fi

# case "$1" in

#     -k|--kill-port)
#         free_port $API_PORT
#         echo "Port $API_PORT cleared."
#         ;;

#     -f|--frontend)
#         run_frontend
#         ;;

#     -b|--backend)
#         free_port $API_PORT
#         (cd "$SCRIPT_DIR" && run_backend) &
#         API_PID=$!
#         wait $API_PID
#         ;;

#     -w|--worker)
#         (cd "$SCRIPT_DIR" && run_worker)
#         ;;

#     -a|--all)
#         free_port $API_PORT

#         build_frontend

#         echo "Starting services..."

#         (cd "$SCRIPT_DIR" && run_backend) &
#         API_PID=$!

#         (cd "$SCRIPT_DIR" && run_worker) &
#         WORKER_PID=$!

#         wait $API_PID $WORKER_PID
#         ;;

#     -n|--npm)
#         shift
#         [ $# -eq 0 ] && echo "Usage: $0 -n <args>" && exit 1
#         (cd "$CLIENT_DIR" && npm "$@")
#         ;;

#     -h|--help)
#         usage 0
#         ;;

#     *)
#         usage
#         ;;

# esac
