import i18next from "i18next";

type ErrorLike = {
  message?: unknown;
  data?: {
    code?: unknown;
    zodError?: unknown;
  };
  shape?: {
    message?: unknown;
    data?: {
      code?: unknown;
    };
  };
};

const codeToTranslationKey: Record<string, string> = {
  UNAUTHORIZED: "errors.api.unauthorized",
  FORBIDDEN: "errors.api.forbidden",
  NOT_FOUND: "errors.api.notFound",
  BAD_REQUEST: "errors.api.badRequest",
  TIMEOUT: "errors.api.timeout",
  TOO_MANY_REQUESTS: "errors.api.tooManyRequests",
  INTERNAL_SERVER_ERROR: "errors.api.internal",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asErrorLike(value: unknown): ErrorLike | null {
  if (!isObject(value)) {
    return null;
  }
  return value as ErrorLike;
}

function getCode(value: unknown): string | null {
  const error = asErrorLike(value);
  if (!error) {
    return null;
  }

  const directCode = error.data?.code;
  if (typeof directCode === "string" && directCode.length > 0) {
    return directCode;
  }

  const shapeCode = error.shape?.data?.code;
  if (typeof shapeCode === "string" && shapeCode.length > 0) {
    return shapeCode;
  }

  return null;
}

function getText(value: unknown): string | null {
  const error = asErrorLike(value);
  if (!error) {
    return null;
  }

  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (
    typeof error.shape?.message === "string" &&
    error.shape.message.trim().length > 0
  ) {
    return error.shape.message.trim();
  }

  return null;
}

function isNetworkError(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed")
  );
}

export function getErrorMessage(
  error: unknown,
  fallbackKey = "errors.api.generic",
): string {
  const code = getCode(error);
  const text = getText(error);
  if (code === "BAD_REQUEST" && text && !asErrorLike(error)?.data?.zodError) {
    return text;
  }
  if (code) {
    const key = codeToTranslationKey[code];
    if (key) {
      return i18next.t(key);
    }
  }

  if (text) {
    if (isNetworkError(text)) {
      return i18next.t("errors.api.network");
    }
    return text;
  }

  return i18next.t(fallbackKey);
}
