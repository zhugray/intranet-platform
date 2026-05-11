'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Library, Download, Search, Calendar, Building2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  department?: { id: string; name: string };
  tags?: string[];
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const fileTypeIcons: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  doc: '📝',
  xlsx: '📊',
  xls: '📊',
  txt: '📃',
  md: '📋',
};

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 24;

  const { data, isLoading } = useQuery({
    queryKey: ['documents', 'library', search, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('category', 'LIBRARY');
      params.set('status', 'APPROVED');
      if (search) params.set('q', search);
      params.set('page', String(page));
      params.set('limit', String(limit));
      return apiClient.get<{ items: Document[]; total: number }>(
        `/documents?${params.toString()}`,
      );
    },
  });

  const handleDownload = async (docId: string) => {
    try {
      const result = await apiClient.get<{ url: string; fileName: string }>(
        `/documents/${docId}/download`,
      );
      window.open(result.url, '_blank');
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const documents = Array.isArray(data) ? data : (data as any)?.items ?? [];
  const total = (data as any)?.total ?? documents.length;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
            <Library className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Library</h1>
            <p className="text-sm text-gray-500">Company knowledge repository</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search library documents..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchInput(''); }}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </form>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Library className="mb-3 h-12 w-12" />
          <p className="text-sm">{search ? 'No documents found' : 'No library documents yet'}</p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-500">{total} document{total !== 1 ? 's' : ''}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {documents.map((doc: Document) => (
              <div
                key={doc.id}
                className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-2xl">
                    {fileTypeIcons[doc.fileType?.toLowerCase()] || '📄'}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    {doc.fileType?.toUpperCase()}
                  </span>
                </div>

                <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-gray-900">
                  {doc.title}
                </h3>

                {doc.description && (
                  <p className="mb-2 line-clamp-2 text-xs text-gray-500">{doc.description}</p>
                )}

                <div className="mt-auto space-y-1">
                  {doc.department && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Building2 className="h-3 w-3" />
                      {doc.department.name}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="h-3 w-3" />
                    {new Date(doc.createdAt).toLocaleDateString('en-US')}
                    <span className="ml-auto">{formatBytes(doc.fileSize)}</span>
                  </div>
                </div>

                {doc.tags && doc.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleDownload(doc.id)}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-600"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
