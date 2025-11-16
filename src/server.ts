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

import { routeAgentRequest, type Connection, type ConnectionContext } from "agents";
import { RAGAgent } from "./agent/RAGAgent";

// Export workflow for Cloudflare Workers
export { DocumentProcessingWorkflow } from "./workflows/DocumentProcessing";

// Import tool schemas and implementations
import { allRAGToolSchemas } from './tools/ragToolSchemas';
import { 
  searchDocuments, 
  listDocuments, 
  deleteDocument,
  type SearchDocumentsArgs,
  type DeleteDocumentArgs
} from './tools/ragToolImplementations';

// Chat message format for AI model
type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Tool call response from AI
type AiToolCall = {
  function?: { name?: string; arguments?: unknown };
};
type AiPlanResponse = {
  tool_calls?: AiToolCall[];
};

// Message stored in DB
type Msg = { role: "user" | "assistant" | "tool"; content: string; ts: number };

const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

// Helper to check if message is user or assistant
function isUserOrAssistant(m: Msg): m is { role: "user" | "assistant"; content: string; ts: number } {
  return m.role === "user" || m.role === "assistant";
}

// Helper to check if response is a ReadableStream
function isReadableStream(x: unknown): x is ReadableStream<Uint8Array> {
  return !!x && typeof (x as { getReader?: unknown }).getReader === "function";
}

/**
 * Chat Agent - extends RAGAgent with chat message handling
 * 
 * Uses cf-chat-agent pattern: direct Workers AI calls with manual tool orchestration
 * The model decides which tool to use (agentic), we execute the decision
 */
export class Chat extends RAGAgent {
  
  // Override onConnect to load messages from DB (if table exists)
  async onConnect(conn: Connection, ctx: ConnectionContext) {
    console.log("[AGENT] onConnect called");
    await super.onConnect(conn, ctx);
    
    // Initialize schema (creates messages table if needed)
    await this.initializeDatabase();
    
    // Try to load messages from DB if state is empty
    if (!this.state.messages?.length) {
      try {
        const rows = await this.sql<Msg>`SELECT role, content, ts FROM messages ORDER BY ts ASC`;
        this.setState({
          ...this.state,
          messages: rows
        });
      } catch (error) {
        // Table doesn't exist yet, that's okay - it will be created on first message
        console.log("[AGENT] Messages table doesn't exist yet, starting fresh");
      }
    }
    
    // Send ready signal to frontend (cf-chat-agent pattern)
    conn.send(JSON.stringify({ type: "ready", state: this.state }));
    console.log("[AGENT] Sent ready signal to frontend");
  }

  // Handle HTTP requests (for get-messages endpoint)
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle get-messages endpoint
    if (url.pathname.endsWith('/get-messages')) {
      console.log("[AGENT] get-messages request");
      
      try {
        // Return messages array directly (frontend expects array, not object)
        const messages = this.state.messages || [];
        console.log("[AGENT] Returning", messages.length, "messages");
        if (messages.length > 0) {
          console.log("[AGENT] Last message:", JSON.stringify(messages[messages.length - 1]).substring(0, 200));
        }
        return Response.json(messages);
      } catch (error) {
        console.error("[AGENT] Error getting messages:", error);
        return Response.json([]);
      }
    }
    
