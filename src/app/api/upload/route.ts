import { NextRequest, NextResponse } from 'next/server';
import { processDocument } from '@/lib/document-processor';
import { getVectorStore } from '@/lib/vector-store';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const store = getVectorStore();
    const results: { fileName: string; chunks: number }[] = [];

    for (const file of files) {
      const text = await file.text();
      if (!text.trim()) continue;

      // Remove existing chunks for this file
      store.removeByFileName(file.name);

      const chunks = await processDocument(file.name, text);
      store.addChunks(chunks);
      results.push({ fileName: file.name, chunks: chunks.length });
    }

    return NextResponse.json({
      success: true,
      results,
      totalChunks: store.getChunkCount(),
    });
  } catch (error: unknown) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
