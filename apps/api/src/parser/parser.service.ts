import { Injectable } from "@nestjs/common";
import { ParseInputDto } from "./dto/parse-input.dto";
import { ParsedConversationResult, ParsedEntity } from "./parser.types";
import { classifyByTaxonomy } from "./domain-taxonomy";

const NUMBER_PATTERN =
  "(?:\\d+(?:[.\\s]\\d{3})*(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";

@Injectable()
export class ParserService {
  private readonly monthMap: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  parse(dto: ParseInputDto): ParsedConversationResult {
    const rawText = dto.text.trim();
    const normalizedText = this.normalizeText(rawText);
    const isCorrection = this.hasCorrectionSignal(normalizedText);
    const entities: ParsedEntity[] = [];
    const dueDay = this.extractDueDay(normalizedText);
    const durationMonths = this.extractDurationMonths(normalizedText);
    const startMonthReference = this.extractStartMonthReference(normalizedText);
    const explicitStartMonth = this.extractExplicitStartMonth(normalizedText);
    const hasRecurringSignal = this.hasRecurringCommitmentSignal(normalizedText);
    const amount = isCorrection
      ? this.extractCorrectionAmount(normalizedText)
      : this.extractAmount(normalizedText, hasRecurringSignal ? dueDay : null);
    const timeReference = this.extractTimeReference(normalizedText);
    const counterparty = this.extractCounterparty(rawText);

    let intent: ParsedConversationResult["intent"] = "unknown";
    let direction: ParsedConversationResult["direction"] = null;
    let recurrence: string | null = null;

    if (isCorrection) {
      intent = "correction";
    } else if (this.hasRecurringCommitmentSignal(normalizedText)) {
      intent = "commitment";
      recurrence = this.detectRecurrence(normalizedText, dueDay);
      direction = this.hasFixedIncomeSignal(normalizedText) ? "income" : "expense";
    } else if (this.hasExpenseSignal(normalizedText)) {
      intent = "transaction";
      direction = "expense";
    } else if (this.hasIncomeSignal(normalizedText)) {
      intent = "transaction";
      direction = "income";
    }

    const inferredIntent = intent;

    const description = this.extractDescription(rawText, normalizedText, amount);
    const classification = this.classifyDomain(
      intent,
      direction,
      normalizedText,
      description,
      durationMonths,
    );

    if ((intent === "transaction" || intent === "commitment") && amount === null) {
      intent = "unknown";
      direction = null;
      recurrence = null;
    }

    if (amount !== null) {
      entities.push({ key: "amount", value: amount });
    }

    if (description) {
      entities.push({ key: "description", value: description });
    }

    if (recurrence) {
      entities.push({ key: "recurrence", value: recurrence });
    }

    if (durationMonths !== null) {
      entities.push({ key: "durationMonths", value: durationMonths });
    }

    if (startMonthReference) {
      entities.push({ key: "startMonthReference", value: startMonthReference });
    }

    if (explicitStartMonth) {
      entities.push({ key: "startMonth", value: explicitStartMonth.month });
      entities.push({ key: "startYear", value: explicitStartMonth.year });
    }

    if (timeReference) {
      entities.push({ key: "timeReference", value: timeReference });
    }

    if (dueDay !== null) {
      entities.push({ key: "dueDay", value: dueDay });
    }

    if (counterparty) {
      entities.push({ key: "counterparty", value: counterparty });
    }

    if (direction) {
      entities.push({ key: "direction", value: direction });
    }

    const missingFields: string[] = [];

    if (inferredIntent !== "unknown" && amount === null) {
      missingFields.push("amount");
    }

    if (inferredIntent !== "unknown" && !description) {
      missingFields.push("description");
    }

    return {
      rawText,
      intent,
      inferredIntent,
      direction,
      amount,
      description: classification.description,
      category: classification.category,
      summaryKind: classification.summaryKind,
      recurrence,
      durationMonths,
      startMonthReference,
      startMonth: explicitStartMonth?.month ?? null,
      startYear: explicitStartMonth?.year ?? null,
      timeReference,
      dueDay,
      counterparty,
      confidence: amount !== null || description ? "medium" : "low",
      missingFields,
      entities,
      placeholder: true,
    };
  }

  private classifyDomain(
    intent: ParsedConversationResult["intent"],
    direction: ParsedConversationResult["direction"],
    normalizedText: string,
    description: string | null,
    durationMonths: number | null,
  ): {
    description: string | null;
    category: string | null;
    summaryKind: ParsedConversationResult["summaryKind"];
  } {
    const classification = classifyByTaxonomy(intent, direction, normalizedText, description);

    if (
      intent === "commitment" &&
      direction === "expense" &&
      durationMonths !== null &&
      durationMonths > 0 &&
      durationMonths <= 6
    ) {
      return {
        ...classification,
        category: "divida curta",
      };
    }

    return classification;
  }

