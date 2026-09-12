import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import type { DiceRoll } from "../../lib/dice/types";
import type {
  InitiativeEntry,
  InitiativeTracker,
} from "../../lib/initiative/types";
import type { RoomMessage } from "../../lib/chat/types";
import type { RoomSave } from "../../lib/room-saves/types";
import type { NpcDialogue } from "../../lib/npc/types";
import type { DmNarration } from "../../lib/dm/types";
import type { GeneratedMonster } from "../../lib/monsters/types";
import { DiceTable } from "./dice-table";
import type{MessengerDispatch}from"./party-awareness";
import type { RoomHomunculus, RoomHomunculusCommand } from "./homunculus-room-panel";
import type{WorldBoss,WorldBossContribution}from"../../lib/combat/world-boss";
import type{CharacterSkill,SkillUse}from"../../lib/skills/types";
import type{Appearance}from"../../lib/characters/catalog";
import type{Fighter}from"./battle-stage";

export const metadata: Metadata = { title: "Realtime Dice — Mythweave" };

type Props = { searchParams: Promise<{ table?: string }> };
type BattleMemberRow={user_id:string;display_name:string;role:string;character_id:string|null;character_name:string|null;race:string|null;character_class:string|null;appearance:Appearance|null;hp_current:number|null;hp_max:number|null};

