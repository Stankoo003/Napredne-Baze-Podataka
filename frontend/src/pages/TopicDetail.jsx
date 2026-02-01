import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import TopBar from '../components/TopBar';
import './TopicDetail.css';

function TopicDetail() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [topic, setTopic] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ content: '', category: '' });

  const categories = ['Discussion', 'News', 'Esports', 'Looking for Group', 'Questions'];

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    setCurrentUser(user);
    fetchTopicData();
  }, [topicId]);

  const fetchTopicData = async () => {
    setLoading(true);
    try {
      const [topicRes, commentsRes] = await Promise.all([
        axios.get(`http://localhost:3001/api/topics/${topicId}`),
        axios.get(`http://localhost:3001/api/topics/${topicId}/comments`)
      ]);
      setTopic(topicRes.data);
      setComments(commentsRes.data);
      setEditData({
        content: topicRes.data.content,
        category: topicRes.data.category
      });
    } catch (error) {
      console.error('Error fetching topic:', error);
      alert('Topic not found');
      navigate('/forum');
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('You must be logged in to comment!');
      navigate('/login');
      return;
    }

    if (!commentText.trim()) {
      alert('Comment cannot be empty');
      return;
    }

    try {
      await axios.post(`http://localhost:3001/api/topics/${topicId}/comments`, {
        content: commentText,
        authorUsername: currentUser.username
      });
      setCommentText('');
      fetchTopicData();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment');
    }
  };

  const handleEdit = async () => {
    if (!editData.content.trim()) {
      alert('Content cannot be empty');
      return;
    }

    try {
      await axios.put(`http://localhost:3001/api/topics/${topicId}`, {
        content: editData.content,
        category: editData.category,
        username: currentUser.username
      });
      setIsEditing(false);
      fetchTopicData();
      alert('Topic updated successfully!');
    } catch (error) {
      console.error('Error updating topic:', error);
      alert(error.response?.data?.error || 'Failed to update topic');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this topic?')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:3001/api/topics/${topicId}`, {
        data: { username: currentUser.username }
      });
      alert('Topic deleted successfully');
      navigate('/forum');
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert(error.response?.data?.error || 'Failed to delete topic');
    }
  };

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
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

  if (loading) {
    return (
      <div className="topic-detail-page">
        <TopBar showBackButton={true} />
        <div className="loading-screen">
          <div className="loader">⏳</div>
          <p>Loading topic...</p>
        </div>
      </div>
    );
  }

  if (!topic) return null;

  const isAuthor = currentUser && currentUser.username === topic.authorUsername;

  return (
    <div className="topic-detail-page">
      <TopBar showBackButton={true} />
      <div className="scanlines"></div>

      <div className="topic-detail-container">
        <div className="topic-main">
          <div className="topic-header-section">
            <span className="topic-category-tag">{topic.category}</span>
            <h1 className="topic-main-title">{topic.title}</h1>
            <div className="topic-author-info">
              <div className="author-avatar" onClick={() => handleUserClick(topic.authorUsername)}>
                🎮
              </div>
              <div className="author-details">
                <span className="author-name" onClick={() => handleUserClick(topic.authorUsername)}>
                  {topic.authorUsername}
                </span>
                <span className="post-time">{getTimeAgo(topic.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="topic-body">
            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={editData.category}
                    onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                    className="edit-select"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Content</label>
                  <textarea
                    value={editData.content}
                    onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                    rows={10}
                    className="edit-textarea"
                  />
                </div>
                <div className="edit-actions">
                  <button className="btn-save" onClick={handleEdit}>Save Changes</button>
                  <button className="btn-cancel-edit" onClick={() => setIsEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <p className="topic-content-text">{topic.content}</p>
            )}

            {isAuthor && !isEditing && (
              <div className="author-actions">
                <button className="btn-edit" onClick={() => setIsEditing(true)}>
                  ✏️ Edit
                </button>
                <button className="btn-delete" onClick={handleDelete}>
                  🗑️ Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="comments-section">
          <h2 className="comments-title">Comments ({comments.length})</h2>

          {currentUser && (
            <form className="comment-form" onSubmit={handleCommentSubmit}>
              <textarea
                className="comment-input"
                placeholder="Share your thoughts..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={4}
              />
              <button type="submit" className="comment-submit-btn">
                Post Comment
              </button>
            </form>
          )}

          <div className="comments-list">
            {comments.length === 0 ? (
              <div className="no-comments">
                <p>No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-avatar" onClick={() => handleUserClick(comment.authorUsername)}>
                    🎮
                  </div>
                  <div className="comment-body">
                    <div className="comment-header">
                      <span className="comment-author" onClick={() => handleUserClick(comment.authorUsername)}>
                        {comment.authorUsername}
                      </span>
                      <span className="comment-time">{getTimeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="comment-text">{comment.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopicDetail;
