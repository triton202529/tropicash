import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  fetchDeveloperEvents,
} from "../../lib/developerEventRegistry";

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";
const searchClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  const map = {
    available: "border-emerald-200 bg-emerald-50 text-emerald-900",
    planned: "border-amber-200 bg-amber-50 text-amber-950",
    internal: "border-slate-200 bg-slate-100 text-slate-600",
  };
  const cls = map[s] || "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}

function categoryBadge(category) {
  return (
    <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
      {category || "—"}
    </span>
  );
}

function SummaryCard({ title, value, icon }) {
  return (
    <article className="tropicash-surface flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {icon ? (
          <span aria-hidden className="text-lg leading-none">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {value ?? "—"}
      </p>
    </article>
  );
}

function EventDetailsDrawer({ event, onClose }) {
  if (!event) return null;
  let prettyPayload = "{}";
  try {
    prettyPayload = JSON.stringify(event.sample_payload ?? {}, null, 2);
  } catch {
    prettyPayload = String(event.sample_payload ?? "{}");
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button
        type="button"
        aria-label="Close details"
        className="flex-1 cursor-default"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-drawer-heading"
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="event-drawer-heading" className="font-mono text-lg font-bold text-slate-900">
            {event.event_name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {categoryBadge(event.category)}
          {statusBadge(event.status)}
        </div>

        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-slate-700">Description</dt>
            <dd className="mt-1 text-slate-600">{event.description || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Available Since</dt>
            <dd className="mt-1 text-slate-600">{formatWhen(event.available_since)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Sample Payload</dt>
            <dd className="mt-1">
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-800">
                {prettyPayload}
              </pre>
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export default function DevConsoleEventsPage() {
  const { user, loading: authLoading } = useUser();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const { data, error } = await fetchDeveloperEvents();
    if (error) {
      setLoadError(error.message || "Could not load the event registry.");
      setEvents([]);
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const total = events.length;
    const available = events.filter((e) => e.status === "available").length;
    const planned = events.filter((e) => e.status === "planned").length;
    const categories = new Set(events.map((e) => e.category)).size;
    return { total, available, planned, categories };
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (q) {
        const haystack = `${e.event_name} ${e.description || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, search, categoryFilter, statusFilter]);

  if (authLoading) {
    return (
      <DevConsoleLayout title="Event Registry" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="Event Registry" subtitle="Sign in to browse the event registry.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  return (
    <DevConsoleLayout
      title="Event Registry"
      subtitle="The single source of truth for Tropicash events available through webhooks, APIs, and future integrations."
    >
      <EventDetailsDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      {/* Summary cards */}
      <section
        aria-labelledby="events-summary-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
      >
        <h2 id="events-summary-heading" className="sr-only">
          Event registry summary
        </h2>
        <SummaryCard title="Total Events" value={loading ? "…" : summary.total} icon="📚" />
        <SummaryCard title="Available Events" value={loading ? "…" : summary.available} icon="✅" />
        <SummaryCard title="Planned Events" value={loading ? "…" : summary.planned} icon="🗓️" />
        <SummaryCard title="Categories" value={loading ? "…" : summary.categories} icon="🗂️" />
      </section>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}{" "}
          <span className="text-slate-600">
            Run{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_event_registry_phase12e.sql
            </code>{" "}
            if the registry table is missing.
          </span>
        </p>
      ) : null}

      {/* Filters */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="events-filters-heading">
        <h2 id="events-filters-heading" className="text-lg font-bold text-slate-900">
          Browse events
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label htmlFor="event-search" className="sr-only">
              Search events
            </label>
            <input
              id="event-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event name or description…"
              className={searchClass}
            />
          </div>
          <div>
            <label htmlFor="category-filter" className="sr-only">
              Filter by category
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="all">All categories</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="all">All statuses</option>
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading…</p>
        ) : filtered.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Event Name</th>
                  <th className="pb-2 pr-3 font-semibold">Category</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedEvent(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setSelectedEvent(e);
                      }
                    }}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <td className="py-2 pr-3">
                      <code className="text-xs font-semibold text-slate-900">{e.event_name}</code>
                    </td>
                    <td className="py-2 pr-3">{categoryBadge(e.category)}</td>
                    <td className="py-2 pr-3">{statusBadge(e.status)}</td>
                    <td className="py-2 text-slate-600">{e.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No events match your filters.</p>
        )}
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/webhooks" className="font-semibold text-tropicash-green-hover underline">
          Webhooks
        </Link>
        {" · "}
        <Link href="/dev-console/credentials" className="font-semibold text-tropicash-green-hover underline">
          API Credentials
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
