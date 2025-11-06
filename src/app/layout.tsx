import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
