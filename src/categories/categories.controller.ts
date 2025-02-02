import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createCategory(@Body() categoryData: CreateCategoryDto) {
    return this.categoriesService.create(categoryData);
  }

  @Get()
  async getCategories() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  async getCategory(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard)
  async updateCategory(
    @Param('id') id: string,
    @Body() categoryData: UpdateCategoryDto
  ) {
    return this.categoriesService.update(id, categoryData);
  }

  @Post(':id/delete')
  @UseGuards(JwtAuthGuard)
  async deleteCategory(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
