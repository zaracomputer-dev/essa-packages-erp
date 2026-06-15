# ESSA ERP API Specification

## Overview

This document defines the RESTful API specification for the ESSA ERP system. All endpoints follow REST conventions with JSON request/response bodies.

**API Version**: 1.0.0  
**Base URL**: `https://api.essa-erp.com/v1`  
**Authentication**: JWT Bearer Token  
**Response Format**: JSON

---

## 1. Authentication & Authorization

### 1.1 Login Endpoint

**POST** `/auth/login`

Request:
```json
{
  "username": "user@company.com",
  "password": "secure_password",
  "mfa_code": "123456" // optional
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600,
    "user": {
      "id": "uuid",
      "username": "user@company.com",
      "first_name": "John",
      "last_name": "Doe",
      "roles": ["sales_manager", "user"],
      "company_id": "uuid"
    }
  }
}
```

### 1.2 Refresh Token

**POST** `/auth/refresh`

Request:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600
  }
}
```

### 1.3 Logout

**POST** `/auth/logout`

Headers: `Authorization: Bearer <token>`

Response (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 2. Common Response Format

All API responses follow this format:

### Success Response (2xx)
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [
    { /* item 1 */ },
    { /* item 2 */ }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "page_size": 20,
    "total_pages": 8,
    "has_next": true,
    "has_previous": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## 3. Inventory Management APIs

### 3.1 Products

#### List Products
**GET** `/inventory/products`

Query Parameters:
- `page=1` (optional, default: 1)
- `page_size=20` (optional, default: 20)
- `category_id=uuid` (optional)
- `search=query` (optional, searches SKU and name)
- `is_active=true` (optional)
- `sort_by=name` (optional)
- `sort_order=asc` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sku": "PKG-001",
      "name": "Cardboard Box 10x10",
      "category": { "id": "uuid", "name": "Packaging" },
      "base_unit": { "id": "uuid", "code": "PC", "name": "Piece" },
      "product_type": "RAW_MATERIAL",
      "is_batch_tracked": true,
      "minimum_stock": 100,
      "reorder_quantity": 500,
      "current_stock": 450,
      "standard_cost": 2.50,
      "is_active": true,
      "created_at": "2026-06-15T10:30:00Z",
      "updated_at": "2026-06-15T10:30:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### Get Product Details
**GET** `/inventory/products/:id`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sku": "PKG-001",
    "name": "Cardboard Box 10x10",
    "description": "Standard cardboard box",
    "category": { "id": "uuid", "name": "Packaging" },
    "base_unit": { "id": "uuid", "code": "PC", "name": "Piece" },
    "product_type": "RAW_MATERIAL",
    "is_serialized": false,
    "is_batch_tracked": true,
    "reorder_quantity": 500,
    "minimum_stock": 100,
    "maximum_stock": 2000,
    "standard_cost": 2.50,
    "stock_by_warehouse": [
      {
        "warehouse_id": "uuid",
        "warehouse_name": "Main Warehouse",
        "quantity_on_hand": 450,
        "quantity_reserved": 50,
        "quantity_available": 400
      }
    ],
    "unit_conversions": [
      {
        "from_unit": "PC",
        "to_unit": "BOX",
        "conversion_factor": 12
      }
    ],
    "is_active": true,
    "created_at": "2026-06-15T10:30:00Z"
  }
}
```

#### Create Product
**POST** `/inventory/products`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "sku": "PKG-002",
  "name": "Plastic Film Roll",
  "description": "Industrial plastic film",
  "category_id": "uuid",
  "base_unit_id": "uuid",
  "product_type": "RAW_MATERIAL",
  "is_batch_tracked": true,
  "minimum_stock": 50,
  "reorder_quantity": 200,
  "maximum_stock": 1000,
  "standard_cost": 5.00
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": { /* Created product object */ }
}
```

#### Update Product
**PUT** `/inventory/products/:id`

Headers: `Authorization: Bearer <token>`

Request: (same fields as create)

Response (200 OK):
```json
{
  "success": true,
  "data": { /* Updated product object */ }
}
```

### 3.2 Warehouses & Stock Levels

#### List Warehouses
**GET** `/inventory/warehouses`

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "WH-01",
      "name": "Main Warehouse",
      "city": "New York",
      "manager": { "id": "uuid", "name": "Manager Name" },
      "is_active": true
    }
  ]
}
```

