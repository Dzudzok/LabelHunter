import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AuthPage from './components/Auth/AuthPage'
import Dashboard from './components/Dashboard/Dashboard'
import PackageView from './components/PackageView/PackageView'
import TrackingPage from './pages/TrackingPage/TrackingPage'
import ReturnPage from './pages/ReturnPage/ReturnPage'

function PrivateRoute({ children }) {
  const worker = useAuthStore(s => s.worker)
  return worker ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/package/:id" element={<PrivateRoute><PackageView /></PrivateRoute>} />
        <Route path="/tracking/:token" element={<TrackingPage />} />
        <Route path="/return/:token" element={<ReturnPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
