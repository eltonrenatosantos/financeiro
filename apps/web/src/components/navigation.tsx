import Link from "next/link";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transacoes" },
  { href: "/commitments", label: "Compromissos" },
  { href: "/attachments", label: "Comprovantes" },
  { href: "/settings", label: "Configuracoes" },
];

export function Navigation() {
  return (
    <nav className="nav" aria-label="Primary">
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

