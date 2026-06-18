import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import LandingPage from "./pages/LandingPage";
import Login from "./Login";
import Dashboard from "./Dashboard";
import ProtectedRoute from "./ProtectedRoute";
import TermsOfService from "./pages/Legal/TermsOfService";
import PrivacyPolicy from "./pages/Legal/PrivacyPolicy";
import ErrorBoundary from "./components/ErrorBoundary";
import DocsIndex from "./pages/docs/DocsIndex";
import GHL from "./pages/docs/integrations/GHL";
import Tally from "./pages/docs/integrations/Tally";
import N8n from "./pages/docs/integrations/N8n";
import Typeform from "./pages/docs/integrations/Typeform";
import Jotform from "./pages/docs/integrations/Jotform";
import Zapier from "./pages/docs/integrations/Zapier";

function App() {
  return (
    <ErrorBoundary>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(51, 65, 85, 0.5)',
          }
        }} 
      />
      <Routes>
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LandingPage />} />

        {/* Public docs — no auth required */}
        <Route path="/docs" element={<DocsIndex />} />
        <Route path="/docs/integrations/ghl" element={<GHL />} />
        <Route path="/docs/integrations/tally" element={<Tally />} />
        <Route path="/docs/integrations/n8n" element={<N8n />} />
        <Route path="/docs/integrations/typeform" element={<Typeform />} />
        <Route path="/docs/integrations/jotform" element={<Jotform />} />
        <Route path="/docs/integrations/zapier" element={<Zapier />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Catch-all — redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
