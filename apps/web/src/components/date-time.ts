const FALLBACK_TIME_ZONE = "America/Sao_Paulo";

function getFormatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    ...options,
  });
}

export function resolveUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

export function formatDateTimeInZone(
  value: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return getFormatter(timeZone, options).format(new Date(value));
}

export function getLocalDayKey(value: string | Date, timeZone: string) {
  const parts = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function getLocalYearMonth(value: string | Date, timeZone: string) {
  const parts = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");

  return { year, month };
}

export function getLocalDayOfMonth(value: string | Date, timeZone: string) {
  return Number(
    getFormatter(timeZone, { day: "2-digit" }).format(new Date(value)),
  );
}

