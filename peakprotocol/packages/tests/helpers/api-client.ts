/**
 * Typed test API client for PeakProtocol integration tests.
 *
 * Wraps fetch calls to the Workers dev server with typed request/response
 * handling and automatic auth token management.
 *
 * Usage:
 *   const client = new TestClient("http://localhost:8787");
 *   await client.getDeviceToken();
 *   const supp = await client.createSupplement({ name: "Creatine" });
 */

// ── Response types ──────────────────────────────────────────────────

interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

interface SupplementResponse {
  id: string;
  name: string;
  currentDose: string | null;
  unit: string | null;
  scheduleType: string | null;
  scheduleValue: Record<string, unknown> | null;
  timeOfDay: string | null;
  tags: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FoodEntryResponse {
  id: string;
  date: string;
  meal: string;
  foodName: string;
  fdcId: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  loggedAt: string;
}

interface TrainingSessionResponse {
  id: string;
  date: string;
  type: string;
  durationMinutes: number | null;
  intensity: string | null;
  details: Record<string, unknown> | null;
  notes: string | null;
  loggedAt: string;
}

interface JournalEntryResponse {
  id: string;
  date: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface MetricsResponse {
  date: string;
  weight: number | null;
  weightUnit: string;
  waterMl: number | null;
  waterTargetMl: number;
  notes: string | null;
  tags: string[];
  loggedAt: string;
}

interface DoseChangeResponse {
  id: string;
  supplementId: string;
  dose: string | null;
  unit: string | null;
  changedAt: string;
  notes: string | null;
}

interface WeeklySummaryResponse {
  sessions: TrainingSessionResponse[];
  summary: {
    totalDuration: number;
    sessionCount: number;
    byType: Record<string, { count: number; duration: number }>;
  };
}

interface AnalysisReportResponse {
  period: { start: string; end: string };
  dataPoints: number;
  correlations: Array<{
    metric1: string;
    metric2: string;
    correlation: number | null;
    interpretation: string;
    dataPoints: number;
    period: { start: string; end: string };
  }>;
  weightTrend: {
    current7DayAvg: number | null;
    previous7DayAvg: number | null;
    delta: number | null;
    trend: "up" | "down" | "stable";
  };
  macroAverages: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
}

interface ExportResponse {
  success: true;
  key: string;
  size: number;
  tables: Record<string, number>;
}

interface ImportResponse {
  success: true;
  imported: Record<string, number>;
}

interface CorrelationResponse {
  metric1: string;
  metric2: string;
  correlation: number | null;
  interpretation: string;
  dataPoints: number;
  period: { start: string; end: string };
}

// ── Client ──────────────────────────────────────────────────────────

export class TestClient {
  private baseUrl: string;
  private token: string | null;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = (baseUrl ?? process.env["API_BASE_URL"] ?? "http://localhost:8787").replace(/\/$/, "");
    this.token = token ?? null;
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  // ── Auth ──────────────────────────────────────────────────────────

