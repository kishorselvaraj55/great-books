
"use client";

import { useState } from "react";

type CompanyLogoProps = {
  logoUrl?: string | null;
  companyName?: string;
  size?: number;
  className?: string;
};

export default function CompanyLogo({
  logoUrl,
  companyName = "Business logo",
  size = 40,
  className = "",
}: CompanyLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const validLogoUrl = logoUrl?.trim();

  if (!validLogoUrl || imageFailed) {
    return (
      <div
        className={`company-logo-fallback ${className}`}
        style={{ width: size, height: size }}
        title={companyName}
        aria-label={companyName}
      >
        <span>{companyName.trim().charAt(0).toUpperCase() || "B"}</span>
      </div>
    );
  }

  return (
    <img
      key={validLogoUrl}
      src={validLogoUrl}
      alt={`${companyName} logo`}
      width={size}
      height={size}
      className={`company-logo-image ${className}`}
      onError={() => setImageFailed(true)}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
      }}
    />
  );
}
