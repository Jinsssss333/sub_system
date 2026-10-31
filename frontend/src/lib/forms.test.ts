import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { applyServerErrors, intField, percent, rupees } from './forms';
import { ApiError, buildQuery, parseError } from '../api/client';
import { bpsToPercent, compactINR, methodLabel, paiseToRupeeInput } from './format';

describe('rupees field', () => {
  const field = rupees('Price', { allowZero: false });
  it('turns rupee text into integer paise', () => {
    expect(field.parse('1499')).toBe(149_900);
    expect(field.parse(' 1499.5 ')).toBe(149_950);
  });
  it('rejects empty, malformed, zero and over-precise input', () => {
    expect(field.safeParse('').success).toBe(false);
    expect(field.safeParse('abc').success).toBe(false);
    expect(field.safeParse('0').success).toBe(false);
    expect(field.safeParse('1.999').success).toBe(false);
  });
  it('rejects amounts above the documented maximum', () => {
    expect(field.safeParse('999999999999').success).toBe(false);
  });
});

describe('percent and integer fields', () => {
  it('maps percent text to basis points', () => {
    expect(percent('Rate').parse('18')).toBe(1800);
    expect(percent('Rate').parse('12.5')).toBe(1250);
    expect(percent('Rate').safeParse('100.01').success).toBe(false);
  });
  it('coerces whole quantities within bounds', () => {
    expect(intField('Qty').parse('3')).toBe(3);
    expect(intField('Qty').safeParse('0').success).toBe(false);
    expect(intField('Qty').safeParse('1.5').success).toBe(false);
  });
});

describe('API client helpers', () => {
  it('drops empty query values', () => {
    expect(buildQuery({ page: 2, q: '', status: undefined, x: null, paused: false })).toBe('?page=2&paused=false');
    expect(buildQuery({})).toBe('');
  });
  it('unwraps the shared error envelope', async () => {
    const res = new Response(JSON.stringify({ error: { code: 'VALIDATION', message: 'Invalid input', fields: { amount: 'Too high' } } }), { status: 400 });
    const err = await parseError(res);
    expect(err).toBeInstanceOf(ApiError);
    expect([err.status, err.code, err.message, err.fields.amount]).toEqual([400, 'VALIDATION', 'Invalid input', 'Too high']);
  });
  it('gives a friendly message when the body is not JSON', async () => {
    const err = await parseError(new Response('oops', { status: 502 }));
    expect(err.message).toMatch(/server had a problem/);
  });
  it('copies server field errors onto a form', () => {
    const set: Array<[string, string]> = [];
    const applied = applyServerErrors<{ amount: string }>(new ApiError(400, 'VALIDATION', 'x', { amount: 'Too high' }), (name, e) => set.push([name, e.message ?? '']));
    expect(applied).toBe(true);
    expect(set).toEqual([['amount', 'Too high']]);
    expect(applyServerErrors(new Error('plain'), () => {})).toBe(false);
  });
});

describe('display formatting', () => {
  it('formats compact Indian amounts and labels', () => {
    expect(compactINR(1_85_00_000_00)).toBe('₹1.85 Cr');
    expect(compactINR(96_40_000_00)).toBe('₹96.4 L');
    expect(compactINR(12_500_00)).toBe('₹12.5K');
    expect(paiseToRupeeInput(149_950)).toBe('1499.50');
    expect(bpsToPercent(1250)).toBe('12.5%');
    expect(methodLabel('BANK_TRANSFER')).toBe('Bank transfer');
    expect(methodLabel('UPI')).toBe('UPI');
  });
  it('keeps z available for schema composition', () => {
    expect(z.object({ price: rupees('Price') }).parse({ price: '10' })).toEqual({ price: 1000 });
  });
});