#### Get Stock Levels
**GET** `/inventory/stock-levels`

Query Parameters:
- `warehouse_id=uuid` (optional)
- `product_id=uuid` (optional)
- `low_stock=true` (optional, shows only items below minimum)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "product_sku": "PKG-001",
      "product_name": "Cardboard Box 10x10",
      "warehouse_id": "uuid",
      "warehouse_name": "Main Warehouse",
      "quantity_on_hand": 450,
      "quantity_reserved": 50,
      "quantity_available": 400,
      "minimum_stock": 100,
      "reorder_quantity": 500,
      "is_below_minimum": false,
      "last_count_date": "2026-06-10T00:00:00Z",
      "updated_at": "2026-06-15T10:30:00Z"
    }
  ]
}
```

#### Get Stock Movement History
**GET** `/inventory/stock-movements/:product_id`

Query Parameters:
- `warehouse_id=uuid` (optional)
- `start_date=2026-06-01` (optional)
- `end_date=2026-06-15` (optional)
- `movement_type=PURCHASE` (optional: PURCHASE, SALES, PRODUCTION, TRANSFER, ADJUSTMENT)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "warehouse_id": "uuid",
      "movement_type": "PURCHASE",
      "quantity_moved": 500,
      "reference_type": "PURCHASE_ORDER",
      "reference_id": "uuid",
      "batch_number": "BATCH-001",
      "movement_date": "2026-06-15T09:00:00Z",
      "created_by": { "id": "uuid", "name": "Employee Name" }
    }
  ]
}
```

### 3.3 Product Batches (Pharmaceutical)

#### Get Batch Details
**GET** `/inventory/batches/:batch_id`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "product_id": "uuid",
    "product_name": "Antibiotic Capsule",
    "batch_number": "BATCH-PHM-001",
    "manufacturer_date": "2026-03-15",
    "expiration_date": "2028-03-15",
    "received_date": "2026-06-01",
    "quantity_received": 10000,
    "quantity_available": 8500,
    "warehouse_id": "uuid",
    "storage_location": "A-01-02-001",
    "status": "ACTIVE",
    "cost_per_unit": 0.15,
    "days_until_expiration": 641,
    "is_near_expiration": false
  }
}
```

#### Get Expiring Batches
**GET** `/inventory/batches/expiring`

Query Parameters:
- `days_threshold=90` (optional, default: 90)
- `warehouse_id=uuid` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "product_name": "Antibiotic Capsule",
      "batch_number": "BATCH-PHM-005",
      "expiration_date": "2026-07-15",
      "days_until_expiration": 30,
      "quantity_available": 2000,
      "warehouse_name": "Pharma Warehouse"
    }
  ]
}
```

---

## 4. Purchase Management APIs

### 4.1 Purchase Orders

#### List Purchase Orders
**GET** `/purchases/purchase-orders`

Query Parameters:
- `status=CONFIRMED` (optional: DRAFT, SENT, CONFIRMED, PARTIAL, RECEIVED, CANCELLED)
- `supplier_id=uuid` (optional)
- `start_date=2026-06-01` (optional)
- `end_date=2026-06-15` (optional)
- `page=1` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "po_number": "PO-2026-001",
      "po_date": "2026-06-15",
      "supplier": { "id": "uuid", "code": "SUP-001", "name": "Supplier Name" },
      "delivery_date": "2026-06-25",
      "status": "CONFIRMED",
      "line_items_count": 5,
      "subtotal": 5000.00,
      "tax_amount": 500.00,
      "total_amount": 5500.00,
      "created_by": { "id": "uuid", "name": "Employee Name" },
      "created_at": "2026-06-15T10:30:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### Get Purchase Order Details
