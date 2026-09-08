create or replace function public.vtt_board_state(target_table_id uuid)returns jsonb language plpgsql security definer set search_path=''stable as $$
declare board public.vtt_boards%rowtype;member public.dice_table_members%rowtype;tokens jsonb;fog jsonb;
begin
 select*into member from public.dice_table_members where table_id=target_table_id and user_id=auth.uid();if member.user_id is null then raise exception'room member required';end if;
 select*into board from public.vtt_boards where table_id=target_table_id;if board.table_id is null then return jsonb_build_object('board',null,'tokens','[]'::jsonb,'fog','[]'::jsonb,'viewer_role',member.role,'viewer_character_id',member.character_id);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',token.id,'character_id',token.character_id,'owner_user_id',token.owner_user_id,'label',token.label,'x',token.x,'y',token.y,'color',token.color,'visible',token.visible,'is_own',token.owner_user_id=auth.uid(),'race',hero.race,'character_class',hero.character_class,'appearance',hero.appearance)order by token.label),'[]'::jsonb)into tokens from public.vtt_tokens token left join public.characters hero on hero.id=token.character_id where token.table_id=target_table_id;
 select coalesce(jsonb_agg(jsonb_build_object('cell_x',cell_x,'cell_y',cell_y,'revealed',revealed)),'[]'::jsonb)into fog from public.vtt_fog_cells where table_id=target_table_id;
 return jsonb_build_object('board',to_jsonb(board),'tokens',tokens,'fog',fog,'viewer_role',member.role,'viewer_character_id',member.character_id);
end;$$;
