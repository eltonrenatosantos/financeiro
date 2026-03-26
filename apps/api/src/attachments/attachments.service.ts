import { Injectable } from "@nestjs/common";
import { CreateAttachmentDto } from "./dto/create-attachment.dto";

@Injectable()
export class AttachmentsService {
  list() {
    return {
      items: [],
      placeholder: true,
    };
  }

  create(dto: CreateAttachmentDto) {
    return {
      message: "Anexo recebido como placeholder.",
      payload: dto,
    };
  }
}

