import { getPool } from "./connection.js";

async function ensureProductImageKeyColumn() {
  const [rows] = await getPool().query("SHOW COLUMNS FROM products LIKE 'image_key'");

  if (rows.length > 0) {
    return;
  }

  await getPool().query(`
    ALTER TABLE products
    ADD COLUMN image_key VARCHAR(512) NOT NULL DEFAULT '' AFTER image_url
  `);
}

async function ensureProductCatalogColumns() {
  const columnAdditions = [
    {
      name: "badge",
      sql: `
        ALTER TABLE products
        ADD COLUMN badge VARCHAR(64) NOT NULL DEFAULT '' AFTER sku
      `,
    },
    {
      name: "subtitle",
      sql: `
        ALTER TABLE products
        ADD COLUMN subtitle VARCHAR(191) NOT NULL DEFAULT '' AFTER badge
      `,
    },
    {
      name: "original_price",
      sql: `
        ALTER TABLE products
        ADD COLUMN original_price DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER price
      `,
    },
    {
      name: "offer_price",
      sql: `
        ALTER TABLE products
        ADD COLUMN offer_price DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER original_price
      `,
    },
  ];

  for (const column of columnAdditions) {
    const [rows] = await getPool().query(`SHOW COLUMNS FROM products LIKE '${column.name}'`);
    if (rows.length === 0) {
      await getPool().query(column.sql);
    }
  }

  await getPool().query(`
    UPDATE products
    SET
      original_price = CASE
        WHEN original_price <= 0 THEN price
        ELSE original_price
      END,
      offer_price = CASE
        WHEN offer_price <= 0 THEN price
        ELSE offer_price
      END
  `);
}

async function ensureOrderPaymentColumns() {
  const columnAdditions = [
    {
      name: "payment_status",
      sql: `
        ALTER TABLE orders
        ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'pending' AFTER payment_method
      `,
    },
    {
      name: "payment_gateway",
      sql: `
        ALTER TABLE orders
        ADD COLUMN payment_gateway VARCHAR(64) NOT NULL DEFAULT '' AFTER payment_status
      `,
    },
    {
      name: "gateway_order_id",
      sql: `
        ALTER TABLE orders
        ADD COLUMN gateway_order_id VARCHAR(128) NOT NULL DEFAULT '' AFTER payment_gateway
      `,
    },
    {
      name: "gateway_payment_id",
      sql: `
        ALTER TABLE orders
        ADD COLUMN gateway_payment_id VARCHAR(128) NOT NULL DEFAULT '' AFTER gateway_order_id
      `,
    },
    {
      name: "gateway_signature",
      sql: `
        ALTER TABLE orders
        ADD COLUMN gateway_signature VARCHAR(512) NOT NULL DEFAULT '' AFTER gateway_payment_id
      `,
    },
  ];

  for (const column of columnAdditions) {
    const [rows] = await getPool().query(`SHOW COLUMNS FROM orders LIKE '${column.name}'`);
    if (rows.length === 0) {
      await getPool().query(column.sql);
    }
  }
}

