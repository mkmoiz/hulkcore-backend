-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(64) NOT NULL,
    `phone` VARCHAR(64) NULL,
    `full_name` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NULL,
    `address_line1` VARCHAR(191) NULL,
    `address_line2` VARCHAR(191) NULL,
    `city` VARCHAR(128) NULL,
    `state` VARCHAR(128) NULL,
    `postal_code` VARCHAR(32) NULL,
    `country` VARCHAR(64) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_users_phone`(`phone`),
    UNIQUE INDEX `uq_users_email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_challenges` (
    `id` VARCHAR(64) NOT NULL,
    `phone` VARCHAR(24) NOT NULL,
    `otp_hash` CHAR(64) NOT NULL,
    `attempts_remaining` INTEGER UNSIGNED NOT NULL DEFAULT 5,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_otp_phone_created`(`phone`, `created_at`),
    INDEX `idx_otp_expires`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_otp_challenges` (
    `id` VARCHAR(64) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `otp_hash` CHAR(64) NOT NULL,
    `attempts_remaining` INTEGER UNSIGNED NOT NULL DEFAULT 5,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_email_otp_email_created`(`email`, `created_at`),
    INDEX `idx_email_otp_expires`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `token` VARCHAR(128) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_auth_sessions_user`(`user_id`),
    INDEX `idx_auth_sessions_expires`(`expires_at`),
    PRIMARY KEY (`token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `image_url` TEXT NOT NULL,
    `image_key` VARCHAR(512) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_categories_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `image_url` TEXT NOT NULL,
    `image_key` VARCHAR(512) NOT NULL DEFAULT '',
    `sku` VARCHAR(191) NOT NULL DEFAULT '',
    `badge` VARCHAR(64) NOT NULL DEFAULT '',
    `subtitle` VARCHAR(191) NOT NULL DEFAULT '',
    `category_id` VARCHAR(64) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `original_price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `offer_price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `rating_avg` DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    `review_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `stock` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_products_category_id`(`category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `image_url` TEXT NOT NULL,
    `image_key` VARCHAR(512) NOT NULL DEFAULT '',
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_product_images_product_sort`(`product_id`, `sort_order`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_reviews` (
    `id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `rating` TINYINT NOT NULL,
    `headline` VARCHAR(191) NULL,
    `comment` TEXT NULL,
    `is_approved` BOOLEAN NOT NULL DEFAULT false,
    `is_highlighted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_product_reviews_product`(`product_id`, `is_approved`, `created_at`),
    INDEX `idx_product_reviews_highlighted`(`is_highlighted`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wishlist_items` (
    `id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `idx_wishlist_items_user`(`user_id`, `created_at`),
    UNIQUE INDEX `uq_wishlist_items_user_product`(`user_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carts` (
    `id` VARCHAR(64) NOT NULL,
    `customer_ref` VARCHAR(128) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_carts_customer_status`(`customer_ref`, `status`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_items` (
    `id` VARCHAR(64) NOT NULL,
    `cart_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_cart_items_cart`(`cart_id`),
    UNIQUE INDEX `uq_cart_items_cart_product`(`cart_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_combo_items` (
    `id` VARCHAR(64) NOT NULL,
    `cart_id` VARCHAR(64) NOT NULL,
    `combo_offer_id` VARCHAR(64) NOT NULL,
    `combo_title` VARCHAR(191) NOT NULL,
    `banner_image_url` TEXT NOT NULL,
    `products_json` LONGTEXT NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_cart_combo_items_cart`(`cart_id`, `created_at`),
    UNIQUE INDEX `uq_cart_combo_items_pair`(`cart_id`, `combo_offer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(64) NOT NULL,
    `cart_id` VARCHAR(64) NULL,
    `customer_ref` VARCHAR(128) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `customer_email` VARCHAR(191) NOT NULL,
    `customer_phone` VARCHAR(64) NOT NULL DEFAULT '',
    `shipping_address_json` LONGTEXT NOT NULL,
    `payment_method` VARCHAR(64) NOT NULL DEFAULT 'cod',
    `payment_status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `payment_gateway` VARCHAR(64) NOT NULL DEFAULT '',
    `gateway_order_id` VARCHAR(128) NOT NULL DEFAULT '',
    `gateway_payment_id` VARCHAR(128) NOT NULL DEFAULT '',
    `gateway_signature` VARCHAR(512) NOT NULL DEFAULT '',
    `fulfillment_provider` VARCHAR(64) NOT NULL DEFAULT '',
    `fulfillment_order_id` VARCHAR(128) NOT NULL DEFAULT '',
    `fulfillment_shipment_id` VARCHAR(128) NOT NULL DEFAULT '',
    `fulfillment_awb_code` VARCHAR(128) NOT NULL DEFAULT '',
    `fulfillment_courier_name` VARCHAR(191) NOT NULL DEFAULT '',
    `fulfillment_status` VARCHAR(64) NOT NULL DEFAULT '',
    `fulfillment_synced_at` DATETIME(3) NULL,
    `fulfillment_payload_json` LONGTEXT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'INR',
    `status` VARCHAR(32) NOT NULL DEFAULT 'placed',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `shipping_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(10, 2) NOT NULL,
    `placed_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_orders_customer_ref`(`customer_ref`),
    INDEX `idx_orders_placed_at`(`placed_at`),
    INDEX `idx_orders_gateway_payment_id`(`gateway_payment_id`),
    INDEX `idx_orders_gateway_order_id`(`gateway_order_id`),
    INDEX `idx_orders_fulfillment_order_id`(`fulfillment_order_id`),
    INDEX `idx_orders_fulfillment_shipment_id`(`fulfillment_shipment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(64) NOT NULL,
    `order_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `product_name` VARCHAR(191) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `line_total` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_order_items_order_id`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_combo_items` (
    `id` VARCHAR(64) NOT NULL,
    `order_id` VARCHAR(64) NOT NULL,
    `combo_offer_id` VARCHAR(64) NOT NULL,
    `combo_title` VARCHAR(191) NOT NULL,
    `combo_description` TEXT NOT NULL,
    `banner_image_url` TEXT NOT NULL,
    `products_json` LONGTEXT NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `line_total` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_order_combo_items_order_id`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carousel_images` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT '',
    `image_url` TEXT NOT NULL,
    `image_key` VARCHAR(512) NOT NULL DEFAULT '',
    `linked_product_id` VARCHAR(191) NULL,
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_carousel_sort`(`sort_order`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `home_content` (
    `customer_code` VARCHAR(64) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`customer_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `levels` (
    `id` VARCHAR(64) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `image_url` TEXT NOT NULL,
    `image_key` VARCHAR(512) NOT NULL DEFAULT '',
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `rule_mode` VARCHAR(16) NOT NULL DEFAULT 'CURATED',
    `sort_mode` VARCHAR(32) NOT NULL DEFAULT 'featured',
    `include_category_ids_json` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_levels_slug`(`slug`),
    UNIQUE INDEX `uq_levels_name`(`name`),
    INDEX `idx_levels_position`(`position`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `level_products` (
    `id` VARCHAR(64) NOT NULL,
    `level_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_level_products_level`(`level_id`, `position`, `created_at`),
    UNIQUE INDEX `uq_level_products_pair`(`level_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offer_products` (
    `id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `badge` VARCHAR(64) NOT NULL DEFAULT '',
    `subtitle` VARCHAR(191) NOT NULL DEFAULT '',
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_offer_products_product`(`product_id`),
    INDEX `idx_offer_products_position`(`position`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `combo_offers` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `banner_image_url` TEXT NOT NULL,
    `banner_image_key` VARCHAR(512) NOT NULL DEFAULT '',
    `description` TEXT NOT NULL,
    `offer_price` DECIMAL(10, 2) NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `start_at` DATETIME(3) NULL,
    `end_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_combo_offers_position`(`position`, `created_at`),
    INDEX `idx_combo_offers_schedule`(`is_active`, `start_at`, `end_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `combo_offer_products` (
    `id` VARCHAR(64) NOT NULL,
    `combo_offer_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_combo_offer_products_combo`(`combo_offer_id`, `position`, `created_at`),
    UNIQUE INDEX `uq_combo_offer_products_pair`(`combo_offer_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `best_seller_products` (
    `id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_best_seller_products_product`(`product_id`),
    INDEX `idx_best_seller_products_position`(`position`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `homepage_product_section` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `heading` VARCHAR(191) NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_homepage_sections_position`(`position`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `homepage_products` (
    `id` VARCHAR(64) NOT NULL,
    `section_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_homepage_products_section`(`section_id`, `position`, `created_at`),
    UNIQUE INDEX `uq_homepage_products_pair`(`section_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lab_reports` (
    `id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `report_url` TEXT NOT NULL,
    `report_key` VARCHAR(512) NOT NULL DEFAULT '',
    `product_id` VARCHAR(64) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_lab_reports_position`(`position`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nav_menus` (
    `id` VARCHAR(64) NOT NULL,
    `menu_key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `published_payload` LONGTEXT NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_nav_menus_key`(`menu_key`),
    INDEX `idx_nav_menus_active`(`is_active`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nav_items` (
    `id` VARCHAR(64) NOT NULL,
    `menu_id` VARCHAR(64) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `item_type` VARCHAR(16) NOT NULL,
    `href` TEXT NULL,
    `target` VARCHAR(16) NOT NULL DEFAULT '_self',
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,
    `icon` VARCHAR(191) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_nav_items_menu_position`(`menu_id`, `position`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nav_dropdown_groups` (
    `id` VARCHAR(64) NOT NULL,
    `nav_item_id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT '',
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_nav_groups_item_position`(`nav_item_id`, `position`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nav_dropdown_links` (
    `id` VARCHAR(64) NOT NULL,
    `group_id` VARCHAR(64) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `href` TEXT NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `badge` VARCHAR(64) NOT NULL DEFAULT '',
    `tracking_tag` VARCHAR(128) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_nav_links_group_position`(`group_id`, `position`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nav_promo_tiles` (
    `id` VARCHAR(64) NOT NULL,
    `nav_item_id` VARCHAR(64) NOT NULL,
    `image_url` TEXT NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT '',
    `subtitle` VARCHAR(191) NOT NULL DEFAULT '',
    `href` TEXT NOT NULL,
    `position` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_nav_tiles_item_position`(`nav_item_id`, `position`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement_items` (
    `id` VARCHAR(64) NOT NULL,
    `text` VARCHAR(500) NOT NULL,
    `href` VARCHAR(500) NOT NULL DEFAULT '',
    `sort_order` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_announcement_items_order`(`sort_order`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `theme_settings` (
    `customer_code` VARCHAR(64) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`customer_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `fk_auth_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `fk_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reviews` ADD CONSTRAINT `fk_product_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reviews` ADD CONSTRAINT `fk_product_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wishlist_items` ADD CONSTRAINT `fk_wishlist_items_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wishlist_items` ADD CONSTRAINT `fk_wishlist_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `fk_cart_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_combo_items` ADD CONSTRAINT `fk_cart_combo_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_combo_items` ADD CONSTRAINT `fk_order_combo_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_products` ADD CONSTRAINT `fk_level_products_level` FOREIGN KEY (`level_id`) REFERENCES `levels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `level_products` ADD CONSTRAINT `fk_level_products_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offer_products` ADD CONSTRAINT `fk_offer_products_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `combo_offer_products` ADD CONSTRAINT `fk_combo_offer_products_offer` FOREIGN KEY (`combo_offer_id`) REFERENCES `combo_offers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `combo_offer_products` ADD CONSTRAINT `fk_combo_offer_products_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `best_seller_products` ADD CONSTRAINT `fk_best_seller_products_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homepage_products` ADD CONSTRAINT `fk_homepage_products_section` FOREIGN KEY (`section_id`) REFERENCES `homepage_product_section`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `homepage_products` ADD CONSTRAINT `fk_homepage_products_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lab_reports` ADD CONSTRAINT `fk_lab_reports_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nav_items` ADD CONSTRAINT `fk_nav_items_menu` FOREIGN KEY (`menu_id`) REFERENCES `nav_menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nav_dropdown_groups` ADD CONSTRAINT `fk_nav_groups_item` FOREIGN KEY (`nav_item_id`) REFERENCES `nav_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nav_dropdown_links` ADD CONSTRAINT `fk_nav_links_group` FOREIGN KEY (`group_id`) REFERENCES `nav_dropdown_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nav_promo_tiles` ADD CONSTRAINT `fk_nav_tiles_item` FOREIGN KEY (`nav_item_id`) REFERENCES `nav_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
