import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './SocialGraph.css';

function SocialGraph() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  
  const games = [
    'League of Legends',
    'World of Warcraft',
    'CS:GO',
    'Minecraft',
    'Valorant',
    'Dota 2'
  ];

  const [selectedGame, setSelectedGame] = useState('League of Legends');
  const [dragging, setDragging] = useState(null);

  // Mock connections sa prirodnijim pozicijama (malo randomizirano)
  const initialConnectionsByGame = {
    'League of Legends': [
      { id: 1, name: 'Marko', x: 18, y: 22 },
      { id: 2, name: 'Janko', x: 78, y: 18 },
      { id: 3, name: 'Stefan', x: 25, y: 75 },
      { id: 4, name: 'Ana', x: 82, y: 78 }
    ],
    'World of Warcraft': [
      { id: 2, name: 'Janko', x: 48, y: 12 },
      { id: 5, name: 'Petar', x: 88, y: 48 },
      { id: 6, name: 'Milica', x: 12, y: 52 }
    ],
    'CS:GO': [
      { id: 3, name: 'Stefan', x: 22, y: 28 },
      { id: 7, name: 'Nikola', x: 72, y: 25 },
      { id: 8, name: 'Luka', x: 50, y: 82 }
    ],
    'Minecraft': [
      { id: 4, name: 'Ana', x: 52, y: 18 },
      { id: 9, name: 'Sara', x: 78, y: 68 }
    ],
    'Valorant': [
      { id: 1, name: 'Marko', x: 48, y: 15 },
      { id: 10, name: 'Dimitrije', x: 18, y: 58 },
      { id: 11, name: 'Vuk', x: 78, y: 62 }
    ],
    'Dota 2': [
      { id: 12, name: 'Igor', x: 28, y: 32 },
      { id: 13, name: 'Jovana', x: 68, y: 28 }
    ]
  };

  const [nodePositions, setNodePositions] = useState(initialConnectionsByGame);
  const currentConnections = nodePositions[selectedGame] || [];

  // Funkcija za kreiranje zakrivljene linije (Bezier curve)
  const createCurvedPath = (x1, y1, x2, y2) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    // Offset za kontrolnu tačku (pravi zakrivljenje)
    const offsetX = (y2 - y1) * 0.15;
    const offsetY = (x1 - x2) * 0.15;
    
    return `M ${x1} ${y1} Q ${midX + offsetX} ${midY + offsetY}, ${x2} ${y2}`;
  };

  // Drag & Drop handlers
  const handleMouseDown = (e, nodeId) => {
    e.preventDefault();
    setDragging(nodeId);
  };

  const handleMouseMove = (e) => {
    if (dragging === null) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    //Ограничи позицију (5% - 95%)
    const clampedX = Math.max(5, Math.min(95, x));
    const clampedY = Math.max(5, Math.min(95, y));
    
    setNodePositions(prev => ({
      ...prev,
      [selectedGame]: prev[selectedGame].map(node =>
        node.id === dragging 
          ? { ...node, x: clampedX, y: clampedY }
          : node
      )
    }));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  return (
    <div 
      className="social-graph-page"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="scanlines"></div>
      
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Back to Home
      </button>

      <div className="social-graph-container">
        
        {/* Header */}
        <header className="graph-header">
          <h1>🔗 Social <span className="highlight">Graph</span></h1>
          <p className="graph-subtitle">Discover your gaming connections</p>
        </header>

        {/* Game Selector */}
        <div className="game-selector">
          <label htmlFor="game-select">Select Game:</label>
          <select 
            id="game-select" 
            value={selectedGame} 
            onChange={(e) => setSelectedGame(e.target.value)}
            className="game-dropdown"
          >
            {games.map(game => (
              <option key={game} value={game}>{game}</option>
            ))}
          </select>
        </div>

        {/* Graph Visualization */}
        <div className="graph-canvas" ref={canvasRef}>
          
          {/* SVG za zakrivljene linije */}
          <svg className="connection-svg" width="100%" height="100%">
            {currentConnections.map(connection => {
              const path = createCurvedPath(
                50, // You center X
                50, // You center Y
                connection.x,
                connection.y
              );
              return (
                <path
                  key={connection.id}
                  d={path}
                  fill="none"
                  stroke="rgba(0, 255, 0, 0.6)"
                  strokeWidth="3"
                  className="svg-line"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {/* Central Node (You) */}
          <div className="node node-center">
            <div className="node-avatar">👤</div>
            <div className="node-name">You</div>
          </div>

          {/* Friend Nodes (Draggable) */}
          {currentConnections.map(connection => (
            <div 
              key={connection.id} 
              className={`node ${dragging === connection.id ? 'dragging' : ''}`}
              style={{
                left: `${connection.x}%`,
                top: `${connection.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'grab'
              }}
              onMouseDown={(e) => handleMouseDown(e, connection.id)}
            >
              <div className="node-avatar">🎮</div>
              <div className="node-name">{connection.name}</div>
            </div>
          ))}

          {/* Empty State */}
          {currentConnections.length === 0 && (
            <div className="empty-state">
              <p>No connections found for this game</p>
            </div>
          )}
        </div>

        {/* Connection Count */}
        <div className="connection-info">
          <p>
            You have <span className="count">{currentConnections.length}</span> 
            {currentConnections.length === 1 ? ' connection' : ' connections'} 
            in <span className="game-name">{selectedGame}</span>
          </p>
          <p className="hint">💡 Drag nodes to rearrange the graph</p>
        </div>

      </div>
    </div>
  );
}

export default SocialGraph;
