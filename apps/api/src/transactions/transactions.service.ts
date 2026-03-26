import { Injectable } from "@nestjs/common";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { SupabaseService } from "../integrations/supabase/supabase.service";

@Injectable()
export class TransactionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list() {
    const admin = this.supabaseService.admin;

    if (!admin) {
      return {
        items: [],
        placeholder: true,
        provider: "none",
        reason: "Supabase nao configurado.",
      };
    }

    const { data, error } = await admin
      .from("transactions")
      .select("id, direction, description, amount, category, created_at")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      return {
        items: [],
        placeholder: false,
        provider: "supabase",
        reason: error.message,
      };
    }

    return {
      items: data ?? [],
      placeholder: false,
      provider: "supabase",
    };
  }

  create(dto: CreateTransactionDto) {
    return {
      message: "Transacao recebida como placeholder.",
      payload: dto,
    };
  }
}