  /**
   * Obtain a device/session token for test authentication.
   * The dev server with Miniflare should accept a simplified auth flow.
   */
  async getDeviceToken(): Promise<string> {
    const res = await this.request("POST", "/api/auth/device", {
      deviceId: `test-device-${Date.now()}`,
    });
    const data = (await res.json()) as { token: string };
    this.token = data.token;
    return data.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  // ── Supplements ───────────────────────────────────────────────────

  async createSupplement(data: Record<string, unknown>): Promise<SupplementResponse> {
    const res = await this.request("POST", "/api/supplements", data);
    const body = (await res.json()) as { supplement: SupplementResponse };
    return body.supplement;
  }

  async getSupplement(id: string): Promise<SupplementResponse> {
    const res = await this.request("GET", `/api/supplements/${id}`);
    const body = (await res.json()) as { supplement: SupplementResponse };
    return body.supplement;
  }

  async listSupplements(params?: Record<string, string>): Promise<SupplementResponse[]> {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const res = await this.request("GET", `/api/supplements${qs}`);
    const body = (await res.json()) as { supplements: SupplementResponse[] };
    return body.supplements;
  }

  async updateSupplement(id: string, data: Record<string, unknown>): Promise<SupplementResponse> {
    const res = await this.request("PUT", `/api/supplements/${id}`, data);
    const body = (await res.json()) as { supplement: SupplementResponse };
    return body.supplement;
  }

  async deleteSupplement(id: string): Promise<void> {
    await this.request("DELETE", `/api/supplements/${id}`);
  }

  // ── Dose Titration ────────────────────────────────────────────────

  async changeDose(
    supplementId: string,
    data: { dose: string; unit?: string; notes?: string },
  ): Promise<{ doseChange: DoseChangeResponse; supplement: SupplementResponse }> {
    const res = await this.request("POST", `/api/supplements/${supplementId}/dose`, data);
    return (await res.json()) as { doseChange: DoseChangeResponse; supplement: SupplementResponse };
  }

  async getDoseHistory(
    supplementId: string,
    params?: { limit?: number; offset?: number },
  ): Promise<{ history: DoseChangeResponse[]; total: number }> {
    const qs = params ? "?" + new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString() : "";
    const res = await this.request("GET", `/api/supplements/${supplementId}/dose-history${qs}`);
    return (await res.json()) as { history: DoseChangeResponse[]; total: number };
  }

  // ── Food Search ───────────────────────────────────────────────────

  async searchFoods(params: Record<string, string>): Promise<Record<string, unknown>[]> {
    const qs = "?" + new URLSearchParams(params).toString();
    const res = await this.request("GET", `/api/foods/search${qs}`);
    const body = (await res.json()) as { foods: Record<string, unknown>[] };
    return body.foods;
  }

  // ── Food Entries ──────────────────────────────────────────────────

  async createFoodEntry(data: Record<string, unknown>): Promise<FoodEntryResponse> {
    const res = await this.request("POST", "/api/food-entries", data);
    const body = (await res.json()) as { entry: FoodEntryResponse };
    return body.entry;
  }

  async listFoodEntries(date: string): Promise<{
    entries: FoodEntryResponse[];
    totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  }> {
    const res = await this.request("GET", `/api/food-entries?date=${date}`);
    return (await res.json()) as {
      entries: FoodEntryResponse[];
      totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
    };
  }

  async deleteFoodEntry(id: string): Promise<void> {
    await this.request("DELETE", `/api/food-entries/${id}`);
  }

  // ── Training Sessions ─────────────────────────────────────────────

  async createTrainingSession(data: Record<string, unknown>): Promise<TrainingSessionResponse> {
    const res = await this.request("POST", "/api/training-sessions", data);
    const body = (await res.json()) as { session: TrainingSessionResponse };
    return body.session;
  }

  async getWeeklySummary(weekOf?: string): Promise<WeeklySummaryResponse> {
    const qs = weekOf ? `?weekOf=${weekOf}` : "";
    const res = await this.request("GET", `/api/training-sessions/weekly${qs}`);
    return (await res.json()) as WeeklySummaryResponse;
  }

  async listTrainingSessions(params?: Record<string, string>): Promise<TrainingSessionResponse[]> {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const res = await this.request("GET", `/api/training-sessions${qs}`);
    const body = (await res.json()) as { sessions: TrainingSessionResponse[] };
    return body.sessions;
  }

  // ── Journal ───────────────────────────────────────────────────────

  async createJournalEntry(data: Record<string, unknown>): Promise<JournalEntryResponse> {
    const res = await this.request("POST", "/api/journal", data);
    const body = (await res.json()) as { entry: JournalEntryResponse };
    return body.entry;
  }

  async searchJournal(q: string, limit?: number): Promise<{
    entries: JournalEntryResponse[];
    total: number;
  }> {
    const params = new URLSearchParams({ q });
    if (limit !== undefined) params.set("limit", String(limit));
    const res = await this.request("GET", `/api/journal/search?${params.toString()}`);
    return (await res.json()) as { entries: JournalEntryResponse[]; total: number };
  }

  async listJournalEntries(params?: Record<string, string>): Promise<JournalEntryResponse[]> {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const res = await this.request("GET", `/api/journal${qs}`);
    const body = (await res.json()) as { entries: JournalEntryResponse[] };
    return body.entries;
  }

  // ── Daily Metrics ─────────────────────────────────────────────────

  async upsertMetrics(date: string, data: Record<string, unknown>): Promise<MetricsResponse> {
    const res = await this.request("PUT", `/api/metrics/${date}`, data);
    const body = (await res.json()) as { metrics: MetricsResponse };
    return body.metrics;
  }

  async getMetrics(date: string): Promise<MetricsResponse> {
    const res = await this.request("GET", `/api/metrics/${date}`);
    const body = (await res.json()) as { metrics: MetricsResponse };
    return body.metrics;
  }

  async getMetricsRange(startDate: string, endDate: string): Promise<MetricsResponse[]> {
    const res = await this.request("GET", `/api/metrics?startDate=${startDate}&endDate=${endDate}`);
    const body = (await res.json()) as { metrics: MetricsResponse[] };
    return body.metrics;
  }

  // ── Analysis ──────────────────────────────────────────────────────

  async getAnalysisReport(days?: number): Promise<AnalysisReportResponse> {
    const qs = days ? `?days=${days}` : "";
    const res = await this.request("GET", `/api/analysis/report${qs}`);
    const body = (await res.json()) as { report: AnalysisReportResponse };
    return body.report;
  }

  async getCorrelation(
    metric1: string,
    metric2: string,
    days?: number,
  ): Promise<CorrelationResponse> {
    const params = new URLSearchParams({ metric1, metric2 });
    if (days !== undefined) params.set("days", String(days));
    const res = await this.request("GET", `/api/analysis/correlation?${params.toString()}`);
    const body = (await res.json()) as { correlation: CorrelationResponse };
    return body.correlation;
  }

  // ── Export / Import ───────────────────────────────────────────────

  async exportData(): Promise<ExportResponse> {
    const res = await this.request("GET", "/api/export");
    return (await res.json()) as ExportResponse;
  }

  async importData(payload: Record<string, unknown>): Promise<ImportResponse> {
    const res = await this.request("POST", "/api/import", payload);
    return (await res.json()) as ImportResponse;
  }

  // ── Compliance ────────────────────────────────────────────────────

  async getCompliance(date: string): Promise<Record<string, unknown>> {
    const res = await this.request("GET", `/api/compliance?date=${date}`);
    return (await res.json()) as Record<string, unknown>;
  }

  async getComplianceRange(startDate: string, endDate: string): Promise<Record<string, unknown>> {
    const res = await this.request(
      "GET",
      `/api/compliance?startDate=${startDate}&endDate=${endDate}`,
    );
    return (await res.json()) as Record<string, unknown>;
  }

  // ── Schedule ──────────────────────────────────────────────────────

  async getSchedule(date: string): Promise<Record<string, unknown>> {
    const res = await this.request("GET", `/api/schedule?date=${date}`);
    return (await res.json()) as Record<string, unknown>;
  }

  // ── Raw request ───────────────────────────────────────────────────

  async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const reqHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    if (this.token) {
      reqHeaders["Cookie"] = `session=${this.token}`;
    }

    const init: RequestInit = {
      method,
      headers: reqHeaders,
    };

    if (body && method !== "GET") {
      init.body = JSON.stringify(body);
    }

    return fetch(url, init);
  }

  /**
   * Make a request with an idempotency key (X-Request-Id header).
   */
  async requestWithIdempotency(
    method: string,
    path: string,
    requestId: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    return this.request(method, path, body, { "X-Request-Id": requestId });
  }
}
