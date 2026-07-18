import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MobilyaOS",
  description: "MobilyaOS P2 foundation"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
