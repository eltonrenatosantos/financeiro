"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavIcon({ kind }: { kind: "conversation" | "extract" | "summary" }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "conversation":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.2 7.5A2.3 2.3 0 0 1 8.5 5.2h7a2.3 2.3 0 0 1 2.3 2.3v5.2a2.3 2.3 0 0 1-2.3 2.3h-4.3l-3 2.5v-2.5H8.5a2.3 2.3 0 0 1-2.3-2.3Z" {...stroke} />
        </svg>
      );
    case "extract":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 5.5h10M7 11h10M7 16.5h7" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 16.5V12M12 16.5V7.5M18 16.5V10" {...stroke} />
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
