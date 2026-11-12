"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, LoaderCircle, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setError(error.message);
        setValidSession(false);
      } else {
        setValidSession(Boolean(data.session));
      }

      setChecking(false);
    }

    void checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" || session) {
        setValidSession(true);
        setError("");
      } else if (event === "SIGNED_OUT") {
        setValidSession(false);
      }

      setChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function updatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("Your password has been updated successfully.");
      setPassword("");
      setConfirmPassword("");

      await supabase.auth.signOut();
      window.setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your password. Please request a new reset link."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">
            <BookOpen size={21} />
          </div>
          <span>Great Books</span>
        </div>

        <h1>Set a new password</h1>

        {checking ? (
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 24, color: "#667085", fontSize: 13 }}>
            <LoaderCircle size={17} /> Verifying your reset link…
          </div>
        ) : !validSession ? (
          <>
            <p>
              This password-reset link is invalid or has expired. Request a
              new link to continue.
            </p>
            <Link
              className="btn btn-primary full"
              href="/forgot-password"
              style={{ marginTop: 16, textDecoration: "none" }}
            >
              Request a new reset link
            </Link>
          </>
        ) : (
          <>
            <p>Choose a new password for your Great Books account.</p>

            <form onSubmit={updatePassword}>
              <div className="field">
                <label htmlFor="password">New password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="field">
                <label htmlFor="confirmPassword">Confirm new password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter your new password again"
                />
              </div>

              <button className="btn btn-primary full" disabled={busy} type="submit">
                {busy ? (
                  <>
                    <LoaderCircle size={15} /> Updating password…
                  </>
                ) : (
                  <>
                    <LockKeyhole size={15} /> Update password
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {message && (
          <div className="success" role="status" style={{ lineHeight: 1.6 }}>
            {message}
          </div>
        )}

        {error && (
          <div className="error" role="alert" style={{ lineHeight: 1.6 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              color: "#475467",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
