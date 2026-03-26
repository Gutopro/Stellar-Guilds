import 'dotenv/config';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { WinstonLogger } from './logger/winston.logger';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLogger('Bootstrap'),
  });

  const logger = new WinstonLogger('Main');
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // Apply response standardization globally
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.use(
    '/uploads',
    express.static(
      process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), 'uploads'),
    ),
  );

  const config = new DocumentBuilder()
    .setTitle('Stellar-Guilds')
    .setDescription('Stellar-Guilds API documentation')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Stellar-Guilds API listening on port ${port}`, 'Bootstrap');
}
bootstrap().catch((error) => {
  const logger = new WinstonLogger('Bootstrap');
  logger.error('Failed to start application', error.stack, 'Bootstrap');
  process.exit(1);
});
