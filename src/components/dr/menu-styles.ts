/**
 * Shared look of dashboard menu rows (links and buttons). Plain strings in a server-safe module: server components
 * may combine them (a "use client" module would hand them a client reference instead of the string).
 */
export const menuItem = "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-sm font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-50";
export const menuItemDanger = "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-sm font-semibold text-brand transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft disabled:opacity-50";
