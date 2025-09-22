import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Products } from './products.entity';
import { Categories } from '../categories/categories.entity';
import { Repository, Like, Between, ILike } from 'typeorm';
import { ImageUtils } from '../utils/image.utils';
import { SearchProductsDto, SortOrder } from './dto/search-products.dto';
import { FilterProductsDto, SortBy } from './dto/filter-products.dto';

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

    // Process images if present
    if (productData.images && Array.isArray(productData.images)) {
      try {
        // Process each image in parallel
        const optimizedImages = await Promise.all(
          productData.images.map(image => ImageUtils.validateAndOptimizeImage(image))
        );
        productData.images = optimizedImages;
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    } else if (productData.images) {
      throw new BadRequestException('Images must be provided as an array');
    }

    // Convert old string description to new format if needed
    if (typeof productData.description === 'string') {
      productData.description = {
        en: productData.description,
        de: productData.description,
        sq: productData.description
      };
    }

    const product = this.productsRepository.create({
      ...productData,
      category,
    });
    return this.productsRepository.save(product);
  }

  async findAll(): Promise<Products[]> {
    return this.productsRepository.find({
      relations: ['category'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async search(searchDto: SearchProductsDto) {
    const {
      query,
      categoryIds,
      sortBy,
      sortOrder,
      page = 1,
      limit = 10
    } = searchDto;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    // Apply search query if provided
    if (query) {
      queryBuilder.andWhere(
        '(LOWER(product.name) LIKE LOWER(:search) OR ' +
        'CASE ' +
        'WHEN jsonb_typeof(product.description) = "string" THEN LOWER(product.description::text) LIKE LOWER(:search) ' +
        'ELSE LOWER(product.description->>"en") LIKE LOWER(:search) OR ' +
        'LOWER(product.description->>"de") LIKE LOWER(:search) OR ' +
        'LOWER(product.description->>"sq") LIKE LOWER(:search) ' +
        'END)',
        { search: `%${query}%` }
      );
    }

    // Filter by categories if provided
    if (categoryIds && categoryIds.length > 0) {
      // Filter out invalid UUIDs
      const validCategoryIds = categoryIds.filter(id => {
        try {
          // Remove any extra characters and validate format
          const cleanId = id.trim();
          return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
        } catch {
          return false;
        }
      });
      
      // If categoryIds were provided but none are valid, return empty result
      if (validCategoryIds.length === 0) {
        return {
          items: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0
          }
        };
      }

      queryBuilder.andWhere('category.id IN (:...categoryIds)', { categoryIds: validCategoryIds });
    }

    // Apply sorting
    switch (sortBy) {
      case SortBy.NAME:
        queryBuilder.orderBy('product.name', sortOrder);
        break;
      case SortBy.STOCK:
        queryBuilder.orderBy('product.stock', sortOrder);
        break;
      case SortBy.CREATED_AT:
      default:
        queryBuilder.orderBy('product.createdAt', sortOrder);
    }

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async filterProducts(filterDto: FilterProductsDto) {
    const { categoryIds, sortBy, sortOrder, page = 1, limit = 10 } = filterDto;
    
    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (categoryIds && categoryIds.length > 0) {
      queryBuilder.where('category.id IN (:...categoryIds)', { categoryIds });
    }

    if (sortBy === SortBy.NAME) {
      queryBuilder.orderBy('product.name', sortOrder);
    } else if (sortBy === SortBy.CREATED_AT) {
      queryBuilder.orderBy('product.createdAt', sortOrder);
    }

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      items: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(id: string): Promise<Products> {
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

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
    // Process images if present
    if (productData.images && Array.isArray(productData.images)) {
      try {
        // Process each image in parallel
        const optimizedImages = await Promise.all(
          productData.images.map(image => ImageUtils.validateAndOptimizeImage(image))
        );
        productData.images = optimizedImages;
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    } else if (productData.images) {
      throw new BadRequestException('Images must be provided as an array');
    }

    // Convert old string description to new format if needed
    if (typeof productData.description === 'string') {
      productData.description = {
        en: productData.description,
        de: productData.description,
        sq: productData.description
      };
    }

    const updateResult = await this.productsRepository.update(id, productData);
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const product = await this.findOne(id);
  
    await this.productsRepository.remove(product);
  }
}
