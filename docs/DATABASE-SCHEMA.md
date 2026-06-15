# ESSA ERP - Database Schema Design

## Overview

This document defines the complete database schema for the ESSA ERP system, designed to support packaging and pharmaceutical industries with comprehensive inventory, production, sales, and accounting management.

**Database System**: PostgreSQL 13+  
**Character Set**: UTF-8  
**Collation**: en_US.UTF-8

---

## 1. Core Entity Relationship Diagram (ERD)

```
┌──────────────────────────────────────────────────────────────────┐
│                        ORGANIZATION                               │
├──────────────────────────────────────────────────────────────────┤
│ • Companies/Branches                                              │
│ • Departments                                                     │
│ • Cost Centers                                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       MASTER DATA                                  │
├──────────────────────────────────────────────────────────────────┤
│ • Customers      • Suppliers      • Products                      │
│ • Employees      • Warehouses     • Units of Measure              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    TRANSACTION DATA                                │
├──────────────────────────────────────────────────────────────────┤
│ • Purchase Orders    • Sales Orders    • Production Orders        │
│ • Goods Receipts     • Invoices        • Payment Records           │
│ • Stock Movements    • Journal Entries • Batch Transactions       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. System Schemas

### 2.1 Organization Schema

#### `companies` Table
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  registration_number VARCHAR(50),
  tax_id VARCHAR(50) UNIQUE,
  currency_code CHAR(3) DEFAULT 'USD',
  fiscal_year_start INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### `departments` Table
```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_department_id UUID REFERENCES departments(id),
  department_head_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### `cost_centers` Table
```sql
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  department_id UUID REFERENCES departments(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

---

### 2.2 User & Security Schema

#### `users` Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  require_password_change BOOLEAN DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### `roles` Table
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `user_roles` Table
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role_id)
);
```

#### `permissions` Table
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  resource VARCHAR(100),
  action VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `role_permissions` Table
```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);
```

---

## 3. Master Data Schema

### 3.1 Inventory Master Data

