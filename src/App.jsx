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
import Hotspots from './pages/Hotspots';
import Tax from './pages/Tax';
import Receipts from './pages/Receipts';
import VehicleCare from './pages/VehicleCare';
import Safety from './pages/Safety';
import BreakTime from './pages/BreakTime';
import OnTheRoad from './pages/OnTheRoad';
import Awareness from './pages/Awareness';
import Connectivity from './pages/Connectivity';
import ShopDeliver from './pages/ShopDeliver';
import AiGps from './pages/AiGps';
import Connect from './pages/Connect';
import Opportunities from './pages/Opportunities';
import Showcase from './pages/Showcase';
import DriverLayout from './components/DriverLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthConsent from './pages/OAuthConsent';

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
          <Route path="/hotspots" element={<Hotspots />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/vehicle-care" element={<VehicleCare />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/break-time" element={<BreakTime />} />
          <Route path="/on-the-road" element={<OnTheRoad />} />
          <Route path="/awareness" element={<Awareness />} />
          <Route path="/connectivity" element={<Connectivity />} />
          <Route path="/shop-deliver" element={<ShopDeliver />} />
          <Route path="/ai-gps" element={<AiGps />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/showcase" element={<Showcase />} />
        </Route>
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/oauth/consent" element={<OAuthConsent />} />
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