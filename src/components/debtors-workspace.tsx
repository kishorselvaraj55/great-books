"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, Wallet, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string;
  role: string;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type Invoice = {
  id: string;
  company_id: string;
  customer_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  grand_total: number | string;
  amount_paid: number | string | null;
};

type Receipt = {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: number | string;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  created_at: string;
};

type DebtorRow = Invoice & {
  customer: Customer | null;
  paid: number;
  outstanding: number;
  overdueDays: number;
};

const moneyNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const todayISO = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN");
};

export function DebtorsWorkspace({ companies }: { companies: Company[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"outstanding" | "overdue" | "all">("outstanding");
  const [selectedInvoice, setSelectedInvoice] = useState<DebtorRow | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");

  const currency = companies.find((company) => company.id === companyId)?.currency || "INR";
  const mayWrite = ["owner", "admin", "manager"].includes(
    (companies.find((company) => company.id === companyId)?.role || "").toLowerCase()
  );

  const formatMoney = useCallback((value: number) => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${currency} ${value.toFixed(2)}`;
    }
  }, [currency]);

  const loadData = useCallback(async () => {
    if (!companyId) {
      setCustomers([]);
      setInvoices([]);
      setReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const [customerResult, invoiceResult, receiptResult] = await Promise.all([
      supabase
        .from("customers")
        .select("id,name,phone,email")
        .eq("company_id", companyId)
        .order("name"),
      supabase
        .from("sales_invoices")
        .select("id,company_id,customer_id,invoice_number,invoice_date,due_date,status,grand_total,amount_paid")
        .eq("company_id", companyId)
        .order("invoice_date", { ascending: false }),
      supabase
        .from("customer_payments")
        .select("id,invoice_id,customer_id,amount,payment_date,payment_method,reference,created_at")
        .eq("company_id", companyId)
        .order("payment_date", { ascending: false }),
    ]);

    const failures = [
      customerResult.error?.message,
      invoiceResult.error?.message,
      receiptResult.error?.message,
    ].filter(Boolean);

    if (failures.length) setError(`Unable to load debtor records: ${failures.join(" | ")}`);

    setCustomers((customerResult.data ?? []) as Customer[]);
    setInvoices((invoiceResult.data ?? []) as Invoice[]);
    setReceipts((receiptResult.data ?? []) as Receipt[]);
    setLoading(false);
  }, [companyId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const rows = useMemo<DebtorRow[]>(() => {
    const today = new Date(`${todayISO()}T00:00:00`);
    return invoices
      .filter((invoice) => invoice.status !== "cancelled")
      .map((invoice) => {
        const paid = moneyNumber(invoice.amount_paid);
        const outstanding = Math.max(0, moneyNumber(invoice.grand_total) - paid);
        const due = invoice.due_date ? new Date(`${invoice.due_date}T00:00:00`) : null;
        const overdueDays =
          due && outstanding > 0 && due < today
            ? Math.floor((today.getTime() - due.getTime()) / 86400000)
            : 0;
        return {
          ...invoice,
          customer: customerMap.get(invoice.customer_id) ?? null,
          paid,
          outstanding,
          overdueDays,
        };
      });
  }, [invoices, customerMap]);

  const outstandingRows = rows.filter((row) => row.outstanding > 0.009);
  const totalOutstanding = outstandingRows.reduce((sum, row) => sum + row.outstanding, 0);
  const overdueRows = outstandingRows.filter((row) => row.overdueDays > 0);
  const totalOverdue = overdueRows.reduce((sum, row) => sum + row.outstanding, 0);
  const totalCollected = receipts.reduce((sum, receipt) => sum + moneyNumber(receipt.amount), 0);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "outstanding" && row.outstanding <= 0.009) return false;
      if (filter === "overdue" && row.overdueDays <= 0) return false;
      if (!term) return true;
      return [
        row.invoice_number,
        row.customer?.name,
        row.customer?.phone,
        row.customer?.email,
      ].some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [rows, filter, search]);

  const openPayment = (row: DebtorRow) => {
    setSelectedInvoice(row);
    setAmount(row.outstanding.toFixed(2));
    setPaymentDate(todayISO());
    setPaymentMethod("bank_transfer");
    setReference("");
    setError("");
    setSuccess("");
  };

  const savePayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInvoice || !companyId) return;

    const paymentAmount = moneyNumber(amount);
    if (paymentAmount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    if (paymentAmount > selectedInvoice.outstanding + 0.009) {
      setError("Payment cannot be greater than the outstanding balance.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setSaving(false);
      setError("Your session has expired. Please sign in again.");
      return;
    }

    const receiptPayload = {
      company_id: companyId,
      invoice_id: selectedInvoice.id,
      customer_id: selectedInvoice.customer_id,
      amount: paymentAmount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference: reference.trim() || null,
      received_by: authData.user.id,
    };

    const { error: receiptError } = await supabase
      .from("customer_payments")
      .insert(receiptPayload);

    if (receiptError) {
      setSaving(false);
      setError(`Payment could not be recorded: ${receiptError.message}`);
      return;
    }

    const newPaid = selectedInvoice.paid + paymentAmount;
    const { error: invoiceError } = await supabase
      .from("sales_invoices")
      .update({
        amount_paid: newPaid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedInvoice.id)
      .eq("company_id", companyId);

    setSaving(false);

    if (invoiceError) {
      setError(
        `Receipt was saved, but the invoice balance could not be updated: ${invoiceError.message}. Do not record this payment again; contact support to reconcile it.`
      );
      await loadData();
      return;
    }

    setSelectedInvoice(null);
    setSuccess(`Payment of ${formatMoney(paymentAmount)} recorded for invoice ${selectedInvoice.invoice_number}.`);
    await loadData();
  };

  const exportCsv = () => {
    const headers = ["Invoice", "Invoice date", "Due date", "Customer", "Invoice total", "Paid", "Outstanding", "Overdue days"];
    const values = filteredRows.map((row) => [
      row.invoice_number,
      row.invoice_date,
      row.due_date ?? "",
      row.customer?.name ?? "",
      moneyNumber(row.grand_total).toFixed(2),
      row.paid.toFixed(2),
      row.outstanding.toFixed(2),
      String(row.overdueDays),
    ]);
    const csv = [headers, ...values]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "great-books-debtors.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GREAT BOOKS WORKSPACE</div>
          <h1>Debtors Management</h1>
          <p>Track customer receivables, collect payments and monitor overdue invoices.</p>
        </div>
        <div className="sales-heading-actions">
          <button type="button" className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {companies.length > 1 && (
        <label className="customer-company-select">
          Company
          <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
      )}

      {error && <div className="notice" role="alert">{error}</div>}
      {success && <div className="notice customer-success" role="status">{success}</div>}

      <div className="module-grid sales-stats">
        <div className="card">
          <div className="stat-top">Total outstanding</div>
          <div className="stat-value">{formatMoney(totalOutstanding)}</div>
          <div className="stat-foot">{outstandingRows.length} unpaid or partially paid invoices</div>
        </div>
        <div className="card">
          <div className="stat-top">Overdue amount</div>
          <div className="stat-value">{formatMoney(totalOverdue)}</div>
          <div className="stat-foot">{overdueRows.length} overdue invoices</div>
        </div>
        <div className="card">
          <div className="stat-top">Payments recorded</div>
          <div className="stat-value">{formatMoney(totalCollected)}</div>
          <div className="stat-foot">{receipts.length} receipts in this company</div>
        </div>
      </div>

      <div className="card sales-list-card">
        <div className="inventory-toolbar">
          <div className="inventory-search-wrap">
            <Search size={17} className="inventory-search-icon" />
            <input
              className="inventory-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice number, customer, phone or email..."
            />
          </div>
          <button type="button" className="btn" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div className="sales-filter-tabs">
          <button type="button" className={filter === "outstanding" ? "btn btn-primary" : "btn"} onClick={() => setFilter("outstanding")}>
            Outstanding
          </button>
          <button type="button" className={filter === "overdue" ? "btn btn-primary" : "btn"} onClick={() => setFilter("overdue")}>
            Overdue
          </button>
          <button type="button" className={filter === "all" ? "btn btn-primary" : "btn"} onClick={() => setFilter("all")}>
            All invoices
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Loading debtor records...</div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state">
            <Wallet size={28} style={{ marginBottom: 12, opacity: 0.55 }} />
            <h3>No debtor invoices found</h3>
            <p>Invoices with an outstanding balance will appear here automatically after they are created in Sales.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Invoice date</th>
                  <th>Due date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.invoice_number}</strong></td>
                    <td>
                      <strong>{row.customer?.name ?? "Customer"}</strong>
                      <div className="customer-muted">{row.customer?.phone ?? row.customer?.email ?? ""}</div>
                    </td>
                    <td>{formatDate(row.invoice_date)}</td>
                    <td>{formatDate(row.due_date)}</td>
                    <td>{formatMoney(moneyNumber(row.grand_total))}</td>
                    <td>{formatMoney(row.paid)}</td>
                    <td><strong>{formatMoney(row.outstanding)}</strong></td>
                    <td>
                      {row.outstanding <= 0.009 ? (
                        <span className="status status-active">Paid</span>
                      ) : row.overdueDays > 0 ? (
                        <span className="status status-inactive">Overdue {row.overdueDays}d</span>
                      ) : row.paid > 0 ? (
                        <span className="status status-active">Part paid</span>
                      ) : (
                        <span className="status">Unpaid</span>
                      )}
                    </td>
                    <td>
                      {row.outstanding > 0.009 && mayWrite ? (
                        <button type="button" className="btn btn-primary" onClick={() => openPayment(row)}>
                          <Wallet size={14} /> Receive
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="customer-list-footer">
          Showing {filteredRows.length} of {rows.length} invoices
        </div>
      </div>

      {selectedInvoice && (
        <div className="customer-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setSelectedInvoice(null);
        }}>
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="debtor-payment-title">
            <div className="customer-modal-header">
              <div>
                <div className="eyebrow">CUSTOMER RECEIPT</div>
                <h2 id="debtor-payment-title">Record payment</h2>
              </div>
              <button type="button" className="btn" onClick={() => setSelectedInvoice(null)} disabled={saving} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form className="customer-modal-form" onSubmit={savePayment}>
              <div className="customer-modal-body">
                {error && <div className="notice" role="alert">{error}</div>}
                <div className="notice">
                  <strong>{selectedInvoice.customer?.name ?? "Customer"}</strong>
                  <br />
                  Invoice: {selectedInvoice.invoice_number}
                  <br />
                  Outstanding balance: <strong>{formatMoney(selectedInvoice.outstanding)}</strong>
                </div>

                <div className="customer-form-grid">
                  <label className="customer-field">
                    Amount received *
                    <input
                      type="number"
                      min="0.01"
                      max={selectedInvoice.outstanding}
                      step="0.01"
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                  </label>
                  <label className="customer-field">
                    Payment date *
                    <input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                  </label>
                  <label className="customer-field">
                    Payment method
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
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
                    <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional" />
                  </label>
                </div>
              </div>

              <div className="customer-modal-footer">
                <button type="button" className="btn" onClick={() => setSelectedInvoice(null)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DebtorsWorkspace;
