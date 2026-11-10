export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  unauthorized: (message = 'Требуется вход в штаб') => new ApiError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Недостаточно прав') => new ApiError(403, 'FORBIDDEN', message),
  notFound: (message = 'Не найдено') => new ApiError(404, 'NOT_FOUND', message),
  badRequest: (message = 'Некорректный запрос', details?: unknown) =>
    new ApiError(400, 'BAD_REQUEST', message, details),
  conflict: (message = 'Конфликт данных') => new ApiError(409, 'CONFLICT', message),
};
