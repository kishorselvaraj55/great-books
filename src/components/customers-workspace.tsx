

"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import {

  Plus,

  Search,

  Pencil,

  X,

  UsersRound,

  UserCheck,

  UserX,

  RefreshCw,

  MapPin,

} from "lucide-react";



import { createClient } from "@/lib/supabase/client";



type Company = {

  id: string;

  name: string;

  currency: string;

  role: string;

};



type Address = {

  address?: string;

  city?: string;

  state?: string;

  postal_code?: string;

  country?: string;

};



type Customer = {

  id: string;

  company_id: string;

  customer_code: string | null;

  name: string;

  email: string | null;

  phone: string | null;

  gstin: string | null;

  billing_address: Address | null;

  shipping_address: Address | null;

  payment_terms_days: number;

  is_active: boolean;

  created_at: string;

  updated_at: string;

};



type CustomerForm = {

  customer_code: string;

  name: string;

  email: string;

  phone: string;

  gstin: string;

  billing_address: Address;

  shipping_address: Address;

  payment_terms_days: string;

  is_active: boolean;

};



const emptyAddress: Address = {

  address: "",

  city: "",

  state: "",

  postal_code: "",

  country: "India",

};



const emptyForm: CustomerForm = {

  customer_code: "",

  name: "",

  email: "",

  phone: "",

  gstin: "",

  billing_address: { ...emptyAddress },

  shipping_address: { ...emptyAddress },

  payment_terms_days: "0",

  is_active: true,

};



function cleanAddress(address: Address): Address {

  return {

    address: address.address?.trim() ?? "",

    city: address.city?.trim() ?? "",

    state: address.state?.trim() ?? "",

    postal_code: address.postal_code?.trim() ?? "",

    country: address.country?.trim() || "India",

  };

}



function addressText(address: Address | null): string {

  if (!address) return "—";



  return [

    address.address,

    address.city,

    address.state,

    address.postal_code,

    address.country,

  ]

    .filter(Boolean)

    .join(", ") || "—";

}



function canManage(role: string): boolean {

  return ["owner", "admin", "manager"].includes(role.toLowerCase());

}



