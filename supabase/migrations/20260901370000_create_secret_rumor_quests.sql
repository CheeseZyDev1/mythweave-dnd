insert into public.quest_templates(slug,title_th,quest_type,description_th,objective_template,reward_template,weight,tags,active)values
('secret-bell-beneath','ระฆังใต้รากไม้','investigate','ตามเสียงระฆังที่ดังจากใต้รากไม้ของป่ากระซิบ และค้นหาว่าใครกำลังเรียกชื่อผู้ตาย','{"target_count":3}','{"gold":18,"xp":140}',1,array['secret','forest'],false),
('secret-blank-ledger','บัญชีหน้าว่าง','delivery','นำหน้าบัญชีที่มองเห็นตัวอักษรเฉพาะใต้แสงจันทร์ไปส่งยังหอจดหมายเหตุดารา','{"target_count":2}','{"gold":22,"xp":120}',1,array['secret','city'],false),
('secret-salt-crown','มงกุฎเกลือ','hunt','ติดตามราชาโจรสลัดไร้เงาที่ปรากฏเฉพาะยามน้ำลง ณ ชายฝั่ง Azuredeep','{"target_count":4}','{"gold":30,"xp":180}',1,array['secret','coast'],false),
('secret-seventh-lantern','โคมดวงที่เจ็ด','investigate','จุดโคมหกดวงตามลำดับเพื่อเปิดทางไปยังศาลเจ้าที่หายไปจากแผนที่','{"target_count":3}','{"gold":20,"xp":160}',1,array['secret','ruins'],false),
('secret-iron-seed','เมล็ดเหล็ก','gather','รวบรวมเศษเมล็ดโลหะจากรอยแยกและนำไปปลูกในเตาหลอมโบราณ','{"target_count":5}','{"gold":26,"xp":170}',1,array['secret','mountain'],false);

