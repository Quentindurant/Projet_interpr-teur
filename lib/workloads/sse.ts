// Parsing d'un flux SSE au format "chat completion" (OpenAI et API compatibles).
// Les événements sont séparés par une ligne vide ("\n\n").

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "finish"; reason: string }
  | { type: "done" };

interface Choice {
  delta: { content?: string };
  finish_reason: string | null;
}

interface ChatCompletionChunk {
  choices: Choice[];
}

const DATA_PREFIX = "data: ";

function parseEvent(raw: string): StreamEvent | null {
  let payload = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith(DATA_PREFIX)) payload += line.slice(DATA_PREFIX.length);
  }
  if (payload === "") return null; // commentaire ou keep-alive
  if (payload === "[DONE]") return { type: "done" };
  const choice = (JSON.parse(payload) as ChatCompletionChunk).choices[0];
  if (choice.finish_reason) return { type: "finish", reason: choice.finish_reason };
  return { type: "token", text: choice.delta.content ?? "" };
}

export interface SseParser {
  /** Ajoute un morceau du flux et renvoie les événements désormais complets. */
  push(chunk: string): StreamEvent[];
}

export function createSseParser(): SseParser {
  let buffer = "";
  return {
    push(chunk) {
      buffer += chunk;
      const events: StreamEvent[] = [];
      for (let end = buffer.indexOf("\n\n"); end !== -1; end = buffer.indexOf("\n\n")) {
        const event = parseEvent(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (event) events.push(event);
      }
      return events;
    },
  };
}

const frame = (choice: Choice) =>
  `data: ${JSON.stringify({ id: "chatcmpl-bench", object: "chat.completion.chunk", choices: [{ index: 0, ...choice }] })}\n\n`;

/** Construit le flux complet : un événement par token, le motif de fin, puis [DONE]. */
export function buildSseStream(tokens: readonly string[]): string {
  const frames = tokens.map((text) => frame({ delta: { content: text }, finish_reason: null }));
  frames.push(frame({ delta: {}, finish_reason: "stop" }), "data: [DONE]\n\n");
  return frames.join("");
}

/** Découpe en morceaux de taille aléatoire, comme des paquets réseau : un événement peut être coupé en deux. */
export function splitRandomly(text: string, rand: () => number, minSize: number, maxSize: number): string[] {
  const chunks: string[] = [];
  for (let at = 0; at < text.length; ) {
    const size = minSize + Math.floor(rand() * (maxSize - minSize + 1));
    chunks.push(text.slice(at, at + size));
    at += size;
  }
  return chunks;
}
