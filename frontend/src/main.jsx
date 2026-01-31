import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Login from './Login.jsx'
import SocialGraph from './SocialGraph.jsx'
import Signup from './Signup.jsx'  // ← Proveri da li postoji ova linija

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/social-graph" element={<SocialGraph />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
