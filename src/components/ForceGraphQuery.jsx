// ForceGraphQuery.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { DataSet, Network } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";

export default function ForceGraphQuery({
  base,
  endpoint1,
  endpoint2,
  height = 720,
}) {
  // Simple color palette by label type
  const labelColorMap = {
    UID: "#3498db",
    Refid: "#f39c12",
    Operator: "#27ae60",
    Location: "#e74c3c",
    Machine: "#34495e",
    Device: "#f1c40f",
    Station: "#95a5a6",
    default: "#999",
  };

  const containerRef = useRef(null);
  const networkRef = useRef(null);

  const [currId, setcurrId] = useState("communityid");
  const [refid, setRefid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [previewCounts, setPreviewCounts] = useState({ nodes: 0, edges: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [magicFilter, setMagicFilter] = useState(false);

  // Fetch data
  const fetchGraph = useCallback(
    async (id) => {
      setError(null);
      setLoading(true);
      try {
        if (!id) {
          setError("Please enter an id.");
          setNodes([]);
          setRelationships([]);
          return;
        }
        const baseClean = base.replace(/\/$/, "");
        let url =
          currId === "refid"
            ? `${baseClean}${endpoint1}?refid=${encodeURIComponent(id)}`
            : `${baseClean}${endpoint2}?id=${encodeURIComponent(id)}`;

        const res = await fetch(url);
        if (!res.ok)
          throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        const json = await res.json();

        const apiNodes = Array.isArray(json.nodes)
          ? json.nodes
          : Array.isArray(json.incoming)
          ? json.incoming
          : [];
        const apiRels = Array.isArray(json.relationships)
          ? json.relationships
          : [];

        setNodes(
          apiNodes.map((n) => ({
            node_id: n.node_id ?? n.id ?? n.props?.id ?? n.id,
            labels: n.labels ?? [],
          }))
        );
        setRelationships(
          apiRels.map((r, i) => ({
            id:
              r.id ??
              `r-${i}-${r.start_node_id ?? r.from}-${r.end_node_id ?? r.to}`,
            start: r.start_node_id ?? r.from ?? r.start_id,
            end: r.end_node_id ?? r.to ?? r.end_id,
            type: r.type ?? r.label ?? "",
          }))
        );
      } catch (err) {
        console.error(err);
        setError(err.message || String(err));
        setNodes([]);
        setRelationships([]);
      } finally {
        setLoading(false);
      }
    },
    [base, endpoint1, endpoint2, currId]
  );

  const toggleMagic = () => setMagicFilter((s) => !s);

  useEffect(() => {
    if (!containerRef.current) return;

    // Compute degree map for magic filter
    const degMap = new Map();
    for (const r of relationships) {
      const s = String(r.start);
      const e = String(r.end);
      degMap.set(s, (degMap.get(s) || 0) + 1);
      degMap.set(e, (degMap.get(e) || 0) + 1);
    }

    // Filter nodes based on magic filter
    let filteredNodes = nodes;
    if (magicFilter) {
      const toRemove = new Set();
      for (const n of nodes) {
        const degree = degMap.get(String(n.node_id)) || 0;
        const labels = (n.labels || []).map((l) => l.toLowerCase());
        if (
          degree === 1 &&
          (labels.includes("operator") || labels.includes("uid"))
        ) {
          toRemove.add(String(n.node_id));
        }
      }
      filteredNodes = nodes.filter((n) => !toRemove.has(String(n.node_id)));
    }

    // Build vis nodes
    const visNodes = filteredNodes.map((node) => {
      const labelKey =
        node.labels.find((l) => labelColorMap[l]) ?? "default";
      return {
        id: String(node.node_id),
        label: String(node.labels),
        title: `ID: ${node.node_id}\nLabels: ${node.labels.join(", ")}`,
        shape: "dot",
        color: {
          background: labelColorMap[labelKey] || labelColorMap.default,
          border: "#333",
        },
        value: 20,
      };
    });

    // Build vis edges
    const visEdges = relationships
      .filter(
        (r) =>
          filteredNodes.some((n) => String(n.node_id) === String(r.start)) &&
          filteredNodes.some((n) => String(n.node_id) === String(r.end))
      )
      .map((r) => ({
        id: r.id,
        from: String(r.start),
        to: String(r.end),
        label: r.type || "",
        arrows: "to",
        title: r.type || "",
      }));

    setPreviewCounts({ nodes: visNodes.length, edges: visEdges.length });

    const data = { nodes: new DataSet(visNodes), edges: new DataSet(visEdges) };

    const options = {
      physics: {
        enabled: false,
        barnesHut: {
          gravitationalConstant: -2000,
          springLength: 150,
          springConstant: 0.04,
          avoidOverlap: 0.5,
        },
      },
      nodes: {
        shape: "dot",
        scaling: { min: 8, max: 48 },
        font: { color: "#333" },
      },
      edges: {
        color: { color: "#888", highlight: "#ff4500" },
        smooth: { type: "continuous" },
        arrows: "to",
      },
      interaction: { hover: true, tooltipDelay: 100, navigationButtons: true },
    };

    // Destroy previous network
    if (networkRef.current) {
      try {
        networkRef.current.destroy();
      } catch {}
      networkRef.current = null;
    }

    // Create new vis network
    networkRef.current = new Network(containerRef.current, data, options);

    // Selection and interactions
    networkRef.current.on("select", (params) => {
      if (params.nodes?.length) {
        const nid = params.nodes[0];
        const node = data.nodes.get(nid);
        setSelectedNode({
          id: nid,
          labels: node
            ? node.title.match(/Labels: (.*)/)?.[1]?.split(", ")
            : [],
        });
      } else {
        setSelectedNode(null);
      }
    });

    networkRef.current.on("doubleClick", (params) => {
      if (!params.nodes?.length) {
        networkRef.current.setOptions({ physics: { enabled: true } });
        networkRef.current.once("stabilizationIterationsDone", () => {
          networkRef.current.setOptions({ physics: { enabled: false } });
        });
      }
    });

    return () => {
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch {}
        networkRef.current = null;
      }
    };
  }, [nodes, relationships, magicFilter]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    await fetchGraph(refid.trim());
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit(e);
  };

  const toggleId = () => {
    setcurrId((prev) => (prev === "refid" ? "communityid" : "refid"));
  };

  // Styles
  const toolbarStyle = {
    display: "flex",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
  };
  const inputStyle = {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #e0e0e0",
    width: 380,
    fontSize: 14,
  };
  const btnPrimary = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: "#1976d2",
    color: "#fff",
  };
  const btnMagic = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    background: magicFilter ? "#ffa726" : "#ddd",
    color: magicFilter ? "#fff" : "#222",
  };
  const infoStyle = {
    marginLeft: "auto",
    color: error ? "#b00020" : "#666",
    fontSize: 13,
  };
  const selectionBox = {
    position: "absolute",
    right: 12,
    top: 80,
    padding: "8px 12px",
    background: "#ffffffcc",
    border: "1px solid #ddd",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
    zIndex: 10,
    minWidth: 220,
  };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <div style={toolbarStyle}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Refid graph</div>
        <input
          placeholder="Enter Refid/refid id"
          value={refid}
          onChange={(e) => setRefid(e.target.value)}
          onKeyDown={onKeyDown}
          style={inputStyle}
        />
        <button onClick={toggleId} style={btnPrimary}>
          {currId}
        </button>
        <button onClick={handleSubmit} disabled={loading} style={btnPrimary}>
          {loading ? "Loading…" : "Fetch"}
        </button>
        <button onClick={toggleMagic} style={btnMagic}>
          Magic
        </button>
        <div style={infoStyle}>
          {error
            ? error
            : `nodes: ${previewCounts.nodes} • edges: ${previewCounts.edges}`}
        </div>
      </div>

      {/* Selection box */}
      <div style={selectionBox}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Selection</div>
        {selectedNode ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {selectedNode.id}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {(selectedNode.labels || []).join(", ")}
            </div>
          </div>
        ) : (
          <div style={{ color: "#666", fontSize: 13 }}>No node selected</div>
        )}
      </div>

      {/* Network container */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: typeof height === "number" ? `${height}px` : height,
          border: "1px solid #eaeaea",
          borderRadius: 8,
          background: "#fff",
        }}
      />
    </div>
  );
}
