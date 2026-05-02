import * as vscode from 'vscode';
import * as https from 'https';

export interface BobInference {
  id: string;
  timestamp: string;
  prompt: string;
  response: string;
  model: {
    name: string;
    version: string;
    provider: string;
  };
  metadata?: {
    temperature?: number;
    max_tokens?: number;
    confidence?: number;
  };
  context?: {
    file_path?: string;
    line_range?: [number, number];
  };
}

export interface BobApiConfig {
  apiKey: string;
  teamId?: string;
  baseUrl: string;
  enabled: boolean;
}

export class BobApiClient {
  private config: BobApiConfig;
  private outputChannel: vscode.OutputChannel;

  constructor(config: BobApiConfig) {
    this.config = config;
    this.outputChannel = vscode.window.createOutputChannel('Bob API Client');
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.config.enabled) {
        return { success: false, message: 'Bob API integration is disabled. Enable it in settings.' };
      }

      if (!this.config.apiKey) {
        return { success: false, message: 'Bob API key is not configured. Add it in settings.' };
      }

      this.outputChannel.appendLine(`🔍 Testing connection to: ${this.config.baseUrl}`);
      this.outputChannel.appendLine(`🔑 API Key: ${this.config.apiKey.substring(0, 10)}...`);
      
      // Test with a simple chat completion request
      const testPayload = {
        model: 'bob-code-gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      };
      
      const response = await this.makeRequest('/v1/chat/completions', 'POST', testPayload);
      
      if (response.ok) {
        this.outputChannel.appendLine('✅ Bob API connection successful');
        return { success: true, message: 'Connected to Bob API successfully' };
      } else {
        const error = await response.text();
        this.outputChannel.appendLine(`❌ Bob API connection failed (${response.status}): ${error}`);
        return { success: false, message: `Connection failed: ${response.status} - ${error}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.outputChannel.appendLine(`❌ Bob API error: ${message}`);
      return { success: false, message: `Error: ${message}` };
    }
  }

  /**
   * Get inference history since a specific timestamp
   */
  async getInferenceHistory(since?: Date): Promise<BobInference[]> {
    try {
      if (!this.config.enabled || !this.config.apiKey) {
        return [];
      }

      const sinceParam = since ? `?since=${since.toISOString()}` : '';
      const response = await this.makeRequest(`/v1/inferences${sinceParam}`, 'GET');

      if (!response.ok) {
        throw new Error(`Failed to fetch inference history: ${response.status}`);
      }

      const data = await response.json() as any;
      this.outputChannel.appendLine(`📥 Fetched ${data.inferences?.length || 0} inferences from Bob API`);
      
      return this.parseInferences(data.inferences || []);
    } catch (error) {
      this.outputChannel.appendLine(`❌ Error fetching inference history: ${error}`);
      return [];
    }
  }

  /**
   * Get a specific inference by ID
   */
  async getInference(id: string): Promise<BobInference | null> {
    try {
      if (!this.config.enabled || !this.config.apiKey) {
        return null;
      }

      const response = await this.makeRequest(`/v1/inferences/${id}`, 'GET');

      if (!response.ok) {
        throw new Error(`Failed to fetch inference: ${response.status}`);
      }

      const data = await response.json() as any;
      return this.parseInference(data);
    } catch (error) {
      this.outputChannel.appendLine(`❌ Error fetching inference ${id}: ${error}`);
      return null;
    }
  }

  /**
   * Get recent inferences (last N)
   */
  async getRecentInferences(limit: number = 50): Promise<BobInference[]> {
    try {
      if (!this.config.enabled || !this.config.apiKey) {
        return [];
      }

      const response = await this.makeRequest(`/v1/inferences?limit=${limit}`, 'GET');

      if (!response.ok) {
        throw new Error(`Failed to fetch recent inferences: ${response.status}`);
      }

      const data = await response.json() as any;
      return this.parseInferences(data.inferences || []);
    } catch (error) {
      this.outputChannel.appendLine(`❌ Error fetching recent inferences: ${error}`);
      return [];
    }
  }

  /**
   * Search inferences by prompt or response content
   */
  async searchInferences(query: string): Promise<BobInference[]> {
    try {
      if (!this.config.enabled || !this.config.apiKey) {
        return [];
      }

      const response = await this.makeRequest(
        `/v1/inferences/search?q=${encodeURIComponent(query)}`,
        'GET'
      );

      if (!response.ok) {
        throw new Error(`Failed to search inferences: ${response.status}`);
      }

      const data = await response.json() as any;
      return this.parseInferences(data.inferences || []);
    } catch (error) {
      this.outputChannel.appendLine(`❌ Error searching inferences: ${error}`);
      return [];
    }
  }

  /**
   * Make an authenticated request to Bob API
   */
  private async makeRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add team ID header if using General API key
    if (this.config.teamId) {
      headers['X-Bob-Team-Id'] = this.config.teamId;
    }

    const bodyString = body ? JSON.stringify(body) : undefined;

    this.outputChannel.appendLine(`🔄 ${method} ${url.toString()}`);
    if (bodyString) {
      this.outputChannel.appendLine(`📤 Request body: ${bodyString.substring(0, 200)}...`);
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
          ...headers,
          ...(bodyString ? { 'Content-Length': Buffer.byteLength(bodyString) } : {})
        }
      };

      this.outputChannel.appendLine(`📡 Connecting to: ${options.hostname}:${options.port}`);

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          this.outputChannel.appendLine(`📥 Response: ${res.statusCode} ${res.statusMessage}`);
          this.outputChannel.appendLine(`📄 Response body: ${data.substring(0, 500)}...`);
          
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            text: async () => data,
            json: async () => JSON.parse(data)
          });
        });
      });

      req.on('error', (error) => {
        this.outputChannel.appendLine(`❌ Request error: ${error.message}`);
        this.outputChannel.appendLine(`Stack: ${error.stack}`);
        reject(error);
      });

      if (bodyString) {
        req.write(bodyString);
      }

      req.end();
    });
  }

  /**
   * Parse raw inference data from Bob API
   */
  private parseInferences(rawInferences: any[]): BobInference[] {
    return rawInferences.map(raw => this.parseInference(raw)).filter(Boolean) as BobInference[];
  }

  /**
   * Parse a single inference from Bob API response
   */
  private parseInference(raw: any): BobInference | null {
    try {
      return {
        id: raw.id || raw.inference_id,
        timestamp: raw.timestamp || raw.created_at,
        prompt: raw.prompt || raw.input,
        response: raw.response || raw.output || raw.completion,
        model: {
          name: raw.model?.name || raw.model_name || 'unknown',
          version: raw.model?.version || raw.model_version || '1.0',
          provider: raw.model?.provider || 'ibm',
        },
        metadata: {
          temperature: raw.temperature || raw.metadata?.temperature,
          max_tokens: raw.max_tokens || raw.metadata?.max_tokens,
          confidence: raw.confidence || raw.metadata?.confidence,
        },
        context: {
          file_path: raw.context?.file_path || raw.file_path,
          line_range: raw.context?.line_range || raw.line_range,
        },
      };
    } catch (error) {
      this.outputChannel.appendLine(`⚠️ Failed to parse inference: ${error}`);
      return null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BobApiConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration (without exposing API key)
   */
  getConfig(): Omit<BobApiConfig, 'apiKey'> {
    return {
      teamId: this.config.teamId,
      baseUrl: this.config.baseUrl,
      enabled: this.config.enabled,
    };
  }
}

// Made with Bob