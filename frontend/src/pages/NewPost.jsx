import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import TopBar from '../components/TopBar';
import './NewPost.css';

function NewPost() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'Discussion'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = ['Discussion', 'News', 'Esports', 'Looking for Group', 'Questions'];

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) {
      alert('You must be logged in to create a post!');
      navigate('/login');
      return;
    }
    setCurrentUser(user);
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    if (formData.title.length < 5) {
      setError('Title must be at least 5 characters long');
      return;
    }

    if (formData.content.length < 10) {
      setError('Content must be at least 10 characters long');
      return;
    }

    setLoading(true);

    try {
      await axios.post('http://localhost:3001/api/topics', {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        authorUsername: currentUser.username
      });

      alert('Topic created successfully!');
      navigate('/forum');
    } catch (err) {
      console.error('Error creating topic:', err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to create topic. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="new-post-page">
      <TopBar showBackButton={true} />
      <div className="scanlines"></div>

      <div className="new-post-container">
        <div className="new-post-header">
          <h1 className="new-post-title">Create a <span className="highlight">New Topic</span></h1>
          <p className="new-post-subtitle">Share your thoughts with the community</p>
        </div>

        <div className="new-post-box">
          {error && <div className="error-message">{error}</div>}

          <form className="new-post-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="form-select"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                type="text"
                id="title"
                name="title"
                placeholder="Enter a unique and descriptive title"
                value={formData.title}
                onChange={handleChange}
                maxLength={200}
              />
              <span className="char-count">{formData.title.length}/200</span>
            </div>

            <div className="form-group">
              <label htmlFor="content">Content</label>
              <textarea
                id="content"
                name="content"
                placeholder="What's on your mind? Share your thoughts, questions, or news..."
                value={formData.content}
                onChange={handleChange}
                rows={12}
              />
              <span className="char-count">{formData.content.length} characters</span>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => navigate('/forum')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Topic'}
              </button>
            </div>
          </form>
        </div>

        <div className="posting-guidelines">
          <h3>Posting Guidelines</h3>
          <ul>
            <li>Choose a clear and descriptive title</li>
            <li>Topic titles must be unique</li>
            <li>Be respectful and constructive</li>
            <li>Stay on topic and relevant to gaming</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default NewPost;
