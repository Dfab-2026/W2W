import './globals.css';
import { Toaster } from '@/components/ui/sonner';

<<<<<<< HEAD
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

=======
>>>>>>> 2e184e548a506e14c8bce48a1472abbe6dbea4d4
export const metadata = {
  title: 'Work2Wish – Find day-work or hire skilled workers',
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
