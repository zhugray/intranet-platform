'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  FileText,
  ArrowLeft,
  Calendar,
  User,
  Download,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const categoryLabels: Record<string, string> = {
  POLICY: 'Policy',
  PROCEDURE: 'Procedure',
  ANNOUNCEMENT: 'Announcement',
  KNOWLEDGE: 'Knowledge',
  LIBRARY: 'Library',
};

interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy?: { id: string; name: string; email: string };
  tags?: string[];
}

interface ReviewCardProps {
  doc: Document;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isLoading: boolean;
}

function ReviewCard({ doc, onApprove, onReject, isLoading }: ReviewCardProps) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  const handleDownload = async () => {
    try {
      const result = await apiClient.get<{ url: string }>(`/documents/${doc.id}/download`);
      window.open(result.url, '_blank');
    } catch {
      alert('Download failed');
    }
  };

  const handleRejectSubmit = () => {
    if (!reason.trim()) return;
    onReject(doc.id, reason);
    setShowReject(false);
    setReason('');
  };

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="p-5">
        {/* Doc Info */}
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
            <FileText className="h-5 w-5 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{doc.title}</h3>
            {doc.description && (
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{doc.description}</p>
            )}
          </div>
          <span className="ml-2 flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {doc.fileType?.toUpperCase()}
          </span>
        </div>

        {/* Meta */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700">
            {categoryLabels[doc.category] || doc.category}
          </span>
          {doc.uploadedBy && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {doc.uploadedBy.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(doc.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span>{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
        </div>

        {doc.tags && doc.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {doc.tags.map((tag) => (
              <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Reject reason input */}
        {showReject && (
          <div className="mb-4 rounded-lg bg-red-50 p-3">
            <label className="mb-1.5 block text-xs font-medium text-red-700">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please enter the rejection reason; the uploader will be notified"
              rows={3}
              className="w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" />
            Preview
          </button>

          <div className="flex-1" />

          {showReject ? (
            <>
              <button
                onClick={() => { setShowReject(false); setReason(''); }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!reason.trim() || isLoading}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                <XCircle className="h-3.5 w-3.5" />
                Confirm Reject
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowReject(true)}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
              <button
                onClick={() => onApprove(doc.id)}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const pathname = usePathname();
  const deptId = useMemo(() => pathname?.split('/').filter(Boolean)[0] ?? '', [pathname]);
  const qc = useQueryClient();

  const { data: dept } = useQuery({
    queryKey: ['department', deptId],
    queryFn: () => apiClient.get<{ id: string; name: string }>(`/departments/${deptId}`),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['docs-review', deptId],
    queryFn: () =>
      apiClient.get<{ items: Document[]; total: number }>(
        `/documents?deptId=${deptId}&status=PENDING&limit=50`,
      ),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
      rejectReason,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      rejectReason?: string;
    }) =>
      apiClient.patch(`/documents/${id}/review`, { status, rejectReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs-review', deptId] });
      qc.invalidateQueries({ queryKey: ['docs', deptId] });
      refetch();
    },
    onError: (err: any) => alert(err.message || 'Operation failed'),
  });

  const docs = Array.isArray(data) ? data : (data as any)?.items ?? [];
  const total = (data as any)?.total ?? docs.length;

  return (
    <div className="px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href={`/${deptId}/docs`}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Documents
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Review Queue</h1>
            <p className="mt-1 text-sm text-gray-500">
              {dept?.name} · {isLoading ? '...' : `${total} pending review`}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl bg-white shadow-sm ring-1 ring-gray-100 text-gray-400">
          <CheckCircle className="mb-3 h-12 w-12 text-green-400" />
          <p className="text-base font-medium text-gray-600">Review Queue Empty</p>
          <p className="mt-1 text-sm">No pending documents at this time</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-700">
              <span className="font-semibold">{total}</span> document{total !== 1 ? 's' : ''} pending review — please verify carefully before taking action
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {docs.map((doc: Document) => (
              <ReviewCard
                key={doc.id}
                doc={doc}
                isLoading={reviewMutation.isPending}
                onApprove={(id) =>
                  reviewMutation.mutate({ id, status: 'APPROVED' })
                }
                onReject={(id, rejectReason) =>
                  reviewMutation.mutate({ id, status: 'REJECTED', rejectReason })
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
