import { Injectable, UnauthorizedException } from "@nestjs/common";
import { SupabaseService } from "../integrations/supabase/supabase.service";

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  status() {
    return {
      ready: true,
      message: "Autenticacao por token pronta para integracao com o frontend.",
    };
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return null;
    }

    return token.trim();
  }

  async resolveUserIdFromAuthorization(authorization?: string) {
    const accessToken = this.extractBearerToken(authorization);
    const admin = this.supabaseService.admin;

    if (!accessToken || !admin) {
      return null;
    }

    const { data, error } = await admin.auth.getUser(accessToken);

    if (error || !data.user?.id) {
      return null;
    }

    return data.user.id;
  }

  async requireUserId(authorization?: string) {
    const userId = await this.resolveUserIdFromAuthorization(authorization);

    if (!userId) {
      throw new UnauthorizedException("Sessão inválida ou ausente.");
    }

    return userId;
  }
}
