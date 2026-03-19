'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function AdminSidebar() {
  const { logout } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 p-6 space-y-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold tracking-wide text-gray-900">ADMIN DASHBOARD</h2>
        <p className="text-xs text-gray-500 mt-1">Manage regattas, notices and content.</p>
      </div>

      <div>
        <Link
          href="/admin/create-regatta"
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          New regatta
        </Link>
      </div>

      <nav className="flex flex-col space-y-1">
        <Link
          href="/admin/manage-regattas"
          className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100"
        >
          Regattas
        </Link>
        <Link href="/admin/news" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
          News
        </Link>
        <Link href="/admin/design" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
          Design
        </Link>
        <Link href="/admin/sponsors" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
          Sponsors
        </Link>
        <Link href="/admin/email" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
          Email
        </Link>
        <Link href="/admin/settings" className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
          Settings
        </Link>
      </nav>

      <div className="pt-3 border-t border-gray-100">
        <button
          onClick={() => {
            logout({ redirectTo: '/' });
          }}
          className="w-full mt-0 inline-flex items-center justify-center rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

