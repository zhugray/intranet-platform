'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Shield, Building2, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

type Role = 'EMPLOYEE' | 'DEPT_EDITOR' | 'DEPT_ADMIN' | 'SUPER_ADMIN';

const roleLabels: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  DEPT_EDITOR: 'Dept Editor',
  DEPT_ADMIN: 'Dept Admin',
  SUPER_ADMIN: 'Super Admin',
};

const roleColors: Record<Role, string> = {
  EMPLOYEE: 'bg-gray-100 text-gray-700',
  DEPT_EDITOR: 'bg-blue-100 text-blue-700',
  DEPT_ADMIN: 'bg-purple-100 text-purple-700',
  SUPER_ADMIN: 'bg-red-100 text-red-700',
};

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  department?: { id: string; name: string };
}

export default function UsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      params.set('page', String(page));
      params.set('limit', String(limit));
      return apiClient.get<{ items: User[]; total: number }>(
        `/users?${params.toString()}`,
      );
    },
    enabled: isSuperAdmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiClient.patch(`/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (err: any) => alert(err.message || 'Failed to update role'),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <Shield className="mb-3 h-12 w-12" />
        <p className="text-base font-medium text-gray-600">Access Denied</p>
        <p className="mt-1 text-sm">This page is restricted to Super Admin only</p>
      </div>
    );
  }

  const users = Array.isArray(data) ? data : (data as any)?.items ?? [];
  const total = (data as any)?.total ?? users.length;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">{total} user{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
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

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Users className="mb-2 h-10 w-10" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Joined</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Change Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user: User) => (
                    <tr key={user.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                            {user.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="flex items-center gap-1 text-xs text-gray-400">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.department ? (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                            {user.department.name}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            roleColors[user.role] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {roleLabels[user.role] || user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            user.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-4 py-3">
                        {user.id !== currentUser?.id ? (
                          <select
                            value={user.role}
                            onChange={(e) => {
                              const newRole = e.target.value as Role;
                              if (
                                confirm(
                                  `Change ${user.name}'s role to "${roleLabels[newRole]}"?`,
                                )
                              ) {
                                updateRoleMutation.mutate({ id: user.id, role: newRole });
                              }
                            }}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
                          >
                            {(Object.keys(roleLabels) as Role[]).map((r) => (
                              <option key={r} value={r}>
                                {roleLabels[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400">(current account)</span>
                        )}
                      </td>
                    </tr>
                  ))}
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
