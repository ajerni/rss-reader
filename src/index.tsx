import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { Fragment } from "hono/jsx";

import * as store from "./db.js";
import { fetchFeed } from "./rss.js";
import { parseScope, scopeToQuery, type Scope, hostname } from "./util.js";
import { Layout } from "./views/layout.js";
import { Sidebar } from "./views/sidebar.js";
import { ListPane, MorePage, CardBody, PAGE_SIZE } from "./views/list.js";
import { Reader, EmptyReader, ReaderActions } from "./views/reader.js";
import { AddFeedModal } from "./views/modal.js";

const app = new Hono();

app.use("/htmx.min.js", serveStatic({ path: "./public/htmx.min.js" }));
app.use("/styles.css", serveStatic({ path: "./public/styles.css" }));

/* ── shared view data ──────────────────────────────────────────────────── */

function sidebarProps(scope: Scope) {
  return {
    scope,
    folders: store.listFolders(),
    feeds: store.listFeeds(),
    counts: store.getCounts(),
    folderUnread: store.folderUnreadCounts(),
  };
}

function describeScope(scope: Scope): { title: string; subtitle: string } {
  const viewLabel =
    scope.view === "unread" ? "Unread only" : scope.view === "starred" ? "Starred only" : "All articles";

  if (scope.search) {
    return { title: `“${scope.search}”`, subtitle: `Search results · ${viewLabel}` };
  }
  if (scope.feedId !== undefined) {
    const feed = store.getFeed(scope.feedId);
    if (feed) {
      const detail = feed.last_error
        ? `Last refresh failed: ${feed.last_error}`
        : (feed.description ?? hostname(feed.site_url ?? feed.feed_url));
      return { title: feed.title, subtitle: detail || viewLabel };
    }
  }
  if (scope.folderId !== undefined) {
    const folder = store.listFolders().find((f) => f.id === scope.folderId);
    if (folder) {
      const n = store.listFeeds().filter((f) => f.folder_id === folder.id).length;
      return { title: folder.name, subtitle: `${n} ${n === 1 ? "feed" : "feeds"} · ${viewLabel}` };
    }
  }
  return {
    title: viewLabel,
    subtitle:
      scope.view === "unread"
        ? "Everything you haven't read yet"
        : scope.view === "starred"
          ? "Articles you saved for later"
          : "Everything from all your feeds",
  };
}

function listProps(scope: Scope, selectedId?: number) {
  return {
    scope,
    ...describeScope(scope),
    articles: store.listArticles({ ...scope, limit: PAGE_SIZE }),
    total: store.countArticles(scope),
    selectedId,
  };
}

/* ── pages ─────────────────────────────────────────────────────────────── */

app.get("/", (c) => {
  const scope = parseScope(c.req.query());
  const open = scope.articleId !== undefined ? store.getArticle(scope.articleId) : undefined;
  return c.html(
    <Layout title={open ? `${open.title} · Reader` : "Reader"}>
      <div class="grid h-dvh grid-cols-[15rem_minmax(20rem,26rem)_1fr]">
        <Sidebar {...sidebarProps(scope)} />
        <ListPane {...listProps(scope, open?.id)} />
        {open ? <Reader article={open} scope={scope} /> : <EmptyReader />}
      </div>
    </Layout>,
  );
});

app.get("/list", (c) => {
  const scope = parseScope(c.req.query());
  const url = `/${scopeToQuery({ ...scope, articleId: undefined })}`;

  // Reached directly (bookmark, reload of a pushed URL) — serve the whole app instead of a fragment.
  if (!c.req.header("HX-Request")) return c.redirect(url);

  c.header("HX-Push-Url", url);
  return c.html(
    <Fragment>
      <ListPane {...listProps(scope)} />
      <Sidebar {...sidebarProps(scope)} oob />
      <EmptyReader oob />
    </Fragment>,
  );
});

app.get("/list/more", (c) => {
  const scope = parseScope(c.req.query());
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
  const articles = store.listArticles({ ...scope, limit: PAGE_SIZE, offset });
  return c.html(<MorePage scope={scope} articles={articles} offset={offset} />);
});

app.get("/read/:id", (c) => {
  const id = Number(c.req.param("id"));
  const scope = parseScope(c.req.query());
  const before = store.getArticle(id);
  if (!before) return c.text("Article not found", 404);

  if (before.is_read === 0) store.setRead(id, true);
  const article = store.getArticle(id)!;

  return c.html(
    <Fragment>
      <Reader article={article} scope={scope} />
      <CardBody article={article} oob />
      <Sidebar {...sidebarProps(scope)} oob />
    </Fragment>,
  );
});

/* ── article mutations ─────────────────────────────────────────────────── */

function articleStateResponse(scope: Scope, id: number) {
  const article = store.getArticle(id)!;
  return (
    <Fragment>
      <CardBody article={article} oob />
      <ReaderActions article={article} oob />
      <Sidebar {...sidebarProps(scope)} oob />
    </Fragment>
  );
}

