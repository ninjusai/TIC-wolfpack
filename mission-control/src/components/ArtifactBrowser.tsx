import type { Component } from "solid-js";
import { For, Show, createSignal, createMemo, createEffect, on } from "solid-js";
import { marked } from "marked";
import { useDb } from "../contexts/DbContext";
import type { ArtifactEntry, ArtifactInfo } from "../types";

/* ───────────── Frontmatter Parsing ───────────── */

interface FrontmatterData {
  id?: string;
  title?: string;
  version?: string;
  status?: string;
  author?: string;
  "last-updated"?: string;
  [key: string]: string | undefined;
}

interface ParsedContent {
  frontmatter: FrontmatterData | null;
  body: string;
}

function parseFrontmatter(raw: string): ParsedContent {
  const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = raw.match(fmRegex);

  if (!match) {
    return { frontmatter: null, body: raw };
  }

  const yamlBlock = match[1];
  const body = match[2];

  const frontmatter: FrontmatterData = {};
  for (const line of yamlBlock.split("\n")) {
    const kvMatch = line.match(/^(\S+):\s*"?([^"]*)"?\s*$/);
    if (kvMatch) {
      frontmatter[kvMatch[1]] = kvMatch[2];
    }
  }

  return { frontmatter, body };
}

/* ───────────── Frontmatter Display ───────────── */

const FrontmatterBar: Component<{ data: FrontmatterData }> = (props) => {
  const displayFields: Array<{ key: string; label: string }> = [
    { key: "id", label: "ID" },
    { key: "title", label: "Title" },
    { key: "version", label: "Version" },
    { key: "status", label: "Status" },
    { key: "author", label: "Author" },
    { key: "last-updated", label: "Updated" },
  ];

  return (
    <div class="bg-white/5 border border-border rounded-lg px-4 py-3 mb-6">
      <div class="flex flex-wrap gap-x-6 gap-y-2">
        <For each={displayFields}>
          {(field) => {
            const value = (): string | undefined => props.data[field.key];
            return (
              <Show when={value()}>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-text-dim">{field.label}:</span>
                  <span class="text-xs font-medium text-text">{value()}</span>
                </div>
              </Show>
            );
          }}
        </For>
      </div>
    </div>
  );
};

/* ───────────── File Icon Helper ───────────── */

