import { Body, Controller, Delete, Get, Headers, Post } from "@nestjs/common";
import { CreateReminderDto } from "./dto/create-reminder.dto";
import { RegisterPushSubscriptionDto } from "./dto/register-push-subscription.dto";
import { RemindersService } from "./reminders.service";
import { AuthService } from "../auth/auth.service";

@Controller("reminders")
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async list(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.requireUserId(authorization);
    return this.remindersService.list(userId);
  }

  @Post()
  async create(
    @Body() dto: CreateReminderDto,
    @Headers("authorization") authorization?: string,
  ) {
    const userId = await this.authService.requireUserId(authorization);
    return this.remindersService.create(dto, userId);
  }

  @Post("subscriptions")
  async registerSubscription(
    @Body() dto: RegisterPushSubscriptionDto,
    @Headers("authorization") authorization?: string,
  ) {
    const userId = await this.authService.requireUserId(authorization);
    return this.remindersService.registerSubscription(dto, userId);
  }

  @Delete("subscriptions")
  async unregisterSubscription(
    @Body("endpoint") endpoint: string,
    @Headers("authorization") authorization?: string,
  ) {
    const userId = await this.authService.requireUserId(authorization);
    return this.remindersService.unregisterSubscription(endpoint, userId);
  }

  @Post("dispatch-due")
  dispatchDue(@Headers("x-reminders-admin-token") adminToken?: string) {
    return this.remindersService.dispatchDueCommitments(adminToken);
  }
}
