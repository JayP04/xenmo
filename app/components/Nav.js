// app/components/Nav.js
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', label: 'Home', icon: '⬡' },
  { href: '/send', label: 'Send', icon: '↗' },
  { href: '/scan', label: 'Scan', icon: '⊞' },
  { href: '/request', label: 'Request', icon: '↙' },
  { href: '/history', label: 'History', icon: '☰' },
];

export default function Nav() {
  const pathname = usePathname();

  // Hide nav on landing page
  if (pathname === '/') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom" style={{ background: '#1C1C1E', borderTop: '1px solid #2C2C2E' }}>
      <div className="max-w-md mx-auto flex justify-around py-2 px-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center px-3 py-1 text-xs transition-colors ${
                active ? 'text-[#0A84FF] font-semibold' : 'text-[#8E8E93]'
              }`}
            >
              <span className="text-lg mb-0.5">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
