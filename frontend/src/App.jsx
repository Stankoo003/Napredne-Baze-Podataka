import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [nodes, setNodes] = useState([]);
  const [newNode, setNewNode] = useState({ label: 'Person', name: '' });

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const { data } = await axios.get('http://localhost:3001/api/nodes');
      setNodes(data.nodes);
    } catch (error) {
      console.error('Greška:', error);
    }
  };

  const createNode = async () => {
    try {
      await axios.post('http://localhost:3001/api/nodes', {
        label: newNode.label,
        properties: { name: newNode.name }
      });
      fetchNodes(); // Refresh
      setNewNode({ label: 'Person', name: '' });
    } catch (error) {
      console.error('Greška pri kreiranju:', error);
    }
  };

  return (
    <div className="App">
      <h1>🧠 Neo4j + React Projekat</h1>
      
      <div className="controls">
        <input
          value={newNode.name}
          onChange={(e) => setNewNode({...newNode, name: e.target.value})}
          placeholder="Ime noda"
        />
        <button onClick={createNode}>➕ Dodaj nod</button>
      </div>

      <div className="nodes">
        <h2>Nodovi u grafu:</h2>
        {nodes.map((node, i) => (
          <div key={i} className="node">
            <strong>{node.properties.name || 'Bez imena'}</strong>
            <span>({node.labels[0]})</span>
          </div>
        ))}
      </div>

      <div className="links">
        <a href="http://localhost:7474" target="_blank">🔍 Neo4j Browser</a>
        <a href="http://localhost:3001/api/nodes" target="_blank">🔧 API</a>
      </div>
    </div>
  );
}

export default App;
