import { NextResponse } from "next/server";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
const remindersAdminToken = process.env.REMINDERS_ADMIN_TOKEN ?? "";
const cronSecret = process.env.CRON_SECRET ?? "";

function isAuthorized(request: Request) {
  if (!cronSecret) {
    return true;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, reason: "Nao autorizado." },
      { status: 401 },
    );
  }

  if (!apiBaseUrl || !remindersAdminToken) {
    return NextResponse.json(
      {
        ok: false,
        reason: "Variaveis de ambiente ausentes para disparo de lembretes.",
      },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/reminders/dispatch-due`, {
      method: "POST",
      headers: {
        "x-reminders-admin-token": remindersAdminToken,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: "Falha ao acionar o backend de lembretes.",
          status: response.status,
          data,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: "vercel-cron",
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "Falha inesperada no cron.",
      },
      { status: 500 },
    );
  }
}
