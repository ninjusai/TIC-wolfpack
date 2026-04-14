import type { Component } from "solid-js";
import { For, Show, createSignal, createMemo, onMount } from "solid-js";
import { useDb } from "../contexts/DbContext";
import type {
  ReportRow,
  TaskRow,
  SessionRow,
  AgentRow,
  QueryResult,
} from "../types";

/* ───────────── Tab Types ───────────── */

type TabId = "reports" | "tasks" | "sessions" | "agents";

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: "reports", label: "Reports", icon: "\u{1F4CB}" },
  { id: "tasks", label: "Tasks", icon: "\u{1F4CC}" },
  { id: "sessions", label: "Session Log", icon: "\u{1F4DD}" },
  { id: "agents", label: "Agents", icon: "\u{1F43A}" },
];

/* ───────────── Reusable Filter Bar ───────────── */

interface FilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  agentFilter: string;
  onAgentFilter: (value: string) => void;
  statusFilter: string;
  onStatusFilter: (value: string) => void;
  showAgent: boolean;
  showStatus: boolean;
  agents: string[];
  statuses: string[];
  showing: number;
  total: number;
}

const FilterBar: Component<FilterBarProps> = (props) => {
  return (
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <input
        type="text"
        placeholder="Search..."
        value={props.search}
        onInput={(e) => props.onSearch(e.currentTarget.value)}
        class="bg-bg border border-border rounded px-3 py-1.5 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent w-56"
      />
      <Show when={props.showAgent}>
        <select
          value={props.agentFilter}
          onChange={(e) => props.onAgentFilter(e.currentTarget.value)}
          class="bg-bg border border-border rounded px-3 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="">All Agents</option>
          <For each={props.agents}>
            {(agent) => <option value={agent}>{agent}</option>}
          </For>
        </select>
      </Show>
      <Show when={props.showStatus}>
        <select
          value={props.statusFilter}
          onChange={(e) => props.onStatusFilter(e.currentTarget.value)}
          class="bg-bg border border-border rounded px-3 py-1.5 text-sm text-text focus:outline-none focus:border-accent"
        >
          <option value="">All Statuses</option>
          <For each={props.statuses}>
            {(status) => <option value={status}>{status}</option>}
          </For>
        </select>
      </Show>
      <span class="text-xs text-text-dim ml-auto">
        Showing {props.showing} of {props.total}
      </span>
    </div>
  );
};

/* ───────────── Empty State ───────────── */

const EmptyState: Component = () => {
  return (
    <div class="text-center py-12">
      <p class="text-text-dim text-sm">No records found</p>
    </div>
  );
};

/* ───────────── Generic Data Table ───────────── */

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => string;
  mono?: boolean;
}

