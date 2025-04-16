export type PhaseStatus = "pending" | "in_progress" | "completed" | "failed";

export interface Template {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface Phase {
  id: string;
  name: string;
  status: PhaseStatus;
  template?: Template;
  expectedOutput: string;
  codeAnalysisEnabled: boolean;
  autoMergeSettings: {
    enabled: boolean;
    strategy: "squash" | "merge" | "rebase";
  };
  successCriteria: {
    testCoverage?: number;
    lintingPassed: boolean;
    customChecks: string[];
  };
}

export interface ConcurrentFeature {
  id: string;
  name: string;
  dependencies: string[];
  priority: number;
  rateLimit?: number;
}
