import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import SplashScreen from './components/SplashScreen';
// Add page imports here
import Home from './pages/Home';
import RoutePlanner from './pages/RoutePlanner';
import Categories from './pages/Categories';
import Locator from './pages/Locator';
import Fuel from './pages/Fuel';
import LokinAI from './pages/LokinAI';
import Earnings from './pages/Earnings';
import More from './pages/More';
import AvoidList from './pages/AvoidList';
import Settings from './pages/Settings';
import DrivingMode from './pages/DrivingMode';
import Brand from './pages/Brand';
import Pricing from './pages/Pricing';
import ThankYou from './pages/ThankYou';
import Support from './pages/Support';
import GigTasks from './pages/GigTasks';
import Receipts from './pages/Receipts';
import DriverLayout from './components/DriverLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<ProtectedRoute unauthenticatedElement={null} />}>
        <Route element={<DriverLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/route" element={<RoutePlanner />} />
          <Route path="/lokin" element={<LokinAI />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/more" element={<More />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/locator" element={<Locator />} />
          <Route path="/avoid" element={<AvoidList />} />
          <Route path="/fuel" element={<Fuel />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/drive" element={<DrivingMode />} />
          <Route path="/brand" element={<Brand />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/support" element={<Support />} />
          <Route path="/gigs" element={<GigTasks />} />
          <Route path="/receipts" element={<Receipts />} />
        </Route>
      </Route>
      <Route path="/ThankYou" element={<ThankYou />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <SplashScreen />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App