export default async function DicePage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const[{data:activeSolo},{data:ownedCharacters},{data:activeBoss}]=await Promise.all([
    supabase.from("solo_adventures").select("character_id").eq("status","active").maybeSingle(),
    supabase.from("characters").select("id,name").order("created_at",{ascending:false}),
    supabase.from("world_bosses").select("*").eq("status","active").order("starts_at",{ascending:false}).limit(1).maybeSingle(),
  ]);
  let ghostMode=false;
  if(activeSolo){const{data:life}=await supabase.from("solo_life_states").select("status").eq("character_id",activeSolo.character_id).maybeSingle();ghostMode=life?.status==="dead";if(!ghostMode)redirect(`/solo?character=${activeSolo.character_id}`);}

  const { table: tableId } = await searchParams;
  let table: { id: string; code: string } | null = null;
  let rolls: DiceRoll[] = [];
  let members:Fighter[] = [];
  let awareness:{user_id:string;display_name:string;role:string;character_id:string|null;character_name:string|null;location_id:number|null;location_name:string|null;awareness_tier:string}[]=[];
  let messengerBirds=0;let messengerDispatches:MessengerDispatch[]=[];
  let initiativeEntries: InitiativeEntry[] = [];
  let initiativeTracker: InitiativeTracker | null = null;
  let messages: RoomMessage[] = [];
  let saves: RoomSave[] = [];
  let npcHistory: NpcDialogue[] = [];
  let narrations: DmNarration[] = [];
  let monsters: GeneratedMonster[] = [];
  let companions: RoomHomunculus[] = [];
  let companionCommands: RoomHomunculusCommand[] = [];
  let characterSkills:CharacterSkill[]=[];let skillUses:SkillUse[]=[];
  let hasSessionRecaps=false;
  const worldBoss=(activeBoss as WorldBoss|null)??null;let worldBossContributions:WorldBossContribution[]=[];
  if (tableId) {
    const { data } = await supabase
      .from("dice_tables")
      .select("id,code")
      .eq("id", tableId)
      .maybeSingle();
    table = data;
    if (table) {
      const [
        { data: rollData },
        { data: memberData },
        { data: entryData },
        { data: trackerData },
        { data: messageData },
        { data: saveData },
        { data: npcData },
        { data: narrationData },
        { data: monsterData },{data:companionData},{data:companionCommandData},{data:skillUseData},{count:recapCount},
      ] = await Promise.all([
        supabase
          .from("dice_rolls")
          .select("*")
          .eq("table_id", table.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.rpc("get_room_battle_members",{target_table_id:table.id}),
        supabase
          .from("initiative_entries")
          .select("*")
          .eq("table_id", table.id)
          .order("initiative", { ascending: false }),
        supabase
          .from("initiative_trackers")
          .select("*")
          .eq("table_id", table.id)
          .maybeSingle(),
        supabase
          .from("room_messages")
          .select("*")
          .eq("table_id", table.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("room_saves").select("id,table_id,slot,save_name,entry_count,round_number,created_by,created_at,updated_at").eq("table_id", table.id).order("slot"),
        supabase.from("npc_dialogue_history").select("*").eq("table_id",table.id).order("created_at",{ascending:false}).limit(20),
        supabase.from("dm_narrations").select("*").eq("table_id",table.id).order("created_at",{ascending:false}).limit(10),
        supabase.from("generated_monsters").select("*").eq("table_id",table.id).order("created_at",{ascending:false}).limit(12),
        supabase.from("homunculus_companions").select("id,user_id,character_id,name,stance,hp_current,hp_max,guard_points,active_table_id").eq("active_table_id",table.id),
        supabase.from("homunculus_commands").select("id,companion_id,command,response_th,created_at").eq("table_id",table.id).order("created_at",{ascending:false}).limit(20),
        supabase.from("skill_uses").select("*").eq("table_id",table.id).order("created_at",{ascending:false}).limit(20),
        supabase.from("session_recaps").select("id",{count:"exact",head:true}).eq("table_id",table.id),
      ]);
      rolls = (rollData ?? []).reverse() as DiceRoll[];
      members = ((memberData??[])as BattleMemberRow[]).map(member=>({user_id:member.user_id,display_name:member.display_name,role:member.role,character_id:member.character_id,character:member.character_id?{name:member.character_name??member.display_name,race:member.race??"human",character_class:member.character_class??"fighter",appearance:member.appearance??{}as Appearance,hp_current:member.hp_current??0,hp_max:member.hp_max??1}:null}));
      const ownCharacterId=members.find(member=>member.user_id===user.id)?.character_id;
      if(ownCharacterId){const[{data:awarenessData},{data:birdStack},{data:dispatchData},{data:skillData}]=await Promise.all([supabase.rpc("get_party_awareness",{target_table_id:table.id,viewer_character_id:ownCharacterId}),supabase.from("character_item_stacks").select("quantity,content_items!inner(slug)").eq("character_id",ownCharacterId).eq("content_items.slug","messenger-raven").maybeSingle(),supabase.from("messenger_dispatches").select("*").eq("table_id",table.id).order("created_at",{ascending:false}).limit(12),supabase.rpc("get_character_room_skills",{target_table_id:table.id,target_character_id:ownCharacterId})]);awareness=awarenessData??[];messengerBirds=birdStack?.quantity??0;messengerDispatches=(dispatchData??[])as MessengerDispatch[];characterSkills=(skillData??[])as CharacterSkill[];}
      initiativeEntries = (entryData ?? []) as InitiativeEntry[];
      initiativeTracker = trackerData as InitiativeTracker | null;
      messages = ((messageData ?? []) as RoomMessage[]).reverse();
      saves = (saveData ?? []) as RoomSave[];
      npcHistory = ((npcData ?? []) as NpcDialogue[]).reverse();
      narrations = ((narrationData ?? []) as DmNarration[]).reverse();
      monsters = (monsterData ?? []) as GeneratedMonster[];
      companions=(companionData??[])as RoomHomunculus[];companionCommands=(companionCommandData??[])as RoomHomunculusCommand[];
      skillUses=((skillUseData??[])as SkillUse[]).reverse();
      hasSessionRecaps=(recapCount??0)>0;
      if(worldBoss){const{data:contributionData}=await supabase.from("world_boss_contributions").select("*").eq("boss_id",worldBoss.id).eq("table_id",table.id).order("created_at",{ascending:false}).limit(12);worldBossContributions=(contributionData??[])as WorldBossContribution[];}
    }
  }

  return (
    <DiceTable
      initialTable={table}
      initialRolls={rolls}
      members={members}
      currentUserId={user.id}
      invalidTable={Boolean(tableId && !table)}
      initialInitiativeEntries={initiativeEntries}
      initialInitiativeTracker={initiativeTracker}
      initialMessages={messages}
      initialSaves={saves}
      initialNpcHistory={npcHistory}
      initialNarrations={narrations}
      initialMonsters={monsters}
      initialCompanions={companions}
      initialCompanionCommands={companionCommands}
      ghostMode={ghostMode}
      characters={ownedCharacters??[]}
      initialAwareness={awareness}
      initialMessengerBirds={messengerBirds}
      initialMessengerDispatches={messengerDispatches}
      initialWorldBoss={worldBoss}
      initialWorldBossContributions={worldBossContributions}
      initialSkills={characterSkills}
      initialSkillUses={skillUses}
      hasSessionRecaps={hasSessionRecaps}
    />
  );
}
