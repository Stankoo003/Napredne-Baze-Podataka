import { useNavigate } from 'react-router-dom';
import './TopBar.css';

function TopBar({ showBackButton = true }) {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  const handleHome = () => {
    navigate('/');
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="top-bar-logo" onClick={handleHome}>
          <span className="logo-icon-top">🎮</span>
          <span className="logo-text-top">PlayTrack</span>
        </div>
        {showBackButton && (
          <button className="top-bar-back-btn" onClick={handleBack}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

export default TopBar;
