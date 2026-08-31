export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'بيانات الدخول غير صحيحة',
  'Email not confirmed': 'يرجى تأكيد البريد الإلكتروني أولاً',
  'User already registered': 'البريد الإلكتروني مسجل من قبل',
  'Password should be at least 6 characters': 'كلمة السر يجب أن تكون 6 أحرف على الأقل',
  'JWT expired': 'انتهت جلستك، يرجى تسجيل الدخول مجدداً',
  'Network request failed': 'تعذّر الاتصال بالإنترنت',
  'new row violates row-level security policy': 'ليس لديك صلاحية لتنفيذ هذه العملية',
  'permission denied': 'ليس لديك صلاحية لتنفيذ هذه العملية',
};

interface SupabaseErrorLike {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

function hasArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

export function mapError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) {
    return ERROR_MAP[error.message] ?? 'حدث خطأ، يرجى المحاولة مجدداً';
  }
  return 'حدث خطأ غير متوقع';
}

export function handleSupabaseError(error: SupabaseErrorLike | null): void {
  if (!error) return;
  console.error('[Supabase]', JSON.stringify({
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  }));

  const mapped = ERROR_MAP[error.message];
  const message = mapped ?? (hasArabicText(error.message) ? error.message : mapError(error));
  throw new AppError(message, error.code);
}