**GET** `/purchases/purchase-orders/:id`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "po_number": "PO-2026-001",
    "po_date": "2026-06-15",
    "supplier": {
      "id": "uuid",
      "code": "SUP-001",
      "name": "Supplier Name",
      "email": "supplier@example.com",
      "phone": "+1234567890"
    },
    "payment_terms": {
      "id": "uuid",
      "name": "Net 30",
      "due_days": 30,
      "discount_days": 5,
      "discount_percentage": 2
    },
    "delivery_location": {
      "id": "uuid",
      "name": "Main Warehouse"
    },
    "status": "CONFIRMED",
    "line_items": [
      {
        "id": "uuid",
        "line_number": 1,
        "product": { "id": "uuid", "sku": "PKG-001", "name": "Cardboard Box" },
        "quantity_ordered": 1000,
        "quantity_received": 500,
        "unit": { "code": "PC", "name": "Piece" },
        "unit_price": 2.50,
        "line_total": 2500.00,
        "status": "PARTIAL"
      }
    ],
    "subtotal": 5000.00,
    "tax_amount": 500.00,
    "total_amount": 5500.00,
    "po_reference": "EXT-REF-001",
    "remarks": "Express delivery needed",
    "created_by": { "id": "uuid", "name": "Employee Name" },
    "created_at": "2026-06-15T10:30:00Z"
  }
}
```

#### Create Purchase Order
**POST** `/purchases/purchase-orders`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "supplier_id": "uuid",
  "po_date": "2026-06-15",
  "delivery_date": "2026-06-25",
  "delivery_location_id": "uuid",
  "payment_terms_id": "uuid",
  "line_items": [
    {
      "product_id": "uuid",
      "quantity_ordered": 1000,
      "unit_id": "uuid",
      "unit_price": 2.50,
      "expected_delivery_date": "2026-06-25"
    }
  ],
  "remarks": "Express delivery needed"
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "po_number": "PO-2026-001",
    "status": "DRAFT",
    /* ... */
  }
}
```

#### Update Purchase Order (DRAFT only)
**PUT** `/purchases/purchase-orders/:id`

Headers: `Authorization: Bearer <token>`

Request: (same fields as create)

Response (200 OK):
```json
{
  "success": true,
  "data": { /* Updated PO object */ }
}
```

#### Approve Purchase Order
**POST** `/purchases/purchase-orders/:id/approve`

Headers: `Authorization: Bearer <token>`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "SENT"
  }
}
```

#### Cancel Purchase Order
**POST** `/purchases/purchase-orders/:id/cancel`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "reason": "Supplier unable to deliver"
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CANCELLED"
  }
}
```

### 4.2 Goods Receipts

#### List Goods Receipts
**GET** `/purchases/goods-receipts`

Query Parameters:
- `status=RECEIVED` (optional: DRAFT, RECEIVED, INSPECTED, POSTED)
- `supplier_id=uuid` (optional)
- `warehouse_id=uuid` (optional)
- `start_date=2026-06-01` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "grn_number": "GRN-2026-001",
      "grn_date": "2026-06-20",
      "po_number": "PO-2026-001",
      "supplier_name": "Supplier Name",
      "warehouse_name": "Main Warehouse",
      "received_by": { "id": "uuid", "name": "Employee Name" },
      "status": "RECEIVED",
      "line_items_count": 5,
      "is_inspected": false,
      "created_at": "2026-06-20T14:00:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### Get Goods Receipt Details
**GET** `/purchases/goods-receipts/:id`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "grn_number": "GRN-2026-001",
    "grn_date": "2026-06-20",
    "po": {
      "id": "uuid",
      "po_number": "PO-2026-001"
    },
    "supplier": {
      "id": "uuid",
      "code": "SUP-001",
      "name": "Supplier Name"
    },
    "warehouse": {
      "id": "uuid",
      "name": "Main Warehouse"
    },
    "received_by": { "id": "uuid", "name": "Employee Name" },
    "line_items": [
      {
        "id": "uuid",
        "product": { "sku": "PKG-001", "name": "Cardboard Box" },
        "batch_number": "BATCH-001",
        "expiration_date": "2028-06-20",
        "quantity_received": 500,
        "unit": { "code": "PC" },
        "warehouse_location": "A-01-02-001"
      }
    ],
    "status": "RECEIVED",
    "is_inspected": false,
    "lr_number": "LR-12345",
    "remarks": "Partial delivery"
  }
}
```

#### Create Goods Receipt
**POST** `/purchases/goods-receipts`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "po_id": "uuid",
  "grn_date": "2026-06-20",
  "warehouse_id": "uuid",
  "lr_number": "LR-12345",
  "line_items": [
    {
      "po_line_item_id": "uuid",
      "quantity_received": 500,
      "batch_number": "BATCH-001",
      "expiration_date": "2028-06-20",
      "warehouse_location_id": "uuid"
    }
  ],
  "remarks": "Partial delivery"
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": { /* Created GRN object */ }
}
```

