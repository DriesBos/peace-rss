import type { Metadata, Viewport } from 'next';
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
import { FontFamilyController } from '@/components/FontFamilyController/FontFamilyController';
import Notifications from '@/components/Notifications/Notifications';
import { GlobalKeybindings } from '@/components/GlobalKeybindings/GlobalKeybindings';
import { KomorebiMainController } from '@/components/KomorebiMainController/KomorebiMainController';
import { LandingPage } from '@/components/LandingPage/LandingPage';
import { MainKomorebiLayer } from '@/components/MainKomorebiLayer/MainKomorebiLayer';
import { SpacingWideController } from '@/components/SpacingWideController/SpacingWideController';
import { TypeSizeController } from '@/components/TypeSizeController/TypeSizeController';
import { DEFAULT_FONT_FAMILY } from '@/lib/fontFamily';
import { DEFAULT_KOMOREBI_MAIN } from '@/lib/komorebi';
import { DEFAULT_THEME, THEME_OPTIONS } from '@/lib/theme';
import { DEFAULT_TYPE_SIZE } from '@/lib/typeSize';

const untitledSans = localFont({
  src: [
    {
      path: '../fonts/untitled/untitled-sans-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/untitled/untitled-sans-regular-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/untitled/untitled-sans-bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/untitled/untitled-sans-bold-italic.woff2',
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
  ],
  variable: '--font-soul-sister',
});

const cheltenham = localFont({
  src: [
    {
      path: '../fonts/celtenham/cheltenham-normal-700.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-cheltenham',
});

const imperial = localFont({
  src: [
    {
      path: '../fonts/imperial-normal-400.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-imperial',
});

export const metadata: Metadata = {
  title: 'Komorebi Reader',
  description: 'Enjoy your reading',
  manifest: '/manifest.json',
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/komorebi-favicon-black.svg', type: 'image/svg+xml', sizes: 'any' },
      {
        url: '/komorebi-favicon-black.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/komorebi-favicon-white.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: [
      { url: '/images/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e3e3d1' },
    { media: '(prefers-color-scheme: dark)', color: '#3d3f31' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showLandingPageInDevelopment = process.env.NODE_ENV === 'development';

  return (
    <ClerkProvider signInFallbackRedirectUrl="/">
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${untitledSans.variable} ${soulSister.variable} ${cheltenham.variable} ${imperial.variable}`}
          data-font-family={DEFAULT_FONT_FAMILY}
          data-komorebi-main={DEFAULT_KOMOREBI_MAIN}
          data-spacing-wide="false"
          data-type-size={DEFAULT_TYPE_SIZE}
        >
          <ThemeProvider
            attribute="data-theme"
            defaultTheme={DEFAULT_THEME}
            themes={THEME_OPTIONS.filter((theme) => theme !== 'system')}
            enableSystem={true}
            storageKey="peace-rss-theme"
          >
            <SpacingWideController />
            <FontFamilyController />
            <TypeSizeController />
            <KomorebiMainController />
            <Notifications />
            <main>
              {showLandingPageInDevelopment ? (
                <LandingPage />
              ) : (
                <>
                  <SignedOut>
                    <LandingPage />
                  </SignedOut>
                  <SignedIn>
                    <MainKomorebiLayer />
                    <div className="mainContentLayer">
                      <GlobalKeybindings />
                      {children}
                    </div>
                  </SignedIn>
                </>
              )}
            </main>
            <div id="modal-root" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
