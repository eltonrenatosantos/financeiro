import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { CommitmentsService } from "./commitments.service";
import { CreateCommitmentDto } from "./dto/create-commitment.dto";
import { AuthService } from "../auth/auth.service";

@Controller("commitments")
export class CommitmentsController {
  constructor(
    private readonly commitmentsService: CommitmentsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async list(@Headers("authorization") authorization?: string) {
    const userId = await this.authService.requireUserId(authorization);
    return this.commitmentsService.list(userId);
  }

  @Post()
  create(@Body() dto: CreateCommitmentDto) {
    return this.commitmentsService.create(dto);
  }
}
