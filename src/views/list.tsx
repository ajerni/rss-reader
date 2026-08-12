import type { FC } from "hono/jsx";
import { Fragment } from "hono/jsx";
import type { ArticleRow } from "../db.js";
import { type Scope, scopeToQuery, relativeTime, hueFor, initials } from "../util.js";
import { IconStar, IconCheck, IconSearch } from "./icons.js";

export const PAGE_SIZE = 40;

export type ListData = {
  scope: Scope;
  title: string;
  subtitle: string;
  articles: ArticleRow[];
  total: number;
  selectedId?: number;
};

const viewChip = (scope: Scope, view: Scope["view"], label: string) => {
  const target: Scope = { ...scope, view, articleId: undefined };
  const active = scope.view === view;
  const query = scopeToQuery(target);
  return (
    <a
      href={`/${query}`}
      hx-get={`/list${query}`}
      hx-target="#list-pane"
      hx-swap="outerHTML"
      hx-push-url={`/${query}`}
      class={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? "bg-ink text-canvas" : "text-faint hover:bg-raised hover:text-ink"
      }`}
    >
      {label}
    </a>
  );
};

/**
 * The read/starred-dependent part of a card, split out so mutations can swap it
 * over the wire without disturbing the row's selection state.
 */
export const CardBody: FC<{ article: ArticleRow; oob?: boolean }> = ({ article, oob }) => {
  const unread = article.is_read === 0;
  const hue = hueFor(article.feed_title);
  return (
    <div id={`card-${article.id}`} {...(oob ? { "hx-swap-oob": "true" } : {})}>
      <div class="flex gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 text-[11px] font-medium">
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              style={`background: hsl(${hue} 62% 52%)`}
            />
            <span class="truncate text-muted">{article.feed_title}</span>
            <span class="text-faint">·</span>
            <span class="shrink-0 text-faint">{relativeTime(article.published_at)}</span>
            {unread ? (
              <span class="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Unread" />
            ) : null}
          </div>
          <h3
            class={`mt-1 line-clamp-2 text-[13.5px] leading-snug ${
              unread ? "font-semibold text-ink" : "font-medium text-muted"
            }`}
          >
            {article.title}
          </h3>
          {article.summary ? (
            <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-faint">{article.summary}</p>
          ) : null}
        </div>

        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            loading="lazy"
            class="h-14 w-14 shrink-0 rounded-lg border border-line object-cover"
            onerror="this.remove()"
          />
        ) : null}
      </div>

      <div class="mt-2 flex items-center gap-1">
        <button
          type="button"
          hx-post={`/articles/${article.id}/star`}
          hx-swap="none"
          onclick="event.stopPropagation()"
          title={article.is_starred ? "Remove star" : "Star"}
          class={`grid h-6 w-6 place-items-center rounded-md transition ${
            article.is_starred
              ? "text-amber-500"
              : "text-faint opacity-0 hover:bg-surface hover:text-ink group-hover:opacity-100"
          }`}
        >
          <IconStar class="h-3.5 w-3.5" filled={article.is_starred === 1} />
        </button>
        <button
          type="button"
          hx-post={`/articles/${article.id}/read`}
          hx-swap="none"
          onclick="event.stopPropagation()"
          title={unread ? "Mark as read" : "Mark as unread"}
          class="grid h-6 w-6 place-items-center rounded-md text-faint opacity-0 transition hover:bg-surface hover:text-ink group-hover:opacity-100"
        >
          <IconCheck class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export const ArticleCard: FC<{ article: ArticleRow; scope: Scope; selected: boolean }> = ({
  article,
  scope,
  selected,
}) => (
  <article
    id={`row-${article.id}`}
    data-article-row
    data-selected={selected ? "true" : "false"}
    hx-get={`/read/${article.id}${scopeToQuery(scope)}`}
    hx-target="#reader-pane"
    hx-swap="outerHTML"
    hx-push-url={`/${scopeToQuery({ ...scope, articleId: article.id })}`}
    class={`group relative cursor-pointer border-b border-line px-4 py-3.5 transition-colors ${
      selected ? "bg-accent-soft" : "hover:bg-raised"
    }`}
  >
    <span
      class={`absolute left-0 top-0 h-full w-[3px] transition-opacity ${
        selected ? "bg-accent opacity-100" : "opacity-0"
      }`}
    />
    <CardBody article={article} />
  </article>
);

/** Sentinel that pulls the next page into view as the user scrolls. */
const LoadMore: FC<{ scope: Scope; offset: number }> = ({ scope, offset }) => {
  const params = new URLSearchParams(scopeToQuery(scope).replace(/^\?/, ""));
  params.set("offset", String(offset));
  return (
    <div
      hx-get={`/list/more?${params}`}
      hx-trigger="revealed"
      hx-swap="outerHTML"
      class="flex items-center justify-center py-6 text-xs text-faint"
    >
      Loading more…
    </div>
  );
};

/** Replaces the LoadMore sentinel with the next page plus a fresh sentinel. */
export const MorePage: FC<{ scope: Scope; articles: ArticleRow[]; offset: number }> = ({
  scope,
  articles,
  offset,
}) => (
  <Fragment>
    {articles.map((a) => (
      <ArticleCard article={a} scope={scope} selected={false} />
    ))}
    {articles.length === PAGE_SIZE ? <LoadMore scope={scope} offset={offset + PAGE_SIZE} /> : null}
  </Fragment>
);

export const ListPane: FC<ListData & { oob?: boolean }> = (data) => {
  const { scope, title, subtitle, articles, total, selectedId, oob } = data;
  return (
    <section
      id="list-pane"
      {...(oob ? { "hx-swap-oob": "true" } : {})}
      class="flex h-dvh min-w-0 flex-col border-r border-line bg-canvas"
    >
      <header class="border-b border-line bg-surface/80 px-4 pb-2.5 pt-4 backdrop-blur">
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
            <p class="mt-0.5 truncate text-xs text-faint">{subtitle}</p>
          </div>
          {scope.view !== "starred" ? (
            <button
              type="button"
              hx-post={`/mark-all-read${scopeToQuery(scope)}`}
              hx-target="#list-pane"
              hx-swap="outerHTML"
              hx-confirm="Mark everything in this view as read?"
              class="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:bg-raised hover:text-ink"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <div class="mt-2.5 flex items-center gap-1">
          {viewChip(scope, "all", "All")}
          {viewChip(scope, "unread", "Unread")}
          {viewChip(scope, "starred", "Starred")}
          <span class="ml-auto text-[11px] tabular-nums text-faint">
            {total} {total === 1 ? "article" : "articles"}
          </span>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto [.htmx-request_&]:opacity-50 [.htmx-request_&]:transition-opacity">
        {articles.length > 0 ? (
          <>
            {articles.map((a) => (
              <ArticleCard article={a} scope={scope} selected={a.id === selectedId} />
            ))}
            {articles.length === PAGE_SIZE ? <LoadMore scope={scope} offset={PAGE_SIZE} /> : null}
          </>
        ) : (
          <EmptyList scope={scope} />
        )}
      </div>
    </section>
  );
};

const EmptyList: FC<{ scope: Scope }> = ({ scope }) => (
  <div class="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
    <span class="grid h-12 w-12 place-items-center rounded-2xl bg-raised text-faint">
      <IconSearch class="h-5 w-5" />
    </span>
    <div>
      <p class="text-sm font-medium text-muted">
        {scope.search
          ? "No matches"
          : scope.view === "unread"
            ? "You're all caught up"
            : scope.view === "starred"
              ? "No starred articles"
              : "Nothing here yet"}
      </p>
      <p class="mt-1 text-xs text-faint">
        {scope.search
          ? `Nothing found for "${scope.search}".`
          : scope.view === "starred"
            ? "Star an article to keep it here."
            : "Add a feed or hit refresh to pull in articles."}
      </p>
    </div>
  </div>
);
