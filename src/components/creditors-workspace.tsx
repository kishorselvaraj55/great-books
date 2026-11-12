"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Search, RefreshCw, Wallet, AlertCircle, CheckCircle2,
  Download, ReceiptText, History
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = { id: string; name: string; currency: string; role: string };

type Supplier = {
  id: string;
  name: string;
  supplier_code: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
};

type PurchaseBill = {
  id: string;
  company_id: string;
  supplier_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  status: string;
};

type SupplierPayment = {
  id: string;
  purchase_bill_id: string;
  supplier_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 42,
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  background: "#fff",
  color: "#172033",
  font: "inherit",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

function canManage(role?: string) {
  return ["owner", "admin", "manager"].includes((role ?? "").toLowerCase());
}

function money(value: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode || "INR",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return `₹${(Number(value) || 0).toFixed(2)}`;
  }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysOverdue(dueDate: string | null) {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN");
}

export default function CreditorsWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"outstanding" | "overdue" | "all">("outstanding");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentBill, setPaymentBill] = useState<PurchaseBill | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [historySupplier, setHistorySupplier] = useState<string | null>(null);

  const company = companies.find((c) => c.id === companyId);
  const mayManage = canManage(company?.role);
  const supplierById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  );

  const billRows = useMemo(() => {
    return bills.map((bill) => {
      const paid = Number(bill.amount_paid) || 0;
      const total = Number(bill.total) || 0;
      const balance = Math.max(0, total - paid);
      const overdueDays = balance > 0.005 ? daysOverdue(bill.due_date) : 0;
      return {
        ...bill,
        total,
        amount_paid: paid,
        balance,
        overdueDays,
        supplierName: supplierById.get(bill.supplier_id)?.name ?? "Supplier",
      };
    });
  }, [bills, supplierById]);

  const outstandingRows = billRows.filter((b) => b.balance > 0.005);
  const overdueRows = outstandingRows.filter((b) => b.overdueDays > 0);
  const totalOutstanding = outstandingRows.reduce((sum, b) => sum + b.balance, 0);
  const overdueAmount = overdueRows.reduce((sum, b) => sum + b.balance, 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const filteredRows = billRows.filter((b) => {
    if (filter === "outstanding" && b.balance <= 0.005) return false;
    if (filter === "overdue" && (b.balance <= 0.005 || b.overdueDays <= 0)) return false;
    const supplier = supplierById.get(b.supplier_id);
    const q = search.trim().toLowerCase();
    return !q || [
      b.bill_number,
      b.supplierName,
      supplier?.phone ?? "",
      supplier?.email ?? "",
      b.status,
    ].join(" ").toLowerCase().includes(q);
  });

  const load = useCallback(async () => {
    if (!companyId) {
      setSuppliers([]);
      setBills([]);
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [supplierResult, billResult, paymentResult] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id,name,supplier_code,phone,email,gstin")
        .eq("company_id", companyId)
        .order("name"),
      supabase
        .from("purchase_bills")
        .select("id,company_id,supplier_id,bill_number,bill_date,due_date,total,amount_paid,status")
        .eq("company_id", companyId)
        .order("bill_date", { ascending: false }),
      supabase
        .from("supplier_payments")
        .select("id,purchase_bill_id,supplier_id,amount,payment_date,payment_method,reference")
        .eq("company_id", companyId)
        .order("payment_date", { ascending: false }),
    ]);

    if (supplierResult.error) {
      setError(`Unable to load suppliers: ${supplierResult.error.message}`);
    } else {
      setSuppliers((supplierResult.data ?? []) as Supplier[]);
    }

    if (billResult.error) {
      setError(`Unable to load purchase bills: ${billResult.error.message}`);
    } else {
      setBills((billResult.data ?? []) as PurchaseBill[]);
    }

    if (paymentResult.error) {
      setError(`Unable to load supplier payments: ${paymentResult.error.message}`);
    } else {
      setPayments((paymentResult.data ?? []) as SupplierPayment[]);
    }

    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openPayment(bill: PurchaseBill) {
    const balance = Math.max(0, Number(bill.total) - Number(bill.amount_paid));
    setPaymentBill(bill);
    setAmount(balance.toFixed(2));
    setPaymentDate(todayISO());
    setPaymentMethod("bank_transfer");
    setReference("");
    setError("");
    setSuccess("");
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentBill || !mayManage) {
      setError("You do not have permission to record supplier payments.");
      return;
    }

    const paymentAmount = Number(amount);
    const currentBalance = Math.max(
      0,
      Number(paymentBill.total) - Number(paymentBill.amount_paid)
    );

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0 ||
      paymentAmount > currentBalance + 0.005
    ) {
      setError(`Enter an amount greater than zero and no more than ${money(currentBalance, company?.currency ?? "INR")}.`);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { data: authData } = await supabase.auth.getUser();

    const { error: insertError } = await supabase
      .from("supplier_payments")
      .insert({
        company_id: companyId,
        purchase_bill_id: paymentBill.id,
        supplier_id: paymentBill.supplier_id,
        amount: Number(paymentAmount.toFixed(2)),
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference.trim() || null,
        created_by: authData.user?.id ?? null,
      });

    if (insertError) {
      setSaving(false);
      setError(`Unable to record payment: ${insertError.message}`);
      return;
    }

    const newPaid = Number(
      (Number(paymentBill.amount_paid) + paymentAmount).toFixed(2)
    );
    const newStatus =
      newPaid >= Number(paymentBill.total) - 0.005 ? "paid" : "partial";

    const { error: updateError } = await supabase
      .from("purchase_bills")
      .update({
        amount_paid: newPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentBill.id)
      .eq("company_id", companyId);

    setSaving(false);

    if (updateError) {
      setError(
        `Payment was recorded but the bill balance update failed: ${updateError.message}. Refresh and reconcile this bill before retrying.`
      );
      await load();
      return;
    }

    setPaymentBill(null);
    setSuccess("Supplier payment recorded successfully.");
    await load();
  }

  function exportCsv() {
    const rows = [
      [
        "Bill number", "Supplier", "Bill date", "Due date",
        "Bill total", "Paid", "Outstanding", "Days overdue", "Status",
      ],
      ...filteredRows.map((b) => [
        b.bill_number,
        b.supplierName,
        b.bill_date,
        b.due_date ?? "",
        b.total,
        b.amount_paid,
        b.balance,
        b.overdueDays,
        b.status,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "creditors-payables-register.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const historyPayments = historySupplier
    ? payments.filter((p) => p.supplier_id === historySupplier)
    : [];

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GREAT BOOKS WORKSPACE</div>
          <h1>Creditors Management</h1>
          <p>Track supplier balances, due dates, overdue bills and payments.</p>
        </div>
        <div style={rowStyle}>
          <button
            type="button"
            className="btn"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {companies.length > 1 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            Company
            <select
              style={inputStyle}
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setSearch("");
                setError("");
                setSuccess("");
              }}
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!companyId && (
        <div className="notice">
          Your account needs an active company membership before creditors can be managed.
        </div>
      )}

      {companyId && !mayManage && (
        <div className="notice">
          You have read-only access to Creditors Management.
        </div>
      )}

      {error && (
        <div className="notice" role="alert" style={{ borderColor: "#fecaca", color: "#b42318" }}>
          <AlertCircle size={16} style={{ verticalAlign: "middle", marginRight: 7 }} />
          {error}
        </div>
      )}

      {success && (
        <div className="notice" role="status" style={{ borderColor: "#bbf7d0", color: "#166534" }}>
          <CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 7 }} />
          {success}
        </div>
      )}

      <div
        className="module-grid"
        style={{
          gridTemplateColumns: "repeat(3,minmax(0,1fr))",
          marginBottom: 18,
        }}
      >
        <div className="card">
          <div className="stat-top">Total outstanding</div>
          <div className="stat-value">{money(totalOutstanding, company?.currency ?? "INR")}</div>
          <div className="stat-foot">{outstandingRows.length} unpaid or partially paid bills</div>
        </div>
        <div className="card">
          <div className="stat-top">Overdue amount</div>
          <div className="stat-value">{money(overdueAmount, company?.currency ?? "INR")}</div>
          <div className="stat-foot">{overdueRows.length} overdue bills</div>
        </div>
        <div className="card">
          <div className="stat-top">Payments recorded</div>
          <div className="stat-value">{money(totalPaid, company?.currency ?? "INR")}</div>
          <div className="stat-foot">{payments.length} supplier payments</div>
        </div>
      </div>

      <div className="card">
        <div className="inventory-toolbar" style={{ gap: 12, alignItems: "center" }}>
          <div className="inventory-search-wrap" style={{ flex: 1, minWidth: 240 }}>
            <Search size={17} className="inventory-search-icon" />
            <input
              className="inventory-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bill number, supplier, phone or email..."
            />
          </div>
          <button type="button" className="btn" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div style={{ ...rowStyle, margin: "12px 0 16px" }}>
          <button
            type="button"
            className={`btn ${filter === "outstanding" ? "btn-primary" : ""}`}
            onClick={() => setFilter("outstanding")}
          >
            Outstanding
          </button>
          <button
            type="button"
            className={`btn ${filter === "overdue" ? "btn-primary" : ""}`}
            onClick={() => setFilter("overdue")}
          >
            Overdue
          </button>
          <button
            type="button"
            className={`btn ${filter === "all" ? "btn-primary" : ""}`}
            onClick={() => setFilter("all")}
          >
            All bills
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Loading creditor records...</div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state">
            <Wallet size={30} />
            <h3>No bills found</h3>
            <p>Purchase bills with supplier balances will appear here automatically.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Supplier</th>
                  <th>Bill date</th>
                  <th>Due date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((bill) => {
                  const isOverdue = bill.balance > 0.005 && bill.overdueDays > 0;
                  return (
                    <tr key={bill.id}>
                      <td><strong>{bill.bill_number}</strong></td>
                      <td>
                        <strong>{bill.supplierName}</strong>
                        <div className="customer-muted">
                          {supplierById.get(bill.supplier_id)?.phone ?? ""}
                        </div>
                      </td>
                      <td>{formatDate(bill.bill_date)}</td>
                      <td>
                        {formatDate(bill.due_date)}
                        {isOverdue && (
                          <div style={{ color: "#b42318", fontSize: 11 }}>
                            {bill.overdueDays} days overdue
                          </div>
                        )}
                      </td>
                      <td>{money(bill.total, company?.currency ?? "INR")}</td>
                      <td>{money(bill.amount_paid, company?.currency ?? "INR")}</td>
                      <td><strong>{money(bill.balance, company?.currency ?? "INR")}</strong></td>
                      <td>
                        <span className={`status ${bill.balance <= 0.005 ? "paid" : isOverdue ? "overdue" : "status-active"}`}>
                          {bill.balance <= 0.005 ? "Paid" : isOverdue ? "Overdue" : bill.status === "partial" ? "Partial" : "Unpaid"}
                        </span>
                      </td>
                      <td>
                        <div style={rowStyle}>
                          {mayManage && bill.balance > 0.005 && (
                            <button type="button" className="btn btn-primary" onClick={() => openPayment(bill)}>
                              <Wallet size={14} /> Pay
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setHistorySupplier(bill.supplier_id)}
                            title="View supplier payment history"
                          >
                            <History size={14} /> History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-heading">
          <div>
            <h2>Supplier balances</h2>
            <p>Outstanding amount grouped by supplier.</p>
          </div>
        </div>
        {suppliers.length === 0 ? (
          <div className="empty-state">No suppliers found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th>GSTIN</th>
                  <th>Outstanding bills</th>
                  <th>Outstanding amount</th>
                  <th>Payment history</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const supplierBills = outstandingRows.filter((b) => b.supplier_id === supplier.id);
                  const balance = supplierBills.reduce((sum, b) => sum + b.balance, 0);
                  return (
                    <tr key={supplier.id}>
                      <td><strong>{supplier.name}</strong></td>
                      <td>{supplier.phone ?? "—"}</td>
                      <td>{supplier.gstin ?? "—"}</td>
                      <td>{supplierBills.length}</td>
                      <td><strong>{money(balance, company?.currency ?? "INR")}</strong></td>
                      <td>
                        <button type="button" className="btn" onClick={() => setHistorySupplier(supplier.id)}>
                          <History size={14} /> View history
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paymentBill && (
        <div
          className="customer-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setPaymentBill(null);
          }}
        >
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="creditor-payment-title" style={{ maxWidth: 620 }}>
            <div className="customer-modal-header">
              <div>
                <div className="eyebrow">SUPPLIER PAYMENT</div>
                <h2 id="creditor-payment-title">Record payment</h2>
              </div>
              <button type="button" className="btn" onClick={() => setPaymentBill(null)}>×</button>
            </div>
            <form
              className="customer-modal-form"
              onSubmit={savePayment}
            >
              <div className="customer-modal-body">
                <div className="notice">
                  <strong>{supplierById.get(paymentBill.supplier_id)?.name ?? "Supplier"}</strong>
                  <br />
                  Bill: {paymentBill.bill_number}
                  <br />
                  Outstanding balance:{" "}
                  <strong>
                    {money(
                      Number(paymentBill.total) - Number(paymentBill.amount_paid),
                      company?.currency ?? "INR"
                    )}
                  </strong>
                </div>
                <div className="customer-form-grid">
                  <label className="customer-field">
                    Amount *
                    <input
                      required
                      type="number"
                      min="0.01"
                      max={(Number(paymentBill.total) - Number(paymentBill.amount_paid)).toFixed(2)}
                      step="0.01"
                      style={inputStyle}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label className="customer-field">
                    Payment date *
                    <input
                      required
                      type="date"
                      style={inputStyle}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </label>
                  <label className="customer-field">
                    Payment method
                    <select
                      style={inputStyle}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="customer-field">
                    Reference / transaction ID
                    <input
                      style={inputStyle}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>
              </div>
              <div className="customer-modal-footer">
                <button type="button" className="btn" onClick={() => setPaymentBill(null)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historySupplier && (
        <div
          className="customer-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setHistorySupplier(null);
          }}
        >
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="creditor-history-title" style={{ maxWidth: 820 }}>
            <div className="customer-modal-header">
              <div>
                <div className="eyebrow">SUPPLIER ACCOUNT</div>
                <h2 id="creditor-history-title">
                  Payment history — {supplierById.get(historySupplier)?.name ?? "Supplier"}
                </h2>
              </div>
              <button type="button" className="btn" onClick={() => setHistorySupplier(null)}>×</button>
            </div>
            <div className="customer-modal-body">
              {historyPayments.length === 0 ? (
                <div className="empty-state">
                  <ReceiptText size={28} />
                  <h3>No payments recorded</h3>
                  <p>Payments for this supplier will appear here.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Payment date</th>
                        <th>Bill number</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyPayments.map((payment) => {
                        const bill = bills.find((b) => b.id === payment.purchase_bill_id);
                        return (
                          <tr key={payment.id}>
                            <td>{formatDate(payment.payment_date)}</td>
                            <td>{bill?.bill_number ?? "—"}</td>
                            <td><strong>{money(Number(payment.amount), company?.currency ?? "INR")}</strong></td>
                            <td>{payment.payment_method.replaceAll("_", " ")}</td>
                            <td>{payment.reference ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="customer-modal-footer">
              <button type="button" className="btn" onClick={() => setHistorySupplier(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
