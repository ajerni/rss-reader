import type { FC } from "hono/jsx";
import type { Folder, FeedWithCount, Counts } from "../db.js";
import { type Scope, scopeToQuery, faviconUrl, hueFor, initials } from "../util.js";
import { IconInbox, IconDot, IconStar, IconFolder, IconPlus, IconRefresh, IconSearch, IconLogo } from "./icons.js";

export type SidebarData = {
  scope: Scope;
  folders: Folder[];
  feeds: FeedWithCount[];
  counts: Counts;
  folderUnread: Map<number, number>;
};

const navLink = (target: Scope) => {
  const query = scopeToQuery(target);
  return {
    "hx-get": `/list${query}`,
    "hx-target": "#list-pane",
    "hx-swap": "outerHTML",
    "hx-push-url": `/${query}`,
    "hx-indicator": "#list-pane",
  };
};

const Count: FC<{ value: number; active: boolean }> = ({ value, active }) =>
  value > 0 ? (
    <span
      class={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        active ? "bg-accent-soft text-accent" : "bg-raised text-faint"
      }`}
    >
      {value > 999 ? "999+" : value}
    </span>
  ) : null;

const FeedRow: FC<{ feed: FeedWithCount; scope: Scope; nested?: boolean }> = ({ feed, scope, nested }) => {
  const active = scope.feedId === feed.id;
  const icon = faviconUrl(feed.site_url ?? feed.feed_url);
  const hue = hueFor(feed.feed_url);
  return (
    <a
      href={`/${scopeToQuery({ view: scope.view, feedId: feed.id })}`}
      {...navLink({ view: scope.view, feedId: feed.id })}
      title={feed.last_error ? `Last refresh failed: ${feed.last_error}` : feed.title}
      class={`group flex items-center gap-2.5 rounded-lg py-1.5 pr-2 text-sm transition-colors ${
        nested ? "pl-8" : "pl-2.5"
      } ${active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-raised hover:text-ink"}`}
    >
      <span
        class="relative grid h-4 w-4 shrink-0 place-items-center overflow-hidden rounded-[4px] text-[8px] font-bold text-white"
        style={`background: hsl(${hue} 62% 52%)`}
      >
        {initials(feed.title)}
        {icon ? (
          <img
            src={icon}
            alt=""
            loading="lazy"
            class="absolute inset-0 h-4 w-4 object-cover"
            onerror="this.remove()"
          />
        ) : null}
      </span>
      <span class="truncate">{feed.title}</span>
      {feed.last_error ? <span class="shrink-0 text-danger" title={feed.last_error}>!</span> : null}
      <Count value={feed.unread} active={active} />
    </a>
  );
};

