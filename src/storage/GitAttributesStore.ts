import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface EmbeddedProvenance {
  id: string;
  timestamp: string;
  model: {
    name: string;
    version: string;
    provider: string;
  };
  generation: {
    prompt_hash: string;
    confidence_score: number;
  };
  compliance: {
    flags: string[];
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    human_review_required: boolean;
  };
  signature: string;
}

export class GitAttributesStore {
  private repoPath: string;
  private gitattributesPath: string;
  private readonly PROV_PREFIX = 'prov:';
  private readonly PROV_MARKER = 'AI-GENERATED-CODE';

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.gitattributesPath = path.join(repoPath, '.gitattributes');
    this.ensureGitattributes();
  }

 
  private ensureGitattributes(): void {
    if (!fs.existsSync(this.gitattributesPath)) {
      this.createDefaultGitattributes();
    } else {
      this.updateExistingGitattributes();
    }
  }

  /**
   * Create a new .gitattributes file with provenance tracking.
   */
  private createDefaultGitattributes(): void {
    const content = `# Code Provenance Tracking
# This file marks source files for AI-generated code tracking

# Track all source files for provenance
*.ts provenance=text
*.js provenance=text
*.py provenance=text
*.java provenance=text
*.go provenance=text
*.rs provenance=text
*.cpp provenance=text
*.c provenance=text
*.h provenance=text
*.hpp provenance=text

# Mark files that contain AI-generated code sections
*.ts diff=provenance
*.js diff=provenance
*.py diff=provenance

# Binary files - no provenance tracking
*.png binary
*.jpg binary
*.gif binary
*.ico binary
*.woff binary
*.woff2 binary
*.ttf binary
*.eot binary
`;
    fs.writeFileSync(this.gitattributesPath, content, 'utf-8');
  }

 
  private updateExistingGitattributes(): void {
    let content = fs.readFileSync(this.gitattributesPath, 'utf-8');

    // Check if provenance tracking is already configured
    if (content.includes('provenance=') || content.includes('Code Provenance')) {
      return;
    }

    const provenanceSection = `
# Code Provenance Tracking (added by code-provenance extension)
*.ts provenance=text diff=provenance
*.js provenance=text diff=provenance
*.py provenance=text diff=provenance
*.java provenance=text diff=provenance
*.go provenance=text diff=provenance
*.rs provenance=text diff=provenance
*.cpp provenance=text diff=provenance
*.c provenance=text diff=provenance
`;

    content = content.trim() + '\n' + provenanceSection;
    fs.writeFileSync(this.gitattributesPath, content, 'utf-8');
  }

 
  private getCommentSyntax(filePath: string): { start: string; end?: string } {
    const ext = path.extname(filePath).toLowerCase();

    const singleLineComments = ['.ts', '.js', '.java', '.go', '.rs', '.cpp', '.c', '.h', '.hpp', '.swift', '.kt'];
    if (singleLineComments.includes(ext)) {
      return { start: '//' };
    }

    if (ext === '.py' || ext === '.rb' || ext === '.sh' || ext === '.yaml' || ext === '.yml') {
      return { start: '#' };
    }

    // Default to C-style comments
    return { start: '//' };
  }

 
  async embedProvenance(
    filePath: string,
    lineRange: [number, number],
    provenance: Omit<EmbeddedProvenance, 'id' | 'timestamp' | 'signature'>
  ): Promise<string> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.repoPath, filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n');

    // Generate provenance ID and signature
    const id = this.generateProvenanceId();
    const timestamp = new Date().toISOString();
    const fullProvenance: EmbeddedProvenance = {
      id,
      timestamp,
      ...provenance,
      signature: this.generateSignature(provenance, filePath, lineRange)
    };

    // Create embedded comment
    const commentSyntax = this.getCommentSyntax(filePath);
    const encodedData = Buffer.from(JSON.stringify(fullProvenance)).toString('base64');

    // Insert provenance comment at the start of the AI-generated section
    const startLine = lineRange[0];
    const insertLine = Math.max(0, startLine - 1);

    const provenanceComment = commentSyntax.end
      ? `${commentSyntax.start} ${this.PROV_MARKER}: ${this.PROV_PREFIX} ${encodedData} ${commentSyntax.end}`
      : `${commentSyntax.start} ${this.PROV_MARKER}: ${this.PROV_PREFIX} ${encodedData}`;

    // Insert the provenance comment
    lines.splice(insertLine, 0, provenanceComment);

    fs.writeFileSync(absolutePath, lines.join('\n'), 'utf-8');

    return id;
  }

 
  extractProvenance(filePath: string): Array<EmbeddedProvenance & { line: number }> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.repoPath, filePath);

    if (!fs.existsSync(absolutePath)) {
      return [];
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n');
    const results: Array<EmbeddedProvenance & { line: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const provenanceData = this.parseProvenanceLine(line);

      if (provenanceData) {
        results.push({
          ...provenanceData,
          line: i + 1
        });
      }
    }

    return results;
  }

 
  private parseProvenanceLine(line: string): EmbeddedProvenance | null {
    const markerIndex = line.indexOf(this.PROV_MARKER);
    if (markerIndex === -1) {
      return null;
    }

    const prefixIndex = line.indexOf(this.PROV_PREFIX, markerIndex);
    if (prefixIndex === -1) {
      return null;
    }

    const startIndex = prefixIndex + this.PROV_PREFIX.length;
    let endIndex = line.length;

    // Handle block comments
    const blockCommentEnd = line.lastIndexOf('*/');
    if (blockCommentEnd > startIndex) {
      endIndex = blockCommentEnd;
    }

    const encodedData = line.substring(startIndex, endIndex).trim();

    try {
      const jsonData = Buffer.from(encodedData, 'base64').toString('utf-8');
      return JSON.parse(jsonData) as EmbeddedProvenance;
    } catch {
      return null;
    }
  }

 
  async removeProvenance(filePath: string, provenanceId?: string): Promise<number> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.repoPath, filePath);

    if (!fs.existsSync(absolutePath)) {
      return 0;
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n');
    const originalLength = lines.length;

    const filteredLines = lines.filter((line) => {
      const provenance = this.parseProvenanceLine(line);
      if (!provenance) {
        return true; // Keep non-provenance lines
      }
      // If specific ID provided, only remove that one
      if (provenanceId) {
        return provenance.id !== provenanceId;
      }
      // Remove all provenance
      return false;
    });

    fs.writeFileSync(absolutePath, filteredLines.join('\n'), 'utf-8');

    return originalLength - filteredLines.length;
  }

 
  verifyProvenance(filePath: string, lineNumber: number): boolean {
    const provenanceList = this.extractProvenance(filePath);
    const provenance = provenanceList.find((p) => p.line === lineNumber);

    if (!provenance) {
      return false;
    }

    const expectedSignature = this.generateSignature(
      {
        model: provenance.model,
        generation: provenance.generation,
        compliance: provenance.compliance
      },
      filePath,
      [lineNumber, lineNumber]
    );

    return provenance.signature === expectedSignature;
  }

 
  findAllProvenanceFiles(): string[] {
    const results: string[] = [];
    this.scanDirectory(this.repoPath, results);
    return results;
  }

 
  private scanDirectory(dir: string, results: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip common non-source directories
        if (entry.name === 'node_modules' ||
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'out' ||
            entry.name === 'build') {
          continue;
        }
        this.scanDirectory(fullPath, results);
      } else if (entry.isFile()) {
        const provenance = this.extractProvenance(fullPath);
        if (provenance.length > 0) {
          results.push(path.relative(this.repoPath, fullPath));
        }
      }
    }
  }

 
  getRepositoryStats(): {
    totalFiles: number;
    totalProvenanceEntries: number;
    byRiskLevel: Record<string, number>;
    byModel: Record<string, number>;
    filesNeedingReview: string[];
  } {
    const files = this.findAllProvenanceFiles();
    const byRiskLevel: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const filesNeedingReview: string[] = [];
    let totalEntries = 0;

    for (const file of files) {
      const provenanceList = this.extractProvenance(file);
      totalEntries += provenanceList.length;

      let fileNeedsReview = false;

      for (const provenance of provenanceList) {
        // Count by risk level
        byRiskLevel[provenance.compliance.risk_level] =
          (byRiskLevel[provenance.compliance.risk_level] || 0) + 1;

        // Count by model
        const modelKey = `${provenance.model.provider}/${provenance.model.name}`;
        byModel[modelKey] = (byModel[modelKey] || 0) + 1;

        // Check if review required
        if (provenance.compliance.human_review_required) {
          fileNeedsReview = true;
        }
      }

      if (fileNeedsReview) {
        filesNeedingReview.push(file);
      }
    }

    return {
      totalFiles: files.length,
      totalProvenanceEntries: totalEntries,
      byRiskLevel,
      byModel,
      filesNeedingReview
    };
  }

 
  private generateProvenanceId(): string {
    return `prov-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

 
  private generateSignature(
    provenance: Omit<EmbeddedProvenance, 'id' | 'timestamp' | 'signature'>,
    filePath: string,
    lineRange: [number, number]
  ): string {
    const data = JSON.stringify({
      model: provenance.model,
      generation: provenance.generation,
      compliance: provenance.compliance,
      file: filePath,
      lines: lineRange
    });

    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, 16);
  }

 
  getGitattributesPath(): string {
    return this.gitattributesPath;
  }

 
  isTrackedForProvenance(filePath: string): boolean {
    if (!fs.existsSync(this.gitattributesPath)) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(this.gitattributesPath, 'utf-8');

    const pattern = new RegExp(`\\${ext}.*provenance=`);
    return pattern.test(content);
  }
}

// Made with Bob
