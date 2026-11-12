
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Mail, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { jsPDF } from "jspdf";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string;
  role: string;
};

type Address = {
  name?: string;
  address?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  gstin?: string;
  phone?: string;
  email?: string;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  billing_address: Address | null;
  payment_terms_days: number | null;
};

type Item = {
  id: string;
  code: string | null;
  name: string;
  unit: string | null;
  hsn_sac: string | null;
  gst_rate: number | null;
  selling_price: number | null;
};

type CompanyDetails = {
  name: string;
  legal_name: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  bank_account_holder: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  bank_account_type: string | null;
  invoice_format?: string | null;
  logo_url?: string | null;
};

type Invoice = {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  place_of_supply: string | null;
  supply_type: string;
  shipping_address: Address;
  delivery_note: string;
  payment_terms: string;
  reference_number: string;
  buyer_order_number: string;
  dispatch_document_number: string;
  delivery_note_date: string;
  dispatched_through: string;
  destination: string;
  lr_rr_number: string;
  bill_of_lading_date: string;
  vehicle_number: string;
  terms_of_delivery: string;
  package_count: string;
  package_kind: string;
  subtotal: number;
  discount_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  round_off: number;
  grand_total: number;
  amount_paid: number;
  notes: string | null;
  invoice_format?: string | null;
  customers?: Customer | null;
};

type Line = {
  key: string;
  item_id: string;
  description: string;
  hsn_sac: string;
  quantity: string;
  unit: string;
  rate: string;
  discount: string;
  gst_rate: string;
};

type CalculatedLine = Line & {
  qty: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

const asNumber = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function makeLine(): Line {
  return {
    key: `${Date.now()}-${Math.random()}`,
    item_id: "",
    description: "",
    hsn_sac: "",
    quantity: "1",
    unit: "KGS",
    rate: "0",
    discount: "0",
    gst_rate: "0",
  };
}

function formatMoney(value: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `₹${(value || 0).toFixed(2)}`;
  }
}

function wordsUnderThousand(n: number): string {
  const ones = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
    "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
    "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty",
    "Seventy", "Eighty", "Ninety",
  ];

  let result = "";
  if (n >= 100) {
    result += `${ones[Math.floor(n / 100)]} Hundred `;
    n %= 100;
  }
  if (n >= 20) {
    result += `${tens[Math.floor(n / 10)]} `;
    n %= 10;
  }
  if (n > 0) result += `${ones[n]} `;
  return result.trim();
}

function amountInWords(amount: number) {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  let n = Math.floor(rounded);
  const paise = Math.round((rounded - n) * 100);
  const groups: [number, string][] = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ];

  const parts: string[] = [];
  for (const [size, label] of groups) {
    if (n >= size) {
      const count = Math.floor(n / size);
      parts.push(`${wordsUnderThousand(count)} ${label}`);
      n %= size;
    }
  }
  if (n > 0 || parts.length === 0) parts.push(wordsUnderThousand(n));

  let result = `INR ${parts.join(" ")} Rupees`;
  if (paise > 0) result += ` and ${wordsUnderThousand(paise)} Paise`;
  return `${amount < 0 ? "Minus " : ""}${result} Only`;
}

function addressLines(address: Address | null | undefined) {
  if (!address) return [];
  return [
    address.address,
    address.address_line1,
    address.address_line2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(", "),
    address.country,
  ].filter((x): x is string => Boolean(x && x.trim()));
}

// Normalize older customer address records that store the whole street address
// in `address` rather than `address_line1`, so copying fills the visible fields.
function customerShippingAddress(customer: Customer): Address {
  const billing = customer.billing_address ?? {};
  return {
    name: customer.name ?? "",
    address: "",
    address_line1: billing.address_line1?.trim() || billing.address?.trim() || "",
    address_line2: billing.address_line2 ?? "",
    city: billing.city ?? "",
    state: billing.state ?? "",
    postal_code: billing.postal_code ?? "",
    country: billing.country || "India",
    phone: customer.phone ?? billing.phone ?? "",
    email: customer.email ?? billing.email ?? "",
  };
}

function roleCanWrite(role: string) {
  return ["owner", "admin", "manager"].includes(role.toLowerCase());
}

function gstinStateCode(gstin: string | null | undefined) {
  const value = (gstin ?? "").trim().toUpperCase();
  return /^\d{2}[A-Z0-9]{13}$/.test(value) ? value.slice(0, 2) : "";
}

function normalizeState(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/&/g, "and");
}

function deriveSupplyType(
  sellerGstin: string | null | undefined,
  buyerGstin: string | null | undefined,
  sellerState: string | null | undefined,
  buyerState: string | null | undefined,
): "intra_state" | "inter_state" {
  const sellerCode = gstinStateCode(sellerGstin);
  const buyerCode = gstinStateCode(buyerGstin);
  if (sellerCode && buyerCode) {
    return sellerCode === buyerCode ? "intra_state" : "inter_state";
  }
  const seller = normalizeState(sellerState);
  const buyer = normalizeState(buyerState);
  if (seller && buyer) return seller === buyer ? "intra_state" : "inter_state";
  // Conservative fallback: don't assume inter-state when GSTIN/state data is missing.
  return "intra_state";
}

function getNextInvoiceNumber(existingInvoices: Pick<Invoice, "invoice_number">[]) {
  // Invoice rows are loaded newest-first. Continue the most recently saved
  // invoice's numbering series and preserve its prefix, separator and padding.
  for (const invoice of existingInvoices) {
    const current = String(invoice.invoice_number ?? "").trim();
    const match = current.match(/^(.*?)(\\d+)$/);
    if (!match) continue;

    const prefix = match[1];
    const digits = match[2];
    const next = String(Number(digits) + 1).padStart(digits.length, "0");
    return `${prefix}${next}`;
  }

  return "INV 001";
}

const emptyAddress: Address = {
  name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  gstin: "",
  phone: "",
};

