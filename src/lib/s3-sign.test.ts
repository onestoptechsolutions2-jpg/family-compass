import { describe, expect, it } from "vitest";

import { signS3 } from "./s3-sign";

// The worked example in AWS's S3 SigV4 documentation ("GET Object"), with its published signature.
describe("signing an S3 request", () => {
  it("matches AWS's own example", () => {
    const h = signS3({
      method: "GET",
      url: "https://examplebucket.s3.amazonaws.com/test.txt",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      headers: { Range: "bytes=0-9" },
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(h.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(h["x-amz-date"]).toBe("20130524T000000Z");
  });
});
