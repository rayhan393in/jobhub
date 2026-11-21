import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/anek-bangla";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { themeScript } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: {
    default: "JobHub — বাংলাদেশের কম্পিটিটিভ পরীক্ষা প্রস্তুতি",
    template: "%s · JobHub",
  },
  description:
    "JobHub — BCS, ব্যাংক, সরকারি চাকরি, প্রাথমিক শিক্ষক, NTRCA ও EEE প্রস্তুতির জন্য যাচাইকৃত প্রশ্নব্যাংক, লাইভ পরীক্ষা এবং বাস্তব পারফরম্যান্স বিশ্লেষণ।",
  applicationName: "JobHub",
  keywords: [
    "BCS প্রস্তুতি",
    "বাংলাদেশ চাকরি প্রস্তুতি",
    "ব্যাংক জব প্রস্তুতি",
    "NTRCA",
    "প্রাইমারি শিক্ষক",
    "online exam",
    "JobHub",
  ],
  authors: [{ name: "JobHub" }],
  openGraph: {
    title: "JobHub — Bangladesh Exam Preparation",
    description:
      "Verified question bank, live exams and real performance analytics for Bangladesh competitive examinations.",
    type: "website",
    locale: "bn_BD",
    siteName: "JobHub",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14172b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html translate="no" lang="bn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--brand)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          মূল কন্টেন্টে যান
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
