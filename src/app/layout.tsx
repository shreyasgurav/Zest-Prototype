import type { Metadata } from 'next';
import { Lexend, Barrio, Schoolbell, Lexend_Peta } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import ClientLayout from './ClientLayout';
import { Toaster } from "react-hot-toast";
import AnimatedBackground from "@/components/AnimatedBackground";

// Initialize Lexend font with all weights
const lexend = Lexend({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-lexend',
});

// Initialize Barrio font
const barrio = Barrio({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-barrio',
});

// Initialize Schoolbell font
const schoolbell = Schoolbell({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-schoolbell',
});

// Initialize Lexend Peta font
const lexendPeta = Lexend_Peta({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-lexend-peta',
});

// Combine all font variables
const fontVariables = `${lexend.variable} ${barrio.variable} ${schoolbell.variable} ${lexendPeta.variable}`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Zest',
  description: 'Your guide to everything',
  icons: {
    icon: '/Zest Logo.jpeg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <AnimatedBackground />
        <ClientLayout>
          {children}
        </ClientLayout>
        <Analytics />
        <Toaster position="top-center" />
      </body>
    </html>
  );
} 