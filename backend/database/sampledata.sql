-- ============================================================
-- SEED DATA (10 rows per table)
-- Run AFTER the CREATE TABLE statements
-- ============================================================

-- ------------------------------------------------------------
-- 1. roles
-- ------------------------------------------------------------
INSERT INTO roles (id, name, description) VALUES
('11111111-1111-1111-1111-111111111101','Admin','Full system-wide access to all warehouses, users, roles, settings, inventory, movements, purchase orders, sales orders, receiving, shipping, returns, locations, capacity, cycle counts, suppliers, customers, quality checks, reports, and analytics.'),
('11111111-1111-1111-1111-111111111102','Warehouse Manager','Full access to their assigned warehouse(s), including Dashboard, Inventory, Movements, Purchase Orders, Sales Orders, Receiving, Shipping, Returns, Locations, Capacity, Cycle Count, Suppliers, Customers, Reports, and Analytics. Cannot manage Users, Roles, or System Settings.'),
('11111111-1111-1111-1111-111111111103','Shift Supervisor','Full operational access to their assigned warehouse, including Inventory, Movements, Receiving, Shipping, Returns, Locations, and Cycle Count. Read access to Dashboard, Purchase Orders, Sales Orders, Capacity, Suppliers, Customers, Reports, and Analytics.'),
('11111111-1111-1111-1111-111111111104','Warehouse Operator','Write access within their assigned warehouse for Stock Adjustment, Stock Movements, Receiving, Picking, Packing, Shipping, Dispatch, Labels, Returns, Stock Assignment, and Cycle Count. Read access to Dashboard, Inventory, Movements, Locations, and Returns.'),
('11111111-1111-1111-1111-111111111105','Receiving Clerk','Full access to Receiving operations in their assigned warehouse, including receiving goods, quantity verification, receiving records, and location assignment. Write access to Stock Movements, Returns, and Stock Assignment. Read access to Dashboard, Inventory, Purchase Orders, Locations, Suppliers, and Returns.'),
('11111111-1111-1111-1111-111111111106','Picker / Packer','Write access to shipping and fulfillment operations in their assigned warehouse, including Pick, Pack, Shipping Labels, and Dispatch. Read access to Dashboard, Inventory, Sales Orders, Shipments, and Locations.'),
('11111111-1111-1111-1111-111111111107','Sales Coordinator','Full access to Sales Orders, Shipping, Returns, and Customers associated with their assigned warehouse(s). Can create and manage orders, dispatch shipments, generate labels, and process returns. Read access to Dashboard, Inventory, and Reports.'),
('11111111-1111-1111-1111-111111111108','Inventory Controller','Full access to Inventory, Movements, Locations, Capacity, and Cycle Count within their assigned warehouse(s). Can adjust and reconcile inventory, manage stock locations, perform counts, and review inventory accuracy. Read access to Dashboard, Reports, and Analytics.'),
('11111111-1111-1111-1111-111111111109','Quality Inspector','Full access to Quality Checks within their assigned warehouse, including inspection, approval/rejection, defect recording, quarantine, and release. Write access to Receive Return. Read access to Dashboard, Inventory, Receiving, Returns, Locations, Cycle Count, Suppliers, and Reports.'),
('11111111-1111-1111-1111-111111111110','Viewer','Read-only access to permitted information within their assigned warehouse(s), including Dashboard, Inventory, Movements, Locations, Capacity, Suppliers, Customers, Reports, and Analytics. Cannot create, modify, approve, delete, or execute warehouse operations.');
-- ------------------------------------------------------------
-- 2. categories
-- ------------------------------------------------------------
INSERT INTO categories (id, name) VALUES
('22222222-2222-2222-2222-222222222201', 'Electronics'),
('22222222-2222-2222-2222-222222222202', 'Furniture'),
('22222222-2222-2222-2222-222222222203', 'Office Supplies'),
('22222222-2222-2222-2222-222222222204', 'Industrial Tools'),
('22222222-2222-2222-2222-222222222205', 'Packaging Materials'),
('22222222-2222-2222-2222-222222222206', 'Safety Equipment'),
('22222222-2222-2222-2222-222222222207', 'Consumables'),
('22222222-2222-2222-2222-222222222208', 'IT Accessories'),
('22222222-2222-2222-2222-222222222209', 'Cleaning Supplies'),
('22222222-2222-2222-2222-222222222210', 'Raw Materials');

-- ------------------------------------------------------------
-- 3. warehouses
-- ------------------------------------------------------------
INSERT INTO warehouses (id, code, name, location, manager, capacity, utilized, zones, bins, status) VALUES
('33333333-3333-3333-3333-333333333301', 'WH-MNL-01', 'Manila Main Warehouse', 'Pasay City, Metro Manila', 'Juan Dela Cruz', 50000.00, 68.50, 8, 320, 'active'),
('33333333-3333-3333-3333-333333333302', 'WH-CEB-01', 'Cebu Hub', 'Mandaue City, Cebu', 'Maria Santos', 25000.00, 55.20, 5, 180, 'active'),
('33333333-3333-3333-3333-333333333303', 'WH-DAV-01', 'Davao Distribution Center', 'Davao City', 'Pedro Reyes', 30000.00, 42.10, 6, 210, 'active'),
('33333333-3333-3333-3333-333333333304', 'WH-CLP-01', 'Clark Logistics Park', 'Clark Freeport, Pampanga', 'Ana Lopez', 40000.00, 71.80, 7, 280, 'active'),
('33333333-3333-3333-3333-333333333305', 'WH-BGZ-01', 'Baguio Cold Storage', 'Baguio City', 'Carlos Tan', 15000.00, 33.40, 3, 90, 'active'),
('33333333-3333-3333-3333-333333333306', 'WH-ILO-01', 'Iloilo Regional Warehouse', 'Iloilo City', 'Sofia Garcia', 18000.00, 48.90, 4, 140, 'active'),
('33333333-3333-3333-3333-333333333307', 'WH-CAG-01', 'Cagayan de Oro Depot', 'Cagayan de Oro', 'Miguel Torres', 22000.00, 61.25, 5, 165, 'active'),
('33333333-3333-3333-3333-333333333308', 'WH-BAC-01', 'Bacolod Satellite', 'Bacolod City', 'Elena Ramos', 12000.00, 29.70, 3, 85, 'active'),
('33333333-3333-3333-3333-333333333309', 'WH-GEN-01', 'General Santos Hub', 'General Santos City', 'Ramon Villanueva', 20000.00, 52.60, 4, 155, 'active'),
('33333333-3333-3333-3333-333333333310', 'WH-SUB-01', 'Subic Freeport Warehouse', 'Subic Bay, Zambales', 'Liza Mendoza', 35000.00, 64.15, 6, 240, 'active');

