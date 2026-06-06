import { v4 as uuidv4 } from 'uuid';
import { DocumentChunk, tokenize } from './vector-store';

const MAX_CHUNK_SIZE = 500;
const OVERLAP_SENTENCES = 1;

// Split text into sentences, preserving punctuation
function splitIntoSentences(text: string): { sentence: string; start: number; end: number }[] {
  const sentences: { sentence: string; start: number; end: number }[] = [];
  // Match sentences ending with common Chinese/English punctuation, or double newline (paragraph break)
  const re = /[^。！？.!?\n]*[。！？.!?\n]+|[^。！？.!?\n]+(?=\n\n)|[^\n]+(?=\n)|[^\n]+$/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const s = match[0].trim();
    if (s.length > 0) {
      sentences.push({
        sentence: s,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return sentences;
}

function splitText(text: string): { content: string; startChar: number; endChar: number }[] {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return [];

  const chunks: { content: string; startChar: number; endChar: number }[] = [];
  let i = 0;

  while (i < sentences.length) {
    let chunkText = '';
    let chunkStart = sentences[i].start;
    let j = i;

    // Accumulate sentences until we hit MAX_CHUNK_SIZE
    while (j < sentences.length) {
      const candidate = chunkText ? chunkText + sentences[j].sentence : sentences[j].sentence;
      if (candidate.length > MAX_CHUNK_SIZE && chunkText.length > 0) break;
      chunkText = candidate;
      j++;
    }

    // If a single sentence exceeds MAX_CHUNK_SIZE, just take it
    if (j === i) {
      chunkText = sentences[i].sentence;
      j = i + 1;
    }

    const chunkEnd = sentences[j - 1].end;
    if (chunkText.trim().length > 0) {
      chunks.push({ content: chunkText.trim(), startChar: chunkStart, endChar: chunkEnd });
    }

    // Move forward, but keep OVERLAP_SENTENCES from the end for context
    i = Math.max(j - OVERLAP_SENTENCES, i + 1);
  }

  return chunks;
}

export async function processDocument(
  fileName: string,
  content: string
): Promise<DocumentChunk[]> {
  const textChunks = splitText(content);
  if (textChunks.length === 0) return [];

  const chunks: DocumentChunk[] = textChunks.map((chunk, i) => ({
    id: uuidv4(),
    content: chunk.content,
    tokens: tokenize(chunk.content),
    metadata: {
      fileName,
      chunkIndex: i,
      startChar: chunk.startChar,
      endChar: chunk.endChar,
    },
  }));

  return chunks;
}
