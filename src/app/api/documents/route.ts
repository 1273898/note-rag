import { NextRequest, NextResponse } from 'next/server';
import { getVectorStore } from '@/lib/vector-store';

export async function GET() {
  const store = getVectorStore();
  const fileNames = store.getAllFileNames();
  return NextResponse.json({
    documents: fileNames.map(name => ({
      name,
      chunkCount: store.getChunksByFileName(name).length,
    })),
    totalChunks: store.getChunkCount(),
  });
}

export async function DELETE(request: NextRequest) {
  const { fileName } = await request.json();
  const store = getVectorStore();
  store.removeByFileName(fileName);
  return NextResponse.json({ success: true });
}
