
import React, { useState } from 'react';
// import OgmaGraph from './components/OgmaGraph';
import { useGraphData } from './hooks/useGraphData';

function Temp() {
  const [endpoint, setEndpoint] = useState('http://localhost:8080/compdegree');

  // Call the custom hook with the dynamic endpoint.
  const { graphData, isLoading, error } = useGraphData(endpoint);

  if (isLoading) {
    return <div>Loading graph data...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="Temp">
      <h1>My Ogma Graph</h1>
      <div>
        <button onClick={() => setEndpoint('http://localhost:8080/compdegree')}>
          Load Graph 1
        </button>
        <button onClick={() => setEndpoint('http://localhost:8080/sameop')}>
          Load Graph 2
        </button>
      </div>
      <OgmaGraph graphData={graphData} />
    </div>
  );
}

export default Temp;
