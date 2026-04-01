'use strict';

// US-043 — Date utility tests

const { FormatDate, IsValidDate, IsAfterDate, IsBeforeDate, NowUTC, SerializeDates } = require('../date.util');

describe('FormatDate (US-043)', () => {
  it('formats a Date object using default format', () => {
    const date = new Date('2025-06-15T10:30:00.000Z');
    const result = FormatDate(date);
    expect(result).toMatch(/^2025-06-15/);
  });

  it('formats an ISO string using default format', () => {
    const result = FormatDate('2025-01-01T00:00:00.000Z');
    expect(result).toMatch(/^2025-01-01/);
  });

  it('accepts a custom format string', () => {
    const date = new Date('2025-12-25T00:00:00.000Z');
    const result = FormatDate(date, 'dd/MM/yyyy');
    expect(result).toMatch(/25\/12\/2025/);
  });
});

describe('IsValidDate (US-043)', () => {
  it('returns true for a valid Date object', () => {
    expect(IsValidDate(new Date())).toBe(true);
  });

  it('returns true for a valid ISO string', () => {
    expect(IsValidDate('2025-06-15')).toBe(true);
  });

  it('returns false for an invalid date string', () => {
    expect(IsValidDate('not-a-date')).toBe(false);
  });

  it('returns false for Invalid Date object', () => {
    expect(IsValidDate(new Date('invalid'))).toBe(false);
  });
});

describe('IsAfterDate / IsBeforeDate (US-043)', () => {
  const earlier = '2025-01-01';
  const later = '2025-12-31';

  it('IsAfterDate returns true when date is after reference', () => {
    expect(IsAfterDate(later, earlier)).toBe(true);
  });

  it('IsAfterDate returns false when date is before reference', () => {
    expect(IsAfterDate(earlier, later)).toBe(false);
  });

  it('IsBeforeDate returns true when date is before reference', () => {
    expect(IsBeforeDate(earlier, later)).toBe(true);
  });

  it('IsBeforeDate returns false when date is after reference', () => {
    expect(IsBeforeDate(later, earlier)).toBe(false);
  });
});

describe('NowUTC', () => {
  it('returns a Date object', () => {
    expect(NowUTC()).toBeInstanceOf(Date);
  });

  it('returns a date close to current time', () => {
    const before = Date.now();
    const now = NowUTC().getTime();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe('SerializeDates', () => {
  it('converts Date instances to ISO strings', () => {
    const date = new Date('2025-06-15T12:00:00.000Z');
    expect(SerializeDates(date)).toBe('2025-06-15T12:00:00.000Z');
  });

  it('recurses into plain objects', () => {
    const obj = { name: 'test', created_at: new Date('2025-01-01T00:00:00.000Z') };
    const result = SerializeDates(obj);
    expect(result.created_at).toBe('2025-01-01T00:00:00.000Z');
    expect(result.name).toBe('test');
  });

  it('recurses into arrays', () => {
    const arr = [new Date('2025-01-01T00:00:00.000Z'), 'string', 42];
    const result = SerializeDates(arr);
    expect(result[0]).toBe('2025-01-01T00:00:00.000Z');
    expect(result[1]).toBe('string');
    expect(result[2]).toBe(42);
  });

  it('passes through null and undefined', () => {
    expect(SerializeDates(null)).toBeNull();
    expect(SerializeDates(undefined)).toBeUndefined();
  });

  it('passes through non-date primitives', () => {
    expect(SerializeDates('hello')).toBe('hello');
    expect(SerializeDates(42)).toBe(42);
  });
});