async function ensureOrderFulfillmentColumns() {
  const columnAdditions = [
    {
      name: "fulfillment_provider",
      sql: `
        ALTER TABLE orders
        ADD COLUMN fulfillment_provider VARCHAR(64) NOT NULL DEFAULT '' AFTER gateway_signature
      `,
    },
    {
      name: "fulfillment_order_id",
      sql: `
        ALTER TABLE orders
        ADD COLUMN fulfillment_order_id VARCHAR(128) NOT NULL DEFAULT '' AFTER fulfillment_provider
      `,
    },
    {
      name: "fulfillment_shipment_id",
      sql: `
        ALTER TABLE orders
        ADD COLUMN fulfillment_shipment_id VARCHAR(128) NOT NULL DEFAULT '' AFTER fulfillment_order_id
      `,
    },
    {
      name: "fulfillment_awb_code",
      sql: `
        ALTER TABLE orders
        ADD COLUMN fulfillment_awb_code VARCHAR(128) NOT NULL DEFAULT '' AFTER fulfillment_shipment_id
      `,
    },
    {
      name: "fulfillment_courier_name",
      sql: `
        ALTER TABLE orders
        ADD COLUMN fulfillment_courier_name VARCHAR(191) NOT NULL DEFAULT '' AFTER fulfillment_awb_code
      `,
    },
    {
      name: "fulfillment_status",
      sql: `
        ALTER TABLE orders
        ADD COLUMN fulfillment_status VARCHAR(64) NOT NULL DEFAULT '' AFTER fulfillment_courier_name
      `,
    },
    {
      name: "fulfillment_synced_at",
      sql: `
        ALTER TABLE orders
        ADD COLUMN fulfillment_synced_at DATETIME(3) NULL AFTER fulfillment_status
      `,
    },
    {
      name: "fulfillment_payload_json",
      sql: `
        ALTER TABLE orders
        ADD COLUMN fulfillment_payload_json LONGTEXT NULL AFTER fulfillment_synced_at
      `,
    },
  ];

  for (const column of columnAdditions) {
    const [rows] = await getPool().query(`SHOW COLUMNS FROM orders LIKE '${column.name}'`);
    if (rows.length === 0) {
      await getPool().query(column.sql);
    }
  }
}

async function ensureOrderPaymentIndexes() {
  const indexDefinitions = [
    {
      name: "idx_orders_gateway_payment_id",
      sql: "CREATE INDEX idx_orders_gateway_payment_id ON orders (gateway_payment_id)",
    },
    {
      name: "idx_orders_gateway_order_id",
      sql: "CREATE INDEX idx_orders_gateway_order_id ON orders (gateway_order_id)",
    },
    {
      name: "idx_orders_fulfillment_order_id",
      sql: "CREATE INDEX idx_orders_fulfillment_order_id ON orders (fulfillment_order_id)",
    },
    {
      name: "idx_orders_fulfillment_shipment_id",
      sql: "CREATE INDEX idx_orders_fulfillment_shipment_id ON orders (fulfillment_shipment_id)",
    },
  ];

  for (const index of indexDefinitions) {
    const [rows] = await getPool().query(
      `
        SHOW INDEX FROM orders
        WHERE Key_name = ?
      `,
      [index.name],
    );

    if (rows.length === 0) {
      await getPool().query(index.sql);
    }
  }
}

async function ensureCategoryImageColumns() {
  const [urlRows] = await getPool().query("SHOW COLUMNS FROM categories LIKE 'image_url'");
  if (urlRows.length === 0) {
    await getPool().query(`
      ALTER TABLE categories
      ADD COLUMN image_url TEXT NULL AFTER description
    `);
    await getPool().query("UPDATE categories SET image_url = '' WHERE image_url IS NULL");
    await getPool().query("ALTER TABLE categories MODIFY COLUMN image_url TEXT NOT NULL");
  }

  const [keyRows] = await getPool().query("SHOW COLUMNS FROM categories LIKE 'image_key'");
  if (keyRows.length === 0) {
    await getPool().query(`
      ALTER TABLE categories
      ADD COLUMN image_key VARCHAR(512) NOT NULL DEFAULT '' AFTER image_url
    `);
  }
}



