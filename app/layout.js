import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import Script from 'next/script';

export const metadata = {
  title: 'Work2Wish – Find day-work or hire skilled workers',
  description: 'Work2Wish connects skilled workers with employers for daily and short-term jobs.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Script id="exit-confirm">{`window.addEventListener("beforeunload",function(e){e.preventDefault();e.returnValue="";});`}</Script>{children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
