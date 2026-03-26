import { ParsedConversationResult } from "./parser.types";

type DomainRule = {
  tokens: string[];
  description: string;
  category: string;
  summaryKind: ParsedConversationResult["summaryKind"];
};

type ClassifiedDomain = {
  description: string | null;
  category: string | null;
  summaryKind: ParsedConversationResult["summaryKind"];
};

function resolveSpecificShoppingDescription(normalizedText: string) {
  if (hasWholeTokenOrPhrase(normalizedText, "supermercado")) {
    return "supermercado";
  }

  if (hasWholeTokenOrPhrase(normalizedText, "padaria")) {
    return "padaria";
  }

  if (hasWholeTokenOrPhrase(normalizedText, "feira")) {
    return "feira";
  }

  if (hasWholeTokenOrPhrase(normalizedText, "sacolao")) {
    return "sacolao";
  }

  if (hasWholeTokenOrPhrase(normalizedText, "mercado")) {
    return "mercado";
  }

  return null;
}

function hasWholeTokenOrPhrase(normalizedText: string, token: string) {
  if (token.includes(" ")) {
    return normalizedText.includes(token);
  }

  const parts = normalizedText.split(" ");
  return parts.includes(token);
}

export const COMMITMENT_DOMAIN_RULES: DomainRule[] = [
  {
    tokens: ["prolabore", "pro labore", "pro-labore"],
    description: "prolabore",
    category: "entrada fixa",
    summaryKind: "income",
  },
  {
    tokens: ["salario", "salário"],
    description: "salario",
    category: "entrada fixa",
    summaryKind: "income",
  },
  {
    tokens: ["freelance", "freela", "freelancer"],
    description: "freelance",
    category: "entrada fixa",
    summaryKind: "income",
  },
  {
    tokens: ["aluguel carro", "aluguel do carro", "locacao de carro", "locação de carro"],
    description: "aluguel carro",
    category: "mobilidade fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["aluguel roupa", "aluguel de roupa", "aluguel vestido", "aluguel de vestido", "aluguel terno", "aluguel de terno"],
    description: "aluguel roupa",
    category: "servicos fixos",
    summaryKind: "fixed",
  },
  {
    tokens: ["mercado", "supermercado", "padaria", "feira", "sacolao"],
    description: "compras do mes",
    category: "compras fixas",
    summaryKind: "fixed",
  },
  {
    tokens: ["aluguel", "apartamento", "imovel", "casa"],
    description: "moradia",
    category: "moradia fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["internet", "vivo", "claro", "tim"],
    description: "internet",
    category: "conectividade fixa",
    summaryKind: "fixed",
  },
  {
    tokens: [
      "streaming",
      "streamings",
      "filmes",
      "series",
      "séries",
      "plataforma de video",
      "plataforma de vídeo",
      "tv por assinatura",
      "netflix",
      "disney",
      "disney+",
      "apple tv",
      "prime video",
      "prime vídeo",
      "max",
      "spotify",
      "youtube premium",
    ],
    description: "assinaturas",
    category: "assinaturas fixas",
    summaryKind: "fixed",
  },
  {
    tokens: ["agua", "sabesp"],
    description: "agua",
    category: "casa fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["luz", "energia", "enel", "cemig"],
    description: "energia",
    category: "casa fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["transporte escolar", "van escolar", "perua escolar"],
    description: "transporte escolar",
    category: "educacao fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["escola", "colegio", "faculdade", "material escolar", "uniforme", "kalunga", "papelaria"],
    description: "escola",
    category: "educacao fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["condominio"],
    description: "condominio",
    category: "moradia fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["seguro"],
    description: "seguro",
    category: "protecao fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["plano de saude", "plano saude", "convenio", "convênio", "unimed", "amil", "bradesco saude", "bradesco saúde", "sulamerica", "sulamérica"],
    description: "plano de saude",
    category: "saude fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["oculos", "óculos"],
    description: "oculos",
    category: "saude fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["cartao", "cartão", "fatura do cartao", "fatura do cartão"],
    description: "cartao",
    category: "financeiro fixo",
    summaryKind: "fixed",
  },
  {
    tokens: ["emprestimo", "empréstimo", "financiamento", "parcela", "prestacao", "prestação", "boleto", "divida", "dívida"],
    description: "emprestimo",
    category: "financeiro fixo",
    summaryKind: "fixed",
  },
];

