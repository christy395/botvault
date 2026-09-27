import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BotVault — Free Discord Bot Hosting",
  description: "Your Discord Bots. Online. 24/7.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
