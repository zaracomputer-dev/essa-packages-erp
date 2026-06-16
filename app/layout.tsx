import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Essa Packages ERP",
  description: "Operational dashboard for Essa Packages ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
