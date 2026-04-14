import type { Component } from "solid-js";
import { Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { useProject } from "../contexts/ProjectContext";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: "\u{1F4CA}" },
  { path: "/intake", label: "Intake", icon: "\u{1F4E5}" },
  { path: "/db", label: "DB Explorer", icon: "\u{1F5C4}" },
  { path: "/agents", label: "Agent Roster", icon: "\u{1F43A}" },
  { path: "/settings", label: "Settings", icon: "\u2699\uFE0F" },
];

const Sidebar: Component = () => {
  const location = useLocation();
  const { activeProject } = useProject();

  const isActive = (path: string): boolean => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const isProjectRoute = (): boolean => location.pathname.startsWith("/project/");

  return (
    <aside class="w-60 bg-surface border-r border-border flex flex-col shrink-0">
      {/* Logo / Title */}
      <div class="h-14 flex items-center px-4 border-b border-border">
        <span class="text-accent font-bold text-lg tracking-tight">
          Wolf Pack
        </span>
      </div>

      {/* Navigation */}
      <nav class="flex-1 py-2">
        {navItems.map((item) => (
          <A
            href={item.path}
            class={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              isActive(item.path)
                ? "text-accent bg-accent/10 border-r-2 border-accent"
                : "text-text-dim hover:text-text hover:bg-white/5"
            }`}
          >
            <span class="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </A>
        ))}

        {/* Active project indicator - shows whenever a project is selected */}
        <Show when={activeProject()}>
          <div class="mt-2 pt-2 border-t border-border">
            <A
              href={`/project/${activeProject()}`}
              class={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isProjectRoute()
                  ? "text-accent bg-accent/10 border-r-2 border-accent"
                  : "text-text-dim hover:text-text hover:bg-white/5"
              }`}
            >
              <span class="text-base">{"\u{1F4C1}"}</span>
              <span class="truncate">{activeProject()}</span>
            </A>
          </div>
        </Show>
      </nav>

      {/* Footer */}
      <div class="px-4 py-3 border-t border-border">
        <p class="text-xs text-text-dim">Mission Control v0.1.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;
