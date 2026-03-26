"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FINANCE_DATA_UPDATED_EVENT } from "./data-sync";
import { getLocalYearMonth, resolveUserTimeZone } from "./date-time";

type TransactionItem = {
  id: string;
  direction: "expense" | "income" | "transfer";
  description: string;
  amount: number | null;
  created_at: string;
};

type TransactionsApiResponse = {
  items: TransactionItem[];
  provider: "supabase" | "none";
  reason?: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function SummaryView() {
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");

  useEffect(() => {
    setTimeZone(resolveUserTimeZone());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
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
        setErrorMessage(data.reason ?? null);
      } catch {
        if (cancelled) {
          return;
        }

        setErrorMessage("Não consegui carregar o resumo agora.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void loadSummary();
      }
    }

    void loadSummary();

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

  const months = useMemo(() => {
    return [2026, 2027].map((year) => ({
      year,
      months: monthLabels.map((label, index) => {
      const month = index + 1;
      const monthlyItems = items.filter((item) => {
        const local = getLocalYearMonth(item.created_at, timeZone);
        return local.year === year && local.month === month;
      });
      const now = new Date();

      return {
        label,
        year,
        month,
        active: monthlyItems.length > 0,
        current: now.getFullYear() === year && now.getMonth() + 1 === month,
      };
      }),
    }));
  }, [items, timeZone]);

  return (
    <main className="app-main">
      <div className="shell shell--narrow">
        <section className="extract-hero">
          <div>
            <p className="eyebrow">Resumo</p>
            <h1>Escolha o mês.</h1>
            <p className="hero-balance-label">Visão anual</p>
          </div>
        </section>

        {loading ? (
          <section className="conversation-panel">
            <p className="muted-text">Carregando resumo...</p>
          </section>
        ) : null}

        {!loading && errorMessage ? (
          <section className="conversation-panel">
            <p className="muted-text">{errorMessage}</p>
          </section>
        ) : null}

        {!loading ? (
          <section className="summary-year-list">
            {months.map((group) => (
              <section key={group.year} className="summary-year-section">
                <div className="extract-group__header">
                  <h2>{group.year}</h2>
                </div>
                <div className="summary-grid summary-grid--compact">
                  {group.months.map((month) => (
                    <Link
                      key={`${group.year}-${month.month}`}
                      href={`/dashboard/${group.year}-${String(month.month).padStart(2, "0")}`}
                      className={`summary-month${
                        month.active ? " summary-month--active" : ""
                      }${month.current ? " summary-month--current" : ""}`}
                    >
                      <span>{month.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
