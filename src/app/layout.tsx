// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ConditionalBackground from "@/components/ConditionalBackground";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.nouvellerive.eu"),
  title: {
    default: "Nouvelle Rive — Vintage et upcyclé chinés à Paris",
    template: "%s | Nouvelle Rive",
  },
  description:
    "Boutique vintage et upcyclée au cœur du Marais à Paris. Pièces uniques chinées par des créatrices indépendantes — vintage de luxe, upcycling, créateurs. 8 rue des Ecouffes, 75004 Paris.",
  keywords: [
    "vintage",
    "upcycling",
    "vintage Paris",
    "upcyclé Paris",
    "boutique vintage Paris",
    "boutique vintage Le Marais",
    "upcycling Paris",
    "mode circulaire",
    "seconde main luxe Paris",
    "friperie Paris",
    "vintage de luxe",
    "Nouvelle Rive",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nouvelle Rive",
  },
  verification: {
    google: "QWUCoEjaDcFHWH1Oj35_QgUna7F7v23dtujYKyp6sTA",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Nouvelle Rive",
    url: "https://www.nouvellerive.eu",
    title: "Nouvelle Rive — Vintage et upcyclé chinés à Paris",
    description:
      "Boutique vintage et upcyclée au cœur du Marais à Paris. Pièces uniques chinées par des créatrices indépendantes.",
    images: [
      {
        url: "/facade%20paysage.jpg",
        width: 1200,
        height: 630,
        alt: "Nouvelle Rive — Boutique vintage 8 rue des Ecouffes, Le Marais Paris",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nouvelle Rive — Vintage et upcyclé chinés à Paris",
    description:
      "Boutique vintage et upcyclée au cœur du Marais à Paris.",
    images: ["/facade%20paysage.jpg"],
  },
  alternates: {
    canonical: "/",
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
    <html lang="fr" className="overflow-x-hidden">
      <body className="font-sans bg-white text-black antialiased overflow-x-hidden">
        <ConditionalBackground />
        <RegisterSW />
        <div className="relative" style={{ zIndex: 10 }}>
          {children}
        </div>
      </body>
    </html>
  );
}