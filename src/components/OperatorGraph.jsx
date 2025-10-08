// UIDOperatorGraph.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { DataSet, Network } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";

/**
 * Props:
 *  - base (string) : base url of API
 *  - endpoint (string) : endpoint path (default "/uidoperatorchains")
 *  - height (number|string) : graph container height
 */
export default function UIDOperatorGraph({
  base = "http://localhost:8080",
  endpoint = "/sameop",
  height = 720,
}) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // raw api result arrays
  const [apiNodes, setApiNodes] = useState([]); // [{ node_id, labels }]
  const [apiRels, setApiRels] = useState([]); // [{ start_node_id, end_node_id, type }]

  // UI state
  const [previewCounts, setPreviewCounts] = useState({ nodes: 0, edges: 0 });
  const [selectedNode, setSelectedNode] = useState(null);

  const fetchGraph = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const url = `${base.replace(/\/$/, "")}${endpoint}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      const json = await res.json();

      // defensive parsing
      const nodes = Array.isArray(json.nodes) ? json.nodes : [];
      const rels = Array.isArray(json.relationships) ? json.relationships : [];

      setApiNodes(nodes.map((n) => ({ node_id: n.node_id ?? n.id ?? (n.props && n.props.id) ?? String(n.node_id), labels: n.labels ?? [] })));
      setApiRels(rels.map((r, i) => ({
        id: r.id ?? `r-${i}-${r.start_node_id ?? r.start}-${r.end_node_id ?? r.end}`,
        start: r.start_node_id ?? r.start,
        end: r.end_node_id ?? r.end,
        type: r.type ?? r.label ?? "",
        raw: r,
      })));
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      setApiNodes([]);
      setApiRels([]);
    } finally {
      setLoading(false);
    }
  }, [base, endpoint]);

  // initial fetch on mount
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // build and render graph when apiNodes/apiRels change
  useEffect(() => {
    if (!containerRef.current) return;

    // categorize nodes
    const operators = [];
    const uids = [];
    const persons = [];
    const others = [];

    for (const n of apiNodes) {
      const id = String(n.node_id);
      const labelsLower = (n.labels || []).map((l) => (l || "").toString().toLowerCase());
      if (labelsLower.some((l) => l.includes("operator"))) operators.push({ id, labels: n.labels });
      else if (labelsLower.some((l) => l.includes("uid"))) uids.push({ id, labels: n.labels });
      else if (labelsLower.some((l) => l.includes("person"))) persons.push({ id, labels: n.labels });
      else others.push({ id, labels: n.labels });
    }

    // layout positions
    const layerX = { left: -360, left2: -200, center: 0, right: 360 };
    const spacingY = 80;

    const positioned = new Map();

    // operators column (left)
    operators.forEach((node, idx) => {
      positioned.set(node.id, {
        id: node.id,
        label: node.id,
        title: `ID: ${node.id}\nLabels: ${node.labels.join(", ")}`,
        x: layerX.left,
        y: idx * spacingY - ((operators.length - 1) * spacingY) / 2,
        shape: "dot",
        value: 26,
        group: "operator",
      });
    });

    // uids column (left2)
    uids.forEach((node, idx) => {
      positioned.set(node.id, {
        id: node.id,
        label: node.id,
        title: `ID: ${node.id}\nLabels: ${node.labels.join(", ")}`,
        x: layerX.left2,
        y: idx * spacingY - ((uids.length - 1) * spacingY) / 2,
        shape: "dot",
        value: 22,
        group: "uid",
      });
    });

    // persons center column
    persons.forEach((node, idx) => {
      positioned.set(node.id, {
        id: node.id,
        label: node.id,
        title: `ID: ${node.id}\nLabels: ${node.labels.join(", ")}`,
        x: layerX.center,
        y: idx * spacingY - ((persons.length - 1) * spacingY) / 2,
        shape: "dot",
        value: 24,
        group: "person",
      });
    });

    // others right column
    others.forEach((node, idx) => {
      positioned.set(node.id, {
        id: node.id,
        label: node.id,
        title: `ID: ${node.id}\nLabels: ${node.labels.join(", ")}`,
        x: layerX.right,
        y: idx * spacingY - ((others.length - 1) * spacingY) / 2,
        shape: "dot",
        value: 18,
        group: "other",
      });
    });

    // edges
    const edgesArr = apiRels
      .map((r) => ({
        id: r.id,
        from: String(r.start),
        to: String(r.end),
        label: r.type || "",
        arrows: "to",
        title: r.type || "",
      }))
      // only include edges whose nodes exist in positioned (defensive)
      .filter((e) => positioned.has(e.from) && positioned.has(e.to));

    setPreviewCounts({ nodes: positioned.size, edges: edgesArr.length });

    const nodesDS = new DataSet(Array.from(positioned.values()));
    const edgesDS = new DataSet(edgesArr);
    const data = { nodes: nodesDS, edges: edgesDS };

    const options = {
      physics: {
        enabled: true,
        stabilization: { enabled: true, iterations: 600, updateInterval: 50 },
        barnesHut: { gravitationalConstant: -2000, springLength: 150, springConstant: 0.04, avoidOverlap: 0.5 },
      },
      nodes: { font: { multi: true }, scaling: { min: 8, max: 56 } },
      edges: { smooth: { type: "continuous" }, color: { color: "#888", highlight: "#ff4500" } },
      interaction: { hover: true, tooltipDelay: 100, navigationButtons: true, dragNodes: true },
      groups: {
        operator: { color: { background: "#ffd1a4", border: "#c06" } },
        uid: { color: { background: "#cfe9ff", border: "#06c" } },
        person: { color: { background: "#e6ffe6", border: "#0a0" } },
        other: { color: { background: "#eee", border: "#777" } },
      },
    };

    // destroy prev
    if (networkRef.current) {
      try {
        networkRef.current.destroy();
      } catch (e) {}
      networkRef.current = null;
    }

    networkRef.current = new Network(containerRef.current, data, options);

    // tidy then disable physics so dragging doesn't nudge others
    networkRef.current.once("stabilizationIterationsDone", () => {
      try {
        networkRef.current.setOptions({ physics: { enabled: false } });
        networkRef.current.fit({ animation: { duration: 300 } });
      } catch (e) {}
    });

    // selection handler
    const onSelect = (params) => {
      if (params.nodes && params.nodes.length) {
        const nid = params.nodes[0];
        const n = nodesDS.get(nid);
        // use labels from group if available (fallback)
        const labels = n && n.group ? [n.group] : [];
        setSelectedNode({ id: nid, labels });
      } else {
        setSelectedNode(null);
      }
    };

    // drag end: no auto-fix, allow repeated drags
    const onDragEnd = () => {
      // nothing — vis updates positions in the dataset automatically
    };

    // double click on background to re-layout briefly
    const onDoubleClick = (params) => {
      if (!params.nodes || params.nodes.length === 0) {
        networkRef.current.setOptions({ physics: { enabled: true } });
        networkRef.current.once("stabilizationIterationsDone", () => {
          try {
            networkRef.current.setOptions({ physics: { enabled: false } });
          } catch (e) {}
        });
      }
    };

    networkRef.current.on("select", onSelect);
    networkRef.current.on("dragEnd", onDragEnd);
    networkRef.current.on("doubleClick", onDoubleClick);

    return () => {
      if (networkRef.current) {
        try {
          networkRef.current.off("select", onSelect);
          networkRef.current.off("dragEnd", onDragEnd);
          networkRef.current.off("doubleClick", onDoubleClick);
          networkRef.current.destroy();
        } catch (e) {}
        networkRef.current = null;
      }
    };
  }, [apiNodes, apiRels]);

  // simple UI & controls
  const refresh = () => fetchGraph();

  const toolbarStyle = { display: "flex", gap: 8, marginBottom: 12, alignItems: "center", justifyContent: "space-between" };
  const btn = { padding: "8px 12px", borderRadius: 8, border: "none", background: "#1976d2", color: "#fff", cursor: "pointer" };
  const small = { fontSize: 13, color: "#666" };

  const selectionBox = {
    position: "absolute",
    right: 12,
    top:70,
    padding: "8px 12px",
    background: "#ffffffcc",
    border: "1px solid #ddd",
    borderRadius: 8,
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
    zIndex: 10,
    minWidth: 220,
  };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <div style={toolbarStyle}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>UID - Operator Chains</div>
          <div style={small}>Shows UID ← Operator ← Person -MATCHES→ Person → UID chains.</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={refresh} style={btn}>{loading ? "Loading…" : "Refresh"}</button>
          <div style={{ marginLeft: 8, color: error ? "#b00020" : "#666" }}>{error ? error : `nodes: ${previewCounts.nodes} • edges: ${previewCounts.edges}`}</div>
        </div>
      </div>

      {/* selection box */}
      <div style={selectionBox}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Selection</div>
        {selectedNode ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedNode.id}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{(selectedNode.labels || []).join(", ")}</div>
          </div>
        ) : (
          <div style={{ color: "#666", fontSize: 13 }}>No node selected</div>
        )}
      </div>

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
