import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import TopBar from './components/TopBar';
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


      // Group connections by depth
      const groupedByDepth = {
        1: connectionsData.filter(c => c.depth === 1),
        2: connectionsData.filter(c => c.depth === 2),
        3: connectionsData.filter(c => c.depth === 3)
      };


      // Position nodes in circular layout
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


  const createCurvedPath = (x1, y1, x2, y2, seed = 0) => {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const randomFactor = Math.sin(seed * 12.9898) * 0.3;
    const direction = seed % 2 === 0 ? 1 : -1;
    const offsetX = (y2 - y1) * (0.15 + randomFactor) * direction;
    const offsetY = (x1 - x2) * (0.15 + randomFactor) * direction;


    return `M ${x1} ${y1} Q ${midX + offsetX} ${midY + offsetY}, ${x2} ${y2}`;
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


  const getMedalEmoji = (depth) => {
    if (depth === 1) return '🥇';
    if (depth === 2) return '🥈';
    if (depth === 3) return '🥉';
    return '👤';
  };


  if (loading && games.length === 0) {
    return (
      <div className="social-graph-page">
        <TopBar />
        <div className="social-graph-container">
          <div className="graph-header">
            <h1>Loading...</h1>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="social-graph-page">
      <TopBar />
      
      <button className="back-btn" onClick={() => navigate('/home')}>
        ← Back to Home
      </button>


      <div className="social-graph-container">
        <div className="graph-header">
          <h1>
            Social <span className="highlight">Graph</span>
          </h1>
          <p className="graph-subtitle">Network Visualization</p>
        </div>


        <div className="game-selector">
          <label htmlFor="game-select">Select Game:</label>
          <select
            id="game-select"
            className="game-dropdown"
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
          >
            {games.map((game) => (
              <option key={game.title} value={game.title}>
                {game.title}
              </option>
            ))}
          </select>
        </div>


        <div
          ref={canvasRef}
          className={`graph-canvas ${dragging ? 'dragging' : ''}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ transform: `scale(${zoom})` }}
        >
          {connections.length === 0 ? (
            <div className="empty-state">
              <h2>No connections found for this game</h2>
              <p>Follow other players who play {selectedGame}</p>
            </div>
          ) : (
            <>
              <svg 
                className="connection-svg" 
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ zIndex: 1 }}
              >
                {connections.map((conn, idx) => {
                  const targetPos = nodePositions[conn.username];
                  if (!targetPos) return null;

                  const x1 = centerPosition.x;
                  const y1 = centerPosition.y;
                  const x2 = targetPos.x;
                  const y2 = targetPos.y;

                  const pathData = createCurvedPath(x1, y1, x2, y2, idx);

                  return (
                    <path
                      key={`direct-${conn.username}-${idx}`}
                      d={pathData}
                      className="svg-line"
                      fill="none"
                    />
                  );
                })}

                {edges.map((edge, idx) => {
                  const fromPos = nodePositions[edge.from];
                  const toPos = nodePositions[edge.to];

                  if (!fromPos || !toPos) return null;

                  const x1 = fromPos.x;
                  const y1 = fromPos.y;
                  const x2 = toPos.x;
                  const y2 = toPos.y;

                  const pathData = createCurvedPath(x1, y1, x2, y2, idx + 1000);

                  return (
                    <path
                      key={`peer-${edge.from}-${edge.to}-${idx}`}
                      d={pathData}
                      className="svg-line-peer"
                      fill="none"
                    />
                  );
                })}
              </svg>

              <div
                className="node node-center"
                style={{
                  left: `${centerPosition.x}%`,
                  top: `${centerPosition.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                onMouseDown={(e) => handleMouseDown(e, 'center')}
              >
                <div className="node-avatar">
                  {currentUser?.avatar ? (
                    <img 
                      src={`http://localhost:3001${currentUser.avatar}`}
                      alt={currentUser.username}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    '👤'
                  )}
                </div>
                <div className="node-name">
                  {currentUser?.username || 'YOU'}
                </div>
              </div>

              {connections.map((conn) => {
                const pos = nodePositions[conn.username];
                if (!pos) return null;

                return (
                  <div
                    key={conn.username}
                    className="node"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, conn.username)}
                  >
                    <div className="node-avatar">
                      {conn.avatar ? (
                        <img 
                          src={`http://localhost:3001${conn.avatar}`}
                          alt={conn.username}
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        getMedalEmoji(conn.depth)
                      )}
                    </div>
                    <div className="node-name">{conn.username}</div>
                    <div className="node-depth-badge">L{conn.depth}</div>
                  </div>
                );
              })}
            </>
          )}
        </div>


        {connections.length > 0 && (
          <div className="connection-info">
            <p>
              You have <span className="count">{connections.length}</span>{' '}
              {connections.length === 1 ? 'connection' : 'connections'} for{' '}
              <span className="game-name">{selectedGame}</span>
            </p>
            <p className="hint">
              💡 Bright green lines = Direct follows | Lighter lines = Peer connections
            </p>
            <p className="hint">
              🔢 L1 = Direct follows | L2 = Friends of friends | L3 = Extended network
            </p>
            <p className="hint">
              🖱️ Scroll to zoom | Drag nodes to reposition
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


export default SocialGraph;
