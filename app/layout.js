// app/layout.js
import './globals.css';
import { WalletProvider } from './components/WalletProvider';
import Nav from './components/Nav';
import ChatBot from './components/ChatBot';

export const metadata = {
  title: 'RemitX — Send Money Anywhere',
  description: 'Cross-border P2P payments on the XRP Ledger',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#161618" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", background: '#161618', color: '#F5F5F7' }}>
        <WalletProvider>
          <main className="max-w-md mx-auto pb-20 min-h-screen">
            {children}
          </main>
          <Nav />
          <ChatBot />
        </WalletProvider>
      </body>
    </html>
  );
}
