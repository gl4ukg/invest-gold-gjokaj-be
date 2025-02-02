import { Body, Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SearchProductsDto } from './dto/search-products.dto';
import { Products } from './products.entity';
import { CreateProductDto } from './dto/create-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createProduct(@Body() createProductDto: CreateProductDto) {
    const { product, categoryId } = createProductDto;
    
    // Extract only the needed fields from the product
    const productData = {
      name: product.name,
      description: product.description,
      weight: product.weight,
      stock: product.stock,
      image: product.image
    };

    return this.productsService.create(productData, categoryId);
  }

  @Get()
  async getProducts() {
    return this.productsService.findAll();
  }

  @Get('search')
  async searchProducts(@Query() searchDto: SearchProductsDto) {
    // Convert string numbers to actual numbers
    // if (searchDto.minPrice) searchDto.minPrice = Number(searchDto.minPrice);
    // if (searchDto.maxPrice) searchDto.maxPrice = Number(searchDto.maxPrice);
    if (searchDto.page) searchDto.page = Number(searchDto.page);
    if (searchDto.limit) searchDto.limit = Number(searchDto.limit);

    return this.productsService.search(searchDto);
  }

  @Get(':id')
  async getProduct(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard)
  async updateProduct(
    @Param('id') id: string,
    @Body() productData: any
  ) {
    return this.productsService.update(id, productData);
  }

  @Post(':id/delete')
  @UseGuards(JwtAuthGuard)
  async deleteProduct(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
