import { Module } from "@nestjs/common";
import { CommitmentsController } from "./commitments.controller";
import { CommitmentsService } from "./commitments.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [CommitmentsController],
  providers: [CommitmentsService],
  exports: [CommitmentsService],
})
export class CommitmentsModule {}
