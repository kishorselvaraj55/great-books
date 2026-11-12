"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, LoaderCircle, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendResetEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );

      if (error) throw error;

      setMessage(
        "If an account exists for this email address, a password-reset link has been sent. Please check your inbox and spam folder."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the password-reset email. Please try again."
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

        <h1>Forgot your password?</h1>
        <p>
          Enter the email address associated with your account. We’ll send you
          a link to reset your password.
        </p>

        <form onSubmit={sendResetEmail}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <button className="btn btn-primary full" disabled={busy} type="submit">
            {busy ? (
              <>
                <LoaderCircle size={15} /> Sending…
              </>
            ) : (
              <>
                <MailCheck size={16} /> Send reset link
              </>
            )}
          </button>

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
        </form>

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
