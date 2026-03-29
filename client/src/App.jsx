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
import TagsManagement from './components/retino/settings/TagsManagement'
import AutomationRules from './components/retino/settings/AutomationRules'
import EmailDesigner from './components/retino/settings/EmailDesigner'
import RatingsAnalytics from './components/retino/analytics/RatingsAnalytics'
import AnalyticsTimeliness from './components/retino/analytics/AnalyticsTimeliness'
import AnalyticsTT from './components/retino/analytics/AnalyticsTT'
import CostAnalysis from './components/retino/analytics/CostAnalysis'
import TrackAndTrace from './components/public/TrackAndTrace'
import ReturnForm from './components/public/ReturnForm/ReturnForm'
import ReturnStatus from './components/public/ReturnStatus'
import RefundQueue from './components/retino/returns/RefundQueue'
import RefundAccounts from './components/retino/settings/RefundAccounts'
import CaseTypes from './components/retino/settings/CaseTypes'
import ReturnsAnalytics from './components/retino/analytics/ReturnsAnalytics'
import CustomFields from './components/retino/settings/CustomFields'
import Webhooks from './components/retino/settings/Webhooks'

function PrivateRoute({ children }) {
  const worker = useAuthStore(s => s.worker)
  return worker ? children : <Navigate to="/login" replace />
}

// Detect if running on retino subdomain
const isRetinoDomain = window.location.hostname.startsWith('retino.');

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
              <Route path="/" element={
                isRetinoDomain
                  ? <Navigate to="/retino/tracking" replace />
                  : <PrivateRoute><Dashboard /></PrivateRoute>
              } />
              <Route path="/package/:id" element={<PrivateRoute><PackageView /></PrivateRoute>} />

              {/* Retino admin routes — wrapped in sidebar layout */}
              <Route path="/retino" element={<PrivateRoute><RetinoLayout /></PrivateRoute>}>
                <Route path="tracking" element={<TrackingDashboard />} />
                <Route path="tracking/problems" element={<TrackingProblems />} />
                <Route path="tracking/:id" element={<ShipmentDetail />} />
                <Route path="analytics/overview" element={<AnalyticsOverview />} />
                <Route path="analytics/delivery-time" element={<AnalyticsDeliveryTime />} />
                <Route path="analytics/problems" element={<AnalyticsProblems />} />
                <Route path="analytics/ratings" element={<RatingsAnalytics />} />
                <Route path="analytics/timeliness" element={<AnalyticsTimeliness />} />
                <Route path="analytics/tt" element={<AnalyticsTT />} />
                <Route path="analytics/costs" element={<CostAnalysis />} />
                <Route path="analytics/returns" element={<ReturnsAnalytics />} />
                <Route path="settings/tags" element={<TagsManagement />} />
                <Route path="settings/automation" element={<AutomationRules />} />
                <Route path="settings/email-designer" element={<EmailDesigner />} />
                <Route path="returns" element={<ReturnsDashboard />} />
                <Route path="returns/new" element={<ReturnAdminCreate />} />
                <Route path="returns/:id" element={<ReturnDetail />} />
                <Route path="returns/refunds" element={<RefundQueue />} />
                <Route path="settings/refund-accounts" element={<RefundAccounts />} />
                <Route path="settings/case-types" element={<CaseTypes />} />
                <Route path="settings/custom-fields" element={<CustomFields />} />
                <Route path="settings/webhooks" element={<Webhooks />} />
                <Route index element={<Navigate to="tracking" replace />} />
              </Route>

              <Route path="*" element={
                isRetinoDomain
                  ? <Navigate to="/retino/tracking" replace />
                  : <Navigate to="/" replace />
              } />
            </Routes>
          </LoginGate>
        } />
      </Routes>
    </BrowserRouter>
  )
}
