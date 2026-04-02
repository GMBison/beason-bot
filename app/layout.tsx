import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BEASON License Admin",
  description: "Telegram-based license generation system for BEASON CBT.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
