import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import SplashScreen from './components/SplashScreen';
import FeatureTour from './components/FeatureTour';
import DeepLinkHandler from './components/DeepLinkHandler';
// Add page imports here
import Home from './pages/Home';
const RoutePlanner = lazy(() => import('./pages/RoutePlanner'));
const Categories = lazy(() => import('./pages/Categories'));
const Locator = lazy(() => import('./pages/Locator'));
const Fuel = lazy(() => import('./pages/Fuel'));
const LokinAI = lazy(() => import('./pages/LokinAI'));
const Earnings = lazy(() => import('./pages/Earnings'));
const EarningsIntelligence = lazy(() => import('./pages/EarningsIntelligence'));
const ShiftReport = lazy(() => import('./pages/ShiftReport'));
const DriverPlatforms = lazy(() => import('./pages/DriverPlatforms'));
const UberDriverCallback = lazy(() => import('./pages/UberDriverCallback'));
const More = lazy(() => import('./pages/More'));
const AvoidList = lazy(() => import('./pages/AvoidList'));
const Settings = lazy(() => import('./pages/Settings'));
const DrivingMode = lazy(() => import('./pages/DrivingMode'));
const Brand = lazy(() => import('./pages/Brand'));
const Oasis = lazy(() => import('./pages/Oasis'));
const Pricing = lazy(() => import('./pages/Pricing'));
const ThankYou = lazy(() => import('./pages/ThankYou'));
const Support = lazy(() => import('./pages/Support'));
const GigTasks = lazy(() => import('./pages/GigTasks'));
const Hotspots = lazy(() => import('./pages/Hotspots'));
const TrafficLog = lazy(() => import('./pages/TrafficLog'));
const Tax = lazy(() => import('./pages/Tax'));
const Receipts = lazy(() => import('./pages/Receipts'));
const VehicleCare = lazy(() => import('./pages/VehicleCare'));
const Safety = lazy(() => import('./pages/Safety'));
const BreakTime = lazy(() => import('./pages/BreakTime'));
const OnTheRoad = lazy(() => import('./pages/OnTheRoad'));
const Awareness = lazy(() => import('./pages/Awareness'));
const Connectivity = lazy(() => import('./pages/Connectivity'));
const ShopDeliver = lazy(() => import('./pages/ShopDeliver'));
const AiGps = lazy(() => import('./pages/AiGps'));
const GPSCommandCenter = lazy(() => import("./pages/GPSCommandCenter"));
const CommandIngress = lazy(() => import('./pages/CommandIngress'));
const Connect = lazy(() => import('./pages/Connect'));
const PrintfulConnect = lazy(() => import('./pages/PrintfulConnect'));
const PrintfulCallback = lazy(() => import('./pages/PrintfulCallback'));
const Opportunities = lazy(() => import('./pages/Opportunities'));
const Showcase = lazy(() => import('./pages/Showcase'));
const FiveG = lazy(() => import('./pages/FiveG'));
const ActiveDelivery = lazy(() => import('./pages/ActiveDelivery'));
const Certified = lazy(() => import('./pages/Certified'));
const MerchantHub = lazy(() => import('./pages/MerchantHub'));
const ComplianceHandoff = lazy(() => import('./pages/ComplianceHandoff'));
const DriverDispatch = lazy(() => import('./pages/DriverDispatch'));
import DriverLayout from './components/DriverLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'));
const ShopifyEmbed = lazy(() => import('./pages/ShopifyEmbed'));
const Stash = lazy(() => import('./pages/Stash'));
const StashCart = lazy(() => import('./pages/StashCart'));
const GreenDelivery = lazy(() => import('./pages/GreenDelivery'));
const Insurance = lazy(() => import('./pages/Insurance'));
const InsuranceAdmin = lazy(() => import('./pages/InsuranceAdmin'));
const DriverOnboarding = lazy(() => import('./pages/DriverOnboarding'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const SupportInfo = lazy(() => import('./pages/SupportInfo'));
const FundingCommand = lazy(() => import('./pages/FundingCommand'));
const L3Ops = lazy(() => import('./pages/L3Ops'));
const VisionBridge = lazy(() => import('./pages/VisionBridge'));
const VisionHud = lazy(() => import('./pages/VisionHud'));
import ReleaseGate from './components/ReleaseGate';
import { RELEASE_FLAGS } from './lib/releaseFlags';

// Shown while a lazily-split route chunk loads. Only Home stays in the eager
// bundle; every other page (including AiGps, so first paint never carries
// mapbox-gl) loads on demand and never hits the splash floor twice.
const RouteFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-black">
    <div className="w-8 h-8 border-4 border-[#8FE44E]/20 border-t-[#8FE44E] rounded-full animate-spin" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Shopify's embedded app must render without waiting for or requiring a Base44 session.
  // These routes are intentionally handled before any Base44 auth/loading gate so the
  // Shopify Admin iframe can load them even when no Base44 user is signed in.
  const pathname = window.location.pathname;
  if (isShopifyEmbedRequest(pathname)) {
    return (
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/shopify" element={<ShopifyEmbed />} />
        <Route path="/shopify/auth/callback" element={<ShopifyEmbed />} />
      </Routes>
      </Suspense>
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
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route element={<ProtectedRoute unauthenticatedElement={<Login />} />}>
        <Route element={<DriverLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/route" element={<RoutePlanner />} />
          <Route path="/lokin" element={<LokinAI />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/earnings-intelligence" element={<EarningsIntelligence />} />
          <Route path="/shift-report" element={<ShiftReport />} />
          <Route path="/driver-platforms" element={<DriverPlatforms />} />
          <Route path="/driver-platforms/uber/callback" element={<UberDriverCallback />} />
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
          <Route path="/traffic" element={<TrafficLog />} />
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
          <Route path="/gps-command" element={<GPSCommandCenter />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/showcase" element={<Showcase />} />
          <Route path="/funding-command" element={<FundingCommand />} />
          <Route path="/l3" element={<L3Ops />} />
          <Route path="/vision-bridge" element={<VisionBridge />} />
          <Route path="/vision-hud" element={<VisionHud />} />
          <Route path="/5g" element={<FiveG />} />
          <Route path="/active-delivery" element={<ActiveDelivery />} />
          <Route path="/certified" element={<Certified />} />
          <Route path="/merchant-hub" element={<MerchantHub />} />
          <Route path="/compliance-handoff" element={<ComplianceHandoff />} />
          <Route path="/merchant-portal" element={<Navigate to="/merchant-hub?tab=orders" replace />} />
          <Route path="/driver-dispatch" element={<DriverDispatch />} />
          <Route path="/printful-connect" element={<PrintfulConnect />} />
          <Route path="/printful/callback" element={<PrintfulCallback />} />
          <Route path="/stash" element={RELEASE_FLAGS.regulatedCannabis ? <Stash /> : <ReleaseGate title="Not available in this release" body="This feature is not available in the App Store 1.0 release." />} />
          <Route path="/stash/cart" element={RELEASE_FLAGS.regulatedCannabis ? <StashCart /> : <ReleaseGate title="Not available in this release" body="This feature is not available in the App Store 1.0 release." />} />
          <Route path="/green-delivery" element={RELEASE_FLAGS.regulatedCannabis ? <GreenDelivery /> : <ReleaseGate title="Not available in this release" body="This feature is not available in the App Store 1.0 release." />} />
          <Route path="/insurance" element={RELEASE_FLAGS.insuranceTransactions ? <Insurance /> : <ReleaseGate title="Not available in this release" body="This feature is not available in the App Store 1.0 release." />} />
          <Route path="/insurance-admin" element={RELEASE_FLAGS.insuranceTransactions ? <InsuranceAdmin /> : <ReleaseGate title="Not available in this release" body="This feature is not available in the App Store 1.0 release." />} />
          <Route path="/onboarding" element={<DriverOnboarding />} />
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
    </Suspense>
  );
};


function ShopifyPublicApp() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/shopify" element={<ShopifyEmbed />} />
          <Route path="/shopify/auth/callback" element={<ShopifyEmbed />} />
          <Route path="*" element={<ShopifyEmbed />} />
        </Routes>
        </Suspense>
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
          <FeatureTour />
          <DeepLinkHandler />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App