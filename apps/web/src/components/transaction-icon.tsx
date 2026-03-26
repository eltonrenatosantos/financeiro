type TransactionIconKind =
  | "shopping"
  | "food"
  | "car"
  | "health"
  | "education"
  | "play"
  | "internet"
  | "home"
  | "finance"
  | "income"
  | "dot";

function iconStrokeProps() {
  return {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function resolveTransactionIconKind(
  description: string,
  category?: string | null,
  direction?: "expense" | "income" | "transfer",
): TransactionIconKind {
  const text = `${category ?? ""} ${description}`.toLowerCase();

  if (text.includes("mercado") || text.includes("supermercado") || text.includes("compra")) {
    return "shopping";
  }

  if (
    text.includes("almoço") ||
    text.includes("almoco") ||
    text.includes("jantar") ||
    text.includes("restaurante")
  ) {
    return "food";
  }

  if (
    text.includes("transporte") ||
    text.includes("uber") ||
    text.includes("gasolina") ||
    text.includes("carro")
  ) {
    return "car";
  }

  if (
    text.includes("saúde") ||
    text.includes("saude") ||
    text.includes("farmácia") ||
    text.includes("farmacia") ||
    text.includes("dentista") ||
    text.includes("oculos") ||
    text.includes("óculos")
  ) {
    return "health";
  }

  if (
    text.includes("educação") ||
    text.includes("educacao") ||
    text.includes("escola") ||
    text.includes("papelaria") ||
    text.includes("kalunga")
  ) {
    return "education";
  }

  if (
    text.includes("assinatura") ||
    text.includes("streaming") ||
    text.includes("netflix") ||
    text.includes("disney") ||
    text.includes("spotify")
  ) {
    return "play";
  }

  if (text.includes("internet")) {
    return "internet";
  }

  if (
    text.includes("moradia") ||
    text.includes("aluguel") ||
    text.includes("condomínio") ||
    text.includes("condominio")
  ) {
    return "home";
  }

  if (
    text.includes("empréstimo") ||
    text.includes("emprestimo") ||
    text.includes("cartão") ||
    text.includes("cartao")
  ) {
    return "finance";
  }

  if (direction === "income") {
    return "income";
  }

  return "dot";
}

export function TransactionIcon({
  description,
  category,
  direction,
}: {
  description: string;
  category?: string | null;
  direction?: "expense" | "income" | "transfer";
}) {
  const kind = resolveTransactionIconKind(description, category, direction);
  const stroke = iconStrokeProps();

  switch (kind) {
    case "shopping":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7.2 9.2h9.9l-1 5.2a2 2 0 0 1-2 1.6H9.6a2 2 0 0 1-2-1.6L6.5 6.1H4.6" {...stroke} />
          <circle cx="10.1" cy="18.7" r="1" fill="currentColor" />
          <circle cx="15.9" cy="18.7" r="1" fill="currentColor" />
        </svg>
      );
    case "food":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4v7M9.8 4v7M8.4 11v9M14.5 4v16M17.8 4c0 2.8-1.1 4.8-3.3 6" {...stroke} />
        </svg>
      );
    case "car":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.5 14.8 7 10.2a2 2 0 0 1 1.9-1.4h6.2a2 2 0 0 1 1.9 1.4l1.5 4.6M4.5 15h15v2.7a1 1 0 0 1-1 1h-.8M5.3 18.7h-.8a1 1 0 0 1-1-1V15m3.1 3.7v-2m9.8 2v-2" {...stroke} />
          <circle cx="7.7" cy="15.4" r="1" fill="currentColor" />
          <circle cx="16.3" cy="15.4" r="1" fill="currentColor" />
        </svg>
      );
    case "health":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6.2v11.6M6.2 12h11.6" {...stroke} />
        </svg>
      );
    case "education":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m4.5 8 7.5-3.6L19.5 8 12 11.6 4.5 8Z" {...stroke} />
          <path d="M8.2 10.6v3.4c0 .9 1.7 2.1 3.8 2.1s3.8-1.2 3.8-2.1v-3.4" {...stroke} />
        </svg>
      );
    case "play":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5.5" y="6.3" width="13" height="11.4" rx="3" {...stroke} />
          <path d="m10.3 9.3 4.6 2.7-4.6 2.7Z" {...stroke} />
        </svg>
      );
    case "internet":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7" {...stroke} />
          <path d="M5.5 12h13M12 5.2c2 2 2.8 4.2 2.8 6.8S14 16.8 12 18.8M12 5.2c-2 2-2.8 4.2-2.8 6.8S10 16.8 12 18.8" {...stroke} />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 10.2 12 4.8l7 5.4v8a1 1 0 0 1-1 1h-4.2v-5H10.2v5H6a1 1 0 0 1-1-1Z" {...stroke} />
        </svg>
      );
    case "finance":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4.5" y="6.5" width="15" height="11" rx="2.6" {...stroke} />
          <path d="M9.2 12h5.6" {...stroke} />
          <circle cx="8" cy="12" r="0.9" fill="currentColor" />
          <circle cx="16" cy="12" r="0.9" fill="currentColor" />
        </svg>
      );
    case "income":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 18V6M12 6 8.6 9.4M12 6l3.4 3.4" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      );
  }
}