#### `products` Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),
  base_unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  product_type ENUM('RAW_MATERIAL', 'FINISHED_GOODS', 'SEMI_FINISHED'),
  is_serialized BOOLEAN DEFAULT FALSE,
  is_batch_tracked BOOLEAN DEFAULT TRUE,
  reorder_quantity DECIMAL(12,4) DEFAULT 0,
  minimum_stock DECIMAL(12,4) DEFAULT 0,
  maximum_stock DECIMAL(12,4) DEFAULT 0,
  standard_cost DECIMAL(15,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### `product_categories` Table
```sql
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_category_id UUID REFERENCES product_categories(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### `units_of_measure` Table
```sql
CREATE TABLE units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `product_unit_conversions` Table
```sql
CREATE TABLE product_unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  from_unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  to_unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  conversion_factor DECIMAL(12,4) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(product_id, from_unit_id, to_unit_id)
);
```

#### `product_batches` Table (Pharmaceutical/Expiration tracking)
```sql
CREATE TABLE product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  batch_number VARCHAR(50) NOT NULL,
  manufacturer_date DATE,
  expiration_date DATE NOT NULL,
  received_date DATE NOT NULL,
  quantity_received DECIMAL(12,4) NOT NULL,
  quantity_available DECIMAL(12,4) NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  storage_location VARCHAR(100),
  status ENUM('ACTIVE', 'RESERVED', 'DAMAGED', 'EXPIRED') DEFAULT 'ACTIVE',
  cost_per_unit DECIMAL(15,4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, batch_number)
);
```

### 3.2 Warehouse Management

#### `warehouses` Table
```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  manager_id UUID REFERENCES employees(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `warehouse_locations` Table
```sql
CREATE TABLE warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  zone VARCHAR(20),
  aisle VARCHAR(20),
  rack VARCHAR(20),
  shelf VARCHAR(20),
  position VARCHAR(20),
  location_code VARCHAR(50) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `stock_levels` Table
```sql
CREATE TABLE stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity_on_hand DECIMAL(12,4) DEFAULT 0,
  quantity_reserved DECIMAL(12,4) DEFAULT 0,
  quantity_available DECIMAL(12,4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  last_count_date DATE,
  recount_required BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, warehouse_id)
);
```

### 3.3 Party Master Data

#### `customers` Table
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('INDIVIDUAL', 'CORPORATE') DEFAULT 'CORPORATE',
  tax_id VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(20),
  billing_address TEXT,
  shipping_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  credit_limit DECIMAL(15,2) DEFAULT 0,
  payment_terms_id UUID REFERENCES payment_terms(id),
  customer_group_id UUID REFERENCES customer_groups(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### `suppliers` Table
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  tax_id VARCHAR(50),
  payment_terms_id UUID REFERENCES payment_terms(id),
  supplier_rating DECIMAL(3,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### `employees` Table
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  employee_code VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  date_of_birth DATE,
  department_id UUID REFERENCES departments(id),
  manager_id UUID REFERENCES employees(id),
  designation VARCHAR(100),
  date_of_joining DATE NOT NULL,
  date_of_leaving DATE,
  status ENUM('ACTIVE', 'INACTIVE', 'LEFT') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `payment_terms` Table
```sql
CREATE TABLE payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  due_days INT DEFAULT 0,
  discount_days INT DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `customer_groups` Table
```sql
CREATE TABLE customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Transaction Data Schema

### 4.1 Purchase Management

#### `purchase_requisitions` Table
```sql
CREATE TABLE purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  pr_number VARCHAR(50) UNIQUE NOT NULL,
  pr_date DATE NOT NULL,
  required_by_date DATE,
  department_id UUID NOT NULL REFERENCES departments(id),
  requested_by_id UUID NOT NULL REFERENCES employees(id),
  approved_by_id UUID REFERENCES employees(id),
  approval_date TIMESTAMP,
  status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED') DEFAULT 'DRAFT',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `pr_line_items` Table
```sql
CREATE TABLE pr_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID NOT NULL REFERENCES purchase_requisitions(id),
  line_number INT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_required DECIMAL(12,4) NOT NULL,
  unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  remarks TEXT,
  UNIQUE(pr_id, line_number)
);
```

#### `purchase_orders` Table
```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  payment_terms_id UUID REFERENCES payment_terms(id),
  delivery_date DATE,
  delivery_location_id UUID REFERENCES warehouses(id),
  status ENUM('DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED') DEFAULT 'DRAFT',
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total_amount DECIMAL(15,2),
  currency_code CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(10,4) DEFAULT 1,
  po_reference VARCHAR(50),
  remarks TEXT,
  created_by_id UUID NOT NULL REFERENCES employees(id),
  approved_by_id UUID REFERENCES employees(id),
  approval_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `po_line_items` Table
```sql
CREATE TABLE po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  line_number INT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_ordered DECIMAL(12,4) NOT NULL,
  quantity_received DECIMAL(12,4) DEFAULT 0,
  unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  unit_price DECIMAL(15,4) NOT NULL,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  expected_delivery_date DATE,
  status ENUM('PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED') DEFAULT 'PENDING',
  UNIQUE(po_id, line_number)
);
```

#### `goods_receipts` Table
```sql
CREATE TABLE goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  grn_date DATE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  received_by_id UUID NOT NULL REFERENCES employees(id),
  lr_number VARCHAR(50),
  remarks TEXT,
  is_inspected BOOLEAN DEFAULT FALSE,
  inspection_date TIMESTAMP,
  status ENUM('DRAFT', 'RECEIVED', 'INSPECTED', 'POSTED') DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `grn_line_items` Table
```sql
CREATE TABLE grn_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipts(id),
  po_line_item_id UUID REFERENCES po_line_items(id),
  product_id UUID NOT NULL REFERENCES products(id),
  batch_number VARCHAR(50),
  expiration_date DATE,
  quantity_received DECIMAL(12,4) NOT NULL,
  unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  warehouse_location_id UUID REFERENCES warehouse_locations(id),
  remarks TEXT,
  line_number INT NOT NULL,
  UNIQUE(grn_id, line_number)
);
```

### 4.2 Sales Management

#### `sales_orders` Table
```sql
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  so_number VARCHAR(50) UNIQUE NOT NULL,
  so_date DATE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  billing_address TEXT,
  shipping_address TEXT,
  delivery_date DATE,
  shipping_method VARCHAR(50),
  status ENUM('DRAFT', 'CONFIRMED', 'PARTIAL', 'DELIVERED', 'INVOICED', 'CANCELLED') DEFAULT 'DRAFT',
  subtotal DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total_amount DECIMAL(15,2),
  currency_code CHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(10,4) DEFAULT 1,
  remarks TEXT,
  created_by_id UUID NOT NULL REFERENCES employees(id),
  approved_by_id UUID REFERENCES employees(id),
  approval_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `so_line_items` Table
```sql
CREATE TABLE so_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id UUID NOT NULL REFERENCES sales_orders(id),
  line_number INT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_ordered DECIMAL(12,4) NOT NULL,
  quantity_delivered DECIMAL(12,4) DEFAULT 0,
  unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  unit_price DECIMAL(15,4) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  status ENUM('PENDING', 'PARTIAL', 'DELIVERED', 'CANCELLED') DEFAULT 'PENDING',
  UNIQUE(so_id, line_number)
);
```

#### `deliveries` Table
```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  delivery_number VARCHAR(50) UNIQUE NOT NULL,
  delivery_date DATE NOT NULL,
  so_id UUID REFERENCES sales_orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  delivered_by_id UUID REFERENCES employees(id),
  lr_number VARCHAR(50),
  remarks TEXT,
  status ENUM('DRAFT', 'READY', 'IN_TRANSIT', 'DELIVERED', 'RETURNED') DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `delivery_line_items` Table
```sql
CREATE TABLE delivery_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id),
  so_line_item_id UUID REFERENCES so_line_items(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_delivered DECIMAL(12,4) NOT NULL,
  unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  batch_number VARCHAR(50),
  line_number INT NOT NULL,
  UNIQUE(delivery_id, line_number)
);
```

### 4.3 Direct Sales / POS

#### `direct_sales` Table
```sql
CREATE TABLE direct_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_date TIMESTAMP NOT NULL,
  customer_id UUID REFERENCES customers(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  subtotal DECIMAL(15,2),
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2),
  total_amount DECIMAL(15,2),
  payment_method ENUM('CASH', 'CARD', 'CHEQUE', 'DIGITAL_WALLET', 'CREDIT') DEFAULT 'CASH',
  payment_status ENUM('PENDING', 'COMPLETED', 'PARTIAL') DEFAULT 'PENDING',
  status ENUM('DRAFT', 'COMPLETED', 'CANCELLED') DEFAULT 'DRAFT',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `direct_sale_items` Table