#### Inspect Goods Receipt
**POST** `/purchases/goods-receipts/:id/inspect`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "quality_status": "APPROVED",
  "remarks": "All items inspected and verified"
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "is_inspected": true,
    "status": "INSPECTED"
  }
}
```

#### Post Goods Receipt
**POST** `/purchases/goods-receipts/:id/post`

Headers: `Authorization: Bearer <token>`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "POSTED",
    "message": "Inventory updated: 500 units added"
  }
}
```

---

## 5. Sales Management APIs

### 5.1 Sales Orders

#### List Sales Orders
**GET** `/sales/sales-orders`

Query Parameters:
- `status=CONFIRMED` (optional: DRAFT, CONFIRMED, PARTIAL, DELIVERED, INVOICED, CANCELLED)
- `customer_id=uuid` (optional)
- `start_date=2026-06-01` (optional)
- `page=1` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "so_number": "SO-2026-001",
      "so_date": "2026-06-15",
      "customer": { "id": "uuid", "code": "CUST-001", "name": "Customer Name" },
      "delivery_date": "2026-06-25",
      "status": "CONFIRMED",
      "line_items_count": 3,
      "subtotal": 3000.00,
      "tax_amount": 300.00,
      "total_amount": 3300.00,
      "created_by": { "id": "uuid", "name": "Sales Manager" },
      "created_at": "2026-06-15T10:30:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

#### Get Sales Order Details
**GET** `/sales/sales-orders/:id`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "so_number": "SO-2026-001",
    "so_date": "2026-06-15",
    "customer": {
      "id": "uuid",
      "code": "CUST-001",
      "name": "Customer Name",
      "email": "customer@example.com"
    },
    "billing_address": "123 Main St",
    "shipping_address": "456 Delivery Ave",
    "delivery_date": "2026-06-25",
    "status": "CONFIRMED",
    "line_items": [
      {
        "id": "uuid",
        "line_number": 1,
        "product": { "id": "uuid", "sku": "PKG-001", "name": "Cardboard Box" },
        "quantity_ordered": 200,
        "quantity_delivered": 0,
        "unit_price": 2.50,
        "discount_percentage": 5,
        "line_total": 475.00,
        "status": "PENDING"
      }
    ],
    "subtotal": 3000.00,
    "tax_amount": 300.00,
    "total_amount": 3300.00,
    "created_by": { "id": "uuid", "name": "Sales Manager" },
    "created_at": "2026-06-15T10:30:00Z"
  }
}
```

#### Create Sales Order
**POST** `/sales/sales-orders`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "customer_id": "uuid",
  "so_date": "2026-06-15",
  "delivery_date": "2026-06-25",
  "billing_address": "123 Main St",
  "shipping_address": "456 Delivery Ave",
  "shipping_method": "EXPRESS",
  "line_items": [
    {
      "product_id": "uuid",
      "quantity_ordered": 200,
      "unit_id": "uuid",
      "unit_price": 2.50,
      "discount_percentage": 5
    }
  ]
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": { /* Created SO object */ }
}
```

#### Confirm Sales Order
**POST** `/sales/sales-orders/:id/confirm`

Headers: `Authorization: Bearer <token>`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CONFIRMED",
    "reserved_inventory": {
      "product_id": "uuid",
      "quantity_reserved": 200
    }
  }
}
```

#### Check Stock Availability
**POST** `/sales/sales-orders/:id/check-availability`

Headers: `Authorization: Bearer <token>`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "all_items_available": true,
    "items": [
      {
        "line_item_id": "uuid",
        "product_sku": "PKG-001",
        "quantity_ordered": 200,
        "quantity_available": 450,
        "is_available": true
      }
    ]
  }
}
```

### 5.2 Deliveries

#### List Deliveries
**GET** `/sales/deliveries`

Query Parameters:
- `status=READY` (optional: DRAFT, READY, IN_TRANSIT, DELIVERED, RETURNED)
- `customer_id=uuid` (optional)
- `warehouse_id=uuid` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "delivery_number": "DLV-2026-001",
      "delivery_date": "2026-06-20",
      "so_number": "SO-2026-001",
      "customer_name": "Customer Name",
      "warehouse_name": "Main Warehouse",
      "status": "READY",
      "line_items_count": 3,
      "created_at": "2026-06-15T10:30:00Z"
    }
  ]
}
```

#### Create Delivery
**POST** `/sales/deliveries`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "so_id": "uuid",
  "delivery_date": "2026-06-20",
  "warehouse_id": "uuid",
  "line_items": [
    {
      "so_line_item_id": "uuid",
      "quantity_delivered": 200,
      "batch_number": "BATCH-001"
    }
  ]
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": { /* Created Delivery object */ }
}
```

