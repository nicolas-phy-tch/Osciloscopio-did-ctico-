import { WaveType } from '../types';

interface WaveSelectorProps {
  waves: WaveType[];
  selectedWaveId: string;
  onSelectWave: (waveId: string) => void;
}

export default function WaveSelector({
  waves,
  selectedWaveId,
  onSelectWave
}: WaveSelectorProps) {
  
  // Custom hand-drawn SVG previews for all 10 electronic waves
  const renderWaveIcon = (waveId: string, isSelected: boolean) => {
    const strokeColor = isSelected ? 'stroke-slate-50' : 'stroke-slate-400 group-hover:stroke-slate-100';
    
    switch (waveId) {
      case 'sine':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,15 C7.5,1 7.5,29 15,15 C22.5,1 22.5,29 30,15 C37.5,1 37.5,29 45,15 C52.5,1 52.5,29 60,15" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'square':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,15 L0,5 L15,5 L15,25 L30,25 L30,5 L45,5 L45,25 L60,25" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'triangle':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,15 L7.5,5 L22.5,25 L37.5,5 L52.5,25 L60,15" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'sawtooth':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,25 L15,5 L15,25 L30,5 L30,25 L45,5 L45,25 L60,5" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'pulse':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,25 L0,5 L12,5 L12,25 L60,25" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'rectified':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,25 C3.75,1 11.25,1 15,25 C18.75,1 26.25,1 30,25 C33.75,1 41.25,1 45,25 C48.75,1 56.25,1 60,25" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'rc_charge':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,25 C2.5,15 12.5,5 15,5 L15,25 C17.5,15 27.5,5 30,5 L30,25 C32.5,15 42.5,5 45,5 L45,25 C47.5,15 57.5,5 60,5" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'staircase':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,25 L15,25 L15,18.3 L30,18.3 L30,11.6 L45,11.6 L45,5 L60,5" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'damped':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,15 C2,1 4,29 8,15 C11,5 14,25 18,15 C21,8 24,22 28,15 C31,10 34,20 38,15 C41,12 44,18 48,15 C52,13 56,17 60,15" 
                  className={`${strokeColor} transition-colors`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'noise':
        return (
          <svg className="h-10 w-20 flex-shrink-0" viewBox="0 0 60 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,15 L3,5 L6,25 L9,10 L12,20 L15,2 L18,28 L21,12 L24,18 L27,6 L30,24 L33,10 L36,20 L39,4 L42,26 L45,12 L48,16 L51,8 L54,22 L57,14 L60,15" 
                  className={`${strokeColor} transition-colors`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'Analógica':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Digital':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Transitoria':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Ruido':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
          Selección de Señal (10 Tipos)
        </h3>
        <span className="font-mono text-[11px] font-bold text-sky-400">
          Total: {waves.length} Canales
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {waves.map((wave) => {
          const isSelected = wave.id === selectedWaveId;
          
          return (
            <button
              id={`wave-card-${wave.id}`}
              key={wave.id}
              onClick={() => onSelectWave(wave.id)}
              className={`group flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all duration-300 outline-none cursor-pointer backdrop-blur-md ${
                isSelected
                  ? 'border-white/30 bg-white/15 shadow-xl shadow-white/5 ring-1 ring-white/10 translate-x-1'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="mr-3 flex flex-col space-y-1 overflow-hidden">
                <div className="flex items-center space-x-2">
                  <span className={`font-sans text-sm font-semibold tracking-tight transition-colors ${
                    isSelected ? 'text-white' : 'text-slate-300 group-hover:text-slate-100'
                  }`}>
                    {wave.name}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wide ${getCategoryStyles(wave.category)}`}>
                    {wave.category}
                  </span>
                </div>
                <p className="line-clamp-1 font-mono text-[10px] text-slate-400">
                  {wave.formula}
                </p>
              </div>

              {/* Glowing Interactive Visual Preview */}
              <div className={`flex items-center justify-center rounded-lg border px-2 py-1 transition-all duration-300 ${
                isSelected ? 'border-white/20 bg-white/10' : 'border-white/5 bg-black/25 group-hover:border-white/10'
              }`}>
                {renderWaveIcon(wave.id, isSelected)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
