import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface DocumentChunk {
  id: string;
  content: string;
  tokens: string[];
  metadata: {
    fileName: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'vector-store.json');

// Simple tokenizer for Chinese + English
function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  // Split on non-alphanumeric/CJK boundaries, keep CJK chars as individual tokens
  const tokens: string[] = [];
  let buf = '';
  for (const ch of lower) {
    if (ch >= '一' && ch <= '鿿') {
      // CJK character - emit as its own token
      if (buf) { tokens.push(buf); buf = ''; }
      tokens.push(ch);
    } else if (/[a-z0-9]/.test(ch)) {
      buf += ch;
    } else {
      if (buf) { tokens.push(buf); buf = ''; }
    }
  }
  if (buf) tokens.push(buf);
  return tokens.filter(t => t.length > 0);
}

// BM25 scoring
const K1 = 1.5;
const B = 0.75;

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDl: number,
  N: number,
  df: Map<string, number>
): number {
  const tf = new Map<string, number>();
  for (const t of docTokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  const dl = docTokens.length;
  let score = 0;
  for (const qt of queryTokens) {
    const docFreq = tf.get(qt) || 0;
    if (docFreq === 0) continue;
    const docCount = df.get(qt) || 1;
    const idf = Math.log((N - docCount + 0.5) / (docCount + 0.5) + 1);
    const tfNorm = (docFreq * (K1 + 1)) / (docFreq + K1 * (1 - B + B * (dl / avgDl)));
    score += idf * tfNorm;
  }
  return score;
}

class VectorStore {
  private chunks: DocumentChunk[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const data = fs.readFileSync(STORE_FILE, 'utf-8');
        this.chunks = JSON.parse(data);
      }
    } catch {
      this.chunks = [];
    }
  }

  private save() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(this.chunks, null, 2));
  }

  addChunks(chunks: DocumentChunk[]) {
    this.chunks.push(...chunks);
    this.save();
  }

  search(query: string, topK: number = 5): SearchResult[] {
    if (this.chunks.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // Build document frequency map
    const df = new Map<string, number>();
    let totalLen = 0;
    for (const chunk of this.chunks) {
      totalLen += chunk.tokens.length;
      const unique = new Set(chunk.tokens);
      for (const t of unique) {
        df.set(t, (df.get(t) || 0) + 1);
      }
    }
    const avgDl = totalLen / this.chunks.length;
    const N = this.chunks.length;

    const results: SearchResult[] = this.chunks.map(chunk => ({
      chunk,
      score: bm25Score(queryTokens, chunk.tokens, avgDl, N, df),
    }));

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  getChunksByFileName(fileName: string): DocumentChunk[] {
    return this.chunks.filter(c => c.metadata.fileName === fileName);
  }

  removeByFileName(fileName: string) {
    this.chunks = this.chunks.filter(c => c.metadata.fileName !== fileName);
    this.save();
  }

  getAllFileNames(): string[] {
    return [...new Set(this.chunks.map(c => c.metadata.fileName))];
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  clear() {
    this.chunks = [];
    this.save();
  }
}

let store: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!store) {
    store = new VectorStore();
  }
  return store;
}

export { tokenize };
