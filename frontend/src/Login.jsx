import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    // Ovde ćeš kasnije dodati API poziv ka backendu
    console.log('Login:', { email, password });
    alert(`Logged in as: ${email}`);
    // navigate('/dashboard'); // Kasnije kad napraviš dashboard
  };

  return (
    <div className="login-page">
      <div className="scanlines"></div>
      
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Back to Home
      </button>

      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <span className="login-icon">🎮</span>
            <h1>Play<span className="highlight">Track</span></h1>
            <p className="login-subtitle">Enter the Gaming Network</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gamer@playtrack.com"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn btn-login">
              Login
            </button>
          </form>

          <div className="login-footer">
            <p>Don't have an account? <span className="link" onClick={() => navigate('/signup')}>Sign up</span></p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Login;
