
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { CustomersWorkspace } from "@/components/customers-workspace";

export const dynamic = "force-dynamic";

type MembershipRow = {
  company_id: string;
  role: string;
  status: string;
  companies:
    | {
        id: string;
        name: string;
        currency: string | null;
      }
    | {
        id: string;
        name: string;
        currency: string | null;
      }[]
    | null;
};

export default async function CustomersPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const {
    data: membershipData,
    error: membershipError,
  } = await supabase
    .from("company_members")
    .select("company_id, role, status, companies(id, name, currency)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    console.error(
      "Unable to load company memberships:",
      membershipError.message
    );
  }

  const memberships = (membershipData ?? []) as unknown as MembershipRow[];

  const companies = memberships.map((membership) => {
    const company = Array.isArray(membership.companies)
      ? membership.companies[0]
      : membership.companies;

    return {
      id: membership.company_id,
      name: company?.name ?? "Company",
      currency: company?.currency ?? "INR",
      role: membership.role,
    };
  });

  return (
    <AppShell userEmail={user.email ?? ""} companies={companies}>
      {membershipError ? (
        <div className="content">
          <div className="notice" role="alert">
            Unable to load company memberships. Please refresh the page.
          </div>
        </div>
      ) : (
        <CustomersWorkspace companies={companies} />
      )}
    </AppShell>
  );
}
