import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Forum.css';

function Forum() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('hot'); // hot, new, top

  // Mock data - kasnije iz backend-a
  const allTopics = [
    {
      id: 1,
      title: 'Game of the Year 2025 - Your Predictions?',
      author: 'Marko',
      category: 'Discussion',
      preview: 'What do you think will win GOTY 2025? My bet is on the new Zelda...',
      replies: 47,
      likes: 128,
      createdAt: '2 hours ago',
      isPinned: true
    },
    {
      id: 2,
      title: 'CS2 Major Copenhagen 2026 - Watch Party Thread',
      author: 'Stefan',
      category: 'Esports',
      preview: 'Who\'s watching the major? Let\'s discuss the matches live!',
      replies: 203,
      likes: 89,
      createdAt: '5 hours ago',
      isPinned: false
    },
    {
      id: 3,
      title: 'New Minecraft Update 1.22 - Caves & Cliffs Part 3',
      author: 'Ana',
      category: 'News',
      preview: 'Mojang just announced the next major update! Deep dark biome expansion...',
      replies: 56,
      likes: 234,
      createdAt: '1 day ago',
      isPinned: false
    },
    {
      id: 4,
      title: 'Looking for Valorant Team - EU Diamond',
      author: 'Nikola',
      category: 'LFG',
      preview: 'Diamond 2 player looking for serious team. Main roles: Controller/Sentinel',
      replies: 12,
      likes: 23,
      createdAt: '3 hours ago',
      isPinned: false
    },
    {
      id: 5,
      title: 'The Best Gaming Moments of 2025 - Share Yours!',
      author: 'Jovana',
      category: 'Discussion',
      preview: 'What was your most memorable gaming moment this year? Mine was...',
      replies: 91,
      likes: 167,
      createdAt: '1 day ago',
      isPinned: false
    },
    {
      id: 6,
      title: 'League of Legends Season 15 Patch Notes Discussion',
      author: 'Janko',
      category: 'News',
      preview: 'New champions, item changes, and jungle overhaul. Thoughts?',
      replies: 134,
      likes: 201,
      createdAt: '6 hours ago',
      isPinned: false
    }
  ];

  const categories = [
    { id: 'all', name: 'All Topics', icon: '🌐' },
    { id: 'discussion', name: 'Discussion', icon: '💭' },
    { id: 'news', name: 'News', icon: '📰' },
    { id: 'esports', name: 'Esports', icon: '🏆' },
    { id: 'lfg', name: 'Looking for Group', icon: '👥' }
  ];

  // Filter topics
  const filteredTopics = allTopics.filter(topic => {
    const matchesSearch = topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         topic.preview.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           topic.category.toLowerCase() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTopicClick = (topicId) => {
    navigate(`/topic/${topicId}`);
  };

  return (
    <div className="forum-page">
      <div className="scanlines"></div>

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={() => navigate('/')}>
          <span className="logo-icon-nav">🎮</span>
          <span className="logo-text-nav">Play<span className="highlight">Track</span></span>
        </div>
        <button className="nav-btn" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
      </nav>

      <div className="forum-container">
        
        {/* Header */}
        <header className="forum-header">
          <h1 className="forum-title">
            💬 Gaming <span className="highlight">Forum</span>
          </h1>
          <p className="forum-subtitle">Discuss games, news, and connect with the community</p>
        </header>

        {/* Search Bar */}
        <div className="forum-search-section">
          <div className="search-bar-wrapper">
            <span className="search-icon-input">🔍</span>
            <input 
              type="text"
              className="forum-search-input"
              placeholder="Search topics, discussions, news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="forum-controls">
          {/* Categories */}
          <div className="category-filters">
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="cat-icon">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="sort-controls">
            <button 
              className={`sort-btn ${sortBy === 'hot' ? 'active' : ''}`}
              onClick={() => setSortBy('hot')}
            >
              🔥 Hot
            </button>
            <button 
              className={`sort-btn ${sortBy === 'new' ? 'active' : ''}`}
              onClick={() => setSortBy('new')}
            >
              ⭐ New
            </button>
            <button 
              className={`sort-btn ${sortBy === 'top' ? 'active' : ''}`}
              onClick={() => setSortBy('top')}
            >
              📈 Top
            </button>
          </div>
        </div>

        {/* Topics List */}
        <div className="topics-list">
          {filteredTopics.length > 0 ? (
            filteredTopics.map(topic => (
              <div 
                key={topic.id} 
                className={`topic-item ${topic.isPinned ? 'pinned' : ''}`}
                onClick={() => handleTopicClick(topic.id)}
              >
                {topic.isPinned && <div className="pin-badge">📌 Pinned</div>}
                
                <div className="topic-votes">
                  <button className="vote-btn upvote">▲</button>
                  <span className="vote-count">{topic.likes}</span>
                  <button className="vote-btn downvote">▼</button>
                </div>

                <div className="topic-content">
                  <div className="topic-header-row">
                    <span className="topic-category-badge">{topic.category}</span>
                    <span className="topic-meta">
                      Posted by <span className="topic-author">{topic.author}</span> • {topic.createdAt}
                    </span>
                  </div>
                  
                  <h3 className="topic-title">{topic.title}</h3>
                  <p className="topic-preview">{topic.preview}</p>
                  
                  <div className="topic-footer">
                    <div className="topic-stats">
                      <span className="stat-item">
                        💬 {topic.replies} replies
                      </span>
                    </div>
                  </div>
                </div>

                <div className="topic-arrow">→</div>
              </div>
            ))
          ) : (
            <div className="empty-topics">
              <div className="empty-icon">🔍</div>
              <p>No topics found</p>
              <span>Try different keywords or category</span>
            </div>
          )}
        </div>

        {/* Create Post Button */}
        <button className="create-post-btn">
          <span className="create-icon">✏️</span>
          Create New Topic
        </button>

      </div>
    </div>
  );
}

export default Forum;
