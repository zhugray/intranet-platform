// apps/web/src/app/(protected)/knowledge/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, BookOpen, ChevronDown } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Source {
  index: number;
  doc_id: string;
  title: string;
  dept_name: string;
  excerpt: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export default function KnowledgePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hello! I am the company knowledge assistant. I can help you find information about company policies, procedures, and internal documents. How can I help you?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const history = messages
        .filter((m) => m.role !== 'assistant' || m.id !== '0')
        .slice(-6)
        .map((m) => ({
          question: m.role === 'user' ? m.content : '',
          answer: m.role === 'assistant' ? m.content : '',
        }))
        .filter((h) => h.question || h.answer);

      return apiClient.post('/ai/chat', { question, sessionId, history });
    },
    onSuccess: (data) => {
      setSessionId(data.session_id);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, the service is temporarily unavailable. Please try again later.',
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    const q = input.trim();
    if (!q || chatMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        content: q,
        timestamp: new Date(),
      },
    ]);
    setInput('');
    chatMutation.mutate(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const suggestedQuestions = [
    'What is the annual leave policy?',
    'How do I submit an expense claim?',
    'How long is the probation period?',
    'How do I request equipment purchase?',
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AI Knowledge Assistant</h1>
            <p className="text-xs text-gray-500">Powered by company knowledge base</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {chatMutation.isPending && <ThinkingIndicator />}

          {/* Suggested questions (shown initially) */}
          {messages.length === 1 && (
            <div className="grid grid-cols-2 gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 shadow-sm transition hover:border-blue-300 hover:text-blue-600"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question, press Enter to send (Shift+Enter for new line)"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-400">
            AI answers are based on the company knowledge base and for reference only. Contact the relevant department for official guidance.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isUser && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
              AI
            </div>
            <span className="text-xs text-gray-400">Knowledge Assistant</span>
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-100'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showSources ? 'rotate-180' : ''}`} />
              {message.sources.length} reference{message.sources.length > 1 ? 's' : ''}
            </button>

            {showSources && (
              <div className="mt-2 space-y-1">
                {message.sources.map((s) => (
                  <div
                    key={s.doc_id}
                    className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">[{s.index}] {s.title}</span>
                      <span className="text-gray-400">· {s.dept_name}</span>
                    </div>
                    <p className="mt-1 text-gray-500 line-clamp-2">{s.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <span className="text-xs text-gray-400">AI is thinking...</span>
      </div>
    </div>
  );
}
