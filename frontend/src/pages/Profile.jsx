import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Profile.css';

function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('games'); // games, friends, activity
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    setCurrentUser(user);
    fetchProfileData();
  }, [userId]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      // Mock data - kasnije iz backend-a
      const mockProfile = {
        id: userId,
        username: 'Marko',
        avatar: '🎮',
        bio: 'Competitive gamer | CS2 & Valorant enthusiast | Streaming occasionally',
        joinedDate: 'January 2024',
        stats: {
          gamesPlayed: 47,
          friends: 128,
          totalRatings: 89,
          avgRating: 4.3,
          hoursPlayed: 1247
        },
        recentGames: [
          { id: 1, name: 'Counter-Strike 2', rating: 5, hours: 340 },
          { id: 2, name: 'Valorant', rating: 4, hours: 230 },
          { id: 3, name: 'League of Legends', rating: 4, hours: 180 },
          { id: 4, name: 'Dota 2', rating: 3, hours: 120 }
        ],
        friends: [
          { id: 2, username: 'Stefan', avatar: '🎯' },
          { id: 3, username: 'Ana', avatar: '🎨' },
          { id: 4, username: 'Janko', avatar: '⚡' },
          { id: 5, username: 'Nikola', avatar: '🔥' }
        ],
        activities: [
          { id: 1, type: 'rating', text: 'Rated CS2', time: '2 hours ago' },
          { id: 2, type: 'friend', text: 'Added Stefan as friend', time: '1 day ago' },
          { id: 3, type: 'achievement', text: 'Unlocked 100 hours in Valorant', time: '2 days ago' }
        ]
      };

      setProfileUser(mockProfile);
      // Check if current user follows this profile
      setIsFollowing(false); // Mock - proveri iz backend-a
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      // API call za follow/unfollow
      const endpoint = isFollowing ? '/api/users/unfollow' : '/api/users/follow';
      await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profileUser.id })
      });

      setIsFollowing(!isFollowing);
      // Update stats
      setProfileUser(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          friends: prev.stats.friends + (isFollowing ? -1 : 1)
        }
      }));
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-screen">
          <div className="loader">⏳</div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="profile-page">
        <div className="error-screen">
          <h2>User not found</h2>
          <button onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profileUser.id;

  return (
    <div className="profile-page">
      <div className="scanlines"></div>

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={() => navigate('/')}>
          <span className="logo-icon-nav">🎮</span>
          <span className="logo-text-nav">Play<span className="highlight">Track</span></span>
        </div>
        <button className="nav-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </nav>

      <div className="profile-container">
        
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-banner"></div>
          
          <div className="profile-info-section">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar">{profileUser.avatar}</div>
              <div className="online-indicator"></div>
            </div>

            <div className="profile-main-info">
              <h1 className="profile-username">{profileUser.username}</h1>
              <p className="profile-joined">Joined {profileUser.joinedDate}</p>
              {profileUser.bio && <p className="profile-bio">{profileUser.bio}</p>}
            </div>

            <div className="profile-actions">
              {!isOwnProfile && (
                <button 
                  className={`follow-btn ${isFollowing ? 'following' : ''}`}
                  onClick={handleFollowToggle}
                >
                  {isFollowing ? (
                    <>
                      <span className="btn-icon">✓</span>
                      Following
                    </>
                  ) : (
                    <>
                      <span className="btn-icon">+</span>
                      Follow
                    </>
                  )}
                </button>
              )}
              {isOwnProfile && (
                <button className="edit-profile-btn" onClick={() => navigate('/settings')}>
                  <span className="btn-icon">⚙️</span>
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🎮</div>
            <div className="stat-value">{profileUser.stats.gamesPlayed}</div>
            <div className="stat-label">Games Played</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{profileUser.stats.friends}</div>
            <div className="stat-label">Friends</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-value">{profileUser.stats.totalRatings}</div>
            <div className="stat-label">Ratings</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-value">{profileUser.stats.avgRating.toFixed(1)}</div>
            <div className="stat-label">Avg Rating</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-value">{profileUser.stats.hoursPlayed}</div>
            <div className="stat-label">Hours Played</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button 
            className={`tab-btn ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            🎮 Games
          </button>
          <button 
            className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            👥 Friends
          </button>
          <button 
            className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            📊 Activity
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          
          {/* Games Tab */}
          {activeTab === 'games' && (
            <div className="games-list">
              {profileUser.recentGames.map(game => (
                <div key={game.id} className="game-item">
                  <div className="game-icon">🎮</div>
                  <div className="game-info">
                    <h3 className="game-name">{game.name}</h3>
                    <p className="game-hours">{game.hours} hours played</p>
                  </div>
                  <div className="game-rating">
                    <span className="rating-stars">{'⭐'.repeat(game.rating)}</span>
                    <span className="rating-value">{game.rating}/5</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="friends-grid">
              {profileUser.friends.map(friend => (
                <div 
                  key={friend.id} 
                  className="friend-card"
                  onClick={() => navigate(`/profile/${friend.id}`)}
                >
                  <div className="friend-avatar">{friend.avatar}</div>
                  <div className="friend-name">{friend.username}</div>
                </div>
              ))}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="activity-list">
              {profileUser.activities.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'rating' && '⭐'}
                    {activity.type === 'friend' && '👥'}
                    {activity.type === 'achievement' && '🏆'}
                  </div>
                  <div className="activity-content">
                    <p className="activity-text">{activity.text}</p>
                    <span className="activity-time">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default Profile;
