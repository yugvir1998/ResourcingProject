'use client';

import { useState, useEffect, Fragment, useMemo, useId } from 'react';
import type { Employee, EmployeeAllocations, ScenarioTag } from '@/types';
import { PEOPLE_TAG_OPTIONS } from '@/types';
import { MAX_PEOPLE_TAG_LENGTH, normalizePeopleTag } from '@/lib/people-tags';
import { useToast } from '@/components/Toast';
import { VENTURE_CREATION, STUDIO_ADMINISTRATION, DEFAULT_ALLOCATIONS } from '@/lib/allocations';

const AVATAR_COLORS = [
  'border-emerald-400 bg-emerald-50 text-emerald-700',
  'border-blue-400 bg-blue-50 text-blue-700',
  'border-violet-400 bg-violet-50 text-violet-700',
  'border-amber-400 bg-amber-50 text-amber-700',
  'border-rose-400 bg-rose-50 text-rose-700',
  'border-cyan-400 bg-cyan-50 text-cyan-700',
  'border-indigo-400 bg-indigo-50 text-indigo-700',
  'border-teal-400 bg-teal-50 text-teal-700',
];

const ALLOCATION_COLORS: Record<string, string> = {
  access: 'border-emerald-400 bg-emerald-50',
  explore: 'border-[#80E3D1] bg-[#80E3D1]/20',
  shape: 'border-[#9F6AE2] bg-[#9F6AE2]/20',
  build: 'border-[#4A7AFF] bg-[#4A7AFF]/20',
  spin_out: 'border-[#FFA166] bg-[#FFA166]/20',
  support: 'border-cyan-400 bg-cyan-50',
  fundraising: 'border-indigo-400 bg-indigo-50',
  finance_accounting: 'border-teal-400 bg-teal-50',
  legal: 'border-slate-400 bg-slate-50',
  marketing_growth: 'border-pink-400 bg-pink-50',
  operations: 'border-orange-400 bg-orange-50',
  hiring: 'border-lime-400 bg-lime-50',
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function AllocationBar({ allocations }: { allocations: EmployeeAllocations | null | undefined }) {
  const segments = useMemo(() => {
    if (!allocations) return [];
    return Object.entries(allocations)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, val]) => ({ key, val, color: ALLOCATION_COLORS[key] || 'bg-zinc-400' }));
  }, [allocations]);

  const total = segments.reduce((s, x) => s + x.val, 0);
  if (total === 0) return <div className="h-2 w-24 rounded-full bg-zinc-100" title="No allocations" />;

  return (
    <div className="flex h-3 w-32 overflow-hidden rounded-full border border-zinc-200 bg-zinc-50" title={`Total: ${total}%`}>
      {segments.map(({ key, val, color }) => (
        <div
          key={key}
          className={`${color} transition-all`}
          style={{ width: `${(val / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function AllocationChips({ allocations }: { allocations: EmployeeAllocations | null | undefined }) {
  const items = useMemo(() => {
    if (!allocations) return [];
    return Object.entries(allocations)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [allocations]);

  if (items.length === 0) return <span className="text-sm text-zinc-400">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([key, val]) => (
        <span
          key={key}
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ALLOCATION_COLORS[key] || 'border-zinc-300 bg-zinc-50'} text-zinc-700`}
        >
          {key.replace(/_/g, ' ')} {val}%
        </span>
      ))}
      {Object.values(allocations || {}).filter((v) => v > 0).length > 5 && (
        <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
          +{Object.values(allocations || {}).filter((v) => v > 0).length - 5}
        </span>
      )}
    </div>
  );
}

