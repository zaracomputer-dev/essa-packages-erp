# Eissa Packages ERP Supabase Migration Report

Date: 2026-06-02

## Production Issue Fixed

The ERP could still be opened with the old local `admin / 1234` login. That allowed each computer to keep its own local browser data, so products, invoices and dashboard totals could differ between Computer A and Computer B.

The application has now been changed to cloud-first production mode:

- Supabase email/password login is required when Supabase is configured.
- The old local-only login is blocked in production.
- Startup pulls live Supabase tables before the ERP is used.
- Local storage is now only an offline cache, not the source of truth.
- Every save schedules an immediate Supabase sync.
- Realtime table subscriptions reload shared data from Supabase.

## What Was Stored Locally Before

These ERP records were held in browser `localStorage` as the working source:

- Products
- Customers
- Suppliers
- Sales invoices
- Purchase invoices
- Customer and supplier ledger entries
- Journal entries / Roznamcha
- Inventory movements
- Dashboard/report totals derived from local records
- Quotations
- Dispatch records
- Production records
- Staff and salary records
- Bank records
- Settings and audit logs

## What Was Migrated / Synced To Supabase

Primary normalized Supabase tables now receive the core operational ERP data:

- `erp_products`
- `erp_customers`
- `erp_suppliers`
- `erp_sales_invoices`
- `erp_purchase_invoices`
- `erp_entries`
- `erp_journal_entries`
- `erp_inventory_movements`

The app also keeps `erp_state` as a full cloud snapshot for compatibility and secondary modules:

- Quotations
- Dispatch records
- Production records
- Staff and salary records
- Bank records
- Settings
- Audit logs
- Legacy invoice records

## Modules Now Using Supabase

- Products: saved to and loaded from `erp_products`
- Customers: saved to and loaded from `erp_customers`
- Suppliers: saved to and loaded from `erp_suppliers`
- Sales invoices: saved to and loaded from `erp_sales_invoices`
- Purchase invoices: saved to and loaded from `erp_purchase_invoices`
- Ledgers / entries: saved to and loaded from `erp_entries`
- Roznamcha / journal entries: saved to and loaded from `erp_journal_entries`
- Inventory movement ledger: saved to and loaded from `erp_inventory_movements`
- Dashboard totals: calculated from Supabase-loaded ERP state after login
- Reports: calculated from Supabase-loaded ERP state after login

## Validation Scenario

Expected production behavior after deploying the new ZIP:

1. Login on Computer A with the Supabase email/password.
2. Login on Computer B with the same Supabase email/password.
3. Create a product on Computer A.
4. Refresh Computer B.
5. The product appears on Computer B.
6. Create an invoice on Computer B.
7. Refresh Computer A.
8. The invoice appears on Computer A.

## Important Operating Rule

Every computer must use the same Supabase authenticated user account, or accounts that share the same database access policy. If different Supabase users are used, Row Level Security keeps their ERP rows separate.
