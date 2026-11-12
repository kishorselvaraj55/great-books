"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { BookOpen } from "lucide-react";

import { navigation } from "@/lib/modules";

import { SignOutButton } from "@/components/sign-out-button";

import { createClient } from "@/lib/supabase/client";



type Company = {

  id: string;

  name: string;

  currency: string;

  role: string;

};



type AppShellProps = {

  children: React.ReactNode;

  userEmail: string;

  companies: Company[];

};



function BusinessAvatar({

  logoUrl,

  fallbackText,

}: {

  logoUrl: string;

  fallbackText: string;

}) {

  const [imageError, setImageError] = useState(false);



  useEffect(() => {

    setImageError(false);

  }, [logoUrl]);



  if (logoUrl && !imageError) {

    return (

      <div className="business-avatar" title="Business logo">

        <img

          key={logoUrl}

          src={logoUrl}

          alt="Business logo"

          onError={() => setImageError(true)}

        />

      </div>

    );

  }



  return (

    <div className="business-avatar business-avatar-fallback" aria-label="Business logo">

      {(fallbackText.trim()[0] ?? "C").toUpperCase()}

    </div>

  );

}



export function AppShell({

  children,

  userEmail,

  companies,

}: AppShellProps) {

  const supabase = useMemo(() => createClient(), []);



  const company = companies[0];

  const companyId = company?.id ?? "";

  const companyName = company?.name ?? "No company selected";



  const [companyLogoUrl, setCompanyLogoUrl] = useState("");



  const loadCompanyLogo = useCallback(async () => {

    if (!companyId) {

      setCompanyLogoUrl("");

      return;

    }



    const { data, error } = await (supabase as any)

      .from("company_settings")

      .select("logo_url")

      .eq("company_id", companyId)

      .maybeSingle();



    if (error) {

      console.error("Unable to load business logo:", error.message);

      setCompanyLogoUrl("");

      return;

    }



    const savedLogo =

      typeof data?.logo_url === "string" ? data.logo_url.trim() : "";



    if (!savedLogo) {

      setCompanyLogoUrl("");

      return;

    }



    if (
      savedLogo.startsWith("https://") ||
      savedLogo.startsWith("http://")
    ) {

      setCompanyLogoUrl(savedLogo);

      return;

    }



    const { data: publicData } = supabase.storage

      .from("company-logos")

      .getPublicUrl(savedLogo);



    setCompanyLogoUrl(publicData.publicUrl);

  }, [companyId, supabase]);



  useEffect(() => {

    let active = true;



    const refreshLogo = async () => {

      if (!active) return;

      await loadCompanyLogo();

    };



    void refreshLogo();



    // The Settings page dispatches this event after a successful logo upload.

    const onLogoUpdated = (event: Event) => {

      const customEvent = event as CustomEvent<{

        companyId?: string;

        logoUrl?: string;

      }>;



      if (customEvent.detail?.companyId !== companyId) return;



      const nextUrl = customEvent.detail?.logoUrl?.trim() ?? "";

      if (nextUrl) setCompanyLogoUrl(nextUrl);

      else void refreshLogo();

    };



    // Also refresh when the user returns to this browser tab.

    const onFocus = () => void refreshLogo();

    const onVisibilityChange = () => {

      if (document.visibilityState === "visible") void refreshLogo();

    };



    window.addEventListener("great-books:company-logo-updated", onLogoUpdated);

    window.addEventListener("focus", onFocus);

    document.addEventListener("visibilitychange", onVisibilityChange);



    return () => {

      active = false;

      window.removeEventListener("great-books:company-logo-updated", onLogoUpdated);

      window.removeEventListener("focus", onFocus);

      document.removeEventListener("visibilitychange", onVisibilityChange);

    };

  }, [companyId, loadCompanyLogo]);



  return (

    <div className="shell">

      <aside className="sidebar">

        <Link href="/dashboard" className="brand">

          <span className="brand-mark">

            <BookOpen size={21} />

          </span>

          <span>Great Books</span>

        </Link>



        <div className="sidebar-navigation">

          {navigation.map((group) => (

            <div key={group.label}>

              <div className="nav-label">{group.label}</div>

              {group.items.map((item) => {

                const Icon = item.icon;

                return (

                  <Link key={item.href} href={item.href} className="nav-link">

                    <Icon size={17} />

                    <span>{item.title}</span>

                  </Link>

                );

              })}

            </div>

          ))}

        </div>



        <div className="sidebar-bottom">

          <div className="nav-link sidebar-user" style={{ cursor: "default" }}>

            <BusinessAvatar logoUrl={companyLogoUrl} fallbackText={companyName} />

            <div className="sidebar-user-details">

              <div className="sidebar-user-email" title={userEmail}>

                {userEmail}

              </div>

              <div className="sidebar-user-status">Signed in</div>

            </div>

          </div>

          <SignOutButton />

        </div>

      </aside>



      <main className="main">

        <header className="topbar">

          <div className="mobile-brand">

            <span className="brand-mark mobile-brand-mark">

              <BookOpen size={17} />

            </span>

            Great Books

          </div>



          <div className="crumb">Business management / Workspace</div>



          <div className="top-actions">
            <div className="gb-company-identity" title={companyName}>
              <span className="gb-company-logo-slot">
                {companyLogoUrl ? (
                  <img
                    key={companyLogoUrl}
                    src={companyLogoUrl}
                    alt={`${companyName} logo`}
                    onError={() => setCompanyLogoUrl("")}
                  />
                ) : (
                  <span className="gb-company-logo-fallback">
                    {(companyName.trim()[0] ?? "C").toUpperCase()}
                  </span>
                )}
              </span>
              <span className="gb-company-identity-name">{companyName}</span>
            </div>
          </div>
        </header>



        <div className="main-content">{children}</div>

      </main>



      <style jsx>{`

        .business-avatar {

          box-sizing: border-box !important;

          width: 38px !important;

          height: 38px !important;

          min-width: 38px !important;

          min-height: 38px !important;

          max-width: 38px !important;

          max-height: 38px !important;

          flex: 0 0 38px !important;

          overflow: hidden !important;

          padding: 0 !important;

          margin: 0 !important;

          border: 1px solid #e5eaf2 !important;

          border-radius: 9px !important;

          background: #ffffff !important;

          display: inline-flex !important;

          align-items: center !important;

          justify-content: center !important;

          position: relative !important;

          line-height: 1 !important;

        }



        .business-avatar img {

          box-sizing: border-box !important;

          display: block !important;

          width: 100% !important;

          height: 100% !important;

          min-width: 0 !important;

          min-height: 0 !important;

          max-width: 100% !important;

          max-height: 100% !important;

          object-fit: contain !important;

          object-position: center !important;

          position: absolute !important;

          inset: 0 !important;

          margin: auto !important;

          border-radius: inherit !important;

        }



        .business-avatar-fallback {

          color: #315efb !important;

          font-size: 15px !important;

          font-weight: 700 !important;

        }



        .sidebar-user {

          display: flex;

          align-items: center;

          gap: 10px;

        }



        .sidebar-user-details {

          min-width: 0;

          flex: 1;

        }



        .sidebar-user-email {

          overflow: hidden;

          text-overflow: ellipsis;

          white-space: nowrap;

          font-size: 11px;

          font-weight: 700;

        }



        .sidebar-user-status {

          margin-top: 4px;

          color: #98a2b3;

          font-size: 10px;

        }



        .gb-company-identity {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 8px !important;
          flex: 0 0 auto !important;
          width: max-content !important;
          min-width: 0 !important;
          max-width: min(340px, 45vw) !important;
          padding: 5px 9px !important;
          border: 1px solid #e7ebf2 !important;
          border-radius: 10px !important;
          background: #fff !important;
          box-sizing: border-box !important;
        }

        .gb-company-logo-slot {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
          flex: 0 0 30px !important;
          width: 30px !important;
          height: 30px !important;
          min-width: 30px !important;
          min-height: 30px !important;
          overflow: hidden !important;
          border: 1px solid #e5eaf2 !important;
          border-radius: 6px !important;
          background: #fff !important;
          box-sizing: border-box !important;
        }

        .gb-company-logo-slot img {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: contain !important;
          object-position: center !important;
        }

        .gb-company-logo-fallback {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          height: 100% !important;
          color: #315efb !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }

        .gb-company-identity-name {
          display: block !important;
          min-width: 0 !important;
          max-width: 270px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          color: #263247 !important;
          font-size: 12px !important;
          font-weight: 600 !important;
        }

        .mobile-brand-mark {

          width: 30px;

          height: 30px;

          border-radius: 8px;

        }



        @media (max-width: 700px) {

          .company-identity-name {

            max-width: 125px !important;

            font-size: 11px !important;

          }

        }

      `}</style>

    </div>

  );

}
