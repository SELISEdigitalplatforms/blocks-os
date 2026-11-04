/**
 * The page's Content-Security-Policy style nonce, or "" when there is none (Vite dev server,
 * tests). The server writes it into <meta name="csp-nonce"> on every response.
 */
export function getCspNonce(doc?: Document): string {
  const target = doc ?? (typeof document === "undefined" ? undefined : document);
  if (!target) return "";
  const meta = target.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]');
  const nonce = meta?.nonce || meta?.getAttribute("nonce") || "";
  return nonce.startsWith("__") ? "" : nonce;
}

/**
 * Stamp the style nonce on every <style> in an HTML string meant for an iframe srcdoc. A
 * srcdoc document inherits this page's policy, so its <style> blocks need the nonce to apply.
 */
export function withStyleNonce(html: string, nonce: string = getCspNonce()): string {
  if (!nonce || !html) return html;
  return html.replace(/<style\b(?![^>]*\bnonce=)/gi, `<style nonce="${nonce}"`);
}
