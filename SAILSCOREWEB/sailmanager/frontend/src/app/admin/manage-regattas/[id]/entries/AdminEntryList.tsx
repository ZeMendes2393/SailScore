'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';
import {
  ENTRY_LIST_COLUMNS,
  getVisibleColumnsForClass,
  columnsByClassAfterToggle,
  type EntryListColumnId,
} from '@/lib/entryListColumns';
import type { EntryListEntry } from '@/lib/entryListTypes';
import { EntryListCell } from '@/components/entry-list/EntryListCell';
import { isAdminRole } from '@/lib/roles';
import { useAdminOrg, withOrg } from '@/lib/useAdminOrg';
import notify from '@/lib/notify';
import { useConfirm } from '@/components/ConfirmDialog';
import ImportEntriesModal from '@/components/admin/ImportEntriesModal';

interface RegattaForEntryList {
  id: number;
  entry_list_columns?: string[] | Record<string, string[]> | null;
  online_entry_limit_enabled?: boolean;
  online_entry_limit?: number | null;
  online_entry_limits_by_class?: Record<string, { enabled?: boolean; limit?: number | null }> | null;
}

interface AdminEntryListProps {
  regattaId: number;
  selectedClass: string | null;
  regatta: RegattaForEntryList | null;
  onRegattaUpdate: (r: RegattaForEntryList) => void;
}

