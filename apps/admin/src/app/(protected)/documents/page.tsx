'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Building2, FileText, Upload, CheckSquare, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Department {
  id: string;
  name: string;
  code?: string;
  children?: Department[];
  _count?: { documents: number };
}

function DeptCard({ dept }: { dept: Department }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
          <Building2 className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{dept.name}</h3>
          {dept.code && <p className="text-xs text-gray-400">{dept.code}</p>}
        </div>
        <ChevronRight className="ml-auto h-4 w-4 text-gray-300" />
      </div>

      <div className="flex flex-col gap-2">
        <Link
          href={`/${dept.id}/docs`}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <FileText className="h-4 w-4" />
          View Documents
          {dept._count?.documents !== undefined && (
            <span className="ml-auto text-xs text-gray-400">{dept._count.documents}</span>
          )}
        </Link>
        <Link
          href={`/${dept.id}/upload`}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
        >
          <Upload className="h-4 w-4" />
          Upload Document
        </Link>
        <Link
          href={`/${dept.id}/review`}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
        >
          <CheckSquare className="h-4 w-4" />
          Review Queue
        </Link>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiClient.get<Department[]>('/departments'),
  });

  const depts = Array.isArray(departments) ? departments : [];

  const flatten = (items: Department[], result: Department[] = []): Department[] => {
    items.forEach((item) => {
      result.push(item);
      if (item.children) flatten(item.children, result);
    });
    return result;
  };

  const flatDepts = flatten(depts);

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Documents</h1>
        <p className="mt-1 text-sm text-gray-500">Select a department to view and manage documents</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : flatDepts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Building2 className="mb-3 h-12 w-12" />
          <p className="text-sm">No departments available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flatDepts.map((dept) => (
            <DeptCard key={dept.id} dept={dept} />
          ))}
        </div>
      )}
    </div>
  );
}
