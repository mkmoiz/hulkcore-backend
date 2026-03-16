-- Add optional linked_product_id to carousel_images
ALTER TABLE carousel_images ADD COLUMN linked_product_id VARCHAR(191) DEFAULT NULL;
