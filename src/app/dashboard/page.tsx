import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Dashboard } from "@/components/dashboard";

export default async function DashboardPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const {data:memberships}=await supabase.from("company_members").select("company_id, role, companies(id, name, currency)").eq("user_id",user.id).eq("status","active");const companies=(memberships??[]).map((m:any)=>({id:m.company_id,name:m.companies?.name??"Company",currency:m.companies?.currency??"INR",role:m.role}));return <AppShell userEmail={user.email??""} companies={companies}><Dashboard companies={companies}/></AppShell>; }
