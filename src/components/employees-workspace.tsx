
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Download,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  UserRound,
  UserCheck,
  UserX,
  X,
  Phone,
  Mail,
  FileText,
  Upload,
  Trash2,
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
  phone: string | null;
  email: string | null;
  address: unknown;
  department: string | null;
  designation: string | null;
  joining_date: string | null;
  employment_status: string | null;
  pay_type: string | null;
  base_pay: number | string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type EmployeeDocument = {
  id: string;
  company_id: string;
  employee_id: string;
  document_name: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
};

type EmployeeForm = {
  employee_code: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  department: string;
  designation: string;
  joining_date: string;
  employment_status: string;
  pay_type: string;
  base_pay: string;
};

const blank: EmployeeForm = {
  employee_code: "",
  full_name: "",
  phone: "",
  email: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  department: "",
  designation: "",
  joining_date: "",
  employment_status: "active",
  pay_type: "monthly",
  base_pay: "0",
};

const canManage = (role: string) =>
  ["owner", "admin", "manager"].includes(role.toLowerCase());

function addressToText(address: unknown): string {
  if (typeof address === "string") return address;

  if (address && typeof address === "object") {
    const value = address as Record<string, unknown>;
    if (typeof value.text === "string") return value.text;

    return Object.values(value)
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }

  return "";
}

function addressField(address: unknown, key: string): string {
  if (address && typeof address === "object") {
    const value = (address as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  }

  return "";
}

function dateText(value: string | null) {
  if (!value) return "—";

  const date = new Date(
    value.length === 10 ? `${value}T00:00:00` : value
  );

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN");
}

function money(value: number | string | null, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
  } catch {
    return `${currency || "INR"} ${Number(value ?? 0).toFixed(2)}`;
  }
}

function isActive(employee: Employee) {
  return (employee.employment_status ?? "active").toLowerCase() === "active";
}

function statusLabel(status: string | null) {
  switch ((status ?? "active").toLowerCase()) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "left":
      return "Left";
    default:
      return status ?? "Active";
  }
}

function payLabel(payType: string | null) {
  switch ((payType ?? "monthly").toLowerCase()) {
    case "monthly":
      return "Salary";
    case "daily":
      return "Wages";
    default:
      return payType || "Salary";
  }
}

function formatFileSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function EmployeesWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(blank);

  const [documentEmployee, setDocumentEmployee] =
    useState<Employee | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentName, setDocumentName] = useState("");

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const company = companies.find((item) => item.id === companyId);
  const canWrite = canManage(company?.role ?? "");

  const load = useCallback(async () => {
    if (!companyId) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("employees")
      .select(
        "id, company_id, employee_code, full_name, phone, email, address, department, designation, joining_date, employment_status, pay_type, base_pay, created_by, created_at, updated_at"
      )
      .eq("company_id", companyId)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Employee loading failed:", error);

      setEmployees([]);
      setNotice({
        type: "error",
        text: `Unable to load employees: ${error.message}`,
      });
    } else {
      setEmployees((data ?? []) as Employee[]);
    }

    setLoading(false);
  }, [companyId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();

    return employees.filter((employee) => {
      const status = (employee.employment_status ?? "active").toLowerCase();
      const matchesStatus =
        showInactive || (status !== "inactive" && status !== "left");

      const searchableText = [
        employee.full_name,
        employee.employee_code,
        employee.phone,
        employee.email,
        employee.department,
        employee.designation,
      ]
        .map((value) => value ?? "")
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!q || searchableText.includes(q));
    });
  }, [employees, query, showInactive]);

  const activeCount = employees.filter(isActive).length;

  const inactiveCount = employees.filter(
    (employee) => !isActive(employee)
  ).length;

  const monthlyPayroll = employees
    .filter(
      (employee) =>
        isActive(employee) &&
        (employee.pay_type ?? "").toLowerCase() === "monthly"
    )
    .reduce(
      (total, employee) => total + Number(employee.base_pay ?? 0),
      0
    );

  function setField<K extends keyof EmployeeForm>(
    key: K,
    value: EmployeeForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function createEmployee() {
    setEditing(null);
    setForm({
      ...blank,
      employee_code: `EMP-${String(employees.length + 1).padStart(3, "0")}`,
      joining_date: new Date().toISOString().slice(0, 10),
    });
    setNotice(null);
    setModal(true);
  }

  function editEmployee(employee: Employee) {
    setEditing(employee);

    setForm({
      employee_code: employee.employee_code ?? "",
      full_name: employee.full_name ?? "",
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      address: addressToText(employee.address),
      emergency_contact_name: addressField(
        employee.address,
        "emergency_contact_name"
      ),
      emergency_contact_phone: addressField(
        employee.address,
        "emergency_contact_phone"
      ),
      department: employee.department ?? "",
      designation: employee.designation ?? "",
      joining_date: employee.joining_date ?? "",
      employment_status: (
        employee.employment_status ?? "active"
      ).toLowerCase(),
      pay_type: (employee.pay_type ?? "monthly").toLowerCase(),
      base_pay: String(employee.base_pay ?? 0),
    });

    setNotice(null);
    setModal(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyId) {
      setNotice({ type: "error", text: "Select a company first." });
      return;
    }

    if (!form.full_name.trim()) {
      setNotice({ type: "error", text: "Employee name is required." });
      return;
    }

    const basePay = Number(form.base_pay);
    if (!Number.isFinite(basePay) || basePay < 0) {
      setNotice({
        type: "error",
        text: "Enter a valid non-negative salary or wage.",
      });
      return;
    }

    const employmentStatus = form.employment_status.toLowerCase();
    const payType = form.pay_type.toLowerCase();

    if (!["active", "inactive", "left"].includes(employmentStatus)) {
      setNotice({
        type: "error",
        text: "Select Active, Inactive, or Left.",
      });
      return;
    }

    if (!["monthly", "daily"].includes(payType)) {
      setNotice({
        type: "error",
        text: "Select Monthly or Daily pay type.",
      });
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setNotice({
          type: "error",
          text: userError?.message ?? "Please sign in again.",
        });
        return;
      }

      // address is NOT NULL in the existing database.
      const addressData = {
        text: form.address.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
      };

      const payload = {
        company_id: companyId,
        employee_code: form.employee_code.trim() || null,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: addressData,
        department: form.department.trim() || null,
        designation: form.designation.trim() || null,
        joining_date: form.joining_date || null,
        employment_status: employmentStatus,
        pay_type: payType,
        base_pay: basePay,
        updated_at: new Date().toISOString(),
      };

      const columns =
        "id, company_id, employee_code, full_name, phone, email, address, department, designation, joining_date, employment_status, pay_type, base_pay, created_by, created_at, updated_at";

      const result = editing
        ? await supabase
            .from("employees")
            .update(payload)
            .eq("company_id", companyId)
            .eq("id", editing.id)
            .select(columns)
            .single()
        : await supabase
            .from("employees")
            .insert({ ...payload, created_by: user.id })
            .select(columns)
            .single();

      if (result.error) {
        const err = result.error;
        const errorMessage = [
          err.message,
          err.code ? `Code: ${err.code}` : "",
          err.details ?? "",
          err.hint ?? "",
        ]
          .filter(Boolean)
          .join(" | ");

        console.error("Employee save failed:", errorMessage);

        setNotice({
          type: "error",
          text:
            err.code === "23505"
              ? "That employee code already exists. Use a different code."
              : `Unable to save employee: ${errorMessage}`,
        });
        return;
      }

      setModal(false);
      setNotice({
        type: "success",
        text: editing
          ? "Employee updated successfully."
          : "Employee created successfully.",
      });

      await load();
    } catch (error) {
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

  async function toggleActive(employee: Employee) {
    if (!canWrite) return;

    const nextStatus = isActive(employee) ? "inactive" : "active";
    const action = nextStatus === "inactive" ? "Deactivate" : "Reactivate";

    if (!window.confirm(`${action} ${employee.full_name}?`)) return;

    const { error } = await supabase
      .from("employees")
      .update({
        employment_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("id", employee.id);

    if (error) {
      setNotice({
        type: "error",
        text: `Unable to update employee: ${error.message}`,
      });
    } else {
      setNotice({
        type: "success",
        text: `Employee ${nextStatus === "active" ? "reactivated" : "deactivated"} successfully.`,
      });
      await load();
    }
  }

  async function markLeft(employee: Employee) {
    if (!canWrite) return;

    if (!window.confirm(`Mark ${employee.full_name} as left?`)) return;

    const { error } = await supabase
      .from("employees")
      .update({
        employment_status: "left",
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId)
      .eq("id", employee.id);

    if (error) {
      setNotice({
        type: "error",
        text: `Unable to update employee: ${error.message}`,
      });
    } else {
      setNotice({
        type: "success",
        text: "Employee marked as left.",
      });
      await load();
    }
  }

  async function deleteEmployee(employee: Employee) {
    if (!canWrite || deletingEmployeeId) return;

    const confirmed = window.confirm(
      `Permanently delete ${employee.full_name} (${employee.employee_code ?? "no employee code"})?\n\nThis will permanently delete all attendance records and uploaded documents linked to this employee, then delete the employee. Salary payment history will not be deleted. This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingEmployeeId(employee.id);
    setNotice(null);

    try {
      // Preserve all salary payment history. Do not proceed if any exists.
      const [attendanceCheck, salaryCheck, docsCheck] = await Promise.all([
        supabase
          .from("attendance_records")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("employee_id", employee.id),
        supabase
          .from("salary_payments")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("employee_id", employee.id),
        supabase
          .from("employee_documents")
          .select("id, storage_path")
          .eq("company_id", companyId)
          .eq("employee_id", employee.id),
      ]);

      if (attendanceCheck.error) {
        throw new Error(`Unable to check attendance history: ${attendanceCheck.error.message}`);
      }
      if (salaryCheck.error) {
        throw new Error(`Unable to check salary payment history: ${salaryCheck.error.message}`);
      }
      if (docsCheck.error) {
        throw new Error(`Unable to check employee documents: ${docsCheck.error.message}`);
      }

      const attendanceCount = attendanceCheck.count ?? 0;
      const salaryCount = salaryCheck.count ?? 0;

      if (salaryCount > 0) {
        throw new Error(
          `Cannot delete ${employee.full_name}: ${salaryCount} salary payment record(s) are linked. Salary history has been protected, and no records were deleted.`
        );
      }

      // Remove attendance records only after the user has explicitly confirmed.
      if (attendanceCount > 0) {
        const { error: attendanceDeleteError } = await supabase
          .from("attendance_records")
          .delete()
          .eq("company_id", companyId)
          .eq("employee_id", employee.id);

        if (attendanceDeleteError) {
          throw new Error(`Unable to delete attendance records: ${attendanceDeleteError.message}`);
        }
      }

      const employeeDocs = docsCheck.data ?? [];
      const paths = employeeDocs
        .map((document) => document.storage_path)
        .filter((path): path is string => Boolean(path));

      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("employee-documents")
          .remove(paths);

        if (storageError) {
          throw new Error(`Unable to delete employee documents from storage: ${storageError.message}`);
        }
      }

      const { error: metadataError } = await supabase
        .from("employee_documents")
        .delete()
        .eq("company_id", companyId)
        .eq("employee_id", employee.id);

      if (metadataError) {
        throw new Error(`Unable to delete employee document records: ${metadataError.message}`);
      }

      const { data: deleted, error: deleteError } = await supabase
        .from("employees")
        .delete()
        .eq("company_id", companyId)
        .eq("id", employee.id)
        .select("id")
        .maybeSingle();

      if (deleteError) {
        throw new Error(`Attendance/documents were removed, but employee deletion failed: ${deleteError.message}`);
      }
      if (!deleted) {
        throw new Error(
          "Attendance/documents were removed, but the employee was not deleted. Check the employees DELETE permission (RLS policy) in Supabase."
        );
      }

      setNotice({
        type: "success",
        text: `${employee.full_name} was permanently deleted. ${attendanceCount} attendance record(s) and linked documents were also deleted. Salary payment history was not touched.`,
      });
      await load();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while deleting the employee.",
      });
    } finally {
      setDeletingEmployeeId(null);
    }
  }

  function exportCsv() {
    const headers = [
      "Employee Code",
      "Full Name",
      "Phone",
      "Email",
      "Department",
      "Designation",
      "Joining Date",
      "Employment Status",
      "Pay Type",
      "Base Pay",
      "Address",
      "Emergency Contact Name",
      "Emergency Contact Phone",
    ];

    const escapeCsv = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = shown.map((employee) =>
      [
        employee.employee_code,
        employee.full_name,
        employee.phone,
        employee.email,
        employee.department,
        employee.designation,
        employee.joining_date,
        statusLabel(employee.employment_status),
        payLabel(employee.pay_type),
        employee.base_pay,
        addressToText(employee.address),
        addressField(employee.address, "emergency_contact_name"),
        addressField(employee.address, "emergency_contact_phone"),
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csv = [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
    );

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "great-books-employees.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function openDocuments(employee: Employee) {
    setDocumentEmployee(employee);
    setDocuments([]);
    setSelectedFiles([]);
    setDocumentName("");
    setDocumentsLoading(true);
    setNotice(null);

    const { data, error } = await supabase
      .from("employee_documents")
      .select(
        "id, company_id, employee_id, document_name, file_name, storage_path, mime_type, file_size, uploaded_by, created_at"
      )
      .eq("company_id", companyId)
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    if (error) {
      setNotice({
        type: "error",
        text: `Unable to load documents: ${error.message}`,
      });
    } else {
      setDocuments((data ?? []) as EmployeeDocument[]);
    }

    setDocumentsLoading(false);
  }

  async function uploadDocuments() {
    if (!documentEmployee || !companyId || !canWrite) return;

    if (selectedFiles.length === 0) {
      setNotice({
        type: "error",
        text: "Select at least one document.",
      });
      return;
    }

    const oversized = selectedFiles.find(
      (file) => file.size > 10 * 1024 * 1024
    );

    if (oversized) {
      setNotice({
        type: "error",
        text: `${oversized.name} exceeds the 10 MB per-file limit.`,
      });
      return;
    }

    setUploadingDocuments(true);
    setNotice(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in again before uploading documents.");
      }

      const failures: string[] = [];
      let successfulUploads = 0;

      for (const file of selectedFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath =
          `${companyId}/${documentEmployee.id}/` +
          `${crypto.randomUUID()}-${safeName}`;

        const { error: storageError } = await supabase.storage
          .from("employee-documents")
          .upload(storagePath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (storageError) {
          failures.push(`${file.name}: ${storageError.message}`);
          continue;
        }

        const { error: metadataError } = await supabase
          .from("employee_documents")
          .insert({
            company_id: companyId,
            employee_id: documentEmployee.id,
            document_name: documentName.trim() || file.name,
            file_name: file.name,
            storage_path: storagePath,
            mime_type: file.type || null,
            file_size: file.size,
            uploaded_by: user.id,
          });

        if (metadataError) {
          await supabase.storage
            .from("employee-documents")
            .remove([storagePath]);

          failures.push(`${file.name}: ${metadataError.message}`);
          continue;
        }

        successfulUploads++;
      }

      setSelectedFiles([]);

      const input = document.getElementById(
        "employee-document-files"
      ) as HTMLInputElement | null;

      if (input) input.value = "";

      await openDocuments(documentEmployee);

      if (failures.length > 0) {
        setNotice({
          type: "error",
          text:
            `${successfulUploads} uploaded successfully. ` +
            `Some files failed: ${failures.join(" | ")}`,
        });
      } else {
        setNotice({
          type: "success",
          text: `${successfulUploads} document(s) uploaded successfully.`,
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error ? error.message : "Document upload failed.",
      });
    } finally {
      setUploadingDocuments(false);
    }
  }

  async function downloadDocument(document: EmployeeDocument) {
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(document.storage_path, 60);

    if (error || !data?.signedUrl) {
      setNotice({
        type: "error",
        text: `Unable to download document: ${error?.message ?? "No download URL returned."}`,
      });
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument(document: EmployeeDocument) {
    if (!canWrite || deletingDocumentId) return;

    if (!window.confirm(`Delete "${document.file_name}"?`)) return;

    setDeletingDocumentId(document.id);
    setNotice(null);

    try {
      const { error: storageError } = await supabase.storage
        .from("employee-documents")
        .remove([document.storage_path]);

      if (storageError) {
        setNotice({
          type: "error",
          text: `Unable to delete file: ${storageError.message}`,
        });
        return;
      }

      const { error: metadataError } = await supabase
        .from("employee_documents")
        .delete()
        .eq("id", document.id)
        .eq("company_id", companyId)
        .eq("employee_id", document.employee_id);

      if (metadataError) {
        setNotice({
          type: "error",
          text: `The file was removed, but its database record could not be deleted: ${metadataError.message}`,
        });
        return;
      }

      setDocuments((current) =>
        current.filter((item) => item.id !== document.id)
      );

      setNotice({
        type: "success",
        text: "Document deleted successfully.",
      });
    } finally {
      setDeletingDocumentId(null);
    }
  }

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">BUSINESS MANAGEMENT</div>
          <h1>Employees</h1>
          <p>
            Manage employee profiles, documents, employment details and pay.
          </p>
        </div>

        <div className="employees-actions">
          <button
            className="btn"
            type="button"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          <button className="btn" type="button" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>

          {canWrite && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={createEmployee}
            >
              <Plus size={16} /> New employee
            </button>
          )}
        </div>
      </div>

      {companies.length > 1 && (
        <div className="employees-company-select">
          <label htmlFor="employee-company">Company</label>
          <select
            id="employee-company"
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

      <div className="module-grid employees-stats">
        <div className="card">
          <div className="stat-top">
            <span>Total employees</span>
            <UserRound size={19} />
          </div>
          <div className="stat-value">{employees.length}</div>
          <div className="stat-foot">All employee records</div>
        </div>

        <div className="card">
          <div className="stat-top">
            <span>Active employees</span>
            <UserCheck size={19} />
          </div>
          <div className="stat-value">{activeCount}</div>
          <div className="stat-foot">Currently employed</div>
        </div>

        <div className="card">
          <div className="stat-top">
            <span>Inactive / Left</span>
            <UserX size={19} />
          </div>
          <div className="stat-value">{inactiveCount}</div>
          <div className="stat-foot">Not currently active</div>
        </div>

        <div className="card">
          <div className="stat-top">
            <span>Monthly basic payroll</span>
          </div>
          <div className="stat-value employees-money">
            {money(monthlyPayroll, company?.currency ?? "INR")}
          </div>
          <div className="stat-foot">Active monthly-paid staff only</div>
        </div>
      </div>

      <div className="card employees-directory">
        <div className="inventory-toolbar">
          <div className="inventory-search-wrap">
            <Search size={17} className="inventory-search-icon" />
            <input
              className="inventory-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, code, phone, email, department..."
              aria-label="Search employees"
            />
          </div>

          <label className="inventory-inactive-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            Show inactive and left employees
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Contact</th>
                <th>Department / Designation</th>
                <th>Joining date</th>
                <th>Salary basis</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Loading employees…</td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    {query
                      ? "No employees match your search."
                      : "No employees yet. Click New employee to add one."}
                  </td>
                </tr>
              ) : (
                shown.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.full_name}</strong>
                      <div className="employees-subtext">
                        {employee.employee_code || "No employee code"}
                      </div>
                    </td>

                    <td>
                      {employee.phone && (
                        <div>
                          <Phone
                            size={12}
                            className="employees-inline-icon"
                          />{" "}
                          {employee.phone}
                        </div>
                      )}
                      {employee.email && (
                        <div>
                          <Mail
                            size={12}
                            className="employees-inline-icon"
                          />{" "}
                          {employee.email}
                        </div>
                      )}
                      {!employee.phone && !employee.email && "—"}
                    </td>

                    <td>
                      {employee.department || "—"}
                      <div className="employees-subtext">
                        {employee.designation || "—"}
                      </div>
                    </td>

                    <td>{dateText(employee.joining_date)}</td>

                    <td>
                      <strong>
                        {money(employee.base_pay, company?.currency ?? "INR")}
                      </strong>
                      <div className="employees-subtext">
                        {payLabel(employee.pay_type)}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`status ${
                          isActive(employee)
                            ? "status-active"
                            : "status-inactive"
                        }`}
                      >
                        {statusLabel(employee.employment_status)}
                      </span>
                    </td>

                    <td>
                      <div className="inventory-row-actions">
                        <button
                          className="btn btn-small"
                          type="button"
                          onClick={() => void openDocuments(employee)}
                        >
                          <FileText size={14} /> Documents
                        </button>

                        {canWrite && (
                          <button
                            className="btn btn-small"
                            type="button"
                            onClick={() => editEmployee(employee)}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        )}

                        {canWrite && isActive(employee) && (
                          <button
                            className="btn btn-small"
                            type="button"
                            onClick={() => void toggleActive(employee)}
                          >
                            Deactivate
                          </button>
                        )}

                        {canWrite &&
                          (employee.employment_status ?? "").toLowerCase() !==
                            "left" && (
                            <button
                              className="btn btn-small"
                              type="button"
                              onClick={() => void markLeft(employee)}
                            >
                              Mark left
                            </button>
                          )}

                        {canWrite &&
                          !isActive(employee) &&
                          (employee.employment_status ?? "").toLowerCase() !==
                            "left" && (
                            <button
                              className="btn btn-small"
                              type="button"
                              onClick={() => void toggleActive(employee)}
                            >
                              Reactivate
                            </button>
                          )}

                        {canWrite && !isActive(employee) && (
                          <button
                            className="btn btn-small"
                            type="button"
                            disabled={deletingEmployeeId === employee.id}
                            onClick={() => void deleteEmployee(employee)}
                          >
                            <Trash2 size={14} />
                            {deletingEmployeeId === employee.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="employees-table-footer">
          Showing {shown.length} of {employees.length} employees
        </div>
      </div>

      {modal && (
        <div
          className="customer-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(false);
          }}
        >
          <section
            className="customer-modal employees-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-modal-title"
          >
            <div className="customer-modal-header">
              <div>
                <div className="eyebrow">
                  {editing ? "EDIT EMPLOYEE" : "NEW EMPLOYEE"}
                </div>
                <h2 id="employee-modal-title">
                  {editing ? "Edit employee" : "Add employee"}
                </h2>
              </div>

              <button
                className="btn"
                type="button"
                onClick={() => setModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save}>
              <div className="customer-modal-body">
                {notice?.type === "error" && (
                  <div className="notice notice-error" role="alert">
                    {notice.text}
                  </div>
                )}

                <h3 className="employees-form-section">
                  Basic information
                </h3>

                <div className="employees-form-grid">
                  <label>
                    Employee name *
                    <input
                      required
                      autoFocus
                      value={form.full_name}
                      onChange={(event) =>
                        setField("full_name", event.target.value)
                      }
                      placeholder="Enter full name"
                    />
                  </label>

                  <label>
                    Employee code
                    <input
                      value={form.employee_code}
                      onChange={(event) =>
                        setField("employee_code", event.target.value)
                      }
                      placeholder="EMP-001"
                    />
                  </label>

                  <label>
                    Phone number
                    <input
                      value={form.phone}
                      onChange={(event) =>
                        setField("phone", event.target.value)
                      }
                      inputMode="tel"
                    />
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setField("email", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Joining date
                    <input
                      type="date"
                      value={form.joining_date}
                      onChange={(event) =>
                        setField("joining_date", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Employment status
                    <select
                      value={form.employment_status}
                      onChange={(event) =>
                        setField("employment_status", event.target.value)
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="left">Left</option>
                    </select>
                  </label>
                </div>

                <h3 className="employees-form-section">Work and salary</h3>

                <div className="employees-form-grid">
                  <label>
                    Department
                    <input
                      value={form.department}
                      onChange={(event) =>
                        setField("department", event.target.value)
                      }
                      placeholder="Production"
                    />
                  </label>

                  <label>
                    Designation
                    <input
                      value={form.designation}
                      onChange={(event) =>
                        setField("designation", event.target.value)
                      }
                      placeholder="Operator"
                    />
                  </label>

                  <label>
                    Pay type
                    <select
                      value={form.pay_type}
                      onChange={(event) =>
                        setField("pay_type", event.target.value)
                      }
                    >
                      <option value="monthly">Monthly — Salary</option>
                      <option value="daily">Daily — Wages</option>
                    </select>
                  </label>

                  <label>
                    {form.pay_type === "monthly"
                      ? "Monthly Salary"
                      : "Daily Wages"}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.base_pay}
                      onChange={(event) =>
                        setField("base_pay", event.target.value)
                      }
                    />
                  </label>
                </div>

                <h3 className="employees-form-section">
                  Address and emergency contact
                </h3>

                <div className="employees-form-grid">
                  <label className="employees-full-width">
                    Address
                    <textarea
                      rows={3}
                      value={form.address}
                      onChange={(event) =>
                        setField("address", event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Emergency contact name
                    <input
                      value={form.emergency_contact_name}
                      onChange={(event) =>
                        setField(
                          "emergency_contact_name",
                          event.target.value
                        )
                      }
                      placeholder="Contact person's name"
                    />
                  </label>

                  <label>
                    Emergency contact phone
                    <input
                      value={form.emergency_contact_phone}
                      onChange={(event) =>
                        setField(
                          "emergency_contact_phone",
                          event.target.value
                        )
                      }
                      inputMode="tel"
                      placeholder="Emergency phone number"
                    />
                  </label>
                </div>
              </div>

              <div className="customer-modal-footer">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Save employee"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {documentEmployee && (
        <div
          className="customer-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDocumentEmployee(null);
              setSelectedFiles([]);
            }
          }}
        >
          <section
            className="customer-modal employees-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-documents-title"
          >
            <div className="customer-modal-header">
              <div>
                <div className="eyebrow">EMPLOYEE FILES</div>
                <h2 id="employee-documents-title">
                  Documents — {documentEmployee.full_name}
                </h2>
                <p>Upload and manage multiple employee documents.</p>
              </div>

              <button
                className="btn"
                type="button"
                onClick={() => {
                  setDocumentEmployee(null);
                  setSelectedFiles([]);
                }}
                aria-label="Close documents"
              >
                <X size={18} />
              </button>
            </div>

            <div className="customer-modal-body">
              {notice && (
                <div
                  className={`notice ${
                    notice.type === "error" ? "notice-error" : ""
                  }`}
                  role="status"
                >
                  {notice.text}
                </div>
              )}

              {canWrite && (
                <>
                  <label>
                    Document category or description (optional)
                    <input
                      value={documentName}
                      onChange={(event) =>
                        setDocumentName(event.target.value)
                      }
                      placeholder="Aadhaar, PAN, Offer Letter..."
                    />
                  </label>

                  <label style={{ display: "block", marginTop: 16 }}>
                    Select documents — multiple files allowed
                    <input
                      id="employee-document-files"
                      type="file"
                      multiple
                      onChange={(event) =>
                        setSelectedFiles(
                          Array.from(event.target.files ?? [])
                        )
                      }
                      style={{ display: "block", marginTop: 8 }}
                    />
                  </label>

                  <p className="employees-subtext">
                    Maximum 10 MB per file.
                  </p>

                  {selectedFiles.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <strong>
                        Selected files ({selectedFiles.length})
                      </strong>
                      {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`}>
                          {file.name} — {formatFileSize(file.size)}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void uploadDocuments()}
                    disabled={
                      uploadingDocuments || selectedFiles.length === 0
                    }
                    style={{ marginTop: 16 }}
                  >
                    <Upload size={15} />
                    {uploadingDocuments
                      ? "Uploading..."
                      : `Upload ${selectedFiles.length || ""} document${selectedFiles.length === 1 ? "" : "s"}`}
                  </button>
                </>
              )}

              <h3 className="employees-form-section">
                Uploaded documents
              </h3>

              {documentsLoading ? (
                <p>Loading documents...</p>
              ) : documents.length === 0 ? (
                <p>No documents uploaded for this employee yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Size</th>
                        <th>Uploaded</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {documents.map((document) => (
                        <tr key={document.id}>
                          <td>
                            <strong>{document.document_name}</strong>
                            <div className="employees-subtext">
                              {document.file_name}
                            </div>
                          </td>

                          <td>{formatFileSize(document.file_size)}</td>

                          <td>{dateText(document.created_at)}</td>

                          <td>
                            <div className="inventory-row-actions">
                              <button
                                className="btn btn-small"
                                type="button"
                                onClick={() =>
                                  void downloadDocument(document)
                                }
                              >
                                <Download size={14} /> Download
                              </button>

                              {canWrite && (
                                <button
                                  className="btn btn-small"
                                  type="button"
                                  disabled={
                                    deletingDocumentId === document.id
                                  }
                                  onClick={() =>
                                    void deleteDocument(document)
                                  }
                                >
                                  <Trash2 size={14} />
                                  {deletingDocumentId === document.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="customer-modal-footer">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setDocumentEmployee(null);
                  setSelectedFiles([]);
                }}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
