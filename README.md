# Blocks OS

ASP.NET Core + React (Vite, TypeScript) application: **Genesis-backed API**, **background worker**, and a **SPA** built into `server/Api/wwwroot` so Kestrel can serve the UI and backend from one host. Node/npm are used for the client toolchain (install, dev server, production build).

## Project structure

```
blocks-os/
├── client/                         # React + Vite + TypeScript
│   ├── app/                        # Application source
│   │   ├── cross-modules/          # Feature areas (idp, ai, communication, devops, identifier,
│   │   │                           #   lmt, localization, secrets, storage, utilities)
│   │   ├── routes/, pages/         # Route modules and pages
│   │   ├── layouts/, components/   # Shell UI, shared components
│   │   ├── hooks/, lib/, services/, providers/
│   │   ├── main.tsx, router.tsx
│   │   └── …
│   ├── public/                     # Static assets
│   ├── index.html
│   ├── vite.config.ts              # build.outDir → ../server/Api/wwwroot; `BLOCKS_*` env prefix
│   ├── package.json
│   └── .env.example                # Copy to .env (see below)
├── server/
│   ├── Api/                        # Web host (Kestrel, Genesis, controllers, static SPA)
│   │   ├── Controllers/            # HTTP API (attribute routes; `api` prefix via convention)
│   │   ├── wwwroot/                # Vite output (generated; do not edit by hand)
│   │   ├── Program.cs
│   │   ├── Api.csproj
│   │   └── GlobalApiRoutePrefixConvention.cs
│   ├── Worker/                     # Background worker (message consumers, …)
│   ├── LmtManagedServiceWorker/    # Managed-service worker for logs, metrics and traces
│   ├── Cloud.DomainService/
│   ├── Cloud.LmtService/
│   ├── Configuration.DomainService/
│   ├── Identifier.DomainService/
│   ├── Secrets.DomainService/
│   ├── XUnitTest/                  # Unit tests
│   └── BlocksOS.sln                # Solution: Api, domain libraries, Workers, XUnitTest
├── e2e/                            # Playwright end-to-end tests (see e2e/README.md)
├── scripts/                        # deploy.sh entry point
├── run.sh                          # Build/run helpers (Unix/macOS; see below)
├── run.ps1                         # Same role on Windows (PowerShell; see below)
├── LICENSE
└── README.md
```

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (`TargetFramework` is `net10.0` in `server/Directory.Build.props`)
- [Node.js LTS](https://nodejs.org/) (for `npm install`, `npm run dev`, `npm run build`)
- [Docker](https://docs.docker.com/get-docker/) with [Docker Compose](https://docs.docker.com/compose/) (for local backing services; see below)

### Local infrastructure

To run Blocks OS **locally**, clone **[blocks-infra](https://github.com/SELISEdigitalplatforms/blocks-infra)** and bring up its **Docker Compose** stack (for example **`docker compose up -d`**, using the compose file and options described in that repository). Start that stack **before** or **alongside** the API and Worker from this repo so local dependencies (databases, queues, and so on) are available.

## How to run

Both **`run.sh`** (Bash) and **`run.ps1`** (PowerShell) live at the repo root. They **require an option**; calling them with no recognized flags prints usage and exits.

**Ports:** both scripts assume API port **5000**. `run.sh` also uses **4000** for `npm run dev` when you pass **`-f`** (see `run.sh`). `server/Api/Properties/launchSettings.json` may differ for IDE launches; use the URL your process prints.

### Options (same flags, different invocation)

| Option | Role |
|--------|------|
| **`-a`**, **`--all`** | Install/build client, sync **`client/dist`** → **`server/Api/wwwroot`**, then start **API** and **Worker** |
| **`-b`**, **`--backend`** | Run **API** only (`dotnet run` on `server/Api/Api.csproj`) |
| **`-w`**, **`--worker`** | Run **Worker** only (`server/Worker/Worker.csproj`) |
| **`-f`**, **`--frontend`** | Vite dev server: **`npm run dev`** in **`client/`** (`run.sh` installs dependencies only if **`node_modules`** is missing; **`run.ps1`** runs **`npm install`** every time) |
| **`-k`**, **`--kill-port`** | Stop whatever is listening on the API port (**5000**) |
| **`-n`**, **`--npm`** *args…* | Run **`npm`** in **`client/`** (e.g. `run test`, `run build`) |
| **`-tf`**, **`--test-fe`** | Frontend unit tests in **`client/`** (build as a TS gate, then **vitest**; `SKIP_BUILD=1` skips the build) |
| **`-te`**, **`--test-e2e`** | End-to-end tests in **`e2e/`** (**Playwright**; starts the API itself, needs **`e2e/.env.e2e`**) |
| **`-tb`**, **`--test-be`** | Backend unit tests: **`dotnet clean`** → **`build`** → **`test`** on **`server/BlocksOS.sln`** |
| **`-ta`**, **`--test-all`** | FE unit → BE unit → E2E, stopping at the first failure |
| **`-h`**, **`--help`** | Show usage |

**Windows only (`run.ps1`):** **`-d`** / **`--dotnet`** *args…* runs **`dotnet`** from the repo root (for example restore, build, or test commands).

### Unix / macOS (`run.sh`)

```bash
./run.sh -a              # full stack (build + API + Worker in this shell)
./run.sh -b              # API only (frees port 5000 first)
./run.sh -f              # Vite dev server
./run.sh -n run test     # npm in client/
./run.sh -tf             # frontend unit tests
./run.sh -tb             # backend unit tests
./run.sh -te             # e2e tests
./run.sh -ta             # everything
```

`run.sh` syncs the built SPA with **`rsync`** (`dist/` → `wwwroot/`). For **`-a`**, the API and Worker run as background jobs in the same terminal; **Ctrl+C** runs the script’s cleanup trap.

### Windows (`run.ps1`)

```powershell
.\run.ps1 -a             # build + start API and Worker in separate windows
.\run.ps1 -b             # API only (restore + free port 5000 first)
.\run.ps1 -f             # Vite dev server
.\run.ps1 -n run test    # npm in client/
.\run.ps1 -d test server/XUnitTest/XUnitTest.csproj
.\run.ps1 -tf            # frontend unit tests
.\run.ps1 -tb            # backend unit tests
.\run.ps1 -te            # e2e tests
.\run.ps1 -ta            # everything
```

`run.ps1` syncs **`dist`** → **`wwwroot`** with **`robocopy`**. It runs **`dotnet restore`** on the Api and Worker projects before **`-b`**, **`-w`**, and **`-a`**. With **`-a`**, two extra PowerShell windows open (one for the API, one for the Worker); press **Enter** in the original window to stop those processes.

### Without the scripts

If the client is already built into **`wwwroot`**:

```bash
dotnet run --project server/Api/Api.csproj
```

### Client environment (`BLOCKS_*`)

Vite exposes env vars prefixed with **`BLOCKS_`** (see **`client/vite.config.ts`**). Copy **`client/.env.example`** → **`client/.env`** and set values as needed:

- **`BLOCKS_OS_BASE_URL`**: base URL of this service; when set it also enables the Vite dev proxy (`client/vite.config.ts`).
- **`BLOCKS_IAM_BASE_URL`**, **`BLOCKS_IAM_CLIENT_ID`**, **`BLOCKS_IAM_CALLBACK_URL`**: IAM endpoint and OIDC client for the sign-in flow.
- **`BLOCKS_<SERVICE>_BASE_URL` / `_CALLBACK_URL` / `_CLIENT_ID`**: per-service URLs and OIDC client ids for the sibling Blocks apps the console links to (data, logic, monitor, release, studio, utilities, localization, agents).
- **`BLOCKS_X_BLOCKS_KEY`**, **`BLOCKS_GOOGLE_SITE_KEY`**, **`BLOCKS_CONSTRUCT_URL`**, **`BLOCKS_GITHUB_SSO_CLIENT_ID`**, **`BLOCKS_BASE_DOMAIN`**: tenant key, captcha site key, construct URL, GitHub SSO client id and base domain used across the UI.

The full key list with comments is in `client/.env.example`.

Rebuild the client (`npm run build` in **`client/`** or **`./run.sh -a`** / **`.\run.ps1 -a`**) after changing env for **production** bundles.

## Production / publish

Build the client, then publish the API (ensure **`wwwroot`** contains the built SPA if you want the UI in the output):

```bash
(cd client && npm install && npm run build)
dotnet publish server/Api/Api.csproj -c Release -o ./publish
```

No Node process is required on the server at runtime.

## Tests

Run from the repository root:

```bash
# backend unit tests (xUnit); the solution is server/BlocksOS.sln
dotnet test server/XUnitTest/XUnitTest.csproj

# frontend unit tests (Vitest)
npm --prefix client run test

# end-to-end tests (Playwright); needs a reachable app and e2e/.env.e2e,
# see e2e/README.md for setup and target modes
npm --prefix e2e run test
```

Coverage:

```bash
dotnet test server/XUnitTest/XUnitTest.csproj --collect:"XPlat Code Coverage"
npm --prefix client run test:coverage
```

## Deployment

`scripts/deploy.sh` is the maintainer deploy-and-scan pipeline for the dev host: it syncs the latest `inception`, builds and publishes the Api and Worker projects, restarts their systemd services, and then runs the security scans (SAST, SCA and DAST) against the deployed instance using scanners in the maintainers' environment. It is not a general-purpose installer.

## API and routing

- Controllers live under **`server/Api/Controllers/`** (e.g. authentication, IAM, MFA, mail, storage, traces, projects). Route templates omit the **`api`** segment in code; **`GlobalApiRoutePrefixConvention`** in **`Program.cs`** adds the **`api`** prefix for attribute-routed controllers.
- **`/api` is reserved for the HTTP API** in the integrated setup; keep client-side routes from colliding with API paths.

### Version endpoint

- **`GET /api/version`** returns the running API assembly version. No authentication is required.
- Response body:

  ```json
  { "version": "1.0.0.0" }
  ```

  The value is read from the running assembly (`Assembly.GetExecutingAssembly().GetName().Version`), so it reflects whatever version the deployed build was stamped with.

## Contributing and security

- Contribution conventions and workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Reporting a vulnerability: [SECURITY.md](SECURITY.md)
- Community standards: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

See [LICENSE](LICENSE).
