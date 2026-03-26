import { Injectable, Logger } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../../config/supabase.config";

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly config = supabaseConfig();
  private readonly serviceRoleClient: SupabaseClient | null;

  constructor() {
    if (!this.config.url || !this.config.serviceRoleKey) {
      this.logger.warn(
        "Supabase service role nao configurado. O cliente foi criado como placeholder.",
      );
      this.serviceRoleClient = null;
      return;
    }

    this.serviceRoleClient = createClient(
      this.config.url,
      this.config.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  get admin(): SupabaseClient | null {
    return this.serviceRoleClient;
  }
}
