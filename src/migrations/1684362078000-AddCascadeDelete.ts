import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCascadeDelete1684362078000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the existing foreign key
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_cdb99c05982d5191ac8465ac010"`);
    
    // Re-create the foreign key with CASCADE delete
    await queryRunner.query(`ALTER TABLE "order_items" 
      ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" 
      FOREIGN KEY ("productId") 
      REFERENCES "products"("id") 
      ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert back to the original foreign key without CASCADE
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_cdb99c05982d5191ac8465ac010"`);
    
    await queryRunner.query(`ALTER TABLE "order_items" 
      ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" 
      FOREIGN KEY ("productId") 
      REFERENCES "products"("id")`);
  }
}
