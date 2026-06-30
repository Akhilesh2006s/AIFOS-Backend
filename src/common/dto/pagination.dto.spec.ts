import { paginate, paginationSkip } from './pagination.dto';

describe('pagination.dto', () => {
  it('computes skip offset', () => {
    expect(paginationSkip(1, 50)).toBe(0);
    expect(paginationSkip(3, 25)).toBe(50);
    expect(paginationSkip(0, 25)).toBe(0);
  });

  it('builds paginated envelope', () => {
    const result = paginate(['a', 'b'], 100, 2, 25);
    expect(result.data).toEqual(['a', 'b']);
    expect(result.meta).toEqual({
      page: 2,
      limit: 25,
      total: 100,
      totalPages: 4,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('handles last page', () => {
    const result = paginate(['z'], 51, 3, 25);
    expect(result.meta.hasNext).toBe(false);
    expect(result.meta.hasPrev).toBe(true);
  });
});
