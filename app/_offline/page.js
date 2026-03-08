'use client';

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="text-6xl mb-6">📡</div>
      <h1 className="text-2xl font-semibold text-[#F5F5F7] mb-3">You're Offline</h1>
      <p className="text-[#8E8E93] text-base mb-8 max-w-xs">
        Check your internet connection and try again. Xenmo needs a connection to process payments.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-[#0A84FF] text-white font-medium rounded-xl active:opacity-80 transition-opacity"
      >
        Try Again
      </button>
    </div>
  );
}