#### Mark Delivery as In Transit
**POST** `/sales/deliveries/:id/in-transit`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "vehicle_number": "ABC-123",
  "driver_name": "John Driver",
  "estimated_arrival": "2026-06-20T17:00:00Z"
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_TRANSIT"
  }
}
```

#### Complete Delivery
**POST** `/sales/deliveries/:id/complete`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "delivered_by_id": "uuid",
  "customer_signature": "base64_image",
  "remarks": "Delivered successfully"
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "DELIVERED",
    "inventory_updated": true
  }
}
```

---

## 6. Direct Sales / POS APIs

### 6.1 Direct Sale Transactions

#### Create Direct Sale
**POST** `/pos/direct-sales`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "transaction_date": "2026-06-15T14:30:00Z",
  "customer_id": "uuid", // optional
  "warehouse_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 5,
      "unit_price": 10.00,
      "discount_percentage": 0
    }
  ],
  "payment_method": "CASH",
  "total_amount": 50.00
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "transaction_number": "POS-2026-000001",
    "transaction_date": "2026-06-15T14:30:00Z",
    "items_count": 1,
    "subtotal": 50.00,
    "tax_amount": 0.00,
    "total_amount": 50.00,
    "payment_method": "CASH",
    "status": "COMPLETED",
    "receipt_url": "https://api.essa-erp.com/receipts/uuid"
  }
}
```

#### Get Receipt
**GET** `/pos/direct-sales/:id/receipt`

Response (200 OK - PDF):
```
Binary PDF content with receipt details
```

#### Quick Return
**POST** `/pos/direct-sales/:id/return`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "items": [
    {
      "product_id": "uuid",
      "quantity": 1,
      "reason": "Damaged"
    }
  ]
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "return_transaction_number": "RET-2026-000001",
    "refund_amount": 10.00,
    "refund_method": "ORIGINAL_PAYMENT_METHOD"
  }
}
```

---

## 7. Production Management APIs

### 7.1 Bill of Materials

#### Get BOM
**GET** `/production/bom/:product_id`

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "finished_product": { "sku": "FIN-001", "name": "Finished Product" },
    "version": 1,
    "effective_from": "2026-01-01",
    "components": [
      {
        "id": "uuid",
        "component_product": { "sku": "PKG-001", "name": "Cardboard Box" },
        "quantity_required": 10,
        "unit": { "code": "PC" },
        "waste_percentage": 2,
        "line_number": 1
      }
    ]
  }
}
```

### 7.2 Production Orders

#### List Production Orders
**GET** `/production/production-orders`

Query Parameters:
- `status=IN_PROGRESS` (optional)
- `start_date=2026-06-01` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "po_number": "PROD-2026-001",
      "finished_product": { "sku": "FIN-001", "name": "Product" },
      "quantity_to_produce": 1000,
      "quantity_produced": 500,
      "status": "IN_PROGRESS",
      "planned_start_date": "2026-06-15",
      "planned_end_date": "2026-06-20",
      "actual_start_date": "2026-06-15",
      "created_at": "2026-06-15T10:30:00Z"
    }
  ]
}
```

#### Create Production Order
**POST** `/production/production-orders`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "finished_product_id": "uuid",
  "quantity_to_produce": 1000,
  "bom_id": "uuid",
  "warehouse_id": "uuid",
  "planned_start_date": "2026-06-15",
  "planned_end_date": "2026-06-20"
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "po_number": "PROD-2026-001",
    "status": "DRAFT"
  }
}
```

#### Record Production Batch
**POST** `/production/production-orders/:id/batches`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "batch_number": "BATCH-001",
  "manufacturing_date": "2026-06-15",
  "batch_quantity": 500,
  "quality_status": "APPROVED"
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "batch_number": "BATCH-001",
    "quantity_produced": 500
  }
}
```

---

## 8. Accounting APIs

### 8.1 Chart of Accounts

#### List Chart of Accounts
**GET** `/accounting/chart-of-accounts`

