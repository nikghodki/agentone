import { describe, it, expect } from "vitest";
import { signRequestV4 } from "../../src/main/aws-sigv4";

describe("AWS SigV4 Signing", () => {
  // AWS SigV4 canonical example (get-vanilla family) — deterministic with fixed date + test creds.
  it("produces the AWS-documented Authorization header for the canonical example", () => {
    const headers = signRequestV4({
      method: "GET", host: "example.amazonaws.com", path: "/", region: "us-east-1", service: "service",
      headers: { host: "example.amazonaws.com", "x-amz-date": "20150830T123600Z" }, body: "",
      accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      now: new Date(Date.UTC(2015, 7, 30, 12, 36, 0)),
    });
    // The exact expected Authorization string from the AWS SigV4 test-suite for this input.
    expect(headers["Authorization"]).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
      "SignedHeaders=host;x-amz-date, " +
      "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
    );
  });
});
