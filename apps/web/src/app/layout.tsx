import type { Metadata } from "next";
import { AuthGate } from "../components/auth-gate";
import { AuthProvider } from "../components/auth-provider";
import { PwaProvider } from "../components/pwa-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financeiro Voice",
  description: "PWA inicial do gestor financeiro orientado por voz.",
  manifest: "/manifest.json",
  applicationName: "Financeiro Voice",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Financeiro Voice",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.svg", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <PwaProvider />
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
