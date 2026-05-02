import * as vscode from 'vscode';
import { BobSessionWatcher } from './core/BobSessionWatcher';
import { AIBehaviorDetector } from './core/AIBehaviorDetector';
import { ProvenanceStore } from './storage/ProvenanceStore';
import { AuditPanel } from './ui/AuditPanel';

let sessionWatcher: BobSessionWatcher | null = null;
let behaviorDetector: AIBehaviorDetector | null = null;
let store: ProvenanceStore | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  // Initialize storage
  store = new ProvenanceStore(workspaceRoot);

  // Initialize watchers
  sessionWatcher = new BobSessionWatcher(workspaceRoot);
  sessionWatcher.start();

  behaviorDetector = new AIBehaviorDetector(store);
  const detectorSubscription = behaviorDetector.start();
  context.subscriptions.push(detectorSubscription);

  // Show audit trail command
  const showAuditCommand = vscode.commands.registerCommand(
    'codeProvenance.showAudit',
    () => {
      if (store) {
        AuditPanel.createOrShow(context.extensionUri, store);
      }
    }
  );

  const showStatusCommand = vscode.commands.registerCommand(
    'codeProvenance.showStatus',
    () => {
      if (store) {
        const stats = store.getStatistics();
        vscode.window.showInformationMessage(
          `AI Code: ${stats.totalRecords} generations | Avg Confidence: ${stats.averageConfidence.toFixed(1)}%`
        );
      } else {
        vscode.window.showInformationMessage('Code Provenance: Active and watching Bob sessions');
      }
    }
  );

  const queryProvenanceCommand = vscode.commands.registerCommand(
    'codeProvenance.queryProvenance',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }
      
      if (store) {
        const filePath = vscode.workspace.asRelativePath(editor.document.uri);
        const records = store.getRecordsByFile(filePath);

        if (records.length === 0) {
          vscode.window.showInformationMessage(`No AI-generated code found in ${filePath}`);
        } else {
          vscode.window.showInformationMessage(
            `Found ${records.length} AI-generated code block(s) in ${filePath}`
          );
          AuditPanel.createOrShow(context.extensionUri, store);
        }
      }
    }
  );

  const validateCommand = vscode.commands.registerCommand(
    'codeProvenance.validateRepository',
    () => {
      if (store) {
        const stats = store.getStatistics();
        const highRisk = store.getRecordsByRiskLevel('high').length +
                         store.getRecordsByRiskLevel('critical').length;
        
        if (highRisk > 0) {
          vscode.window.showWarningMessage(
            `⚠️ Found ${highRisk} high-risk AI-generated code block(s) requiring review`
          );
        } else {
          vscode.window.showInformationMessage(
            `✅ Repository validated: ${stats.totalRecords} AI generations, no high-risk items`
          );
        }
        
        AuditPanel.createOrShow(context.extensionUri, store);
      } else {
        vscode.window.showInformationMessage('Validating repository provenance...');
      }
    }
  );

  const exportAuditCommand = vscode.commands.registerCommand(
    'codeProvenance.exportAudit',
    async () => {
      if (store) {
        const json = store.exportToJSON();
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('provenance-audit.json'),
          filters: { 'JSON': ['json'] }
        });

        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
          vscode.window.showInformationMessage('Audit trail exported successfully');
        }
      }
    }
  );

  context.subscriptions.push(
    showAuditCommand,
    showStatusCommand,
    queryProvenanceCommand,
    validateCommand,
    exportAuditCommand
  );

  // Show welcome message
  vscode.window.showInformationMessage(
    '🔍 Code Provenance is now tracking AI-generated code',
    'Show Audit Trail'
  ).then(selection => {
    if (selection === 'Show Audit Trail' && store) {
      AuditPanel.createOrShow(context.extensionUri, store);
    }
  });
}

export function deactivate(): void {
  if (sessionWatcher) {
    sessionWatcher.stop();
    sessionWatcher = null;
  }
  behaviorDetector = null;
  store = null;
}

// Made with Bob
