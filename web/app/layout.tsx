import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LumenMarket',
  description: 'Permissionless token launchpad on Stellar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold bg-gradient-to-r from-purple to-cyan bg-clip-text text-transparent">
            LumenMarket
          </a>
          <a
            href="/create"
            className="px-4 py-1.5 bg-purple rounded-lg text-sm text-white hover:bg-purple/80 transition"
          >
            + Create
          </a>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
