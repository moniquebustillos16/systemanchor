-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. ROLES
-- =====================================================
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- =====================================================
-- 2. WAREHOUSES
-- =====================================================
CREATE TABLE warehouses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(150) NOT NULL,
    location    VARCHAR(255),
    manager     VARCHAR(150),
    capacity    NUMERIC(12,2),
    utilized    NUMERIC(5,2),
    zones       INT DEFAULT 0,
    bins        INT DEFAULT 0,
    status      VARCHAR(30) DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- =====================================================
-- 3. USERS
-- =====================================================
CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR(255) NOT NULL,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    password              VARCHAR(255) NOT NULL,
    role_id               UUID REFERENCES roles(id),
    warehouse_id          UUID REFERENCES warehouses(id),
    access_all_warehouses BOOLEAN NOT NULL DEFAULT false,
    status                VARCHAR(30) NOT NULL DEFAULT 'active',
    phone                 VARCHAR(50),
    job_title             VARCHAR(150),
    department            VARCHAR(150),
    image_path            VARCHAR(500),
    image_url             VARCHAR(1000),
    last_login_at         TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ
);

-- =====================================================
-- 4. USER_WAREHOUSES
-- =====================================================
CREATE TABLE user_warehouses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, warehouse_id)
);

-- =====================================================
-- 5. USER_SETTINGS
-- =====================================================
CREATE TABLE user_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id),
    language            VARCHAR(50) DEFAULT 'English',
    timezone            VARCHAR(80) DEFAULT 'Asia/Manila',
    date_format         VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    theme               VARCHAR(20) DEFAULT 'system',
    email_notifications BOOLEAN DEFAULT true,
    push_notifications  BOOLEAN DEFAULT true,
    low_stock_alerts    BOOLEAN DEFAULT true,
    order_alerts        BOOLEAN DEFAULT true,
    digest_frequency    VARCHAR(20) DEFAULT 'daily',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 6. CATEGORIES
-- =====================================================
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- =====================================================
-- 7. SUPPLIERS
-- =====================================================
CREATE TABLE suppliers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    contact     VARCHAR(150),
    email       VARCHAR(255),
    phone       VARCHAR(50),
    city        VARCHAR(100),
    product_offers TEXT,
    score       NUMERIC(5,2) DEFAULT 80,
    status      VARCHAR(30) DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- =====================================================
-- 8. CUSTOMERS
-- =====================================================
CREATE TABLE customers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    contact     VARCHAR(150),
    email       VARCHAR(255),
    phone       VARCHAR(50),
    city        VARCHAR(100),
    status      VARCHAR(30) DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- =====================================================
-- 9. PRODUCTS
-- =====================================================
CREATE TABLE products (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku          VARCHAR(100) UNIQUE NOT NULL,
    name         VARCHAR(255) NOT NULL,
    barcode      VARCHAR(100),
    serial       VARCHAR(100),
    category_id  UUID REFERENCES categories(id),
    warehouse_id UUID REFERENCES warehouses(id),
    supplier_id  UUID REFERENCES suppliers(id),
    qty          NUMERIC(18,4) NOT NULL DEFAULT 0,
    min_stock    NUMERIC(18,4) DEFAULT 0,
    max_stock    NUMERIC(18,4) DEFAULT 0,
    price        NUMERIC(18,2) DEFAULT 0,
    status       VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

-- =====================================================
-- 10. PRODUCT_IMAGES
-- =====================================================
CREATE TABLE product_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id),
    image_path  VARCHAR(500) NOT NULL,
    image_url   VARCHAR(1000),
    file_name   VARCHAR(255),
    mime_type   VARCHAR(100),
    file_size   BIGINT,
    is_primary  BOOLEAN DEFAULT false,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- =====================================================
-- 11. PURCHASE_ORDERS
-- =====================================================
CREATE TABLE purchase_orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number    VARCHAR(50) UNIQUE NOT NULL,
    supplier_id  UUID NOT NULL REFERENCES suppliers(id),
    warehouse_id UUID REFERENCES warehouses(id),
    order_date   DATE NOT NULL,
    items        INT DEFAULT 1,
    product_name      VARCHAR(255) NOT NULL,   -- e.g. Steel, Bolts
    qty               INT NOT NULL DEFAULT 1,  -- 10, 2, 3 …
    unit_price        NUMERIC(18,2) NOT NULL DEFAULT 0,
    total        NUMERIC(18,2) NOT NULL,
    status       VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

-- =====================================================
-- 12. SALES_ORDERS
-- =====================================================
CREATE TABLE sales_orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_number    VARCHAR(50) UNIQUE NOT NULL,
    customer_id  UUID NOT NULL REFERENCES customers(id),
    warehouse_id UUID REFERENCES warehouses(id),
    order_date   DATE NOT NULL,
    items        INT DEFAULT 1,
    total        NUMERIC(18,2) NOT NULL,
    status       VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at   TIMESTAMPTZ
);

-- =====================================================
-- 13. GOODS_RECEIPTS
-- =====================================================
CREATE TABLE goods_receipts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number    VARCHAR(50) UNIQUE NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
    supplier_id       UUID NOT NULL REFERENCES suppliers(id),
    warehouse_id      UUID REFERENCES warehouses(id),
    receiver_id       UUID REFERENCES users(id),
    date              DATE NOT NULL,
    expected          NUMERIC(18,4) NOT NULL DEFAULT 0,
    received          NUMERIC(18,4) NOT NULL DEFAULT 0,
    status            VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

