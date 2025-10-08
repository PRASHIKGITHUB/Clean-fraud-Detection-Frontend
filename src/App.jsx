// src/App.jsx
import { useState } from "react";
import { Toaster } from "sonner";
import ForceGraphQuery from "./components/ForceGraphQuery";
import SusNodes from "./components/SusNodes";
import UIDOperatorGraph from "./components/OperatorGraph";

export default function App() {
  // "force" = ForceGraphQuery (default), "sus" = SusNodes, "both" = show both
  const [activePanel, setActivePanel] = useState("force");

  return (
    <div className="p-6 space-y-6">
      <Toaster richColors closeButton />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Graph View</h1>
          <p className="text-sm text-gray-600">Inspect component relationships and suspicious nodes.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActivePanel("force")}
            className={`px-3 py-2 rounded-md font-medium transition ${activePanel === "force" ? "bg-amber-500 text-white" : "bg-white border border-gray-200"}`}
          >
            ForceGraph
          </button>

          <button
            onClick={() => setActivePanel("sus")}
            className={`px-3 py-2 rounded-md font-medium transition ${activePanel === "sus" ? "bg-amber-500 text-white" : "bg-white border border-gray-200"}`}
          >
            SusNodes
          </button>

          <button
            onClick={() => setActivePanel("op")}
            className={`px-3 py-2 rounded-md font-medium transition ${activePanel === "op" ? "bg-amber-500 text-white" : "bg-white border border-gray-200"}`}
          >
            Operator Pakda Gaya
          </button>


          <button
            onClick={() => setActivePanel("both")}
            className={`px-3 py-2 rounded-md font-medium transition ${activePanel === "both" ? "bg-amber-500 text-white" : "bg-white border border-gray-200"}`}
          >
            Both
          </button>
        </div>
      </div>

      <div>
        {activePanel === "force" && (
          <div>
            <ForceGraphQuery />
          </div>
        )}

        {activePanel === "sus" && (
          <div>
            <SusNodes />
          </div>
        )}

        {activePanel === "op" && (
          <div>
            <UIDOperatorGraph />
          </div>
        )}

        {activePanel === "both" && (
          <div className="space-y-6">
            <ForceGraphQuery />
            <SusNodes />
          </div>
        )}
      </div>
    </div>
  );
}
