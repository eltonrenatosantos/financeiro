export interface AppConfig {
  appName: string;
  port: number;
  corsOrigins: string[];
}

export function appConfig(): AppConfig {
  const configuredOrigins = (process.env.API_CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    appName: process.env.API_APP_NAME ?? "financeiro-voice-api",
    port: Number(process.env.API_PORT ?? 4000),
    corsOrigins: configuredOrigins,
  };
}
