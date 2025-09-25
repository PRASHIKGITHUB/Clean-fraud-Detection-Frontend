// ForceGraphVis-with-fetch.jsx
import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { DataSet, Network } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";

const BASE = "http://172.31.186.176:8080"; // change if needed

const MATCH_PROPS = [
  "face_score",
  "left_index_score",
  "left_little_score",
  "left_middle_score",
  "left_ring_score",
  "right_index_score",
  "right_little_score",
  "right_middle_score",
  "right_ring_score",
  "left_thumb_score",
  "right_thumb_score",
  "left_iris_score",
  "right_iris_score",
];

export default function ForceGraphVis({ height = 750 }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  const [idInput, setIdInput] = useState("");
  const [fetchedResolved, setFetchedResolved] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // filter UI state
  const [filterOpen, setFilterOpen] = useState(true);
  const [selectedProps, setSelectedProps] = useState(() =>
    MATCH_PROPS.reduce((acc, k) => ({ ...acc, [k]: true }), {})
  );
  const [thresholds, setThresholds] = useState(() =>
    MATCH_PROPS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {})
  );

  // preview counts for UI
  const [previewNodes, setPreviewNodes] = useState(0);
  const [previewEdges, setPreviewEdges] = useState(0);

  const normalizeComponents = (input) => {
    if (!input) return null;
    if (Array.isArray(input)) return input;
    if (input.components) return Array.isArray(input.components) ? input.components : [input.components];
    if (input.component) return Array.isArray(input.component) ? input.component : [input.component];
    if (input.nodes || input.relationships) return [input];
    return null;
  };

  const resolvedSource = fetchedResolved;
  const normalizedComponents = normalizeComponents(resolvedSource) || [];

  // helpers
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    const norm = h.length === 3 ? h.split("").map((s) => s + s).join("") : h;
    const bigint = parseInt(norm, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };
  const rgbToHex = (r, g, b) => {
    const toHex = (c) => c.toString(16).padStart(2, "0");
    return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`;
  };
  const lerp = (a, b, t) => a + (b - a) * t;

  // MAIN: compute visNodes, visEdges, groups, and preview counts without side-effects
  const { visNodes, visEdges, groups, previewCounts } = useMemo(() => {
    const nodeMap = new Map();
    const edges = [];

    // gather nodes & edges
    normalizedComponents.forEach((comp, compIdx) => {
      (comp.nodes || []).forEach((n) => {
        if (!nodeMap.has(n.id)) {
          nodeMap.set(n.id, {
            id: n.id,
            label: n.props?.id || n.id,
            typeLabels: n.labels || [],
            group: `g${compIdx}`,
            __rawNode: n,
          });
        }
      });
      (comp.relationships || []).forEach((r, i) => {
        edges.push({
          id: `e-${compIdx}-${i}-${r.startId}-${r.endId}`,
          from: r.startId,
          to: r.endId,
          label: r.type || "",
          __rawRel: r,
        });
      });
    });

    const relType = (r) => (r.type || r.label || "").toString().toLowerCase();
    const isMatches = (r) => relType(r) === "matches" || relType(r) === "match";
    const isBelongsTo = (r) => relType(r).includes("belongs");
    const isOperatedBy = (r) => relType(r).includes("operat");

    // determine eligible matches
    const edgeEligibleMap = new Map();
    for (const e of edges) {
      const raw = e.__rawRel || {};
      if (!isMatches(raw)) {
        edgeEligibleMap.set(e.id, false);
        continue;
      }
      const src = raw.props ?? raw.properties ?? raw;
      let ok = false;
      for (const prop of MATCH_PROPS) {
        if (!selectedProps[prop]) continue;
        const thr = Number(thresholds[prop] ?? 0);
        const v = src ? src[prop] : undefined;
        if (v == null) continue;
        const num = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
        if (!Number.isNaN(num) && Number.isFinite(num) && num >= thr) {
          ok = true;
          break;
        }
      }
      edgeEligibleMap.set(e.id, ok);
    }

    // filter edges: matches must be eligible; others kept
    const renderedEdges = edges.filter((e) => {
      const raw = e.__rawRel || {};
      return isMatches(raw) ? !!edgeEligibleMap.get(e.id) : true;
    });

    // preview counts (computed locally)
    const previewEdgesCount = renderedEdges.length;
    const nodeIdsInEdges = new Set(renderedEdges.flatMap((e) => [e.from, e.to]));
    const previewNodesCount = nodeIdsInEdges.size || nodeMap.size;

    // maps for degree & prop counts
    const refDegreeMap = new Map();
    const belongsAdj = new Map();
    const operatedAdj = new Map();
    const perPropCountMap = new Map();
    for (const nid of nodeMap.keys()) {
      refDegreeMap.set(nid, 0);
      perPropCountMap.set(nid, new Map());
    }

    // populate degrees and adjacency
    for (const e of renderedEdges) {
      const raw = e.__rawRel || {};
      const from = e.from,
        to = e.to;
      if (isMatches(raw)) {
        refDegreeMap.set(from, (refDegreeMap.get(from) || 0) + 1);
        refDegreeMap.set(to, (refDegreeMap.get(to) || 0) + 1);
        const src = raw.props ?? raw.properties ?? raw;
        for (const prop of MATCH_PROPS) {
          const val = src ? src[prop] : undefined;
          if (val == null) continue;
          const num = typeof val === "number" ? val : typeof val === "string" ? Number(val) : NaN;
          if (!Number.isNaN(num) && Number.isFinite(num)) {
            const a = perPropCountMap.get(from) || new Map();
            a.set(prop, (a.get(prop) || 0) + 1);
            perPropCountMap.set(from, a);
            const b = perPropCountMap.get(to) || new Map();
            b.set(prop, (b.get(prop) || 0) + 1);
            perPropCountMap.set(to, b);
          }
        }
      } else {
        // belongs/operated adjacency
        const fromNode = nodeMap.get(from),
          toNode = nodeMap.get(to);
        const fromLabels = (fromNode?.typeLabels || []).map((x) => (x || "").toString().toLowerCase());
        const toLabels = (toNode?.typeLabels || []).map((x) => (x || "").toString().toLowerCase());
        const isARef = fromLabels.some((l) => l.includes("ref"));
        const isBRef = toLabels.some((l) => l.includes("ref"));
        const isAUid = fromLabels.some((l) => l.includes("uid"));
        const isBUid = toLabels.some((l) => l.includes("uid"));
        const isAOp = fromLabels.some((l) => l.includes("operator"));
        const isBOp = toLabels.some((l) => l.includes("operator"));

        if (isBelongsTo(raw)) {
          if (isARef && isBUid) {
            const s = belongsAdj.get(to) || new Set();
            s.add(from);
            belongsAdj.set(to, s);
          } else if (isBRef && isAUid) {
            const s = belongsAdj.get(from) || new Set();
            s.add(to);
            belongsAdj.set(from, s);
          } else {
            if (isARef) {
              const s = belongsAdj.get(to) || new Set();
              s.add(from);
              belongsAdj.set(to, s);
            } else if (isBRef) {
              const s = belongsAdj.get(from) || new Set();
              s.add(to);
              belongsAdj.set(from, s);
            }
          }
        }
        if (isOperatedBy(raw)) {
          if (isARef && isBOp) {
            const s = operatedAdj.get(to) || new Set();
            s.add(from);
            operatedAdj.set(to, s);
          } else if (isBRef && isAOp) {
            const s = operatedAdj.get(from) || new Set();
            s.add(to);
            operatedAdj.set(from, s);
          } else {
            if (isARef) {
              const s = operatedAdj.get(to) || new Set();
              s.add(from);
              operatedAdj.set(to, s);
            } else if (isBRef) {
              const s = operatedAdj.get(from) || new Set();
              s.add(to);
              operatedAdj.set(from, s);
            }
          }
        }
      }
    }

    // compute uid/operator degrees
    const uidDegreeMap = new Map();
    for (const [uidId, refSet] of belongsAdj.entries()) {
      let count = 0;
      for (const refId of refSet) {
        if ((refDegreeMap.get(refId) || 0) > 0) count++;
      }
      uidDegreeMap.set(uidId, count);
    }

    const operatorDegreeMap = new Map();
    for (const [opId, refSet] of operatedAdj.entries()) {
      let count = 0;
      for (const refId of refSet) {
        if ((refDegreeMap.get(refId) || 0) > 0) count++;
      }
      operatorDegreeMap.set(opId, count);
    }

    // compute max degree for scaling
    let maxDegree = 0;
    for (const nid of nodeMap.keys()) {
      const n = nodeMap.get(nid);
      const labels = (n.typeLabels || []).map((x) => (x || "").toString().toLowerCase());
      let deg = 0;
      if (labels.some((l) => l.includes("ref"))) deg = refDegreeMap.get(nid) || 0;
      else if (labels.some((l) => l.includes("uid"))) deg = uidDegreeMap.get(nid) || 0;
      else if (labels.some((l) => l.includes("operator"))) deg = operatorDegreeMap.get(nid) || 0;
      else deg = refDegreeMap.get(nid) || uidDegreeMap.get(nid) || operatorDegreeMap.get(nid) || 0;
      if (deg > maxDegree) maxDegree = deg;
    }
    maxDegree = Math.max(maxDegree, 1);

    // color ramp
    const lowHex = "#7ed321";
    const highHex = "#ff4444";
    const lowRgb = hexToRgb(lowHex);
    const highRgb = hexToRgb(highHex);

    // finalize node objects (title, color, size)
    for (const [id, nObj] of nodeMap) {
      const labels = (nObj.typeLabels || []).map((x) => (x || "").toString().toLowerCase());
      let deg = 0;
      if (labels.some((l) => l.includes("ref"))) deg = refDegreeMap.get(id) || 0;
      else if (labels.some((l) => l.includes("uid"))) deg = uidDegreeMap.get(id) || 0;
      else if (labels.some((l) => l.includes("operator"))) deg = operatorDegreeMap.get(id) || 0;
      else deg = refDegreeMap.get(id) || uidDegreeMap.get(id) || operatorDegreeMap.get(id) || 0;

      const countsMap = perPropCountMap.get(id) || new Map();
      const entries = Array.from(countsMap.entries()).sort((a, b) => b[1] - a[1]);
      const totalCount = entries.reduce((s, [, v]) => s + v, 0);

      const topN = entries.slice(0, 6).map(([k, v]) => `${k}: ${v}`);
      const more = entries.length > 6 ? ` (+${entries.length - 6} more)` : "";

      const t = clamp(deg / maxDegree, 0, 1);
      const r = lerp(lowRgb[0], highRgb[0], t);
      const g = lerp(lowRgb[1], highRgb[1], t);
      const b = lerp(lowRgb[2], highRgb[2], t);
      const bgHex = rgbToHex(r, g, b);
      const borderHex = rgbToHex(r * 0.78, g * 0.78, b * 0.78);

      const minSize = 16;
      const maxSize = 56;
      const size = minSize + (deg / maxDegree) * (maxSize - minSize);

      nodeMap.set(id, {
        ...nObj,
        title: `ID: ${id} | Type: ${(nObj.typeLabels || []).join(", ") || "Unknown"} | Degree: ${deg}\n${topN.join(" | ")}${more} | Total: ${totalCount}`,
        color: { background: bgHex, border: borderHex, highlight: { background: bgHex, border: "#222" } },
        value: size,
        size: Math.round(size),
      });
    }

    const groupsOut = {};
    normalizedComponents.forEach((_, i) => {
      groupsOut[`g${i}`] = { color: { background: "#4a90e2", border: "#666" }, shape: "dot" };
    });

    const visEdgesClean = renderedEdges.map(({ __rawRel, ...rest }) => rest);

    // return previewCounts with the memo result (but do NOT call any setState here)
    return {
      visNodes: Array.from(nodeMap.values()),
      visEdges: visEdgesClean,
      groups: groupsOut,
      previewCounts: { nodes: previewNodesCount, edges: previewEdgesCount },
    };
  }, [normalizedComponents, selectedProps, thresholds]);

  // set preview counts in an effect (so it causes a single state update after memo completes)
  useEffect(() => {
    if (!previewCounts) {
      setPreviewNodes(0);
      setPreviewEdges(0);
      return;
    }
    setPreviewNodes(previewCounts.nodes);
    setPreviewEdges(previewCounts.edges);
  }, [previewCounts]);

  // fetch function
  const fetchById = useCallback(async (id, signal) => {
    setError(null);
    if (!id) {
      setError("Please provide an id.");
      return;
    }
    const baseClean = BASE.replace(/\/$/, "");
    const url = `${baseClean}/components/${encodeURIComponent(id)}`;
    setLoading(true);
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      setFetchedResolved(json);
      setError(null);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      setError(err.message || String(err));
      setFetchedResolved(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // render network
  useEffect(() => {
    if (!containerRef.current) return;
    const nodesDS = new DataSet(visNodes);
    const edgesDS = new DataSet(visEdges);
    const data = { nodes: nodesDS, edges: edgesDS };

    const options = {
      physics: { stabilization: true, barnesHut: { gravitationalConstant: -8000, springLength: 200, springConstant: 0.04, avoidOverlap: 0.5 }, minVelocity: 0.75 },
      nodes: { shape: "dot", scaling: { min: 16, max: 56, label: { min: 8, max: 20, drawThreshold: 5 } }, font: { multi: true, vadjust: -10 } },
      edges: { smooth: { type: "continuous" }, arrows: { to: { enabled: true, scaleFactor: 0.8, type: "triangle" } }, color: { color: "#888", highlight: "#ff4500" } },
      groups,
      interaction: { hover: true, tooltipDelay: 100, navigationButtons: true, keyboard: false },
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
        networkRef.current.fit({ animation: { duration: 300 } });
      } catch (e) {}
    });

    return () => {
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch (e) {}
        networkRef.current = null;
      }
    };
  }, [visNodes, visEdges, groups]);

  // handlers
  const toggleFilterOpen = () => setFilterOpen((s) => !s);
  const handlePropToggle = (prop) => setSelectedProps((prev) => ({ ...prev, [prop]: !prev[prop] }));
  const handleThresholdChange = (prop, value) => setThresholds((prev) => ({ ...prev, [prop]: Number(value) }));
  const handleReset = () => {
    setSelectedProps(MATCH_PROPS.reduce((a, k) => ({ ...a, [k]: true }), {}));
    setThresholds(MATCH_PROPS.reduce((a, k) => ({ ...a, [k]: 0 }), {}));
  };

  const handleInputChange = (e) => setIdInput(e.target.value);
  const handleFetchClick = async () => {
    const controller = new AbortController();
    await fetchById(idInput.trim(), controller.signal);
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFetchClick();
    }
  };

  // small UI styles
  const toolbarStyle = { display: "flex", gap: 8, marginBottom: 12, alignItems: "center", background: "#fff8f0", padding: 12, borderRadius: 8 };
  const inputStyle = { padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", flex: "0 0 480px", fontSize: 14 };
  const btnPrimary = { padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.08)", fontWeight: 700, background: "#1976d2", color: "#fff" };
  const btnGhost = { padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", background: "#fff" };
  const panel = { border: "1px solid #eee", padding: 12, borderRadius: 8, background: "#fff" };
  const smallInput = { width: 80, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };

  return (
    <div style={{ width: "100%" }}>
      <div style={toolbarStyle}>
        <div style={{ flex: "1 1 auto" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Graph View</div>
          <div style={{ color: "#666", fontSize: 13 }}>Fetch a component by id, then refine the matches filter below.</div>
        </div>

        <input placeholder="Enter component id" value={idInput} onChange={handleInputChange} onKeyDown={handleKeyDown} style={inputStyle} />
        <button onClick={handleFetchClick} disabled={loading} style={btnPrimary}>
          {loading ? "Fetching..." : "Fetch"}
        </button>
        <button onClick={toggleFilterOpen} style={btnGhost}>
          {filterOpen ? "Hide Filters" : "Show Filters"}
        </button>

        <div style={{ marginLeft: 8, color: error ? "#b00020" : "#666" }}>{error ? error : fetchedResolved ? "Loaded from server" : "No data loaded"}</div>
      </div>

      {filterOpen && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Match properties</div>
                <div style={{ color: "#666", fontSize: 13 }}>{previewNodes} nodes • {previewEdges} relationships visible</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {MATCH_PROPS.map((p) => (
                  <div key={p} style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, borderRadius: 8, background: "#fbfbfb", border: "1px solid #f1f1f1" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto" }}>
                      <input type="checkbox" checked={!!selectedProps[p]} onChange={() => handlePropToggle(p)} />
                      <div style={{ fontSize: 13 }}>{p}</div>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input style={smallInput} type="number" step="0.01" value={thresholds[p]} onChange={(e) => handleThresholdChange(p, e.target.value)} />
                      <div style={{ fontSize: 12, color: "#666" }}>thr</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: 300 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={handleReset} style={{ ...btnGhost, background: "#fff" }}>
                  Reset filters
                </button>
                <div style={{ color: "#444", fontSize: 13 }}>
                  Changes apply instantly. Non-eligible MATCHES relationships are hidden.
                </div>
                <hr style={{ border: 0, borderTop: "1px solid #f0f0f0", margin: "8px 0" }} />
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Legend</div>
                <div style={{ fontSize: 13, color: "#555" }}>
                  Node color & size scale with node degree (ref / uid / operator). Hover a node to see top prop counts.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={containerRef} style={{ width: "100%", height: typeof height === "number" ? `${height}px` : height, border: "1px solid #eaeaea", borderRadius: 8, background: "#ffffff" }} />
    </div>
  );
}
