// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ConditionalBackground from "@/components/ConditionalBackground";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Nouvelle Rive",
  description: "Espace vendeur·euse",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nouvelle Rive",
  },
  verification: {
    google: "QWUCoEjaDcFHWH1Oj35_QgUna7F7v23dtujYKyp6sTA",
  },
};

export const viewport = {
  themeColor: "#22209C",
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
        <RegisterSW />
        <div className="relative" style={{ zIndex: 10 }}>
          {children}
        </div>
      </body>
    </html>
  );
}