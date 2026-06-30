import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hermina Review Intelligence",
  description: "Dashboard intelijen review pasien untuk rumah sakit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
