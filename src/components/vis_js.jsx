// ForceGraphVis-with-fetch.jsx
import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { DataSet, Network } from "vis-network/standalone";
import "vis-network/styles/vis-network.css";


export default function ForceGraphVis({ height = 750 }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  // UI state for fetching by id
  const [idInput, setIdInput] = useState("");
  const [fetchedResolved, setFetchedResolved] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const { visNodes, visEdges, groups } = useMemo(() => {
    const nodeMap = new Map();
    const edges = [];
    const palette = ["#4a90e2", "#50e3c2", "#f5a623", "#bd10e0", "#7ed321", "#b8e986"];

    normalizedComponents.forEach((comp, compIdx) => {
      (comp.nodes || []).forEach((n) => {
        if (!nodeMap.has(n.id)) {
          const label = n.props?.id || n.id;
          nodeMap.set(n.id, {
            id: n.id,
            label,
            title: `<div><strong>ID:</strong> ${n.id}<br/><strong>Labels:</strong> ${(n.labels||[]).join(", ")}<br/><strong>Props:</strong><pre style="white-space:pre-wrap">${JSON.stringify(n.props||{},null,2)}</pre></div>`,
            group: `g${compIdx}`,
            value: n.props?.weight ?? 1,
          });
        }
      });

      (comp.relationships || []).forEach((r, i) => {
        edges.push({
          id: `e-${compIdx}-${i}-${r.startId}-${r.endId}`,
          from: r.startId,
          to: r.endId,
          arrows: "to",
          label: r.type || "",
          font: { align: "top" },
        });
      });
    });

    const groups = {};
    normalizedComponents.forEach((_, i) => {
      groups[`g${i}`] = {
        color: { background: palette[i % palette.length], border: "#666" },
        shape: "dot",
      };
    });

    return { visNodes: Array.from(nodeMap.values()), visEdges: edges, groups };
  }, [normalizedComponents]);

  // Fetch function
  const fetchById = useCallback(async (id, signal) => {
    setError(null);
    if (!id) {
      setError("Please provide an id.");
      return;
    }

    const base = "http://10.8.12.212:8080";
    const baseClean = base.replace(/\/$/, "");
    const url = `${baseClean}/components/${encodeURIComponent(id)}`;

    setLoading(true);
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      const json = await res.json();
      console.log(json);
      console.log(normalizeComponents(json));
      setFetchedResolved(json)
      setError(null);
    } catch (err) {
      if (err.name === 'AbortError') return; // ignore abort
      console.error(err);
      setError(err.message || String(err));
      setFetchedResolved(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-create the network whenever nodes/edges/groups change
  useEffect(() => {
    if (!containerRef.current) return;

    const nodesDS = new DataSet(visNodes);
    const edgesDS = new DataSet(visEdges);

    const data = { nodes: nodesDS, edges: edgesDS };

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
        size: 16,
        font: { multi: true, vadjust: -10 },
      },
      edges: {
        smooth: { type: "continuous" },
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

    if (networkRef.current) {
      try { networkRef.current.destroy(); } catch (e) {}
      networkRef.current = null;
    }

    networkRef.current = new Network(containerRef.current, data, options);

    networkRef.current.once("stabilizationIterationsDone", () => {
      try { networkRef.current.fit({ animation: { duration: 300 } }); } catch (e) {}
    });

    return () => {
      if (networkRef.current) {
        try { networkRef.current.destroy(); } catch (e) {}
        networkRef.current = null;
      }
    };
  }, [visNodes, visEdges, groups]);

  // Handlers
  const handleInputChange = (e) => {
    e.stopPropagation();
    const value = e.target.value;
    setIdInput(value);
  };

  const handleFetchClick = async () => {
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

  const handleInputKeyPress = (e) => {
    e.stopPropagation();
  };

  const handleInputFocus = (e) => {
    e.stopPropagation();
  };

  // Button styles (simple, modern)
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

  return (
    <div style={{ width: "100%" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <input
          placeholder="Enter component id"
          value={idInput}
          type="text"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyPress={handleInputKeyPress}
          onFocus={handleInputFocus}
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
