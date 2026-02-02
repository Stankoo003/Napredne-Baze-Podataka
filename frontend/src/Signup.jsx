import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Signup.css';

function Signup() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('http://localhost:3001/api/players', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        age: parseInt(formData.age) || 18
      });

      console.log('Signup success:', response.data);

      localStorage.setItem('currentUser', JSON.stringify({
        username: response.data.player.username,
        email: response.data.player.email,
        age: response.data.player.age
      }));

      alert(`Welcome to PlayTrack, ${formData.username}! 🎮`);
      navigate('/'); 

    } catch (err) {
      console.error('Signup error:', err);
      
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
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

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="signup-form">
            <div className="input-group">
              <label htmlFor="username">Username *</label>
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
              <label htmlFor="email">Email *</label>
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
              <label htmlFor="age">Age (optional)</label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="18"
                min="13"
                max="120"
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Password *</label>
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
              <label htmlFor="confirmPassword">Confirm Password *</label>
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

            <button 
              type="submit" 
              className="btn btn-signup"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
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
