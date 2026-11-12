
import {
  LayoutDashboard,
  ShoppingCart,
  ReceiptText,
  Users,
  UsersRound,
  Wallet,
  CalendarCheck,
  Files,
  UserPlus,
  Settings,
  Package,
  Truck,
  ChartNoAxesCombined,
} from "lucide-react";

export const navigation = [
  {
    label: "OVERVIEW",
    items: [
      {
        title: "Home",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "BUSINESS",
    items: [
      {
        title: "Purchase",
        href: "/modules/purchase",
        icon: ShoppingCart,
      },
      {
        title: "Sales",
        href: "/modules/sales",
        icon: ReceiptText,
      },
      {
        title: "Customers",
        href: "/modules/customers",
        icon: UsersRound,
      },
      {
        title: "Debtors",
        href: "/modules/debtors",
        icon: Wallet,
      },
      {
        title: "Creditors",
        href: "/modules/creditors",
        icon: Truck,
      },
      {
        title: "Items & Inventory",
        href: "/modules/items",
        icon: Package,
      },
    ],
  },
  {
    label: "PEOPLE & FILES",
    items: [
      {
        title: "Employees",
        href: "/modules/employees",
        icon: Users,
      },
      {
        title: "Attendance & Salary",
        href: "/modules/attendance",
        icon: CalendarCheck,
      },
      {
        title: "Documents",
        href: "/modules/documents",
        icon: Files,
      },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      {
        title: "Invite Users",
        href: "/modules/users",
        icon: UserPlus,
      },
      {
        title: "Reports",
        href: "/modules/reports",
        icon: ChartNoAxesCombined,
      },
      {
        title: "Settings",
        href: "/modules/settings",
        icon: Settings,
      },
    ],
  },
];

export const moduleDetails: Record<
  string,
  {
    title: string;
    description: string;
    icon: typeof ShoppingCart;
    features: string[];
  }
> = {
  purchase: {
    title: "Purchase Management",
    description:
      "Manage supplier bills, purchase records, expenses, and payments in one place.",
    icon: ShoppingCart,
    features: [
      "Vendor directory and GSTIN details",
      "Purchase bills and line items",
      "Expense categories and attachments",
      "Due dates and supplier payments",
      "Purchase registers and exports",
    ],
  },

  sales: {
    title: "Sales Management",
    description:
      "Create customer records, GST invoices, delivery challans, and track sales activity.",
    icon: ReceiptText,
    features: [
      "Customer directory and GSTIN details",
      "Sales invoices with configurable tax",
      "Invoice status and payment tracking",
      "Delivery challan references",
      "Sales register and exports",
    ],
  },

  customers: {
    title: "Customer Management",
    description:
      "Manage customer profiles, GSTIN details, billing addresses, and payment terms.",
    icon: UsersRound,
    features: [
      "Customer directory and contact details",
      "GSTIN and billing address management",
      "Customer codes and searchable records",
      "Payment terms and credit limits",
      "Active and inactive customer records",
    ],
  },

  debtors: {
    title: "Debtors · Accounts Receivable",
    description:
      "Track customer balances, collections, overdue invoices, and receivable ageing.",
    icon: Wallet,
    features: [
      "Customer-wise outstanding balances",
      "Invoice due dates and overdue tracking",
      "Record payments received",
      "Payment history",
      "Ageing report",
    ],
  },

  creditors: {
    title: "Creditors · Accounts Payable",
    description:
      "Track supplier balances, payment schedules, and outstanding purchase bills.",
    icon: Truck,
    features: [
      "Vendor-wise outstanding balances",
      "Bill due dates and overdue tracking",
      "Record supplier payments",
      "Payment history",
      "Ageing report",
    ],
  },

  items: {
    title: "Items & Inventory",
    description:
      "Maintain a reusable item master for products, services, pricing, and stock tracking.",
    icon: Package,
    features: [
      "Item code, name, and description",
      "Units, selling price, and purchase price",
      "GST tax rate configuration",
      "Stock opening balance and movement",
      "Low-stock reporting",
    ],
  },

  employees: {
    title: "Employee Management",
    description:
      "Keep employee profiles, designations, joining dates, and employment documents organized.",
    icon: Users,
    features: [
      "Employee profiles and employee IDs",
      "Department and designation",
      "Joining date and employment status",
      "Salary structure and advances",
      "Employee document references",
    ],
  },

  attendance: {
    title: "Attendance & Salary",
    description:
      "Record daily attendance and prepare monthly salary statements from configured pay rules.",
    icon: CalendarCheck,
    features: [
      "Present, absent, half-day, and leave",
      "Monthly and daily-wage salary rules",
      "Overtime, allowances, and deductions",
      "Salary statement and payslip records",
      "Salary payment history",
    ],
  },

  documents: {
    title: "Document Management",
    description:
      "Organize business files with company-scoped access controls.",
    icon: Files,
    features: [
      "Folder and category organization",
      "Secure upload and download",
      "GST, PAN, licences, and agreements",
      "Employee and invoice document references",
      "Access governed by company membership",
    ],
  },

  users: {
    title: "Invite Users",
    description:
      "Manage company members, invitations, roles, and module permissions.",
    icon: UserPlus,
    features: [
      "Invite team members by email",
      "Owner, admin, manager, and staff roles",
      "Module-level permissions",
      "Activate or deactivate membership",
      "Audit important user actions",
    ],
  },

  reports: {
    title: "Reports & Exports",
    description:
      "Review business activity and export supported data for reconciliation and analysis.",
    icon: ChartNoAxesCombined,
    features: [
      "Sales and purchase registers",
      "Receivables and payables ageing",
      "Inventory movement reports",
      "Attendance and salary summaries",
      "CSV exports and printable reports",
    ],
  },

  settings: {
    title: "Company Settings",
    description:
      "Configure company profiles, financial year, invoice preferences, and account settings.",
    icon: Settings,
    features: [
      "Multiple company profiles",
      "GSTIN, addresses, and company logo",
      "Financial year and invoice numbering",
      "Tax and currency preferences",
      "Security and subscription settings",
    ],
  },
};


/** Shared role checks for navigation and server-side route authorization. */
export type CompanyRole = "owner" | "admin" | "manager" | "staff";

const STAFF_MODULES = new Set(["sales", "purchase", "customers", "items"]);
const MANAGER_MODULES = new Set([
  ...STAFF_MODULES,
  "employees",
  "attendance",
]);

export function normalizeCompanyRole(role: string | null | undefined): CompanyRole {
  const value = (role ?? "").trim().toLowerCase();
  if (value === "owner") return "owner";
  if (value === "admin" || value === "administrator") return "admin";
  if (value === "manager") return "manager";
  return "staff";
}

export function canAccessModule(
  role: string | null | undefined,
  module: string,
): boolean {
  const normalizedRole = normalizeCompanyRole(role);
  if (normalizedRole === "owner" || normalizedRole === "admin") return true;
  if (module === "dashboard") return true;
  if (normalizedRole === "manager") return MANAGER_MODULES.has(module);
  return STAFF_MODULES.has(module);
}

export function getNavigationForRole(role: string | null | undefined) {
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.href === "/dashboard") return true;
        const module = item.href.split("/").filter(Boolean).at(-1) ?? "";
        return canAccessModule(role, module);
      }),
    }))
    .filter((group) => group.items.length > 0);
}
