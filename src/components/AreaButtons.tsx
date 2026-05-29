import React from "react";
import { CampusArea } from "../types";
import { CheckCircle2, MapPin } from "lucide-react";

interface AreaButtonsProps {
  areas: CampusArea[];
  activeAreaId: string;
  onSelectArea: (areaId: string) => void;
}

export default function AreaButtons({ areas, activeAreaId, onSelectArea }: AreaButtonsProps) {
  return (
    <div id="campus-areas-grid" className="w-full scroll-mt-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="font-sans text-[#f2be22] text-xs font-bold uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/15">
          Step Inside
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-white mt-2 mb-3">
          Select Your Campus Destination
        </h2>
        <p className="font-sans text-sm text-neutral-200/80">
          Click either of the {areas.length} facilities below to step in and explore Mahatma Education Society's campus.
        </p>
      </div>

      {/* Grid of fully-covered image cards optimized for exactly 2 spaces */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {areas.map((area, idx) => {
          const isActive = area.id === activeAreaId;
          return (
            <button
              key={area.id}
              onClick={() => onSelectArea(area.id)}
              id={`area-btn-${area.id}`}
              className={`group relative text-left rounded-2xl overflow-hidden shadow-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 transform border-2 text-neutral-900 cursor-pointer h-64 sm:h-80 w-full ${
                isActive
                  ? "border-[#f2be22] ring-4 ring-[#f2be22]/20"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {/* Full Image Background */}
              <img
                src={area.imageUrl}
                alt={area.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />

              {/* Seamless Dark Vignette Underlay for Perfect Contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent transition-opacity duration-300 group-hover:from-black/95 group-hover:via-black/55" />

              {/* Number Badge (Overlay) */}
              <div className="absolute top-4 left-4 w-7 h-7 rounded-full bg-black/60 text-white text-xs font-bold flex items-center justify-center backdrop-blur-md border border-white/10">
                0{idx + 1}
              </div>

              {/* Top Right Active Indicator Check */}
              {isActive && (
                <div className="absolute top-4 right-4 bg-[#801818] text-[#f2be22] px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-md border border-[#f2be22]/35 animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Selected</span>
                </div>
              )}

              {/* Facility Name Overlay Header at Bottom */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 flex flex-col justify-end z-10">
                <h3 className="font-serif text-lg sm:text-2xl font-black text-white tracking-tight leading-tight transition-colors group-hover:text-[#f2be22]">
                  {area.name}
                </h3>
                
                {/* Location Footer Accent */}
                <div className="mt-1.5 flex items-center gap-1 text-neutral-300 text-xs font-sans font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#f2be22] shrink-0" />
                  <span className="truncate">{area.location}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
