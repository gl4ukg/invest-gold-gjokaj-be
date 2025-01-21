import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Products } from './products.entity';
import { Categories } from '../categories/categories.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Products, Categories]),
    AuthModule
  ],
  controllers: [ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
