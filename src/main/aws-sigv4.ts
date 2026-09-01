import { createHash, createHmac } from "crypto";

/**
 * AWS Signature Version 4 signing parameters.
 */
export interface SignRequestV4Params {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  headers: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  now?: Date;
}

/**
 * Signs an AWS API request using Signature Version 4.
 * Returns headers to send including Authorization, x-amz-date, and x-amz-security-token (if sessionToken present).
 *
 * NEVER logs secrets (accessKeyId, secretAccessKey, sessionToken, Authorization).
 *
 * @param params - Signing parameters
 * @returns Headers to send with the request
 */
export function signRequestV4(params: SignRequestV4Params): Record<string, string> {
  const {
    method,
    host,
    path,
    region,
    service,
    headers,
    body,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    now = new Date(),
  } = params;

  // Step 1: Create canonical request
  const amzDate = headers["x-amz-date"] || toAmzDate(now);
  const date = amzDate.substring(0, 8); // YYYYMMDD

  // Build case-insensitive lookup map
  const headerLookup = new Map<string, string>();
  for (const [key, value] of Object.entries(headers)) {
    headerLookup.set(key.toLowerCase(), value);
  }

  // Prepare headers for signing (lowercase keys, sorted)
  const signedHeadersList = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();

  // Add session token to signed headers if present
  if (sessionToken) {
    if (!signedHeadersList.includes("x-amz-security-token")) {
      signedHeadersList.push("x-amz-security-token");
      signedHeadersList.sort();
    }
  }

  const signedHeaders = signedHeadersList.join(";");

  // Build canonical headers string
  const canonicalHeaders = signedHeadersList
    .map((key) => {
      const value = key === "x-amz-security-token" && sessionToken
        ? sessionToken
        : headerLookup.get(key) || "";
      // Trim and collapse internal whitespace per SigV4 spec
      const normalizedValue = value.trim().replace(/ +/g, " ");
      return `${key}:${normalizedValue}`;
    })
    .join("\n") + "\n";

  // Hash the body
  const bodyHash = createHash("sha256").update(body).digest("hex");

  // Build canonical request
  const canonicalRequest = [
    method,
    path,
    "", // query string (empty for this implementation)
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  // Step 2: Create string to sign
  const canonicalRequestHash = createHash("sha256").update(canonicalRequest).digest("hex");
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // Step 3: Calculate signing key
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");

  // Step 4: Calculate signature
  const signature = hmac(kSigning, stringToSign, "hex");

  // Step 5: Build Authorization header
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  // Return headers
  const result: Record<string, string> = {
    Authorization: authorization,
    "x-amz-date": amzDate,
  };

  if (sessionToken) {
    result["x-amz-security-token"] = sessionToken;
  }

  return result;
}

/**
 * Creates an HMAC digest.
 */
function hmac(key: string | Buffer, data: string, encoding: "hex" | undefined = undefined): any {
  const hmacInstance = createHmac("sha256", key);
  hmacInstance.update(data);
  return encoding ? hmacInstance.digest(encoding) : hmacInstance.digest();
}

/**
 * Formats a Date as ISO8601 compact format (YYYYMMDDTHHMMSSZ).
 */
function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
