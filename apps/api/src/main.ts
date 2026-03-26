import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { appConfig } from "./config/app.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = appConfig();

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: config.corsOrigin,
  });

  await app.listen(config.port);
}

void bootstrap();

