import { XMLParser } from "fast-xml-parser";
import { toPlainText } from "./sanitize.js";
import type { NewArticle } from "./db.js";

const USER_AGENT = "rss-reader/1.0 (+local)";
const FETCH_TIMEOUT_MS = 15_000;

export type ParsedFeed = {
  title: string;
  siteUrl: string | null;
  description: string | null;
  items: ParsedItem[];
};

export type ParsedItem = Omit<NewArticle, "feed_id">;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  htmlEntities: true,
});

/** Feed XML nodes are either a string, an object with `#text`, or an array of either. */
function text(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string") return node.trim() || null;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    for (const entry of node) {
      const value = text(entry);
      if (value) return value;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if ("#text" in obj) return text(obj["#text"]);
    if ("@_href" in obj) return text(obj["@_href"]);
  }
  return null;
}

function asArray<T>(node: T | T[] | undefined | null): T[] {
  if (node == null) return [];
  return Array.isArray(node) ? node : [node];
}

function attr(node: unknown, name: string): string | null {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    return text((node as Record<string, unknown>)[`@_${name}`]);
  }
  return null;
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Atom entries may carry several <link>s; prefer rel="alternate" over enclosures. */
function pickAtomLink(links: unknown): string | null {
  const candidates = asArray(links);
  const alternate = candidates.find((l) => {
    const rel = attr(l, "rel");
    return rel === null || rel === "alternate";
  });
  const chosen = alternate ?? candidates[0];
  if (!chosen) return null;
  return attr(chosen, "href") ?? text(chosen);
}

function extractImage(entry: Record<string, unknown>, html: string | null): string | null {
  for (const enclosure of asArray(entry.enclosure)) {
    const type = attr(enclosure, "type") ?? "";
    if (type.startsWith("image/")) return attr(enclosure, "url");
  }
  for (const media of asArray(entry["media:content"])) {
    const type = attr(media, "type") ?? attr(media, "medium") ?? "";
    if (type.startsWith("image") || type === "image") return attr(media, "url");
  }
  const thumb = asArray(entry["media:thumbnail"])[0];
  if (thumb) {
    const url = attr(thumb, "url");
    if (url) return url;
  }
  if (html) {
    const match = html.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
    if (match && /^https?:\/\//i.test(match[1])) return match[1];
  }
  return null;
}

function resolveUrl(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function parseEntry(raw: unknown, feedUrl: string): ParsedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;

  const title =
    text(entry.title) ?? toPlainText(text(entry.description) ?? "", 120) ?? "";
  const link =
    resolveUrl(text(entry.link) ?? null, feedUrl) ??
    resolveUrl(pickAtomLink(entry.link), feedUrl) ??
    resolveUrl(text(entry["@_rdf:about"]), feedUrl);

  // Atom feeds often ship the full post in <summary> and omit <content> entirely.
  const content =
    text(entry["content:encoded"]) ??
    text(entry.content) ??
    text(entry.description) ??
    text(entry.summary) ??
    null;
  const summarySource = text(entry.description) ?? text(entry.summary) ?? content;
  // Link-aggregator feeds put boilerplate like "Comments" in the description;
  // an excerpt that short carries no information, so drop it.
  const summary = toPlainText(summarySource, 400);

  const published =
    parseDate(text(entry.pubDate)) ??
    parseDate(text(entry.published)) ??
    parseDate(text(entry.updated)) ??
    parseDate(text(entry["dc:date"])) ??
    Date.now();

  const guid = text(entry.guid) ?? text(entry.id) ?? link ?? (title ? `${title}:${published}` : null);
  if (!guid) return null;

  return {
    guid,
    url: link,
    title: title || "(untitled)",
    author:
      text(entry.author) ??
      text(entry["dc:creator"]) ??
      (entry.author && typeof entry.author === "object"
        ? text((entry.author as Record<string, unknown>).name)
        : null),
    summary: summary.length >= 25 && summary !== title ? summary : null,
    content,
    image_url: extractImage(entry, content),
    published_at: published,
  };
}

async function fetchText(url: string): Promise<{ body: string; contentType: string; finalUrl: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return {
    body: await response.text(),
    contentType: response.headers.get("content-type") ?? "",
    finalUrl: response.url || url,
  };
}

/** Finds the feed URL advertised in an HTML page's <link rel="alternate">. */
function discoverFeedUrl(html: string, baseUrl: string): string | null {
  const linkRe = /<link\b[^>]*>/gi;
  for (const tag of html.match(linkRe) ?? []) {
    if (!/rel\s*=\s*["']?[^"'>]*alternate/i.test(tag)) continue;
    if (!/type\s*=\s*["']?(application\/(rss|atom)\+xml|application\/xml|text\/xml)/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    const resolved = resolveUrl(href ?? null, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}

function parseDocument(xml: string, feedUrl: string): ParsedFeed {
  const doc = parser.parse(xml) as Record<string, any>;

  const rssChannel = doc?.rss?.channel ?? doc?.["rdf:RDF"]?.channel ?? doc?.RDF?.channel;
  const atomFeed = doc?.feed;

  if (rssChannel) {
    const channel = Array.isArray(rssChannel) ? rssChannel[0] : rssChannel;
    const rawItems = [
      ...asArray(channel.item),
      ...asArray(doc?.["rdf:RDF"]?.item),
      ...asArray(doc?.RDF?.item),
    ];
    return {
      title: text(channel.title) ?? feedUrl,
      siteUrl: resolveUrl(text(channel.link) ?? pickAtomLink(channel.link), feedUrl),
      description: toPlainText(text(channel.description), 500) || null,
      items: rawItems.map((i) => parseEntry(i, feedUrl)).filter((i): i is ParsedItem => i !== null),
    };
  }

  if (atomFeed) {
    const feed = Array.isArray(atomFeed) ? atomFeed[0] : atomFeed;
    return {
      title: text(feed.title) ?? feedUrl,
      siteUrl: resolveUrl(pickAtomLink(feed.link), feedUrl),
      description: toPlainText(text(feed.subtitle), 500) || null,
      items: asArray(feed.entry)
        .map((i) => parseEntry(i, feedUrl))
        .filter((i): i is ParsedItem => i !== null),
    };
  }

  throw new Error("Not a recognizable RSS, Atom, or RDF feed");
}

/**
 * Fetches and parses a feed. Accepts either a feed URL or a site URL —
 * an HTML response is followed to the feed it advertises.
 */
export async function fetchFeed(url: string): Promise<{ feedUrl: string; feed: ParsedFeed }> {
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const first = await fetchText(normalized);

  const looksHtml =
    first.contentType.includes("text/html") ||
    /^\s*(<!doctype html|<html)/i.test(first.body);

  if (looksHtml) {
    const discovered = discoverFeedUrl(first.body, first.finalUrl);
    if (!discovered) throw new Error("That page does not link to an RSS or Atom feed");
    const second = await fetchText(discovered);
    return { feedUrl: discovered, feed: parseDocument(second.body, discovered) };
  }

  return { feedUrl: first.finalUrl, feed: parseDocument(first.body, first.finalUrl) };
}
