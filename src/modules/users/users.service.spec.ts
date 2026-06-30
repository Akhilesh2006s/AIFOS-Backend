import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;
  const userModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();
    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('isTemporarilyLocked', () => {
    it('returns true when isLocked', () => {
      expect(service.isTemporarilyLocked({ isLocked: true })).toBe(true);
    });

    it('returns true when lockedUntil is in the future', () => {
      expect(
        service.isTemporarilyLocked({
          isLocked: false,
          lockedUntil: new Date(Date.now() + 60_000),
        }),
      ).toBe(true);
    });

    it('returns false when lock expired', () => {
      expect(
        service.isTemporarilyLocked({
          isLocked: false,
          lockedUntil: new Date(Date.now() - 1000),
        }),
      ).toBe(false);
    });
  });

  describe('recordFailedLogin', () => {
    it('increments attempts and locks at threshold', async () => {
      userModel.findById.mockResolvedValue({ failedLoginAttempts: 4 });
      userModel.findByIdAndUpdate.mockResolvedValue({});
      await service.recordFailedLogin('user-id');
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user-id',
        expect.objectContaining({
          failedLoginAttempts: 5,
          isLocked: true,
        }),
      );
    });
  });
});
