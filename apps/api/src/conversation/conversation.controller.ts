import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ConversationService } from "./conversation.service";
import { CreateConversationTurnDto } from "./dto/create-conversation-turn.dto";
import { AuthService } from "../auth/auth.service";

@Controller("conversation")
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly authService: AuthService,
  ) {}

  @Post("turns")
  async createTurn(
    @Body() dto: CreateConversationTurnDto,
    @Headers("authorization") authorization?: string,
  ) {
    const userId = await this.authService.requireUserId(authorization);
    return this.conversationService.createTurn(dto, userId);
  }
}
