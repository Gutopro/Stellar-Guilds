import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { STORAGE_S3_CLIENT_FACTORY } from './storage.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    StorageService,
    {
      provide: STORAGE_S3_CLIENT_FACTORY,
      useValue: () => {
        const awsSdk = require('aws-sdk');
        return awsSdk.S3;
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
