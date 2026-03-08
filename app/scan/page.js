// app/scan/page.js
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../components/WalletProvider';

export default function Scan() {
  const { wallet } = useWallet();
  const router = useRouter();
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedAddress, setScannedAddress] = useState(null);
  const scannerRef = useRef(null);
  const stoppedRef = useRef(false);

  // Navigate after scan via window.location to avoid Next.js Router bugs
  useEffect(() => {
    if (scannedAddress) {
      window.location.href = `/send?to=${encodeURIComponent(scannedAddress)}`;
    }
  }, [scannedAddress]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current && !stoppedRef.current) {
      stoppedRef.current = true;
      scannerRef.current.stop().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!wallet) return;

    let html5QrCode = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;
        stoppedRef.current = false;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: Math.min(250, window.innerWidth - 80), height: Math.min(250, window.innerWidth - 80) } },
          (decodedText) => {
            stopScanner();
            const address = decodedText.trim();
            if (address.startsWith('r') && address.length >= 25) {
              setScannedAddress(address);
            } else {
              setError(`Invalid QR code`);
              setScanning(false);
            }
          },
          () => {}
        );
        setScanning(true);
      } catch (err) {
        setError('Camera access denied or not available.');
      }
    };

    startScanner();

    return () => stopScanner();
  }, [wallet, stopScanner]);

  if (!wallet) return null;

  if (scannedAddress) {
    return (
      <div className="flex items-center justify-center h-screen text-[#8E8E93]">
        Opening send...
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h2 className="text-xl font-bold text-[#F5F5F7] mb-4">Scan QR Code</h2>
      <p className="text-sm text-[#8E8E93] mb-4">Point your camera at the recipient&apos;s QR code.</p>

      <div className="rounded-2xl overflow-hidden mb-4 card" style={{ minHeight: 'min(300px, 50vh)' }}>
        <div id="qr-reader" />
      </div>

      {error && (
        <div className="text-[#FF453A] text-sm p-3 rounded-xl mb-4 card">{error}</div>
      )}

      <button
        onClick={() => router.push('/send')}
        className="w-full py-3 rounded-xl text-sm font-medium text-[#8E8E93] card"
      >
        Enter address manually instead
      </button>
    </div>
  );
}
