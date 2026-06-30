import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    "SlateLane Dispatch helps owner-operators and small trucking fleets maximize revenue through professional dispatching, broker negotiation, route planning, and back-office support.",

  keywords: [
    "truck dispatch",
    "dispatch services",
    "owner operator dispatch",
    "freight dispatch",
    "truck dispatcher",
    "dispatch company USA",
    "dry van dispatch",
    "box truck dispatch",
    "hotshot dispatch",
    "freight broker negotiation",
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
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://slatelanedispatch.com",
    siteName: "SlateLane Dispatch",
    title: "SlateLane Dispatch | Professional Truck Dispatch Services",
    description:
      "Professional dispatching, broker negotiation, route planning, paperwork management, and 24/7 driver support.",
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
      "Professional truck dispatch services for owner-operators and small fleets.",
    images: ["/favicon.png"],
  },

  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },

  category: "Transportation",

  applicationName: "SlateLane Dispatch",

  referrer: "origin-when-cross-origin",

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
      </body>
    </html>
  );
}