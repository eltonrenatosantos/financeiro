export interface ParsedEntity {
  key: string;
  value: string | number;
}

export interface ParsedConversationResult {
  rawText: string;
  intent: "transaction" | "commitment" | "correction" | "unknown";
  inferredIntent: "transaction" | "commitment" | "correction" | "unknown";
  direction: "expense" | "income" | null;
  amount: number | null;
  description: string | null;
  category: string | null;
  summaryKind: "fixed" | "variable" | "income" | null;
  recurrence: string | null;
  durationMonths: number | null;
  startMonthReference: "current" | "next" | null;
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  endYear: number | null;
  timeReference: "today" | "yesterday" | "tomorrow" | null;
  dueDay: number | null;
  counterparty: string | null;
  confidence: "low" | "medium";
  missingFields: string[];
  entities: ParsedEntity[];
  placeholder: true;
}
