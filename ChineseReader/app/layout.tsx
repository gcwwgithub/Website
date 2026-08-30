import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "语流 Yǔliú · Chinese Novel Reader",
  description: "Read continuous Chinese novel pages, hear selections aloud, and look up exact meanings from a private translation database.",
  icons: {
    icon: "/Website/ChineseReader/out/favicon.svg",
    shortcut: "/Website/ChineseReader/out/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
