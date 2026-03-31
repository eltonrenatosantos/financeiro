"use client";

import { useEffect, useMemo, useState } from "react";
import { FINANCE_DATA_UPDATED_EVENT } from "./data-sync";
import {
  formatDateTimeInZone,
  getLocalDayOfMonth,
  getLocalYearMonth,
  resolveUserTimeZone,
} from "./date-time";
import { formatDisplayText } from "./display-text";
import { authenticatedFetch } from "../lib/api";

type TransactionItem = {
  id: string;
  direction: "expense" | "income" | "transfer";
  description: string;
  amount: number | null;
  category?: string | null;
  created_at: string;
};

type TransactionsApiResponse = {
  items: TransactionItem[];
  provider: "supabase" | "none";
  reason?: string;
};

type CommitmentItem = {
  id: string;
  title: string;
  amount: number | null;
  direction: "expense" | "income";
  recurrence_rule: string | null;
  day_of_month: number | null;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
};

type CommitmentsApiResponse = {
  items: CommitmentItem[];
  provider: "supabase" | "none";
  reason?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatMonthTitle(year: number, month: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
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

function sortCommitmentsByDay(items: CommitmentItem[]) {
  return [...items].sort((left, right) => {
    const leftDay = left.day_of_month ?? Number.POSITIVE_INFINITY;
    const rightDay = right.day_of_month ?? Number.POSITIVE_INFINITY;

    if (leftDay !== rightDay) {
      return leftDay - rightDay;
    }

    const titleComparison = left.title.localeCompare(right.title, "pt-BR");

    if (titleComparison !== 0) {
      return titleComparison;
    }

    return left.created_at.localeCompare(right.created_at);
  });
}

export function MonthSummaryView({ monthKey }: { monthKey: string }) {
  const parsed = parseMonthKey(monthKey);
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [commitments, setCommitments] = useState<CommitmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");

  useEffect(() => {
    setTimeZone(resolveUserTimeZone());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMonth() {
      try {
        const [transactionsResponse, commitmentsResponse] = await Promise.all([
          authenticatedFetch(`${apiBaseUrl}/api/transactions`, {
            cache: "no-store",
          }),
          authenticatedFetch(`${apiBaseUrl}/api/commitments`, {
            cache: "no-store",
          }),
        ]);

        if (!transactionsResponse.ok) {
          throw new Error(`API retornou status ${transactionsResponse.status}`);
        }

        if (!commitmentsResponse.ok) {
          throw new Error(`API retornou status ${commitmentsResponse.status}`);
        }

        const transactionsData = (await transactionsResponse.json()) as TransactionsApiResponse;
        const commitmentsData = (await commitmentsResponse.json()) as CommitmentsApiResponse;

        if (cancelled) {
          return;
        }

        setItems(transactionsData.items);
        setCommitments(commitmentsData.items);
        setErrorMessage(transactionsData.reason ?? commitmentsData.reason ?? null);
      } catch {
        if (cancelled) {
          return;
        }

        setErrorMessage("Não consegui carregar essa planilha mensal agora.");
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
  }, []);

  const monthItems = useMemo(() => {
    if (!parsed) {
      return [];
    }

    return items.filter((item) => {
      const local = getLocalYearMonth(item.created_at, timeZone);
      return local.year === parsed.year && local.month === parsed.month;
    });
  }, [items, parsed, timeZone]);

  const monthSummary = useMemo(() => {
    return monthItems.reduce(
      (acc, item) => {
        const amount = item.amount ?? 0;

        if (item.direction === "income") {
          acc.income += amount;
        } else if (item.direction === "expense") {
          acc.expense += amount;
        }

        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [monthItems]);

  const activeCommitments = useMemo(() => {
    if (!parsed) {
      return [];
    }

    const monthStart = new Date(parsed.year, parsed.month - 1, 1);
    const monthEnd = new Date(parsed.year, parsed.month, 0);

    return commitments.filter((item) => {
      const startsOn = item.starts_on ? new Date(`${item.starts_on}T00:00:00`) : null;
      const endsOn = item.ends_on ? new Date(`${item.ends_on}T23:59:59`) : null;

      const started = !startsOn || startsOn <= monthEnd;
      const notEnded = !endsOn || endsOn >= monthStart;

      return started && notEnded;
    });
  }, [commitments, parsed]);

  const fixedExpenseCommitments = useMemo(
    () => sortCommitmentsByDay(activeCommitments.filter((item) => item.direction === "expense")),
    [activeCommitments],
  );

  const fixedIncomeCommitments = useMemo(
    () => sortCommitmentsByDay(activeCommitments.filter((item) => item.direction === "income")),
    [activeCommitments],
  );

  const commitmentsTotal = useMemo(
    () =>
      fixedExpenseCommitments.reduce((total, item) => {
        return total + (item.amount ?? 0);
      }, 0),
    [fixedExpenseCommitments],
  );

  const fixedIncomeTotal = useMemo(
    () =>
      fixedIncomeCommitments.reduce((total, item) => {
        return total + (item.amount ?? 0);
      }, 0),
    [fixedIncomeCommitments],
  );

  const summaryIncomeTotal = monthSummary.income + fixedIncomeTotal;
  const summaryExpenseTotal = monthSummary.expense + commitmentsTotal;
  const summaryBalance = summaryIncomeTotal - summaryExpenseTotal;

  const incomeItems = useMemo(
    () => monthItems.filter((item) => item.direction === "income"),
    [monthItems],
  );

  const variableExpenseItems = useMemo(
    () => monthItems.filter((item) => item.direction === "expense" && item.category !== "conectividade fixa" && item.category !== "moradia fixa"),
    [monthItems],
  );

  const fixedExpensePayments = useMemo(
    () => monthItems.filter((item) => item.direction === "expense" && (item.category === "conectividade fixa" || item.category === "moradia fixa")),
    [monthItems],
  );

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
          <div>
            <p className="eyebrow">Resumo mensal</p>
            <h1>{formatMonthTitle(parsed.year, parsed.month)}</h1>
            <p className="hero-balance-label">Saldo projetado</p>
            <strong className="hero-balance-value">
              {formatCurrency(summaryBalance)}
            </strong>
          </div>
        </section>

        <section className="month-sheet-summary">
          <article className="extract-summary__card extract-summary__card--sheet">
            <span className="mini-label extract-summary__label">Entradas</span>
            <strong className="extract-amount extract-amount--income">
              {formatCurrency(summaryIncomeTotal)}
            </strong>
          </article>
          <article className="extract-summary__card extract-summary__card--sheet">
            <span className="mini-label extract-summary__label">Saídas</span>
            <strong className="extract-amount extract-amount--expense">
              {formatCurrency(summaryExpenseTotal)}
            </strong>
          </article>
          <article className="extract-summary__card extract-summary__card--sheet">
            <span className="mini-label extract-summary__label">Saldo</span>
            <strong>{formatCurrency(summaryBalance)}</strong>
          </article>
        </section>

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

        {!loading && !errorMessage ? (
          <section className="month-sheet-layout">
            <section className="month-sheet-section">
              <div className="month-sheet-section__header">
                <div>
                  <p className="eyebrow">Entradas</p>
                  <h2>Receitas do mês</h2>
                </div>
                <strong className="extract-amount extract-amount--income">
                  {formatCurrency(summaryIncomeTotal)}
                </strong>
              </div>

              {incomeItems.length === 0 && fixedIncomeCommitments.length === 0 ? (
                <div className="month-sheet-empty">
                  <p>Nenhuma entrada registrada neste mês.</p>
                </div>
              ) : null}

              {incomeItems.length > 0 ? (
                <div className="month-sheet-list">
                  {incomeItems.map((item) => (
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
                </div>
              ) : null}

              {fixedIncomeCommitments.length > 0 ? (
                <div className="month-sheet-list">
                  {fixedIncomeCommitments.map((item) => (
                    <article key={item.id} className="month-sheet-row month-sheet-row--linked month-sheet-row--commitment">
                      <div className="month-sheet-date-chip month-sheet-date-chip--income" aria-hidden="true">
                        <strong>{String(getLocalDayOfMonth(item.created_at, timeZone)).padStart(2, "0")}</strong>
                      </div>
                      <div className="month-sheet-row__content">
                        <strong>{formatDisplayText(item.title)}</strong>
                      </div>
                      <strong className="extract-amount extract-amount--income">
                        {formatCurrency(item.amount ?? 0)}
                      </strong>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="month-sheet-section">
              <div className="month-sheet-section__header">
                <div>
                  <p className="eyebrow">Saídas</p>
                  <h2>Gastos fixos</h2>
                </div>
                <strong className="extract-amount extract-amount--expense">
                  {formatCurrency(commitmentsTotal)}
                </strong>
              </div>

              {fixedExpenseCommitments.length === 0 ? (
                <div className="month-sheet-empty">
                  <strong>Nenhum gasto fixo conectado ainda.</strong>
                  <p>
                    Quando você cadastrar contratos e contas recorrentes por voz, eles vão aparecer aqui
                    com valor e previsão mensal.
                  </p>
                </div>
              ) : (
                <div className="month-sheet-list">
                  {fixedExpenseCommitments.map((item) => (
                    <article key={item.id} className="month-sheet-row month-sheet-row--commitment">
                      <div className="month-sheet-date-chip" aria-hidden="true">
                        <strong>
                          {item.day_of_month !== null
                            ? String(item.day_of_month).padStart(2, "0")
                            : "--"}
                        </strong>
                      </div>
                      <div className="month-sheet-row__content">
                        <strong>{formatDisplayText(item.title)}</strong>
                      </div>
                      <strong className="extract-amount extract-amount--expense">
                        {formatCurrency(item.amount ?? 0)}
                      </strong>
                    </article>
                  ))}

                  {fixedExpensePayments.map((item) => (
                    <article key={item.id} className="month-sheet-row month-sheet-row--linked month-sheet-row--commitment">
                      <div className="month-sheet-date-chip" aria-hidden="true">
                        <strong>{String(getLocalDayOfMonth(item.created_at, timeZone)).padStart(2, "0")}</strong>
                      </div>
                      <div className="month-sheet-row__content">
                        <strong>Pagamento vinculado • {formatDisplayText(item.description)}</strong>
                        <p>
                          {formatDisplayText(item.category ?? "gasto fixo")} • {formatDateTimeInZone(item.created_at, timeZone, {
                            day: "2-digit",
                            month: "long",
                          })} • {formatDateTimeInZone(item.created_at, timeZone, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <strong className="extract-amount extract-amount--expense">
                        {formatCurrency(item.amount ?? 0)}
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
                  {formatCurrency(monthSummary.expense)}
                </strong>
              </div>

              {variableExpenseItems.length === 0 ? (
                <div className="month-sheet-empty">
                  <p>Nenhum gasto variável registrado neste mês.</p>
                </div>
              ) : (
                <div className="month-sheet-list month-sheet-list--clean">
                  {variableExpenseItems.map((item) => (
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
                            })} • {formatDateTimeInZone(item.created_at, timeZone, {
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
