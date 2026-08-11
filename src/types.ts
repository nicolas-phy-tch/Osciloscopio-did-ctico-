export type WaveCategory = 'Analógica' | 'Digital' | 'Transitoria' | 'Ruido';

export interface WaveType {
  id: string;
  name: string;
  englishName: string;
  formula: string;
  description: string;
  electronicsContext: string;
  harmonics: string;
  category: WaveCategory;
  // Dynamic formula params
  mathFormula: (t: number) => number;
}

export interface AudioSettings {
  frequency: number;
  amplitude: number;
  isPlaying: boolean;
  isMuted: boolean;
}

export interface OscilloscopeSettings {
  timebase: number; // horizontal scale factor
  gain: number;     // vertical scale factor
  triggerEnabled: boolean;
  showGrid: boolean;
  mode: 'time' | 'frequency' | 'vu'; // Time domain (oscilloscope), Frequency domain (FFT spectrum) or VU Volume columns
  freeze: boolean;
  traceMode?: 'audio' | 'ideal' | 'fourier' | 'comparison';
}
