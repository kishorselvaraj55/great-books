
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Search,
  Plus,
  Pencil,
  X,
  Package,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  currency: string;
  role: string;
};

type Item = {
  id: string;
  company_id: string;
  code: string | null;
  name: string;
  description: string | null;
  item_type: "product" | "service";
  unit: string;
  hsn_sac: string | null;
  gst_rate: number;
  purchase_price: number;
  selling_price: number;
  opening_stock: number;
  is_active: boolean;
};

type ItemForm = {
  code: string;
  name: string;
  description: string;
  item_type: "product" | "service";
  unit: string;
  hsn_sac: string;
  gst_rate: string;
  purchase_price: string;
  selling_price: string;
  opening_stock: string;
};

const blankForm: ItemForm = {
  code: "",
  name: "",
  description: "",
  item_type: "product",
  unit: "pcs",
  hsn_sac: "",
  gst_rate: "18",
  purchase_price: "0",
  selling_price: "0",
  opening_stock: "0",
};

const UNIT_OPTIONS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "ton", label: "Metric Ton" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "dozen", label: "Dozen" },
  { value: "m", label: "Metre (m)" },
  { value: "m2", label: "Square Metre (m²)" },
  { value: "ltr", label: "Litre (ltr)" },
  { value: "set", label: "Set" },
  { value: "pair", label: "Pair" },
  { value: "service", label: "Service" },
];

const GST_RATES = [3, 5, 12, 18, 28];

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `₹${(value || 0).toLocaleString("en-IN")}`;
  }
}

function formatQuantity(value: number) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 3,
  });
}

function displayUnit(unit: string) {
  const option = UNIT_OPTIONS.find(
    (entry) => entry.value === unit
  );

  return option?.label ?? unit;
}

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 7,
  minWidth: 0,
  color: "#344054",
  fontSize: 13,
  fontWeight: 600,
};

const inputStyle = {
  boxSizing: "border-box" as const,
  display: "block",
  width: "100%",
  minWidth: 0,
  minHeight: 42,
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: 8,
  background: "#ffffff",
  color: "#172033",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 400,
  outline: "none",
};

