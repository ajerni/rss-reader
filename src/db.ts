import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = process.env.DB_PATH ?? resolve(process.cwd(), "data/reader.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS folders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS feeds (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id       INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  feed_url        TEXT NOT NULL UNIQUE,
  site_url        TEXT,
  description     TEXT,
  last_fetched_at INTEGER,
  last_error      TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id      INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid         TEXT NOT NULL,
  url          TEXT,
  title        TEXT NOT NULL,
  author       TEXT,
  summary      TEXT,
  content      TEXT,
  image_url    TEXT,
  published_at INTEGER NOT NULL,
  is_read      INTEGER NOT NULL DEFAULT 0,
  is_starred   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(feed_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_feed      ON articles(feed_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_unread    ON articles(is_read, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_starred   ON articles(is_starred, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_folder       ON feeds(folder_id);

CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title, summary, content,
  content='articles', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, title, summary, content)
  VALUES (new.id, new.title, new.summary, new.content);
END;

CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, summary, content)
  VALUES ('delete', old.id, old.title, old.summary, old.content);
END;

CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE OF title, summary, content ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, summary, content)
  VALUES ('delete', old.id, old.title, old.summary, old.content);
  INSERT INTO articles_fts(rowid, title, summary, content)
  VALUES (new.id, new.title, new.summary, new.content);
END;
`);

export type Folder = {
  id: number;
  name: string;
  position: number;
  created_at: number;
};

export type Feed = {
  id: number;
  folder_id: number | null;
  title: string;
  feed_url: string;
  site_url: string | null;
  description: string | null;
  last_fetched_at: number | null;
  last_error: string | null;
  created_at: number;
};

export type FeedWithCount = Feed & { unread: number; total: number };

export type Article = {
  id: number;
  feed_id: number;
  guid: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  published_at: number;
  is_read: number;
  is_starred: number;
  created_at: number;
};

export type ArticleRow = Article & { feed_title: string; site_url: string | null };

/* ── folders ───────────────────────────────────────────────────────────── */

export function listFolders(): Folder[] {
  return db
    .prepare(`SELECT * FROM folders ORDER BY position, name COLLATE NOCASE`)
    .all() as Folder[];
}

export function createFolder(name: string): Folder {
  const max = db.prepare(`SELECT COALESCE(MAX(position), 0) AS p FROM folders`).get() as { p: number };
  const info = db
    .prepare(`INSERT INTO folders (name, position) VALUES (?, ?)`)
    .run(name.trim(), max.p + 1);
  return db.prepare(`SELECT * FROM folders WHERE id = ?`).get(info.lastInsertRowid) as Folder;
}

export function renameFolder(id: number, name: string): void {
  db.prepare(`UPDATE folders SET name = ? WHERE id = ?`).run(name.trim(), id);
}

export function deleteFolder(id: number): void {
  db.prepare(`DELETE FROM folders WHERE id = ?`).run(id);
}

/* ── feeds ─────────────────────────────────────────────────────────────── */

export function listFeeds(): FeedWithCount[] {
  return db
    .prepare(
      `SELECT f.*,
              COUNT(a.id) FILTER (WHERE a.is_read = 0) AS unread,
              COUNT(a.id)                              AS total
       FROM feeds f
       LEFT JOIN articles a ON a.feed_id = f.id
       GROUP BY f.id
       ORDER BY f.title COLLATE NOCASE`,
    )
    .all() as FeedWithCount[];
}

export function getFeed(id: number): Feed | undefined {
  return db.prepare(`SELECT * FROM feeds WHERE id = ?`).get(id) as Feed | undefined;
}

export function findFeedByUrl(url: string): Feed | undefined {
  return db.prepare(`SELECT * FROM feeds WHERE feed_url = ?`).get(url) as Feed | undefined;
}

export function createFeed(feed: {
  title: string;
  feed_url: string;
  site_url?: string | null;
  description?: string | null;
  folder_id?: number | null;
}): Feed {
  const info = db
    .prepare(
      `INSERT INTO feeds (title, feed_url, site_url, description, folder_id)
       VALUES (@title, @feed_url, @site_url, @description, @folder_id)`,
    )
    .run({
      title: feed.title,
      feed_url: feed.feed_url,
      site_url: feed.site_url ?? null,
      description: feed.description ?? null,
      folder_id: feed.folder_id ?? null,
    });
  return db.prepare(`SELECT * FROM feeds WHERE id = ?`).get(info.lastInsertRowid) as Feed;
}

export function updateFeed(id: number, patch: { title?: string; folder_id?: number | null }): void {
  if (patch.title !== undefined) {
    db.prepare(`UPDATE feeds SET title = ? WHERE id = ?`).run(patch.title.trim(), id);
  }
  if (patch.folder_id !== undefined) {
    db.prepare(`UPDATE feeds SET folder_id = ? WHERE id = ?`).run(patch.folder_id, id);
  }
}

export function deleteFeed(id: number): void {
  db.prepare(`DELETE FROM feeds WHERE id = ?`).run(id);
}

export function markFeedFetched(id: number, error: string | null): void {
  db.prepare(`UPDATE feeds SET last_fetched_at = ?, last_error = ? WHERE id = ?`).run(
    Date.now(),
    error,
    id,
  );
}

/* ── articles ──────────────────────────────────────────────────────────── */

export type NewArticle = {
  feed_id: number;
  guid: string;
  url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  published_at: number;
};

const insertArticleStmt = db.prepare(
  `INSERT OR IGNORE INTO articles
     (feed_id, guid, url, title, author, summary, content, image_url, published_at)
   VALUES
     (@feed_id, @guid, @url, @title, @author, @summary, @content, @image_url, @published_at)`,
);

export const insertArticles = db.transaction((items: NewArticle[]): number => {
  let inserted = 0;
  for (const item of items) inserted += insertArticleStmt.run(item).changes;
  return inserted;
});

export type ArticleQuery = {
  view: "all" | "unread" | "starred";
  feedId?: number;
  folderId?: number;
  search?: string;
  limit?: number;
  offset?: number;
};

/** Escapes user input into an FTS5 prefix query so punctuation can't break the parser. */
function toFtsQuery(input: string): string {
  const tokens = input.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"*`).join(" AND ");
}

