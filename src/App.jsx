import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import SplashScreen from './components/SplashScreen';
import DeepLinkHandler from './components/DeepLinkHandler';
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
import Oasis from './pages/Oasis';
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
import CommandIngress from './pages/CommandIngress';
import Connect from './pages/Connect';
import PrintfulConnect from './pages/PrintfulConnect';
import PrintfulCallback from './pages/PrintfulCallback';
import Opportunities from './pages/Opportunities';
import Showcase from './pages/Showcase';
import FiveG from './pages/FiveG';
import ActiveDelivery from './pages/ActiveDelivery';
import Certified from './pages/Certified';
import MerchantHub from './pages/MerchantHub';
import ComplianceHandoff from './pages/ComplianceHandoff';
import MerchantPortal from './pages/MerchantPortal';
import DriverDispatch from './pages/DriverDispatch';
import DriverLayout from './components/DriverLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthConsent from './pages/OAuthConsent';
import ShopifyEmbed from './pages/ShopifyEmbed';
import Stash from './pages/Stash';
import StashCart from './pages/StashCart';
import GreenDelivery from './pages/GreenDelivery';
import Insurance from './pages/Insurance';
import InsuranceAdmin from './pages/InsuranceAdmin';
import DriverOnboarding from './pages/DriverOnboarding';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import SupportInfo from './pages/SupportInfo';
import FundingCommand from './pages/FundingCommand';
import ReleaseGate from './components/ReleaseGate';
import { RELEASE_FLAGS } from './lib/releaseFlags';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Shopify's embedded app must render without waiting for or requiring a Base44 session.
  // These routes are intentionally handled before any Base44 auth/loading gate so the
  // Shopify Admin iframe can load them even when no Base44 user is signed in.
  const pathname = window.location.pathname;
  if (isShopifyEmbedRequest(pathname)) {
    return (
      <Routes>
        <Route path="/shopify" element={<ShopifyEmbed />} />
        <Route path="/shopify/auth/callback" element={<ShopifyEmbed />} />
      </Routes>
    );
  }

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
      <Route element={<ProtectedRoute unauthenticatedElement={<Login />} />}>
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
          <Route path="/oasis" element={<Oasis />} />
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
          <Route path="/funding-command" element={<FundingCommand />} />
          <Route path="/5g" element={<FiveG />} />
          <Route path="/active-delivery" element={<ActiveDelivery />} />
          <Route path="/certified" element={<Certified />} />
          <Route path="/merchant-hub" element={<MerchantHub />} />
          <Route path="/compliance-handoff" element={<ComplianceHandoff />} />
          <Route path="/merchant-portal" element={<MerchantPortal />} />
          <Route path="/driver-dispatch" element={<DriverDispatch />} />
          <Route path="/printful-connect" element={<PrintfulConnect />} />
          <Route path="/printful/callback" element={<PrintfulCallback />} />
          <Route path="/stash" element={RELEASE_FLAGS.regulatedCannabis ? <Stash /> : <ReleaseGate title="LOKIN Green — partner activation required" body="LOKIN Green is preserved but disabled for the App Store 1.0 launch until a licensed cannabis-market partner, legal-entity submission, and jurisdictional geo-restriction are active." />} />
          <Route path="/stash/cart" element={RELEASE_FLAGS.regulatedCannabis ? <StashCart /> : <ReleaseGate title="Regulated checkout unavailable" body="Cannabis checkout is disabled in the App Store 1.0 launch candidate." />} />
          <Route path="/green-delivery" element={RELEASE_FLAGS.regulatedCannabis ? <GreenDelivery /> : <ReleaseGate title="Green Delivery — partner activation required" body="Regulated delivery remains disabled until licensed-market and jurisdiction controls are active." />} />
          <Route path="/insurance" element={RELEASE_FLAGS.insuranceTransactions ? <Insurance /> : <ReleaseGate title="LOKIN Cover — partner activation required" body="Insurance application and binding workflows are preserved but disabled in the App Store 1.0 launch until an authorized carrier/agency relationship and required legal-entity submission are in place." />} />
          <Route path="/insurance-admin" element={RELEASE_FLAGS.insuranceTransactions ? <InsuranceAdmin /> : <ReleaseGate title="LOKIN Cover Admin unavailable" body="Carrier administration is not enabled in the App Store 1.0 launch candidate." />} />
          <Route path="/onboarding" element={RELEASE_FLAGS.regulatedCannabis ? <DriverOnboarding /> : <ReleaseGate title="Regulated onboarding unavailable" body="Green Delivery onboarding is disabled for the App Store 1.0 launch candidate." />} />
        </Route>
      </Route>
      <Route path="/command" element={<CommandIngress />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/support-info" element={<SupportInfo />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/oauth/consent" element={<OAuthConsent />} />
      <Route path="/ThankYou" element={<ThankYou />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function ShopifyPublicApp() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route path="/shopify" element={<ShopifyEmbed />} />
          <Route path="/shopify/auth/callback" element={<ShopifyEmbed />} />
          <Route path="*" element={<ShopifyEmbed />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

// Detect a Shopify Admin embed / OAuth callback regardless of the exact App URL
// path configured in the Shopify Partner Dashboard. Shopify appends embed params
// (embedded=1, shop, hmac, host, timestamp) to the iframe URL and the OAuth
// callback carries code+shop+hmac. Matching on those params — not just the
// /shopify path — prevents a mismatched/trailing-slash App URL from falling
// through to the authenticated driver shell and rendering blank inside the
// Shopify iframe (where no Base44 session can exist).
function isShopifyEmbedRequest(pathname) {
  if (pathname === '/shopify' || pathname.startsWith('/shopify/')) return true;
  const sp = new URLSearchParams(window.location.search);
  if (sp.get('embedded') === '1' && sp.get('shop')) return true;
  if (sp.get('code') && sp.get('shop') && sp.get('hmac')) return true;
  return false;
}

function App() {
  // IMPORTANT: Shopify Admin loads this app in a third-party iframe where there
  // may be no Base44 browser session/cookies. Keep the embedded Shopify entry
  // completely outside AuthProvider, SplashScreen, deep-link handlers, and the
  // normal authenticated driver shell. This prevents auth/public-settings
  // requests or overlays from blocking the iframe before ShopifyEmbed renders.
  const pathname = window.location.pathname;
  if (isShopifyEmbedRequest(pathname)) {
    return <ShopifyPublicApp />;
  }

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <SplashScreen />
          <DeepLinkHandler />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App