import { z } from 'zod';
import { FieldValues, Path, Resolver, UseFormSetError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LIMITS, rupeesToPaise } from '@brightloop/shared';
import { ApiError } from '../api/client';

/** Rupee text input → integer paise, validated like the backend. */
export const rupees = (label: string, { allowZero = true, max = LIMITS.MAX_PRICE_PAISE } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => rupeesToPaise(value) !== null, `${label}: enter an amount like 1499 or 1499.50`)
    .transform((value) => rupeesToPaise(value)!)
    .refine((paise) => allowZero || paise > 0, `${label} must be more than ₹0`)
    .refine((paise) => paise <= max, `${label} is above the maximum`);

/** Percent text input ("18" or "12.5") → integer basis points. */
export const percent = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), `${label}: enter a number like 18 or 12.5`)
    .transform((value) => Math.round(Number(value) * 100))
    .refine((bps) => bps <= LIMITS.MAX_RATE_BPS, `${label} cannot exceed 100%`);

export const intField = (label: string, min = 1, max: number = LIMITS.MAX_QUANTITY) =>
  z.coerce.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} is too large`);

/** Copy backend field errors (from the shared error envelope) onto the form. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  if (!(error instanceof ApiError) || Object.keys(error.fields).length === 0) return false;
  for (const [field, message] of Object.entries(error.fields)) setError(field as Path<T>, { type: 'server', message });
  return true;
}

/**
 * zodResolver typed for schemas whose parsed output differs from the form input
 * (e.g. rupee strings that become integer paise). At runtime it is plain zodResolver,
 * which hands the parsed (transformed) values to handleSubmit.
 */
export function typedResolver<S extends z.ZodTypeAny>(schema: S): Resolver<z.input<S>, unknown, z.output<S>> {
  return zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>;
}
