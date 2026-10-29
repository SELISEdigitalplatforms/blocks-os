/**
 * Writes `text` to the clipboard, falling back to a hidden textarea when the
 * async Clipboard API isn't available (non-secure context / older browsers).
 * Mirrors the behaviour of `CopyToClipboardButton`, but usable outside JSX.
 */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textArea);
    return copied;
  } catch (error) {
    console.error("Failed to copy:", error);
    return false;
  }
};
