/**
 * Chat Input Component
 * 
 * Message input with send button and auto-resize.
 */

import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { Button } from '../ui/Button';
import { clsx } from 'clsx';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Chat input with auto-resize
 * 
 * Features:
 * - Auto-resizing textarea
 * - Enter to send, Shift+Enter for new line
 * - Send button
 * - Disabled state
 * 
 * Usage:
 * <ChatInput
 *   onSend={handleSendMessage}
 *   disabled={isLoading}
 *   placeholder="Ask about your documents..."
 * />
 */
export function ChatInput({ 
  onSend, 
  disabled = false,
  placeholder = 'Ask about your documents...'
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize textarea and show scrollbar only when needed
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset to base height first
      textarea.style.height = '52px';
      
      // Only grow if content is larger
      if (textarea.scrollHeight > 52) {
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${newHeight}px`;
      }
      
      // Show scrollbar only when content exceeds max height
      if (textarea.scrollHeight > 200) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [message]);
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;
    
    onSend(trimmedMessage);
    setMessage('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="p-4">
        <div className="flex gap-3 items-end">
          {/* Textarea */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={clsx(
                'w-full px-4 py-3 rounded-lg resize-none',
                'bg-gray-50 dark:bg-gray-800',
                'border border-gray-200 dark:border-gray-700',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'text-gray-900 dark:text-gray-100',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
                'overflow-y-hidden'
              )}
              style={{ 
                maxHeight: '200px',
                minHeight: '52px',
                height: '52px'
              }}
            />
          </div>
          
          {/* Send Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={disabled || !message.trim()}
            leftIcon={<PaperPlaneTilt size={20} weight="fill" />}
            className="shrink-0 h-[52px]"
          >
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
