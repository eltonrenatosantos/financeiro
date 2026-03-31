import { Injectable, Logger } from "@nestjs/common";
import * as webpush from "web-push";
import { CreateReminderDto } from "./dto/create-reminder.dto";
import { RegisterPushSubscriptionDto } from "./dto/register-push-subscription.dto";
import { SupabaseService } from "../integrations/supabase/supabase.service";

type StoredPushSubscription = {
  user_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  active: boolean;
};

type CommitmentItem = {
  id: string;
  user_id: string | null;
  title: string;
  amount: number | null;
  day_of_month: number | null;
  starts_on: string | null;
  ends_on: string | null;
  direction: "expense" | "income";
};

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private readonly vapidPublicKey = process.env.WEB_PUSH_PUBLIC_KEY ?? "";
  private readonly vapidPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY ?? "";
  private readonly vapidSubject = process.env.WEB_PUSH_SUBJECT ?? "mailto:financeiro@example.com";
  private readonly adminToken = process.env.REMINDERS_ADMIN_TOKEN ?? "";
  private readonly pushConfigured: boolean;

  constructor(private readonly supabaseService: SupabaseService) {
    this.pushConfigured = Boolean(
      this.vapidPublicKey && this.vapidPrivateKey && this.vapidSubject,
    );

    if (this.pushConfigured) {
      webpush.setVapidDetails(
        this.vapidSubject,
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );
      return;
    }

    this.logger.warn("Web push nao configurado. Configure as chaves VAPID para ativar notificacoes.");
  }

  async list(userId: string) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        items: [],
        subscriptions: 0,
        provider: "none" as const,
        reason: "Supabase nao configurado.",
      };
    }

    const [{ data: reminders, error: remindersError }, { count, error: subscriptionsError }] =
      await Promise.all([
        admin
          .from("reminders")
          .select("id, related_entity_type, related_entity_id, channel, scheduled_for, status, payload, sent_at, created_at")
          .eq("user_id", userId)
          .order("scheduled_for", { ascending: false })
          .limit(30),
        admin
          .from("push_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("active", true),
      ]);

    if (remindersError || subscriptionsError) {
      return {
        items: [],
        subscriptions: 0,
        provider: "supabase" as const,
        reason: remindersError?.message ?? subscriptionsError?.message,
      };
    }

    return {
      items: reminders ?? [],
      subscriptions: count ?? 0,
      provider: "supabase" as const,
      pushConfigured: this.pushConfigured,
    };
  }

  async create(dto: CreateReminderDto, userId: string) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        saved: false,
        provider: "none" as const,
        reason: "Supabase nao configurado.",
      };
    }

    const scheduledFor = new Date(dto.schedule);

    if (Number.isNaN(scheduledFor.getTime())) {
      return {
        saved: false,
        provider: "supabase" as const,
        reason: "Data de agendamento invalida.",
      };
    }

    const { data, error } = await admin
      .from("reminders")
      .insert({
        user_id: userId,
        related_entity_type: dto.relatedEntityType,
        related_entity_id: dto.relatedEntityId,
        channel: dto.channel ?? "push",
        scheduled_for: scheduledFor.toISOString(),
        payload: dto.payload ?? {},
      })
      .select("id, related_entity_type, related_entity_id, channel, scheduled_for, status, payload, created_at")
      .single();

    if (error) {
      return {
        saved: false,
        provider: "supabase" as const,
        reason: error.message,
      };
    }

    return {
      saved: true,
      provider: "supabase" as const,
      item: data,
    };
  }

  async registerSubscription(dto: RegisterPushSubscriptionDto, userId: string) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        saved: false,
        provider: "none" as const,
        reason: "Supabase nao configurado.",
      };
    }

    if (!dto.endpoint || !dto.keys?.p256dh || !dto.keys?.auth) {
      return {
        saved: false,
        provider: "supabase" as const,
        reason: "Subscription invalida.",
      };
    }

    const { data, error } = await admin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: dto.endpoint,
          p256dh: dto.keys.p256dh,
          auth: dto.keys.auth,
          expiration_time: dto.expirationTime ?? null,
          device_label: dto.deviceLabel ?? null,
          user_agent: dto.userAgent ?? null,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      )
      .select("id, endpoint, active, created_at, updated_at")
      .single();

    if (error) {
      return {
        saved: false,
        provider: "supabase" as const,
        reason: error.message,
      };
    }

    return {
      saved: true,
      provider: "supabase" as const,
      subscription: data,
      pushConfigured: this.pushConfigured,
    };
  }

  async unregisterSubscription(endpoint: string, userId: string) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        saved: false,
        provider: "none" as const,
        reason: "Supabase nao configurado.",
      };
    }

    if (!endpoint) {
      return {
        saved: false,
        provider: "supabase" as const,
        reason: "Endpoint ausente.",
      };
    }

    const { error } = await admin
      .from("push_subscriptions")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("endpoint", endpoint);

    if (error) {
      return {
        saved: false,
        provider: "supabase" as const,
        reason: error.message,
      };
    }

    return {
      saved: true,
      provider: "supabase" as const,
    };
  }

  async dispatchDueCommitments(adminToken?: string) {
    if (!this.adminToken || adminToken !== this.adminToken) {
      return {
        sent: 0,
        failed: 0,
        provider: "none" as const,
        reason: "Token administrativo invalido.",
      };
    }

    if (!this.pushConfigured) {
      return {
        sent: 0,
        failed: 0,
        provider: "none" as const,
        reason: "Web push nao configurado.",
      };
    }

    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        sent: 0,
        failed: 0,
        provider: "none" as const,
        reason: "Supabase nao configurado.",
      };
    }

    const today = this.getSaoPauloDateParts();

    const [{ data: commitments, error: commitmentsError }, { data: subscriptions, error: subscriptionsError }] =
      await Promise.all([
        admin
          .from("commitments")
          .select("id, user_id, title, amount, day_of_month, starts_on, ends_on, direction")
          .eq("direction", "expense"),
        admin
          .from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth, active")
          .eq("active", true),
      ]);

    if (commitmentsError || subscriptionsError) {
      return {
        sent: 0,
        failed: 0,
        provider: "supabase" as const,
        reason: commitmentsError?.message ?? subscriptionsError?.message,
      };
    }

    const dueToday = (commitments ?? []).filter((item) =>
      this.isCommitmentDueToday(item as CommitmentItem, today),
    )
      .filter((item) => item.user_id) as CommitmentItem[];

    const subscriptionsByUser = new Map<string, StoredPushSubscription[]>();

    for (const subscription of (subscriptions ?? []) as StoredPushSubscription[]) {
      if (!subscription.user_id) {
        continue;
      }

      const current = subscriptionsByUser.get(subscription.user_id) ?? [];
      current.push(subscription);
      subscriptionsByUser.set(subscription.user_id, current);
    }

    if (dueToday.length === 0 || subscriptionsByUser.size === 0) {
      return {
        sent: 0,
        failed: 0,
        provider: "supabase" as const,
        dueToday: dueToday.length,
        subscriptions: (subscriptions ?? []).length,
      };
    }

    let sent = 0;
    let failed = 0;

    for (const commitment of dueToday) {
      const userSubscriptions = subscriptionsByUser.get(commitment.user_id ?? "");

      if (!userSubscriptions?.length) {
        continue;
      }

      const scheduledFor = this.toSaoPauloMiddayIso(today.year, today.month, today.day);
      const payload = this.buildCommitmentPayload(commitment);
      const reminderId = await this.ensureReminder(
        admin,
        commitment.id,
        commitment.user_id ?? null,
        scheduledFor,
        payload,
      );

      if (!reminderId) {
        failed += userSubscriptions.length;
        continue;
      }

      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify(payload),
          );

          sent += 1;
          await admin
            .from("push_subscriptions")
            .update({
              last_success_at: new Date().toISOString(),
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("endpoint", subscription.endpoint);
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "Falha ao enviar notificacao.";
          await admin
            .from("push_subscriptions")
            .update({
              last_error: message,
              updated_at: new Date().toISOString(),
            })
            .eq("endpoint", subscription.endpoint);
        }
      }

      if (sent > 0) {
        await admin
          .from("reminders")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", reminderId);
      }
    }

    return {
      sent,
      failed,
      provider: "supabase" as const,
      dueToday: dueToday.length,
      subscriptions: subscriptions.length,
    };
  }

  private async ensureReminder(
    admin: NonNullable<SupabaseService["admin"]>,
    commitmentId: string,
    userId: string | null,
    scheduledFor: string,
    payload: Record<string, unknown>,
  ) {
    const { data: existing } = await admin
      .from("reminders")
      .select("id, status")
      .eq("user_id", userId)
      .eq("related_entity_type", "commitment")
      .eq("related_entity_id", commitmentId)
      .eq("scheduled_for", scheduledFor)
      .maybeSingle();

    if (existing?.id) {
      return existing.id;
    }

    const { data, error } = await admin
      .from("reminders")
      .insert({
        user_id: userId,
        related_entity_type: "commitment",
        related_entity_id: commitmentId,
        channel: "push",
        scheduled_for: scheduledFor,
        status: "pending",
        payload,
      })
      .select("id")
      .single();

    if (error) {
      this.logger.warn(`Nao foi possivel criar reminder para commitment ${commitmentId}: ${error.message}`);
      return null;
    }

    return data.id;
  }

  private buildCommitmentPayload(commitment: CommitmentItem) {
    const title = this.toPrettyTitle(commitment.title);
    const amount = typeof commitment.amount === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(commitment.amount)
      : null;

    return {
      title: `${title} vence hoje`,
      body: amount ? `${title} • ${amount}` : title,
      tag: `commitment-${commitment.id}`,
      data: {
        url: "/summary",
        commitmentId: commitment.id,
      },
    };
  }

  private isCommitmentDueToday(
    commitment: CommitmentItem,
    today: { year: number; month: number; day: number; isoDate: string },
  ) {
    if (commitment.direction !== "expense") {
      return false;
    }

    if (commitment.starts_on && commitment.starts_on > today.isoDate) {
      return false;
    }

    if (commitment.ends_on && commitment.ends_on < today.isoDate) {
      return false;
    }

    return commitment.day_of_month === today.day;
  }

  private getSaoPauloDateParts() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
    const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
    const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

    return {
      year,
      month,
      day,
      isoDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }

  private toSaoPauloMiddayIso(year: number, month: number, day: number) {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00-03:00`;
  }

  private toPrettyTitle(value: string) {
    if (!value) {
      return "Conta";
    }

    const map: Record<string, string> = {
      condominio: "Condomínio",
      emprestimo: "Empréstimo",
      oculos: "Óculos",
      plano_de_saude: "Plano de saúde",
      "plano de saude": "Plano de saúde",
      "compras do mes": "Compras do mês",
    };

    const normalized = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    return map[normalized]
      ?? value
        .split(" ")
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ");
  }
}
