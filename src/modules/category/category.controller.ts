import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryDto } from './dto/caregory-dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from 'src/utils/query.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { CurrentUser } from 'src/modules/auth/decorator/user.decorator';

@ApiTags('Category')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  @Post()
  create(@Body() body: CategoryDto, @CurrentUser('userId') userId: number) {
    return this.categoryService.create(body, userId);
  }

  @Get()
  findAll(@Param() params: PaginationDto, @CurrentUser('userId') userId: number) {
    return this.categoryService.findAll(params, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CategoryDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.categoryService.update(+id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('userId') userId: number) {
    return this.categoryService.remove(+id, userId);
  }
}
