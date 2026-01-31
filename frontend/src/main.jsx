import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Login from './Login.jsx'
import SocialGraph from './SocialGraph.jsx'
import Signup from './Signup.jsx'
import Profile from './Profile.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/social-graph" element={<SocialGraph />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
