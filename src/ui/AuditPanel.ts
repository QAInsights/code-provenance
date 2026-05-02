import * as vscode from 'vscode';
import { ProvenanceStore } from '../storage/ProvenanceStore';

export class AuditPanel {
  public static currentPanel: AuditPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private store: ProvenanceStore;

  private constructor(panel: vscode.WebviewPanel, store: ProvenanceStore) {
    this.panel = panel;
    this.store = store;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this.disposables
    );

    this.update();
  }

  public static createOrShow(extensionUri: vscode.Uri, store: ProvenanceStore): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (AuditPanel.currentPanel) {
      AuditPanel.currentPanel.panel.reveal(column);
      AuditPanel.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'codeProvenanceAudit',
      'AI Code Audit Trail',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    AuditPanel.currentPanel = new AuditPanel(panel, store);
  }

  public update(): void {
    this.panel.webview.html = this.getHtmlContent();
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'refresh':
        this.update();
        break;
      case 'export':
        await this.exportData();
        break;
      case 'clearAll':
        await this.clearAllRecords();
        break;
      case 'deleteRecord':
        await this.deleteRecord(message.id);
        break;
      case 'openFile':
        await this.openFile(message.file, message.line);
        break;
      case 'filter':
        this.updateWithFilter(message.filter);
        break;
    }
  }

  private async exportData(): Promise<void> {
    const json = this.store.exportToJSON();
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('provenance-audit.json'),
      filters: { 'JSON': ['json'] }
    });

    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
      vscode.window.showInformationMessage('Audit trail exported successfully');
    }
  }

  private async clearAllRecords(): Promise<void> {
    const answer = await vscode.window.showWarningMessage(
      'Are you sure you want to clear all audit records?',
      'Yes', 'No'
    );

    if (answer === 'Yes') {
      this.store.clearAllRecords();
      this.update();
      vscode.window.showInformationMessage('All audit records cleared');
    }
  }

  private async deleteRecord(id: string): Promise<void> {
    this.store.deleteRecord(id);
    this.update();
  }

  private async openFile(file: string, line: number): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const uri = vscode.Uri.joinPath(workspaceFolder.uri, file);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    
    const position = new vscode.Position(line - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
  }

  private updateWithFilter(_filter: any): void {
    // Filter logic will be handled in the HTML/JS
    this.update();
  }

  private getHtmlContent(): string {
    const records = this.store.getAllRecords();
    const stats = this.store.getStatistics();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Code Audit Trail</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 10px;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 2px;
      font-size: 13px;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    button.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 25px;
    }

    .stat-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 15px;
      border-radius: 4px;
      border-left: 3px solid var(--vscode-textLink-foreground);
    }

    .stat-label {
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 5px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
    }

    .filters {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    select, input {
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 6px 10px;
      border-radius: 2px;
      font-size: 13px;
    }

    .records {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .record {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 15px;
      border-radius: 4px;
      border-left: 3px solid;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .record:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .record.risk-low { border-left-color: #4caf50; }
    .record.risk-medium { border-left-color: #ff9800; }
    .record.risk-high { border-left-color: #f44336; }
    .record.risk-critical { border-left-color: #9c27b0; }

    .record-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .record-title {
      font-weight: 600;
      font-size: 14px;
    }

    .record-badges {
      display: flex;
      gap: 5px;
    }

    .badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge.confidence {
      background-color: var(--vscode-textLink-foreground);
      color: var(--vscode-editor-background);
    }

    .badge.tab {
      background-color: #2196f3;
      color: white;
    }

    .badge.block {
      background-color: #9c27b0;
      color: white;
    }

    .badge.risk {
      background-color: #f44336;
      color: white;
    }

    .record-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      font-size: 12px;
      opacity: 0.9;
    }

    .detail {
      display: flex;
      flex-direction: column;
    }

    .detail-label {
      opacity: 0.7;
      margin-bottom: 2px;
    }

    .detail-value {
      font-weight: 500;
    }

    .record-actions {
      margin-top: 10px;
      display: flex;
      gap: 5px;
    }

    .record-actions button {
      padding: 4px 10px;
      font-size: 11px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      opacity: 0.6;
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }

    .compliance-flags {
      display: flex;
      gap: 5px;
      margin-top: 5px;
    }

    .compliance-flag {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      background-color: var(--vscode-editorWarning-foreground);
      color: var(--vscode-editor-background);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 AI Code Audit Trail</h1>
    <div class="actions">
      <button onclick="refresh()">↻ Refresh</button>
      <button onclick="exportData()">📥 Export</button>
      <button class="secondary" onclick="clearAll()">🗑️ Clear All</button>
    </div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Total AI Generations</div>
      <div class="stat-value">${stats.totalRecords}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average Confidence</div>
      <div class="stat-value">${stats.averageConfidence.toFixed(1)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Tab Completions</div>
      <div class="stat-value">${stats.tabCompletions}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Block Completions</div>
      <div class="stat-value">${stats.blockCompletions}</div>
    </div>
  </div>

  <div class="filters">
    <select id="riskFilter" onchange="applyFilters()">
      <option value="">All Risk Levels</option>
      <option value="low">Low Risk</option>
      <option value="medium">Medium Risk</option>
      <option value="high">High Risk</option>
      <option value="critical">Critical Risk</option>
    </select>
    <select id="languageFilter" onchange="applyFilters()">
      <option value="">All Languages</option>
      ${Object.keys(stats.byLanguage).map(lang => 
        `<option value="${lang}">${lang} (${stats.byLanguage[lang]})</option>`
      ).join('')}
    </select>
    <input type="text" id="searchFilter" placeholder="Search files..." onkeyup="applyFilters()">
  </div>

  <div class="records" id="recordsList">
    ${records.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div>No AI-generated code detected yet</div>
        <div style="margin-top: 10px; font-size: 12px;">Start coding with AI assistance to see audit trails here</div>
      </div>
    ` : records.map(record => `
      <div class="record risk-${record.compliance?.risk_level || 'low'}" data-record='${JSON.stringify(record)}'>
        <div class="record-header">
          <div class="record-title">${record.file}</div>
          <div class="record-badges">
            <span class="badge confidence">${record.detection.confidence}%</span>
            ${record.detection.is_tab_completion ? '<span class="badge tab">Tab</span>' : ''}
            ${record.detection.is_block ? '<span class="badge block">Block</span>' : ''}
            ${record.compliance?.risk_level !== 'low' ? `<span class="badge risk">${record.compliance?.risk_level}</span>` : ''}
          </div>
        </div>
        <div class="record-details">
          <div class="detail">
            <span class="detail-label">Language</span>
            <span class="detail-value">${record.language}</span>
          </div>
          <div class="detail">
            <span class="detail-label">Lines</span>
            <span class="detail-value">${record.lineRange[0]}-${record.lineRange[1]}</span>
          </div>
          <div class="detail">
            <span class="detail-label">Speed</span>
            <span class="detail-value">${record.detection.speed_ms}ms</span>
          </div>
          <div class="detail">
            <span class="detail-label">Timestamp</span>
            <span class="detail-value">${new Date(record.timestamp).toLocaleString()}</span>
          </div>
        </div>
        ${record.compliance?.flags && record.compliance.flags.length > 0 ? `
          <div class="compliance-flags">
            ${record.compliance.flags.map(flag => `<span class="compliance-flag">${flag}</span>`).join('')}
          </div>
        ` : ''}
        <div class="record-actions">
          <button onclick='openFile("${record.file}", ${record.lineRange[0]})'>📄 Open File</button>
          <button onclick='deleteRecord("${record.id}")'>🗑️ Delete</button>
        </div>
      </div>
    `).join('')}
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function exportData() {
      vscode.postMessage({ command: 'export' });
    }

    function clearAll() {
      if (confirm('Are you sure you want to clear all audit records?')) {
        vscode.postMessage({ command: 'clearAll' });
      }
    }

    function deleteRecord(id) {
      vscode.postMessage({ command: 'deleteRecord', id });
    }

    function openFile(file, line) {
      vscode.postMessage({ command: 'openFile', file, line });
    }

    function applyFilters() {
      const riskFilter = document.getElementById('riskFilter').value;
      const languageFilter = document.getElementById('languageFilter').value;
      const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

      const records = document.querySelectorAll('.record');
      records.forEach(record => {
        const data = JSON.parse(record.getAttribute('data-record'));
        let show = true;

        if (riskFilter && data.compliance?.risk_level !== riskFilter) {
          show = false;
        }

        if (languageFilter && data.language !== languageFilter) {
          show = false;
        }

        if (searchFilter && !data.file.toLowerCase().includes(searchFilter)) {
          show = false;
        }

        record.style.display = show ? 'block' : 'none';
      });
    }
  </script>
</body>
</html>`;
  }

  public dispose(): void {
    AuditPanel.currentPanel = undefined;
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

// Made with Bob