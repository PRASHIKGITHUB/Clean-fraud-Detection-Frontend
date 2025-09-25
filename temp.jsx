// ForceGraphVis-with-fetch.jsx
import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { DataSet, Network } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";

/**
 * ForceGraphVis (fetch-by-id) — commented in simple language
 *
 * What this component does (short):
 * 1. Lets you type an `id` and press Fetch.
 * 2. Calls `${BASE}/components/{id}` to get graph data.
 * 3. Normalizes different server response shapes to a single array of "components".
 * 4. Builds nodes and edges for the vis-network library.
 * 5. For each node, counts how many relationships touching it include each numeric property
 *    (for example: "face: 5" means the node is part of 5 relationships that have a numeric 'face' prop).
 * 6. Sets node color (green -> red) and size based on node degree (how many edges touch it).
 * 7. Renders the interactive graph and shows a tooltip with the counts when you hover a node.
 *
 * Use: put this file in a React app. Change BASE URL if needed.
 */

export default function ForceGraphVis({ height = 750 }) {
  // containerRef is a pointer to the HTML div where the graph will render.
  // React sets containerRef.current = DOM node after render.
  const containerRef = useRef(null);

  // networkRef stores the vis `Network` instance. We keep it so we can destroy/update later.
  const networkRef = useRef(null);

  // ---------- Small bits of UI state ----------
  const [idInput, setIdInput] = useState("");
  // `fetchedResolved` will hold the JSON returned by the server.
  const [fetchedResolved, setFetchedResolved] = useState(null);
  // `loading` tells the UI to show "Fetching..." and disable the button.
  const [loading, setLoading] = useState(false);
  // `error` holds an error message if fetch fails.
  const [error, setError] = useState(null);

  // normalizeComponents: make sure we always work with an array of component objects.
  // Server might return different shapes; this helper converts them to a common shape.
  const normalizeComponents = (input) => {
    if (!input) return null; // nothing to do
    if (Array.isArray(input)) return input; // already an array
    // If the server returned `{ components: ... }` or `{ component: ... }`, normalize to array
    if (input.components) return Array.isArray(input.components) ? input.components : [input.components];
    if (input.component) return Array.isArray(input.component) ? input.component : [input.component];
    // If server returned a single graph object with nodes/relationships, wrap it in an array
    if (input.nodes || input.relationships) return [input];
    return null; // unknown shape
  };

  // Keep a local alias to the fetched JSON and a normalized array.
  const resolvedSource = fetchedResolved;
  const normalizedComponents = normalizeComponents(resolvedSource) || [];

  // ---------- Tiny math + color helpers (easy language) ----------
  // clamp: keep value between a and b
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  // hexToRgb: turn "#7ed321" into [r,g,b] numbers (0-255)
  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    // support #rgb shorthand by doubling chars
    const norm = h.length === 3 ? h.split("").map(s => s + s).join("") : h;
    const bigint = parseInt(norm, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };

  // rgbToHex: turn r,g,b numbers back into "#rrggbb"
  const rgbToHex = (r, g, b) => {
    const toHex = (c) => c.toString(16).padStart(2, "0");
    return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`;
  };

  // lerp: linear interpolation between two numbers. lerp(0,10,0.5) -> 5
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Build the nodes and edges for vis-network ----------
  // useMemo: run this heavy computation only when `normalizedComponents` changes.
  const { visNodes, visEdges, groups } = useMemo(() => {
    // nodeMap: map nodeId -> node object (we'll fill this and then turn into array)
    const nodeMap = new Map();
    // edges: temporary array, we keep raw relationship on each edge as __rawRel
    const edges = [];
    // palette: colors for different groups (different components)
    const palette = ["#4a90e2", "#50e3c2", "#f5a623", "#bd10e0", "#7ed321", "#b8e986"];

    // STEP 1: read every component and collect nodes + edges
    normalizedComponents.forEach((comp, compIdx) => {
      // add nodes to map (avoid duplicates if same id appears multiple times)
      (comp.nodes || []).forEach((n) => {
        if (!nodeMap.has(n.id)) {
          // For label we prefer `n.props.id` if it's present, otherwise use the node id
          const label = n.props?.id || n.id;
          nodeMap.set(n.id, {
            id: n.id,
            label,
            // initial title (will be overwritten with more info later)
            title: `ID: ${n.id} | Type: ${(n.labels || []).join(", ")}`,
            group: `g${compIdx}`,
            // start value from node.props.weight if available
            value: n.props?.weight ?? 1,
            __labels: n.labels || [], // keep labels for tooltip later
          });
        }
      });

      // add relationships as edges; we keep the original relationship object on the edge
      (comp.relationships || []).forEach((r, i) => {
        edges.push({
          id: `e-${compIdx}-${i}-${r.startId}-${r.endId}`,
          from: r.startId,
          to: r.endId,
          arrows: "to",
          label: r.type || "",
          font: { align: "top" },
          __rawRel: r, // raw rel used later to find numeric properties
        });
      });
    });

    // STEP 2: adjacencyCountsMap will store, for each node, a map: propKey -> count
    // Example: node 'A' -> Map { 'face' => 5, 'weight' => 3 }
    const adjacencyCountsMap = new Map();
    for (const nid of nodeMap.keys()) adjacencyCountsMap.set(nid, new Map());

    // Helper to pick numeric-looking keys from a relationship object
    // We accept actual numbers and numeric strings like "12".
    const extractNumericKeysFromRel = (rel) => {
      // relationship might put its user properties under `props` or `properties`, or be flat
      const src = rel.props ?? rel.properties ?? rel;
      const keys = [];
      const ignore = new Set(["startId", "endId", "from", "to", "type", "id", "label"]);
      for (const k of Object.keys(src || {})) {
        if (ignore.has(k)) continue; // skip metadata keys
        const v = src[k];
        if (v == null) continue; // skip null/undefined
        // if it's a number, accept it
        if (typeof v === "number" && Number.isFinite(v)) keys.push(k);
        else if (typeof v === "string") {
          // if it's a string but looks like a number ("12"), accept it
          const parsed = Number(v);
          if (!Number.isNaN(parsed) && Number.isFinite(parsed)) keys.push(k);
        }
      }
      return keys; // return list of property names we will count
    };

    // STEP 3: walk edges and increment counts for numeric keys on both endpoints
    edges.forEach((e) => {
      const relObj = e.__rawRel || {};
      const numericKeys = extractNumericKeysFromRel(relObj);
      const fromMap = adjacencyCountsMap.get(e.from) || new Map();
      const toMap = adjacencyCountsMap.get(e.to) || new Map();

      numericKeys.forEach((k) => {
        // increment count for property k on both 'from' and 'to' nodes
        fromMap.set(k, (fromMap.get(k) || 0) + 1);
        toMap.set(k, (toMap.get(k) || 0) + 1);
      });

      adjacencyCountsMap.set(e.from, fromMap);
      adjacencyCountsMap.set(e.to, toMap);
    });

    // STEP 4: build a degree map so we know how "connected" each node is
    // degree = number of edges incident (in + out)
    const degreeMap = new Map();
    for (const nodeId of nodeMap.keys()) degreeMap.set(nodeId, 0);
    edges.forEach((e) => {
      degreeMap.set(e.from, (degreeMap.get(e.from) || 0) + 1);
      degreeMap.set(e.to, (degreeMap.get(e.to) || 0) + 1);
    });

    // STEP 5: find maximum degree so we can normalize sizes and colors
    let maxDegree = 0;
    for (const [, d] of degreeMap) if (d > maxDegree) maxDegree = d;
    maxDegree = Math.max(maxDegree, 1); // avoid dividing by zero

    // We will color nodes between green (low degree) and red (high degree)
    const lowHex = "#7ed321"; // green for low-degree
    const highHex = "#ff4444"; // red for high-degree
    const lowRgb = hexToRgb(lowHex);
    const highRgb = hexToRgb(highHex);

    // STEP 6: finalize node visual fields (title, size, color)
    for (const [id, nodeObj] of nodeMap) {
      const countsMap = adjacencyCountsMap.get(id) || new Map();
      // sorted entries so we show the most frequent properties first in tooltip
      const entries = Array.from(countsMap.entries()).sort((a, b) => b[1] - a[1]);
      // countsText is a simple string like "face: 5 | weight: 3"
      const countsText = entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(' | ') : 'No weights';

      // totalCount is the sum of all numeric-property counts for this node
      const totalCount = entries.reduce((s, [, v]) => s + v, 0);
      const deg = degreeMap.get(id) || 0;
      // t is 0..1 telling us how far between green and red this node should be
      const t = clamp(deg / maxDegree, 0, 1);

      // size: small nodes for low-degree, big nodes for high-degree
      const minSize = 16; // px
      const maxSize = 50; // px
      const size = minSize + (deg / maxDegree) * (maxSize - minSize);

      // color: linear blend between lowRgb and highRgb by t
      const r = lerp(lowRgb[0], highRgb[0], t);
      const g = lerp(lowRgb[1], highRgb[1], t);
      const b = lerp(lowRgb[2], highRgb[2], t);
      const bgHex = rgbToHex(r, g, b);
      // slightly darker border for contrast
      const darkenFactor = 0.78;
      const borderHex = rgbToHex(r * darkenFactor, g * darkenFactor, b * darkenFactor);

      // set final node object fields that vis-network expects
      nodeMap.set(id, {
        ...nodeObj,
        // title is what vis shows in tooltip on hover — include counts so it's visible
        title: `ID: ${id} | Type: ${(nodeObj.__labels || []).join(", ") || "Unknown"} | Counts: ${countsText} | Total: ${totalCount}`,
        color: {
          background: bgHex,
          border: borderHex,
          highlight: {
            background: bgHex,
            border: "#222",
          },
        },
        // 'value' is used for scaling by vis, we also set explicit 'size'
        value: size,
        size: Math.round(size),
      });
    }

    // Build groups so nodes coming from different components can have different default colors
    const groups = {};
    normalizedComponents.forEach((_, i) => {
      groups[`g${i}`] = {
        color: { background: palette[i % palette.length], border: "#666" },
        shape: "dot",
      };
    });

    // Remove internal fields before giving edges array to vis
    const visEdgesClean = edges.map(({ __rawRel, ...rest }) => rest);

    // Return arrays/objects used by the rendering effect
    return { visNodes: Array.from(nodeMap.values()), visEdges: visEdgesClean, groups };
  }, [normalizedComponents]);

  // ---------- Fetching logic: get component by id from backend ----------
  const fetchById = useCallback(async (id, signal) => {
    setError(null); // clear previous error
    if (!id) {
      setError("Please provide an id.");
      return;
    }

    // NOTE: BASE is hard-coded here. For production, pass as prop or use env variable.
    const BASE = "http://172.31.186.176:8080";
    const baseClean = BASE.replace(/\/$/, "");
    const url = `${baseClean}/components/${encodeURIComponent(id)}`;

    setLoading(true);
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      // store the raw server response; normalizeComponents will run in useMemo
      setFetchedResolved(json);
      setError(null);
    } catch (err) {
      // if the fetch was aborted we silently ignore it
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message || String(err));
      setFetchedResolved(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------- Rendering / vis-network lifecycle ----------
  // create/destroy the vis.Network whenever nodes/edges/groups change
  useEffect(() => {
    if (!containerRef.current) return; // need a DOM element to mount into

    // create DataSets that vis uses (they are mutable, but we recreate here for simplicity)
    const nodesDS = new DataSet(visNodes);
    const edgesDS = new DataSet(visEdges);

    const data = { nodes: nodesDS, edges: edgesDS };

    // options: control physics and appearance
    const options = {
      physics: {
        stabilization: true,
        barnesHut: {
          gravitationalConstant: -8000,
          springLength: 200,
          springConstant: 0.04,
          avoidOverlap: 0.5,
        },
        minVelocity: 0.75,
      },
      nodes: {
        shape: "dot",
        scaling: {
          min: 16,
          max: 50,
          label: { min: 8, max: 20, drawThreshold: 5 }
        },
        font: { multi: true, vadjust: -10 },
      },
      edges: {
        smooth: { type: "continuous" },
        width: 4,
        arrows: { to: { enabled: true, scaleFactor: 0.8, type: "triangle" } },
        color: { color: "#888", highlight: "#ff4500" },
      },
      groups,
      interaction: {
        hover: true,
        tooltipDelay: 100,
        navigationButtons: true,
        keyboard: false,
      },
    };

    // destroy any previous network to avoid memory leaks
    if (networkRef.current) {
      try { networkRef.current.destroy(); } catch (e) {}
      networkRef.current = null;
    }

    // create the network
    networkRef.current = new Network(containerRef.current, data, options);

    // when physics stabilizes, zoom/pan so the whole graph fits the view
    networkRef.current.once("stabilizationIterationsDone", () => {
      try { networkRef.current.fit({ animation: { duration: 300 } }); } catch (e) {}
    });

    // cleanup function runs when component unmounts or before the next effect run
    return () => {
      if (networkRef.current) {
        try { networkRef.current.destroy(); } catch (e) {}
        networkRef.current = null;
      }
    };
  }, [visNodes, visEdges, groups]);

  // ---------- UI handlers ----------
  const handleInputChange = (e) => {
    // stopPropagation prevents the underlying graph from treating this click/drag as an interaction
    e.stopPropagation();
    setIdInput(e.target.value);
  };

  const handleFetchClick = async () => {
    // create an AbortController in case we later want to cancel
    const controller = new AbortController();
    await fetchById(idInput.trim(), controller.signal);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      handleFetchClick();
    }
  };

  // simple inline button styles
  const buttonBase = {
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    transition: 'transform 120ms ease, box-shadow 120ms ease',
    fontWeight: 600,
    background: '#1976d2',
    color: '#fff',
  };
  const buttonDisabled = {
    background: '#90caf9',
    cursor: 'not-allowed',
    boxShadow: 'none',
  };

  // ---------- JSX output ----------
  return (
    <div style={{ width: "100%" }}>
      {/* Toolbar: input + fetch button + status */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <input
          placeholder="Enter component id"
          value={idInput}
          type="text"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          // prevent clicks inside the input from being interpreted as graph drags
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', flex: '0 0 420px' }}
        />

        <button
          onClick={handleFetchClick}
          disabled={loading}
          style={{ ...(buttonBase), ...(loading ? buttonDisabled : {} ) }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(1px)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          {loading ? 'Fetching...' : 'Fetch'}
        </button>

        <div style={{ color: error ? '#b00020' : '#666', marginLeft: 8 }}>
          {error ? error : (fetchedResolved ? 'Loaded from server' : 'No data loaded')}
        </div>
      </div>

      {/* This div is where the vis-network will mount. Height can be a number (px) or string. */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: typeof height === "number" ? `${height}px` : height,
          border: "1px solid #e6e6e6",
          borderRadius: 6,
          background: "#fff",
        }}
      />
    </div>
  );
}
