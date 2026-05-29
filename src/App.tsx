import React, { useState } from "react";
import { CAMPUS_AREAS } from "./data/campusData";
import HeroSection from "./components/HeroSection";
import AreaButtons from "./components/AreaButtons";
import VRModal from "./components/VRModal";

export default function App() {
  const [activeAreaId, setActiveAreaId] = useState<string>("makers-studio");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const activeArea = CAMPUS_AREAS.find((area) => area.id === activeAreaId) || CAMPUS_AREAS[0];

  const handleExploreClick = () => {
    const campusGridElement = document.getElementById("campus-areas-grid");
    if (campusGridElement) {
      campusGridElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSelectArea = (areaId: string) => {
    setActiveAreaId(areaId);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      {/* 1. Hero Section */}
      <HeroSection onExploreClick={handleExploreClick} />

      {/* Main Layout containing only the 6 buttons, styled in deep maroon background */}
      <main className="flex-1 bg-[#801818] py-16 sm:py-20 relative overflow-hidden">
        {/* Subtle Decorative Lattice Background to match the original hero styling */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none text-white">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="main-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#main-grid)" />
          </svg>
        </div>

        {/* Faint gold radial glow underlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#f2be22]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <AreaButtons
            areas={CAMPUS_AREAS}
            activeAreaId={activeAreaId}
            onSelectArea={handleSelectArea}
          />
        </div>
      </main>

      {/* 360° VR View Overlay Modal */}
      <VRModal
        area={activeArea}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onNavigate={(areaId) => {
          setActiveAreaId(areaId);
        }}
      />
    </div>
  );
}
