import { Injectable, Logger } from "@nestjs/common";
import { CreateConversationTurnDto } from "./dto/create-conversation-turn.dto";
import { ParserService } from "../parser/parser.service";
import { SupabaseService } from "../integrations/supabase/supabase.service";
import {
  ConversationPersistenceResult,
  ConversationTurnResponse,
} from "./conversation.types";

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly numberPattern =
    /(?:r\$\s*)?(\d+(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
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
  private readonly genericCommitmentTerms = new Set([
    "aluguel",
    "internet",
    "vivo",
    "claro",
    "tim",
    "telefone",
    "celular",
    "escola",
    "seguro",
    "academia",
    "agua",
    "luz",
    "energia",
    "condominio",
    "financiamento",
    "parcela",
  ]);
  private readonly ignoredCommitmentTokens = new Set([
    "tem",
    "tenho",
    "um",
    "uma",
    "gasto",
    "fixo",
    "mes",
    "mensal",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "para",
    "pro",
    "pra",
    "com",
    "e",
  ]);

  constructor(
    private readonly parserService: ParserService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async createTurn(dto: CreateConversationTurnDto): Promise<ConversationTurnResponse> {
    const parsed = this.parserService.parse({ text: dto.text });
    const destructivePersistence = await this.handleDestructiveCommand(dto.text);
    const persistence = destructivePersistence ?? (await this.persistTurn(dto, parsed));

    return {
      message: "Entrada conversacional processada no modo placeholder.",
      assistantReply: this.buildAssistantReply(parsed, persistence),
      payload: dto,
      parsed,
      persistence,
    };
  }

  private buildAssistantReply(
    parsed: ReturnType<ParserService["parse"]>,
    persistence: ConversationPersistenceResult,
  ) {
    if (persistence.assistantMessage) {
      return persistence.assistantMessage;
    }

    if (persistence.reason === "ambiguous_commitment") {
      const options = persistence.conflictingTitles?.filter(Boolean) ?? [];

      if (options.length > 0) {
        return `Encontrei algo parecido: ${options.join(", ")}. Me diga qual deles você quer usar.`;
      }

      return "Encontrei um gasto fixo parecido. Me diga qual deles você quer usar.";
    }

    if (persistence.reason === "updated_existing_commitment") {
      return "Pronto. Atualizei esse gasto fixo.";
    }

    if (persistence.reason === "existing_commitment_requires_confirmation") {
      return "Já existe um gasto fixo com esse nome. Se quiser alterar, me diga isso claramente.";
    }

    if (persistence.reason === "updated_commitment_due_day") {
      return "Pronto. Atualizei o vencimento.";
    }

    if (persistence.reason === "fixed_payment_inferred") {
      return "Pronto. Registrei esse pagamento no seu fixo.";
    }

    if (parsed.missingFields.includes("amount")) {
      return "Não entendi o valor. Me diga novamente.";
    }

    if (parsed.intent === "commitment") {
      return "Pronto. Já deixei isso no seu planejamento.";
    }

    if (parsed.intent === "correction") {
      return "Pronto. Corrigi isso para você.";
    }

    if (parsed.intent === "transaction") {
      return "Pronto. Já registrei isso.";
    }

      return "Não entendi. Me diga novamente.";
  }

  private extractMonthDeletionTarget(input: string) {
    const normalized = this.normalizeText(input);
    const match = normalized.match(
      /apague todos os dados do mes de\s+([a-zç]+)\s+de\s+(\d{4})/,
    );

    if (!match) {
      return null;
    }

    const month = this.monthMap[match[1]];
    const year = Number(match[2]);

    if (!month || Number.isNaN(year)) {
      return null;
    }

    return { year, month };
  }

  private isDeleteAllCommitmentsCommand(input: string) {
    const normalized = this.normalizeText(input);
    return normalized.includes("apague todos os meus gastos fixos");
  }

  private isDeleteAllTransactionsCommand(input: string) {
    const normalized = this.normalizeText(input);
    const hasDeleteVerb =
      normalized.includes("apagar") ||
      normalized.includes("apague") ||
      normalized.includes("apaga") ||
      normalized.includes("deleta") ||
      normalized.includes("deletar") ||
      normalized.includes("delete") ||
      normalized.includes("retire") ||
      normalized.includes("retira") ||
      normalized.includes("retirar") ||
      normalized.includes("remove") ||
      normalized.includes("remova") ||
      normalized.includes("remover") ||
      normalized.includes("limpa") ||
      normalized.includes("limpe") ||
      normalized.includes("limpar");
    const hasWholeScope =
      normalized.includes("tudo") ||
      normalized.includes("todo") ||
      normalized.includes("todos") ||
      normalized.includes("todas");
    const hasExtractScope =
      normalized.includes("extrato") ||
      normalized.includes("itens do extrato") ||
      normalized.includes("dados do extrato") ||
      normalized.includes("lancamentos do extrato") ||
      normalized.includes("lançamentos do extrato");

    return hasDeleteVerb && hasWholeScope && hasExtractScope;
  }

  private isRemoveRecordCommand(input: string) {
    const normalized = this.normalizeText(input);
    return (
      normalized.includes("deleta ") ||
      normalized.includes("deletar ") ||
      normalized.includes("quero remover") ||
      normalized.includes("quero tirar") ||
      normalized.includes("tirar ") ||
      normalized.includes("retire ") ||
      normalized.includes("retira ") ||
      normalized.includes("apague ") ||
      normalized.includes("apaga ") ||
      normalized.includes("remove ") ||
      normalized.includes("remova ") ||
      normalized.includes("exclua ") ||
      normalized.includes("retire esse registro") ||
      normalized.includes("retira esse registro") ||
      normalized.includes("retire esse ultimo registro") ||
      normalized.includes("retira esse ultimo registro") ||
      normalized.includes("retire esse ultimo") ||
      normalized.includes("retira esse ultimo")
    );
  }

  private extractAmountFromText(input: string) {
    const normalized = this.normalizeText(input);
    const matches = Array.from(normalized.matchAll(this.numberPattern));
    const lastMatch = matches[matches.length - 1]?.[1];

    if (!lastMatch) {
      return null;
    }

    const parsedValue = Number(
      lastMatch
        .replace(/\s/g, "")
        .replace(/\.(?=\d{3}(?:\D|$))/g, "")
        .replace(",", "."),
    );

    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  private removeActionWords(input: string) {
    return this.normalizeText(input)
      .replace(/\b(quero|remover|tirar|retire|retira|apague|apaga|remove|remova|exclua|deleta|deletar)\b/g, " ")
      .replace(/\b(esse|essa|este|esta|ultimo|ultima|último|última|registro)\b/g, " ")
      .replace(/\b(um|uma)\b/g, " ")
      .replace(
        /\b(nos gastos fixos|no gasto fixo|dos gastos fixos|do gasto fixo|gastos fixos|gasto fixo|compromisso|compromissos|extrato|transacao|transações|transacao|lancamento|lançamento|variavel|variável|despesa variavel|despesa variável|despesas variaveis|despesas variáveis)\b/g,
        " ",
      )
      .replace(this.numberPattern, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private detectRemovalScope(input: string) {
    if (
      input.includes("gastos fixos") ||
      input.includes("gasto fixo") ||
      input.includes("compromisso") ||
      input.includes("compromissos") ||
      input.includes("fixo")
    ) {
      return "commitment" as const;
    }

    if (
      input.includes("despesa variavel") ||
      input.includes("despesa variável") ||
      input.includes("despesas variaveis") ||
      input.includes("despesas variáveis") ||
      input.includes("gasto variavel") ||
      input.includes("gasto variável") ||
      input.includes("variavel") ||
      input.includes("variável")
    ) {
      return "variable" as const;
    }

    if (
      input.includes("extrato") ||
      input.includes("transacao") ||
      input.includes("transação") ||
      input.includes("transacoes") ||
      input.includes("transações") ||
      input.includes("lancamento") ||
      input.includes("lançamento")
    ) {
      return "transaction" as const;
    }

    return null;
  }

  private isVariableTransactionCategory(category: string | null) {
    if (!category) {
      return true;
    }

    const normalizedCategory = this.normalizeText(category);

    return !normalizedCategory.includes("fixa");
  }

  private scoreTextMatch(target: string, candidate: string) {
    const targetTokens = target.split(" ").filter(Boolean);
    const candidateTokens = candidate.split(" ").filter(Boolean);

    return targetTokens.reduce((score, token) => {
      return candidateTokens.includes(token) ? score + 1 : score;
    }, 0);
  }

  private async deleteLatestMatchingRecord(input: string) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return null;
    }

    const normalized = this.normalizeText(input);
    const amount = this.extractAmountFromText(input);
    const targetText = this.removeActionWords(input);
    const removalScope = this.detectRemovalScope(normalized);
    const fixedOnly = removalScope === "commitment";
    const transactionOnly =
      removalScope === "transaction" || removalScope === "variable";
    const latestOnly =
      normalized.includes("ultimo registro") ||
      normalized.includes("ultimo") ||
      normalized.includes("último");

    if (fixedOnly) {
      let query = admin
        .from("commitments")
        .select("id, title, created_at")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!latestOnly && amount !== null) {
        query = admin
          .from("commitments")
          .select("id, title, created_at")
          .eq("amount", amount)
          .order("created_at", { ascending: false })
          .limit(1);
      }

      const { data } =
        targetText && !latestOnly
          ? await admin
              .from("commitments")
              .select("id, title, created_at")
              .order("created_at", { ascending: false })
              .limit(30)
          : await query.single();

      const selectedCommitment = Array.isArray(data)
        ? data
            .map((item) => ({
              ...item,
              score: this.scoreTextMatch(targetText, this.normalizeText(item.title as string)),
            }))
            .filter((item) => item.score > 0)
            .sort((left, right) => right.score - left.score)[0]
        : data;

      if (!selectedCommitment) {
        return {
          saved: false,
          provider: "supabase" as const,
          conversationId: null,
          recordId: null,
          reason: "remove_not_found",
          assistantMessage: "Não encontrei um gasto fixo para retirar.",
        };
      }

      const { error } = await admin.from("commitments").delete().eq("id", selectedCommitment.id);

      if (error) {
        return {
          saved: false,
          provider: "supabase" as const,
          conversationId: null,
          recordId: selectedCommitment.id,
          reason: error.message,
          assistantMessage: "Não consegui retirar esse gasto fixo agora.",
        };
      }

      return {
        saved: true,
        provider: "supabase" as const,
        conversationId: null,
        recordId: selectedCommitment.id,
        reason: "removed_commitment",
        assistantMessage: "Retirei esse gasto fixo da sua planilha.",
      };
    }

    if (transactionOnly) {
      const { data } =
        targetText && !latestOnly
          ? await admin
              .from("transactions")
              .select("id, description, category, direction, created_at")
              .order("created_at", { ascending: false })
              .limit(50)
          : amount !== null && !latestOnly
            ? await admin
                .from("transactions")
                .select("id, description, category, direction, created_at")
                .eq("amount", amount)
                .order("created_at", { ascending: false })
                .limit(30)
            : await admin
                .from("transactions")
                .select("id, description, category, direction, created_at")
                .order("created_at", { ascending: false })
                .limit(30);

      const transactionCandidates = (data ?? []).filter((item) => {
        if (removalScope !== "variable") {
          return true;
        }

        return (
          item.direction === "expense" &&
          this.isVariableTransactionCategory(item.category as string | null)
        );
      });

      const selectedTransaction =
        targetText && !latestOnly
          ? transactionCandidates
              .map((item) => ({
                ...item,
                score:
                  this.scoreTextMatch(
                    targetText,
                    this.normalizeText(item.description as string),
                  ) +
                  this.scoreTextMatch(
                    targetText,
                    this.normalizeText((item.category as string | null) ?? ""),
                  ),
              }))
              .filter((item) => item.score > 0)
              .sort((left, right) => right.score - left.score)[0]
          : transactionCandidates[0];

      if (!selectedTransaction) {
        return {
          saved: false,
          provider: "supabase" as const,
          conversationId: null,
          recordId: null,
          reason: "remove_not_found",
          assistantMessage:
            removalScope === "variable"
              ? "Não encontrei uma despesa variável para retirar."
              : "Não encontrei um lançamento para retirar.",
        };
      }

      const { error } = await admin
        .from("transactions")
        .delete()
        .eq("id", selectedTransaction.id);

      if (error) {
        return {
          saved: false,
          provider: "supabase" as const,
          conversationId: null,
          recordId: selectedTransaction.id,
          reason: error.message,
          assistantMessage:
            removalScope === "variable"
              ? "Não consegui retirar essa despesa variável agora."
              : "Não consegui retirar esse lançamento agora.",
        };
      }

      return {
        saved: true,
        provider: "supabase" as const,
        conversationId: null,
        recordId: selectedTransaction.id,
        reason: "removed_transaction",
        assistantMessage:
          removalScope === "variable"
            ? "Retirei essa despesa variável da sua planilha."
            : "Retirei esse lançamento do seu extrato.",
      };
    }

    const [latestTransactionResponse, latestCommitmentResponse] = await Promise.all([
      amount !== null && !latestOnly
        ? admin
            .from("transactions")
            .select("id, created_at")
            .eq("amount", amount)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : admin
            .from("transactions")
            .select("id, created_at")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
      amount !== null && !latestOnly
        ? admin
            .from("commitments")
            .select("id, created_at")
            .eq("amount", amount)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : admin
            .from("commitments")
            .select("id, created_at")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    const latestTransaction = latestTransactionResponse.data;
    const latestCommitment = latestCommitmentResponse.data;

    if (!latestTransaction && !latestCommitment) {
      return {
        saved: false,
        provider: "supabase" as const,
        conversationId: null,
        recordId: null,
        reason: "remove_not_found",
        assistantMessage: "Não encontrei um registro para retirar.",
      };
    }

    const useCommitment =
      !latestTransaction ||
      (latestCommitment &&
        new Date(latestCommitment.created_at).getTime() >
          new Date(latestTransaction.created_at).getTime());

    const table = useCommitment ? "commitments" : "transactions";
    const recordId = useCommitment ? latestCommitment?.id ?? null : latestTransaction?.id ?? null;

    if (!recordId) {
      return {
        saved: false,
        provider: "supabase" as const,
        conversationId: null,
        recordId: null,
        reason: "remove_not_found",
        assistantMessage: "Não encontrei um registro para retirar.",
      };
    }

    const { error } = await admin.from(table).delete().eq("id", recordId);

    if (error) {
      return {
        saved: false,
        provider: "supabase" as const,
        conversationId: null,
        recordId,
        reason: error.message,
        assistantMessage: "Não consegui retirar esse registro agora.",
      };
    }

    return {
      saved: true,
      provider: "supabase" as const,
      conversationId: null,
      recordId,
      reason: useCommitment ? "removed_commitment" : "removed_transaction",
      assistantMessage: useCommitment
        ? "Retirei esse gasto fixo da sua planilha."
        : "Retirei esse registro da sua planilha.",
    };
  }

  private formatMonthName(month: number) {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
    }).format(new Date(2026, month - 1, 1));
  }

  private async handleDestructiveCommand(input: string) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return null;
    }

    if (this.isDeleteAllTransactionsCommand(input)) {
      const { error } = await admin.from("transactions").delete().not("id", "is", null);

      if (error) {
        this.logger.error(`Falha ao apagar todo o extrato: ${error.message}`);
        return {
          saved: false,
          provider: "supabase" as const,
          conversationId: null,
          recordId: null,
          reason: error.message,
          assistantMessage: "Não consegui apagar todo o extrato agora.",
        };
      }

      return {
        saved: true,
        provider: "supabase" as const,
        conversationId: null,
        recordId: null,
        reason: "deleted_all_transactions",
        assistantMessage: "Apaguei todos os itens do seu extrato.",
      };
    }

    if (this.isDeleteAllCommitmentsCommand(input)) {
      const { error } = await admin.from("commitments").delete().not("id", "is", null);

      if (error) {
        this.logger.error(`Falha ao apagar gastos fixos: ${error.message}`);
        return {
          saved: false,
          provider: "supabase" as const,
          conversationId: null,
          recordId: null,
          reason: error.message,
          assistantMessage: "Não consegui apagar os seus gastos fixos agora.",
        };
      }

      return {
        saved: true,
        provider: "supabase" as const,
        conversationId: null,
        recordId: null,
        reason: "deleted_all_commitments",
        assistantMessage: "Apaguei todos os seus gastos fixos.",
      };
    }

    if (this.isRemoveRecordCommand(input)) {
      return this.deleteLatestMatchingRecord(input);
    }

    const monthTarget = this.extractMonthDeletionTarget(input);

    if (!monthTarget) {
      return null;
    }

    const monthStart = `${monthTarget.year}-${String(monthTarget.month).padStart(2, "0")}-01`;
    const nextMonthDate = new Date(monthTarget.year, monthTarget.month, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

    const { error: transactionsError } = await admin
      .from("transactions")
      .delete()
      .gte("created_at", monthStart)
      .lt("created_at", nextMonth);

    if (transactionsError) {
      this.logger.error(`Falha ao apagar transacoes do mes: ${transactionsError.message}`);
      return {
        saved: false,
        provider: "supabase" as const,
        conversationId: null,
        recordId: null,
        reason: transactionsError.message,
        assistantMessage: "Não consegui apagar os dados desse mês agora.",
      };
    }

    const { error: conversationsError } = await admin
      .from("conversations")
      .delete()
      .gte("created_at", monthStart)
      .lt("created_at", nextMonth);

    if (conversationsError) {
      this.logger.error(`Falha ao apagar conversas do mes: ${conversationsError.message}`);
      return {
        saved: false,
        provider: "supabase" as const,
        conversationId: null,
        recordId: null,
        reason: conversationsError.message,
        assistantMessage: "Não consegui apagar todos os dados desse mês agora.",
      };
    }

    return {
      saved: true,
      provider: "supabase" as const,
      conversationId: null,
      recordId: null,
      reason: "deleted_month_data",
      assistantMessage: `Apaguei os dados de ${this.formatMonthName(monthTarget.month)} de ${monthTarget.year}.`,
    };
  }

  private normalizeText(input: string) {
    return input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  private tokenizeCommitment(value: string) {
    return this.normalizeText(value)
      .split(" ")
      .filter((token) => token.length > 1 && !this.ignoredCommitmentTokens.has(token));
  }

  private findSimilarCommitments(
    description: string,
    commitments: Array<{ id: string; title: string; normalizedTitle: string; amount?: number | null }>,
  ) {
    const tokens = this.tokenizeCommitment(description);

    return commitments.filter((item) => {
      const itemTokens = this.tokenizeCommitment(item.normalizedTitle);
      const sharedTokens = tokens.filter((token) => itemTokens.includes(token));
      return sharedTokens.length > 0;
    });
  }

  private isGenericCommitmentDescription(description: string) {
    const tokens = this.tokenizeCommitment(description);

    return (
      tokens.length > 0 &&
      tokens.every((token) => this.genericCommitmentTerms.has(token))
    );
  }

  private hasExplicitUpdateSignal(input: string) {
    return (
      input.includes("deixa apenas") ||
      input.includes("deixa so") ||
      input.includes("mantem apenas") ||
      input.includes("substitui") ||
      input.includes("substituir") ||
      input.includes("atualiza") ||
      input.includes("atualizar") ||
      input.includes("corrige") ||
      input.includes("corrigir")
    );
  }

  private hasConsolidationSignal(input: string) {
    return (
      input.includes("deixa apenas") ||
      input.includes("deixa so") ||
      input.includes("mantem apenas")
    );
  }

  private scoreCommitmentMatch(description: string, title: string) {
    const descriptionTokens = this.tokenizeCommitment(description);
    const titleTokens = this.tokenizeCommitment(title);

    return descriptionTokens.reduce((score, token) => {
      return titleTokens.includes(token) ? score + 1 : score;
    }, 0);
  }

  private hasExpenseSettlementSignal(input: string) {
    return (
      input.includes("paguei") ||
      input.includes("pagar") ||
      input.includes("pago") ||
      input.includes("desse mes") ||
      input.includes("deste mes")
    );
  }

  private buildCommitmentDateRange(
    durationMonths: number | null,
    startMonthReference: "current" | "next" | null,
    startMonth: number | null,
    startYear: number | null,
  ) {
    const now = new Date();
    let startDate: Date | null = null;

    if (startMonth !== null && startYear !== null) {
      startDate = new Date(startYear, startMonth - 1, 1);
    } else if (startMonthReference === "next") {
      startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (startMonthReference === "current" || durationMonths !== null) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (!startDate && !durationMonths) {
      return {
        startsOn: null as string | null,
        endsOn: null as string | null,
      };
    }

    if (!startDate) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const endDate = durationMonths
      ? new Date(startDate.getFullYear(), startDate.getMonth() + durationMonths, 0)
      : null;

    return {
      startsOn: startDate.toISOString().slice(0, 10),
      endsOn: endDate ? endDate.toISOString().slice(0, 10) : null,
    };
  }

  private commitmentIsRelevantForRange(
    item: { starts_on?: string | null; ends_on?: string | null },
    range: { startsOn: string | null; endsOn: string | null },
  ) {
    if (!item.starts_on && !item.ends_on) {
      return true;
    }

    const rangeStart = range.startsOn ? new Date(`${range.startsOn}T00:00:00`) : null;
    const rangeEnd = range.endsOn ? new Date(`${range.endsOn}T23:59:59`) : null;
    const itemStart = item.starts_on ? new Date(`${item.starts_on}T00:00:00`) : null;
    const itemEnd = item.ends_on ? new Date(`${item.ends_on}T23:59:59`) : null;

    if (rangeStart && itemEnd && itemEnd < rangeStart) {
      return false;
    }

    if (rangeEnd && itemStart && itemStart > rangeEnd) {
      return false;
    }

    return true;
  }

  private async persistTurn(
    dto: CreateConversationTurnDto,
    parsed: ReturnType<ParserService["parse"]>,
  ): Promise<ConversationPersistenceResult> {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        saved: false,
        provider: "none",
        conversationId: null,
        recordId: null,
        reason: "Supabase nao configurado.",
      };
    }

    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .insert({
        user_id: null,
        channel: dto.audioAssetPath ? "voice" : "text",
      })
      .select("id")
      .single();

    if (conversationError || !conversation) {
      this.logger.error(`Falha ao salvar conversa: ${conversationError?.message}`);
      return {
        saved: false,
        provider: "supabase",
        conversationId: null,
        recordId: null,
        reason: conversationError?.message ?? "Falha ao criar conversa.",
      };
    }

    const { error: stateError } = await admin.from("conversation_states").insert({
      conversation_id: conversation.id,
      active_intent: parsed.intent,
      missing_slots: parsed.missingFields,
      draft_payload: parsed,
    });

    if (stateError) {
      this.logger.error(`Falha ao salvar estado da conversa: ${stateError.message}`);
    }

    if (parsed.intent === "correction" && parsed.amount !== null) {
      const { data: latestTransaction, error: latestTransactionError } = await admin
        .from("transactions")
        .select("id, description")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestTransactionError || !latestTransaction) {
        this.logger.error(
          `Falha ao localizar ultima transacao para correcao: ${latestTransactionError?.message}`,
        );
        return {
          saved: false,
          provider: "supabase",
          conversationId: conversation.id,
          recordId: null,
          reason: "Nao encontrei um lancamento recente para corrigir.",
        };
      }

      const { error: correctionError } = await admin
        .from("transactions")
        .update({
          amount: parsed.amount,
          description: parsed.description ?? latestTransaction.description,
        })
        .eq("id", latestTransaction.id);

      if (correctionError) {
        this.logger.error(`Falha ao corrigir transacao: ${correctionError.message}`);
        return {
          saved: false,
          provider: "supabase",
          conversationId: conversation.id,
          recordId: latestTransaction.id,
          reason: correctionError.message,
        };
      }

      return {
        saved: true,
        provider: "supabase",
        conversationId: conversation.id,
        recordId: latestTransaction.id,
        reason: "Ultimo lancamento corrigido.",
      };
    }

    if (parsed.intent === "transaction" && parsed.description) {
      const { data: transaction, error: transactionError } = await admin
        .from("transactions")
        .insert({
          user_id: null,
          conversation_id: conversation.id,
          direction: parsed.direction,
          description: parsed.description,
          amount: parsed.amount,
          category: parsed.category,
          source: dto.audioAssetPath ? "voice" : "text",
        })
        .select("id")
        .single();

      if (transactionError) {
        this.logger.error(`Falha ao salvar transacao: ${transactionError.message}`);
        return {
          saved: false,
          provider: "supabase",
          conversationId: conversation.id,
          recordId: null,
          reason: transactionError.message,
        };
      }

      return {
        saved: true,
        provider: "supabase",
        conversationId: conversation.id,
        recordId: transaction?.id ?? null,
      };
    }

    if (parsed.intent === "unknown" && parsed.description) {
      const normalizedRawText = this.normalizeText(dto.text);

      if (
        parsed.inferredIntent === "commitment" &&
        parsed.dueDay !== null &&
        parsed.amount === null
      ) {
        const normalizedParsedDescription = this.normalizeText(parsed.description);
        const { data: existingCommitments } = await admin
          .from("commitments")
          .select("id, title")
          .order("created_at", { ascending: false })
          .limit(30);

        const normalizedExistingCommitments =
          existingCommitments?.map((item) => ({
            id: item.id as string,
            title: item.title as string,
            normalizedTitle: this.normalizeText(item.title as string),
          })) ?? [];

        const exactExistingCommitment = normalizedExistingCommitments.find(
          (item) => item.normalizedTitle === normalizedParsedDescription,
        );
        const similarCommitments = this.findSimilarCommitments(
          parsed.description,
          normalizedExistingCommitments,
        );

        if (exactExistingCommitment) {
          const matchedCommitment = exactExistingCommitment;
          const { error: updateDueDayError } = await admin
            .from("commitments")
            .update({
              day_of_month: parsed.dueDay,
            })
            .eq("id", matchedCommitment.id);

          if (updateDueDayError) {
            return {
              saved: false,
              provider: "supabase",
              conversationId: conversation.id,
              recordId: matchedCommitment.id,
              reason: updateDueDayError.message,
            };
          }

          return {
            saved: true,
            provider: "supabase",
            conversationId: conversation.id,
            recordId: matchedCommitment.id,
            reason: "updated_commitment_due_day",
          };
        }

        if (similarCommitments.length > 0) {
          return {
            saved: false,
            provider: "supabase",
            conversationId: conversation.id,
            recordId: null,
            reason: "ambiguous_commitment",
            conflictingTitles: similarCommitments.map((item) => item.title),
          };
        }
      }

      if (this.hasExpenseSettlementSignal(normalizedRawText)) {
        const normalizedParsedDescription = this.normalizeText(parsed.description);
        const { data: existingCommitments } = await admin
          .from("commitments")
          .select("id, title, amount")
          .order("created_at", { ascending: false })
          .limit(30);

        const normalizedExistingCommitments =
          existingCommitments?.map((item) => ({
            id: item.id as string,
            title: item.title as string,
            amount: item.amount as number | null,
            normalizedTitle: this.normalizeText(item.title as string),
          })) ?? [];

        const exactExistingCommitment = normalizedExistingCommitments.find(
          (item) => item.normalizedTitle === normalizedParsedDescription,
        );
        const similarCommitments = this.findSimilarCommitments(
          parsed.description,
          normalizedExistingCommitments,
        );

        if (exactExistingCommitment && exactExistingCommitment.amount !== null) {
          const matchedCommitment = exactExistingCommitment;
          const { data: transaction, error: transactionError } = await admin
            .from("transactions")
            .insert({
              user_id: null,
              conversation_id: conversation.id,
              direction: "expense",
              description: matchedCommitment.title,
              amount: matchedCommitment.amount,
              category: parsed.category ?? matchedCommitment.title,
              source: dto.audioAssetPath ? "voice" : "text",
            })
            .select("id")
            .single();

          if (transactionError) {
            this.logger.error(`Falha ao salvar pagamento ligado a fixo: ${transactionError.message}`);
            return {
              saved: false,
              provider: "supabase",
              conversationId: conversation.id,
              recordId: null,
              reason: transactionError.message,
            };
          }

          return {
            saved: true,
            provider: "supabase",
            conversationId: conversation.id,
            recordId: transaction?.id ?? null,
            reason: "fixed_payment_inferred",
          };
        }

        if (similarCommitments.length > 0) {
          return {
            saved: false,
            provider: "supabase",
            conversationId: conversation.id,
            recordId: null,
            reason: "ambiguous_commitment",
            conflictingTitles: similarCommitments.map((item) => item.title),
          };
        }
      }
    }

    if (parsed.intent === "commitment" && parsed.description) {
      const normalizedDescription = this.normalizeText(parsed.description);
      const normalizedRawText = this.normalizeText(dto.text);
      const range = this.buildCommitmentDateRange(
        parsed.durationMonths,
        parsed.startMonthReference,
        parsed.startMonth,
        parsed.startYear,
      );
      const { data: existingCommitments, error: existingCommitmentsError } = await admin
        .from("commitments")
        .select("id, title, starts_on, ends_on")
        .order("created_at", { ascending: false })
        .limit(30);

      if (existingCommitmentsError) {
        this.logger.error(
          `Falha ao consultar compromissos existentes: ${existingCommitmentsError.message}`,
        );
      }

      const normalizedExistingCommitments =
        existingCommitments?.map((item) => ({
          id: item.id as string,
          title: item.title as string,
          normalizedTitle: this.normalizeText(item.title as string),
          starts_on: (item.starts_on as string | null) ?? null,
          ends_on: (item.ends_on as string | null) ?? null,
        }))
          .filter((item) => this.commitmentIsRelevantForRange(item, range)) ?? [];

      const exactExistingCommitment = normalizedExistingCommitments.find(
        (item) => item.normalizedTitle === normalizedDescription,
      );
      const similarCommitments = this.findSimilarCommitments(
        normalizedDescription,
        normalizedExistingCommitments,
      );

      if (!exactExistingCommitment && similarCommitments.length > 0) {
        return {
          saved: false,
          provider: "supabase",
          conversationId: conversation.id,
          recordId: null,
          reason: "ambiguous_commitment",
          conflictingTitles: similarCommitments.map((item) => item.title),
        };
      }

      if (
        this.hasConsolidationSignal(normalizedRawText) &&
        similarCommitments.length > 1
      ) {
        const rankedCommitments = similarCommitments
          .map((item) => ({
            ...item,
            score: this.scoreCommitmentMatch(normalizedDescription, item.normalizedTitle),
          }))
          .sort((left, right) => right.score - left.score);

        const primaryCommitment = rankedCommitments[0];
        const duplicateIds = rankedCommitments.slice(1).map((item) => item.id);

        if (primaryCommitment) {
          const { error: consolidateUpdateError } = await admin
            .from("commitments")
            .update({
              title: parsed.description,
              amount: parsed.amount,
              direction: parsed.direction,
              recurrence_rule: parsed.recurrence,
              day_of_month: parsed.dueDay,
              starts_on: range.startsOn,
              ends_on: range.endsOn,
            })
            .eq("id", primaryCommitment.id);

          if (consolidateUpdateError) {
            this.logger.error(
              `Falha ao consolidar compromisso principal: ${consolidateUpdateError.message}`,
            );
            return {
              saved: false,
              provider: "supabase",
              conversationId: conversation.id,
              recordId: primaryCommitment.id,
              reason: consolidateUpdateError.message,
            };
          }

          if (duplicateIds.length > 0) {
            const { error: deleteDuplicatesError } = await admin
              .from("commitments")
              .delete()
              .in("id", duplicateIds);

            if (deleteDuplicatesError) {
              this.logger.error(
                `Falha ao remover compromissos duplicados: ${deleteDuplicatesError.message}`,
              );
            }
          }

          return {
            saved: true,
            provider: "supabase",
            conversationId: conversation.id,
            recordId: primaryCommitment.id,
            reason: "updated_existing_commitment",
          };
        }
      }

      if (exactExistingCommitment && !this.hasExplicitUpdateSignal(normalizedRawText)) {
        return {
          saved: false,
          provider: "supabase",
          conversationId: conversation.id,
          recordId: exactExistingCommitment.id,
          reason: "existing_commitment_requires_confirmation",
        };
      }

      if (exactExistingCommitment) {
        const { error: updateCommitmentError } = await admin
          .from("commitments")
          .update({
            title: parsed.description,
            amount: parsed.amount,
            direction: parsed.direction,
            recurrence_rule: parsed.recurrence,
            day_of_month: parsed.dueDay,
            starts_on: range.startsOn,
            ends_on: range.endsOn,
          })
          .eq("id", exactExistingCommitment.id);

        if (updateCommitmentError) {
          this.logger.error(`Falha ao atualizar compromisso existente: ${updateCommitmentError.message}`);
          return {
            saved: false,
            provider: "supabase",
            conversationId: conversation.id,
            recordId: exactExistingCommitment.id,
            reason: updateCommitmentError.message,
          };
        }

        return {
          saved: true,
          provider: "supabase",
          conversationId: conversation.id,
          recordId: exactExistingCommitment.id,
          reason: "updated_existing_commitment",
        };
      }

      const { data: commitment, error: commitmentError } = await admin
        .from("commitments")
        .insert({
          user_id: null,
          title: parsed.description,
          amount: parsed.amount,
          direction: parsed.direction,
          recurrence_rule: parsed.recurrence,
          day_of_month: parsed.dueDay,
          starts_on: range.startsOn,
          ends_on: range.endsOn,
        })
        .select("id")
        .single();

      if (commitmentError) {
        this.logger.error(`Falha ao salvar compromisso: ${commitmentError.message}`);
        return {
          saved: false,
          provider: "supabase",
          conversationId: conversation.id,
          recordId: null,
          reason: commitmentError.message,
        };
      }

      return {
        saved: true,
        provider: "supabase",
        conversationId: conversation.id,
        recordId: commitment?.id ?? null,
      };
    }

    return {
      saved: true,
      provider: "supabase",
      conversationId: conversation.id,
      recordId: null,
      reason: "Somente a conversa foi persistida.",
    };
  }
}
