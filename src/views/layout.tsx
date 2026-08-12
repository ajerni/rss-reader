import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";

/** Applies the stored theme before first paint so there is no flash of the wrong theme. */
const THEME_BOOTSTRAP = `
(function () {
  var stored = localStorage.getItem('theme');
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
})();
`;

const APP_SCRIPT = `
function toggleTheme() {
  var dark = !document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

document.addEventListener('keydown', function (e) {
  var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (e.key === 'Escape') {
    var modal = document.getElementById('modal');
    if (modal && modal.innerHTML.trim()) { modal.innerHTML = ''; return; }
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); document.getElementById('search-input')?.focus(); return; }
  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    var rows = Array.from(document.querySelectorAll('[data-article-row]'));
    if (!rows.length) return;
    var current = document.querySelector('[data-article-row][data-selected="true"]');
    var next = rows[Math.min(Math.max(rows.indexOf(current) + (e.key === 'j' ? 1 : -1), 0), rows.length - 1)];
    if (next) { next.click(); next.scrollIntoView({ block: 'nearest' }); }
  }
});

document.body.addEventListener('close-modal', function () {
  document.getElementById('modal').innerHTML = '';
});

document.body.addEventListener('htmx:responseError', function (e) {
  var banner = document.getElementById('toast');
  if (!banner) return;
  banner.textContent = e.detail.xhr.responseText || 'Something went wrong';
  banner.classList.remove('hidden');
  setTimeout(function () { banner.classList.add('hidden'); }, 5000);
});
`;

export const Layout: FC<PropsWithChildren<{ title?: string }>> = ({ children, title }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title ?? "Reader"}</title>
      <link rel="stylesheet" href="/styles.css" />
      <link
        rel="icon"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='5' cy='19' r='1.4' fill='%236366f1'/%3E%3Cpath d='M4 11a9 9 0 0 1 9 9'/%3E%3Cpath d='M4 4a16 16 0 0 1 16 16'/%3E%3C/svg%3E"
      />
      <script>{raw(THEME_BOOTSTRAP)}</script>
      <script src="/htmx.min.js" defer></script>
    </head>
    <body class="h-dvh overflow-hidden bg-canvas text-ink antialiased selection:bg-accent/25">
      {children}
      <div id="modal" />
      <div
        id="toast"
        class="hidden fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-danger/40 bg-surface px-4 py-2.5 text-sm text-danger shadow-pop"
      />
      <script>{raw(APP_SCRIPT)}</script>
    </body>
  </html>
);
