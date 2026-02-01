import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import TopBar from '../components/TopBar';
import './Profile.css';

function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('games');
  const [loading, setLoading] = useState(true);
  const [newRating, setNewRating] = useState({});

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    setCurrentUser(user);
    if (user) {
      const targetUsername = userId || user.username;
      fetchProfileData(targetUsername);
      if (userId && userId !== user.username) {
        checkFollowStatus(user.username, userId);
      }
    }
  }, [userId]);

  const fetchProfileData = async (username) => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:3001/api/players/${username}/profile`);
      const data = response.data;

      const allUserGames = data.allGames || [];
      const ratedGames = allUserGames.filter(g => g.rating !== null && g.rating !== undefined);
      const avgRating = ratedGames.length > 0
        ? ratedGames.reduce((sum, g) => sum + g.rating, 0) / ratedGames.length
        : 0;

      setProfileUser({
        username: data.player.username,
        email: data.player.email,
        avatar: '🎮',
        bio: data.player.bio || '',
        joinedDate: new Date(data.player.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        stats: {
          gamesPlayed: allUserGames.length || 0,
          friends: data.stats.followsCount || 0,
          totalRatings: ratedGames.length || 0,
          avgRating: avgRating
        },
        recentGames: allUserGames,
        friends: data.friendsList || [],
        activities: []
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async (username, targetUsername) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/players/${username}/is-following/${targetUsername}`);
      setIsFollowing(response.data.isFollowing);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      if (isFollowing) {
        await axios.post(`http://localhost:3001/api/players/${currentUser.username}/unfollow`, {
          targetUsername: profileUser.username
        });
      } else {
        await axios.post(`http://localhost:3001/api/players/${currentUser.username}/follow`, {
          targetUsername: profileUser.username
        });
      }
      setIsFollowing(!isFollowing);
      
      if (!userId || userId === currentUser.username) {
        fetchProfileData(currentUser.username);
      }
    } catch (error) {
      console.error('Follow error:', error);
      alert('Failed to update follow status');
    }
  };

  const handleRateGame = async (gameTitle, rating) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      await axios.post(`http://localhost:3001/api/players/${currentUser.username}/rate`, {
        gameTitle: gameTitle,
        rating: parseInt(rating)
      });
      alert(`Successfully rated ${gameTitle} with ${rating}/5`);
      fetchProfileData(currentUser.username);
      setNewRating({});
    } catch (error) {
      console.error('Rating error:', error);
      alert('Failed to rate game');
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
        <TopBar showBackButton={true} />
        <div className="loading-screen">
          <div className="loader">⏳</div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileUser) return null;

  const isOwnProfile = !userId || (currentUser && userId === currentUser.username);

  return (
    <div className="profile-page">
      <TopBar showBackButton={true} />
      <div className="scanlines"></div>

      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-banner"></div>
          
          <div className="profile-info-section">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar">
                {profileUser.avatar}
                <div className="online-indicator"></div>
              </div>
            </div>

            <div className="profile-main-info">
              <h1 className="profile-username">{profileUser.username}</h1>
              <p className="profile-joined">Joined {profileUser.joinedDate}</p>
              {profileUser.bio && <p className="profile-bio">{profileUser.bio}</p>}
            </div>

            <div className="profile-actions">
              {isOwnProfile ? (
                <>
                  <button className="edit-profile-btn" onClick={() => navigate('/edit-profile')}>
                    <span className="btn-icon">⚙️</span>
                    Edit Profile
                  </button>
                  <button className="logout-btn" onClick={handleLogout}>
                    <span className="btn-icon">🚪</span>
                    Logout
                  </button>
                </>
              ) : (
                <button
                  className={`follow-btn ${isFollowing ? 'following' : ''}`}
                  onClick={handleFollowToggle}
                >
                  <span className="btn-icon">{isFollowing ? '✓' : '+'}</span>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🎮</div>
            <div className="stat-value">{profileUser.stats.gamesPlayed}</div>
            <div className="stat-label">Games</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{profileUser.stats.friends}</div>
            <div className="stat-label">Connections</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-value">{profileUser.stats.totalRatings}</div>
            <div className="stat-label">Ratings</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-value">{profileUser.stats.avgRating.toFixed(1)}</div>
            <div className="stat-label">Avg Rating</div>
          </div>
        </div>

        <div className="profile-tabs">
          <button
            className={`tab-btn ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            Games
          </button>
          <button
            className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Friends
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'games' && (
            <div className="games-list">
              {profileUser.recentGames.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>
                  No games yet
                </p>
              ) : (
                profileUser.recentGames.map((game, index) => (
                  <div key={index} className="game-item">
                    <div className="game-icon">🎮</div>
                    <div className="game-info">
                      <h3 className="game-name">{game.title}</h3>
                      <p className="game-genre">{game.genre}</p>
                    </div>
                    <div className="game-rating">
                      {game.rating ? (
                        <>
                          <span className="rating-stars">
                            {'⭐'.repeat(game.rating)}
                          </span>
                          <span className="rating-value">{game.rating}/5</span>
                        </>
                      ) : (
                        <span className="no-rating">Not rated</span>
                      )}
                      
                      {isOwnProfile && (
                        <div className="rating-update">
                          <select
                            value={newRating[game.title] || ''}
                            onChange={(e) => setNewRating({ ...newRating, [game.title]: e.target.value })}
                          >
                            <option value="">Rate</option>
                            <option value="1">1⭐</option>
                            <option value="2">2⭐</option>
                            <option value="3">3⭐</option>
                            <option value="4">4⭐</option>
                            <option value="5">5⭐</option>
                          </select>
                          {newRating[game.title] && (
                            <button onClick={() => handleRateGame(game.title, newRating[game.title])}>
                              Save
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="friends-list">
              {profileUser.friends.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>
                  No connections yet
                </p>
              ) : (
                profileUser.friends.map((friend, index) => (
                  <div key={index} className="friend-item" onClick={() => navigate(`/profile/${friend.username}`)}>
                    <div className="friend-avatar">🎮</div>
                    <div className="friend-info">
                      <h3 className="friend-name">{friend.username}</h3>
                      <p className="friend-email">{friend.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
