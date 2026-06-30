import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://slatelanedispatch.com"),

  title: {
    default: "SlateLane Dispatch | Professional Truck Dispatch Services",
    template: "%s | SlateLane Dispatch",
  },

  description:
    "Professional truck dispatch services helping owner-operators and small fleets maximize profits with high-paying freight across the USA.",

  keywords: [
    "truck dispatch",
    "dispatch services",
    "owner operator",
    "freight dispatcher",
    "USA trucking",
    "truck loads",
    "dispatch company",
  ],

  verification: {
    google: "I7VlGiWYqqlf1xuOhw3E-o8bXSbGERlcDtKScusB1C8",
  },

  openGraph: {
    title: "SlateLane Dispatch",
    description:
      "Professional truck dispatch services across the United States.",
    url: "https://slatelanedispatch.com",
    siteName: "SlateLane Dispatch",
    images: [
      {
        url: "/favicon.png",
        width: 1024,
        height: 1024,
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "SlateLane Dispatch",
    description:
      "Professional truck dispatch services helping owner operators maximize profits.",
    images: ["/favicon.png"],
  },

  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}

        <GoogleAnalytics gaId="G-R5KVM3BG30" />
      </body>
    </html>
  );
}