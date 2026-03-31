"use client";

import { useEffect, useMemo, useState } from "react";
import { FINANCE_DATA_UPDATED_EVENT } from "./data-sync";
import {
  formatDateTimeInZone,
  getLocalDayOfMonth,
  resolveUserTimeZone,
} from "./date-time";
import { formatDisplayText } from "./display-text";
import { authenticatedFetch } from "../lib/api";

type MonthFixedItem = {
  id: string;
  title: string;
  amount: number;
  direction: "expense" | "income";
  dayOfMonth: number | null;
  dueOn: string;
  status: "open" | "paid" | "overdue" | "expected" | "confirmed";
  paidAt: string | null;
  overdueDays: number;
  transactionId: string | null;
};

type TransactionItem = {
  id: string;
  direction: "expense" | "income" | "transfer";
  description: string;
  amount: number | null;
  category?: string | null;
  created_at: string;
};

type DashboardSummaryResponse = {
  placeholder: boolean;
  provider: "supabase" | "none";
  reason?: string;
  month?: {
    key: string;
    title: string;
  };
  metrics: {
    estimatedIncome: number;
    realIncome: number;
    estimatedExpense: number;
    realExpense: number;
    fixedExpenseEstimated: number;
    fixedExpenseReal: number;
    variableEstimated: number;
    variableReal: number;
    estimatedBalance: number;
    realBalance: number;
  };
  insights: Array<{
    id: "income-gap" | "variable-overrun" | "balance-risk" | "overdue-fixed" | "month-ok";
    target: "income" | "variable" | "balance" | "fixed" | "general";
    tone: "warning" | "danger" | "success";
    message: string;
  }>;
  counts: {
    fixedPaid: number;
    fixedOpen: number;
    fixedOverdue: number;
    fixedTotal: number;
    fixedPaidAmount: number;
    fixedOpenAmount: number;
    fixedOverdueAmount: number;
  };
  fixedExpenses: MonthFixedItem[];
  fixedIncomes: MonthFixedItem[];
  incomeTransactions: TransactionItem[];
  variableExpenses: TransactionItem[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function parseMonthKey(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function getStatusLabel(item: MonthFixedItem) {
  if (item.direction === "income") {
    return item.status === "confirmed" ? "Confirmada" : "Prevista";
  }

  if (item.status === "paid") {
    return "Pago";
  }

  if (item.status === "overdue") {
    return item.overdueDays === 1 ? "Vencido há 1 dia" : `Vencido há ${item.overdueDays} dias`;
  }

  return "Em aberto";
}

function getStatusClass(item: MonthFixedItem) {
  if (item.direction === "income") {
    return item.status === "confirmed"
      ? "month-sheet-status month-sheet-status--paid"
      : "month-sheet-status month-sheet-status--expected";
  }

  if (item.status === "paid") {
    return "month-sheet-status month-sheet-status--paid";
  }

  if (item.status === "overdue") {
    return "month-sheet-status month-sheet-status--overdue";
  }

  return "month-sheet-status month-sheet-status--open";
}

export function MonthSummaryView({ monthKey }: { monthKey: string }) {
  const parsed = parseMonthKey(monthKey);
  const [data, setData] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");

  useEffect(() => {
    setTimeZone(resolveUserTimeZone());
  }, []);

  useEffect(() => {
    if (!parsed) {
      setLoading(false);
      setErrorMessage("Mês inválido.");
      return;
    }

    let cancelled = false;

    async function loadMonth() {
      try {
        const response = await authenticatedFetch(
          `${apiBaseUrl}/api/dashboard/summary?month=${monthKey}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`API retornou status ${response.status}`);
        }

        const nextData = (await response.json()) as DashboardSummaryResponse;

        if (cancelled) {
          return;
        }

        setData(nextData);
        setErrorMessage(nextData.reason ?? null);
      } catch {
        if (cancelled) {
          return;
        }

        setErrorMessage("Não consegui carregar esse mês agora.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void loadMonth();
      }
    }

    void loadMonth();

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener(FINANCE_DATA_UPDATED_EVENT, refreshIfVisible);
    const intervalId = window.setInterval(refreshIfVisible, 15000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener(FINANCE_DATA_UPDATED_EVENT, refreshIfVisible);
      window.clearInterval(intervalId);
    };
  }, [monthKey, parsed]);

  const metrics = data?.metrics;
  const counts = data?.counts;
  const fixedExpenses = data?.fixedExpenses ?? [];
  const fixedIncomes = data?.fixedIncomes ?? [];
  const incomeTransactions = data?.incomeTransactions ?? [];
  const variableExpenses = data?.variableExpenses ?? [];

  const topCards = useMemo(() => {
    if (!metrics) {
      return [];
    }

    return [
      {
        key: "estimated-income",
        label: "Entradas estimadas",
        value: metrics.estimatedIncome,
        tone: "income",
        surface: "estimated",
      },
      {
        key: "real-income",
        label: "Entradas reais",
        value: metrics.realIncome,
        tone: "income",
        surface: "real",
      },
      {
        key: "estimated-expense",
        label: "Saídas estimadas",
        value: metrics.estimatedExpense,
        tone: "expense",
        surface: "estimated",
      },
      {
        key: "real-expense",
        label: "Saídas reais",
        value: metrics.realExpense,
        tone: "expense",
        surface: "real",
      },
      {
        key: "estimated-balance",
        label: "Saldo estimado",
        value: metrics.estimatedBalance,
        tone: metrics.estimatedBalance >= 0 ? "income" : "expense",
        surface: "estimated",
      },
      {
        key: "real-balance",
        label: "Saldo real",
        value: metrics.realBalance,
        tone: metrics.realBalance >= 0 ? "income" : "expense",
        surface: "real",
      },
    ];
  }, [metrics]);

  if (!parsed) {
    return (
      <main className="app-main">
        <div className="shell shell--narrow">
          <section className="conversation-panel">
            <p className="muted-text">Mês inválido.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="shell shell--narrow">
        <section className="month-sheet-hero">
          <div className="hero-copy-block">
            <p className="eyebrow">Resumo mensal</p>
            <h1>{data?.month?.title ?? monthKey}</h1>
          </div>
          <div className="hero-balance-block">
            <p className="hero-balance-label">Saldo real do mês</p>
            <strong className="hero-balance-value">
              {formatCurrency(metrics?.realBalance ?? 0)}
            </strong>
          </div>
        </section>

        {topCards.length > 0 ? (
          <section className="month-sheet-summary month-sheet-summary--expanded">
            {topCards.map((card) => (
              <article
                key={card.key}
                className={`extract-summary__card extract-summary__card--sheet ${
                  card.surface === "real"
                    ? "extract-summary__card--real"
                    : "extract-summary__card--estimated"
                }`}
              >
                <div className="extract-summary__card-content">
                  <span className="mini-label extract-summary__label">{card.label}</span>
                </div>
                <div className="extract-summary__card-value">
                  <strong
                    className={`extract-amount ${
                      card.tone === "income"
                        ? "extract-amount--income"
                        : "extract-amount--expense"
                    }`}
                  >
                    {formatCurrency(card.value)}
                  </strong>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {loading ? (
          <section className="conversation-panel">
            <p className="muted-text">Carregando planilha do mês...</p>
          </section>
        ) : null}

        {!loading && errorMessage ? (
          <section className="conversation-panel">
            <p className="muted-text">{errorMessage}</p>
          </section>
        ) : null}

        {!loading && !errorMessage && data ? (
          <section className="month-sheet-layout">
            <section className="month-sheet-section">
              <div className="month-sheet-section__header">
                <div>
                  <p className="eyebrow">Leitura</p>
                  <h2>Execução do mês</h2>
                </div>
                <strong>
                  {counts?.fixedPaid ?? 0}/{counts?.fixedTotal ?? 0}
                </strong>
              </div>
              <div className="month-sheet-progress-grid">
                <article className="month-sheet-progress-card">
                  <span className="mini-label">Fixos pagos</span>
                  <strong>{counts?.fixedPaid ?? 0}</strong>
                  <p className="month-sheet-progress-value">
                    {formatCurrency(counts?.fixedPaidAmount ?? 0)}
                  </p>
                </article>
                <article className="month-sheet-progress-card">
                  <span className="mini-label">No prazo</span>
                  <strong>{counts?.fixedOpen ?? 0}</strong>
                  <p className="month-sheet-progress-value">
                    {formatCurrency(counts?.fixedOpenAmount ?? 0)}
                  </p>
                </article>
                <article className="month-sheet-progress-card month-sheet-progress-card--alert">
                  <span className="mini-label">Atrasados</span>
                  <strong>{counts?.fixedOverdue ?? 0}</strong>
                  <p className="month-sheet-progress-value">
                    {formatCurrency(counts?.fixedOverdueAmount ?? 0)}
                  </p>
                </article>
              </div>
            </section>

            <section className="month-sheet-section">
              <div className="month-sheet-section__header">
                <div>
                  <p className="eyebrow">Entradas</p>
                  <h2>Receitas do mês</h2>
                </div>
                <strong className="extract-amount extract-amount--income">
                  {formatCurrency(metrics?.realIncome ?? 0)}
                </strong>
              </div>

              {incomeTransactions.length === 0 && fixedIncomes.length === 0 ? (
                <div className="month-sheet-empty">
                  <p>Nenhuma entrada registrada neste mês.</p>
                </div>
              ) : (
                <div className="month-sheet-list">
                  {incomeTransactions.map((item) => (
                    <article key={item.id} className="month-sheet-row month-sheet-row--commitment">
                      <div className="month-sheet-date-chip month-sheet-date-chip--income" aria-hidden="true">
                        <strong>{String(getLocalDayOfMonth(item.created_at, timeZone)).padStart(2, "0")}</strong>
                      </div>
                      <div className="month-sheet-row__content">
                        <strong>{formatDisplayText(item.description)}</strong>
                      </div>
                      <strong className="extract-amount extract-amount--income">
                        {formatCurrency(item.amount ?? 0)}
                      </strong>
                    </article>
                  ))}

                  {fixedIncomes.map((item) => (
                    <article key={item.id} className="month-sheet-row month-sheet-row--commitment">
                      <div className="month-sheet-date-chip month-sheet-date-chip--income" aria-hidden="true">
                        <strong>
                          {item.dayOfMonth !== null
                            ? String(item.dayOfMonth).padStart(2, "0")
                            : "--"}
                        </strong>
                      </div>
                      <div className="month-sheet-row__content">
                        <strong>{formatDisplayText(item.title)}</strong>
                        <div className="month-sheet-row__meta">
                          <span className={getStatusClass(item)}>{getStatusLabel(item)}</span>
                        </div>
                      </div>
                      <strong
                        className={
                          item.status === "confirmed"
                            ? "extract-amount extract-amount--income"
                            : "extract-amount"
                        }
                      >
                        {formatCurrency(item.amount)}
                      </strong>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="month-sheet-section">
              <div className="month-sheet-section__header">
                <div>
                  <p className="eyebrow">Saídas</p>
                  <h2>Gastos fixos</h2>
                </div>
                <strong className="extract-amount extract-amount--expense">
                  {formatCurrency(metrics?.fixedExpenseEstimated ?? 0)}
                </strong>
              </div>

              {fixedExpenses.length === 0 ? (
                <div className="month-sheet-empty">
                  <strong>Nenhum gasto fixo conectado ainda.</strong>
                  <p>Quando você cadastrar contas recorrentes, elas aparecem aqui com status do mês.</p>
                </div>
              ) : (
                <div className="month-sheet-list">
                  {fixedExpenses.map((item) => (
                    <article
                      key={item.id}
                      className={`month-sheet-row month-sheet-row--commitment month-sheet-row--status-${item.status}`}
                    >
                      <div className="month-sheet-date-chip" aria-hidden="true">
                        <strong>
                          {item.dayOfMonth !== null
                            ? String(item.dayOfMonth).padStart(2, "0")
                            : "--"}
                        </strong>
                      </div>
                      <div className="month-sheet-row__content">
                        <strong>{formatDisplayText(item.title)}</strong>
                        <div className="month-sheet-row__meta">
                          <span className={getStatusClass(item)}>{getStatusLabel(item)}</span>
                        </div>
                      </div>
                      <strong
                        className={
                          item.status === "paid"
                            ? "extract-amount extract-amount--income"
                            : "extract-amount extract-amount--expense"
                        }
                      >
                        {formatCurrency(item.amount)}
                      </strong>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="month-sheet-section">
              <div className="month-sheet-section__header">
                <div>
                  <p className="eyebrow">Saídas</p>
                  <h2>Despesas variáveis</h2>
                </div>
                <strong className="extract-amount extract-amount--expense">
                  {formatCurrency(metrics?.variableReal ?? 0)}
                </strong>
              </div>

              {variableExpenses.length === 0 ? (
                <div className="month-sheet-empty">
                  <p>Nenhum gasto variável registrado neste mês.</p>
                </div>
              ) : (
                <div className="month-sheet-list month-sheet-list--clean">
                  {variableExpenses.map((item) => (
                    <article key={item.id} className="month-sheet-row month-sheet-row--clean">
                      <div className="month-sheet-date-chip" aria-hidden="true">
                        <strong>{String(getLocalDayOfMonth(item.created_at, timeZone)).padStart(2, "0")}</strong>
                      </div>
                      <div className="month-sheet-row__content">
                        <strong>{formatDisplayText(item.description)}</strong>
                        <div className="month-sheet-row__meta">
                          <p>
                            {formatDateTimeInZone(item.created_at, timeZone, {
                              day: "2-digit",
                              month: "long",
                            })}{" "}
                            •{" "}
                            {formatDateTimeInZone(item.created_at, timeZone, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <strong className="extract-amount extract-amount--expense">
                        {formatCurrency(item.amount ?? 0)}
                      </strong>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        ) : null}
      </div>
    </main>
  );
}
