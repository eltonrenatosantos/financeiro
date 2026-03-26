import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { appConfig } from "./config/app.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = appConfig();

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isConfiguredOrigin = config.corsOrigins.includes(origin);
      const isLocalOrigin =
        origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000";
      const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

      if (isConfiguredOrigin || isLocalOrigin || isVercelPreview) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
  });

  await app.listen(config.port);
}

void bootstrap();
