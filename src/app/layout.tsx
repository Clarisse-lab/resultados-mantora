import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const texto = Inter({ subsets: ["latin"], variable: "--fonte-texto" });
const numeros = JetBrains_Mono({ subsets: ["latin"], variable: "--fonte-numeros" });

export const metadata: Metadata = {
  title: "Mantora — Resultados",
  description: "Painel de marketing e vendas dos clientes Mantora.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${texto.variable} ${numeros.variable}`}>
      <body>{children}</body>
    </html>
  );
}
