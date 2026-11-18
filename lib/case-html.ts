import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "ul", "ol", "li", "a", "b", "i"],
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { a: ["http", "https", "mailto"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "completelyDiscard",
};

// Keep the formatting the editor can produce. Drop scripts, styles, and other tags.
export function sanitizeCaseHtml(value: string): string {
  const clean = sanitizeHtml(value, OPTIONS).trim();
  const text = clean
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .trim();
  if (!text) return "";
  return clean;
}
