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

export const metadata: Metadata = { title: "Realtime Dice — Mythweave" };

type Props = { searchParams: Promise<{ table?: string }> };

export default async function DicePage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const{data:activeSolo}=await supabase.from("solo_adventures").select("character_id").eq("status","active").maybeSingle();
  let ghostMode=false;
  if(activeSolo){const{data:life}=await supabase.from("solo_life_states").select("status").eq("character_id",activeSolo.character_id).maybeSingle();ghostMode=life?.status==="dead";if(!ghostMode)redirect(`/solo?character=${activeSolo.character_id}`);}
  const{data:ownedCharacters}=await supabase.from("characters").select("id,name").order("created_at",{ascending:false});

  const { table: tableId } = await searchParams;
  let table: { id: string; code: string } | null = null;
  let rolls: DiceRoll[] = [];
  let members: { user_id: string; display_name: string; role: string;character_id:string|null }[] = [];
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
        { data: monsterData },{data:companionData},{data:companionCommandData},
      ] = await Promise.all([
        supabase
          .from("dice_rolls")
          .select("*")
          .eq("table_id", table.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("dice_table_members")
          .select("user_id,display_name,role,character_id")
          .eq("table_id", table.id)
          .order("joined_at"),
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
      ]);
      rolls = (rollData ?? []).reverse() as DiceRoll[];
      members = memberData ?? [];
      const ownCharacterId=members.find(member=>member.user_id===user.id)?.character_id;
      if(ownCharacterId){const[{data:awarenessData},{data:birdStack},{data:dispatchData}]=await Promise.all([supabase.rpc("get_party_awareness",{target_table_id:table.id,viewer_character_id:ownCharacterId}),supabase.from("character_item_stacks").select("quantity,content_items!inner(slug)").eq("character_id",ownCharacterId).eq("content_items.slug","messenger-raven").maybeSingle(),supabase.from("messenger_dispatches").select("*").eq("table_id",table.id).order("created_at",{ascending:false}).limit(12)]);awareness=awarenessData??[];messengerBirds=birdStack?.quantity??0;messengerDispatches=(dispatchData??[])as MessengerDispatch[];}
      initiativeEntries = (entryData ?? []) as InitiativeEntry[];
      initiativeTracker = trackerData as InitiativeTracker | null;
      messages = ((messageData ?? []) as RoomMessage[]).reverse();
      saves = (saveData ?? []) as RoomSave[];
      npcHistory = ((npcData ?? []) as NpcDialogue[]).reverse();
      narrations = ((narrationData ?? []) as DmNarration[]).reverse();
      monsters = (monsterData ?? []) as GeneratedMonster[];
      companions=(companionData??[])as RoomHomunculus[];companionCommands=(companionCommandData??[])as RoomHomunculusCommand[];
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
    />
  );
}