```sql
CREATE TABLE direct_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direct_sale_id UUID NOT NULL REFERENCES direct_sales(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(12,4) NOT NULL,
  unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  unit_price DECIMAL(15,4) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  line_number INT NOT NULL,
  UNIQUE(direct_sale_id, line_number)
);
```

### 4.4 Production Management

#### `bills_of_materials` Table
```sql
CREATE TABLE bills_of_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  finished_product_id UUID NOT NULL REFERENCES products(id),
  version INT DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(finished_product_id, version, effective_from)
);
```

#### `bom_components` Table
```sql
CREATE TABLE bom_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bills_of_materials(id),
  component_product_id UUID NOT NULL REFERENCES products(id),
  quantity_required DECIMAL(12,4) NOT NULL,
  unit_id UUID NOT NULL REFERENCES units_of_measure(id),
  waste_percentage DECIMAL(5,2) DEFAULT 0,
  line_number INT NOT NULL,
  UNIQUE(bom_id, line_number)
);
```

#### `production_orders` Table
```sql
CREATE TABLE production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE NOT NULL,
  finished_product_id UUID NOT NULL REFERENCES products(id),
  quantity_to_produce DECIMAL(12,4) NOT NULL,
  quantity_produced DECIMAL(12,4) DEFAULT 0,
  bom_id UUID NOT NULL REFERENCES bills_of_materials(id),
  warehouse_id UUID REFERENCES warehouses(id),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  status ENUM('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'DRAFT',
  created_by_id UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `production_batches` Table
```sql
CREATE TABLE production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID NOT NULL REFERENCES production_orders(id),
  batch_number VARCHAR(50) NOT NULL,
  manufacturing_date DATE NOT NULL,
  batch_quantity DECIMAL(12,4) NOT NULL,
  quality_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(production_order_id, batch_number)
);
```

### 4.5 Accounting Transactions

#### `chart_of_accounts` Table
```sql
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  account_code VARCHAR(20) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'CONTRA_ASSET') NOT NULL,
  account_subtype VARCHAR(50),
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `journal_entries` Table
```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  journal_number VARCHAR(50) UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  journal_type ENUM('GENERAL', 'SALES', 'PURCHASE', 'BANK', 'PAYROLL') DEFAULT 'GENERAL',
  reference_id UUID,
  reference_type VARCHAR(50),
  posted_date DATE,
  status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED') DEFAULT 'DRAFT',
  notes TEXT,
  created_by_id UUID NOT NULL REFERENCES employees(id),
  approved_by_id UUID REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `journal_line_items` Table
```sql
CREATE TABLE journal_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id),
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  line_number INT NOT NULL,
  cost_center_id UUID REFERENCES cost_centers(id),
  UNIQUE(journal_id, line_number)
);
```

#### `accounts_receivable` Table
```sql
CREATE TABLE accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  invoice_number VARCHAR(50),
  so_id UUID REFERENCES sales_orders(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  amount_received DECIMAL(15,2) DEFAULT 0,
  amount_due DECIMAL(15,2) GENERATED ALWAYS AS (amount - amount_received) STORED,
  status ENUM('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'DISPUTED') DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `accounts_payable` Table
```sql
CREATE TABLE accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  invoice_number VARCHAR(50),
  po_id UUID REFERENCES purchase_orders(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  amount_due DECIMAL(15,2) GENERATED ALWAYS AS (amount - amount_paid) STORED,
  status ENUM('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'DISPUTED') DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Stock Movement & Transactions

#### `stock_movements` Table
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  movement_type ENUM('PURCHASE', 'SALES', 'PRODUCTION', 'TRANSFER', 'ADJUSTMENT', 'WRITE_OFF') NOT NULL,
  quantity_moved DECIMAL(12,4) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  from_location_id UUID REFERENCES warehouse_locations(id),
  to_location_id UUID REFERENCES warehouse_locations(id),
  batch_number VARCHAR(50),
  movement_date TIMESTAMP NOT NULL,
  created_by_id UUID REFERENCES employees(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Audit & Logging Schema

#### `audit_log` Table
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action ENUM('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT') NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Attachment & Documents

#### `attachments` Table
```sql
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type VARCHAR(50),
  uploaded_by_id UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);
```

---

## 8. Notifications & Alerts

#### `notifications` Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type ENUM('INFO', 'WARNING', 'ERROR', 'SUCCESS') DEFAULT 'INFO',
  reference_type VARCHAR(50),
  reference_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);
```

---

## 9. Indexes Strategy

### Critical Indexes for Performance
```sql
-- Lookups by company
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_suppliers_company ON suppliers(company_id);

-- Business transaction searches
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id, po_date DESC);
CREATE INDEX idx_so_customer ON sales_orders(customer_id, so_date DESC);
CREATE INDEX idx_grn_date ON goods_receipts(grn_date DESC);

-- Stock tracking
CREATE INDEX idx_stock_levels_product ON stock_levels(product_id);
CREATE INDEX idx_stock_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX idx_product_batches_expiration ON product_batches(expiration_date);

-- User & security
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Accounting
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date DESC);
CREATE INDEX idx_ar_customer_status ON accounts_receivable(customer_id, status);
CREATE INDEX idx_ap_supplier_status ON accounts_payable(supplier_id, status);

-- Audit trail
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, timestamp DESC);

-- Stock movements
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, movement_date DESC);
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id, movement_date DESC);
```

---

## 10. Constraints & Business Rules

### Data Integrity
- Foreign key constraints on all transactional records
- Unique constraints on business identifiers (SKU, PO#, SO#, etc.)
- Check constraints for numeric ranges (quantities > 0, percentages 0-100)
- Not-null constraints on required fields

### Business Logic Constraints
- Stock cannot go negative (at warehouse level)
- Purchase order quantity must match sum of GRN quantities
- Sales order quantity cannot exceed available inventory
- Invoice amounts must match line item totals
- Journal entry debits must equal credits

---

## 11. Data Archival Strategy

- Transactions older than 7 years → Archive table
- Active data retention: 7 years (regulatory requirement)
- Deleted_at field for soft deletes (GDPR compliance)
- Audit logs retained indefinitely

---

## 12. Backup & Recovery

- **Backup Schedule**: Daily incremental, weekly full
- **Recovery Point Objective (RPO)**: 1 hour
- **Recovery Time Objective (RTO)**: 4 hours
- **Storage**: Off-site encrypted backup

---

**Schema Version**: 1.0  
**Created**: 2026-06-15  
**PostgreSQL Version**: 13+
