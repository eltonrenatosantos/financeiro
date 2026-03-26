"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavIcon({ kind }: { kind: "conversation" | "extract" | "summary" }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "conversation":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.4 7.6A2.4 2.4 0 0 1 8.8 5.2h6.4a2.4 2.4 0 0 1 2.4 2.4V13a2.4 2.4 0 0 1-2.4 2.4H11l-2.8 2.2v-2.2H8.8A2.4 2.4 0 0 1 6.4 13Z" {...stroke} />
          <circle cx="10" cy="10.3" r="0.8" fill="currentColor" />
          <circle cx="12.9" cy="10.3" r="0.8" fill="currentColor" />
        </svg>
      );
    case "extract":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.2 5.8h9.6M7.2 10.9h9.6M7.2 16h6.1" {...stroke} />
          <rect x="5" y="4" width="14" height="16" rx="3" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 16.8v-3.3M12 16.8V7M17.5 16.8v-5.1" {...stroke} />
          <path d="M5 18.8h14" {...stroke} />
        </svg>
      );
  }
}

const links = [
  { href: "/", label: "Conversa", icon: "conversation" as const },
  { href: "/transactions", label: "Extrato", icon: "extract" as const },
  { href: "/dashboard", label: "Resumo", icon: "summary" as const },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navegacao principal">
      {links.map((link) => {
        const isActive =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              <NavIcon kind={link.icon} />
            </span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
