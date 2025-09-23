// src/App.jsx
import { useState } from "react"
import { Toaster } from "sonner"
import GraphView from "@/components/vis_js"
export default function App() {
  const [view, setView] = useState("graph") // "t1" | "t2" | "get" | "graph"
  const [inputId, setInputId] = useState("")
  const [submittedId, setSubmittedId] = useState(null)

  return (
    <div className="p-6 space-y-6">
      <Toaster richColors closeButton />
      
        <>
          <h1 className="text-2xl font-semibold">Graph View</h1>
          <GraphView />
          
        </>
     
    </div>
  )
}




