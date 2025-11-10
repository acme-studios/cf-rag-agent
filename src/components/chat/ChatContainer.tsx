/**
 * Chat Container Component
 * 
 * Complete chat interface with messages and input.
 */

import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Alert } from '../ui/Alert';
import { Spinner } from '../ui/Spinner';

interface Citation {
  filename: string;
  page?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

/**
 * Complete chat interface
 * 
 * Features:
 * - Message list with auto-scroll
 * - Streaming support
 * - Error display
 * - Loading states
 * - Empty state
 * 
 * Usage:
 * <ChatContainer
 *   messages={messages}
 *   onSendMessage={handleSend}
 *   isLoading={loading}
 *   isStreaming={streaming}
 *   error={error}
 * />
 */
export function ChatContainer({
  messages,
  onSendMessage,
  isLoading = false,
  isStreaming = false,
  error,
  onClearError
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);
  
  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Error Alert */}
        {error && (
          <div className="p-4">
            <Alert variant="error" title="Error" onDismiss={onClearError}>
              {error}
            </Alert>
          </div>
        )}
        
        {/* Empty State */}
        {messages.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-slate-500 to-slate-700 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Welcome to RAG Agent
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
              Upload documents and ask questions about them. I'll search through your documents and provide accurate answers with citations.
            </p>
          </div>
        )}
        
        {/* Messages */}
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={message.content}
            citations={message.citations}
            isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
          />
        ))}
        
        {/* Loading Indicator */}
        {isLoading && !isStreaming && (
          <div className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-800/50">
            <div className="shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-slate-500 to-slate-700 flex items-center justify-center">
              <Spinner size="sm" className="text-white" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Thinking...</span>
            </div>
          </div>
        )}
        
        {/* Scroll Anchor */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading}
        placeholder="Ask about your documents..."
      />
    </div>
  );
}
