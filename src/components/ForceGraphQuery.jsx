// ForceGraphQuery.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { DataSet, Network } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";

/**
 * Props:
 *  - base (string) : base url of API
 *  - endpoint (string) : path to query
 *  - height (number|string) : graph container height
 */
export default function ForceGraphQuery({
  base = "http://localhost:8080",
  endpoint = "/refsimilar",
  height = 720,
}) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  const [refid, setRefid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [nodes, setNodes] = useState([]); // expected: [{ node_id, labels }]
  const [relationships, setRelationships] = useState([]); // expected: [{ start_node_id, end_node_id, type }]

  const [previewCounts, setPreviewCounts] = useState({ nodes: 0, edges: 0 });
  const [selectedNode, setSelectedNode] = useState(null); // { id, labels }

  // NEW: magic filter flag
  const [magicFilter, setMagicFilter] = useState(false);

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
        const url = `${baseClean}${endpoint}?refid=${encodeURIComponent(id)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        const json = await res.json();

        const apiNodes = Array.isArray(json.nodes) ? json.nodes : Array.isArray(json.incoming) ? json.incoming : [];
        const apiRels = Array.isArray(json.relationships) ? json.relationships : [];

        setNodes(apiNodes.map((n) => ({ node_id: n.node_id ?? n.id ?? n.props?.id ?? n.id, labels: n.labels ?? [] })));
        setRelationships(
          apiRels.map((r, i) => ({
            id: r.id ?? `r-${i}-${r.start_node_id ?? r.from}-${r.end_node_id ?? r.to}`,
            start: r.start_node_id ?? r.from,
            end: r.end_node_id ?? r.to,
            type: r.type ?? r.label ?? "",
            raw: r,
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
    [base, endpoint]
  );

  // toggle magic filter
  const toggleMagic = () => setMagicFilter((s) => !s);

  // Build vis nodes/edges, compute layered positions and mount network whenever nodes/relationships or magicFilter change
  useEffect(() => {
    if (!containerRef.current) return;

    // first, create a simple degree map from relationships (counts occurrences as start or end)
    const degMap = new Map();
    for (const r of relationships) {
      const s = String(r.start);
      const e = String(r.end);
      degMap.set(s, (degMap.get(s) || 0) + 1);
      degMap.set(e, (degMap.get(e) || 0) + 1);
    }

    // categorize nodes into groups (but apply magic filter later)
    const ops = [];
    const uids = [];
    const persons = [];
    const others = [];

    for (const n of nodes) {
      const id = String(n.node_id);
      const labelsLower = (n.labels || []).map((l) => (l || "").toString().toLowerCase());
      if (labelsLower.some((l) => l.includes("operator"))) ops.push({ id, labels: n.labels });
      else if (labelsLower.some((l) => l.includes("uid"))) uids.push({ id, labels: n.labels });
      else if (labelsLower.some((l) => l.includes("person"))) persons.push({ id, labels: n.labels });
      else others.push({ id, labels: n.labels });
    }

    // If magicFilter is enabled, remove UID/Operator nodes that have exactly 1 relation
    const removedNodeIds = new Set();
    if (magicFilter) {
      for (const op of ops) {
        if ((degMap.get(op.id) || 0) === 1) removedNodeIds.add(op.id);
      }
      for (const u of uids) {
        if ((degMap.get(u.id) || 0) === 1) removedNodeIds.add(u.id);
      }
    }

    // layout params
    const layerX = {
      left: -320, // layer -1 (uids + operators)
      center: 0, // layer -2 (persons)
      right: 320, // layer 3 (others)
    };
    const spacingY = 80;

    // build positioned node map while skipping removed nodes
    const positioned = new Map();

    // Operators: vertical line at left X
    const filteredOps = ops.filter((n) => !removedNodeIds.has(n.id));
    filteredOps.forEach((node, idx) => {
      positioned.set(node.id, {
        id: node.id,
        label: node.id,
        title: `ID: ${node.id}\nLabels: ${node.labels.join(", ")}`,
        x: layerX.left,
        y: idx * spacingY - ((filteredOps.length - 1) * spacingY) / 2,
        shape: "dot",
        value: 24,
        group: "operator",
      });
    });

    // UIDs: place slightly right to operators but still in same left-layer band
    const filteredUids = uids.filter((n) => !removedNodeIds.has(n.id));
    filteredUids.forEach((node, idx) => {
      positioned.set(node.id, {
        id: node.id,
        label: node.id,
        title: `ID: ${node.id}\nLabels: ${node.labels.join(", ")}`,
        x: layerX.left + 120,
        y: idx * spacingY - ((filteredUids.length - 1) * spacingY) / 2,
        shape: "dot",
        value: 20,
        group: "uid",
      });
    });

    // Persons: center column (do not remove persons)
    persons.forEach((node, idx) => {
      positioned.set(node.id, {
        id: node.id,
        label: node.id,
        title: `ID: ${node.id}\nLabels: ${node.labels.join(", ")}`,
        x: layerX.center,
        y: idx * spacingY - ((persons.length - 1) * spacingY) / 2,
        shape: "dot",
        value: 22,
        group: "person",
      });
    });

    // Others: right column (do not remove)
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

    // create edges — skip edges touching removed nodes
    const edgesArr = relationships
      .filter((r) => {
        const s = String(r.start);
        const e = String(r.end);
        if (removedNodeIds.has(s) || removedNodeIds.has(e)) return false;
        return true;
      })
      .map((r) => ({
        id: r.id,
        from: String(r.start),
        to: String(r.end),
        label: r.type || "",
        arrows: "to",
        title: r.type || "",
      }));

    // preview counts
    setPreviewCounts({ nodes: positioned.size, edges: edgesArr.length });

    // create DataSets with positions applied
    const nodesDS = new DataSet(Array.from(positioned.values()));
    const edgesDS = new DataSet(edgesArr);
    const data = { nodes: nodesDS, edges: edgesDS };

    const options = {
      physics: {
        enabled: true,
        stabilization: { enabled: true, iterations: 500, updateInterval: 25 },
        barnesHut: { gravitationalConstant: -2000, springLength: 150, springConstant: 0.04, avoidOverlap: 0.5 },
      },
      nodes: { font: { multi: true }, scaling: { min: 8, max: 48 } },
      edges: { smooth: { type: "continuous" }, color: { color: "#888", highlight: "#ff4500" } },
      interaction: { hover: true, tooltipDelay: 100, navigationButtons: true, dragNodes: true },
      groups: {
        operator: { color: { background: "#ffd1a4", border: "#c06" } },
        uid: { color: { background: "#cfe9ff", border: "#06c" } },
        person: { color: { background: "#e6ffe6", border: "#0a0" } },
        other: { color: { background: "#eee", border: "#777" } },
      },
    };

    // destroy previous network if present
    if (networkRef.current) {
      try {
        networkRef.current.destroy();
      } catch (e) {
        // ignore
      }
      networkRef.current = null;
    }

    networkRef.current = new Network(containerRef.current, data, options);

    // after stabilization, disable physics so nodes remain where placed
    networkRef.current.once("stabilizationIterationsDone", () => {
      try {
        networkRef.current.setOptions({ physics: { enabled: false } });
        networkRef.current.fit({ animation: { duration: 300 } });
      } catch (e) {}
    });

    // selection handler: update info box
    const onSelect = (params) => {
      if (params.nodes && params.nodes.length) {
        const nid = params.nodes[0];
        const n = nodesDS.get(nid);
        setSelectedNode({ id: nid, labels: (n.group ? [n.group] : []) });
      } else {
        setSelectedNode(null);
      }
    };

    // drag end: positions are updated automatically in vis DS; nothing to fix
    const onDragEnd = (/*params*/) => {};

    // double click background to re-enable physics briefly for re-layout
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
  }, [nodes, relationships, magicFilter]);

  // UI handlers
  const handleSubmit = async (e) => {
    e?.preventDefault();
    await fetchGraph(refid.trim());
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit(e);
  };

  // styles
  const toolbarStyle = { display: "flex", gap: 8, marginBottom: 12, alignItems: "center", padding: 8, borderRadius: 8 };
  const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1px solid #e0e0e0", width: 380, fontSize: 14 };
  const btnPrimary = { padding: "8px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: "#1976d2", color: "#fff" };
  const btnMagic = { padding: "8px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: magicFilter ? "#ffa726" : "#ddd", color: magicFilter ? "#fff" : "#222" };
  const infoStyle = { marginLeft: "auto", color: error ? "#b00020" : "#666", fontSize: 13 };

  // top-right selection box
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
          placeholder="Enter person/refid id"
          value={refid}
          onChange={(e) => setRefid(e.target.value)}
          onKeyDown={onKeyDown}
          style={inputStyle}
        />
        <button onClick={handleSubmit} disabled={loading} style={btnPrimary}>
          {loading ? "Loading…" : "Fetch"}
        </button>

        {/* Magic filter button */}
        <button onClick={toggleMagic} style={btnMagic}>
           Magic
        </button>

        <div style={infoStyle}>{error ? error : `nodes: ${previewCounts.nodes} • edges: ${previewCounts.edges}`}</div>
      </div>

      {/* selection info box */}
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
