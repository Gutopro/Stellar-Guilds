import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let storageService: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uploads avatar and replaces an existing stored file', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      avatarUrl: 'http://localhost:3000/uploads/old-avatar.png',
    });
    storageService.uploadFile.mockResolvedValue(
      'http://localhost:3000/uploads/new-avatar.png',
    );
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      avatarUrl: 'http://localhost:3000/uploads/new-avatar.png',
    });

    const result = await service.updateAvatar('user-1', {
      buffer: Buffer.from('avatar'),
      originalname: 'avatar.png',
    });

    expect(storageService.uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'avatar.png',
    );
    expect(storageService.deleteFile).toHaveBeenCalledWith(
      'http://localhost:3000/uploads/old-avatar.png',
    );
    expect(result.avatarUrl).toBe('http://localhost:3000/uploads/new-avatar.png');
  });

  it('throws when updating avatar for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.updateAvatar('missing-user', {
        buffer: Buffer.from('avatar'),
        originalname: 'avatar.png',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
