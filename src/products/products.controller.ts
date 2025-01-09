import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createProduct(@Body() productData, categoryId: string) {
    return this.productsService.create(productData, categoryId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getProducts() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getProduct(@Body() id: string) {
    return this.productsService.findOne(id);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard)
  async updateProduct(@Body() id: string, @Body() productData) {
    return this.productsService.update(id, productData);
  }

  @Post(':id/delete')
  @UseGuards(JwtAuthGuard)
  async deleteProduct(@Body() id: string) {
    return this.productsService.remove(id);
  }
}
