'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';

type GlobalSettings = {
  club_name: string | null;
  entry_fee_transfer_iban: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type EntryEmailConfig = {
  enabled: boolean;
  payment_instructions: string;
  closing_note: string;
};

const PLACEHOLDERS = [
  '{{sailor_name}}', '{{event_name}}', '{{entry_fee_transfer_iban}}',
  '{{class_name}}', '{{boat_name}}', '{{sail_number}}', '{{helm_name}}',
  '{{contact_email}}', '{{club_name}}',
];

/** English sample data for entry-specific fields in the preview. */
const SAMPLE_ENTRY_VALUES: Record<string, string> = {
  '{{sailor_name}}': 'John Smith',
  '{{event_name}}': 'Summer Regatta 2026',
  '{{class_name}}': 'ILCA 7',
  '{{boat_name}}': 'Wind Seeker',
  '{{sail_number}}': 'GBR 123',
  '{{helm_name}}': 'John Smith',
};

const NOT_CONFIGURED_IBAN = '[IBAN not set in Settings]';
const NOT_CONFIGURED_CONTACT = '[Contact email not set in Settings]';
const NOT_CONFIGURED_CLUB = '[Club name not set in Settings]';

function replacePlaceholders(text: string, values: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(key).join(value);
  }
  return out;
}

function getEntryEmailPreviewPlaceholders(globalSettings: GlobalSettings): Record<string, string> {
  return {
    ...SAMPLE_ENTRY_VALUES,
    '{{entry_fee_transfer_iban}}': (globalSettings.entry_fee_transfer_iban?.trim()) || NOT_CONFIGURED_IBAN,
    '{{contact_email}}': (globalSettings.contact_email?.trim()) || NOT_CONFIGURED_CONTACT,
    '{{club_name}}': (globalSettings.club_name?.trim()) || NOT_CONFIGURED_CLUB,
  };
}

