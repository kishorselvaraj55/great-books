"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
export function SignOutButton(){const [busy,setBusy]=useState(false);const router=useRouter();async function signOut(){setBusy(true);const supabase=createClient();await supabase.auth.signOut();router.replace("/login");router.refresh();}return <button className="nav-link" onClick={signOut} disabled={busy} style={{width:"100%",border:0,background:"transparent",textAlign:"left"}}><LogOut size={16}/>{busy?"Signing out…":"Log out"}</button>}
