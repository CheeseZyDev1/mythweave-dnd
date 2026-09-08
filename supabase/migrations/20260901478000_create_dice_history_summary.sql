create or replace function public.dice_roll_history_summary(target_table_id uuid)returns jsonb language sql security definer set search_path=''stable as $$
 with rolls as(select*from public.dice_rolls where table_id=target_table_id and public.is_dice_table_member(target_table_id)),by_die as(select dice_sides,count(*)as count from rolls group by dice_sides)
 select jsonb_build_object('total',count(*),'average',coalesce(round(avg(r.total)::numeric,1),0),'highest',coalesce(max(r.total),0),'natural20s',count(*)filter(where r.dice_sides=20 and 20=any(r.rolls)),'natural1s',count(*)filter(where r.dice_sides=20 and 1=any(r.rolls)),'byDie',coalesce((select jsonb_object_agg('d'||dice_sides,count)from by_die),'{}'::jsonb))from rolls r;
$$;
revoke all on function public.dice_roll_history_summary(uuid)from public;grant execute on function public.dice_roll_history_summary(uuid)to authenticated;
