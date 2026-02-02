import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import TopBar from '../components/TopBar';
import './Forum.css';

function Forum() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchResults, setSearchResults] = useState({ topics: [], users: [] });
  const [isSearching, setIsSearching] = useState(false);
  
  const debounceTimerRef = useRef(null);

  const categories = [
    { id: 'all', name: 'All Topics', icon: '🌐' },
    { id: 'Discussion', name: 'Discussion', icon: '💭' },
    { id: 'News', name: 'News', icon: '📰' },
    { id: 'Esports', name: 'Esports', icon: '🏆' },
    { id: 'Looking for Group', name: 'Looking for Group', icon: '👥' },
    { id: 'Questions', name: 'Questions', icon: '❓' }
  ];

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (!isSearching) {
      fetchTopics();
    }
  }, [selectedCategory, currentPage, isSearching, currentUser]);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      let response;
      
      if (currentUser && selectedCategory === 'all') {
        response = await axios.get(`http://localhost:3001/api/topics/recommended/${currentUser.username}`, {
          params: { page: currentPage, limit: 10 }
        });
      } else {
        response = await axios.get('http://localhost:3001/api/topics', {
          params: {
            category: selectedCategory === 'all' ? undefined : selectedCategory,
            page: currentPage,
            limit: 10
          }
        });
      }
      
      console.log('Fetched topics:', response.data);
      setTopics(response.data.topics || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching topics:', error);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim().length === 0) {
      setIsSearching(false);
      setSearchResults({ topics: [], users: [] });
      return;
    }

    setIsSearching(true);
    setLoading(true);

    debounceTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  };

  const performSearch = async (query) => {
    try {
      const [topicsRes, usersRes] = await Promise.all([
        axios.get('http://localhost:3001/api/topics/search', { params: { q: query } }),
        axios.get('http://localhost:3001/api/users/search', { params: { q: query } })
      ]);

      setSearchResults({
        topics: topicsRes.data.topics || [],
        users: usersRes.data.users || []
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({ topics: [], users: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleTopicClick = (topicId) => {
    navigate(`/forum/${topicId}`);
  };

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
  };

  const handleCreatePost = () => {
    if (!currentUser) {
      alert('You must be logged in to create a post!');
      navigate('/login');
      return;
    }
    navigate('/forum/new');
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const displayTopics = isSearching ? searchResults.topics : topics;
  const displayUsers = isSearching ? searchResults.users : [];
  const hasResults = displayTopics.length > 0 || displayUsers.length > 0;

  return (
    <div className="forum-page">
      <TopBar showBackButton={true} />
      <div className="scanlines"></div>

      <div className="forum-container">
        <div className="forum-header">
          <h1 className="forum-title">Gaming Forum</h1>
          <p className="forum-subtitle">Discuss, Share, Connect</p>
        </div>

        <div className="forum-search-section">
          <input
            type="text"
            className="forum-search-input"
            placeholder="🔍 Search topics or users..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        {!isSearching && (
          <div className="forum-controls">
            <div className="category-filters">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setCurrentPage(1);
                  }}
                >
                  <span className="cat-icon">{cat.icon}</span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="empty-topics">
            <div className="empty-icon">⏳</div>
            <p>Loading...</p>
          </div>
        ) : !hasResults ? (
          <div className="empty-topics">
            <div className="empty-icon">📭</div>
            <p>No topics found</p>
            {isSearching && <span>Try different keywords</span>}
          </div>
        ) : (
          <>
            {displayUsers.length > 0 && (
              <div className="search-users-section">
                <h2 className="search-section-title">
                  <span className="section-icon">👤</span>
                  Users
                </h2>
                <div className="users-grid">
                  {displayUsers.map(user => (
                    <div
                      key={user.username}
                      className="user-card"
                      onClick={() => handleUserClick(user.username)}
                    >
                      <div className="user-card-avatar">
                        {user.avatar ? (
                          <img 
                            src={`http://localhost:3001${user.avatar}`}
                            alt={user.username}
                            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '50%' }}
                          />
                        ) : (
                          '🎮'
                        )}
                      </div>
                      <div className="user-card-info">
                        <h3 className="user-card-name">{user.username}</h3>
                        <p className="user-card-email">{user.email}</p>
                        <div className="user-card-stats">
                          <span>{user.gamesCount} games</span>
                          <span>•</span>
                          <span>{user.friendsCount} connections</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {displayTopics.length > 0 && (
              <>
                {isSearching && (
                  <h2 className="search-section-title">
                    <span className="section-icon">📝</span>
                    Topics
                  </h2>
                )}
                <div className="topics-list">
                  {displayTopics.map(topic => (
                    <div
                      key={topic.id}
                      className={`topic-item ${topic.isRecommended ? 'recommended' : ''}`}
                      onClick={() => handleTopicClick(topic.id)}
                    >
                      {topic.isRecommended && (
                        <div className="recommended-badge">
                          ⭐ Recommended for you
                        </div>
                      )}
                      
                      <div className="topic-votes">
                        <button className="vote-btn">▲</button>
                        <span className="vote-count">0</span>
                        <button className="vote-btn">▼</button>
                      </div>

                      <div className="topic-content">
                        <div className="topic-header-row">
                          <span className="topic-category-badge">{topic.category}</span>
                          <span className="topic-meta">
                            Posted by <span className="topic-author">{topic.authorUsername}</span> • {getTimeAgo(topic.createdAt)}
                          </span>
                        </div>

                        <h3 className="topic-title">{topic.title}</h3>
                        <p className="topic-preview">{topic.content}</p>

                        <div className="topic-footer">
                          <div className="topic-stats">
                            <span className="stat-item">💬 {topic.commentCount || 0} comments</span>
                          </div>
                        </div>
                      </div>

                      <div className="topic-arrow">→</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!isSearching && totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  ← Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {currentUser && (
          <button className="create-post-btn" onClick={handleCreatePost}>
            <span>✏️</span> Create New Topic
          </button>
        )}
      </div>
    </div>
  );
}

export default Forum;