-- ------------------------------------------------------------
-- 4. suppliers
-- ------------------------------------------------------------
INSERT INTO suppliers (id, name, contact, email, phone, city, score, status) VALUES
('44444444-4444-4444-4444-444444444401', 'TechSource Philippines Inc.', 'Robert Lim', 'robert.lim@techsource.ph', '+63 917 123 4567', 'Makati', 92.50, 'active'),
('44444444-4444-4444-4444-444444444402', 'OfficePro Supply Co.', 'Grace Uy', 'grace.uy@officepro.ph', '+63 918 234 5678', 'Quezon City', 88.00, 'active'),
('44444444-4444-4444-4444-444444444403', 'Industrial Tools PH', 'Mark Villar', 'mark.villar@indtools.ph', '+63 919 345 6789', 'Pasig', 85.75, 'active'),
('44444444-4444-4444-4444-444444444404', 'SafeGuard Equipment', 'Jenny Chua', 'jenny.chua@safeguard.ph', '+63 920 456 7890', 'Manila', 91.20, 'active'),
('44444444-4444-4444-4444-444444444405', 'PackRight Solutions', 'David Ong', 'david.ong@packright.ph', '+63 921 567 8901', 'Caloocan', 79.50, 'active'),
('44444444-4444-4444-4444-444444444406', 'CleanMaster Supplies', 'Angela Sy', 'angela.sy@cleanmaster.ph', '+63 922 678 9012', 'Taguig', 86.30, 'active'),
('44444444-4444-4444-4444-444444444407', 'Furniture Hub Asia', 'Kevin Tan', 'kevin.tan@furniturehub.ph', '+63 923 789 0123', 'Parañaque', 83.90, 'active'),
('44444444-4444-4444-4444-444444444408', 'RawMat Trading Corp.', 'Patricia Go', 'patricia.go@rawmat.ph', '+63 924 890 1234', 'Valenzuela', 77.40, 'active'),
('44444444-4444-4444-4444-444444444409', 'IT Gadgets Express', 'Brian Ng', 'brian.ng@itgadgets.ph', '+63 925 901 2345', 'Mandaluyong', 94.10, 'active'),
('44444444-4444-4444-4444-444444444410', 'Consumables Direct', 'Sarah Lee', 'sarah.lee@consumables.ph', '+63 926 012 3456', 'Las Piñas', 81.60, 'active');

-- ------------------------------------------------------------
-- 5. customers
-- ------------------------------------------------------------
INSERT INTO customers (id, name, contact, email, phone, city, status) VALUES
('55555555-5555-5555-5555-555555555501', 'Metro Retail Group', 'James Rivera', 'james.rivera@metroretail.ph', '+63 917 111 2222', 'Makati', 'active'),
('55555555-5555-5555-5555-555555555502', 'Pacific Logistics Corp.', 'Nina Cruz', 'nina.cruz@pacificlog.ph', '+63 918 222 3333', 'Pasay', 'active'),
('55555555-5555-5555-5555-555555555503', 'Cebu Trading Company', 'Alvin Bautista', 'alvin.bautista@cebtrading.ph', '+63 919 333 4444', 'Cebu City', 'active'),
('55555555-5555-5555-5555-555555555504', 'Davao Commercial Center', 'Rosa Mendoza', 'rosa.mendoza@davaocom.ph', '+63 920 444 5555', 'Davao City', 'active'),
('55555555-5555-5555-5555-555555555505', 'Northern Luzon Distributors', 'Francis Aquino', 'francis.aquino@nldist.ph', '+63 921 555 6666', 'Baguio', 'active'),
('55555555-5555-5555-5555-555555555506', 'Visayas Supply Chain Inc.', 'Michelle Fernandez', 'michelle.fernandez@visayas.ph', '+63 922 666 7777', 'Iloilo', 'active'),
('55555555-5555-5555-5555-555555555507', 'Mindanao Builders Co.', 'George Santos', 'george.santos@mindbuilders.ph', '+63 923 777 8888', 'Cagayan de Oro', 'active'),
('55555555-5555-5555-5555-555555555508', 'National Office Solutions', 'Karen Yap', 'karen.yap@natloffice.ph', '+63 924 888 9999', 'Quezon City', 'active'),
('55555555-5555-5555-5555-555555555509', 'Island Wide Retailers', 'Tony Chua', 'tony.chua@islandwide.ph', '+63 925 999 0000', 'Bacolod', 'active'),
('55555555-5555-5555-5555-555555555510', 'Express Mart Holdings', 'Liza Gomez', 'liza.gomez@expressmart.ph', '+63 926 000 1111', 'General Santos', 'active');

