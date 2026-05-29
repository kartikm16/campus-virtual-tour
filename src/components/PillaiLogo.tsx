import React from "react";
// @ts-ignore
import logoBlack from "../../PillaiUnivLogo_BlackText.png";
// @ts-ignore
import logoWhite from "../../PillaiUnivLogo_OnlyPillaiLogoMark_WhiteText.png";

interface PillaiLogoProps {
  className?: string;
  light?: boolean;
}

export default function PillaiLogo({ className = "", light = true }: PillaiLogoProps) {
  return (
    <div className={`inline-flex items-center gap-4 ${className} select-none`}>
      {/* High-Resolution Shield Image from highly-reliable public CDN */}
      <img
        src={light ? logoWhite : logoBlack}
        alt="Pillai University Shield"
        className="h-16 sm:h-20 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.15)] shrink-0 transition-transform duration-300 hover:scale-105"
        referrerPolicy="no-referrer"
      />
      
      {/* Elegant Serif Typographic Brand Alignment */}
     
    </div>
  );
}
