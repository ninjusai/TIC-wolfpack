/** Types for the project intake / scaffolding flow */

export interface IntakeData {
  title: string;
  slug: string;
  description: string;
  mode: string;  // Required by Rust
  problem: string;
  users: string;
  scopeIn: string[];
  scopeOut: string[];
  constraints: string;
  successCriteria: string[];
  priorArt: string;
}

export interface SlugValidation {
  available: boolean;
  suggestion: string | null;
}
