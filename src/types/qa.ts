export interface QAIssue {
  code: string;
  message: string;
  slideIndex?: number;
  elementIndex?: number;
}

export interface QAResult {
  hasIssues: boolean;
  issues: QAIssue[];
}

export interface QAConfig {
  autoFix?: boolean;
  maxIterations?: number;
}