Query Parameters:
- `account_type=ASSET` (optional)
- `is_active=true` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "account_code": "1000",
      "account_name": "Cash",
      "account_type": "ASSET",
      "is_active": true,
      "balance": 50000.00
    }
  ]
}
```

### 8.2 Journal Entries

#### Create Journal Entry
**POST** `/accounting/journal-entries`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "entry_date": "2026-06-15",
  "journal_type": "GENERAL",
  "line_items": [
    {
      "account_id": "uuid",
      "debit_amount": 1000.00,
      "cost_center_id": "uuid"
    },
    {
      "account_id": "uuid",
      "credit_amount": 1000.00
    }
  ],
  "notes": "Monthly rent payment"
}
```

Response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "journal_number": "JE-2026-0001",
    "status": "DRAFT"
  }
}
```

### 8.3 Accounts Receivable

#### Get AR Summary
**GET** `/accounting/accounts-receivable`

Query Parameters:
- `status=OPEN` (optional)
- `customer_id=uuid` (optional)

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "total_receivable": 25000.00,
    "total_received": 15000.00,
    "total_outstanding": 10000.00,
    "overdue_amount": 2000.00,
    "records": [
      {
        "id": "uuid",
        "customer_name": "Customer Name",
        "invoice_number": "INV-001",
        "amount": 5000.00,
        "amount_received": 3000.00,
        "status": "PARTIAL",
        "due_date": "2026-06-20",
        "days_overdue": 0
      }
    ]
  }
}
```

---

## 9. AI Assistant APIs

### 9.1 Chat Interface

#### Send Message
**POST** `/ai/chat`

Headers: `Authorization: Bearer <token>`

Request:
```json
{
  "message": "What is the current stock level of SKU-001?",
  "conversation_id": "uuid", // optional
  "context": {
    "product_id": "uuid", // optional context
    "warehouse_id": "uuid" // optional context
  }
}
```

Response (200 OK):
```json
{
  "success": true,
  "data": {
    "conversation_id": "uuid",
    "response": "The current stock level of SKU-001 (Cardboard Box) is 450 units in the Main Warehouse. This is 350 units below the maximum stock level of 2000 units.",
    "suggested_actions": [
      {
        "action": "CREATE_PURCHASE_ORDER",
        "description": "Create a purchase order for 500 units"
      }
    ],
    "data_references": [
      {
        "type": "product",
        "id": "uuid",
        "name": "SKU-001"
      }
    ]
  }
}
```

### 9.2 Recommendations

#### Get Recommendations
**GET** `/ai/recommendations`

Query Parameters:
- `type=REORDER` (optional: REORDER, PRICING, SUPPLIER, PRODUCTION_SCHEDULE)

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "REORDER",
      "title": "Reorder SKU-001",
      "description": "Stock of Cardboard Box is below minimum threshold",
      "product": { "sku": "SKG-001", "name": "Cardboard Box" },
      "recommended_quantity": 500,
      "recommended_supplier": { "name": "Best Supplier Inc" },
      "estimated_cost": 1250.00,
      "confidence": 95,
      "action_url": "/sales/create-purchase-order?supplier_id=uuid&product_id=uuid"
    }
  ]
}
```

### 9.3 Anomaly Detection

#### Get Alerts
**GET** `/ai/alerts`

Response (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "UNUSUAL_INVENTORY",
      "severity": "WARNING",
      "title": "Unusual inventory spike",
      "description": "Inventory of SKU-005 increased by 300% compared to typical monthly pattern",
      "detected_at": "2026-06-15T14:00:00Z",
      "related_entity": {
        "type": "product",
        "id": "uuid",
        "name": "SKU-005"
      }
    }
  ]
}
```

---

## 10. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_REQUEST | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Authentication failed or missing |
| FORBIDDEN | 403 | User lacks permission for action |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict (duplicate, status mismatch) |
| UNPROCESSABLE_ENTITY | 422 | Business logic validation failed |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

---

## 11. Rate Limiting

- **Rate Limit**: 1000 requests per hour per user
- **Headers**:
  - `X-RateLimit-Limit: 1000`
  - `X-RateLimit-Remaining: 999`
  - `X-RateLimit-Reset: 1623804000`

---

## 12. Versioning

- **Current Version**: v1
- **Deprecation Policy**: 6 months notice before removing endpoints
- **Migration Path**: `/v2` endpoints available 3 months before v1 sunset

---

**API Version**: 1.0.0  
**Last Updated**: 2026-06-15  
**Maintainer**: ESSA Development Team

