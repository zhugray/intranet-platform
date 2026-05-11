'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, FileText, Clock, Megaphone, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  description?: string;
}

function StatCard({ title, value, icon: Icon, color, bgColor, description }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
          {description && (
            <p className="mt-1 text-xs text-gray-400">{description}</p>
          )}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgColor}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users-count'],
    queryFn: () => apiClient.get<any>('/users?limit=1'),
    retry: false,
  });

  const { data: docsData } = useQuery({
    queryKey: ['admin', 'docs-count'],
    queryFn: () => apiClient.get<any>('/documents?limit=1&status=APPROVED'),
    retry: false,
  });

  const { data: pendingData } = useQuery({
    queryKey: ['admin', 'pending-count'],
    queryFn: () => apiClient.get<any>('/documents?limit=1&status=PENDING'),
    retry: false,
  });

  const { data: noticesData } = useQuery({
    queryKey: ['admin', 'notices-count'],
    queryFn: () => apiClient.get<any>('/notices?limit=1'),
    retry: false,
  });

  const { data: recentDocs } = useQuery({
    queryKey: ['admin', 'recent-docs'],
    queryFn: () => apiClient.get<any>('/documents?limit=5&status=PENDING'),
    retry: false,
  });

  const totalUsers = usersData?.total ?? (Array.isArray(usersData) ? usersData.length : '—');
  const totalDocs = docsData?.total ?? (Array.isArray(docsData) ? docsData.length : '—');
  const pendingDocs = pendingData?.total ?? (Array.isArray(pendingData) ? pendingData.length : '—');
  const totalNotices = noticesData?.total ?? (Array.isArray(noticesData) ? noticesData.length : '—');

  const pendingList = Array.isArray(recentDocs)
    ? recentDocs
    : recentDocs?.items ?? [];

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Platform overview</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={Users}
          color="text-blue-600"
          bgColor="bg-blue-50"
          description="Registered users"
        />
        <StatCard
          title="Published Documents"
          value={totalDocs}
          icon={FileText}
          color="text-green-600"
          bgColor="bg-green-50"
          description="Approved documents"
        />
        <StatCard
          title="Pending Review"
          value={pendingDocs}
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-50"
          description="Awaiting approval"
        />
        <StatCard
          title="Published Notices"
          value={totalNotices}
          icon={Megaphone}
          color="text-purple-600"
          bgColor="bg-purple-50"
          description="All notices"
        />
      </div>

      {/* Recent Pending Docs */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">Latest Pending Documents</h2>
          </div>
          {pendingDocs > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {pendingDocs} pending
            </span>
          )}
        </div>

        {pendingList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <TrendingUp className="mb-2 h-8 w-8" />
            <p className="text-sm">No pending documents</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pendingList.map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{doc.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {doc.department?.name || 'Unknown Dept'} ·{' '}
                    {new Date(doc.createdAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <span className="ml-4 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Pending
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
