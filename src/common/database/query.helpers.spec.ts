import { delayedProjectFilter } from './query.helpers';

describe('query.helpers', () => {
  describe('delayedProjectFilter', () => {
    it('returns delayed status or active overdue shape', () => {
      const filter = delayedProjectFilter();
      expect(filter.$or).toHaveLength(2);
      expect(filter.$or[0]).toEqual({ status: 'delayed' });
      expect(filter.$or[1]).toMatchObject({
        status: 'active',
        progressPercent: { $lt: 95 },
      });
    });
  });
});
