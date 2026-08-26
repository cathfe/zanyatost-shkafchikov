import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Занятость шкафчиков — СПОРТ МЕДИА',
  description:
    'Актуальная занятость шкафчиков и раздевалок по фитнес-клубам: по месяцам, слотам и раздевалкам.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