export const Sidebar: FC<SidebarData & { oob?: boolean }> = ({
  scope,
  folders,
  feeds,
  counts,
  folderUnread,
  oob,
}) => {
  const unfiled = feeds.filter((f) => f.folder_id === null);
  const isViewActive = (view: Scope["view"]) =>
    scope.view === view && scope.feedId === undefined && scope.folderId === undefined && !scope.search;

  return (
    <aside
      id="sidebar"
      {...(oob ? { "hx-swap-oob": "true" } : {})}
      class="flex h-dvh flex-col border-r border-line bg-surface"
    >
      <div class="flex items-center gap-2 px-4 pb-3 pt-4">
        <span class="text-accent">
          <IconLogo />
        </span>
        <span class="text-[15px] font-semibold tracking-tight">Reader</span>
        <button
          type="button"
          onclick="toggleTheme()"
          title="Toggle theme"
          class="ml-auto grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-raised hover:text-ink"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>
      </div>

      <form
        class="relative px-3 pb-3"
        hx-get="/list"
        hx-target="#list-pane"
        hx-swap="outerHTML"
        hx-push-url="true"
        hx-trigger="submit, keyup changed delay:350ms from:#search-input, search from:#search-input"
      >
        <input type="hidden" name="view" value={scope.view} />
        <span class="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-faint">
          <IconSearch />
        </span>
        <input
          id="search-input"
          type="search"
          name="q"
          value={scope.search ?? ""}
          placeholder="Search articles"
          autocomplete="off"
          class="w-full rounded-xl border border-line bg-raised py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent/60 focus:bg-surface focus:ring-4 focus:ring-accent/10"
        />
      </form>

      <nav class="flex-1 overflow-y-auto px-3 pb-3">
        <div class="space-y-0.5">
          {(
            [
              ["all", "All articles", counts.all, IconInbox],
              ["unread", "Unread", counts.unread, IconDot],
              ["starred", "Starred", counts.starred, IconStar],
            ] as const
          ).map(([view, label, count, Icon]) => {
            const active = isViewActive(view);
            return (
              <a
                href={`/${scopeToQuery({ view })}`}
                {...navLink({ view })}
                class={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <Icon />
                <span>{label}</span>
                <Count value={count} active={active} />
              </a>
            );
          })}
        </div>

        {folders.map((folder) => {
          const folderFeeds = feeds.filter((f) => f.folder_id === folder.id);
          const active = scope.folderId === folder.id;
          return (
            <div class="mt-4">
              <div class="group flex items-center gap-1">
                <a
                  href={`/${scopeToQuery({ view: scope.view, folderId: folder.id })}`}
                  {...navLink({ view: scope.view, folderId: folder.id })}
                  class={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    active ? "bg-accent-soft text-accent" : "text-faint hover:bg-raised hover:text-ink"
                  }`}
                >
                  <IconFolder class="h-3.5 w-3.5 shrink-0" />
                  <span class="truncate">{folder.name}</span>
                  <Count value={folderUnread.get(folder.id) ?? 0} active={active} />
                </a>
                <button
                  type="button"
                  hx-delete={`/folders/${folder.id}`}
                  hx-confirm={`Delete folder "${folder.name}"? Its feeds move to Unfiled.`}
                  hx-target="#list-pane"
                  hx-swap="outerHTML"
                  title="Delete folder"
                  class="grid h-6 w-6 shrink-0 place-items-center rounded-md text-faint opacity-0 transition hover:bg-raised hover:text-danger group-hover:opacity-100"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <div class="mt-0.5 space-y-0.5">
                {folderFeeds.length > 0 ? (
                  folderFeeds.map((feed) => <FeedRow feed={feed} scope={scope} nested />)
                ) : (
                  <p class="px-8 py-1 text-xs text-faint">No feeds</p>
                )}
              </div>
            </div>
          );
        })}

        {unfiled.length > 0 ? (
          <div class="mt-4">
            <p class="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
              {folders.length > 0 ? "Unfiled" : "Feeds"}
            </p>
            <div class="mt-0.5 space-y-0.5">
              {unfiled.map((feed) => (
                <FeedRow feed={feed} scope={scope} />
              ))}
            </div>
          </div>
        ) : null}

        {feeds.length === 0 ? (
          <p class="mt-6 rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs leading-relaxed text-faint">
            No feeds yet.
            <br />
            Add one to get started.
          </p>
        ) : null}
      </nav>

      <div class="space-y-2 border-t border-line p-3">
        <button
          type="button"
          hx-get="/feeds/new"
          hx-target="#modal"
          hx-swap="innerHTML"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-strong active:scale-[0.99]"
        >
          <IconPlus />
          Add feed
        </button>
        <button
          type="button"
          hx-post={`/refresh${scopeToQuery(scope)}`}
          hx-target="#list-pane"
          hx-swap="outerHTML"
          hx-indicator="#refresh-btn"
          id="refresh-btn"
          class="group flex w-full items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:bg-raised hover:text-ink disabled:opacity-60"
        >
          <span class="group-[.htmx-request]:animate-spin">
            <IconRefresh />
          </span>
          <span class="group-[.htmx-request]:hidden">Refresh all</span>
          <span class="hidden group-[.htmx-request]:inline">Refreshing…</span>
        </button>
      </div>
    </aside>
  );
};
