import type { FC, PropsWithChildren } from "hono/jsx";
import type { Folder, FeedWithCount } from "../db.js";
import { type Scope, scopeToQuery, hostname } from "../util.js";
import { IconClose, IconTrash } from "./icons.js";

const closeModal = "document.getElementById('modal').innerHTML = ''";

const Modal: FC<PropsWithChildren<{ title: string; description?: string }>> = ({
  title,
  description,
  children,
}) => (
  <div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[12vh] backdrop-blur-sm">
    <div
      class="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-pop"
      onclick="event.stopPropagation()"
    >
      <div class="flex items-start gap-3 border-b border-line px-5 py-4">
        <div class="min-w-0 flex-1">
          <h2 class="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description ? <p class="mt-0.5 text-xs text-faint">{description}</p> : null}
        </div>
        <button
          type="button"
          onclick={closeModal}
          class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-raised hover:text-ink"
        >
          <IconClose />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const AddFeedModal: FC<{
  folders: Folder[];
  feeds: FeedWithCount[];
  scope: Scope;
  error?: string;
  value?: string;
}> = ({ folders, feeds, scope, error, value }) => (
  <Modal title="Add a feed" description="Paste a feed URL, or just a site address — we'll find it.">
    <form
      hx-post={`/feeds${scopeToQuery(scope)}`}
      hx-target="#modal"
      hx-swap="innerHTML"
      hx-disabled-elt="find button[type=submit]"
      class="px-5 py-4"
    >
      <label class="block text-xs font-medium text-muted" for="feed-url">
        Feed or site URL
      </label>
      <input
        id="feed-url"
        name="url"
        type="text"
        required
        autofocus
        value={value ?? ""}
        placeholder="https://news.ycombinator.com/rss"
        class="mt-1.5 w-full rounded-xl border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent/60 focus:bg-surface focus:ring-4 focus:ring-accent/10"
      />

      <label class="mt-4 block text-xs font-medium text-muted" for="feed-folder">
        Folder
      </label>
      <div class="mt-1.5 flex gap-2">
        <select
          id="feed-folder"
          name="folder_id"
          class="min-w-0 flex-1 rounded-xl border border-line bg-raised px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent/60 focus:bg-surface focus:ring-4 focus:ring-accent/10"
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option value={String(f.id)}>{f.name}</option>
          ))}
        </select>
        <input
          name="new_folder"
          type="text"
          placeholder="or new folder…"
          class="min-w-0 flex-1 rounded-xl border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent/60 focus:bg-surface focus:ring-4 focus:ring-accent/10"
        />
      </div>

      {error ? (
        <p class="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div class="mt-5 flex items-center gap-2">
        <button
          type="submit"
          class="group flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-60"
        >
          <span class="group-[.htmx-request]:hidden">Add feed</span>
          <span class="hidden group-[.htmx-request]:inline">Fetching…</span>
        </button>
        <button
          type="button"
          onclick={closeModal}
          class="rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-raised hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>

    {feeds.length > 0 ? (
      <div class="max-h-56 overflow-y-auto border-t border-line px-5 py-3">
        <p class="pb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
          Subscribed ({feeds.length})
        </p>
        {feeds.map((feed) => (
          <div class="group flex items-center gap-2 py-1.5 text-sm">
            <span class="min-w-0 flex-1 truncate text-muted">{feed.title}</span>
            <span class="shrink-0 text-xs text-faint">{hostname(feed.site_url ?? feed.feed_url)}</span>
            <button
              type="button"
              hx-delete={`/feeds/${feed.id}`}
              hx-confirm={`Unsubscribe from "${feed.title}"? Its articles will be deleted.`}
              hx-target="#list-pane"
              hx-swap="outerHTML"
              title="Unsubscribe"
              class="grid h-6 w-6 shrink-0 place-items-center rounded-md text-faint opacity-0 transition hover:bg-raised hover:text-danger group-hover:opacity-100"
            >
              <IconTrash class="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    ) : null}
  </Modal>
);
