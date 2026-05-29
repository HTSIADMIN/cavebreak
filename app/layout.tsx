import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { CommandMenu } from "@/components/command-menu";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cavebreak",
  description: "A top-down RTS — mine outward through the cave and break out.",
};

// Dark mode is pinned on <html> (the game is a dark UI); no next-themes provider,
// which avoids its theme <script> that errors on client render under React 19.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          {children}
          <CommandMenu />
          <Toaster theme="dark" />
        </TooltipProvider>
      </body>
    </html>
  );
}
