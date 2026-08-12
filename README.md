# Reader

A local-first RSS reader. Hono on the server, SQLite for storage, HTMX for interactivity —
one process, no client-side framework.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

`npm run dev` watches both the TypeScript server and the stylesheet. For a one-off run
without watchers, use `npm start`.

## What it does

- **Add feeds** by URL. Paste a feed address or just the site — if you give it a homepage,
  it follows the `<link rel="alternate">` the page advertises. RSS 2.0, Atom, and RDF all work.
- **Folders** group feeds, with unread counts rolled up per folder.
- **Star** anything to keep it in the Starred view.
- **Search** across every article with SQLite FTS5, matching on title, excerpt, and body.
- **Refresh** pulls all feeds in parallel; articles are deduplicated per feed, so re-fetching
  never creates duplicates. A feed that fails to load records the error and shows a marker in
  the sidebar rather than breaking the run.
- **Dark and light themes**, following your system preference until you pick one.

### Keyboard

| Key | Action |
| --- | --- |
| `j` / `k` | Next / previous article |
| `/` | Focus search |
| `Esc` | Close dialog |

## Layout

```
src/
├── index.tsx        Hono routes — pages, HTMX fragments, mutations
├── db.ts            SQLite schema, applied on boot, and all queries
├── rss.ts           Feed fetching, autodiscovery, RSS/Atom/RDF parsing
├── sanitize.ts      Allowlist HTML sanitizer for feed content
├── util.ts          Formatting and URL-scope helpers
└── views/           JSX components (server-rendered)
styles/input.css     Design tokens + article typography
```

The database lives at `data/reader.db` and is created on first boot. Set `DB_PATH` to move it,
`PORT` to change the port.

## Notes

Feed content is untrusted HTML, so it runs through an allowlist sanitizer
([src/sanitize.ts](src/sanitize.ts)) before rendering: unknown tags and attributes are dropped,
scripts and embeds are removed entirely, and `javascript:` URLs are stripped. All SQL uses bound
parameters, and search input is tokenized before it reaches FTS5 so punctuation can't break the
query parser.
