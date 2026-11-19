import { isJwtExpired } from "@/lib/authToken";
import { getStoredAccessToken } from "@/lib/authSession";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "";
export const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";

const getAccessToken = () => getStoredAccessToken();

const notifySessionExpired = () => {
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
};

const parseResponseBody = (responseText: string) => {
  if (!responseText) return null;
  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
};

const logApiResponse = (method: string, path: string, response: Response, responseText: string) => {
  console.log("[apiFetch]", {
    method,
    path,
    status: response.status,
    ok: response.ok,
    data: parseResponseBody(responseText),
  });
};

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  json?: boolean;
  rawResponse?: boolean;
}

type ApiError = Error & { statusCode?: unknown };

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    method = "GET",
    headers,
    body,
    auth = true,
    json = true,
    rawResponse = false,
    ...rest
  } = options;

  const token = auth ? getAccessToken() : null;
  const resolvedHeaders = new Headers(headers);
  const isFormData = body instanceof FormData || body instanceof URLSearchParams;

  if (token && isJwtExpired(token)) {
    notifySessionExpired();
    const error: ApiError = new Error("Authentication session expired");
    error.statusCode = 401;
    throw error;
  }

  if (json && !resolvedHeaders.has("Content-Type") && !isFormData) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: resolvedHeaders,
    body:
      body === undefined || body === null
        ? undefined
        : json && !isFormData && typeof body !== "string"
        ? JSON.stringify(body)
        : body,
    ...rest,
  });

  if (auth && response.status === 401) {
    notifySessionExpired();
  }

  if (options.rawResponse) {
    const responseText = await response.clone().text();
    logApiResponse(method, path, response, responseText);
    return response as unknown as T;
  }

  const responseText = await response.text();
  logApiResponse(method, path, response, responseText);

  if (!response.ok) {
    let errorMessage = responseText || response.statusText || "Request failed";
    try {
      const parsed = parseResponseBody(responseText);
      if (parsed && typeof parsed === "object") {
        if (parsed.message) errorMessage = parsed.message;
        else if (parsed.error) errorMessage = parsed.error;
      }
    } catch {
      // ignore invalid JSON error body
    }

    const error: ApiError = new Error(errorMessage);
    try {
      const parsed = parseResponseBody(responseText);
      if (parsed && typeof parsed === "object" && parsed.statusCode != null) {
        error.statusCode = parsed.statusCode;
      }
    } catch {
      // ignore
    }
    throw error;
  }

  if (!responseText) {
    return undefined as unknown as T;
  }

  return parseResponseBody(responseText) as T;
}

export const getAuthHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
