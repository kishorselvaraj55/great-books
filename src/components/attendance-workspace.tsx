"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  RefreshCw,
  Save,
  Wallet,
  Download,
  CheckCircle2,
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

type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "holiday";

type AttendanceRow = {
  id?: string;
  company_id: string;
  employee_id: string;
  attendance_date: string;
  status: AttendanceStatus;
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

const statusOptions: {
  value: AttendanceStatus;
  label: string;
}[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half-day" },
  { value: "leave", label: "Paid leave" },
  { value: "holiday", label: "Holiday" },
];

function today() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "INR"} ${amount.toFixed(2)}`;
  }
}

function canManage(role: string) {
  return ["owner", "admin", "manager"].includes(role.toLowerCase());
}

export function AttendanceWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const company = companies.find((item) => item.id === companyId);
  const currency = company?.currency ?? "INR";
  const canWrite = canManage(company?.role ?? "");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);

  const [attendance, setAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [salaryMonth, setSalaryMonth] = useState(today().slice(0, 7));

  const [tab, setTab] = useState<"attendance" | "salary">("attendance");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState<string | null>(null);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
    setNotice(null);

    try {
      const selectedAttendanceMonth = attendanceDate.slice(0, 7);

      const firstMonth =
        salaryMonth < selectedAttendanceMonth
          ? salaryMonth
          : selectedAttendanceMonth;

      const lastMonth =
        salaryMonth > selectedAttendanceMonth
          ? salaryMonth
          : selectedAttendanceMonth;

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
              `${lastMonth}-${String(monthDays(lastMonth)).padStart(2, "0")}`
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
        (employee) =>
          (employee.employment_status ?? "active").toLowerCase() === "active"
      );

      const attendanceRows = (attendanceResult.data ??
        []) as AttendanceRow[];

      setEmployees(activeEmployees);
      setRecords(attendanceRows);
      setPayments((paymentResult.data ?? []) as SalaryPayment[]);

      const selectedDayRecords = attendanceRows.filter(
        (row) => row.attendance_date === attendanceDate
      );

      const nextAttendance: Record<string, AttendanceStatus> = {};
      const nextNotes: Record<string, string> = {};

      selectedDayRecords.forEach((row) => {
        nextAttendance[row.employee_id] = row.status;
        nextNotes[row.employee_id] = row.notes ?? "";
      });

      setAttendance(nextAttendance);
      setNotes(nextNotes);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load Attendance & Salary records.",
      });
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

      if (status) {
        result[status]++;
      } else {
        result.unmarked++;
      }
    });

    return result;
  }, [employees, attendance]);

  const payroll = useMemo(() => {
    return employees.map((employee) => {
      const base = Number(employee.base_pay ?? 0);
      const type = (employee.pay_type ?? "monthly").toLowerCase();
      const days = monthDays(salaryMonth);

      const count = {
        present: 0,
        absent: 0,
        half_day: 0,
        leave: 0,
        holiday: 0,
      };

      records
        .filter(
          (row) =>
            row.employee_id === employee.id &&
            row.attendance_date >= `${salaryMonth}-01` &&
            row.attendance_date <=
              `${salaryMonth}-${String(days).padStart(2, "0")}`
        )
        .forEach((row) => {
          count[row.status]++;
        });

      const payableDays =
        count.present +
        count.half_day * 0.5 +
        count.leave +
        count.holiday;

      const payable =
        type === "daily"
          ? (count.present + count.half_day * 0.5) * base
          : (base * payableDays) / days;

      return {
        employee,
        base,
        type,
        count,
        payable: Math.max(0, Math.round(payable * 100) / 100),
        existing: payments.find(
          (payment) => payment.employee_id === employee.id
        ),
      };
    });
  }, [employees, records, salaryMonth, payments]);

  async function saveAttendance() {
    if (!companyId || !canWrite) {
      setNotice({
        type: "error",
        text: "Select a company and make sure you have manager or administrator access.",
      });
      return;
    }

    const rows = employees
      .filter((employee) => attendance[employee.id])
      .map((employee) => ({
        company_id: companyId,
        employee_id: employee.id,
        attendance_date: attendanceDate,
        status: attendance[employee.id],
        notes: notes[employee.id]?.trim() || null,
      }));

    if (!rows.length) {
      setNotice({
        type: "error",
        text: "Select an attendance status for at least one employee.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const { error } = await supabase
        .from("attendance_records")
        .upsert(rows, {
          onConflict: "company_id,employee_id,attendance_date",
        });

      if (error) throw error;

      setNotice({
        type: "success",
        text: `Attendance saved for ${rows.length} employee(s).`,
      });

      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to save attendance.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveSalary(
    employeeId: string,
    amount: number,
    base: number
  ) {
    if (!canWrite) return;

    const existingPayment = payments.find(
      (payment) => payment.employee_id === employeeId
    );

    const paidInput = window.prompt(
      "Enter total amount paid so far:",
      String(Number(existingPayment?.paid_amount ?? 0))
    );

    if (paidInput === null) return;

    const paid = Number(paidInput);

    if (!Number.isFinite(paid) || paid < 0) {
      setNotice({
        type: "error",
        text: "Enter a valid non-negative payment amount.",
      });
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

    setSavingEmployee(employeeId);
    setNotice(null);

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
            payable_amount: amount,
            paid_amount: paid,
            payment_status:
              paid <= 0 ? "pending" : paid >= amount ? "paid" : "partial",
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

      setNotice({
        type: "success",
        text: "Salary payment saved successfully.",
      });

      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to save salary payment.",
      });
    } finally {
      setSavingEmployee(null);
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
          <p>Mark daily attendance and track monthly salary payments.</p>
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
          className={`notice ${notice.type === "error" ? "notice-error" : ""}`}
          role="status"
        >
          {notice.text}
        </div>
      )}

      {!canWrite && (
        <div className="notice">
          You have read-only access. Contact a company owner or administrator
          to update attendance and salary payments.
        </div>
      )}

      <div className="module-grid employees-stats">
        <div className="card">
          <div className="stat-top">
            <span>Active employees</span>
            <CheckCircle2 size={18} />
          </div>
          <div className="stat-value">{employees.length}</div>
        </div>

        <div className="card">
          <div className="stat-top">
            <span>Present on selected date</span>
            <CalendarCheck size={18} />
          </div>
          <div className="stat-value">{stats.present}</div>
          <div className="stat-foot">{attendanceDate}</div>
        </div>

        <div className="card">
          <div className="stat-top">
            <span>Monthly payroll</span>
            <Wallet size={18} />
          </div>
          <div className="stat-value employees-money">
            {money(totalPayable, currency)}
          </div>
          <div className="stat-foot">{salaryMonth}</div>
        </div>

        <div className="card">
          <div className="stat-top">
            <span>Salary balance</span>
          </div>
          <div className="stat-value employees-money">
            {money(Math.max(0, totalPayable - totalPaid), currency)}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className={`btn ${tab === "attendance" ? "btn-primary" : ""}`}
            type="button"
            onClick={() => setTab("attendance")}
          >
            <CalendarCheck size={15} /> Daily attendance
          </button>

          <button
            className={`btn ${tab === "salary" ? "btn-primary" : ""}`}
            type="button"
            onClick={() => setTab("salary")}
          >
            <Wallet size={15} /> Salary &amp; payments
          </button>
        </div>
      </div>

      {tab === "attendance" ? (
        <div className="card employees-directory">
          <div
            className="card-heading"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "end",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2>Daily attendance</h2>
              <p>Select a date and mark employee attendance.</p>
            </div>

            <label>
              Attendance date
              <input
                type="date"
                value={attendanceDate}
                onChange={(event) => setAttendanceDate(event.target.value)}
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
                          aria-label={`Attendance for ${employee.full_name}`}
                          onChange={(event) =>
                            setAttendance((previous) => ({
                              ...previous,
                              [employee.id]: event.target
                                .value as AttendanceStatus,
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
                          aria-label={`Notes for ${employee.full_name}`}
                          onChange={(event) =>
                            setNotes((previous) => ({
                              ...previous,
                              [employee.id]: event.target.value,
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
              alignItems: "center",
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
              className="btn btn-primary"
              type="button"
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
          <div
            className="card-heading"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "end",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2>Salary &amp; payments</h2>
              <p>
                Review wages and record salary payments for the selected month.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
              <label>
                Salary month
                <input
                  type="month"
                  value={salaryMonth}
                  onChange={(event) => setSalaryMonth(event.target.value)}
                />
              </label>

              <button className="btn" type="button" onClick={exportPayroll}>
                <Download size={15} /> Export CSV
              </button>
            </div>
          </div>

          <div className="notice">
            Preliminary calculation: monthly salary is prorated by calendar
            days. Present, paid leave and holidays count as payable days;
            half-day counts as 0.5. Daily-wage staff are paid for present and
            half-days only. Verify your payroll rules before paying wages.
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
                          {item.type === "daily"
                            ? "Daily wage"
                            : "Monthly salary"}
                          <div className="employees-subtext">
                            Base: {money(item.base, currency)}
                          </div>
                        </td>

                        <td>
                          P {item.count.present} · A {item.count.absent}
                          <div className="employees-subtext">
                            Half {item.count.half_day} · Leave {item.count.leave} ·
                            Holiday {item.count.holiday}
                          </div>
                        </td>

                        <td>{money(item.payable, currency)}</td>
                        <td>{money(paid, currency)}</td>
                        <td>{money(balance, currency)}</td>

                        <td>
                          {item.existing?.payment_status ?? "Not saved"}
                        </td>

                        <td>
                          <button
                            className="btn btn-small"
                            type="button"
                            disabled={
                              !canWrite ||
                              savingEmployee === item.employee.id
                            }
                            onClick={() =>
                              void saveSalary(
                                item.employee.id,
                                item.payable,
                                item.base
                              )
                            }
                          >
                            {savingEmployee === item.employee.id
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
            Total calculated: {money(totalPayable, currency)} · Paid:{" "}
            {money(totalPaid, currency)} · Balance:{" "}
            {money(Math.max(0, totalPayable - totalPaid), currency)}
          </div>
        </div>
      )}
    </div>
  );
}