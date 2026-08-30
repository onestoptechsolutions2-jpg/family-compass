import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "rate_limited"
  | "method_not_allowed"
  | "server_error";

export function apiOk<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(
    { data },
    { status: init?.status ?? 200, headers: { ...CORS, ...(init?.headers ?? {}) } },
  );
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...CORS, ...(headers ?? {}) } },
  );
}

export function apiPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Marker type: helpers return either a Response (stop) or a value (continue). */
export function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}
