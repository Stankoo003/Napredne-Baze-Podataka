import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Profile.css';


function Profile() {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();


  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!currentUser) {
      alert('You must be logged in to view profile!');
      navigate('/login');
      return;
    }


    fetchProfile(currentUser.username);
  }, [navigate]);


  const fetchProfile = async (username) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/players/${username}/profile`);
      setProfileData(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError('Failed to load profile data');
      setLoading(false);
    }
  };


  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    alert('Logged out successfully!');
    navigate('/');
  };


  if (loading) {
    return (
      <div className="profile-page">
        <div className="scanlines"></div>
        <div className="loading-container">
          <div className="loading-spinner">🎮</div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }


  if (error || !profileData) {
    return (
      <div className="profile-page">
        <div className="scanlines"></div>
        <div className="error-container">
          <p className="error-text">⚠️ {error || 'Profile not found'}</p>
          <button className="btn-back" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }


  const { player, stats, favoriteGames, topRatedGames, friendsList } = profileData;


  return (
    <div className="profile-page">
      <div className="scanlines"></div>
      
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Back to Home
      </button>


      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar">
            <span className="avatar-icon">🎮</span>
          </div>
          <div className="profile-info">
            <h1 className="profile-username">
              {player.username}
            </h1>
            <p className="profile-email">{player.email}</p>
            <div className="profile-meta">
              <span className="meta-item">Age: {player.age || 'N/A'}</span>
              <span className="meta-separator">|</span>
              <span className="meta-item">Member since: {new Date(player.createdAt).toLocaleDateString()}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Logout 🚪
            </button>
          </div>
        </div>


        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.followsCount}</div>
            <div className="stat-label">Following</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-value">{stats.followersCount}</div>
            <div className="stat-label">Followers</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-value">{stats.ratedGamesCount}</div>
            <div className="stat-label">Games Rated</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value">{stats.averageRating}</div>
            <div className="stat-label">Avg Rating</div>
          </div>
        </div>


        <div className="profile-content">
          
          <div className="section-box">
            <h2 className="section-title">
              <span className="title-icon">🌟</span>
              Top Rated Games
            </h2>
            {topRatedGames.length > 0 ? (
              <div className="games-list">
                {topRatedGames.map((game, index) => (
                  <div key={index} className="game-item">
                    <div className="game-info">
                      <span className="game-title">{game.title}</span>
                      <span className="game-genre">{game.genre}</span>
                    </div>
                    <div className="game-rating">
                      {'⭐'.repeat(game.rating)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No rated games yet</p>
            )}
          </div>


          <div className="section-box">
            <h2 className="section-title">
              <span className="title-icon">💚</span>
              Favorite Games
            </h2>
            {favoriteGames.length > 0 ? (
              <div className="games-list">
                {favoriteGames.map((game, index) => (
                  <div key={index} className="game-item">
                    <div className="game-info">
                      <span className="game-title">{game.title}</span>
                      <span className="game-genre">{game.genre}</span>
                    </div>
                    <div className="favorite-badge">♥</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No favorite games yet</p>
            )}
          </div>


          <div className="section-box">
            <h2 className="section-title">
              <span className="title-icon">👥</span>
              Friends ({stats.followsCount})
            </h2>
            {friendsList.length > 0 ? (
              <div className="friends-list">
                {friendsList.map((friend, index) => (
                  <div key={index} className="friend-item">
                    <div className="friend-avatar">🎮</div>
                    <div className="friend-info">
                      <span className="friend-username">{friend.username}</span>
                      <span className="friend-email">{friend.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No friends yet. Start following gamers!</p>
            )}
          </div>


        </div>
      </div>
    </div>
  );
}


export default Profile;
