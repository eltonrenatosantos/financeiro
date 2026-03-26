import { z } from "zod";
import { TransactionDirection } from "../enums/transaction-direction.enum";

export const transactionDraftSchema = z.object({
  description: z.string().min(1),
  amount: z.number().nullable(),
  direction: z.nativeEnum(TransactionDirection),
  category: z.string().nullable(),
});

