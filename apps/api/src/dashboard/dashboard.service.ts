import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../integrations/supabase/supabase.service";

type CommitmentItem = {
  id: string;
  title: string;
  amount: number | null;
  direction: "expense" | "income";
  day_of_month: number | null;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
};

type TransactionItem = {
  id: string;
  direction: "expense" | "income" | "transfer";
  description: string;
  amount: number | null;
  category: string | null;
  created_at: string;
};

type OccurrenceItem = {
  id: string;
  commitment_id: string;
  due_on: string;
  status: "pending" | "paid";
  transaction_id: string | null;
  created_at: string;
};

type MonthReference = {
  year: number;
  month: number;
  monthKey: string;
  monthStartIso: string;
  nextMonthIso: string;
  monthEndIso: string;
  daysInMonth: number;
};

type DashboardInsight = {
  id: "income-gap" | "variable-overrun" | "balance-risk" | "overdue-fixed" | "month-ok";
  target: "income" | "variable" | "balance" | "fixed" | "general";
  tone: "warning" | "danger" | "success";
  message: string;
};

@Injectable()
export class DashboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async summary(userId: string, monthKey?: string) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        placeholder: true,
        provider: "none" as const,
        reason: "Supabase nao configurado.",
      };
    }

    const month = this.resolveMonthReference(monthKey);

    if (!month) {
      return {
        placeholder: false,
        provider: "supabase" as const,
        reason: "Mes invalido.",
      };
    }

    const [commitmentsResponse, transactionsResponse] = await Promise.all([
      admin
        .from("commitments")
        .select("id, title, amount, direction, day_of_month, starts_on, ends_on, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      admin
        .from("transactions")
        .select("id, direction, description, amount, category, created_at")
        .eq("user_id", userId)
        .gte("created_at", month.monthStartIso)
        .lt("created_at", month.nextMonthIso)
        .order("created_at", { ascending: false }),
    ]);

    if (commitmentsResponse.error || transactionsResponse.error) {
      return {
        placeholder: false,
        provider: "supabase" as const,
        reason: commitmentsResponse.error?.message ?? transactionsResponse.error?.message,
      };
    }

    const activeCommitments = ((commitmentsResponse.data ?? []) as CommitmentItem[]).filter(
      (item) => this.isCommitmentActiveInMonth(item, month),
    );
    const transactions = (transactionsResponse.data ?? []) as TransactionItem[];

    const ensuredOccurrences = await this.ensureMonthOccurrences(
      userId,
      activeCommitments,
      transactions,
      month,
    );

    const occurrenceIds = ensuredOccurrences.map((item) => item.id);
    const { data: occurrenceRows, error: occurrencesError } = await admin
      .from("commitment_occurrences")
      .select("id, commitment_id, due_on, status, transaction_id, created_at")
      .in("id", occurrenceIds.length > 0 ? occurrenceIds : ["00000000-0000-0000-0000-000000000000"]);

    if (occurrencesError && occurrenceIds.length > 0) {
      return {
        placeholder: false,
        provider: "supabase" as const,
        reason: occurrencesError.message,
      };
    }

    const occurrenceByCommitment = new Map<string, OccurrenceItem>();

    for (const occurrence of (occurrenceRows ?? []) as OccurrenceItem[]) {
      occurrenceByCommitment.set(occurrence.commitment_id, occurrence);
    }

    const normalizedCommitmentTitles = new Map(
      activeCommitments.map((item) => [item.id, this.normalizeText(item.title)]),
    );

    const commitmentRows = activeCommitments.map((commitment) => {
      const occurrence = occurrenceByCommitment.get(commitment.id);
      const dueOn = occurrence?.due_on ?? this.buildDueOn(commitment, month);
      const displayStatus = this.resolveDisplayStatus(commitment, occurrence, month);

      return {
        id: commitment.id,
        title: commitment.title,
        amount: commitment.amount ?? 0,
        direction: commitment.direction,
        dayOfMonth: commitment.day_of_month,
        dueOn,
        status: displayStatus.status,
        paidAt: displayStatus.paidAt,
        overdueDays: displayStatus.overdueDays,
        transactionId: occurrence?.transaction_id ?? null,
      };
    });

    const sortByMonthFlow = (left: { dayOfMonth: number | null; title: string }, right: { dayOfMonth: number | null; title: string }) => {
      if (left.dayOfMonth === null && right.dayOfMonth === null) {
        return left.title.localeCompare(right.title, "pt-BR");
      }

      if (left.dayOfMonth === null) {
        return 1;
      }

      if (right.dayOfMonth === null) {
        return -1;
      }

      if (left.dayOfMonth !== right.dayOfMonth) {
        return left.dayOfMonth - right.dayOfMonth;
      }

      return left.title.localeCompare(right.title, "pt-BR");
    };

    const fixedExpenseRows = commitmentRows
      .filter((item) => item.direction === "expense")
      .sort(sortByMonthFlow);
    const fixedIncomeRows = commitmentRows
      .filter((item) => item.direction === "income")
      .sort(sortByMonthFlow);

    const linkedFixedTransactionIds = new Set(
      commitmentRows
        .map((item) => item.transactionId)
        .filter((value): value is string => Boolean(value)),
    );

    const incomeTransactions = transactions.filter((item) => item.direction === "income");
    const expenseTransactions = transactions.filter((item) => item.direction === "expense");
    const variableExpenseTransactions = expenseTransactions.filter((item) => {
      if (linkedFixedTransactionIds.has(item.id)) {
        return false;
      }

      const normalizedDescription = this.normalizeText(item.description);
      const normalizedCategory = this.normalizeText(item.category ?? "");

      return !Array.from(normalizedCommitmentTitles.values()).some(
        (title) => normalizedDescription === title || normalizedCategory === title,
      );
    });

    const estimatedIncome = fixedIncomeRows.reduce((total, item) => total + item.amount, 0);
    const realIncome = incomeTransactions.reduce(
      (total, item) => total + (item.amount ?? 0),
      0,
    );
    const fixedExpenseEstimated = fixedExpenseRows.reduce(
      (total, item) => total + item.amount,
      0,
    );
    const variableEstimated = await this.estimateVariableExpenses(
      userId,
      activeCommitments,
      month,
    );
    const estimatedExpense = fixedExpenseEstimated + variableEstimated;
    const realExpense = expenseTransactions.reduce(
      (total, item) => total + (item.amount ?? 0),
      0,
    );
    const fixedExpenseReal = fixedExpenseRows
      .filter((item) => item.status === "paid")
      .reduce((total, item) => total + item.amount, 0);
    const variableReal = variableExpenseTransactions.reduce(
      (total, item) => total + (item.amount ?? 0),
      0,
    );

    const estimatedBalance = estimatedIncome - estimatedExpense;
    const realBalance = realIncome - realExpense;

    const insightMessages = this.buildInsights({
      estimatedIncome,
      realIncome,
      variableEstimated,
      variableReal,
      estimatedBalance,
      realBalance,
      overdueCount: fixedExpenseRows.filter((item) => item.status === "overdue").length,
      paidCount: fixedExpenseRows.filter((item) => item.status === "paid").length,
      totalCount: fixedExpenseRows.length,
    });

    return {
      placeholder: false,
      provider: "supabase" as const,
      month: {
        key: month.monthKey,
        title: this.formatMonthTitle(month.year, month.month),
      },
      metrics: {
        estimatedIncome,
        realIncome,
        estimatedExpense,
        realExpense,
        fixedExpenseEstimated,
        fixedExpenseReal,
        variableEstimated,
        variableReal,
        estimatedBalance,
        realBalance,
      },
      insights: insightMessages,
      counts: {
        fixedPaid: fixedExpenseRows.filter((item) => item.status === "paid").length,
        fixedOpen: fixedExpenseRows.filter((item) => item.status === "open").length,
        fixedOverdue: fixedExpenseRows.filter((item) => item.status === "overdue").length,
        fixedTotal: fixedExpenseRows.length,
        fixedPaidAmount: fixedExpenseRows
          .filter((item) => item.status === "paid")
          .reduce((total, item) => total + item.amount, 0),
        fixedOpenAmount: fixedExpenseRows
          .filter((item) => item.status === "open")
          .reduce((total, item) => total + item.amount, 0),
        fixedOverdueAmount: fixedExpenseRows
          .filter((item) => item.status === "overdue")
          .reduce((total, item) => total + item.amount, 0),
      },
      fixedExpenses: fixedExpenseRows,
      fixedIncomes: fixedIncomeRows,
      incomeTransactions,
      variableExpenses: variableExpenseTransactions,
    };
  }

  private resolveMonthReference(monthKey?: string | null): MonthReference | null {
    const now = new Date();
    const match = monthKey ? /^(\d{4})-(\d{2})$/.exec(monthKey) : null;
    const year = match ? Number(match[1]) : now.getFullYear();
    const month = match ? Number(match[2]) : now.getMonth() + 1;

    if (month < 1 || month > 12 || Number.isNaN(year)) {
      return null;
    }

    const monthStart = new Date(year, month - 1, 1);
    const nextMonth = new Date(year, month, 1);
    const monthEnd = new Date(year, month, 0);

    return {
      year,
      month,
      monthKey: `${year}-${String(month).padStart(2, "0")}`,
      monthStartIso: monthStart.toISOString(),
      nextMonthIso: nextMonth.toISOString(),
      monthEndIso: monthEnd.toISOString().slice(0, 10),
      daysInMonth: monthEnd.getDate(),
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

  private isCommitmentActiveInMonth(item: CommitmentItem, month: MonthReference) {
    const startsOn = item.starts_on ?? null;
    const endsOn = item.ends_on ?? null;

    return (!startsOn || startsOn <= month.monthEndIso) &&
      (!endsOn || endsOn >= month.monthKey + "-01");
  }

  private buildDueOn(item: CommitmentItem, month: MonthReference) {
    const dueDay = item.day_of_month
      ? Math.min(item.day_of_month, month.daysInMonth)
      : item.starts_on && item.starts_on.startsWith(month.monthKey)
        ? Number(item.starts_on.slice(-2))
        : 1;

    return `${month.monthKey}-${String(dueDay).padStart(2, "0")}`;
  }

  private async ensureMonthOccurrences(
    userId: string,
    commitments: CommitmentItem[],
    transactions: TransactionItem[],
    month: MonthReference,
  ) {
    const admin = this.supabaseService.admin;

    if (!admin || commitments.length === 0) {
      return [];
    }

    const commitmentIds = commitments.map((item) => item.id);
    const { data: existingRows } = await admin
      .from("commitment_occurrences")
      .select("id, commitment_id, due_on, status, transaction_id, created_at")
      .in("commitment_id", commitmentIds);

    const existingByKey = new Map<string, OccurrenceItem>();

    for (const row of (existingRows ?? []) as OccurrenceItem[]) {
      existingByKey.set(`${row.commitment_id}:${row.due_on}`, row);
    }

    const inserts: Array<{
      commitment_id: string;
      due_on: string;
      status: "pending" | "paid";
      transaction_id: string | null;
    }> = [];

    for (const commitment of commitments) {
      const dueOn = this.buildDueOn(commitment, month);
      const key = `${commitment.id}:${dueOn}`;
      const matchedTransaction = this.findMatchingCommitmentTransaction(
        commitment,
        transactions,
        month,
      );
      const existing = existingByKey.get(key);

      if (!existing) {
        inserts.push({
          commitment_id: commitment.id,
          due_on: dueOn,
          status: matchedTransaction ? "paid" : "pending",
          transaction_id: matchedTransaction?.id ?? null,
        });
        continue;
      }

      if (existing.status !== "paid" && matchedTransaction?.id) {
        await admin
          .from("commitment_occurrences")
          .update({
            status: "paid",
            transaction_id: matchedTransaction.id,
          })
          .eq("id", existing.id);

        existingByKey.set(key, {
          ...existing,
          status: "paid",
          transaction_id: matchedTransaction.id,
        });
      }
    }

    if (inserts.length > 0) {
      const { data: insertedRows } = await admin
        .from("commitment_occurrences")
        .insert(inserts)
        .select("id, commitment_id, due_on, status, transaction_id, created_at");

      for (const row of (insertedRows ?? []) as OccurrenceItem[]) {
        existingByKey.set(`${row.commitment_id}:${row.due_on}`, row);
      }
    }

    return commitments
      .map((commitment) => {
        const dueOn = this.buildDueOn(commitment, month);
        return existingByKey.get(`${commitment.id}:${dueOn}`);
      })
      .filter(Boolean) as OccurrenceItem[];
  }

  private findMatchingCommitmentTransaction(
    commitment: CommitmentItem,
    transactions: TransactionItem[],
    month: MonthReference,
  ) {
    const normalizedTitle = this.normalizeText(commitment.title);
    const direction = commitment.direction;
    const monthTransactions = transactions.filter((item) => item.direction === direction);

    return monthTransactions.find((item) => {
      const normalizedDescription = this.normalizeText(item.description);
      const normalizedCategory = this.normalizeText(item.category ?? "");
      const amountMatches =
        commitment.amount === null || item.amount === null || Number(item.amount) === Number(commitment.amount);

      return amountMatches && (
        normalizedDescription === normalizedTitle ||
        normalizedCategory === normalizedTitle
      );
    }) ?? null;
  }

  private resolveDisplayStatus(
    commitment: CommitmentItem,
    occurrence: OccurrenceItem | undefined,
    month: MonthReference,
  ) {
    const today = this.getSaoPauloIsoDate();
    const dueOn = occurrence?.due_on ?? this.buildDueOn(commitment, month);

    if (occurrence?.status === "paid") {
      return {
        status: commitment.direction === "income" ? "confirmed" : "paid",
        paidAt: occurrence.created_at,
        overdueDays: 0,
      };
    }

    if (commitment.direction === "expense" && dueOn < today) {
      return {
        status: "overdue",
        paidAt: null,
        overdueDays: this.diffInDays(dueOn, today),
      };
    }

    return {
      status: commitment.direction === "income" ? "expected" : "open",
      paidAt: null,
      overdueDays: 0,
    };
  }

  private diffInDays(fromIso: string, toIso: string) {
    const from = new Date(`${fromIso}T00:00:00`);
    const to = new Date(`${toIso}T00:00:00`);

    return Math.max(
      0,
      Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  private getSaoPauloIsoDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  private async estimateVariableExpenses(
    userId: string,
    commitments: CommitmentItem[],
    month: MonthReference,
  ) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return 0;
    }

    const start = new Date(month.year, month.month - 4, 1).toISOString();
    const end = month.monthStartIso;

    const { data } = await admin
      .from("transactions")
      .select("id, direction, description, amount, category, created_at")
      .eq("user_id", userId)
      .eq("direction", "expense")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    const normalizedCommitmentTitles = commitments.map((item) => this.normalizeText(item.title));
    const monthlyTotals = new Map<string, number>();

    for (const transaction of (data ?? []) as TransactionItem[]) {
      const normalizedDescription = this.normalizeText(transaction.description);
      const normalizedCategory = this.normalizeText(transaction.category ?? "");

      if (
        normalizedCommitmentTitles.some(
          (title) => title === normalizedDescription || title === normalizedCategory,
        )
      ) {
        continue;
      }

      const createdAt = new Date(transaction.created_at);
      const key = `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + (transaction.amount ?? 0));
    }

    const values = Array.from(monthlyTotals.values());

    if (values.length === 0) {
      return 0;
    }

    return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100;
  }

  private buildInsights(input: {
    estimatedIncome: number;
    realIncome: number;
    variableEstimated: number;
    variableReal: number;
    estimatedBalance: number;
    realBalance: number;
    overdueCount: number;
    paidCount: number;
    totalCount: number;
  }): DashboardInsight[] {
    const messages: DashboardInsight[] = [];

    if (input.estimatedIncome > 0 && input.realIncome < input.estimatedIncome * 0.6) {
      messages.push({
        id: "income-gap",
        target: "income",
        tone: "warning",
        message: "Precisa entrar mais grana.",
      });
    }

    if (input.variableEstimated > 0 && input.variableReal > input.variableEstimated * 1.1) {
      messages.push({
        id: "variable-overrun",
        target: "variable",
        tone: "warning",
        message: "Tá gastando muito, hein.",
      });
    } else if (input.variableEstimated === 0 && input.variableReal > 0) {
      messages.push({
        id: "variable-overrun",
        target: "variable",
        tone: "warning",
        message: "Seu variável já começou a comer o mês.",
      });
    }

    if (input.realBalance < input.estimatedBalance - Math.max(200, Math.abs(input.estimatedBalance) * 0.15)) {
      messages.push({
        id: "balance-risk",
        target: "balance",
        tone: "danger",
        message: "Vai dar ruim no mês.",
      });
    }

    if (input.overdueCount > 0) {
      messages.push({
        id: "overdue-fixed",
        target: "fixed",
        tone: "danger",
        message: "Tem conta vencida te puxando para baixo.",
      });
    } else if (input.totalCount > 0 && input.paidCount === input.totalCount) {
      messages.push({
        id: "month-ok",
        target: "general",
        tone: "success",
        message: "Você já pagou tudo que estava pendente.",
      });
    }

    if (messages.length === 0) {
      messages.push({
        id: "month-ok",
        target: "general",
        tone: "success",
        message: "Mês sob controle até aqui.",
      });
    }

    return messages.slice(0, 3);
  }

  private formatMonthTitle(year: number, month: number) {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, 1));
  }
}
