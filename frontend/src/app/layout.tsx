import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';
import './globals.sass';
import '@/styles/vars.sass';
import { ThemeProvider } from '@/components/ThemeProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Peace RSS',
  description: 'Read your news in peace',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignInUrl="/" afterSignUpUrl="/">
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
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
            <SignedIn>{children}</SignedIn>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
