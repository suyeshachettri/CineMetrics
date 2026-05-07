import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Stats from './features/stats/Stats'
import Blend from './features/blend/Blend'
import Wrapped from './features/wrapped/Wrapped'
import Recs from './features/recs/Recs'
import Watchlist from './features/watchlist/Watchlist'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">BoxOfficd</h1>
        <nav className="nav">
          <NavLink to="/" end>Stats</NavLink>
          <NavLink to="/blend">Blend</NavLink>
          <NavLink to="/recs">Recs</NavLink>
          <NavLink to="/wrapped">Wrapped</NavLink>
          <NavLink to="/watchlist">Watchlist</NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Stats />} />
          <Route path="/blend" element={<Blend />} />
          <Route path="/recs" element={<Recs />} />
          <Route path="/wrapped" element={<Wrapped />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Routes>
      </main>
    </div>
  )
}