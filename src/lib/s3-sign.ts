import { createHash, createHmac } from "node:crypto";

// AWS Signature Version 4 for one S3 request: the part every S3-compatible store (Cloudflare R2,
// Backblaze B2, Wasabi, MinIO, AWS) checks. Pure, so it is tested against AWS's own example.

const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();
const sha256 = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");
/** Each path segment encoded as S3 expects (slashes kept). */
const encodePath = (p: string) => p.split("/").map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");

export type S3Request = {
  method: "PUT" | "GET" | "DELETE" | "HEAD";
  url: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** the body's SHA-256 in hex, or "UNSIGNED-PAYLOAD" for a streamed upload */
  payloadHash: string;
  headers?: Record<string, string>;
  now?: Date;
};

/** The headers to send with the request, Authorization included. */
export function signS3(r: S3Request): Record<string, string> {
  const url = new URL(r.url);
  const amzDate = (r.now ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()])),
    host: url.host,
    "x-amz-content-sha256": r.payloadHash,
    "x-amz-date": amzDate,
  };
  const names = Object.keys(headers).sort();
  const query = [...url.searchParams.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a], [b]) => (a! < b! ? -1 : a! > b! ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonical = [
    r.method,
    encodePath(decodeURIComponent(url.pathname)),
    query,
    names.map((n) => `${n}:${headers[n]}\n`).join(""),
    names.join(";"),
    r.payloadHash,
  ].join("\n");
  const scope = `${day}/${r.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${r.secretAccessKey}`, day), r.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign, "utf8").digest("hex");
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${r.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
  delete headers.host;
  return headers;
}
