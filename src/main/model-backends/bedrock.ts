import type { ChatMessage, ModelBackend, ModelBackendConfig } from "../../shared/v2-types";
import { signRequestV4 } from "../aws-sigv4";

/**
 * AWS Bedrock credentials (stored as JSON in the secret).
 */
interface BedrockCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/**
 * ModelBackend implementation for Amazon Bedrock (Anthropic Claude models).
 * Uses AWS Signature Version 4 signing for authentication.
 * Non-streaming (single onToken call with full response).
 *
 * NEVER logs credentials (accessKeyId, secretAccessKey, sessionToken).
 */
export class BedrockBackend implements ModelBackend {
  constructor(
    private cfg: ModelBackendConfig,
    private apiKey: string | null,
    private fetchFn: typeof fetch = fetch
  ) {}

  async chat(messages: ChatMessage[], onToken: (token: string) => void): Promise<string> {
    // Parse credentials from apiKey (stored as JSON)
    if (!this.apiKey) {
      throw new Error("Bedrock backend requires credentials (apiKey must be a JSON string with accessKeyId and secretAccessKey)");
    }

    let creds: BedrockCredentials;
    try {
      creds = JSON.parse(this.apiKey);
    } catch (e) {
      throw new Error("Bedrock backend: failed to parse credentials JSON from apiKey");
    }

    if (!creds.accessKeyId || !creds.secretAccessKey) {
      throw new Error("Bedrock backend: credentials must include accessKeyId and secretAccessKey");
    }

    // Get region from extra config
    if (!this.cfg.extra?.region) {
      throw new Error("Bedrock backend requires extra.region to be specified");
    }

    const region = this.cfg.extra.region as string;

    // Build request
    const host = `bedrock-runtime.${region}.amazonaws.com`;
    const encodedModel = encodeURIComponent(this.cfg.model);
    const path = `/model/${encodedModel}/invoke`;
    const url = `https://${host}${path}`;

    // Build Anthropic-on-Bedrock request body
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Create headers to sign
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");

    const headersToSign: Record<string, string> = {
      host,
      "x-amz-date": amzDate,
      "content-type": "application/json",
    };

    // Sign the request using SigV4
    const signedHeaders = signRequestV4({
      method: "POST",
      host,
      path,
      region,
      service: "bedrock",
      headers: headersToSign,
      body,
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
      now,
    });

    // Merge signed headers with content-type
    const requestHeaders: Record<string, string> = {
      "content-type": "application/json",
      ...signedHeaders,
    };

    // Make the request
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: requestHeaders,
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Bedrock request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`);
    }

    // Parse response
    const data = await response.json();

    // Extract text from Bedrock Anthropic response format
    // Response shape: { content: [{ type: "text", text: "..." }] }
    if (!data.content || !Array.isArray(data.content)) {
      throw new Error("Bedrock response missing content array");
    }

    const textBlocks = data.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text || "");

    const fullText = textBlocks.join("");

    // Non-streaming: call onToken once with full text
    onToken(fullText);

    return fullText;
  }
}
