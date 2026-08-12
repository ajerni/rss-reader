/**
 * Allowlist HTML sanitizer for untrusted feed content.
 * Anything not explicitly permitted is dropped, so new/unknown markup fails closed.
 */

const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code", "dd", "del",
  "div", "dl", "dt", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5",
  "h6", "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "q",
  "s", "samp", "section", "small", "span", "strong", "sub", "sup", "table",
  "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "video", "source",
]);

/** Tags whose entire subtree is discarded, not just the tag itself. */
const VOID_SUBTREE_TAGS = ["script", "style", "iframe", "object", "embed", "form", "noscript", "svg", "math"];

const SELF_CLOSING = new Set(["br", "hr", "img", "source"]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  video: new Set(["src", "poster", "controls", "width", "height"]),
  source: new Set(["src", "type"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
};

const URL_ATTRS = new Set(["href", "src", "poster"]);

function isSafeUrl(value: string): boolean {
  const v = value.trim();
  if (v.startsWith("//")) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return /^https?:/i.test(v) || /^mailto:/i.test(v);
  return true; // relative URL
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseAttrs(raw: string): [string, string][] {
  const out: [string, string][] = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push([m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? ""]);
  }
  return out;
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";

  let html = input;
  for (const tag of VOID_SUBTREE_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), "");
  }
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  const openStack: string[] = [];
  let out = "";
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(html)) !== null) {
    out += html.slice(last, m.index);
    last = tagRe.lastIndex;

    const isClosing = m[0][1] === "/";
    const tag = m[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (isClosing) {
      const idx = openStack.lastIndexOf(tag);
      if (idx === -1) continue;
      openStack.splice(idx, 1);
      out += `</${tag}>`;
      continue;
    }

    const allowed = ALLOWED_ATTRS[tag];
    let attrs = "";
    if (allowed) {
      for (const [name, value] of parseAttrs(m[2])) {
        if (!allowed.has(name)) continue;
        if (URL_ATTRS.has(name) && !isSafeUrl(value)) continue;
        attrs += value === "" ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`;
      }
    }

    if (SELF_CLOSING.has(tag)) {
      out += `<${tag}${attrs}>`;
    } else {
      if (tag === "a") attrs += ` target="_blank" rel="noopener noreferrer nofollow"`;
      openStack.push(tag);
      out += `<${tag}${attrs}>`;
    }
  }
  out += html.slice(last);

  for (let i = openStack.length - 1; i >= 0; i--) out += `</${openStack[i]}>`;
  return out;
}

/** Collapses markup to a plain-text excerpt for list previews. */
export function toPlainText(input: string | null | undefined, maxLength = 300): string {
  if (!input) return "";
  const text = input
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
