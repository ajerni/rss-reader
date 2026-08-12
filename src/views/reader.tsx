import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import type { ArticleRow } from "../db.js";
import { sanitizeHtml } from "../sanitize.js";
import { fullDate, hostname, type Scope } from "../util.js";
import { IconStar, IconExternal, IconCheck, IconLogo } from "./icons.js";

export const EmptyReader: FC<{ oob?: boolean }> = ({ oob }) => (
  <main
    id="reader-pane"
    {...(oob ? { "hx-swap-oob": "true" } : {})}
    class="grid h-dvh place-items-center bg-canvas px-8"
  >
    <div class="max-w-sm text-center">
      <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <IconLogo class="h-6 w-6" />
      </span>
      <h2 class="mt-4 text-base font-semibold tracking-tight">Pick something to read</h2>
      <p class="mt-1.5 text-sm leading-relaxed text-faint">
        Select an article from the list. Use <Kbd>j</Kbd> and <Kbd>k</Kbd> to move between items,
        and <Kbd>/</Kbd> to search.
      </p>
    </div>
  </main>
);

const Kbd: FC<{ children?: unknown }> = ({ children }) => (
  <kbd class="mx-0.5 rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[11px] text-muted">
    {children}
  </kbd>
);

export const ReaderActions: FC<{ article: ArticleRow; oob?: boolean }> = ({ article, oob }) => (
  <div
    id={`reader-actions-${article.id}`}
    {...(oob ? { "hx-swap-oob": "true" } : {})}
    class="ml-auto flex shrink-0 items-center gap-1"
  >
    <button
      type="button"
      hx-post={`/articles/${article.id}/star`}
      hx-swap="none"
      title={article.is_starred ? "Remove star" : "Star article"}
      class={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-raised ${
        article.is_starred ? "text-amber-500" : "text-faint hover:text-ink"
      }`}
    >
      <IconStar filled={article.is_starred === 1} />
    </button>
    <button
      type="button"
      hx-post={`/articles/${article.id}/read`}
      hx-swap="none"
      title={article.is_read ? "Mark as unread" : "Mark as read"}
      class={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-raised ${
        article.is_read ? "text-accent" : "text-faint hover:text-ink"
      }`}
    >
      <IconCheck />
    </button>
    {article.url ? (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        class="ml-1 flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-raised hover:text-ink"
      >
        <IconExternal class="h-3.5 w-3.5" />
        Open
      </a>
    ) : null}
  </div>
);

export const Reader: FC<{ article: ArticleRow; scope: Scope; oob?: boolean }> = ({ article, oob }) => {
  const body = sanitizeHtml(article.content ?? article.summary);
  const host = hostname(article.url ?? article.site_url);

  return (
    <main id="reader-pane" {...(oob ? { "hx-swap-oob": "true" } : {})} class="flex h-dvh flex-col bg-canvas">
      <header class="flex items-center gap-1.5 border-b border-line bg-surface/80 px-6 py-3 backdrop-blur">
        <span class="truncate text-xs font-medium text-muted">{article.feed_title}</span>
        <ReaderActions article={article} />
      </header>

      <div class="flex-1 overflow-y-auto">
        <article class="mx-auto max-w-[42rem] px-6 pb-24 pt-10">
          <h1 class="text-[28px] font-bold leading-[1.2] tracking-tight text-ink">
            {article.url ? (
              <a href={article.url} target="_blank" rel="noopener noreferrer" class="hover:text-accent">
                {article.title}
              </a>
            ) : (
              article.title
            )}
          </h1>

          <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
            {article.author ? (
              <>
                <span class="font-medium text-muted">{article.author}</span>
                <span>·</span>
              </>
            ) : null}
            <time datetime={new Date(article.published_at).toISOString()}>
              {fullDate(article.published_at)}
            </time>
            {host ? (
              <>
                <span>·</span>
                <span>{host}</span>
              </>
            ) : null}
          </div>

          {article.image_url && !body.includes(article.image_url) ? (
            <img
              src={article.image_url}
              alt=""
              class="mt-6 w-full rounded-xl border border-line object-cover"
              onerror="this.remove()"
            />
          ) : null}

          {body ? (
            <div class="article-body mt-7">{raw(body)}</div>
          ) : (
            <p class="mt-7 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
              This feed only provides a headline.{" "}
              {article.url ? (
                <a href={article.url} target="_blank" rel="noopener noreferrer" class="text-accent hover:underline">
                  Read it at the source →
                </a>
              ) : null}
            </p>
          )}
        </article>
      </div>
    </main>
  );
};
