import "./globals.css";
import type { Viewport } from "next";
import RegisterSW from "./register-sw";

export const metadata = {
  title: "Ledger App",
  description: "Your ledger management system",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <link rel="manifest" href="/manifest.json" />
      <body>
         <RegisterSW />
        {children}
      </body>
    </html>
  );
}

