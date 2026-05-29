import React, { useRef, useEffect } from "react";
import { Clock, BookOpen, Award, ArrowDown, Sparkles } from "lucide-react";
import PillaiLogo from "./PillaiLogo";

const panoramaBg = "/images/PANO_20200719_160026_7.jpg";

interface HeroSectionProps {
  onExploreClick: () => void;
}

export default function HeroSection({ onExploreClick }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ResizeObserver on the container to preserve responsive sizes at all times
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = Math.floor(width || 800) * window.devicePixelRatio;
          canvas.height = Math.floor(height || 480) * window.devicePixelRatio;
          canvas.style.width = "100%";
          canvas.style.height = "100%";
        }
      }
    });

    observer.observe(container);
    return () => {
      observer.unobserve(container);
    };
  }, []);

  // Frame Renderer for realistic 360 degree panoramic rotation
  useEffect(() => {
    let frameId: number;
    let yawValue = 0;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = panoramaBg;
    
    let isLoaded = false;
    img.onload = () => {
      isLoaded = true;
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas || !isLoaded) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Slow peaceful ambient automatic rotation (yaw in radians)
      yawValue = (yawValue + 0.0004) % (2 * Math.PI);

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Horizontal FOV (immersive wide 360 rendering perspective)
      const horizontalFOV = 2.4; 
      const verticalFOV = horizontalFOV * (canvasHeight / canvasWidth);
      const imgW = img.width;
      const imgH = img.height;

      if (imgW === 0 || imgH === 0) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const pxPerRad = imgW / (2 * Math.PI);
      const sliceW = horizontalFOV * pxPerRad;
      const sliceH = sliceW * (canvasHeight / canvasWidth);

      // Map yaw to current horizontal center
      let centerX = (yawValue / (2 * Math.PI)) * imgW;
      centerX = ((centerX % imgW) + imgW) % imgW;

      let leftX = centerX - sliceW / 2;

      const pitch = -0.06; // slight downward tilt for a better laboratory perspective
      const centerY = (imgH / 2) - (pitch * pxPerRad);
      const topY = Math.max(0, Math.min(imgH - sliceH, centerY - sliceH / 2));

      // Help scale and paint the specific 2D slices seamlessly
      const renderSlice = (sx: number, sy: number, sw: number, sh: number, dx: number, dw: number) => {
        try {
          ctx.drawImage(
            img, 
            Math.max(0, sx), 
            Math.max(0, sy), 
            Math.max(1, sw), 
            Math.max(1, sh), 
            dx, 
            0, 
            dw, 
            canvasHeight
          );
        } catch (e) {
          // safe boundary protection
        }
      };

      if (leftX < 0) {
        const leftPartW = -leftX;
        const rightPartW = sliceW - leftPartW;
        const drawLeftCanvasW = (leftPartW / sliceW) * canvasWidth;

        renderSlice(imgW - leftPartW, topY, leftPartW, sliceH, 0, drawLeftCanvasW);
        renderSlice(0, topY, rightPartW, sliceH, drawLeftCanvasW, canvasWidth - drawLeftCanvasW);
      } else if (leftX + sliceW > imgW) {
        const leftPartW = imgW - leftX;
        const rightPartW = sliceW - leftPartW;
        const drawLeftCanvasW = (leftPartW / sliceW) * canvasWidth;

        renderSlice(leftX, topY, leftPartW, sliceH, 0, drawLeftCanvasW);
        renderSlice(0, topY, rightPartW, sliceH, drawLeftCanvasW, canvasWidth - drawLeftCanvasW);
      } else {
        renderSlice(leftX, topY, sliceW, sliceH, 0, canvasWidth);
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section 
      ref={containerRef}
      className="relative bg-transparent text-neutral-900 overflow-hidden py-16 lg:py-24 border-b border-neutral-100"
    >
      {/* 360° Real-time Spherical Rotating Panorama VR Background Canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 block w-full h-full pointer-events-none" 
      />

      {/* Slight white background overlay for impeccable text readability */}
      <div className="absolute inset-0 bg-white/40 pointer-events-none" />


      {/* Decorative Brand Lattice Background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Subtle Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#801818]/4 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          {/* Official Pillai University Shield & Elegant Tagline Logo Block */}
          <div className="flex justify-center mb-8 sm:mb-10 animate-fade-in">
            <PillaiLogo light={false} />
          </div>

          {/* Heading with Brand Color Accents */}
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 mb-6 leading-[1.12]">
            Experience <span className="text-[#801818]">Pillai University</span>
            <br />
            in Immersive 360° Virtual Reality
          </h1>

          {/* Subtitle text */}
          <p className="font-sans text-base sm:text-lg lg:text-xl text-neutral-600 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
            Step inside Mahatma Education Society's tech-forward workspace. Experience our state-of-the-art Makers Innovation Studio and the high-tech Electric Vehicle Engineering Laboratory in fully immersive 360° virtual reality.
          </p>

          {/* Program Features Grid (Replicating reference image exactly) */}
         

          {/* Golden Exploration button block */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={onExploreClick}
              id="hero-explore-btn"
              className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-[#801818] hover:bg-neutral-900 text-white rounded-full font-sans font-bold text-base shadow-xl hover:shadow-[#801818]/25 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <span>Explore Virtual Tour</span>
              <ArrowDown className="w-4 h-4 bg-transparent stroke-[3px] group-hover:translate-y-0.5 transition-transform" />
            </button>

          </div>
        </div>

        {/* Floating Vertical Accent resembling reference image enquiry banner */}
       
      </div>
    </section>
  );
}