export default function SalesWorkspace({ companies }: { companies: Company[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [companyLogoDataUrl, setCompanyLogoDataUrl] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewInvoiceNumber, setPreviewInvoiceNumber] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("classic");

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCustomerName, setEmailCustomerName] = useState("Customer");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailAttachment, setEmailAttachment] = useState<File | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const openInvoiceEmailDraft = async (invoice: Invoice) => {
    const recipient = invoice.customers?.email?.trim();
    if (!recipient) {
      setError(`No email address is saved for ${invoice.customers?.name || "this customer"}. Add the customer's email address and try again.`);
      return;
    }

    setError("");
    setSuccess("");
    setPreviewLoading(true);
    const { data: lineData, error: lineError } = await supabase
      .from("sales_invoice_lines")
      .select("description,hsn_sac,quantity,unit,rate,discount,gst_rate,taxable_value,cgst,sgst,igst,line_total")
      .eq("company_id", companyId)
      .eq("invoice_id", invoice.id)
      .order("created_at");

    if (lineError) {
      setPreviewLoading(false);
      setError(`Unable to prepare invoice attachment: ${lineError.message}`);
      return;
    }

    const pdfUrl = buildPdf(invoice, (lineData ?? []) as Record<string, unknown>[], "preview");
    if (!pdfUrl) {
      setPreviewLoading(false);
      setError("Unable to prepare the invoice PDF.");
      return;
    }

    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const safeName = `${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
      setEmailAttachment(new File([blob], safeName, { type: "application/pdf" }));
    } catch {
      setEmailAttachment(null);
      setError("The email draft is ready, but the PDF attachment could not be prepared. You can still download the invoice separately.");
    } finally {
      URL.revokeObjectURL(pdfUrl);
      setPreviewLoading(false);
    }

    const companyName = companyDetails?.legal_name || companyDetails?.name || "Great Books";
    const balanceDue = Math.max(0, asNumber(invoice.grand_total) - asNumber(invoice.amount_paid));
    const { data: authData } = await supabase.auth.getUser();
    const signedInEmail = authData.user?.email || companyDetails?.email || "";
    const signedInName = authData.user?.user_metadata?.full_name || authData.user?.user_metadata?.name || companyDetails?.name || "Great Books";
    setEmailFrom(`${signedInName} <${signedInEmail}>`);
    setEmailCustomerName(invoice.customers?.name || "Customer");
    setEmailTo(recipient);
    setEmailCc("");
    setEmailBcc("");
    setShowBcc(false);
    setEmailSubject(`Invoice ${invoice.invoice_number} from ${companyName}`);
    setEmailBody(
      `<p>Dear ${invoice.customers?.name || "Customer"},</p>
       <p>Please find attached invoice <strong>${invoice.invoice_number}</strong>.</p>
       <table style="border-collapse:collapse;width:100%;max-width:560px">
         <tr><td style="padding:8px;border:1px solid #e5e7eb">Invoice date</td><td style="padding:8px;border:1px solid #e5e7eb">${invoice.invoice_date}</td></tr>
         <tr><td style="padding:8px;border:1px solid #e5e7eb">Due date</td><td style="padding:8px;border:1px solid #e5e7eb">${invoice.due_date || "As agreed"}</td></tr>
         <tr><td style="padding:8px;border:1px solid #e5e7eb">Invoice total</td><td style="padding:8px;border:1px solid #e5e7eb">${formatMoney(asNumber(invoice.grand_total), currency)}</td></tr>
         <tr><td style="padding:8px;border:1px solid #e5e7eb">Amount paid</td><td style="padding:8px;border:1px solid #e5e7eb">${formatMoney(asNumber(invoice.amount_paid), currency)}</td></tr>
         <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Balance due</strong></td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${formatMoney(balanceDue, currency)}</strong></td></tr>
       </table>
       <p>Please review the attached invoice and let us know if you have any questions.</p>
       <p>Regards,<br/><strong>${companyName}</strong><br/>${companyDetails?.email || ""}<br/>${companyDetails?.phone || ""}</p>`
    );
    setEmailOpen(true);
  };

  const formatEmailBody = (command: "bold" | "italic" | "underline") => {
    document.execCommand(command, false);
  };

  const submitInvoiceEmail = async () => {
    setError("Your email draft is ready, but email sending is not connected yet. Configure an email provider (for example, Resend or SMTP) to enable Send.");
  };
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Load the saved company logo once as a data URL so jsPDF can embed it in
  // every invoice format (including previews and downloads).
  useEffect(() => {
    let cancelled = false;
    const savedLogo = companyDetails?.logo_url?.trim();
    setCompanyLogoDataUrl(null);
    if (!savedLogo) return;

    const logoUrl = savedLogo.startsWith("https://") || savedLogo.startsWith("http://")
      ? savedLogo
      : supabase.storage.from("company-logos").getPublicUrl(savedLogo).data.publicUrl;

    fetch(logoUrl)
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load company logo");
        return response.blob();
      })
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Invalid logo image"));
        reader.onerror = () => reject(new Error("Unable to read company logo"));
        reader.readAsDataURL(blob);
      }))
      .then((dataUrl) => {
        if (!cancelled) setCompanyLogoDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setCompanyLogoDataUrl(null);
      });

    return () => { cancelled = true; };
  }, [companyDetails?.logo_url]);

  // Close any open dropdown (Bulk options / More actions) when the user
  // clicks or taps anywhere outside that dropdown.
  useEffect(() => {
    function closeDropdownsOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((dropdown) => {
        if (!dropdown.contains(target)) {
          dropdown.open = false;
        }
      });
    }

    document.addEventListener("pointerdown", closeDropdownsOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeDropdownsOnOutsideClick);
  }, []);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [shipping, setShipping] = useState<Address>({ ...emptyAddress });
  const [copyBillingToShipping, setCopyBillingToShipping] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [buyerOrderNumber, setBuyerOrderNumber] = useState("");
  const [dispatchDocumentNumber, setDispatchDocumentNumber] = useState("");
  const [deliveryNoteDate, setDeliveryNoteDate] = useState("");
  const [dispatchedThrough, setDispatchedThrough] = useState("");
  const [destination, setDestination] = useState("");
  const [lrRrNumber, setLrRrNumber] = useState("");
  const [billOfLadingDate, setBillOfLadingDate] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [termsOfDelivery, setTermsOfDelivery] = useState("");
  const [packageCount, setPackageCount] = useState("");
  const [packageKind, setPackageKind] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([makeLine()]);

  const company = companies.find((c) => c.id === companyId);
  const currency = company?.currency || "INR";
  const mayWrite = roleCanWrite(company?.role ?? "");
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const supplyType = deriveSupplyType(
    companyDetails?.gstin,
    selectedCustomer?.gstin,
    companyDetails?.state,
    selectedCustomer?.billing_address?.state || placeOfSupply,
  );

  const loadData = useCallback(async () => {
    if (!companyId) {
      setCustomers([]);
      setItems([]);
      setInvoices([]);
      setCompanyDetails(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [companyResult, settingsResult, customerResult, itemResult, invoiceResult] =
      await Promise.all([
        supabase
          .from("companies")
          .select(
            "name,legal_name,gstin,pan,email,phone,address_line1,address_line2,city,state,postal_code,country"
          )
          .eq("id", companyId)
          .maybeSingle(),

        (supabase as any)
          .from("company_settings")
          .select("*")
          .eq("company_id", companyId)
          .maybeSingle(),

        supabase
          .from("customers")
          .select(
            "id,name,email,phone,gstin,billing_address,payment_terms_days"
          )
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("items")
          .select("id,code,name,unit,hsn_sac,gst_rate,selling_price")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("sales_invoices")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

    if (companyResult.error || settingsResult.error || customerResult.error || itemResult.error || invoiceResult.error) {
      setError(
        [
          companyResult.error?.message,
          settingsResult.error?.message,
          customerResult.error?.message,
          itemResult.error?.message,
          invoiceResult.error?.message,
        ].filter(Boolean).join(" | ")
      );
    }

    setSelectedTemplate(settingsResult.data?.invoice_format === "minimal" ? "standard" : (settingsResult.data?.invoice_format || "classic"));
    setCompanyDetails(
      companyResult.data
        ? ({
            ...companyResult.data,
            // Company profile is stored in company_settings by the Settings page.
            legal_name: settingsResult.data?.legal_name || companyResult.data.legal_name || companyResult.data.name,
            name: settingsResult.data?.display_name || companyResult.data.name,
            gstin: settingsResult.data?.gstin || companyResult.data.gstin,
            pan: settingsResult.data?.pan || companyResult.data.pan,
            email: settingsResult.data?.business_email || companyResult.data.email,
            phone: settingsResult.data?.phone || companyResult.data.phone,
            address_line1: settingsResult.data?.address_line1 || companyResult.data.address_line1,
            address_line2: settingsResult.data?.address_line2 || companyResult.data.address_line2,
            city: settingsResult.data?.city || companyResult.data.city,
            state: settingsResult.data?.state || companyResult.data.state,
            postal_code: settingsResult.data?.pincode || companyResult.data.postal_code,
            country: settingsResult.data?.country || companyResult.data.country,
            bank_account_holder: settingsResult.data?.bank_account_holder ?? null,
            bank_name: settingsResult.data?.bank_name ?? null,
            bank_account_number: settingsResult.data?.bank_account_number ?? null,
            bank_ifsc: settingsResult.data?.bank_ifsc ?? null,
            bank_branch: settingsResult.data?.bank_branch ?? null,
            bank_account_type: settingsResult.data?.bank_account_type ?? null,
            invoice_format: settingsResult.data?.invoice_format || "classic",
            logo_url: settingsResult.data?.logo_url || null,
          } as CompanyDetails)
        : null
    );
    setCustomers((customerResult.data ?? []) as Customer[]);
    setItems((itemResult.data ?? []) as Item[]);

    const loadedInvoices = (invoiceResult.data ?? []) as unknown as Invoice[];
    const customerMap = new Map(
      ((customerResult.data ?? []) as Customer[]).map((c) => [c.id, c])
    );

    setInvoices(
      loadedInvoices.map((inv) => ({
        ...inv,
        customers: customerMap.get(inv.customer_id) ?? null,
        shipping_address: inv.shipping_address ?? {},
      }))
    );
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    setActiveInvoiceId(null);
    setPreviewUrl(null);
    setPreviewInvoiceNumber("");
    setSelectedInvoiceIds([]);
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedInvoiceIds([]);
  }, [companyId]);

  const calculated = useMemo<CalculatedLine[]>(() => {
    return lines.map((line) => {
      const qty = Math.max(0, asNumber(line.quantity));
      const rate = Math.max(0, asNumber(line.rate));
      const discount = Math.min(
        round2(qty * rate),
        Math.max(0, asNumber(line.discount))
      );
      const taxable = round2(qty * rate - discount);
      const tax = round2(taxable * Math.max(0, asNumber(line.gst_rate)) / 100);
      const cgst = supplyType === "intra_state" ? round2(tax / 2) : 0;
      const sgst = supplyType === "intra_state" ? round2(tax - cgst) : 0;
      const igst = supplyType === "inter_state" ? tax : 0;

      return {
        ...line,
        qty,
        taxable,
        cgst,
        sgst,
        igst,
        total: round2(taxable + cgst + sgst + igst),
      };
    });
  }, [lines, supplyType]);

  const totals = useMemo(() => {
    const subtotal = round2(
      calculated.reduce((sum, line) => sum + line.qty * asNumber(line.rate), 0)
    );
    const discount = round2(
      calculated.reduce((sum, line) => sum + Math.min(
        line.qty * asNumber(line.rate),
        Math.max(0, asNumber(line.discount))
      ), 0)
    );
    const taxable = round2(calculated.reduce((sum, line) => sum + line.taxable, 0));
    const cgst = round2(calculated.reduce((sum, line) => sum + line.cgst, 0));
    const sgst = round2(calculated.reduce((sum, line) => sum + line.sgst, 0));
    const igst = round2(calculated.reduce((sum, line) => sum + line.igst, 0));
    const beforeRound = round2(taxable + cgst + sgst + igst);
    const grand = Math.round(beforeRound);

    return {
      subtotal,
      discount,
      cgst,
      sgst,
      igst,
      roundOff: round2(grand - beforeRound),
      grand,
    };
  }, [calculated]);

  const filteredInvoices = invoices.filter((inv) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      inv.invoice_number,
      inv.customers?.name,
      inv.invoice_date,
      inv.status,
    ].some((value) => value?.toLowerCase().includes(q));
  });

  function resetForm() {
    setEditingInvoiceId(null);
    setInvoiceNumber(getNextInvoiceNumber(invoices));
    setInvoiceDate(today());
    setDueDate("");
    setCustomerId("");
    setPlaceOfSupply("");
    setShipping({ ...emptyAddress });
    setCopyBillingToShipping(false);
    setDeliveryNote("");
    setPaymentTerms("");
    setReferenceNumber("");
    setBuyerOrderNumber("");
    setDispatchDocumentNumber("");
    setDeliveryNoteDate("");
    setDispatchedThrough("");
    setDestination("");
    setLrRrNumber("");
    setBillOfLadingDate("");
    setVehicleNumber("");
    setTermsOfDelivery("");
    setPackageCount("");
    setPackageKind("");
    setNotes("");
    setLines([makeLine()]);
    setError("");
  }

  function openNewInvoice() {
    if (!mayWrite) {
      setError("Your role cannot create invoices. Contact your company administrator.");
      return;
    }
    resetForm();
    setSuccess("");
    setModalOpen(true);
  }

  async function openEditInvoice(invoice: Invoice) {
    if (!mayWrite) {
      setError("Your role cannot edit invoices. Contact your company administrator.");
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    const { data: lineData, error: lineError } = await supabase
      .from("sales_invoice_lines")
      .select("id,item_id,description,hsn_sac,quantity,unit,rate,discount,gst_rate")
      .eq("company_id", companyId)
      .eq("invoice_id", invoice.id)
      .order("created_at");

    setSaving(false);

    if (lineError) {
      setError(`Unable to load invoice for editing: ${lineError.message}`);
      return;
    }

    setEditingInvoiceId(invoice.id);
    setSelectedTemplate(invoice.invoice_format || "classic");
    setInvoiceNumber(invoice.invoice_number ?? "");
    setInvoiceDate(invoice.invoice_date ?? today());
    setDueDate(invoice.due_date ?? "");
    setCustomerId(invoice.customer_id ?? "");
    setPlaceOfSupply(invoice.place_of_supply ?? "");
    setShipping({ ...emptyAddress, ...(invoice.shipping_address ?? {}) });
    setCopyBillingToShipping(false);
    setDeliveryNote(invoice.delivery_note ?? "");
    setPaymentTerms(invoice.payment_terms ?? "");
    setReferenceNumber(invoice.reference_number ?? "");
    setBuyerOrderNumber(invoice.buyer_order_number ?? "");
    setDispatchDocumentNumber(invoice.dispatch_document_number ?? "");
    setDeliveryNoteDate(invoice.delivery_note_date ?? "");
    setDispatchedThrough(invoice.dispatched_through ?? "");
    setDestination(invoice.destination ?? "");
    setLrRrNumber(invoice.lr_rr_number ?? "");
    setBillOfLadingDate(invoice.bill_of_lading_date ?? "");
    setVehicleNumber(invoice.vehicle_number ?? "");
    setTermsOfDelivery(invoice.terms_of_delivery ?? "");
    setPackageCount("");
    setPackageKind("");
    setNotes(invoice.notes ?? "");
    const editableLines: Line[] = (lineData ?? []).map((row: any) => ({
      key: `${row.id ?? Date.now()}-${Math.random()}`,
      item_id: row.item_id ?? "",
      description: row.description ?? "",
      hsn_sac: row.hsn_sac ?? "",
      quantity: String(row.quantity ?? 1),
      unit: row.unit ?? "KGS",
      rate: String(row.rate ?? 0),
      discount: String(row.discount ?? 0),
      gst_rate: String(row.gst_rate ?? 0),
    }));
    setLines(editableLines.length ? editableLines : [makeLine()]);
    setModalOpen(true);
  }

  function updateShipping(field: keyof Address, value: string) {
    setShipping((prev) => ({ ...prev, [field]: value }));
  }

  function updateLine(key: string, field: keyof Line, value: string) {
    setLines((prev) => prev.map((line) => {
      if (line.key !== key) return line;
      if (field === "item_id" && value) {
        const item = items.find((i) => i.id === value);
        if (item) {
          return {
            ...line,
            item_id: item.id,
            description: item.name,
            hsn_sac: item.hsn_sac ?? "",
            quantity: "1",
            unit: item.unit || "KGS",
            rate: String(item.selling_price ?? 0),
            gst_rate: String(item.gst_rate ?? 0),
          };
        }
      }
      return { ...line, [field]: value };
    }));
  }

  function buildPdf(
    invoice: Invoice,
    invoiceLines: Record<string, unknown>[],
    outputMode: "download" | "preview" = "download",
  ): string | null {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const right = pageWidth - margin;
    const width = right - margin;
    const seller = companyDetails;
    type InvoiceFormat = "classic" | "standard" | "spreadsheet";
    // Existing and legacy invoices default to the original A4 layout.
    const savedFormat = invoice.invoice_format || "classic";
    const invoiceFormat: InvoiceFormat =
      savedFormat === "standard" || savedFormat === "spreadsheet"
        ? savedFormat
        : "classic";
    const customer = invoice.customers;
    const ship = invoice.shipping_address ?? {};
    const sellerName = seller?.legal_name || seller?.name || company?.name || "Company";
    const sellerAddressLines = [
      seller?.address_line1,
      seller?.address_line2,
      [seller?.city, seller?.postal_code].filter(Boolean).join(", "),
      [seller?.state, seller?.country].filter(Boolean).join(", "),
    ].map((line) => String(line ?? "").trim()).filter(Boolean);
    const buyerAddress = addressLines(customer?.billing_address);
    const shipAddress = addressLines(ship);
    const fmt = (v: unknown) =>
      asNumber(v).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const shortDate = (v: unknown) => v ? String(v).slice(0, 10) : "-";
    const text = (value: unknown) => String(value ?? "").trim();
    const put = (
      value: string,
      x: number,
      y: number,
      size = 7,
      bold = false,
      align: "left" | "center" | "right" = "left",
    ) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.text(value, x, y, { align });
    };
    const hline = (y: number, x1 = margin, x2 = right) => doc.line(x1, y, x2, y);
    const vline = (x: number, y1: number, y2: number) => doc.line(x, y1, x, y2);
    const wrapped = (value: string, maxWidth: number, size = 7) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      return doc.splitTextToSize(value, maxWidth);
    };

    // Only two alternate templates are available: Standard and Spreadsheet.
    // "classic" continues directly to the original, unchanged GST invoice below.
    if (invoiceFormat !== "classic") {
      const ink: [number, number, number] = [35, 42, 52];
      const accent: [number, number, number] =
        invoiceFormat === "spreadsheet" ? [55, 65, 75] : [55, 55, 55];
      const customerName = text(customer?.name) || "Customer";
      const sellerLines = [
        ...sellerAddressLines,
        seller?.gstin ? `GSTIN: ${seller.gstin}` : "",
        seller?.pan ? `PAN: ${seller.pan}` : "",
        seller?.phone ? `Phone: ${seller.phone}` : "",
        seller?.email || "",
      ].filter(Boolean);
      const billLines = [
        ...buyerAddress,
        customer?.gstin ? `GSTIN: ${customer.gstin}` : "",
        customer?.phone ? `Phone: ${customer.phone}` : "",
      ].filter(Boolean);
      const shipLines = [
        ...shipAddress,
        ship.gstin ? `GSTIN: ${ship.gstin}` : "",
        ship.phone ? `Phone: ${ship.phone}` : "",
      ].filter(Boolean);
      const rows = invoiceLines.map((line, index) => ({
        no: String(index + 1),
        description: text(line.description),
        hsn: text(line.hsn_sac) || "-",
        qty: `${fmt(line.quantity)} ${text(line.unit)}`.trim(),
        rate: fmt(line.rate),
        taxable: fmt(line.taxable_value),
        cgst: asNumber(line.cgst),
        sgst: asNumber(line.sgst),
        igst: asNumber(line.igst),
        gst: asNumber(line.gst_rate),
        total: fmt(line.line_total),
      }));
      const setInk = () => doc.setTextColor(...ink);
      const label = (v: string, x: number, y: number, size = 6.5) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        doc.setTextColor(100, 108, 120);
        doc.text(v, x, y);
      };
      const value = (v: string, x: number, y: number, size = 7, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        setInk();
        doc.text(v || "-", x, y);
      };
      const drawWrapped = (lines: string[], x: number, y: number, maxW: number, size = 6.5, lineGap = 2.8) => {
        let yy = y;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        for (const item of lines) {
          const parts = doc.splitTextToSize(item, maxW) as string[];
          for (const part of parts) {
            doc.text(part, x, yy);
            yy += lineGap;
          }
        }
        return yy;
      };
      const wrappedLineCount = (lines: string[], maxW: number, size = 6.5) =>
        lines.reduce((n, line) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(size);
          return n + (doc.splitTextToSize(line, maxW) as string[]).length;
        }, 0);
      const sellerTitle = (seller?.legal_name || seller?.name || company?.name || "Company").toUpperCase();
      const taxTotal = asNumber(invoice.cgst_total) + asNumber(invoice.sgst_total) + asNumber(invoice.igst_total);
      const taxable = invoiceLines.reduce((sum, line) => sum + asNumber(line.taxable_value), 0);
      const bank = [
        seller?.bank_name ? `Bank: ${seller.bank_name}` : "",
        seller?.bank_account_number ? `A/c: ${seller.bank_account_number}` : "",
        seller?.bank_branch ? `Branch: ${seller.bank_branch}` : "",
        seller?.bank_ifsc ? `IFSC: ${seller.bank_ifsc}` : "",
      ].filter(Boolean);
      const isInterState = invoice.supply_type === "inter_state" || asNumber(invoice.igst_total) > 0;
      const dateText = (v: unknown) => v ? String(v).slice(0, 10) : "-";

      doc.setProperties({ title: `Tax Invoice ${invoice.invoice_number}`, subject: "Sales invoice", creator: "Great Books" });
      doc.setLineWidth(0.25);
      doc.setDrawColor(...accent);
      setInk();

      if (invoiceFormat === "standard") {
        // Standard template follows the supplied clean Zoho-style reference:
        // open party blocks, invoice meta on the right, dark table header and right totals.
        doc.setFont("helvetica", "bold");
        doc.setFontSize(19);
        doc.setTextColor(...accent);
        doc.text("TAX INVOICE", right, 20, { align: "right" });
        doc.setFontSize(8);
        doc.text(`# ${text(invoice.invoice_number)}`, right, 27, { align: "right" });
        label("BALANCE DUE", right, 37);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        setInk();
        doc.text(`Rs. ${fmt(Math.max(0, asNumber(invoice.grand_total) - asNumber(invoice.amount_paid)))}`, right, 43, { align: "right" });

        if (companyLogoDataUrl) {
          try { doc.addImage(companyLogoDataUrl, companyLogoDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG", margin, 28, 21, 21, undefined, "FAST"); } catch {}
        }
        const standardSellerX = companyLogoDataUrl ? margin + 25 : margin;
        const standardSellerW = companyLogoDataUrl ? 82 : 105;
        value(sellerTitle, standardSellerX, 30, 9, true);
        drawWrapped(sellerLines, standardSellerX, 36, standardSellerW, 6.7, 3.1);

        const billTop = 82;
        label("Bill To", margin, billTop);
        value(customerName, margin, billTop + 7, 8, true);
        const billBottom = drawWrapped(billLines, margin, billTop + 12, 105, 6.6, 3.0);

        const shipTop = Math.max(billTop + 39, billBottom + 4);
        label("Ship To", margin, shipTop);
        value(text(ship.name) || customerName, margin, shipTop + 7, 8, true);
        const shipBottom = drawWrapped(shipLines, margin, shipTop + 12, 105, 6.6, 3.0);

        const metaX = 137;
        const metaY = shipTop + 3;
        label("Invoice Date", metaX, metaY);
        value(dateText(invoice.invoice_date), metaX + 27, metaY, 7);
        label("Terms", metaX, metaY + 10);
        value(text(invoice.payment_terms) || "Due on Receipt", metaX + 27, metaY + 10, 7);
        label("Due Date", metaX, metaY + 20);
        value(dateText(invoice.due_date), metaX + 27, metaY + 20, 7);

        const supplyY = Math.max(shipBottom + 5, metaY + 31);
        label(`Place Of Supply: ${text(invoice.place_of_supply) || text(seller?.state) || "-"}`, margin, supplyY, 7);

        const tableTop = supplyY + 9;
        const cols = [
          { title: "#", x: margin, w: 8, align: "left" as const },
          { title: "Item & Description", x: margin + 8, w: 65, align: "left" as const },
          { title: "HSN/SAC", x: margin + 73, w: 20, align: "left" as const },
          { title: "Qty", x: margin + 93, w: 20, align: "right" as const },
          { title: "Rate", x: margin + 113, w: 19, align: "right" as const },
          { title: "CGST", x: margin + 132, w: 17, align: "right" as const },
          { title: "SGST", x: margin + 149, w: 17, align: "right" as const },
          { title: "Amount", x: margin + 166, w: 24, align: "right" as const },
        ];
        doc.setFillColor(55, 55, 55);
        doc.rect(margin, tableTop, width, 10, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);
        cols.forEach((c) => doc.text(c.title, c.align === "right" ? c.x + c.w - 1.5 : c.x + 1.5, tableTop + 6.5, { align: c.align }));

        let y = tableTop + 17;
        rows.forEach((r, i) => {
          const desc = doc.splitTextToSize(r.description, 62) as string[];
          const rowH = Math.max(12, desc.length * 3 + 5);
          doc.setTextColor(...ink);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.text(r.no, cols[0].x + 2, y);
          doc.text(desc, cols[1].x + 1.5, y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.2);
          doc.text(r.hsn, cols[2].x + 1, y);
          doc.text(r.qty, cols[3].x + cols[3].w - 1.5, y, { align: "right" });
          doc.text(r.rate, cols[4].x + cols[4].w - 1.5, y, { align: "right" });
          const cgstText = r.igst > 0 ? "-" : `${fmt(r.cgst)}\n${(r.gst / 2).toFixed(2)}%`;
          const sgstText = r.igst > 0 ? "-" : `${fmt(r.sgst)}\n${(r.gst / 2).toFixed(2)}%`;
          doc.text(cgstText.split("\n"), cols[5].x + cols[5].w - 1.5, y, { align: "right" });
          doc.text(sgstText.split("\n"), cols[6].x + cols[6].w - 1.5, y, { align: "right" });
          doc.text(r.total, cols[7].x + cols[7].w - 1.5, y, { align: "right" });
          doc.setDrawColor(215, 218, 222);
          doc.line(margin, y + rowH - 3, right, y + rowH - 3);
          y += rowH;
        });

        y += 3;
        const totalsX = 133;
        const totals = [
          ["Sub Total", taxable],
          ...(isInterState
            ? [["IGST", asNumber(invoice.igst_total)] as [string, number]]
            : [["CGST", asNumber(invoice.cgst_total)] as [string, number], ["SGST", asNumber(invoice.sgst_total)] as [string, number]]),
          ["Total", asNumber(invoice.grand_total)],
          ["Payment Made", -asNumber(invoice.amount_paid)],
          ["Balance Due", Math.max(0, asNumber(invoice.grand_total) - asNumber(invoice.amount_paid))],
        ] as [string, number][];
        totals.forEach(([name, amount], index) => {
          doc.setFont("helvetica", index === 2 || index === 4 ? "bold" : "normal");
          doc.setFontSize(index === 2 || index === 4 ? 7.5 : 7);
          setInk();
          doc.text(name, totalsX, y);
          doc.text(`${amount < 0 ? "(-) " : "Rs. "}${fmt(Math.abs(amount))}`, right, y, { align: "right" });
          y += 6;
        });

        const lowerY = Math.max(y + 7, 235);
        label("Total In Words", margin, lowerY);
        value(amountInWords(invoice.grand_total), margin, lowerY + 5, 7, true);
        label("Notes", margin, lowerY + 15);
        drawWrapped([text(invoice.notes) || "Thanks for your business."], margin, lowerY + 20, 95, 6.5, 3);
        label("Terms & Conditions", margin, lowerY + 34);
        drawWrapped(
          ["1. Our Responsibility Ceases When goods leave our Factory.", "2. Goods once sold will not be taken back. Subject to Tirupur Jurisdiction."],
          margin, lowerY + 39, 105, 6.1, 2.8
        );
        drawWrapped(bank, 125, lowerY + 17, 75, 6.1, 2.8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text("Authorised Signature", right, 284, { align: "right" });
      } else {
        // Spreadsheet template follows the supplied ruled A4 sample:
        // seller/header box, invoice meta, side-by-side Bill/Ship, GST split columns and totals.
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.3);
        doc.rect(margin, 12, width, 46);

        if (companyLogoDataUrl) {
          try { doc.addImage(companyLogoDataUrl, companyLogoDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG", margin + 5, 19, 29, 29, undefined, "FAST"); } catch {}
        }
        const spreadsheetSellerX = companyLogoDataUrl ? 48 : 63;
        const spreadsheetSellerW = companyLogoDataUrl ? 94 : 82;
        value(sellerTitle, spreadsheetSellerX, 19, 10, true);
        drawWrapped(sellerLines, spreadsheetSellerX, 24, spreadsheetSellerW, 6.1, 2.8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(17);
        setInk();
        doc.text("TAX INVOICE", right - 2, 52, { align: "right" });

        // Invoice metadata block with place of supply.
        const metaTop = 58;
        doc.rect(margin, metaTop, width, 23);
        const metaSplit = 110;
        doc.line(metaSplit, metaTop, metaSplit, metaTop + 23);
        const metaLeft = [
          [`#`, text(invoice.invoice_number)],
          ["Invoice Date", dateText(invoice.invoice_date)],
          ["Terms", text(invoice.payment_terms) || "Due on Receipt"],
          ["Due Date", dateText(invoice.due_date)],
        ];
        metaLeft.forEach(([k, v], i) => {
          const yy = metaTop + 5 + i * 5;
          label(k, margin + 2, yy, 6);
          value(v, margin + 31, yy, 6.4, true);
        });
        label("Place Of Supply", metaSplit + 2, metaTop + 7, 6);
        value(text(invoice.place_of_supply) || text(seller?.state) || "-", metaSplit + 35, metaTop + 7, 6.5, true);

        // Two equal-width party columns. Each box height is driven by wrapped content.
        const partyTop = metaTop + 23;
        const partyWidth = width / 2;
        const billCount = wrappedLineCount(billLines, partyWidth - 6, 6.1);
        const shipCount = wrappedLineCount(shipLines, partyWidth - 6, 6.1);
        const partyHeight = Math.max(34, 14 + Math.max(billCount, shipCount) * 2.65);
        doc.rect(margin, partyTop, partyWidth, partyHeight);
        doc.rect(margin + partyWidth, partyTop, partyWidth, partyHeight);
        label("Bill To", margin + 2, partyTop + 4, 6.2);
        value(customerName, margin + 2, partyTop + 9, 6.8, true);
        drawWrapped(billLines, margin + 2, partyTop + 13, partyWidth - 5, 6.1, 2.65);
        label("Ship To", margin + partyWidth + 2, partyTop + 4, 6.2);
        value(text(ship.name) || customerName, margin + partyWidth + 2, partyTop + 9, 6.8, true);
        drawWrapped(shipLines, margin + partyWidth + 2, partyTop + 13, partyWidth - 5, 6.1, 2.65);

        const tableTop = partyTop + partyHeight;
        const colWidths = [7, 43, 18, 16, 17, 10, 15, 10, 15, 39];
        const colX = [margin];
        colWidths.forEach((w) => colX.push(colX[colX.length - 1] + w));
        const headers = ["#", "Item & Description", "HSN/SAC", "Qty", "Rate", "CGST %", "CGST Amt", "SGST %", "SGST/IGST Amt", "Amount"];
        const headerH = 12;
        doc.setFillColor(238, 240, 242);
        doc.rect(margin, tableTop, width, headerH, "F");
        doc.setDrawColor(140, 145, 150);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.8);
        doc.setTextColor(...ink);
        headers.forEach((h, i) => {
          const lines = doc.splitTextToSize(h, colWidths[i] - 1.5) as string[];
          doc.text(lines, colX[i] + 0.8, tableTop + (lines.length > 1 ? 4.5 : 7.5));
        });
        let y = tableTop + headerH;
        rows.forEach((r) => {
          const descLines = doc.splitTextToSize(r.description, colWidths[1] - 2) as string[];
          const rowH = Math.max(10, descLines.length * 2.8 + 4);
          doc.rect(margin, y, width, rowH);
          for (let c = 1; c < colX.length - 1; c++) doc.line(colX[c], y, colX[c], y + rowH);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.8);
          doc.setTextColor(...ink);
          doc.text(r.no, colX[0] + 1, y + 6);
          doc.text(descLines, colX[1] + 1, y + 5.5);
          doc.text(r.hsn, colX[2] + 1, y + 6);
          doc.text(r.qty, colX[4] - 1, y + 6, { align: "right" });
          doc.text(r.rate, colX[5] - 1, y + 6, { align: "right" });
          doc.text(isInterState ? "-" : `${(r.gst / 2).toFixed(2)}%`, colX[6] - 1, y + 6, { align: "right" });
          doc.text(isInterState ? "-" : fmt(r.cgst), colX[7] - 1, y + 6, { align: "right" });
          doc.text(isInterState ? "-" : `${(r.gst / 2).toFixed(2)}%`, colX[8] - 1, y + 6, { align: "right" });
          doc.text(isInterState ? fmt(r.igst) : fmt(r.sgst), colX[9] - 1, y + 6, { align: "right" });
          doc.text(r.total, colX[10] - 1, y + 6, { align: "right" });
          y += rowH;
        });

        y += 1;
        const bottomTop = y;
        const summaryLeftW = 100;
        const summaryRightX = margin + summaryLeftW;
        const summaryRightW = width - summaryLeftW;
        const summaryH = 58;
        doc.rect(margin, bottomTop, summaryLeftW, summaryH);
        doc.rect(summaryRightX, bottomTop, summaryRightW, summaryH);
        label("Total In Words", margin + 2, bottomTop + 6, 6);
        value(amountInWords(invoice.grand_total), margin + 2, bottomTop + 11, 6.2, true);
        label("Notes", margin + 2, bottomTop + 20, 6);
        drawWrapped([text(invoice.notes) || "Thanks for your business."], margin + 2, bottomTop + 25, summaryLeftW - 4, 5.8, 2.6);
        label("Terms & Conditions", margin + 2, bottomTop + 35, 6);
        drawWrapped(
          ["1. Our Responsibility Ceases When goods leave our Factory.", "2. Goods once sold will not be taken back. Subject to Tirupur Jurisdiction."],
          margin + 2, bottomTop + 40, summaryLeftW - 4, 5.4, 2.4
        );

        const summaryRows: [string, number, boolean][] = [
          ["Sub Total", taxable, false],
          ...(isInterState
            ? [["IGST", asNumber(invoice.igst_total), false] as [string, number, boolean]]
            : [["CGST", asNumber(invoice.cgst_total), false] as [string, number, boolean], ["SGST", asNumber(invoice.sgst_total), false] as [string, number, boolean]]),
          ["Total", asNumber(invoice.grand_total), true],
          ["Payment Made", asNumber(invoice.amount_paid), false],
          ["Balance Due", Math.max(0, asNumber(invoice.grand_total) - asNumber(invoice.amount_paid)), true],
        ];
        let sumY = bottomTop + 7;
        summaryRows.forEach(([name, amount, bold]) => {
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setFontSize(6.2);
          setInk();
          doc.text(name, summaryRightX + 3, sumY);
          doc.text(`Rs. ${fmt(amount)}`, right - 2, sumY, { align: "right" });
          sumY += 8;
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.text("Authorised Signature", right - 2, bottomTop + summaryH - 3, { align: "right" });
        drawWrapped(bank, margin, Math.min(bottomTop + summaryH + 7, 278), 110, 5.8, 2.5);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(120, 125, 132);
      doc.text("This is a computer generated invoice.", pageWidth / 2, 291, { align: "center" });
      if (outputMode === "download") {
        doc.save(`${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`);
        return null;
      }
      return URL.createObjectURL(doc.output("blob"));
    }

    // The non-classic templates return above. This is the preserved original
    // GST invoice layout, so keep its original title, typography and borders.
    doc.setProperties({
      title: `Tax Invoice ${invoice.invoice_number}`,
      subject: "GST tax invoice",
      creator: "Great Books",
    });
    doc.setDrawColor(45, 45, 45);
    doc.setTextColor(20, 20, 20);
    doc.setLineWidth(0.22);

    // Original title and upper seller / invoice particulars block.
    put("Tax Invoice", pageWidth / 2, 9, 11, true, "center");
    const top = 12;
    const sellerW = 91;
    const split = margin + sellerW;
    const topBottom = 103;
    doc.rect(margin, top, width, topBottom - top);
    vline(split, top, topBottom);

    let sy = top + 5;
    const classicSellerX = companyLogoDataUrl ? margin + 23 : margin + 2;
    const classicSellerW = companyLogoDataUrl ? sellerW - 26 : sellerW - 5;
    if (companyLogoDataUrl) {
      try { doc.addImage(companyLogoDataUrl, companyLogoDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG", margin + 2, top + 5, 18, 18, undefined, "FAST"); } catch {}
    }
    const sellerHead = wrapped(sellerName.toUpperCase(), classicSellerW, 8.1);
    sellerHead.forEach((line: string) => {
      put(line, classicSellerX, sy, 8.1, true);
      sy += 3.6;
    });

    const sellerRows = [
      ...sellerAddressLines,
      ...(seller?.gstin ? [`GSTIN/UIN: ${seller.gstin}`] : []),
      ...(seller?.state || gstinStateCode(seller?.gstin)
        ? [`State Name: ${seller?.state || "-"}${gstinStateCode(seller?.gstin) ? `, Code: ${gstinStateCode(seller?.gstin)}` : ""}`]
        : []),
      ...(seller?.phone ? [`Contact: ${seller.phone}`] : []),
      ...(seller?.email ? [seller.email] : []),
    ];

    // Wrap every company line and use compact, consistent leading so the
    // company email never collides with the Consignee heading below it.
    const sellerTextLines = sellerRows.flatMap((line) =>
      wrapped(line, classicSellerW, 6.4) as string[]
    );
    sellerTextLines.forEach((line) => {
      put(line, classicSellerX, sy, 6.4);
      sy += 2.55;
    });

    const metaX = split + 1;
    const metaW = right - metaX;
    const metaRows = [
      [`Invoice No.`, text(invoice.invoice_number) || "-", `Dated`, shortDate(invoice.invoice_date)],
      [`Delivery Note`, text(invoice.delivery_note) || "-", `Mode/Terms of Payment`, text(invoice.payment_terms) || "-"],
      [`Reference No. & Date`, text(invoice.reference_number) || "-", `Other References`, "-"],
      [`Buyer's Order No.`, text(invoice.buyer_order_number) || "-", `Dated`, "-"],
      [`Dispatch Doc No.`, text(invoice.dispatch_document_number) || "-", `Delivery Note Date`, shortDate(invoice.delivery_note_date)],
      [`Dispatched through`, text(invoice.dispatched_through) || "-", `Destination`, text(invoice.destination) || "-"],
      [`Bill of Lading/LR-RR No.`, text(invoice.lr_rr_number) || "-", `Motor Vehicle No.`, text(invoice.vehicle_number) || "-"],
      [`Terms of Delivery`, text(invoice.terms_of_delivery) || "-", ``, ``],
    ];
    const metaRowH = (topBottom - top) / metaRows.length;
    const metaMid = metaX + metaW * 0.51;
    metaRows.forEach((row, i) => {
      const y = top + i * metaRowH;
      if (i > 0) hline(y, split, right);
      vline(metaMid, y, y + metaRowH);
      put(row[0], metaX + 1.5, y + 3.2, 6.5);
      put(row[1], metaX + 1.5, y + 7.1, 7, Boolean(row[1] !== "-"));
      if (row[2]) {
        put(row[2], metaMid + 1.5, y + 3.2, 6.5);
        put(row[3], metaMid + 1.5, y + 7.1, 7, Boolean(row[3] !== "-"));
      }
    });

    // Consignee and Buyer share the seller-side column, like the paper sample.
    const partyBottom = topBottom;
    const consigneeTop = Math.max(top + 27, sy + 1.4);
    hline(consigneeTop, margin, split);
    put("Consignee (Ship to)", margin + 2, consigneeTop + 3.2, 6.8, true);
    put(text(ship.name) || text(customer?.name) || "-", margin + 2, consigneeTop + 6.8, 7.0, true);

    const consigneeGstin = text(ship.gstin) || text(customer?.gstin);
    const consigneeState = text(ship.state) || text(customer?.billing_address?.state);
    const consigneeStateCode = gstinStateCode(consigneeGstin);
    const consigneeLines = [
      ...shipAddress,
      ...(consigneeGstin ? [`GSTIN/UIN: ${consigneeGstin}`] : []),
      ...(consigneeState ? [`State Name: ${consigneeState}${consigneeStateCode ? `, Code: ${consigneeStateCode}` : ""}`] : []),
      ...(ship.phone || customer?.phone ? [`Contact: ${text(ship.phone) || text(customer?.phone)}`] : []),
    ];
    const consigneeTextLines = consigneeLines.flatMap((line) =>
      wrapped(line, sellerW - 5, 6.1) as string[]
    );

    let cy = consigneeTop + 9.7;
    consigneeTextLines.forEach((line) => {
      put(line, margin + 2, cy, 6.1);
      cy += 2.35;
    });

    // Place the Bill to divider after the actual Ship to content, not at a
    // hard-coded coordinate. This prevents overlap for longer GST addresses.
    const buyerTop = cy + 1.2;
    hline(buyerTop, margin, split);
    put("Buyer (Bill to)", margin + 2, buyerTop + 3.2, 6.8, true);
    put(text(customer?.name) || "-", margin + 2, buyerTop + 6.8, 7.0, true);

    const buyerLines = [
      ...buyerAddress,
      ...(customer?.gstin ? [`GSTIN/UIN: ${customer.gstin}`] : []),
      ...(customer?.billing_address?.state
        ? [`State Name: ${customer.billing_address.state}${gstinStateCode(customer.gstin) ? `, Code: ${gstinStateCode(customer.gstin)}` : ""}`]
        : []),
      ...(customer?.phone ? [`Contact: ${customer.phone}`] : []),
    ];
    const buyerTextLines = buyerLines.flatMap((line) =>
      wrapped(line, sellerW - 5, 6.1) as string[]
    );

    let by = buyerTop + 9.7;
    const buyerLineGap = buyerTextLines.length
      ? Math.min(2.35, Math.max(1.85, (partyBottom - by - 1) / buyerTextLines.length))
      : 2.35;
    buyerTextLines.forEach((line) => {
      if (by <= partyBottom - 1) put(line, margin + 2, by, 6.1);
      by += buyerLineGap;
    });

    // Main goods table: two package columns followed by the sample's item columns.
    const tableTop = topBottom;
    const cols = [
      { label: "Sl.\nNo.", w: 7 },
      { label: "No. & Kind\nof Pkgs.", w: 15 },
      { label: "Description of Goods", w: 58 },
      { label: "HSN/SAC", w: 15 },
      { label: "Quantity", w: 21 },
      { label: "Rate", w: 16 },
      { label: "per", w: 10 },
      { label: "Amount", w: 48 },
    ];
    let x = margin;
    const xPositions = [margin];
    cols.forEach((col) => {
      x += col.w;
      xPositions.push(x);
    });
    const headerH = 9;
    const tableBottom = 205;
    const bodyTop = tableTop + headerH;
    doc.rect(margin, tableTop, width, tableBottom - tableTop);
    xPositions.slice(1, -1).forEach((lineX) => vline(lineX, tableTop, tableBottom));
    hline(bodyTop);
    cols.forEach((col, i) => {
      const lines = col.label.split("\n");
      lines.forEach((line, j) => {
        put(line, xPositions[i] + col.w / 2, tableTop + 3.3 + j * 3, 6.5, true, "center");
      });
    });

    const itemRows = invoiceLines.map((line, index) => ({
      sl: String(index + 1),
      pkg: index === 0 ? [text(invoice.package_count), text(invoice.package_kind)].filter(Boolean).join(" ") : "",
      description: text(line.description),
      hsn: text(line.hsn_sac) || "-",
      quantity: `${fmt(line.quantity)} ${text(line.unit)}`.trim(),
      rate: fmt(line.rate),
      per: text(line.unit) || "-",
      amount: fmt(line.line_total),
      cgst: asNumber(line.cgst),
      sgst: asNumber(line.sgst),
      igst: asNumber(line.igst),
      gstRate: asNumber(line.gst_rate),
    }));

    const rowCount = Math.max(itemRows.length, 1);
    const availableBodyH = tableBottom - bodyTop;
    const baseRowH = availableBodyH / rowCount;
    itemRows.forEach((row, index) => {
      const rowTop = bodyTop + index * baseRowH;
      const rowBottom = index === rowCount - 1 ? tableBottom : rowTop + baseRowH;
      const centerY = rowTop + 5;
      put(row.sl, xPositions[0] + cols[0].w / 2, centerY, 6.8, false, "center");
      put(row.pkg, xPositions[1] + 1, centerY, 6.8);
      const descLines = wrapped(row.description, cols[2].w - 3, 7);
      descLines.forEach((line: string, j: number) => put(line, xPositions[2] + 2, centerY + j * 3.2, 7, true));
      put(row.hsn, xPositions[3] + cols[3].w / 2, centerY, 6.6, false, "center");
      put(row.quantity, xPositions[4] + cols[4].w / 2, centerY, 6.7, false, "center");
      put(row.rate, xPositions[5] + cols[5].w - 1.5, centerY, 6.7, false, "right");
      put(row.per, xPositions[6] + cols[6].w / 2, centerY, 6.7, false, "center");
      put(row.amount, xPositions[7] + cols[7].w - 2, centerY, 7, false, "right");

      let taxY = centerY + Math.max(12, descLines.length * 3.2 + 4);
      if (row.cgst > 0) {
        put(`CGST ${row.gstRate / 2}%`, xPositions[2] + cols[2].w - 2, taxY, 7, true, "right");
        put(fmt(row.cgst), xPositions[7] + cols[7].w - 2, taxY, 7, false, "right");
        taxY += 3.5;
      }
      if (row.sgst > 0) {
        put(`SGST ${row.gstRate / 2}%`, xPositions[2] + cols[2].w - 2, taxY, 7, true, "right");
        put(fmt(row.sgst), xPositions[7] + cols[7].w - 2, taxY, 7, false, "right");
        taxY += 3.5;
      }
      if (row.igst > 0) {
        put(`IGST ${row.gstRate}%`, xPositions[2] + cols[2].w - 2, taxY, 7, true, "right");
        put(fmt(row.igst), xPositions[7] + cols[7].w - 2, taxY, 7, false, "right");
      }
    });

    // Total row immediately below the goods body.
    const totalY = tableBottom;
    const totalH = 7;
    doc.rect(margin, totalY, width, totalH);
    put("Total", xPositions[2] + cols[2].w - 2, totalY + 4.6, 7, true, "right");
    const quantityTotal = invoiceLines.reduce((sum, line) => sum + asNumber(line.quantity), 0);
    const quantityUnit = text(invoiceLines[0]?.unit);
    put(`${fmt(quantityTotal)}${quantityUnit ? ` ${quantityUnit}` : ""}`, xPositions[4] + cols[4].w - 1.5, totalY + 4.6, 6.5, true, "right");
    put(`Rs. ${fmt(invoice.grand_total)}`, right - 2, totalY + 4.6, 6.8, true, "right");

    let fy = totalY + totalH;
    doc.rect(margin, fy, width, 10);
    put("Amount Chargeable (in words)", margin + 2, fy + 3, 6.6);
    put(amountInWords(invoice.grand_total), margin + 2, fy + 7.3, 7.2, true);
    put("E. & O.E.", right - 2, fy + 7.3, 6.2, false, "right");
    fy += 10;

    // GST summary with grouped headings and a bold total row, matching the sample.
    const taxCols = [
      { label: "HSN/SAC", w: 38 },
      { label: "Taxable Value", w: 30 },
      { label: "Central Rate", w: 18 },
      { label: "Central Amount", w: 22 },
      { label: "State Rate", w: 18 },
      { label: "State Amount", w: 22 },
      { label: "Total Tax Amount", w: width - 148 },
    ];
    const taxHeaderH = 12;
    const taxDataH = 6;
    const taxTotalH = 6;
    let tx = margin;
    const taxXs = [margin];
    taxCols.forEach((col) => {
      tx += col.w;
      taxXs.push(tx);
    });

    const taxTableBottom = fy + taxHeaderH + taxDataH + taxTotalH;
    const taxGroupDividerY = fy + 6;

    // Outer border.
    doc.rect(margin, fy, width, taxHeaderH + taxDataH + taxTotalH);

    // Main vertical borders: HSN, taxable value, Central/State groups,
    // and Total Tax Amount span both header rows and the data rows.
    vline(taxXs[1], fy, taxTableBottom);
    vline(taxXs[2], fy, taxTableBottom);
    vline(taxXs[4], fy, taxTableBottom);
    vline(taxXs[6], fy, taxTableBottom);

    // Rate/Amount dividers begin below the group headings, matching the sample.
    vline(taxXs[3], taxGroupDividerY, taxTableBottom);
    vline(taxXs[5], taxGroupDividerY, taxTableBottom);

    // Group-heading separators appear only under Central Tax and State Tax.
    hline(taxGroupDividerY, taxXs[2], taxXs[4]);
    hline(taxGroupDividerY, taxXs[4], taxXs[6]);

    // Full-width lines below the subheadings and between data and total rows.
    hline(fy + taxHeaderH);
    hline(fy + taxHeaderH + taxDataH);

    put("HSN/SAC", taxXs[0] + taxCols[0].w / 2, fy + 7, 6.4, true, "center");
    put("Taxable Value", taxXs[1] + taxCols[1].w / 2, fy + 7, 6.4, true, "center");
    put("Central Tax", (taxXs[2] + taxXs[4]) / 2, fy + 4, 6.4, true, "center");
    put("Rate", taxXs[2] + taxCols[2].w / 2, fy + 10, 6.1, true, "center");
    put("Amount", taxXs[3] + taxCols[3].w / 2, fy + 10, 6.1, true, "center");
    put("State Tax", (taxXs[4] + taxXs[6]) / 2, fy + 4, 6.4, true, "center");
    put("Rate", taxXs[4] + taxCols[4].w / 2, fy + 10, 6.1, true, "center");
    put("Amount", taxXs[5] + taxCols[5].w / 2, fy + 10, 6.1, true, "center");
    put("Total Tax Amount", taxXs[6] + taxCols[6].w / 2, fy + 7, 6.2, true, "center");

    const taxableValue = invoiceLines.reduce((sum, line) => sum + asNumber(line.taxable_value), 0);
    const taxable = taxableValue || (asNumber(invoice.subtotal) - asNumber(invoice.discount_total));
    const cgstTotal = asNumber(invoice.cgst_total);
    const sgstTotal = asNumber(invoice.sgst_total);
    const igstTotal = asNumber(invoice.igst_total);
    const taxTotal = cgstTotal + sgstTotal + igstTotal;
    const centralRate = taxable > 0 ? (cgstTotal / taxable * 100).toFixed(2) + "%" : "-";
    const stateRate = taxable > 0 ? (sgstTotal / taxable * 100).toFixed(2) + "%" : "-";
    const hsnSummary = invoiceLines
      .map((line) => text(line.hsn_sac))
      .filter(Boolean)
      .filter((value, index, all) => all.indexOf(value) === index)
      .join(", ") || "-";
    const taxValues = [
      hsnSummary,
      fmt(taxable),
      invoice.supply_type === "inter_state" ? "-" : centralRate,
      fmt(cgstTotal),
      invoice.supply_type === "inter_state" ? "-" : stateRate,
      fmt(sgstTotal),
      fmt(taxTotal),
    ];
    taxCols.forEach((col, index) => {
      doc.setFont("helvetica", index === 0 ? "bold" : "normal");
      doc.setFontSize(6.2);
      doc.text(
        doc.splitTextToSize(taxValues[index], col.w - 2.5),
        taxXs[index] + col.w / 2,
        fy + taxHeaderH + 4,
        { align: "center" }
      );
    });

    const totalValues = ["Total", fmt(taxable), "", fmt(cgstTotal), "", fmt(sgstTotal), fmt(taxTotal)];
    taxCols.forEach((col, index) => {
      if (!totalValues[index]) return;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.2);
      doc.text(
        doc.splitTextToSize(totalValues[index], col.w - 2.5),
        taxXs[index] + col.w / 2,
        fy + taxHeaderH + taxDataH + 4,
        { align: "center" }
      );
    });
    fy += taxHeaderH + taxDataH + taxTotalH;
    put(`Tax Amount (in words):  ${amountInWords(taxTotal)}`, margin + 2, fy + 4, 6.8, true);
    fy += 7;

    // Three-column footer: declaration | bank details | signature.
    const footerH = 32;
    if (fy + footerH > pageHeight - 10) {
      fy = pageHeight - 10 - footerH;
    }

    doc.rect(margin, fy, width, footerH);
    const declarationRight = margin + width * 0.34;
    const bankRight = margin + width * 0.70;
    vline(declarationRight, fy, fy + footerH);
    vline(bankRight, fy, fy + footerH);

    // Declaration: remove PAN and align the heading and paragraph consistently.
    put("Declaration", margin + 2, fy + 6, 6.7, true);
    const declaration =
      "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";
   wrapped(declaration, declarationRight - margin - 5, 6.3).forEach(
  (line: string, index: number) => {
    put(line, margin + 2, fy + 11 + index * 3.1, 6.3);
  }
);

    // Bank labels stay regular weight; only the saved bank values are bold.
    const bankX = declarationRight + 2;
    put("Company's Bank Details", bankX, fy + 5, 6.8, true);
    const bankRows = [
      ["Bank Name:", seller?.bank_name?.trim() || "-"],
      ["A/c No.:", seller?.bank_account_number?.trim() || "-"],
      ["Branch:", seller?.bank_branch?.trim() || "-"],
      ["IFSC Code:", seller?.bank_ifsc?.trim()?.toUpperCase() || "-"],
    ] as const;

    bankRows.forEach(([label, value], index) => {
      const y = fy + 9.5 + index * 3.4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4);
      doc.text(label, bankX, y);
      const labelWidth = doc.getTextWidth(label);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.4);
      const maxValueWidth = bankRight - bankX - labelWidth - 4;
      const valueLines = doc.splitTextToSize(value, maxValueWidth);
      doc.text(valueLines, bankX + labelWidth + 1.2, y);
    });

    // Company name and signatory are both aligned to the right.
    // No horizontal signature rule is drawn.
    const signatureRight = right - 3;
    put(`for ${sellerName.toUpperCase()}`, signatureRight, fy + 9, 6.8, true, "right");
    put("Authorised Signatory", signatureRight, fy + footerH - 3, 6.2, false, "right");

    put("This is a Computer Generated Invoice", pageWidth / 2, pageHeight - 5, 6.8, false, "center");
    if (outputMode === "download") {
      doc.save(`${invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`);
      return null;
    }
    return URL.createObjectURL(doc.output("blob"));
  }

  async function saveInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!companyId) return setError("Select a company first.");
    if (!mayWrite) return setError("Your role cannot create invoices.");
    if (!customerId) return setError("Please select a customer.");
    if (!invoiceNumber.trim()) return setError("Please enter an invoice number.");
    if (calculated.some((l) => !l.description.trim() || l.qty <= 0)) {
      return setError("Each invoice line needs a description and a quantity above zero.");
    }

    setSaving(true);

    // Friendly duplicate check. A database unique index should also be added
    // to protect against two users saving the same number at the same time.
    const { data: matchingInvoice, error: numberCheckError } = await supabase
      .from("sales_invoices")
      .select("id")
      .eq("company_id", companyId)
      .eq("invoice_number", invoiceNumber.trim())
      .maybeSingle();

    if (numberCheckError) {
      setSaving(false);
      return setError(`Unable to verify invoice number: ${numberCheckError.message}`);
    }
    if (matchingInvoice && matchingInvoice.id !== editingInvoiceId) {
      setSaving(false);
      return setError(`Invoice number ${invoiceNumber.trim()} already exists. Please use the next invoice number.`);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setSaving(false);
      return setError("Your session expired. Please sign in again.");
    }

    const invoiceHeader = {
      company_id: companyId,
      customer_id: customerId,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      status: "issued",
      place_of_supply: placeOfSupply.trim() || null,
      supply_type: supplyType,
      shipping_address: {
        ...shipping,
        name: shipping.name?.trim() || customers.find((c) => c.id === customerId)?.name || "",
      },
      delivery_note: deliveryNote.trim(),
      payment_terms: paymentTerms.trim(),
      reference_number: referenceNumber.trim(),
      buyer_order_number: buyerOrderNumber.trim(),
      dispatch_document_number: dispatchDocumentNumber.trim(),
      delivery_note_date: deliveryNoteDate || null,
      dispatched_through: dispatchedThrough.trim(),
      destination: destination.trim(),
      lr_rr_number: lrRrNumber.trim(),
      bill_of_lading_date: billOfLadingDate || null,
      vehicle_number: vehicleNumber.trim(),
      terms_of_delivery: termsOfDelivery.trim(),
      package_count: "",
      package_kind: "",
      subtotal: totals.subtotal,
      discount_total: totals.discount,
      cgst_total: totals.cgst,
      sgst_total: totals.sgst,
      igst_total: totals.igst,
      round_off: totals.roundOff,
      grand_total: totals.grand,
      amount_paid: 0,
      notes: notes.trim() || null,
      invoice_format: selectedTemplate,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    let savedId = editingInvoiceId;
    let headerError: { message: string } | null = null;

    if (editingInvoiceId) {
      const { error } = await supabase
        .from("sales_invoices")
        .update(Object.fromEntries(Object.entries(invoiceHeader).filter(([key]) => key !== "created_by")))
        .eq("company_id", companyId)
        .eq("id", editingInvoiceId);
      headerError = error;
    } else {
      const { data: saved, error } = await supabase
        .from("sales_invoices")
        .insert(invoiceHeader)
        .select("id")
        .single();
      headerError = error;
      savedId = saved?.id ?? null;
    }

    if (headerError || !savedId) {
      setSaving(false);
      setError(`Invoice could not be saved: ${headerError?.message ?? "No invoice ID returned"}`);
      return;
    }

    const linePayload = calculated.map((line) => ({
      company_id: companyId,
      invoice_id: savedId,
      item_id: line.item_id || null,
      description: line.description.trim(),
      hsn_sac: line.hsn_sac.trim() || null,
      quantity: line.qty,
      unit: line.unit || "KGS",
      rate: Math.max(0, asNumber(line.rate)),
      discount: Math.max(0, asNumber(line.discount)),
      gst_rate: Math.max(0, asNumber(line.gst_rate)),
      taxable_value: line.taxable,
      cgst: line.cgst,
      sgst: line.sgst,
      igst: line.igst,
      line_total: line.total,
    }));

    if (editingInvoiceId) {
      const { error: deleteLinesError } = await supabase
        .from("sales_invoice_lines")
        .delete()
        .eq("company_id", companyId)
        .eq("invoice_id", editingInvoiceId);

      if (deleteLinesError) {
        setSaving(false);
        setError(`Invoice header updated, but old item lines could not be replaced: ${deleteLinesError.message}`);
        await loadData();
        return;
      }
    }

    const { error: linesError } = await supabase
      .from("sales_invoice_lines")
      .insert(linePayload);

    setSaving(false);

    if (linesError) {
      setError(`Invoice header saved, but item lines failed: ${linesError.message}. Check the invoice before retrying.`);
      await loadData();
      return;
    }

    const customer = customers.find((c) => c.id === customerId) ?? null;
    const savedInvoice = {
      id: savedId,
      ...invoiceHeader,
      customers: customer,
    } as unknown as Invoice;

    const wasEditing = Boolean(editingInvoiceId);
    setModalOpen(false);
    setEditingInvoiceId(null);
    setSuccess(`Invoice ${invoiceNumber} ${wasEditing ? "updated" : "saved"} successfully.`);
    await loadData();
    const nextPreviewUrl = buildPdf(
      savedInvoice,
      linePayload as unknown as Record<string, unknown>[],
      "preview",
    );
    if (nextPreviewUrl) {
      setPreviewUrl(nextPreviewUrl);
      setPreviewInvoiceNumber(savedInvoice.invoice_number);
      setActiveInvoiceId(savedInvoice.id);
    }
  }

  async function previewSavedPdf(invoice: Invoice) {
    setError("");
    setPreviewLoading(true);
    const { data, error: linesError } = await supabase
      .from("sales_invoice_lines")
      .select("description,hsn_sac,quantity,unit,rate,discount,gst_rate,taxable_value,cgst,sgst,igst,line_total")
      .eq("company_id", companyId)
      .eq("invoice_id", invoice.id)
      .order("created_at");
    setPreviewLoading(false);
    if (linesError) {
      setError(`Unable to load invoice preview: ${linesError.message}`);
      return;
    }
    const nextPreviewUrl = buildPdf(invoice, (data ?? []) as Record<string, unknown>[], "preview");
    if (nextPreviewUrl) {
      setPreviewUrl(nextPreviewUrl);
      setPreviewInvoiceNumber(invoice.invoice_number);
      setActiveInvoiceId(invoice.id);
      setSelectedTemplate(invoice.invoice_format || "classic");
    }
  }

  async function changeInvoiceTemplate(invoice: Invoice, template: string) {
    if (!mayWrite) {
      setError("Your role cannot change invoice templates.");
      return;
    }
    setError("");
    setSuccess("");
    setPreviewLoading(true);

    const { error: updateError } = await supabase
      .from("sales_invoices")
      .update({ invoice_format: template, updated_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("id", invoice.id);

    if (updateError) {
      setPreviewLoading(false);
      setError(`Unable to change invoice template: ${updateError.message}`);
      return;
    }

    const updatedInvoice = { ...invoice, invoice_format: template };
    setInvoices((current) => current.map((item) =>
      item.id === invoice.id ? { ...item, invoice_format: template } : item
    ));
    setSelectedTemplate(template);

    const { data: lineData, error: lineError } = await supabase
      .from("sales_invoice_lines")
      .select("description,hsn_sac,quantity,unit,rate,discount,gst_rate,taxable_value,cgst,sgst,igst,line_total")
      .eq("company_id", companyId)
      .eq("invoice_id", invoice.id)
      .order("created_at");

    setPreviewLoading(false);
    if (lineError) {
      setError(`Template saved, but preview could not be refreshed: ${lineError.message}`);
      return;
    }

    const nextUrl = buildPdf(updatedInvoice, (lineData ?? []) as Record<string, unknown>[], "preview");
    if (nextUrl) {
      setPreviewUrl(nextUrl);
      setPreviewInvoiceNumber(invoice.invoice_number);
      setSuccess(`Template changed to ${template === "classic" ? "Existing Invoice" : template} for ${invoice.invoice_number}.`);
    }
  }

  async function downloadSavedPdf(invoice: Invoice) {
    setError("");
    const { data, error: linesError } = await supabase
      .from("sales_invoice_lines")
      .select("description,hsn_sac,quantity,unit,rate,discount,gst_rate,taxable_value,cgst,sgst,igst,line_total")
      .eq("company_id", companyId)
      .eq("invoice_id", invoice.id)
      .order("created_at");

    if (linesError) {
      setError(`Unable to load invoice lines: ${linesError.message}`);
      return;
    }

    buildPdf(invoice, (data ?? []) as Record<string, unknown>[]);
  }

  async function cancelInvoice(invoice: Invoice) {
    if (!mayWrite) {
      setError("Your role cannot cancel invoices.");
      return;
    }
    if (!window.confirm(`Cancel invoice ${invoice.invoice_number}? The record will be retained.`)) return;

    const { error: cancelError } = await supabase
      .from("sales_invoices")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("company_id", companyId)
      .eq("id", invoice.id);

    if (cancelError) {
      setError(`Unable to cancel invoice: ${cancelError.message}`);
    } else {
      setSuccess(`Invoice ${invoice.invoice_number} cancelled.`);
      await loadData();
    }
  }

  async function deleteInvoice(invoice: Invoice) {
    if (!mayWrite) return setError("Your role cannot delete invoices.");
    if (!window.confirm(
      `Permanently delete invoice ${invoice.invoice_number}, its recorded customer payments and item lines? This cannot be undone.`
    )) return;

    setError("");
    setSuccess("");
    setSaving(true);

    // Remove dependent payment records first to satisfy the customer_payments
    // foreign key that references this invoice.
    const { error: paymentDeleteError } = await supabase
      .from("customer_payments")
      .delete()
      .eq("company_id", companyId)
      .eq("invoice_id", invoice.id);

    if (paymentDeleteError) {
      setSaving(false);
      return setError(`Unable to delete linked customer payments: ${paymentDeleteError.message}`);
    }

    const { error: lineDeleteError } = await supabase
      .from("sales_invoice_lines")
      .delete()
      .eq("company_id", companyId)
      .eq("invoice_id", invoice.id);

    if (lineDeleteError) {
      setSaving(false);
      return setError(`Customer payments were deleted, but invoice lines could not be deleted: ${lineDeleteError.message}`);
    }

    const { error: invoiceDeleteError } = await supabase
      .from("sales_invoices")
      .delete()
      .eq("company_id", companyId)
      .eq("id", invoice.id);

    setSaving(false);
    if (invoiceDeleteError) {
      return setError(`Linked payments and invoice lines were deleted, but the invoice could not be deleted: ${invoiceDeleteError.message}`);
    }

    if (previewInvoiceNumber === invoice.invoice_number) {
      setPreviewUrl(null);
      setPreviewInvoiceNumber("");
    }
    if (activeInvoiceId === invoice.id) setActiveInvoiceId(null);
    setSuccess(`Invoice ${invoice.invoice_number}, its linked payments and item lines were permanently deleted.`);
    await loadData();
  }

  const selectedInvoices = invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id));
  const allVisibleSelected = filteredInvoices.length > 0 && filteredInvoices.every((invoice) => selectedInvoiceIds.includes(invoice.id));

  function toggleInvoiceSelection(invoiceId: string, checked: boolean) {
    setSelectedInvoiceIds((current) => checked
      ? (current.includes(invoiceId) ? current : [...current, invoiceId])
      : current.filter((id) => id !== invoiceId));
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedInvoiceIds((current) => {
      const visibleIds = filteredInvoices.map((invoice) => invoice.id);
      return checked
        ? Array.from(new Set([...current, ...visibleIds]))
        : current.filter((id) => !visibleIds.includes(id));
    });
  }

  async function runBulkAction(action: "download" | "cancel" | "delete") {
    if (!selectedInvoices.length) return;
    if (action !== "download" && !mayWrite) return setError("Your role cannot modify invoices.");
    const actionLabel = action === "download" ? "downloaded" : action === "cancel" ? "cancelled" : "deleted";
    const prompt = action === "delete"
      ? `Permanently delete ${selectedInvoices.length} selected invoice(s), their linked customer payments and item lines? This cannot be undone.`
      : action === "cancel"
        ? `Cancel ${selectedInvoices.filter((invoice) => invoice.status !== "cancelled").length} selected invoice(s)? Their records will be retained.`
        : `Download PDFs for ${selectedInvoices.length} selected invoice(s)?`;
    if (!window.confirm(prompt)) return;

    setError(""); setSuccess(""); setBulkBusy(true);
    let completed = 0;
    const failures: string[] = [];

    for (const invoice of selectedInvoices) {
      if (action === "download") {
        await downloadSavedPdf(invoice);
        completed += 1;
        continue;
      }
      if (action === "cancel") {
        if (invoice.status === "cancelled") continue;
        const { error: cancelError } = await supabase
          .from("sales_invoices")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("company_id", companyId)
          .eq("id", invoice.id);
        if (cancelError) failures.push(`${invoice.invoice_number}: ${cancelError.message}`);
        else completed += 1;
        continue;
      }

      const { error: paymentError } = await supabase.from("customer_payments")
        .delete().eq("company_id", companyId).eq("invoice_id", invoice.id);
      if (paymentError) {
        failures.push(`${invoice.invoice_number} (payments): ${paymentError.message}`);
        continue;
      }

      const { error: lineError } = await supabase.from("sales_invoice_lines")
        .delete().eq("company_id", companyId).eq("invoice_id", invoice.id);
      if (lineError) {
        failures.push(`${invoice.invoice_number} (invoice lines): ${lineError.message}`);
        continue;
      }

      const { error: invoiceError } = await supabase.from("sales_invoices")
        .delete().eq("company_id", companyId).eq("id", invoice.id);
      if (invoiceError) failures.push(`${invoice.invoice_number}: ${invoiceError.message}`);
      else {
        completed += 1;
        if (previewInvoiceNumber === invoice.invoice_number) {
          setPreviewUrl(null);
          setPreviewInvoiceNumber("");
        }
      }
    }

    setBulkBusy(false);
    setSelectedInvoiceIds([]);
    if (failures.length) setError(`${completed} completed. Some actions failed: ${failures.join(" | ")}`);
    else setSuccess(`${completed} invoice(s) ${actionLabel} successfully.`);
    if (action !== "download") await loadData();
  }

  return (
    <div className="content sales-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">BUSINESS MANAGEMENT</div>
          <h1>Sales</h1>
          <p>Create GST invoices and download A4 tax invoice PDFs.</p>
        </div>
        <div className="sales-heading-actions">
          <button type="button" className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={openNewInvoice} disabled={!companyId}>
            <Plus size={16} /> New invoice
          </button>
        </div>
      </div>

      {companies.length > 1 && (
        <label className="customer-company-select">
          Company
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}

      {error && <div className="notice" role="alert">{error}</div>}
      {success && <div className="notice customer-success" role="status">{success}</div>}

      {emailOpen ? (
        <section className="gb-email-composer">
          <style>{`
            .gb-email-composer{background:#fff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden;min-height:620px}
            .gb-email-title{font-size:22px;font-weight:500;padding:18px 20px;border-bottom:1px solid #eaecf0;margin:0}
            .gb-email-fields{padding:10px 16px 0}
            .gb-email-field{display:grid;grid-template-columns:82px minmax(0,1fr);align-items:center;gap:12px;min-height:44px;border-bottom:1px solid #eaecf0;color:#667085;font-size:13px}
            .gb-email-field input{border:0;outline:0;width:100%;padding:10px 0;color:#344054;background:transparent}
            .gb-email-toolbar{display:flex;align-items:center;gap:5px;padding:9px 14px;border-bottom:1px solid #eaecf0;background:#f9fafb}
            .gb-email-toolbar button{border:0;background:transparent;border-radius:5px;padding:7px 10px;color:#344054;cursor:pointer;font-weight:650}
            .gb-email-toolbar button:hover{background:#eaecf0}
            .gb-email-body{padding:22px 18px;min-height:300px;max-height:440px;overflow:auto;outline:0;color:#344054;font-size:14px;line-height:1.65}
            .gb-email-attachment{margin:12px 18px;padding:10px 12px;border:1px solid #e4e7ec;border-radius:8px;display:flex;align-items:center;gap:9px;color:#475467;font-size:12px}
            .gb-email-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid #eaecf0;padding:12px 16px;display:flex;gap:9px}
            @media(max-width:600px){.gb-email-title{font-size:19px}.gb-email-field{grid-template-columns:62px minmax(0,1fr)}}
          `}</style>
          <h2 className="gb-email-title">Email To {emailCustomerName}</h2>
          <div className="gb-email-fields">
            <div className="gb-email-field"><span>From</span><span style={{color:"#344054"}}>{emailFrom || "Loading sender details..."}</span></div>
            <label className="gb-email-field"><span>Send To</span><input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="customer@example.com" /></label>
            <label className="gb-email-field"><span>Cc</span><input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="Optional" /></label>
            {showBcc && <label className="gb-email-field"><span>Bcc</span><input value={emailBcc} onChange={(e) => setEmailBcc(e.target.value)} placeholder="Optional" /></label>}
            <div style={{display:"flex",justifyContent:"flex-end",padding:"5px 0"}}><button type="button" className="btn" style={{border:0,color:"#3165e8"}} onClick={() => setShowBcc((value) => !value)}>{showBcc ? "Hide Bcc" : "Bcc"}</button></div>
            <label className="gb-email-field"><span>Subject</span><input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} /></label>
          </div>
          <div className="gb-email-toolbar">
            <button type="button" onClick={() => formatEmailBody("bold")} title="Bold">B</button>
            <button type="button" onClick={() => formatEmailBody("italic")} title="Italic"><em>I</em></button>
            <button type="button" onClick={() => formatEmailBody("underline")} title="Underline"><u>U</u></button>
            <span style={{borderLeft:"1px solid #d0d5dd",height:22,margin:"0 5px"}} />
            <span style={{fontSize:12,color:"#667085"}}>Formatted invoice message</span>
          </div>
          <div
            className="gb-email-body"
            contentEditable
            suppressContentEditableWarning
            onInput={(event) => setEmailBody(event.currentTarget.innerHTML)}
            dangerouslySetInnerHTML={{__html: emailBody}}
          />
          <div className="gb-email-attachment">
            <span aria-hidden="true">📎</span>
            <span>{emailAttachment ? emailAttachment.name : "Preparing invoice PDF attachment..."}</span>
            {emailAttachment && <span style={{marginLeft:"auto",color:"#039855"}}>Attached</span>}
          </div>
          <div className="gb-email-footer">
            <button type="button" className="btn btn-primary" disabled={emailSending || !emailTo.trim() || !emailSubject.trim()} onClick={() => void submitInvoiceEmail()}>Send</button>
            <button type="button" className="btn" onClick={() => setEmailOpen(false)}>Cancel</button>
          </div>
        </section>
      ) : (
      <div className="sales-reference-shell">
        <style>{`
          .sales-reference-shell{display:grid;gap:14px;min-width:0}
          .sales-reference-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
          .sales-reference-title{font-size:19px;font-weight:750;color:#182230;margin:0}
          .sales-reference-list{background:#fff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden;min-width:0}
          .sales-reference-toolbar{display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:1px solid #eaecf0;flex-wrap:wrap}
          .sales-reference-toolbar .inventory-search-wrap{flex:1;min-width:220px}
          .sales-reference-table-wrap{overflow:auto}
          .sales-reference-table{width:100%;min-width:820px;border-collapse:collapse;font-size:12px}
          .sales-reference-table th{background:#f8f9fc;color:#667085;text-align:left;font-size:11px;font-weight:700;padding:12px 10px;white-space:nowrap}
          .sales-reference-table td{padding:12px 10px;border-top:1px solid #eaecf0;color:#344054;vertical-align:middle}
          .sales-reference-table tbody tr{cursor:pointer}
          .sales-reference-table tbody tr:hover{background:#f8faff}
          .sales-reference-table tbody tr.active{background:#eff4ff}
          .sales-reference-split{display:grid;grid-template-columns:minmax(300px, .82fr) minmax(0, 1.65fr);gap:14px;align-items:start;min-width:0}
          .sales-reference-left,.sales-reference-detail{background:#fff;border:1px solid #e4e7ec;border-radius:12px;min-width:0;overflow:hidden}
          .sales-reference-left-head{padding:14px;border-bottom:1px solid #eaecf0;display:grid;gap:10px}
          .sales-reference-invoice-list{max-height:calc(100vh - 300px);min-height:360px;overflow:auto}
          .sales-reference-invoice-row{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:9px;align-items:start;padding:13px 12px;border-bottom:1px solid #f0f1f3;cursor:pointer}
          .sales-reference-invoice-row:hover{background:#f8faff}
          .sales-reference-invoice-row.active{background:#eff4ff;border-left:3px solid #3165e8;padding-left:9px}
          .sales-reference-invoice-row strong{font-size:12px;color:#2458c6}
          .sales-reference-invoice-row small{display:block;color:#667085;font-size:11px;margin-top:4px;line-height:1.45}
          .sales-reference-detail-head{padding:13px 16px;border-bottom:1px solid #eaecf0;display:flex;justify-content:space-between;align-items:center;gap:12px}
          .sales-reference-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #eaecf0}
          .sales-reference-preview{padding:12px;background:#f2f4f7;min-height:600px}
          .sales-reference-preview iframe{display:block;width:100%;height:calc(100vh - 300px);min-height:650px;border:1px solid #d0d5dd;border-radius:6px;background:#fff}
          .sales-reference-payments{padding:10px 14px;border-bottom:1px solid #eaecf0}
          .sales-reference-payments summary{cursor:pointer;color:#344054;font-size:12px;font-weight:650}
          @media(max-width:1000px){.sales-reference-split{grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr)}.sales-reference-preview iframe{min-height:520px}}
          @media(max-width:760px){.sales-reference-split{grid-template-columns:minmax(0,1fr)}.sales-reference-invoice-list{max-height:380px}.sales-reference-preview iframe{height:75vh;min-height:480px}}
        `}</style>

        {!activeInvoiceId ? (
          <section className="sales-reference-list">
            <div className="sales-reference-toolbar">
              <h2 className="sales-reference-title" style={{ marginRight: 8 }}>All invoices</h2>
              <div className="inventory-search-wrap">
                <Search size={16} className="inventory-search-icon" />
                <input className="inventory-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." />
              </div>
              <span style={{ color: "#667085", fontSize: 12, whiteSpace: "nowrap" }}>{selectedInvoiceIds.length} selected</span>
              <details style={{ position: "relative" }}>
                <summary className="btn" style={{ cursor: "pointer", listStyle: "none" }}>Bulk options ▾</summary>
                <div style={{ position: "absolute", zIndex: 30, right: 0, top: "calc(100% + 6px)", minWidth: 185, padding: 8, display: "grid", gap: 6, background: "#fff", border: "1px solid #e4e7ec", borderRadius: 10, boxShadow: "0 12px 30px rgba(16,24,40,.14)" }}>
                  <button type="button" className="btn" disabled={!selectedInvoices.length || bulkBusy} onClick={() => void runBulkAction("download")}>Download selected</button>
                  {mayWrite && <button type="button" className="btn" disabled={!selectedInvoices.length || bulkBusy} onClick={() => void runBulkAction("cancel")}>Cancel selected</button>}
                  {mayWrite && <button type="button" className="btn" disabled={!selectedInvoices.length || bulkBusy} onClick={() => void runBulkAction("delete")} style={{ color: "#b42318" }}>Delete selected</button>}
                </div>
              </details>
            </div>
            {loading ? <div className="empty-state">Loading invoices...</div> : filteredInvoices.length === 0 ? (
              <div className="empty-state"><h3>No invoices yet</h3><p>Create your first invoice using saved customers and items.</p><button type="button" className="btn btn-primary" onClick={openNewInvoice}><Plus size={15} /> New invoice</button></div>
            ) : (
              <div className="sales-reference-table-wrap">
                <table className="sales-reference-table">
                  <thead><tr>
                    <th><input aria-label="Select all visible invoices" type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleAllVisible(e.target.checked)} /></th>
                    <th>Date</th><th>Invoice</th><th>Order number</th><th>Customer name</th><th>Status</th><th>Due date</th><th style={{ textAlign: "right" }}>Total</th>
                  </tr></thead>
                  <tbody>{filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      onClick={() => void previewSavedPdf(invoice)}
                    >
                      <td onClick={(e) => e.stopPropagation()}><input aria-label={`Select ${invoice.invoice_number}`} type="checkbox" checked={selectedInvoiceIds.includes(invoice.id)} onChange={(e) => toggleInvoiceSelection(invoice.id, e.target.checked)} /></td>
                      <td>{invoice.invoice_date}</td>
                      <td><strong style={{ color: "#2458c6" }}>{invoice.invoice_number}</strong></td>
                      <td>{invoice.buyer_order_number || "—"}</td>
                      <td>{invoice.customers?.name ?? "Customer"}</td>
                      <td>
                        {invoice.status === "cancelled" ? (
                          <span className="status" style={{ background: "transparent", color: "#dc2626", border: "0", padding: 0 }}>CANCELLED</span>
                        ) : (
                          <span className="status status-active">{invoice.status}</span>
                        )}
                      </td>
                      <td>{invoice.due_date || "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 650 }}>{formatMoney(asNumber(invoice.grand_total), currency)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <div className="customer-list-footer" style={{ padding: "12px 14px" }}>Showing {filteredInvoices.length} of {invoices.length} invoices</div>
          </section>
        ) : (
          <div className="sales-reference-split">
            <section className="sales-reference-left">
              <div className="sales-reference-left-head">
                <div className="sales-reference-top"><strong>All invoices</strong><button type="button" className="btn" onClick={() => setActiveInvoiceId(null)}>Back to list</button></div>
                <div className="inventory-search-wrap"><Search size={16} className="inventory-search-icon" /><input className="inventory-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoices..." /></div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#667085" }}><input type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleAllVisible(e.target.checked)} /> Select all</label>
                  <details style={{ position: "relative" }}>
                    <summary className="btn" style={{ cursor: "pointer", listStyle: "none", fontSize: 11 }}>Bulk options ▾</summary>
                    <div style={{ position: "absolute", zIndex: 30, right: 0, top: "calc(100% + 6px)", minWidth: 175, padding: 8, display: "grid", gap: 6, background: "#fff", border: "1px solid #e4e7ec", borderRadius: 10, boxShadow: "0 12px 30px rgba(16,24,40,.14)" }}>
                      <button type="button" className="btn" disabled={!selectedInvoices.length || bulkBusy} onClick={() => void runBulkAction("download")}>Download selected</button>
                      {mayWrite && <button type="button" className="btn" disabled={!selectedInvoices.length || bulkBusy} onClick={() => void runBulkAction("cancel")}>Cancel selected</button>}
                      {mayWrite && <button type="button" className="btn" disabled={!selectedInvoices.length || bulkBusy} onClick={() => void runBulkAction("delete")} style={{ color: "#b42318" }}>Delete selected</button>}
                    </div>
                  </details>
                </div>
              </div>
              <div className="sales-reference-invoice-list">
                {filteredInvoices.map((invoice) => (
                  <div key={invoice.id} className={`sales-reference-invoice-row ${activeInvoiceId === invoice.id ? "active" : ""}`} onClick={() => void previewSavedPdf(invoice)}>
                    <input type="checkbox" aria-label={`Select ${invoice.invoice_number}`} checked={selectedInvoiceIds.includes(invoice.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => toggleInvoiceSelection(invoice.id, e.target.checked)} />
                    <div><strong>{invoice.customers?.name || "Customer"}</strong><small>{invoice.invoice_number} · {invoice.invoice_date}<br />{invoice.status.toUpperCase()}</small></div>
                    <strong style={{ color: "#344054", fontSize: 11 }}>{formatMoney(asNumber(invoice.grand_total), currency)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="sales-reference-detail">
              {(() => {
                const activeInvoice = invoices.find((invoice) => invoice.id === activeInvoiceId);
                if (!activeInvoice) return <div className="empty-state">Select an invoice.</div>;
                return <>
                  <div className="sales-reference-detail-head">
                    <div><strong style={{ fontSize: 14 }}>{activeInvoice.invoice_number}</strong><div style={{ fontSize: 11, color: "#667085", marginTop: 3 }}>{activeInvoice.customers?.name || "Customer"} · {activeInvoice.invoice_date} · {activeInvoice.status}</div></div>
                    <button type="button" className="btn" onClick={() => setActiveInvoiceId(null)} aria-label="Close invoice details"><X size={15} /></button>
                  </div>
                  <div className="sales-reference-actions">
                    {mayWrite && activeInvoice.status !== "cancelled" && <button type="button" className="btn" onClick={() => void openEditInvoice(activeInvoice)}><Pencil size={14} /> Edit</button>}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => openInvoiceEmailDraft(activeInvoice)}
                      title={activeInvoice.customers?.email ? `Prepare email for ${activeInvoice.customers.email}` : "Customer email address is not available"}
                    ><Mail size={14} /> Send Email</button>
                    <button type="button" className="btn" onClick={() => void downloadSavedPdf(activeInvoice)}><Download size={14} /> PDF / Print</button>
                    <details style={{ position: "relative" }}>
                      <summary className="btn" style={{ cursor: "pointer", listStyle: "none" }}>More actions ▾</summary>
                      <div style={{ position: "absolute", zIndex: 30, right: 0, top: "calc(100% + 6px)", minWidth: 175, padding: 8, display: "grid", gap: 6, background: "#fff", border: "1px solid #e4e7ec", borderRadius: 10, boxShadow: "0 12px 30px rgba(16,24,40,.14)" }}>
                        {mayWrite && activeInvoice.status !== "cancelled" && <button type="button" className="btn" onClick={() => void cancelInvoice(activeInvoice)}><X size={14} /> Cancel invoice</button>}
                        {mayWrite && <button type="button" className="btn" style={{ color: "#b42318" }} onClick={() => void deleteInvoice(activeInvoice)}><Trash2 size={14} /> Delete invoice</button>}
                      </div>
                    </details>
                  </div>
                  <details className="sales-reference-payments">
                    <summary>Payments received · {formatMoney(asNumber(activeInvoice.amount_paid), currency)}</summary>
                    <div style={{ padding: "10px 0 2px", fontSize: 12, color: "#667085" }}>Recorded payments: {formatMoney(asNumber(activeInvoice.amount_paid), currency)}<br />Balance due: {formatMoney(Math.max(0, asNumber(activeInvoice.grand_total) - asNumber(activeInvoice.amount_paid)), currency)}</div>
                  </details>
                  <div className="sales-reference-preview">
                    {previewLoading ? <div className="empty-state">Preparing invoice preview...</div> : previewUrl ? <iframe key={previewUrl} src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`} title={`Preview ${previewInvoiceNumber}`} /> : <div className="empty-state">Preparing invoice preview...</div>}
                  </div>
                  <div className="sales-reference-template-footer" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, padding: "12px 4px 18px", fontSize: 12, color: "#667085" }}>
                    <span>PDF Template:</span>
                    <strong style={{ color: "#344054" }}>
                      {({
                        classic: "Existing Invoice",
                        standard: "Standard",
                        spreadsheet: "Spreadsheet",
                      } as Record<string, string>)[activeInvoice.invoice_format || "classic"] || "Existing Invoice"}
                    </strong>
                    <details className="sales-template-change-menu" style={{ position: "relative" }}>
                      <summary style={{ color: "#2563eb", cursor: "pointer", listStyle: "none", userSelect: "none" }}>Change</summary>
                      <div style={{ position: "absolute", right: 0, bottom: "calc(100% + 8px)", zIndex: 30, width: 235, padding: 8, background: "#fff", border: "1px solid #d0d5dd", borderRadius: 10, boxShadow: "0 8px 24px rgba(16,24,40,.14)" }}>
                        {[
                          ["classic", "Existing Invoice — original layout"],
                          ["standard", "Standard — attached reference"],
                          ["spreadsheet", "Spreadsheet — attached reference"],
                        ].map(([value, label]) => (
                          <button key={value} type="button" className="btn" disabled={previewLoading || (activeInvoice.invoice_format || "classic") === value} onClick={(event) => {
                            const details = event.currentTarget.closest("details");
                            if (details) details.open = false;
                            void changeInvoiceTemplate(activeInvoice, value);
                          }} style={{ display: "block", width: "100%", textAlign: "left", margin: "2px 0", background: (activeInvoice.invoice_format || "classic") === value ? "#eff4ff" : "#fff", border: 0 }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                </>;
              })()}
            </section>
          </div>
        )}
      </div>
      )}

      {modalOpen && (
        <div className="customer-modal-backdrop" onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) setModalOpen(false);
        }}>
          <div className="customer-modal sales-invoice-modal" role="dialog" aria-modal="true" aria-labelledby="sales-modal-title">
            <div className="customer-modal-header">
              <div><div className="eyebrow">SALES</div><h2 id="sales-modal-title">{editingInvoiceId ? "Edit tax invoice" : "Create tax invoice"}</h2></div>
              <button type="button" className="btn" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close"><X size={18} /></button>
            </div>

            <form className="customer-modal-form" onSubmit={saveInvoice}>
              <div className="customer-modal-body">
                {error && <div className="notice" role="alert">{error}</div>}

                <h3 className="sales-section-heading">Invoice details</h3>
                <div className="sales-invoice-top-grid">
                  <label className="customer-field">Invoice number *<input required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></label>
                  <label className="customer-field">Invoice date *<input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></label>
                  <label className="customer-field">Due date<input type="date" min={invoiceDate} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
                  <label className="customer-field">Customer *<select required value={customerId} onChange={(e) => {
                    const nextCustomer = customers.find((c) => c.id === e.target.value) ?? null;
                    setCustomerId(e.target.value);
                    if (nextCustomer) {
                      const d = new Date(`${invoiceDate}T12:00:00`);
                      d.setDate(d.getDate() + (nextCustomer.payment_terms_days ?? 0));
                      setDueDate(d.toISOString().slice(0, 10));
                      const addr = nextCustomer.billing_address ?? {};
                      setPlaceOfSupply(addr.state ?? "");
                      if (copyBillingToShipping) {
                        setShipping(customerShippingAddress(nextCustomer));
                      } else {
                        setShipping((prev) => ({ ...prev, name: nextCustomer.name, phone: nextCustomer.phone ?? "" }));
                      }
                    } else {
                      setPlaceOfSupply("");
                    }
                  }}><option value="">Select customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.gstin ? ` · ${c.gstin}` : ""}</option>)}</select></label>
                  <label className="customer-field">Delivery note<input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} /></label>
                  <label className="customer-field">Mode / terms of payment<input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 30 days" /></label>
                  <label className="customer-field">Reference No. &amp; Date<input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} /></label>
                  <label className="customer-field">Buyer's order No.<input value={buyerOrderNumber} onChange={(e) => setBuyerOrderNumber(e.target.value)} /></label>
                  <label className="customer-field">Dispatch document No.<input value={dispatchDocumentNumber} onChange={(e) => setDispatchDocumentNumber(e.target.value)} /></label>
                  <label className="customer-field">Delivery note date<input type="date" value={deliveryNoteDate} onChange={(e) => setDeliveryNoteDate(e.target.value)} /></label>
                  <label className="customer-field">Dispatched through<input value={dispatchedThrough} onChange={(e) => setDispatchedThrough(e.target.value)} /></label>
                  <label className="customer-field">Destination<input value={destination} onChange={(e) => setDestination(e.target.value)} /></label>
                  <label className="customer-field">Bill of Lading / LR-RR No.<input value={lrRrNumber} onChange={(e) => setLrRrNumber(e.target.value)} placeholder="LR / RR number" /></label>
                  <label className="customer-field">Bill of Lading date<input type="date" value={billOfLadingDate} onChange={(e) => setBillOfLadingDate(e.target.value)} /></label>
                  <label className="customer-field">Motor vehicle No.<input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} /></label>
                  <label className="customer-field">Terms of delivery<input value={termsOfDelivery} onChange={(e) => setTermsOfDelivery(e.target.value)} /></label>
                </div>

                <div className="sales-address-columns">
                  <section className="sales-address-panel">
                    <h3 className="sales-section-heading">Buyer (Bill to)</h3>
                    {selectedCustomer ? (
                      <>
                        <div className="sales-billing-name">{selectedCustomer.name}</div>
                        {addressLines(selectedCustomer.billing_address).map((part, index) => (
                          <div className="sales-billing-line" key={`${index}-${part}`}>{part}</div>
                        ))}
                        {selectedCustomer.gstin && <div className="sales-billing-line">GSTIN/UIN: {selectedCustomer.gstin}</div>}
                        {selectedCustomer.phone && <div className="sales-billing-line">Contact: {selectedCustomer.phone}</div>}
                      </>
                    ) : (
                      <p className="sales-address-empty">Select a customer to view their billing address.</p>
                    )}
                  </section>

                  <section className="sales-address-panel">
                    <h3 className="sales-section-heading">Consignee (Ship to)</h3>
                    <label className="sales-copy-address"><input type="checkbox" checked={copyBillingToShipping} onChange={(e) => {
                      const checked = e.target.checked;
                      setCopyBillingToShipping(checked);
                      if (checked && selectedCustomer) {
                        setShipping(customerShippingAddress(selectedCustomer));
                      }
                    }} /> Copy billing address to shipping address</label>
                    <div className="sales-invoice-top-grid">
                      <label className="customer-field">Consignee name<input value={shipping.name ?? ""} onChange={(e) => updateShipping("name", e.target.value)} placeholder="Delivery recipient" /></label>
                      <label className="customer-field">Address line 1<input value={shipping.address_line1 ?? ""} onChange={(e) => updateShipping("address_line1", e.target.value)} /></label>
                      <label className="customer-field">Address line 2<input value={shipping.address_line2 ?? ""} onChange={(e) => updateShipping("address_line2", e.target.value)} /></label>
                      <label className="customer-field">City<input value={shipping.city ?? ""} onChange={(e) => updateShipping("city", e.target.value)} /></label>
                      <label className="customer-field">State<input value={shipping.state ?? ""} onChange={(e) => updateShipping("state", e.target.value)} /></label>
                      <label className="customer-field">PIN code<input value={shipping.postal_code ?? ""} onChange={(e) => updateShipping("postal_code", e.target.value)} /></label>
                      <label className="customer-field">Contact number<input value={shipping.phone ?? ""} onChange={(e) => updateShipping("phone", e.target.value)} /></label>
                    </div>
                  </section>
                </div>

                <h3 className="sales-section-heading">Invoice items</h3>
                <div className="sales-lines-heading">
                  <p>Select a saved item or enter goods manually.</p>
                  <button type="button" className="btn" onClick={() => setLines((prev) => [...prev, makeLine()])}><Plus size={14} /> Add line</button>
                </div>

                {items.length === 0 && <div className="notice">No active items found. You can enter the goods manually or add items in Items &amp; Inventory.</div>}

                {lines.map((line, index) => (
                  <div className="sales-line-card" key={line.key}>
                    <div className="sales-line-title">
                      <strong>Item {index + 1}</strong>
                      <button type="button" className="btn" disabled={lines.length === 1} onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}><Trash2 size={14} /> Remove</button>
                    </div>
                    <div className="sales-line-grid">
                      <label className="customer-field sales-line-item">Choose item<select value={line.item_id} onChange={(e) => updateLine(line.key, "item_id", e.target.value)}><option value="">Manual line / select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>)}</select></label>
                      <label className="customer-field sales-line-description">Description *<input required value={line.description} onChange={(e) => updateLine(line.key, "description", e.target.value)} /></label>
                      <label className="customer-field">HSN/SAC<input value={line.hsn_sac} onChange={(e) => updateLine(line.key, "hsn_sac", e.target.value)} /></label>
                      <label className="customer-field">Quantity *<input type="number" min="0.001" step="0.001" required value={line.quantity} onChange={(e) => updateLine(line.key, "quantity", e.target.value)} /></label>
                      <label className="customer-field">Rate *<input type="number" min="0" step="0.01" required value={line.rate} onChange={(e) => updateLine(line.key, "rate", e.target.value)} /></label>
                      <label className="customer-field">Unit<input value={line.unit} onChange={(e) => updateLine(line.key, "unit", e.target.value)} /></label>
                      <label className="customer-field">Discount (₹)<input type="number" min="0" step="0.01" value={line.discount} onChange={(e) => updateLine(line.key, "discount", e.target.value)} /></label>
                      <label className="customer-field">GST %<select value={line.gst_rate} onChange={(e) => updateLine(line.key, "gst_rate", e.target.value)}>{[0, 3, 5, 12, 18, 28].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select></label>
                    </div>
                    <div className="sales-line-total">Taxable: <strong>{formatMoney(calculated[index]?.taxable ?? 0, currency)}</strong> · Line total: <strong>{formatMoney(calculated[index]?.total ?? 0, currency)}</strong></div>
                  </div>
                ))}

                <div className="sales-invoice-bottom">
                  <label className="customer-field">Notes / terms<textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional invoice notes and terms" /></label>
                  <div className="sales-totals">
                    <div><span>Subtotal</span><strong>{formatMoney(totals.subtotal, currency)}</strong></div>
                    <div><span>Discount</span><strong>{formatMoney(totals.discount, currency)}</strong></div>
                    {supplyType === "intra_state" ? <>
                      <div><span>CGST</span><strong>{formatMoney(totals.cgst, currency)}</strong></div>
                      <div><span>SGST</span><strong>{formatMoney(totals.sgst, currency)}</strong></div>
                    </> : <div><span>IGST</span><strong>{formatMoney(totals.igst, currency)}</strong></div>}
                    <div><span>Round off</span><strong>{formatMoney(totals.roundOff, currency)}</strong></div>
                    <div className="sales-grand-total"><span>Grand total</span><strong>{formatMoney(totals.grand, currency)}</strong></div>
                  </div>
                </div>
              </div>

              <div className="customer-modal-footer">
                <button type="button" className="btn" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving invoice..." : editingInvoiceId ? "Save changes" : "Save invoice"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
