export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AppError";
    this.code = options.code || "app_error";
    this.stage = options.stage || null;
    this.details = options.details || null;
    this.source = options.source || null;
  }
}

export function serializeError(error, fallbackStage = null) {
  if (!error) {
    return {
      message: "Something went wrong.",
      code: "unknown_error",
      stage: fallbackStage,
      details: null,
      source: null,
    };
  }

  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      stage: error.stage || fallbackStage,
      details: error.details || null,
      source: error.source || null,
    };
  }

  return {
    message: error.message || "Something went wrong.",
    code: error.code || "unknown_error",
    stage: error.stage || fallbackStage,
    details: error.details || null,
    source: error.source || null,
  };
}
