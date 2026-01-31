import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    setCurrentUser(user);
  }, []);
  return (
    <div className="app">
  <div className="scanlines"></div>
  
  {/* Navigation Bar */}
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
        {/* Header sa logom */}
        <header className="header">
          <div className="logo">
            <span className="logo-icon">🎮</span>
            <h1 className="logo-text">
              Play<span className="highlight">Track</span>
            </h1>
          </div>
          <p className="tagline">Find Your Next Gaming Obsession</p>
        </header>

        {/* Hero sekcija */}
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
            <div className="cta-buttons">
               <button className="btn btn-primary" onClick={() => window.location.href = '/login'}>
                Start Exploring
              </button>
              <button className="btn btn-secondary">Learn More</button>
            </div>
          </div>

          {/* Interaktivni džojstik */}
          <div className="joystick-visual">
            <div className="joystick">🕹️</div>
          </div>
        </section>

        {/* Features */}
        <section className="features">
         <div className="feature-card" onClick={() => window.location.href = '/social-graph'}>
          <div className="feature-icon">🔗</div>
          <h3>Social Graph</h3>
          <p>Connect with gamers & track relationships</p>
          </div>   
          <div className="feature-card">
            <div className="feature-icon">⭐</div>
            <h3>Smart Ratings</h3>
            <p>Rate games & see friend reviews</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <p>Powered by <span className="tech-badge">Neo4j</span> × <span className="tech-badge">React</span></p>
        </footer>

      </div>
    </div>
  );
}

export default App;
