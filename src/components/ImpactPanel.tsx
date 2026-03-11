'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface ImpactPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string | null;
  onInitialMessageSent?: () => void;
}

const QUICK_PROMPTS = [
  "What's at risk?",
  "Who's overloaded?",
  "Scenario: delay upline by 2 weeks",
];

export function ImpactPanel({
  isOpen,
  onClose,
  initialMessage,
  onInitialMessageSent,
}: ImpactPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isOpen) initialSentRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !initialMessage || messages.length > 0 || initialSentRef.current) return;
    initialSentRef.current = true;
    onInitialMessageSent?.();
    sendMessage(initialMessage);
  }, [isOpen, initialMessage]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/impact-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
      } else {
        setError(data.error ?? 'Failed to get response');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-xl"
        role="dialog"
        aria-label="Impact analysis chat"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 p-4">
          <h3 className="text-lg font-semibold text-zinc-900">Impact analysis</h3>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && !loading && (
              <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
                <p className="text-sm text-zinc-600">
                  Ask about delays, risks, resource conflicts, or scenario planning.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  E.g. &quot;What would happen if we delayed upline by 2 weeks?&quot;
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`mb-4 ${m.role === 'user' ? 'ml-8' : 'mr-4'}`}
              >
                {m.role === 'user' ? (
                  <div className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white">
                    {m.content}
                  </div>
                ) : (
                  <div className="impact-markdown space-y-2 text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_h1,h2,h3]:text-zinc-900 [&_p]:text-zinc-700 [&_ul]:list-inside [&_ul]:space-y-1 [&_li]:text-zinc-700">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
                <span>Thinking...</span>
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t border-zinc-200 p-4">
            {messages.length === 0 && !loading && (
              <div className="mb-3 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt)}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask a question..."
                rows={2}
                disabled={loading}
                className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50 disabled:text-zinc-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="shrink-0 self-end rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
