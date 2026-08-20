/**
 * The onboarding brief handed to a coding agent, still carrying its
 * `{{PLACEHOLDER}}` tokens - `resolveOnboardingGuide` fills them in from the
 * selected project.
 *
 * Held as a plain string constant rather than a raw file import, so it travels
 * with the module graph and needs nothing bundler-specific. Backticks and
 * backslashes are escaped for the template literal; the text itself is ordinary
 * markdown.
 */
export const ONBOARDING_GUIDE_TEMPLATE = `# Starting a project on SELISE Blocks

You are starting work on an existing SELISE Blocks project. The portal already
provided the project values below. Use them exactly; do not ask the user for a
project key, domain, API URL, OIDC client id, token, or secret.

## Project context

x-blocks-key:
{{X_BLOCKS_KEY}}

App domain:
{{APP_DOMAIN}}

Local host mapping:
\`127.0.0.1  {{APP_HOST}}\`

Default Blocks API URL for browser app config:
\`{{BLOCKS_API_URL}}\`

## Start safely

\`\`\`bash
blocks --version
npm view @seliseblocks/cli-os version
blocks auth status --json
blocks doctor --json
blocks skill list --json
\`\`\`

If the CLI is missing or older than the published version, stop and ask before
installing or updating with \`npm install -g @seliseblocks/cli-os@latest\`:

\`\`\`bash
npm install -g @seliseblocks/cli-os@latest
\`\`\`

If login is needed, run \`blocks login\`, show the verification URL/code, then
verify with \`blocks auth status --json\`. Never read CLI token/config/secret
files directly.

Select and verify this project:

\`\`\`bash
blocks use {{X_BLOCKS_KEY}}
blocks projects get --json
\`\`\`

## Use Blocks skills

Before feature work, load the relevant skill and follow it as the source of
truth. Use onboarding whenever login, project, app, or OIDC state is unclear.

\`\`\`bash
blocks skill show blocks-onboarding
blocks skill add blocks-onboarding
blocks skill show <matching-skill>
blocks skill add <matching-skill>
\`\`\`

Use \`blocks\` CLI for project/admin work and \`@seliseblocks/client\` for app
code. Do not use raw API calls when the CLI or SDK supports the work. Configure
SDK app code with \`xBlocksKey\`; it sends \`x-blocks-key\`. Never use
\`ProjectKey\` or \`projectKey\`, and do not add \`/api\` after \`/v4\` routes.

## Resolve app login

Check for an existing public OIDC client:

\`\`\`bash
blocks auth oidc-clients list --json
\`\`\`

If no suitable public client exists, create one through the CLI. Show the
dry-run output and wait for approval before using \`--yes\`:

\`\`\`bash
blocks auth oidc-clients save \\
  --client-display-name <appName> \\
  --client-type public \\
  --redirect-uris https://{{APP_HOST}}:5173/login/callback \\
  --scope "openid profile" \\
  --require-pkce \\
  --register-as-identity-provider \\
  --auto-redirect \\
  --dry-run --json
\`\`\`

A create/rotate response can show a \`client_secret\` once. Treat that output as
sensitive: do not print, log, commit, or put it in frontend code. Use only the
public OIDC client id for the web app.

## New web app

Scaffold with explicit values so an agent run does not hang on interactive
prompts. Leave \`--blocks-api-url\` off unless the project uses a non-default
gateway; \`blocks new web\` derives \`{{BLOCKS_API_URL}}\` from the app domain.

\`\`\`bash
blocks new web <appName> \\
  --x-blocks-key {{X_BLOCKS_KEY}} \\
  --app-domain {{APP_DOMAIN}} \\
  --client-id <publicOidcClientId>
cd <appName>
npm install
\`\`\`

Now work only inside \`<appName>\`. If the app needs data schemas/rules or other
project-local Blocks files, run \`blocks init\` here, not in the parent folder:

\`\`\`bash
blocks init
\`\`\`

This keeps \`blocks.json\` and \`blocks/\` inside the generated app. Add any
feature skills from inside the app as well.

For local HTTPS login:

\`\`\`bash
npm run cert
npm run dev
\`\`\`

Open \`https://{{APP_HOST}}:5173\`. If needed, add the hosts-file line shown at
the top; the generated app README is the final source of truth for local dev.

## Existing app

From the existing app root, install/update the SDK and print the client config:

\`\`\`bash
npm install @seliseblocks/client@latest
blocks sdk client \\
  --x-blocks-key {{X_BLOCKS_KEY}} \\
  --app-domain {{APP_DOMAIN}} \\
  --client-id <publicOidcClientId> \\
  --blocks-api-url {{BLOCKS_API_URL}}
\`\`\`

\`blocks sdk client\` is read-only and writes no files. Pass \`--blocks-api-url\`
for existing apps so browser SDK config uses the same gateway that \`new web\`
would derive.

## Rules throughout

- Ask the user what to build if they have not described it yet.
- Before cloud-mutating commands, show the exact action, run \`--dry-run --json\`
  if supported, and wait for approval before \`--yes\`.
- Never expose tokens, secrets, cookies, passwords, JWTs, client secrets, or
  private credentials.
- Never invent project keys, domains, API URLs, or client ids.
- Treat GraphQL \`errors\` as failure even when HTTP status is 200.
- Unknown command or flag usually means the CLI is outdated; re-check the
  installed and published versions before working around it.
- Verify with build/tests before handoff.
`;
