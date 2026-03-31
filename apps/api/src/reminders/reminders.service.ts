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

type CommitmentDueStatus =
  | {
      kind: "due_today";
      dueDate: string;
      overdueDays: 0;
    }
  | {
      kind: "overdue";
      dueDate: string;
      overdueDays: number;
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

    const dueItems = (commitments ?? [])
      .map((item) => {
        const dueStatus = this.resolveCommitmentDueStatus(
          item as CommitmentItem,
          today,
        );

        if (!dueStatus || !item.user_id) {
          return null;
        }

        return {
          commitment: item as CommitmentItem,
          dueStatus,
        };
      })
      .filter(Boolean) as Array<{
      commitment: CommitmentItem;
      dueStatus: CommitmentDueStatus;
    }>;

    const subscriptionsByUser = new Map<string, StoredPushSubscription[]>();

    for (const subscription of (subscriptions ?? []) as StoredPushSubscription[]) {
      if (!subscription.user_id) {
        continue;
      }

      const current = subscriptionsByUser.get(subscription.user_id) ?? [];
      current.push(subscription);
      subscriptionsByUser.set(subscription.user_id, current);
    }

    if (dueItems.length === 0 || subscriptionsByUser.size === 0) {
      return {
        sent: 0,
        failed: 0,
        provider: "supabase" as const,
        dueToday: 0,
        overdue: 0,
        eligible: dueItems.length,
        subscriptions: (subscriptions ?? []).length,
      };
    }

    let sent = 0;
    let failed = 0;

    for (const item of dueItems) {
      const userSubscriptions = subscriptionsByUser.get(item.commitment.user_id ?? "");

      if (!userSubscriptions?.length) {
        continue;
      }

      const scheduledFor = this.toSaoPauloMiddayIso(today.year, today.month, today.day);
      const payload = this.buildCommitmentPayload(item.commitment, item.dueStatus);
      const reminderId = await this.ensureReminder(
        admin,
        item.commitment.id,
        item.commitment.user_id ?? null,
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
      dueToday: dueItems.filter((item) => item.dueStatus.kind === "due_today").length,
      overdue: dueItems.filter((item) => item.dueStatus.kind === "overdue").length,
      eligible: dueItems.length,
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

  private buildCommitmentPayload(
    commitment: CommitmentItem,
    dueStatus: CommitmentDueStatus,
  ) {
    const title = this.toPrettyTitle(commitment.title);
    const amount = typeof commitment.amount === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(commitment.amount)
      : null;
    const statusTitle =
      dueStatus.kind === "due_today"
        ? `${title} vence hoje`
        : `${title} está vencido`;
    const statusBody =
      dueStatus.kind === "due_today"
        ? amount
          ? `${title} • ${amount}`
          : title
        : amount
          ? `${title} está vencido há ${dueStatus.overdueDays} ${dueStatus.overdueDays === 1 ? "dia" : "dias"} • ${amount}`
          : `${title} está vencido há ${dueStatus.overdueDays} ${dueStatus.overdueDays === 1 ? "dia" : "dias"}`;

    return {
      title: statusTitle,
      body: statusBody,
      tag: `commitment-${commitment.id}`,
      data: {
        url: "/summary",
        commitmentId: commitment.id,
        dueDate: dueStatus.dueDate,
        dueStatus: dueStatus.kind,
        overdueDays: dueStatus.overdueDays,
      },
    };
  }

  private resolveCommitmentDueStatus(
    commitment: CommitmentItem,
    today: { year: number; month: number; day: number; isoDate: string },
  ): CommitmentDueStatus | null {
    if (commitment.direction !== "expense") {
      return null;
    }

    if (commitment.starts_on && commitment.starts_on > today.isoDate) {
      return null;
    }

    if (commitment.ends_on && commitment.ends_on < today.isoDate) {
      return null;
    }

    if (!commitment.day_of_month) {
      return null;
    }

    const todayDate = new Date(today.year, today.month - 1, today.day);
    const candidateDates = [
      new Date(today.year, today.month - 1, commitment.day_of_month),
      new Date(today.year, today.month - 2, commitment.day_of_month),
    ];

    for (const candidate of candidateDates) {
      const dueDate = `${String(candidate.getFullYear()).padStart(4, "0")}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;

      if (commitment.starts_on && dueDate < commitment.starts_on) {
        continue;
      }

      if (commitment.ends_on && dueDate > commitment.ends_on) {
        continue;
      }

      const diffDays = Math.floor(
        (todayDate.getTime() - candidate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays < 0 || diffDays > 5) {
        continue;
      }

      if (diffDays === 0) {
        return {
          kind: "due_today",
          dueDate,
          overdueDays: 0,
        };
      }

      return {
        kind: "overdue",
        dueDate,
        overdueDays: diffDays,
      };
    }

    return null;
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