export const TRANSACTION_DOMAIN_RULES: DomainRule[] = [
  {
    tokens: ["mercado", "supermercado", "padaria", "feira", "sacolao"],
    description: "",
    category: "compras do mes",
    summaryKind: "variable",
  },
  {
    tokens: ["almoco", "jantar", "restaurante", "lanche", "cafe", "pao", "pão"],
    description: "",
    category: "alimentacao",
    summaryKind: "variable",
  },
  {
    tokens: ["uber", "99", "onibus", "metro"],
    description: "",
    category: "transporte",
    summaryKind: "variable",
  },
  {
    tokens: ["gasolina", "combustivel", "posto", "manutencao", "mecanico", "oficina", "pneu", "ipva", "seguro do carro"],
    description: "",
    category: "carro",
    summaryKind: "variable",
  },
  {
    tokens: ["farmacia", "remedio", "medicamento", "consulta", "dentista", "exame", "hospital"],
    description: "",
    category: "saude",
    summaryKind: "variable",
  },
  {
    tokens: ["kalunga", "material escolar", "papelaria", "escola", "colegio", "faculdade", "curso", "uniforme"],
    description: "",
    category: "educacao",
    summaryKind: "variable",
  },
  {
    tokens: [
      "streaming",
      "streamings",
      "filmes",
      "series",
      "séries",
      "plataforma de video",
      "plataforma de vídeo",
      "tv por assinatura",
      "netflix",
      "disney",
      "disney+",
      "apple tv",
      "prime video",
      "prime vídeo",
      "max",
      "spotify",
      "youtube premium",
    ],
    description: "",
    category: "assinaturas",
    summaryKind: "variable",
  },
  {
    tokens: ["condominio"],
    description: "condominio",
    category: "moradia fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["internet", "vivo", "claro", "tim"],
    description: "internet",
    category: "conectividade fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["aluguel", "apartamento", "imovel", "casa"],
    description: "moradia",
    category: "moradia fixa",
    summaryKind: "fixed",
  },
  {
    tokens: ["prolabore", "pro labore", "pro-labore"],
    description: "prolabore",
    category: "entrada",
    summaryKind: "income",
  },
  {
    tokens: ["salario", "salário"],
    description: "salario",
    category: "entrada",
    summaryKind: "income",
  },
  {
    tokens: ["freelance", "freela", "freelancer", "cliente", "pagamento", "pix recebido"],
    description: "",
    category: "entrada",
    summaryKind: "income",
  },
];

export function hasTransactionExpenseContext(normalizedText: string) {
  return TRANSACTION_DOMAIN_RULES.some(
    (rule) =>
      rule.summaryKind === "variable" &&
      rule.tokens.some((token) => hasWholeTokenOrPhrase(normalizedText, token)),
  );
}

export function hasTransactionIncomeContext(normalizedText: string) {
  return TRANSACTION_DOMAIN_RULES.some(
    (rule) =>
      rule.summaryKind === "income" &&
      rule.tokens.some((token) => hasWholeTokenOrPhrase(normalizedText, token)),
  );
}

export function classifyByTaxonomy(
  intent: ParsedConversationResult["intent"],
  direction: ParsedConversationResult["direction"],
  normalizedText: string,
  description: string | null,
): ClassifiedDomain {
  if (intent === "commitment") {
    const matched = COMMITMENT_DOMAIN_RULES.find((rule) =>
      rule.tokens.some((token) => hasWholeTokenOrPhrase(normalizedText, token)),
    );

    if (matched) {
      return {
        description: matched.description || description,
        category: matched.category,
        summaryKind: direction === "income" ? "income" : matched.summaryKind,
      };
    }

    return {
      description,
      category: direction === "income" ? "entrada fixa" : "gasto fixo",
      summaryKind: direction === "income" ? "income" : "fixed",
    };
  }

  if (intent === "transaction") {
    const matched = TRANSACTION_DOMAIN_RULES.find((rule) =>
      rule.tokens.some((token) => hasWholeTokenOrPhrase(normalizedText, token)),
    );

    if (matched) {
      const specificShoppingDescription =
        matched.category === "compras do mes"
          ? resolveSpecificShoppingDescription(normalizedText)
          : null;

      return {
        description:
          specificShoppingDescription ?? (matched.description || description),
        category: matched.category,
        summaryKind: matched.summaryKind,
      };
    }

    return {
      description,
      category: direction === "income" ? "entrada" : null,
      summaryKind: direction === "income" ? "income" : "variable",
    };
  }

  return {
    description,
    category: null,
    summaryKind: null,
  };
}
