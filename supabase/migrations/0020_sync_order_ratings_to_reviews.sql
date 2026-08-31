-- ============================================================
-- 0020_sync_order_ratings_to_reviews.sql
-- Sync customer order_ratings to public.reviews for Admin Moderation
-- ============================================================

-- 1. Ensure RLS policies on public.reviews allow Admin full access
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select" ON public.reviews
  FOR SELECT USING (status = 'approved' OR auth.uid() = customer_id OR public.is_admin());

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id OR public.is_admin());

DROP POLICY IF EXISTS "reviews_admin_update" ON public.reviews;
CREATE POLICY "reviews_admin_update" ON public.reviews
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "reviews_admin_delete" ON public.reviews;
CREATE POLICY "reviews_admin_delete" ON public.reviews
  FOR DELETE USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

-- 2. Function & Trigger: Sync order_ratings inserts/updates into public.reviews
CREATE OR REPLACE FUNCTION public.sync_order_rating_to_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  -- For each meal in the order, create or update a review entry
  FOR v_item IN
    SELECT DISTINCT meal_id
    FROM public.order_items
    WHERE order_id = NEW.order_id
      AND meal_id IS NOT NULL
  LOOP
    INSERT INTO public.reviews (
      order_id,
      customer_id,
      meal_id,
      rating,
      comment,
      status,
      created_at,
      updated_at
    ) VALUES (
      NEW.order_id,
      NEW.customer_id,
      v_item.meal_id,
      COALESCE(NEW.food_rating, NEW.overall_rating, 5),
      NEW.comment,
      'pending', -- Pending Admin Moderation
      NEW.created_at,
      now()
    )
    ON CONFLICT (order_id, meal_id) DO UPDATE SET
      rating = EXCLUDED.rating,
      comment = EXCLUDED.comment,
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_rating ON public.order_ratings;
CREATE TRIGGER trg_sync_order_rating
  AFTER INSERT OR UPDATE ON public.order_ratings
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_rating_to_reviews();

-- 3. Backfill existing order_ratings into reviews table
INSERT INTO public.reviews (
  order_id,
  customer_id,
  meal_id,
  rating,
  comment,
  status,
  created_at,
  updated_at
)
SELECT DISTINCT ON (r.order_id, oi.meal_id)
  r.order_id,
  r.customer_id,
  oi.meal_id,
  COALESCE(r.food_rating, r.overall_rating, 5),
  r.comment,
  'pending',
  r.created_at,
  now()
FROM public.order_ratings r
JOIN public.order_items oi ON oi.order_id = r.order_id
WHERE oi.meal_id IS NOT NULL
ON CONFLICT (order_id, meal_id) DO NOTHING;
