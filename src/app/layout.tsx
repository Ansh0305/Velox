import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import { Analytics } from "@vercel/analytics/next";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Velox - Secure, Self-Destructing Chat",
  description: "A private, ephemeral chat application with end-to-end encryption, self-destructing rooms, and zero logs.",
  authors: [{ name: "Sirigiri Sai Ansh Raj" }],
  keywords: ["secure chat", "self-destructing messages", "private messaging", "encrypted chat", "anonymous chat", "realtime chat"],
  openGraph: {
    title: "Velox - Secure Chat",
    description: "Start a private, encrypted conversation that disappears forever when the timer expires.",
    type: "website",
    locale: "en_US",
    siteName: "Velox",
  },
  twitter: {
    card: "summary_large_image",
    title: "Velox - Secure Chat",
    description: "Start a private, encrypted conversation that disappears forever.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
      <Analytics/>
    </html>
  );
}
