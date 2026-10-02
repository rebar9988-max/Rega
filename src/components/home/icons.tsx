/** Line icons used on the home page and in the footer (REGA red, 24px grid). Decorative: always aria-hidden. */
const P: Record<string, React.ReactNode> = {
  health: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  food: <path d="M7 3v8m-2-8v4a2 2 0 0 0 4 0V3M7 11v10M16 3c-1.7 1.2-2.5 3-2.5 6s.8 3.6 2.5 4v8" />,
  legal: <path d="M12 4v16M8 20h8M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0L5 8Zm14 0-2.5 6a3 3 0 0 0 5 0L19 8Z" />,
  admin: <path d="M7 3h7l4 4v14H7V3Zm7 0v4h4M10 12h5M10 16h5" />,
  all: <g><circle cx="7" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="17" cy="12" r="1.5" /></g>,
  grid: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />,
  search: <g><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></g>,
  pin: <g><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></g>,
  near: <path d="m21 3-7.5 18-2.5-7.5L3.5 11 21 3Z" />,
  clock: <g><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>,
  store: <path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M9.5 20v-5h5v5" />,
  briefcase: <path d="M4 8h16v11H4V8Zm5 0V5h6v3M4 13h16" />,
  flame: <path d="M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8-1 2-2.5 3-3.5 3 .3-2.5-.5-5-2.5-7 0 3.5-4.5 6-4.5 12a8 8 0 0 0 8 6Z" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  phone: <path d="M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" />,
  mail: <g><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></g>,
};

export function HomeIcon({ name, className = "size-6", filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] ?? P.grid}
    </svg>
  );
}
