'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';

/** Resposta da API (campos opcionais / null). */
type GlobalSettingsResponse = {
  club_name: string | null;
  entry_fee_transfer_iban: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

/** Estado do formulário — sempre strings para inputs controlados. */
type GlobalSettingsForm = {
  club_name: string;
  entry_fee_transfer_iban: string;
  contact_email: string;
  contact_phone: string;
};

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const { orgSlug } = useAdminOrg();
  const [settings, setSettings] = useState<GlobalSettingsForm>({
    club_name: '',
    entry_fee_transfer_iban: '',
    contact_email: '',
    contact_phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    try {
      const data = await apiGet<GlobalSettingsResponse>(withOrg('/settings/global', orgSlug));
      setSettings({
        club_name: data.club_name ?? '',
        entry_fee_transfer_iban: data.entry_fee_transfer_iban ?? '',
        contact_email: data.contact_email ?? '',
        contact_phone: data.contact_phone ?? '',
      });
    } catch {
      setSettings({ club_name: '', entry_fee_transfer_iban: '', contact_email: '', contact_phone: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [orgSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiSend(
        withOrg('/settings/global', orgSlug),
        'PATCH',
        {
          club_name: settings.club_name.trim() || null,
          entry_fee_transfer_iban: settings.entry_fee_transfer_iban.trim() || null,
          contact_email: settings.contact_email.trim() || null,
          contact_phone: settings.contact_phone.trim() || null,
        },
        token
      );
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
      await fetchSettings();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <main className="flex-1 px-4 sm:px-6 py-8 bg-gray-50">
        <div className="mb-4">
          <Link href={withOrg('/admin', orgSlug)} className="text-sm text-blue-600 hover:underline">← Back to Dashboard</Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">Global settings</h1>
        <p className="text-gray-600 mb-8">
          Organisation and payment variables used across the platform (e.g. email templates, registration confirmations, payment instructions). Configure the entry confirmation email in <Link href={withOrg('/admin/email', orgSlug)} className="text-blue-600 hover:underline">Automated Emails</Link>.
        </p>

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-xl space-y-6 bg-white border rounded-xl p-6 shadow-sm">
            {message && (
              <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {message.text}
              </div>
            )}

            <div>
              <label htmlFor="club_name" className="block text-sm font-medium text-gray-700 mb-1">Club name</label>
              <input
                id="club_name"
                type="text"
                value={settings.club_name}
                onChange={(e) => setSettings((s) => ({ ...s, club_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Clube Naval de Lisboa"
              />
              <p className="mt-1 text-xs text-gray-500">Template placeholder: <code className="bg-gray-100 px-1 rounded">club_name</code></p>
            </div>

            <div>
              <label htmlFor="entry_fee_transfer_iban" className="block text-sm font-medium text-gray-700 mb-1">IBAN for entry fee transfer</label>
              <input
                id="entry_fee_transfer_iban"
                type="text"
                value={settings.entry_fee_transfer_iban}
                onChange={(e) => setSettings((s) => ({ ...s, entry_fee_transfer_iban: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                placeholder="PT50 0000 0000 0000 0000 00000"
              />
              <p className="mt-1 text-xs text-gray-500">Template placeholder: <code className="bg-gray-100 px-1 rounded">entry_fee_transfer_iban</code></p>
            </div>

            <div>
              <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700 mb-1">Race office contact email</label>
              <input
                id="contact_email"
                type="email"
                value={settings.contact_email}
                onChange={(e) => setSettings((s) => ({ ...s, contact_email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. raceoffice@club.com"
              />
              <p className="mt-1 text-xs text-gray-500">Email the race office will use for entries and general contact. Template placeholder: <code className="bg-gray-100 px-1 rounded">contact_email</code></p>
            </div>

            <div>
              <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 mb-1">Organization contact phone</label>
              <input
                id="contact_phone"
                type="tel"
                value={settings.contact_phone}
                onChange={(e) => setSettings((s) => ({ ...s, contact_phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. +351 123 456 789"
              />
              <p className="mt-1 text-xs text-gray-500">Phone number for championship/organization contact. Template placeholder: <code className="bg-gray-100 px-1 rounded">contact_phone</code></p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
