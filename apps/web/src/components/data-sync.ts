"use client";

export const FINANCE_DATA_UPDATED_EVENT = "financeiro:data-updated";

export function notifyFinanceDataUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(FINANCE_DATA_UPDATED_EVENT));
}

