import{createBrowserClient}from"@supabase/ssr";
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,appUrl=process.env.TEST_APP_URL??"http://127.0.0.1:3212";if(!url||!key)throw new Error("Missing Supabase environment");
const jar=new Map(),supabase=createBrowserClient(url,key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>value?jar.set(name,value):jar.delete(name))}});
const{data,error}=await supabase.auth.signInAnonymously({options:{data:{display_name:"Quick Wanderer"}}});if(error||!data.user?.is_anonymous)throw error??new Error("Anonymous session missing");
const cookie=[...jar].map(([name,value])=>`${name}=${encodeURIComponent(value)}`).join("; ");const response=await fetch(`${appUrl}/lobby`,{headers:{Cookie:cookie}}),html=await response.text();if(!response.ok||!html.includes("Quick Wanderer")||!html.includes("Guest"))throw new Error("Guest lobby did not render");
console.log(JSON.stringify({userId:data.user.id,guestAuth:true,displayName:true,lobby:true}));
