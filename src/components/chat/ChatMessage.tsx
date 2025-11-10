/**
 * Chat Message Component
 * 
 * Individual message bubble with markdown rendering and citations.
 */

import { User, Robot } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx } from 'clsx';

interface Citation {
  filename: string;
  page?: number;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

/**
 * Chat message bubble
 * 
 * Features:
 * - User vs Assistant styling
 * - Markdown rendering
 * - Code syntax highlighting
 * - Citations display
 * - Streaming indicator
 * 
 * Usage:
 * <ChatMessage
 *   role="assistant"
 *   content="Here's the answer..."
 *   citations={[{ filename: "doc.pdf", page: 5 }]}
 *   isStreaming={false}
 * />
 */
export function ChatMessage({ 
  role, 
  content, 
  citations,
  isStreaming 
}: ChatMessageProps) {
  const isUser = role === 'user';
  
  return (
    <div className={clsx(
      'flex gap-3 p-4',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* Avatar */}
      <div className={clsx(
        'shrink-0 w-8 h-8 rounded-full flex items-center justify-center self-start',
        isUser 
          ? 'bg-slate-600 text-white' 
          : 'bg-linear-to-br from-slate-500 to-slate-700 text-white'
      )}>
        {isUser ? (
          <User size={18} weight="fill" />
        ) : (
          <Robot size={18} weight="fill" />
        )}
      </div>
      
      {/* Content */}
      <div className={clsx(
        'flex-1 min-w-0',
        isUser ? 'flex justify-end' : ''
      )}>
        <div className={clsx(
          'rounded-2xl px-4 py-3 inline-block',
          isUser 
            ? 'bg-slate-600 text-white max-w-[80%]' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 max-w-full'
        )}>
          {/* Markdown Content */}
          <div className={clsx(
            'prose prose-sm max-w-none',
            'prose-p:leading-relaxed prose-p:m-0',
            isUser 
              ? 'prose-invert prose-p:text-white' 
              : 'dark:prose-invert',
            'prose-pre:bg-slate-900 prose-pre:text-slate-100',
            'prose-code:text-slate-700 dark:prose-code:text-slate-300',
            'prose-code:bg-slate-100 dark:prose-code:bg-slate-800',
            'prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
            'prose-code:before:content-none prose-code:after:content-none'
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
            
            {/* Streaming Cursor */}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-slate-500 animate-pulse ml-1" />
            )}
          </div>
          
          {/* Citations */}
          {citations && citations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {citations.map((citation, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-xs text-slate-700 dark:text-slate-300"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="font-medium">{citation.filename}</span>
                  {citation.page && (
                    <span className="text-slate-600 dark:text-slate-400">
                      • p.{citation.page}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
