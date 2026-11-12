
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Save,
  RefreshCw,
  MapPin,
  Phone,
  FileText,
  ShieldCheck,
  Pencil,
  Landmark,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string;
  role: string;
};

type BusinessProfile = {
  legal_name: string;
  display_name: string;
  gstin: string;
  pan: string;
  registration_number: string;
  business_type: string;
  business_email: string;
  phone: string;
  website: string;
  logo_url: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  bank_account_holder: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_branch: string;
  bank_account_type: string;
};

const emptyProfile: BusinessProfile = {
  legal_name: "",
  display_name: "",
  gstin: "",
  pan: "",
  registration_number: "",
  business_type: "Proprietorship",
  business_email: "",
  phone: "",
  website: "",
  logo_url: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "Tamil Nadu",
  pincode: "",
  country: "India",
  bank_account_holder: "",
  bank_name: "",
  bank_account_number: "",
  bank_ifsc: "",
  bank_branch: "",
  bank_account_type: "Current",
};

const editableRoles = ["owner", "admin", "manager"];

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
  "Other",
];

function InputField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="business-settings-field">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ReadField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="business-settings-read-field">
      <span>{label}</span>
      <strong>{value?.trim() || "Not provided"}</strong>
    </div>
  );
}

function ProfileSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="business-settings-profile-section">
      <div className="business-settings-section-title">
        {icon}
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Business logo display.
 * Explicit dimensions prevent global CSS from making the logo enormous.
 * Great Books branding is not modified by this component.
 */
function BusinessLogo({
  url,
  name,
  size = 72,
}: {
  url: string;
  name: string;
  size?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const cleanUrl = url.trim();
  const logoSize = Math.min(Math.max(size, 1), 72);

  useEffect(() => {
    setImageFailed(false);
  }, [cleanUrl]);

  const frameStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: `${logoSize}px`,
    height: `${logoSize}px`,
    minWidth: `${logoSize}px`,
    minHeight: `${logoSize}px`,
    maxWidth: `${logoSize}px`,
    maxHeight: `${logoSize}px`,
    flex: `0 0 ${logoSize}px`,
    overflow: "hidden",
    boxSizing: "border-box",
    border: "1px solid #eaecf0",
    borderRadius: "8px",
    background: "#ffffff",
  };

  if (!cleanUrl || imageFailed) {
    return (
      <div
        className="business-settings-logo-placeholder"
        style={{
          ...frameStyle,
          borderStyle: "dashed",
          background: "#f9fafb",
          color: "#667085",
        }}
        aria-label="No business logo available"
        title="No business logo available"
      >
        <Building2 size={Math.min(logoSize * 0.4, 28)} />
      </div>
    );
  }

  return (
    <div className="business-settings-logo-frame" style={frameStyle}>
      <img
        key={cleanUrl}
        src={cleanUrl}
        alt={`${name || "Business"} logo`}
        onError={() => setImageFailed(true)}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          objectPosition: "center",
          flex: "0 0 auto",
        }}
      />
    </div>
  );
}

