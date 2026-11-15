import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Myanmar } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const myanmar = Noto_Sans_Myanmar({
  variable: "--font-myanmar",
  subsets: ["myanmar"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Farm O'Clock — Planting-Risk & Crop Rotation Planner",
  description:
    "Drop a pin on any farm on Earth and get NASA-data-driven planting-risk, sowing windows, and crop-rotation guidance — in English or Burmese.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${myanmar.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
