"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function handleInvitation() {
      const supabase = createClient();

      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const authError = params.get("error_description");

        if (authError) throw new Error(authError.replace(/\+/g, " "));

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          window.history.replaceState(null, "", window.location.pathname);
        } else {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
            throw new Error("This invitation link is invalid or has expired. Please ask your administrator to send a new invitation.");
          }
        }

        if (mounted) setReady(true);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to verify your invitation.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void handleInvitation();
    return () => { mounted = false; };
  }, []);

  async function handleSetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const cleanedName = fullName.trim().replace(/\s+/g, " ");

    if (cleanedName.length < 2) return setError("Please enter your full name.");
    if (password.length < 8) return setError("Password must contain at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { full_name: cleanedName },
      });
      if (updateError) throw updateError;

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate your account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="gb-activate">
      <section className="gb-activate-side">
        <div className="gb-activate-brand">
          <span><BookOpen size={22} /></span>
          <strong>Great Books</strong>
        </div>
        <div className="gb-side-copy">
          <div className="gb-side-tag">YOUR BUSINESS. CONNECTED.</div>
          <h2>A better way<br />to work <em>together.</em></h2>
          <p>Join your company workspace and access the tools your team needs to get work done.</p>
          <div className="gb-side-points">
            <div><Check size={16} /> Your company workspace</div>
            <div><Check size={16} /> Role-based access</div>
            <div><Check size={16} /> Secure account protection</div>
          </div>
        </div>
        <div className="gb-side-foot">GREAT BOOKS · BUSINESS MANAGEMENT</div>
        <div className="gb-side-decoration" />
      </section>

      <section className="gb-activate-main">
        <div className="gb-activate-card">
          <div className="gb-activate-mobile-brand"><span><BookOpen size={20} /></span><strong>Great Books</strong></div>

          {loading ? (
            <div className="gb-activate-state">
              <div className="gb-state-icon"><ShieldCheck size={25} /></div>
              <div className="gb-activate-eyebrow">SECURE ACCOUNT SETUP</div>
              <h1>Verifying your invitation</h1>
              <p>Please wait while we securely verify your invitation link.</p>
              <div className="gb-progress"><span /></div>
            </div>
          ) : error && !ready ? (
            <div className="gb-activate-state">
              <div className="gb-state-icon gb-state-error"><ShieldCheck size={25} /></div>
              <div className="gb-activate-eyebrow">INVITATION LINK</div>
              <h1>We couldn't verify this link</h1>
              <div className="gb-activate-error" role="alert">{error}</div>
              <button className="gb-activate-submit" type="button" onClick={() => router.replace("/login")}>Go to sign in <ArrowRight size={16} /></button>
            </div>
          ) : (
            <>
              <div className="gb-activate-eyebrow">YOU'RE INVITED</div>
              <h1>Set up your account</h1>
              <p className="gb-activate-intro">A few details and you'll be ready to join your Great Books workspace.</p>

              {error && <div className="gb-activate-error" role="alert">{error}</div>}

              <form onSubmit={handleSetPassword}>
                <div className="gb-activate-field">
                  <label htmlFor="fullName">Full name</label>
                  <div className="gb-activate-input">
                    <UserRound size={17} />
                    <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" autoComplete="name" maxLength={100} required />
                  </div>
                </div>

                <div className="gb-activate-field">
                  <label htmlFor="newPassword">Create password</label>
                  <div className="gb-activate-input">
                    <LockKeyhole size={17} />
                    <input id="newPassword" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required autoComplete="new-password" />
                    <button type="button" className="gb-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                  <div className="gb-password-hint"><span className={password.length >= 8 ? "is-valid" : ""}><Check size={12} /> At least 8 characters</span></div>
                </div>

                <div className="gb-activate-field">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <div className="gb-activate-input">
                    <LockKeyhole size={17} />
                    <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Enter your password again" minLength={8} required autoComplete="new-password" />
                    <button type="button" className="gb-eye" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                  {confirmPassword && <div className={`gb-match ${password === confirmPassword ? "is-valid" : "is-invalid"}`}>{password === confirmPassword ? "Passwords match" : "Passwords do not match"}</div>}
                </div>

                <button className="gb-activate-submit" type="submit" disabled={saving || !ready}>
                  {saving ? "Activating your account..." : <>Activate account <ArrowRight size={17} /></>}
                </button>
              </form>

              <div className="gb-activate-security"><ShieldCheck size={17} /><span>Your details are encrypted and securely managed by Supabase authentication.</span></div>
            </>
          )}
        </div>
        <footer className="gb-activate-footer">© {new Date().getFullYear()} Great Books <span>·</span> Secure account activation</footer>
      </section>

      <style jsx>{`
        .gb-activate{min-height:100vh;display:grid;grid-template-columns:minmax(340px,.85fr) 1.15fr;background:#f7f9fd;color:#17243a}
        .gb-activate-side{position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:38px 9%;background:linear-gradient(145deg,#102b62,#1749a3 58%,#2563eb);color:#fff}
        .gb-activate-brand{display:flex;align-items:center;gap:11px;font-size:19px}
        .gb-activate-brand span,.gb-activate-mobile-brand span{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#fff;color:#2058d5}
        .gb-side-copy{position:relative;margin:50px auto;max-width:450px}
        .gb-side-tag,.gb-activate-eyebrow{font-size:10px;font-weight:800;letter-spacing:1.6px;color:#3974e9}
        .gb-side-tag{color:#c9dcff}
        .gb-side-copy h2{font-size:clamp(38px,4.2vw,58px);line-height:1.08;letter-spacing:-2px;margin:20px 0}
        .gb-side-copy h2 em{font-style:normal;color:#bcd4ff}
        .gb-side-copy p{font-size:14px;line-height:1.8;color:#dce8ff;max-width:390px}
        .gb-side-points{display:grid;gap:15px;margin-top:34px;color:#eef4ff;font-size:13px}
        .gb-side-points div{display:flex;align-items:center;gap:10px}
        .gb-side-points svg{color:#a9f0d0}
        .gb-side-foot{font-size:10px;letter-spacing:1.1px;color:#c8d9fb}
        .gb-side-decoration{position:absolute;z-index:-1;width:570px;height:570px;border:1px solid rgba(255,255,255,.13);border-radius:50%;right:-330px;top:20%;box-shadow:0 0 0 55px rgba(255,255,255,.035),0 0 0 110px rgba(255,255,255,.025)}
        .gb-activate-main{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:42px 7% 22px}
        .gb-activate-card{width:100%;max-width:470px;background:#fff;border:1px solid #e7ecf4;border-radius:22px;padding:40px;box-shadow:0 22px 65px rgba(24,48,88,.08)}
        .gb-activate-card h1{font-size:28px;letter-spacing:-.9px;margin:11px 0 8px;color:#17243a}
        .gb-activate-intro,.gb-activate-state p{font-size:13px;line-height:1.65;color:#738099;margin:0 0 26px}
        .gb-activate-field{margin-bottom:19px}
        .gb-activate-field label{display:block;font-size:12px;font-weight:700;color:#344054;margin-bottom:8px}
        .gb-activate-input{height:48px;display:flex;align-items:center;gap:11px;padding:0 13px;border:1px solid #dce3ee;border-radius:10px;color:#8b97aa;transition:border-color .18s,box-shadow .18s}
        .gb-activate-input:focus-within{border-color:#4c7ff0;box-shadow:0 0 0 4px rgba(37,99,235,.1)}
        .gb-activate-input input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#17243a;font:inherit;font-size:13px}
        .gb-activate-input input::placeholder{color:#a0aabc}
        .gb-eye{border:0;background:transparent;color:#7c899d;padding:5px;display:grid;place-items:center;cursor:pointer}
        .gb-password-hint{margin-top:7px;font-size:10px;color:#98a2b3}
        .gb-password-hint span{display:inline-flex;align-items:center;gap:4px}
        .gb-password-hint .is-valid,.gb-match.is-valid{color:#07865b}
        .gb-match{font-size:10px;margin-top:7px}
        .gb-match.is-invalid{color:#c2413b}
        .gb-activate-submit{width:100%;min-height:49px;margin-top:6px;border:0;border-radius:10px;background:linear-gradient(100deg,#2563eb,#174bc7);color:#fff;font-size:13px;font-weight:750;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;box-shadow:0 8px 18px rgba(37,99,235,.2)}
        .gb-activate-submit:disabled{opacity:.65;cursor:wait}
        .gb-activate-error{padding:11px 13px;margin:0 0 18px;border:1px solid #fecaca;border-radius:10px;background:#fff1f2;color:#b42318;font-size:12px;line-height:1.5}
        .gb-activate-security{display:flex;align-items:flex-start;gap:9px;margin-top:23px;padding-top:18px;border-top:1px solid #edf0f5;color:#8793a6;font-size:10px;line-height:1.6}
        .gb-activate-security svg{flex:0 0 auto;color:#3973e8}
        .gb-activate-footer{display:flex;gap:8px;margin-top:23px;color:#98a2b3;font-size:10px}
        .gb-activate-state .gb-state-icon{width:48px;height:48px;border-radius:14px;background:#edf4ff;color:#2563eb;display:grid;place-items:center;margin-bottom:22px}
        .gb-state-error{background:#fff1f2!important;color:#c2413b!important}
        .gb-progress{height:4px;border-radius:99px;background:#e9eef7;overflow:hidden;margin-top:24px}
        .gb-progress span{display:block;width:42%;height:100%;border-radius:99px;background:#2563eb;animation:gb-loading 1.2s ease-in-out infinite alternate}
        @keyframes gb-loading{from{transform:translateX(0)}to{transform:translateX(135%)}}
        .gb-activate-mobile-brand{display:none}
        @media(max-width:760px){.gb-activate{display:block}.gb-activate-side{display:none}.gb-activate-main{min-height:100vh;padding:26px 18px}.gb-activate-mobile-brand{display:flex;align-items:center;gap:10px;margin:0 auto 22px;font-size:18px}.gb-activate-mobile-brand span{width:39px;height:39px;background:#2563eb;color:#fff}.gb-activate-card{padding:30px 24px;border-radius:18px}.gb-activate-card h1{font-size:25px}}
      `}</style>
    </main>
  );
}
