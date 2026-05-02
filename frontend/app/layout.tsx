import type { Metadata } from "next";
import "./globals.css";
import { ThemeInit } from "@/components/app/theme-init";

export const metadata: Metadata = {
  title: "NEXUS — Cross-Channel Measurement",
  description:
    "Live dashboard for broadcast audio fingerprinting and telecom sector insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
