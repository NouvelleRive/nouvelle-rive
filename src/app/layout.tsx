// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ConditionalBackground from "@/components/ConditionalBackground";

export const metadata: Metadata = {
  title: "Nouvelle Rive",
  description: "Espace vendeur·euse",
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