// src/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nouvelle Rive",
  description: "Espace vendeur·euse",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "sans-serif", background: "white", color: "black" }}>
        {children}
      </body>
    </html>
  );
}
