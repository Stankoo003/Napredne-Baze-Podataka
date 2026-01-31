import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Signup.css';

function Signup() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignup = (e) => {
    e.preventDefault();
    
    // Validacija lozinki
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    // Ovde ćeš kasnije dodati API poziv ka backendu
    console.log('Signup:', formData);
    alert(`Welcome to PlayTrack, ${formData.username}!`);
    // navigate('/login'); // Posle registracije ide na login
  };

  return (
    <div className="signup-page">
      <div className="scanlines"></div>
      
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Back to Home
      </button>

      <div className="signup-container">
        <div className="signup-box">
          <div className="signup-header">
            <span className="signup-icon">🎮</span>
            <h1>Play<span className="highlight">Track</span></h1>
            <p className="signup-subtitle">Join the Gaming Network</p>
          </div>

          <form onSubmit={handleSignup} className="signup-form">
            <div className="input-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="ProGamer123"
                required
                minLength="3"
              />
            </div>

            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="gamer@playtrack.com"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                minLength="6"
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                minLength="6"
              />
            </div>

            <button type="submit" className="btn btn-signup">
              Create Account
            </button>
          </form>

          <div className="signup-footer">
            <p>Already have an account? <span className="link" onClick={() => navigate('/login')}>Login</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;