-- =====================================================
-- 14. STOCK_MOVEMENTS
-- =====================================================
CREATE TABLE stock_movements (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_number    VARCHAR(50) UNIQUE NOT NULL,
    type               VARCHAR(20) NOT NULL,
    product_id         UUID NOT NULL REFERENCES products(id),
    qty                NUMERIC(18,4) NOT NULL,
    from_warehouse_id  UUID REFERENCES warehouses(id),
    to_warehouse_id    UUID REFERENCES warehouses(id),
    reference          VARCHAR(100),
    notes              TEXT,
    performed_by       UUID REFERENCES users(id),
    movement_date      TIMESTAMPTZ NOT NULL,
    status             VARCHAR(30) DEFAULT 'posted',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 15. SHIPMENTS
-- =====================================================
CREATE TABLE shipments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number  VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id   UUID NOT NULL REFERENCES sales_orders(id),
    carrier          VARCHAR(100) NOT NULL,
    tracking         VARCHAR(100),
    warehouse_id     UUID REFERENCES warehouses(id),
    packages         INT NOT NULL DEFAULT 1,
    date             DATE NOT NULL,
    status           VARCHAR(30) NOT NULL DEFAULT 'shipped',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);

-- =====================================================
-- 16. RETURNS
-- =====================================================
CREATE TABLE returns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number   VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id  UUID NOT NULL REFERENCES sales_orders(id),
    warehouse_id    UUID REFERENCES warehouses(id),
    reason          VARCHAR(100) NOT NULL,
    disposition     VARCHAR(100) NOT NULL,
    items           INT NOT NULL DEFAULT 1,
    date            DATE NOT NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'processing',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- =====================================================
-- 17. CYCLE_COUNTS
-- =====================================================
CREATE TABLE cycle_counts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id   UUID NOT NULL REFERENCES warehouses(id),
    zone           VARCHAR(100) NOT NULL,
    scheduled_date DATE NOT NULL,
    started_at     VARCHAR(20),
    ended_at       VARCHAR(20),
    counted        NUMERIC(18,4) NOT NULL DEFAULT 0,
    system_qty     NUMERIC(18,4) NOT NULL DEFAULT 0,
    variance       VARCHAR(20),
    accuracy       NUMERIC(5,2),
    counter        VARCHAR(150),
    status         VARCHAR(30) NOT NULL DEFAULT 'draft',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);

-- =====================================================
-- 18. NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(255) NOT NULL,
    message     TEXT,
    page        VARCHAR(100),
    is_read     BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 19. API_KEYS
-- =====================================================
CREATE TABLE api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    key_prefix  VARCHAR(20) NOT NULL,
    key_hash    VARCHAR(255) NOT NULL,
    last_used_at TIMESTAMPTZ,
    status      VARCHAR(30) DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

-- =====================================================
-- 20. COMPANY_SETTINGS
-- =====================================================
CREATE TABLE company_settings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name         VARCHAR(255) NOT NULL DEFAULT 'System Anchor Logistics Inc.',
    trading_name         VARCHAR(255),
    tin                  VARCHAR(50),
    industry             VARCHAR(100) DEFAULT 'Warehousing & Logistics',
    street_address       VARCHAR(255),
    city                 VARCHAR(100),
    province             VARCHAR(100),
    region               VARCHAR(100),
    zip_code             VARCHAR(20),
    country              VARCHAR(100) DEFAULT 'Philippines',
    landmark             VARCHAR(255),
    phone                VARCHAR(50),
    email                VARCHAR(255),
    website              VARCHAR(255),
    timezone             VARCHAR(80) DEFAULT 'Asia/Manila',
    currency             VARCHAR(10) DEFAULT 'PHP',
    date_format          VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    language             VARCHAR(50) DEFAULT 'English',
    default_warehouse_id UUID REFERENCES warehouses(id),
    fiscal_year_start    VARCHAR(20) DEFAULT 'January',
    low_stock_threshold  NUMERIC(18,4) DEFAULT 15,
    auto_reorder         VARCHAR(50) DEFAULT 'disabled',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PRODUCT TRANSACTIONS
-- =====================================================

CREATE TABLE product_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product
    product_id UUID REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,

    -- Transaction
    transaction_type VARCHAR(30) NOT NULL
        CHECK (
            transaction_type IN (
                'purchase',
                'sale',
                'receiving',
                'shipment',
                'return'
            )
        ),

    reference_id UUID,
    reference_number VARCHAR(100),

    -- Partner
    -- partner_id stores either suppliers.id or customers.id
    partner_id UUID,
    partner_type VARCHAR(20) NOT NULL
        CHECK (
            partner_type IN (
                'supplier',
                'customer'
            )
        ),

    -- Quantity and Pricing
    quantity NUMERIC(18,4) NOT NULL DEFAULT 0
        CHECK (quantity >= 0),

    unit_price NUMERIC(18,2) NOT NULL DEFAULT 0
        CHECK (unit_price >= 0),

    total NUMERIC(18,2)
        GENERATED ALWAYS AS (quantity * unit_price) STORED,

    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'processing',
                'completed',
                'cancelled',
                'shipped',
                'received',
                'returned'
            )
        ),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);