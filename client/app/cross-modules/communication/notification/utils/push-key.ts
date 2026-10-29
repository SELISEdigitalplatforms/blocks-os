/** Client helpers for the Firebase service account key. The server checks the key again; these only guide the form. */

const SERVICE_ACCOUNT = "service_account";

const readKey = (text: string): Record<string, unknown> | null => {
  try {
    const key = JSON.parse(text) as unknown;
    return key && typeof key === "object" ? (key as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** Light check: the text parses as an object with the four fields of a service account key. */
export const isServiceAccountKey = (text: string): boolean => {
  const key = readKey(text);
  return (
    key?.type === SERVICE_ACCOUNT && !!key.project_id && !!key.private_key && !!key.client_email
  );
};

/** The key's Firebase project id, or null when the text is not a key. */
export const keyProjectId = (text: string): string | null => {
  const projectId = readKey(text)?.project_id;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
};

/**
 * A pasted private key often arrives with its line breaks as the two characters "\n" (copied from the JSON file)
 * or with Windows line ends. Both make the PEM unreadable, so turn them into real line breaks.
 */
export const normalizePrivateKey = (privateKey: string): string => {
  const pem = privateKey
    .replaceAll(String.raw`\n`, "\n")
    .replaceAll("\r\n", "\n")
    .trim();
  return pem ? `${pem}\n` : "";
};

const IAM_EMAIL = /^[^@\s]+@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i;
const APPSPOT_EMAIL = /^([a-z0-9-]+)@appspot\.gserviceaccount\.com$/i;

/**
 * The Firebase project a service account email belongs to: `...@<project>.iam.gserviceaccount.com`, or the part
 * before the @ of `<project>@appspot.gserviceaccount.com`. Null when the email has neither form.
 */
export const projectFromEmail = (email: string): string | null => {
  const text = email.trim();
  const match = IAM_EMAIL.exec(text) ?? APPSPOT_EMAIL.exec(text);
  return match ? match[1].toLowerCase() : null;
};

export interface IManualKeyFields {
  clientEmail: string;
  privateKey: string;
}

export type ManualKeyResult =
  { ok: true; projectId: string; json: string } | { ok: false; reason: "incomplete" | "email" };

/**
 * Builds the same JSON a downloaded key file holds, from the typed fields. The project comes from the email, so it
 * can never disagree with the key.
 */
export const buildServiceAccountKey = (fields: IManualKeyFields): ManualKeyResult => {
  const clientEmail = fields.clientEmail.trim();
  const privateKey = normalizePrivateKey(fields.privateKey);
  if (!clientEmail || !privateKey.includes("PRIVATE KEY"))
    return { ok: false, reason: "incomplete" };
  const projectId = projectFromEmail(clientEmail);
  if (!projectId) return { ok: false, reason: "email" };
  const json = JSON.stringify({
    type: SERVICE_ACCOUNT,
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  });
  return { ok: true, projectId, json };
};