    // Default response for other requests
    return new Response("Not found", { status: 404 });
  }
  
  // Main chat handler - processes user messages and executes tools
  async #handleChatMessage(conn: Connection, userText: string) {
    console.log("[AGENT] User message:", userText);

    // Save user message
    const now = Date.now();
    await this.sql`INSERT INTO messages (role, content, ts) VALUES ('user', ${userText}, ${now})`;
    const userMsg: Msg = { role: "user", content: userText, ts: now };

    this.setState({
      ...this.state,
      messages: [...this.state.messages, userMsg]
    });

    // Get recent conversation history (last 40 messages, user/assistant only)
    const recentUA = this.state.messages.slice(-40).filter(isUserOrAssistant);
    const history: AiChatMessage[] = recentUA.map(({ role, content }) => ({ role, content }));

    // Get available documents for context
    const documentsContext = await this.#getDocumentsContext();

    // PHASE 1: Unified tool planner - let model decide which tool (if any) to use
    console.log("[AGENT] Phase 1: Invoking unified planner for tool selection");
    const toolPlan = await this.#planWithAllTools(history, userText, documentsContext);

    // PHASE 2: Execute tool based on model's decision
    
    // search_documents tool execution
    if (toolPlan?.tool === "search_documents") {
      console.log("[AGENT] Phase 2: Executing search_documents based on model decision");
      await this.#executeSearchDocuments(conn, toolPlan.args as SearchDocumentsArgs, history, userText);
      return;
    }

    // list_documents tool execution
    if (toolPlan?.tool === "list_documents") {
      console.log("[AGENT] Phase 2: Executing list_documents based on model decision");
      await this.#executeListDocuments(conn);
      return;
    }

    // delete_document tool execution
    if (toolPlan?.tool === "delete_document") {
      console.log("[AGENT] Phase 2: Executing delete_document based on model decision");
      await this.#executeDeleteDocument(conn, toolPlan.args as DeleteDocumentArgs);
      return;
    }

    // PHASE 3: No tool needed, just chat
    console.log("[AGENT] Phase 3: No tool selected, proceeding with regular chat");
    
    const system = 
      "You are a helpful RAG assistant. Keep replies concise and friendly.\n\n" +
      documentsContext + "\n\n" +
      "You can help users:\n" +
      "- Search and summarize their uploaded documents\n" +
      "- List available documents\n" +
      "- Answer questions about document content\n" +
      "- Delete documents when requested\n\n" +
      "For this message, just have a natural conversation. If they ask about documents, mention what's available above.";
    
    const payload: AiChatMessage[] = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: userText },
    ];
    
    await this.#streamAssistant(conn, payload);
  }

  // WebSocket message handler (for direct WebSocket connections)
  async onMessage(conn: Connection, message: string | ArrayBuffer | ArrayBufferView) {
    console.log("[AGENT] onMessage called, message type:", typeof message);
    
    if (typeof message !== "string") {
      console.log("[AGENT] Message is not a string, ignoring");
      return;
    }

    console.log("[AGENT] Raw message:", message.substring(0, 200));

    let data: any = null;
    try { data = JSON.parse(message); } catch (e) { 
      console.log("[AGENT] Failed to parse message as JSON:", e);
      return;
    }
    
    console.log("[AGENT] Parsed data type:", data?.type);
    
    // Handle Agents SDK format (cf_agent_use_chat_request)
    if (data?.type === "cf_agent_use_chat_request") {
      console.log("[AGENT] Handling SDK chat request");
      
      try {
        // Parse the body which contains the actual message
        const body = JSON.parse(data.init.body);
        console.log("[AGENT] SDK body:", body);
        
        // Extract the last user message
        const messages = body.messages || [];
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && lastMessage.role === "user") {
          // Extract text from parts
          let userText = "";
          if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
            for (const part of lastMessage.parts) {
              if (part.type === "text" && part.text) {
                userText += part.text;
              }
            }
          }
          
          if (userText.trim()) {
            console.log("[AGENT] Extracted user text:", userText);
            await this.#handleChatMessage(conn, userText.trim());
          }
        }
      } catch (e) {
        console.error("[AGENT] Error parsing SDK message:", e);
      }
      return;
    }
    
    // Handle simple format (for backwards compatibility)
    if (data?.type === "reset") {
      // Clear all messages
      await this.sql`DELETE FROM messages`;
      this.setState({
        ...this.state,
        messages: []
      });
      conn.send(JSON.stringify({ type: "cleared" }));
      return;
    }

    if (data?.type === "chat") {
      const userText = (data.text || "").trim();
      if (!userText) return;
      await this.#handleChatMessage(conn, userText);
    }
  }


  // Get documents context for tool planning
  async #getDocumentsContext(): Promise<string> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT filename, processing_status
        FROM documents
        WHERE session_id = ?
        ORDER BY upload_timestamp DESC
        LIMIT 10
      `).bind(this.state.sessionId).all();

      if (!result.results.length) {
        return "No documents uploaded yet.";
      }

      const docList = result.results
        .map((row: any, i: number) => `${i + 1}. ${row.filename} (${row.processing_status})`)
        .join('\n');
      
      return `Available documents (${result.results.length}):\n${docList}`;
    } catch (error) {
      console.error('[AGENT] Error getting documents context:', error);
      return "No documents available.";
    }
  }

  // Unified tool planner - model decides which tool (if any) to use
  async #planWithAllTools(
    history: AiChatMessage[],
    userText: string,
    documentsContext: string
  ): Promise<{ tool: "search_documents" | "list_documents" | "delete_document"; args: unknown } | null> {
    console.log("[AGENT] Unified planner: evaluating tools for:", userText.slice(0, 60));
    console.log("[AGENT] Documents context:", documentsContext);

    const system =
      "You are a RAG assistant. Analyze the user's request and decide which tool to use.\n\n" +
      documentsContext + "\n\n" +
      "TOOL SELECTION RULES:\n\n" +
      "1. Use 'search_documents' when user asks about DOCUMENT CONTENT:\n" +
      "   - 'summarize the document', 'what's in the PDF?'\n" +
      "   - 'what does it say about X?', 'find information on Y'\n" +
      "   - 'is X mentioned?', 'tell me about Z'\n" +
      "   Extract the key topic as the query parameter.\n\n" +
      "2. Use 'list_documents' when user asks WHAT DOCUMENTS EXIST:\n" +
      "   - 'what documents do you have?', 'show my files', 'list documents'\n" +
      "   - 'what can you access?', 'what files are available?'\n" +
      "   - 'what tools do you have?', 'what can you do?' (they want to see documents)\n" +
      "   - ANY question about available documents or files\n\n" +
      "3. Use 'delete_document' when user wants to DELETE:\n" +
      "   - 'delete the document', 'remove the file'\n\n" +
      "4. Use NO TOOL for:\n" +
      "   - Greetings: 'hello', 'hi', 'hey'\n" +
      "   - General questions NOT about documents\n\n" +
      "IMPORTANT: If user mentions 'documents', 'files', 'tools', or 'access', they likely want list_documents.\n" +
      "Choose ONE tool or NONE.";

    const messages: AiChatMessage[] = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: userText },
    ];

    const payload = {
      messages,
      tools: [...allRAGToolSchemas] as any, // Cast to mutable array for Workers AI
      temperature: 0.1,
      max_tokens: 300
    };

    try {
      const out = await this.env.AI.run(DEFAULT_MODEL, payload);

      if (!out || typeof out !== "object") {
        console.log("[AGENT] Planner: no valid response");
        return null;
      }

      const calls = Array.isArray((out as AiPlanResponse).tool_calls)
        ? (out as AiPlanResponse).tool_calls!
        : [];

      if (!calls.length) {
        console.log("[AGENT] Planner: no tool_calls, no tool needed");
        return null;
      }

      const call = calls[0];
      const toolName = call?.function?.name;

      if (!toolName || !["search_documents", "list_documents", "delete_document"].includes(toolName)) {
        console.log("[AGENT] Planner: invalid tool name:", toolName);
        return null;
      }

      const rawArgs = call?.function?.arguments;
      console.log("[AGENT] Planner: model decided tool:", toolName, "with args:", 
        typeof rawArgs === "string" ? rawArgs.slice(0, 100) : JSON.stringify(rawArgs).slice(0, 100));

      let parsedArgs: unknown = rawArgs;
      if (typeof rawArgs === "string") {
        try {
          parsedArgs = JSON.parse(rawArgs);
        } catch (e) {
          console.log("[AGENT] Planner: failed to parse args:", e instanceof Error ? e.message : String(e));
          parsedArgs = {};
        }
      }

      return { 
        tool: toolName as "search_documents" | "list_documents" | "delete_document", 
        args: parsedArgs 
      };
    } catch (e) {
      console.log("[AGENT] Planner: exception:", e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  // Execute search_documents tool
  async #executeSearchDocuments(
    conn: Connection,
    args: SearchDocumentsArgs,
    history: AiChatMessage[],
    userText: string
  ) {
    const pre = "Let me search through your documents…";
    conn.send(JSON.stringify({ type: "delta", text: pre }));
    conn.send(JSON.stringify({ type: "done" }));
    await this.#saveAssistant(conn, pre);

    conn.send(JSON.stringify({ 
      type: "tool", 
      tool: "search_documents", 
      status: "started", 
      message: "Searching documents..." 
    }));

    try {
      const result = await searchDocuments(args, this);
      
      conn.send(JSON.stringify({ 
        type: "tool", 
        tool: "search_documents", 
        status: "done", 
        message: "Search complete" 
      }));

      // Save tool result
      const toolRow: Msg = {
        role: "tool",
        content: JSON.stringify({ type: "tool_result", tool: "search_documents", result }),
        ts: Date.now(),
      };
      await this.sql`INSERT INTO messages (role, content, ts) VALUES ('tool', ${toolRow.content}, ${toolRow.ts})`;
      this.setState({
        ...this.state,
        messages: [...this.state.messages, toolRow]
      });

      // Generate response with search results
      const system = 
        "You are a RAG assistant. Use the search results below to answer the user's question accurately.\n\n" +
        "IMPORTANT RULES:\n" +
        "1. Base your answer ONLY on the provided search results\n" +
        "2. ALWAYS cite sources using this format: [Source: filename]\n" +
        "3. If results don't contain the answer, say so clearly\n" +
        "4. Keep answers concise but complete\n" +
        "5. Quote relevant excerpts when helpful";
      
      const resultMessage = `Search results:\n\n${result}\n\nUser's question: "${userText}"\n\nAnswer the question using ONLY the search results above. Cite sources clearly.`;

      const messages: AiChatMessage[] = [
        { role: "system", content: system },
        ...history.slice(-4),
        { role: "user", content: resultMessage },
      ];

      await this.#streamAssistant(conn, messages);
    } catch (error) {
      conn.send(JSON.stringify({ 
        type: "tool", 
        tool: "search_documents", 
        status: "error", 
        message: error instanceof Error ? error.message : "Search failed" 
      }));
      
      const errMsg = "I couldn't search the documents. Please try again.";
      conn.send(JSON.stringify({ type: "delta", text: errMsg }));
      conn.send(JSON.stringify({ type: "done" }));
      await this.#saveAssistant(conn, errMsg);
    }
  }

  // Execute list_documents tool
  async #executeListDocuments(conn: Connection) {
    const pre = "Let me check your documents…";
    conn.send(JSON.stringify({ type: "delta", text: pre }));
    conn.send(JSON.stringify({ type: "done" }));
    await this.#saveAssistant(conn, pre);

    try {
      const result = await listDocuments(this);
      
      const summary = result.success && result.documents.length > 0
        ? `You have ${result.documents.length} document(s):\n\n${result.documents.map((d: any, i: number) => 
            `${i + 1}. **${d.filename}** (${d.status}${d.totalChunks ? `, ${d.totalChunks} chunks` : ''})`
          ).join('\n')}`
        : "You don't have any documents uploaded yet.";

      conn.send(JSON.stringify({ type: "delta", text: summary }));
      conn.send(JSON.stringify({ type: "done" }));
      await this.#saveAssistant(conn, summary);
    } catch (error) {
      const errMsg = "I couldn't list the documents. Please try again.";
      conn.send(JSON.stringify({ type: "delta", text: errMsg }));
      conn.send(JSON.stringify({ type: "done" }));
      await this.#saveAssistant(conn, errMsg);
    }
  }

  // Execute delete_document tool
  async #executeDeleteDocument(conn: Connection, args: DeleteDocumentArgs) {
    const pre = "Let me delete that document…";
    conn.send(JSON.stringify({ type: "delta", text: pre }));
    conn.send(JSON.stringify({ type: "done" }));
    await this.#saveAssistant(conn, pre);

    try {
      const result = await deleteDocument(args, this);
      
      const resultText = typeof result === 'string' ? result : JSON.stringify(result);
      conn.send(JSON.stringify({ type: "delta", text: resultText }));
      conn.send(JSON.stringify({ type: "done" }));
      await this.#saveAssistant(conn, result);
    } catch (error) {
      const errMsg = "I couldn't delete the document. Please try again.";
      conn.send(JSON.stringify({ type: "delta", text: errMsg }));
      conn.send(JSON.stringify({ type: "done" }));
      await this.#saveAssistant(conn, errMsg);
    }
  }

  // Stream assistant response
  async #streamAssistant(conn: Connection, messages: AiChatMessage[]) {
    console.log("[AGENT] Starting stream assistant");
    let full = "";
    try {
      console.log("[AGENT] Calling AI.run with model:", DEFAULT_MODEL);
      const out = await this.env.AI.run(DEFAULT_MODEL, { 
        messages, 
        stream: true,
        max_tokens: 2048
      });
      console.log("[AGENT] AI.run returned, checking if stream");

      const stream = isReadableStream(out) ? out : null;
      if (!stream) {
        console.log("[AGENT] Not a stream, got:", typeof out);
        const text = typeof out === "string" ? out : "[no response]";
        conn.send(JSON.stringify({ type: "delta", text }));
        conn.send(JSON.stringify({ type: "done" }));
        await this.#saveAssistant(conn, text);
        return;
      }

      console.log("[AGENT] Got stream, reading...");
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[AGENT] Stream done, total chunks:", chunkCount);
          break;
        }
        chunkCount++;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          for (const line of frame.replace(/\r\n/g, "\n").split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trimStart();
            if (!payload || payload === "[DONE]") continue;

            try {
              const json = JSON.parse(payload) as { response?: string };
              const piece = typeof json?.response === "string" ? json.response : "";
              if (piece) {
                full += piece;
                conn.send(JSON.stringify({ type: "delta", text: piece }));
              }
            } catch {
              full += payload;
              conn.send(JSON.stringify({ type: "delta", text: payload }));
            }
          }
        }
      }
      console.log("[AGENT] Stream complete, full length:", full.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[AGENT] Stream error:", msg, e);
      full = full || "_(stream error)_";
      conn.send(JSON.stringify({ type: "delta", text: full }));
    } finally {
      console.log("[AGENT] Sending done signal");
      conn.send(JSON.stringify({ type: "done" }));
    }

    await this.#saveAssistant(conn, full);
  }

  // Save assistant message
  async #saveAssistant(_conn: Connection, text: string) {
    const ts = Date.now();
    await this.sql`INSERT INTO messages (role, content, ts) VALUES ('assistant', ${text}, ${ts})`;
    this.setState({
      ...this.state,
      messages: [...this.state.messages, { role: "assistant", content: text, ts }]
    });
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
