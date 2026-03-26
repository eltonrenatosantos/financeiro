export interface AppConfig {
  appName: string;
  port: number;
  corsOrigin: string;
}

export function appConfig(): AppConfig {
  return {
    appName: process.env.API_APP_NAME ?? "financeiro-voice-api",
    port: Number(process.env.API_PORT ?? 4000),
    corsOrigin: process.env.API_CORS_ORIGIN ?? "http://localhost:3000",
  };
}
