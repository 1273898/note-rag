'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Source {
  id: number;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
  startChar: number;
  endChar: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

interface Document {
  name: string;
  chunkCount: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocuments(data.documents || []);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        await fetchDocuments();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileName: string) => {
    await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    await fetchDocuments();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      console.log('Sending chat request...');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      console.log('Got response:', res.status, res.ok);

      if (!res.ok) {
        const errText = await res.text();
        console.error('API error:', errText);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error: ${errText}` },
        ]);
        setIsLoading(false);
        return;
      }

      const sourcesHeader = res.headers.get('X-Sources');
      const sources: Source[] = sourcesHeader
        ? JSON.parse(decodeURIComponent(escape(atob(sourcesHeader))))
        : [];

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', sources }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          assistantContent += text;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: assistantContent,
              sources,
            };
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const highlightCitations = (text: string) => {
    const parts = text.split(/(\[\s*Source\s+\d+\s*\])/gi);
    return parts.map((part, i) => {
      const match = part.match(/\[\s*Source\s+(\d+)\s*\]/i);
      if (match) {
        const sourceNum = parseInt(match[1]);
        return (
          <button
            key={i}
            onClick={() => {
              const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
              const source = lastAssistant?.sources?.find(s => s.id === sourceNum);
              if (source) setSelectedSource(source);
            }}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 cursor-pointer transition-colors"
          >
            [Source {sourceNum}]
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-white border-r border-gray-200 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Documents</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload your notes (.txt, .md)
          </p>
          <label className="mt-3 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-sm font-medium">
            {uploading ? 'Uploading...' : 'Upload Files'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.text"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">
              No documents uploaded yet
            </p>
          ) : (
            documents.map(doc => (
              <div
                key={doc.name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {doc.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {doc.chunkCount} chunks
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.name)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 bg-white flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg mr-3"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">NoteRAG</h1>
          <span className="ml-3 text-sm text-gray-400">
            Ask questions about your notes
          </span>
        </div>

        {/* Chat + Source Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-lg font-medium">Upload notes and start asking questions</p>
                  <p className="text-sm mt-1">Every answer includes traceable citations to your source notes</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.role === 'assistant' ? highlightCitations(msg.content) : msg.content}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-2">Sources:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map(s => (
                            <button
                              key={s.id}
                              onClick={() => setSelectedSource(s)}
                              className={`inline-flex items-center px-2 py-1 text-xs rounded-md transition-colors ${
                                selectedSource?.id === s.id && selectedSource?.fileName === s.fileName
                                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                              }`}
                            >
                              [{s.id}] {s.fileName}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-sm">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 bg-white p-4">
              <form onSubmit={handleSubmit} className="flex space-x-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask a question about your notes..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Source Panel */}
          {selectedSource && (
            <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 text-sm">Source Detail</h3>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                <div>
                  <span className="text-xs text-gray-400">File</span>
                  <p className="text-sm font-medium text-gray-700">{selectedSource.fileName}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Chunk</span>
                  <p className="text-sm text-gray-700">#{selectedSource.chunkIndex}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Character Range</span>
                  <p className="text-sm text-gray-700">
                    {selectedSource.startChar} - {selectedSource.endChar}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Relevance Score</span>
                  <p className="text-sm text-gray-700">{(selectedSource.score * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Content</span>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                    {selectedSource.content}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
