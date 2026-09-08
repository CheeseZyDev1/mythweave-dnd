"use client";
import { useEffect,useState } from "react";

type Theme="verdant"|"ember"|"arcane";
type Scale="compact"|"standard"|"large";
type Preference={theme:Theme;scale:Scale;contrast:boolean};
const defaults:Preference={theme:"verdant",scale:"standard",contrast:false};
function apply(value:Preference){const root=document.documentElement;root.dataset.theme=value.theme;root.dataset.scale=value.scale;root.dataset.contrast=String(value.contrast)}

export function ThemeController(){
 const[open,setOpen]=useState(false);const[preference,setPreference]=useState<Preference>(defaults);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("mythweave-theme")??"null")as Partial<Preference>|null;const next={theme:["verdant","ember","arcane"].includes(saved?.theme??"")?saved!.theme!:defaults.theme,scale:["compact","standard","large"].includes(saved?.scale??"")?saved!.scale!:defaults.scale,contrast:Boolean(saved?.contrast)};setPreference(next);apply(next)}catch{apply(defaults)}},[]);
 function update(patch:Partial<Preference>){const next={...preference,...patch};setPreference(next);apply(next);localStorage.setItem("mythweave-theme",JSON.stringify(next))}
 return <aside className={`theme-dock ${open?"open":""}`}><button className="theme-orb" aria-label="เปิดตัวเลือกธีม" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>✦</button>{open&&<section><header><div><small>PERSONAL DISPLAY</small><h2>ปรับบรรยากาศ</h2></div><button aria-label="ปิดตัวเลือกธีม" onClick={()=>setOpen(false)}>×</button></header><label>โทนสี</label><div className="theme-swatches">{(["verdant","ember","arcane"]as Theme[]).map(theme=><button className={preference.theme===theme?"selected":""} data-color={theme} key={theme} onClick={()=>update({theme})}>{theme==="verdant"?"พงไพร":theme==="ember"?"อัคคี":"อาคม"}</button>)}</div><label>ขนาดตัวอักษร</label><div className="theme-scales">{(["compact","standard","large"]as Scale[]).map(scale=><button className={preference.scale===scale?"selected":""} key={scale} onClick={()=>update({scale})}>{scale==="compact"?"เล็ก":scale==="standard"?"ปกติ":"ใหญ่"}</button>)}</div><button className={`contrast-toggle ${preference.contrast?"selected":""}`} onClick={()=>update({contrast:!preference.contrast})}><i/>Contrast สูง · {preference.contrast?"เปิด":"ปิด"}</button><p>การตั้งค่าจะถูกจำไว้ในอุปกรณ์นี้อัตโนมัติ</p></section>}</aside>
}
