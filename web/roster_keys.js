export function rosterIdentityKey(value, normalizeKey = defaultRosterKeyNormalizer) {
  return normalizeKey(value).replace(/\s+/g, "");
}

export function normalizeRosterGroupKey(key, normalizeKey = defaultRosterKeyNormalizer) {
  try {
    const parts = JSON.parse(String(key ?? ""));
    if (!Array.isArray(parts) || parts.length < 4) {
      return key || "";
    }
    return JSON.stringify([
      parts[0] || "",
      rosterIdentityKey(parts[1] || "unknown", normalizeKey) || "unknown",
      rosterIdentityKey(parts[2] || "", normalizeKey),
      rosterIdentityKey(parts[3] || "", normalizeKey),
    ]);
  } catch {
    return key || "";
  }
}

function defaultRosterKeyNormalizer(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("\u00e4", "ae")
    .replaceAll("\u00f6", "oe")
    .replaceAll("\u00fc", "ue")
    .replaceAll("\u00df", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("\u00e3\u00a4", "ae")
    .replaceAll("\u00e3\u00b6", "oe")
    .replaceAll("\u00e3\u00bc", "ue")
    .replaceAll("\u00e3\u00bf", "ss")
    .replaceAll("\u00e3\u0192\u00e2\u00a4", "ae")
    .replaceAll("\u00e3\u0192\u00e2\u00b6", "oe")
    .replaceAll("\u00e3\u0192\u00e2\u00bc", "ue")
    .replaceAll("\u00e3\u0192\u00e2\u00bf", "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
