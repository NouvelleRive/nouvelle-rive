// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ConditionalBackground from "@/components/ConditionalBackground";

export const metadata: Metadata = {
  title: "Nouvelle Rive",
  description: "Espace vendeur·euse",
  manifest: "/manifest.json",
  themeColor: "#22209C",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nouvelle Rive",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  verification: {
    google: "QWUCoEjaDcFHWH1Oj35_QgUna7F7v23dtujYKyp6sTA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="font-sans bg-white text-black antialiased">
        <ConditionalBackground />
        <div className="relative" style={{ zIndex: 10 }}>
          {children}
        </div>
      </body>
    </html>
  );
}