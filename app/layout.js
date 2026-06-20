import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata = {
  icons: { icon: '/work2wish-logo.png', apple: '/work2wish-logo.png' },
  title: "Work2Wish",
  description: 'Work2Wish connects skilled workers with employers for daily and short-term jobs.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
