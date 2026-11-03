import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flashfire Attendance",
  description: "Attendance and leave for the Flashfire team",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-100 font-sans text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
