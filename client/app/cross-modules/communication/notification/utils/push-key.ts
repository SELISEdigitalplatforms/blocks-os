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

export interface IManualKeyFields {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** Builds the same JSON a downloaded key file holds, from the typed fields; null when a field is missing. */
export const buildServiceAccountKey = (fields: IManualKeyFields): string | null => {
  const projectId = fields.projectId.trim();
  const clientEmail = fields.clientEmail.trim();
  const privateKey = normalizePrivateKey(fields.privateKey);
  if (!projectId || !clientEmail || !privateKey.includes("PRIVATE KEY")) return null;
  return JSON.stringify({
    type: SERVICE_ACCOUNT,
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  });
};
