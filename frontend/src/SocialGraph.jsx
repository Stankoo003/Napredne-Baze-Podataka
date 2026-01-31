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
  const [centerPosition, setCenterPosition] = useState({ x: 50, y: 50 });

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

  const peerConnectionsByGame = {
    'League of Legends': [
      { from: 1, to: 2 },
      { from: 2, to: 4 },
      { from: 3, to: 4 }
    ],
    'World of Warcraft': [
      { from: 2, to: 5 },
      { from: 5, to: 6 }
    ],
    'CS:GO': [
      { from: 3, to: 7 },
      { from: 7, to: 8 }
    ],
    'Minecraft': [
      { from: 4, to: 9 }
    ],
    'Valorant': [
      { from: 1, to: 10 },
      { from: 10, to: 11 }
    ],
    'Dota 2': [
      { from: 12, to: 13 }
    ]
  };

  const [nodePositions, setNodePositions] = useState(initialConnectionsByGame);
  const currentConnections = nodePositions[selectedGame] || [];
  const currentPeerConnections = peerConnectionsByGame[selectedGame] || [];

  const createCurvedPath = (x1, y1, x2, y2, seed = 0) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    
    // Random offset baziran na seed-u (ali konzistentan za istu liniju)
    const randomFactor = Math.sin(seed * 12.9898) * 0.3; // -0.3 do 0.3
    const direction = seed % 2 === 0 ? 1 : -1; // Naizmenice lijevo/desno
    
    const offsetX = (y2 - y1) * (0.15 + randomFactor) * direction;
    const offsetY = (x1 - x2) * (0.15 + randomFactor) * direction;
    
    return `M ${x1} ${y1} Q ${midX + offsetX} ${midY + offsetY}, ${x2} ${y2}`;
  };

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
    
    const clampedX = Math.max(5, Math.min(95, x));
    const clampedY = Math.max(5, Math.min(95, y));
    
    if (dragging === 'center') {
      setCenterPosition({ x: clampedX, y: clampedY });
    } else {
      setNodePositions(prev => ({
        ...prev,
        [selectedGame]: prev[selectedGame].map(node =>
          node.id === dragging 
            ? { ...node, x: clampedX, y: clampedY }
            : node
        )
      }));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const findNodeById = (id) => {
    return currentConnections.find(node => node.id === id);
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
        
        <header className="graph-header">
          <h1>🔗 Social <span className="highlight">Graph</span></h1>
          <p className="graph-subtitle">Discover your gaming connections</p>
        </header>

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

        <div className="graph-canvas" ref={canvasRef}>
          
          <svg 
            className="connection-svg" 
            width="100%" 
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Linije od centra ka prijateljima */}
            {currentConnections.map(connection => {
              const path = createCurvedPath(
                centerPosition.x,
                centerPosition.y,
                connection.x,
                connection.y,
                connection.id  // Seed za konzistentno zakrivljenje
              );
              
              return (
                <path
                  key={`center-${connection.id}`}
                  d={path}
                  fill="none"
                  stroke="rgba(0, 255, 0, 0.6)"
                  strokeWidth="0.3"
                  className="svg-line"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Linije između prijatelja */}
            {currentPeerConnections.map((peerConn, index) => {
              const nodeFrom = findNodeById(peerConn.from);
              const nodeTo = findNodeById(peerConn.to);
              
              if (!nodeFrom || !nodeTo) return null;
              
              const path = createCurvedPath(
                nodeFrom.x,
                nodeFrom.y,
                nodeTo.x,
                nodeTo.y,
                peerConn.from + peerConn.to  // Seed za peer connections
              );
              
              return (
                <path
                  key={`peer-${index}`}
                  d={path}
                  fill="none"
                  stroke="rgba(150, 255, 150, 0.7)"
                  strokeWidth="0.4"
                  className="svg-line-peer"
                  strokeDasharray="3 2"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {/* Central Node */}
          <div 
            className={`node node-center ${dragging === 'center' ? 'dragging' : ''}`}
            style={{
              left: `${centerPosition.x}%`,
              top: `${centerPosition.y}%`,
              transform: 'translate(-50%, -50%)',
              cursor: 'grab'
            }}
            onMouseDown={(e) => handleMouseDown(e, 'center')}
          >
            <div className="node-avatar">👤</div>
            <div className="node-name">You</div>
          </div>

          {/* Friend Nodes */}
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

          {currentConnections.length === 0 && (
            <div className="empty-state">
              <p>No connections found for this game</p>
            </div>
          )}
        </div>

        <div className="connection-info">
          <p>
            You have <span className="count">{currentConnections.length}</span> 
            {currentConnections.length === 1 ? ' connection' : ' connections'} 
            in <span className="game-name">{selectedGame}</span>
          </p>
          <p className="hint">💡 Drag any node to rearrange the graph</p>
        </div>

      </div>
    </div>
  );
}

export default SocialGraph;
