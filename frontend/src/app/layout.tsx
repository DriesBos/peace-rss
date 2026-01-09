import type { Metadata } from 'next';
import localFont from 'next/font/local';
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';
import '@/styles/vars.sass';
import '@/styles/reset.css';
import '@/styles/globals.sass';
import { ThemeProvider } from '@/components/ThemeProvider';

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

export const metadata: Metadata = {
  title: 'Peace RSS',
  description: 'Read your news in peace',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Peace RSS',
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
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  icons: {
    icon: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
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
        <body className={`${untitledSans.variable}`}>
          <ThemeProvider
            attribute="data-theme"
            defaultTheme="light"
            themes={['light', 'dark', 'softlight', 'softdark', 'green']}
            enableSystem={true}
            storageKey="peace-rss-theme"
          >
            <header
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 1000,
              }}
            >
              <SignedOut>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <SignInButton />
                  <SignUpButton />
                </div>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </header>
            <SignedOut>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '100vh',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <h1>Peace RSS</h1>
                <p>Please sign in to continue</p>
              </div>
            </SignedOut>
            <SignedIn>
              <main>{children}</main>
            </SignedIn>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
