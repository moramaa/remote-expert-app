import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrains = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FieldSync — Remote Expert Platform',
  description: 'Live remote expert assistance for on-site field workers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#0a0f1e] text-zinc-100">
        <Script id="matterport-analytics-rejection-guard" strategy="beforeInteractive">
          {`
            window.addEventListener('unhandledrejection', function(event) {
              var reason = event && event.reason;
              var isMatterportAnalyticsNetworkFailure =
                reason &&
                typeof reason === 'object' &&
                reason.status_code === 0;

              if (isMatterportAnalyticsNetworkFailure) {
                event.preventDefault();
                event.stopImmediatePropagation();
              }
            }, true);
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
