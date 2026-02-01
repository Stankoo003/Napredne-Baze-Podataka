import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './SocialGraph.css';

function SocialGraph() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState('');
  const [connections, setConnections] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [nodePositions, setNodePositions] = useState({});
  const [centerPosition, setCenterPosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
      alert('You must be logged in!');
      navigate('/login');
      return;
    }
    setCurrentUser(user);
    fetchGames();
  }, [navigate]);

  const fetchGames = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/games');
      setGames(response.data);
      if (response.data.length > 0) {
        setSelectedGame(response.data[0].title);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching games:', err);
      setError('Failed to load games');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGame && currentUser) {
      fetchNetworkConnections(currentUser.username, selectedGame);
    }
  }, [selectedGame, currentUser]);

  const fetchNetworkConnections = async (username, gameTitle) => {
    try {
      setLoading(true);
      const response = await axios.post('http://localhost:3001/api/social-graph/depth', {
        username: username,
        gameTitle: gameTitle
      });

      const connectionsData = response.data.connections || [];
      const edgesData = response.data.edges || [];

      const groupedByDepth = {
        1: connectionsData.filter(c => c.depth === 1),
        2: connectionsData.filter(c => c.depth === 2),
        3: connectionsData.filter(c => c.depth === 3)
      };

      const positions = {};
      const centerX = 50;
      const centerY = 50;
      
      Object.keys(groupedByDepth).forEach(depth => {
        const nodes = groupedByDepth[depth];
        if (nodes.length === 0) return;
        
        const depthInt = parseInt(depth);
        const radius = 18 + (depthInt * 10);
        
        nodes.forEach((node, index) => {
          const angle = (index / nodes.length) * 2 * Math.PI - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          
          positions[node.username] = {
            name: node.username,
            depth: node.depth,
            x: x,
            y: y
          };
        });
      });

      setNodePositions(positions);
      setConnections(connectionsData);
      setEdges(edgesData);
      setCenterPosition({ x: 50, y: 50 });
      setLoading(false);
      setZoom(1);
    } catch (err) {
      console.error('Error fetching network:', err);
      setError('Failed to load social network');
      setLoading(false);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const delta = -e.deltaY * zoomSpeed;
    setZoom(prevZoom => Math.min(Math.max(0.5, prevZoom + delta), 2.5));
  };

  const handleMouseDown = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(nodeId);
  };

  const handleMouseMove = (e) => {
    if (dragging === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(10, Math.min(90, x));
    const clampedY = Math.max(10, Math.min(90, y));

    if (dragging === 'center') {
      setCenterPosition({ x: clampedX, y: clampedY });
    } else {
      setNodePositions(prev => ({
        ...prev,
        [dragging]: {
          ...prev[dragging],
          x: clampedX,
          y: clampedY
        }
      }));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  if (loading && games.length === 0) {
    return (
      <div className="social-graph-page">
        <div className="scanlines"></div>
        <button className="back-btn" onClick={() => navigate('/')}>
          Back to Home
        </button>
        <div className="social-graph-container">
          <div className="graph-header">
            <h1>
              Social <span className="highlight">Network</span>
            </h1>
            <p className="graph-subtitle">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="social-graph-page">
        <div className="scanlines"></div>
        <button className="back-btn" onClick={() => navigate('/')}>
          Back to Home
        </button>
        <div className="social-graph-container">
          <div className="graph-header">
            <h1>
              Social <span className="highlight">Network</span>
            </h1>
            <p className="graph-subtitle" style={{ color: '#ff4444' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const myEdges = edges.filter(e => e.from === currentUser?.username);
  const peerEdges = edges.filter(e => e.from !== currentUser?.username);

  return (
    <div className="social-graph-page">
      <div className="scanlines"></div>
      
      <button className="back-btn" onClick={() => navigate('/')}>
        Back to Home
      </button>

      <div className="social-graph-container">
        <div className="graph-header">
          <h1>
            Social <span className="highlight">Network</span>
          </h1>
          <p className="graph-subtitle">Gaming Connections (Max Depth 3)</p>
        </div>

        <div className="game-selector">
          <label htmlFor="game-select">Select Game:</label>
          <select
            id="game-select"
            className="game-dropdown"
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
          >
            {games.map(game => (
              <option key={game.title} value={game.title}>
                {game.title}
              </option>
            ))}
          </select>
        </div>

        <div className="zoom-controls">
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}>+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>-</button>
        </div>

        <div
          className="graph-canvas"
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div 
            className="graph-viewport"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center'
            }}
          >
           <svg className="connection-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
  {myEdges.map((edge, idx) => {
    const targetPos = nodePositions[edge.to];
    if (!targetPos) return null;

    const x1 = centerPosition.x;
    const y1 = centerPosition.y;
    const x2 = targetPos.x;
    const y2 = targetPos.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    
    // Radijusi u % (mora odgovarati veličini node avatara)
    const centerRadius = 2.8; // Centralni node (150px / ~5333px = ~2.8%)
    const targetRadius = 1.7; // Obični node (90px / ~5333px = ~1.7%)

    const startX = x1 + Math.cos(angle) * centerRadius;
    const startY = y1 + Math.sin(angle) * centerRadius;
    const endX = x2 - Math.cos(angle) * targetRadius;
    const endY = y2 - Math.sin(angle) * targetRadius;

    return (
      <line
        key={`my-edge-${idx}`}
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        className="svg-line"
        strokeWidth="0.5"
      />
    );
  })}

  {peerEdges.map((edge, idx) => {
    const fromPos = nodePositions[edge.from];
    const toPos = nodePositions[edge.to];
    if (!fromPos || !toPos) return null;

    const x1 = fromPos.x;
    const y1 = fromPos.y;
    const x2 = toPos.x;
    const y2 = toPos.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    
    const nodeRadius = 1.7;

    const startX = x1 + Math.cos(angle) * nodeRadius;
    const startY = y1 + Math.sin(angle) * nodeRadius;
    const endX = x2 - Math.cos(angle) * nodeRadius;
    const endY = y2 - Math.sin(angle) * nodeRadius;

    return (
      <line
        key={`peer-edge-${idx}`}
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        className="svg-line-peer"
        strokeWidth="0.3"
      />
    );
  })}
</svg>

            <div
              className={`node node-center ${dragging === 'center' ? 'dragging' : ''}`}
              style={{
                left: `${centerPosition.x}%`,
                top: `${centerPosition.y}%`
              }}
              onMouseDown={(e) => handleMouseDown(e, 'center')}
            >
              <div className="node-avatar">🎮</div>
              <div className="node-name">{currentUser?.username || 'You'}</div>
            </div>

            {Object.entries(nodePositions).map(([username, pos]) => (
              <div
                key={username}
                className={`node ${dragging === username ? 'dragging' : ''}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`
                }}
                onMouseDown={(e) => handleMouseDown(e, username)}
                onClick={() => navigate(`/profile/${username}`)}
              >
                <div className="node-avatar">👤</div>
                <div className="node-name">{username}</div>
                <div className="node-depth-badge">L{pos.depth}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="connection-info">
          <p>
            You have <span className="count">{connections.length}</span>{' '}
            {connections.length === 1 ? 'connection' : 'connections'} for{' '}
            <span className="game-name">{selectedGame}</span>
          </p>
          {connections.length > 0 && (
            <>
              <p className="hint">
                💡 Bright green lines = Your direct follows | Lighter lines = Peer connections
              </p>
              <p className="hint">
                🔢 L1 = Direct follows | L2 = Friends of friends | L3 = Extended network
              </p>
              <p className="hint">
                🖱️ Scroll to zoom | Drag nodes to reposition
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SocialGraph;
