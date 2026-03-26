import { Body, Controller, Delete, Get, Headers, Post } from "@nestjs/common";
import { CreateReminderDto } from "./dto/create-reminder.dto";
import { RegisterPushSubscriptionDto } from "./dto/register-push-subscription.dto";
import { RemindersService } from "./reminders.service";

@Controller("reminders")
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  list() {
    return this.remindersService.list();
  }

  @Post()
  create(@Body() dto: CreateReminderDto) {
    return this.remindersService.create(dto);
  }

  @Post("subscriptions")
  registerSubscription(@Body() dto: RegisterPushSubscriptionDto) {
    return this.remindersService.registerSubscription(dto);
  }

  @Delete("subscriptions")
  unregisterSubscription(@Body("endpoint") endpoint: string) {
    return this.remindersService.unregisterSubscription(endpoint);
  }

  @Post("dispatch-due")
  dispatchDue(@Headers("x-reminders-admin-token") adminToken?: string) {
    return this.remindersService.dispatchDueCommitments(adminToken);
  }
}
