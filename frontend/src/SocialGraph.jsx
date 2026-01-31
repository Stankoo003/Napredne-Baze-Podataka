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
  const [players, setPlayers] = useState([]);
  const [peerConnections, setPeerConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [dragging, setDragging] = useState(null);
  const [centerPosition, setCenterPosition] = useState({ x: 50, y: 50 });
  const [nodePositions, setNodePositions] = useState({});

  // Učitaj korisnika i igre
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

  // Fetch sve igre iz baze
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

  // Fetch konekcije za odabranu igru
  useEffect(() => {
    if (selectedGame && currentUser) {
      fetchConnectionsForGame(selectedGame);
    }
  }, [selectedGame, currentUser]);

  const fetchConnectionsForGame = async (gameTitle) => {
    try {
      setLoading(true);
      
      const response = await axios.post('http://localhost:3001/api/social-graph', {
        username: currentUser.username,
        gameTitle: gameTitle
      });

      const playersData = response.data.players || [];
      const connectionsData = response.data.connections || [];
      
      // Generiši pozicije za sve igrače u krug
      const positions = {};
      playersData.forEach((player, index) => {
        const angle = (index / playersData.length) * 2 * Math.PI;
        const radius = 35; // procenat od centra
        positions[player.username] = {
          id: index + 1,
          name: player.username,
          x: 50 + radius * Math.cos(angle),
          y: 50 + radius * Math.sin(angle)
        };
      });

      setNodePositions(positions);
      setPlayers(playersData);
      setPeerConnections(connectionsData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching connections:', err);
      setError('Failed to load social graph');
      setLoading(false);
    }
  };

  const createCurvedPath = (x1, y1, x2, y2, seed = 0) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const randomFactor = Math.sin(seed * 12.9898) * 0.3;
    const direction = seed % 2 === 0 ? 1 : -1;
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
        [dragging]: { ...prev[dragging], x: clampedX, y: clampedY }
      }));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  if (loading) {
    return (
      <div className="social-graph-page">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#00ff00', fontSize: '2rem' }}>
          🎮 Loading social graph...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="social-graph-page">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#ff5050', fontSize: '1.5rem' }}>
          ❌ {error}
        </div>
      </div>
    );
  }

  const currentConnections = Object.values(nodePositions);

  return (
    <div 
      className="social-graph-page" 
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <button className="back-btn" onClick={() => navigate('/')}>← Back</button>

      <div className="graph-header">
        <h1>🎮 Social <span className="highlight">Graph</span></h1>
        <p className="graph-subtitle">Gaming Network Visualization (Depth 3)</p>
      </div>

      <div className="game-selector">
        <label>Select Game:</label>
        <select 
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

      <div className="social-graph-container" ref={canvasRef}>
        <div className="graph-canvas">
          {/* SVG Linije */}
          <svg className="connection-svg">
            {/* Linije od trenutnog korisnika ka drugima */}
            {peerConnections
              .filter(conn => conn.from === currentUser.username)
              .map((conn, idx) => {
                const toNode = nodePositions[conn.to];
                if (!toNode) return null;
                return (
                  <path
                    key={`from-center-${idx}`}
                    className="svg-line"
                    d={createCurvedPath(
                      centerPosition.x + '%',
                      centerPosition.y + '%',
                      toNode.x + '%',
                      toNode.y + '%',
                      idx
                    )}
                    fill="none"
                    stroke="#00ff00"
                    strokeWidth="3"
                    opacity="0.8"
                  />
                );
              })}

            {/* Linije između ostalih igrača (peer-to-peer) */}
            {peerConnections
              .filter(conn => conn.from !== currentUser.username && conn.to !== currentUser.username)
              .map((conn, idx) => {
                const fromNode = nodePositions[conn.from];
                const toNode = nodePositions[conn.to];
                if (!fromNode || !toNode) return null;
                return (
                  <path
                    key={`peer-${idx}`}
                    className="svg-line svg-line-peer"
                    d={createCurvedPath(
                      fromNode.x + '%',
                      fromNode.y + '%',
                      toNode.x + '%',
                      toNode.y + '%',
                      idx + 100
                    )}
                    fill="none"
                    stroke="#00aa00"
                    strokeWidth="2"
                    opacity="0.4"
                  />
                );
              })}
          </svg>

          {/* Centralni node (trenutni korisnik) */}
          {currentUser && (
            <div
              className="node node-center"
              style={{ 
                left: `${centerPosition.x}%`, 
                top: `${centerPosition.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'center')}
            >
              <div className="node-avatar">👤</div>
              <div className="node-name">{currentUser.username} (You)</div>
            </div>
          )}

          {/* Ostali nodovi */}
          {currentConnections.map((node) => (
            <div
              key={node.name}
              className="node"
              style={{ 
                left: `${node.x}%`, 
                top: `${node.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseDown={(e) => handleMouseDown(e, node.name)}
            >
              <div className="node-avatar">🎮</div>
              <div className="node-name">{node.name}</div>
            </div>
          ))}

          {currentConnections.length === 0 && (
            <div className="empty-state">
              No players found for this game in your network
            </div>
          )}
        </div>
      </div>

      <div className="connection-info">
        <p>
          You have <span className="count">{currentConnections.length}</span> 
          {currentConnections.length === 1 ? ' connection' : ' connections'} in{' '}
          <span className="game-name">{selectedGame}</span>
        </p>
        <p className="hint">💡 Green lines = Your follows | Darker lines = Peer connections</p>
      </div>
    </div>
  );
}

export default SocialGraph;
