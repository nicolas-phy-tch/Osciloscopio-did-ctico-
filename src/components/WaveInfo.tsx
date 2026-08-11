import { WaveType } from '../types';
import { Hash } from 'lucide-react';

interface WaveInfoProps {
  wave: WaveType;
}

export default function WaveInfo({ wave }: WaveInfoProps) {
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Analógica':
        return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'Digital':
        return 'text-blue-400 border-blue-500/20 bg-blue-500/5';
      case 'Transitoria':
        return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'Ruido':
        return 'text-purple-400 border-purple-500/20 bg-purple-500/5';
      default:
        return 'text-slate-400 border-slate-500/20 bg-slate-500/5';
    }
  };

  return (
    <div id="wave-info-panel" className="flex flex-col space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      
      {/* Title block with badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3.5">
        <div>
          <h2 className="font-sans text-lg font-bold tracking-tight text-white">
            {wave.name}
          </h2>
          <p className="font-mono text-[11px] text-slate-400">
            {wave.englishName}
          </p>
        </div>
        <span className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide ${getCategoryColor(wave.category)}`}>
          Señal {wave.category}
        </span>
      </div>

      {/* LaTeX Formula Panel */}
      <div className="flex flex-col space-y-1 rounded-2xl border border-white/10 bg-black/40 p-4">
        <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Hash className="h-3.5 w-3.5" /> Ecuación Matemática General
        </span>
        <div className="flex justify-center py-2.5 overflow-x-auto select-all">
          <code className="font-mono text-sm font-semibold tracking-wider text-sky-400">
            {wave.formula}
          </code>
        </div>
      </div>

    </div>
  );
}
