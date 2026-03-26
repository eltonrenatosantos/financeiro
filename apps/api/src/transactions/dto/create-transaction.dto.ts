import { TransactionDirection } from "@financeiro/shared";

export class CreateTransactionDto {
  description!: string;
  amount?: number;
  direction!: TransactionDirection;
}