export function CustomersWorkspace({

  companies,

}: {

  companies: Company[];

}) {

  const supabase = useMemo(() => createClient(), []);



  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [search, setSearch] = useState("");

  const [showInactive, setShowInactive] = useState(false);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<CustomerForm>({ ...emptyForm });

  const [sameAddress, setSameAddress] = useState(false);



  const selectedCompany = companies.find(

    (company) => company.id === companyId

  );



  const mayManage = canManage(selectedCompany?.role ?? "");



  const loadCustomers = useCallback(async () => {

    if (!companyId) {

      setCustomers([]);

      setLoading(false);

      return;

    }



    setLoading(true);

    setError("");



    const { data, error: fetchError } = await supabase

      .from("customers")

      .select("*")

      .eq("company_id", companyId)

      .order("name", { ascending: true });



    if (fetchError) {

      setError(`Unable to load customers: ${fetchError.message}`);

      setCustomers([]);

    } else {

      setCustomers((data ?? []) as Customer[]);

    }



    setLoading(false);

  }, [supabase, companyId]);



  useEffect(() => {

    void loadCustomers();

  }, [loadCustomers]);



  const filteredCustomers = useMemo(() => {

    const term = search.trim().toLowerCase();



    return customers.filter((customer) => {

      if (!showInactive && !customer.is_active) return false;

      if (!term) return true;



      return [

        customer.name,

        customer.customer_code,

        customer.phone,

        customer.email,

        customer.gstin,

      ].some((value) => value?.toLowerCase().includes(term));

    });

  }, [customers, search, showInactive]);



  const activeCount = customers.filter((c) => c.is_active).length;

  const inactiveCount = customers.length - activeCount;



  function updateField<K extends keyof CustomerForm>(

    key: K,

    value: CustomerForm[K]

  ) {

    setForm((previous) => ({ ...previous, [key]: value }));

  }



  function updateAddress(

    type: "billing_address" | "shipping_address",

    key: keyof Address,

    value: string

  ) {

    setForm((previous) => {

      const updated = {

        ...previous,

        [type]: { ...previous[type], [key]: value },

      };



      if (sameAddress && type === "billing_address") {

        updated.shipping_address = {

          ...updated.billing_address,

        };

      }



      return updated;

    });

  }



  function openCreate() {

    setEditingId(null);

    setForm({ ...emptyForm });

    setSameAddress(false);

    setError("");

    setSuccess("");

    setModalOpen(true);

  }



  function openEdit(customer: Customer) {

    setEditingId(customer.id);



    const billing = {

      ...emptyAddress,

      ...(customer.billing_address ?? {}),

    };



    const shipping = {

      ...emptyAddress,

      ...(customer.shipping_address ?? {}),

    };



    const addressesMatch =

      JSON.stringify(cleanAddress(billing)) ===

      JSON.stringify(cleanAddress(shipping));



    setSameAddress(addressesMatch);



    setForm({

      customer_code: customer.customer_code ?? "",

      name: customer.name,

      email: customer.email ?? "",

      phone: customer.phone ?? "",

      gstin: customer.gstin ?? "",

      billing_address: billing,

      shipping_address: shipping,

      payment_terms_days: String(customer.payment_terms_days ?? 0),

      is_active: customer.is_active,

    });



    setError("");

    setSuccess("");

    setModalOpen(true);

  }



  async function handleSave(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();



    if (!companyId || !form.name.trim()) {

      setError("Select a company and enter the customer name.");

      return;

    }



    if (!mayManage) {

      setError("Your role does not allow you to create or edit customers.");

      return;

    }



    const paymentDays = Number(form.payment_terms_days);



    if (

      !Number.isInteger(paymentDays) ||

      paymentDays < 0 ||

      paymentDays > 3650

    ) {

      setError("Payment terms must be a whole number between 0 and 3650.");

      return;

    }



    const email = form.email.trim();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

      setError("Enter a valid email address.");

      return;

    }



    const { data: authData, error: authError } =

      await supabase.auth.getUser();



    if (authError || !authData.user) {

      setError("Your session has expired. Please log in again.");

      return;

    }



    setSaving(true);

    setError("");

    setSuccess("");



    const payload = {

      company_id: companyId,

      customer_code: form.customer_code.trim() || null,

      name: form.name.trim(),

      email: email || null,

      phone: form.phone.trim() || null,

      gstin: form.gstin.trim().toUpperCase() || null,

      billing_address: cleanAddress(form.billing_address),

      shipping_address: cleanAddress(

        sameAddress ? form.billing_address : form.shipping_address

      ),

      payment_terms_days: paymentDays,

      is_active: form.is_active,

      updated_at: new Date().toISOString(),

    };



    const result = editingId

      ? await supabase

          .from("customers")

          .update(payload)

          .eq("id", editingId)

          .eq("company_id", companyId)

          .select("id")

          .maybeSingle()

      : await supabase

          .from("customers")

          .insert({

            ...payload,

            created_by: authData.user.id,

          })

          .select("id")

          .single();



    setSaving(false);



    if (result.error) {

      if (result.error.code === "23505") {

        setError("That customer code already exists for this company.");

      } else {

        setError(`Unable to save customer: ${result.error.message}`);

      }

      return;

    }



    if (!result.data) {

      setError(

        "No customer was updated. Check your company access and permissions."

      );

      return;

    }



    setModalOpen(false);

    setSuccess(editingId ? "Customer updated successfully." : "Customer created successfully.");

    await loadCustomers();

  }



  async function toggleActive(customer: Customer) {

    if (!mayManage) {

      setError("Your role does not allow you to change customer status.");

      return;

    }



    const action = customer.is_active ? "deactivate" : "activate";



    if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} ${customer.name}?`)) {

      return;

    }



    setError("");

    setSuccess("");



    const { error: updateError } = await supabase

      .from("customers")

      .update({

        is_active: !customer.is_active,

        updated_at: new Date().toISOString(),

      })

      .eq("id", customer.id)

      .eq("company_id", companyId);



    if (updateError) {

      setError(`Unable to update status: ${updateError.message}`);

      return;

    }



    setSuccess(

      `${customer.name} ${customer.is_active ? "deactivated" : "activated"} successfully.`

    );

    await loadCustomers();

  }



  function renderAddressFields(

    type: "billing_address" | "shipping_address",

    title: string

  ) {

    const address = form[type];



    return (

      <section className="customer-address-section">

        <h3>{title}</h3>



        <label className="customer-field customer-field-full">

          Address

          <textarea

            rows={2}

            value={address.address ?? ""}

            onChange={(event) =>

              updateAddress(type, "address", event.target.value)

            }

            placeholder="Street, building, area"

          />

        </label>



        <div className="customer-form-grid">

          <label className="customer-field">

            City

            <input

              value={address.city ?? ""}

              onChange={(event) =>

                updateAddress(type, "city", event.target.value)

              }

            />

          </label>



          <label className="customer-field">

            State

            <input

              value={address.state ?? ""}

              onChange={(event) =>

                updateAddress(type, "state", event.target.value)

              }

            />

          </label>



          <label className="customer-field">

            PIN code

            <input

              value={address.postal_code ?? ""}

              onChange={(event) =>

                updateAddress(type, "postal_code", event.target.value)

              }

              inputMode="numeric"

            />

          </label>



          <label className="customer-field">

            Country

            <input

              value={address.country ?? ""}

              onChange={(event) =>

                updateAddress(type, "country", event.target.value)

              }

            />

          </label>

        </div>

      </section>

    );

  }



  return (

    <div className="content customers-workspace">

      <div className="page-heading">

        <div>

          <div className="eyebrow">BUSINESS MANAGEMENT</div>

          <h1>Customers</h1>

          <p>Manage customer details, GSTINs, addresses, and payment terms.</p>

        </div>



        <div className="customer-heading-actions">

          <button

            type="button"

            className="btn"

            onClick={() => void loadCustomers()}

            disabled={loading}

          >

            <RefreshCw size={15} />

            Refresh

          </button>



          {mayManage && (

            <button

              type="button"

              className="btn btn-primary"

              onClick={openCreate}

              disabled={!companyId}

            >

              <Plus size={16} />

              New customer

            </button>

          )}

        </div>

      </div>



      {companies.length > 1 && (

        <div className="customer-company-select">

          <label htmlFor="customer-company">Company</label>

          <select

            id="customer-company"

            value={companyId}

            onChange={(event) => {

              setCompanyId(event.target.value);

              setSuccess("");

              setError("");

            }}

          >

            {companies.map((company) => (

              <option key={company.id} value={company.id}>

                {company.name}

              </option>

            ))}

          </select>

        </div>

      )}



      {error && (

        <div className="notice" role="alert">

          {error}

        </div>

      )}



      {success && (

        <div className="notice customer-success" role="status">

          {success}

        </div>

      )}



      {companies.length === 0 ? (

        <div className="card empty-state">

          <UsersRound size={32} />

          <h3>No company available</h3>

          <p>Your account must be linked to an active company to manage customers.</p>

        </div>

      ) : (

        <>

          <div className="module-grid customer-stats">

            <div className="card">

              <div className="stat-top">

                <span>Total customers</span>

                <UsersRound size={19} />

              </div>

              <div className="stat-value">{customers.length}</div>

              <div className="stat-foot">All customer records</div>

            </div>



            <div className="card">

              <div className="stat-top">

                <span>Active customers</span>

                <UserCheck size={19} />

              </div>

              <div className="stat-value">{activeCount}</div>

              <div className="stat-foot">Available for new transactions</div>

            </div>



            <div className="card">

              <div className="stat-top">

                <span>Inactive customers</span>

                <UserX size={19} />

              </div>

              <div className="stat-value">{inactiveCount}</div>

              <div className="stat-foot">Kept for historical records</div>

            </div>

          </div>



          <div className="card customer-list-card">

            <div className="inventory-toolbar">

              <div className="inventory-search-wrap">

                <Search

                  size={17}

                  className="inventory-search-icon"

                />

                <input

                  className="inventory-search"

                  value={search}

                  onChange={(event) => setSearch(event.target.value)}

                  placeholder="Search name, code, phone, email or GSTIN..."

                />

              </div>



              <label className="inventory-inactive-toggle">

                <input

                  type="checkbox"

                  checked={showInactive}

                  onChange={(event) => setShowInactive(event.target.checked)}

                />

                Show inactive

              </label>

            </div>



            {loading ? (

              <div className="empty-state">Loading customers...</div>

            ) : filteredCustomers.length === 0 ? (

              <div className="empty-state">

                <UsersRound size={30} />

                <h3>No customers found</h3>

                <p>

                  {search

                    ? "Try another search term."

                    : "Create your first customer to get started."}

                </p>

                {!search && mayManage && (

                  <button className="btn btn-primary" onClick={openCreate}>

                    <Plus size={15} />

                    New customer

                  </button>

                )}

              </div>

            ) : (

              <div className="table-wrap">

                <table className="data-table">

                  <thead>

                    <tr>

                      <th>Customer</th>

                      <th>Contact</th>

                      <th>GSTIN</th>

                      <th>Billing address</th>

                      <th>Payment terms</th>

                      <th>Status</th>

                      {mayManage && <th>Actions</th>}

                    </tr>

                  </thead>



                  <tbody>

                    {filteredCustomers.map((customer) => (

                      <tr key={customer.id}>

                        <td>

                          <div className="customer-name">

                            {customer.name}

                          </div>

                          <div className="customer-muted">

                            {customer.customer_code || "No customer code"}

                          </div>

                        </td>



                        <td>

                          <div>{customer.phone || "—"}</div>

                          <div className="customer-muted">

                            {customer.email || ""}

                          </div>

                        </td>



                        <td>{customer.gstin || "—"}</td>



                        <td className="customer-address-cell">

                          <MapPin size={14} />

                          <span>{addressText(customer.billing_address)}</span>

                        </td>



                        <td>

                          {customer.payment_terms_days === 0

                            ? "Due immediately"

                            : `${customer.payment_terms_days} days`}

                        </td>



                        <td>

                          <span

                            className={`status ${

                              customer.is_active ? "status-active" : "status-inactive"

                            }`}

                          >

                            {customer.is_active ? "Active" : "Inactive"}

                          </span>

                        </td>



                        {mayManage && (

                          <td>

                            <div className="inventory-row-actions">

                              <button

                                type="button"

                                className="btn"

                                title="Edit customer"

                                aria-label={`Edit ${customer.name}`}

                                onClick={() => openEdit(customer)}

                              >

                                <Pencil size={14} />

                              </button>



                              <button

                                type="button"

                                className="btn"

                                onClick={() => void toggleActive(customer)}

                              >

                                {customer.is_active ? "Deactivate" : "Activate"}

                              </button>

                            </div>

                          </td>

                        )}

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            )}



            <div className="customer-list-footer">

              Showing {filteredCustomers.length} of {customers.length} customers

            </div>

          </div>

        </>

      )}



      {modalOpen && (

        <div

          className="customer-modal-backdrop"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget && !saving) {

              setModalOpen(false);

            }

          }}

        >

          <div

            className="customer-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="customer-modal-title"

          >

            <div className="customer-modal-header">

              <div>

                <div className="eyebrow">

                  {editingId ? "CUSTOMER DETAILS" : "NEW CUSTOMER"}

                </div>

                <h2 id="customer-modal-title">

                  {editingId ? "Edit customer" : "Add customer"}

                </h2>

              </div>



              <button

                type="button"

                className="btn"

                onClick={() => setModalOpen(false)}

                disabled={saving}

                aria-label="Close form"

              >

                <X size={18} />

              </button>

            </div>



            <form onSubmit={handleSave} className="customer-modal-form">

              <div className="customer-modal-body">

                {error && (

                  <div className="notice" role="alert">

                    {error}

                  </div>

                )}



                <section className="customer-address-section">

                  <h3>Basic information</h3>



                  <div className="customer-form-grid">

                    <label className="customer-field">

                      Customer name *

                      <input

                        required

                        autoFocus

                        value={form.name}

                        onChange={(event) =>

                          updateField("name", event.target.value)

                        }

                        placeholder="Enter customer name"

                      />

                    </label>



                    <label className="customer-field">

                      Customer code

                      <input

                        value={form.customer_code}

                        onChange={(event) =>

                          updateField("customer_code", event.target.value)

                        }

                        placeholder="e.g. CUST-001"

                      />

                    </label>



                    <label className="customer-field">

                      Phone number

                      <input

                        value={form.phone}

                        onChange={(event) =>

                          updateField("phone", event.target.value)

                        }

                        inputMode="tel"

                      />

                    </label>



                    <label className="customer-field">

                      Email

                      <input

                        type="email"

                        value={form.email}

                        onChange={(event) =>

                          updateField("email", event.target.value)

                        }

                      />

                    </label>



                    <label className="customer-field customer-field-full">

                      GSTIN

                      <input

                        value={form.gstin}

                        onChange={(event) =>

                          updateField("gstin", event.target.value.toUpperCase())

                        }

                        maxLength={15}

                        placeholder="15-character GSTIN"

                      />

                    </label>



                    <label className="customer-field">

                      Payment terms (days)

                      <input

                        type="number"

                        min="0"

                        max="3650"

                        step="1"

                        value={form.payment_terms_days}

                        onChange={(event) =>

                          updateField("payment_terms_days", event.target.value)

                        }

                      />

                    </label>



                    <label className="customer-field customer-checkbox-field">

                      <input

                        type="checkbox"

                        checked={form.is_active}

                        onChange={(event) =>

                          updateField("is_active", event.target.checked)

                        }

                      />

                      Customer is active

                    </label>

                  </div>

                </section>



                {renderAddressFields("billing_address", "Billing address")}



                <label className="customer-same-address">

                  <input

                    type="checkbox"

                    checked={sameAddress}

                    onChange={(event) => {

                      const checked = event.target.checked;

                      setSameAddress(checked);



                      if (checked) {

                        setForm((previous) => ({

                          ...previous,

                          shipping_address: {

                            ...previous.billing_address,

                          },

                        }));

                      }

                    }}

                  />

                  Shipping address is the same as billing address

                </label>



                {!sameAddress &&

                  renderAddressFields("shipping_address", "Shipping address")}

              </div>



              <div className="customer-modal-footer">

                <button

                  type="button"

                  className="btn"

                  onClick={() => setModalOpen(false)}

                  disabled={saving}

                >

                  Cancel

                </button>



                <button

                  type="submit"

                  className="btn btn-primary"

                  disabled={saving}

                >

                  {saving

                    ? "Saving..."

                    : editingId

                      ? "Save changes"

                      : "Create customer"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>

  );

}
