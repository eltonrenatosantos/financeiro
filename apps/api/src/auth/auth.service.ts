import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthService {
  status() {
    return {
      ready: false,
      message: "Fluxo de autenticacao ainda nao implementado.",
    };
  }
}

