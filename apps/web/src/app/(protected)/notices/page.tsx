'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Pin, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Notice {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  publishedAt: string;
  expiresAt?: string | null;
}

function NoticeCard({ notice }: { notice: Notice }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl bg-white shadow-sm ring-1 transition ${
        notice.pinned ? 'ring-blue-200' : 'ring-gray-100'
      }`}
    >
      <button
        className="flex w-full items-start gap-4 px-5 py-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
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
          <div className="flex items-center gap-2 flex-wrap">
            {notice.pinned && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Pinned
              </span>
            )}
            <h3 className="text-sm font-semibold text-gray-900">{notice.title}</h3>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar className="h-3 w-3" />
            {new Date(notice.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            {notice.expiresAt && (
              <span>
                · Expires{' '}
                {new Date(notice.expiresAt).toLocaleDateString('en-US')}
              </span>
            )}
          </div>
          {!expanded && (
            <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">{notice.content}</p>
          )}
        </div>

        <div className="ml-2 flex-shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="prose prose-sm max-w-none text-sm text-gray-700 whitespace-pre-wrap">
            {notice.content}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NoticesPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['notices', page],
    queryFn: () =>
      apiClient.get<{ items: Notice[]; total: number }>(
        `/notices?page=${page}&limit=${limit}`,
      ),
  });

  const notices = Array.isArray(data) ? data : (data as any)?.items ?? [];
  const total = (data as any)?.total ?? notices.length;
  const totalPages = Math.ceil(total / limit);

  const sorted = [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Notices & Announcements</h1>
        <p className="mt-1 text-sm text-gray-500">Latest company notices and event announcements</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Bell className="mb-3 h-12 w-12" />
          <p className="text-sm">No notices available</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {sorted.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
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
