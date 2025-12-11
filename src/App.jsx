// src/App.jsx
import { useState } from "react";
import { Toaster } from "sonner";
import ForceGraphQuery from "./components/ForceGraphQuery";
import SusNodes from "./components/SusNodes";
import UIDOperatorGraph from "./components/OperatorGraph";
import OffTime from "./components/OffTime";
// import TimeBased from "./components/TimeBased"
import RenderComm from "./components/RenderComm"
import CommunityGraphs from "./components/communityGraphs";

export default function App() {
   const [dataComm, setCommData] = useState([]);
   const [dataSus, setSusData] = useState([]);
  const [activePanel, setActivePanel] = useState("force");
   const [apiNodes, setApiNodes] = useState([]); // [{ node_id, labels }]
  const [apiRels, setApiRels] = useState([]); // [{ start_node_id, end_node_id, type }]
    const [apiNodesoff, setApiNodesoff] = useState([]);
  const [apiRelsoff, setApiRelsoff] = useState([]);
  // Constants
  const base_url = "http://localhost:8080"
  const endpoints = {
    "susnode" : "/compdegree",
    "forcegraph" : "/refsimilar",
    "uidoperator": "/sameop",
    "offtime": "/offtime",
    "timeBased":"/query",
    "commTable":"/communities",
    "commId": "/analysecommunity"
  }

  return (
    <div className="px-6 space-y-6">
      <Toaster richColors closeButton />

      <div className="flex items-center justify-between">

        <div className="flex gap-2">

          <button
            onClick={() => setActivePanel("commGraph")}
            className={`px-2 py-1 rounded-md text-sm transition ${activePanel === "commGraph" ? "bg-black text-white" : "bg-white border border-gray-200"}`}
          >
            Community Graph
          </button>

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

          {/* <button
            onClick={() => setActivePanel("TimeBased")}
            className={`px-2 py-1 rounded-md text-sm transition ${activePanel === "TimeBased" ? "bg-black text-white" : "bg-white border border-gray-200"}`}
          >
            TimeBased
          </button> */}

          <button
            onClick={() => setActivePanel("commTable")}
            className={`px-2 py-1 rounded-md text-sm transition ${activePanel === "commTable" ? "bg-black text-white" : "bg-white border border-gray-200"}`}
          >
            Community Table
          </button>
        </div>
      </div>

      <div>
        {activePanel === "force" && (
          <div>
            <ForceGraphQuery base={base_url} endpoint1={endpoints.forcegraph} endpoint2={endpoints.commId}/>
          </div>
        )}

        {activePanel === "commGraph" && (
          <div>
            <CommunityGraphs/>
          </div>
        )}

        {activePanel === "sus" && (
          <div>
            <SusNodes base={base_url} endpoint={endpoints.susnode} data={dataSus} setData={setSusData}/>
          </div>
        )}

        {activePanel === "op" && (
          <div>
            <UIDOperatorGraph base={base_url} endpoint={endpoints.uidoperator} apiNodes={apiNodes} setApiNodes={setApiNodes} apiRels={apiRels} setApiRels={setApiRels} />
          </div>
        )}

        {activePanel === "both" && (
          <div className="space-y-6">
            <ForceGraphQuery base={base_url} endpoint={endpoints.forcegraph}/>
          </div>
        )}

        {activePanel === "offtime" && (
          <div className="space-y-6">
            <OffTime base={base_url} endpoint={endpoints.offtime} apiNodes={apiNodesoff} setApiNodes={setApiNodesoff} apiRels={apiRelsoff} setApiRels={setApiRelsoff}/>
          </div>
        )}

        {/* {activePanel === "TimeBased" && (
          <div className="space-y-6">
            <TimeBased base={base_url} endpoint={endpoints.timeBased}/>
          </div>
        )} */}

        {activePanel === "commTable" && (
          <div className="space-y-6">
            <RenderComm base={base_url} endpoint={endpoints.commTable} data={dataComm} setData={setCommData}/>
          </div>
        )}

      </div>
    </div>
  );
}
