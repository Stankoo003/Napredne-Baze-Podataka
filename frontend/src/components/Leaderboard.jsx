import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import TopBar from './TopBar';
import './Leaderboard.css';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    setCurrentUser(user);
    fetchLeaderboard();
    fetchStats();
    
    if (user) {
      logActivity('page_visit', 0.5);
    }
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/leaderboard/global');
      const data = await response.json();
      setLeaderboardData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stats/leaderboard-summary');
      const data = await response.json();
      setStatsData(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const logActivity = async (activityType, points) => {
    if (!currentUser) return;
    
    try {
      await fetch('http://localhost:3001/api/stats/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          activityType,
          points
        })
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  const getRankClass = (rank) => {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  };

  const activityDistributionData = statsData ? {
    labels: ['Games Rated', 'Topics Created', 'Comments Posted', 'Connections Made', 'Time Active'],
    datasets: [{
      data: [
        statsData.totalRatings || 0,
        statsData.totalTopics || 0,
        statsData.totalComments || 0,
        statsData.totalConnections || 0,
        statsData.totalTimeActive || 0
      ],
      backgroundColor: [
        'rgba(0, 255, 0, 0.8)',
        'rgba(255, 193, 7, 0.8)',
        'rgba(33, 150, 243, 0.8)',
        'rgba(255, 87, 34, 0.8)',
        'rgba(156, 39, 176, 0.8)'
      ],
      borderColor: [
        '#00ff00',
        '#ffc107',
        '#2196f3',
        '#ff5722',
        '#9c27b0'
      ],
      borderWidth: 2
    }]
  } : null;

  const topPlayersChartData = {
    labels: leaderboardData.slice(0, 10).map(p => p.username),
    datasets: [{
      label: 'Total Points',
      data: leaderboardData.slice(0, 10).map(p => p.totalScore),
      backgroundColor: 'rgba(0, 255, 0, 0.6)',
      borderColor: '#00ff00',
      borderWidth: 2
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#00ff00',
          font: { size: 14 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 10, 0.95)',
        titleColor: '#00ff00',
        bodyColor: '#fff',
        borderColor: '#00ff00',
        borderWidth: 1
      }
    },
    scales: {
      y: {
        ticks: { color: '#00ff00' },
        grid: { color: 'rgba(0, 255, 0, 0.1)' }
      },
      x: {
        ticks: { color: '#00ff00' },
        grid: { color: 'rgba(0, 255, 0, 0.1)' }
      }
    }
  };

  if (loading) {
    return (
      <div className="leaderboard-page">
        <TopBar />
        <div className="leaderboard-loading">
          <span className="loading-spinner">🎮</span>
          <p>Loading Leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-page">
      <TopBar />
      
      <div className="leaderboard-container">
        <div className="leaderboard-hero">
          <div className="hero-icon">🏆</div>
          <h1 className="leaderboard-title">
            <span className="title-main">PlayTrack</span>
            <span className="title-sub">Leaderboard</span>
          </h1>
          <p className="leaderboard-subtitle">
            Compete with players worldwide • Earn points • Climb the ranks
          </p>
        </div>

        <div className="points-info-card">
          <h3>💎 How to Earn Points</h3>
          <div className="points-grid">
            <div className="point-item">
              <span className="point-icon">🎮</span>
              <div className="point-details">
                <span className="point-label">Add Game</span>
                <span className="point-value">50 pts</span>
              </div>
            </div>
            <div className="point-item">
              <span className="point-icon">⭐</span>
              <div className="point-details">
                <span className="point-label">Rate Game</span>
                <span className="point-value">100 pts</span>
              </div>
            </div>
            <div className="point-item">
              <span className="point-icon">📝</span>
              <div className="point-details">
                <span className="point-label">Create Topic</span>
                <span className="point-value">150 pts</span>
              </div>
            </div>
            <div className="point-item">
              <span className="point-icon">💬</span>
              <div className="point-details">
                <span className="point-label">Comment</span>
                <span className="point-value">75 pts</span>
              </div>
            </div>
            <div className="point-item">
              <span className="point-icon">👥</span>
              <div className="point-details">
                <span className="point-label">Add Friend</span>
                <span className="point-value">80 pts</span>
              </div>
            </div>
          </div>
        </div>

        <div className="leaderboard-main">
          <div className="leaderboard-table-section">
            <h2 className="section-title">🌟 Top Players</h2>
            {leaderboardData.length === 0 ? (
              <div className="empty-leaderboard">
                <span className="empty-icon">🎯</span>
                <p>No players on the leaderboard yet</p>
                <p className="empty-subtitle">Be the first to earn points!</p>
              </div>
            ) : (
              <div className="leaderboard-table-wrapper">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Total Points</th>
                      <th>Games Played</th>
                      <th>Avg Rating</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((player) => (
                      <tr
                        key={player.username}
                        className={`${getRankClass(player.rank)} ${currentUser && currentUser.username === player.username ? 'current-user-row' : ''}`}
                      >
                        <td className="rank-cell">
                          <span className="rank-badge">{getMedalEmoji(player.rank)}</span>
                        </td>
                        <td className="player-cell">
                          <div className="player-info">
                          <span className="player-avatar">
                            {player.avatar ? (
                              <img 
                                src={`http://localhost:3001${player.avatar}`}
                                alt={player.username}
                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '50%' }}
                              />
                            ) : (
                              '🎮'
                            )}
                          </span>
                            <span className="player-name">{player.username}</span>
                            {currentUser && currentUser.username === player.username && (
                              <span className="you-badge">YOU</span>
                            )}
                          </div>
                        </td>
                        <td className="score-cell">
                          <span className="score-value">{player.totalScore.toLocaleString()}</span>
                        </td>
                        <td className="games-cell">{player.gamesPlayed}</td>
                        <td className="rating-cell">
                          <div className="rating-display">
                            <span className="stars">{'⭐'.repeat(Math.round(player.avgRating))}</span>
                            <span className="rating-number">{player.avgRating.toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="action-cell">
                          <button
                            className="view-profile-btn"
                            onClick={() => navigate(`/profile/${player.username}`)}
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="stats-section">
            <h2 className="section-title">📊 Community Statistics</h2>
            
            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <span className="stat-value">{leaderboardData.length}</span>
                  <span className="stat-label">Active Players</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🎮</div>
                <div className="stat-content">
                  <span className="stat-value">{statsData?.totalRatings || 0}</span>
                  <span className="stat-label">Games Rated</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">💬</div>
                <div className="stat-content">
                  <span className="stat-value">{statsData?.totalComments || 0}</span>
                  <span className="stat-label">Comments</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📝</div>
                <div className="stat-content">
                  <span className="stat-value">{statsData?.totalTopics || 0}</span>
                  <span className="stat-label">Topics Created</span>
                </div>
              </div>
            </div>

            <div className="charts-container">
              <div className="chart-box">
                <h3 className="chart-title">Activity Distribution</h3>
                {activityDistributionData && (
                  <div className="chart-wrapper">
                    <Pie data={activityDistributionData} options={chartOptions} />
                  </div>
                )}
              </div>

              <div className="chart-box">
                <h3 className="chart-title">Top 10 Players</h3>
                <div className="chart-wrapper">
                  <Bar data={topPlayersChartData} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
