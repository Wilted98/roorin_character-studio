import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "roorin · Character Studio",
  description: "Shape your character. A local character studio using supplied character assets, face customization and personal presets.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
