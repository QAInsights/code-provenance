import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BobSession, ProvenanceMetadata, ComplianceFlag } from '../types';

export class BobSessionWatcher {
  private watcher: vscode.FileSystemWatcher | null = null;
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  start(): void {
    const sessionPattern = new vscode.RelativePattern(
      this.workspaceRoot,
      'bob_sessions/**/*.json'
    );

    this.watcher = vscode.workspace.createFileSystemWatcher(sessionPattern);

    this.watcher.onDidCreate(async (uri) => {
      await this.handleNewSession(uri);
    });

    this.watcher.onDidChange(async (uri) => {
      await this.handleSessionUpdate(uri);
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }
  }

  private async handleNewSession(uri: vscode.Uri): Promise<void> {
    try {
      const content = await fs.readFile(uri.fsPath, 'utf-8');
      const session = JSON.parse(content) as BobSession;
      
      const provenance = this.convertSessionToProvenance(session);
      
      vscode.window.showInformationMessage(
        `Captured provenance from Bob session: ${session.session_id}`
      );
      
      console.log('Provenance captured:', provenance);
    } catch (error) {
      console.error('Failed to process Bob session:', error);
    }
  }

  private async handleSessionUpdate(uri: vscode.Uri): Promise<void> {
    console.log('Bob session updated:', uri.fsPath);
  }

  private convertSessionToProvenance(session: BobSession): ProvenanceMetadata {
    return {
      provenance_id: session.session_id,
      model_info: {
        name: session.model,
        version: session.model_version,
        provider: 'ibm'
      },
      generation: {
        timestamp: session.timestamp,
        prompt_hash: this.hashPrompt(session.prompt),
        confidence_score: 0.95
      },
      code_info: {
        file_path: session.target_file || 'unknown',
        line_range: session.line_range || [0, 0],
        lines_count: session.line_range ? session.line_range[1] - session.line_range[0] : 0,
        file_size_bytes: 0,
        language: this.detectLanguage(session.target_file || '')
      },
      compliance: {
        flags: this.detectComplianceFlags(session.response),
        human_review_required: this.requiresReview(session.response),
        policy_version: 'v1.0.0',
        risk_level: this.assessRisk(session.response)
      },
      context: {
        user_id: 'current-user',
        session_id: session.session_id,
        project_id: path.basename(this.workspaceRoot),
        git_branch: 'main'
      },
      validation: {
        signature: ''
      }
    };
  }

  private hashPrompt(prompt: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(prompt).digest('hex');
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go'
    };
    return langMap[ext] || 'unknown';
  }

  private detectComplianceFlags(code: string): ComplianceFlag[] {
    const flags: ComplianceFlag[] = [];
    if (/patient|medical|health|phi/i.test(code)) flags.push('HIPAA');
    if (/payment|credit|card/i.test(code)) flags.push('PCI-DSS');
    if (/personal|privacy|gdpr/i.test(code)) flags.push('GDPR');
    return flags;
  }

  private requiresReview(code: string): boolean {
    return /auth|login|password|token|encrypt|payment/i.test(code);
  }

  private assessRisk(code: string): 'low' | 'medium' | 'high' | 'critical' {
    if (/password|secret|key|token/i.test(code)) return 'critical';
    if (/auth|login|payment/i.test(code)) return 'high';
    if (/database|sql|query/i.test(code)) return 'medium';
    return 'low';
  }
}

// Made with Bob