function DataTable<T>(props: { columns: Column<T>[]; rows: T[] }): ReturnType<Component> {
  return (
    <div class="overflow-x-auto border border-border rounded-lg">
      <Show when={props.rows.length > 0} fallback={<EmptyState />}>
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-border">
              <For each={props.columns}>
                {(col) => (
                  <th class="px-4 py-2.5 text-xs font-semibold text-text-dim uppercase tracking-wide bg-surface">
                    {col.label}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(row, i) => (
                <tr
                  class={`border-b border-border last:border-b-0 hover:bg-white/5 transition-colors ${
                    i() % 2 === 0 ? "bg-surface" : "bg-bg"
                  }`}
                >
                  <For each={props.columns}>
                    {(col) => (
                      <td
                        class={`px-4 py-2.5 text-sm ${
                          col.mono ? "font-mono text-text-dim" : "text-text"
                        }`}
                      >
                        {col.render(row)}
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}

/* ───────────── Tab: Reports ───────────── */

const REPORT_COLUMNS: Column<ReportRow>[] = [
  { key: "id", label: "ID", render: (r) => String(r.id), mono: true },
  { key: "agent", label: "Agent", render: (r) => r.agent },
  { key: "subject", label: "Subject", render: (r) => r.subject, mono: true },
  { key: "status", label: "Status", render: (r) => r.status },
  { key: "summary", label: "Summary", render: (r) => r.summary },
  { key: "timestamp", label: "Timestamp", render: (r) => r.timestamp, mono: true },
];

const ReportsTab: Component = () => {
  const { queryReports } = useDb();
  const [search, setSearch] = createSignal("");
  const [agentFilter, setAgentFilter] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("");
  const [rows, setRows] = createSignal<ReportRow[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);

  const fetchData = async () => {
    const result = await queryReports({
      search: search() || undefined,
      agent: agentFilter() || undefined,
      status: statusFilter() || undefined,
    });
    setRows(result.rows);
    setTotalCount(result.totalCount);
  };

  onMount(fetchData);

  // Re-fetch on filter change
  const agents = createMemo(() => [...new Set(rows().map((r) => r.agent))].sort());
  const statuses = createMemo(() => [...new Set(rows().map((r) => r.status))].sort());

  // Client-side filter for search (since we fetch all initially for mock)
  const filtered = createMemo(() => {
    let data = rows();
    const s = search().toLowerCase();
    if (s) data = data.filter((r) => r.subject.toLowerCase().includes(s) || r.summary.toLowerCase().includes(s));
    if (agentFilter()) data = data.filter((r) => r.agent === agentFilter());
    if (statusFilter()) data = data.filter((r) => r.status === statusFilter());
    return data;
  });

  return (
    <>
      <FilterBar
        search={search()}
        onSearch={setSearch}
        agentFilter={agentFilter()}
        onAgentFilter={setAgentFilter}
        statusFilter={statusFilter()}
        onStatusFilter={setStatusFilter}
        showAgent
        showStatus
        agents={agents()}
        statuses={statuses()}
        showing={filtered().length}
        total={totalCount()}
      />
      <DataTable columns={REPORT_COLUMNS} rows={filtered()} />
    </>
  );
};

/* ───────────── Tab: Tasks ───────────── */

const TASK_COLUMNS: Column<TaskRow>[] = [
  { key: "taskId", label: "Task ID", render: (r) => r.taskId, mono: true },
  { key: "agent", label: "Agent", render: (r) => r.agent },
  { key: "description", label: "Description", render: (r) => r.description },
  { key: "status", label: "Status", render: (r) => r.status },
  { key: "priority", label: "Priority", render: (r) => String(r.priority) },
  { key: "timestamp", label: "Timestamp", render: (r) => r.timestamp, mono: true },
];

const TasksTab: Component = () => {
  const { queryTasks } = useDb();
  const [search, setSearch] = createSignal("");
  const [agentFilter, setAgentFilter] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("");
  const [rows, setRows] = createSignal<TaskRow[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);

  onMount(async () => {
    const result = await queryTasks({});
    setRows(result.rows);
    setTotalCount(result.totalCount);
  });

  const agents = createMemo(() => [...new Set(rows().map((t) => t.agent))].sort());
  const statuses = createMemo(() => [...new Set(rows().map((t) => t.status))].sort());

  const filtered = createMemo(() => {
    let data = rows();
    const s = search().toLowerCase();
    if (s) data = data.filter((t) => t.taskId.toLowerCase().includes(s) || t.description.toLowerCase().includes(s));
    if (agentFilter()) data = data.filter((t) => t.agent === agentFilter());
    if (statusFilter()) data = data.filter((t) => t.status === statusFilter());
    return data;
  });

  return (
    <>
      <FilterBar
        search={search()}
        onSearch={setSearch}
        agentFilter={agentFilter()}
        onAgentFilter={setAgentFilter}
        statusFilter={statusFilter()}
        onStatusFilter={setStatusFilter}
        showAgent
        showStatus
        agents={agents()}
        statuses={statuses()}
        showing={filtered().length}
        total={totalCount()}
      />
      <DataTable columns={TASK_COLUMNS} rows={filtered()} />
    </>
  );
};

/* ───────────── Tab: Session Log ───────────── */

const SESSION_COLUMNS: Column<SessionRow>[] = [
  { key: "id", label: "ID", render: (r) => String(r.id), mono: true },
  { key: "sessionId", label: "Session", render: (r) => r.sessionId, mono: true },
  { key: "agent", label: "Agent", render: (r) => r.agent },
  { key: "action", label: "Action", render: (r) => r.action },
  { key: "detail", label: "Detail", render: (r) => r.detail },
  { key: "timestamp", label: "Timestamp", render: (r) => r.timestamp, mono: true },
];

const SessionsTab: Component = () => {
  const { querySessions } = useDb();
  const [search, setSearch] = createSignal("");
  const [agentFilter, setAgentFilter] = createSignal("");
  const [rows, setRows] = createSignal<SessionRow[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);

  onMount(async () => {
    const result = await querySessions({});
    setRows(result.rows);
    setTotalCount(result.totalCount);
  });

  const agents = createMemo(() => [...new Set(rows().map((s) => s.agent))].sort());

  const filtered = createMemo(() => {
    let data = rows();
    const s = search().toLowerCase();
    if (s) data = data.filter((row) => row.detail.toLowerCase().includes(s) || row.action.toLowerCase().includes(s));
    if (agentFilter()) data = data.filter((row) => row.agent === agentFilter());
    return data;
  });

  return (
    <>
      <FilterBar
        search={search()}
        onSearch={setSearch}
        agentFilter={agentFilter()}
        onAgentFilter={setAgentFilter}
        statusFilter=""
        onStatusFilter={() => {}}
        showAgent
        showStatus={false}
        agents={agents()}
        statuses={[]}
        showing={filtered().length}
        total={totalCount()}
      />
      <DataTable columns={SESSION_COLUMNS} rows={filtered()} />
    </>
  );
};

/* ───────────── Tab: Agents ───────────── */

const AGENT_COLUMNS: Column<AgentRow>[] = [
  { key: "name", label: "Name", render: (r) => r.name },
  { key: "role", label: "Role", render: (r) => r.role },
  { key: "status", label: "Status", render: (r) => r.status },
  { key: "tasksCompleted", label: "Tasks Done", render: (r) => String(r.tasksCompleted) },
  { key: "lastActive", label: "Last Active", render: (r) => r.lastActive, mono: true },
];

const AgentsTab: Component = () => {
  const { queryAgents } = useDb();
  const [search, setSearch] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal("");
  const [rows, setRows] = createSignal<AgentRow[]>([]);
  const [totalCount, setTotalCount] = createSignal(0);

  onMount(async () => {
    const result = await queryAgents({});
    setRows(result.rows);
    setTotalCount(result.totalCount);
  });

  const statuses = createMemo(() => [...new Set(rows().map((a) => a.status))].sort());

  const filtered = createMemo(() => {
    let data = rows();
    const s = search().toLowerCase();
    if (s) data = data.filter((a) => a.name.toLowerCase().includes(s) || a.role.toLowerCase().includes(s));
    if (statusFilter()) data = data.filter((a) => a.status === statusFilter());
    return data;
  });

  return (
    <>
      <FilterBar
        search={search()}
        onSearch={setSearch}
        agentFilter=""
        onAgentFilter={() => {}}
        statusFilter={statusFilter()}
        onStatusFilter={setStatusFilter}
        showAgent={false}
        showStatus
        agents={[]}
        statuses={statuses()}
        showing={filtered().length}
        total={totalCount()}
      />
      <DataTable columns={AGENT_COLUMNS} rows={filtered()} />
    </>
  );
};

/* ───────────── DB Explorer ───────────── */

const DbExplorer: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabId>("reports");

  return (
    <div class="p-8 max-w-7xl">
      <h1 class="text-2xl font-bold text-text mb-6">DB Explorer</h1>

      {/* Tab Navigation */}
      <div class="flex border-b border-border mb-6">
        <For each={TABS}>
          {(tab) => (
            <button
              class={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab() === tab.id
                  ? "text-accent border-accent"
                  : "text-text-dim border-transparent hover:text-text hover:border-border"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span class="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          )}
        </For>
      </div>

      {/* Tab Content */}
      <Show when={activeTab() === "reports"}>
        <ReportsTab />
      </Show>
      <Show when={activeTab() === "tasks"}>
        <TasksTab />
      </Show>
      <Show when={activeTab() === "sessions"}>
        <SessionsTab />
      </Show>
      <Show when={activeTab() === "agents"}>
        <AgentsTab />
      </Show>
    </div>
  );
};

export default DbExplorer;
