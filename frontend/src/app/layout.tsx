import type { Metadata } from 'next';
import localFont from 'next/font/local';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs';
import '@/styles/vars.sass';
import '@/styles/reset.css';
import '@/styles/globals.sass';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SerwistProvider } from './serwist';
import Notifications from '@/components/Notifications/Notifications';
import { GlobalKeybindings } from '@/components/GlobalKeybindings/GlobalKeybindings';
import { LandingPage } from '@/components/LandingPage/LandingPage';

const untitledSans = localFont({
  src: [
    {
      path: '../fonts/untitled/test-untitled-sans-light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../fonts/untitled/test-untitled-sans-light-italic.woff2',
      weight: '300',
      style: 'italic',
    },
    {
      path: '../fonts/untitled/test-untitled-sans-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/untitled/test-untitled-sans-regular-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/untitled/test-untitled-sans-medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/untitled/test-untitled-sans-medium-italic.woff2',
      weight: '500',
      style: 'italic',
    },
    {
      path: '../fonts/untitled/test-untitled-sans-bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/untitled/test-untitled-sans-bold-italic.woff2',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-untitled-sans',
});

const soulSister = localFont({
  src: [
    {
      path: '../fonts/soulsister/soulsister.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/soulsister/soulsister.ttf',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-soul-sister',
});

export const metadata: Metadata = {
  title: 'Komorebi Reader',
  description: 'Enjoy your reading',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Komorebi Reader',
  },
  formatDetection: {
    telephone: false,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e3e3d1' },
    { media: '(prefers-color-scheme: dark)', color: '#3d3f31' },
  ],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  icons: {
    icon: [
      {
        url: '/images/favicon-light.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/images/favicon-dark.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: [
      { url: '/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider signInFallbackRedirectUrl="/">
      <html lang="en" suppressHydrationWarning>
        <body className={`${untitledSans.variable} ${soulSister.variable}`}>
          <SerwistProvider>
            <ThemeProvider
              attribute="data-theme"
              defaultTheme="light"
              themes={['light', 'dark', 'softlight', 'softdark', 'green', 'nightmode']}
              enableSystem={true}
              storageKey="peace-rss-theme"
            >
              <Notifications />
              <main>
                <SignedOut>
                  <LandingPage />
                </SignedOut>
                <SignedIn>
                  <GlobalKeybindings />
                  {children}
                </SignedIn>
              </main>
              <div id="modal-root" />
            </ThemeProvider>
          </SerwistProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
