
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const allowedRoles = ["admin", "manager", "staff"] as const;

type InviteRole = (typeof allowedRoles)[number];

export async function POST(request: Request) {
  try {
    // Verify the signed-in user's access token.
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please sign in before sending an invitation." },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 }
      );
    }

    // Read and validate the request.
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const companyId =
      typeof body.companyId === "string"
        ? body.companyId.trim()
        : "";

    const role =
      typeof body.role === "string"
        ? body.role.trim().toLowerCase()
        : "";

    // Correct email validation.
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailLooksValid) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "Please select a company." },
        { status: 400 }
      );
    }

    if (!allowedRoles.includes(role as InviteRole)) {
      return NextResponse.json(
        { error: "Please select a valid team member role." },
        { status: 400 }
      );
    }

    // Verify the requester is an active member of this company.
    const { data: membership, error: membershipError } = await supabase
      .from("company_members")
      .select("role, status")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You do not have active access to this company." },
        { status: 403 }
      );
    }

    const requesterRole = String(membership.role ?? "").toLowerCase();

    // Only owners and admins can invite users.
    if (!["owner", "admin"].includes(requesterRole)) {
      return NextResponse.json(
        { error: "Only a company owner or admin can invite users." },
        { status: 403 }
      );
    }

    // Initialize the Supabase admin client.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Server configuration is missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.",
        },
        { status: 500 }
      );
    }

    const adminClient = createSupabaseClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check whether this user already belongs to this company.
    const { data: existingUser } =
      await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    const existingAccount = existingUser?.users?.find(
      (account) => account.email?.toLowerCase() === email
    );

    if (existingAccount) {
      const { data: existingMembership, error: existingMembershipError } =
        await adminClient
          .from("company_members")
          .select("id")
          .eq("company_id", companyId)
          .eq("user_id", existingAccount.id)
          .maybeSingle();

      if (existingMembershipError) {
        throw new Error(existingMembershipError.message);
      }

      if (existingMembership) {
        return NextResponse.json(
          { error: "This user already has access to this company." },
          { status: 409 }
        );
      }
    }

    // Send the invitation email.
    const origin = new URL(request.url).origin;

    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/auth/callback`,
        data: {
          invited_by: user.id,
          company_id: companyId,
          company_role: role,
        },
      });

    if (inviteError || !inviteData.user) {
      return NextResponse.json(
        {
          error:
            inviteError?.message ||
            "Supabase did not create the invitation.",
        },
        { status: 400 }
      );
    }

    // Save the user's company membership.
    const { error: insertError } = await adminClient
      .from("company_members")
      .insert({
        company_id: companyId,
        user_id: inviteData.user.id,
        role,
        status: "active",
      });

    if (insertError) {
      console.error("Company membership insert failed:", insertError);

      return NextResponse.json(
        {
          error:
            "The invitation email was created, but company access could not be saved. Do not resend yet. Ask an administrator to check company_members. Details: " +
            insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent successfully to ${email}.`,
    });
  } catch (error) {
    console.error("Invite user API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while sending the invitation.",
      },
      { status: 500 }
    );
  }
}
