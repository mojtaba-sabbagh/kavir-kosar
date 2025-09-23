import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
import Footer from "@/components/Footer";


export const metadata: Metadata = {
  title: "کوثر کویر رفسنجان",
  description: "سامانه فرم‌ها",
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className="rtl-enabled">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased font-sans">
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="container mx-auto max-w-none flex-1 px-4 py-6">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}