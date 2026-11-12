"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeCompanyRole } from "@/lib/modules";

type Company = {
  id: string;
  name: string;
  currency?: string | null;
  role?: string;
};

type InviteRole = "admin" | "manager" | "staff";

export default function InviteUsersWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("staff");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const selectedCompany = companies.find((company) => company.id === companyId);
  const currentRole = normalizeCompanyRole(selectedCompany?.role);
  const canInvite = currentRole === "owner" || currentRole === "admin";

  async function sendInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (!canInvite) {
      setIsError(true);
      setMessage("Only a company owner or admin can invite team members.");
      return;
    }

    if (!companyId || !email.trim()) {
      setIsError(true);
      setMessage("Choose a company and enter the team member's email.");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
          companyId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to send invitation.");
      }

      setMessage(`Invitation sent successfully to ${email.trim()}.`);
      setEmail("");
      setRole("staff");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="content invite-users-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GREAT BOOKS WORKSPACE</div>
          <h1>Invite Users</h1>
          <p>Invite team members and assign access to your company.</p>
        </div>
      </div>

      {!canInvite && companies.length > 0 ? (
        <div className="notice" role="alert">Only a company owner or admin can invite team members.</div>
      ) : companies.length === 0 ? (
        <div className="notice">
          No active company is linked to your account. Set up or select a
          company before inviting team members.
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 760 }}>
          <div className="card-heading">
            <div>
              <h2>Send an invitation</h2>
              <p>
                The invited person will receive an email from Supabase to
                complete their account setup.
              </p>
            </div>
          </div>

          {message && (
            <div
              className="notice"
              role="status"
              style={{
                borderColor: isError ? "#fecaca" : "#bbf7d0",
                color: isError ? "#b91c1c" : "#047857",
                marginBottom: 18,
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={sendInvitation}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 18,
              }}
            >
              <label className="field">
                <span className="field-label">Company *</span>
                <select
                  className="input"
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  required
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Team member email *</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="field">
                <span className="field-label">Role *</span>
                <select
                  className="input"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as InviteRole)
                  }
                >
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>

            {selectedCompany && (
              <p style={{ color: "#667085", fontSize: 13, marginTop: 16 }}>
                This invitation will grant access to {selectedCompany.name}.
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 22,
              }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !companyId}
              >
                {loading ? "Sending invitation..." : "Send invitation"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ maxWidth: 760, marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Role permissions</h3>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <strong>Admin</strong>
            <p style={{ margin: "4px 0 0", color: "#667085" }}>
              Full access to all company modules, settings, reports and team management.
            </p>
          </div>
          <div>
            <strong>Manager</strong>
            <p style={{ margin: "4px 0 0", color: "#667085" }}>
              Access to Sales, Purchase, Customers, Items & Inventory, Employees, and Attendance & Salary.
            </p>
          </div>
          <div>
            <strong>Staff</strong>
            <p style={{ margin: "4px 0 0", color: "#667085" }}>
              Access only to Sales, Purchase, Customers, and Items & Inventory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}