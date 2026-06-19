# Database Schema - Rina's Tours and Travels (RT&T)

Supabase (PostgreSQL). Run each file in Supabase SQL Editor in the order below.

## Execution Order

| # | File | Tables Created | Notes |
|---|------|----------------|-------|
| 1 | `cars_schema.sql` | `cars` | Vehicle fleet and driver profile data. |
| 2 | `destinations_schema.sql` | `destinations` | Taxi destinations with `estimated_duration_minutes`. |
| 3 | `destination_car_fares_schema.sql` | `destination_car_fares` | Fixed taxi fare per destination and car model. |
| 4 | `tour_packages.sql` | `tour_packages` | Tour catalogue with package-level fixed price. |
| 5 | `bookings_and_payments_schema.sql` | `bookings`, `payments`, `payment_records` | Core booking and payment tables. |
| 6 | `assignments_schema.sql` | `vehicle_assignments` | Vehicle assignment windows and overlap guards. |
| 7 | `admin_schema.sql` | `admins` | Admin accounts and auth policy. |
| 8 | `reviews_schema.sql` | `reviews` | Tour/taxi review data. |
| 9 | `app_settings_schema.sql` | `app_settings` | Feature and runtime flags. |
| 10 | `system_events_schema.sql` | `system_events` | Sanitized operational log events. |
| 11 | `seed_system_logs_setting.sql` | - | Seeds `app_settings.system_logs_max_rows` if missing. |
| 12 | `cleanup_demo_payment_data.sql` | - | Optional cleanup for demo payment rows. |
| 13 | `payment_integrity.sql` | - | **Required.** Idempotent. Adds the `record_online_payment()` RPC (atomic record-payment + confirm-booking) and a partial unique index on `payment_records.txn_id`. Run after #5. Re-runnable (`CREATE OR REPLACE` / `IF NOT EXISTS`). |

## Booking Types

| booking_type | Key Reference | Pricing Source |
|--------------|---------------|----------------|
| `taxi` | `destination_id` -> `destinations` | `destination_car_fares.fixed_fare` by `(destination_id, model_name)` |
| `tour` | `tour_package_id` -> `tour_packages` | `tour_packages.price` |

## Core Relationships

```
cars ------------------------------ vehicle_assignments
                                      |
bookings --------------------------- vehicle_assignments
   |
   +-- destination_id -> destinations (taxi)
   +-- tour_package_id -> tour_packages (tour)
   +-- payments -> payment_records

destinations ---------------------- destination_car_fares
cars (model_name) ---------------- destination_car_fares (model_name)
```
