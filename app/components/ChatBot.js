// app/components/ChatBot.js
'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function ChatBot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I\'m RemitX Assistant. Ask me anything about sending money internationally.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Hide on landing page
  if (pathname === '/') return null;

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'bot', text: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: 'Sorry, something went wrong.' }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center text-xl transition-colors"
        style={{ background: '#0A84FF', color: '#fff' }}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-4 left-4 sm:left-auto z-50 sm:w-80 h-[28rem] max-h-[70vh] rounded-2xl flex flex-col overflow-hidden card" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div className="px-4 py-3 text-sm font-semibold text-[#F5F5F7]" style={{ background: '#2C2C2E', borderBottom: '1px solid #3A3A3C' }}>
            RemitX Assistant
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
                <span className={`inline-block px-3 py-2 rounded-xl max-w-[85%] ${
                  m.role === 'user'
                    ? 'bg-[#0A84FF] text-white'
                    : 'bg-[#2C2C2E] text-[#F5F5F7]'
                }`}>
                  {m.text}
                </span>
              </div>
            ))}
            {loading && (
              <div className="text-sm text-[#8E8E93] animate-pulse">Thinking...</div>
            )}
          </div>
          <div className="p-2 flex gap-2" style={{ borderTop: '1px solid #2C2C2E' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask anything..."
              className="flex-1 px-3 py-2 rounded-lg text-sm input-field"
            />
            <button
              onClick={send}
              disabled={loading}
              className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 bg-[#0A84FF] text-white"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
