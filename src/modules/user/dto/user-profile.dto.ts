import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from 'generated/prisma/enums';

export class UserProfileDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: String, nullable: true })
  name: string | null;

  @ApiProperty({ type: String, nullable: true })
  bio: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  hasPassword: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  passwordChangedAt: Date | null;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
