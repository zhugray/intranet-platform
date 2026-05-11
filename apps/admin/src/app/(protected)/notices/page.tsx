'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Pin,
  Plus,
  Trash2,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Notice {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  publishedAt: string;
  expiresAt?: string | null;
  author?: { name: string };
}

interface NoticeFormData {
  title: string;
  content: string;
  pinned: boolean;
}

export default function AdminNoticesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NoticeFormData>({ title: '', content: '', pinned: false });
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-notices', page],
    queryFn: () =>
      apiClient.get<{ items: Notice[]; total: number }>(
        `/notices?page=${page}&limit=${limit}`,
      ),
  });

  const createMutation = useMutation({
    mutationFn: (data: NoticeFormData) => apiClient.post('/notices', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notices'] });
      setShowForm(false);
      setForm({ title: '', content: '', pinned: false });
      setError('');
    },
    onError: (err: any) => setError(err.message || 'Publish failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-notices'] }),
    onError: (err: any) => alert(err.message || 'Delete failed'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Notice title is required');
    if (!form.content.trim()) return setError('Notice content is required');
    createMutation.mutate(form);
  };

  const notices = Array.isArray(data) ? data : (data as any)?.items ?? [];
  const total = (data as any)?.total ?? notices.length;
  const totalPages = Math.ceil(total / limit);

  const sorted = [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return (
    <div className="px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notices</h1>
          <p className="mt-1 text-sm text-gray-500">{total} notice{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Publish Notice
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Publish New Notice</h3>
            <button
              onClick={() => { setShowForm(false); setError(''); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Notice title"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Notice content"
                rows={6}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinned"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="pinned" className="text-sm text-gray-700">
                Pin this notice
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(''); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {createMutation.isPending ? 'Publishing...' : 'Publish Notice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notice List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl bg-white text-gray-400">
          <Bell className="mb-3 h-12 w-12" />
          <p className="text-sm">No notices yet. Click Publish Notice to add one.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {sorted.map((notice) => (
              <div
                key={notice.id}
                className={`rounded-xl bg-white p-5 shadow-sm ring-1 ${
                  notice.pinned ? 'ring-blue-200' : 'ring-gray-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      notice.pinned ? 'bg-blue-600' : 'bg-gray-100'
                    }`}
                  >
                    {notice.pinned ? (
                      <Pin className="h-4 w-4 text-white" />
                    ) : (
                      <Bell className="h-4 w-4 text-gray-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {notice.pinned && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Pinned
                        </span>
                      )}
                      <h3 className="text-sm font-semibold text-gray-900">{notice.title}</h3>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-gray-600">
                      {notice.content}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(notice.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {notice.author && <span>· {notice.author.name}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm('Delete this notice?')) {
                        deleteMutation.mutate(notice.id);
                      }
                    }}
                    className="ml-2 flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
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
