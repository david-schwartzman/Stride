import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SkipLink } from "@/components/layout/SkipLink";

import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stride",
  description:
    "Running gear for your first 5K and 10K. Less choice, clearer guidance, faster decisions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SkipLink />
        <Header />
        {/* scroll-mt clears the sticky Header (57px mobile, 93px md+) so the
            skip link doesn't land #main underneath it. */}
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 scroll-mt-15 focus:outline-none md:scroll-mt-24"
        >
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
