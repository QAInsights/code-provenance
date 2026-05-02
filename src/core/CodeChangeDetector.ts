import * as vscode from 'vscode';
import * as crypto from 'crypto';

export class CodeChangeDetector {
  private lastChangeTime = new Map<string, number>();
  private changeBuffer = new Map<string, vscode.TextDocumentChangeEvent>();
  private readonly DEBOUNCE_MS = 1000;
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Code Provenance');
  }

  start(): vscode.Disposable {
    return vscode.workspace.onDidChangeTextDocument((event) => {
      this.handleTextChange(event);
    });
  }

  private handleTextChange(event: vscode.TextDocumentChangeEvent): void {
    if (event.contentChanges.length === 0) {
      return;
    }

    const uri = event.document.uri.toString();
    const now = Date.now();
    
    this.changeBuffer.set(uri, event);
    this.lastChangeTime.set(uri, now);

    setTimeout(() => {
      this.processBufferedChange(uri, now);
    }, this.DEBOUNCE_MS);
  }

  private processBufferedChange(uri: string, timestamp: number): void {
    const lastTime = this.lastChangeTime.get(uri);
    
    if (!lastTime || lastTime !== timestamp) {
      return;
    }

    const event = this.changeBuffer.get(uri);
    if (!event) {
      return;
    }

    this.analyzeChange(event);
    this.changeBuffer.delete(uri);
  }

  private analyzeChange(event: vscode.TextDocumentChangeEvent): void {
    for (const change of event.contentChanges) {
      if (this.looksLikeAIGenerated(change.text)) {
        this.captureProvenance(event, change);
      }
    }
  }

  private looksLikeAIGenerated(text: string): boolean {
    if (text.length < 50) {
      return false;
    }

    const indicators = [
      /function\s+\w+\s*\([^)]*\)/,
      /export\s+(async\s+)?function/,
      /interface\s+\w+\s*{/,
      /class\s+\w+\s*{/,
      /const\s+\w+\s*=\s*async/,
      /const\s+\w+\s*=\s*\([^)]*\)\s*=>/,
      /\/\/.*Made with Bob/i
    ];

    return indicators.some(pattern => pattern.test(text));
  }

  private captureProvenance(
    event: vscode.TextDocumentChangeEvent,
    change: vscode.TextDocumentContentChangeEvent
  ): void {
    const filePath = vscode.workspace.asRelativePath(event.document.uri);
    const startLine = change.range.start.line + 1;
    const endLine = change.range.end.line + 1;
    
    const provenance = {
      file: filePath,
      lines: `${startLine}-${endLine}`,
      size: change.text.length,
      hash: this.hashCode(change.text),
      timestamp: new Date().toISOString()
    };

    this.outputChannel.appendLine('='.repeat(60));
    this.outputChannel.appendLine('AI CODE DETECTED');
    this.outputChannel.appendLine('='.repeat(60));
    this.outputChannel.appendLine(`File: ${provenance.file}`);
    this.outputChannel.appendLine(`Lines: ${provenance.lines}`);
    this.outputChannel.appendLine(`Size: ${provenance.size} characters`);
    this.outputChannel.appendLine(`Hash: ${provenance.hash}`);
    this.outputChannel.appendLine(`Timestamp: ${provenance.timestamp}`);
    this.outputChannel.appendLine('');
    this.outputChannel.show(true);

    vscode.window.showInformationMessage(
      `AI code detected: ${filePath} (${provenance.lines}) - Check Output panel`
    );
  }

  private hashCode(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
  }
}

// Made with Bob
