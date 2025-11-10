/**
 * RAG Agent Server
 * 
 * This file exports the Chat agent (which extends RAGAgent) and handles
 * routing of incoming requests to the agent.
 * 
 * The agent supports:
 * - Session-based document management
 * - Semantic search over uploaded documents
 * - Streaming AI responses with citations
 * - Tool-based interactions (search, list, delete documents)
 */

import { routeAgentRequest } from "agents";
import {
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { processToolCalls, cleanupMessages } from "./utils";
import { RAGAgent } from "./agent/RAGAgent";
import { createWorkersAI } from 'workers-ai-provider';

// Export workflow for Cloudflare Workers
// Note: This file should only be imported server-side
export { DocumentProcessingWorkflow } from "./workflows/DocumentProcessing";

// Import RAG tools
import { ragTools } from './tools/ragTools';

// Combine all tools
const tools = {
  ...ragTools
};
const executions = {};

/**
 * Chat Agent - extends RAGAgent with chat message handling
 * 
 * We keep the name "Chat" to match the Durable Object binding in wrangler.jsonc
 * This class adds the onChatMessage method required by AIChatAgent
 */
export class Chat extends RAGAgent {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        // Create Workers AI instance with Llama 4 Scout
        // This model supports function calling natively
        const workersai = createWorkersAI({ binding: this.env.AI });
        const model = workersai('@cf/meta/llama-4-scout-17b-16e-instruct' as any);

        // Stream AI response with RAG capabilities
        const result = streamText({
          system: `You are a helpful RAG (Retrieval Augmented Generation) assistant with access to the user's uploaded documents.

**Your Capabilities:**
- Search through documents using semantic search (search_documents tool)
- List all uploaded documents (list_documents tool)
- Delete documents when requested (delete_document tool)

**How to Use RAG:**
1. When users ask questions about their documents, ALWAYS use search_documents first
2. Provide answers based on the retrieved content
3. ALWAYS cite sources in your response using the format: [filename, p.X]
4. If no relevant information is found, tell the user clearly

**Document Management:**
- Use list_documents when users ask "what documents do I have?"
- Use delete_document only when explicitly requested by the user
- Confirm before deleting to avoid accidents

**Response Style:**
- Be conversational and helpful
- Always cite your sources with document names and page numbers
- If information isn't in the documents, say so clearly
- Don't make up information - only use what's in the retrieved content

Be accurate, cite sources, and help users get the most value from their documents!`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Document upload endpoint
    if (url.pathname === "/api/upload" && request.method === "POST") {
      const { handleDocumentUpload } = await import("./api/uploadDocument");
      const sessionId = request.headers.get("x-session-id") || "default";
      return handleDocumentUpload(request, env, sessionId);
    }
    
    // Document status endpoint
    if (url.pathname.startsWith("/api/documents/") && request.method === "GET") {
      const { getDocumentStatus } = await import("./api/uploadDocument");
      const documentId = url.pathname.split("/").pop();
      const sessionId = request.headers.get("x-session-id") || "default";
      
      if (!documentId) {
        return Response.json({ success: false, error: "Document ID required" }, { status: 400 });
      }
      
      return getDocumentStatus(documentId, sessionId, env);
    }
    
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
