"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import {
  Download, FileText, FolderOpen, RefreshCw, Search, Trash2,
  Upload, X, File as FileIcon, ShieldCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Company = { id: string; name: string; currency: string; role: string };
type DocumentRow = {
  id: string;
  company_id: string;
  name: string;
  category: string;
  description: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
};

const BUCKET = "company-documents";

const CATEGORIES = [
  "GST",
  "PAN",
  "Invoices",
  "Purchase bills",
  "Licences",
  "Agreements",
  "Bank documents",
  "Employee documents",
  "Other",
];

const inputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 42,
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: 9,
  background: "#fff",
  color: "#172033",
  font: "inherit",
  fontWeight: 400,
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  color: "#344054",
  fontSize: 13,
  fontWeight: 600,
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 40,
  padding: "9px 14px",
  border: "1px solid #d0d5dd",
  borderRadius: 9,
  background: "#fff",
  color: "#344054",
  fontWeight: 600,
  cursor: "pointer",
};

function formatBytes(bytes: number | null) {
  const value = Number(bytes ?? 0);

  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(-120) || "document"
  );
}

function canManage(role?: string) {
  return ["owner", "admin", "manager"].includes(
    (role ?? "").toLowerCase()
  );
}

export default function DocumentsWorkspace({
  companies,
}: {
  companies: Company[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const activeCompany = companies.find(
    (company) => company.id === companyId
  );

  const mayManage = canManage(activeCompany?.role);

  const loadDocuments = useCallback(async () => {
    if (!companyId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("company_documents")
      .select(
        "id,company_id,name,category,description,file_path,file_size,mime_type,uploaded_by,created_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(`Unable to load documents: ${queryError.message}`);
      setDocuments([]);
    } else {
      setDocuments((data ?? []) as DocumentRow[]);
    }

    setLoading(false);
  }, [companyId, supabase]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesCategory =
        categoryFilter === "All categories" ||
        doc.category === categoryFilter;

      const matchesSearch =
        !term ||
        [doc.name, doc.category, doc.description ?? ""].some((value) =>
          value.toLowerCase().includes(term)
        );

      return matchesCategory && matchesSearch;
    });
  }, [documents, search, categoryFilter]);

  async function handleUpload(event: ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyId || !selectedFile) {
      setError("Choose a file before uploading.");
      return;
    }

    if (!mayManage) {
      setError("You do not have permission to upload documents.");
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("The file is larger than 20 MB. Please choose a smaller file.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    const path = `${companyId}/${Date.now()}-${safeFileName(
      selectedFile.name
    )}`;

    const { data: authData } = await supabase.auth.getUser();

    const storageResult = await supabase.storage
      .from(BUCKET)
      .upload(path, selectedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: selectedFile.type || "application/octet-stream",
      });

    if (storageResult.error) {
      setError(`Upload failed: ${storageResult.error.message}`);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("company_documents")
      .insert({
        company_id: companyId,
        name: selectedFile.name,
        category,
        description: description.trim() || null,
        file_path: path,
        file_size: selectedFile.size,
        mime_type: selectedFile.type || null,
        uploaded_by: authData.user?.id ?? null,
      });

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);

      setError(
        `File uploaded but its record could not be saved. The uploaded file was rolled back: ${insertError.message}`
      );

      setUploading(false);
      return;
    }

    setSuccess("Document uploaded successfully.");
    setUploadOpen(false);
    setSelectedFile(null);
    setCategory("Other");
    setDescription("");

    if (fileRef.current) {
      fileRef.current.value = "";
    }

    await loadDocuments();
    setUploading(false);
  }

  async function downloadDocument(doc: DocumentRow) {
    setError("");

    const { data, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 60);

    if (signedError || !data?.signedUrl) {
      setError(
        `Unable to create a download link: ${
          signedError?.message ?? "No download URL returned."
        }`
      );
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument(doc: DocumentRow) {
    if (!mayManage) {
      setError("You do not have permission to delete documents.");
      return;
    }

    if (
      !window.confirm(
        `Delete "${doc.name}"? This will permanently remove the stored file.`
      )
    ) {
      return;
    }

    setDeletingId(doc.id);
    setError("");
    setSuccess("");

    const { error: rowError } = await supabase
      .from("company_documents")
      .delete()
      .eq("id", doc.id)
      .eq("company_id", companyId);

    if (rowError) {
      setError(`Unable to delete document record: ${rowError.message}`);
      setDeletingId(null);
      return;
    }

    const { error: fileError } = await supabase.storage
      .from(BUCKET)
      .remove([doc.file_path]);

    if (fileError) {
      setError(
        `Document record deleted, but stored file cleanup failed: ${fileError.message}`
      );
    } else {
      setSuccess("Document deleted successfully.");
    }

    await loadDocuments();
    setDeletingId(null);
  }

  const totalSize = documents.reduce(
    (sum, doc) => sum + Number(doc.file_size ?? 0),
    0
  );

  return (
    <div
      className="content documents-workspace"
      style={{ display: "grid", gap: 20 }}
    >
      <div className="page-heading" style={{ alignItems: "center" }}>
        <div>
          <div className="eyebrow">GREAT BOOKS WORKSPACE</div>
          <h1>Document Management</h1>
          <p>
            Securely store, organize and access your company documents.
          </p>
        </div>

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            style={buttonStyle}
            onClick={() => void loadDocuments()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Refresh
          </button>

          {mayManage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setUploadOpen(true)}
            >
              <Upload size={15} /> Upload document
            </button>
          )}
        </div>
      </div>

      {companies.length > 1 && (
        <label style={{ ...labelStyle, maxWidth: 360 }}>
          Company
          <select
            style={inputStyle}
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <div className="notice" role="alert" style={{ color: "#b42318" }}>
          {error}
        </div>
      )}

      {success && (
        <div className="notice" role="status" style={{ color: "#027a48" }}>
          {success}
        </div>
      )}

      {!mayManage && companyId && (
        <div className="notice">
          <ShieldCheck
            size={16}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 7,
            }}
          />
          You have view and download access. Ask a company owner, admin or
          manager to upload or delete documents.
        </div>
      )}

      <div
        className="stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: 16,
        }}
      >
        <div className="card">
          <div className="muted">Total documents</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {documents.length}
          </div>
          <div className="muted">Files in this company</div>
        </div>

        <div className="card">
          <div className="muted">Storage used</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {formatBytes(totalSize)}
          </div>
          <div className="muted">Combined file size</div>
        </div>

        <div className="card">
          <div className="muted">Categories</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {new Set(documents.map((doc) => doc.category)).size}
          </div>
          <div className="muted">Categories in use</div>
        </div>
      </div>

      <section
        className="card"
        style={{ padding: 20, display: "grid", gap: 16 }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 320px" }}>
            <Search
              size={17}
              style={{
                position: "absolute",
                left: 12,
                top: 13,
                color: "#667085",
              }}
            />

            <input
              style={{ ...inputStyle, paddingLeft: 39 }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search file name, category or description..."
            />
          </div>

          <select
            style={{ ...inputStyle, width: "auto", minWidth: 180 }}
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option>All categories</option>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading documents...</div>
        ) : filteredDocuments.length === 0 ? (
          <div
            className="empty-state"
            style={{ padding: 42, textAlign: "center" }}
          >
            <FolderOpen
              size={32}
              style={{ marginBottom: 10, color: "#98a2b3" }}
            />

            <div style={{ fontWeight: 650, marginBottom: 5 }}>
              {documents.length
                ? "No matching documents"
                : "No documents uploaded yet"}
            </div>

            <div className="muted">
              {documents.length
                ? "Try another search or category."
                : "Upload GST certificates, invoices, licences and other business files here."}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 720,
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  {[
                    "Document",
                    "Category",
                    "Size",
                    "Uploaded",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "13px 12px",
                        color: "#667085",
                        fontSize: 12,
                        fontWeight: 650,
                        borderBottom: "1px solid #eaecf0",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td
                      style={{
                        padding: 13,
                        borderBottom: "1px solid #eaecf0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            width: 36,
                            height: 36,
                            display: "grid",
                            placeItems: "center",
                            background: "#eff6ff",
                            color: "#2563eb",
                            borderRadius: 9,
                          }}
                        >
                          <FileIcon size={18} />
                        </span>

                        <div>
                          <div
                            style={{ fontWeight: 650, color: "#172033" }}
                          >
                            {doc.name}
                          </div>

                          {doc.description && (
                            <div
                              className="muted"
                              style={{ fontSize: 12 }}
                            >
                              {doc.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td
                      style={{
                        padding: 13,
                        borderBottom: "1px solid #eaecf0",
                      }}
                    >
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 20,
                          background: "#f2f4f7",
                          fontSize: 12,
                        }}
                      >
                        {doc.category}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: 13,
                        borderBottom: "1px solid #eaecf0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatBytes(doc.file_size)}
                    </td>

                    <td
                      style={{
                        padding: 13,
                        borderBottom: "1px solid #eaecf0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(doc.created_at)}
                    </td>

                    <td
                      style={{
                        padding: 13,
                        borderBottom: "1px solid #eaecf0",
                      }}
                    >
                      <div style={{ display: "flex", gap: 7 }}>
                        <button
                          type="button"
                          style={buttonStyle}
                          title="Download"
                          onClick={() => void downloadDocument(doc)}
                        >
                          <Download size={15} /> Download
                        </button>

                        {mayManage && (
                          <button
                            type="button"
                            style={{ ...buttonStyle, color: "#b42318" }}
                            title="Delete"
                            disabled={deletingId === doc.id}
                            onClick={() => void deleteDocument(doc)}
                          >
                            <Trash2 size={15} />
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
      </section>

      {uploadOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !uploading
            ) {
              setUploadOpen(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(16,24,40,.52)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-upload-title"
            style={{
              width: "min(620px,100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 24px 64px rgba(16,24,40,.25)",
            }}
          >
            <header
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #eaecf0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div className="eyebrow">DOCUMENT MANAGEMENT</div>
                <h2
                  id="document-upload-title"
                  style={{ margin: "5px 0 0", fontSize: 22 }}
                >
                  Upload document
                </h2>
              </div>

              <button
                type="button"
                style={buttonStyle}
                disabled={uploading}
                onClick={() => setUploadOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>

            <form
              onSubmit={handleUpload}
              style={{ padding: 24, display: "grid", gap: 16 }}
            >
              <label style={labelStyle}>
                Choose file *

                <input
                  ref={fileRef}
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                  style={{ ...inputStyle, padding: 8 }}
                />

                <span
                  style={{
                    color: "#667085",
                    fontSize: 12,
                    fontWeight: 400,
                  }}
                >
                  PDF, images, Word, Excel, CSV or text. Maximum 20 MB.
                </span>
              </label>

              <label style={labelStyle}>
                Category *

                <select
                  style={inputStyle}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Description (optional)

                <textarea
                  style={{
                    ...inputStyle,
                    minHeight: 88,
                    resize: "vertical",
                  }}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add a short note about this document..."
                />
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 9,
                  paddingTop: 8,
                  borderTop: "1px solid #eaecf0",
                }}
              >
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={uploading}
                  onClick={() => setUploadOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || !selectedFile}
                >
                  <Upload size={15} />
                  {uploading ? "Uploading..." : "Upload document"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div
        style={{
          color: "#667085",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <ShieldCheck size={14} />
        Documents are stored in a private company folder. Download links
        expire after 60 seconds.
      </div>
    </div>
  );
}