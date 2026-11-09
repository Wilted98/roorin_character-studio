import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AION · Character Studio",
  description: "Shape your character. An interactive web character studio with real AION2 assets, face customization and personal presets.",
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
