-- ============================================================
-- 0002: First-class receipt tax + split food categories.
--
-- Tax becomes its own thing: a receipts.tax column, folded from
-- legacy tax line items (which were previously stored as ordinary
-- items and polluting the "Other" category). Tax is NOT a spending
-- category — the app displays it separately from category totals.
--
-- "Food & Coffee" splits into:
--   Food — Employee/Volunteer  (meals/drinks for the crew)
--   Food — Coffee Supplies     (coffee, sugar, creamer, cups…)
--   Food — Other               (everything else edible)
--
-- Safe to re-run (add column is IF NOT EXISTS; after the first run
-- there are no tax-named items or "Food & Coffee" rows left).
-- ============================================================

begin;

alter table receipts add column if not exists tax numeric(10,2) not null default 0;

-- Fold legacy tax line items into the receipt-level tax field
with tax_items as (
  select receipt_id, sum(cost)::numeric(10,2) as tax_sum
  from receipt_items
  where item_name ~* 'tax'
  group by receipt_id
)
update receipts r
set tax = tax_items.tax_sum
from tax_items
where tax_items.receipt_id = r.id;

delete from receipt_items where item_name ~* 'tax';

-- Split legacy "Food & Coffee" items by item name
update receipt_items
set category = case
  when item_name ~* '(coff|caffe|creamer|sugar|\bcups?\b|\blids?\b|stirr?ers?|straws?|filters?|decaf|k\-?cups?)' then 'Food — Coffee Supplies'
  when item_name ~* '(meal|burger|pizza|sandwich|snacks?|soda|drinks?|power\s?ade|waters?|donuts?|bagels?|breakfast|lunch|dinner|taco|burrito|chips?)' then 'Food — Employee/Volunteer'
  else 'Food — Other'
end
where category = 'Food & Coffee';

commit;

-- Sanity check (run separately if your client stops at the first result)
select r.id, r.date, r.store, r.tax, coalesce(sum(ri.cost),0) as items_sum
from receipts r left join receipt_items ri on ri.receipt_id = r.id
group by r.id order by r.date;
