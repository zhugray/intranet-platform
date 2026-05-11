'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Archive,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

type DocStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

const STATUS_TABS: { value: '' | DocStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const statusConfig: Record<
  DocStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  ARCHIVED: { label: 'Archived', color: 'bg-gray-100 text-gray-600', icon: Archive },
};

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
  status: DocStatus;
  fileType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy?: { name: string; email: string };
  tags?: string[];
}

export default function DeptDocsPage() {
  const params = useParams();
  const deptId = params.deptId as string;
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canReview = user?.role === 'DEPT_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [statusFilter, setStatusFilter] = useState<'' | DocStatus>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: dept } = useQuery({
    queryKey: ['department', deptId],
    queryFn: () => apiClient.get<{ id: string; name: string }>(`/departments/${deptId}`),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['docs', deptId, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('deptId', deptId);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));
      return apiClient.get<{ items: Document[]; total: number }>(
        `/documents?${params.toString()}`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', deptId] }),
    onError: (err: any) => alert(err.message || 'Delete failed'),
  });

  const handleDownload = async (docId: string) => {
    try {
      const result = await apiClient.get<{ url: string }>(`/documents/${docId}/download`);
      window.open(result.url, '_blank');
    } catch {
      alert('Download failed');
    }
  };

  const docs = Array.isArray(data) ? data : (data as any)?.items ?? [];
  const total = (data as any)?.total ?? docs.length;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/departments"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Departments
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-900">{dept?.name || deptId}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Documents</h1>
            <p className="mt-1 text-sm text-gray-500">
              {dept?.name} · {total} document{total !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {canReview && (
              <Link
                href={`/${deptId}/review`}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
              >
                <Clock className="h-4 w-4" />
                Review Queue
              </Link>
            )}
            <Link
              href={`/${deptId}/upload`}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Upload Document
            </Link>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              statusFilter === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="mb-2 h-10 w-10" />
            <p className="text-sm">No documents</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Upload Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {docs.map((doc: Document) => {
                    const sc = statusConfig[doc.status] || statusConfig.PENDING;
                    const StatusIcon = sc.icon;
                    return (
                      <tr key={doc.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                {doc.title}
                              </p>
                              {doc.uploadedBy && (
                                <p className="text-xs text-gray-400">{doc.uploadedBy.name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {categoryLabels[doc.category] || doc.category}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc.color}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(doc.createdAt).toLocaleDateString('en-US')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownload(doc.id)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            {canReview && doc.status === 'PENDING' && (
                              <Link
                                href={`/${deptId}/review`}
                                className="rounded p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                                title="Review"
                              >
                                <Clock className="h-3.5 w-3.5" />
                              </Link>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this document?')) {
                                  deleteMutation.mutate(doc.id);
                                }
                              }}
                              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-3">
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
    </div>
  );
}
