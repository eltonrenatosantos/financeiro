import { Body, Controller, Get, Post } from "@nestjs/common";
import { CommitmentsService } from "./commitments.service";
import { CreateCommitmentDto } from "./dto/create-commitment.dto";

@Controller("commitments")
export class CommitmentsController {
  constructor(private readonly commitmentsService: CommitmentsService) {}

  @Get()
  list() {
    return this.commitmentsService.list();
  }

  @Post()
  create(@Body() dto: CreateCommitmentDto) {
    return this.commitmentsService.create(dto);
  }
}

