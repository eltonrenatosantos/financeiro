import { Body, Controller, Post } from "@nestjs/common";
import { ParseInputDto } from "./dto/parse-input.dto";
import { ParserService } from "./parser.service";

@Controller("parser")
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post()
  parse(@Body() dto: ParseInputDto) {
    return this.parserService.parse(dto);
  }
}

