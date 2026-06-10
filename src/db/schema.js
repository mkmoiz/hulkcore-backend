import { getPool } from "./connection.js";

export async function createSchema() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      slug VARCHAR(191) NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_key VARCHAR(512) NOT NULL DEFAULT '',
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_categories_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_key VARCHAR(512) NOT NULL DEFAULT '',
      sku VARCHAR(191) NOT NULL DEFAULT '',
      badge VARCHAR(64) NOT NULL DEFAULT '',
      subtitle VARCHAR(191) NOT NULL DEFAULT '',
      category_id VARCHAR(64) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      original_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      offer_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      rating_avg DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
      review_count INT UNSIGNED NOT NULL DEFAULT 0,
      stock INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_products_category_id (category_id),
      CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      rating TINYINT NOT NULL,
      headline VARCHAR(191) NULL,
      comment TEXT NULL,
      is_approved TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_product_reviews_product (product_id, is_approved, created_at),
      CONSTRAINT fk_product_reviews_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_product_reviews_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_images (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      image_url TEXT NOT NULL,
      image_key VARCHAR(512) NOT NULL DEFAULT '',
      sort_order INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_product_images_product_sort (product_id, sort_order, created_at),
      CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      id VARCHAR(64) PRIMARY KEY,
      customer_ref VARCHAR(128) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_carts_customer_status (customer_ref, status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id VARCHAR(64) PRIMARY KEY,
      cart_id VARCHAR(64) NOT NULL,
      product_id VARCHAR(64) NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_cart_items_cart_product (cart_id, product_id),
      INDEX idx_cart_items_cart (cart_id),
      CONSTRAINT fk_cart_items_cart
        FOREIGN KEY (cart_id)
        REFERENCES carts (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_cart_items_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_combo_items (
      id VARCHAR(64) PRIMARY KEY,
      cart_id VARCHAR(64) NOT NULL,
      combo_offer_id VARCHAR(64) NOT NULL,
      combo_title VARCHAR(191) NOT NULL,
      banner_image_url TEXT NOT NULL,
      products_json LONGTEXT NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_cart_combo_items_pair (cart_id, combo_offer_id),
      INDEX idx_cart_combo_items_cart (cart_id, created_at),
      CONSTRAINT fk_cart_combo_items_cart
        FOREIGN KEY (cart_id)
        REFERENCES carts (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64) PRIMARY KEY,
      cart_id VARCHAR(64) NULL,
      customer_ref VARCHAR(128) NOT NULL,
      customer_name VARCHAR(191) NOT NULL,
      customer_email VARCHAR(191) NOT NULL,
      customer_phone VARCHAR(64) NOT NULL DEFAULT '',
      shipping_address_json LONGTEXT NOT NULL,
      payment_method VARCHAR(64) NOT NULL DEFAULT 'cod',
      payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      payment_gateway VARCHAR(64) NOT NULL DEFAULT '',
      gateway_order_id VARCHAR(128) NOT NULL DEFAULT '',
      gateway_payment_id VARCHAR(128) NOT NULL DEFAULT '',
      gateway_signature VARCHAR(512) NOT NULL DEFAULT '',
      fulfillment_provider VARCHAR(64) NOT NULL DEFAULT '',
      fulfillment_order_id VARCHAR(128) NOT NULL DEFAULT '',
      fulfillment_shipment_id VARCHAR(128) NOT NULL DEFAULT '',
      fulfillment_awb_code VARCHAR(128) NOT NULL DEFAULT '',
      fulfillment_courier_name VARCHAR(191) NOT NULL DEFAULT '',
      fulfillment_status VARCHAR(64) NOT NULL DEFAULT '',
      fulfillment_synced_at DATETIME(3) NULL,
      fulfillment_payload_json LONGTEXT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'INR',
      status VARCHAR(32) NOT NULL DEFAULT 'placed',
      subtotal DECIMAL(10, 2) NOT NULL,
      shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
      total DECIMAL(10, 2) NOT NULL,
      placed_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_orders_customer_ref (customer_ref),
      INDEX idx_orders_placed_at (placed_at),
      CONSTRAINT fk_orders_cart
        FOREIGN KEY (cart_id)
        REFERENCES carts (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      phone VARCHAR(64) NULL,
      full_name VARCHAR(191) NOT NULL DEFAULT '',
      email VARCHAR(191) NULL,
      address_line1 VARCHAR(191) NULL,
      address_line2 VARCHAR(191) NULL,
      city VARCHAR(128) NULL,
      state VARCHAR(128) NULL,
      postal_code VARCHAR(32) NULL,
      country VARCHAR(64) NULL,
      is_verified TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_users_phone (phone),
      UNIQUE KEY uq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_challenges (
      id VARCHAR(64) PRIMARY KEY,
      phone VARCHAR(24) NOT NULL,
      otp_hash CHAR(64) NOT NULL,
      attempts_remaining INT UNSIGNED NOT NULL DEFAULT 5,
      expires_at DATETIME(3) NOT NULL,
      consumed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_otp_phone_created (phone, created_at),
      INDEX idx_otp_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_otp_challenges (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(191) NOT NULL,
      otp_hash CHAR(64) NOT NULL,
      attempts_remaining INT UNSIGNED NOT NULL DEFAULT 5,
      expires_at DATETIME(3) NOT NULL,
      consumed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_email_otp_email_created (email, created_at),
      INDEX idx_email_otp_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_auth_sessions_user (user_id),
      INDEX idx_auth_sessions_expires (expires_at),
      CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      product_id VARCHAR(64) NOT NULL,
      product_name VARCHAR(191) NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      line_total DECIMAL(10, 2) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_order_items_order_id (order_id),
      CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_combo_items (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      combo_offer_id VARCHAR(64) NOT NULL,
      combo_title VARCHAR(191) NOT NULL,
      combo_description TEXT NOT NULL,
      banner_image_url TEXT NOT NULL,
      products_json LONGTEXT NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      line_total DECIMAL(10, 2) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_order_combo_items_order_id (order_id),
      CONSTRAINT fk_order_combo_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carousel_images (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(191) NOT NULL DEFAULT '',
      image_url TEXT NOT NULL,
      image_key VARCHAR(512) NOT NULL DEFAULT '',
      sort_order INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_carousel_sort (sort_order, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);



  await pool.query(`
    CREATE TABLE IF NOT EXISTS home_content (
      customer_code VARCHAR(64) PRIMARY KEY,
      payload LONGTEXT NOT NULL,
      updated_at DATETIME(3) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS levels (
      id VARCHAR(64) PRIMARY KEY,
      slug VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_key VARCHAR(512) NOT NULL DEFAULT '',
      position INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      rule_mode VARCHAR(16) NOT NULL DEFAULT 'CURATED',
      sort_mode VARCHAR(32) NOT NULL DEFAULT 'featured',
      include_category_ids_json LONGTEXT NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_levels_slug (slug),
      UNIQUE KEY uq_levels_name (name),
      INDEX idx_levels_position (position, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS level_products (
      id VARCHAR(64) PRIMARY KEY,
      level_id VARCHAR(64) NOT NULL,
      product_id VARCHAR(64) NOT NULL,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      is_pinned TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_level_products_pair (level_id, product_id),
      INDEX idx_level_products_level (level_id, position, created_at),
      CONSTRAINT fk_level_products_level
        FOREIGN KEY (level_id)
        REFERENCES levels (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_level_products_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS offer_products (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      badge VARCHAR(64) NOT NULL DEFAULT '',
      subtitle VARCHAR(191) NOT NULL DEFAULT '',
      position INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_offer_products_product (product_id),
      INDEX idx_offer_products_position (position, created_at),
      CONSTRAINT fk_offer_products_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS combo_offers (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(191) NOT NULL,
      banner_image_url TEXT NOT NULL,
      banner_image_key VARCHAR(512) NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      offer_price DECIMAL(10, 2) NOT NULL,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 0,
      start_at DATETIME(3) NULL,
      end_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_combo_offers_position (position, created_at),
      INDEX idx_combo_offers_schedule (is_active, start_at, end_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS combo_offer_products (
      id VARCHAR(64) PRIMARY KEY,
      combo_offer_id VARCHAR(64) NOT NULL,
      product_id VARCHAR(64) NOT NULL,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_combo_offer_products_pair (combo_offer_id, product_id),
      INDEX idx_combo_offer_products_combo (combo_offer_id, position, created_at),
      CONSTRAINT fk_combo_offer_products_offer
        FOREIGN KEY (combo_offer_id)
        REFERENCES combo_offers (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      CONSTRAINT fk_combo_offer_products_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS best_seller_products (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_best_seller_products_product (product_id),
      INDEX idx_best_seller_products_position (position, created_at),
      CONSTRAINT fk_best_seller_products_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS homepage_product_section (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      heading VARCHAR(191) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      updated_at DATETIME(3) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS homepage_products (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_homepage_products_product (product_id),
      INDEX idx_homepage_products_position (position, created_at),
      CONSTRAINT fk_homepage_products_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lab_reports (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(191) NOT NULL,
      description TEXT NOT NULL,
      report_url TEXT NOT NULL,
      report_key VARCHAR(512) NOT NULL DEFAULT '',
      product_id VARCHAR(64) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_lab_reports_position (position, created_at),
      CONSTRAINT fk_lab_reports_product
        FOREIGN KEY (product_id)
        REFERENCES products (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nav_menus (
      id VARCHAR(64) PRIMARY KEY,
      menu_key VARCHAR(64) NOT NULL,
      name VARCHAR(191) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      version INT UNSIGNED NOT NULL DEFAULT 0,
      published_payload LONGTEXT NULL,
      published_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      UNIQUE KEY uq_nav_menus_key (menu_key),
      INDEX idx_nav_menus_active (is_active, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nav_items (
      id VARCHAR(64) PRIMARY KEY,
      menu_id VARCHAR(64) NOT NULL,
      label VARCHAR(191) NOT NULL,
      item_type VARCHAR(16) NOT NULL,
      href TEXT NULL,
      target VARCHAR(16) NOT NULL DEFAULT '_self',
      position INT UNSIGNED NOT NULL DEFAULT 0,
      is_visible TINYINT(1) NOT NULL DEFAULT 1,
      icon VARCHAR(191) NOT NULL DEFAULT '',
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_nav_items_menu_position (menu_id, position, created_at),
      CONSTRAINT fk_nav_items_menu
        FOREIGN KEY (menu_id)
        REFERENCES nav_menus (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nav_dropdown_groups (
      id VARCHAR(64) PRIMARY KEY,
      nav_item_id VARCHAR(64) NOT NULL,
      title VARCHAR(191) NOT NULL DEFAULT '',
      position INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_nav_groups_item_position (nav_item_id, position, created_at),
      CONSTRAINT fk_nav_groups_item
        FOREIGN KEY (nav_item_id)
        REFERENCES nav_items (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nav_dropdown_links (
      id VARCHAR(64) PRIMARY KEY,
      group_id VARCHAR(64) NOT NULL,
      label VARCHAR(191) NOT NULL,
      href TEXT NOT NULL,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      badge VARCHAR(64) NOT NULL DEFAULT '',
      tracking_tag VARCHAR(128) NOT NULL DEFAULT '',
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_nav_links_group_position (group_id, position, created_at),
      CONSTRAINT fk_nav_links_group
        FOREIGN KEY (group_id)
        REFERENCES nav_dropdown_groups (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nav_promo_tiles (
      id VARCHAR(64) PRIMARY KEY,
      nav_item_id VARCHAR(64) NOT NULL,
      image_url TEXT NOT NULL,
      title VARCHAR(191) NOT NULL DEFAULT '',
      subtitle VARCHAR(191) NOT NULL DEFAULT '',
      href TEXT NOT NULL,
      position INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_nav_tiles_item_position (nav_item_id, position, created_at),
      CONSTRAINT fk_nav_tiles_item
        FOREIGN KEY (nav_item_id)
        REFERENCES nav_items (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
