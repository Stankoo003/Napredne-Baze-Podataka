import './SearchResultCard.css';

// Profile Card
export function ProfileCard({ user, onClick }) {
  return (
    <div className="search-card profile-card" onClick={onClick}>
      <div className="card-avatar">🎮</div>
      <div className="card-content">
        <h4 className="card-title">{user.username}</h4>
        <p className="card-meta">
          {user.gamesCount || 0} games • {user.friendsCount || 0} friends
        </p>
        {user.bio && <p className="card-description">{user.bio}</p>}
      </div>
      <div className="card-arrow">→</div>
    </div>
  );
}

// Topic Card
export function TopicCard({ topic, onClick }) {
  return (
    <div className="search-card topic-card" onClick={onClick}>
      <div className="card-icon topic-icon">💬</div>
      <div className="card-content">
        <h4 className="card-title">{topic.title}</h4>
        <p className="card-meta">
          <span className="topic-category">{topic.category}</span>
          {topic.author && ` • by ${topic.author}`}
          {topic.replies && ` • ${topic.replies} replies`}
        </p>
        {topic.preview && <p className="card-description">{topic.preview}</p>}
      </div>
      <div className="card-stats">
        <div className="stat">
          <span className="stat-icon">👍</span>
          <span className="stat-value">{topic.likes || 0}</span>
        </div>
      </div>
    </div>
  );
}

// Empty State
export function EmptyState({ query, type }) {
  const messages = {
    users: `No players found matching "${query}"`,
    topics: `No topics found matching "${query}"`,
    all: `No results found for "${query}"`
  };

  return (
    <div className="search-empty-state">
      <div className="empty-icon">🔍</div>
      <p className="empty-message">{messages[type] || messages.all}</p>
      <p className="empty-hint">Try different keywords or check your spelling</p>
    </div>
  );
}
