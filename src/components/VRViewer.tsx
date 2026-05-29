import React, { useRef, useEffect, useState } from "react";
import { CampusArea, Hotspot } from "../types";
// @ts-ignore
import makersStudioAudio from "../assets/audio/makers_studio.mp3";
// @ts-ignore
import evLabAudio from "../assets/audio/ev_lab.mp3";
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Compass, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  ArrowLeftRight, 
  Sparkles,
  Info,
  ChevronRight,
  Navigation,
  Headphones,
  Loader2,
  FileText,
  Volume1
} from "lucide-react";

interface VRViewerProps {
  area: CampusArea;
  onNavigate: (areaId: string) => void;
  onClose?: () => void;
}

export default function VRViewer({ area, onNavigate, onClose }: VRViewerProps) {
  // Viewer Angle States in Radians
  const [yaw, setYaw] = useState<number>(0); // 0 to 2*PI
  const [pitch, setPitch] = useState<number>(0); // -PI/4 to PI/4
  const [fov, setFov] = useState<number>(1.8); // Field of view in radians (1.0 = zoom in, 2.5 = zoom out)
  
  // Interactive Controls States
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true); // Enabled by default to support immediate immersion
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [hoveredHotspot, setHoveredHotspot] = useState<Hotspot | null>(null);
  
  // Projected Hotspots for overlay
  const [projectedHotspots, setProjectedHotspots] = useState<
    { hotspot: Hotspot; x: number; y: number; visible: boolean }[]
  >([]);

  // AI voice narration specific states
  const [narrationMuted, setNarrationMuted] = useState<boolean>(false);
  const [narrationLoading, setNarrationLoading] = useState<boolean>(false);
  const [narrationPlaying, setNarrationPlaying] = useState<boolean>(false);
  const [narrationText, setNarrationText] = useState<string>("");
  const [showTranscript, setShowTranscript] = useState<boolean>(true);
  const [isDemoSpeech, setIsDemoSpeech] = useState<boolean>(true);

  // Audio mapping variables requested by user
  const NARRATION_AUDIOS: Record<string, string> = {
    "makers-studio": makersStudioAudio,
    "ev-lab": evLabAudio
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // Dragging mechanism refs
  const isDragging = useRef<boolean>(false);
  const previousMousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const momentum = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  
  // Ambient Sound Ref (continuous room breeze synthesize)
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Narration player refs
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeechSynthesisRef = useRef<boolean>(false);

  // Preload general image when campus location changes
  useEffect(() => {
    setImageLoaded(false);
    setLoadError(false);
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = area.imageUrl;
    
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      // Reset view heading on new area load
      setYaw(0);
      setPitch(0);
      setFov(1.8);
      triggerNavigationSound();
    };
    
    img.onerror = () => {
      console.error("Failed to load panorama image: ", area.imageUrl);
      setLoadError(true);
    };
    
    return () => {
      imageRef.current = null;
    };
  }, [area.id]); // trigger strictly on ID to prevent infinite loops

  // Beautiful fade out helper
  const fadeAudioOut = (audio: HTMLAudioElement, duration = 800) => {
    return new Promise<void>((resolve) => {
      if (!audio || audio.paused) {
        resolve();
        return;
      }
      const startVolume = audio.volume;
      const interval = 25;
      const steps = duration / interval;
      const stepValue = startVolume / steps;
      
      const timer = setInterval(() => {
        try {
          audio.volume = Math.max(0, audio.volume - stepValue);
          if (audio.volume <= 0) {
            clearInterval(timer);
            audio.pause();
            resolve();
          }
        } catch (e) {
          clearInterval(timer);
          audio.pause();
          resolve();
        }
      }, interval);
    });
  };

  // Beautiful fade in helper
  const fadeAudioIn = (audio: HTMLAudioElement, targetVolume = 0.85, duration = 1200) => {
    try {
      audio.volume = 0;
      audio.play().catch(e => console.warn("Audio autoplay block standard bypass", e));
      const interval = 25;
      const steps = duration / interval;
      const stepValue = targetVolume / steps;
      
      const timer = setInterval(() => {
        try {
          audio.volume = Math.min(targetVolume, audio.volume + stepValue);
          if (audio.volume >= targetVolume) {
            clearInterval(timer);
          }
        } catch (e) {
          clearInterval(timer);
        }
      }, interval);
    } catch (e) {
      console.warn("Fade audio in trigger fail", e);
    }
  };

  // Main voice narration fetch-and-play hook (synchronized with section entrance)
  useEffect(() => {
    let active = true;

    // Stop former audios before initializing the new section's text
    const stopCurrentNarration = async () => {
      // 1. Cancel browser Web Speech synthesis if active
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      isSpeechSynthesisRef.current = false;

      // 2. Fade out and release previous audio streams
      if (activeAudioRef.current) {
        const aud = activeAudioRef.current;
        activeAudioRef.current = null;
        await fadeAudioOut(aud, 400);
      }
    };

    const startNarration = async () => {
      await stopCurrentNarration();
      
      if (!active) return;
      
      setNarrationPlaying(false);
      setNarrationLoading(true);
      setNarrationText(area.description);

      const selectedAudio = NARRATION_AUDIOS[area.id];
      if (!selectedAudio) {
        console.warn(`[No Audio Source] No placeholder or real file allocated for ${area.id}`);
        setIsDemoSpeech(true);
        playSpeechSynthesisFallback(area.description);
        return;
      }

      try {
        console.log(`[Audio System] Pre-loading audio for: ${area.id} URL: ${selectedAudio}`);
        const audio = new Audio(selectedAudio);
        audio.preload = "auto";
        activeAudioRef.current = audio;

        audio.addEventListener("canplaythrough", () => {
          if (!active) return;
          setNarrationLoading(false);
          setIsDemoSpeech(false);
          if (!narrationMuted) {
            fadeAudioIn(audio, 0.85, 1000);
          } else {
            audio.volume = 0;
            audio.play().catch(e => console.warn(e));
          }
        });

        audio.addEventListener("play", () => {
          if (active) {
            setNarrationPlaying(true);
            setIsDemoSpeech(false);
          }
        });

        audio.addEventListener("ended", () => {
          if (active) setNarrationPlaying(false);
        });

        audio.addEventListener("error", (e) => {
          // Placeholder stubs will fail to decode, falling back instantly and cleanly to speech synthesis
          console.log(`[Placeholder/Decode Warning] Using high-fidelity speech synthesis for ${area.id}`);
          setIsDemoSpeech(true);
          playSpeechSynthesisFallback(area.description);
        });

        audio.load();
      } catch (err) {
        console.warn("[Audio Init Fault] Triggering local TTS synthesis", err);
        setIsDemoSpeech(true);
        if (active) {
          playSpeechSynthesisFallback(area.description);
        }
      }
    };

    const playSpeechSynthesisFallback = (textToSpeak: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setNarrationLoading(false);
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);

        // Fetch cleanest local voice
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = 
          voices.find(v => v.lang.startsWith("en-US") && v.name.includes("Google")) ||
          voices.find(v => v.lang.startsWith("en")) ||
          voices[0];

        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = narrationMuted ? 0 : 0.85;

        utterance.onstart = () => {
          if (active) {
            setNarrationLoading(false);
            setNarrationPlaying(true);
            isSpeechSynthesisRef.current = true;
          }
        };

        utterance.onend = () => {
          if (active) {
            setNarrationPlaying(false);
            isSpeechSynthesisRef.current = false;
          }
        };

        utterance.onerror = () => {
          if (active) {
            setNarrationLoading(false);
            setNarrationPlaying(false);
            isSpeechSynthesisRef.current = false;
          }
        };

        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch (ex) {
        console.error("Synthesizer fallback crash:", ex);
        setNarrationLoading(false);
      }
    };

    startNarration();

    return () => {
      active = false;
      stopCurrentNarration();
    };
  }, [area.id]);

  // Replay Narration triggered from HUD
  const handleReplayNarration = async () => {
    console.log("[Audio System] Restarting voice narration from beginning...");
    
    // Stop all SpeechSynthesis and Audios
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeechSynthesisRef.current = false;

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
    }

    setNarrationPlaying(false);
    setNarrationLoading(true);

    const selectedAudio = NARRATION_AUDIOS[area.id];
    const isMock = !selectedAudio || selectedAudio.startsWith("data:") || selectedAudio.includes("makers_studio.mp3") || selectedAudio.includes("ev_lab.mp3");

    if (isDemoSpeech || isMock) {
      // Replay SpeechSynthesis
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(area.description);
        
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = 
          voices.find(v => v.lang.startsWith("en-US") && v.name.includes("Google")) ||
          voices.find(v => v.lang.startsWith("en")) ||
          voices[0];

        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = narrationMuted ? 0 : 0.85;

        utterance.onstart = () => {
          setNarrationLoading(false);
          setNarrationPlaying(true);
          isSpeechSynthesisRef.current = true;
        };

        utterance.onend = () => {
          setNarrationPlaying(false);
          isSpeechSynthesisRef.current = false;
        };

        utterance.onerror = () => {
          setNarrationLoading(false);
          setNarrationPlaying(false);
          isSpeechSynthesisRef.current = false;
        };

        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      // Replay actual high-quality loaded audio file
      try {
        if (activeAudioRef.current) {
          activeAudioRef.current.currentTime = 0;
          setNarrationLoading(false);
          fadeAudioIn(activeAudioRef.current, 0.85, 300);
        }
      } catch (ex) {
        console.warn("Audio element replay failed, attempting fallback", ex);
      }
    }
  };

  // Handle Mute/Unmute narration action button clicked
  const handleToggleMuteNarration = () => {
    const nextMuted = !narrationMuted;
    setNarrationMuted(nextMuted);

    if (nextMuted) {
      // Fade out
      if (activeAudioRef.current) {
        fadeAudioOut(activeAudioRef.current, 400);
      }
      if (isSpeechSynthesisRef.current && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setNarrationPlaying(false);
      }
    } else {
      // Fade in/unmute
      if (activeAudioRef.current) {
        fadeAudioIn(activeAudioRef.current, 0.85, 800);
      } else {
        // If synthesis fallback was interrupted, try rebooting SpeechSynthesis
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(narrationText || area.description);
          utterance.volume = 0.85;
          utterance.onstart = () => setNarrationPlaying(true);
          utterance.onend = () => setNarrationPlaying(false);
          activeUtteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
          isSpeechSynthesisRef.current = true;
        }
      }
    }
  };

  // Synthesize a beautiful spatial ambiance sweep sound when shifting spaces
  const triggerNavigationSound = () => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.5);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 1.2);
      
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.Q.setValueAtTime(10, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.3);
    } catch (e) {
      console.error("Audio trigger failed: ", e);
    }
  };

  // Synthesize a gentle continuous background drone (simulate summer breeze at Pillai Campus)
  useEffect(() => {
    if (audioEnabled) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        // Subtly modulating bandpass noise synthesis
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const mainGain = ctx.createGain();

        // Moderate pitch drone with elegant LFO filter sweep-ups
        osc.type = "triangle";
        osc.frequency.value = 110; 

        lfo.type = "sine";
        lfo.frequency.value = 0.15; // ultra-low 0.15 Hz oscillation
        lfoGain.gain.value = 400; // Sweep bandwidth

        filter.type = "bandpass";
        filter.frequency.value = 500;
        filter.Q.value = 1.5;

        mainGain.gain.setValueAtTime(0, ctx.currentTime);
        mainGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.5);

        // Routing
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        osc.connect(filter);
        filter.connect(mainGain);
        mainGain.connect(ctx.destination);

        osc.start();
        lfo.start();

        oscRef.current = osc;
        lfoRef.current = lfo;
        gainNodeRef.current = mainGain;
      } catch (err) {
        console.warn("Drone synth fail: ", err);
      }
    } else {
      stopDroneSynth();
    }

    return () => {
      stopDroneSynth();
    };
  }, [audioEnabled]);

  const stopDroneSynth = () => {
    try {
      if (gainNodeRef.current && audioContextRef.current) {
        const ctx = audioContextRef.current;
        gainNodeRef.current.gain.cancelScheduledValues(ctx.currentTime);
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, ctx.currentTime);
        gainNodeRef.current.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      }
      setTimeout(() => {
        oscRef.current?.stop();
        lfoRef.current?.stop();
        audioContextRef.current?.close();
        oscRef.current = null;
        lfoRef.current = null;
        audioContextRef.current = null;
      }, 350);
    } catch (e) {
      // safe bypass
    }
  };

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

  // Frame Renderer loop
  useEffect(() => {
    let frameId: number;
    
    const draw = () => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      if (!canvas || !img || !imageLoaded) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Handle Decelerating Momentum dragging
      if (!isDragging.current) {
        if (Math.abs(momentum.current.yaw) > 0.0001) {
          setYaw((prev) => (prev + momentum.current.yaw) % (2 * Math.PI));
          momentum.current.yaw *= 0.92; // Friction damping
        }
        if (Math.abs(momentum.current.pitch) > 0.0001) {
          setPitch((prev) => {
            const next = prev + momentum.current.pitch;
            return Math.max(-Math.PI / 4, Math.min(Math.PI / 4, next));
          });
          momentum.current.pitch *= 0.92;
        }

        // Cinematic auto-rotation when idling
        if (isAutoRotating && Math.abs(momentum.current.yaw) < 0.001) {
          setYaw((prev) => (prev + 0.0012) % (2 * Math.PI));
        }
      }

      // Draw beautiful seamless 360 cylindrical projection slice
      const imgW = img.width;
      const imgH = img.height;
      if (imgW === 0 || imgH === 0) return;

      // Horizontal FOV setup
      const horizontalFOV = fov;
      const verticalFOV = horizontalFOV * (canvasHeight / canvasWidth);
      const pxPerRad = imgW / (2 * Math.PI);

      const sliceW = horizontalFOV * pxPerRad;
      const sliceH = sliceW * (canvasHeight / canvasWidth);

      // Horizontal center coordinate maps from current yaw
      let centerX = (yaw / (2 * Math.PI)) * imgW;
      centerX = ((centerX % imgW) + imgW) % imgW;

      let leftX = centerX - sliceW / 2;

      // Pitch vertical center
      const centerY = (imgH / 2) - (pitch * pxPerRad);
      const topY = Math.max(0, Math.min(imgH - sliceH, centerY - sliceH / 2));

      // Quick helper to paint slices securely
      const renderSlice = (sx: number, sy: number, sw: number, sh: number, dx: number, dw: number) => {
        try {
          ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), Math.max(1, sw), Math.max(1, sh), dx, 0, dw, canvasHeight);
        } catch (e) {
          // safe bypass image segment scale bounds
        }
      };

      if (leftX < 0) {
        // Draw wrapped left margin
        const leftPartW = -leftX;
        const rightPartW = sliceW - leftPartW;
        const drawLeftCanvasW = (leftPartW / sliceW) * canvasWidth;

        renderSlice(imgW - leftPartW, topY, leftPartW, sliceH, 0, drawLeftCanvasW);
        renderSlice(0, topY, rightPartW, sliceH, drawLeftCanvasW, canvasWidth - drawLeftCanvasW);
      } else if (leftX + sliceW > imgW) {
        // Draw wrapped right margin
        const leftPartW = imgW - leftX;
        const rightPartW = sliceW - leftPartW;
        const drawLeftCanvasW = (leftPartW / sliceW) * canvasWidth;

        renderSlice(leftX, topY, leftPartW, sliceH, 0, drawLeftCanvasW);
        renderSlice(0, topY, rightPartW, sliceH, drawLeftCanvasW, canvasWidth - drawLeftCanvasW);
      } else {
        // Safe single contiguous slice
        renderSlice(leftX, topY, sliceW, sliceH, 0, canvasWidth);
      }

      // Compute Hotspot spatial placements on viewport array
      const CSS_WIDTH = canvasWidth / window.devicePixelRatio;
      const CSS_HEIGHT = canvasHeight / window.devicePixelRatio;

      const nextProjected = area.hotspots.map((hs) => {
        // shortest path delta
        let diffYaw = hs.yaw - yaw;
        diffYaw = ((diffYaw + Math.PI) % (2 * Math.PI));
        if (diffYaw < 0) diffYaw += 2 * Math.PI;
        diffYaw -= Math.PI;

        const diffPitch = hs.pitch - pitch;
        const halfFOV = horizontalFOV / 2;
        const isVisible = Math.abs(diffYaw) < halfFOV;

        // Calculate mapped viewport coordinates
        const x = (CSS_WIDTH / 2) + (diffYaw / halfFOV) * (CSS_WIDTH / 2);
        const y = (CSS_HEIGHT / 2) - (diffPitch / (verticalFOV / 2)) * (CSS_HEIGHT / 2);

        return {
          hotspot: hs,
          x,
          y,
          visible: isVisible && y > 0 && y < CSS_HEIGHT && x > 0 && x < CSS_WIDTH
        };
      });

      setProjectedHotspots(nextProjected);
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [yaw, pitch, fov, area, imageLoaded, isAutoRotating]);

  // Drag listeners
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    setIsAutoRotating(false);
    momentum.current = { yaw: 0, pitch: 0 };
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    const scale = fov / 800; // adapt speed to FOV scale

    const dYaw = -deltaX * scale;
    const dPitch = deltaY * scale;

    setYaw((prev) => (prev + dYaw + 2 * Math.PI) % (2 * Math.PI));
    setPitch((prev) => Math.max(-Math.PI / 4, Math.min(Math.PI / 4, prev + dPitch)));

    // Track momentum velocity for trailing deceleration glide
    momentum.current = { yaw: dYaw * 0.6, pitch: dPitch * 0.6 };
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  // Touch handlers for seamless mobile compatibility
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    isDragging.current = true;
    setIsAutoRotating(false);
    momentum.current = { yaw: 0, pitch: 0 };
    previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.current.y;

    const scale = fov / 700;
    const dYaw = -deltaX * scale;
    const dPitch = deltaY * scale;

    setYaw((prev) => (prev + dYaw + 2 * Math.PI) % (2 * Math.PI));
    setPitch((prev) => Math.max(-Math.PI / 4, Math.min(Math.PI / 4, prev + dPitch)));

    momentum.current = { yaw: dYaw * 0.6, pitch: dPitch * 0.6 };
    previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  // Manual rotation controls (for accessibility & non-mouse users)
  const manualRotate = (dir: "left" | "right" | "up" | "down", amount: number = 0.25) => {
    setIsAutoRotating(false);
    momentum.current = { yaw: 0, pitch: 0 };
    if (dir === "left") setYaw((prev) => (prev - amount + 2 * Math.PI) % (2 * Math.PI));
    if (dir === "right") setYaw((prev) => (prev + amount) % (2 * Math.PI));
    if (dir === "up") setPitch((prev) => Math.max(-Math.PI / 4, prev + amount));
    if (dir === "down") setPitch((prev) => Math.max(-Math.PI / 4, Math.min(Math.PI / 4, prev - amount)));
  };

  // Zoom control adjusting FOV boundary limits
  const adjustZoom = (type: "in" | "out") => {
    if (type === "in") {
      setFov((prev) => Math.max(1.0, prev - 0.15));
    } else {
      setFov((prev) => Math.min(2.5, prev + 0.15));
    }
  };

  // Calculate dynamic compass heading based on horizontal yaw rotation
  const getCompassHeading = () => {
    // 0 is Center / North
    const degrees = (yaw * (180 / Math.PI)) % 360;
    if (degrees >= 337.5 || degrees < 22.5) return { direction: "North", symbol: "N", angle: degrees };
    if (degrees >= 22.5 && degrees < 67.5) return { direction: "North-East", symbol: "NE", angle: degrees };
    if (degrees >= 67.5 && degrees < 112.5) return { direction: "East", symbol: "E", angle: degrees };
    if (degrees >= 112.5 && degrees < 157.5) return { direction: "South-East", symbol: "SE", angle: degrees };
    if (degrees >= 157.5 && degrees < 202.5) return { direction: "South", symbol: "S", angle: degrees };
    if (degrees >= 202.5 && degrees < 247.5) return { direction: "South-West", symbol: "SW", angle: degrees };
    if (degrees >= 247.5 && degrees < 292.5) return { direction: "West", symbol: "W", angle: degrees };
    return { direction: "North-West", symbol: "NW", angle: degrees };
  };

  const currentHeading = getCompassHeading();

  // Fullscreen support wrapper action
  const toggleFullscreenMode = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch((e) => console.warn(e));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch((e) => console.warn(e));
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-neutral-900 overflow-hidden rounded-2xl border-4 border-[#801818]/90">
      
      {/* Self-contained responsive animated voice wave styles */}
      <style>{`
        @keyframes narration-wave {
          0%, 100% { height: 4px; }
          50% { height: 20px; }
        }
        .animate-wave-1 { animation: narration-wave 1.0s ease-in-out infinite; }
        .animate-wave-2 { animation: narration-wave 1.3s ease-in-out infinite 0.15s; }
        .animate-wave-3 { animation: narration-wave 0.8s ease-in-out infinite 0.3s; }
        .animate-wave-4 { animation: narration-wave 1.1s ease-in-out infinite 0.05s; }
        .animate-wave-5 { animation: narration-wave 0.9s ease-in-out infinite 0.2s; }
      `}</style>

      {/* 1. Header Control Panel */}
      <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/85 to-transparent p-4 flex items-center justify-between z-30 select-none pointer-events-none">
        
        {/* Left Side: active area status */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#f2be22] hotspot-glowing">
            <Compass className="w-5 h-5 animate-spin-slow text-[#f2be22]" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#f2be22] tracking-widest block">
              360° VR Tour
            </span>
            <h4 className="text-sm font-serif font-black text-white drop-shadow-md leading-none">
              {area.title}
            </h4>
          </div>
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          
          {/* Compass Heading Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white font-sans text-xs backdrop-blur-md font-bold">
            <Navigation 
              className="w-3.5 h-3.5 text-[#f2be22]" 
              style={{ transform: `rotate(${currentHeading.angle}deg)`, transition: "transform 0.1s linear" }} 
            />
            <span>{currentHeading.symbol} ({Math.round(currentHeading.angle)}°)</span>
          </div>

          {/* Autoplay Sweep Toggle */}
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            title="Toggle Automatic Campus Pan Sweep"
            className={`p-2 rounded-lg border backdrop-blur-md transition-all cursor-pointer ${
              isAutoRotating 
                ? "bg-[#f2be22]/90 border-[#f2be22] text-black hover:bg-white" 
                : "bg-black/60 border-white/10 text-white hover:bg-black/80"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          {/* Sound Sweep Ambiance Toggle (ambient drone) */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? "Mute Campus Ambient Drone" : "Enable Spatial Campus Ambient Drone"}
            className={`p-2 rounded-lg border backdrop-blur-md transition-all cursor-pointer ${
              audioEnabled 
                ? "bg-emerald-500/90 border-emerald-400 text-white hover:bg-emerald-400" 
                : "bg-black/60 border-white/10 text-neutral-400 hover:bg-black/80"
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreenMode}
            title="Toggle Fullscreen"
            className="p-2 rounded-lg bg-black/60 border border-white/10 text-white hover:bg-black/80 backdrop-blur-md cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Exit Modal Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg bg-[#801818]/90 border border-white/20 text-white hover:bg-red-600 backdrop-blur-md font-sans font-bold text-[10px] sm:text-xs px-2.5 sm:px-3.5 flex items-center gap-1 cursor-pointer transition-colors"
            >
              Close Tour
            </button>
          )}

        </div>
      </div>

      {/* 2. Primary 360 Viewing Area Canvas block */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
        className="flex-1 w-full bg-neutral-950 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none", minHeight: "440px" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

        {/* LOADING SCREEN SPINNER LAYOUT */}
        {(!imageLoaded && !loadError) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/90 backdrop-blur-sm text-center p-6 border-2 border-neutral-800">
            <div className="w-16 h-16 rounded-full border-4 border-t-[#f2be22] border-r-transparent border-b-[#801818] border-l-transparent animate-spin mb-6" />
            <h5 className="font-serif text-lg font-black text-white leading-normal uppercase tracking-wider">
              Entering {area.name} Panorama...
            </h5>
            <p className="text-xs text-neutral-400 max-w-sm mt-2 leading-relaxed font-sans">
              Loading 360° cylindrical virtual-reality environment for the Mahatma Education Society's Pillai campus campus block.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-neutral-300">
              <Sparkles className="w-3.5 h-3.5 text-[#f2be22] animate-bounce" />
              <span>Click and drag inside the viewport once ready to rotate in 360°</span>
            </div>
          </div>
        )}

        {/* LOADING FAILS FALLBACK ACCENT SCREEN */}
        {loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-900 border-2 border-red-900/50 text-center p-6">
            <div className="w-12 h-12 rounded-full bg-red-950 text-red-500 flex items-center justify-center mb-4 border border-red-800">
              <Info className="w-6 h-6" />
            </div>
            <h5 className="font-serif text-base font-bold text-white uppercase">
              Failed to Teleport to {area.name}
            </h5>
            <p className="text-xs text-neutral-400 max-w-xs mt-1.5 font-sans">
              Network limits or CORS block prevented loading the High-Definition source panorama.
            </p>
            <button 
              onClick={() => {
                setImageLoaded(false);
                setLoadError(false);
                // force reload image
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = area.imageUrl + "?retry=" + Date.now();
                img.onload = () => {
                  imageRef.current = img;
                  setImageLoaded(true);
                };
                img.onerror = () => setLoadError(true);
              }}
              className="mt-4 px-4 py-2 bg-[#801818] text-white hover:bg-[#a02020] text-xs font-bold rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* 3. DYNAMIC PULSING HOTSPOT OVERLAYS */}
        {imageLoaded && projectedHotspots.map(({ hotspot, x, y, visible }) => {
          if (!visible) return null;
          
          const isHovered = hoveredHotspot?.id === hotspot.id;

          return (
            <div
              key={hotspot.id}
              className="absolute z-10 select-none transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
              style={{ 
                left: `${x}px`, 
                top: `${y}px`, 
                transition: "opacity 0.15s ease-out, transform 0.15s ease-out" 
              }}
            >
              {/* Dynamic Information Hover Box */}
              {isHovered && (
                <div 
                  className="absolute bottom-11 left-1/2 -translate-x-1/2 bg-neutral-950/95 border border-[#f2be22]/40 text-white rounded-xl p-3 shadow-2xl backdrop-blur-md w-56 animate-fade-in pointer-events-none select-none z-40 text-left"
                  style={{ transformOrigin: "bottom center" }}
                >
                  <p className="text-[10px] uppercase font-extrabold text-[#f2be22] tracking-wider mb-1 flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-[#f2be22] rotate-45" />
                    <span>Navigate Area</span>
                  </p>
                  <h6 className="text-xs font-serif font-black mb-1 text-white leading-normal">
                    {hotspot.label}
                  </h6>
                  {hotspot.info && (
                    <p className="text-[10px] text-neutral-300 leading-normal font-sans font-light">
                      {hotspot.info}
                    </p>
                  )}
                  <div className="mt-2 text-[8px] uppercase tracking-widest text-[#f2be22] hover:text-white font-bold inline-flex items-center gap-0.5">
                    <span>Teleport now</span>
                    <ChevronRight className="w-2.5 h-2.5" />
                  </div>
                </div>
              )}

              {/* Glowing, Pulsing Gateway Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hotspot.targetAreaId) {
                    onNavigate(hotspot.targetAreaId);
                  }
                }}
                onMouseEnter={() => setHoveredHotspot(hotspot)}
                onMouseLeave={() => setHoveredHotspot(null)}
                className="group relative flex items-center justify-center w-11 h-11 rounded-full bg-black/60 hover:bg-[#801818] text-[#f2be22] hover:text-white border-2 border-[#f2be22] hover:border-white shadow-lg shadow-black/40 transition-all duration-300 hover:scale-125 hover:rotate-12 active:scale-95 cursor-pointer backdrop-blur-sm"
              >
                {/* Visual pulse rings */}
                <div className="absolute inset-0 rounded-full border-2 border-[#f2be22] animate-ping opacity-35" />
                <div className="absolute inset-0 rounded-full bg-[#f2be22]/10 animate-pulse" />

                <Compass className="w-5 h-5 transition-transform duration-300 group-hover:rotate-45" />

                {/* mini label marker on physical spot if not hovered */}
                {!isHovered && (
                  <div className="absolute top-11 bg-black/75 backdrop-blur-sm border border-white/5 text-[9px] text-neutral-200 px-1.5 py-0.5 rounded-md font-sans whitespace-nowrap font-medium pointer-events-none select-none shadow">
                     Go to {hotspot.label}
                  </div>
                )}
              </button>
            </div>
          );
        })}

        {/* Centered Reticle Center Guide */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-white/20 rounded-full pointer-events-none opacity-45 flex items-center justify-center">
          <div className="w-1 h-1 bg-white rounded-full" />
        </div>

        {/* 4. EXTREMELY FLOATING GLASSMORPHIC CONTROL DECK: AI Campus Narrator (Placed bottom-left, fully active) */}
        {imageLoaded && (
          <div className="absolute bottom-16 sm:bottom-4 left-4 z-40 max-w-[320px] w-auto pointer-events-auto select-none">
            <div className="backdrop-blur-md bg-neutral-950/80 border border-white/10 rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2 bg-gradient-to-tr from-neutral-950/90 to-neutral-900/60 transition-all duration-300 hover:border-[#f2be22]/40">
              
              {/* Header Title with headphones */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg border flex items-center justify-center transition-all ${
                    narrationPlaying 
                      ? "bg-[#801818] border-[#f2be22]/30 text-[#f2be22] animate-pulse" 
                      : "bg-neutral-900 border-white/10 text-white/50"
                  }`}>
                    <Headphones className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] tracking-widest font-bold text-[#f2be22] uppercase block">Voice Guide</span>
                    <h5 className="font-serif font-black text-xs text-white leading-none flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span>{area.name} AI Narration</span>
                      {isDemoSpeech && (
                        <span className="text-[8px] px-1 bg-amber-500/10 border border-amber-500/20 text-[#f2be22] uppercase font-sans" title="Local high-fidelity voice generator fallback (replace mp3 files in src/assets/audio/ to override)">
                          Demo
                        </span>
                      )}
                    </h5>
                  </div>
                </div>

                {/* Status dot or spinner */}
                {narrationLoading ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-[#f2be22] bg-[#f2be22]/10 border border-[#f2be22]/20 px-2 py-0.5 rounded-full font-sans font-bold">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Synthesizing...</span>
                  </div>
                ) : narrationPlaying ? (
                  <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>Streaming Voice</span>
                  </div>
                ) : (
                  <span className="text-[9px] text-white/40 uppercase font-black">Ready</span>
                )}
              </div>

              {/* Bouncing audio sound wave graphics - ONLY while speaking and not muted */}
              {narrationPlaying && !narrationMuted ? (
                <div className="h-6 flex items-end justify-center gap-1.5 px-3 py-1 bg-black/40 border border-neutral-800 rounded-lg">
                  <div className="w-1 bg-[#f2be22] rounded-full animate-wave-1 bar" />
                  <div className="w-1 bg-[#f2be22]/80 rounded-full animate-wave-2 bar" />
                  <div className="w-1 bg-[#801818] rounded-full animate-wave-3 bar" />
                  <div className="w-1 bg-[#f2be22] rounded-full animate-wave-4 bar" />
                  <div className="w-1 bg-[#801818] rounded-full animate-wave-5 bar" />
                </div>
              ) : (
                // Flat line when paused/muted/idle
                <div className="h-6 flex items-center justify-center px-3 py-1 bg-black/20 border border-neutral-900/50 rounded-lg">
                  <div className="w-full h-0.5 bg-neutral-800 rounded-full relative">
                    {narrationLoading && (
                      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#f2be22] to-transparent w-16 animate-shimmer" style={{ animation: "shimmer 1.5s infinite linear" }} />
                    )}
                  </div>
                </div>
              )}

              {/* Collapsible live text read-along caption panel */}
              {showTranscript && narrationText && (
                <div className="max-h-24 overflow-y-auto pr-1 bg-black/40 rounded-xl p-2.5 border border-white/5 font-sans text-[10px] text-neutral-300 leading-relaxed font-light select-text pointer-events-auto">
                  {narrationText}
                </div>
              )}

              {/* Button controllers: MUTE toggler, replay button, and transcript drawer */}
              <div className="flex items-center gap-1.5 mt-0.5">
                
                {/* Voice Narration Sound Button */}
                <button
                  onClick={handleToggleMuteNarration}
                  title={narrationMuted ? "Unmute Voice Narration" : "Mute Voice Narration"}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border font-sans text-[10px] font-extrabold tracking-wide uppercase transition-all cursor-pointer ${
                    !narrationMuted 
                      ? "bg-[#801818] hover:bg-[#9c2020] text-white border-[#f2be22]/30 active:scale-95" 
                      : "bg-[#f2be22]/10 hover:bg-[#f2be22]/20 text-[#f2be22] border-[#f2be22]/20 hover:text-white"
                  }`}
                >
                  {narrationMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 shrink-0" />
                      <span>Sound Off</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Sound On</span>
                    </>
                  )}
                </button>

                {/* Replay Narration Button */}
                <button
                  onClick={handleReplayNarration}
                  title="Replay Voice Narration"
                  className="p-2 rounded-xl border border-white/10 bg-[#f2be22]/5 text-[#f2be22] hover:text-white hover:bg-neutral-800 flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Toggle Transcript display */}
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  title="Toggle Read-Along Text Caption Box"
                  className={`p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                    showTranscript 
                      ? "bg-neutral-800 border-neutral-700 text-white" 
                      : "bg-black/60 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>

              </div>

            </div>
          </div>
        )}

        {/* View instruction prompt Overlay (bottom center) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center">
          <p className="bg-black/60 border border-white/10 backdrop-blur-md rounded-full py-1 px-3 text-[10px] text-neutral-200 font-sans tracking-wide">
            🖱️ Drag panorama image to look around Mahama Education Society in 360°
          </p>
        </div>

        {/* 5. Left/Right/Plus/Minus Control Panel overlay bottom right */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-black/60 border border-white/10 p-1.5 rounded-xl backdrop-blur-md shadow-lg pointer-events-auto select-none">
          
          <button
            onClick={() => manualRotate("left")}
            title="Rotate Left"
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 group-hover:scale-110" />
          </button>
          <button
            onClick={() => manualRotate("right")}
            title="Rotate Right"
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 transform scale-x-[-1] group-hover:scale-110" />
          </button>
          
          <div className="w-px h-4 bg-white/15 mx-1" />

          <button
            onClick={() => adjustZoom("in")}
            title="Zoom In"
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => adjustZoom("out")}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
}
