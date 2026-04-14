/**
 * Training Log page (WRK-032/033/034).
 *
 * Two tabs: "Log" (daily session logging with optional weight detail)
 * and "Week" (weekly summary view). Mobile-first, dark-mode ready.
 */
import {
  createSignal,
  createResource,
  createMemo,
  Show,
  For,
  type Component,
} from "solid-js";
import {
  formatDate,
  shiftDate,
  getWeekStart,
  getWeekDays,
  dayLabel,
  getTrainingSessions,
  createTrainingSession,
  deleteTrainingSession,
  getWeeklySummary,
  typeEmoji,
  typeLabel,
  intensityColor,
  intensityBgColor,
  exerciseVolume,
  TRAINING_TYPES,
  INTENSITIES,
  type TrainingType,
  type Intensity,
  type Exercise,
  type ExerciseSet,
  type TrainingSession,
} from "../lib/training";

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const Training: Component = () => {
  /* ---- Tab state ---- */
  const [tab, setTab] = createSignal<"log" | "week">("log");

  /* ---- Date navigation ---- */
  const [selectedDate, setSelectedDate] = createSignal(formatDate(new Date()));
  const isToday = () => selectedDate() === formatDate(new Date());

  const goBack = () => setSelectedDate(shiftDate(selectedDate(), -1));
  const goForward = () => setSelectedDate(shiftDate(selectedDate(), 1));
  const goToday = () => setSelectedDate(formatDate(new Date()));

  /* ---- Fetch daily sessions ---- */
  const [sessions, { refetch }] = createResource(selectedDate, (date) =>
    getTrainingSessions(date),
  );

  /* ---- Fetch weekly summary ---- */
  const weekOf = createMemo(() => getWeekStart(selectedDate()));
  const [weekData, { refetch: refetchWeek }] = createResource(weekOf, (w) =>
    getWeeklySummary(w),
  );

  /* ---- Form state ---- */
  const [showForm, setShowForm] = createSignal(false);
  const [formType, setFormType] = createSignal<TrainingType | null>(null);
  const [formDuration, setFormDuration] = createSignal("");
  const [formIntensity, setFormIntensity] = createSignal<Intensity | null>(null);
  const [formNotes, setFormNotes] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  /* ---- Weight detail mode (WRK-033) ---- */
  const [showExercises, setShowExercises] = createSignal(false);
  const [exercises, setExercises] = createSignal<Exercise[]>([
    { name: "", sets: [{ reps: 0, weight: 0, unit: "kg", rpe: undefined }] },
  ]);

  const resetForm = () => {
    setFormType(null);
    setFormDuration("");
    setFormIntensity(null);
    setFormNotes("");
    setShowExercises(false);
    setExercises([{ name: "", sets: [{ reps: 0, weight: 0, unit: "kg", rpe: undefined }] }]);
    setShowForm(false);
  };

  const addExercise = () => {
    setExercises([
      ...exercises(),
      { name: "", sets: [{ reps: 0, weight: 0, unit: "kg", rpe: undefined }] },
    ]);
  };

  const addSet = (exIdx: number) => {
    setExercises(
      exercises().map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: [...ex.sets, { reps: 0, weight: 0, unit: "kg", rpe: undefined }] }
          : ex,
      ),
    );
  };

  const updateExerciseName = (exIdx: number, name: string) => {
    setExercises(
      exercises().map((ex, i) => (i === exIdx ? { ...ex, name } : ex)),
    );
  };

  const updateSet = (exIdx: number, setIdx: number, field: keyof ExerciseSet, value: number) => {
    setExercises(
      exercises().map((ex, i) =>
        i === exIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, j) =>
                j === setIdx ? { ...s, [field]: value } : s,
              ),
            }
          : ex,
      ),
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises(
      exercises().map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }
          : ex,
      ),
    );
  };

  const removeExercise = (exIdx: number) => {
    const current = exercises();
    if (current.length <= 1) return;
    setExercises(current.filter((_, i) => i !== exIdx));
  };

  /* ---- Save ---- */
  const handleSave = async () => {
    const type = formType();
    if (!type) return;
    setSaving(true);
    try {
      const dur = parseInt(formDuration(), 10);
      const details =
        type === "weights" && showExercises()
          ? { exercises: exercises().filter((e) => e.name.trim()) }
          : undefined;

      await createTrainingSession({
        date: selectedDate(),
        type,
        durationMinutes: isNaN(dur) ? undefined : dur,
        intensity: formIntensity() ?? undefined,
        details,
        notes: formNotes().trim() || undefined,
      });
      resetForm();
      refetch();
      refetchWeek();
    } catch {
      // silent — could add toast later
    } finally {
      setSaving(false);
    }
  };

  /* ---- Delete ---- */
  const [deletingId, setDeletingId] = createSignal<string | null>(null);
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTrainingSession(id);
      refetch();
      refetchWeek();
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  /* ---- Helpers ---- */
  const dateLabel = () => {
    if (isToday()) return "Today";
    const d = new Date(selectedDate() + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const sessionList = () => sessions() ?? [];

  /* Week helpers */
  const weekDays = createMemo(() => getWeekDays(selectedDate()));
  const weekSessions = () => weekData()?.sessions ?? [];
  const weekSummary = () =>
    weekData()?.summary ?? { totalDuration: 0, sessionCount: 0, byType: {} };

  const sessionsForDay = (date: string): TrainingSession[] =>
    weekSessions().filter((s) => s.date === date);

  const weekLabel = () => {
    const days = weekDays();
    const start = new Date(days[0] + "T00:00:00");
    const end = new Date(days[6] + "T00:00:00");
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} - ${fmt(end)}`;
  };

  /* Extract previous exercise names for autocomplete */
  const previousExerciseNames = createMemo(() => {
    const names = new Set<string>();
    for (const s of sessionList()) {
      const d = s.details as { exercises?: Exercise[] } | null;
      if (d?.exercises) {
        for (const ex of d.exercises) {
          if (ex.name) names.add(ex.name);
        }
      }
    }
    // Also check week data
    for (const s of weekSessions()) {
      const d = s.details as { exercises?: Exercise[] } | null;
      if (d?.exercises) {
        for (const ex of d.exercises) {
          if (ex.name) names.add(ex.name);
        }
      }
    }
    return [...names].sort();
  });

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div class="pb-24 md:pb-8 md:ml-56">
      <div class="max-w-3xl mx-auto px-4 py-6">
        {/* ---- Tab Switcher ---- */}
        <div class="flex mb-5 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            class={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab() === "log"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
            onClick={() => setTab("log")}
          >
            Log
          </button>
          <button
            class={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab() === "week"
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
            onClick={() => setTab("week")}
          >
            Week
          </button>
        </div>

        {/* ---- Date Navigation ---- */}
        <div class="flex items-center justify-between mb-6">
          <button
            class="touch-target p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={goBack}
            aria-label="Previous day"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">
              {tab() === "log" ? dateLabel() : weekLabel()}
            </h1>
            <input
              type="date"
              value={selectedDate()}
              onInput={(e) => setSelectedDate(e.currentTarget.value)}
              class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            />
            <Show when={!isToday()}>
              <button
                class="touch-target text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                onClick={goToday}
              >
                Today
              </button>
            </Show>
          </div>

          <button
            class="touch-target p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={goForward}
            aria-label="Next day"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ============================================================ */}
        {/* LOG TAB                                                      */}
        {/* ============================================================ */}
        <Show when={tab() === "log"}>
          {/* Loading */}
          <Show when={sessions.loading}>
            <div class="space-y-4">
              <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            </div>
          </Show>

          <Show when={!sessions.loading}>
            {/* ---- Logged Sessions ---- */}
            <Show
              when={sessionList().length > 0}
              fallback={
                <div class="text-center py-12">
                  <div class="text-4xl mb-3">{"\u{1F3CB}\uFE0F"}</div>
                  <p class="text-gray-500 dark:text-gray-400 mb-4">
                    No training logged. Tap below to start.
                  </p>
                </div>
              }
            >
              <div class="space-y-3 mb-6">
                <For each={sessionList()}>
                  {(session) => {
                    const details = () => session.details as { exercises?: Exercise[] } | null;
                    return (
                      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-3 flex-1 min-w-0">
                            <span class="text-2xl">{typeEmoji(session.type)}</span>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2">
                                <span class="font-semibold text-gray-900 dark:text-white">
                                  {typeLabel(session.type)}
                                </span>
                                <Show when={session.intensity}>
                                  <span
                                    class={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${intensityBgColor(session.intensity)}`}
                                  >
                                    {session.intensity}
                                  </span>
                                </Show>
                              </div>
                              <div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <Show when={session.durationMinutes}>
                                  <span>{session.durationMinutes} min</span>
                                </Show>
                                <Show when={session.notes}>
                                  <span class="truncate">{session.notes}</span>
                                </Show>
                              </div>
                            </div>
                          </div>
                          <button
                            class="touch-target p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            onClick={() => handleDelete(session.id)}
                            disabled={deletingId() === session.id}
                            aria-label="Delete session"
                          >
                            <Show
                              when={deletingId() !== session.id}
                              fallback={
                                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              }
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Show>
                          </button>
                        </div>
                        {/* Exercise details for weights */}
                        <Show when={details()?.exercises && details()!.exercises!.length > 0}>
                          <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                            <For each={details()!.exercises!}>
                              {(ex) => (
                                <div class="text-sm">
                                  <div class="flex items-center justify-between">
                                    <span class="font-medium text-gray-700 dark:text-gray-300">{ex.name}</span>
                                    <span class="text-xs text-gray-400 dark:text-gray-500">
                                      Vol: {exerciseVolume(ex).toLocaleString()} kg
                                    </span>
                                  </div>
                                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {ex.sets.map((s) =>
                                      `${s.reps}x${s.weight}kg${s.rpe ? ` @${s.rpe}` : ""}`
                                    ).join(", ")}
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* ---- Training Form ---- */}
            <Show
              when={showForm()}
              fallback={
                <button
                  class="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 font-medium hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  onClick={() => setShowForm(true)}
                >
                  + Log Training
                </button>
              }
            >
              <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Log Training</h3>
                  <button
                    class="touch-target p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    onClick={resetForm}
                    aria-label="Cancel"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Type selector — 4 large buttons */}
                <div class="grid grid-cols-2 gap-3 mb-5">
                  <For each={TRAINING_TYPES}>
                    {(t) => (
                      <button
                        class={`touch-target flex flex-col items-center justify-center py-4 rounded-xl border-2 text-base font-medium transition-all ${
                          formType() === t.value
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                        onClick={() => setFormType(t.value)}
                      >
                        <span class="text-2xl mb-1">{t.emoji}</span>
                        {t.label}
                      </button>
                    )}
                  </For>
                </div>

                {/* Duration */}
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    inputmode="numeric"
                    placeholder="45"
                    value={formDuration()}
                    onInput={(e) => setFormDuration(e.currentTarget.value)}
                    class="w-full px-4 py-3 text-lg rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Intensity */}
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Intensity
                  </label>
                  <div class="flex gap-2">
                    <For each={INTENSITIES}>
                      {(i) => (
                        <button
                          class={`touch-target flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            formIntensity() === i.value
                              ? `text-white ${i.bgColor}`
                              : "border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300"
                          }`}
                          onClick={() => setFormIntensity(i.value)}
                        >
                          {i.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                {/* Weight detail toggle (WRK-033) */}
                <Show when={formType() === "weights"}>
                  <div class="mb-4">
                    <label class="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showExercises()}
                        onChange={(e) => setShowExercises(e.currentTarget.checked)}
                        class="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Log Exercises
                      </span>
                    </label>
                  </div>

                  <Show when={showExercises()}>
                    <div class="space-y-4 mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                      <For each={exercises()}>
                        {(ex, exIdx) => (
                          <div class="space-y-2">
                            <div class="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Exercise name"
                                value={ex.name}
                                onInput={(e) => updateExerciseName(exIdx(), e.currentTarget.value)}
                                list="exercise-names"
                                class="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <Show when={exercises().length > 1}>
                                <button
                                  class="touch-target p-1.5 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                  onClick={() => removeExercise(exIdx())}
                                  aria-label="Remove exercise"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </Show>
                            </div>

                            {/* Sets table */}
                            <div class="space-y-1.5">
                              <div class="grid grid-cols-12 gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                                <div class="col-span-1">#</div>
                                <div class="col-span-3">Reps</div>
                                <div class="col-span-4">Weight (kg)</div>
                                <div class="col-span-3">RPE</div>
                                <div class="col-span-1" />
                              </div>
                              <For each={ex.sets}>
                                {(s, sIdx) => (
                                  <div class="grid grid-cols-12 gap-1.5 items-center">
                                    <div class="col-span-1 text-xs text-gray-400 dark:text-gray-500 text-center">
                                      {sIdx() + 1}
                                    </div>
                                    <input
                                      type="number"
                                      inputmode="numeric"
                                      placeholder="5"
                                      value={s.reps || ""}
                                      onInput={(e) =>
                                        updateSet(exIdx(), sIdx(), "reps", parseInt(e.currentTarget.value, 10) || 0)
                                      }
                                      class="col-span-3 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <input
                                      type="number"
                                      inputmode="decimal"
                                      placeholder="100"
                                      value={s.weight || ""}
                                      onInput={(e) =>
                                        updateSet(exIdx(), sIdx(), "weight", parseFloat(e.currentTarget.value) || 0)
                                      }
                                      class="col-span-4 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <input
                                      type="number"
                                      inputmode="numeric"
                                      placeholder="8"
                                      value={s.rpe ?? ""}
                                      onInput={(e) =>
                                        updateSet(exIdx(), sIdx(), "rpe", parseInt(e.currentTarget.value, 10) || 0)
                                      }
                                      class="col-span-3 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <button
                                      class="col-span-1 touch-target p-1 text-gray-400 hover:text-red-500 transition-colors"
                                      onClick={() => removeSet(exIdx(), sIdx())}
                                      aria-label="Remove set"
                                    >
                                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </For>
                            </div>

                            <div class="flex items-center justify-between">
                              <button
                                class="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                onClick={() => addSet(exIdx())}
                              >
                                + Add Set
                              </button>
                              <Show when={ex.name && ex.sets.some((s) => s.reps > 0 && s.weight > 0)}>
                                <span class="text-xs text-gray-500 dark:text-gray-400">
                                  Vol: {exerciseVolume(ex).toLocaleString()} kg
                                </span>
                              </Show>
                            </div>
                          </div>
                        )}
                      </For>

                      <button
                        class="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        onClick={addExercise}
                      >
                        + Add Exercise
                      </button>
                    </div>

                    {/* Autocomplete datalist */}
                    <datalist id="exercise-names">
                      <For each={previousExerciseNames()}>
                        {(name) => <option value={name} />}
                      </For>
                    </datalist>
                  </Show>
                </Show>

                {/* Notes */}
                <div class="mb-5">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Notes (optional)
                  </label>
                  <textarea
                    placeholder="How did it go?"
                    value={formNotes()}
                    onInput={(e) => setFormNotes(e.currentTarget.value)}
                    rows={2}
                    class="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Save */}
                <button
                  class="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSave}
                  disabled={!formType() || saving()}
                >
                  {saving() ? "Saving..." : "Save Session"}
                </button>
              </div>
            </Show>
          </Show>
        </Show>

        {/* ============================================================ */}
        {/* WEEK TAB (WRK-034)                                           */}
        {/* ============================================================ */}
        <Show when={tab() === "week"}>
          <Show when={weekData.loading}>
            <div class="space-y-4">
              <div class="animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            </div>
          </Show>

          <Show when={!weekData.loading}>
            {/* ---- Summary Stats ---- */}
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-5">
              <div class="flex items-center justify-around">
                <div class="text-center">
                  <div class="text-lg font-bold text-blue-500">{weekSummary().sessionCount}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Sessions</div>
                </div>
                <div class="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                <div class="text-center">
                  <div class="text-lg font-bold text-orange-500">{weekSummary().totalDuration}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Minutes</div>
                </div>
                <div class="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                <div class="text-center">
                  <div class="text-lg font-bold text-green-500">
                    {Object.keys(weekSummary().byType).length}
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Types</div>
                </div>
              </div>
            </div>

            {/* ---- Type Distribution ---- */}
            <Show when={Object.keys(weekSummary().byType).length > 0}>
              <div class="flex flex-wrap gap-2 mb-5">
                <For each={Object.entries(weekSummary().byType)}>
                  {([type, data]) => (
                    <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700/50 text-sm">
                      <span>{typeEmoji(type)}</span>
                      <span class="font-medium text-gray-800 dark:text-gray-200">{typeLabel(type)}</span>
                      <span class="text-gray-500 dark:text-gray-400">
                        {data.count}x {data.duration ? `(${data.duration} min)` : ""}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* ---- Day-by-Day ---- */}
            <div class="space-y-2">
              <For each={weekDays()}>
                {(day, idx) => {
                  const daySessions = () => sessionsForDay(day);
                  const isEmpty = () => daySessions().length === 0;
                  const isSelectedDay = () => day === selectedDate();
                  return (
                    <div
                      class={`rounded-xl border p-3 transition-colors ${
                        isEmpty()
                          ? "border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30"
                          : isSelectedDay()
                            ? "border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      }`}
                    >
                      <div class="flex items-center justify-between mb-1">
                        <span
                          class={`text-sm font-semibold ${
                            isEmpty()
                              ? "text-gray-400 dark:text-gray-500"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {dayLabel(idx())}
                        </span>
                        <span class="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(day + "T00:00:00").toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <Show
                        when={!isEmpty()}
                        fallback={
                          <div class="text-xs text-gray-300 dark:text-gray-600">Rest day</div>
                        }
                      >
                        <div class="space-y-1">
                          <For each={daySessions()}>
                            {(s) => (
                              <div class="flex items-center gap-2 text-sm">
                                <span>{typeEmoji(s.type)}</span>
                                <span class="font-medium text-gray-700 dark:text-gray-300">
                                  {typeLabel(s.type)}
                                </span>
                                <Show when={s.durationMinutes}>
                                  <span class="text-gray-500 dark:text-gray-400">{s.durationMinutes}m</span>
                                </Show>
                                <Show when={s.intensity}>
                                  <span class={`text-xs ${intensityColor(s.intensity)}`}>
                                    {s.intensity}
                                  </span>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default Training;
