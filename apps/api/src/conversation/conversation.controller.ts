import { Body, Controller, Post } from "@nestjs/common";
import { ConversationService } from "./conversation.service";
import { CreateConversationTurnDto } from "./dto/create-conversation-turn.dto";

@Controller("conversation")
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post("turns")
  createTurn(@Body() dto: CreateConversationTurnDto) {
    return this.conversationService.createTurn(dto);
  }
}

