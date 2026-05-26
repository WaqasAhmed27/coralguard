const secretPatterns = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /(?:bearer|token|api[_-]?key|secret)\s*[:=]\s*["']?([A-Za-z0-9._\-]{12,})["']?/gi,
  /AWS[A-Z0-9]{16}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /cookie\s*[:=]\s*[^;\s]+/gi
];

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /(?:\+?\d[\d .()\-]{7,}\d)/g;

export function redactSecrets(text: string): string {
  return secretPatterns.reduce((current, pattern) => current.replace(pattern, "[REDACTED_SECRET]"), text);
}

export function redactPii(text: string, strict = false): string {
  let redacted = text.replace(emailPattern, "[REDACTED_EMAIL]").replace(phonePattern, "[REDACTED_PHONE]");
  if (strict) {
    redacted = redacted.replace(/\b(?:customer|account|user)[ _-]?(?:id)?[:#]?\s*[A-Za-z0-9_-]{4,}\b/gi, "[REDACTED_CUSTOMER]");
  }
  return redacted;
}

export function redactForDisplay(value: unknown, strict = false): string {
  return redactPii(redactSecrets(String(value ?? "")), strict);
}
