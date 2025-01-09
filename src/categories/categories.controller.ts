import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createCategory(@Body() categoryData) {
    return this.categoriesService.create(categoryData);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getCategories() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getCategory(@Body() id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard)
  async updateCategory(@Body() id: string, @Body() categoryData) {
    return this.categoriesService.update(id, categoryData);
  }

  @Post(':id/delete')
  @UseGuards(JwtAuthGuard)
  async deleteCategory(@Body() id: string) {
    return this.categoriesService.remove(id);
  }
}
