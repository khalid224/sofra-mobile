-- The earliest place_order_atomic overload accepted a caller-supplied
-- customer id and was executable by anon. All clients now use the verified
-- auth.uid()-based place_order_atomic_v2(jsonb) RPC.

drop function if exists public.place_order_atomic(uuid, text, text, jsonb);
