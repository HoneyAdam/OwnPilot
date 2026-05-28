/**
 * InferredFactsPanel — audit + delete UI for AI-inferred profile facts.
 *
 * The profile-learning loop writes facts to the personal_data store with
 * source='ai_inferred' whenever the gateway processes a scheduled
 * profile_learn trigger. Without a surface to review them, the user
 * never sees what the AI assumed about them — a privacy issue for a
 * privacy-first product. This panel lists them grouped by category and
 * lets the user delete any entry they disagree with.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { profileApi, type InferredProfileEntry } from '../../api/endpoints/profile';
import { useToast } from '../../components/ToastProvider';
import { Check, Trash2 } from '../../components/icons';

interface Props {
  /** Optional callback fired after a successful delete (e.g. to refresh parent profile). */
  onChange?: () => void;
}

export function InferredFactsPanel({ onChange }: Props) {
  const toast = useToast();
  const [entries, setEntries] = useState<InferredProfileEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [pendingConfirmKey, setPendingConfirmKey] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await profileApi.listInferred();
      setEntries(data.entries);
    } catch {
      setEntries([]);
      toast.error('Failed to load inferred profile entries');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const grouped = useMemo(() => {
    const out = new Map<string, InferredProfileEntry[]>();
    for (const e of entries ?? []) {
      const list = out.get(e.category) ?? [];
      list.push(e);
      out.set(e.category, list);
    }
    return Array.from(out.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  const handleDelete = useCallback(
    async (entry: InferredProfileEntry) => {
      const composite = `${entry.category}:${entry.key}`;
      setPendingDeleteKey(composite);
      try {
        await profileApi.deleteData(entry.category, entry.key);
        setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? null);
        toast.success(`Removed inferred entry "${entry.key}"`);
        onChange?.();
      } catch {
        toast.error('Failed to delete entry');
      } finally {
        setPendingDeleteKey(null);
      }
    },
    [onChange, toast]
  );

  const handleConfirm = useCallback(
    async (entry: InferredProfileEntry) => {
      const composite = `${entry.category}:${entry.key}`;
      setPendingConfirmKey(composite);
      try {
        await profileApi.confirmInferred(entry.category, entry.key);
        // Promoted out of ai_inferred → drop from this panel.
        setEntries((prev) => prev?.filter((e) => e.id !== entry.id) ?? null);
        toast.success(`Confirmed "${entry.key}"`);
        onChange?.();
      } catch {
        toast.error('Failed to confirm entry');
      } finally {
        setPendingConfirmKey(null);
      }
    },
    [onChange, toast]
  );

  if (isLoading) {
    return (
      <p className="text-sm text-text-muted dark:text-dark-text-muted py-4 text-center">
        Loading inferred entries...
      </p>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="py-4 text-center space-y-1">
        <p className="text-sm text-text-muted dark:text-dark-text-muted">
          No inferred entries yet.
        </p>
        <p className="text-xs text-text-muted dark:text-dark-text-muted">
          Anything the profile-learning loop guesses from your conversations will appear here for
          you to review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted dark:text-dark-text-muted">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} the AI inferred from your
          conversations. User-stated facts are never overwritten and not shown here.
        </p>
        <button
          onClick={fetchEntries}
          className="text-xs text-primary hover:underline"
          aria-label="Refresh inferred entries"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {grouped.map(([category, items]) => (
          <div
            key={category}
            className="border border-border dark:border-dark-border rounded-lg overflow-hidden"
          >
            <div className="px-3 py-1.5 bg-bg-secondary dark:bg-dark-bg-secondary text-xs font-medium text-text-muted dark:text-dark-text-muted uppercase">
              {category}{' '}
              <span className="font-normal text-text-muted dark:text-dark-text-muted">
                ({items.length})
              </span>
            </div>
            <ul className="divide-y divide-border dark:divide-dark-border">
              {items.map((e) => {
                const composite = `${e.category}:${e.key}`;
                const deletePending = pendingDeleteKey === composite;
                const confirmPending = pendingConfirmKey === composite;
                const busy = deletePending || confirmPending;
                const confidencePct = Math.round(e.confidence * 100);
                return (
                  <li
                    key={e.id}
                    className="px-3 py-2 flex items-center gap-3 text-sm hover:bg-bg-secondary dark:hover:bg-dark-bg-secondary"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-muted dark:text-dark-text-muted">
                          {e.key}
                        </span>
                        <span className="text-text-primary dark:text-dark-text-primary truncate">
                          {e.value}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted dark:text-dark-text-muted mt-0.5">
                        <span
                          className={
                            confidencePct >= 80
                              ? 'text-success'
                              : confidencePct >= 50
                                ? 'text-warning'
                                : 'text-danger'
                          }
                        >
                          {confidencePct}% confident
                        </span>
                        <span>·</span>
                        <span>{new Date(e.updatedAt).toLocaleString()}</span>
                        {e.sensitive && (
                          <>
                            <span>·</span>
                            <span className="text-danger">sensitive</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleConfirm(e)}
                      disabled={busy}
                      className="p-1.5 text-text-muted hover:text-success disabled:opacity-50"
                      aria-label={`Confirm inferred entry ${e.key}`}
                      title="Confirm — promote to user-confirmed so learning won't change it"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(e)}
                      disabled={busy}
                      className="p-1.5 text-text-muted hover:text-danger disabled:opacity-50"
                      aria-label={`Delete inferred entry ${e.key}`}
                      title="Delete this inferred entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
