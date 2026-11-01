import {
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CurrentUser } from '../auth/decorator/user.decorator';
import { FileService, ImageUpload } from './file.service';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileController {
  constructor(private readonly files: FileService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE + 2 } }),
  )
  create(
    @CurrentUser('userId') userId: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE + 1 }),
          new FileTypeValidator({
            fileType: /^image\//,
            overrideMimeType: true,
          }),
        ],
      }),
    )
    file: ImageUpload,
  ) {
    return this.files.create(userId, file);
  }

  @Get(':id')
  async get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.files.get(id, userId);
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: 'attachment',
      length: file.size,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') userId: number,
  ) {
    return this.files.remove(id, userId);
  }
}