export function SettingsWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [profile, setProfile] =
    useState<BusinessProfile>({ ...emptyProfile });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const company = companies.find((item) => item.id === companyId);

  const canEdit = editableRoles.includes(
    (company?.role ?? "").toLowerCase()
  );

  const loadProfile = useCallback(async () => {
    if (!companyId) {
      setProfile({ ...emptyProfile });
      setHasSavedProfile(false);
      setIsEditing(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      const db = supabase as any;

      const { data, error } = await db
        .from("company_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        setProfile({
          legal_name: data.legal_name ?? "",
          display_name: data.display_name ?? "",
          gstin: data.gstin ?? "",
          pan: data.pan ?? "",
          registration_number: data.registration_number ?? "",
          business_type: data.business_type ?? "Proprietorship",
          business_email: data.business_email ?? "",
          phone: data.phone ?? "",
          website: data.website ?? "",
          logo_url: data.logo_url ?? "",
          address_line1: data.address_line1 ?? "",
          address_line2: data.address_line2 ?? "",
          city: data.city ?? "",
          state: data.state ?? "Tamil Nadu",
          pincode: data.pincode ?? "",
          country: data.country ?? "India",
          bank_account_holder: data.bank_account_holder ?? "",
          bank_name: data.bank_name ?? "",
          bank_account_number: data.bank_account_number ?? "",
          bank_ifsc: data.bank_ifsc ?? "",
          bank_branch: data.bank_branch ?? "",
          bank_account_type: data.bank_account_type ?? "Current",
        });

        setHasSavedProfile(true);
        setIsEditing(false);
      } else {
        setProfile({
          ...emptyProfile,
          legal_name: company?.name ?? "",
          display_name: company?.name ?? "",
        });

        setHasSavedProfile(false);
        setIsEditing(true);
      }
    } catch (error) {
      console.error("Business profile load failed:", error);

      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load business profile.",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, company?.name, supabase]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function setField<K extends keyof BusinessProfile>(
    key: K,
    value: BusinessProfile[K]
  ) {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function uploadBusinessLogo(file: File) {
    if (!companyId || !canEdit) {
      setNotice({
        type: "error",
        text: "You do not have permission to upload this company's logo.",
      });
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setNotice({
        type: "error",
        text: "Choose a PNG, JPG, WEBP or SVG image.",
      });
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setNotice({
        type: "error",
        text: "Logo image must be 3 MB or smaller.",
      });
      return;
    }

    setUploadingLogo(true);
    setNotice(null);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${companyId}/logo-${Date.now()}.${extension}`;
      const storage = supabase.storage.from("company-logos");

      const { error: uploadError } = await storage.upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data } = storage.getPublicUrl(filePath);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

      // Save the logo URL immediately so the workspace header can load it
      // without requiring the user to resubmit the entire business profile.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(authError?.message ?? "Please sign in again.");
      }

      const { error: updateError } = await (supabase as any)
        .from("company_settings")
        .upsert(
          {
            company_id: companyId,
            logo_url: publicUrl,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );

      if (updateError) {
        throw new Error(updateError.message);
      }

      setField("logo_url", publicUrl);

      // Notify the already-mounted AppShell so its top-right company logo
      // updates immediately without requiring a page reload.
      window.dispatchEvent(
        new CustomEvent("great-books:company-logo-updated", {
          detail: { companyId, logoUrl: publicUrl },
        })
      );

      setNotice({
        type: "success",
        text: "Business logo uploaded and saved successfully.",
      });
    } catch (error) {
      console.error("Business logo upload failed:", error);
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to upload the logo.",
      });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveProfile(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyId || !canEdit) {
      setNotice({
        type: "error",
        text:
          "You do not have permission to edit this company's settings.",
      });
      return;
    }

    if (!profile.legal_name.trim()) {
      setNotice({
        type: "error",
        text: "Enter the legal business name.",
      });
      return;
    }

    const gstin = profile.gstin.trim().toUpperCase();
    const pan = profile.pan.trim().toUpperCase();
    const ifsc = profile.bank_ifsc.trim().toUpperCase();

    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) {
      setNotice({
        type: "error",
        text: "GSTIN must contain 15 letters or numbers.",
      });
      return;
    }

    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      setNotice({
        type: "error",
        text: "Enter a valid 10-character PAN or leave it blank.",
      });
      return;
    }

    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setNotice({
        type: "error",
        text: "Check the IFSC code. It should contain 11 characters.",
      });
      return;
    }

    if (profile.logo_url.trim()) {
      try {
        const parsedUrl = new URL(profile.logo_url.trim());

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid URL protocol");
        }
      } catch {
        setNotice({
          type: "error",
          text: "Enter a valid public HTTPS or HTTP logo image URL.",
        });
        return;
      }
    }

    setSaving(true);
    setNotice(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          authError?.message ?? "Please sign in again."
        );
      }

      const payload = {
        company_id: companyId,
        ...profile,
        legal_name: profile.legal_name.trim(),
        display_name: profile.display_name.trim(),
        gstin,
        pan,
        registration_number: profile.registration_number.trim(),
        business_type: profile.business_type.trim(),
        business_email: profile.business_email.trim(),
        phone: profile.phone.trim(),
        website: profile.website.trim(),
        logo_url: profile.logo_url.trim(),
        address_line1: profile.address_line1.trim(),
        address_line2: profile.address_line2.trim(),
        city: profile.city.trim(),
        state: profile.state.trim(),
        pincode: profile.pincode.trim(),
        country: profile.country.trim(),
        bank_account_holder: profile.bank_account_holder.trim(),
        bank_name: profile.bank_name.trim(),
        bank_account_number: profile.bank_account_number.trim(),
        bank_ifsc: ifsc,
        bank_branch: profile.bank_branch.trim(),
        bank_account_type: profile.bank_account_type,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const db = supabase as any;

      const { error } = await db
        .from("company_settings")
        .upsert(payload, { onConflict: "company_id" });

      if (error) {
        throw new Error(error.message);
      }

      setProfile((current) => ({
        ...current,
        ...payload,
      }));

      setHasSavedProfile(true);
      setIsEditing(false);

      setNotice({
        type: "success",
        text: "Business profile saved successfully.",
      });
    } catch (error) {
      console.error("Business profile save failed:", error);

      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while saving.",
      });
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    if (hasSavedProfile) {
      void loadProfile();
    } else {
      setIsEditing(true);
    }
  }

  const businessName =
    profile.display_name || profile.legal_name || company?.name || "Business";

  return (
    <div className="content business-settings">
      <div className="page-heading">
        <div>
          <div className="eyebrow">COMPANY CONFIGURATION</div>
          <h1>Business Profile</h1>
          <p>
            Manage business registration, contact information and bank details.
          </p>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => void loadProfile()}
          disabled={loading}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {companies.length > 0 && (
        <div className="business-settings-company">
          <label htmlFor="settings-company">Settings for company</label>
          <select
            id="settings-company"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            {companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {notice && (
        <div
          className={
            notice.type === "error"
              ? "notice notice-error"
              : "notice business-settings-success"
          }
          role="status"
        >
          {notice.text}
        </div>
      )}

      {!companyId ? (
        <div className="card empty-state">
          No active company is available for your account.
        </div>
      ) : loading ? (
        <div className="card empty-state">
          Loading company details...
        </div>
      ) : (
        <>
          {hasSavedProfile && !isEditing ? (
            <>
              <div className="business-settings-saved-banner">
                <div className="business-settings-saved-icon">
                  <CheckCircle2 size={20} />
                </div>

                <div>
                  <strong>Company profile saved</strong>
                  <p>
                    Your details are saved. Select Edit Details if you need
                    to make changes.
                  </p>
                </div>

                {canEdit && (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setIsEditing(true);
                    }}
                  >
                    <Pencil size={15} />
                    Edit Details
                  </button>
                )}
              </div>

              <div className="business-settings-layout">
                <div className="card business-settings-main">
                  {/* FIXED: compact business logo at the top of the profile */}
                  <div
                    className="business-settings-profile-logo"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      width: "100%",
                      minHeight: 88,
                      marginBottom: 18,
                    }}
                  >
                    <BusinessLogo
                      url={profile.logo_url}
                      name={businessName}
                      size={72}
                    />
                  </div>

                  <ProfileSection
                    icon={<Building2 size={20} />}
                    title="Business information"
                    description="Registered business details."
                  >
                    <div className="business-settings-read-grid">
                      <ReadField
                        label="Legal business name"
                        value={profile.legal_name}
                      />
                      <ReadField
                        label="Display name"
                        value={profile.display_name}
                      />
                      <ReadField
                        label="Business type"
                        value={profile.business_type}
                      />
                      <ReadField
                        label="Registration number"
                        value={profile.registration_number}
                      />
                    </div>
                  </ProfileSection>

                  <ProfileSection
                    icon={<ShieldCheck size={20} />}
                    title="Tax registration"
                    description="GST and tax identification details."
                  >
                    <div className="business-settings-read-grid">
                      <ReadField label="GSTIN" value={profile.gstin} />
                      <ReadField label="PAN" value={profile.pan} />
                    </div>
                  </ProfileSection>

                  <ProfileSection
                    icon={<Phone size={20} />}
                    title="Contact information"
                    description="Business contact details."
                  >
                    <div className="business-settings-read-grid">
                      <ReadField label="Phone number" value={profile.phone} />
                      <ReadField
                        label="Business email"
                        value={profile.business_email}
                      />
                      <ReadField label="Website" value={profile.website} />
                    </div>
                  </ProfileSection>

                  <ProfileSection
                    icon={<MapPin size={20} />}
                    title="Registered business address"
                    description="Business address for records and invoices."
                  >
                    <div className="business-settings-read-grid">
                      <ReadField
                        label="Address line 1"
                        value={profile.address_line1}
                      />
                      <ReadField
                        label="Address line 2"
                        value={profile.address_line2}
                      />
                      <ReadField label="City / Town" value={profile.city} />
                      <ReadField label="State" value={profile.state} />
                      <ReadField label="PIN code" value={profile.pincode} />
                      <ReadField label="Country" value={profile.country} />
                    </div>
                  </ProfileSection>

                  <ProfileSection
                    icon={<Landmark size={20} />}
                    title="Company bank account"
                    description="Bank details intended for company invoices."
                  >
                    <div className="business-settings-read-grid">
                      <ReadField
                        label="Account holder name"
                        value={profile.bank_account_holder}
                      />
                      <ReadField
                        label="Bank name"
                        value={profile.bank_name}
                      />
                      <ReadField
                        label="Account number"
                        value={profile.bank_account_number}
                      />
                      <ReadField
                        label="IFSC code"
                        value={profile.bank_ifsc}
                      />
                      <ReadField
                        label="Branch"
                        value={profile.bank_branch}
                      />
                      <ReadField
                        label="Account type"
                        value={profile.bank_account_type}
                      />
                    </div>

                    <p className="business-settings-bank-note">
                      These details are saved for this company. Invoice
                      templates still need to be connected to display them on
                      generated bills.
                    </p>
                  </ProfileSection>
                </div>

                <aside className="card business-settings-aside">
                  {/* Compact logo in the company summary card */}
                  <div style={{ marginBottom: 14 }}>
                    <BusinessLogo
                      url={profile.logo_url}
                      name={businessName}
                      size={56}
                    />
                  </div>

                  <h3>{businessName}</h3>
                  <p>{profile.business_type}</p>

                  <div className="business-settings-summary-row">
                    <span>GSTIN</span>
                    <strong>{profile.gstin || "Not provided"}</strong>
                  </div>

                  <div className="business-settings-summary-row">
                    <span>Phone</span>
                    <strong>{profile.phone || "Not provided"}</strong>
                  </div>

                  <div className="business-settings-summary-row">
                    <span>Email</span>
                    <strong>
                      {profile.business_email || "Not provided"}
                    </strong>
                  </div>

                  <div className="business-settings-summary-row">
                    <span>Bank</span>
                    <strong>{profile.bank_name || "Not provided"}</strong>
                  </div>

                  <div className="business-settings-summary-row">
                    <span>Address</span>
                    <strong>
                      {[profile.city, profile.state, profile.pincode]
                        .filter(Boolean)
                        .join(", ") || "Not provided"}
                    </strong>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <form onSubmit={saveProfile}>
              <div className="card business-settings-main">
                <ProfileSection
                  icon={<Building2 size={20} />}
                  title="Business information"
                  description="Enter your registered business details."
                >
                  <div className="business-settings-grid">
                    <InputField
                      label="Legal business name *"
                      value={profile.legal_name}
                      required
                      onChange={(value) => setField("legal_name", value)}
                    />

                    <InputField
                      label="Display name"
                      value={profile.display_name}
                      onChange={(value) => setField("display_name", value)}
                    />

                    <label className="business-settings-field">
                      Business type
                      <select
                        value={profile.business_type}
                        onChange={(event) =>
                          setField("business_type", event.target.value)
                        }
                      >
                        {[
                          "Proprietorship",
                          "Partnership",
                          "LLP",
                          "Private Limited",
                          "Public Limited",
                          "HUF",
                          "Trust",
                          "Other",
                        ].map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <InputField
                      label="Business registration number"
                      value={profile.registration_number}
                      onChange={(value) =>
                        setField("registration_number", value)
                      }
                    />
                  </div>
                </ProfileSection>

                <ProfileSection
                  icon={<ShieldCheck size={20} />}
                  title="Tax registration"
                  description="GST and tax identification details."
                >
                  <div className="business-settings-grid">
                    <InputField
                      label="GSTIN"
                      value={profile.gstin}
                      maxLength={15}
                      onChange={(value) =>
                        setField("gstin", value.toUpperCase())
                      }
                    />

                    <InputField
                      label="PAN"
                      value={profile.pan}
                      maxLength={10}
                      onChange={(value) =>
                        setField("pan", value.toUpperCase())
                      }
                    />
                  </div>
                </ProfileSection>

                <ProfileSection
                  icon={<Phone size={20} />}
                  title="Contact information"
                  description="How customers can contact your business."
                >
                  <div className="business-settings-grid">
                    <InputField
                      label="Phone number"
                      value={profile.phone}
                      type="tel"
                      onChange={(value) => setField("phone", value)}
                    />

                    <InputField
                      label="Business email"
                      value={profile.business_email}
                      type="email"
                      onChange={(value) =>
                        setField("business_email", value)
                      }
                    />

                    <InputField
                      label="Website"
                      value={profile.website}
                      type="url"
                      onChange={(value) => setField("website", value)}
                    />

                    <div className="field">
                      <label htmlFor="business-logo-upload">Business logo</label>
                      <input
                        id="business-logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        disabled={!canEdit || uploadingLogo}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadBusinessLogo(file);
                          event.currentTarget.value = "";
                        }}
                      />
                      <p className="field-hint">
                        Upload PNG, JPG, WEBP or SVG. Maximum file size: 3 MB.
                      </p>
                      {uploadingLogo && (
                        <p className="field-hint">Uploading logo…</p>
                      )}
                    </div>
                  </div>

                  {/* FIXED: logo preview cannot grow beyond 64 x 64 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      marginTop: 16,
                      padding: 12,
                      width: "fit-content",
                      maxWidth: "100%",
                      border: "1px solid #eaecf0",
                      borderRadius: 12,
                      background: "#ffffff",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "#667085",
                        flexShrink: 0,
                      }}
                    >
                      Uploaded logo preview
                    </span>

                    <BusinessLogo
                      url={profile.logo_url}
                      name={profile.display_name || profile.legal_name}
                      size={64}
                    />
                  </div>
                </ProfileSection>

                <ProfileSection
                  icon={<MapPin size={20} />}
                  title="Registered business address"
                  description="Address applicable to your business registration."
                >
                  <div className="business-settings-grid">
                    <InputField
                      label="Address line 1"
                      value={profile.address_line1}
                      onChange={(value) =>
                        setField("address_line1", value)
                      }
                    />

                    <InputField
                      label="Address line 2"
                      value={profile.address_line2}
                      onChange={(value) =>
                        setField("address_line2", value)
                      }
                    />

                    <InputField
                      label="City / Town"
                      value={profile.city}
                      onChange={(value) => setField("city", value)}
                    />

                    <label className="business-settings-field">
                      State
                      <select
                        value={profile.state}
                        onChange={(event) =>
                          setField("state", event.target.value)
                        }
                      >
                        <option value="">Select state</option>
                        {indianStates.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </label>

                    <InputField
                      label="PIN code"
                      value={profile.pincode}
                      maxLength={10}
                      onChange={(value) => setField("pincode", value)}
                    />

                    <InputField
                      label="Country"
                      value={profile.country}
                      onChange={(value) => setField("country", value)}
                    />
                  </div>
                </ProfileSection>

                <ProfileSection
                  icon={<Landmark size={20} />}
                  title="Company bank account details"
                  description="These details are intended for the payment section of your invoices."
                >
                  <div className="business-settings-grid">
                    <InputField
                      label="Account holder name"
                      value={profile.bank_account_holder}
                      onChange={(value) =>
                        setField("bank_account_holder", value)
                      }
                    />

                    <InputField
                      label="Bank name"
                      value={profile.bank_name}
                      onChange={(value) => setField("bank_name", value)}
                    />

                    <InputField
                      label="Account number"
                      value={profile.bank_account_number}
                      onChange={(value) =>
                        setField("bank_account_number", value)
                      }
                    />

                    <InputField
                      label="IFSC code"
                      value={profile.bank_ifsc}
                      maxLength={11}
                      placeholder="Example: ABCD0123456"
                      onChange={(value) =>
                        setField("bank_ifsc", value.toUpperCase())
                      }
                    />

                    <InputField
                      label="Branch"
                      value={profile.bank_branch}
                      onChange={(value) => setField("bank_branch", value)}
                    />

                    <label className="business-settings-field">
                      Account type
                      <select
                        value={profile.bank_account_type}
                        onChange={(event) =>
                          setField("bank_account_type", event.target.value)
                        }
                      >
                        <option value="Current">Current</option>
                        <option value="Savings">Savings</option>
                        <option value="Cash Credit">Cash Credit</option>
                        <option value="Overdraft">Overdraft</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                  </div>
                </ProfileSection>

                <div className="business-settings-footer">
                  <div className="business-settings-help">
                    <FileText size={15} />
                    Details are saved separately for each company.
                  </div>

                  <div className="business-settings-footer-actions">
                    {hasSavedProfile && (
                      <button
                        className="btn"
                        type="button"
                        onClick={cancelEditing}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving || !canEdit}
                    >
                      <Save size={16} />
                      {saving ? "Saving..." : "Save business profile"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </>
      )}

      {/* Component-specific styling: keeps logo dimensions stable */}
      <style jsx>{`
        .business-settings-logo-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex: 0 0 auto;
          box-sizing: border-box;
          border: 1px solid #eaecf0;
          border-radius: 8px;
          background: #ffffff;
        }

        .business-settings-logo-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          flex: 0 0 auto;
          border: 1px dashed #d0d5dd;
          border-radius: 8px;
          background: #f9fafb;
          color: #667085;
        }

        .business-settings-logo-frame img {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: contain !important;
        }
      `}</style>
    </div>
  );
}

export default SettingsWorkspace;
