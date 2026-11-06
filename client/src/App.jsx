import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Spinner from './components/Spinner';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CandidateProfile from './pages/CandidateProfile';
import NotFound from './pages/NotFound';

const CompareResult = lazy(() => import('./pages/CompareResult.jsx'));
const History = lazy(() => import('./pages/History.jsx'));

function PageFallback() {
  return (
    <div className="page-loading">
      <Spinner label="Loading page" />
      <p>Loading…</p>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route
                path="compare/:id"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageFallback />}>
                      <CompareResult />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="history"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageFallback />}>
                      <History />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="candidates/:id" element={<CandidateProfile />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="verify-email" element={<VerifyEmail />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="about" element={<About />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
