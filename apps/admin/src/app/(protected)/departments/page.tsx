'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Upload,
  FileText,
  CheckSquare,
  X,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

interface Department {
  id: string;
  name: string;
  code?: string;
  parentId?: string | null;
  children?: Department[];
  _count?: { users: number; documents: number };
}

function DeptRow({
  dept,
  level,
  onEdit,
  onDelete,
  canEdit,
}: {
  dept: Department;
  level: number;
  onEdit: (d: Department) => void;
  onDelete: (d: Department) => void;
  canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = dept.children && dept.children.length > 0;

  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/50">
        <td className="px-4 py-3">
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${level * 20}px` }}
          >
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                />
              </button>
            ) : (
              <span className="w-4" />
            )}
            <Building2 className={`h-4 w-4 ${level === 0 ? 'text-blue-500' : 'text-gray-400'}`} />
            <span className="text-sm font-medium text-gray-900">{dept.name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{dept.code || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{dept._count?.users ?? 0}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{dept._count?.documents ?? 0}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/${dept.id}/upload`}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600"
            >
              <Upload className="h-3 w-3" />
              Upload
            </Link>
            <Link
              href={`/${dept.id}/docs`}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600"
            >
              <FileText className="h-3 w-3" />
              Docs
            </Link>
            <Link
              href={`/${dept.id}/review`}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-amber-300 hover:text-amber-600"
            >
              <CheckSquare className="h-3 w-3" />
              Review
            </Link>
            {canEdit && (
              <>
                <button
                  onClick={() => onEdit(dept)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(dept)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && hasChildren &&
        dept.children!.map((child) => (
          <DeptRow
            key={child.id}
            dept={child}
            level={level + 1}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
          />
        ))}
    </>
  );
}

interface DeptForm {
  name: string;
  code: string;
  parentId: string;
}

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'DEPT_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [form, setForm] = useState<DeptForm>({ name: '', code: '', parentId: '' });
  const [error, setError] = useState('');

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

  const createMutation = useMutation({
    mutationFn: (data: DeptForm) =>
      apiClient.post('/departments', {
        name: data.name,
        code: data.code || undefined,
        parentId: data.parentId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      setShowForm(false);
      setForm({ name: '', code: '', parentId: '' });
      setError('');
    },
    onError: (err: any) => setError(err.message || 'Creation failed'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: DeptForm) =>
      apiClient.patch(`/departments/${editDept?.id}`, {
        name: data.name,
        code: data.code || undefined,
        parentId: data.parentId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      setEditDept(null);
      setForm({ name: '', code: '', parentId: '' });
      setError('');
    },
    onError: (err: any) => setError(err.message || 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
    onError: (err: any) => alert(err.message || 'Delete failed'),
  });

  const handleEdit = (dept: Department) => {
    setEditDept(dept);
    setForm({ name: dept.name, code: dept.code || '', parentId: dept.parentId || '' });
    setShowForm(true);
  };

  const handleDelete = (dept: Department) => {
    if (confirm(`Delete department "${dept.name}"?`)) {
      deleteMutation.mutate(dept.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Department name is required');
    if (editDept) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const buildTree = (items: Department[]): Department[] => {
    if (!items.length) return [];
    if (items[0]?.children !== undefined) return items;
    const map = new Map<string, Department>();
    const roots: Department[] = [];
    items.forEach((d) => map.set(d.id, { ...d, children: [] }));
    items.forEach((d) => {
      const node = map.get(d.id)!;
      if (d.parentId && map.has(d.parentId)) {
        map.get(d.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const tree = buildTree(depts);

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Departments</h1>
          <p className="mt-1 text-sm text-gray-500">{flatDepts.length} department{flatDepts.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditDept(null);
              setForm({ name: '', code: '', parentId: '' });
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Department
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {editDept ? 'Edit Department' : 'New Department'}
            </h3>
            <button
              onClick={() => { setShowForm(false); setEditDept(null); setError(''); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Department Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Engineering"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Department Code
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. TECH"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Parent Department
              </label>
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              >
                <option value="">None (top-level)</option>
                {flatDepts
                  .filter((d) => d.id !== editDept?.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="sm:col-span-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditDept(null); setError(''); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : editDept ? 'Save Changes' : 'Create Department'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Building2 className="mb-2 h-10 w-10" />
            <p className="text-sm">No departments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Members</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Docs</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tree.map((dept) => (
                  <DeptRow
                    key={dept.id}
                    dept={dept}
                    level={0}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    canEdit={canEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