function RoleTagField({
  value,
  onChange,
  placeholder = 'e.g. Engineer or a custom label',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const listId = useId();
  return (
    <div className="space-y-1">
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MAX_PEOPLE_TAG_LENGTH}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      <datalist id={listId}>
        {PEOPLE_TAG_OPTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <p className="text-xs text-zinc-500">
        Use a suggestion or type your own (max {MAX_PEOPLE_TAG_LENGTH} characters). Leave empty for unassigned.
      </p>
    </div>
  );
}

export function TeamRoster() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    title: string;
    scenario_tag: ScenarioTag;
    people_tag: string;
    allocations: EmployeeAllocations;
  }>({
    name: '',
    title: '',
    scenario_tag: 'potential_hire',
    people_tag: '',
    allocations: { ...DEFAULT_ALLOCATIONS },
  });
  const [editingAllocations, setEditingAllocations] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EmployeeAllocations>({});
  const [editDraftName, setEditDraftName] = useState('');
  const [editDraftTitle, setEditDraftTitle] = useState('');
  const [editDraftTag, setEditDraftTag] = useState<ScenarioTag>('nitwit');
  const [editDraftPeopleTag, setEditDraftPeopleTag] = useState('');
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const toast = useToast();

  const fetchEmployees = async () => {
    const res = await fetch('/api/employees');
    const data = await res.json();
    setEmployees(data);
  };

  useEffect(() => {
    fetchEmployees();
    setLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const tagTrim = form.people_tag.trim();
    if (tagTrim.length > MAX_PEOPLE_TAG_LENGTH) {
      setFormError(`Role tag must be at most ${MAX_PEOPLE_TAG_LENGTH} characters`);
      setSubmitting(false);
      return;
    }
    const payload = {
      name: form.name.trim(),
      title: form.title.trim(),
      scenario_tag: form.scenario_tag,
      people_tag: normalizePeopleTag(form.people_tag),
      allocations: form.allocations,
    };
    const optimistic: Employee = {
      id: -Date.now(),
      ...payload,
      created_at: new Date().toISOString(),
    };
    setEmployees((prev) => [...prev, optimistic].sort((a, b) => a.name.localeCompare(b.name)));
    setForm({
      name: '',
      title: '',
      scenario_tag: 'potential_hire',
      people_tag: '',
      allocations: { ...DEFAULT_ALLOCATIONS },
    });
    setShowForm(false);

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setEmployees((prev) => prev.map((e) => (e.id === optimistic.id ? data : e)));
      toast.show('Employee added');
    } else {
      setEmployees((prev) => prev.filter((e) => e.id !== optimistic.id));
      setFormError(data.error || 'Failed to add employee');
      setShowForm(true);
    }
  };

  const updateEmployee = async (id: number, updates: Partial<Employee>): Promise<boolean> => {
    const prev = employees.find((e) => e.id === id);
    if (prev) {
      setEmployees((prevList) =>
        prevList.map((e) => (e.id === id ? { ...e, ...updates } : e))
      );
    }
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setEmployees((prevList) => prevList.map((e) => (e.id === id ? updated : e)));
      return true;
    }
    if (prev) {
      setEmployees((prevList) => prevList.map((e) => (e.id === id ? prev : e)));
    }
    let message = 'Could not save changes';
    try {
      const err = await res.json();
      if (err.error) message = typeof err.error === 'string' ? err.error : message;
    } catch {
      /* ignore */
    }
    toast.show(message);
    return false;
  };

  const handleDelete = async (e: Employee) => {
    setEmployees((prev) => prev.filter((x) => x.id !== e.id));
    const res = await fetch(`/api/employees/${e.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setEmployees((prev) => [...prev, e].sort((a, b) => a.name.localeCompare(b.name)));
      toast.show('Failed to remove employee');
    } else {
      toast.show('Employee removed');
    }
  };

  const handleImport = async () => {
    setImportError(null);
    setImporting(true);
    try {
      const res = await fetch('/api/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchEmployees();
        toast.show(`Import complete. Created: ${data.created?.length || 0}, Updated: ${data.updated?.length || 0}`);
      } else {
        setImportError(data.error || 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  };

  const getAllocationsSum = (a: EmployeeAllocations | null | undefined) => {
    if (!a) return 0;
    return Object.values(a).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
  };

  const AllocationEditor = ({
    allocations,
    onChange,
  }: {
    allocations: EmployeeAllocations;
    onChange: (a: EmployeeAllocations) => void;
  }) => (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="rounded-xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/50">
        <h4 className="mb-3 text-sm font-semibold text-zinc-800">Venture Creation</h4>
        <div className="grid gap-3">
          {VENTURE_CREATION.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="min-w-[7rem] text-sm font-medium text-zinc-800">{label}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={allocations[key] ?? 0}
                onChange={(e) => onChange({ ...allocations, [key]: parseInt(e.target.value, 10) || 0 })}
                className="w-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <span className="text-sm font-medium text-zinc-600">%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-zinc-50/80 p-4 ring-1 ring-zinc-200/50">
        <h4 className="mb-3 text-sm font-semibold text-zinc-800">Studio Administration</h4>
        <div className="grid gap-3">
          {STUDIO_ADMINISTRATION.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="min-w-[7rem] text-sm font-medium text-zinc-800">{label}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={allocations[key] ?? 0}
                onChange={(e) => onChange({ ...allocations, [key]: parseInt(e.target.value, 10) || 0 })}
                className="w-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <span className="text-sm font-medium text-zinc-600">%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 animate-pulse rounded bg-zinc-200" />
          <div className="flex gap-2">
            <div className="h-10 w-40 animate-pulse rounded-lg bg-zinc-200" />
            <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="divide-y divide-zinc-100 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 py-4">
                <div className="h-5 w-32 animate-pulse rounded bg-zinc-100" />
                <div className="h-5 w-24 animate-pulse rounded bg-zinc-100" />
                <div className="h-5 flex-1 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Team roster</h2>
          <p className="mt-0.5 text-sm text-zinc-500">20–25 employees · Manage allocations</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          {importError && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
              {importError}
            </div>
          )}
          <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {importing ? 'Importing…' : 'Import'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {showForm ? 'Cancel' : 'Add employee'}
          </button>
          </div>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-zinc-900/5"
        >
          {formError && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {formError}
            </p>
          )}
          <div className="mb-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-800">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  placeholder="e.g. Yugvir"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-800">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  placeholder="e.g. Venture Lead"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-1.5 block text-sm font-medium text-zinc-800">Hire status</label>
                <select
                  value={form.scenario_tag}
                  onChange={(e) => setForm((f) => ({ ...f, scenario_tag: e.target.value as ScenarioTag }))}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="nitwit">NITWIT (current hire)</option>
                  <option value="potential_hire">Potential hire</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-800">Role tag</label>
              <RoleTagField value={form.people_tag} onChange={(v) => setForm((f) => ({ ...f, people_tag: v }))} />
            </div>
          </div>
          <div className="mb-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-800">
              Allocations (%) — Total: {getAllocationsSum(form.allocations)}%
            </h3>
            <AllocationEditor
                          allocations={form.allocations}
                          onChange={(a) =>
                            setForm((f) => ({
                              ...f,
                              allocations: { ...DEFAULT_ALLOCATIONS, ...f.allocations, ...a } as typeof DEFAULT_ALLOCATIONS,
                            }))
                          }
                        />
            {getAllocationsSum(form.allocations) > 100 && (
              <p className="mt-2 text-sm font-medium text-amber-600">
                {form.name.trim() ? `${form.name.trim()}'s` : "This person's"} allocations are exceeding 100%.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-70"
          >
            Add employee
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ring-1 ring-zinc-900/5">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Title</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Role tag</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Allocations</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-20 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-5">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200/80 opacity-60" />
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="19" y1="8" x2="19" y2="14" />
                          <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-zinc-900">No team members yet</p>
                      <p className="mt-1.5 text-sm text-zinc-500">Import from spreadsheet or add your first employee to get started</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowForm(true)}
                        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
                      >
                        Add employee
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={importing}
                        className="rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              employees.map((e) => (
                <Fragment key={e.id}>
                  <tr key="main" className="group transition hover:bg-zinc-50/80">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${getAvatarColor(e.name)}`}
                        >
                          {getInitials(e.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-zinc-900">{e.name}</span>
                          {e.scenario_tag === 'potential_hire' && (
                            <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200/50">
                              Potential hire
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-600">{e.title || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-zinc-600">
                      {e.people_tag ? (
                        <span className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {e.people_tag}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {editingAllocations === e.id ? (
                        <span className="text-sm text-zinc-500">Editing…</span>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <AllocationBar allocations={e.allocations} />
                            <span className="text-sm font-semibold text-zinc-800 tabular-nums">
                              {getAllocationsSum(e.allocations)}%
                            </span>
                          </div>
                          <AllocationChips allocations={e.allocations} />
                          {getAllocationsSum(e.allocations) > 100 && (
                            <p className="text-xs font-medium text-amber-600">
                              {e.name}&apos;s allocations are exceeding 100%.
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditDraft({ ...DEFAULT_ALLOCATIONS, ...(e.allocations || {}) });
                            setEditDraftName(e.name);
                            setEditDraftTitle(e.title || '');
                            setEditDraftTag((e.scenario_tag as ScenarioTag) || 'nitwit');
                            setEditDraftPeopleTag(e.people_tag ?? '');
                            setEditingAllocations(e.id);
                          }}
                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Remove this employee?')) {
                            await handleDelete(e);
                          }
                        }}
                        className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                {editingAllocations === e.id && (
                  <tr key={`${e.id}-edit`}>
                    <td colSpan={5} className="bg-zinc-50/30 px-5 py-4">
                      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ring-1 ring-zinc-900/5">
                        <div className="mb-4 space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-zinc-800">Name</label>
                              <input
                                type="text"
                                value={editDraftName}
                                onChange={(e) => setEditDraftName(e.target.value)}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                                placeholder="Employee name"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-zinc-800">Title</label>
                              <input
                                type="text"
                                value={editDraftTitle}
                                onChange={(e) => setEditDraftTitle(e.target.value)}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                                placeholder="e.g. Venture Lead"
                              />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-1">
                              <label className="mb-1.5 block text-sm font-medium text-zinc-800">Hire status</label>
                              <select
                                value={editDraftTag}
                                onChange={(e) => setEditDraftTag(e.target.value as ScenarioTag)}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                              >
                                <option value="nitwit">NITWIT (current hire)</option>
                                <option value="potential_hire">Potential hire</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-800">Role tag</label>
                            <RoleTagField
                              value={editDraftPeopleTag}
                              onChange={setEditDraftPeopleTag}
                              placeholder="Role tag or custom label"
                            />
                          </div>
                        </div>
                        <div className="mb-4">
                          <h3 className="mb-3 text-sm font-semibold text-zinc-800">
                            Allocations (%) — Total: {getAllocationsSum(editDraft)}%
                          </h3>
                          <AllocationEditor allocations={editDraft} onChange={setEditDraft} />
                          {getAllocationsSum(editDraft) > 100 && (
                            <p className="mt-2 text-sm font-medium text-amber-600">
                              {(editDraftName || e.name).trim() ? `${(editDraftName || e.name).trim()}'s` : "This person's"} allocations are exceeding 100%.
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={async () => {
                              if (!editDraftName.trim()) return;
                              if (editDraftPeopleTag.trim().length > MAX_PEOPLE_TAG_LENGTH) {
                                toast.show(`Role tag must be at most ${MAX_PEOPLE_TAG_LENGTH} characters`);
                                return;
                              }
                              const ok = await updateEmployee(e.id, {
                                name: editDraftName.trim(),
                                title: editDraftTitle.trim(),
                                scenario_tag: editDraftTag,
                                people_tag: normalizePeopleTag(editDraftPeopleTag),
                                allocations: editDraft,
                              });
                              if (ok) {
                                setEditingAllocations(null);
                                toast.show('Saved');
                              }
                            }}
                            disabled={!editDraftName.trim()}
                            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingAllocations(null);
                              setEditDraft({});
                            }}
                            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
