// app/scan/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function Scan() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!wallet) { router.push('/'); return; }

    let html5QrCode = null;

    const startScanner = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // QR decoded — could be an XRPL address (starts with 'r')
            html5QrCode.stop().catch(() => {});
            const address = decodedText.trim();

            if (address.startsWith('r') && address.length >= 25) {
              router.push(`/send?to=${address}`);
            } else {
              setError(`Invalid address: ${address}`);
              setScanning(false);
            }
          },
          () => {} // ignore scan failures
        );
        setScanning(true);
      } catch (err) {
        setError('Camera access denied or not available. Try entering the address manually.');
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [wallet, router]);

  if (!wallet) return null;

  return (
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Scan QR Code</h2>
      <p className="text-sm text-gray-500 mb-4">Point your camera at the recipient's QR code.</p>

      <div className="bg-black rounded-2xl overflow-hidden mb-4" style={{ minHeight: 300 }}>
        <div id="qr-reader" ref={containerRef} />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>
      )}

      <button
        onClick={() => router.push('/send')}
        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
      >
        Enter address manually instead
      </button>
    </div>
  );
}
