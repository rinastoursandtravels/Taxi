-- ============================================================================
-- RLS LOCKDOWN  (Batch 1 / C1)
--
-- Problem this fixes:
--   All data tables shipped with Row Level Security DISABLED. Because the
--   Supabase anon key is public (it is embedded in the browser bundle via
--   NEXT_PUBLIC_SUPABASE_ANON_KEY), anyone could read/write every table
--   directly — all customer bookings, phone numbers, emails and payment rows.
--
-- What this does:
--   * Enables RLS on every data table so the anon/authenticated roles are
--     DENIED by default.
--   * Grants back ONLY the two public reads the browser actually performs
--     with the anon key:
--         - tour_packages : public catalogue (no PII)
--         - reviews       : only rows that are is_visible = true
--
--   Everything else (bookings, payments, payment_records, cars, destinations,
--   destination_car_fares, vehicle_assignments, app_settings, system_events)
--   stays locked to anon/authenticated. All server API routes use the
--   service_role key, which BYPASSES RLS, so nothing on the server breaks.
--
-- Safety:
--   * Idempotent — safe to run more than once.
--   * Never touches, moves or deletes any existing row. RLS controls access,
--     not data. Your current bookings/payments/etc. remain exactly as they are.
--   * `admins` is intentionally left as-is (it already had RLS enabled).
--
-- How to run:
--   Supabase Dashboard → SQL Editor → paste this file → Run.
-- ============================================================================

-- 1) Enable RLS (deny-by-default for anon/authenticated) --------------------
ALTER TABLE public.bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_car_fares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews               ENABLE ROW LEVEL SECURITY;

-- 2) Public read: tour_packages ---------------------------------------------
-- The browser reads the tour catalogue directly with the anon key
-- (fetchAllTours / fetchTourById). Tour rows carry no PII.
DROP POLICY IF EXISTS "public_read_tour_packages" ON public.tour_packages;
CREATE POLICY "public_read_tour_packages"
  ON public.tour_packages
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3) Public read: reviews (visible only) ------------------------------------
-- The browser reads review rating stats directly with the anon key
-- (fetchAllTourRatingStats). Only surface rows the admin has kept visible —
-- this matches the app's own .eq('is_visible', true) filter.
DROP POLICY IF EXISTS "public_read_visible_reviews" ON public.reviews;
CREATE POLICY "public_read_visible_reviews"
  ON public.reviews
  FOR SELECT
  TO anon, authenticated
  USING (is_visible = true);

-- ---------------------------------------------------------------------------
-- Deliberately NO anon/authenticated policies for:
--   bookings, payments, payment_records, cars, destinations,
--   destination_car_fares, vehicle_assignments, app_settings, system_events
-- These are reached only through server API routes on the service_role key,
-- which bypasses RLS. Leaving them policy-less keeps them fully private.
-- ---------------------------------------------------------------------------

-- 4) Verify (optional) — every table below should show rowsecurity = true
--    and only tour_packages + reviews should have a policy for anon.
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
