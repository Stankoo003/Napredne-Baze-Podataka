import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileCard, TopicCard, EmptyState } from './SearchResultCard';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchResults, setSearchResults] = useState({ users: [], topics: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [joystickOffset, setJoystickOffset] = useState(0);
  const searchResultsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (searchResultsRef.current && searchQuery.length >= 2) {
      const height = searchResultsRef.current.scrollHeight;
      setJoystickOffset(height + 30);
    } else {
      setJoystickOffset(0);
    }
  }, [searchResults, searchQuery, activeTab]);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults({ users: [], topics: [] });
      return;
    }

    setIsSearching(true);
    
    try {
      const [usersRes, topicsRes] = await Promise.all([
        fetch(`http://localhost:3001/api/users/search?q=${query}`),
        fetch(`http://localhost:3001/api/topics/search?q=${query}`)
      ]);

      const usersData = await usersRes.json();
      const topicsData = await topicsRes.json();

      setSearchResults({
        users: usersData.users || [],
        topics: topicsData.topics || []
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({ users: [], topics: [] });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
    clearSearch();
  };

  const handleTopicClick = (topicId) => {
    navigate(`/forum/${topicId}`);
    clearSearch();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults({ users: [], topics: [] });
  };

  const getFilteredResults = () => {
    if (activeTab === 'users') return { users: searchResults.users, topics: [] };
    if (activeTab === 'topics') return { users: [], topics: searchResults.topics };
    return searchResults;
  };

  const filtered = getFilteredResults();
  const hasResults = filtered.users.length > 0 || filtered.topics.length > 0;
  const totalResults = searchResults.users.length + searchResults.topics.length;

  return (
    <div className="app">
      <div className="scanlines"></div>

      <svg className="wave-decoration" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" preserveAspectRatio="none">
      <defs>
        <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'rgba(0, 255, 0, 0.4)', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: 'rgba(0, 255, 0, 0.2)', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'rgba(0, 255, 0, 0.1)', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <path 
        className="wave-path"
        d="M 0,900 Q 150,850 300,880 T 600,860 T 900,890 T 1200,850" 
        fill="none" 
        stroke="url(#waveGradient)" 
        strokeWidth="3"
        filter="url(#glow)"
      />
      
      <path 
        className="wave-path-2"
        d="M 0,920 Q 150,870 300,900 T 600,880 T 900,910 T 1200,870" 
        fill="none" 
        stroke="rgba(0, 255, 0, 0.15)" 
        strokeWidth="2"
        filter="url(#glow)"
      />
    </svg>
      
      <nav className="navbar">
        <div className="nav-logo">
          <span className="logo-icon-nav">🎮</span>
          <span className="logo-text-nav">Play<span className="highlight">Track</span></span>
        </div>
        
        <div className="nav-links">
          {currentUser ? (
            <button className="nav-btn profile-btn" onClick={() => navigate('/profile')}>
              👤 {currentUser.username}
            </button>
          ) : (
            <>
              <button className="nav-btn" onClick={() => navigate('/login')}>
                Login
              </button>
              <button className="nav-btn signup-nav-btn" onClick={() => navigate('/signup')}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>
      
      <div className="container">        
        <header className="header">
          <div className="logo">
            <span className="logo-icon">🎮</span>
            <h1 className="logo-text">
              Play<span className="highlight">Track</span>
            </h1>
          </div>
          <p className="tagline">Find Your Next Gaming Obsession</p>
        </header>

        <section className="hero">
          <div className="hero-content">
            <h2 className="hero-title">
              Discover Games Through Your
              <span className="neon-text"> Social Network</span>
            </h2>
            <p className="hero-description">
              PlayTrack uses Neo4j graph database to analyze your gaming social circle 
              and recommend titles loved by your friends and players with similar taste.
            </p>

            <div className="hero-search-container">
              <div className="search-bar-wrapper">
                <span className="search-icon-input">🔍</span>
                <input 
                  type="text"
                  className="hero-search-input"
                  placeholder="Search for gamers, topics, discussions..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {isSearching && <div className="search-loader">⏳</div>}
              </div>

              {searchQuery.length >= 2 && (
                <div className="search-tabs">
                  <button 
                    className={`search-tab ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    All ({totalResults})
                  </button>
                  <button 
                    className={`search-tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                  >
                    👤 Players ({searchResults.users.length})
                  </button>
                  <button 
                    className={`search-tab ${activeTab === 'topics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('topics')}
                  >
                    💬 Topics ({searchResults.topics.length})
                  </button>
                </div>
              )}

              {searchQuery.length >= 2 && hasResults && (
                <div className="hero-search-results" ref={searchResultsRef}>
                  {filtered.users.map(user => (
                    <ProfileCard 
                      key={`user-${user.username}`}
                      user={user}
                      onClick={() => handleUserClick(user.username)}
                    />
                  ))}

                  {filtered.topics.map(topic => (
                    <TopicCard
                      key={`topic-${topic.id}`}
                      topic={topic}
                      onClick={() => handleTopicClick(topic.id)}
                    />
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !hasResults && !isSearching && (
                <div className="hero-search-results" ref={searchResultsRef}>
                  <EmptyState query={searchQuery} type={activeTab} />
                </div>
              )}
            </div>

            {!currentUser && (
              <div className="cta-buttons">
                <button className="btn btn-primary" onClick={() => window.location.href = '/login'}>
                  Start Exploring
                </button>
                <button className="btn btn-secondary">Learn More</button>
              </div>
            )}
          </div>

          <div 
            className="joystick-visual"
            style={{
              transform: joystickOffset > 0 ? `translateY(${joystickOffset}px)` : 'translateY(0)',
              marginTop: joystickOffset > 0 ? `${joystickOffset}px` : '0'
            }}
          >
            <div className="joystick">🕹️</div>
          </div>
        </section>

        <section className="features">
          <div className="feature-card" onClick={() => navigate('/social-graph')}>
            <div className="feature-icon">🔗</div>
            <h3>Social Graph</h3>
            <p>Connect with gamers & track relationships</p>
          </div>   
          <div className="feature-card" onClick={() => navigate('/forum')}>
            <div className="feature-icon">💬</div>
            <h3>Gaming Forum</h3>
            <p>Discuss games, news & join the community</p>
          </div>
        </section>

        <footer className="footer">
          <p>Powered by <span className="tech-badge">Neo4j</span> × <span className="tech-badge">React</span></p>
        </footer>

      </div>
    </div>
  );
}

export default App;