export function ItemsWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState(
    companies[0]?.id ?? ""
  );
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>({ ...blankForm });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const company = companies.find(
    (entry) => entry.id === companyId
  );

  const canWrite =
    company?.role === "owner" ||
    company?.role === "admin" ||
    company?.role === "manager";

  const loadItems = useCallback(async () => {
    if (!companyId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("items")
      .select(
        "id,company_id,code,name,description,item_type,unit,hsn_sac,gst_rate,purchase_price,selling_price,opening_stock,is_active"
      )
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    if (queryError) {
      setError(`Unable to load items: ${queryError.message}`);
      setItems([]);
    } else {
      setItems((data ?? []) as Item[]);
    }

    setLoading(false);
  }, [supabase, companyId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = items.filter((item) => {
    if (!showInactive && !item.is_active) {
      return false;
    }

    const term = search.trim().toLowerCase();

    if (!term) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(term) ||
      (item.code ?? "").toLowerCase().includes(term) ||
      (item.hsn_sac ?? "").toLowerCase().includes(term) ||
      (item.description ?? "").toLowerCase().includes(term)
    );
  });

  const activeItems = items.filter((item) => item.is_active);

  const activeProducts = activeItems.filter(
    (item) => item.item_type === "product"
  );

  const openingStockTotal = activeProducts.reduce(
    (total, item) =>
      total + Number(item.opening_stock || 0),
    0
  );

  // Show a unit only when the total represents one product/unit.
  // Never add quantities with different units and label them as one unit.
  const openingStockDisplay =
    activeProducts.length === 1
      ? `${formatQuantity(openingStockTotal)} ${displayUnit(
          activeProducts[0].unit
        )}`
      : formatQuantity(openingStockTotal);

  const openingStockDescription =
    activeProducts.length === 1
      ? "Total opening stock"
      : activeProducts.length === 0
        ? "No active products"
        : "Combined quantity across active products";

  function updateForm<K extends keyof ItemForm>(
    key: K,
    value: ItemForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function openNewItem() {
    setEditingId(null);
    setForm({ ...blankForm });
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function openEditItem(item: Item) {
    setEditingId(item.id);

    setForm({
      code: item.code ?? "",
      name: item.name,
      description: item.description ?? "",
      item_type: item.item_type,
      unit: item.unit,
      hsn_sac: item.hsn_sac ?? "",
      gst_rate: String(item.gst_rate),
      purchase_price: String(item.purchase_price),
      selling_price: String(item.selling_price),
      opening_stock: String(item.opening_stock),
    });

    setError("");
    setMessage("");
    setShowForm(true);
  }

  async function saveItem(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!companyId) {
      setError("Please select a company before saving an item.");
      return;
    }

    if (!canWrite) {
      setError(
        "You do not have permission to create or edit items. Contact your company administrator."
      );
      return;
    }

    const gst = Number(form.gst_rate);
    const purchasePrice = Number(form.purchase_price);
    const sellingPrice = Number(form.selling_price);
    const openingStock = Number(form.opening_stock);

    if (!form.name.trim()) {
      setError("Item name is required.");
      return;
    }

    if (!form.unit.trim()) {
      setError("Unit is required.");
      return;
    }

    if (
      ![gst, purchasePrice, sellingPrice, openingStock].every(
        Number.isFinite
      ) ||
      !GST_RATES.includes(gst) ||
      purchasePrice < 0 ||
      sellingPrice < 0 ||
      openingStock < 0
    ) {
      setError(
        "Select an available GST rate and enter valid, non-negative prices and stock quantities."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      company_id: companyId,
      code: form.code.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      item_type: form.item_type,
      unit: form.unit.trim(),
      hsn_sac: form.hsn_sac.trim() || null,
      gst_rate: gst,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      opening_stock:
        form.item_type === "service" ? 0 : openingStock,
    };

    const result = editingId
      ? await supabase
          .from("items")
          .update(payload)
          .eq("id", editingId)
          .eq("company_id", companyId)
          .select("id")
          .single()
      : await supabase
          .from("items")
          .insert(payload)
          .select("id")
          .single();

    setSaving(false);

    if (result.error) {
      if (result.error.code === "23505") {
        setError(
          "This item code already exists. Please use a different code."
        );
      } else if (result.error.code === "42501") {
        setError(
          "Database permission denied. Check your Supabase Row Level Security policies and company membership."
        );
      } else {
        setError(
          `Unable to save item: ${result.error.message}`
        );
      }

      return;
    }

    setShowForm(false);
    setEditingId(null);
    setForm({ ...blankForm });

    setMessage(
      editingId
        ? "Item updated successfully."
        : "Item created successfully."
    );

    await loadItems();
  }

  async function deactivateItem(item: Item) {
    if (!canWrite || !companyId) {
      setError(
        "You do not have permission to deactivate items."
      );
      return;
    }

    const confirmed = window.confirm(
      `Deactivate "${item.name}"? The item will be hidden from the active register but retained in the database.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");

    const { data, error: updateError } = await supabase
      .from("items")
      .update({ is_active: false })
      .eq("id", item.id)
      .eq("company_id", companyId)
      .select("id")
      .single();

    if (updateError || !data) {
      setError(
        updateError
          ? `Unable to deactivate item: ${updateError.message}`
          : "The item was not updated. Check your permissions."
      );
      return;
    }

    setMessage("Item deactivated successfully.");
    await loadItems();
  }

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GREAT BOOKS WORKSPACE</div>
          <h1>Items &amp; Inventory</h1>
          <p>
            Manage products, services, pricing, and opening stock.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openNewItem}
          disabled={!companyId || !canWrite}
        >
          <Plus size={16} />
          New item
        </button>
      </div>

      {!companyId && (
        <div className="notice">
          Create a company or obtain an active company membership
          before managing inventory.
        </div>
      )}

      {companies.length > 1 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <label htmlFor="inventory-company" style={fieldStyle}>
            Company
            <select
              id="inventory-company"
              value={companyId}
              style={inputStyle}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setShowForm(false);
                setError("");
                setMessage("");
                setSearch("");
              }}
            >
              {companies.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {companyId && !canWrite && (
        <div className="notice">
          You have read-only access to inventory. Contact your
          company administrator if you need permission to add or edit
          items.
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            padding: 13,
            marginBottom: 16,
            border: "1px solid #fecaca",
            borderRadius: 9,
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <AlertCircle
            size={17}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "center",
            padding: 13,
            marginBottom: 16,
            border: "1px solid #bbf7d0",
            borderRadius: 9,
            background: "#f0fdf4",
            color: "#166534",
            fontSize: 13,
          }}
        >
          <CheckCircle2 size={17} />
          {message}
        </div>
      )}

      <div
        className="module-grid"
        style={{
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          marginBottom: 20,
        }}
      >
        <div className="card">
          <div className="stat-top">Active items</div>
          <div className="stat-value">{activeItems.length}</div>
          <div className="stat-foot">Products and services</div>
        </div>

        <div className="card">
          <div className="stat-top">Opening stock quantity</div>
          <div
            className="stat-value"
            title={openingStockDescription}
          >
            {openingStockDisplay}
          </div>
          <div className="stat-foot">
            {openingStockDescription}
          </div>
        </div>
      </div>

      {showForm && (
        <form
          className="card"
          onSubmit={saveItem}
          style={{ marginBottom: 20 }}
        >
          <div className="card-heading">
            <div>
              <h2>{editingId ? "Edit item" : "New item"}</h2>
              <p>Fields marked with * are required.</p>
            </div>

            <button
              type="button"
              className="btn"
              onClick={() => setShowForm(false)}
              aria-label="Close item form"
            >
              <X size={17} />
            </button>
          </div>

          <div className="form-grid">
            <label>
              Item name *
              <input
                required
                maxLength={150}
                style={inputStyle}
                value={form.name}
                onChange={(event) =>
                  updateForm("name", event.target.value)
                }
                placeholder="Enter item name"
              />
            </label>

            <label>
              Item code
              <input
                maxLength={80}
                style={inputStyle}
                value={form.code}
                onChange={(event) =>
                  updateForm("code", event.target.value)
                }
                placeholder="Enter item code"
              />
            </label>

            <label>
              Type
              <select
                style={inputStyle}
                value={form.item_type}
                onChange={(event) =>
                  updateForm(
                    "item_type",
                    event.target.value as "product" | "service"
                  )
                }
              >
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </label>

            <label>
              Unit *
              <select
                required
                style={inputStyle}
                value={form.unit}
                onChange={(event) =>
                  updateForm("unit", event.target.value)
                }
              >
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              HSN / SAC
              <input
                maxLength={30}
                style={inputStyle}
                value={form.hsn_sac}
                onChange={(event) =>
                  updateForm("hsn_sac", event.target.value)
                }
                placeholder="Enter HSN/SAC"
              />
            </label>

            <label>
              GST rate (%)
              <select
                required
                style={inputStyle}
                value={form.gst_rate}
                onChange={(event) =>
                  updateForm("gst_rate", event.target.value)
                }
              >
                {GST_RATES.map((rate) => (
                  <option key={rate} value={String(rate)}>
                    {rate}%
                  </option>
                ))}
              </select>
            </label>

            <label>
              Purchase price (₹)
              <input
                type="number"
                required
                min="0"
                step="0.01"
                style={inputStyle}
                value={form.purchase_price}
                onChange={(event) =>
                  updateForm("purchase_price", event.target.value)
                }
              />
            </label>

            <label>
              Selling price (₹)
              <input
                type="number"
                required
                min="0"
                step="0.01"
                style={inputStyle}
                value={form.selling_price}
                onChange={(event) =>
                  updateForm("selling_price", event.target.value)
                }
              />
            </label>

            <label>
              Opening stock quantity
              <input
                type="number"
                required
                min="0"
                step="0.001"
                disabled={form.item_type === "service"}
                style={{
                  ...inputStyle,
                  background:
                    form.item_type === "service"
                      ? "#f2f4f7"
                      : "#ffffff",
                }}
                value={form.opening_stock}
                onChange={(event) =>
                  updateForm("opening_stock", event.target.value)
                }
              />
            </label>

            <label className="form-full">
              Description
              <textarea
                rows={3}
                maxLength={2000}
                style={{
                  ...inputStyle,
                  minHeight: 90,
                  resize: "vertical",
                }}
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                placeholder="Optional item description"
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 20,
            }}
          >
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Save item"}
            </button>

            <button
              className="btn"
              type="button"
              disabled={saving}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="card-heading">
          <div>
            <h2>Item register</h2>
            <p>
              {filteredItems.length} matching record
              {filteredItems.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => void loadItems()}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        <div className="inventory-toolbar">
          <div className="inventory-search-wrap">
            <Search
              size={17}
              className="inventory-search-icon"
            />
            <input
              className="inventory-search"
              aria-label="Search items"
              placeholder="Search by item name, code, or HSN/SAC..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <label className="inventory-inactive-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) =>
                setShowInactive(event.target.checked)
              }
            />
            Show inactive items
          </label>
        </div>

        {loading ? (
          <div className="empty-state">Loading items...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <Package
              size={28}
              style={{ marginBottom: 12, opacity: 0.55 }}
            />

            <div
              style={{
                fontWeight: 600,
                color: "#344054",
                marginBottom: 6,
              }}
            >
              {search.trim()
                ? "No matching items"
                : "No items found"}
            </div>

            {search.trim()
              ? "Try a different search term."
              : "Add your first item using the New item button."}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Code / HSN</th>
                  <th>Unit</th>
                  <th>GST</th>
                  <th>Purchase price</th>
                  <th>Selling price</th>
                  <th>Opening stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      <div
                        style={{
                          color: "#667085",
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        {item.item_type === "service"
                          ? "Service"
                          : "Product"}
                      </div>
                    </td>

                    <td>
                      {item.code || "—"}
                      <div
                        style={{
                          color: "#667085",
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        {item.hsn_sac || "—"}
                      </div>
                    </td>

                    <td>{displayUnit(item.unit)}</td>
                    <td>{Number(item.gst_rate)}%</td>

                    <td>
                      {money(
                        Number(item.purchase_price),
                        company?.currency ?? "INR"
                      )}
                    </td>

                    <td>
                      {money(
                        Number(item.selling_price),
                        company?.currency ?? "INR"
                      )}
                    </td>

                    <td>
                      {formatQuantity(Number(item.opening_stock))}
                      {" "}
                      {displayUnit(item.unit)}
                    </td>

                    <td>
                      <span
                        className={`status ${
                          item.is_active ? "paid" : "overdue"
                        }`}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      {canWrite && (
                        <div className="inventory-row-actions">
                          <button
                            type="button"
                            className="btn"
                            title="Edit item"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => openEditItem(item)}
                          >
                            <Pencil size={14} />
                          </button>

                          {item.is_active && (
                            <button
                              type="button"
                              className="btn"
                              onClick={() =>
                                void deactivateItem(item)
                              }
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
