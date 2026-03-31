import { Injectable } from "@nestjs/common";
import { CreateCommitmentDto } from "./dto/create-commitment.dto";
import { SupabaseService } from "../integrations/supabase/supabase.service";

@Injectable()
export class CommitmentsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private normalizeText(input: string) {
    return input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  private resolveLegacyDirection(title: string, direction: "expense" | "income") {
    if (direction === "income") {
      return direction;
    }

    const normalizedTitle = this.normalizeText(title);
    const fixedIncomeTerms = ["prolabore", "pro labore", "pro-labore", "salario", "freelance", "freela"];

    return fixedIncomeTerms.some((term) => normalizedTitle.includes(term)) ? "income" : direction;
  }

  async list(userId: string) {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        items: [],
        provider: "none" as const,
        reason: "Supabase nao configurado.",
      };
    }

    const { data, error } = await admin
      .from("commitments")
      .select("id, title, amount, direction, recurrence_rule, day_of_month, starts_on, ends_on, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      return {
        items: [],
        provider: "supabase" as const,
        reason: error.message,
      };
    }

    return {
      items:
        data?.map((item) => ({
          ...item,
          direction: this.resolveLegacyDirection(item.title, item.direction),
        })) ?? [],
      provider: "supabase" as const,
    };
  }

  create(dto: CreateCommitmentDto) {
    return {
      message: "Compromisso recebido como placeholder.",
      payload: dto,
    };
  }
}
