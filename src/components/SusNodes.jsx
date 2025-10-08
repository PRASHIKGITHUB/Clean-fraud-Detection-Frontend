// CompDegreeTable.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";

/**
 * Props:
 *  - base (string) : base url of API (default http://localhost:8080)
 *  - endpoint (string) : endpoint path (default /compdegree)
 */
export default function CompDegreeTable({ base = "http://localhost:8080", endpoint = "/compdegree" }) {
  const [min, setMin] = useState(4);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // table state
  const [sortBy, setSortBy] = useState({ key: "indegree", desc: true });
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // toast state for copy-to-clipboard feedback
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef(null);

  const fetchData = async (minValue) => {
    setError(null);
    setLoading(true);
    setData([]);
    try {
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
    } finally {
      setLoading(false);
    }
  };

  // initial fetch with default min on mount
  useEffect(() => {
    fetchData(min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derived filtered + sorted data
  const processed = useMemo(() => {
    let arr = Array.isArray(data) ? data.slice() : [];

    // filter by search (node_id or indegree)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((r) => (r.node_id || "").toLowerCase().includes(q) || String(r.indegree).includes(q));
    }

    // sort
    arr.sort((a, b) => {
      const av = a[sortBy.key];
      const bv = b[sortBy.key];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortBy.desc ? (bv > av ? 1 : -1) : av > bv ? 1 : -1;
    });

    return arr;
  }, [data, search, sortBy]);

  const total = processed.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageData = processed.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key) => {
    setSortBy((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
  };

  // toast helper
  const showToast = (msg, ms = 3000) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
      toastTimerRef.current = null;
    }, ms);
  };

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
    if (!Array.isArray(processed) || processed.length === 0) return;
    const rows = [["indegree", "node_id"], ...processed.map((r) => [r.indegree, r.node_id])];
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

  // UI styles
  const container = { maxWidth: 980, margin: "20px auto", fontFamily: "Inter, Roboto, system-ui, sans-serif" };
  const toolbar = { display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" };
  const input = { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", width: 120 };
  const btn = { padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#1976d2", color: "#fff" };
  const btnGhost = { padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" };
  const tableWrap = { border: "1px solid #eee", borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 18px rgba(20,20,20,0.04)" };
  const table = { width: "100%", borderCollapse: "collapse" };
  const th = { textAlign: "left", padding: "12px 16px", background: "#fafafa", fontSize: 14, borderBottom: "1px solid #f0f0f0", cursor: "pointer" };
  const td = { padding: "12px 16px", borderBottom: "1px solid #fafafa", fontSize: 14 };
  const small = { fontSize: 12, color: "#666" };

  return (
    <div style={container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Component indegree leaderboard</div>
          <div style={{ color: "#666", fontSize: 13 }}>Query nodes with indegree ≥ min and view results.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              min={0}
              value={min}
              onChange={(e) => setMin(Number(e.target.value))}
              style={input}
              aria-label="min"
            />
            <button
              onClick={() => fetchData(min)}
              disabled={loading}
              style={btn}
            >
              {loading ? "Loading…" : "Fetch"}
            </button>
            <button onClick={exportCSV} style={btnGhost}>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div style={toolbar}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input placeholder="Search node id or indegree" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...input, width: 300 }} />
          <div style={small}>Showing {total} result{total !== 1 ? "s" : ""}</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={small}>Page size</div>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: 6, borderRadius: 6 }}>
            {[5,10,20,50].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th} onClick={() => toggleSort("indegree")}>
                Rank &nbsp; <span style={small}>{sortBy.key === "indegree" ? (sortBy.desc ? "↓" : "↑") : ""}</span>
              </th>
              <th style={th} onClick={() => toggleSort("node_id")}>
                Node ID &nbsp; <span style={small}>{sortBy.key === "node_id" ? (sortBy.desc ? "↓" : "↑") : ""}</span>
              </th>
              <th style={th} onClick={() => toggleSort("indegree")}>
                Indegree &nbsp; <span style={small}>{sortBy.key === "indegree" ? (sortBy.desc ? "↓" : "↑") : ""}</span>
              </th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...td, textAlign: "center", padding: 40 }}>
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
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => copyToClipboard(r.node_id)}
                        style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                      >
                        Copy ID
                      </button>
                      {/* <a
                        href={`#node-${encodeURIComponent(r.node_id)}`}
                        onClick={(e) => e.preventDefault()}
                        style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #1976d2", background: "#1976d2", color: "#fff", textDecoration: "none", display: "inline-block" }}
                      >
                        View
                      </a> */}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ color: "#666", fontSize: 13 }}>
          Page {page} of {pages}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={btnGhost}>First</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={btnGhost}>Prev</button>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} style={btnGhost}>Next</button>
          <button onClick={() => setPage(pages)} disabled={page === pages} style={btnGhost}>Last</button>
        </div>
      </div>

      {/* toast popup */}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            transform: toastVisible ? "translateY(0)" : "translateY(12px)",
            opacity: toastVisible ? 1 : 0,
            transition: "all 220ms ease",
            background: "rgba(34,34,34,0.95)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
            minWidth: 160,
            pointerEvents: "auto",
            fontSize: 13,
          }}
        >
          {toastMsg}
        </div>
      </div>
    </div>
  );
}
