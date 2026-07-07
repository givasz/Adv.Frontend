import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Editor from './pages/Editor'
import Directory from './pages/Directory'
import PublicProfile from './pages/PublicProfile'
import Preview from './pages/Preview'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/buscar" element={<Directory />} />
        <Route path="/__preview/:themeId" element={<Preview />} />
        <Route path="/:slug" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  )
}
