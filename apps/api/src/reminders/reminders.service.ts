import { Injectable } from "@nestjs/common";
import { CreateReminderDto } from "./dto/create-reminder.dto";

@Injectable()
export class RemindersService {
  list() {
    return {
      items: [],
      placeholder: true,
    };
  }

  create(dto: CreateReminderDto) {
    return {
      message: "Lembrete recebido como placeholder.",
      payload: dto,
    };
  }
}