function buildFilters(q: ArticleQuery) {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (q.view === "unread") where.push(`a.is_read = 0`);
  if (q.view === "starred") where.push(`a.is_starred = 1`);
  if (q.feedId !== undefined) {
    where.push(`a.feed_id = @feedId`);
    params.feedId = q.feedId;
  }
  if (q.folderId !== undefined) {
    where.push(`f.folder_id = @folderId`);
    params.folderId = q.folderId;
  }
  return { where, params };
}

export function listArticles(q: ArticleQuery): ArticleRow[] {
  const { where, params } = buildFilters(q);
  const limit = q.limit ?? 50;
  const offset = q.offset ?? 0;
  const fts = q.search ? toFtsQuery(q.search) : "";

  if (q.search && !fts) return [];

  const join = fts ? `JOIN articles_fts fts ON fts.rowid = a.id` : ``;
  if (fts) {
    where.push(`articles_fts MATCH @fts`);
    params.fts = fts;
  }

  const sql = `
    SELECT a.*, f.title AS feed_title, f.site_url
    FROM articles a
    JOIN feeds f ON f.id = a.feed_id
    ${join}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ``}
    ORDER BY ${fts ? `bm25(articles_fts), ` : ``}a.published_at DESC
    LIMIT @limit OFFSET @offset`;

  return db.prepare(sql).all({ ...params, limit, offset }) as ArticleRow[];
}

export function countArticles(q: ArticleQuery): number {
  const { where, params } = buildFilters(q);
  const fts = q.search ? toFtsQuery(q.search) : "";
  if (q.search && !fts) return 0;

  const join = fts ? `JOIN articles_fts fts ON fts.rowid = a.id` : ``;
  if (fts) {
    where.push(`articles_fts MATCH @fts`);
    params.fts = fts;
  }

  const row = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM articles a
       JOIN feeds f ON f.id = a.feed_id
       ${join}
       ${where.length ? `WHERE ${where.join(" AND ")}` : ``}`,
    )
    .get(params) as { n: number };
  return row.n;
}

export function getArticle(id: number): ArticleRow | undefined {
  return db
    .prepare(
      `SELECT a.*, f.title AS feed_title, f.site_url
       FROM articles a JOIN feeds f ON f.id = a.feed_id
       WHERE a.id = ?`,
    )
    .get(id) as ArticleRow | undefined;
}

export function setRead(id: number, read: boolean): void {
  db.prepare(`UPDATE articles SET is_read = ? WHERE id = ?`).run(read ? 1 : 0, id);
}

export function toggleStar(id: number): boolean {
  db.prepare(`UPDATE articles SET is_starred = 1 - is_starred WHERE id = ?`).run(id);
  const row = db.prepare(`SELECT is_starred FROM articles WHERE id = ?`).get(id) as
    | { is_starred: number }
    | undefined;
  return row?.is_starred === 1;
}

export function markAllRead(q: Pick<ArticleQuery, "feedId" | "folderId">): number {
  if (q.feedId !== undefined) {
    return db
      .prepare(`UPDATE articles SET is_read = 1 WHERE is_read = 0 AND feed_id = ?`)
      .run(q.feedId).changes;
  }
  if (q.folderId !== undefined) {
    return db
      .prepare(
        `UPDATE articles SET is_read = 1
         WHERE is_read = 0
           AND feed_id IN (SELECT id FROM feeds WHERE folder_id = ?)`,
      )
      .run(q.folderId).changes;
  }
  return db.prepare(`UPDATE articles SET is_read = 1 WHERE is_read = 0`).run().changes;
}

export type Counts = { all: number; unread: number; starred: number };

export function getCounts(): Counts {
  return db
    .prepare(
      `SELECT COUNT(*)                               AS "all",
              COUNT(*) FILTER (WHERE is_read = 0)    AS unread,
              COUNT(*) FILTER (WHERE is_starred = 1) AS starred
       FROM articles`,
    )
    .get() as Counts;
}

export function folderUnreadCounts(): Map<number, number> {
  const rows = db
    .prepare(
      `SELECT f.folder_id AS folder_id, COUNT(a.id) AS unread
       FROM feeds f
       JOIN articles a ON a.feed_id = f.id AND a.is_read = 0
       WHERE f.folder_id IS NOT NULL
       GROUP BY f.folder_id`,
    )
    .all() as { folder_id: number; unread: number }[];
  return new Map(rows.map((r) => [r.folder_id, r.unread]));
}
