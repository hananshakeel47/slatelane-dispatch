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
    "SlateLane Dispatch helps owner-operators and small trucking fleets maximize revenue through professional dispatching, broker negotiation, route planning, paperwork management, and dedicated back-office support.",

  keywords: [
    "truck dispatch",
    "dispatch services",
    "owner operator dispatch",
    "freight dispatch",
    "dispatch company",
    "freight broker",
    "route planning",
    "paperwork management",
    "SlateLane Dispatch",
  ],

  authors: [
    {
      name: "SlateLane Dispatch",
    },
  ],

  creator: "SlateLane Dispatch",

  publisher: "SlateLane Dispatch",

  alternates: {
    canonical: "https://slatelanedispatch.com",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },

  verification: {
    google: "I7VlGiWYqqlf1xuOhw3E-o8bXSbGERlcDtKScusB1C8",
  },

  openGraph: {
    title: "SlateLane Dispatch | Professional Truck Dispatch Services",
    description:
      "Professional dispatching, broker negotiation, route planning, paperwork management and 24/7 driver support.",

    url: "https://slatelanedispatch.com",

    siteName: "SlateLane Dispatch",

    locale: "en_US",

    type: "website",

    images: [
      {
        url: "/favicon.png",
        width: 1254,
        height: 1254,
        alt: "SlateLane Dispatch",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title: "SlateLane Dispatch",

    description:
      "Professional truck dispatch services for owner operators and small fleets.",

    images: ["/favicon.png"],
  },

  applicationName: "SlateLane Dispatch",

  category: "Transportation",

  formatDetection: {
    telephone: true,
    email: true,
    address: true,
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