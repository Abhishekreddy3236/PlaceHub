import { useEffect, useState } from 'react';
import Logo from './Logo';

const PLACE_VIEWBOX_WIDTH = 214;
const MENTS_VIEWBOX_WIDTH = 256;
const HUB_VIEWBOX_WIDTH = 180;

const getResponsiveLogoHeight = (width) => {
  if (width >= 1600) return 180; // 17.3" Laptops & Widescreen Monitors
  if (width >= 1366) return 160; // 15.6" Laptops
  if (width >= 1024) return 140; // 13" Laptops
  if (width >= 768) return 110;  // Tablets / iPad
  if (width >= 420) return 68;   // Large Phones (iPhone Pro Max, Galaxy Ultra, OnePlus)
  if (width >= 366) return 60;   // Standard Phones (iPhone 14/15, Samsung Galaxy S24)
  return 52;                     // Compact Phones (iPhone SE, narrow 320px/360px screens)
};

export default function SplashScreen({ isReady = true }) {
  const [logoHeight, setLogoHeight] = useState(() =>
    typeof window !== 'undefined'
      ? getResponsiveLogoHeight(window.innerWidth)
      : 60
  );
  const [collapsed, setCollapsed] = useState(false);
  // dotStage: 'hidden' | 'ball' | 'split' | 'wave'
  const [dotStage, setDotStage] = useState('hidden');
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [unmounted, setUnmounted] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setLogoHeight(getResponsiveLogoHeight(window.innerWidth));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scale = logoHeight / 110;
  const placeWidth = PLACE_VIEWBOX_WIDTH * scale;
  const mentsWidth = MENTS_VIEWBOX_WIDTH * scale;
  const hubWidth = HUB_VIEWBOX_WIDTH * scale;
  const fullLogoWidth = 500 * scale;

  // 1. Font loading effect
  useEffect(() => {
    let isMounted = true;
    
    // Wait for fonts to be ready before starting the animation sequence
    // Using document.fonts.load is more reliable than .ready because it explicitly queues the font.
    const fontReadyPromise = document.fonts ? document.fonts.load('900 80px Inter') : Promise.resolve();
    const fallbackTimeoutPromise = new Promise((resolve) => setTimeout(resolve, 1500));

    Promise.race([fontReadyPromise, fallbackTimeoutPromise]).then(() => {
      if (isMounted) {
        setFontsLoaded(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Animation timers effect
  useEffect(() => {
    let isMounted = true;
    const timers = [];

    if (fontsLoaded) {
      // STEP 2: At 420ms, trigger fast & snappy 220ms horizontal collapse
      timers.push(
        setTimeout(() => {
          if (isMounted) setCollapsed(true);
        }, 420)
      );

      // STEP 3: At 680ms, one clean blue ball appears below PlaceHub
      timers.push(
        setTimeout(() => {
          if (isMounted) setDotStage('ball');
        }, 680)
      );

      // STEP 4: At 940ms, the single ball splits smoothly outward into 4 dots
      timers.push(
        setTimeout(() => {
          if (isMounted) setDotStage('split');
        }, 940)
      );

      // STEP 5: At 1240ms, continuous smooth 4-dot loading wave starts
      timers.push(
        setTimeout(() => {
          if (isMounted) setDotStage('wave');
        }, 1240)
      );

      // Snappy minimum display time (2100ms / 2.1s)
      timers.push(
        setTimeout(() => {
          if (isMounted) setMinTimePassed(true);
        }, 2100)
      );
    }

    return () => {
      isMounted = false;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [fontsLoaded]);

  useEffect(() => {
    if (isReady && minTimePassed && !fadeOut) {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setUnmounted(true);
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [isReady, minTimePassed, fadeOut]);

  if (unmounted) {
    return null;
  }

  const isLargeDesktop = logoHeight >= 160;
  const isDesktop = logoHeight >= 140;
  const isTablet = logoHeight >= 110;

  const dotWidth = isLargeDesktop
    ? 20
    : isDesktop
      ? 16
      : isTablet
        ? 14
        : 12;
  const dotGap = isLargeDesktop ? 16 : isDesktop ? 14 : isTablet ? 12 : 10;
  const stepSize = dotWidth + dotGap;

  // Center stack offsets so when merged, all 4 dots sit at exact center
  const centerOffsets = [
    stepSize * 1.5,
    stepSize * 0.5,
    -stepSize * 0.5,
    -stepSize * 1.5,
  ];

  const bgColor = '#FFFFFF'; // Pure Luminous Crisp White

  return (
    <div
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none"
      style={{
        backgroundColor: bgColor,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 280ms ease-out',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes splashDotWave {
          0%, 80%, 100% {
            opacity: 0.28;
            transform: scale(1);
          }
          40% {
            opacity: 1;
            transform: scale(1.15);
          }
        }
      `}</style>

      <div 
        className="flex flex-col items-center justify-center"
        style={{ 
          opacity: fontsLoaded ? 1 : 0
        }}
      >
        {/* Perfectly Centered Responsive Logo Stage */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: collapsed
              ? `${placeWidth + hubWidth}px`
              : `${placeWidth + mentsWidth + hubWidth}px`,
            height: `${logoHeight}px`,
            transition: 'width 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Left: "Place" */}
          <div
            className="absolute top-0 left-0 overflow-hidden z-30"
            style={{
              width: `${placeWidth}px`,
              height: `${logoHeight}px`,
              backgroundColor: bgColor,
            }}
          >
            <div
              style={{
                width: `${fullLogoWidth}px`,
                height: `${logoHeight}px`,
              }}
            >
              <Logo className="h-full w-auto max-w-none block" />
            </div>
          </div>

          {/* Middle: "ments" */}
          <div
            className="absolute top-0 overflow-hidden z-10"
            style={{
              left: `${placeWidth}px`,
              width: `${mentsWidth}px`,
              height: `${logoHeight}px`,
              clipPath: collapsed ? 'inset(0 100% 0 0)' : 'inset(0 0% 0 0)',
              opacity: collapsed ? 0 : 1,
              transition:
                'clip-path 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 130ms ease 90ms',
            }}
          >
            <svg
              className="h-full w-auto max-w-none block"
              viewBox="0 0 256 110"
              style={{
                width: `${mentsWidth}px`,
                height: `${logoHeight}px`,
              }}
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMinYMid meet"
            >
              <defs>
                <linearGradient id="splashMentsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#020617" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
              </defs>
              <text
                x="0"
                y="78"
                fontFamily="Inter, Satoshi, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
                fontSize="80"
                fontWeight="900"
                fill="url(#splashMentsGradient)"
                letterSpacing="-1.5"
              >
                ments
              </text>
            </svg>
          </div>

          {/* Right: "Hub" */}
          <div
            className="absolute top-0 overflow-hidden z-20"
            style={{
              left: `${placeWidth}px`,
              width: `${hubWidth}px`,
              height: `${logoHeight}px`,
              transform: collapsed
                ? 'translate3d(0px, 0, 0)'
                : `translate3d(${mentsWidth}px, 0, 0)`,
              transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              backgroundColor: bgColor,
            }}
          >
            <div
              style={{
                width: `${fullLogoWidth}px`,
                height: `${logoHeight}px`,
                transform: `translate3d(-${placeWidth}px, 0, 0)`,
              }}
            >
              <Logo className="h-full w-auto max-w-none block" />
            </div>
          </div>
        </div>

        {/* Clean Matte Flat Blue Dots */}
        <div
          className={`flex items-center justify-center ${isLargeDesktop
            ? 'mt-9 h-9 gap-4'
            : isDesktop
              ? 'mt-9 h-8 gap-3.5'
              : isTablet
                ? 'mt-7 h-7 gap-3'
                : 'mt-4 h-6 gap-2.5'
            }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isHidden = dotStage === 'hidden';
            const isBall = dotStage === 'ball';
            const isSplit = dotStage === 'split';
            const isWave = dotStage === 'wave';

            let opacity = 0;
            let transform = 'translate3d(0, -14px, 0) scale(0)';

            if (isBall) {
              opacity = 1;
              transform = `translate3d(${centerOffsets[index]}px, 0, 0) scale(1.25)`;
            } else if (isSplit || isWave) {
              opacity = 0.28;
              transform = 'translate3d(0px, 0, 0) scale(1)';
            }

            return (
              <div
                key={index}
                className={`rounded-full ${isLargeDesktop
                  ? 'w-5 h-5'
                  : isDesktop
                    ? 'w-4 h-4'
                    : isTablet
                      ? 'w-3.5 h-3.5'
                      : 'w-3 h-3'
                  }`}
                style={{
                  backgroundColor: '#2563EB',
                  opacity,
                  transform,
                  boxShadow: 'none',
                  transition:
                    'transform 340ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
                  animation: isWave
                    ? `splashDotWave 1.6s infinite ease-in-out ${index * 0.22}s`
                    : 'none',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
