"use client";

import { createBrowserSupabaseClient } from "./supabase";

export async function authenticatedFetch(
  input: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