async function ensureUserProfileColumns() {
  const columnAdditions = [
    {
      name: "full_name",
      sql: `
        ALTER TABLE users
        ADD COLUMN full_name VARCHAR(191) NOT NULL DEFAULT '' AFTER phone
      `,
    },
    {
      name: "email",
      sql: `
        ALTER TABLE users
        ADD COLUMN email VARCHAR(191) NOT NULL DEFAULT '' AFTER full_name
      `,
    },
    {
      name: "address_line1",
      sql: `
        ALTER TABLE users
        ADD COLUMN address_line1 VARCHAR(191) NULL AFTER email
      `,
    },
    {
      name: "address_line2",
      sql: `
        ALTER TABLE users
        ADD COLUMN address_line2 VARCHAR(191) NULL AFTER address_line1
      `,
    },
    {
      name: "city",
      sql: `
        ALTER TABLE users
        ADD COLUMN city VARCHAR(128) NULL AFTER address_line2
      `,
    },
    {
      name: "state",
      sql: `
        ALTER TABLE users
        ADD COLUMN state VARCHAR(128) NULL AFTER city
      `,
    },
    {
      name: "postal_code",
      sql: `
        ALTER TABLE users
        ADD COLUMN postal_code VARCHAR(32) NULL AFTER state
      `,
    },
    {
      name: "country",
      sql: `
        ALTER TABLE users
        ADD COLUMN country VARCHAR(64) NULL AFTER postal_code
      `,
    },
  ];

  for (const column of columnAdditions) {
    const [rows] = await getPool().query(`SHOW COLUMNS FROM users LIKE '${column.name}'`);
    if (rows.length === 0) {
      await getPool().query(column.sql);
    }
  }

  await getPool().query("UPDATE users SET email = NULL WHERE TRIM(COALESCE(email, '')) = ''");
  await getPool().query("ALTER TABLE users MODIFY COLUMN phone VARCHAR(64) NULL");
  await getPool().query("ALTER TABLE users MODIFY COLUMN email VARCHAR(191) NULL");

  const [legacyEmailIndex] = await getPool().query(
    `
      SHOW INDEX FROM users
      WHERE Key_name = 'idx_users_email'
    `,
  );
  if (legacyEmailIndex.length > 0) {
    await getPool().query("DROP INDEX idx_users_email ON users");
  }

  const [uniqueEmailIndex] = await getPool().query(
    `
      SHOW INDEX FROM users
      WHERE Key_name = 'uq_users_email'
    `,
  );
  if (uniqueEmailIndex.length === 0) {
    await getPool().query("CREATE UNIQUE INDEX uq_users_email ON users (email)");
  }
}

async function ensureEmailOtpChallengesTable() {
  await getPool().query(`
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
}

async function ensureComboOfferTables() {
  await getPool().query(`
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

  await getPool().query(`
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
}

async function ensureCartComboItemsTable() {
  await getPool().query(`
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
}

async function ensureOrderComboItemsTable() {
  await getPool().query(`
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
}

async function ensureCarouselLinkColumn() {
  const [rows] = await getPool().query("SHOW COLUMNS FROM carousel_images LIKE 'linked_product_id'");

  if (rows.length > 0) {
    return;
  }

  await getPool().query(`
    ALTER TABLE carousel_images
    ADD COLUMN linked_product_id VARCHAR(191) NULL DEFAULT NULL AFTER image_key
  `);
}

async function ensureProductReviewsTable() {
  const columnAdditions = [
    {
      name: "rating_avg",
      sql: `
        ALTER TABLE products
        ADD COLUMN rating_avg DECIMAL(3, 2) NOT NULL DEFAULT 0.00 AFTER offer_price
      `,
    },
    {
      name: "review_count",
      sql: `
        ALTER TABLE products
        ADD COLUMN review_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER rating_avg
      `,
    },
  ];

  for (const column of columnAdditions) {
    const [rows] = await getPool().query(`SHOW COLUMNS FROM products LIKE '${column.name}'`);
    if (rows.length === 0) {
      await getPool().query(column.sql);
    }
  }

  await getPool().query(`
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
}

async function ensureHomepageProductTables() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS homepage_product_section (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      heading VARCHAR(191) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      updated_at DATETIME(3) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await getPool().query(`
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
}

async function ensureAnnouncementItemsTable() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS announcement_items (
      id VARCHAR(64) PRIMARY KEY,
      text VARCHAR(500) NOT NULL,
      href VARCHAR(500) NOT NULL DEFAULT '',
      sort_order INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      INDEX idx_announcement_items_order (sort_order, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function runMigrations() {
  await ensureCarouselLinkColumn();
  await ensureCategoryImageColumns();
  await ensureProductImageKeyColumn();
  await ensureProductCatalogColumns();
  await ensureOrderPaymentColumns();
  await ensureOrderFulfillmentColumns();
  await ensureOrderPaymentIndexes();

  await ensureUserProfileColumns();
  await ensureEmailOtpChallengesTable();
  await ensureComboOfferTables();
  await ensureCartComboItemsTable();
  await ensureOrderComboItemsTable();
  await ensureProductReviewsTable();
  await ensureHomepageProductTables();
  await ensureAnnouncementItemsTable();
}
