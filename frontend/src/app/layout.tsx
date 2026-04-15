import type { Metadata } from "next";
import { Sora, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "CobbyIQ — AI-Powered Employee Onboarding for Small Teams",
    template: "%s | CobbyIQ",
  },
  description:
    "CobbyIQ turns your company documents into an AI knowledge base. New hires get instant answers from your policies, handbooks, and SOPs. Setup in under 10 minutes.",
  keywords: [
    "employee onboarding software",
    "AI onboarding tool",
    "knowledge base for new hires",
    "automated employee onboarding",
    "onboarding software small business",
    "AI HR tool",
  ],
  metadataBase: new URL("https://cobbyiq.com"),
  openGraph: {
    title: "CobbyIQ — Onboard Smarter. Answer Faster.",
    description:
      "AI-powered onboarding for teams of 20–150. Upload your docs, invite hires, and let CobbyIQ answer their questions 24/7.",
    url: "https://cobbyiq.com",
    siteName: "CobbyIQ",
    type: "website",
    // Add this once you have a real OG image:
    // images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CobbyIQ — AI Onboarding for Small Teams",
    description:
      "Turn your company docs into an instant-answer knowledge base for new hires.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${instrumentSerif.variable}`}>
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}