"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Plus, Search, RefreshCw, X, Pencil, FileText, Wallet,
  AlertCircle, CheckCircle2, Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = { id: string; name: string; currency: string; role: string };
type Supplier = {
  id: string; company_id: string; supplier_code: string | null; name: string;
  email: string | null; phone: string | null; gstin: string | null;
  address: Record<string, string> | null; payment_terms_days: number; is_active: boolean;
};
type Item = {
  id: string; name: string; code: string | null; unit: string;
  gst_rate: number; purchase_price: number; is_active: boolean;
};
type BillLine = {
  id?: string; item_id: string; description: string; quantity: string; unit: string;
  rate: string; gst_rate: string;
};
type Bill = {
  id: string; supplier_id: string; bill_number: string; bill_date: string;
  due_date: string | null; status: string; subtotal: number; tax_total: number;
  total: number; amount_paid: number; notes: string | null;
  suppliers?: { name: string } | null;
};
type SupplierForm = {
  supplier_code: string; name: string; email: string; phone: string; gstin: string;
  address: string; city: string; state: string; postal_code: string;
  payment_terms_days: string;
};
const blankSupplier: SupplierForm = {
  supplier_code: "", name: "", email: "", phone: "", gstin: "",
  address: "", city: "", state: "", postal_code: "", payment_terms_days: "0"
};
const blankLine = (): BillLine => ({
  item_id: "", description: "", quantity: "1", unit: "pcs", rate: "0", gst_rate: "18"
});
const field: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6, minWidth: 0,
  color: "#344054", fontSize: 13, fontWeight: 600
};
const input: React.CSSProperties = {
  width: "100%", minWidth: 0, minHeight: 40, boxSizing: "border-box",
  padding: "9px 11px", border: "1px solid #d0d5dd", borderRadius: 8,
  background: "#fff", color: "#172033", font: "inherit", fontWeight: 400
};
const buttonRow: React.CSSProperties = { display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" };

function canManage(role?: string) {
  return ["owner", "admin", "manager"].includes((role ?? "").toLowerCase());
}
function currency(value: number, code: string) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: code || "INR", maximumFractionDigits: 2 }).format(value || 0);
  } catch {
    return `₹${Number(value || 0).toFixed(2)}`;
  }
}
function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PurchaseWorkspace({ companies }: { companies: Company[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [tab, setTab] = useState<"bills" | "suppliers">("bills");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>({ ...blankSupplier });
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [billNumber, setBillNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [billDate, setBillDate] = useState(isoToday());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([blankLine()]);
  const [paymentBill, setPaymentBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(isoToday());
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const [viewLines, setViewLines] = useState<any[]>([]);
  const [viewPayments, setViewPayments] = useState<any[]>([]);

  const company = companies.find(c => c.id === companyId);
  const mayManage = canManage(company?.role);
  const activeSuppliers = suppliers.filter(s => s.is_active);
  const filteredBills = bills.filter(b => {
    const q = search.trim().toLowerCase();
    const supplierName = b.suppliers?.name ?? suppliers.find(s => s.id === b.supplier_id)?.name ?? "";
    return !q || `${b.bill_number} ${supplierName} ${b.status}`.toLowerCase().includes(q);
  });
  const filteredSuppliers = suppliers.filter(s => {
    const q = search.trim().toLowerCase();
    return (!q || `${s.name} ${s.supplier_code ?? ""} ${s.phone ?? ""} ${s.gstin ?? ""}`.toLowerCase().includes(q));
  });
  const subtotal = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.rate) || 0), 0);
  const taxTotal = lines.reduce((sum, line) => {
    const base = Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.rate) || 0);
    return sum + base * Math.max(0, Number(line.gst_rate) || 0) / 100;
  }, 0);
  const billTotal = subtotal + taxTotal;
  const outstanding = bills.reduce((sum, b) => sum + Math.max(0, Number(b.total) - Number(b.amount_paid)), 0);
  const totalPurchases = bills.reduce((sum, b) => sum + Number(b.total || 0), 0);

  const load = useCallback(async () => {
    if (!companyId) { setSuppliers([]); setItems([]); setBills([]); setLoading(false); return; }
    setLoading(true); setError("");
    const [s, i, b] = await Promise.all([
      supabase.from("suppliers").select("*").eq("company_id", companyId).order("name"),
      supabase.from("items").select("id,name,code,unit,gst_rate,purchase_price,is_active").eq("company_id", companyId).eq("is_active", true).order("name"),
      supabase.from("purchase_bills").select("id,supplier_id,bill_number,bill_date,due_date,status,subtotal,tax_total,total,amount_paid,notes,suppliers(name)").eq("company_id", companyId).order("bill_date", { ascending: false })
    ]);
    if (s.error) setError(`Unable to load suppliers: ${s.error.message}`);
    if (i.error) setError(`Unable to load items: ${i.error.message}`);
    if (b.error) setError(`Unable to load purchase bills: ${b.error.message}`);
    setSuppliers((s.data ?? []) as Supplier[]);
    setItems((i.data ?? []) as Item[]);
    setBills((b.data ?? []) as unknown as Bill[]);
    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => { void load(); }, [load]);

  function openSupplier(s?: Supplier) {
    setEditingSupplier(s?.id ?? null);
    const a = s?.address ?? {};
    setSupplierForm(s ? {
      supplier_code: s.supplier_code ?? "", name: s.name, email: s.email ?? "",
      phone: s.phone ?? "", gstin: s.gstin ?? "", address: a.address ?? "",
      city: a.city ?? "", state: a.state ?? "", postal_code: a.postal_code ?? "",
      payment_terms_days: String(s.payment_terms_days ?? 0)
    } : { ...blankSupplier });
    setError(""); setSuccess(""); setSupplierOpen(true);
  }

  async function saveSupplier(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId || !mayManage) { setError("You do not have permission to manage suppliers."); return; }
    const days = Number(supplierForm.payment_terms_days);
    if (!supplierForm.name.trim() || !Number.isInteger(days) || days < 0 || days > 3650) {
      setError("Enter a supplier name and valid payment terms (0–3650 days)."); return;
    }
    setSaving(true); setError(""); setSuccess("");
    const payload = {
      company_id: companyId, supplier_code: supplierForm.supplier_code.trim() || null,
      name: supplierForm.name.trim(), email: supplierForm.email.trim() || null,
      phone: supplierForm.phone.trim() || null, gstin: supplierForm.gstin.trim().toUpperCase() || null,
      address: { address: supplierForm.address.trim(), city: supplierForm.city.trim(), state: supplierForm.state.trim(), postal_code: supplierForm.postal_code.trim(), country: "India" },
      payment_terms_days: days, updated_at: new Date().toISOString()
    };
    const result = editingSupplier
      ? await supabase.from("suppliers").update(payload).eq("id", editingSupplier).eq("company_id", companyId).select("id").maybeSingle()
      : await supabase.from("suppliers").insert(payload).select("id").single();
    setSaving(false);
    if (result.error) { setError(`Unable to save supplier: ${result.error.message}`); return; }
    if (!result.data) { setError("No supplier was saved. Check your permissions."); return; }
    setSupplierOpen(false); setSuccess(editingSupplier ? "Supplier updated." : "Supplier created."); await load();
  }

  async function toggleSupplier(s: Supplier) {
    if (!mayManage) return;
    const next = !s.is_active;
    if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${s.name}?`)) return;
    const { error: e } = await supabase.from("suppliers").update({ is_active: next, updated_at: new Date().toISOString() }).eq("id", s.id).eq("company_id", companyId);
    if (e) setError(e.message); else { setSuccess("Supplier status updated."); await load(); }
  }

  async function openBill(bill?: Bill) {
    setError(""); setSuccess("");
    setEditingBillId(bill?.id ?? null);
    if (!bill) {
      setEditingBillId(null);
      setBillNumber(""); setSupplierId(activeSuppliers[0]?.id ?? "");
      setBillDate(isoToday()); setDueDate(""); setNotes(""); setLines([blankLine()]);
      setBillOpen(true);
      return;
    }
    setSaving(true);
    const { data, error: lineError } = await supabase.from("purchase_bill_items")
      .select("id,item_id,description,quantity,unit,rate,gst_rate")
      .eq("company_id", companyId).eq("purchase_bill_id", bill.id).order("created_at");
    setSaving(false);
    if (lineError) { setError(`Unable to load bill items: ${lineError.message}`); return; }
    setBillNumber(bill.bill_number); setSupplierId(bill.supplier_id);
    setBillDate(bill.bill_date); setDueDate(bill.due_date ?? ""); setNotes(bill.notes ?? "");
    const loadedLines: BillLine[] = (data ?? []).map((line: any): BillLine => ({
      id: line.id, item_id: line.item_id ?? "", description: line.description ?? "",
      quantity: String(line.quantity), unit: line.unit ?? "pcs",
      rate: String(line.rate), gst_rate: String(line.gst_rate)
    }));
    setLines(loadedLines.length > 0 ? loadedLines : [blankLine()]);
    setBillOpen(true);
  }

  async function viewBillDetails(bill: Bill) {
    setError(""); setViewBill(bill); setViewLines([]); setViewPayments([]);
    const [lineResult, paymentResult] = await Promise.all([
      supabase.from("purchase_bill_items").select("*").eq("company_id", companyId).eq("purchase_bill_id", bill.id),
      supabase.from("supplier_payments").select("id,amount,payment_date,payment_method,reference").eq("company_id", companyId).eq("purchase_bill_id", bill.id).order("payment_date", { ascending: false })
    ]);
    if (lineResult.error) setError(`Unable to load bill items: ${lineResult.error.message}`);
    else setViewLines(lineResult.data ?? []);
    if (paymentResult.error) setError(`Unable to load payment history: ${paymentResult.error.message}`);
    else setViewPayments(paymentResult.data ?? []);
  }

  async function deleteBill(bill: Bill) {
    if (!mayManage) return;
    const ok = window.confirm(
      `Permanently delete purchase bill ${bill.bill_number}? Its bill items and linked supplier payment records will also be deleted. This cannot be undone.`
    );
    if (!ok) return;
    setSaving(true); setError(""); setSuccess("");
    const payments = await supabase.from("supplier_payments").delete()
      .eq("company_id", companyId).eq("purchase_bill_id", bill.id).select("id");
    if (payments.error) { setSaving(false); setError(`Unable to delete linked supplier payments: ${payments.error.message}`); return; }
    const linesResult = await supabase.from("purchase_bill_items").delete()
      .eq("company_id", companyId).eq("purchase_bill_id", bill.id).select("id");
    if (linesResult.error) { setSaving(false); setError(`Unable to delete purchase bill items: ${linesResult.error.message}`); return; }
    const deleted = await supabase.from("purchase_bills").delete()
      .eq("company_id", companyId).eq("id", bill.id).select("id").maybeSingle();
    setSaving(false);
    if (deleted.error) { setError(`Unable to delete purchase bill: ${deleted.error.message}`); return; }
    if (!deleted.data) { setError("The bill was not deleted. Check your Supabase DELETE policies for purchase_bills."); return; }
    setViewBill(null); setSuccess(`Purchase bill ${bill.bill_number} and its linked records were deleted.`); await load();
  }

  async function cancelBill(bill: Bill) {
    if (!mayManage) return;
    if (!window.confirm(`Cancel purchase bill ${bill.bill_number}? The bill and its payment history will be retained.`)) return;
    const result = await supabase.from("purchase_bills")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("company_id", companyId).eq("id", bill.id).select("id").maybeSingle();
    if (result.error) setError(`Unable to cancel purchase bill: ${result.error.message}`);
    else if (!result.data) setError("Bill was not cancelled. Check your Supabase UPDATE policies.");
    else { setSuccess(`Purchase bill ${bill.bill_number} cancelled. Its payment history was retained.`); await load(); }
  }

  async function deleteSupplier(supplier: Supplier) {
    if (!mayManage) return;

    setError("");
    setSuccess("");

    // Preserve accounting history: a supplier can only be permanently deleted
    // when no purchase bills or supplier payment records reference it.
    const [billCheck, paymentCheck] = await Promise.all([
      supabase.from("purchase_bills")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("supplier_id", supplier.id),
      supabase.from("supplier_payments")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("supplier_id", supplier.id)
    ]);

    if (billCheck.error) {
      setError(`Unable to check purchase bills for ${supplier.name}: ${billCheck.error.message}`);
      return;
    }
    if (paymentCheck.error) {
      setError(`Unable to check payment history for ${supplier.name}: ${paymentCheck.error.message}`);
      return;
    }

    const billCount = billCheck.count ?? 0;
    const paymentCount = paymentCheck.count ?? 0;

    if (billCount > 0 || paymentCount > 0) {
      const reasons = [
        billCount > 0 ? `${billCount} purchase bill(s)` : "",
        paymentCount > 0 ? `${paymentCount} supplier payment record(s)` : ""
      ].filter(Boolean).join(" and ");
      setError(
        `Cannot permanently delete ${supplier.name}: ${reasons} are linked to this supplier. ` +
        `Deactivate the supplier instead to preserve your accounting history.`
      );
      return;
    }

    if (!window.confirm(
      `Permanently delete supplier ${supplier.name}? This is allowed only because no purchase bills or payments are linked.`
    )) return;

    setSaving(true);
    const result = await supabase.from("suppliers")
      .delete()
      .eq("company_id", companyId)
      .eq("id", supplier.id)
      .select("id")
      .maybeSingle();
    setSaving(false);

    if (result.error) {
      setError(`Unable to delete supplier: ${result.error.message}`);
      return;
    }
    if (!result.data) {
      setError(
        "Supplier was not deleted. Supabase returned no deleted row. " +
        "Check the suppliers table DELETE policy and confirm it allows this company’s owner/admin/manager to delete suppliers."
      );
      return;
    }

    setSuccess(`Supplier ${supplier.name} deleted.`);
    await load();
  }

  function updateLine(index: number, key: keyof BillLine, value: string) {
    setLines(prev => prev.map((line, i) => i === index ? { ...line, [key]: value } : line));
  }
  function chooseItem(index: number, itemId: string) {
    const item = items.find(i => i.id === itemId);
    setLines(prev => prev.map((line, i) => i === index ? {
      ...line, item_id: itemId, description: item?.name ?? line.description,
      unit: item?.unit ?? line.unit, rate: String(item?.purchase_price ?? 0),
      gst_rate: String(item?.gst_rate ?? 18)
    } : line));
  }

  async function saveBill(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId || !mayManage) { setError("You do not have permission to manage purchase bills."); return; }
    if (!supplierId) { setError("Select a supplier."); return; }
    if (!billNumber.trim()) { setError("Supplier bill number is required."); return; }
    if (!lines.length || lines.some(l => !l.description.trim() || !(Number(l.quantity) > 0) || Number(l.rate) < 0 || Number(l.gst_rate) < 0)) {
      setError("Each line needs a description, positive quantity, and valid rate and GST."); return;
    }
    setSaving(true); setError(""); setSuccess("");
    const payload = {
      company_id: companyId, supplier_id: supplierId, bill_number: billNumber.trim(),
      bill_date: billDate, due_date: dueDate || null, subtotal: Number(subtotal.toFixed(2)),
      tax_total: Number(taxTotal.toFixed(2)), total: Number(billTotal.toFixed(2)),
      notes: notes.trim() || null, updated_at: new Date().toISOString()
    };
    if (!editingBillId) {
      const { data: bill, error: billError } = await supabase.from("purchase_bills")
        .insert({ ...payload, amount_paid: 0, status: "unpaid" }).select("id").single();
      if (billError || !bill) {
        setSaving(false); setError(`Unable to save purchase bill: ${billError?.message ?? "No bill returned"}`); return;
      }
      const linePayload = lines.map(l => {
        const qty = Number(l.quantity), rate = Number(l.rate), gst = Number(l.gst_rate);
        const base = qty * rate, tax = base * gst / 100;
        return { company_id: companyId, purchase_bill_id: bill.id, item_id: l.item_id || null,
          description: l.description.trim(), quantity: qty, unit: l.unit.trim() || "pcs",
          rate, gst_rate: gst, taxable_amount: Number(base.toFixed(2)),
          tax_amount: Number(tax.toFixed(2)), line_total: Number((base + tax).toFixed(2)) };
      });
      const { error: lineError } = await supabase.from("purchase_bill_items").insert(linePayload);
      if (lineError) {
        await supabase.from("purchase_bills").delete().eq("id", bill.id).eq("company_id", companyId);
        setSaving(false); setError(`Bill lines could not be saved; the draft bill was rolled back: ${lineError.message}`); return;
      }
      setSaving(false); setBillOpen(false); setSuccess("Purchase bill created. Inventory opening stock was not changed."); await load();
      return;
    }

    const current = bills.find(b => b.id === editingBillId);
    if (current && Number(current.amount_paid) > billTotal + 0.005) {
      setSaving(false); setError("The updated bill total cannot be lower than payments already recorded."); return;
    }
    const update = await supabase.from("purchase_bills").update({
      ...payload,
      status: current ? (Number(current.amount_paid) >= billTotal - 0.005 ? "paid" : Number(current.amount_paid) > 0 ? "partial" : "unpaid") : "unpaid"
    }).eq("company_id", companyId).eq("id", editingBillId).select("id").maybeSingle();
    if (update.error || !update.data) {
      setSaving(false); setError(`Unable to update purchase bill: ${update.error?.message ?? "No bill was updated. Check permissions."}`); return;
    }
    const existingIds = lines.filter(l => l.id).map(l => l.id as string);
    const removed = await supabase.from("purchase_bill_items").delete()
      .eq("company_id", companyId).eq("purchase_bill_id", editingBillId)
      .not("id", "in", `(${existingIds.length ? existingIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
    if (removed.error) { setSaving(false); setError(`Bill header updated, but removed lines could not be synchronized: ${removed.error.message}`); return; }
    for (const line of lines) {
      const qty = Number(line.quantity), rate = Number(line.rate), gst = Number(line.gst_rate);
      const base = qty * rate, tax = base * gst / 100;
      const row = { company_id: companyId, purchase_bill_id: editingBillId, item_id: line.item_id || null,
        description: line.description.trim(), quantity: qty, unit: line.unit.trim() || "pcs", rate, gst_rate: gst,
        taxable_amount: Number(base.toFixed(2)), tax_amount: Number(tax.toFixed(2)), line_total: Number((base + tax).toFixed(2)) };
      const result = line.id
        ? await supabase.from("purchase_bill_items").update(row).eq("company_id", companyId).eq("purchase_bill_id", editingBillId).eq("id", line.id)
        : await supabase.from("purchase_bill_items").insert(row);
      if (result.error) { setSaving(false); setError(`Bill header was updated, but an item could not be saved: ${result.error.message}`); return; }
    }
    setSaving(false); setBillOpen(false); setEditingBillId(null); setSuccess("Purchase bill updated."); await load();
  }

  async function recordPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paymentBill || !mayManage) return;
    const amount = Number(paymentAmount);
    const balance = Number(paymentBill.total) - Number(paymentBill.amount_paid);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance + 0.005) {
      setError(`Enter an amount greater than zero and no more than the outstanding balance (${currency(balance, company?.currency ?? "INR")}).`); return;
    }
    setSaving(true); setError(""); setSuccess("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: paymentError } = await supabase.from("supplier_payments").insert({
      company_id: companyId, purchase_bill_id: paymentBill.id, supplier_id: paymentBill.supplier_id,
      amount: Number(amount.toFixed(2)), payment_date: paymentDate, payment_method: paymentMethod,
      reference: paymentReference.trim() || null, created_by: auth.user?.id ?? null
    });
    if (paymentError) { setSaving(false); setError(`Unable to record payment: ${paymentError.message}`); return; }
    const newPaid = Number((Number(paymentBill.amount_paid) + amount).toFixed(2));
    const newStatus = newPaid >= Number(paymentBill.total) - 0.005 ? "paid" : "partial";
    const { error: updateError } = await supabase.from("purchase_bills").update({ amount_paid: newPaid, status: newStatus, updated_at: new Date().toISOString() }).eq("id", paymentBill.id).eq("company_id", companyId);
    setSaving(false);
    if (updateError) { setError(`Payment was recorded but bill balance update failed: ${updateError.message}. Please refresh and reconcile before retrying.`); return; }
    setPaymentBill(null); setPaymentAmount(""); setPaymentReference(""); setSuccess("Supplier payment recorded."); await load();
  }

  function downloadCsv() {
    const rows = [
      ["Bill number", "Supplier", "Bill date", "Due date", "Subtotal", "Tax", "Total", "Paid", "Balance", "Status"],
      ...filteredBills.map(b => [
        b.bill_number, b.suppliers?.name ?? suppliers.find(s => s.id === b.supplier_id)?.name ?? "",
        b.bill_date, b.due_date ?? "", b.subtotal, b.tax_total, b.total, b.amount_paid,
        Math.max(0, Number(b.total) - Number(b.amount_paid)), b.status
      ])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "purchase-register.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="content">
      <div className="page-heading">
        <div><div className="eyebrow">GREAT BOOKS WORKSPACE</div><h1>Purchase Management</h1><p>Manage suppliers, purchase bills and supplier payments.</p></div>
        <div style={buttonRow}>
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
          {mayManage && <button type="button" className="btn btn-primary" onClick={tab === "suppliers" ? () => openSupplier() : () => void openBill()} disabled={!companyId}><Plus size={16}/>{tab === "suppliers" ? "New supplier" : "New purchase bill"}</button>}
        </div>
      </div>

      {companies.length > 1 && <div className="card" style={{ marginBottom: 16 }}><label style={field}>Company<select style={input} value={companyId} onChange={e => { setCompanyId(e.target.value); setSearch(""); setError(""); setSuccess(""); }}><option value="">Select company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>}
      {!companyId && <div className="notice">Your account needs an active company membership before purchases can be managed.</div>}
      {companyId && !mayManage && <div className="notice">You have read-only access to Purchase Management.</div>}
      {error && <div className="notice" role="alert" style={{ borderColor: "#fecaca", color: "#b42318" }}><AlertCircle size={16} style={{ verticalAlign: "middle", marginRight: 7 }}/>{error}</div>}
      {success && <div className="notice" role="status" style={{ borderColor: "#bbf7d0", color: "#166534" }}><CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 7 }}/>{success}</div>}

      <div className="module-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", marginBottom: 18 }}>
        <div className="card"><div className="stat-top">Purchase bills</div><div className="stat-value">{bills.length}</div><div className="stat-foot">Recorded bills</div></div>
        <div className="card"><div className="stat-top">Total purchases</div><div className="stat-value">{currency(totalPurchases, company?.currency ?? "INR")}</div><div className="stat-foot">Including GST</div></div>
        <div className="card"><div className="stat-top">Supplier outstanding</div><div className="stat-value">{currency(outstanding, company?.currency ?? "INR")}</div><div className="stat-foot">Unpaid balance</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 12 }}>
        <div style={buttonRow}>
          <button type="button" className={`btn ${tab === "bills" ? "btn-primary" : ""}`} onClick={() => { setTab("bills"); setSearch(""); }}><FileText size={15}/> Purchase bills</button>
          <button type="button" className={`btn ${tab === "suppliers" ? "btn-primary" : ""}`} onClick={() => { setTab("suppliers"); setSearch(""); }}><Wallet size={15}/> Suppliers</button>
        </div>
      </div>

      <div className="card">
        <div className="card-heading"><div><h2>{tab === "bills" ? "Purchase register" : "Supplier directory"}</h2><p>{tab === "bills" ? `${filteredBills.length} bills` : `${filteredSuppliers.length} suppliers`}</p></div>{tab === "bills" && <button type="button" className="btn" onClick={downloadCsv}>Export CSV</button>}</div>
        <div className="inventory-toolbar">
          <div className="inventory-search-wrap"><Search size={17} className="inventory-search-icon"/><input className="inventory-search" value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === "bills" ? "Search bill number, supplier or status..." : "Search supplier, code, phone or GSTIN..."}/></div>
        </div>
        {loading ? <div className="empty-state">Loading purchase records...</div> :
          tab === "bills" ? (filteredBills.length === 0 ? <div className="empty-state"><FileText size={30}/><h3>No purchase bills found</h3><p>Create your first purchase bill to get started.</p></div> :
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Bill</th><th>Supplier</th><th>Bill date</th><th>Due date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {filteredBills.map(b => { const balance = Math.max(0, Number(b.total) - Number(b.amount_paid)); return <tr key={b.id}>
                <td><strong>{b.bill_number}</strong></td><td>{b.suppliers?.name ?? suppliers.find(s => s.id === b.supplier_id)?.name ?? "Supplier"}</td><td>{b.bill_date}</td><td>{b.due_date ?? "—"}</td>
                <td>{currency(Number(b.total), company?.currency ?? "INR")}</td><td>{currency(Number(b.amount_paid), company?.currency ?? "INR")}</td><td>{currency(balance, company?.currency ?? "INR")}</td>
                <td><span className={`status ${b.status === "paid" ? "paid" : b.status === "partial" ? "status-active" : "overdue"}`}>{b.status}</span></td>
                <td><div style={buttonRow}>
                  <button type="button" className="btn" onClick={() => void viewBillDetails(b)}><FileText size={14}/> View</button>
                  {mayManage && <button type="button" className="btn" onClick={() => void openBill(b)}><Pencil size={14}/> Edit</button>}
                  {mayManage && balance > 0.005 && <button type="button" className="btn" onClick={() => { setPaymentBill(b); setPaymentAmount(balance.toFixed(2)); setPaymentDate(isoToday()); setPaymentReference(""); setError(""); }}>Record payment</button>}
                  {mayManage && b.status !== "cancelled" && <button type="button" className="btn" onClick={() => void cancelBill(b)}>Cancel bill</button>}
                  {mayManage && <button type="button" className="btn" style={{ color: "#b42318" }} onClick={() => void deleteBill(b)} disabled={saving}><Trash2 size={14}/> Delete</button>}
                </div></td>
              </tr>; })}
            </tbody></table></div>) :
          (filteredSuppliers.length === 0 ? <div className="empty-state"><Wallet size={30}/><h3>No suppliers found</h3><p>Add your first supplier to create purchase bills.</p></div> :
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Supplier</th><th>Code</th><th>Contact</th><th>GSTIN</th><th>Terms</th><th>Status</th><th>Actions</th></tr></thead><tbody>
              {filteredSuppliers.map(s => <tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.supplier_code ?? "—"}</td><td>{s.phone ?? "—"}<div className="customer-muted">{s.email ?? ""}</div></td><td>{s.gstin ?? "—"}</td><td>{s.payment_terms_days ? `${s.payment_terms_days} days` : "Due immediately"}</td><td><span className={`status ${s.is_active ? "paid" : "overdue"}`}>{s.is_active ? "Active" : "Inactive"}</span></td><td>{mayManage && <div style={buttonRow}><button type="button" className="btn" onClick={() => openSupplier(s)}><Pencil size={14}/> Edit</button><button type="button" className="btn" onClick={() => void toggleSupplier(s)}>{s.is_active ? "Deactivate" : "Activate"}</button><button type="button" className="btn" style={{ color: "#b42318" }} onClick={() => void deleteSupplier(s)}><Trash2 size={14}/> Delete</button></div>}</td></tr>)}
            </tbody></table></div>)}
      </div>

      {viewBill && <div className="customer-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setViewBill(null); }}>
        <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="view-bill-title" style={{ maxWidth: 900 }}>
          <div className="customer-modal-header"><div><div className="eyebrow">PURCHASE REGISTER</div><h2 id="view-bill-title">{viewBill.bill_number}</h2><p style={{ margin: "4px 0 0", color: "#667085" }}>{suppliers.find(x => x.id === viewBill.supplier_id)?.name ?? "Supplier"} · {viewBill.bill_date} · {viewBill.status}</p></div><button type="button" className="btn" onClick={() => setViewBill(null)}><X size={18}/></button></div>
          <div className="customer-modal-body">
            <div className="module-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
              <div className="card"><div className="stat-top">Total</div><strong>{currency(Number(viewBill.total), company?.currency ?? "INR")}</strong></div>
              <div className="card"><div className="stat-top">Paid</div><strong>{currency(Number(viewBill.amount_paid), company?.currency ?? "INR")}</strong></div>
              <div className="card"><div className="stat-top">Balance</div><strong>{currency(Math.max(0, Number(viewBill.total) - Number(viewBill.amount_paid)), company?.currency ?? "INR")}</strong></div>
            </div>
            <h3>Bill items</h3>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>GST</th><th>Line total</th></tr></thead><tbody>
              {viewLines.map((line: any) => <tr key={line.id}><td>{line.description}</td><td>{line.quantity} {line.unit}</td><td>{currency(Number(line.rate), company?.currency ?? "INR")}</td><td>{line.gst_rate}%</td><td>{currency(Number(line.line_total), company?.currency ?? "INR")}</td></tr>)}
              {!viewLines.length && <tr><td colSpan={5}>No bill items found.</td></tr>}
            </tbody></table></div>
            <h3 style={{ marginTop: 20 }}>Payment history</h3>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead><tbody>
              {viewPayments.map((payment: any) => <tr key={payment.id}><td>{payment.payment_date}</td><td>{payment.payment_method}</td><td>{payment.reference ?? "—"}</td><td>{currency(Number(payment.amount), company?.currency ?? "INR")}</td></tr>)}
              {!viewPayments.length && <tr><td colSpan={4}>No payment records found.</td></tr>}
            </tbody></table></div>
            {viewBill.notes && <><h3 style={{ marginTop: 20 }}>Notes</h3><p>{viewBill.notes}</p></>}
          </div>
          <div className="customer-modal-footer"><button type="button" className="btn" onClick={() => setViewBill(null)}>Close</button>{mayManage && <button type="button" className="btn btn-primary" onClick={() => { const bill = viewBill; setViewBill(null); void openBill(bill); }}><Pencil size={14}/> Edit bill</button>}</div>
        </div>
      </div>}

      {supplierOpen && <div className="customer-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setSupplierOpen(false); }}>
        <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-title">
          <div className="customer-modal-header"><div><div className="eyebrow">PURCHASE MANAGEMENT</div><h2 id="supplier-title">{editingSupplier ? "Edit supplier" : "New supplier"}</h2></div><button type="button" className="btn" onClick={() => setSupplierOpen(false)}><X size={18}/></button></div>
          <form className="customer-modal-form" onSubmit={saveSupplier}><div className="customer-modal-body">
            <div className="customer-form-grid">
              <label className="customer-field">Supplier name *<input required style={input} value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))}/></label>
              <label className="customer-field">Supplier code<input style={input} value={supplierForm.supplier_code} onChange={e => setSupplierForm(p => ({ ...p, supplier_code: e.target.value }))}/></label>
              <label className="customer-field">Phone<input style={input} value={supplierForm.phone} onChange={e => setSupplierForm(p => ({ ...p, phone: e.target.value }))}/></label>
              <label className="customer-field">Email<input type="email" style={input} value={supplierForm.email} onChange={e => setSupplierForm(p => ({ ...p, email: e.target.value }))}/></label>
              <label className="customer-field customer-field-full">GSTIN<input maxLength={15} style={input} value={supplierForm.gstin} onChange={e => setSupplierForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}/></label>
              <label className="customer-field customer-field-full">Address<input style={input} value={supplierForm.address} onChange={e => setSupplierForm(p => ({ ...p, address: e.target.value }))}/></label>
              <label className="customer-field">City<input style={input} value={supplierForm.city} onChange={e => setSupplierForm(p => ({ ...p, city: e.target.value }))}/></label>
              <label className="customer-field">State<input style={input} value={supplierForm.state} onChange={e => setSupplierForm(p => ({ ...p, state: e.target.value }))}/></label>
              <label className="customer-field">PIN code<input style={input} value={supplierForm.postal_code} onChange={e => setSupplierForm(p => ({ ...p, postal_code: e.target.value }))}/></label>
              <label className="customer-field">Payment terms (days)<input type="number" min="0" max="3650" step="1" style={input} value={supplierForm.payment_terms_days} onChange={e => setSupplierForm(p => ({ ...p, payment_terms_days: e.target.value }))}/></label>
            </div>
          </div><div className="customer-modal-footer"><button type="button" className="btn" onClick={() => setSupplierOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save supplier"}</button></div></form>
        </div>
      </div>}

      {billOpen && <div className="customer-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setBillOpen(false); }}>
        <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="bill-title" style={{ maxWidth: 980 }}>
          <div className="customer-modal-header"><div><div className="eyebrow">PURCHASE REGISTER</div><h2 id="bill-title">{editingBillId ? "Edit purchase bill" : "New purchase bill"}</h2></div><button type="button" className="btn" onClick={() => setBillOpen(false)}><X size={18}/></button></div>
          <form className="customer-modal-form" onSubmit={saveBill}><div className="customer-modal-body">
            {activeSuppliers.length === 0 && <div className="notice">Create an active supplier before entering a purchase bill.</div>}
            <div className="customer-form-grid">
              <label className="customer-field">Supplier *<select required style={input} value={supplierId} onChange={e => { setSupplierId(e.target.value); const s = activeSuppliers.find(x => x.id === e.target.value); if (s) setDueDate(addDays(billDate, s.payment_terms_days)); }}><option value="">Select supplier</option>{activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="customer-field">Supplier bill number *<input required style={input} value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="e.g. INV-1001"/></label>
              <label className="customer-field">Bill date *<input required type="date" style={input} value={billDate} onChange={e => { setBillDate(e.target.value); const s = activeSuppliers.find(x => x.id === supplierId); if (s) setDueDate(addDays(e.target.value, s.payment_terms_days)); }}/></label>
              <label className="customer-field">Due date<input type="date" style={input} value={dueDate} onChange={e => setDueDate(e.target.value)}/></label>
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h3 style={{ margin: 0 }}>Bill items</h3><button type="button" className="btn" onClick={() => setLines(p => [...p, blankLine()])}><Plus size={14}/> Add line</button></div>
            <div style={{ overflowX: "auto", marginTop: 10 }}><table className="data-table" style={{ minWidth: 760 }}><thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>GST %</th><th>Line total</th><th></th></tr></thead><tbody>
              {lines.map((line, index) => { const base = Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.rate) || 0); const total = base * (1 + Math.max(0, Number(line.gst_rate) || 0) / 100); return <tr key={index}>
                <td><select style={{ ...input, minWidth: 145 }} value={line.item_id} onChange={e => chooseItem(index, e.target.value)}><option value="">Manual line</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td>
                <td><input required style={{ ...input, minWidth: 150 }} value={line.description} onChange={e => updateLine(index, "description", e.target.value)}/></td>
                <td><input required type="number" min="0.001" step="0.001" style={{ ...input, minWidth: 85 }} value={line.quantity} onChange={e => updateLine(index, "quantity", e.target.value)}/></td>
                <td><input style={{ ...input, minWidth: 75 }} value={line.unit} onChange={e => updateLine(index, "unit", e.target.value)}/></td>
                <td><input required type="number" min="0" step="0.01" style={{ ...input, minWidth: 100 }} value={line.rate} onChange={e => updateLine(index, "rate", e.target.value)}/></td>
                <td><select style={{ ...input, minWidth: 80 }} value={line.gst_rate} onChange={e => updateLine(index, "gst_rate", e.target.value)}>{[0,3,5,12,18,28].map(v => <option key={v} value={v}>{v}%</option>)}</select></td>
                <td style={{ whiteSpace: "nowrap" }}>{currency(total, company?.currency ?? "INR")}</td>
                <td><button type="button" className="btn" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(p => p.filter((_, i) => i !== index))}><Trash2 size={14}/></button></td>
              </tr>; })}
            </tbody></table></div>
            <div className="customer-form-grid" style={{ marginTop: 18 }}>
              <label className="customer-field customer-field-full">Notes<textarea rows={2} style={input} value={notes} onChange={e => setNotes(e.target.value)} /></label>
              <div className="card" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
                <div><div className="stat-top">Subtotal</div><strong>{currency(subtotal, company?.currency ?? "INR")}</strong></div>
                <div><div className="stat-top">GST</div><strong>{currency(taxTotal, company?.currency ?? "INR")}</strong></div>
                <div><div className="stat-top">Grand total</div><strong style={{ fontSize: 19 }}>{currency(billTotal, company?.currency ?? "INR")}</strong></div>
              </div>
            </div>
          </div><div className="customer-modal-footer"><button type="button" className="btn" onClick={() => setBillOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving || activeSuppliers.length === 0}>{saving ? "Saving..." : editingBillId ? "Update purchase bill" : "Save purchase bill"}</button></div></form>
        </div>
      </div>}

      {paymentBill && <div className="customer-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setPaymentBill(null); }}>
        <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title" style={{ maxWidth: 560 }}>
          <div className="customer-modal-header"><div><div className="eyebrow">SUPPLIER PAYMENT</div><h2 id="payment-title">Record payment</h2></div><button type="button" className="btn" onClick={() => setPaymentBill(null)}><X size={18}/></button></div>
          <form className="customer-modal-form" onSubmit={recordPayment}><div className="customer-modal-body">
            <div className="notice">Outstanding balance: <strong>{currency(Number(paymentBill.total) - Number(paymentBill.amount_paid), company?.currency ?? "INR")}</strong></div>
            <div className="customer-form-grid">
              <label className="customer-field">Amount *<input required type="number" min="0.01" max={(Number(paymentBill.total) - Number(paymentBill.amount_paid)).toFixed(2)} step="0.01" style={input} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}/></label>
              <label className="customer-field">Payment date *<input required type="date" style={input} value={paymentDate} onChange={e => setPaymentDate(e.target.value)}/></label>
              <label className="customer-field">Payment method<select style={input} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="card">Card</option><option value="other">Other</option></select></label>
              <label className="customer-field">Reference<input style={input} value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Transaction / cheque reference"/></label>
            </div>
          </div><div className="customer-modal-footer"><button type="button" className="btn" onClick={() => setPaymentBill(null)} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save payment"}</button></div></form>
        </div>
      </div>}
    </div>
  );
}

export default PurchaseWorkspace;
