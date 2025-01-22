import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Products } from './products.entity';
import { Categories } from '../categories/categories.entity';
import { Repository, Like, Between, ILike } from 'typeorm';
import { ImageUtils } from '../utils/image.utils';
import { SearchProductsDto, SortOrder } from './dto/search-products.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Products)
    private readonly productsRepository: Repository<Products>,
    @InjectRepository(Categories)
    private readonly categoriesRepository: Repository<Categories>,
  ) {}

  async create(
    productData: Partial<Products>,
    categoryId: string,
  ): Promise<Products> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    // Process image if present
    if (productData.image) {
      try {
        productData.image = await ImageUtils.validateAndOptimizeImage(productData.image);
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    }

    const product = this.productsRepository.create({
      ...productData,
      category,
    });
    return this.productsRepository.save(product);
  }

  async findAll(): Promise<Products[]> {
    return this.productsRepository.find({
      relations: ['category']
    });
  }

  async search(searchDto: SearchProductsDto) {
    const { search, categoryId, minPrice, maxPrice, page = 1, limit = 10, sortBy } = searchDto;
    
    const query = this.productsRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    // Apply search filter
    if (search) {
      query.andWhere(
        '(LOWER(product.name) LIKE LOWER(:search) OR LOWER(product.description) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    // Apply category filter
    if (categoryId) {
      query.andWhere('category.id = :categoryId', { categoryId });
    }

    // Apply price range filter
    if (minPrice !== undefined && maxPrice !== undefined) {
      query.andWhere('product.price BETWEEN :minPrice AND :maxPrice', {
        minPrice,
        maxPrice,
      });
    } else if (minPrice !== undefined) {
      query.andWhere('product.price >= :minPrice', { minPrice });
    } else if (maxPrice !== undefined) {
      query.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    // Apply sorting
    if (sortBy) {
      switch (sortBy) {
        case SortOrder.PRICE_ASC:
          query.orderBy('product.price', 'ASC');
          break;
        case SortOrder.PRICE_DESC:
          query.orderBy('product.price', 'DESC');
          break;
        case SortOrder.NEWEST:
          query.orderBy('product.createdAt', 'DESC');
          break;
        default:
          query.orderBy('product.createdAt', 'DESC'); // Default sorting
      }
    } else {
      query.orderBy('product.createdAt', 'DESC'); // Default sorting
    }

    // Add pagination
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    // Get total count for pagination
    const [products, total] = await query.getManyAndCount();

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }

  async findOne(id: string): Promise<Products> {
    const product = await this.productsRepository.findOne({ 
      where: { id },
      relations: ['category']
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, productData: Partial<Products>): Promise<Products> {
    // Process image if present
    if (productData.image) {
      try {
        productData.image = await ImageUtils.validateAndOptimizeImage(productData.image);
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    }

    const updateResult = await this.productsRepository.update(id, productData);
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.productsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }
}
