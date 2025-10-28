// src/App.jsx
import { useState } from "react";
import { Toaster } from "sonner";
import ForceGraphQuery from "./components/ForceGraphQuery";
import SusNodes from "./components/SusNodes";
import UIDOperatorGraph from "./components/OperatorGraph";
import OffTime from "./components/OffTime";

export default function App() {

  const [activePanel, setActivePanel] = useState("force");
  // Constants
  const base_url = "http://localhost:8080"
  const endpoints = {
    "susnode" : "/compdegree",
    "forcegraph" : "/refsimilar",
    "uidoperator": "/sameop",
    "offtime": "/offtime"
  }

  return (
    <div className="px-6 space-y-6">
      <Toaster richColors closeButton />

      <div className="flex items-center justify-between">

        <div className="flex gap-2">
          <button
            onClick={() => setActivePanel("force")}
            className={`px-2 py-1 rounded-md text-sm transition ${activePanel === "force" ? "bg-black text-white" : "bg-white border border-gray-200"}`}
          >
            Get Component
          </button>

          <button
            onClick={() => setActivePanel("sus")}
            className={`px-2 py-1 rounded-md text-sm transition ${activePanel === "sus" ? "bg-black text-white" : "bg-white border border-gray-200"}`}
          >
            Suspicious Nodes
          </button>

          <button
            onClick={() => setActivePanel("op")}
            className={`px-2 py-1 rounded-md text-sm transition ${activePanel === "op" ? "bg-black text-white" : "bg-white border border-gray-200"}`}
          >
            Operator Activity
          </button>

          <button
            onClick={() => setActivePanel("offtime")}
            className={`px-2 py-1 rounded-md text-sm transition ${activePanel === "offtime" ? "bg-black text-white" : "bg-white border border-gray-200"}`}
          >
            Off Time Activity
          </button>
        </div>
      </div>

      <div>
        {activePanel === "force" && (
          <div>
            <ForceGraphQuery base={base_url} endpoint={endpoints.forcegraph}/>
          </div>
        )}

        {activePanel === "sus" && (
          <div>
            <SusNodes base={base_url} endpoint={endpoints.susnode}/>
          </div>
        )}

        {activePanel === "op" && (
          <div>
            <UIDOperatorGraph base={base_url} endpoint={endpoints.uidoperator}/>
          </div>
        )}

        {activePanel === "both" && (
          <div className="space-y-6">
            <ForceGraphQuery base={base_url} endpoint={endpoints.forcegraph}/>
          </div>
        )}

        {activePanel === "offtime" && (
          <div className="space-y-6">
            <OffTime base={base_url} endpoint={endpoints.offtime}/>
          </div>
        )}

      </div>
    </div>
  );
}