create table public.secret_rumor_chains(
  id bigint generated always as identity primary key,
  slug text not null unique,
  cover_title_th text not null,
  quest_template_id bigint not null unique references public.quest_templates(id),
  active boolean not null default true,
  weight integer not null default 10 check(weight between 1 and 1000)
);
create table public.secret_rumor_clues(
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.secret_rumor_chains(id) on delete cascade,
  sequence_no smallint not null check(sequence_no between 1 and 5),
  source_th text not null,
  clue_th text not null,
  unique(chain_id,sequence_no)
);
create table public.character_rumor_progress(
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chain_id bigint not null references public.secret_rumor_chains(id),
  current_step smallint not null default 0 check(current_step between 0 and 5),
  status text not null default 'investigating' check(status in('investigating','revealed')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revealed_at timestamptz,
  unique(character_id,chain_id)
);
alter table public.secret_rumor_chains enable row level security;
alter table public.secret_rumor_clues enable row level security;
alter table public.character_rumor_progress enable row level security;
create policy "Players can read their rumor progress" on public.character_rumor_progress for select to authenticated using(user_id=auth.uid());

insert into public.secret_rumor_chains(slug,cover_title_th,quest_template_id,weight)
select seed.slug,seed.cover,template.id,seed.weight from(values
('bell-beneath','เสียงจากใต้ผืนดิน',12),('blank-ledger','หมึกที่ไม่มีใครอ่าน',10),('salt-crown','เงาเมื่อน้ำลง',8),('seventh-lantern','แสงที่ขาดหาย',9),('iron-seed','สิ่งที่เติบโตในไฟ',7)
)seed(slug,cover,weight)join public.quest_templates template on template.slug='secret-'||seed.slug;
insert into public.secret_rumor_clues(chain_id,sequence_no,source_th,clue_th)
select chain.id,clue.sequence_no,clue.source_th,clue.clue_th from public.secret_rumor_chains chain join(values
('bell-beneath',1,'คนตัดไม้เมามาย','คืนไร้จันทร์มีเสียงโลหะดังจากใต้ต้นโอ๊กที่ไม่มีเงา'),('bell-beneath',2,'ผู้ดูแลสุสาน','ผู้ที่ได้ยินเสียงสามครั้งจะฝันเห็นบันไดพันรากไม้'),('bell-beneath',3,'เด็กหญิงสวมผ้าคลุมเขียว','ทางลงเปิดเมื่อเรียกชื่อผู้ตายคนสุดท้ายของหมู่บ้าน'),
('blank-ledger',1,'เสมียนตลาด','มีพ่อค้าซื้อสมุดเปล่าด้วยทองทั้งถุง'),('blank-ledger',2,'นักดาราศาสตร์','กระดาษบางชนิดจำแสงดาวได้แม้หมึกจะถูกลบ'),('blank-ledger',3,'คนส่งสารไร้นาม','หน้าที่สิบสามต้องถึงหอจดหมายเหตุก่อนพระจันทร์ดับ'),
('salt-crown',1,'ชาวประมงตาบอด','ยามน้ำลงมีเรือที่ไม่ทิ้งรอยบนทราย'),('salt-crown',2,'แม่ค้าขายเกลือ','เหรียญจากเรือลำนั้นขึ้นสนิมเป็นรูปมงกุฎ'),('salt-crown',3,'กะลาสีชรา','ราชาไร้เงารอผู้ท้าชิงที่เสาหิน Azuredeep'),
('seventh-lantern',1,'พระเดินทาง','โคมหกดวงในซากวิหารไม่เคยดับพร้อมกัน'),('seventh-lantern',2,'ช่างทำเทียน','เปลวไฟต้องเรียงตามสีของรุ่งอรุณ มิใช่ตามตัวเลข'),('seventh-lantern',3,'วิญญาณเฝ้าทาง','เมื่อดวงที่หกสว่าง เงาจะเผยที่วางโคมดวงที่เจ็ด'),
('iron-seed',1,'ช่างตีเหล็กไร้นิ้ว','พบเมล็ดที่หนักกว่าค้อนในรอยแยกภูเขา'),('iron-seed',2,'คนงานเหมือง','มันเต้นตามจังหวะเตาหลอมและกินเศษอาวุธเป็นอาหาร'),('iron-seed',3,'แม่เฒ่าแห่งเตา','ปลูกห้าเมล็ดในไฟสีขาว แล้วรอให้เหล็กผลิดอก')
)clue(slug,sequence_no,source_th,clue_th)on clue.slug=chain.slug;

create or replace function public.character_rumor_journal(target_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' stable as $$
declare result jsonb;
begin
  if not exists(select 1 from public.characters where id=target_character_id and user_id=auth.uid())then raise exception 'character not found';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',progress.id,'cover_title_th',chain.cover_title_th,'current_step',progress.current_step,'total_steps',(select count(*) from public.secret_rumor_clues all_clues where all_clues.chain_id=chain.id),'status',progress.status,'quest_title_th',case when progress.status='revealed' then template.title_th else null end,'quest_id',quest.id,'clues',(select coalesce(jsonb_agg(jsonb_build_object('sequence_no',clue.sequence_no,'source_th',clue.source_th,'clue_th',clue.clue_th)order by clue.sequence_no),'[]'::jsonb)from public.secret_rumor_clues clue where clue.chain_id=chain.id and clue.sequence_no<=progress.current_step),'updated_at',progress.updated_at)order by progress.updated_at desc),'[]'::jsonb)into result
  from public.character_rumor_progress progress join public.secret_rumor_chains chain on chain.id=progress.chain_id join public.quest_templates template on template.id=chain.quest_template_id left join public.character_quests quest on quest.character_id=progress.character_id and quest.template_id=chain.quest_template_id where progress.character_id=target_character_id and progress.user_id=auth.uid();
  return result;
end;$$;

create or replace function public.discover_next_rumor(target_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare hero public.characters%rowtype;chain public.secret_rumor_chains%rowtype;progress public.character_rumor_progress%rowtype;template public.quest_templates%rowtype;total_steps integer;next_step integer;
begin
  select * into hero from public.characters where id=target_character_id and user_id=auth.uid();if hero.id is null then raise exception 'character not found';end if;
  select secret_chain.* into chain from public.character_rumor_progress current_progress join public.secret_rumor_chains secret_chain on secret_chain.id=current_progress.chain_id where current_progress.character_id=hero.id and current_progress.status='investigating' order by current_progress.started_at limit 1 for update of current_progress;
  if chain.id is null then select candidate.* into chain from public.secret_rumor_chains candidate where candidate.active and not exists(select 1 from public.character_rumor_progress seen where seen.character_id=hero.id and seen.chain_id=candidate.id)order by -ln(greatest(random(),0.000001))/candidate.weight limit 1;end if;
  if chain.id is null then raise exception 'all rumors discovered';end if;
  insert into public.character_rumor_progress(character_id,user_id,chain_id,current_step)values(hero.id,auth.uid(),chain.id,0)on conflict(character_id,chain_id)do nothing;
  select * into progress from public.character_rumor_progress where character_id=hero.id and chain_id=chain.id for update;
  select count(*) into total_steps from public.secret_rumor_clues where chain_id=chain.id;next_step:=least(progress.current_step+1,total_steps);
  if next_step>=total_steps then
    update public.character_rumor_progress set current_step=next_step,status='revealed',revealed_at=now(),updated_at=now()where id=progress.id;
    select * into template from public.quest_templates where id=chain.quest_template_id;
    insert into public.character_quests(character_id,user_id,template_id,title_th,description_th,quest_type,target_count,reward_gold,reward_xp)values(hero.id,auth.uid(),template.id,template.title_th,template.description_th,template.quest_type,(template.objective_template->>'target_count')::integer,(template.reward_template->>'gold')::integer,(template.reward_template->>'xp')::integer)on conflict(character_id,template_id)do nothing;
  else update public.character_rumor_progress set current_step=next_step,updated_at=now()where id=progress.id;end if;
  return public.character_rumor_journal(hero.id)->0;
end;$$;
revoke all on function public.character_rumor_journal(uuid) from public;revoke all on function public.discover_next_rumor(uuid) from public;
grant execute on function public.character_rumor_journal(uuid) to authenticated;grant execute on function public.discover_next_rumor(uuid) to authenticated;
