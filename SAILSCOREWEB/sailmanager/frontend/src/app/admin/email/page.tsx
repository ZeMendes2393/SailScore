'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import AdminSidebar from '@/components/admin/AdminSidebar';
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

type ConfirmedEntryEmailConfig = {
  enabled: boolean;
  main_message: string;
  closing_note: string;
};

/** Email types available in the admin. */
const EMAIL_TYPES = [
  { id: 'entry_application', label: 'Entry application received', available: true },
  { id: 'confirmed_entry', label: 'Confirmed entry', available: true },
  { id: 'protest', label: 'Protest', available: false },
] as const;

type EmailTypeId = (typeof EMAIL_TYPES)[number]['id'];

/** English sample data for the preview. Short names used by default; long names still supported. */
const SAMPLE_ENTRY_VALUES: Record<string, string> = {
  '{{sailor_name}}': 'John Smith',
  '{{sailor}}': 'John Smith',
  '{{event_name}}': 'Summer Regatta 2026',
  '{{event}}': 'Summer Regatta 2026',
  '{{class_name}}': 'ILCA 7',
  '{{class}}': 'ILCA 7',
  '{{boat_name}}': 'Wind Seeker',
  '{{boat}}': 'Wind Seeker',
  '{{sail_number}}': 'GBR 123',
  '{{sail}}': 'GBR 123',
  '{{helm_name}}': 'John Smith',
  '{{helm}}': 'John Smith',
};

const NOT_CONFIGURED_IBAN = '[IBAN not set in Settings]';
const NOT_CONFIGURED_CONTACT = '[Contact email not set in Settings]';
const NOT_CONFIGURED_CLUB = '[Club name not set in Settings]';

function replacePlaceholders(text: string, values: Record<string, string>): string {
  let out = text;
  const entries = Object.entries(values).sort(([a], [b]) => b.length - a.length);
  for (const [key, value] of entries) {
    out = out.split(key).join(value);
  }
  return out;
}

function getEntryEmailPreviewPlaceholders(globalSettings: GlobalSettings): Record<string, string> {
  const iban = (globalSettings.entry_fee_transfer_iban?.trim()) || NOT_CONFIGURED_IBAN;
  const contact = (globalSettings.contact_email?.trim()) || NOT_CONFIGURED_CONTACT;
  const club = (globalSettings.club_name?.trim()) || NOT_CONFIGURED_CLUB;
  return {
    ...SAMPLE_ENTRY_VALUES,
    '{{entry_fee_transfer_iban}}': iban,
    '{{iban}}': iban,
    '{{contact_email}}': contact,
    '{{contact}}': contact,
    '{{club_name}}': club,
    '{{club}}': club,
  };
}

