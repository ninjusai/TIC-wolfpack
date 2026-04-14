import type { Component } from "solid-js";
import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { tauriInvoke, TauriUnavailableError } from "../lib/tauri";
import { useDb } from "../contexts/DbContext";
import { useProject } from "../contexts/ProjectContext";
import { useSettings } from "../contexts/SettingsContext";
import {
  type InterviewStage,
  type InterviewSession,
  type InterviewMessage,
  INTERVIEW_STAGES,
  getStageIndex,
  getNextStage,
  isLastStage,
} from "../types";

const toSlug = (title: string | undefined | null) =>
  (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface InterviewIntakeProps {
  onSwitchToManual?: () => void;
}

const InterviewIntake: Component<InterviewIntakeProps> = (props) => {
  const { scaffoldProject, validateSlug } = useDb();
  const { resolvedArtifactsDir } = useSettings();
  const { setActiveProject } = useProject();
  const navigate = useNavigate();

  // Session state
  const [sessionId, setSessionId] = createSignal<string | null>(null);
  const [currentStage, setCurrentStage] =
    createSignal<InterviewStage>("problem_discovery");
  const [messages, setMessages] = createSignal<InterviewMessage[]>([]);
  const [input, setInput] = createSignal("");
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Project metadata (collected before interview starts)
  const [title, setTitle] = createSignal("");
  const [slug, setSlug] = createSignal("");
  const [slugManual, setSlugManual] = createSignal(false);
  const [titleError, setTitleError] = createSignal("");
  const [slugError, setSlugError] = createSignal("");
  const [interviewStarted, setInterviewStarted] = createSignal(false);

  // Collected responses
  const [responses, setResponses] = createSignal<Record<string, string>>({});

  // Toast
  const [toast, setToast] = createSignal("");
  const [toastType, setToastType] = createSignal<"success" | "error">("success");

  let chatContainerRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    messages(); // dependency
    if (chatContainerRef) {
      chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
    }
  });

  // Auto-slug from title
  const handleTitleChange = (value: string) => {
    setTitle(value);
    setTitleError("");
    if (!slugManual()) {
      setSlug(toSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManual(true);
    setSlug(value);
    setSlugError("");
  };

  const isKebabCase = (s: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

  const validateProjectInfo = async (): Promise<boolean> => {
    let valid = true;

    if (!title().trim()) {
      setTitleError("Project title is required");
      valid = false;
    }

    if (!slug().trim()) {
      setSlugError("Project slug is required");
      valid = false;
    } else if (!isKebabCase(slug())) {
      setSlugError("Slug must be kebab-case (e.g. my-project)");
      valid = false;
    } else {
      // Validate slug availability
      try {
        const result = await validateSlug(resolvedArtifactsDir(), slug());
        if (!result.available) {
          setSlugError(result.suggestion ?? "Slug is not available");
          valid = false;
        }
      } catch {
        // In browser mode, skip validation
      }
    }

    return valid;
  };

  const addMessage = (role: "user" | "assistant", content: string) => {
    const msg: InterviewMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
      stage: currentStage(),
    };
    setMessages((prev) => [...prev, msg]);
  };

  const startInterview = async () => {
    // Validate project info first
    const valid = await validateProjectInfo();
    if (!valid) return;

    setInterviewStarted(true);

    // Generate session ID
    const newSessionId = `interview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSessionId(newSessionId);

    // Try to start interview via Tauri (optional - works without it for browser dev)
    try {
      await tauriInvoke<InterviewSession>("start_interview", {
        project_slug: slug(),
        title: title(),
      });
    } catch (err) {
      if (!(err instanceof TauriUnavailableError)) {
        console.warn("Failed to start interview session via Tauri:", err);
      }
      // Continue anyway - we'll track locally
    }

    // Add welcome message and first question
    addMessage(
      "assistant",
      `Great! Let's get started with "${title()}". I'll ask you a few questions to understand your project better.`
    );

    // Add first question after a brief delay for UX
    setTimeout(() => {
      const firstStage = INTERVIEW_STAGES[0];
      addMessage("assistant", firstStage.question);
      textareaRef?.focus();
    }, 500);
  };

  const handleSubmit = async () => {
    const response = input().trim();
    if (!response || isSubmitting()) return;

    setIsSubmitting(true);

    // Add user message
    addMessage("user", response);

    // Save response locally
    const stage = currentStage();
    const stageInfo = INTERVIEW_STAGES.find((s) => s.id === stage);
    if (stageInfo) {
      setResponses((prev) => ({
        ...prev,
        [stageInfo.fieldName]: response,
      }));
    }

    // Try to save via Tauri (optional)
    try {
      await tauriInvoke("save_interview_response", {
        session_id: sessionId(),
        stage: stage,
        field_name: stageInfo?.fieldName ?? stage,
        question: stageInfo?.question ?? "",
        response,
        turn_number: messages().length,
      });
    } catch (err) {
      if (!(err instanceof TauriUnavailableError)) {
        console.warn("Failed to save interview response via Tauri:", err);
      }
    }

    setInput("");

    // Advance to next stage
    if (isLastStage(stage)) {
      // Interview complete - show summary and create project
      await completeInterview();
    } else {
      const nextStage = getNextStage(stage);
      setCurrentStage(nextStage);

      // Add next question after brief delay
      setTimeout(() => {
        const nextStageInfo = INTERVIEW_STAGES.find((s) => s.id === nextStage);
        if (nextStageInfo) {
          addMessage("assistant", nextStageInfo.question);
        }
        textareaRef?.focus();
        setIsSubmitting(false);
      }, 300);
    }
  };

  const completeInterview = async () => {
    setCurrentStage("complete");

    addMessage(
      "assistant",
      "Excellent! I have all the information I need. Let me create your project..."
    );

    try {
      // Parse responses into intake data format
      const resp = responses();

      // Parse scope (split by newlines or semicolons)
      const scopeText = resp.scope || "";
      const scopeParts = scopeText.split(/(?:in scope:|out of scope:|excluded:|include:|exclude:)/i);
      let scopeIn: string[] = [];
      let scopeOut: string[] = [];

      if (scopeParts.length > 1) {
        // Try to parse structured response
        scopeIn = scopeParts[1]?.split(/[;\n]/).map((s) => s.trim()).filter(Boolean) || [];
        scopeOut = scopeParts[2]?.split(/[;\n]/).map((s) => s.trim()).filter(Boolean) || [];
      } else {
        // Treat whole response as in-scope
        scopeIn = scopeText.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
      }

      // Parse success criteria (split by newlines)
      const criteriaText = resp.successCriteria || "";
      const successCriteria = criteriaText
        .split(/[;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      // Create project
      await scaffoldProject(resolvedArtifactsDir(), {
        title: title(),
        slug: slug(),
        description: resp.problem || "",  // Use problem as description
        mode: "standard",  // Default mode
        problem: resp.problem || "",
        users: resp.users || "",
        scopeIn,
        scopeOut,
        constraints: resp.constraints || "",
        successCriteria,
        priorArt: resp.priorArt || "",
      });

      // Success
      setActiveProject(slug());
      showToast("Project created successfully!", "success");

      setTimeout(() => {
        addMessage(
          "assistant",
          `Your project "${title()}" has been created. Redirecting to the project page...`
        );
      }, 300);

      setTimeout(() => {
        navigate(`/project/${slug()}`);
      }, 1500);
    } catch (err) {
      console.error("Failed to create project:", err);
      showToast("Failed to create project. Please try again.", "error");
      addMessage(
        "assistant",
        "I encountered an error creating the project. You may want to try the manual form instead."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast(message);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Progress indicator
  const StageProgress: Component = () => {
    const currentIndex = () => getStageIndex(currentStage());

    return (
      <div class="flex items-center gap-1 px-4 py-3 bg-surface border-b border-border">
        <For each={INTERVIEW_STAGES}>
          {(stage, index) => {
            const isComplete = () => index() < currentIndex();
            const isCurrent = () => stage.id === currentStage();
            const isPending = () => index() > currentIndex();

            return (
              <>
                <div
                  class={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                    isComplete()
                      ? "bg-green-500 text-white"
                      : isCurrent()
                        ? "bg-accent text-white"
                        : "bg-border text-text-dim"
                  }`}
                  title={stage.label}
                >
                  {isComplete() ? (
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index() + 1
                  )}
                </div>
                <Show when={index() < INTERVIEW_STAGES.length - 1}>
                  <div
                    class={`flex-1 h-0.5 max-w-8 ${
                      isComplete() ? "bg-green-500" : "bg-border"
                    }`}
                  />
                </Show>
              </>
            );
          }}
        </For>
        <Show when={currentStage() === "complete"}>
          <div class="flex-1 h-0.5 max-w-8 bg-green-500" />
          <div class="flex items-center justify-center w-7 h-7 rounded-full bg-green-500 text-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </Show>
      </div>
    );
  };

  // Chat bubble component
  const ChatBubble: Component<{ message: InterviewMessage }> = (props) => {
    const isUser = () => props.message.role === "user";

    return (
      <div class={`flex ${isUser() ? "justify-end" : "justify-start"}`}>
        <div
          class={`max-w-[80%] px-4 py-3 rounded-2xl ${
            isUser()
              ? "bg-accent text-white rounded-br-md"
              : "bg-surface border border-border text-text rounded-bl-md"
          }`}
        >
          <p class="text-sm whitespace-pre-wrap">{props.message.content}</p>
        </div>
      </div>
    );
  };

  // Pre-interview form for title/slug
  const ProjectInfoForm: Component = () => {
    const inputClass = (hasError: boolean) =>
      `w-full bg-bg border rounded px-3 py-2 text-text focus:border-accent focus:outline-none ${
        hasError ? "border-red-500" : "border-border"
      }`;

    return (
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="w-full max-w-md space-y-6">
          <div class="text-center mb-8">
            <h2 class="text-xl font-semibold text-text mb-2">
              Let's start your project
            </h2>
            <p class="text-text-dim text-sm">
              First, give your project a name, then I'll guide you through a quick
              interview to capture the details.
            </p>
          </div>

          {/* Title */}
          <div>
            <label class="block text-sm font-medium text-text-dim mb-1">
              Project Title <span class="text-red-400">*</span>
            </label>
            <input
              type="text"
              class={inputClass(!!titleError())}
              placeholder="e.g. Inventory Management System"
              value={title()}
              onInput={(e) => handleTitleChange(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && startInterview()}
            />
            <Show when={titleError()}>
              <p class="text-red-400 text-xs mt-1">{titleError()}</p>
            </Show>
          </div>

          {/* Slug */}
          <div>
            <label class="block text-sm font-medium text-text-dim mb-1">
              Project Slug <span class="text-red-400">*</span>
            </label>
            <input
              type="text"
              class={inputClass(!!slugError())}
              placeholder="my-project-slug"
              value={slug()}
              onInput={(e) => handleSlugChange(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && startInterview()}
            />
            <Show when={slugError()}>
              <p class="text-red-400 text-xs mt-1">{slugError()}</p>
            </Show>
            <Show when={!slugError()}>
              <p class="text-text-dim text-xs mt-1">
                Auto-generated from title. Edit to customize.
              </p>
            </Show>
          </div>

          {/* Start button */}
          <button
            class="w-full px-6 py-3 bg-accent text-white font-medium rounded hover:bg-accent/90 transition-colors"
            onClick={startInterview}
          >
            Start Interview
          </button>

          {/* Switch to manual */}
          <Show when={props.onSwitchToManual}>
            <p class="text-center text-text-dim text-sm">
              Prefer to fill out a form?{" "}
              <button
                class="text-accent hover:underline"
                onClick={props.onSwitchToManual}
              >
                Switch to manual form
              </button>
            </p>
          </Show>
        </div>
      </div>
    );
  };

  return (
    <div class="flex flex-col h-full bg-bg">
      {/* Toast */}
      <Show when={toast()}>
        <div
          class={`fixed top-4 right-4 z-50 px-4 py-2 rounded shadow-lg text-sm font-medium ${
            toastType() === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast()}
        </div>
      </Show>

      <Show when={!interviewStarted()} fallback={
        <>
          {/* Progress bar */}
          <StageProgress />

          {/* Current stage label */}
          <div class="px-4 py-2 border-b border-border bg-surface/50">
            <Show
              when={currentStage() !== "complete"}
              fallback={
                <span class="text-sm text-green-400 font-medium">
                  Interview Complete
                </span>
              }
            >
              <span class="text-sm text-text-dim">
                Stage {getStageIndex(currentStage()) + 1} of {INTERVIEW_STAGES.length}:{" "}
                <span class="text-text font-medium">
                  {INTERVIEW_STAGES.find((s) => s.id === currentStage())?.label}
                </span>
              </span>
            </Show>
          </div>

          {/* Chat area */}
          <div
            ref={chatContainerRef}
            class="flex-1 overflow-y-auto p-4 space-y-4"
          >
            <For each={messages()}>
              {(msg) => <ChatBubble message={msg} />}
            </For>
          </div>

          {/* Input area */}
          <Show when={currentStage() !== "complete"}>
            <div class="p-4 border-t border-border bg-surface">
              <div class="flex gap-3">
                <textarea
                  ref={textareaRef}
                  class="flex-1 bg-bg border border-border rounded-lg px-4 py-3 text-text text-sm resize-none focus:border-accent focus:outline-none"
                  placeholder="Type your response... (Enter to send, Shift+Enter for new line)"
                  rows={3}
                  value={input()}
                  onInput={(e) => setInput(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting()}
                />
                <button
                  class="px-6 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 self-end"
                  onClick={handleSubmit}
                  disabled={isSubmitting() || !input().trim()}
                >
                  {isSubmitting() ? "..." : "Send"}
                </button>
              </div>
            </div>
          </Show>
        </>
      }>
        <ProjectInfoForm />
      </Show>
    </div>
  );
};

export default InterviewIntake;
