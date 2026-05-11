'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Building2,
  Bell,
  Users,
  LogOut,
  Menu,
  X,
  FileStack,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { label: 'Departments', href: '/departments', icon: Building2 },
  { label: 'Documents', href: '/documents', icon: FileStack },
  { label: 'Notices', href: '/notices', icon: Bell },
];

const superAdminItems = [
  { label: 'Users', href: '/users', icon: Users },
];

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const adminRoles = ['DEPT_EDITOR', 'DEPT_ADMIN', 'SUPER_ADMIN'];
    if (!adminRoles.includes(user.role)) {
      router.replace('/login');
    }
  }, [user, hasHydrated, router]);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore
    }
    logout();
    router.push('/login');
  };

  if (!hasHydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const allNavItems = isSuperAdmin ? [...navItems, ...superAdminItems] : navItems;

  const roleLabels: Record<string, string> = {
    DEPT_EDITOR: 'Dept Editor',
    DEPT_ADMIN: 'Dept Admin',
    SUPER_ADMIN: 'Super Admin',
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-white shadow-lg transition-transform lg:relative lg:translate-x-0 lg:shadow-none lg:border-r lg:border-gray-100 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">Admin Console</div>
            <div className="text-xs text-gray-400">Company Intranet</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-gray-400 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
              {user.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900">{user.name}</div>
              <div className="truncate text-xs text-gray-400">
                {roleLabels[user.role] || user.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-100 bg-white px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold text-gray-700">
            {allNavItems.find((i) => pathname.startsWith(i.href))?.label || 'Admin Console'}
          </h1>
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{user.name}</span>
            <span className="ml-2 text-xs text-gray-400">
              {roleLabels[user.role] || user.role}
            </span>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
