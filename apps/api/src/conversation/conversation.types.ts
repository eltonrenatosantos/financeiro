import { ParsedConversationResult } from "../parser/parser.types";

export interface ConversationPersistenceResult {
  saved: boolean;
  provider: "supabase" | "none";
  conversationId: string | null;
  recordId: string | null;
  reason?: string;
  conflictingTitles?: string[];
  assistantMessage?: string;
}

export interface ConversationTurnResponse {
  message: string;
  assistantReply: string;
  payload: {
    text: string;
    audioAssetPath?: string;
  };
  parsed: ParsedConversationResult;
  persistence: ConversationPersistenceResult;
}
