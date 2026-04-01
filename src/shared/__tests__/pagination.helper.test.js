'use strict';

// Paginated queries — all domains
// Pure tests: no mocks needed.

const { NormalizePagination, BuildPaginatedResponse } = require('../pagination.helper');

describe('NormalizePagination', () => {
  it('returns defaults when no input provided', () => {
    const result = NormalizePagination();
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.skip).toBe(0);
  });

  it('uses provided page and limit', () => {
    const result = NormalizePagination({ page: 3, limit: 10 });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.skip).toBe(20);
  });

  it('clamps page to minimum 1', () => {
    expect(NormalizePagination({ page: 0 }).page).toBe(1);
    expect(NormalizePagination({ page: -5 }).page).toBe(1);
  });

  it('clamps limit to minimum 1 for negative values', () => {
    expect(NormalizePagination({ limit: -10 }).limit).toBe(1);
  });

  it('uses default limit when limit is 0 (falsy coercion)', () => {
    // parseInt(0, 10) || DEFAULT_LIMIT = 0 || 20 = 20
    expect(NormalizePagination({ limit: 0 }).limit).toBe(20);
  });

  it('clamps limit to maximum 100', () => {
    expect(NormalizePagination({ limit: 999 }).limit).toBe(100);
    expect(NormalizePagination({ limit: 101 }).limit).toBe(100);
  });

  it('handles string inputs by parsing as integers', () => {
    const result = NormalizePagination({ page: '2', limit: '15' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(15);
    expect(result.skip).toBe(15);
  });

  it('handles NaN inputs by using defaults', () => {
    const result = NormalizePagination({ page: 'abc', limit: 'xyz' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('calculates correct skip for page 2 limit 20', () => {
    expect(NormalizePagination({ page: 2, limit: 20 }).skip).toBe(20);
  });

  it('calculates correct skip for page 5 limit 10', () => {
    expect(NormalizePagination({ page: 5, limit: 10 }).skip).toBe(40);
  });
});

describe('BuildPaginatedResponse', () => {
  it('returns expected shape', () => {
    const result = BuildPaginatedResponse([{ id: 1 }], 50, 1, 20);
    expect(result).toMatchObject({
      data: expect.any(Array),
      total: 50,
      page: 1,
      limit: 20,
      total_pages: 3,
    });
  });

  it('calculates total_pages correctly', () => {
    expect(BuildPaginatedResponse([], 100, 1, 20).total_pages).toBe(5);
    expect(BuildPaginatedResponse([], 1, 1, 20).total_pages).toBe(1);
    expect(BuildPaginatedResponse([], 21, 1, 20).total_pages).toBe(2);
  });

  it('returns total_pages = 1 when total is 0', () => {
    expect(BuildPaginatedResponse([], 0, 1, 20).total_pages).toBe(1);
  });

  it('serializes dates in data array', () => {
    const date = new Date('2025-06-01T00:00:00.000Z');
    const result = BuildPaginatedResponse([{ created_at: date }], 1, 1, 20);
    expect(result.data[0].created_at).toBe('2025-06-01T00:00:00.000Z');
  });

  it('preserves non-date fields as-is', () => {
    const result = BuildPaginatedResponse([{ name: 'foo', count: 42 }], 1, 1, 20);
    expect(result.data[0].name).toBe('foo');
    expect(result.data[0].count).toBe(42);
  });
});
