import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import type { Appearance } from "../../../../../lib/characters/catalog";

type Context={params:Promise<{id:string}>};
const MAX_BYTES=5*1024*1024;

function detectImage(bytes:Uint8Array){
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return{extension:"jpg",contentType:"image/jpeg"};
  if(bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return{extension:"png",contentType:"image/png"};
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return{extension:"webp",contentType:"image/webp"};
  return null;
}

export async function POST(request:Request,context:Context){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
  const{id}=await context.params;
  const{data:character}=await supabase.from("characters").select("appearance").eq("id",id).eq("user_id",user.id).maybeSingle();
  if(!character)return NextResponse.json({error:"not_found"},{status:404});
  const form=await request.formData().catch(()=>null);const file=form?.get("portrait");
  if(!(file instanceof File)||file.size===0)return NextResponse.json({error:"invalid_image"},{status:400});
  if(file.size>MAX_BYTES)return NextResponse.json({error:"file_too_large"},{status:413});
  const buffer=await file.arrayBuffer();const detected=detectImage(new Uint8Array(buffer));
  if(!detected)return NextResponse.json({error:"invalid_image"},{status:415});
  const path=`${user.id}/${id}/${crypto.randomUUID()}.${detected.extension}`;
  const{error:uploadError}=await supabase.storage.from("character-portraits").upload(path,buffer,{contentType:detected.contentType,cacheControl:"31536000",upsert:false});
  if(uploadError)return NextResponse.json({error:"upload_failed"},{status:500});
  const appearance=(character.appearance??{})as Appearance;const oldPath=appearance.customPortraitPath;
  const{error:updateError}=await supabase.from("characters").update({appearance:{...appearance,customPortraitPath:path},portrait_version:3}).eq("id",id).eq("user_id",user.id);
  if(updateError){await supabase.storage.from("character-portraits").remove([path]);return NextResponse.json({error:"save_failed"},{status:500})}
  if(oldPath?.startsWith(`${user.id}/${id}/`))await supabase.storage.from("character-portraits").remove([oldPath]);
  return NextResponse.json({path});
}

export async function DELETE(_:Request,context:Context){
  const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
  const{id}=await context.params;
  const{data:character}=await supabase.from("characters").select("appearance").eq("id",id).eq("user_id",user.id).maybeSingle();
  if(!character)return NextResponse.json({error:"not_found"},{status:404});
  const appearance=(character.appearance??{})as Appearance;const oldPath=appearance.customPortraitPath;
  const{customPortraitPath:removedPath,...generated}=appearance;
  const{error}=await supabase.from("characters").update({appearance:generated,portrait_version:2}).eq("id",id).eq("user_id",user.id);
  if(error)return NextResponse.json({error:"save_failed"},{status:500});
  if(oldPath?.startsWith(`${user.id}/${id}/`))await supabase.storage.from("character-portraits").remove([oldPath]);
  return NextResponse.json({removed:true});
}
