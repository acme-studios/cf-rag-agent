/**
 * RAG Agent Application
 * 
 * Main application component that integrates:
 * - Document management (upload, list, delete)
 * - Chat interface with streaming responses
 * - Session management
 * - Theme toggle
 * 
 * This uses our beautiful atomic UI components and connects to the backend.
 */

import { useEffect, useState } from 'react';
import { useAgent } from 'agents/react';
import { useAgentChat } from 'agents/ai-react';
import type { UIMessage } from '@ai-sdk/react';

// Layout components
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { TwoColumnLayout } from './components/layout/TwoColumnLayout';

// Document components
import { DocumentsPanel } from './components/docs/DocumentsPanel';

// Chat components
import { ChatContainer } from './components/chat/ChatContainer';

// Session management
import { getSessionId } from './utils/sessionId';

// Types
type ProcessingStatus = 'uploading' | 'processing' | 'ready' | 'error';
type ProcessingStep = 'uploading' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'complete';

interface Document {
  id: string;
  filename: string;
  status: ProcessingStatus;
  currentStep?: ProcessingStep;
  progress?: number;
  totalChunks?: number;
  errorMessage?: string;
}

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

/**
 * Main App Component
 */
export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  
  // Session state
  const [sessionId, setSessionId] = useState<string>('');
  
  // Document state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  
  // Initialize session
  useEffect(() => {
    const id = getSessionId();
    setSessionId(id);
    console.log('[APP] Session initialized:', id);
  }, []);
  
  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Initialize agent
  const agent = useAgent({
    agent: 'chat'
  });
  
  // Agent chat hook
  const {
    messages: agentMessages,
    sendMessage,
    status
  } = useAgentChat<unknown, UIMessage>({
    agent
  });
  
  // Convert agent messages to our format
  useEffect(() => {
    const converted: Message[] = agentMessages.map((msg) => {
      // Extract text content
      let content = '';
      const citations: Citation[] = [];
      
      if (msg.parts) {
        for (const part of msg.parts) {
          if (part.type === 'text') {
            content += part.text;
          }
          // TODO: Extract citations from tool results in Phase 4
        }
      }
      
      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content,
        citations: citations.length > 0 ? citations : undefined
      };
    });
    
    setMessages(converted);
  }, [agentMessages]);
  
  // Toggle theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };
  
  // Handle file upload
  const handleUpload = async (file: File) => {
    console.log('[APP] Uploading file:', file.name);
    setIsUploading(true);
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload to backend API
      console.log('[APP] Uploading to API...');
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'x-session-id': sessionId
        },
        body: formData
      });
      
      const uploadResult = await uploadResponse.json() as any;
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }
      
      console.log('[APP] Upload successful:', uploadResult.documentId);
      
      // Add document to list with processing status
      const newDoc: Document = {
        id: uploadResult.documentId,
        filename: uploadResult.filename,
        status: 'processing',
        currentStep: 'uploading',
        progress: 10
      };
      
      setDocuments(prev => [newDoc, ...prev]);
      
      // Start polling for progress
      pollDocumentStatus(uploadResult.documentId);
      
      setIsUploading(false);
      
    } catch (error) {
      console.error('[APP] Upload error:', error);
      setIsUploading(false);
      
      // Add error document to list
      const errorDoc: Document = {
        id: `error-${Date.now()}`,
        filename: file.name,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Upload failed'
      };
      
      setDocuments(prev => [errorDoc, ...prev]);
    }
  };
  
  // Poll document status for real-time progress updates
  const pollDocumentStatus = async (documentId: string) => {
    console.log('[APP] Starting status polling for:', documentId);
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`, {
          headers: {
            'x-session-id': sessionId
          }
        });
        
        const result = await response.json() as any;
        
        if (!result.success) {
          console.error('[APP] Status check failed:', result.error);
          return;
        }
        
        const doc = result.document;
        console.log('[APP] Status update:', doc.status, doc.progress);
        
        // Update document in state
        setDocuments(prev => prev.map(d => 
          d.id === documentId 
            ? {
                ...d,
                status: doc.status,
                currentStep: doc.progress?.step || d.currentStep,
                progress: doc.progress?.progress || d.progress,
                totalChunks: doc.totalChunks,
                errorMessage: doc.progress?.error
              }
            : d
        ));
        
        // Continue polling if still processing
        if (doc.status === 'processing') {
          setTimeout(poll, 2000); // Poll every 2 seconds
        }
        
      } catch (error) {
        console.error('[APP] Status polling error:', error);
      }
    };
    
    // Start polling
    poll();
  };
  
  // Handle document delete
  const handleDelete = async (id: string) => {
    console.log('[APP] Deleting document:', id);
    
    try {
      // TODO: Implement actual delete in Phase 4
      // For now, just remove from list
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (error) {
      console.error('[APP] Delete error:', error);
    }
  };
  
  // Handle send message
  const handleSendMessage = async (message: string) => {
    console.log('[APP] Sending message:', message);
    setChatError(null);
    
    try {
      await sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: message }]
      });
    } catch (error) {
      console.error('[APP] Send message error:', error);
      setChatError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };
  
  // Clear error
  const handleClearError = () => {
    setChatError(null);
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Navbar */}
      <Navbar 
        sessionId={sessionId} 
        theme={theme} 
        onThemeToggle={toggleTheme}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <TwoColumnLayout
          leftColumn={
            <DocumentsPanel
              documents={documents}
              onUpload={handleUpload}
              onDelete={handleDelete}
              isUploading={isUploading}
            />
          }
          rightColumn={
            <ChatContainer
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={status === 'submitted'}
              isStreaming={status === 'streaming'}
              error={chatError}
              onClearError={handleClearError}
            />
          }
        />
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}