export default function AdminEmailPage() {
  const { token } = useAuth();
  const [selectedEmailType, setSelectedEmailType] = useState<EmailTypeId | ''>('');
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
  const [loadingConfirmedEntryEmail, setLoadingConfirmedEntryEmail] = useState(true);
  const [savingEntryEmail, setSavingEntryEmail] = useState(false);
  const [savingConfirmedEntryEmail, setSavingConfirmedEntryEmail] = useState(false);
  const [entryEmailMessage, setEntryEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmedEntryEmailMessage, setConfirmedEntryEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [confirmedEntryEmail, setConfirmedEntryEmail] = useState<ConfirmedEntryEmailConfig>({
    enabled: true,
    main_message: '',
    closing_note: '',
  });

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

  const fetchConfirmedEntryEmail = async () => {
    try {
      const data = await apiGet<ConfirmedEntryEmailConfig>('/settings/confirmed-entry-email');
      setConfirmedEntryEmail({
        enabled: data.enabled ?? true,
        main_message: data.main_message ?? '',
        closing_note: data.closing_note ?? '',
      });
    } catch {
      setConfirmedEntryEmail({ enabled: true, main_message: '', closing_note: '' });
    } finally {
      setLoadingConfirmedEntryEmail(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchEntryEmail();
    fetchConfirmedEntryEmail();
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

  const handleConfirmedEntryEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingConfirmedEntryEmail(true);
    setConfirmedEntryEmailMessage(null);
    try {
      await apiSend('/settings/confirmed-entry-email', 'PATCH', {
        enabled: confirmedEntryEmail.enabled,
        main_message: confirmedEntryEmail.main_message.trim() || null,
        closing_note: confirmedEntryEmail.closing_note.trim() || null,
      }, token);
      setConfirmedEntryEmailMessage({ type: 'success', text: 'Confirmed entry email configuration saved.' });
    } catch (err) {
      setConfirmedEntryEmailMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save.' });
    } finally {
      setSavingConfirmedEntryEmail(false);
    }
  };

  const FIXED_SUBJECT = 'Entry application received – {{event}}';
  const FIXED_CONFIRMED_SUBJECT = 'Confirmed entry – {{event}}';
  const previewPlaceholders = getEntryEmailPreviewPlaceholders(settings);
  const previewSubject = replacePlaceholders(FIXED_SUBJECT, previewPlaceholders);
  const previewPayment = replacePlaceholders(entryEmail.payment_instructions || 'To proceed with payment, please use the following IBAN:\n\n{{iban}}\n\nPlease include your name and sail number in the payment reference.', previewPlaceholders);
  const previewClosing = replacePlaceholders(entryEmail.closing_note || 'If you have any questions, please contact us at {{contact}}.', previewPlaceholders);

  const previewBodyIntro = `Dear ${previewPlaceholders['{{sailor}}']},

Thank you for registering for ${previewPlaceholders['{{event}}']}.

We confirm that your entry application has been received successfully.

Please note that this does not yet guarantee your place in the championship. Your entry will only be considered confirmed once both of the following conditions have been met:

1. The entry fee has been paid
2. The entry has been reviewed and approved by the Race Office`;

  const previewBodyAfterPayment = `Entry details

- Event: ${previewPlaceholders['{{event}}']}
- Class: ${previewPlaceholders['{{class}}']}
- Boat name: ${previewPlaceholders['{{boat}}']}
- Sail number: ${previewPlaceholders['{{sail}}']}
- Helm: ${previewPlaceholders['{{helm}}']}

Once payment has been received and the Race Office has approved your entry, you will receive a further confirmation.`;

  const previewBodySignoff = `Kind regards,
${previewPlaceholders['{{club}}']}`;

  const DEFAULT_CONFIRMED_MAIN = `Your entry has been accepted.

Payment has been received and your entry is now confirmed for the championship. You are officially registered for {{event}}.

Entry details:
- Event: {{event}}
- Class: {{class}}
- Boat: {{boat}}
- Sail number: {{sail}}
- Helm: {{helm}}

We look forward to seeing you at the event.`;
  const previewConfirmedMain = replacePlaceholders(confirmedEntryEmail.main_message || DEFAULT_CONFIRMED_MAIN, previewPlaceholders);
  const previewConfirmedClosing = replacePlaceholders(confirmedEntryEmail.closing_note || 'If you have any questions, please contact us at {{contact}}.', previewPlaceholders);
  const previewConfirmedSubject = replacePlaceholders(FIXED_CONFIRMED_SUBJECT, previewPlaceholders);
  const previewConfirmedBodyIntro = `Dear ${previewPlaceholders['{{sailor}}']},`;
  const previewConfirmedSignoff = `Kind regards,
${previewPlaceholders['{{club}}']}`;
  const previewConfirmedCredentialsBlock = `---
Sailor Account access:
• Username: [added when email is sent]
• Temporary password: [added when email is sent]

Login here: [link]`;

  const missingOrgSettings = [
    !settings.entry_fee_transfer_iban?.trim() && 'IBAN',
    !settings.contact_email?.trim() && 'Contact email',
    !settings.club_name?.trim() && 'Club name',
  ].filter(Boolean) as string[];

  const loading = loadingSettings || loadingEntryEmail;
  const loadingConfirmed = loadingSettings || loadingConfirmedEntryEmail;
  const selectedTypeInfo = EMAIL_TYPES.find((t) => t.id === selectedEmailType);
  const showEntryApplicationEditor = selectedEmailType === 'entry_application';
  const showConfirmedEntryEditor = selectedEmailType === 'confirmed_entry';
  const showComingSoon = selectedEmailType && selectedTypeInfo && !selectedTypeInfo.available;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />

      <main className="flex-1 p-10 bg-gray-50">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">← Back to Dashboard</Link>
        </div>
        <h1 className="text-3xl font-bold mb-2">Email</h1>
        <p className="text-gray-600 mb-6">
          Configure emails sent by the platform. Club name, IBAN and contact email used in these emails are set in <Link href="/admin/settings" className="text-blue-600 hover:underline">Settings</Link>.
        </p>

        <div className="max-w-2xl">
          <div className="mb-6">
            <label htmlFor="email_type" className="block text-sm font-medium text-gray-700 mb-2">
              Email type
            </label>
            <select
              id="email_type"
              value={selectedEmailType}
              onChange={(e) => setSelectedEmailType((e.target.value || '') as EmailTypeId | '')}
              className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select an email type…</option>
              {EMAIL_TYPES.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.available}>
                  {t.label}{!t.available ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>

          {showComingSoon && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-gray-600">
              Configuration for &quot;{selectedTypeInfo?.label}&quot; is not available yet.
            </div>
          )}

          {showConfirmedEntryEditor && (
            <>
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
                <p className="font-medium mb-1">Sent when an entry is marked paid and confirmed</p>
                <p className="text-amber-800">
                  This email confirms that the entry is officially accepted for the championship. You can edit the <strong>Main message</strong> and <strong>Closing note</strong> below. The subject is fixed. When the admin sends this email from the entry list, the system <strong>generates</strong> the sailor account credentials (username, temporary password and login link) at that moment and appends them to the email; the account is created or linked to the sailor when this email is sent.
                </p>
              </div>

              {loadingConfirmed ? (
                <p className="text-gray-500">Loading…</p>
              ) : (
                <form onSubmit={handleConfirmedEntryEmailSubmit} className="space-y-6 bg-white border rounded-xl p-6 shadow-sm">
                  {confirmedEntryEmailMessage && (
                    <div className={`p-3 rounded-lg text-sm ${confirmedEntryEmailMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      {confirmedEntryEmailMessage.text}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmedEntryEmail.enabled}
                        onChange={(e) => setConfirmedEntryEmail((s) => ({ ...s, enabled: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Enable this email</span>
                    </label>
                    <span className="text-xs text-gray-500">When enabled, the admin can send this email from the entry list when an entry is paid and confirmed.</span>
                  </div>

                  <div className="rounded border border-gray-200 bg-gray-50/80 p-3 text-sm text-gray-600">
                    <p className="font-medium text-gray-700 mb-1">Fixed by the system</p>
                    <p><strong>Subject:</strong> Confirmed entry – [event name]</p>
                  </div>

                  <p className="text-xs text-gray-500 -mt-1">
                    Placeholders such as <code className="bg-gray-100 px-1 rounded">&#123;&#123;event&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;sailor&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;class&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;boat&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;sail&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;helm&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;contact&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;club&#125;&#125;</code> are replaced when the email is sent.
                  </p>

                  <div>
                    <label htmlFor="confirmed_entry_main" className="block text-sm font-medium text-gray-700 mb-1">Main message</label>
                    <textarea
                      id="confirmed_entry_main"
                      rows={10}
                      value={confirmedEntryEmail.main_message}
                      onChange={(e) => setConfirmedEntryEmail((s) => ({ ...s, main_message: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Your entry has been accepted…"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirmed_entry_closing" className="block text-sm font-medium text-gray-700 mb-1">Closing note (optional)</label>
                    <textarea
                      id="confirmed_entry_closing"
                      rows={2}
                      value={confirmedEntryEmail.closing_note}
                      onChange={(e) => setConfirmedEntryEmail((s) => ({ ...s, closing_note: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="If you have any questions, please contact us at {{contact}}."
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview (example)</h3>
                    {missingOrgSettings.length > 0 && (
                      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Not set in <Link href="/admin/settings" className="font-medium underline">Settings</Link>: {missingOrgSettings.join(', ')}.
                      </div>
                    )}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 font-sans space-y-3">
                      <div className="text-gray-500 text-xs">Subject: {previewConfirmedSubject}</div>
                      <div className="border-t border-gray-200 pt-2 space-y-3">
                        <div className="whitespace-pre-wrap">{previewConfirmedBodyIntro}</div>

                        <div className="rounded-md border-2 border-blue-300 bg-blue-50/80 p-3">
                          <div className="text-xs font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Editable: Main message</div>
                          <div className="whitespace-pre-wrap text-gray-800">{previewConfirmedMain}</div>
                        </div>

                        <div className="rounded-md border-2 border-blue-300 bg-blue-50/80 p-3">
                          <div className="text-xs font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Editable: Closing note</div>
                          <div className="whitespace-pre-wrap text-gray-800">{previewConfirmedClosing}</div>
                        </div>

                        <div className="whitespace-pre-wrap">{previewConfirmedSignoff}</div>

                        <div className="rounded-md border-2 border-gray-300 bg-gray-100/80 p-3">
                          <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Generated and appended when this email is sent</div>
                          <div className="whitespace-pre-wrap text-gray-700">{previewConfirmedCredentialsBlock}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingConfirmedEntryEmail}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingConfirmedEntryEmail ? 'Saving…' : 'Save'}
                  </button>
                </form>
              )}
            </>
          )}

          {showEntryApplicationEditor && (
            <>
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
                <p className="font-medium mb-1">Used for all championships</p>
                <p className="text-amber-800">
                  This email is sent after every online entry. You can edit the <strong>Payment instructions</strong> and <strong>Closing note</strong> below. The subject is fixed by the system.
                </p>
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
                    <p><strong>Subject:</strong> Entry application received – [event name]</p>
                  </div>

                  <p className="text-xs text-gray-500 -mt-1">
                    Text below can include placeholders such as <code className="bg-gray-100 px-1 rounded">&#123;&#123;event&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;iban&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;contact&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;club&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;sailor&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;helm&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;class&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;boat&#125;&#125;</code>, <code className="bg-gray-100 px-1 rounded">&#123;&#123;sail&#125;&#125;</code>; they are replaced with the real values when the email is sent.
                  </p>

                  <div>
                    <label htmlFor="entry_email_payment" className="block text-sm font-medium text-gray-700 mb-1">Payment instructions</label>
                    <textarea
                      id="entry_email_payment"
                      rows={6}
                      value={entryEmail.payment_instructions}
                      onChange={(e) => setEntryEmail((s) => ({ ...s, payment_instructions: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="To proceed with payment, please use the following IBAN…"
                    />
                  </div>

                  <div>
                    <label htmlFor="entry_email_closing" className="block text-sm font-medium text-gray-700 mb-1">Closing note (optional)</label>
                    <textarea
                      id="entry_email_closing"
                      rows={2}
                      value={entryEmail.closing_note}
                      onChange={(e) => setEntryEmail((s) => ({ ...s, closing_note: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="If you have any questions, please contact us…"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview (example)</h3>
                    {missingOrgSettings.length > 0 && (
                      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        The following are not set in <Link href="/admin/settings" className="font-medium underline">Settings</Link> and will appear as placeholders in the email until you save them there: {missingOrgSettings.join(', ')}.
                      </div>
                    )}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 font-sans space-y-3">
                      <div className="text-gray-500 text-xs">Subject: {previewSubject}</div>
                      <div className="border-t border-gray-200 pt-2 space-y-3">
                        <div className="whitespace-pre-wrap">{previewBodyIntro}</div>

                        <div className="rounded-md border-2 border-blue-300 bg-blue-50/80 p-3">
                          <div className="text-xs font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Editable: Payment instructions</div>
                          <div className="whitespace-pre-wrap text-gray-800">{previewPayment}</div>
                        </div>

                        <div className="whitespace-pre-wrap">{previewBodyAfterPayment}</div>

                        <div className="rounded-md border-2 border-blue-300 bg-blue-50/80 p-3">
                          <div className="text-xs font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Editable: Closing note</div>
                          <div className="whitespace-pre-wrap text-gray-800">{previewClosing}</div>
                        </div>

                        <div className="whitespace-pre-wrap">{previewBodySignoff}</div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingEntryEmail}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingEntryEmail ? 'Saving…' : 'Save'}
                  </button>
                </form>
              )}
            </>
          )}

          {selectedEmailType === '' && !showEntryApplicationEditor && !showConfirmedEntryEditor && !showComingSoon && (
            <p className="text-gray-500">Select an email type above to view and edit its configuration.</p>
          )}
        </div>
      </main>
    </div>
  );
}
