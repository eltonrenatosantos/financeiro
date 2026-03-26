import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "node:path";
import { AuthModule } from "./auth/auth.module";
import { AttachmentsModule } from "./attachments/attachments.module";
import { CommitmentsModule } from "./commitments/commitments.module";
import { ConversationModule } from "./conversation/conversation.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthModule } from "./health/health.module";
import { ParserModule } from "./parser/parser.module";
import { RemindersModule } from "./reminders/reminders.module";
import { SupabaseModule } from "./integrations/supabase/supabase.module";
import { TransactionsModule } from "./transactions/transactions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "../../.env"),
      ],
    }),
    SupabaseModule,
    HealthModule,
    AuthModule,
    ConversationModule,
    ParserModule,
    TransactionsModule,
    CommitmentsModule,
    RemindersModule,
    AttachmentsModule,
    DashboardModule,
  ],
})
export class AppModule {}
