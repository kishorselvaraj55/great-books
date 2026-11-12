"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  RefreshCw,
  Save,
  Wallet,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string;
  role: string;
};

type Employee = {
  id: string;
  company_id: string;
  employee_code: string | null;
  full_name: string;
  department: string | null;
  employment_status: string | null;
  pay_type: string | null;
  base_pay: number | string | null;
};

type Status =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "holiday";

type AttendanceRecord = {
  id?: string;
  company_id: string;
  employee_id: string;
  attendance_date: string;
  status: Status;
  notes: string | null;
};

type SalaryPayment = {
  id: string;
  employee_id: string;
  salary_month: string;
  base_amount: number | string;
  payable_amount: number | string;
  paid_amount: number | string;
  payment_status: string;
  payment_date: string | null;
  payment_method: string | null;
};

const statusOptions: { value: Status; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half-day" },
  { value: "leave", label: "Paid leave" },
  { value: "holiday", label: "Holiday" },
];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function canManage(role: string) {
  return ["owner", "admin", "manager"].includes(role.toLowerCase());
}

export default function AttendanceWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const company = companies.find((c) => c.id === companyId);
  const currency = company?.currency || "INR";
  const canWrite = canManage(company?.role || "");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);

  const [attendance, setAttendance] = useState<
    Record<string, Status>
  >({});

  const [notes, setNotes] = useState<Record<string, string>>({});

  const [attendanceDate, setAttendanceDate] = useState(today());
  const [salaryMonth, setSalaryMonth] = useState(today().slice(0, 7));

  const [tab, setTab] = useState<"attendance" | "salary">("attendance");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  const load = useCallback(async () => {
    if (!companyId) {
      setEmployees([]);
      setRecords([]);
      setPayments([]);
      setAttendance({});
      setNotes({});
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const attendanceMonth = attendanceDate.slice(0, 7);
      const firstMonth =
        salaryMonth < attendanceMonth ? salaryMonth : attendanceMonth;
      const lastMonth =
        salaryMonth > attendanceMonth ? salaryMonth : attendanceMonth;

      const [employeeResult, attendanceResult, paymentResult] =
        await Promise.all([
          supabase
            .from("employees")
            .select(
              "id, company_id, employee_code, full_name, department, employment_status, pay_type, base_pay"
            )
            .eq("company_id", companyId)
            .order("full_name"),

          supabase
            .from("attendance_records")
            .select(
              "id, company_id, employee_id, attendance_date, status, notes"
            )
            .eq("company_id", companyId)
            .gte("attendance_date", `${firstMonth}-01`)
            .lte(
              "attendance_date",
              `${lastMonth}-${String(daysInMonth(lastMonth)).padStart(
                2,
                "0"
              )}`
            ),

          supabase
            .from("salary_payments")
            .select(
              "id, employee_id, salary_month, base_amount, payable_amount, paid_amount, payment_status, payment_date, payment_method"
            )
            .eq("company_id", companyId)
            .eq("salary_month", salaryMonth),
        ]);

      if (employeeResult.error) throw employeeResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (paymentResult.error) throw paymentResult.error;

      const activeEmployees = (
        (employeeResult.data ?? []) as Employee[]
      ).filter(
        (e) =>
          (e.employment_status ?? "active").toLowerCase() === "active"
      );

      const attendanceRows = (attendanceResult.data ??
        []) as AttendanceRecord[];

      setEmployees(activeEmployees);
      setRecords(attendanceRows);
      setPayments((paymentResult.data ?? []) as SalaryPayment[]);

      const dayRecords = attendanceRows.filter(
        (r) => r.attendance_date === attendanceDate
      );

      const nextAttendance: Record<string, Status> = {};
      const nextNotes: Record<string, string> = {};

      dayRecords.forEach((r) => {
        nextAttendance[r.employee_id] = r.status;
        nextNotes[r.employee_id] = r.notes ?? "";
      });

      setAttendance(nextAttendance);
      setNotes(nextNotes);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load records."
      );
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }, [companyId, attendanceDate, salaryMonth, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const result = {
      present: 0,
      absent: 0,
      half_day: 0,
      leave: 0,
      holiday: 0,
      unmarked: 0,
    };

    employees.forEach((employee) => {
      const status = attendance[employee.id];
      if (status) result[status]++;
      else result.unmarked++;
    });

    return result;
  }, [employees, attendance]);

  const payroll = useMemo(() => {
    return employees.map((employee) => {
      const base = Number(employee.base_pay ?? 0);
      const type = (employee.pay_type ?? "monthly").toLowerCase();
      const monthDays = daysInMonth(salaryMonth);

      const count = {
        present: 0,
        absent: 0,
        half_day: 0,
        leave: 0,
        holiday: 0,
      };

      records
        .filter(
          (r) =>
            r.employee_id === employee.id &&
            r.attendance_date >= `${salaryMonth}-01` &&
            r.attendance_date <=
              `${salaryMonth}-${String(monthDays).padStart(2, "0")}`
        )
        .forEach((r) => count[r.status]++);

      const payableDays =
        count.present +
        count.half_day * 0.5 +
        count.leave +
        count.holiday;

      const payable =
        type === "daily"
          ? (count.present + count.half_day * 0.5) * base
          : (base * payableDays) / monthDays;

      const existing = payments.find(
        (p) => p.employee_id === employee.id
      );

      return {
        employee,
        base,
        type,
        count,
        payable: Math.max(0, Math.round(payable * 100) / 100),
        existing,
      };
    });
  }, [employees, records, payments, salaryMonth]);

  async function saveAttendance() {
    if (!companyId || !canWrite) {
      setMessage("You do not have permission to save attendance.");
      setMessageType("error");
      return;
    }

    const rows = employees
      .filter((e) => attendance[e.id])
      .map((e) => ({
        company_id: companyId,
        employee_id: e.id,
        attendance_date: attendanceDate,
        status: attendance[e.id],
        notes: notes[e.id]?.trim() || null,
      }));

    if (!rows.length) {
      setMessage("Mark attendance for at least one employee.");
      setMessageType("error");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("attendance_records")
        .upsert(rows, {
          onConflict: "company_id,employee_id,attendance_date",
        });

      if (error) throw error;

      setMessage("Attendance saved successfully.");
      setMessageType("success");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save attendance."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function saveSalary(
    employeeId: string,
    base: number,
    payable: number
  ) {
    if (!canWrite) return;

    const existing = payments.find(
      (p) => p.employee_id === employeeId
    );

    const paidInput = window.prompt(
      "Enter total amount paid so far:",
      String(Number(existing?.paid_amount ?? 0))
    );

    if (paidInput === null) return;

    const paid = Number(paidInput);

    if (!Number.isFinite(paid) || paid < 0) {
      setMessage("Enter a valid non-negative payment amount.");
      setMessageType("error");
      return;
    }

    let paymentDate: string | null = null;
    let paymentMethod: string | null = null;

    if (paid > 0) {
      paymentDate = window.prompt("Payment date (YYYY-MM-DD):", today());
      if (!paymentDate) return;

      paymentMethod = window.prompt(
        "Payment method (Cash, Bank, UPI):",
        "Bank"
      );

      if (!paymentMethod) return;
    }

    setSavingId(employeeId);

    try {
      const { data: auth } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("salary_payments")
        .upsert(
          {
            company_id: companyId,
            employee_id: employeeId,
            salary_month: salaryMonth,
            base_amount: base,
            payable_amount: payable,
            paid_amount: paid,
            payment_status:
              paid <= 0 ? "pending" : paid >= payable ? "paid" : "partial",
            payment_date: paymentDate,
            payment_method: paymentMethod,
            notes: null,
            updated_by: auth.user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "company_id,employee_id,salary_month",
          }
        );

      if (error) throw error;

      setMessage("Salary payment saved successfully.");
      setMessageType("success");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save salary."
      );
      setMessageType("error");
    } finally {
      setSavingId(null);
    }
  }

  function exportPayroll() {
    const headers = [
      "Employee Code",
      "Employee Name",
      "Pay Type",
      "Base Pay",
      "Present",
      "Absent",
      "Half-day",
      "Leave",
      "Holiday",
      "Calculated Pay",
      "Paid",
      "Balance",
      "Status",
    ];

    const escape = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = payroll.map((item) => {
      const paid = Number(item.existing?.paid_amount ?? 0);

      return [
        item.employee.employee_code,
        item.employee.full_name,
        item.type,
        item.base,
        item.count.present,
        item.count.absent,
        item.count.half_day,
        item.count.leave,
        item.count.holiday,
        item.payable,
        paid,
        Math.max(0, item.payable - paid),
        item.existing?.payment_status ?? "not saved",
      ]
        .map(escape)
        .join(",");
    });

    const csv = [
      headers.map(escape).join(","),
      ...lines,
    ].join("\r\n");

    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
      })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `great-books-payroll-${salaryMonth}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  const totalPayable = payroll.reduce(
    (sum, item) => sum + item.payable,
    0
  );

  const totalPaid = payroll.reduce(
    (sum, item) => sum + Number(item.existing?.paid_amount ?? 0),
    0
  );

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">PEOPLE MANAGEMENT</div>
          <h1>Attendance &amp; Salary</h1>
          <p>Mark attendance and manage monthly salary payments.</p>
        </div>

        <button
          className="btn"
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {companies.length > 1 && (
        <div className="employees-company-select">
          <label htmlFor="attendance-company">Company</label>
          <select
            id="attendance-company"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {message && (
        <div
          className={`notice ${messageType === "error" ? "notice-error" : ""}`}
          role="status"
        >
          {message}
        </div>
      )}

      {!canWrite && (
        <div className="notice">
          You have read-only access. Contact your administrator for permission.
        </div>
      )}

      <div className="module-grid employees-stats">
        <div className="card">
          <div className="stat-top">Active employees</div>
          <div className="stat-value">{employees.length}</div>
        </div>

        <div className="card">
          <div className="stat-top">Present today</div>
          <div className="stat-value">{stats.present}</div>
        </div>

        <div className="card">
          <div className="stat-top">Monthly payroll</div>
          <div className="stat-value employees-money">
            {formatMoney(totalPayable, currency)}
          </div>
        </div>

        <div className="card">
          <div className="stat-top">Salary balance</div>
          <div className="stat-value employees-money">
            {formatMoney(Math.max(0, totalPayable - totalPaid), currency)}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn ${tab === "attendance" ? "btn-primary" : ""}`}
            onClick={() => setTab("attendance")}
          >
            <CalendarCheck size={15} /> Daily attendance
          </button>

          <button
            type="button"
            className={`btn ${tab === "salary" ? "btn-primary" : ""}`}
            onClick={() => setTab("salary")}
          >
            <Wallet size={15} /> Salary &amp; payments
          </button>
        </div>
      </div>

      {tab === "attendance" ? (
        <div className="card employees-directory">
          <div className="card-heading">
            <div>
              <h2>Daily attendance</h2>
              <p>Choose a date and mark employee attendance.</p>
            </div>

            <label>
              Attendance date
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
            </label>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4}>Loading...</td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No active employees found.</td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={employee.id}>
                      <td>
                        <strong>{employee.full_name}</strong>
                        <div className="employees-subtext">
                          {employee.employee_code || "No code"}
                        </div>
                      </td>

                      <td>{employee.department || "—"}</td>

                      <td>
                        <select
                          value={attendance[employee.id] ?? ""}
                          disabled={!canWrite}
                          onChange={(e) =>
                            setAttendance((old) => ({
                              ...old,
                              [employee.id]: e.target.value as Status,
                            }))
                          }
                        >
                          <option value="">Not marked</option>
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          value={notes[employee.id] ?? ""}
                          disabled={!canWrite}
                          placeholder="Optional note"
                          onChange={(e) =>
                            setNotes((old) => ({
                              ...old,
                              [employee.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: 16,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span className="employees-subtext">
              Present {stats.present} · Absent {stats.absent} · Half-day{" "}
              {stats.half_day} · Leave {stats.leave} · Holiday {stats.holiday} ·
              Unmarked {stats.unmarked}
            </span>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveAttendance()}
              disabled={!canWrite || saving || loading}
            >
              <Save size={15} />
              {saving ? "Saving..." : "Save attendance"}
            </button>
          </div>
        </div>
      ) : (
        <div className="card employees-directory">
          <div className="card-heading">
            <div>
              <h2>Salary &amp; payments</h2>
              <p>Review calculated salary and record payments.</p>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
              <label>
                Salary month
                <input
                  type="month"
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                />
              </label>

              <button type="button" className="btn" onClick={exportPayroll}>
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          <div className="notice">
            Preliminary calculation: monthly salary is prorated by calendar
            days. Present, paid leave and holidays count as payable days;
            half-day counts as 0.5. Daily-wage employees are paid for present
            and half-days only. Verify your payroll policy before payment.
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Pay basis</th>
                  <th>Attendance</th>
                  <th>Calculated pay</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8}>Loading...</td>
                  </tr>
                ) : payroll.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No active employees found.</td>
                  </tr>
                ) : (
                  payroll.map((item) => {
                    const paid = Number(item.existing?.paid_amount ?? 0);
                    const balance = Math.max(0, item.payable - paid);

                    return (
                      <tr key={item.employee.id}>
                        <td>
                          <strong>{item.employee.full_name}</strong>
                          <div className="employees-subtext">
                            {item.employee.employee_code || "No code"}
                          </div>
                        </td>

                        <td>
                          {item.type === "daily" ? "Daily wage" : "Monthly salary"}
                          <div className="employees-subtext">
                            Base: {formatMoney(item.base, currency)}
                          </div>
                        </td>

                        <td>
                          P {item.count.present} · A {item.count.absent}
                          <div className="employees-subtext">
                            Half {item.count.half_day} · Leave {item.count.leave} ·
                            Holiday {item.count.holiday}
                          </div>
                        </td>

                        <td>{formatMoney(item.payable, currency)}</td>
                        <td>{formatMoney(paid, currency)}</td>
                        <td>{formatMoney(balance, currency)}</td>
                        <td>{item.existing?.payment_status ?? "Not saved"}</td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={
                              !canWrite || savingId === item.employee.id
                            }
                            onClick={() =>
                              void saveSalary(
                                item.employee.id,
                                item.base,
                                item.payable
                              )
                            }
                          >
                            {savingId === item.employee.id
                              ? "Saving..."
                              : item.existing
                                ? "Update payment"
                                : "Record payment"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="employees-table-footer">
            Total calculated: {formatMoney(totalPayable, currency)} · Paid:{" "}
            {formatMoney(totalPaid, currency)} · Balance:{" "}
            {formatMoney(Math.max(0, totalPayable - totalPaid), currency)}
          </div>
        </div>
      )}
    </div>
  );
}