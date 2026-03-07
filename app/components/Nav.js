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

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-md mx-auto flex justify-around py-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center px-3 py-1 text-xs transition-colors ${
                active ? 'text-brand-600 font-semibold' : 'text-gray-400'
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
