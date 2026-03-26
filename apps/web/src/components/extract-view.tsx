"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDateTimeInZone,
  getLocalDayKey,
  resolveUserTimeZone,
} from "./date-time";
import { formatDisplayText } from "./display-text";
import { TransactionIcon } from "./transaction-icon";

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

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatProviderLabel(provider: "supabase" | "none") {
  return provider === "supabase" ? "Conectado" : "Sem conexão";
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "Sem valor";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function ExtractView() {
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<"supabase" | "none">("none");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");

  useEffect(() => {
    setTimeZone(resolveUserTimeZone());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadExtract() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/transactions`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`API retornou status ${response.status}`);
        }

        const data = (await response.json()) as TransactionsApiResponse;
        if (cancelled) {
          return;
        }

        setItems(data.items);
        setProvider(data.provider);
        setErrorMessage(data.reason ?? null);
      } catch {
        if (cancelled) {
          return;
        }

        setProvider("none");
        setErrorMessage("Não consegui carregar o extrato agora.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void loadExtract();
      }
    }

    void loadExtract();

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    const intervalId = window.setInterval(refreshIfVisible, 15000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.clearInterval(intervalId);
    };
  }, []);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, TransactionItem[]>();

    items.forEach((item) => {
      const dayKey = getLocalDayKey(item.created_at, timeZone);
      const current = groups.get(dayKey) ?? [];
      current.push(item);
      groups.set(dayKey, current);
    });

    return Array.from(groups.entries()).map(([day, transactions]) => ({
      day,
      transactions,
      dayTotal: transactions.reduce((total, transaction) => {
        const amount = transaction.amount ?? 0;
        return transaction.direction === "income" ? total + amount : total - amount;
      }, 0),
    }));
  }, [items, timeZone]);

  const monthSummary = useMemo(() => {
    return items.reduce(
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
  }, [items]);

  return (
    <main className="app-main">
      <div className="shell shell--narrow">
        <section className="extract-hero">
          <div>
            <p className="eyebrow">Extrato</p>
            <h1>
              {formatDateTimeInZone(new Date(), timeZone, {
                month: "long",
                year: "numeric",
              })}
            </h1>
          </div>
          <span className="extract-provider">{formatProviderLabel(provider)}</span>
        </section>

        <section className="extract-summary">
          <article className="extract-summary__card extract-summary__card--sheet">
            <span className="mini-label extract-summary__label">Entradas</span>
            <strong className="extract-amount extract-amount--income">
              {formatCurrency(monthSummary.income)}
            </strong>
          </article>
          <article className="extract-summary__card extract-summary__card--sheet">
            <span className="mini-label extract-summary__label">Saídas</span>
            <strong className="extract-amount extract-amount--expense">
              {formatCurrency(monthSummary.expense)}
            </strong>
          </article>
          <article className="extract-summary__card extract-summary__card--sheet">
            <span className="mini-label extract-summary__label">Saldo</span>
            <strong>
              {formatCurrency(monthSummary.income - monthSummary.expense)}
            </strong>
          </article>
        </section>

        {loading ? (
          <section className="conversation-panel">
            <p className="muted-text">Carregando extrato...</p>
          </section>
        ) : null}

        {!loading && errorMessage && items.length === 0 ? (
          <section className="conversation-panel">
            <p className="muted-text">{errorMessage}</p>
          </section>
        ) : null}

        {!loading && groupedItems.length === 0 && !errorMessage ? (
          <section className="conversation-panel">
            <p className="muted-text">Nenhum lançamento encontrado ainda.</p>
          </section>
        ) : null}

        <section className="extract-list">
          {groupedItems.map((group) => (
            <section key={group.day} className="extract-group">
              <div className="extract-group__header">
                <h2>
                  {formatDateTimeInZone(`${group.day}T12:00:00`, timeZone, {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <strong
                  className={`extract-amount ${
                    group.dayTotal >= 0
                      ? "extract-amount--income"
                      : "extract-amount--expense"
                  }`}
                >
                  {formatCurrency(group.dayTotal)}
                </strong>
              </div>

              <div className="extract-group__items">
                {group.transactions.map((transaction) => (
                  <article key={transaction.id} className="extract-row">
                    <div className="extract-row__left">
                      <span
                        className={`extract-sign extract-sign--${transaction.direction}`}
                      >
                        <TransactionIcon
                          description={transaction.description}
                          category={transaction.category}
                          direction={transaction.direction}
                        />
                      </span>
                      <div>
                        <strong>{formatDisplayText(transaction.description)}</strong>
                        <p>
                          {formatDateTimeInZone(transaction.created_at, timeZone, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <strong
                      className={`extract-amount extract-amount--${transaction.direction}`}
                    >
                      {formatCurrency(transaction.amount)}
                    </strong>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      </div>
    </main>
  );
}
