import type { FC } from "hono/jsx";

type IconProps = { class?: string };

const base = "h-4 w-4 shrink-0";

export const IconInbox: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

export const IconDot: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  </svg>
);

export const IconStar: FC<IconProps & { filled?: boolean }> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill={p.filled ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="m12 2.5 2.9 5.88 6.49.95-4.7 4.58 1.11 6.46L12 17.32l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.95z" />
  </svg>
);

export const IconFolder: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z" />
  </svg>
);

export const IconRefresh: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

export const IconPlus: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconSearch: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconCheck: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m4 12 5 5L20 6" />
  </svg>
);

export const IconExternal: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 4h6v6" />
    <path d="M20 4 10 14" />
    <path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  </svg>
);

export const IconTrash: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M9 7V4h6v3" />
  </svg>
);

export const IconClose: FC<IconProps> = (p) => (
  <svg class={p.class ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconLogo: FC<IconProps> = (p) => (
  <svg class={p.class ?? "h-5 w-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 20a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill="currentColor" />
    <path d="M4 11a9 9 0 0 1 9 9" />
    <path d="M4 4a16 16 0 0 1 16 16" />
  </svg>
);
