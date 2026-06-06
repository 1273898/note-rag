# NoteRAG - Personal Notes Q&A with Traceable Citations

A RAG (Retrieval-Augmented Generation) + Agent system that lets users upload personal notes and ask questions with every answer grounded in source documents and fully traceable.

## What I Built

NoteRAG is a full-stack web application that enables users to:

1. **Upload personal notes** (.txt, .md files) via a drag-and-drop interface
2. **Ask questions** in a chat interface and get answers grounded in their notes
3. **Trace every claim** back to its source with clickable citations that show the exact passage, file name, chunk index, character range, and relevance score

**Architecture:**
- **Frontend:** Next.js App Router with React, Tailwind CSS
- **Backend:** Next.js API Routes with streaming responses
- **Retrieval:** BM25 text search (no external embedding API needed)
- **LLM:** Xiaomi MiMo v2.5 Pro via Anthropic-compatible API
- **Vector Store:** In-memory store with JSON file persistence and BM25 scoring
- **Chunking:** 500-character chunks with 100-character overlap for context preservation

**How it works:**
1. Documents are split into overlapping chunks and tokenized (supporting Chinese + English)
2. When a question is asked, BM25 ranks chunks by keyword relevance
3. Top 5 relevant chunks are injected into the LLM prompt as context
4. The LLM generates an answer with mandatory `[Source N]` citations
5. Sources are returned alongside the streaming response for the citation panel

## What I Chose Not to Build, and Why

- **Authentication/multi-user:** Skipped to focus on the core RAG experience. Adding auth would be straightforward with NextAuth.js but doesn't demonstrate the key differentiator (grounded answers with honest citations).
- **PDF/DOCX support:** Kept to .txt and .md to avoid heavy dependencies. The upload mechanism is extensible.
- **Dense vector search:** Used BM25 instead of embedding-based search because the LLM provider (Xiaomi MiMo) doesn't offer an embeddings API. BM25 works well for personal note collections and avoids external API dependencies for retrieval.
- **Re-ranking / hybrid search:** Basic BM25 works well for personal note collections. Cross-encoder re-ranking would help at scale but adds complexity without proportional benefit for small collections.

## What I'd Do Differently With 3 More Days

1. **Add hybrid search** — combine BM25 with dense vectors (using a local embedding model) for better recall on both keyword and semantic queries.
2. **Implement document-level citation highlighting** — instead of just showing the chunk, highlight the exact passage within the original document view, giving users a true "show me where" experience.
3. **Add evaluation metrics** — build a test set of question-answer pairs from sample notes and measure citation accuracy (does the cited text actually support the claim?) to systematically improve retrieval and prompting.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your API credentials to .env.local
npm run dev
```

## Environment Variables

- `ANTHROPIC_AUTH_TOKEN` - Required. API auth token for the LLM.
- `ANTHROPIC_BASE_URL` - Required. Base URL for the Anthropic-compatible API.
