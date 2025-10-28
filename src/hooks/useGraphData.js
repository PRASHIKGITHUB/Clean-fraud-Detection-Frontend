import { useState, useEffect } from 'react';

// const { graphData, isLoading, error } = useGraphData(endpoint);

export const useGraphData = (url) => {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) {
      return;
    }

    const fetchGraphData = async () => {
      setIsLoading(true);
      setError(null); // Reset error state on new fetch attempt.

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        const edges = data.relationships || data.edges;
        setGraphData({ nodes: data.nodes, edges: edges });
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraphData();
  }, [url]); 

  return { graphData, isLoading, error };
};
