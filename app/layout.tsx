import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Review System",
  description: "Dashboard intelijen review pasien untuk rumah sakit.",
};

import { AuthProvider } from "./lib/auth-context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
