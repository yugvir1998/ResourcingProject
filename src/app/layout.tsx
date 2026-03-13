import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resourcing Dashboard",
  description: "Battlefield command center for venture and resource allocation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ToastProvider>
        <div className="min-h-screen bg-zinc-50">
          <header className="border-b border-zinc-200 bg-white/95 shadow-sm backdrop-blur-sm">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
              <Link href="/" className="text-lg font-bold text-zinc-900">
                Resourcing Dashboard
              </Link>
              <Nav />
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
        </div>
        </ToastProvider>
      </body>
    </html>
  );
}
