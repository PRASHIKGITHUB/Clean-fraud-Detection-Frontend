// src/components/CommunityGraphs.tsx
import React, { JSX, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
  Filler,
} from "chart.js";

import { Chart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
  Filler
);

export default function CommunityGraphs(selectedId: string): JSX.Element {
  const [endpoint, setEndpoint] = useState<string>("");
  const [rawDates, setRawDates] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = "http://localhost:8080/";
  // setEndpoint(String(selectedId));
  async function fetchData() {
    setError(null);
    setRawDates(null);
    if (!endpoint.trim()) {
      setError("Please enter an endpoint URL.");
      return;
    }

    setLoading(true);
    try {
      const url = `${base.replace(/\/$/, "")}${"/communityGraphs"}?id=${encodeURIComponent(
        endpoint
      )}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const json = await res.json();
      if (!json || typeof json !== "object" || !Array.isArray(json.dates)) {
        throw new Error("Invalid response shape. Expecting { dates: string[] }");
      }

      const arr = json.dates.map((d: any) =>
        typeof d === "string" ? d.trim() : String(d)
      );

      setRawDates(arr);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Compute chart-ready data: only EXISTING dates → evenly spaced categories
  const chartData = useMemo(() => {
    if (!rawDates) return null;

    // Count unique dates (based on YYYY-MM-DD)
    const freq: Record<string, number> = {};
    for (const d of rawDates) {
      const iso = d.split("T")[0];
      freq[iso] = (freq[iso] || 0) + 1;
    }

    const sortedDates = Object.keys(freq).sort();

    const counts = sortedDates.map((d) => freq[d]);

    const cumulative: number[] = [];
    let run = 0;
    for (const c of counts) {
      run += c;
      cumulative.push(run);
    }

    return {
      labels: sortedDates, // STRING labels → evenly spaced
      counts,
      cumulative,
    };
  }, [rawDates]);

  const data = useMemo(() => {
    if (!chartData) return undefined;

    return {
      labels: chartData.labels,
      datasets: [
        {
          type: "bar",
          label: "Daily Count",
          data: chartData.counts,
          backgroundColor: "#252222ff",
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Cumulative",
          data: chartData.cumulative,
          borderColor: "#ff0000",
          pointBackgroundColor: "#ffffffff",
          yAxisID: "y",
          tension: 0.25,
          fill: false,
        },
      ],
    };
  }, [chartData]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,

    layout: {
      padding: { top: 20, right: 20, bottom: 20, left: 10 },
    },

    plugins: {
      title: {
        display: true,
        text: "Refid Count vs Time",
        color: "#111",
        font: { size: 20, weight: "bold" },
        padding: { top: 10, bottom: 20 },
      },
      legend: {
        position: "top",
        labels: { color: "#333", font: { size: 14 } },
      },
      tooltip: {
        backgroundColor: "rgba(0,0,0,0.85)",
        titleColor: "#e12f2f",
        bodyColor: "#fff",
        padding: 12,
        borderColor: "#444",
        borderWidth: 1,
      },
    },

    scales: {
      // KEY CHANGE: category axis → evenly spaced data points
      x: {
        type: "category",
        labels: chartData?.labels ?? [],
        ticks: {
          color: "#222",
          font: { size: 12 },
          maxRotation: 45,
          autoSkip: true,
        },
        grid: { color: "rgba(0,0,0,0.08)" },
        title: {
          display: true,
          text: "Date ",
          color: "#333",
          font: { size: 13, weight: "500" },
        },
      },

      y: {
        beginAtZero: true,
        ticks: { color: "#222", font: { size: 12 } },
        grid: { color: "rgba(0,0,0,0.08)" },
        title: {
          display: true,
          text: "Count",
          color: "#333",
          font: { size: 13, weight: "500" },
        },
      },
    },
  };


  return (
    <div
      style={{
        maxWidth: 980,
        margin: "20px auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2 style={{ marginBottom: 12 }}>Community Graph</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Enter community Id"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          onKeyDown={fetchData}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 14,
          }}
        />
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Loading..." : "Fetch"}
        </button>
      </div>

      {error && (
        <div style={{ color: "crimson", marginBottom: 8 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!rawDates && (
        <div style={{ color: "#444", marginBottom: 12 }}>
          Enter an id and click <strong>Fetch</strong>.
        </div>
      )}

      {rawDates && rawDates.length === 0 && (
        <div style={{ color: "#444", marginBottom: 12 }}>
          Endpoint returned an empty dates array.
        </div>
      )}

      <div style={{ height: 480, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        {data ? (
          <Chart type="bar" data={data} options={options} />
        ) : (
          <div style={{ color: "#666" }}>No chart to display yet.</div>
        )}
      </div>

      {rawDates && (
        <div style={{ marginTop: 12, color: "#333", fontSize: 13 }}>
          <strong>Last fetched:</strong> {rawDates.length} Refids.
        </div>
      )}
    </div>
  );
}
