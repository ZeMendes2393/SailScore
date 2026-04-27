'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';

interface Organization {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface OrganizationWithAdmin extends Organization {
  admin_email?: string | null;
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<OrganizationWithAdmin | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const { token, user } = useAuth();
  const { orgSlug, isPlatformAdmin } = useAdminOrg();
  const isGlobalPlatformAdmin = isPlatformAdmin && !orgSlug;

  useEffect(() => {
    (async () => {
      if (!isGlobalPlatformAdmin) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiGet<Organization[]>('/organizations/', token);
        setOrgs(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, isGlobalPlatformAdmin]);

  if (user && !isGlobalPlatformAdmin) {
    return (
      <RequireAuth roles={['admin']}>
        <div className="min-h-screen bg-gray-50 px-4 py-10">
          <div className="mx-auto max-w-2xl rounded-xl border bg-white p-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Organizations</h1>
            <p className="text-sm text-gray-600">
              Organization management is only available in the global platform admin context (without <code className="bg-gray-100 px-1 rounded">?org=...</code>).
            </p>
            <div className="mt-5 flex items-center gap-3">
              {isPlatformAdmin ? (
                <Link
                  href="/admin/organizations"
                  className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Open global Organizations
                </Link>
              ) : (
                <Link
                  href={withOrg('/admin', orgSlug)}
                  className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back to Admin dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </RequireAuth>
    );
  }

  const handleSlugFromName = () => {
    const s = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(s);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    const em = adminEmail.trim().toLowerCase();
    const pw = adminPassword;
    if ((em && !pw) || (pw && !em)) {
      setError('To create the site admin, enter both email and password (min. 8 characters).');
      return;
    }
    if (pw && pw.length < 8) {
      setError('The admin password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim().toLowerCase() || slug,
        is_active: true,
      };
      if (em && pw) {
        payload.admin_email = em;
        payload.admin_password = pw;
        const nm = adminName.trim();
        if (nm) payload.admin_name = nm;
      }
      await apiSend<Organization>('/organizations/', 'POST', payload, token);
      const data = await apiGet<Organization[]>('/organizations/', token);
      setOrgs(Array.isArray(data) ? data : []);
      setName('');
      setSlug('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminName('');
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (org: Organization) => {
    if (!token) return;
    try {
      const data = await apiGet<OrganizationWithAdmin>(`/organizations/${org.id}`, token);
      setEditingOrg(data);
      setEditName(data.name);
      setEditSlug(data.slug);
      setEditIsActive(data.is_active);
      setEditAdminEmail(data.admin_email ?? '');
      setEditAdminPassword('');
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingOrg) return;
    setError(null);
    const em = editAdminEmail.trim().toLowerCase();
    const pw = editAdminPassword.trim();
    if (pw && pw.length < 8) {
      setError('A nova password deve ter pelo menos 8 caracteres.');
      return;
    }
    if (em && !pw && !editingOrg.admin_email) {
      setError('Para adicionar admin, indica também a password (mín. 8 caracteres).');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        slug: editSlug.trim().toLowerCase(),
        is_active: editIsActive,
      };
      if (em) payload.admin_email = em;
      if (pw) payload.admin_password = pw;
      await apiSend(`/organizations/${editingOrg.id}`, 'PATCH', payload, token);
      const data = await apiGet<Organization[]>('/organizations/', token);
      setOrgs(Array.isArray(data) ? data : []);
      setEditingOrg(null);
      setEditAdminEmail('');
      setEditAdminPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to update organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    if (
      !confirm(
        'Are you sure you want to delete this organization? Associated regattas may be affected.'
      )
    )
      return;
    try {
      await apiSend(`/organizations/${id}`, 'DELETE', undefined, token);
      setOrgs((prev) => prev.filter((o) => o.id !== id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete');
    }
  };

  return (
    <RequireAuth roles={['admin']}>
      <div className="flex min-h-screen">
        <aside className="w-64 bg-white border-r border-gray-200 p-6 space-y-5 shadow-sm">
          <div>
            <h2 className="text-lg font-bold tracking-wide text-gray-900">ADMIN DASHBOARD</h2>
            <p className="text-xs text-gray-500 mt-1">Multi-organization management</p>
          </div>
          <nav className="flex flex-col space-y-1">
            <Link
              href={withOrg('/admin/organizations', orgSlug)}
              className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100"
            >
              Organizations
            </Link>
            <Link href={withOrg('/admin/manage-regattas', orgSlug)} className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
              Regattas
            </Link>
            <Link href={withOrg('/admin', orgSlug)} className="px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
              ← Dashboard
            </Link>
          </nav>
        </aside>

        <main className="flex-1 px-4 sm:px-6 py-8 bg-gray-50">
          <h1 className="text-3xl font-bold mb-6">Organizations</h1>
          <p className="text-gray-600 mb-6">
            Each organization (club) has its own site at <code className="bg-gray-200 px-1 rounded">/o/[slug]</code> with separate branding, regattas, and settings.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          {showForm ? (
            <form onSubmit={handleCreate} className="mb-8 p-6 bg-white rounded-lg shadow border">
              <h3 className="font-semibold mb-4">New organization</h3>
              <div className="space-y-3 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSlugFromName}
                    placeholder="e.g. Royal Porto Yacht Club"
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. rpyc"
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens. Site: /o/{slug || '...'}</p>
                </div>
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <p className="text-sm font-medium text-gray-800">Site admin (optional)</p>
                  <p className="text-xs text-gray-500">
                    If you fill this in, an account is created only for this club (the same email can exist on another site with a different password).
                    The admin signs in at{' '}
                    <code className="bg-gray-100 px-1 rounded">/admin/login?org={slug || 'slug'}</code>.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin email</label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@club.example"
                      autoComplete="off"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display name (optional)</label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Shown name"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setAdminEmail('');
                      setAdminPassword('');
                      setAdminName('');
                    }}
                    className="border px-4 py-2 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="mb-6 inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + New organization
            </button>
          )}

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="space-y-3">
              {orgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow border"
                >
                  <div>
                    <h4 className="font-medium">{org.name}</h4>
                    <p className="text-sm text-gray-500">
                      /o/{org.slug}
                      {!org.is_active && <span className="ml-2 text-red-600">(inactive)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(org)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <Link
                      href={`/o/${org.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View site
                    </Link>
                    <Link
                      href={`/admin/manage-regattas?org=${org.slug}`}
                      className="text-sm text-gray-600 hover:underline"
                    >
                      Regattas
                    </Link>
                    <button
                      onClick={() => handleDelete(org.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {orgs.length === 0 && !showForm && (
                <p className="text-gray-500">No organizations yet. Click &quot;New organization&quot; to get started.</p>
              )}
            </div>
          )}

          {editingOrg && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-semibold mb-4">Edit organization</h3>
                <form onSubmit={handleSaveEdit} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                    <input
                      type="text"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      placeholder="e.g. rpyc"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Site: /o/{editSlug || '...'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editIsActive"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="editIsActive" className="text-sm text-gray-700">Active</label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin email</label>
                    <input
                      type="email"
                      value={editAdminEmail}
                      onChange={(e) => setEditAdminEmail(e.target.value)}
                      placeholder="admin@club.example"
                      autoComplete="off"
                      className="w-full border rounded px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Email de login do admin deste site. Se vazio e já existir admin, mantém o atual.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New password (optional)</label>
                    <input
                      type="password"
                      value={editAdminPassword}
                      onChange={(e) => setEditAdminPassword(e.target.value)}
                      placeholder="Leave empty to keep current"
                      autoComplete="new-password"
                      className="w-full border rounded px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only fill to change the site admin&apos;s password. Min. 8 characters.
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOrg(null);
                        setEditAdminEmail('');
                        setEditAdminPassword('');
                      }}
                      className="border px-4 py-2 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
