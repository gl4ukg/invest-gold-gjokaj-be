import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProductPriceColumn1706039908000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, update any null prices to 0
    await queryRunner.query(`
      UPDATE products 
      SET price = 0 
      WHERE price IS NULL
    `);

    // Then alter the column to be decimal with not null constraint
    await queryRunner.query(`
      ALTER TABLE products 
      ALTER COLUMN price TYPE decimal(10,2) USING price::decimal(10,2),
      ALTER COLUMN price SET DEFAULT 0,
      ALTER COLUMN price SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products 
      ALTER COLUMN price DROP NOT NULL,
      ALTER COLUMN price DROP DEFAULT
    `);
  }
}
