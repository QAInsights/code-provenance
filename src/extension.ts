import * as vscode from 'vscode';
import * as fs from 'fs';
import { BobSessionWatcher } from './core/BobSessionWatcher';
import { AIBehaviorDetector } from './core/AIBehaviorDetector';
import { ProvenanceStore } from './storage/ProvenanceStore';
import { GitAttributesStore } from './storage/GitAttributesStore';
import { AuditPanel } from './ui/AuditPanel';
import { BobApiClient, BobApiConfig } from './api/BobApiClient';

let sessionWatcher: BobSessionWatcher | null = null;
let behaviorDetector: AIBehaviorDetector | null = null;
let store: ProvenanceStore | null = null;
let gitStore: GitAttributesStore | null = null;
let bobApiClient: BobApiClient | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  // Initialize storage
  store = new ProvenanceStore(workspaceRoot);
  gitStore = new GitAttributesStore(workspaceRoot);

  // Initialize Bob API client
  const config = vscode.workspace.getConfiguration('codeProvenance');
  const bobApiConfig: BobApiConfig = {
    apiKey: config.get('bobApiKey', ''),
    teamId: config.get('bobTeamId', ''),
    baseUrl: config.get('bobInstanceUrl', 'https://api.bob.ibm.com'),
    enabled: config.get('bobApiEnabled', false),
  };
  bobApiClient = new BobApiClient(bobApiConfig);

  // Initialize watchers
  sessionWatcher = new BobSessionWatcher(workspaceRoot, store);
  sessionWatcher.start();

  behaviorDetector = new AIBehaviorDetector(store, gitStore);
  const detectorSubscription = behaviorDetector.start();
  context.subscriptions.push(detectorSubscription);

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('codeProvenance')) {
        const newConfig = vscode.workspace.getConfiguration('codeProvenance');
        if (bobApiClient) {
          bobApiClient.updateConfig({
            apiKey: newConfig.get('bobApiKey', ''),
            teamId: newConfig.get('bobTeamId', ''),
            baseUrl: newConfig.get('bobInstanceUrl', 'https://api.bob.ibm.com'),
            enabled: newConfig.get('bobApiEnabled', false),
          });
        }
      }
    })
  );

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

  // Test Bob API connection command
  const testBobApiCommand = vscode.commands.registerCommand(
    'codeProvenance.testBobApi',
    async () => {
      if (!bobApiClient) {
        vscode.window.showErrorMessage('Bob API client not initialized');
        return;
      }

      vscode.window.showInformationMessage('Testing Bob API connection...');
      const result = await bobApiClient.testConnection();

      if (result.success) {
        vscode.window.showInformationMessage(`✅ ${result.message}`);
      } else {
        vscode.window.showErrorMessage(`❌ ${result.message}`);
      }
    }
  );

  // Fetch Bob inference history command
  const fetchBobHistoryCommand = vscode.commands.registerCommand(
    'codeProvenance.fetchBobHistory',
    async () => {
      if (!bobApiClient || !store) {
        vscode.window.showErrorMessage('Bob API client or store not initialized');
        return;
      }

      const config = vscode.workspace.getConfiguration('codeProvenance');
      if (!config.get('bobApiEnabled')) {
        vscode.window.showWarningMessage('Bob API integration is disabled. Enable it in settings.');
        return;
      }

      vscode.window.showInformationMessage('Fetching Bob inference history...');
      
      try {
        // Fetch recent inferences (last 100)
        const inferences = await bobApiClient.getRecentInferences(100);

        if (inferences.length === 0) {
          vscode.window.showInformationMessage('No recent Bob inferences found');
          return;
        }

        vscode.window.showInformationMessage(
          `Found ${inferences.length} Bob inferences. Processing...`
        );

        // TODO: Link inferences to code changes and store in provenance
        // For now, just show the count
        vscode.window.showInformationMessage(
          `✅ Fetched ${inferences.length} Bob inferences successfully`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to fetch Bob history: ${message}`);
      }
    }
  );

  // Remove duplicates command
  const removeDuplicatesCommand = vscode.commands.registerCommand(
    'codeProvenance.removeDuplicates',
    () => {
      if (!store) {
        vscode.window.showErrorMessage('Provenance store not initialized');
        return;
      }

      const duplicatesRemoved = store.removeDuplicates();

      if (duplicatesRemoved > 0) {
        vscode.window.showInformationMessage(
          `✅ Removed ${duplicatesRemoved} duplicate record(s) from audit trail`
        );
        // Refresh the audit panel if it's open
        AuditPanel.createOrShow(context.extensionUri, store);
      } else {
        vscode.window.showInformationMessage('No duplicate records found');
      }
    }
  );

  // Extract provenance from current file
  const extractProvenanceCommand = vscode.commands.registerCommand(
    'codeProvenance.extractProvenance',
    () => {
      if (!gitStore) {
        vscode.window.showErrorMessage('Git attributes store not initialized');
        return;
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      const filePath = vscode.workspace.asRelativePath(editor.document.uri);
      const provenanceList = gitStore.extractProvenance(filePath);

      if (provenanceList.length === 0) {
        vscode.window.showInformationMessage(`No embedded provenance found in ${filePath}`);
        return;
      }

      // Show summary
      const summary = provenanceList.map(p =>
        `Line ${p.line}: ${p.model.name} (${p.compliance.risk_level} risk)`
      ).join('\n');

      vscode.window.showInformationMessage(
        `Found ${provenanceList.length} provenance entries in ${filePath}:\n${summary}`
      );
    }
  );

  // Regenerate .gitattributes file
  const regenerateGitattributesCommand = vscode.commands.registerCommand(
    'codeProvenance.regenerateGitattributes',
    () => {
      if (!gitStore) {
        vscode.window.showErrorMessage('Git attributes store not initialized');
        return;
      }

      try {
        // Force recreation by deleting and reinitializing
        const gitattributesPath = gitStore.getGitattributesPath();
        if (fs.existsSync(gitattributesPath)) {
          fs.unlinkSync(gitattributesPath);
        }

        // Create new store instance to regenerate file
        gitStore = new GitAttributesStore(workspaceRoot);
        vscode.window.showInformationMessage(
          `✅ Regenerated .gitattributes at ${gitStore.getGitattributesPath()}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to regenerate .gitattributes: ${message}`);
      }
    }
  );

  context.subscriptions.push(
    showAuditCommand,
    showStatusCommand,
    queryProvenanceCommand,
    validateCommand,
    exportAuditCommand,
    testBobApiCommand,
    fetchBobHistoryCommand,
    removeDuplicatesCommand,
    extractProvenanceCommand,
    regenerateGitattributesCommand
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
  gitStore = null;
  bobApiClient = null;
}

// Made with Bob
