import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Neighborhood Now',
  description:
    'Type an address. See what is happening. Know where it is going.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
