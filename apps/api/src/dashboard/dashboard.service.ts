import { Injectable } from "@nestjs/common";

@Injectable()
export class DashboardService {
  summary() {
    return {
      placeholder: true,
      message: "Resumo do dashboard ainda nao implementado.",
    };
  }
}

