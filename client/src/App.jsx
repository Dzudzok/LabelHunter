import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginGate from './components/Auth/LoginGate'
import AuthPage from './components/Auth/AuthPage'
import Dashboard from './components/Dashboard/Dashboard'
import PackageView from './components/PackageView/PackageView'
import TrackingPage from './pages/TrackingPage/TrackingPage'
import ReturnPage from './pages/ReturnPage/ReturnPage'

// Retino module
import RetinoLayout from './components/retino/RetinoLayout'
import TrackingDashboard from './components/retino/tracking/TrackingDashboard'
import ShipmentDetail from './components/retino/tracking/ShipmentDetail'
import ReturnsDashboard from './components/retino/returns/ReturnsDashboard'
import ReturnAdminCreate from './components/retino/returns/ReturnAdminCreate'
import ReturnDetail from './components/retino/returns/ReturnDetail'
import TrackingProblems from './components/retino/tracking/TrackingProblems'
import AnalyticsOverview from './components/retino/analytics/AnalyticsOverview'
import AnalyticsDeliveryTime from './components/retino/analytics/AnalyticsDeliveryTime'
import AnalyticsProblems from './components/retino/analytics/AnalyticsProblems'
import TrackAndTrace from './components/public/TrackAndTrace'
import ReturnForm from './components/public/ReturnForm/ReturnForm'
import ReturnStatus from './components/public/ReturnStatus'

function PrivateRoute({ children }) {
  const worker = useAuthStore(s => s.worker)
  return worker ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no auth needed */}
        <Route path="/tracking/:token" element={<TrackingPage />} />
        <Route path="/return/:token" element={<ReturnPage />} />

        {/* Retino public routes */}
        <Route path="/sledovani/:trackingToken" element={<TrackAndTrace />} />
        <Route path="/vraceni" element={<ReturnForm />} />
        <Route path="/vraceni/stav/:accessToken" element={<ReturnStatus />} />

        {/* All other routes require system login (JWT) + worker selection */}
        <Route path="/*" element={
          <LoginGate>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/package/:id" element={<PrivateRoute><PackageView /></PrivateRoute>} />

              {/* Retino admin routes — wrapped in sidebar layout */}
              <Route path="/retino" element={<PrivateRoute><RetinoLayout /></PrivateRoute>}>
                <Route path="tracking" element={<TrackingDashboard />} />
                <Route path="tracking/problems" element={<TrackingProblems />} />
                <Route path="tracking/:id" element={<ShipmentDetail />} />
                <Route path="analytics/overview" element={<AnalyticsOverview />} />
                <Route path="analytics/delivery-time" element={<AnalyticsDeliveryTime />} />
                <Route path="analytics/problems" element={<AnalyticsProblems />} />
                <Route path="returns" element={<ReturnsDashboard />} />
                <Route path="returns/new" element={<ReturnAdminCreate />} />
                <Route path="returns/:id" element={<ReturnDetail />} />
                <Route index element={<Navigate to="tracking" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </LoginGate>
        } />
      </Routes>
    </BrowserRouter>
  )
}
