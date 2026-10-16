import { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { Send, Bot, User, Sparkles, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

const EXAMPLE_QUESTIONS = [
  'Can I afford a ₹20,000 phone?',
  'How can I reduce my expenses this month?',
  'Am I on track with my category budgets?',
];

export const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: 'Hello! I am your FinSense AI Financial Adviser. I can help evaluate your purchases, review your monthly budgets, and analyze your cash flow.\n\nAsk me any question below, or select an example to get started!\n\nThis is not professional financial advice.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    setError(null);
    setInput('');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: q,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Send the last 5 messages as context (excluding welcome message)
      const contextHistory = updatedMessages
        .filter(m => m.id !== 'welcome')
        .slice(-5)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetchApi('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          history: contextHistory,
        }),
      });

      if (res.answer) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: res.answer,
            timestamp: new Date(),
          },
        ]);
      } else {
        throw new Error(res.error || 'No answer received from adviser');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'Failed to get a response from the AI adviser');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl text-blue-600 dark:text-blue-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Financial Adviser</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Personalized guidance based on your live balances, cash flow, and budgets
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700/60 rounded-tl-none'
                }`}
              >
                {m.content}
                <div
                  className={`text-[10px] mt-2 font-medium ${
                    isUser ? 'text-blue-100 text-right' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400 pl-2">Adviser is reasoning through your finances...</span>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between text-xs text-red-700 dark:text-red-300">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => handleSend()}
              className="flex items-center space-x-1 font-semibold hover:underline text-red-800 dark:text-red-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Example Question Buttons */}
      <div className="py-2">
        <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Try asking:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition disabled:opacity-50 text-left"
            >
              "{q}"
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end space-x-2 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your financial question... (e.g. Can I afford a 20,000 phone?)"
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none resize-none max-h-24 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-1.5">
          FinSense Adviser uses summarized figures. This is not professional financial advice.
        </p>
      </div>
    </div>
  );
};