/** Extract file extension from path or name */
function getFileExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function fileIcon(path: string): string {
  const ext = getFileExtension(path);
  switch (ext) {
    case "md":
      return "\u{1F4C4}";
    case "mmd":
    case "gv":
      return "\u{1F4CA}";
    case "json":
    case "yaml":
      return "\u{1F4CB}";
    default:
      return "\u{1F4C4}";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/* ───────────── File Tree ───────────── */

const FileTree: Component<{
  artifacts: ArtifactEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}> = (props) => {
  return (
    <div class="w-64 bg-surface border-r border-border flex flex-col shrink-0">
      <div class="px-3 py-2 border-b border-border">
        <span class="text-xs font-semibold text-text-dim uppercase tracking-wide">
          Artifacts
        </span>
      </div>
      <nav class="flex-1 overflow-auto py-1">
        <For each={props.artifacts}>
          {(artifact) => {
            const isActive = (): boolean => props.selectedPath === artifact.path;
            return (
              <button
                class={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${
                  isActive()
                    ? "text-accent bg-accent/10 border-r-2 border-accent"
                    : "text-text-dim hover:text-text hover:bg-white/5"
                }`}
                onClick={() => props.onSelect(artifact.path)}
              >
                <span class="text-xs">{fileIcon(artifact.path)}</span>
                <span class="truncate flex-1">{artifact.name}</span>
                <span class="text-[10px] text-text-dim shrink-0">
                  {formatSize(artifact.size)}
                </span>
              </button>
            );
          }}
        </For>
      </nav>
    </div>
  );
};

/* ───────────── Content Viewer ───────────── */

const ContentViewer: Component<{ artifactInfo: ArtifactInfo | null }> = (props) => {
  /** Get file type from path extension */
  const fileType = (): string | null => {
    const info = props.artifactInfo;
    if (!info) return null;
    return getFileExtension(info.path) || null;
  };

  const parsed = createMemo((): ParsedContent | null => {
    const info = props.artifactInfo;
    if (!info || !info.content) return null;
    if (fileType() === "md") {
      return parseFrontmatter(info.content);
    }
    return { frontmatter: null, body: info.content };
  });

  const renderedHtml = createMemo((): string | null => {
    const p = parsed();
    if (!p) return null;
    if (fileType() === "md") {
      return marked.parse(p.body, { async: false }) as string;
    }
    return null;
  });

  return (
    <div class="flex-1 p-6 overflow-auto">
      <Show
        when={props.artifactInfo}
        fallback={
          <div class="flex items-center justify-center h-full text-text-dim text-sm">
            Select a file to view its contents
          </div>
        }
      >
        <Show
          when={props.artifactInfo?.content}
          fallback={
            <div class="text-text-dim text-sm">No content available for this file.</div>
          }
        >
          {/* Markdown files */}
          <Show when={fileType() === "md"}>
            <Show when={parsed()?.frontmatter}>
              {(fm) => <FrontmatterBar data={fm()} />}
            </Show>
            <div
              class="artifact-prose text-text text-sm leading-relaxed"
              innerHTML={renderedHtml() ?? ""}
            />
          </Show>

          {/* Mermaid / Graphviz — display as code */}
          <Show when={fileType() === "mmd" || fileType() === "gv"}>
            <div class="mb-2">
              <span class="text-xs text-text-dim uppercase tracking-wide">
                {fileType() === "mmd" ? "Mermaid Diagram" : "Graphviz Diagram"}
              </span>
            </div>
            <pre class="bg-white/5 border border-border rounded-lg p-4 text-sm text-text font-mono overflow-auto whitespace-pre">
              {props.artifactInfo?.content}
            </pre>
          </Show>

          {/* YAML / JSON — formatted code */}
          <Show when={fileType() === "yaml" || fileType() === "json"}>
            <div class="mb-2">
              <span class="text-xs text-text-dim uppercase tracking-wide">
                {fileType()?.toUpperCase()}
              </span>
            </div>
            <pre class="bg-white/5 border border-border rounded-lg p-4 text-sm text-text font-mono overflow-auto whitespace-pre">
              {props.artifactInfo?.content}
            </pre>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

/* ───────────── Artifact Browser ───────────── */

const ArtifactBrowser: Component<{ projectSlug: string; artifactsDir: string }> = (props) => {
  const { listArtifacts, readArtifact } = useDb();

  const [artifacts, setArtifacts] = createSignal<ArtifactEntry[]>([]);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [currentArtifact, setCurrentArtifact] = createSignal<ArtifactInfo | null>(null);

  // Load artifact list when slug or artifactsDir changes
  createEffect(
    on(
      () => [props.projectSlug, props.artifactsDir] as const,
      async ([slug, artifactsDir]) => {
        if (!slug || !artifactsDir) return;
        try {
          // Construct absolute path: artifactsDir/slug
          const cleanDir = artifactsDir.replace(/[\\/]+$/, '');
          const fullPath = `${cleanDir}/${slug}`;
          const entries = await listArtifacts(fullPath);
          setArtifacts(entries);
          setSelectedPath(null);
          setCurrentArtifact(null);
        } catch {
          setArtifacts([]);
        }
      },
    ),
  );

  // Load artifact content when selection changes
  createEffect(
    on(selectedPath, async (path) => {
      if (!path) {
        setCurrentArtifact(null);
        return;
      }
      try {
        const info = await readArtifact(path);
        setCurrentArtifact(info);
      } catch {
        setCurrentArtifact(null);
      }
    }),
  );

  return (
    <div class="flex h-full border border-border rounded-lg overflow-hidden bg-bg">
      <FileTree
        artifacts={artifacts()}
        selectedPath={selectedPath()}
        onSelect={setSelectedPath}
      />
      <ContentViewer artifactInfo={currentArtifact()} />
    </div>
  );
};

export default ArtifactBrowser;
