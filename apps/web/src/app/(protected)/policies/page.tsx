'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Search, Calendar, Building2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'POLICY', label: 'Policies' },
  { value: 'PROCEDURE', label: 'Procedures' },
  { value: 'ANNOUNCEMENT', label: 'Announcements' },
  { value: 'KNOWLEDGE', label: 'Knowledge' },
];

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const categoryColors: Record<string, string> = {
  POLICY: 'bg-blue-100 text-blue-700',
  PROCEDURE: 'bg-purple-100 text-purple-700',
  ANNOUNCEMENT: 'bg-amber-100 text-amber-700',
  KNOWLEDGE: 'bg-green-100 text-green-700',
};

const categoryLabels: Record<string, string> = {
  POLICY: 'Policy',
  PROCEDURE: 'Procedure',
  ANNOUNCEMENT: 'Announcement',
  KNOWLEDGE: 'Knowledge',
};

export default function PoliciesPage() {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['documents', 'policies', category, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search) params.set('q', search);
      params.set('status', 'APPROVED');
      params.set('limit', '50');
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
  };

  const documents = Array.isArray(data) ? data : (data as any)?.items ?? [];

  return (
    <div className="px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Policies & Procedures</h1>
        <p className="mt-1 text-sm text-gray-500">Browse company policies, procedures, and official documents</p>
      </div>

      {/* Search + Filter */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* Category Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              category === cat.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <FileText className="mb-3 h-12 w-12" />
          <p className="text-sm">No documents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc: Document) => (
            <div
              key={doc.id}
              className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    categoryColors[doc.category] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {categoryLabels[doc.category] || doc.category}
                </span>
                <span className="text-xs text-gray-400">{doc.fileType?.toUpperCase()}</span>
              </div>

              <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-gray-900">
                {doc.title}
              </h3>

              {doc.description && (
                <p className="mb-3 line-clamp-2 text-xs text-gray-500">{doc.description}</p>
              )}

              <div className="mt-auto space-y-1.5">
                {doc.department && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Building2 className="h-3.5 w-3.5" />
                    {doc.department.name}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(doc.createdAt)}
                  <span className="ml-1">{formatBytes(doc.fileSize)}</span>
                </div>
              </div>

              {doc.tags && doc.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {doc.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
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
      )}
    </div>
  );
}
