import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateReminderDto } from "./dto/create-reminder.dto";
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
}