-- ------------------------------------------------------------
-- 6. api_keys
-- ------------------------------------------------------------
INSERT INTO api_keys (id, name, key_prefix, key_hash, status) VALUES
('66666666-6666-6666-6666-666666666601', 'Mobile App Key', 'ak_live_', 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456', 'active'),
('66666666-6666-6666-6666-666666666602', 'WMS Integration', 'ak_live_', 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678', 'active'),
('66666666-6666-6666-6666-666666666603', 'ERP Connector', 'ak_live_', 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890', 'active'),
('66666666-6666-6666-6666-666666666604', 'Reporting Service', 'ak_live_', 'd4e5f6789012345678901234567890abcdef1234567890abcdef1234567890ab', 'active'),
('66666666-6666-6666-6666-666666666605', 'Partner Portal', 'ak_live_', 'e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcd', 'active'),
('66666666-6666-6666-6666-666666666606', 'Legacy System Sync', 'ak_test_', 'f6789012345678901234567890abcdef1234567890abcdef1234567890abcdef', 'active'),
('66666666-6666-6666-6666-666666666607', 'Analytics Dashboard', 'ak_live_', '789012345678901234567890abcdef1234567890abcdef1234567890abcdef12', 'active'),
('66666666-6666-6666-6666-666666666608', 'Third-party Shipping', 'ak_live_', '89012345678901234567890abcdef1234567890abcdef1234567890abcdef1234', 'active'),
('66666666-6666-6666-6666-666666666609', 'Internal Testing', 'ak_test_', '9012345678901234567890abcdef1234567890abcdef1234567890abcdef12345', 'active'),
('66666666-6666-6666-6666-666666666610', 'Backup Integration', 'ak_live_', '012345678901234567890abcdef1234567890abcdef1234567890abcdef123456', 'active');

-- ------------------------------------------------------------
-- 7. users
-- ------------------------------------------------------------
INSERT INTO users (id, name, email, password, role_id, status, phone, job_title, department) VALUES
('77777777-7777-7777-7777-777777777701', 'Juan Dela Cruz', 'juan.delacruz@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111101', 'active', '+63 917 100 1001', 'System Administrator', 'IT'),
('77777777-7777-7777-7777-777777777702', 'Maria Santos', 'maria.santos@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111102', 'active', '+63 917 100 1002', 'Operations Manager', 'Operations'),
('77777777-7777-7777-7777-777777777703', 'Pedro Reyes', 'pedro.reyes@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111103', 'active', '+63 917 100 1003', 'Warehouse Manager', 'Warehouse'),
('77777777-7777-7777-7777-777777777704', 'Ana Lopez', 'ana.lopez@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111104', 'active', '+63 917 100 1004', 'Inventory Clerk', 'Warehouse'),
('77777777-7777-7777-7777-777777777705', 'Carlos Tan', 'carlos.tan@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111105', 'active', '+63 917 100 1005', 'Purchasing Officer', 'Procurement'),
('77777777-7777-7777-7777-777777777706', 'Sofia Garcia', 'sofia.garcia@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111106', 'active', '+63 917 100 1006', 'Sales Officer', 'Sales'),
('77777777-7777-7777-7777-777777777707', 'Miguel Torres', 'miguel.torres@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111107', 'active', '+63 917 100 1007', 'Receiving Supervisor', 'Warehouse'),
('77777777-7777-7777-7777-777777777708', 'Elena Ramos', 'elena.ramos@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111108', 'active', '+63 917 100 1008', 'Shipping Coordinator', 'Logistics'),
('77777777-7777-7777-7777-777777777709', 'Ramon Villanueva', 'ramon.villanueva@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111109', 'active', '+63 917 100 1009', 'Finance Officer', 'Finance'),
('77777777-7777-7777-7777-777777777710', 'Liza Mendoza', 'liza.mendoza@anchorlogistics.ph', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '11111111-1111-1111-1111-111111111110', 'active', '+63 917 100 1010', 'Data Analyst', 'IT');

-- ------------------------------------------------------------
-- 8. user_settings
-- ------------------------------------------------------------
INSERT INTO user_settings (id, user_id, language, timezone, theme, digest_frequency) VALUES
('88888888-8888-8888-8888-888888888801', '77777777-7777-7777-7777-777777777701', 'English', 'Asia/Manila', 'dark', 'daily'),
('88888888-8888-8888-8888-888888888802', '77777777-7777-7777-7777-777777777702', 'English', 'Asia/Manila', 'system', 'daily'),
('88888888-8888-8888-8888-888888888803', '77777777-7777-7777-7777-777777777703', 'English', 'Asia/Manila', 'light', 'weekly'),
('88888888-8888-8888-8888-888888888804', '77777777-7777-7777-7777-777777777704', 'English', 'Asia/Manila', 'system', 'daily'),
('88888888-8888-8888-8888-888888888805', '77777777-7777-7777-7777-777777777705', 'English', 'Asia/Manila', 'dark', 'daily'),
('88888888-8888-8888-8888-888888888806', '77777777-7777-7777-7777-777777777706', 'English', 'Asia/Manila', 'light', 'weekly'),
('88888888-8888-8888-8888-888888888807', '77777777-7777-7777-7777-777777777707', 'English', 'Asia/Manila', 'system', 'daily'),
('88888888-8888-8888-8888-888888888808', '77777777-7777-7777-7777-777777777708', 'English', 'Asia/Manila', 'dark', 'daily'),
('88888888-8888-8888-8888-888888888809', '77777777-7777-7777-7777-777777777709', 'English', 'Asia/Manila', 'system', 'weekly'),
('88888888-8888-8888-8888-888888888810', '77777777-7777-7777-7777-777777777710', 'English', 'Asia/Manila', 'light', 'daily');

-- ------------------------------------------------------------
-- 9. products
-- ------------------------------------------------------------
INSERT INTO products (id, sku, name, barcode, category_id, warehouse_id, supplier_id, qty, min_stock, max_stock, price, status) VALUES
('99999999-9999-9999-9999-999999999901', 'ELEC-001', 'Wireless Keyboard', '4801234567890', '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444401', 150.0000, 20.0000, 300.0000, 1250.00, 'active'),
('99999999-9999-9999-9999-999999999902', 'ELEC-002', 'USB-C Hub 7-in-1', '4801234567891', '22222222-2222-2222-2222-222222222208', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444409', 85.0000, 15.0000, 200.0000, 1890.00, 'active'),
('99999999-9999-9999-9999-999999999903', 'FURN-001', 'Ergonomic Office Chair', '4801234567892', '22222222-2222-2222-2222-222222222202', '33333333-3333-3333-3333-333333333304', '44444444-4444-4444-4444-444444444407', 42.0000, 10.0000, 80.0000, 6500.00, 'active'),
('99999999-9999-9999-9999-999999999904', 'OFF-001', 'A4 Bond Paper (500 sheets)', '4801234567893', '22222222-2222-2222-2222-222222222203', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444402', 320.0000, 50.0000, 500.0000, 280.00, 'active'),
('99999999-9999-9999-9999-999999999905', 'TOOL-001', 'Cordless Drill 18V', '4801234567894', '22222222-2222-2222-2222-222222222204', '33333333-3333-3333-3333-333333333303', '44444444-4444-4444-4444-444444444403', 65.0000, 12.0000, 100.0000, 4200.00, 'active'),
('99999999-9999-9999-9999-999999999906', 'PACK-001', 'Carton Box 12x12x12', '4801234567895', '22222222-2222-2222-2222-222222222205', '33333333-3333-3333-3333-333333333302', '44444444-4444-4444-4444-444444444405', 980.0000, 100.0000, 1500.0000, 45.00, 'active'),
('99999999-9999-9999-9999-999999999907', 'SAFE-001', 'Safety Helmet (Yellow)', '4801234567896', '22222222-2222-2222-2222-222222222206', '33333333-3333-3333-3333-333333333307', '44444444-4444-4444-4444-444444444404', 210.0000, 30.0000, 400.0000, 350.00, 'active'),
('99999999-9999-9999-9999-999999999908', 'CONS-001', 'Ballpen Black (Box of 50)', '4801234567897', '22222222-2222-2222-2222-222222222207', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444410', 145.0000, 25.0000, 300.0000, 185.00, 'active'),
('99999999-9999-9999-9999-999999999909', 'CLN-001', 'Industrial Floor Cleaner 5L', '4801234567898', '22222222-2222-2222-2222-222222222209', '33333333-3333-3333-3333-333333333306', '44444444-4444-4444-4444-444444444406', 78.0000, 15.0000, 150.0000, 420.00, 'active'),
('99999999-9999-9999-9999-999999999910', 'RAW-001', 'Steel Sheet 1.2mm', '4801234567899', '22222222-2222-2222-2222-222222222210', '33333333-3333-3333-3333-333333333310', '44444444-4444-4444-4444-444444444408', 55.0000, 10.0000, 120.0000, 1850.00, 'active');

-- ------------------------------------------------------------
-- 10. product_images
-- ------------------------------------------------------------
INSERT INTO product_images (id, product_id, image_path, image_url, file_name, mime_type, file_size, is_primary, sort_order) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', '99999999-9999-9999-9999-999999999901', '/uploads/products/elec-001-main.jpg', 'https://cdn.anchorlogistics.ph/products/elec-001-main.jpg', 'elec-001-main.jpg', 'image/jpeg', 245760, true, 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', '99999999-9999-9999-9999-999999999901', '/uploads/products/elec-001-side.jpg', 'https://cdn.anchorlogistics.ph/products/elec-001-side.jpg', 'elec-001-side.jpg', 'image/jpeg', 198450, false, 2),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', '99999999-9999-9999-9999-999999999902', '/uploads/products/elec-002-main.jpg', 'https://cdn.anchorlogistics.ph/products/elec-002-main.jpg', 'elec-002-main.jpg', 'image/jpeg', 312000, true, 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04', '99999999-9999-9999-9999-999999999903', '/uploads/products/furn-001-main.jpg', 'https://cdn.anchorlogistics.ph/products/furn-001-main.jpg', 'furn-001-main.jpg', 'image/jpeg', 456800, true, 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05', '99999999-9999-9999-9999-999999999904', '/uploads/products/off-001-main.jpg', 'https://cdn.anchorlogistics.ph/products/off-001-main.jpg', 'off-001-main.jpg', 'image/jpeg', 187200, true, 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa06', '99999999-9999-9999-9999-999999999905', '/uploads/products/tool-001-main.jpg', 'https://cdn.anchorlogistics.ph/products/tool-001-main.jpg', 'tool-001-main.jpg', 'image/jpeg', 278900, true, 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa07', '99999999-9999-9999-9999-999999999906', '/uploads/products/pack-001-main.jpg', 'https://cdn.anchorlogistics.ph/products/pack-001-main.jpg', 'pack-001-main.jpg', 'image/jpeg', 156300, true, 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa08', '99999999-9999-9999-9999-999999999907', '/uploads/products/safe-001-main.jpg', 'https://cdn.anchorlogistics.ph/products/safe-001-main.jpg', 'safe-001-main.jpg', 'image/jpeg', 201500, true, 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa09', '99999999-9999-9999-9999-999999999908', '/uploads/products/cons-001-main.jpg', 'https://cdn.anchorlogistics.ph/products/cons-001-main.jpg', 'cons-001-main.jpg', 'image/jpeg', 134700, true, 1),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10', '99999999-9999-9999-9999-999999999909', '/uploads/products/cln-001-main.jpg', 'https://cdn.anchorlogistics.ph/products/cln-001-main.jpg', 'cln-001-main.jpg', 'image/jpeg', 223400, true, 1);

-- ------------------------------------------------------------
-- 11. purchase_orders
-- ------------------------------------------------------------
INSERT INTO purchase_orders (id, po_number, supplier_id, warehouse_id, order_date, items, total, status) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'PO-2026-0001', '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', '2026-01-15', 3, 187500.00, 'received'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'PO-2026-0002', '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333301', '2026-02-03', 2, 89600.00, 'received'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'PO-2026-0003', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', '2026-02-20', 4, 273000.00, 'partial'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', 'PO-2026-0004', '44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333307', '2026-03-05', 1, 73500.00, 'pending'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', 'PO-2026-0005', '44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333302', '2026-03-18', 5, 44100.00, 'received'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', 'PO-2026-0006', '44444444-4444-4444-4444-444444444406', '33333333-3333-3333-3333-333333333306', '2026-04-02', 2, 32760.00, 'approved'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb07', 'PO-2026-0007', '44444444-4444-4444-4444-444444444407', '33333333-3333-3333-3333-333333333304', '2026-04-22', 3, 273000.00, 'pending'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb08', 'PO-2026-0008', '44444444-4444-4444-4444-444444444408', '33333333-3333-3333-3333-333333333310', '2026-05-10', 2, 101750.00, 'received'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb09', 'PO-2026-0009', '44444444-4444-4444-4444-444444444409', '33333333-3333-3333-3333-333333333301', '2026-05-28', 4, 160650.00, 'approved'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10', 'PO-2026-0010', '44444444-4444-4444-4444-444444444410', '33333333-3333-3333-3333-333333333301', '2026-06-12', 1, 26825.00, 'pending');

-- ------------------------------------------------------------
-- 12. sales_orders
-- ------------------------------------------------------------
INSERT INTO sales_orders (id, so_number, customer_id, warehouse_id, order_date, items, total, status) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccc01', 'SO-2026-0001', '55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333301', '2026-01-20', 5, 312500.00, 'completed'),
('cccccccc-cccc-cccc-cccc-cccccccccc02', 'SO-2026-0002', '55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333301', '2026-02-08', 3, 187500.00, 'completed'),
('cccccccc-cccc-cccc-cccc-cccccccccc03', 'SO-2026-0003', '55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333302', '2026-02-25', 4, 156800.00, 'shipped'),
('cccccccc-cccc-cccc-cccc-cccccccccc04', 'SO-2026-0004', '55555555-5555-5555-5555-555555555504', '33333333-3333-3333-3333-333333333303', '2026-03-12', 2, 94500.00, 'processing'),
('cccccccc-cccc-cccc-cccc-cccccccccc05', 'SO-2026-0005', '55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333305', '2026-03-28', 6, 278400.00, 'completed'),
('cccccccc-cccc-cccc-cccc-cccccccccc06', 'SO-2026-0006', '55555555-5555-5555-5555-555555555506', '33333333-3333-3333-3333-333333333306', '2026-04-15', 3, 126000.00, 'shipped'),
('cccccccc-cccc-cccc-cccc-cccccccccc07', 'SO-2026-0007', '55555555-5555-5555-5555-555555555507', '33333333-3333-3333-3333-333333333307', '2026-05-02', 4, 210000.00, 'processing'),
('cccccccc-cccc-cccc-cccc-cccccccccc08', 'SO-2026-0008', '55555555-5555-5555-5555-555555555508', '33333333-3333-3333-3333-333333333301', '2026-05-20', 2, 87500.00, 'pending'),
('cccccccc-cccc-cccc-cccc-cccccccccc09', 'SO-2026-0009', '55555555-5555-5555-5555-555555555509', '33333333-3333-3333-3333-333333333308', '2026-06-05', 5, 198750.00, 'approved'),
('cccccccc-cccc-cccc-cccc-cccccccccc10', 'SO-2026-0010', '55555555-5555-5555-5555-555555555510', '33333333-3333-3333-3333-333333333309', '2026-06-18', 3, 142500.00, 'pending');

-- ------------------------------------------------------------
-- 13. goods_receipts
-- ------------------------------------------------------------
INSERT INTO goods_receipts (id, receipt_number, purchase_order_id, supplier_id, warehouse_id, receiver_id, date, expected, received, status) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddd01', 'GR-2026-0001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', '77777777-7777-7777-7777-777777777707', '2026-01-22', 150.0000, 150.0000, 'completed'),
('dddddddd-dddd-dddd-dddd-dddddddddd02', 'GR-2026-0002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333301', '77777777-7777-7777-7777-777777777707', '2026-02-10', 320.0000, 320.0000, 'completed'),
('dddddddd-dddd-dddd-dddd-dddddddddd03', 'GR-2026-0003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', '77777777-7777-7777-7777-777777777707', '2026-03-01', 65.0000, 40.0000, 'partial'),
('dddddddd-dddd-dddd-dddd-dddddddddd04', 'GR-2026-0004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', '44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333302', '77777777-7777-7777-7777-777777777704', '2026-03-25', 980.0000, 980.0000, 'completed'),
('dddddddd-dddd-dddd-dddd-dddddddddd05', 'GR-2026-0005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb08', '44444444-4444-4444-4444-444444444408', '33333333-3333-3333-3333-333333333310', '77777777-7777-7777-7777-777777777707', '2026-05-18', 55.0000, 55.0000, 'completed'),
('dddddddd-dddd-dddd-dddd-dddddddddd06', 'GR-2026-0006', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', '77777777-7777-7777-7777-777777777707', '2026-01-28', 85.0000, 85.0000, 'completed'),
('dddddddd-dddd-dddd-dddd-dddddddddd07', 'GR-2026-0007', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', '44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333307', '77777777-7777-7777-7777-777777777704', '2026-03-15', 210.0000, 0.0000, 'pending'),
('dddddddd-dddd-dddd-dddd-dddddddddd08', 'GR-2026-0008', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', '44444444-4444-4444-4444-444444444406', '33333333-3333-3333-3333-333333333306', '77777777-7777-7777-7777-777777777707', '2026-04-12', 78.0000, 78.0000, 'completed'),
('dddddddd-dddd-dddd-dddd-dddddddddd09', 'GR-2026-0009', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb09', '44444444-4444-4444-4444-444444444409', '33333333-3333-3333-3333-333333333301', '77777777-7777-7777-7777-777777777704', '2026-06-05', 85.0000, 60.0000, 'partial'),
('dddddddd-dddd-dddd-dddd-dddddddddd10', 'GR-2026-0010', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb07', '44444444-4444-4444-4444-444444444407', '33333333-3333-3333-3333-333333333304', '77777777-7777-7777-7777-777777777707', '2026-05-01', 42.0000, 0.0000, 'pending');

-- ------------------------------------------------------------
-- 14. stock_movements
-- ------------------------------------------------------------
INSERT INTO stock_movements (id, movement_number, type, product_id, qty, from_warehouse_id, to_warehouse_id, reference, notes, performed_by, movement_date, status) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'SM-2026-0001', 'receipt', '99999999-9999-9999-9999-999999999901', 150.0000, NULL, '33333333-3333-3333-3333-333333333301', 'GR-2026-0001', 'Initial stock receipt', '77777777-7777-7777-7777-777777777707', '2026-01-22 10:30:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'SM-2026-0002', 'receipt', '99999999-9999-9999-9999-999999999904', 320.0000, NULL, '33333333-3333-3333-3333-333333333301', 'GR-2026-0002', 'Paper stock received', '77777777-7777-7777-7777-777777777707', '2026-02-10 14:15:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'SM-2026-0003', 'transfer', '99999999-9999-9999-9999-999999999906', 200.0000, '33333333-3333-3333-3333-333333333302', '33333333-3333-3333-3333-333333333301', 'TR-2026-001', 'Transfer to Manila for high demand', '77777777-7777-7777-7777-777777777703', '2026-03-05 09:00:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'SM-2026-0004', 'issue', '99999999-9999-9999-9999-999999999901', 25.0000, '33333333-3333-3333-3333-333333333301', NULL, 'SO-2026-0001', 'Sales order fulfillment', '77777777-7777-7777-7777-777777777708', '2026-01-25 11:45:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05', 'SM-2026-0005', 'adjustment', '99999999-9999-9999-9999-999999999903', -2.0000, '33333333-3333-3333-3333-333333333304', NULL, 'ADJ-2026-001', 'Damaged units written off', '77777777-7777-7777-7777-777777777704', '2026-04-10 16:20:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee06', 'SM-2026-0006', 'receipt', '99999999-9999-9999-9999-999999999905', 40.0000, NULL, '33333333-3333-3333-3333-333333333303', 'GR-2026-0003', 'Partial receipt of drills', '77777777-7777-7777-7777-777777777707', '2026-03-01 13:00:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee07', 'SM-2026-0007', 'transfer', '99999999-9999-9999-9999-999999999907', 50.0000, '33333333-3333-3333-3333-333333333307', '33333333-3333-3333-3333-333333333301', 'TR-2026-002', 'Safety stock redistribution', '77777777-7777-7777-7777-777777777703', '2026-04-18 08:30:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee08', 'SM-2026-0008', 'issue', '99999999-9999-9999-9999-999999999902', 15.0000, '33333333-3333-3333-3333-333333333301', NULL, 'SO-2026-0002', 'USB hubs for customer order', '77777777-7777-7777-7777-777777777708', '2026-02-12 15:10:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09', 'SM-2026-0009', 'receipt', '99999999-9999-9999-9999-999999999910', 55.0000, NULL, '33333333-3333-3333-3333-333333333310', 'GR-2026-0005', 'Steel sheets received', '77777777-7777-7777-7777-777777777707', '2026-05-18 10:00:00+08', 'posted'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10', 'SM-2026-0010', 'adjustment', '99999999-9999-9999-9999-999999999908', 5.0000, NULL, '33333333-3333-3333-3333-333333333301', 'ADJ-2026-002', 'Found extra stock during count', '77777777-7777-7777-7777-777777777704', '2026-06-01 14:45:00+08', 'posted');

-- ------------------------------------------------------------
-- 15. shipments
-- ------------------------------------------------------------
INSERT INTO shipments (id, shipment_number, sales_order_id, carrier, tracking, warehouse_id, packages, date, status) VALUES
('ffffffff-ffff-ffff-ffff-ffffffffff01', 'SHP-2026-0001', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 'LBC Express', 'LBC123456789PH', '33333333-3333-3333-3333-333333333301', 3, '2026-01-26', 'delivered'),
('ffffffff-ffff-ffff-ffff-ffffffffff02', 'SHP-2026-0002', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 'J&T Express', 'JT987654321PH', '33333333-3333-3333-3333-333333333301', 2, '2026-02-10', 'delivered'),
('ffffffff-ffff-ffff-ffff-ffffffffff03', 'SHP-2026-0003', 'cccccccc-cccc-cccc-cccc-cccccccccc03', '2GO Express', '2GO456789012PH', '33333333-3333-3333-3333-333333333302', 4, '2026-03-02', 'in_transit'),
('ffffffff-ffff-ffff-ffff-ffffffffff04', 'SHP-2026-0004', 'cccccccc-cccc-cccc-cccc-cccccccccc05', 'LBC Express', 'LBC234567890PH', '33333333-3333-3333-3333-333333333305', 5, '2026-04-02', 'delivered'),
('ffffffff-ffff-ffff-ffff-ffffffffff05', 'SHP-2026-0005', 'cccccccc-cccc-cccc-cccc-cccccccccc06', 'Ninja Van', 'NV345678901PH', '33333333-3333-3333-3333-333333333306', 2, '2026-04-18', 'in_transit'),
('ffffffff-ffff-ffff-ffff-ffffffffff06', 'SHP-2026-0006', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 'GrabExpress', 'GE456789012PH', '33333333-3333-3333-3333-333333333301', 1, '2026-01-27', 'delivered'),
('ffffffff-ffff-ffff-ffff-ffffffffff07', 'SHP-2026-0007', 'cccccccc-cccc-cccc-cccc-cccccccccc03', 'J&T Express', 'JT567890123PH', '33333333-3333-3333-3333-333333333302', 1, '2026-03-05', 'shipped'),
('ffffffff-ffff-ffff-ffff-ffffffffff08', 'SHP-2026-0008', 'cccccccc-cccc-cccc-cccc-cccccccccc07', '2GO Express', '2GO678901234PH', '33333333-3333-3333-3333-333333333307', 3, '2026-05-08', 'processing'),
('ffffffff-ffff-ffff-ffff-ffffffffff09', 'SHP-2026-0009', 'cccccccc-cccc-cccc-cccc-cccccccccc09', 'LBC Express', 'LBC789012345PH', '33333333-3333-3333-3333-333333333308', 4, '2026-06-10', 'shipped'),
('ffffffff-ffff-ffff-ffff-ffffffffff10', 'SHP-2026-0010', 'cccccccc-cccc-cccc-cccc-cccccccccc04', 'Ninja Van', 'NV890123456PH', '33333333-3333-3333-3333-333333333303', 2, '2026-03-20', 'processing');

-- ------------------------------------------------------------
-- 16. returns
-- ------------------------------------------------------------
INSERT INTO returns (id, return_number, sales_order_id, warehouse_id, reason, disposition, items, date, status) VALUES
('10101010-1010-1010-1010-101010101001', 'RTN-2026-0001', 'cccccccc-cccc-cccc-cccc-cccccccccc01', '33333333-3333-3333-3333-333333333301', 'Damaged in transit', 'scrap', 2, '2026-02-05', 'completed'),
('10101010-1010-1010-1010-101010101002', 'RTN-2026-0002', 'cccccccc-cccc-cccc-cccc-cccccccccc02', '33333333-3333-3333-3333-333333333301', 'Wrong item shipped', 'restock', 1, '2026-02-18', 'completed'),
('10101010-1010-1010-1010-101010101003', 'RTN-2026-0003', 'cccccccc-cccc-cccc-cccc-cccccccccc03', '33333333-3333-3333-3333-333333333302', 'Customer changed mind', 'restock', 3, '2026-03-15', 'processing'),
('10101010-1010-1010-1010-101010101004', 'RTN-2026-0004', 'cccccccc-cccc-cccc-cccc-cccccccccc05', '33333333-3333-3333-3333-333333333305', 'Defective product', 'return_to_supplier', 1, '2026-04-10', 'completed'),
('10101010-1010-1010-1010-101010101005', 'RTN-2026-0005', 'cccccccc-cccc-cccc-cccc-cccccccccc06', '33333333-3333-3333-3333-333333333306', 'Overstocked by customer', 'restock', 2, '2026-04-28', 'processing'),
('10101010-1010-1010-1010-101010101006', 'RTN-2026-0006', 'cccccccc-cccc-cccc-cccc-cccccccccc01', '33333333-3333-3333-3333-333333333301', 'Packaging damaged', 'scrap', 1, '2026-02-12', 'completed'),
('10101010-1010-1010-1010-101010101007', 'RTN-2026-0007', 'cccccccc-cccc-cccc-cccc-cccccccccc07', '33333333-3333-3333-3333-333333333307', 'Quality issue', 'return_to_supplier', 2, '2026-05-15', 'processing'),
('10101010-1010-1010-1010-101010101008', 'RTN-2026-0008', 'cccccccc-cccc-cccc-cccc-cccccccccc08', '33333333-3333-3333-3333-333333333301', 'Incorrect quantity', 'restock', 1, '2026-05-30', 'pending'),
('10101010-1010-1010-1010-101010101009', 'RTN-2026-0009', 'cccccccc-cccc-cccc-cccc-cccccccccc09', '33333333-3333-3333-3333-333333333308', 'Not as described', 'restock', 3, '2026-06-15', 'processing'),
('10101010-1010-1010-1010-101010101010', 'RTN-2026-0010', 'cccccccc-cccc-cccc-cccc-cccccccccc04', '33333333-3333-3333-3333-333333333303', 'Late delivery rejection', 'restock', 2, '2026-03-25', 'completed');

-- ------------------------------------------------------------
-- 17. cycle_counts
-- ------------------------------------------------------------
INSERT INTO cycle_counts (id, code, warehouse_id, zone, scheduled_date, started_at, ended_at, counted, system_qty, variance, accuracy, counter, status) VALUES
('12121212-1212-1212-1212-121212121201', 'CC-2026-0001', '33333333-3333-3333-3333-333333333301', 'Zone A', '2026-01-10', '08:00', '11:30', 148.0000, 150.0000, '-2', 98.67, 'Ana Lopez', 'completed'),
('12121212-1212-1212-1212-121212121202', 'CC-2026-0002', '33333333-3333-3333-3333-333333333301', 'Zone B', '2026-02-05', '09:00', '12:00', 320.0000, 320.0000, '0', 100.00, 'Ana Lopez', 'completed'),
('12121212-1212-1212-1212-121212121203', 'CC-2026-0003', '33333333-3333-3333-3333-333333333302', 'Zone A', '2026-02-20', '08:30', '11:00', 975.0000, 980.0000, '-5', 99.49, 'Pedro Reyes', 'completed'),
('12121212-1212-1212-1212-121212121204', 'CC-2026-0004', '33333333-3333-3333-3333-333333333303', 'Zone C', '2026-03-15', '10:00', '13:45', 63.0000, 65.0000, '-2', 96.92, 'Ana Lopez', 'completed'),
('12121212-1212-1212-1212-121212121205', 'CC-2026-0005', '33333333-3333-3333-3333-333333333304', 'Zone A', '2026-04-01', '08:00', '10:30', 40.0000, 42.0000, '-2', 95.24, 'Pedro Reyes', 'completed'),
('12121212-1212-1212-1212-121212121206', 'CC-2026-0006', '33333333-3333-3333-3333-333333333305', 'Zone B', '2026-04-20', NULL, NULL, 0.0000, 0.0000, NULL, NULL, NULL, 'draft'),
('12121212-1212-1212-1212-121212121207', 'CC-2026-0007', '33333333-3333-3333-3333-333333333306', 'Zone A', '2026-05-08', '09:15', '12:30', 76.0000, 78.0000, '-2', 97.44, 'Ana Lopez', 'completed'),
('12121212-1212-1212-1212-121212121208', 'CC-2026-0008', '33333333-3333-3333-3333-333333333307', 'Zone D', '2026-05-22', '08:00', '11:00', 208.0000, 210.0000, '-2', 99.05, 'Pedro Reyes', 'completed'),
('12121212-1212-1212-1212-121212121209', 'CC-2026-0009', '33333333-3333-3333-3333-333333333308', 'Zone A', '2026-06-05', NULL, NULL, 0.0000, 0.0000, NULL, NULL, NULL, 'scheduled'),
('12121212-1212-1212-1212-121212121210', 'CC-2026-0010', '33333333-3333-3333-3333-333333333310', 'Zone B', '2026-06-18', '10:00', '13:00', 54.0000, 55.0000, '-1', 98.18, 'Ana Lopez', 'completed');

-- ------------------------------------------------------------
-- 18. notifications
-- ------------------------------------------------------------
INSERT INTO notifications (id, user_id, type, title, message, page, is_read) VALUES
('13131313-1313-1313-1313-131313131301', '77777777-7777-7777-7777-777777777701', 'system', 'Welcome to System Anchor Logistics', 'Your account has been successfully created.', 'dashboard', true),
('13131313-1313-1313-1313-131313131302', '77777777-7777-7777-7777-777777777703', 'low_stock', 'Low Stock Alert: Wireless Keyboard', 'SKU ELEC-001 is below minimum stock level.', 'products', false),
('13131313-1313-1313-1313-131313131303', '77777777-7777-7777-7777-777777777705', 'order', 'New Purchase Order Created', 'PO-2026-0010 has been created and is pending approval.', 'purchase-orders', false),
('13131313-1313-1313-1313-131313131304', '77777777-7777-7777-7777-777777777706', 'order', 'Sales Order Ready for Shipping', 'SO-2026-0008 is ready to be shipped.', 'sales-orders', true),
('13131313-1313-1313-1313-131313131305', '77777777-7777-7777-7777-777777777707', 'receipt', 'Goods Receipt Pending', 'GR-2026-0007 is awaiting receiving.', 'goods-receipts', false),
('13131313-1313-1313-1313-131313131306', '77777777-7777-7777-7777-777777777704', 'cycle_count', 'Cycle Count Scheduled', 'CC-2026-0009 has been scheduled for Zone A.', 'cycle-counts', false),
('13131313-1313-1313-1313-131313131307', '77777777-7777-7777-7777-777777777708', 'shipment', 'Shipment In Transit', 'SHP-2026-0003 is currently in transit.', 'shipments', true),
('13131313-1313-1313-1313-131313131308', '77777777-7777-7777-7777-777777777702', 'system', 'Monthly Digest Available', 'Your monthly operations digest is ready to view.', 'reports', false),
('13131313-1313-1313-1313-131313131309', '77777777-7777-7777-7777-777777777709', 'return', 'Return Request Received', 'RTN-2026-0008 requires review.', 'returns', false),
('13131313-1313-1313-1313-131313131310', '77777777-7777-7777-7777-777777777701', 'security', 'New API Key Created', 'A new API key "Backup Integration" was generated.', 'api-keys', true);

-- ------------------------------------------------------------
-- 19. company_settings (only 1 meaningful row is typical, but 10 rows as requested)
-- ------------------------------------------------------------
INSERT INTO company_settings (
    id, company_name, trading_name, tin, industry,
    street_address, city, province, region, zip_code, country, landmark,
    phone, email, website, timezone, currency, date_format, language,
    default_warehouse_id, fiscal_year_start, low_stock_threshold, auto_reorder
) VALUES
('14141414-1414-1414-1414-141414141401', 'System Anchor Logistics Inc.', 'Anchor Logistics', '123-456-789-000', 'Warehousing & Logistics',
 '123 Logistics Avenue', 'Pasay City', 'Metro Manila', 'NCR', '1300', 'Philippines', 'Near NAIA Terminal 3',
 '+63 2 8888 1000', 'info@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333301', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141402', 'System Anchor Logistics Inc. - Cebu', 'Anchor Cebu', '123-456-789-001', 'Warehousing & Logistics',
 '45 Industrial Road', 'Mandaue City', 'Cebu', 'Region VII', '6014', 'Philippines', 'Near Mactan Airport',
 '+63 32 888 2000', 'cebu@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333302', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141403', 'System Anchor Logistics Inc. - Davao', 'Anchor Davao', '123-456-789-002', 'Warehousing & Logistics',
 '78 Distribution Blvd', 'Davao City', 'Davao del Sur', 'Region XI', '8000', 'Philippines', 'Near Sasa Port',
 '+63 82 888 3000', 'davao@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333303', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141404', 'System Anchor Logistics Inc. - Clark', 'Anchor Clark', '123-456-789-003', 'Warehousing & Logistics',
 'Unit 12 Clark Logistics Park', 'Clark Freeport', 'Pampanga', 'Region III', '2023', 'Philippines', 'Inside Clark Freeport Zone',
 '+63 45 888 4000', 'clark@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333304', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141405', 'System Anchor Logistics Inc. - Baguio', 'Anchor Baguio', '123-456-789-004', 'Warehousing & Logistics',
 '15 Cold Storage Road', 'Baguio City', 'Benguet', 'CAR', '2600', 'Philippines', 'Near Session Road',
 '+63 74 888 5000', 'baguio@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333305', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141406', 'System Anchor Logistics Inc. - Iloilo', 'Anchor Iloilo', '123-456-789-005', 'Warehousing & Logistics',
 '22 Regional Hub Street', 'Iloilo City', 'Iloilo', 'Region VI', '5000', 'Philippines', 'Near Iloilo Port',
 '+63 33 888 6000', 'iloilo@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333306', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141407', 'System Anchor Logistics Inc. - CDO', 'Anchor CDO', '123-456-789-006', 'Warehousing & Logistics',
 '89 Depot Avenue', 'Cagayan de Oro', 'Misamis Oriental', 'Region X', '9000', 'Philippines', 'Near Macabalan Port',
 '+63 88 888 7000', 'cdo@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333307', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141408', 'System Anchor Logistics Inc. - Bacolod', 'Anchor Bacolod', '123-456-789-007', 'Warehousing & Logistics',
 '5 Satellite Street', 'Bacolod City', 'Negros Occidental', 'Region VI', '6100', 'Philippines', 'Near Bacolod Airport',
 '+63 34 888 8000', 'bacolod@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333308', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141409', 'System Anchor Logistics Inc. - GenSan', 'Anchor GenSan', '123-456-789-008', 'Warehousing & Logistics',
 '33 Hub Road', 'General Santos City', 'South Cotabato', 'Region XII', '9500', 'Philippines', 'Near Makar Port',
 '+63 83 888 9000', 'gensan@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333309', 'January', 15.0000, 'disabled'),

('14141414-1414-1414-1414-141414141410', 'System Anchor Logistics Inc. - Subic', 'Anchor Subic', '123-456-789-009', 'Warehousing & Logistics',
 '17 Freeport Warehouse Lane', 'Subic Bay', 'Zambales', 'Region III', '2200', 'Philippines', 'Inside Subic Freeport',
 '+63 47 888 0000', 'subic@anchorlogistics.ph', 'https://www.anchorlogistics.ph', 'Asia/Manila', 'PHP', 'YYYY-MM-DD', 'English',
 '33333333-3333-3333-3333-333333333310', 'January', 15.0000, 'disabled');

 INSERT INTO permissions (name, description) VALUES
('dashboard.view', 'View Dashboard'),

('inventory.view', 'View Inventory'),
('inventory.create', 'Create Inventory'),
('inventory.update', 'Update Inventory'),
('inventory.delete', 'Delete Inventory'),

('movements.view', 'View Stock Movements'),
('movements.create', 'Create Stock Movements'),

('receiving.view', 'View Receiving'),
('receiving.create', 'Create Receiving'),
('receiving.update', 'Update Receiving'),

('shipping.view', 'View Shipping'),
('shipping.create', 'Create Shipping'),
('shipping.update', 'Update Shipping'),

('returns.view', 'View Returns'),
('returns.create', 'Create Returns'),
('returns.update', 'Update Returns'),

('locations.view', 'View Locations'),
('locations.create', 'Create Locations'),
('locations.update', 'Update Locations'),

('cycle_counts.view', 'View Cycle Counts'),
('cycle_counts.create', 'Perform Cycle Count'),
('cycle_counts.update', 'Update Cycle Count'),

('purchase_orders.view', 'View Purchase Orders'),
('purchase_orders.create', 'Create Purchase Orders'),
('purchase_orders.update', 'Update Purchase Orders'),

('sales_orders.view', 'View Sales Orders'),
('sales_orders.create', 'Create Sales Orders'),
('sales_orders.update', 'Update Sales Orders'),

('suppliers.view', 'View Suppliers'),
('suppliers.create', 'Create Suppliers'),
('suppliers.update', 'Update Suppliers'),

('customers.view', 'View Customers'),
('customers.create', 'Create Customers'),
('customers.update', 'Update Customers'),

('quality_checks.view', 'View Quality Checks'),
('quality_checks.create', 'Perform Quality Checks'),
('quality_checks.update', 'Update Quality Checks'),

('reports.view', 'View Reports'),
('analytics.view', 'View Analytics'),

('users.view', 'View Users'),
('users.create', 'Create Users'),
('users.update', 'Update Users'),
('users.delete', 'Delete Users'),

('roles.view', 'View Roles'),
('roles.create', 'Create Roles'),
('roles.update', 'Update Roles'),
('roles.delete', 'Delete Roles'),

('settings.view', 'View Settings'),
('settings.update', 'Update Settings');


INSERT INTO role_permissions (role_id, permission_id)
SELECT
    '11111111-1111-1111-1111-111111111104',
    id
FROM permissions
WHERE name IN (
    'dashboard.view',
    'inventory.view',
    'movements.view',
    'receiving.view',
    'receiving.create',
    'receiving.update',
    'shipping.view',
    'shipping.create',
    'shipping.update',
    'returns.view',
    'returns.create',
    'returns.update',
    'locations.view',
    'cycle_counts.view',
    'cycle_counts.create',
    'cycle_counts.update'
);