import { Body, Controller, Get, Post } from "@nestjs/common";
import { AttachmentsService } from "./attachments.service";
import { CreateAttachmentDto } from "./dto/create-attachment.dto";

@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  list() {
    return this.attachmentsService.list();
  }

  @Post()
  create(@Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.create(dto);
  }
}

