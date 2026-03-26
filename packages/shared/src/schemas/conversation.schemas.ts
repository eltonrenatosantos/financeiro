import { z } from "zod";
import { ConversationRole } from "../enums/conversation-role.enum";

export const conversationMessageSchema = z.object({
  role: z.nativeEnum(ConversationRole),
  content: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const conversationStateSchema = z.object({
  conversationId: z.string().uuid(),
  activeIntent: z.string().nullable(),
  missingSlots: z.array(z.string()).default([]),
});

