export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function fullDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hostname(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function faviconUrl(siteUrl: string | null): string | null {
  const host = hostname(siteUrl);
  return host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : null;
}

/** Deterministic hue per feed so each feed gets a stable accent colour. */
export function hueFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export type Scope = {
  view: "all" | "unread" | "starred";
  feedId?: number;
  folderId?: number;
  search?: string;
  /** The open article. Part of the URL so a reload restores what you were reading. */
  articleId?: number;
};

export function parseScope(query: Record<string, string | undefined>): Scope {
  const view = query.view === "unread" || query.view === "starred" ? query.view : "all";
  const feedId = query.feed ? Number(query.feed) : undefined;
  const folderId = query.folder ? Number(query.folder) : undefined;
  const search = query.q?.trim() || undefined;
  const articleId = query.article ? Number(query.article) : undefined;
  return {
    view,
    feedId: Number.isInteger(feedId) ? feedId : undefined,
    folderId: Number.isInteger(folderId) ? folderId : undefined,
    search,
    articleId: Number.isInteger(articleId) ? articleId : undefined,
  };
}

export function scopeToQuery(scope: Scope): string {
  const params = new URLSearchParams();
  if (scope.view !== "all") params.set("view", scope.view);
  if (scope.feedId !== undefined) params.set("feed", String(scope.feedId));
  if (scope.folderId !== undefined) params.set("folder", String(scope.folderId));
  if (scope.search) params.set("q", scope.search);
  if (scope.articleId !== undefined) params.set("article", String(scope.articleId));
  const s = params.toString();
  return s ? `?${s}` : "";
}
