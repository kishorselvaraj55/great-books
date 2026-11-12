"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please check your details and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gb-auth">
      <section className="gb-auth-visual" aria-label="Great Books introduction">
        <div className="gb-visual-top">
          <div className="gb-brand">
            <span className="gb-brand-icon"><BookOpen size={22} strokeWidth={2.2} /></span>
            <span>Great Books</span>
          </div>
          <span className="gb-secure"><ShieldCheck size={14} /> Secure workspace</span>
        </div>

        <div className="gb-visual-content">
          <span className="gb-kicker"><Sparkles size={14} /> BUSINESS, MADE CLEAR</span>
          <h2>Run your business.<br /><span>With confidence.</span></h2>
          <p>One connected workspace for your sales, purchases, inventory, people and financial operations.</p>

          <div className="gb-feature-card">
            <div className="gb-feature-icon"><BookOpen size={19} /></div>
            <div>
              <strong>Your business, in one place</strong>
              <span>Stay organised. Make informed decisions. Keep moving forward.</span>
            </div>
          </div>
        </div>

        <div className="gb-visual-footer">
          <span>GREAT BOOKS WORKSPACE</span>
          <span>Simple operations. Better visibility.</span>
        </div>
        <div className="gb-orb gb-orb-one" />
        <div className="gb-orb gb-orb-two" />
      </section>

      <section className="gb-auth-main">
        <div className="gb-mobile-brand">
          <span className="gb-brand-icon"><BookOpen size={21} /></span>
          <strong>Great Books</strong>
        </div>

        <div className="gb-login-card">
          <div className="gb-form-eyebrow">WELCOME BACK</div>
          <h1>Sign in to your workspace</h1>
          <p className="gb-form-intro">Enter your details below to access your business dashboard.</p>

          {error && <div className="gb-error" role="alert">{error}</div>}

          <form onSubmit={signIn}>
            <div className="gb-field">
              <label htmlFor="email">Work email</label>
              <div className="gb-input-wrap">
                <Mail size={17} />
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
            </div>

            <div className="gb-field">
              <div className="gb-label-row">
                <label htmlFor="password">Password</label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
              <div className="gb-input-wrap">
                <LockKeyhole size={17} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  className="gb-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button className="gb-submit" disabled={busy} type="submit">
              {busy ? "Signing in..." : <>Sign in to Great Books <ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="gb-form-divider"><span>YOUR WORKSPACE</span></div>
          <div className="gb-help">
            <ShieldCheck size={17} />
            <p>Your account is protected by secure authentication. Need access? Ask your company administrator to invite you.</p>
          </div>
        </div>

        <footer className="gb-auth-bottom">
          <span>© {new Date().getFullYear()} Great Books</span>
          <span>Business management, simplified.</span>
        </footer>
      </section>

      <style jsx>{`
        .gb-auth{min-height:100vh;display:grid;grid-template-columns:minmax(380px,0.92fr) 1.08fr;background:#f7f9fd;color:#17243a;font-family:inherit}
        .gb-auth-visual{position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:38px 8%;color:#fff;background:linear-gradient(145deg,#102b62 0%,#1749a3 52%,#2563eb 100%)}
        .gb-auth-visual:before{content:"";position:absolute;z-index:-1;width:620px;height:620px;border:1px solid rgba(255,255,255,.13);border-radius:50%;right:-290px;top:14%;box-shadow:0 0 0 55px rgba(255,255,255,.035),0 0 0 110px rgba(255,255,255,.025)}
        .gb-visual-top,.gb-brand,.gb-secure,.gb-visual-footer{display:flex;align-items:center}
        .gb-visual-top{justify-content:space-between;gap:16px}
        .gb-brand{gap:11px;font-size:19px;font-weight:750;letter-spacing:-.5px}
        .gb-brand-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#fff;color:#2058d5;box-shadow:0 8px 24px rgba(5,20,55,.16)}
        .gb-secure{gap:7px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.09);padding:8px 11px;border-radius:999px;font-size:11px;color:#e5edff}
        .gb-visual-content{max-width:540px;margin:70px auto;position:relative}
        .gb-kicker{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:750;letter-spacing:1.6px;color:#c9dcff}
        .gb-visual-content h2{font-size:clamp(38px,4.2vw,60px);line-height:1.08;letter-spacing:-2.4px;margin:22px 0 18px;font-weight:780}
        .gb-visual-content h2 span{color:#bcd4ff}
        .gb-visual-content>p{max-width:440px;color:#dce8ff;font-size:15px;line-height:1.8;margin:0}
        .gb-feature-card{display:flex;gap:14px;align-items:center;margin-top:38px;padding:17px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);backdrop-filter:blur(12px);border-radius:15px;max-width:430px}
        .gb-feature-icon{width:39px;height:39px;flex:0 0 39px;border-radius:11px;background:#fff;color:#215bd6;display:grid;place-items:center}
        .gb-feature-card strong,.gb-feature-card span{display:block}
        .gb-feature-card strong{font-size:13px;margin-bottom:5px}
        .gb-feature-card span{font-size:11px;line-height:1.5;color:#dce8ff}
        .gb-visual-footer{justify-content:space-between;gap:12px;color:#c8d9fb;font-size:10px;letter-spacing:.8px}
        .gb-visual-footer span+span{letter-spacing:0;font-size:11px}
        .gb-orb{position:absolute;z-index:-1;border-radius:50%;background:rgba(255,255,255,.07);filter:blur(1px)}
        .gb-orb-one{width:210px;height:210px;right:-70px;bottom:12%}
        .gb-orb-two{width:90px;height:90px;left:-40px;top:38%}
        .gb-auth-main{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:54px 7% 24px;min-width:0}
        .gb-login-card{width:100%;max-width:440px;padding:42px 40px;background:#fff;border:1px solid #e7ecf4;border-radius:22px;box-shadow:0 22px 65px rgba(24,48,88,.08)}
        .gb-form-eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:800;color:#2563eb}
        .gb-login-card h1{font-size:28px;line-height:1.2;letter-spacing:-.9px;margin:12px 0 9px;color:#17243a}
        .gb-form-intro{font-size:13px;line-height:1.65;color:#738099;margin:0 0 29px}
        .gb-field{margin-bottom:20px}
        .gb-field label,.gb-label-row label{display:block;font-size:12px;font-weight:700;color:#344054;margin-bottom:8px}
        .gb-label-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .gb-label-row a{font-size:11px;font-weight:700;color:#2563eb;text-decoration:none;margin-bottom:8px}
        .gb-label-row a:hover{text-decoration:underline}
        .gb-input-wrap{height:49px;display:flex;align-items:center;gap:11px;padding:0 14px;border:1px solid #dce3ee;border-radius:11px;color:#8b97aa;background:#fff;transition:border-color .18s,box-shadow .18s}
        .gb-input-wrap:focus-within{border-color:#4c7ff0;box-shadow:0 0 0 4px rgba(37,99,235,.1)}
        .gb-input-wrap input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#17243a;font:inherit;font-size:13px}
        .gb-input-wrap input::placeholder{color:#a0aabc}
        .gb-password-toggle{border:0;background:transparent;color:#7c899d;padding:5px;display:grid;place-items:center;cursor:pointer}
        .gb-submit{width:100%;min-height:50px;margin-top:5px;border:0;border-radius:11px;background:linear-gradient(100deg,#2563eb,#174bc7);color:#fff;font-size:13px;font-weight:750;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;box-shadow:0 8px 18px rgba(37,99,235,.2);transition:transform .18s,box-shadow .18s}
        .gb-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 11px 22px rgba(37,99,235,.27)}
        .gb-submit:disabled{opacity:.65;cursor:wait}
        .gb-error{padding:11px 13px;margin:-10px 0 19px;border:1px solid #fecaca;border-radius:10px;background:#fff1f2;color:#b42318;font-size:12px;line-height:1.5}
        .gb-form-divider{display:flex;align-items:center;gap:12px;margin:26px 0 17px;color:#a0aabc;font-size:9px;font-weight:800;letter-spacing:1.4px}
        .gb-form-divider:before,.gb-form-divider:after{content:"";height:1px;background:#edf0f5;flex:1}
        .gb-help{display:flex;align-items:flex-start;gap:10px;color:#8190a5}
        .gb-help svg{flex:0 0 auto;color:#3973e8;margin-top:1px}
        .gb-help p{font-size:11px;line-height:1.6;margin:0}
        .gb-auth-bottom{width:100%;max-width:440px;display:flex;justify-content:space-between;gap:12px;margin-top:25px;color:#98a2b3;font-size:10px}
        .gb-mobile-brand{display:none}
        @media(max-width:900px){.gb-auth{grid-template-columns: minmax(300px,.78fr) 1.22fr}.gb-auth-visual{padding:30px 7%}.gb-secure{display:none}.gb-login-card{padding:34px 30px}}
        @media(max-width:680px){.gb-auth{display:block;background:#f7f9fd}.gb-auth-visual{display:none}.gb-auth-main{min-height:100vh;padding:28px 20px 20px;justify-content:center}.gb-mobile-brand{display:flex;align-items:center;gap:10px;margin:0 auto 24px;font-size:18px;color:#17243a}.gb-mobile-brand .gb-brand-icon{width:39px;height:39px;background:#2563eb;color:#fff}.gb-login-card{padding:30px 24px;border-radius:18px}.gb-login-card h1{font-size:25px}.gb-auth-bottom{padding:0 4px;font-size:9px}}
      `}</style>
    </main>
  );
}
