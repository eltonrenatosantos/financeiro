import { ConversationRole } from "../enums/conversation-role.enum";
import { ReminderChannel } from "../enums/reminder-channel.enum";
import { TransactionDirection } from "../enums/transaction-direction.enum";

export type UUID = string;

export interface Profile {
  id: UUID;
  fullName: string | null;
  preferredLocale: string;
  createdAt: string;
}

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
  createdAt: string;
}

export interface TransactionDraft {
  description: string;
  amount: number | null;
  direction: TransactionDirection;
  category: string | null;
}

export interface ReminderDraft {
  channel: ReminderChannel;
  scheduledFor: string;
}

