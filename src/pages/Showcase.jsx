import ShowcaseHero from "@/components/showcase/ShowcaseHero";
import FeaturesSidebar from "@/components/showcase/FeaturesSidebar";
import PhoneMockups from "@/components/showcase/PhoneMockups";
import CapabilitiesColumn from "@/components/showcase/CapabilitiesColumn";
import DashboardPanels from "@/components/showcase/DashboardPanels";
import ShowcaseFooter from "@/components/showcase/ShowcaseFooter";

export default function Showcase() {
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-10 pb-12">
      <ShowcaseHero />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-6 items-start">
        <FeaturesSidebar />
        <PhoneMockups />
        <CapabilitiesColumn />
      </div>
      <section>
        <div className="text-[11px] tracking-[0.22em] text-primary/70 font-display mb-3 text-center">DASHBOARD PANELS</div>
        <DashboardPanels />
      </section>
      <ShowcaseFooter />
    </div>
  );
}