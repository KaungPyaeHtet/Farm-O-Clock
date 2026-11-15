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

const description =
  "Drop a pin on any farm on Earth and get NASA-data-driven planting-risk, sowing windows, and crop-rotation guidance — in English or Burmese.";

// Icons and the share preview come from files in this folder: favicon.ico, icon.svg,
// apple-icon.png, opengraph-image.png (the Farm O'Clock "orbit clock" logo).
export const metadata: Metadata = {
  metadataBase: new URL("https://farm-oclock-five.vercel.app"),
  title: "Farm O'Clock — Planting-Risk & Crop Rotation Planner",
  description,
  applicationName: "Farm O'Clock",
  openGraph: { title: "Farm O'Clock", description, siteName: "Farm O'Clock", type: "website" },
  twitter: { card: "summary_large_image", title: "Farm O'Clock", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${myanmar.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
