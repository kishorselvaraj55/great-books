"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, Download, RefreshCw, Search, TrendingUp,
  ShoppingCart, Package, Users, Wallet, CalendarDays, FileSpreadsheet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = { id: string; name: string; currency: string; role: string };
type AnyRow = Record<string, any>;
type ReportKey =
  | "sales" | "purchases" | "debtors" | "creditors"
  | "inventory" | "expenses" | "attendance" | "salary";

const REPORTS: { key: ReportKey; label: string; description: string }[] = [
  { key: "sales", label: "Sales", description: "Sales invoices, collections and GST summary" },
  { key: "purchases", label: "Purchases", description: "Purchase bills and supplier payments" },
  { key: "debtors", label: "Debtors", description: "Customer invoice balances and overdue amounts" },
  { key: "creditors", label: "Creditors", description: "Supplier bill balances and overdue amounts" },
  { key: "inventory", label: "Inventory", description: "Opening stock and recorded purchase/sales movement" },
  { key: "expenses", label: "Expenses", description: "Expense register by date and category" },
  { key: "attendance", label: "Attendance", description: "Attendance records and overtime" },
  { key: "salary", label: "Salary", description: "Salary runs and salary payment records" },
];

const inputStyle: React.CSSProperties = {
  minHeight: 40, padding: "9px 11px", border: "1px solid #d0d5dd",
  borderRadius: 8, background: "#fff", color: "#172033", font: "inherit",
};
const buttonStyle: React.CSSProperties = {
  minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: 8, padding: "9px 13px", border: "1px solid #d0d5dd", borderRadius: 8,
  background: "#fff", color: "#344054", fontWeight: 600, cursor: "pointer",
};
const cardStyle: React.CSSProperties = {
  border: "1px solid #eaecf0", borderRadius: 12, padding: 16, background: "#fff",
};
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "11px 12px", color: "#667085", fontSize: 12,
  fontWeight: 700, whiteSpace: "nowrap", background: "#f9fafb",
  borderBottom: "1px solid #eaecf0",
};
const tdStyle: React.CSSProperties = {
  padding: "11px 12px", borderBottom: "1px solid #f0f1f3",
  color: "#344054", fontSize: 13, verticalAlign: "top",
};

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstDayOfYear() { return `${new Date().getFullYear()}-01-01`; }
function today() { return isoDate(new Date()); }
function n(v: any) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function dateInRange(value: any, from: string, to: string) {
  if (!value) return true;
  const d = String(value).slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}
function fmtDate(value: any) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-IN");
}
function escapeCsv(value: any) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}
function daysLate(due: any) {
  if (!due) return 0;
  const diff = new Date(`${today()}T00:00:00`).getTime() -
    new Date(`${String(due).slice(0, 10)}T00:00:00`).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}
