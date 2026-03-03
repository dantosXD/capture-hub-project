import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundaryWrapper } from "@/components/ErrorBoundaryWrapper";
import { WebSocketProvider } from "@/contexts/WebSocketContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Capture Hub - Your Personal Command Center",
  description: "A floating action hub for quick capture, organization, and AI-enhanced management of ideas, screenshots, web pages, and more.",
  keywords: ["Capture", "Notes", "OCR", "Screenshots", "Web scraping", "Organization", "AI"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Capture Hub",
    description: "Your Personal Command Center for Quick Capture & Organization",
    url: "https://capturehub.z.ai",
    siteName: "Capture Hub",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Capture Hub",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ErrorBoundaryWrapper>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <WebSocketProvider>
              {children}
            </WebSocketProvider>
          </ThemeProvider>
        </ErrorBoundaryWrapper>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
