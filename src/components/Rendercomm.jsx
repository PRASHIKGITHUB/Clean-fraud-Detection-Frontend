//Rendercomm.jsx
import React, { useState, useRef, useMemo } from "react";
import CommunityGraphs from "./communityGraphs";

const container = { maxWidth: 980, margin: "20px auto", fontFamily: "Inter, Roboto, system-ui, sans-serif" };
const btn = { padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "#1976d2", color: "#fff" };
const btnGhost = { padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer"};
const btn2 = { padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" , marginRight: 20};
const tableWrap = { border: "1px solid #eee", borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 18px rgba(20,20,20,0.04)" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "12px 16px", background: "#fafafa", fontSize: 14, borderBottom: "1px solid #f0f0f0" };
const td = { padding: "12px 16px", borderBottom: "1px solid #fafafa", fontSize: 14, verticalAlign: "top" };
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

export default function RenderComm({ base, endpoint, data, setData }) {
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef(null);

  const [page, setPage] = useState(1);
  const pageSize = 10; //  number of rows per page

  const [showCommModal, setShowCommModal] = useState(false);
  const [selectedCommId, setSelectedCommId] = useState("");

  const showToast = (msg, ms = 2500) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), ms);
  };

  const fetchCommunities = async () => {
    setLoading(true);
    setData([]);
    setPage(1); // reset to first page when fetching

    try {
      const url = `${base}${endpoint}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const json = await res.json();

      if (!json || !Array.isArray(json.results)) {
        throw new Error("Invalid response format — missing 'results' array");
      }

      setData(json.results);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      setSelectedCommId(text);
      await navigator.clipboard.writeText(text);
      showToast(`Copied: ${text}`);
      setShowCommModal(true);
    } catch (e) {
      showToast("Copy failed");
    }
  };

  // ✅ Get current batch of data
  const currentData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page]);

  const totalPages = Math.ceil(data.length / pageSize);



  return (
    <div style={container}>
        {showCommModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-4 rounded-lg w-[90%] max-w-3xl shadow-lg relative">

      <button
        onClick={() => setShowCommModal(false)}
        className="absolute right-3 top-3 text-black border px-2 rounded"
      >
        ✕
      </button>

        <CommunityGraphs selectedId={selectedCommId} />
        </div>
    </div>
    )}

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ marginBottom: 4 }}>Community Finder</h2>
        <div style={{ color: "#666", fontSize: 13 }}>
          Click "Fetch" to retrieve community IDs with sizes.
        </div>
      </div>

      <div>


      <button onClick={fetchCommunities} disabled={loading} style={btn} >
        {loading ? "Fetching…" : "Fetch"}
      </button>
      </div>


      <div style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          {data.length > 0
            ? `Showing ${currentData.length} of ${data.length} communities (Page ${page}/${totalPages})`
            : "No data yet. Fetch to view results."}
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>Community ID</th>
                <th style={th}>Operator</th>
                <th style={th}>Operated Refids</th>
                <th style={th}>Total Refids</th>
                <th style={th}>Percent Controlled</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...td, textAlign: "center", padding: 40 }}>
                    {loading ? "Loading…" : "No results"}
                  </td>
                </tr>
              ) : (
                currentData.map((row, i) => (
                  <tr key={row.communityId || i}>
                    <td style={td}>{(page - 1) * pageSize + i + 1}</td>
                    <td style={td}>{row.communityId}</td>
                    <td style={td}>{row.operator}</td>
                    <td style={td}>{row.operatedCount}</td>
                    <td style={td}>{row.totalRefids}</td>
                    <td style={td}>{row.percentControlled}</td>
                    <td style={td}>
                      <button onClick={() => copyToClipboard(row.communityId)} style={btnGhost}>
                        Load Graph
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ Pagination Controls */}
        {data.length > pageSize && (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              style={{ ...btnGhost, opacity: page === 1 ? 0.6 : 1 }}
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              style={{ ...btnGhost, opacity: page === totalPages ? 0.6 : 1 }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      <div
        style={{
          ...toastDiv,
          transform: toastVisible ? "translateY(0)" : "translateY(150%)",
        }}
      >
        {toastMsg}
      </div>
    </div>
  );
}
