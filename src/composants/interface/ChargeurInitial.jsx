
import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import FondApp from "@/composants/disposition/FondApp";

const textSlides = [
  { text: "Créez des textes puissants", subtext: "avec l'intelligence artificielle" },
  { text: "Générez des images uniques", subtext: "en quelques secondes" },
  { text: "Produisez des vidéos", subtext: "sans effort" },
  { text: "Tout en un seul outil", subtext: "ViralWorks Studio pour tout créer" },
];

export default function ChargeurInitial({ onEnter }) {
  const [isReady, setIsReady] = useState(false);
  const [logoScale, setLogoScale] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const sliderRef = useRef(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  useEffect(() => {

    const logoTimer = setTimeout(() => {
      setLogoScale(1);
    }, 100);


    const buttonTimer = setTimeout(() => {
      setIsReady(true);
    }, 1000);


    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % textSlides.length);
    }, 3500);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(buttonTimer);
      clearInterval(slideInterval);
    };
  }, []);

  const handleEnter = useCallback(() => {
    if (onEnter) {
      onEnter();
    }
  }, [onEnter]);


  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsSliding(true);
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    if (clientX) {
      startXRef.current = clientX;
      currentXRef.current = clientX;
    }
  };

  useEffect(() => {
    if (!isSliding) return;
    
    const handleMove = (e) => {
      if (!sliderRef.current) return;
      
      e.preventDefault();
      const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
      if (!clientX) return;
      
      currentXRef.current = clientX;
      const sliderRect = sliderRef.current.getBoundingClientRect();
      const sliderWidth = sliderRect.width;
      const buttonWidth = 56;
      const maxDistance = sliderWidth - buttonWidth - 8;
      
      const deltaX = Math.max(0, Math.min(maxDistance, currentXRef.current - startXRef.current));
      const progress = (deltaX / maxDistance) * 100;
      
      setSlideProgress(progress);
      
      if (progress >= 85) {
        setSlideProgress(100);
        setTimeout(() => {
          handleEnter();
          setIsSliding(false);
          setSlideProgress(0);
        }, 100);
      }
    };

    const handleUp = () => {
      setIsSliding(false);
      setSlideProgress((prev) => {
        if (prev < 85) {
          return 0;
        }
        return prev;
      });
    };

    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [isSliding, handleEnter]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#07090f]">
        <FondApp fixed />
        <div className="absolute inset-0 opacity-30">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 800" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(65, 209, 255, 0.3)" />
                <stop offset="100%" stopColor="rgba(189, 52, 254, 0.2)" />
              </linearGradient>
            </defs>
            <path
              d="M0,400 Q300,200 600,400 T1200,400 L1200,800 L0,800 Z"
              fill="url(#waveGradient1)"
              className="animate-wave1"
            />
            <path
              d="M0,500 Q400,300 800,500 T1200,500 L1200,800 L0,800 Z"
              fill="url(#waveGradient1)"
              opacity="0.6"
              className="animate-wave2"
            />
          </svg>
        </div>

        <div className="absolute inset-0 opacity-20">
          <svg className="absolute inset-0 w-full h-full">
            {[...Array(20)].map((_, i) => {
              const x1 = (i * 37) % 100;
              const y1 = (i * 23) % 100;
              const x2 = ((i * 37 + 50) % 100);
              const y2 = ((i * 23 + 30) % 100);
              
              return (
                <line
                  key={i}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke={`rgba(${i % 3 === 0 ? '65, 209, 255' : i % 3 === 1 ? '189, 52, 254' : '255, 234, 131'}, 0.2)`}
                  strokeWidth="1"
                  className="animate-linePulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              );
            })}
          </svg>
        </div>

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] rounded-full blur-3xl animate-organicMove1" style={{
          background: 'radial-gradient(circle, rgba(65,209,255,0.25) 0%, transparent 70%)',
          animationDuration: '12s'
        }} />
        <div className="absolute bottom-1/4 right-1/4 w-[700px] h-[700px] rounded-full blur-3xl animate-organicMove2" style={{
          background: 'radial-gradient(circle, rgba(189,52,254,0.25) 0%, transparent 70%)',
          animationDuration: '15s',
          animationDelay: '2s'
        }} />
        
        <div className="absolute inset-0">
          {[...Array(25)].map((_, i) => {
            const colors = [
              'rgba(65, 209, 255, 0.5)',
              'rgba(189, 52, 254, 0.5)',
              'rgba(255, 234, 131, 0.5)',
              'rgba(255, 221, 53, 0.5)'
            ];
            const size = 3 + (i % 4) * 2;
            return (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: colors[i % colors.length],
                  left: `${(i * 13.7) % 95}%`,
                  top: `${(i * 19.3) % 90}%`,
                  animation: `organicFloat ${6 + (i % 4) * 1.5}s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                  boxShadow: `0 0 ${size * 3}px ${colors[i % colors.length]}`,
                  filter: 'blur(1px)'
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-6 sm:gap-8 px-4 py-8 w-full max-w-7xl mx-auto">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 shadow-[0_0_80px_rgba(65,209,255,0.6),0_0_120px_rgba(189,52,254,0.4)] flex items-center justify-center flex-shrink-0">
          <svg 
            width="128" 
            height="128" 
            viewBox="0 0 256 257" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-2xl"
            style={{ filter: 'drop-shadow(0 0 40px rgba(65,209,255,0.8)) drop-shadow(0 0 60px rgba(189,52,254,0.6))' }}
          >
            <defs>
              <linearGradient id="logoGradient1" x1="-0.828%" x2="57.636%" y1="7.652%" y2="78.411%">
                <stop offset="0%" stopColor="#41D1FF" />
                <stop offset="100%" stopColor="#BD34FE" />
              </linearGradient>
              <linearGradient id="logoGradient2" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%">
                <stop offset="0%" stopColor="#FFEA83" />
                <stop offset="8.333%" stopColor="#FFDD35" />
                <stop offset="100%" stopColor="#FFA800" />
              </linearGradient>
            </defs>
            
            <path 
              d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z" 
              fill="url(#logoGradient2)" 
            />
          </svg>
        </div>

        <div className="relative w-full min-h-[80px] sm:min-h-[100px] md:min-h-[120px] flex items-center justify-center overflow-hidden py-2 sm:py-4 flex-shrink-0">
          <div className="relative w-full max-w-4xl flex items-center justify-center">
            {textSlides.map((slide, index) => {
              const isActive = index === currentSlide;
              const offset = index - currentSlide;
              
              let translateX = '';
              let opacity = 0;
              let scale = 0.92;
              
              if (isActive) {
                translateX = 'translateX(0%)';
                opacity = 1;
                scale = 1;
              } else {
                translateX = `translateX(${offset > 0 ? '120%' : '-120%'})`;
                opacity = 0;
                scale = 0.92;
              }
              
              return (
                <div
                  key={index}
                  className="absolute flex flex-col items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
                  style={{
                    transform: `translate(-50%, -50%) ${translateX} scale(${scale})`,
                    opacity,
                    pointerEvents: isActive ? 'auto' : 'none',
                    willChange: isActive ? 'transform, opacity' : 'auto',
                    left: '50%',
                    top: '50%',
                    transformOrigin: 'center center',
                    width: '100%',
                    maxWidth: '100%'
                  }}
                >
                  <div className="text-center">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
                      {slide.text}
                    </h2>
                    <p className="text-sm sm:text-base md:text-lg text-gray-300">
                      {slide.subtext}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!isReady && (
          <div 
            className="relative w-16 h-16 sm:w-20 sm:h-20 transition-opacity duration-500 flex-shrink-0"
            style={{ opacity: logoScale }}
          >
            <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-400 border-r-violet-400 animate-spin" style={{ animationDuration: '1s' }} />
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-b-violet-300 border-l-cyan-300 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            <div className="absolute inset-6 rounded-full border-4 border-transparent border-t-yellow-300 animate-spin" style={{ animationDuration: '2s' }} />
          </div>
        )}

        {isReady && (
          <div className="relative w-full max-w-md mx-auto flex-shrink-0">
            <div 
              ref={sliderRef}
              className="relative h-14 sm:h-16 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 overflow-hidden cursor-pointer"
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
            >
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 transition-all duration-150 ease-out"
                style={{
                  width: `${slideProgress}%`,
                  boxShadow: slideProgress > 0 ? '0 0 30px rgba(65, 209, 255, 0.6), 0 0 60px rgba(189, 52, 254, 0.4)' : 'none'
                }}
              />
              
              <div
                className="absolute top-1 left-1 bottom-1 w-12 sm:w-14 bg-gradient-to-br from-white to-gray-100 rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing transition-transform duration-150 ease-out"
                style={{
                  transform: `translateX(${(() => {
                    if (!sliderRef.current) return 0;
                    const sliderRect = sliderRef.current.getBoundingClientRect();
                    const buttonWidth = sliderRect.height - 8;
                    const maxDistance = sliderRect.width - buttonWidth - 8;
                    return (slideProgress / 100) * maxDistance;
                  })()}px)`,
                  boxShadow: slideProgress > 0 
                    ? '0 0 20px rgba(65, 209, 255, 0.6), 0 0 40px rgba(189, 52, 254, 0.4), 0 4px 12px rgba(0,0,0,0.3)' 
                    : '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                <ChevronRight 
                  className="w-5 h-5 sm:w-6 sm:h-6 transition-all duration-200" 
                  style={{
                    transform: slideProgress > 50 ? 'scale(1.2)' : 'scale(1)',
                    color: slideProgress > 50 ? 'rgba(65, 209, 255, 1)' : 'rgba(107, 114, 128, 1)'
                  }}
                />
              </div>
            </div>
            
            <button
              onClick={handleEnter}
              className="mt-4 text-xs text-white/40 hover:text-white/60 transition-colors duration-200 underline decoration-dotted underline-offset-2 mx-auto block"
              style={{
                fontSize: '10px',
                letterSpacing: '0.05em'
              }}
            >
              Entrer directement
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
        
        @keyframes diagonalMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(40px, 40px); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.4; }
          50% { transform: translateY(-30px) translateX(15px); opacity: 0.8; }
        }
        
        @keyframes wave1 {
          0%, 100% { d: path("M0,400 Q300,200 600,400 T1200,400 L1200,800 L0,800 Z"); }
          50% { d: path("M0,400 Q300,300 600,400 T1200,400 L1200,800 L0,800 Z"); }
        }
        
        @keyframes wave2 {
          0%, 100% { d: path("M0,500 Q400,300 800,500 T1200,500 L1200,800 L0,800 Z"); }
          50% { d: path("M0,500 Q400,400 800,500 T1200,500 L1200,800 L0,800 Z"); }
        }
        
        @keyframes floatShape {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 0.3;
          }
          33% { 
            transform: translate(30px, -40px) rotate(120deg) scale(1.2);
            opacity: 0.6;
          }
          66% { 
            transform: translate(-20px, 30px) rotate(240deg) scale(0.8);
            opacity: 0.4;
          }
        }
        
        @keyframes linePulse {
          0%, 100% { opacity: 0.1; stroke-width: 1; }
          50% { opacity: 0.4; stroke-width: 2; }
        }
        
        @keyframes spiralFloat {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
            opacity: 0.4;
          }
          50% { 
            transform: translate(20px, -30px) scale(1.5);
            opacity: 0.8;
          }
        }
        
        @keyframes morphGlow {
          0%, 100% { 
            transform: translate(-50%, -50%) scale(1);
            border-radius: 50%;
          }
          25% { 
            transform: translate(-50%, -50%) scale(1.1) rotate(90deg);
            border-radius: 40% 60% 40% 60%;
          }
          50% { 
            transform: translate(-50%, -50%) scale(0.9) rotate(180deg);
            border-radius: 60% 40% 60% 40%;
          }
          75% { 
            transform: translate(-50%, -50%) scale(1.05) rotate(270deg);
            border-radius: 50% 50% 50% 50%;
          }
        }
        
        @keyframes organicMove1 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(50px, -30px); }
          50% { transform: translate(-30px, 50px); }
          75% { transform: translate(40px, 40px); }
        }
        
        @keyframes organicMove2 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-50px, 30px); }
          50% { transform: translate(30px, -50px); }
          75% { transform: translate(-40px, -40px); }
        }
        
        @keyframes organicMove3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -40px) scale(1.2); }
          66% { transform: translate(-40px, 60px) scale(0.8); }
        }
        
        @keyframes organicMove4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-60px, 40px) scale(0.8); }
          66% { transform: translate(40px, -60px) scale(1.2); }
        }
        
        @keyframes organicFloat {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
            opacity: 0.3;
          }
          50% { 
            transform: translate(40px, -50px) scale(1.3);
            opacity: 0.7;
          }
        }
        
        @keyframes organicRay {
          0%, 100% { 
            opacity: 0.1;
            stroke-width: 1;
          }
          50% { 
            opacity: 0.4;
            stroke-width: 3;
          }
        }
        
        @keyframes expandLine {
          0% { 
            width: 0;
            opacity: 0;
          }
          100% { 
            width: 96px;
            opacity: 1;
          }
        }
        
        @keyframes textGlow {
          0%, 100% { 
            text-shadow: 0 0 20px rgba(65, 209, 255, 0.5), 0 0 40px rgba(189, 52, 254, 0.3);
          }
          50% { 
            text-shadow: 0 0 30px rgba(65, 209, 255, 0.7), 0 0 60px rgba(189, 52, 254, 0.5);
          }
        }
        
        .animate-wave1 {
          animation: wave1 8s ease-in-out infinite;
        }
        
        .animate-wave2 {
          animation: wave2 10s ease-in-out infinite reverse;
        }
        
        .animate-morphGlow {
          animation: morphGlow 8s ease-in-out infinite;
        }
        
        .animate-organicMove1 {
          animation: organicMove1 12s ease-in-out infinite;
        }
        
        .animate-organicMove2 {
          animation: organicMove2 15s ease-in-out infinite;
        }
        
        .animate-organicMove3 {
          animation: organicMove3 10s ease-in-out infinite;
        }
        
        .animate-organicMove4 {
          animation: organicMove4 14s ease-in-out infinite;
        }
        
        .animate-organicFloat {
          animation: organicFloat 6s ease-in-out infinite;
        }
        
        .animate-organicRay {
          animation: organicRay 4s ease-in-out infinite;
        }
        
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(200%) skewX(-15deg); }
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes progressBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: translateX(50px) scale(0.9);
          }
          to { 
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
        
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        
        .animate-progressBar {
          animation: progressBar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

