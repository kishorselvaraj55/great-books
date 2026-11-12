
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  FileText,
  Plus,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string;
  role: string;
};

type Holiday = {
  date: string;
  name: string;
  type: "Public holiday" | "Bank holiday";
};

type RecentRecord = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  type: "sale" | "purchase";
};

const HOLIDAYS_2026: Holiday[] = [
  { date: "2026-01-01", name: "New Year's Day", type: "Public holiday" },
  { date: "2026-01-15", name: "Pongal", type: "Public holiday" },
  { date: "2026-01-16", name: "Thiruvalluvar Day", type: "Public holiday" },
  { date: "2026-01-17", name: "Uzhavar Thirunal", type: "Public holiday" },
  { date: "2026-01-26", name: "Republic Day", type: "Public holiday" },
  { date: "2026-02-01", name: "Thai Poosam", type: "Public holiday" },
  { date: "2026-03-19", name: "Telugu New Year's Day", type: "Public holiday" },
  { date: "2026-03-21", name: "Ramzan (Idul Fitr)", type: "Public holiday" },
  { date: "2026-03-31", name: "Mahaveer Jayanthi", type: "Public holiday" },
  { date: "2026-04-01", name: "Annual bank account closing", type: "Bank holiday" },
  { date: "2026-04-03", name: "Good Friday", type: "Public holiday" },
  { date: "2026-04-14", name: "Tamil New Year / Ambedkar Birthday", type: "Public holiday" },
  { date: "2026-05-01", name: "May Day", type: "Public holiday" },
  { date: "2026-05-28", name: "Bakrid (Idul Azha)", type: "Public holiday" },
  { date: "2026-06-26", name: "Muharram", type: "Public holiday" },
  { date: "2026-08-15", name: "Independence Day", type: "Public holiday" },
  { date: "2026-08-26", name: "Milad-un-Nabi", type: "Public holiday" },
  { date: "2026-09-04", name: "Krishna Jayanthi", type: "Public holiday" },
  { date: "2026-09-14", name: "Vinayakar Chathurthi", type: "Public holiday" },
  { date: "2026-10-02", name: "Gandhi Jayanthi", type: "Public holiday" },
  { date: "2026-10-19", name: "Ayutha Pooja", type: "Public holiday" },
  { date: "2026-10-20", name: "Vijaya Dasami", type: "Public holiday" },
  { date: "2026-11-08", name: "Deepavali", type: "Public holiday" },
  { date: "2026-12-25", name: "Christmas", type: "Public holiday" },
];

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${currency || "INR"} ${(value || 0).toFixed(2)}`;
  }
};

const number = (value: unknown) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatDate = (value: string) => {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

const formatClockDate = (date: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

function getHoliday(date: Date) {
  return HOLIDAYS_2026.find((holiday) => holiday.date === dateKey(date));
}

function isBankWeekend(date: Date) {
  const day = date.getDay();
  const dayOfMonth = date.getDate();

  return (
    day === 0 ||
    (day === 6 && dayOfMonth >= 8 && dayOfMonth <= 14) ||
    (day === 6 && dayOfMonth >= 22 && dayOfMonth <= 28)
  );
}

export function Dashboard({ companies }: { companies: Company[] }) {
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [clock, setClock] = useState(() => new Date(0));
  const [userName, setUserName] = useState("there");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(0));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    sales: 0,
    purchases: 0,
    receivables: 0,
    payables: 0,
    expenses: 0,
    stockValue: 0,
    itemCount: 0,
    invoiceCount: 0,
  });

  const [recent, setRecent] = useState<RecentRecord[]>([]);

  const company = companies.find((item) => item.id === companyId);
  const currency = company?.currency || "INR";

  // Live clock: updates every second.
  useEffect(() => {
    // Start with a deterministic server/client value, then set the real
    // browser time after hydration to prevent a live-clock hydration mismatch.
    const now = new Date();
    setClock(now);
    setCalendarMonth(now);

    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Load the signed-in user's first name.
  useEffect(() => {
    async function loadUserName() {
      const { data, error } = await supabase.auth.getUser();

      if (error) return;

      const user = data.user;

      const name =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.user_metadata?.display_name ||
        "there";

      const firstName = String(name).trim().split(/\s+/)[0];

      setUserName(
        firstName.charAt(0).toUpperCase() + firstName.slice(1)
      );
    }

    void loadUserName();
  }, [supabase]);

  // Greeting based on Indian Standard Time.
  const istHour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(clock)
  );

  const greeting =
    istHour < 12
      ? "Good morning"
      : istHour < 16
        ? "Good afternoon"
        : "Good evening";

  const greetingIcon =
    istHour < 12 ? "☀️" : istHour < 16 ? "👋" : "🌙";

  // Load company dashboard information.
  const loadDashboard = useCallback(async () => {
    if (!companyId) {
      setStats({
        sales: 0,
        purchases: 0,
        receivables: 0,
        payables: 0,
        expenses: 0,
        stockValue: 0,
        itemCount: 0,
        invoiceCount: 0,
      });
      setRecent([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [
        invoiceResult,
        billResult,
        expenseResult,
        itemResult,
      ] = await Promise.all([
        supabase
          .from("sales_invoices")
          .select("id, invoice_number, invoice_date, grand_total, amount_paid, status")
          .eq("company_id", companyId)
          .order("invoice_date", { ascending: false }),

        supabase
          .from("purchase_bills")
          .select("id, bill_number, bill_date, total, grand_total, amount_paid, status")
          .eq("company_id", companyId)
          .order("bill_date", { ascending: false }),

        supabase
          .from("expenses")
          .select("id, amount, expense_date")
          .eq("company_id", companyId),

        supabase
          .from("items")
          .select("id, name, opening_stock, purchase_price, is_active")
          .eq("company_id", companyId),
      ]);

      const failed = [
        invoiceResult.error,
        billResult.error,
        expenseResult.error,
        itemResult.error,
      ].find(Boolean);

      if (failed) throw new Error(failed.message);

      const invoices = invoiceResult.data ?? [];
      const bills = billResult.data ?? [];
      const expenses = expenseResult.data ?? [];
      const items = itemResult.data ?? [];

      const year = new Date().getFullYear();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const yearInvoices = invoices.filter(
        (row) => row.invoice_date >= yearStart && row.invoice_date <= yearEnd
      );

      const yearBills = bills.filter(
        (row) => row.bill_date >= yearStart && row.bill_date <= yearEnd
      );

      const yearExpenses = expenses.filter(
        (row) => row.expense_date >= yearStart && row.expense_date <= yearEnd
      );

      const salesTotal = yearInvoices.reduce(
        (sum, row) => sum + number(row.grand_total),
        0
      );

      const purchasesTotal = yearBills.reduce(
        (sum, row) => sum + number(row.total ?? row.grand_total),
        0
      );

      const receivables = invoices.reduce(
        (sum, row) =>
          sum + Math.max(0, number(row.grand_total) - number(row.amount_paid)),
        0
      );

      const payables = bills.reduce(
        (sum, row) =>
          sum + Math.max(
            0,
            number(row.total ?? row.grand_total) - number(row.amount_paid)
          ),
        0
      );

      const expenseTotal = yearExpenses.reduce(
        (sum, row) => sum + number(row.amount),
        0
      );

      const activeItems = items.filter((item) => item.is_active !== false);

      const stockValue = activeItems.reduce(
        (sum, item) =>
          sum + number(item.opening_stock) * number(item.purchase_price),
        0
      );

      setStats({
        sales: salesTotal,
        purchases: purchasesTotal,
        receivables,
        payables,
        expenses: expenseTotal,
        stockValue,
        itemCount: activeItems.length,
        invoiceCount: yearInvoices.length,
      });

      const latestSales: RecentRecord[] = invoices.slice(0, 5).map((row) => ({
        id: row.id,
        title: row.invoice_number || "Sales invoice",
        subtitle: `Sales · ${formatDate(row.invoice_date)}`,
        amount: number(row.grand_total),
        date: row.invoice_date,
        type: "sale",
      }));

      const latestPurchases: RecentRecord[] = bills.slice(0, 5).map((row) => ({
        id: row.id,
        title: row.bill_number || "Purchase bill",
        subtitle: `Purchase · ${formatDate(row.bill_date)}`,
        amount: number(row.total ?? row.grand_total),
        date: row.bill_date,
        type: "purchase",
      }));

      setRecent(
        [...latestSales, ...latestPurchases]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 8)
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load dashboard information."
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, supabase]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Calendar calculations.
  const monthLabel = calendarMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const first = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1
    );

    const startOffset = first.getDay();

    const daysInMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    ).getDate();

    return [
      ...Array.from({ length: startOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [calendarMonth]);

  const selectedMonthHolidays = HOLIDAYS_2026.filter((holiday) => {
    const date = new Date(`${holiday.date}T00:00:00`);

    return (
      date.getFullYear() === calendarMonth.getFullYear() &&
      date.getMonth() === calendarMonth.getMonth()
    );
  });

  const upcomingHolidays = HOLIDAYS_2026.filter(
    (holiday) => holiday.date >= dateKey(clock)
  ).slice(0, 4);

  const cards = [
    {
      label: "Total sales",
      value: money(stats.sales, currency),
      note: "Current calendar year",
      icon: TrendingUp,
    },
    {
      label: "Total purchases",
      value: money(stats.purchases, currency),
      note: "Current calendar year",
      icon: ShoppingBag,
    },
    {
      label: "Receivables due",
      value: money(stats.receivables, currency),
      note: "Outstanding customer balances",
      icon: ArrowDownRight,
    },
    {
      label: "Payables due",
      value: money(stats.payables, currency),
      note: "Outstanding supplier balances",
      icon: ArrowUpRight,
    },
  ];

  return (
    <div className="content">
      {/* Dashboard heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">BUSINESS OVERVIEW</div>

          <h1>
            {greeting}, {userName}! {greetingIcon}
          </h1>

          <p>Here’s what’s happening with your business today.</p>
        </div>

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <Link href="/modules/sales" className="btn">
            <Plus size={15} /> New invoice
          </Link>

          <Link href="/modules/purchase" className="btn btn-primary">
            <Plus size={15} /> Record purchase
          </Link>
        </div>
      </div>

      {/* Live IST clock */}
      <section
        className="card"
        style={{
          marginBottom: 20,
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          background: "linear-gradient(115deg, #eff6ff, #ffffff)",
          border: "1px solid #dbeafe",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "#dbeafe",
              color: "#2563eb",
            }}
          >
            <Clock3 size={23} />
          </div>

          <div>
            <div
              style={{
                color: "#475467",
                fontSize: 12,
                fontWeight: 650,
                marginBottom: 4,
              }}
            >
              CURRENT DATE & TIME · INDIA (IST)
            </div>

            <div
              style={{
                color: "#172033",
                fontSize: 14,
                fontWeight: 650,
              }}
            >
              {formatClockDate(clock)}
            </div>
          </div>
        </div>

        <div
          style={{
            color: "#1d4ed8",
            fontSize: 25,
            fontWeight: 750,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.5px",
          }}
        >
          {formatTime(clock)}
        </div>
      </section>

      {/* Company setup notice */}
      {companies.length === 0 && (
        <div className="notice">
          <strong>Set up your company to get started.</strong> Your account is
          signed in, but it is not yet linked to a company. First run{" "}
          <code>supabase/schema.sql</code> in the Supabase SQL Editor, then
          create your workspace.

          <div style={{ marginTop: 12 }}>
            <Link className="btn btn-primary" href="/companies/new">
              Create your first company
            </Link>
          </div>
        </div>
      )}

      {/* Company selector */}
      {companies.length > 1 && (
        <div className="card" style={{ marginBottom: 16, padding: 14 }}>
          <label
            style={{
              display: "block",
              color: "#475467",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Selected company
          </label>

          <select
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            style={{
              width: "100%",
              maxWidth: 380,
              minHeight: 40,
              border: "1px solid #d0d5dd",
              borderRadius: 8,
              padding: "8px 10px",
              background: "#fff",
            }}
          >
            {companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div
          className="notice"
          role="alert"
          style={{ color: "#b42318", marginBottom: 16 }}
        >
          Dashboard data could not be fully loaded: {error}
        </div>
      )}

      {/* Main business figures */}
      <div className="stats">
        {cards.map((item) => {
          const Icon = item.icon;

          return (
            <div className="card" key={item.label}>
              <div className="stat-top">
                <span>{item.label}</span>
                <span className="stat-icon">
                  <Icon size={17} />
                </span>
              </div>

              <div className="stat-value">
                {loading ? "Loading..." : item.value}
              </div>

              <div className="stat-foot">{item.note}</div>
            </div>
          );
        })}
      </div>

      {/* Secondary business figures */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
          marginTop: 14,
        }}
      >
        {[
          {
            label: "Total expenses",
            value: money(stats.expenses, currency),
            icon: Wallet,
          },
          {
            label: "Inventory stock value",
            value: money(stats.stockValue, currency),
            icon: ShoppingBag,
          },
          {
            label: "Active inventory items",
            value: stats.itemCount.toLocaleString("en-IN"),
            icon: FileText,
          },
          {
            label: "Sales invoices this year",
            value: stats.invoiceCount.toLocaleString("en-IN"),
            icon: TrendingUp,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div className="card" key={item.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  color: "#667085",
                  fontSize: 12,
                  fontWeight: 650,
                }}
              >
                {item.label}
                <Icon size={17} color="#2563eb" />
              </div>

              <div
                style={{
                  marginTop: 9,
                  color: "#172033",
                  fontSize: 20,
                  fontWeight: 750,
                }}
              >
                {loading ? "Loading..." : item.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Holiday calendar */}
      <section
        className="card"
        style={{
          marginTop: 20,
          padding: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: "#eff6ff",
              color: "#2563eb",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CalendarDays size={21} />
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Holiday calendar</h2>
            <p style={{ margin: "4px 0 0", color: "#667085", fontSize: 12 }}>
              India-wide observances and Tamil Nadu public and bank holidays
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setCalendarMonth(new Date());
            setCalendarOpen(true);
          }}
        >
          <CalendarDays size={16} /> View Calendar
        </button>
      </section>

      {/* Upcoming holidays */}
      {upcomingHolidays.length > 0 && (
        <section className="card" style={{ marginTop: 14, padding: 18 }}>
          <div className="card-heading">
            <div>
              <h2>Upcoming holidays</h2>
              <p>Notified Tamil Nadu holidays for 2026</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {upcomingHolidays.map((holiday) => (
              <div
                key={holiday.date}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 650, color: "#344054" }}>
                    {holiday.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#667085" }}>
                    {formatDate(holiday.date)}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    padding: "5px 9px",
                    borderRadius: 20,
                    background:
                      holiday.type === "Bank holiday" ? "#fff7ed" : "#eff6ff",
                    color:
                      holiday.type === "Bank holiday" ? "#c2410c" : "#1d4ed8",
                    fontWeight: 650,
                  }}
                >
                  {holiday.type}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent activity and priorities */}
      <div className="dashboard-grid" style={{ marginTop: 20 }}>
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest sales invoices and purchase bills</p>
            </div>

            <Link href="/modules/reports" className="small-link">
              View reports
            </Link>
          </div>

          {loading ? (
            <p style={{ color: "#667085", fontSize: 13 }}>
              Loading recent activity...
            </p>
          ) : recent.length === 0 ? (
            <div
              style={{
                padding: 22,
                textAlign: "center",
                color: "#667085",
                fontSize: 13,
              }}
            >
              No sales or purchase activity found yet.
            </div>
          ) : (
            <div className="list">
              {recent.map((item) => (
                <div className="list-row" key={`${item.type}-${item.id}`}>
                  <div className="list-main">
                    <div className="list-avatar">
                      {item.type === "sale" ? (
                        <TrendingUp size={16} />
                      ) : (
                        <ShoppingBag size={16} />
                      )}
                    </div>

                    <div>
                      <div className="list-title">{item.title}</div>
                      <div className="list-sub">{item.subtitle}</div>
                    </div>
                  </div>

                  <strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                    {money(item.amount, currency)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Today’s priorities</h2>
              <p>Items that may need your attention</p>
            </div>
            <CalendarDays size={18} color="#64748b" />
          </div>

          <div className="list">
            <div className="list-row">
              <div className="list-main">
                <div className="list-avatar">
                  <Clock3 size={16} />
                </div>
                <div>
                  <div className="list-title">Receivables due</div>
                  <div className="list-sub">
                    {money(stats.receivables, currency)} outstanding
                  </div>
                </div>
              </div>

              <Link href="/modules/debtors" className="small-link">
                Review
              </Link>
            </div>

            <div className="list-row">
              <div className="list-main">
                <div className="list-avatar">
                  <FileText size={16} />
                </div>
                <div>
                  <div className="list-title">Payables due</div>
                  <div className="list-sub">
                    {money(stats.payables, currency)} outstanding
                  </div>
                </div>
              </div>

              <Link href="/modules/creditors" className="small-link">
                Review
              </Link>
            </div>

            <div className="list-row">
              <div className="list-main">
                <div className="list-avatar">
                  <Users size={16} />
                </div>
                <div>
                  <div className="list-title">Employee attendance</div>
                  <div className="list-sub">Daily attendance register</div>
                </div>
              </div>

              <Link href="/modules/attendance" className="small-link">
                Open
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Quick access */}
      <section style={{ marginTop: 20 }}>
        <div className="card-heading">
          <div>
            <h2>Quick access</h2>
            <p>Jump into the tools you use most</p>
          </div>

          <Link href="/modules/reports" className="small-link">
            View reports
          </Link>
        </div>

        <div className="module-grid">
          {[
            {
              name: "Create an invoice",
              desc: "Prepare a customer invoice and track its payment.",
              href: "/modules/sales",
              icon: FileText,
            },
            {
              name: "Manage items",
              desc: "Maintain your product and service master.",
              href: "/modules/items",
              icon: ShoppingBag,
            },
            {
              name: "Manage customers",
              desc: "Review your customer and billing records.",
              href: "/modules/customers",
              icon: Users,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Link
                href={item.href}
                className="module-card"
                key={item.name}
              >
                <div className="module-icon">
                  <Icon size={20} />
                </div>
                <h3>{item.name}</h3>
                <p>{item.desc}</p>
                <span className="small-link">Open module →</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Interactive calendar modal */}
      {calendarOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCalendarOpen(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(16,24,40,.58)",
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="holiday-calendar-title"
            className="card"
            style={{
              width: "min(900px, 100%)",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: 20,
              boxShadow: "0 24px 70px rgba(16,24,40,.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <div>
                <div className="eyebrow">GREAT BOOKS CALENDAR</div>
                <h2
                  id="holiday-calendar-title"
                  style={{ margin: 0, fontSize: 22 }}
                >
                  Holiday Calendar
                </h2>
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#667085",
                    fontSize: 12,
                  }}
                >
                  Tamil Nadu · India · 2026 notified holidays
                </p>
              </div>

              <button
                type="button"
                className="btn"
                onClick={() => setCalendarOpen(false)}
                aria-label="Close calendar"
              >
                <X size={18} /> Close
              </button>
            </div>

            {/* Month navigation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <button
                type="button"
                className="btn"
                aria-label="Previous month"
                onClick={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() - 1,
                      1
                    )
                  )
                }
              >
                <ChevronLeft size={17} />
              </button>

              <strong style={{ fontSize: 17 }}>{monthLabel}</strong>

              <button
                type="button"
                className="btn"
                aria-label="Next month"
                onClick={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() + 1,
                      1
                    )
                  )
                }
              >
                <ChevronRight size={17} />
              </button>
            </div>

            {/* Calendar grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 5,
              }}
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  style={{
                    textAlign: "center",
                    padding: 8,
                    fontSize: 11,
                    fontWeight: 750,
                    color: "#667085",
                  }}
                >
                  {day}
                </div>
              ))}

              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} />;

                const date = new Date(
                  calendarMonth.getFullYear(),
                  calendarMonth.getMonth(),
                  day
                );

                const holiday = getHoliday(date);
                const weekend = isBankWeekend(date);
                const isToday = dateKey(date) === dateKey(clock);
                const isSunday = date.getDay() === 0;

                return (
                  <div
                    key={dateKey(date)}
                    title={
                      holiday?.name ||
                      (weekend ? "Bank weekend closure" : "")
                    }
                    style={{
                      minHeight: 66,
                      padding: "7px 3px",
                      borderRadius: 9,
                      border: isToday
                        ? "2px solid #2563eb"
                        : "1px solid #eaecf0",
                      background: holiday
                        ? holiday.type === "Bank holiday"
                          ? "#fff7ed"
                          : "#eff6ff"
                        : weekend
                          ? "#f8fafc"
                          : "#fff",
                      textAlign: "center",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: isToday ? 800 : 600,
                        color: isSunday ? "#b42318" : "#344054",
                      }}
                    >
                      {day}
                    </div>

                    {holiday && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 9,
                          lineHeight: 1.2,
                          fontWeight: 700,
                          color:
                            holiday.type === "Bank holiday"
                              ? "#c2410c"
                              : "#1d4ed8",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {holiday.name}
                      </div>
                    )}

                    {!holiday && weekend && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 9,
                          color: "#98a2b3",
                        }}
                      >
                        {isSunday ? "Sunday" : "Bank closed"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calendar legend */}
            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
                marginTop: 16,
                fontSize: 11,
                color: "#667085",
              }}
            >
              <span>
                <span style={{ color: "#2563eb" }}>●</span> Public holiday
              </span>
              <span>
                <span style={{ color: "#c2410c" }}>●</span> Bank holiday
              </span>
              <span>
                <span style={{ color: "#98a2b3" }}>●</span> Bank weekend closure
              </span>
              <span>
                <span style={{ color: "#2563eb" }}>◎</span> Today
              </span>
            </div>

            {/* Holiday list */}
            <div style={{ marginTop: 22 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>
                Holidays this month
              </h3>

              {selectedMonthHolidays.length === 0 ? (
                <p style={{ color: "#667085", fontSize: 13 }}>
                  No notified Tamil Nadu public or bank holidays listed for
                  this month.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 9 }}>
                  {selectedMonthHolidays.map((holiday) => (
                    <div
                      key={holiday.date}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                        padding: "10px 12px",
                        border: "1px solid #eaecf0",
                        borderRadius: 9,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 650, fontSize: 13 }}>
                          {holiday.name}
                        </div>
                        <div style={{ color: "#667085", fontSize: 11 }}>
                          {formatDate(holiday.date)}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color:
                            holiday.type === "Bank holiday"
                              ? "#c2410c"
                              : "#1d4ed8",
                        }}
                      >
                        {holiday.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p
              style={{
                marginTop: 18,
                fontSize: 11,
                lineHeight: 1.6,
                color: "#98a2b3",
              }}
            >
              Holiday data shown here is the notified 2026 Tamil Nadu list.
              Bank weekend markers show Sundays and second/fourth Saturdays.
              Local bank branches may publish additional notices or changes.
              Verify dates with your bank before planning time-sensitive
              payments. Future-year holiday lists need to be updated when
              officially announced.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
