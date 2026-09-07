import{redirect}from"next/navigation";import{createClient}from"../supabase/server";
export async function requireSiteAdmin(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth");const{data:isAdmin,error}=await supabase.rpc("is_site_admin");if(error||!isAdmin)redirect("/lobby?error=admin_required");return{supabase,user};}