export default function AdminEntryList({
  regattaId,
  selectedClass,
  regatta,
  onRegattaUpdate,
}: AdminEntryListProps) {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const { orgSlug } = useAdminOrg();
  const confirm = useConfirm();
  const isAdmin = isAdminRole(user?.role);
  const isScorer = user?.role === 'scorer';
  const canManageEntryList = isAdmin || isScorer;
  const manageRegattaBasePath = isScorer ? '/scorer/manage-regattas' : '/admin/manage-regattas';

  const [entries, setEntries] = useState<EntryListEntry[]>([]);
  const [savingColumns, setSavingColumns] = useState(false);
  const [limitDraft, setLimitDraft] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);
  const [movingEntryId, setMovingEntryId] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const publicVisibleColumnIds = useMemo(
    () => getVisibleColumnsForClass(regatta?.entry_list_columns, selectedClass),
    [regatta?.entry_list_columns, selectedClass]
  );
  const adminVisibleColumnIds = useMemo(
    () => ENTRY_LIST_COLUMNS.map((c) => c.id),
    []
  );
  const isPublicColumnVisible = (columnId: EntryListColumnId) =>
    publicVisibleColumnIds.includes(columnId);

  const filteredEntries = useMemo(() => {
    if (!selectedClass) return entries;
    const cls = selectedClass.trim().toLowerCase();
    return entries.filter((e) => (e.class_name || '').trim().toLowerCase() === cls);
  }, [entries, selectedClass]);

  const activeEntries = useMemo(() => filteredEntries.filter((e) => !e.waiting_list), [filteredEntries]);
  const waitingEntries = useMemo(() => filteredEntries.filter((e) => !!e.waiting_list), [filteredEntries]);

  const classLimitCfg = useMemo(() => {
    if (!selectedClass) return { enabled: false, limit: null as number | null };
    const map = regatta?.online_entry_limits_by_class || {};
    const direct = map[selectedClass];
    if (direct) {
      return { enabled: !!direct.enabled, limit: typeof direct.limit === 'number' ? direct.limit : null };
    }
    const selectedKey = selectedClass.trim().toLowerCase();
    for (const [k, v] of Object.entries(map)) {
      if (k.trim().toLowerCase() === selectedKey) {
        return { enabled: !!v?.enabled, limit: typeof v?.limit === 'number' ? v.limit : null };
      }
    }
    return { enabled: false, limit: null as number | null };
  }, [regatta?.online_entry_limits_by_class, selectedClass]);

  /** Mesma prioridade que o backend: limite por classe desta classe → depois limite global da regata. */
  const limitScope = useMemo(() => {
    const perClass =
      classLimitCfg.enabled &&
      typeof classLimitCfg.limit === 'number' &&
      classLimitCfg.limit >= 0;
    if (perClass) return { kind: 'class' as const, limit: classLimitCfg.limit as number };
    const globOn = !!regatta?.online_entry_limit_enabled;
    const globVal = regatta?.online_entry_limit;
    if (globOn && globVal != null && Number(globVal) >= 0) {
      return { kind: 'global' as const, limit: Number(globVal) };
    }
    return null;
  }, [classLimitCfg.enabled, classLimitCfg.limit, regatta?.online_entry_limit_enabled, regatta?.online_entry_limit]);

  const showWaitingListActions = !!limitScope && !!selectedClass;

  const entryListAtCapacity = useMemo(() => {
    if (!limitScope) return false;
    if (limitScope.kind === 'class') return activeEntries.length >= limitScope.limit;
    return entries.filter((e) => !e.waiting_list).length >= limitScope.limit;
  }, [limitScope, activeEntries.length, entries]);

  useEffect(() => {
    setLimitDraft(classLimitCfg.limit != null ? String(classLimitCfg.limit) : '');
  }, [classLimitCfg.limit, selectedClass]);

  const loadEntries = React.useCallback(async () => {
    try {
      const data = await apiGet<EntryListEntry[]>(
        `/entries/by_regatta/${Number(regattaId)}?include_waiting=1`,
        token ?? undefined
      );
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }, [regattaId, token]);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;

    (async () => {
      try {
        const list = await loadEntries();
        if (!alive) return;
        setEntries(list);
      } catch {
        if (alive) setEntries([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, loadEntries]);

  // Refrescar lista quando uma entry é guardada (vindo da página de edição)
  useEffect(() => {
    const onEntrySaved = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { regattaId?: number };
      if (d?.regattaId === regattaId && !authLoading && token) {
        loadEntries().then((list) => setEntries(list));
      }
    };
    window.addEventListener('entry-saved', onEntrySaved);
    return () => window.removeEventListener('entry-saved', onEntrySaved);
  }, [regattaId, authLoading, token, loadEntries]);

  // Refrescar quando a página volta a ficar visível (ex.: trocar de tab)
  useEffect(() => {
    const onVisible = () => {
      if (authLoading || !token) return;
      loadEntries().then((list) => setEntries(list));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [authLoading, token, loadEntries]);

  const toggleColumn = async (columnId: EntryListColumnId) => {
    if (!selectedClass || !token || !regatta) return;
    const current = getVisibleColumnsForClass(regatta?.entry_list_columns, selectedClass);
    const next = current.includes(columnId)
      ? current.filter((id) => id !== columnId)
      : [...current, columnId].sort(
          (a, b) =>
            ENTRY_LIST_COLUMNS.findIndex((c) => c.id === a) -
            ENTRY_LIST_COLUMNS.findIndex((c) => c.id === b)
        );
    const payload = columnsByClassAfterToggle(regatta?.entry_list_columns, selectedClass, next);
    setSavingColumns(true);
    try {
      const patched = await apiSend<RegattaForEntryList>(
        `/regattas/${regattaId}`,
        'PATCH',
        { entry_list_columns: payload },
        token
      );
      if (patched) onRegattaUpdate(patched);
    } catch (e: any) {
      notify.error(e?.message || 'Failed to save columns.');
    } finally {
      setSavingColumns(false);
    }
  };

  const rowColors = (e: EntryListEntry) => {
    if (e.waiting_list) {
      return { base: 'bg-slate-200 text-gray-900', hover: 'group-hover:bg-slate-300' };
    }
    const paid = !!e.paid;
    const confirmed = !!e.confirmed;
    if (paid && confirmed) {
      return { base: 'bg-green-200 text-gray-900', hover: 'group-hover:bg-green-300' };
    }
    if (!paid && !confirmed) {
      return { base: 'bg-red-200 text-gray-900', hover: 'group-hover:bg-red-300' };
    }
    return { base: 'bg-yellow-200 text-gray-900', hover: 'group-hover:bg-yellow-300' };
  };

  const goToEdit = (entryId: number) => {
    router.push(
      withOrg(`${manageRegattaBasePath}/${regattaId}/entries/${entryId}?regattaId=${regattaId}`, orgSlug)
    );
  };

  const isImportPlaceholderEmail = (email?: string | null) =>
    !!email?.trim() && /@import\.sailscore\.online$/i.test(email.trim());

  const maybeSendConfirmedEmail = async (entryId: number, nextPaid: boolean, nextConfirmed: boolean) => {
    if (!token) return;
    const currentEntry = entries.find((e) => e.id === entryId);
    if (currentEntry?.confirmed_email_sent_at) return;
    if (isImportPlaceholderEmail(currentEntry?.email)) return;
    const wasFullyConfirmed = entries.some((e) => e.id === entryId && e.paid && e.confirmed);
    const willBeFullyConfirmed = nextPaid && nextConfirmed;
    if (!willBeFullyConfirmed || wasFullyConfirmed) return;

    const ok = await confirm({
      title: 'Mark entry as paid and confirmed?',
      description:
        'A confirmation email with account access details for this championship will be sent to the sailor.',
      tone: 'warning',
      confirmLabel: 'Yes, confirm and send',
    });
    if (!ok) return;

    try {
      const res = await apiSend<{ message?: string; sent?: boolean }>(
        `/entries/${entryId}/send-confirmation-email`,
        'POST',
        {},
        token
      );
      const sent = res?.sent !== false;
      if (sent) {
        notify.success(res?.message || 'Confirmation email sent.');
      } else {
        notify.info(
          res?.message ||
            'Confirmation email was already sent previously for this entry.'
        );
      }
      const refreshed = await loadEntries();
      setEntries(refreshed);
    } catch (e: any) {
      notify.error(e?.message || 'Failed to send confirmation email.');
    }
  };

  const handleStatusChange = async (entryId: number, confirmed: boolean) => {
    if (!token) return;
    const current = entries.find((e) => e.id === entryId);
    try {
      await apiSend(`/entries/${entryId}`, 'PATCH', { confirmed }, token);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, confirmed } : e))
      );
      if (current) {
        await maybeSendConfirmedEmail(entryId, !!current.paid, confirmed);
      }
    } catch (e: any) {
      notify.error(e?.message || 'Failed to update status.');
    }
  };

  const handlePaidChange = async (entryId: number, paid: boolean) => {
    if (!token) return;
    const current = entries.find((e) => e.id === entryId);
    try {
      await apiSend(`/entries/${entryId}`, 'PATCH', { paid }, token);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, paid } : e))
      );
      if (current) {
        await maybeSendConfirmedEmail(entryId, paid, !!current.confirmed);
      }
    } catch (e: any) {
      notify.error(e?.message || 'Failed to update payment status.');
    }
  };

  const patchClassLimit = async (next: { enabled?: boolean; limit?: number | null }) => {
    if (!token || !regatta || !selectedClass) return;
    const current = regatta.online_entry_limits_by_class || {};
    const mergedForClass = {
      ...(current[selectedClass] || {}),
      ...next,
    };
    const payload = {
      ...current,
      [selectedClass]: mergedForClass,
    };
    const patched = await apiSend<RegattaForEntryList>(
      `/regattas/${regattaId}`,
      'PATCH',
      { online_entry_limits_by_class: payload },
      token
    );
    if (patched) onRegattaUpdate(patched);
  };

  const toggleClassLimitEnabled = async (nextEnabled: boolean) => {
    if (!selectedClass) return;
    setSavingLimit(true);
    try {
      await patchClassLimit({
        enabled: nextEnabled,
        // Enabling does not apply a new number automatically.
        // The limit value only becomes active after explicit Save.
        limit: classLimitCfg.limit,
      });
    } catch (e: any) {
      notify.error(e?.message || 'Failed to update class limit.');
    } finally {
      setSavingLimit(false);
    }
  };

  const saveClassLimit = async () => {
    if (!selectedClass) return;
    const n = Number(limitDraft);
    if (!limitDraft.trim() || Number.isNaN(n) || n < 0) {
      notify.warning('Limit must be 0 or a positive number.');
      return;
    }
    setSavingLimit(true);
    try {
      await patchClassLimit({ limit: n });
      notify.success('Class limit saved.');
    } catch (e: any) {
      notify.error(e?.message || 'Failed to save class limit.');
    } finally {
      setSavingLimit(false);
    }
  };

  const moveBetweenWaitingAndEntry = async (entryId: number, waiting: boolean) => {
    if (!token) return;
    setMovingEntryId(entryId);
    try {
      await apiSend(`/entries/${entryId}`, 'PATCH', { waiting_list: waiting }, token);
      const list = await loadEntries();
      setEntries(list);
    } catch (e: any) {
      notify.error(e?.message || 'Failed to update list placement.');
    } finally {
      setMovingEntryId(null);
    }
  };

  if (!canManageEntryList) return <p className="text-gray-500">Access restricted.</p>;

  return (
    <div className="space-y-5">
      {/* Seletor de colunas: definido aqui e usado apenas na lista pública */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:p-5 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-base font-semibold text-gray-800 w-full sm:w-auto">
          Public entry list columns per class{selectedClass ? ` (${selectedClass})` : ''}:
        </span>
        {!selectedClass && (
          <span className="text-sm text-amber-800 w-full">Select a class above to change the columns.</span>
        )}
        <span className="text-sm text-gray-600 w-full">
          Admin view always shows all columns; these options affect only the public entry list.
        </span>
        {ENTRY_LIST_COLUMNS.map((col) => (
          <label key={col.id} className="inline-flex items-center gap-2 cursor-pointer text-base">
            <input
              type="checkbox"
              checked={publicVisibleColumnIds.includes(col.id)}
              onChange={() => toggleColumn(col.id)}
              disabled={savingColumns || !selectedClass}
              className="rounded border-gray-300 size-4"
            />
            {col.label}
          </label>
        ))}
        {savingColumns && <span className="text-sm text-gray-500">Saving…</span>}
      </div>

      <div className="flex items-center gap-6 flex-wrap text-base text-gray-800">
        <span>
          Entries: <b>{activeEntries.length}</b>
        </span>
        <span>
          Waiting list: <b>{waitingEntries.length}</b>
        </span>
        {selectedClass && token && (
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="ml-auto px-4 py-2 rounded-lg border border-blue-600 text-blue-700 text-sm font-medium hover:bg-blue-50"
          >
            Import from URL
          </button>
        )}
      </div>

      {showImportModal && selectedClass && token && (
        <ImportEntriesModal
          regattaId={regattaId}
          className={selectedClass}
          token={token}
          onClose={() => setShowImportModal(false)}
          onImported={async () => {
            const list = await loadEntries();
            setEntries(list);
          }}
        />
      )}

      <div className="rounded-lg border border-gray-200 p-4 sm:p-5 bg-gray-50 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-base font-semibold text-gray-900">
              Class entry limit{selectedClass ? ` (${selectedClass})` : ''}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              When enabled, extra entries for this class go to waiting list.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <span className="text-base font-medium">Enabled</span>
            <button
              type="button"
              disabled={!selectedClass || savingLimit}
              onClick={() => toggleClassLimitEnabled(!classLimitCfg.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                classLimitCfg.enabled ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
              aria-pressed={classLimitCfg.enabled ? 'true' : 'false'}
              aria-label="Toggle class entry limit"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  classLimitCfg.enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-700">Max entries</span>
          <input
            type="number"
            min={0}
            step={1}
            className="border rounded px-3 py-2 w-28"
            value={limitDraft}
            disabled={!selectedClass || !classLimitCfg.enabled}
            onChange={(e) => setLimitDraft(e.target.value)}
          />
          <button
            type="button"
            disabled={!selectedClass || !classLimitCfg.enabled || savingLimit}
            onClick={saveClassLimit}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-base font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {savingLimit ? 'Saving…' : 'Save'}
          </button>
        </div>
        {classLimitCfg.enabled && (
          <p className="text-sm text-gray-600">
            The limit is only applied after you click Save.
          </p>
        )}
        {showWaitingListActions && (
          <p className="text-sm text-gray-700 leading-relaxed">
            With an active entry limit (per class or regatta-wide), use the Actions column to move sailors between
            the entry list and the waiting list. Promoting from waiting is blocked when the entry list is full.
          </p>
        )}
      </div>

      {activeEntries.length === 0 && waitingEntries.length === 0 ? (
        <p className="text-gray-500">There are no entries for this class yet.</p>
      ) : (
        <div className="space-y-6">
          {activeEntries.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
              <table className="w-full table-auto border-collapse text-base leading-snug text-slate-800">
                <thead className="bg-slate-50/95 text-left">
                  <tr>
                    {adminVisibleColumnIds.map((id) => {
                      const def = ENTRY_LIST_COLUMNS.find((c) => c.id === id);
                      return (
                        <th
                          key={id}
                          className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 border-b border-slate-200 ${
                            id === 'paid' || id === 'status' ? 'text-center' : 'text-left'
                          } ${isPublicColumnVisible(id) ? '' : 'bg-slate-100/90 text-slate-600'}`}
                        >
                          {def?.label ?? id}
                          {!isPublicColumnVisible(id) && (
                            <span className="ml-1 block sm:inline text-[10px] font-normal normal-case tracking-normal text-slate-500">
                              (hidden on public)
                            </span>
                          )}
                        </th>
                      );
                    })}
                    {showWaitingListActions && (
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 border-b border-slate-200 text-center w-[11rem]">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeEntries.map((entry) => {
                    const c = rowColors(entry);
                    const cell = `p-3 border-b border-slate-100 ${c.base} ${c.hover} transition-colors`;
                    return (
                      <tr key={entry.id} onClick={() => goToEdit(entry.id)} className="group cursor-pointer">
                      {adminVisibleColumnIds.map((colId) => (
                        <td
                          key={colId}
                          className={`${cell} ${colId === 'paid' || colId === 'status' ? 'text-center' : ''} ${
                            isPublicColumnVisible(colId) ? '' : 'bg-slate-50/90 text-slate-700'
                          }`}
                        >
                          <EntryListCell
                            entry={entry}
                            columnId={colId}
                            onStatusChange={colId === 'status' && !entry.waiting_list ? handleStatusChange : undefined}
                            onPaidChange={colId === 'paid' && !entry.waiting_list ? handlePaidChange : undefined}
                          />
                        </td>
                      ))}
                      {showWaitingListActions && (
                        <td
                          className={`${cell} align-middle text-center`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="text-sm px-3 py-1.5 rounded-md bg-slate-700 text-white font-medium hover:bg-slate-800 disabled:opacity-50"
                            disabled={movingEntryId === entry.id}
                            onClick={() => moveBetweenWaitingAndEntry(entry.id, true)}
                          >
                            To waiting list
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}

          {waitingEntries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Waiting list ({waitingEntries.length})
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <table className="w-full table-auto border-collapse text-base leading-snug text-slate-800">
                  <thead className="bg-slate-50/95 text-left">
                    <tr>
                      {adminVisibleColumnIds.map((id) => {
                        const def = ENTRY_LIST_COLUMNS.find((c) => c.id === id);
                        return (
                          <th
                            key={id}
                            className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 border-b border-slate-200 ${
                              id === 'paid' || id === 'status' ? 'text-center' : 'text-left'
                            } ${isPublicColumnVisible(id) ? '' : 'bg-slate-100/90 text-slate-600'}`}
                          >
                            {def?.label ?? id}
                            {!isPublicColumnVisible(id) && (
                              <span className="ml-1 block sm:inline text-[10px] font-normal normal-case tracking-normal text-slate-500">
                                (hidden on public)
                              </span>
                            )}
                          </th>
                        );
                      })}
                      {showWaitingListActions && (
                        <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 border-b border-slate-200 text-center w-[11rem]">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {waitingEntries.map((entry) => {
                      const c = rowColors(entry);
                      const cell = `p-3 border-b border-slate-100 ${c.base} ${c.hover} transition-colors`;
                    const blocked = entryListAtCapacity;
                    return (
                      <tr key={entry.id} onClick={() => goToEdit(entry.id)} className="group cursor-pointer">
                        {adminVisibleColumnIds.map((colId) => (
                          <td
                            key={colId}
                            className={`${cell} ${colId === 'paid' || colId === 'status' ? 'text-center' : ''} ${
                              isPublicColumnVisible(colId) ? '' : 'bg-slate-50/90 text-slate-700'
                            }`}
                          >
                            <EntryListCell
                              entry={entry}
                              columnId={colId}
                              onStatusChange={undefined}
                              onPaidChange={undefined}
                            />
                          </td>
                        ))}
                        {showWaitingListActions && (
                          <td
                            className={`${cell} align-middle text-center`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="text-sm px-3 py-1.5 rounded-md bg-emerald-700 text-white font-medium hover:bg-emerald-800 disabled:opacity-50"
                              title={
                                blocked
                                  ? 'Entry list is full for this class (or regatta). Free a slot or raise the limit.'
                                  : undefined
                              }
                              disabled={movingEntryId === entry.id || blocked}
                              onClick={() => moveBetweenWaitingAndEntry(entry.id, false)}
                            >
                              To entry list
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
