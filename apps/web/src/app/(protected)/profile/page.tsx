'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Shield, Building2, Save, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

const roleLabels: Record<string, string> = {
  EMPLOYEE: 'Employee',
  DEPT_EDITOR: 'Dept Editor',
  DEPT_ADMIN: 'Dept Admin',
  SUPER_ADMIN: 'Super Admin',
};

const roleColors: Record<string, string> = {
  EMPLOYEE: 'bg-gray-100 text-gray-700',
  DEPT_EDITOR: 'bg-blue-100 text-blue-700',
  DEPT_ADMIN: 'bg-purple-100 text-purple-700',
  SUPER_ADMIN: 'bg-red-100 text-red-700',
};

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  deptId?: string;
  avatarUrl?: string;
  department?: { id: string; name: string };
  createdAt?: string;
  isActive?: boolean;
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<UserProfile>('/users/me'),
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => apiClient.patch('/users/me', data),
    onSuccess: (updated: any) => {
      qc.invalidateQueries({ queryKey: ['me'] });
      if (user) {
        setUser({ ...user, name: updated.name || name });
      }
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || 'Save failed. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Name cannot be empty');
    updateMutation.mutate({ name: name.trim() });
  };

  const data = profile;

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your personal information</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          {isLoading ? (
            <div className="space-y-3">
              <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-gray-100" />
              <div className="h-4 animate-pulse rounded bg-gray-100" />
              <div className="h-3 animate-pulse rounded bg-gray-100" />
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                {data?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <h2 className="text-lg font-bold text-gray-900">{data?.name}</h2>
              <p className="mt-1 text-sm text-gray-500">{data?.email}</p>
              <div className="mt-3 flex items-center justify-center">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    roleColors[data?.role || ''] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {roleLabels[data?.role || ''] || data?.role}
                </span>
              </div>
              {data?.department && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-gray-500">
                  <Building2 className="h-4 w-4" />
                  {data.department.name}
                </div>
              )}
              {data?.createdAt && (
                <p className="mt-2 text-xs text-gray-400">
                  Joined: {new Date(data.createdAt).toLocaleDateString('en-US')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h3 className="mb-5 text-base font-semibold text-gray-900">Edit Information</h3>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {saved && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              Saved successfully
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Company Email
                <span className="ml-2 text-xs font-normal text-gray-400">(read-only)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={data?.email || ''}
                  readOnly
                  className="w-full rounded-lg border border-gray-100 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-500 outline-none"
                />
              </div>
            </div>

            {/* Role (read-only) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Role
                <span className="ml-2 text-xs font-normal text-gray-400">(contact admin to change)</span>
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={roleLabels[data?.role || ''] || data?.role || ''}
                  readOnly
                  className="w-full rounded-lg border border-gray-100 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-500 outline-none"
                />
              </div>
            </div>

            {/* Department (read-only) */}
            {data?.department && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Department
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={data.department.name}
                    readOnly
                    className="w-full rounded-lg border border-gray-100 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={updateMutation.isPending || isLoading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
