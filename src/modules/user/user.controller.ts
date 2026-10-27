import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorator/user.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ImageUpload } from '../file/file.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UserService } from './user.service';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({ description: 'The user account is banned.' })
  getMe(@CurrentUser('userId') userId: number): Promise<UserProfileDto> {
    return this.userService.getMe(userId);
  }

  @Patch('me')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOkResponse({ type: UserProfileDto })
  updateMe(
    @CurrentUser('userId') userId: number,
    @Body() body: UpdateProfileDto,
  ) {
    return this.userService.updateMe(userId, body);
  }

  @Put('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: UserProfileDto })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_SIZE + 2 } }),
  )
  putAvatar(
    @CurrentUser('userId') userId: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_AVATAR_SIZE + 1 }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png)$/,
            overrideMimeType: true,
          }),
        ],
      }),
    )
    file: ImageUpload,
  ) {
    return this.userService.putAvatar(userId, file);
  }

  @Get('me/avatar')
  async getAvatar(
    @CurrentUser('userId') userId: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.userService.getAvatar(userId);
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: 'inline',
      length: file.size,
    });
  }

  @Delete('me/avatar')
  @HttpCode(204)
  deleteAvatar(@CurrentUser('userId') userId: number) {
    return this.userService.deleteAvatar(userId);
  }

  @Delete('me')
  @HttpCode(204)
  deleteMe(@CurrentUser('userId') userId: number) {
    return this.userService.deleteMe(userId);
  }
}
