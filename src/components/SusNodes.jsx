import React, { useState, useEffect, useMemo, useRef } from "react";

// Using inline styles for simplicity
const container = { maxWidth: 980, margin: "20px auto", fontFamily: "Inter, Roboto, system-ui, sans-serif" };
const toolbar = { display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" };
const input = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 120 };
const btn = { padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#1976d2", color: "#fff" };
const btnGhost = { padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" };
const tableWrap = { border: "1px solid #eee", borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 18px rgba(20,20,20,0.04)" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "12px 16px", background: "#fafafa", fontSize: 14, borderBottom: "1px solid #f0f0f0" };
const td = { padding: "12px 16px", borderBottom: "1px solid #fafafa", fontSize: 14, verticalAlign: "top" };
const small = { fontSize: 12, color: "#666" };

const toastDiv = {
  position: "fixed",
  bottom: "20px",
  right: "20px",
  padding: "12px 20px",
  borderRadius: "8px",
  background: "#333",
  color: "#fff",
  transition: "transform 0.3s ease-in-out",
  transform: "translateY(150%)",
  zIndex: 1000,
};

export default function CompDegreeTable({ base, endpoint}) {
  const [min, setMin] = useState(4);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Toast state
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef(null);

  const showToast = (msg, ms = 3000) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      toastTimerRef.current = null;
    }, ms);
  };

  const fetchData = async (minValue) => {
    setError(null);
    setLoading(true);
    setData([]);
    try {
      if (!base) {
        throw new Error("Base URL not provided.");
      }
      const url = `${base.replace(/\/$/, "")}${endpoint}?min=${encodeURIComponent(minValue)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error("API did not return an array");
      setData(json);
      setPage(1);
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      showToast(`Error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(min);
  }, [base, endpoint]);

  const processed = useMemo(() => {
    let arr = Array.isArray(data) ? data.slice() : [];

    // Filter by search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((r) =>
        (r.node_id || "").toLowerCase().includes(q) ||
        String(r.indegree).includes(q) ||
        (Array.isArray(r.common_properties) && r.common_properties.join(",").toLowerCase().includes(q))
      );
    }

    // Static sort by indegree descending
    arr.sort((a, b) => b.indegree - a.indegree);

    return arr;
  }, [data, search]);

  const total = processed.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageData = processed.slice((page - 1) * pageSize, page * pageSize);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied: ${text}`);
    } catch (e) {
      console.warn("Clipboard failed", e);
      showToast("Copy failed");
    }
  };

  const exportCSV = () => {
    if (!Array.isArray(processed) || processed.length === 0) {
      showToast("No data to export");
      return;
    }
    const rows = [
      ["indegree", "node_id", "common_properties"],
      ...processed.map((r) => [
        r.indegree,
        r.node_id,
        (r.common_properties || []).join(", "),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compdegree_min${min}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Component indegree leaderboard</div>
          <div style={{ color: "#666", fontSize: 13 }}>Query nodes with indegree ≥ min and view results.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="number"
            min={0}
            value={min}
            onChange={(e) => setMin(Number(e.target.value))}
            style={input}
            aria-label="min"
            onKeyDown={(e) => {if(e.key === 'Enter') fetchData(min)}}
          />
          <button onClick={() => fetchData(min)} disabled={loading} style={btn}>
            {loading ? "Loading…" : "Fetch"}
          </button>
          <button onClick={exportCSV} style={btnGhost}>Export CSV</button>
        </div>
      </div>

      <div style={toolbar}>
        <input
          placeholder="Search node id"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ ...input, width: 300 }}
        />
        <div style={small}>Showing {total} result{total !== 1 ? "s" : ""}</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={small}>Page size</div>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: 6, borderRadius: 6 }}>
            {[5, 10, 20, 50].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Rank</th>
              <th style={th}>Node ID</th>
              <th style={th}>Indegree</th>
              <th style={th}>Common Properties</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...td, textAlign: "center", padding: 40 }}>
                  {loading ? "Loading…" : error ? <span style={{ color: "#b00020" }}>{error}</span> : "No results"}
                </td>
              </tr>
            ) : (
              pageData.map((r, idx) => (
                <tr key={r.node_id}>
                  <td style={td}>{(page - 1) * pageSize + idx + 1}</td>
                  <td style={td}><div style={{ fontWeight: 600 }}>{r.node_id}</div></td>
                  <td style={td}><div style={{ fontWeight: 700 }}>{r.indegree}</div></td>
                  <td style={td}>
                    <div style={{ fontSize: 13, color: "#333" }}>
                      {((r.common_properties?.length > 0) ? (r.common_properties.join(", ")) : "N/A")}
                    </div>
                  </td>
                  <td style={td}>
                    <button onClick={() => copyToClipboard(r.node_id)} style={btnGhost}>Copy ID</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, alignItems: "center" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={btnGhost}>
            Previous
          </button>
          <div style={small}>Page {page} of {pages}</div>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={btnGhost}>
            Next
          </button>
        </div>
      )}

      {/* Manual Toast implementation */}
      <div style={{ ...toastDiv, transform: toastVisible ? "translateY(0)" : "translateY(150%)" }}>
        {toastMsg}
      </div>
    </div>
  );
}
