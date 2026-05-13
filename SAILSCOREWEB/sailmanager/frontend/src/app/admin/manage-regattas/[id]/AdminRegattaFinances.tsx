'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiDelete, apiGet, apiSend } from '@/lib/api';
import notify from '@/lib/notify';
import { useConfirm } from '@/components/ConfirmDialog';

export type FinanceKind = 'revenue' | 'expense';

export type FinanceLine = {
  id: number;
  regatta_id: number;
  kind: FinanceKind;
  description: string;
  amount: number;
  currency: string;
  notes?: string | null;
  sort_order: number;
  created_at: string;
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function AdminRegattaFinances({ regattaId }: { regattaId: number }) {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [lines, setLines] = useState<FinanceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [kind, setKind] = useState<FinanceKind>('revenue');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<FinanceLine[]>(`/regattas/${regattaId}/finance-lines`, token);
      setLines(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load finances.');
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [regattaId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    let revenue = 0;
    let expense = 0;
    const curs = new Set(lines.map((l) => l.currency || 'EUR'));
    const cur = curs.size === 1 ? [...curs][0] : lines[0]?.currency ?? 'EUR';
    for (const l of lines) {
      if (l.kind === 'revenue') revenue += l.amount;
      else expense += l.amount;
    }
    return { revenue, expense, balance: revenue - expense, currency: cur, mixedCurrency: curs.size > 1 };
  }, [lines]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const amount = Number(amountStr.replace(',', '.'));
    if (!description.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify.warning('Enter a description and a positive amount.');
      return;
    }
    setSaving(true);
    try {
      await apiSend<FinanceLine>(
        `/regattas/${regattaId}/finance-lines`,
        'POST',
        {
          kind,
          description: description.trim(),
          amount,
          currency: currency.trim().toUpperCase() || 'EUR',
          notes: notes.trim() || undefined,
          sort_order: lines.length,
        },
        token
      );
      setDescription('');
      setAmountStr('');
      setNotes('');
      notify.success('Finance line added.');
      await load();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Could not add line.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    const ok = await confirm({
      title: 'Remove this line?',
      description: 'The finance line will be deleted from this regatta. This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await apiDelete(`/regattas/${regattaId}/finance-lines/${id}`, token);
      notify.success('Finance line removed.');
      await load();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Could not delete line.');
    }
  }

  return (
    <div className="p-6 bg-white rounded shadow max-w-5xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Finances</h2>
        <p className="text-sm text-gray-600 mt-1">
          Track championship revenue (e.g. entry fees) and costs (e.g. race committee, equipment). Figures are for your
          planning only — not formal accounting.
        </p>
      </div>

      {totals.mixedCurrency && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Multiple currencies in use — totals below sum numeric amounts only; use one currency per championship for
          accurate balance.
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium uppercase text-green-800">Total revenue</p>
          <p className="text-xl font-bold text-green-900">{formatMoney(totals.revenue, totals.currency)}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium uppercase text-red-800">Total costs</p>
          <p className="text-xl font-bold text-red-900">{formatMoney(totals.expense, totals.currency)}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium uppercase text-blue-800">Balance</p>
          <p className="text-xl font-bold text-blue-900">{formatMoney(totals.balance, totals.currency)}</p>
        </div>
      </section>

      <form onSubmit={handleAdd} className="rounded-lg border border-gray-200 p-4 space-y-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">Add line</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
            Type
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as FinanceKind)}
              className="rounded border px-2 py-2 text-sm bg-white min-w-[9rem]"
            >
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 flex-1 min-w-[12rem]">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Entry fees — 49er class"
              className="rounded border px-2 py-2 text-sm"
              maxLength={500}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 w-28">
            Amount
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="rounded border px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 w-24">
            Currency
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={8}
              className="rounded border px-2 py-2 text-sm uppercase"
            />
          </label>
          <button
            type="submit"
            disabled={saving || !token}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-60"
          >
            Add
          </button>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-700">
          Notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Invoice ref., contractor name…"
            className="rounded border px-2 py-2 text-sm"
          />
        </label>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : lines.length === 0 ? (
        <p className="text-gray-500 text-sm">No lines yet. Add revenue and expenses above.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Description</th>
                <th className="p-3 font-semibold text-right">Amount</th>
                <th className="p-3 font-semibold">Notes</th>
                <th className="p-3 font-semibold w-24" />
              </tr>
            </thead>
            <tbody>
              {lines.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-3">
                    <span
                      className={
                        row.kind === 'revenue'
                          ? 'inline-flex rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium'
                          : 'inline-flex rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-xs font-medium'
                      }
                    >
                      {row.kind === 'revenue' ? 'Revenue' : 'Expense'}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-gray-900">{row.description}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(row.amount, row.currency)}</td>
                  <td className="p-3 text-gray-600 max-w-xs truncate" title={row.notes ?? ''}>
                    {row.notes || '—'}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="text-red-600 hover:underline text-xs font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
