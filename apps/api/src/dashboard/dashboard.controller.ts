import { Controller, Get, Headers, Query } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { AuthService } from "../auth/auth.service";

@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly authService: AuthService,
  ) {}

  @Get("summary")
  async summary(
    @Headers("authorization") authorization?: string,
    @Query("month") month?: string,
  ) {
    const userId = await this.authService.requireUserId(authorization);
    return this.dashboardService.summary(userId, month);
  }
}
