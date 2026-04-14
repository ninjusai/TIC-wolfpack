import type { Component } from "solid-js";
import { createSignal, createMemo, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useDb } from "../contexts/DbContext";
import { useProject } from "../contexts/ProjectContext";
import { useSettings } from "../contexts/SettingsContext";
import InterviewIntake from "../components/InterviewIntake";

type IntakeMode = "manual" | "interview";

const toSlug = (title: string | undefined | null) =>
  (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const isKebabCase = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

interface FieldError {
  field: string;
  message: string;
}

const IntakeView: Component = () => {
  const { scaffoldProject, validateSlug } = useDb();
  const { resolvedArtifactsDir } = useSettings();
  const { setActiveProject } = useProject();
  const navigate = useNavigate();

  // Mode toggle state
  const [mode, setMode] = createSignal<IntakeMode>("interview");

  const [title, setTitle] = createSignal("");
  const [slug, setSlug] = createSignal("");
  const [slugManual, setSlugManual] = createSignal(false);
  const [problem, setProblem] = createSignal("");
  const [users, setUsers] = createSignal("");
  const [scopeIn, setScopeIn] = createSignal("");
  const [scopeOut, setScopeOut] = createSignal("");
  const [constraints, setConstraints] = createSignal("");
  const [successCriteria, setSuccessCriteria] = createSignal("");
  const [priorArt, setPriorArt] = createSignal("");
  const [errors, setErrors] = createSignal<FieldError[]>([]);
  const [submitted, setSubmitted] = createSignal(false);
  const [toast, setToast] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  let formRef: HTMLDivElement | undefined;

  // Auto-slug from title
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManual()) {
      setSlug(toSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManual(true);
    setSlug(value);
  };

  // Ready-check computations
  const hasProblem = createMemo(() => problem().trim().length > 0);
  const hasUsers = createMemo(() => users().trim().length > 0);
  const hasCriteria = createMemo(
    () => successCriteria().trim().length > 0
  );
  const allReady = createMemo(() => hasProblem() && hasUsers() && hasCriteria());

  const fieldError = (field: string) =>
    errors().find((e) => e.field === field)?.message ?? "";

  const validate = (): FieldError[] => {
    const errs: FieldError[] = [];
    if (!title().trim()) errs.push({ field: "title", message: "Title is required" });
    if (!slug().trim()) {
      errs.push({ field: "slug", message: "Slug is required" });
    } else if (!isKebabCase(slug())) {
      errs.push({ field: "slug", message: "Slug must be kebab-case (e.g. my-project)" });
    }
    if (!problem().trim())
      errs.push({ field: "problem", message: "Problem statement is required" });
    return errs;
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const errs = validate();
    setErrors(errs);

    if (errs.length > 0) {
      const firstField = formRef?.querySelector(`[data-field="${errs[0].field}"]`);
      firstField?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      // Validate slug via IPC
      const slugResult = await validateSlug(resolvedArtifactsDir(), slug());
      if (!slugResult.available) {
        setErrors([{ field: "slug", message: slugResult.suggestion ?? "Slug is not available" }]);
        setSubmitting(false);
        return;
      }

      // Scaffold project via IPC
      const projectSlug = slug();
      await scaffoldProject(resolvedArtifactsDir(), {
        title: title(),
        slug: projectSlug,
        description: problem(),  // Use problem as description
        mode: "standard",  // Default mode
        problem: problem(),
        users: users(),
        scopeIn: scopeIn().split("\n").filter((l) => l.trim()),
        scopeOut: scopeOut().split("\n").filter((l) => l.trim()),
        constraints: constraints(),
        successCriteria: successCriteria().split("\n").filter((l) => l.trim()),
        priorArt: priorArt(),
      });

      // Set active project and navigate to it
      setActiveProject(projectSlug);
      setToast("Project created! Redirecting...");
      setTimeout(() => {
        setToast("");
        navigate(`/project/${projectSlug}`);
      }, 1000);
    } catch {
      setToast("Failed to create project");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full bg-bg border rounded px-3 py-2 text-text focus:border-accent focus:outline-none ${
      submitted() && fieldError(field) ? "border-red-500" : "border-border"
    }`;

  const labelClass = "block text-sm font-medium text-text-dim mb-1";

  // Tab button component
  const ModeTab: Component<{
    tabMode: IntakeMode;
    label: string;
    description: string;
  }> = (props) => {
    const isActive = () => mode() === props.tabMode;
    return (
      <button
        class={`flex-1 px-4 py-3 text-left rounded-lg transition-all ${
          isActive()
            ? "bg-accent/10 border-2 border-accent"
            : "bg-surface border-2 border-transparent hover:border-border"
        }`}
        onClick={() => setMode(props.tabMode)}
      >
        <span
          class={`block text-sm font-medium ${
            isActive() ? "text-accent" : "text-text"
          }`}
        >
          {props.label}
        </span>
        <span class="block text-xs text-text-dim mt-0.5">{props.description}</span>
      </button>
    );
  };

  // Manual form content (extracted for readability)
  const ManualFormContent: Component = () => (
    <div class="flex gap-8">
      {/* Left column - form fields */}
      <div class="flex-1 min-w-0 space-y-5">
        {/* Title */}
        <div data-field="title">
          <label class={labelClass}>
            Project Title <span class="text-red-400">*</span>
          </label>
          <input
            type="text"
            class={inputClass("title")}
            placeholder="e.g. Inventory Management System"
            value={title()}
            onInput={(e) => handleTitleChange(e.currentTarget.value)}
          />
          <Show when={submitted() && fieldError("title")}>
            <p class="text-red-400 text-xs mt-1">{fieldError("title")}</p>
          </Show>
        </div>

        {/* Slug */}
        <div data-field="slug">
          <label class={labelClass}>
            Project Slug <span class="text-red-400">*</span>
          </label>
          <input
            type="text"
            class={inputClass("slug")}
            placeholder="my-project-slug"
            value={slug()}
            onInput={(e) => handleSlugChange(e.currentTarget.value)}
          />
          <Show when={submitted() && fieldError("slug")}>
            <p class="text-red-400 text-xs mt-1">{fieldError("slug")}</p>
          </Show>
          <Show when={!submitted() || !fieldError("slug")}>
            <p class="text-text-dim text-xs mt-1">
              Auto-generated from title. Edit to customize.
            </p>
          </Show>
        </div>

        {/* Problem */}
        <div data-field="problem">
          <label class={labelClass}>
            Problem <span class="text-red-400">*</span>
          </label>
          <textarea
            class={inputClass("problem")}
            style={{ "min-height": "120px" }}
            placeholder="What problem does this project solve?"
            value={problem()}
            onInput={(e) => setProblem(e.currentTarget.value)}
          />
          <Show when={submitted() && fieldError("problem")}>
            <p class="text-red-400 text-xs mt-1">{fieldError("problem")}</p>
          </Show>
        </div>

        {/* Users */}
        <div data-field="users">
          <label class={labelClass}>Users / Personas</label>
          <textarea
            class={inputClass("users")}
            style={{ "min-height": "80px" }}
            placeholder="Who will use this? Describe target users or personas."
            value={users()}
            onInput={(e) => setUsers(e.currentTarget.value)}
          />
        </div>

        {/* Scope In */}
        <div data-field="scopeIn">
          <label class={labelClass}>Scope In</label>
          <textarea
            class={inputClass("scopeIn")}
            style={{ "min-height": "80px" }}
            placeholder={"One scope item per line\ne.g.\nUser authentication\nDashboard analytics"}
            value={scopeIn()}
            onInput={(e) => setScopeIn(e.currentTarget.value)}
          />
          <p class="text-text-dim text-xs mt-1">One item per line.</p>
        </div>

        {/* Scope Out */}
        <div data-field="scopeOut">
          <label class={labelClass}>Scope Out</label>
          <textarea
            class={inputClass("scopeOut")}
            style={{ "min-height": "80px" }}
            placeholder={"What is explicitly NOT in scope?\nOne item per line."}
            value={scopeOut()}
            onInput={(e) => setScopeOut(e.currentTarget.value)}
          />
        </div>

        {/* Constraints */}
        <div data-field="constraints">
          <label class={labelClass}>Constraints</label>
          <textarea
            class={inputClass("constraints")}
            style={{ "min-height": "80px" }}
            placeholder="Technical, business, or timeline constraints."
            value={constraints()}
            onInput={(e) => setConstraints(e.currentTarget.value)}
          />
        </div>

        {/* Success Criteria */}
        <div data-field="successCriteria">
          <label class={labelClass}>Success Criteria</label>
          <textarea
            class={inputClass("successCriteria")}
            style={{ "min-height": "80px" }}
            placeholder={"One criterion per line\ne.g.\nPage load < 2s\n95% test coverage"}
            value={successCriteria()}
            onInput={(e) => setSuccessCriteria(e.currentTarget.value)}
          />
          <p class="text-text-dim text-xs mt-1">One criterion per line.</p>
        </div>

        {/* Prior Art */}
        <div data-field="priorArt">
          <label class={labelClass}>Prior Art</label>
          <textarea
            class={inputClass("priorArt")}
            style={{ "min-height": "80px" }}
            placeholder="Links, references, or descriptions of existing solutions."
            value={priorArt()}
            onInput={(e) => setPriorArt(e.currentTarget.value)}
          />
        </div>

        {/* Submit */}
        <div class="pt-4 pb-8">
          <button
            class="px-6 py-2.5 bg-accent text-white font-medium rounded hover:bg-accent/90 transition-colors disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting()}
          >
            {submitting() ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>

      {/* Right column - ready check panel */}
      <div class="w-72 shrink-0">
        <div class="sticky top-8 bg-surface border border-border rounded-lg p-5">
          <h3 class="text-sm font-semibold text-text mb-4">Ready Check</h3>
          <ul class="space-y-3 text-sm">
            <li class="flex items-center gap-2">
              <span class={hasProblem() ? "text-green-400" : "text-red-400"}>
                {hasProblem() ? "\u2705" : "\u274C"}
              </span>
              <span class={hasProblem() ? "text-text" : "text-text-dim"}>
                Problem statement
              </span>
            </li>
            <li class="flex items-center gap-2">
              <span class={hasUsers() ? "text-green-400" : "text-red-400"}>
                {hasUsers() ? "\u2705" : "\u274C"}
              </span>
              <span class={hasUsers() ? "text-text" : "text-text-dim"}>
                Users / personas identified
              </span>
            </li>
            <li class="flex items-center gap-2">
              <span class={hasCriteria() ? "text-green-400" : "text-red-400"}>
                {hasCriteria() ? "\u2705" : "\u274C"}
              </span>
              <span class={hasCriteria() ? "text-text" : "text-text-dim"}>
                Success criteria defined
              </span>
            </li>
          </ul>
          <div
            class={`mt-5 pt-4 border-t border-border text-xs font-medium ${
              allReady() ? "text-green-400" : "text-red-400"
            }`}
          >
            {allReady() ? "All checks passed" : "Some checks incomplete"}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div class="h-full flex flex-col" ref={formRef}>
      {/* Header with mode toggle */}
      <div class="p-8 pb-0 max-w-6xl mx-auto w-full">
        <h1 class="text-2xl font-bold text-text mb-1">New Project Intake</h1>
        <p class="text-text-dim mb-6">
          Define the problem, scope, and success criteria for your project.
        </p>

        {/* Mode toggle */}
        <div class="flex gap-3 mb-6">
          <ModeTab
            tabMode="interview"
            label="Guided Interview"
            description="Step-by-step questions to capture your project"
          />
          <ModeTab
            tabMode="manual"
            label="Manual Form"
            description="Fill out all fields directly"
          />
        </div>
      </div>

      {/* Toast */}
      <Show when={toast()}>
        <div class="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow-lg text-sm font-medium">
          {toast()}
        </div>
      </Show>

      {/* Content based on mode */}
      <Show
        when={mode() === "interview"}
        fallback={
          <div class="flex-1 overflow-y-auto px-8 max-w-6xl mx-auto w-full">
            <ManualFormContent />
          </div>
        }
      >
        <div class="flex-1 overflow-hidden">
          <InterviewIntake onSwitchToManual={() => setMode("manual")} />
        </div>
      </Show>
    </div>
  );
};

export default IntakeView;
