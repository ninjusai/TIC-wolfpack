import {
  createContext,
  createSignal,
  useContext,
  type ParentComponent,
  type Accessor,
} from "solid-js";

interface ProjectContextValue {
  activeProject: Accessor<string | null>;
  setActiveProject: (slug: string | null) => void;
}

const ProjectContext = createContext<ProjectContextValue>();

export const ProjectProvider: ParentComponent = (props) => {
  const [activeProject, setActiveProject] = createSignal<string | null>(null);

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {props.children}
    </ProjectContext.Provider>
  );
};

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return ctx;
}