export default function AdminEmailPage() {
  const { token, logout } = useAuth();
  const [settings, setSettings] = useState<GlobalSettings>({
    club_name: '',
    entry_fee_transfer_iban: '',
    contact_email: '',
    contact_phone: '',
  });
  const [entryEmail, setEntryEmail] = useState<EntryEmailConfig>({
    enabled: true,
    payment_instructions: '',
    closing_note: '',
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingEntryEmail, setLoadingEntryEmail] = useState(true);
  const [savingEntryEmail, setSavingEntryEmail] = useState(false);
  const [entryEmailMessage, setEntryEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    try {
      const data = await apiGet<GlobalSettings>('/settings/global');
      setSettings({
        club_name: data.club_name ?? '',
        entry_fee_transfer_iban: data.entry_fee_transfer_iban ?? '',
        contact_email: data.contact_email ?? '',
        contact_phone: data.contact_phone ?? '',
      });
    } catch {
      setSettings({ club_name: '', entry_fee_transfer_iban: '', contact_email: '', contact_phone: '' });
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchEntryEmail = async () => {
    try {
      const data = await apiGet<EntryEmailConfig>('/settings/entry-email');
      setEntryEmail({
        enabled: data.enabled ?? true,
        payment_instructions: data.payment_instructions ?? '',
        closing_note: data.closing_note ?? '',
      });
    } catch {
      setEntryEmail({ enabled: true, payment_instructions: '', closing_note: '' });
    } finally {
      setLoadingEntryEmail(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchEntryEmail();
  }, []);

  const handleEntryEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingEntryEmail(true);
    setEntryEmailMessage(null);
    try {
      await apiSend('/settings/entry-email', 'PATCH', {
        enabled: entryEmail.enabled,
        payment_instructions: entryEmail.payment_instructions.trim() || null,
        closing_note: entryEmail.closing_note.trim() || null,
      }, token);
      setEntryEmailMessage({ type: 'success', text: 'Entry email configuration saved successfully.' });
    } catch (err) {
      setEntryEmailMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save.' });
    } finally {
      setSavingEntryEmail(false);
    }
  };

  const FIXED_SUBJECT = 'Entry application received – {{event_name}}';
  const FIXED_INTRO = 'We are pleased to receive your entry for this event.';

  const previewPlaceholders = getEntryEmailPreviewPlaceholders(settings);
  const previewSubject = replacePlaceholders(FIXED_SUBJECT, previewPlaceholders);
  const previewIntro = FIXED_INTRO;
  const previewPayment = replacePlaceholders(entryEmail.payment_instructions || 'To proceed with payment, please use the following IBAN:\n\n{{entry_fee_transfer_iban}}\n\nPlease include your name and sail number in the payment reference.', previewPlaceholders);
  const previewClosing = replacePlaceholders(entryEmail.closing_note || 'If you have any questions, please contact us at {{contact_email}}.', previewPlaceholders);
  const previewBody = `Dear ${previewPlaceholders['{{sailor_name}}']},

Thank you for registering for ${previewPlaceholders['{{event_name}}']}.

We confirm that your entry application has been received successfully.

${previewIntro}

Please note that this does not yet guarantee your place in the championship. Your entry will only be considered confirmed once both of the following conditions have been met:

1. The entry fee has been paid
2. The entry has been reviewed and approved by the Race Office

${previewPayment}

Entry details

- Event: ${previewPlaceholders['{{event_name}}']}
- Class: ${previewPlaceholders['{{class_name}}']}
- Boat name: ${previewPlaceholders['{{boat_name}}']}
- Sail number: ${previewPlaceholders['{{sail_number}}']}
- Helm: ${previewPlaceholders['{{helm_name}}']}

Once payment has been received and the Race Office has approved your entry, you will receive a further confirmation.

${previewClosing}

Kind regards,
${previewPlaceholders['{{club_name}}']}`;

  const missingOrgSettings = [
    !settings.entry_fee_transfer_iban?.trim() && 'IBAN',
    !settings.contact_email?.trim() && 'Contact email',
    !settings.club_name?.trim() && 'Club name',
  ].filter(Boolean) as string[];

  const loading = loadingSettings || loadingEntryEmail;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-r p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-bold mb-6">ADMIN DASHBOARD</h2>
        <nav className="flex flex-col space-y-2">
          <Link href="/admin" className="hover:underline">Dashboard</Link>
          <Link href="/admin/manage-regattas" className="hover:underline">Regattas</Link>
          <Link href="/admin/news" className="hover:underline">News</Link>
          <Link href="/admin/manage-users" className="hover:underline">Users</Link>
          <Link href="/admin/manage-protests" className="hover:underline">Protests</Link>
          <Link href="/admin/design" className="hover:underline">Design</Link>
          <Link href="/admin/sponsors" className="hover:underline">Sponsors</Link>
          <Link href="/admin/email" className="hover:underline font-semibold text-blue-600">Email</Link>
          <Link href="/admin/settings" className="hover:underline">Settings</Link>
        </nav>
        <button
          onClick={() => { logout(); window.location.href = '/'; }}
          className="mt-6 text-sm text-red-600 hover:underline"
        >
          Log out
        </button>
      </aside>

      <main className="flex-1 p-10 bg-gray-50">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">← Back to Dashboard</Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">Email</h1>
        <p className="text-gray-600 mb-6">
          Configure emails sent by the platform. Club name, IBAN and contact email used in these emails are set in <Link href="/admin/settings" className="text-blue-600 hover:underline">Settings</Link>.
        </p>

        <div className="max-w-2xl">
          <h2 className="text-xl font-bold mb-2">Entry application received</h2>

          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
            <p className="font-medium mb-1">Global configuration – used for all championships</p>
            <p className="text-amber-800">
              This email is sent after every online entry, for every regatta. Only the <strong>Payment instructions</strong> and <strong>Closing note</strong> below are editable. The subject and the introductory text are fixed by the system. Because the same text is used for all events, use the variables (e.g. {'{{event_name}}'}, {'{{entry_fee_transfer_iban}}'}, {'{{contact_email}}'}) in your text so that each sailor receives the correct information for their championship.
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-gray-800">
            <h3 className="font-semibold text-gray-900 mb-2">Variables you can use (in Payment instructions and Closing note)</h3>
            <p className="mb-3 text-gray-700">
              Type the variable name inside double curly brackets. When the email is sent, each variable is replaced with the real value (e.g. the sailor’s name, the event name, or the IBAN from Settings). This keeps the email correct for every championship.
            </p>
            <ul className="space-y-1.5 text-gray-700">
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{sailor_name}}'}</code> — Name of the sailor (helm)</li>
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{event_name}}'}</code> — Name of the regatta/event</li>
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{class_name}}'}</code> — Class of the entry (e.g. ILCA 7)</li>
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{boat_name}}'}</code> — Boat name</li>
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{sail_number}}'}</code> — Sail number</li>
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{helm_name}}'}</code> — Helm name</li>
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{entry_fee_transfer_iban}}'}</code> — IBAN for payment (set in <Link href="/admin/settings" className="text-blue-600 hover:underline">Settings</Link>)</li>
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{contact_email}}'}</code> — Race office contact email (set in Settings)</li>
              <li><code className="bg-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{'{{club_name}}'}</code> — Club/organisation name (set in Settings)</li>
            </ul>
          </div>

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <form onSubmit={handleEntryEmailSubmit} className="space-y-6 bg-white border rounded-xl p-6 shadow-sm">
              {entryEmailMessage && (
                <div className={`p-3 rounded-lg text-sm ${entryEmailMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {entryEmailMessage.text}
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entryEmail.enabled}
                    onChange={(e) => setEntryEmail((s) => ({ ...s, enabled: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable email sending</span>
                </label>
                <span className="text-xs text-gray-500">When enabled, this email is sent after each online entry (all championships).</span>
              </div>

              <div className="rounded border border-gray-200 bg-gray-50/80 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Fixed by the system (same for all events)</p>
                <p><strong>Subject:</strong> Entry application received – {'{{event_name}}'}</p>
                <p className="mt-1"><strong>Intro:</strong> We are pleased to receive your entry for this event.</p>
              </div>

              <div>
                <label htmlFor="entry_email_payment" className="block text-sm font-medium text-gray-700 mb-1">Payment instructions</label>
                <textarea
                  id="entry_email_payment"
                  rows={6}
                  value={entryEmail.payment_instructions}
                  onChange={(e) => setEntryEmail((s) => ({ ...s, payment_instructions: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={'To proceed with payment, please use the following IBAN:\n\n{{entry_fee_transfer_iban}}\n\nPlease include your name and sail number in the payment reference.'}
                />
                <p className="mt-1 text-xs text-gray-500">Use {'{{entry_fee_transfer_iban}}'} for the IBAN.</p>
              </div>

              <div>
                <label htmlFor="entry_email_closing" className="block text-sm font-medium text-gray-700 mb-1">Closing note (optional)</label>
                <textarea
                  id="entry_email_closing"
                  rows={2}
                  value={entryEmail.closing_note}
                  onChange={(e) => setEntryEmail((s) => ({ ...s, closing_note: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="If you have any questions, please contact us at {{contact_email}}."
                />
              </div>

              <p className="text-xs text-gray-500">Available placeholders: {PLACEHOLDERS.join(', ')}</p>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview (example)</h3>
                {missingOrgSettings.length > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    The following are not set in <Link href="/admin/settings" className="font-medium underline">Settings</Link> and will appear as placeholders in the email until you save them there: {missingOrgSettings.join(', ')}.
                  </div>
                )}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans">
                  <div className="text-gray-500 text-xs mb-2">Subject: {previewSubject}</div>
                  <div className="border-t border-gray-200 pt-2 mt-2">{previewBody}</div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingEntryEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {savingEntryEmail ? 'Saving…' : 'Save entry email configuration'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
