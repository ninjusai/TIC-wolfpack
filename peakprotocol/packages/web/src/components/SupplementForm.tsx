/**
 * Reusable Supplement form for create and edit modes (WRK-016).
 */
import {
  createSignal,
  createEffect,
  For,
  Show,
  type Component,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  createSupplement,
  updateSupplement,
  type Supplement,
  type SupplementFormData,
} from "../lib/supplements";

interface SupplementFormProps {
  mode: "create" | "edit";
  supplement?: Supplement;
  onSaved?: () => void;
}

const DAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
] as const;

/** Normalize legacy capitalized day names from existing DB rows. */
const normalizeDay = (d: string): string => {
  const lower = (d ?? "").toLowerCase().slice(0, 3);
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(lower) ? lower : "mon";
};

/** Normalize legacy capitalized timeOfDay values. */
const normalizeTimeOfDay = (t: string): string => {
  const lower = (t ?? "").toLowerCase();
  if (lower === "morning" || lower === "evening" || lower === "with_food" || lower === "anytime") {
    return lower;
  }
  if (lower === "with food") return "with_food";
  return "morning";
};
const UNIT_SUGGESTIONS = ["mg", "mcg", "g", "IU", "ml", "drops"] as const;
const TIME_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
  { value: "with_food", label: "With Food" },
  { value: "anytime", label: "Anytime" },
] as const;
const SCHEDULE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "every_n_days", label: "Every N Days" },
  { value: "weekly", label: "Weekly" },
  { value: "specific_days", label: "Specific Days" },
] as const;

