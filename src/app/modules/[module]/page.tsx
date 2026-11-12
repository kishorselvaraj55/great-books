
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

import { ItemsWorkspace } from "@/components/items-workspace";
import SalesWorkspace from "@/components/sales-workspace";
import { CustomersWorkspace } from "@/components/customers-workspace";
import { EmployeesWorkspace } from "@/components/employees-workspace";
import AttendanceWorkspace from "@/components/attendance-workspace-fixed";
import PurchaseWorkspace from "@/components/purchase-workspace";
import { DebtorsWorkspace } from "@/components/debtors-workspace";
import CreditorsWorkspace from "@/components/creditors-workspace";
import DocumentsWorkspace from "@/components/documents-workspace";
import InviteUsersWorkspace from "@/components/invite-users-workspace";
import { SettingsWorkspace } from "@/components/settings-workspace";
import ReportsWorkspace from "@/components/reports-workspace";

import { moduleDetails } from "@/lib/modules";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ module: string }>;
};

const roleModuleAccess: Record<string, string[]> = {
  staff: ["sales", "purchase", "customers", "items"],
  manager: [
    "sales",
    "purchase",
    "customers",
    "items",
    "employees",
    "attendance",
  ],
  admin: ["*"],
  owner: ["*"],
};

function roleCanAccessModule(role: string, module: string) {
  const allowed = roleModuleAccess[String(role ?? "").toLowerCase()] ?? [];
  return allowed.includes("*") || allowed.includes(module);
}

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

export default async function ModulePage({ params }: PageProps) {
  const { module } = await params;

  const details = moduleDetails[module];

  if (!details) {
    notFound();
  }

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
      "Failed to load company memberships:",
      membershipError.message
    );
  }

  const memberships = (membershipData ?? []) as unknown as MembershipRow[];

  const companies = memberships.map((membership) => {
    const relatedCompany = Array.isArray(membership.companies)
      ? membership.companies[0]
      : membership.companies;

    return {
      id: membership.company_id,
      name: relatedCompany?.name ?? "Company",
      currency: relatedCompany?.currency ?? "INR",
      role: membership.role,
    };
  });

  const accessibleCompanies = companies.filter((company) =>
    roleCanAccessModule(company.role, module)
  );

  if (accessibleCompanies.length === 0) {
    redirect("/dashboard");
  }

  const userEmail = user.email ?? "";

  // ITEMS MODULE
  if (module === "items") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <ItemsWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // SALES MODULE
  if (module === "sales") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <SalesWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // CUSTOMERS MODULE
  if (module === "customers") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <CustomersWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // EMPLOYEES MODULE
  if (module === "employees") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <EmployeesWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // ATTENDANCE AND SALARY MODULE
  if (module === "attendance") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <AttendanceWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // PURCHASE MANAGEMENT MODULE
  if (module === "purchase") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <PurchaseWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // DEBTORS MANAGEMENT MODULE
  if (module === "debtors") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <DebtorsWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // CREDITORS MANAGEMENT MODULE
  if (module === "creditors") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <CreditorsWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // DOCUMENT MANAGEMENT MODULE
  if (module === "documents") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <DocumentsWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // INVITE USERS MODULE
  if (module === "users") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <InviteUsersWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // REPORTS AND EXPORTS MODULE
  if (module === "reports") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <ReportsWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // SETTINGS MODULE
  if (module === "settings") {
    return (
      <AppShell userEmail={userEmail} companies={accessibleCompanies}>
        <SettingsWorkspace companies={accessibleCompanies} />
      </AppShell>
    );
  }

  // OTHER MODULES - PLACEHOLDER
  const Icon = details.icon;

  return (
    <AppShell userEmail={userEmail} companies={accessibleCompanies}>
      <div className="content">
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/dashboard"
            className="small-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
        </div>

        <div className="page-heading">
          <div>
            <div className="eyebrow">GREAT BOOKS WORKSPACE</div>
            <h1>{details.title}</h1>
            <p>{details.description}</p>
          </div>

          <button
            className="btn btn-primary"
            disabled
            title="This module's data-entry workflow is not implemented yet."
          >
            + New record
          </button>
        </div>

        {membershipError && (
          <div className="notice" role="alert">
            Unable to load company memberships. Please refresh the page or
            contact your administrator if the problem continues.
          </div>
        )}

        {accessibleCompanies.length === 0 && (
          <div className="notice">
            <strong>Company setup required.</strong> Your user must be linked
            to an active company before this module can access company records.
          </div>
        )}

        <div className="module-grid">
          {details.features.map((feature, index) => (
            <div className="module-card" key={feature}>
              <div className="module-icon">
                {index === 0 ? (
                  <Icon size={20} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
              </div>

              <h3>{feature}</h3>

              <p>
                {module} workspace capability. The production data-entry
                workflow and reports will be connected in a future
                implementation step.
              </p>

              <div className="module-meta">
                <CircleDashed
                  size={12}
                  style={{
                    display: "inline",
                    verticalAlign: "middle",
                    marginRight: 5,
                  }}
                />
                Planned module capability
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-heading">
            <div>
              <h2>Records</h2>
              <p>
                Company-scoped records will appear here when this module is
                connected.
              </p>
            </div>
          </div>

          <div className="empty-state">
            <Icon
              size={28}
              style={{
                marginBottom: 12,
                opacity: 0.55,
              }}
            />

            <div
              style={{
                fontWeight: 600,
                color: "#344054",
                marginBottom: 6,
              }}
            >
              No records to display
            </div>

            Database setup and module workflows are required before records
            can be created.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
