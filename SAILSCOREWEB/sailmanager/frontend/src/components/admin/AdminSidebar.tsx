'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';
import { canAccessOrganizationManagement, hrefOrganizationsPage } from '@/lib/organizationManagementAccess';

export default function AdminSidebar() {
  const { logout, user } = useAuth();
  const { orgSlug, isPlatformAdmin } = useAdminOrg();
  const pathname = usePathname();
  const canManageOrganizations = canAccessOrganizationManagement(user, isPlatformAdmin, orgSlug);

  const base = (path: string) => withOrg(path, orgSlug);
  const itemClass = (active: boolean) =>
    `px-4 py-2.5 rounded-xl text-base ${
      active
        ? 'font-semibold text-blue-700 bg-blue-50 border border-blue-100 shadow-sm'
        : 'font-medium text-gray-700 hover:bg-gray-50'
    }`;
  const isRegattas =
    pathname?.startsWith('/admin/manage-regattas') ||
    pathname?.startsWith('/admin/create-regatta') ||
    pathname?.startsWith('/admin/edit-regatta');
  const isNews = pathname?.startsWith('/admin/news');
  const isDesign = pathname?.startsWith('/admin/design');
  const isSponsors = pathname?.startsWith('/admin/sponsors');
  const isEmail = pathname?.startsWith('/admin/email');
  const isSettings = pathname?.startsWith('/admin/settings');
  const isOrganizations = pathname?.startsWith('/admin/organizations');
  const isDemoRequests = pathname?.startsWith('/admin/demo-requests');
  const organizationsHref = hrefOrganizationsPage(user, isPlatformAdmin, orgSlug, withOrg);
  const canViewDemoRequests = user?.role === 'platform_admin';
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onEsc);
    };
  }, [mobileOpen]);

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Admin Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1.5">Manage regattas, notices and content.</p>
      </div>

      <div>
        <Link
          href={base('/admin/create-regatta')}
          onClick={onNavigate}
          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 transition"
        >
          New regatta
        </Link>
      </div>

      <nav className="flex flex-col space-y-1">
        {canManageOrganizations && (
          <Link href={organizationsHref} onClick={onNavigate} className={itemClass(!!isOrganizations)}>
            Organizations
          </Link>
        )}
        {canViewDemoRequests && (
          <Link href="/admin/demo-requests" onClick={onNavigate} className={itemClass(!!isDemoRequests)}>
            Demo requests
          </Link>
        )}
        <Link href={base('/admin/manage-regattas')} onClick={onNavigate} className={itemClass(!!isRegattas)}>
          Regattas
        </Link>
        <Link href={base('/admin/news')} onClick={onNavigate} className={itemClass(!!isNews)}>
          News
        </Link>
        <Link href={base('/admin/design')} onClick={onNavigate} className={itemClass(!!isDesign)}>
          Design
        </Link>
        <Link href={base('/admin/sponsors')} onClick={onNavigate} className={itemClass(!!isSponsors)}>
          Sponsors
        </Link>
        <Link href={base('/admin/email')} onClick={onNavigate} className={itemClass(!!isEmail)}>
          Automated Emails
        </Link>
        <Link href={base('/admin/settings')} onClick={onNavigate} className={itemClass(!!isSettings)}>
          Settings
        </Link>
      </nav>

      <div className="pt-4 border-t border-gray-100">
        <button
          onClick={() => {
            onNavigate?.();
            logout({ redirectTo: orgSlug ? `/o/${orgSlug}` : '/' });
          }}
          className="w-full mt-0 inline-flex items-center justify-center rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-base font-semibold text-red-700 hover:bg-red-100 transition"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed left-4 top-20 z-30 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-sm font-medium text-gray-800 shadow"
      >
        <Menu size={16} />
        Admin menu
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-white border-r border-gray-200 p-5 space-y-5 shadow-xl transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="ml-auto inline-flex rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50"
          aria-label="Close admin menu"
        >
          <X size={16} />
        </button>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <aside className="hidden lg:block sticky top-0 h-screen w-72 overflow-y-auto bg-white/95 border-r border-gray-200 p-7 space-y-6 shadow-sm">
        <SidebarContent />
      </aside>
    </>
  );
}

