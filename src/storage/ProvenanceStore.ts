import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ProvenanceRecord {
  id: string;
  timestamp: string;
  file: string;
  language: string;
  lineRange: [number, number];
  code: string;
  codeHash: string;
  detection: {
    speed_ms: number;
    is_block: boolean;
    is_tab_completion: boolean;
    confidence: number;
  };
  model?: {
    name: string;
    version: string;
    provider: string;
  };
  compliance?: {
    flags: string[];
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    human_review_required: boolean;
  };
  session_id?: string;
  user?: string;
}

export class ProvenanceStore {
  private storePath: string;
  private records: Map<string, ProvenanceRecord> = new Map();
  private projectId: string;

  constructor(workspaceRoot: string) {
    this.projectId = this.generateProjectId(workspaceRoot);
    this.storePath = path.join(workspaceRoot, '.vscode', 'provenance');
    this.ensureStoreDirectory();
    this.loadRecords();
  }

  private generateProjectId(workspaceRoot: string): string {
    return crypto.createHash('sha256')
      .update(workspaceRoot)
      .digest('hex')
      .substring(0, 16);
  }

  private ensureStoreDirectory(): void {
    if (!fs.existsSync(this.storePath)) {
      fs.mkdirSync(this.storePath, { recursive: true });
    }
  }

  private getStoreFilePath(): string {
    return path.join(this.storePath, 'audit-trail.json');
  }

  private loadRecords(): void {
    try {
      const filePath = this.getStoreFilePath();
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const records = JSON.parse(data) as ProvenanceRecord[];
        records.forEach(record => {
          this.records.set(record.id, record);
        });
      }
    } catch (error) {
      console.error('Failed to load provenance records:', error);
    }
  }

  private saveRecords(): void {
    try {
      const filePath = this.getStoreFilePath();
      const records = Array.from(this.records.values());
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save provenance records:', error);
    }
  }

  async addRecord(record: Omit<ProvenanceRecord, 'id' | 'timestamp'>): Promise<ProvenanceRecord> {
    const fullRecord: ProvenanceRecord = {
      id: this.generateRecordId(),
      timestamp: new Date().toISOString(),
      ...record
    };

    this.records.set(fullRecord.id, fullRecord);
    this.saveRecords();
    
    return fullRecord;
  }

  private generateRecordId(): string {
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  getRecord(id: string): ProvenanceRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): ProvenanceRecord[] {
    return Array.from(this.records.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getRecordsByFile(filePath: string): ProvenanceRecord[] {
    return this.getAllRecords().filter(record => record.file === filePath);
  }

  getRecordsByDateRange(startDate: Date, endDate: Date): ProvenanceRecord[] {
    return this.getAllRecords().filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= startDate && recordDate <= endDate;
    });
  }

  getRecordsByConfidence(minConfidence: number): ProvenanceRecord[] {
    return this.getAllRecords().filter(record => 
      record.detection.confidence >= minConfidence
    );
  }

  getRecordsByRiskLevel(riskLevel: 'low' | 'medium' | 'high' | 'critical'): ProvenanceRecord[] {
    return this.getAllRecords().filter(record => 
      record.compliance?.risk_level === riskLevel
    );
  }

  getStatistics(): {
    totalRecords: number;
    byLanguage: Record<string, number>;
    byRiskLevel: Record<string, number>;
    byConfidence: { low: number; medium: number; high: number };
    tabCompletions: number;
    blockCompletions: number;
    averageConfidence: number;
  } {
    const records = this.getAllRecords();
    const stats = {
      totalRecords: records.length,
      byLanguage: {} as Record<string, number>,
      byRiskLevel: {} as Record<string, number>,
      byConfidence: { low: 0, medium: 0, high: 0 },
      tabCompletions: 0,
      blockCompletions: 0,
      averageConfidence: 0
    };

    let totalConfidence = 0;

    records.forEach(record => {
      // Language stats
      stats.byLanguage[record.language] = (stats.byLanguage[record.language] || 0) + 1;

      // Risk level stats
      if (record.compliance?.risk_level) {
        stats.byRiskLevel[record.compliance.risk_level] = 
          (stats.byRiskLevel[record.compliance.risk_level] || 0) + 1;
      }

      // Confidence stats
      const confidence = record.detection.confidence;
      totalConfidence += confidence;
      if (confidence < 50) stats.byConfidence.low++;
      else if (confidence < 80) stats.byConfidence.medium++;
      else stats.byConfidence.high++;

      // Detection type stats
      if (record.detection.is_tab_completion) stats.tabCompletions++;
      if (record.detection.is_block) stats.blockCompletions++;
    });

    stats.averageConfidence = records.length > 0 ? totalConfidence / records.length : 0;

    return stats;
  }

  deleteRecord(id: string): boolean {
    const deleted = this.records.delete(id);
    if (deleted) {
      this.saveRecords();
    }
    return deleted;
  }

  clearAllRecords(): void {
    this.records.clear();
    this.saveRecords();
  }

  exportToJSON(): string {
    return JSON.stringify({
      projectId: this.projectId,
      exportDate: new Date().toISOString(),
      records: this.getAllRecords()
    }, null, 2);
  }

  getProjectId(): string {
    return this.projectId;
  }
}

// Made with Bob