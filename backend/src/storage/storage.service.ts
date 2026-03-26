import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { STORAGE_S3_CLIENT_FACTORY } from './storage.constants';

type UploadedObject = {
  Location?: string;
};

type S3UploadRequest = {
  upload: (params: Record<string, unknown>) => {
    promise: () => Promise<UploadedObject>;
  };
  deleteObject: (params: Record<string, unknown>) => {
    promise: () => Promise<void>;
  };
};

type S3ClientFactory = new (config: Record<string, unknown>) => S3UploadRequest;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3UploadRequest | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(STORAGE_S3_CLIENT_FACTORY)
    private readonly s3ClientFactory: S3ClientFactory,
  ) {}

  async uploadFile(buffer: Buffer, filename: string): Promise<string> {
    const safeFilename = this.buildFileName(filename);

    if (this.isAwsEnabled()) {
      return this.uploadToS3(buffer, safeFilename);
    }

    return this.uploadToLocal(buffer, safeFilename);
  }

  async deleteFile(url: string): Promise<void> {
    if (!url) {
      return;
    }

    if (this.isAwsEnabled()) {
      const key = this.extractS3KeyFromUrl(url);
      if (!key) {
        this.logger.warn(`Skipping S3 delete for unrecognized URL: ${url}`);
        return;
      }

      await this.getS3Client()
        .deleteObject({
          Bucket: this.getBucket(),
          Key: key,
        })
        .promise();
      return;
    }

    const filePath = this.resolveLocalFilePath(url);
    if (!filePath) {
      this.logger.warn(`Skipping local delete for unrecognized URL: ${url}`);
      return;
    }

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private isAwsEnabled(): boolean {
    return Boolean(
      this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
        this.configService.get<string>('AWS_SECRET_ACCESS_KEY') &&
        this.configService.get<string>('AWS_REGION') &&
        this.configService.get<string>('AWS_S3_BUCKET'),
    );
  }

  private async uploadToS3(buffer: Buffer, filename: string): Promise<string> {
    const uploadResult = await this.getS3Client()
      .upload({
        Bucket: this.getBucket(),
        Key: filename,
        Body: buffer,
        ACL: 'public-read',
      })
      .promise();

    if (!uploadResult.Location) {
      throw new InternalServerErrorException(
        'Upload completed without a public file URL',
      );
    }

    return uploadResult.Location;
  }

  private async uploadToLocal(buffer: Buffer, filename: string): Promise<string> {
    const uploadsDir = this.getUploadsDir();
    await fs.mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, buffer);

    return `${this.getPublicBaseUrl()}/uploads/${filename}`;
  }

  private getS3Client(): S3UploadRequest {
    if (!this.s3Client) {
      this.s3Client = new this.s3ClientFactory({
        region: this.configService.get<string>('AWS_REGION'),
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      });
    }

    return this.s3Client;
  }

  private buildFileName(filename: string): string {
    const parsed = path.parse(filename);
    const extension = parsed.ext || '';
    const name = parsed.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

    const normalizedBase = name || 'file';
    return `${randomUUID()}-${normalizedBase}${extension}`;
  }

  private getUploadsDir(): string {
    return this.configService.get<string>('STORAGE_LOCAL_DIR') ??
      path.join(process.cwd(), 'uploads');
  }

  private getPublicBaseUrl(): string {
    return (
      this.configService.get<string>('APP_URL') ??
      this.configService.get<string>('BACKEND_URL') ??
      `http://localhost:${this.configService.get<string>('PORT') ?? '3000'}`
    );
  }

  private getBucket(): string {
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    if (!bucket) {
      throw new InternalServerErrorException('AWS_S3_BUCKET is not configured');
    }

    return bucket;
  }

  private extractS3KeyFromUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      const bucket = this.getBucket();

      if (parsedUrl.hostname === `${bucket}.s3.amazonaws.com`) {
        return decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
      }

      if (parsedUrl.hostname.startsWith(`${bucket}.s3.`)) {
        return decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
      }

      if (
        parsedUrl.hostname.startsWith('s3.') ||
        parsedUrl.hostname === 's3.amazonaws.com'
      ) {
        const [bucketFromPath, ...keyParts] = parsedUrl.pathname
          .replace(/^\/+/, '')
          .split('/');
        if (bucketFromPath === bucket && keyParts.length > 0) {
          return decodeURIComponent(keyParts.join('/'));
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private resolveLocalFilePath(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      const uploadsPrefix = '/uploads/';
      if (!parsedUrl.pathname.startsWith(uploadsPrefix)) {
        return null;
      }

      const relativePath = decodeURIComponent(
        parsedUrl.pathname.slice(uploadsPrefix.length),
      );
      const uploadsDir = this.getUploadsDir();
      const resolvedPath = path.resolve(uploadsDir, relativePath);

      if (!resolvedPath.startsWith(path.resolve(uploadsDir))) {
        return null;
      }

      return resolvedPath;
    } catch {
      return null;
    }
  }
}
