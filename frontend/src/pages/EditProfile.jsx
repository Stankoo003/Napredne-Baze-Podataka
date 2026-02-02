import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './EditProfile.css';

function EditProfile() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [allGames, setAllGames] = useState([]);
  const [userGames, setUserGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('avatar');
  const [showNewGameForm, setShowNewGameForm] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [selectedGame, setSelectedGame] = useState('');
  const [newGameData, setNewGameData] = useState({
    title: '',
    genre: '',
    releaseYear: new Date().getFullYear()
  });
  
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
      alert('You must be logged in!');
      navigate('/login');
      return;
    }
    setCurrentUser(user);
    fetchData(user.username);
  }, [navigate]);

  const fetchData = async (username) => {
    setLoading(true);
    try {
      const [gamesResponse, profileResponse, avatarResponse] = await Promise.all([
        axios.get('http://localhost:3001/api/games'),
        axios.get(`http://localhost:3001/api/players/${username}/profile`),
        axios.get(`http://localhost:3001/api/players/${username}/avatar`)
      ]);
      
      setAllGames(gamesResponse.data);
      const userGamesList = profileResponse.data.allGames;
      setUserGames(userGamesList.map(g => g.title));
      
      if (avatarResponse.data.avatar) {
        setAvatarPreview(`http://localhost:3001${avatarResponse.data.avatar}`);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setAllGames([]);
      setUserGames([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB!');
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !currentUser) return;
    
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    
    try {
      await axios.post(
        `http://localhost:3001/api/players/${currentUser.username}/upload-avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      alert('Profile picture updated successfully!');
      setAvatarFile(null);
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters!');
      return;
    }
    
    try {
      await axios.post(`http://localhost:3001/api/players/${currentUser.username}/change-password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      alert('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Password change error:', error);
      alert(error.response?.data?.error || 'Failed to change password');
    }
  };

  const handleGameSelection = (e) => {
    const value = e.target.value;
    if (value === 'addnew') {
      setShowNewGameForm(true);
      setSelectedGame('');
    } else {
      setSelectedGame(value);
      setShowNewGameForm(false);
    }
  };

  const handleAddSelectedGame = async () => {
    if (!selectedGame || !currentUser) return;
    
    if (userGames.includes(selectedGame)) {
      alert('You already have this game in your profile!');
      return;
    }
    
    try {
      await axios.post(`http://localhost:3001/api/players/${currentUser.username}/add-game`, {
        gameTitle: selectedGame
      });
      alert(`${selectedGame} added to your profile! You can rate it from your profile.`);
      navigate('/profile');
    } catch (error) {
      console.error('Add game error:', error);
      alert('Failed to add game');
    }
  };

  const handleCreateNewGame = async (e) => {
    e.preventDefault();
    
    if (!newGameData.title || !newGameData.genre) {
      alert('Please fill in all fields!');
      return;
    }
    
    const gameExists = allGames.some(game => 
      game.title.toLowerCase() === newGameData.title.toLowerCase()
    );
    
    if (gameExists) {
      alert('This game already exists in the database! Please select it from the dropdown.');
      return;
    }
    
    try {
      await axios.post('http://localhost:3001/api/games', {
        title: newGameData.title,
        genre: newGameData.genre,
        releaseYear: parseInt(newGameData.releaseYear)
      });
      
      await axios.post(`http://localhost:3001/api/players/${currentUser.username}/add-game`, {
        gameTitle: newGameData.title
      });
      
      alert(`${newGameData.title} created and added to your profile!`);
      navigate('/profile');
    } catch (error) {
      console.error('Create game error:', error);
      alert('Failed to create game');
    }
  };

  if (loading) {
    return (
      <div className="edit-profile-page">
        <div className="scanlines"></div>
        <div className="loading-container">
          <div className="loading-spinner">🎮</div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-page">
      <div className="scanlines"></div>
      
      <nav className="navbar">
        <div className="nav-logo" onClick={() => navigate('/')}>
          <span className="logo-icon-nav">🎮</span>
          <span className="logo-text-nav">Play<span className="highlight">Track</span></span>
        </div>
        <button className="nav-btn" onClick={() => navigate('/profile')}>
          Back to Profile
        </button>
      </nav>

      <div className="edit-profile-container">
        <div className="edit-profile-header">
          <h1 className="edit-profile-title">Edit Profile</h1>
          <p className="edit-profile-subtitle">Manage your account settings and games</p>
        </div>

        <div className="edit-sections-tabs">
          <button 
            className={`section-tab ${activeSection === 'avatar' ? 'active' : ''}`}
            onClick={() => { setActiveSection('avatar'); setShowNewGameForm(false); }}
          >
            📸 Profile Picture
          </button>
          <button 
            className={`section-tab ${activeSection === 'password' ? 'active' : ''}`}
            onClick={() => { setActiveSection('password'); setShowNewGameForm(false); }}
          >
            🔒 Change Password
          </button>
          <button 
            className={`section-tab ${activeSection === 'games' ? 'active' : ''}`}
            onClick={() => { setActiveSection('games'); setShowNewGameForm(false); }}
          >
            🎮 Add Game
          </button>
        </div>

        <div className="edit-content">
          {activeSection === 'avatar' && (
            <div className="avatar-section">
              <h2 className="section-title">Profile Picture</h2>
              <div className="avatar-upload-container">
                <div className="avatar-preview">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="avatar-image" />
                  ) : (
                    <div className="avatar-placeholder">🎮</div>
                  )}
                </div>
                <div className="avatar-upload-controls">
                  <input 
                    type="file"
                    id="avatar-input"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="avatar-input" className="btn-choose-file">
                    Choose Image
                  </label>
                  {avatarFile && (
                    <button 
                      className="submit-btn"
                      onClick={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? 'Uploading...' : 'Upload Profile Picture'}
                    </button>
                  )}
                  <p className="avatar-info">Max size: 5MB • Formats: JPG, PNG, GIF, WEBP</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'password' && (
            <div className="password-section">
              <h2 className="section-title">Change Password</h2>
              <form onSubmit={handlePasswordChange} className="password-form">
                <div className="form-group">
                  <label>Current Password</label>
                  <input 
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    placeholder="Enter current password"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input 
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                <button type="submit" className="submit-btn">
                  Update Password
                </button>
              </form>
            </div>
          )}

          {activeSection === 'games' && !showNewGameForm && (
            <div className="games-section">
              <h2 className="section-title">Add Game to Your Profile</h2>
              <div className="game-selection-container">
                <div className="form-group">
                  <label>Select a Game</label>
                  <select 
                    className="game-select"
                    value={selectedGame}
                    onChange={handleGameSelection}
                  >
                    <option value="">Choose a game...</option>
                    {allGames.map((game, index) => (
                      <option 
                        key={index} 
                        value={game.title}
                        disabled={userGames.includes(game.title)}
                      >
                        {game.title} {userGames.includes(game.title) ? '(Already added)' : ''}
                      </option>
                    ))}
                    <option value="addnew" className="add-new-option">➕ Add New Game</option>
                  </select>
                </div>
                {selectedGame && (
                  <button className="submit-btn" onClick={handleAddSelectedGame}>
                    Add {selectedGame} to Profile
                  </button>
                )}
              </div>
            </div>
          )}

          {activeSection === 'games' && showNewGameForm && (
            <div className="new-game-section">
              <div className="new-game-header">
                <h2 className="section-title">Create New Game</h2>
                <button 
                  className="back-to-select-btn"
                  onClick={() => {
                    setShowNewGameForm(false);
                    setNewGameData({ title: '', genre: '', releaseYear: new Date().getFullYear() });
                  }}
                >
                  ← Back to Game Selection
                </button>
              </div>
              <form onSubmit={handleCreateNewGame} className="new-game-form">
                <div className="form-group">
                  <label>Game Title</label>
                  <input 
                    type="text"
                    value={newGameData.title}
                    onChange={(e) => setNewGameData({...newGameData, title: e.target.value})}
                    placeholder="Enter game title"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Genre</label>
                  <input 
                    type="text"
                    value={newGameData.genre}
                    onChange={(e) => setNewGameData({...newGameData, genre: e.target.value})}
                    placeholder="e.g. Action, RPG, FPS"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Release Year</label>
                  <input 
                    type="number"
                    value={newGameData.releaseYear}
                    onChange={(e) => setNewGameData({...newGameData, releaseYear: e.target.value})}
                    placeholder="2024"
                    min="1980"
                    max={new Date().getFullYear() + 5}
                    required
                  />
                </div>
                <button type="submit" className="submit-btn">
                  Create & Add Game
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditProfile;