const SupplementForm: Component<SupplementFormProps> = (props) => {
  const navigate = useNavigate();

  const [name, setName] = createSignal("");
  const [dose, setDose] = createSignal("");
  const [unit, setUnit] = createSignal("");
  const [scheduleType, setScheduleType] = createSignal("daily");
  const [everyNDays, setEveryNDays] = createSignal(2);
  const [weeklyDay, setWeeklyDay] = createSignal("mon");
  const [specificDays, setSpecificDays] = createSignal<string[]>([]);
  const [timeOfDay, setTimeOfDay] = createSignal("morning");
  const [tagInput, setTagInput] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  // Pre-fill fields in edit mode
  createEffect(() => {
    if (props.mode === "edit" && props.supplement) {
      const s = props.supplement;
      setName(s.name);
      setDose(s.currentDose ?? "");
      setUnit(s.unit ?? "");
      setScheduleType(s.scheduleType ?? "daily");
      setTimeOfDay(normalizeTimeOfDay(s.timeOfDay ?? "morning"));
      setTags(s.tags ?? []);

      const cfg = s.scheduleValue as Record<string, unknown> | null;
      if (cfg) {
        if (cfg.n) setEveryNDays(cfg.n as number);
        if (cfg.day) setWeeklyDay(normalizeDay(cfg.day as string));
        if (cfg.days) setSpecificDays((cfg.days as string[]).map(normalizeDay));
      }
    }
  });

  const buildScheduleConfig = (): Record<string, unknown> => {
    switch (scheduleType()) {
      case "every_n_days":
        return { n: everyNDays() };
      case "weekly":
        return { day: weeklyDay() };
      case "specific_days":
        return { days: specificDays() };
      default:
        return {};
    }
  };

  const handleAddTag = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput().trim().replace(/,$/g, "");
      if (val && !tags().includes(val)) {
        setTags([...tags(), val]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags().filter((t) => t !== tag));
  };

  const toggleDay = (day: string) => {
    const current = specificDays();
    if (current.includes(day)) {
      setSpecificDays(current.filter((d) => d !== day));
    } else {
      setSpecificDays([...current, day]);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name().trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError("");

    const data: SupplementFormData = {
      name: name().trim(),
      currentDose: dose(),
      unit: unit(),
      scheduleType: scheduleType(),
      scheduleValue: buildScheduleConfig(),
      timeOfDay: timeOfDay(),
      tags: tags(),
    };

    try {
      if (props.mode === "edit" && props.supplement) {
        await updateSupplement(props.supplement.id, data);
      } else {
        await createSupplement(data);
      }

      if (props.onSaved) {
        props.onSaved();
      } else {
        navigate("/supplements");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save supplement";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <form onSubmit={handleSubmit} class="space-y-5">
      <Show when={error()}>
        <div class="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error()}
        </div>
      </Show>

      {/* Name */}
      <div>
        <label class={labelClass}>Name *</label>
        <input
          type="text"
          class={inputClass}
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          placeholder="e.g. Vitamin D3"
          required
        />
      </div>

      {/* Dose + Unit */}
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class={labelClass}>Dose</label>
          <input
            type="text"
            class={inputClass}
            value={dose()}
            onInput={(e) => setDose(e.currentTarget.value)}
            placeholder="500"
          />
        </div>
        <div>
          <label class={labelClass}>Unit</label>
          <input
            type="text"
            list="unit-suggestions"
            class={inputClass}
            value={unit()}
            onInput={(e) => setUnit(e.currentTarget.value)}
            placeholder="mg"
          />
          <datalist id="unit-suggestions">
            <For each={[...UNIT_SUGGESTIONS]}>
              {(u) => <option value={u} />}
            </For>
          </datalist>
        </div>
      </div>

      {/* Schedule Type */}
      <div>
        <label class={labelClass}>Schedule Type</label>
        <select
          class={inputClass}
          value={scheduleType()}
          onChange={(e) => setScheduleType(e.currentTarget.value)}
        >
          <For each={[...SCHEDULE_TYPES]}>
            {(st) => <option value={st.value}>{st.label}</option>}
          </For>
        </select>
      </div>

      {/* Schedule Config — dynamic */}
      <Show when={scheduleType() === "every_n_days"}>
        <div>
          <label class={labelClass}>Every N days</label>
          <input
            type="number"
            min="2"
            class={inputClass}
            value={everyNDays()}
            onInput={(e) => setEveryNDays(parseInt(e.currentTarget.value) || 2)}
          />
        </div>
      </Show>

      <Show when={scheduleType() === "weekly"}>
        <div>
          <label class={labelClass}>Day of week</label>
          <select
            class={inputClass}
            value={weeklyDay()}
            onChange={(e) => setWeeklyDay(e.currentTarget.value)}
          >
            <For each={[...DAYS]}>{(d) => <option value={d.value}>{d.label}</option>}</For>
          </select>
        </div>
      </Show>

      <Show when={scheduleType() === "specific_days"}>
        <div>
          <label class={labelClass}>Select days</label>
          <div class="flex flex-wrap gap-2">
            <For each={[...DAYS]}>
              {(d) => (
                <button
                  type="button"
                  class={`touch-target rounded-lg px-3 py-1 text-sm font-medium border transition-colors ${
                    specificDays().includes(d.value)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  }`}
                  onClick={() => toggleDay(d.value)}
                >
                  {d.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Time of Day */}
      <div>
        <label class={labelClass}>Time of Day</label>
        <select
          class={inputClass}
          value={timeOfDay()}
          onChange={(e) => setTimeOfDay(e.currentTarget.value)}
        >
          <For each={[...TIME_OPTIONS]}>
            {(t) => <option value={t.value}>{t.label}</option>}
          </For>
        </select>
      </div>

      {/* Tags */}
      <div>
        <label class={labelClass}>Tags</label>
        <div class="flex flex-wrap gap-1.5 mb-2">
          <For each={tags()}>
            {(tag) => (
              <span class="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-xs font-medium">
                {tag}
                <button
                  type="button"
                  class="ml-0.5 text-blue-500 hover:text-blue-700 dark:hover:text-blue-200"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  x
                </button>
              </span>
            )}
          </For>
        </div>
        <input
          type="text"
          class={inputClass}
          value={tagInput()}
          onInput={(e) => setTagInput(e.currentTarget.value)}
          onKeyDown={handleAddTag}
          placeholder="Type a tag and press Enter"
        />
      </div>

      {/* Actions */}
      <div class="flex gap-3 pt-2">
        <button
          type="submit"
          class="btn-primary touch-target flex-1"
          disabled={saving()}
        >
          {saving() ? "Saving..." : props.mode === "edit" ? "Update" : "Create"}
        </button>
        <button
          type="button"
          class="btn-secondary touch-target flex-1"
          onClick={() => navigate("/supplements")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default SupplementForm;
