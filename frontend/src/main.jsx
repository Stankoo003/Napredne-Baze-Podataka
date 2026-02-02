import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Login from './Login.jsx'
import SocialGraph from './SocialGraph.jsx'
import Signup from './Signup.jsx'
import Forum from './pages/Forum'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import NewPost from './pages/NewPost'
import TopicDetail from './pages/TopicDetail'
import Leaderboard from './components/Leaderboard';


ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
    <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/" element={<App />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/social-graph" element={<SocialGraph />} />
      <Route path="/forum" element={<Forum />} />
      <Route path="/forum/new" element={<NewPost />} />
      <Route path="/forum/:topicId" element={<TopicDetail />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/:userId" element={<Profile />} />
      <Route path="/edit-profile" element={<EditProfile />} />
    </Routes>
  </BrowserRouter>
)
