export interface ProvenanceMetadata {
  provenance_id: string;
  model_info: ModelInfo;
  generation: GenerationInfo;
  code_info: CodeInfo;
  compliance: ComplianceInfo;
  context: ContextInfo;
  validation: ValidationInfo;
}

export interface ModelInfo {
  name: string;
  version: string;
  provider: string;
}

export interface GenerationInfo {
  timestamp: string;
  prompt_hash: string;
  confidence_score: number;
  temperature?: number;
}

export interface CodeInfo {
  file_path: string;
  function_name?: string;
  line_range: [number, number];
  lines_count: number;
  file_size_bytes: number;
  language: string;
}

export interface ComplianceInfo {
  flags: ComplianceFlag[];
  human_review_required: boolean;
  policy_version: string;
  risk_level: RiskLevel;
}

export interface ContextInfo {
  user_id: string;
  session_id: string;
  project_id: string;
  git_branch: string;
}

export interface ValidationInfo {
  signature: string;
  chain_hash?: string;
}

export type ComplianceFlag = 'HIPAA' | 'GDPR' | 'PCI-DSS' | 'SOX';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface BobSession {
  session_id: string;
  timestamp: string;
  prompt: string;
  response: string;
  model: string;
  model_version: string;
  target_file?: string;
  line_range?: [number, number];
}

// Made with Bob
