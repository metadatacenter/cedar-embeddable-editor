/** Syntax only; identifier resolution and vocabulary membership require the host's services. */
export function validAbsoluteIri(value: string): boolean {
  if (
    !/^[a-z][a-z0-9+.-]*:.+$/i.test(value) ||
    /[\s<>"{}|\\^`\p{Cc}\p{Cs}]/u.test(value) ||
    /%(?![\da-f]{2})/i.test(value)
  )
    return false;
  try {
    const parsed = new URL(value);
    return !/^https?:/i.test(value) || (/^https?:\/\//i.test(value) && !!parsed.hostname);
  } catch {
    return false;
  }
}
