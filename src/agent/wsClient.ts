// RAG Agent WebSocket Client
// Handles real-time communication with the backend agent

export type AgentState = {
  sessionId: string;
  messages: { role: "user" | "assistant" | "tool"; content: string; ts: number }[];
  documents?: Array<{
    id: string;
    filename: string;
    status: string;
  }>;
};

/** Tool event shape for RAG tools */
export type ToolEvent =
  | { type: "tool"; tool: "search_documents"; status: "started" | "step" | "done" | "error"; message?: string; result?: unknown }
  | { type: "tool"; tool: "list_documents"; status: "started" | "step" | "done" | "error"; message?: string; result?: unknown }
  | { type: "tool"; tool: "delete_document"; status: "started" | "step" | "done" | "error"; message?: string; result?: unknown };

export class RAGAgentClient {
  private ws: WebSocket | null = null;

  onReady: (s: AgentState) => void = () => {};
  onDelta: (t: string) => void = () => {};
  onDone: () => void = () => {};
  onCleared: () => void = () => {};
  onTool: (evt: ToolEvent) => void = () => {};

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  isConnecting() {
    return this.ws?.readyState === WebSocket.CONNECTING;
  }

  async connect(sessionId: string): Promise<void> {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/agents/chat/${sessionId}`;

    console.log("[RAG WS] connecting", { url, sessionId });
    this.ws = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error("no ws"));
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e: Event) => {
        console.error("[RAG WS] error", e);
        reject(new Error("WebSocket error"));
      };
    });

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        if (msg?.type === "ready") {
          this.onReady(msg.state as AgentState);
          return;
        }
        if (msg?.type === "delta") {
          this.onDelta(String(msg.text ?? ""));
          return;
        }
        if (msg?.type === "done") {
          this.onDone();
          return;
        }
        if (msg?.type === "cleared") {
          this.onCleared();
          return;
        }
        if (msg?.type === "tool") {
          this.onTool(msg as ToolEvent);
          return;
        }
      } catch {
        // ignore malformed frames
      }
    };

    this.ws.onclose = (ev) => {
      console.log("[RAG WS] close", ev.code, ev.reason || "");
    };
    
    this.ws.onerror = (ev) => {
      console.log("[RAG WS] error", ev);
    };
  }

  chat(text: string) {
    this.ws?.send(JSON.stringify({ type: "chat", text }));
  }

  reset() {
    this.ws?.send(JSON.stringify({ type: "reset" }));
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