  private normalizeText(input: string): string {
    return input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  private hasExpenseSignal(input: string): boolean {
    return [
      "gastei",
      "gastar",
      "gastando",
      "gasto",
      "paguei",
      "pagar",
      "pagando",
      "comprei",
      "comprar",
      "desembolsei",
      "acabei de gastar",
      "acabei de pagar",
    ].some((token) => input.includes(token));
  }

  private hasIncomeSignal(input: string): boolean {
    return [
      "recebi",
      "receber",
      "recebendo",
      "ganhei",
      "ganhar",
      "caiu",
      "entrou",
      "acabou de entrar",
      "acabou de cair",
      "entrada",
      "pix recebido",
    ].some((token) => input.includes(token));
  }

  private hasFixedIncomeSignal(input: string): boolean {
    return (
      input.includes("entrada fixa") ||
      input.includes("receita fixa") ||
      input.includes("salario fixo") ||
      input.includes("salario mensal") ||
      input.includes("recebimento fixo") ||
      this.hasIncomeSignal(input)
    );
  }

  private hasRecurringCommitmentSignal(input: string): boolean {
    const hasFixedKeyword =
      input.includes("aluguel") ||
      input.includes("internet") ||
      input.includes("vivo") ||
      input.includes("claro") ||
      input.includes("tim") ||
      input.includes("escola") ||
      input.includes("seguro") ||
      input.includes("condominio") ||
      input.includes("financiamento") ||
      input.includes("emprestimo") ||
      input.includes("emprestimo") ||
      input.includes("parcela") ||
      input.includes("cartao") ||
      input.includes("cartão") ||
      input.includes("plano de saude") ||
      input.includes("plano saude") ||
      input.includes("oculos") ||
      input.includes("óculos") ||
      input.includes("transporte escolar") ||
      input.includes("van escolar") ||
      input.includes("perua escolar");

    return (
      input.includes("gasto fixo") ||
      input.includes("fixo") ||
      input.includes("contrato") ||
      input.includes("todo dia") ||
      input.includes("todo mes") ||
      input.includes("todo mes") ||
      input.includes("por mes") ||
      input.includes("vencimento") ||
      input.includes("mensal") ||
      input.includes("recorrente") ||
      hasFixedKeyword
    );
  }

  private hasCorrectionSignal(input: string): boolean {
    return (
      input.includes("nao foi") ||
      input.includes("não foi") ||
      input.includes("nao ") ||
      input.includes("não ") ||
      input.includes("corrige") ||
      input.includes("corrigir") ||
      input.includes("na verdade") ||
      input.includes("o valor certo")
    );
  }

  private detectRecurrence(input: string, dueDay: number | null): string {
    if (input.includes("todo dia") && dueDay !== null) {
      return "monthly";
    }

    if (input.includes("todo dia")) {
      return "daily";
    }

    return "monthly";
  }

  private extractDurationMonths(input: string): number | null {
    const match = input.match(
      /\b(?:por|durante)\s+(\d{1,2})\s+(?:mes|meses)\b/,
    );

    if (!match) {
      return null;
    }

    const parsedValue = Number(match[1]);
    return Number.isNaN(parsedValue) || parsedValue < 1 ? null : parsedValue;
  }

  private extractStartMonthReference(input: string): "current" | "next" | null {
    if (
      input.includes("a partir deste mes") ||
      input.includes("a partir desse mes") ||
      input.includes("a partir deste mês") ||
      input.includes("a partir desse mês")
    ) {
      return "current";
    }

    if (
      input.includes("a partir do mes que vem") ||
      input.includes("a partir do mês que vem") ||
      input.includes("a partir do proximo mes") ||
      input.includes("a partir do próximo mês")
    ) {
      return "next";
    }

    return null;
  }

  private extractExplicitStartMonth(input: string): { month: number; year: number } | null {
    const match = input.match(
      /a partir de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/,
    );

    if (!match) {
      return null;
    }

    const month = this.monthMap[match[1]];

    if (!month) {
      return null;
    }

    const currentYear = new Date().getFullYear();
    const year = match[2] ? Number(match[2]) : currentYear;

    if (Number.isNaN(year)) {
      return null;
    }

    return { month, year };
  }

  private extractAmount(input: string, ignoredValue?: number | null): number | null {
    const matches = Array.from(
      input.matchAll(new RegExp(`(?:r\\$\\s*)?(${NUMBER_PATTERN})`, "g")),
    );

    if (matches.length === 0) {
      return null;
    }

    const parsedValues = matches
      .map((match) => this.parseNumberFragment(match[1]))
      .filter((value): value is number => value !== null);

    if (parsedValues.length === 0) {
      return null;
    }

    if (ignoredValue !== null && ignoredValue !== undefined) {
      const filteredValues = parsedValues.filter((value) => value !== ignoredValue);

      return filteredValues.length > 0 ? filteredValues[0] : null;
    }

    return parsedValues[0];
  }

  private extractCorrectionAmount(input: string): number | null {
    const explicitPatterns: Array<{ pattern: RegExp; groupIndex: number }> = [
      {
        pattern: new RegExp(
          `nao foi\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})\\s*(?:,|\\s)+foi\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})`,
        ),
        groupIndex: 2,
      },
      {
        pattern: new RegExp(
          `nao\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})\\s*(?:,|\\s)+foi\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})`,
        ),
        groupIndex: 2,
      },
      {
        pattern: new RegExp(
          `foi\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})(?:[\\s\\S]{0,40})\\bnao\\b\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})`,
        ),
        groupIndex: 1,
      },
      {
        pattern: new RegExp(`corrige(?:\\s+para)?\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})`),
        groupIndex: 1,
      },
      {
        pattern: new RegExp(`na verdade foi\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})`),
        groupIndex: 1,
      },
      {
        pattern: new RegExp(
          `o valor certo(?:\\s+e|\\s+era)?\\s+(?:r\\$\\s*)?(${NUMBER_PATTERN})`,
        ),
        groupIndex: 1,
      },
    ];

    for (const { pattern, groupIndex } of explicitPatterns) {
      const match = input.match(pattern);

      if (match?.[groupIndex]) {
        return this.parseNumberFragment(match[groupIndex]);
      }
    }

    const matches = Array.from(
      input.matchAll(new RegExp(`(?:r\\$\\s*)?(${NUMBER_PATTERN})`, "g")),
    );

    if (matches.length === 0) {
      return null;
    }

    const lastMatch = matches[matches.length - 1]?.[1];

    if (!lastMatch) {
      return null;
    }

    return this.parseNumberFragment(lastMatch);
  }

  private parseNumberFragment(value: string): number | null {
    const normalizedNumber = value
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const parsedValue = Number(normalizedNumber);

    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  private extractDueDay(input: string): number | null {
    const match = input.match(/(?:todo dia|dia)\s+(\d{1,2})\b/);

    if (!match) {
      return null;
    }

    const day = Number(match[1]);
    return day >= 1 && day <= 31 ? day : null;
  }

  private extractTimeReference(
    input: string,
  ): "today" | "yesterday" | "tomorrow" | null {
    if (input.includes("hoje") || input.includes("agora") || input.includes("acabei de")) {
      return "today";
    }

    if (input.includes("acabou de")) {
      return "today";
    }

    if (input.includes("ontem")) {
      return "yesterday";
    }

    if (input.includes("amanha")) {
      return "tomorrow";
    }

    return null;
  }

  private extractCounterparty(input: string): string | null {
    const match = input.match(/\b(?:cliente|do cliente|da cliente)\s+([A-ZÀ-ÿ][\p{L}]+(?:\s+[A-ZÀ-ÿ][\p{L}]+)*)/u);
    return match?.[1]?.trim() ?? null;
  }

  private extractDescription(
    rawText: string,
    normalizedText: string,
    amount: number | null,
  ): string | null {
    let description = this.normalizeText(rawText);

    const removablePatterns = [
      /\b(hoje|ontem|amanha|agora)\b/g,
      /\bacabei de\b/g,
      /\bacabou de\b/g,
      /\bna verdade\b/g,
      /\beu\b/g,
      /\bnao foi\b/g,
      /\bnão foi\b/g,
      /\bnao\b/g,
      /\bnão\b/g,
      /\bcorrige\b/g,
      /\bcorrigir\b/g,
      /\bo valor certo\b/g,
      /\bfoi\b/g,
      /\btem um\b/g,
      /\btenho um\b/g,
      /\bdeixa apenas\b/g,
      /\bdeixa so\b/g,
      /\bdeixa só\b/g,
      /\bmantem apenas\b/g,
      /\bmantém apenas\b/g,
      /\btem\b/g,
      /\btenho\b/g,
      /\bum\b/g,
      /\buma\b/g,
      /\bgasto fixo\b/g,
      /\bfixo\b/g,
      /\bfixos\b/g,
      /\bcontrato\b/g,
      /\bpor mes\b/g,
      /\bvencimento\b/g,
      /\b(todo dia|todo mes|mensal|recorrente)\b/g,
      /\bdia\s+\d{1,2}\b/g,
      /\b(gastei|gastar|gastando|gasto|paguei|pagar|pagando|recebi|receber|recebendo|ganhei|ganhar|comprei|comprar|desembolsei|entrou|entrar|caiu|cair)\b/g,
      /\br\$\s*/g,
      /\bdo cliente\b/g,
      /\bda cliente\b/g,
      /\bcliente\b/g,
    ];

    removablePatterns.forEach((pattern) => {
      description = description.replace(pattern, " ");
    });

    if (amount !== null) {
      description = description
        .replace(new RegExp(String(amount).replace(".", "\\."), "g"), " ")
        .replace(/\b\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?\b/g, " ");
    }

    description = description
      .replace(/\b(no|na|do|da|de|pro|pra|para|com)\b(?=\s)/g, " ")
      .replace(/\bapartamento\b/g, "imovel")
      .replace(/\bcasa\b/g, "imovel")
      .replace(/\bfreelancer\b/g, "freelance")
      .replace(/\s+/g, " ")
      .trim();

    if (!description && normalizedText.includes("escola")) {
      return "escola";
    }

    return description || null;
  }
}
