'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronRight, ChevronDown, Users } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Department {
  id: string;
  name: string;
  code?: string;
  parentId?: string | null;
  children?: Department[];
  _count?: { users: number };
}

function DeptNode({ dept, level = 0 }: { dept: Department; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = dept.children && dept.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 transition hover:bg-gray-50 ${
          level === 0 ? 'font-semibold text-gray-900' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${12 + level * 20}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-600"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="h-5 w-5 flex-shrink-0" />
        )}

        <Building2
          className={`h-4 w-4 flex-shrink-0 ${
            level === 0 ? 'text-blue-600' : 'text-gray-400'
          }`}
        />

        <span className="flex-1 text-sm">{dept.name}</span>

        {dept.code && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
            {dept.code}
          </span>
        )}

        {dept._count?.users !== undefined && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="h-3.5 w-3.5" />
            {dept._count.users}
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {dept.children!.map((child) => (
            <DeptNode key={child.id} dept={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgPage() {
  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiClient.get<Department[]>('/departments'),
  });

  const buildTree = (depts: Department[]): Department[] => {
    if (!depts || depts.length === 0) return [];
    if (depts[0]?.children !== undefined) return depts;

    const map = new Map<string, Department>();
    const roots: Department[] = [];

    depts.forEach((d) => {
      map.set(d.id, { ...d, children: [] });
    });

    depts.forEach((d) => {
      const node = map.get(d.id)!;
      if (d.parentId && map.has(d.parentId)) {
        map.get(d.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const depts = Array.isArray(departments) ? departments : [];
  const tree = buildTree(depts);

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Organization Chart</h1>
        <p className="mt-1 text-sm text-gray-500">Company department hierarchy</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded bg-gray-100"
                style={{ width: `${70 + Math.random() * 30}%` }}
              />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Building2 className="mb-3 h-12 w-12" />
            <p className="text-sm">No department data available</p>
          </div>
        ) : (
          <div className="p-2">
            {tree.map((dept) => (
              <DeptNode key={dept.id} dept={dept} level={0} />
            ))}
          </div>
        )}
      </div>

      {!isLoading && depts.length > 0 && (
        <p className="mt-4 text-center text-xs text-gray-400">
          {depts.length} department{depts.length !== 1 ? 's' : ''} total
        </p>
      )}
    </div>
  );
}