app.post("/articles/:id/star", (c) => {
  const id = Number(c.req.param("id"));
  if (!store.getArticle(id)) return c.text("Article not found", 404);
  store.toggleStar(id);
  return c.html(articleStateResponse(parseScope(c.req.query()), id));
});

app.post("/articles/:id/read", (c) => {
  const id = Number(c.req.param("id"));
  const article = store.getArticle(id);
  if (!article) return c.text("Article not found", 404);
  store.setRead(id, article.is_read === 0);
  return c.html(articleStateResponse(parseScope(c.req.query()), id));
});

app.post("/mark-all-read", (c) => {
  const scope = parseScope(c.req.query());
  store.markAllRead({ feedId: scope.feedId, folderId: scope.folderId });
  return c.html(
    <Fragment>
      <ListPane {...listProps(scope)} />
      <Sidebar {...sidebarProps(scope)} oob />
    </Fragment>,
  );
});

/* ── feeds ─────────────────────────────────────────────────────────────── */

app.get("/feeds/new", (c) => {
  const scope = parseScope(c.req.query());
  return c.html(<AddFeedModal folders={store.listFolders()} feeds={store.listFeeds()} scope={scope} />);
});

app.post("/feeds", async (c) => {
  const scope = parseScope(c.req.query());
  const body = await c.req.parseBody();
  const url = String(body.url ?? "").trim();
  const newFolder = String(body.new_folder ?? "").trim();
  const folderIdRaw = String(body.folder_id ?? "").trim();

  const fail = (error: string) =>
    c.html(
      <AddFeedModal
        folders={store.listFolders()}
        feeds={store.listFeeds()}
        scope={scope}
        error={error}
        value={url}
      />,
    );

  if (!url) return fail("Please enter a URL.");

  let resolved: Awaited<ReturnType<typeof fetchFeed>>;
  try {
    resolved = await fetchFeed(url);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not load that feed.");
  }

  if (store.findFeedByUrl(resolved.feedUrl)) return fail("You're already subscribed to that feed.");

  let folderId: number | null = folderIdRaw ? Number(folderIdRaw) : null;
  if (newFolder) {
    const existing = store.listFolders().find((f) => f.name.toLowerCase() === newFolder.toLowerCase());
    folderId = existing ? existing.id : store.createFolder(newFolder).id;
  }

  const feed = store.createFeed({
    title: resolved.feed.title,
    feed_url: resolved.feedUrl,
    site_url: resolved.feed.siteUrl,
    description: resolved.feed.description,
    folder_id: folderId,
  });
  store.insertArticles(resolved.feed.items.map((item) => ({ ...item, feed_id: feed.id })));
  store.markFeedFetched(feed.id, null);

  const target: Scope = { view: scope.view, feedId: feed.id };
  c.header("HX-Push-Url", `/?view=${target.view}&feed=${feed.id}`);
  return c.html(
    <Fragment>
      <ListPane {...listProps(target)} oob />
      <Sidebar {...sidebarProps(target)} oob />
      <EmptyReader oob />
    </Fragment>,
  );
});

app.delete("/feeds/:id", (c) => {
  const id = Number(c.req.param("id"));
  store.deleteFeed(id);
  const scope: Scope = { view: parseScope(c.req.query()).view };
  c.header("HX-Trigger", "close-modal");
  c.header("HX-Push-Url", `/?view=${scope.view}`);
  return c.html(
    <Fragment>
      <ListPane {...listProps(scope)} />
      <Sidebar {...sidebarProps(scope)} oob />
      <EmptyReader oob />
    </Fragment>,
  );
});

app.post("/refresh", async (c) => {
  const scope = parseScope(c.req.query());
  const feeds = store.listFeeds();

  await Promise.all(
    feeds.map(async (feed) => {
      try {
        const { feed: parsed } = await fetchFeed(feed.feed_url);
        store.insertArticles(parsed.items.map((item) => ({ ...item, feed_id: feed.id })));
        store.markFeedFetched(feed.id, null);
      } catch (err) {
        store.markFeedFetched(feed.id, err instanceof Error ? err.message : "Refresh failed");
      }
    }),
  );

  return c.html(
    <Fragment>
      <ListPane {...listProps(scope)} />
      <Sidebar {...sidebarProps(scope)} oob />
    </Fragment>,
  );
});

/* ── folders ───────────────────────────────────────────────────────────── */

app.delete("/folders/:id", (c) => {
  store.deleteFolder(Number(c.req.param("id")));
  const scope: Scope = { view: parseScope(c.req.query()).view };
  return c.html(
    <Fragment>
      <ListPane {...listProps(scope)} />
      <Sidebar {...sidebarProps(scope)} oob />
      <EmptyReader oob />
    </Fragment>,
  );
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\n  Reader running at http://localhost:${info.port}\n`);
});
