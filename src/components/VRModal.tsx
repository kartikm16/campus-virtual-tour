import React, { useEffect } from "react";
import { CampusArea } from "../types";
import VRViewer from "./VRViewer";
import { ArrowLeft, MapPin, Grid, BarChart3, CheckSquare, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface VRModalProps {
  area: CampusArea;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (areaId: string) => void;
}

export default function VRModal({ area, isOpen, onClose, onNavigate }: VRModalProps) {
  // Prevent background scrolling while tour is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Support "Escape" key press to exit VR modal smoothly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-black overflow-hidden">
      {/* Immersive Blurred backdrop */}
      <div 
        className="absolute inset-0 bg-gradient-to-tr from-neutral-950/98 via-neutral-900/90 to-neutral-950/95 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />

      {/* Main Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full h-full bg-neutral-950 shadow-2xl rounded-none border-none overflow-hidden flex flex-col z-10"
      >
        
        {/* Dynamic Mobile/Desktop Top navigation bar inside modal */}
        <div className="bg-neutral-900/95 border-b border-white/10 px-4 sm:px-6 py-3.5 flex items-center justify-between z-25 shrink-0">
          <button 
            onClick={onClose}
            className="group inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white hover:text-[#f2be22] py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Facility Grid</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#801818]/90 border border-[#f2be22]/30 text-white rounded-full text-[10px] sm:text-xs font-bold font-sans">
            <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#f2be22] animate-pulse" />
            <span>Active Virtual Presence</span>
          </div>
        </div>

        {/* Full-screen VR Viewport */}
        <div className="flex-1 relative min-h-0 bg-neutral-950">
          {area.id === "makers-studio" ? (
            <iframe 
              src="/vr%20tour/index.html" 
              className="w-full h-full border-none" 
              title="VR Tour" 
              allowFullScreen 
            />
          ) : (
            <VRViewer area={area} onNavigate={onNavigate} onClose={onClose} />
          )}
        </div>

      </motion.div>
    </div>
  );
}
