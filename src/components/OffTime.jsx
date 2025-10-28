import React, { useEffect, useRef, useState, useCallback } from "react";
import { DataSet, Network } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";

export default function OffTime({
  base,
  endpoint,
  height = 720,
}) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // raw api result arrays
  const [apiNodes, setApiNodes] = useState([]);
  const [apiRels, setApiRels] = useState([]);

  // UI state
  const [previewCounts, setPreviewCounts] = useState({ nodes: 0, edges: 0 });
  const [selectedNode, setSelectedNode] = useState(null);

  // degree filter (default = 3)
  const [degree, setDegree] = useState(3);

  // fetch graph data
  const fetchGraph = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const cleanBase = base.replace(/\/$/, "");
      const url = `${cleanBase}${endpoint}?degree=${encodeURIComponent(degree)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);

      const json = await res.json();
      console.log("API response:", json);

      const nodes = Array.isArray(json.nodes) ? json.nodes : [];
      const rels = Array.isArray(json.relationships) ? json.relationships : [];

      setApiNodes(
        nodes.map((n) => ({
          node_id: n.node_id ?? n.id ?? String(n.node_id),
          labels: n.labels ?? [],
        }))
      );

      setApiRels(
        rels.map((r, i) => ({
          id: r.id ?? `r-${i}-${r.start_node_id ?? r.start}-${r.end_node_id ?? r.end}`,
          start: r.start_node_id ?? r.start,
          end: r.end_node_id ?? r.end,
          type: r.type ?? r.label ?? "",
          raw: r,
        }))
      );
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      setApiNodes([]);
      setApiRels([]);
    } finally {
      setLoading(false);
    }
  }, [base, endpoint, degree]);

  // fetch on mount and whenever degree changes
  useEffect(() => {
    fetchGraph();
  }, []);

  // build graph when nodes/rels change
  useEffect(() => {
    if (!containerRef.current) return;

    // --- Categorize nodes ---
    const operators = [];
    const others = [];

    for (const n of apiNodes) {
      const id = String(n.node_id);
      const labelsLower = (n.labels || []).map((l) => (l || "").toLowerCase());
      if (labelsLower.some((l) => l.includes("operator")))
        operators.push({ id, labels: n.labels });
      else others.push({ id, labels: n.labels });
    }

    // --- Build quick lookup of relationships ---
    const relByStart = new Map();
    for (const r of apiRels) {
      const s = String(r.end);
      const e = String(r.start);
      if (!relByStart.has(s)) relByStart.set(s, []);
      relByStart.get(s).push(e);
    }

    // --- Position operators spaced out in grid ---
    const operatorSpacing = 700;
    const clusterRadius = 250;
    const positioned = new Map();

    operators.forEach((op, i) => {
      const row = Math.floor(i / 7);
      const col = i % 7;
      const baseX = col * operatorSpacing;
      const baseY = row * operatorSpacing;

      // operator node
      positioned.set(op.id, {
        id: op.id,
        label: op.id,
        title: `Operator: ${op.id}\n${op.labels.join(", ")}`,
        x: baseX,
        y: baseY,
        shape: "dot",
        value: 28,
        group: "operator",
      });

      // connected nodes (uids/persons/others)
      const neighbors = relByStart.get(op.id) || [];
      neighbors.forEach((nid, j) => {
        if (positioned.has(nid)) return; // skip already placed
        const angle = (j / Math.max(neighbors.length, 1)) * Math.PI * 2;
        const x = baseX + clusterRadius * Math.cos(angle) + Math.random() * 40;
        const y = baseY + clusterRadius * Math.sin(angle) + Math.random() * 40;

        const node = apiNodes.find((n) => String(n.node_id) === nid);
        const labels = node?.labels || [];
        const lblLower = labels.map((l) => l.toLowerCase());

        positioned.set(nid, {
          id: nid,
        //   label: nid,
          title: `ID: ${nid}\nLabels: ${labels.join(", ")}`,
          x,
          y,
          shape: "dot",
          value: 20,
          group: lblLower.some((l) => l.includes("uid"))
            ? "uid"
            : lblLower.some((l) => l.includes("person"))
            ? "person"
            : "other",
        });
      });
    });

    // --- Any unconnected leftover nodes ---
    others.forEach((n, idx) => {
      if (!positioned.has(n.id)) {
        positioned.set(n.id, {
          id: n.id,
          label: n.id,
          title: `ID: ${n.id}\nLabels: ${n.labels.join(", ")}`,
          x: (idx % 5) * 200,
          y: 600 + Math.floor(idx / 5) * 150,
          shape: "dot",
          value: 16,
          group: "other",
        });
      }
    });

    // --- Edges ---
    const edgesArr = apiRels
      .map((r) => ({
        id: r.id,
        from: String(r.start),
        to: String(r.end),
        label: r.type || "",
        arrows: "to",
        title: r.type || "",
      }))
      .filter((e) => positioned.has(e.from) && positioned.has(e.to));

    setPreviewCounts({ nodes: positioned.size, edges: edgesArr.length });

    // --- Build DataSets and Network ---
    const nodesDS = new DataSet(Array.from(positioned.values()));
    const edgesDS = new DataSet(edgesArr);
    const data = { nodes: nodesDS, edges: edgesDS };

    const options = {
      physics: {
        enabled: false,
        stabilization: { enabled: true, iterations: 600 },
        barnesHut: {
        //   gravitationalConstant: 10000,
          springLength: 150,
          avoidOverlap: 0.5,
        },
      },
      nodes: { font: { multi: true }, scaling: { min: 8, max: 56 } },
      edges: {
        smooth: { type: "continuous" },
        color: { color: "#888", highlight: "#ff4500" },
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        navigationButtons: true,
      },
      groups: {
        operator: { color: { background: "#ffd1a4", border: "#c06" } },
        uid: { color: { background: "#cfe9ff", border: "#06c" } },
        person: { color: { background: "#e6ffe6", border: "#0a0" } },
        other: { color: { background: "#eee", border: "#777" } },
      },
    };

    if (networkRef.current) {
      try {
        networkRef.current.destroy();
      } catch (e) {}
      networkRef.current = null;
    }

    networkRef.current = new Network(containerRef.current, data, options);

    networkRef.current.once("stabilizationIterationsDone", () => {
      try {
        networkRef.current.setOptions({ physics: { enabled: false } });
        networkRef.current.fit({ animation: { duration: 300 } });
      } catch (e) {}
    });

    // --- Selection handling ---
    const onSelect = (params) => {
      if (params.nodes?.length) {
        const nid = params.nodes[0];
        const n = nodesDS.get(nid);
        const labels = n && n.group ? [n.group] : [];
        setSelectedNode({ id: nid, labels });
      } else setSelectedNode(null);
    };

    networkRef.current.on("select", onSelect);

    return () => {
      if (networkRef.current) {
        try {
          networkRef.current.off("select", onSelect);
          networkRef.current.destroy();
        } catch (e) {}
        networkRef.current = null;
      }
    };
  }, [apiNodes, apiRels]);

  // simple UI
  const refresh = () => fetchGraph();

  const toolbarStyle = {
    display: "flex",
    gap: 8,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "space-between",
  };
  const btn = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "none",
    background: "#1976d2",
    color: "#fff",
    cursor: "pointer",
  };
  const small = { fontSize: 13, color: "#666" };

  const selectionBox = {
    position: "absolute",
    right: 12,
    top: 70,
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
          <div style={{ fontWeight: 700, fontSize: 18 }}>Off-Time Operator Graph</div>
          <div style={small}>
            Shows operators with after-hours relationships filtered by degree.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* degree input */}
          <label style={{ fontSize: 14 }}>
            Offtime Operator Activity :
            <input
              type="number"
              min="1"
              value={degree}
              onChange={(e) => setDegree(Number(e.target.value) || 0)}
              style={{
                width: 70,
                marginLeft: 6,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />
          </label>
          <button onClick={refresh} style={btn}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <div style={{ marginLeft: 8, color: error ? "#b00020" : "#666" }}>
            {error ? error : `nodes: ${previewCounts.nodes} • edges: ${previewCounts.edges}`}
          </div>
        </div>
      </div>

      {/* selected node info */}
      <div style={selectionBox}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Selection</div>
        {selectedNode ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedNode.id}</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {(selectedNode.labels || []).join(", ")}
            </div>
          </div>
        ) : (
          <div style={{ color: "#666", fontSize: 13 }}>No node selected</div>
        )}
      </div>

      {/* graph container */}
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