function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: currency || "INR", maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${currency || "INR"} ${(value || 0).toFixed(2)}`;
  }
}

export default function ReportsWorkspace({ companies }: { companies: Company[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [active, setActive] = useState<ReportKey>("sales");
  const [from, setFrom] = useState(firstDayOfYear());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastLoaded, setLastLoaded] = useState("");
  const [data, setData] = useState<Record<string, AnyRow[]>>({
    invoices: [], invoiceLines: [], customers: [], customerPayments: [],
    bills: [], billItems: [], suppliers: [], supplierPayments: [],
    items: [], expenses: [], attendance: [], employees: [],
    salaryRuns: [], salaryPayments: [],
  });

  const company = companies.find(c => c.id === companyId);
  const currency = company?.currency || "INR";

  const load = useCallback(async () => {
    if (!companyId) { setData({}); return; }
    setLoading(true);
    setError("");
    const specs = [
      ["invoices", "sales_invoices"], ["invoiceLines", "sales_invoice_lines"],
      ["customers", "customers"], ["customerPayments", "customer_payments"],
      ["bills", "purchase_bills"], ["billItems", "purchase_bill_items"],
      ["suppliers", "suppliers"], ["supplierPayments", "supplier_payments"],
      ["items", "items"], ["expenses", "expenses"],
      ["attendance", "attendance_records"], ["employees", "employees"],
      ["salaryRuns", "salary_runs"], ["salaryPayments", "salary_payments"],
    ] as const;
    try {
      const results = await Promise.all(specs.map(async ([key, table]) => {
        const result = await supabase.from(table).select("*").eq("company_id", companyId);
        return { key, data: result.data ?? [], error: result.error };
      }));
      const failed = results.find(r => r.error);
      if (failed?.error) throw new Error(`${failed.key}: ${failed.error.message}`);
      const next: Record<string, AnyRow[]> = {};
      results.forEach(r => { next[r.key] = r.data as AnyRow[]; });
      setData(next);
      setLastLoaded(new Date().toLocaleString("en-IN"));
    } catch (e: any) {
      setError(e?.message || "Unable to load report data.");
    } finally {
      setLoading(false);
    }
  }, [companyId, supabase]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const d = data as Record<string, AnyRow[]>;
    const invoices = (d.invoices || []).filter(r => dateInRange(r.invoice_date, from, to));
    const bills = (d.bills || []).filter(r => dateInRange(r.bill_date, from, to));
    const expenses = (d.expenses || []).filter(r => dateInRange(r.expense_date, from, to));
    const attendance = (d.attendance || []).filter(r => dateInRange(r.attendance_date, from, to));
    const salaryRuns = (d.salaryRuns || []).filter(r =>
      (!from || String(r.period_end || r.period_start || "").slice(0, 10) >= from) &&
      (!to || String(r.period_start || r.period_end || "").slice(0, 10) <= to)
    );
    const salaryPayments = (d.salaryPayments || []).filter(r => dateInRange(r.payment_date || r.salary_month, from, to));
    const customerMap = new Map((d.customers || []).map(r => [r.id, r]));
    const supplierMap = new Map((d.suppliers || []).map(r => [r.id, r]));
    const employeeMap = new Map((d.employees || []).map(r => [r.id, r]));
    const invoiceRows = invoices.map(r => ({
      "Invoice No.": r.invoice_number, Date: fmtDate(r.invoice_date),
      Customer: customerMap.get(r.customer_id)?.name || "Customer",
      Status: r.status || "—", "Taxable value": n(r.subtotal),
      "CGST": n(r.cgst_total), "SGST": n(r.sgst_total), "IGST": n(r.igst_total),
      Total: n(r.grand_total), Received: n(r.amount_paid),
      Balance: Math.max(0, n(r.grand_total) - n(r.amount_paid)),
    }));
    const billRows = bills.map(r => ({
      "Bill No.": r.bill_number || r.vendor_invoice_number || "—",
      Date: fmtDate(r.bill_date),
      Supplier: supplierMap.get(r.supplier_id)?.name || "Supplier",
      Status: r.status || "—", Subtotal: n(r.subtotal),
      Tax: n(r.tax_total), Total: n(r.total ?? r.grand_total),
      Paid: n(r.amount_paid),
      Balance: Math.max(0, n(r.total ?? r.grand_total) - n(r.amount_paid)),
    }));
    const debtorRows = invoices.map(r => {
      const total = n(r.grand_total), paid = n(r.amount_paid);
      const balance = Math.max(0, total - paid);
      return {
        "Invoice No.": r.invoice_number, Customer: customerMap.get(r.customer_id)?.name || "Customer",
        "Invoice date": fmtDate(r.invoice_date), "Due date": fmtDate(r.due_date),
        Total: total, Paid: paid, Outstanding: balance,
        "Days overdue": balance > 0 ? daysLate(r.due_date) : 0,
      };
    }).filter(r => r.Outstanding > 0.005);
    const creditorRows = bills.map(r => {
      const total = n(r.total ?? r.grand_total), paid = n(r.amount_paid);
      const balance = Math.max(0, total - paid);
      return {
        "Bill No.": r.bill_number || r.vendor_invoice_number || "—",
        Supplier: supplierMap.get(r.supplier_id)?.name || "Supplier",
        "Bill date": fmtDate(r.bill_date), "Due date": fmtDate(r.due_date),
        Total: total, Paid: paid, Outstanding: balance,
        "Days overdue": balance > 0 ? daysLate(r.due_date) : 0,
      };
    }).filter(r => r.Outstanding > 0.005);
    const expenseRows = expenses.map(r => ({
      Date: fmtDate(r.expense_date), Category: r.category || "Uncategorised",
      Description: r.description || "—", "Payment method": r.payment_method || "—",
      Amount: n(r.amount),
    }));
    const attendanceRows = attendance.map(r => ({
      Date: fmtDate(r.attendance_date),
      Employee: employeeMap.get(r.employee_id)?.full_name || "Employee",
      Department: employeeMap.get(r.employee_id)?.department || "—",
      Status: r.status || "—", "Overtime hours": n(r.overtime_hours),
      Notes: r.notes || "—",
    }));
    const salaryRunRows = salaryRuns.map(r => ({
      Employee: employeeMap.get(r.employee_id)?.full_name || "Employee",
      "Period start": fmtDate(r.period_start), "Period end": fmtDate(r.period_end),
      "Paid days": n(r.paid_days), "Overtime amount": n(r.overtime_amount),
      Allowances: n(r.allowances), Deductions: n(r.deductions),
      "Advance deduction": n(r.advance_deduction), "Gross pay": n(r.gross_pay),
      "Net pay": n(r.net_pay), Status: r.status || "—",
    }));
    const salaryPaymentRows = salaryPayments.map(r => ({
      Employee: employeeMap.get(r.employee_id)?.full_name || "Employee",
      "Salary month": r.salary_month || "—", "Base amount": n(r.base_amount),
      Payable: n(r.payable_amount), Paid: n(r.paid_amount),
      "Payment status": r.payment_status || "—",
      "Payment date": fmtDate(r.payment_date), "Payment method": r.payment_method || "—",
    }));
    const itemRows = (d.items || []).filter(r => r.is_active !== false).map(item => {
      const bought = (d.billItems || []).filter(line => line.item_id === item.id &&
        dateInRange((d.bills || []).find(b => b.id === line.purchase_bill_id)?.bill_date, from, to))
        .reduce((s, line) => s + n(line.quantity), 0);
      const sold = (d.invoiceLines || []).filter(line => line.item_id === item.id &&
        dateInRange((d.invoices || []).find(inv => inv.id === line.invoice_id)?.invoice_date, from, to))
        .reduce((s, line) => s + n(line.quantity), 0);
      const opening = n(item.opening_stock);
      return {
        Code: item.code || "—", Item: item.name, Type: item.item_type || "—",
        Unit: item.unit || "—", "Opening stock": opening,
        "Purchases in period": bought, "Sales in period": sold,
        "Estimated stock": opening + bought - sold,
        "Purchase price": n(item.purchase_price),
        "Estimated stock value": (opening + bought - sold) * n(item.purchase_price),
      };
    });
    const salesTotal = invoiceRows.reduce((s, r) => s + n(r.Total), 0);
    const salesReceived = invoiceRows.reduce((s, r) => s + n(r.Received), 0);
    const purchaseTotal = billRows.reduce((s, r) => s + n(r.Total), 0);
    const purchasePaid = billRows.reduce((s, r) => s + n(r.Paid), 0);
    const expenseTotal = expenseRows.reduce((s, r) => s + n(r.Amount), 0);
    const salaryNet = salaryRunRows.reduce((s, r) => s + n(r["Net pay"]), 0);
    const salaryPaid = salaryPaymentRows.reduce((s, r) => s + n(r.Paid), 0);
    const paymentRows = (d.customerPayments || []).filter(r => dateInRange(r.payment_date, from, to));
    const supplierPaymentRows = (d.supplierPayments || []).filter(r => dateInRange(r.payment_date, from, to));
    const invoiceLineRows = (d.invoiceLines || []).filter(line =>
      dateInRange((d.invoices || []).find(inv => inv.id === line.invoice_id)?.invoice_date, from, to));
    const billItemRows = (d.billItems || []).filter(line =>
      dateInRange((d.bills || []).find(b => b.id === line.purchase_bill_id)?.bill_date, from, to));
    return {
      sales: { rows: invoiceRows, metrics: [
        ["Invoice total", salesTotal], ["Collections recorded", salesReceived],
        ["Outstanding", invoiceRows.reduce((s, r) => s + n(r.Balance), 0)],
        ["GST collected on invoices", invoiceRows.reduce((s, r) => s + n(r.CGST) + n(r.SGST) + n(r.IGST), 0)],
      ], extra: paymentRows.length ? `${paymentRows.length} customer payment entries in this period` : "No customer payment entries in this period" },
      purchases: { rows: billRows, metrics: [
        ["Purchase total", purchaseTotal], ["Paid to suppliers", purchasePaid],
        ["Outstanding", billRows.reduce((s, r) => s + n(r.Balance), 0)],
        ["Purchase bill count", billRows.length],
      ], extra: `${billItemRows.length} purchase line entries in this period` },
      debtors: { rows: debtorRows, metrics: [
        ["Outstanding receivables", debtorRows.reduce((s, r) => s + n(r.Outstanding), 0)],
        ["Overdue receivables", debtorRows.filter(r => n(r["Days overdue"]) > 0).reduce((s, r) => s + n(r.Outstanding), 0)],
        ["Open invoices", debtorRows.length],
      ], extra: "Balances are calculated as invoice grand total less amount paid." },
      creditors: { rows: creditorRows, metrics: [
        ["Outstanding payables", creditorRows.reduce((s, r) => s + n(r.Outstanding), 0)],
        ["Overdue payables", creditorRows.filter(r => n(r["Days overdue"]) > 0).reduce((s, r) => s + n(r.Outstanding), 0)],
        ["Open bills", creditorRows.length],
      ], extra: "Balances are calculated as purchase bill total less amount paid." },
      inventory: { rows: itemRows, metrics: [
        ["Active items", itemRows.length],
        ["Estimated stock value", itemRows.reduce((s, r) => s + n(r["Estimated stock value"]), 0)],
        ["Units purchased", itemRows.reduce((s, r) => s + n(r["Purchases in period"]), 0)],
        ["Units sold", itemRows.reduce((s, r) => s + n(r["Sales in period"]), 0)],
      ], extra: "Estimated stock = opening stock + recorded purchase quantities − recorded sales quantities. This excludes manual stock adjustments, returns and transfers." },
      expenses: { rows: expenseRows, metrics: [
        ["Total expenses", expenseTotal], ["Expense entries", expenseRows.length],
        ["Average expense", expenseRows.length ? expenseTotal / expenseRows.length : 0],
      ], extra: "Expense totals use the expense_date and amount fields." },
      attendance: { rows: attendanceRows, metrics: [
        ["Attendance entries", attendanceRows.length],
        ["Present", attendanceRows.filter(r => String(r.Status).toLowerCase() === "present").length],
        ["Absent", attendanceRows.filter(r => String(r.Status).toLowerCase() === "absent").length],
        ["Overtime hours", attendanceRows.reduce((s, r) => s + n(r["Overtime hours"]), 0)],
      ], extra: "Attendance is grouped by attendance records; no assumptions are made about missing days." },
      salary: { rows: salaryRunRows, metrics: [
        ["Net pay in salary runs", salaryNet],
        ["Salary run entries", salaryRunRows.length],
        ["Paid amount in payment records", salaryPaid],
        ["Salary payment entries", salaryPaymentRows.length],
      ], extra: "The table shows salary runs. Salary payment records are available separately below." , secondary: salaryPaymentRows },
    } as Record<ReportKey, { rows: AnyRow[]; metrics: [string, number][]; extra: string; secondary?: AnyRow[] }>;
  }, [data, from, to]);

  const activeReport = rows[active];
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeReport.rows;
    return activeReport.rows.filter(row => Object.values(row).some(v =>
      String(v ?? "").toLowerCase().includes(q)));
  }, [activeReport, search]);

  const columns = visibleRows.length ? Object.keys(visibleRows[0]) :
    activeReport.rows.length ? Object.keys(activeReport.rows[0]) : [];
  const exportCsv = (exportRows: AnyRow[], suffix: string) => {
    if (!exportRows.length) return;
    const keys = Object.keys(exportRows[0]);
    const csv = [keys.map(escapeCsv).join(","), ...exportRows.map(r => keys.map(k => escapeCsv(r[k])).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `great-books-${active}-${suffix}-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content" style={{ maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <div style={{ color: "#667085", fontSize: 11, fontWeight: 800, letterSpacing: 1.2 }}>GREAT BOOKS WORKSPACE</div>
          <h1 style={{ margin: "7px 0 5px", color: "#101828", fontSize: 28 }}>Reports &amp; Exports</h1>
          <p style={{ margin: 0, color: "#667085" }}>Review business performance and export company reports.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={buttonStyle} onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
          <button type="button" style={{ ...buttonStyle, background: "#2563eb", color: "#fff", borderColor: "#2563eb" }} onClick={() => exportCsv(visibleRows, "report")} disabled={!visibleRows.length}><Download size={16} /> Export CSV</button>
        </div>
      </div>

      {companies.length > 1 && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475467", marginBottom: 6 }}>Company</label>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ ...inputStyle, minWidth: 260 }}>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ ...cardStyle, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>
        <div><label style={{ display: "block", fontSize: 12, color: "#667085", fontWeight: 700, marginBottom: 5 }}>From date</label><input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} style={inputStyle} /></div>
        <div><label style={{ display: "block", fontSize: 12, color: "#667085", fontWeight: 700, marginBottom: 5 }}>To date</label><input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: 200 }}><label style={{ display: "block", fontSize: 12, color: "#667085", fontWeight: 700, marginBottom: 5 }}>Search current report</label><div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 11, top: 12, color: "#98a2b3" }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rows..." style={{ ...inputStyle, width: "100%", paddingLeft: 34 }} /></div></div>
        <div style={{ color: "#98a2b3", fontSize: 12, paddingBottom: 10 }}>{lastLoaded ? `Updated ${lastLoaded}` : ""}</div>
      </div>

      {error && <div role="alert" style={{ ...cardStyle, borderColor: "#fecdca", color: "#b42318", marginBottom: 16 }}>Could not load reports: {error}. Check that the signed-in user has access to the selected company's records.</div>}
      {!companyId && <div style={cardStyle}>No active company is available for this user.</div>}

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 12 }}>
        {REPORTS.map(r => (
          <button key={r.key} type="button" onClick={() => { setActive(r.key); setSearch(""); }}
            style={{ ...buttonStyle, flexShrink: 0, borderColor: active === r.key ? "#344b70" : "#d0d5dd", background: active === r.key ? "#eef2f8" : "#fff", color: active === r.key ? "#172b4d" : "#475467" }}>
            {r.key === "sales" ? <TrendingUp size={15} /> : r.key === "purchases" ? <ShoppingCart size={15} /> : r.key === "inventory" ? <Package size={15} /> : r.key === "attendance" || r.key === "salary" ? <Users size={15} /> : r.key === "expenses" ? <Wallet size={15} /> : <BarChart3 size={15} />}
            {r.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 4px", color: "#101828", fontSize: 19 }}>{REPORTS.find(r => r.key === active)?.label} report</h2>
        <p style={{ margin: 0, color: "#667085", fontSize: 13 }}>{REPORTS.find(r => r.key === active)?.description}</p>
      </div>

      {loading ? <div style={{ ...cardStyle, padding: 32, textAlign: "center", color: "#667085" }}>Loading company reports…</div> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            {activeReport.metrics.map(([label, value]) => (
              <div key={label} style={cardStyle}>
                <div style={{ color: "#667085", fontSize: 12, fontWeight: 600 }}>{label}</div>
                <div style={{ color: "#101828", fontSize: 21, fontWeight: 750, marginTop: 8 }}>
                  {/(total|outstanding|overdue|collected|paid|pay|value|expense|average|amount|receivables|payables)/i.test(label) ? money(value, currency) : value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #eaecf0" }}>
              <div style={{ fontWeight: 700, color: "#344054" }}>{visibleRows.length} records</div>
              {active === "salary" && activeReport.secondary && (
                <button type="button" style={buttonStyle} onClick={() => exportCsv(activeReport.secondary || [], "salary-payments")}><FileSpreadsheet size={15} /> Export salary payments</button>
              )}
            </div>
            {visibleRows.length === 0 ? (
              <div style={{ padding: 36, textAlign: "center", color: "#667085" }}>No records found for the selected date range.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead><tr>{columns.map(col => <th key={col} style={thStyle}>{col}</th>)}</tr></thead>
                  <tbody>{visibleRows.map((row, index) => (
                    <tr key={`${active}-${index}`}>
                      {columns.map(col => <td key={col} style={tdStyle}>
                        {typeof row[col] === "number" && /(amount|total|paid|balance|outstanding|value|price|tax|pay|received|deduction|allowance|gross|net|subtotal|cgst|sgst|igst)/i.test(col)
                          ? money(row[col], currency)
                          : String(row[col] ?? "—")}
                      </td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
          {active === "salary" && activeReport.secondary && (
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <div><h3 style={{ margin: 0, color: "#101828" }}>Salary payment records</h3><p style={{ margin: "4px 0 0", color: "#667085", fontSize: 13 }}>Payment data from salary_payments.</p></div>
                <button type="button" style={buttonStyle} onClick={() => exportCsv(activeReport.secondary || [], "salary-payments")}><Download size={15} /> Export payments CSV</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead><tr>{Object.keys(activeReport.secondary[0] || {}).map(k => <th key={k} style={thStyle}>{k}</th>)}</tr></thead>
                  <tbody>{activeReport.secondary.map((r, i) => <tr key={i}>{Object.keys(activeReport.secondary![0] || {}).map(k => <td key={k} style={tdStyle}>{typeof r[k] === "number" ? money(r[k], currency) : String(r[k] ?? "—")}</td>)}</tr>)}</tbody>
                </table>
                {!activeReport.secondary.length && <div style={{ padding: 20, color: "#667085" }}>No salary payments in this period.</div>}
              </div>
            </div>
          )}
          <p style={{ color: "#98a2b3", fontSize: 11, marginTop: 12 }}>
            Reports are read-only. Amounts and balances are calculated from saved records and are not accounting adjustments.
          </p>
        </>
      )}
    </div>
  );
}
