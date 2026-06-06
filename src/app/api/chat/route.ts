import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getVectorStore } from '@/lib/vector-store';

const client = new OpenAI({
  apiKey: process.env.XIAOMI_API_KEY || 'tp-cngubns681ylty70zi33v3xc59ixstuxnsrjboief458c7sv',
  baseURL: process.env.XIAOMI_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
});

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const lastMessage = messages[messages.length - 1];

    const store = getVectorStore();
    const results = store.search(lastMessage.content, 5);

    const context = results
      .map(
        (r, i) =>
          `[Source ${i + 1}] File: ${r.chunk.metadata.fileName}, Chunk ${r.chunk.metadata.chunkIndex} (chars ${r.chunk.metadata.startChar}-${r.chunk.metadata.endChar})\n${r.chunk.content}`
      )
      .join('\n\n---\n\n');

    const sources = results.map((r, i) => ({
      id: i + 1,
      fileName: r.chunk.metadata.fileName,
      chunkIndex: r.chunk.metadata.chunkIndex,
      content: r.chunk.content,
      score: r.score,
      startChar: r.chunk.metadata.startChar,
      endChar: r.chunk.metadata.endChar,
    }));

    const systemPrompt = `You are a helpful assistant that answers questions based on the user's personal notes. You MUST follow these rules:

1. ONLY answer based on the provided context from the user's notes.
2. Every claim in your answer MUST include a citation in the format [Source N] where N is the source number.
3. If the context doesn't contain enough information to answer the question, say so clearly.
4. Do not make up information that isn't supported by the sources.
5. Be concise but thorough in your answers.

Context from the user's notes:
${context || 'No relevant notes found.'}`;

    const stream = await client.chat.completions.create({
      model: 'mimo-v2.5-pro',
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    });

    const encoder = new TextEncoder();
    const sourcesBase64 = Buffer.from(JSON.stringify(sources)).toString('base64');

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (err) {
          console.error('Stream error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Sources': sourcesBase64,
      },
    });
  } catch (err) {
    console.error('Chat error:', err);
    return new Response(`Server error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}
