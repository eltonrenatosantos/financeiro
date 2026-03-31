import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { TransactionsService } from "./transactions.service";
import { AuthService } from "../auth/auth.service";

@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async list(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.requireUserId(authorization);
    return this.transactionsService.list(userId);
  }

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }
}
