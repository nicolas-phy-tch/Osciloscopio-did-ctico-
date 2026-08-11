import { useState, useEffect, useRef } from 'react';
import { getFullWaveDefinitions, waveDefinitions } from './waves';
import { AudioSettings, OscilloscopeSettings, WaveType } from './types';
import Oscilloscope from './components/Oscilloscope';
import WaveSelector from './components/WaveSelector';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Info,
  Radio,
  RotateCcw,
  Maximize2,
  Grid,
  Zap,
  HelpCircle,
  Clock,
  FlameKindling,
  Mic,
  MicOff,
  Power,
  Activity,
  FileCode,
  Download
} from 'lucide-react';

export default function App() {
  const waves = getFullWaveDefinitions();

  // Selected Wave State
  const [selectedWaveId, setSelectedWaveId] = useState<string>('sine');
  const activeWave = waves.find((w) => w.id === selectedWaveId) || waves[0];

  // Instrument State
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    frequency: 440, // 440Hz standard reference
    amplitude: 0.3,  // safe starting amplitude
    isPlaying: false,
    isMuted: false
  });

  const [scopeSettings, setScopeSettings] = useState<OscilloscopeSettings>({
    timebase: 1.5,
    gain: 1.0,
    triggerEnabled: true,
    showGrid: true,
    mode: 'time',
    freeze: false,
    traceMode: 'comparison'
  });

  // Audio Context Ref & Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  
  // Tracks if audio subsystem has been initialized at least once
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [browserBlocked, setBrowserBlocked] = useState(false);

  // Microphone Capture State & Refs
  const [isMicActive, setIsMicActive] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Slider mapping for logarithmic frequency
  // Slider goes from 0 to 100, maps to 20Hz - 2000Hz
  const minF = 20;
  const maxF = 2000;
  
  const freqToSlider = (freq: number): number => {
    return (100 * Math.log(freq / minF)) / Math.log(maxF / minF);
  };

  const sliderToFreq = (val: number): number => {
    const f = minF * Math.exp((val / 100) * Math.log(maxF / minF));
    return Math.round(f * 10) / 10; // 1 decimal place precision
  };

  const [frequencySliderVal, setFrequencySliderVal] = useState<number>(
    freqToSlider(440)
  );

  // Initialize buffers on startup when audio context is created
  const generateAllBuffers = (ctx: AudioContext) => {
    const sampleRate = ctx.sampleRate;
    const N = 2048; // single-cycle size

    waveDefinitions.forEach((def) => {
      if (def.id === 'noise') {
        // 2 seconds of high-fidelity white noise to make it non-periodic
        const noiseLength = sampleRate * 2;
        const buffer = ctx.createBuffer(1, noiseLength, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < noiseLength; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        buffersRef.current[def.id] = buffer;
      } else {
        // Periodic waves (1-9)
        const buffer = ctx.createBuffer(1, N, sampleRate);
        const data = buffer.getChannelData(0);
        const mathFormula = getFullWaveDefinitions().find((w) => w.id === def.id)?.mathFormula || Math.sin;

        // Fill raw values
        for (let i = 0; i < N; i++) {
          data[i] = mathFormula(i / N);
        }

        // AC-couple (remove any DC offset)
        let sum = 0;
        for (let i = 0; i < N; i++) {
          sum += data[i];
        }
        const mean = sum / N;
        for (let i = 0; i < N; i++) {
          data[i] -= mean;
        }

        // Normalize to peak 0.98 for safe headroom
        let maxVal = 0;
        for (let i = 0; i < N; i++) {
          const absVal = Math.abs(data[i]);
          if (absVal > maxVal) maxVal = absVal;
        }
        if (maxVal > 0) {
          for (let i = 0; i < N; i++) {
            data[i] = (data[i] / maxVal) * 0.98;
          }
        }

        buffersRef.current[def.id] = buffer;
      }
    });
  };

  // Turn on/off or initialize instrument
  const handlePowerToggle = async () => {
    if (!isAudioInitialized) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        // Create Analyser for visual scoping
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        // Create BiquadFilter (for white noise sweep)
        const filter = ctx.createBiquadFilter();
        filter.type = 'allpass';
        filterRef.current = filter;

        // Create Master Gain node
        const gainNode = ctx.createGain();
        gainRef.current = gainNode;

        // Graph: Source -> Filter -> Gain -> Analyser & Destination (Separately to prevent mic loopback feedback)
        filter.connect(gainNode);
        gainNode.connect(analyser);
        gainNode.connect(ctx.destination);

        // Precompile all 10 waveforms
        generateAllBuffers(ctx);

        setIsAudioInitialized(true);
        setAudioSettings((prev) => ({ ...prev, isPlaying: true }));
        
        // Setup initial loop
        setupSourceNode(ctx, selectedWaveId, audioSettings.frequency, audioSettings.amplitude, audioSettings.isMuted);
      } catch (err) {
        console.error('Failed to initialize AudioContext:', err);
        setBrowserBlocked(true);
      }
    } else {
      const ctx = audioContextRef.current;
      if (ctx) {
        if (audioSettings.isPlaying) {
          // Pause/Power down: Mute the volume node & stop the active oscillator
          if (gainRef.current) {
            gainRef.current.gain.setValueAtTime(0, ctx.currentTime);
          }
          if (sourceRef.current) {
            try {
              sourceRef.current.stop();
            } catch (e) {}
            sourceRef.current.disconnect();
            sourceRef.current = null;
          }

          // Clean up microphone if active
          if (micSourceRef.current) {
            try {
              micSourceRef.current.disconnect();
            } catch (e) {}
            micSourceRef.current = null;
          }
          if (micStreamRef.current) {
            try {
              micStreamRef.current.getTracks().forEach((track) => track.stop());
            } catch (e) {}
            micStreamRef.current = null;
          }
          setIsMicActive(false);

          setAudioSettings((prev) => ({ ...prev, isPlaying: false }));
        } else {
          // Power up: Resume audio context, restore volume, and re-start oscillator
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          setAudioSettings((prev) => ({ ...prev, isPlaying: true }));
          setupSourceNode(ctx, selectedWaveId, audioSettings.frequency, audioSettings.amplitude, audioSettings.isMuted);
        }
      }
    }
  };

  const setupSourceNode = (
    ctx: AudioContext,
    waveId: string,
    freq: number,
    amp: number,
    muted: boolean
  ) => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
      sourceRef.current.disconnect();
    }

    const buffer = buffersRef.current[waveId];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Apply playback rate or filter based on wave category
    if (waveId === 'noise') {
      source.playbackRate.setValueAtTime(1.0, ctx.currentTime);
      if (filterRef.current) {
        filterRef.current.type = 'bandpass';
        filterRef.current.Q.setValueAtTime(2.0, ctx.currentTime);
        filterRef.current.frequency.setValueAtTime(freq, ctx.currentTime);
      }
    } else {
      const baseFreq = ctx.sampleRate / 2048;
      const rate = freq / baseFreq;
      source.playbackRate.setValueAtTime(rate, ctx.currentTime);
      if (filterRef.current) {
        filterRef.current.type = 'allpass';
      }
    }

    // Connect source to filter
    if (filterRef.current) {
      source.connect(filterRef.current);
    }

    // Apply volume smoothly
    if (gainRef.current) {
      const targetGain = (muted || isMicActive) ? 0 : amp;
      gainRef.current.gain.setValueAtTime(targetGain, ctx.currentTime);
    }

    source.start(0);
    sourceRef.current = source;
  };

  // Handle switching wave types
  const handleSelectWave = (waveId: string) => {
    setSelectedWaveId(waveId);
    
    const ctx = audioContextRef.current;
    if (ctx && audioSettings.isPlaying) {
      setupSourceNode(ctx, waveId, audioSettings.frequency, audioSettings.amplitude, audioSettings.isMuted);
    }
  };

  // Frequency change handler
  const handleFrequencyChange = (val: number) => {
    setFrequencySliderVal(val);
    const newFreq = sliderToFreq(val);
    setAudioSettings((prev) => ({ ...prev, frequency: newFreq }));

    const ctx = audioContextRef.current;
    if (ctx && audioSettings.isPlaying) {
      if (selectedWaveId === 'noise') {
        // Noise: controls the filter cutoff instead of rate
        if (filterRef.current) {
          filterRef.current.frequency.setTargetAtTime(newFreq, ctx.currentTime, 0.05);
        }
      } else {
        // Periodic waves: controls playback rate
        if (sourceRef.current) {
          const baseFreq = ctx.sampleRate / 2048;
          const rate = newFreq / baseFreq;
          sourceRef.current.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.05);
        }
      }
    }
  };

  // Quick frequency presets
  const handleApplyPreset = (freq: number) => {
    const sliderVal = freqToSlider(freq);
    handleFrequencyChange(sliderVal);
  };

  // Amplitude (Volume) change handler
  const handleAmplitudeChange = (amp: number) => {
    setAudioSettings((prev) => ({ ...prev, amplitude: amp }));
    
    const ctx = audioContextRef.current;
    if (ctx && gainRef.current && audioSettings.isPlaying) {
      const targetGain = (audioSettings.isMuted || isMicActive) ? 0 : amp;
      gainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.02);
    }
  };

  // Mute toggle
  const handleMuteToggle = () => {
    const newMuted = !audioSettings.isMuted;
    setAudioSettings((prev) => ({ ...prev, isMuted: newMuted }));

    const ctx = audioContextRef.current;
    if (ctx && gainRef.current && audioSettings.isPlaying) {
      const targetGain = (newMuted || isMicActive) ? 0 : audioSettings.amplitude;
      gainRef.current.gain.setValueAtTime(targetGain, ctx.currentTime);
    }
  };

  // Microphone capture toggle handler
  const toggleMicrophone = async () => {
    try {
      setMicError(null);
      
      // If audio context is not initialized yet, initialize it!
      let ctx = audioContextRef.current;
      if (!isAudioInitialized || !ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        const filter = ctx.createBiquadFilter();
        filter.type = 'allpass';
        filterRef.current = filter;

        const gainNode = ctx.createGain();
        gainRef.current = gainNode;

        // Connections: Synth sounds are connected but muted
        filter.connect(gainNode);
        gainNode.connect(analyser);
        gainNode.connect(ctx.destination);

        generateAllBuffers(ctx);
        setIsAudioInitialized(true);
        setAudioSettings((prev) => ({ ...prev, isPlaying: true }));
        setupSourceNode(ctx, selectedWaveId, audioSettings.frequency, audioSettings.amplitude, audioSettings.isMuted);
      }

      // Resume context if suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (isMicActive) {
        // Turn off microphone
        if (micSourceRef.current) {
          try {
            micSourceRef.current.disconnect();
          } catch (e) {}
          micSourceRef.current = null;
        }
        if (micStreamRef.current) {
          try {
            micStreamRef.current.getTracks().forEach((track) => track.stop());
          } catch (e) {}
          micStreamRef.current = null;
        }
        setIsMicActive(false);

        // Re-enable synthesizer smoothly
        if (gainRef.current) {
          const targetGain = audioSettings.isMuted ? 0 : audioSettings.amplitude;
          gainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
        }
      } else {
        // Request microphone permission and capture stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;

        const micSource = ctx.createMediaStreamSource(stream);
        micSourceRef.current = micSource;

        // Connect microphone output ONLY to the analyser for visual rendering
        if (analyserRef.current) {
          micSource.connect(analyserRef.current);
        }

        // Mute the synth smoothly to prevent overlapping/bleeding
        if (gainRef.current) {
          gainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        }

        setIsMicActive(true);
      }
    } catch (err: any) {
      console.error('Error in toggleMicrophone:', err);
      setMicError(err.message || 'No se pudo acceder al micrófono. Por favor verifica los permisos.');
    }
  };

  return (
    <div className="min-h-screen bg-[#080d16] font-sans text-slate-100 antialiased selection:bg-white/20 selection:text-white relative overflow-hidden">
      
      {/* Decorative Frosted Glass Background Orbs */}
      <div className="pointer-events-none absolute top-10 left-10 -z-10 h-[350px] w-[350px] rounded-full bg-emerald-500/10 blur-[120px] animate-pulse" />
      <div className="pointer-events-none absolute bottom-1/4 right-10 -z-10 h-[400px] w-[400px] rounded-full bg-sky-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 -z-10 h-[300px] w-[300px] rounded-full bg-indigo-500/10 blur-[100px]" />

      {/* Main Container */}
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 relative z-10">
        
        {/* Lab Header */}
        <header className="mb-6 flex flex-col justify-between border-b border-white/10 pb-5 md:flex-row md:items-center">
          <div className="flex items-center space-x-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-sky-400 shadow-xl backdrop-blur-md">
              <Radio className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-sans text-xl font-bold tracking-tight text-white sm:text-2xl">
                Laboratorio Virtual de Ondas
              </h1>
              <p className="font-mono text-xs text-slate-400">
                Generador de Señales y Osciloscopio Didáctico • 10 Canales Electrónicos
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 md:mt-0 items-center">
            {/* Standalone HTML file direct launcher */}
            <a
              href="/osciloscopio.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 font-sans text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all shadow-lg active:scale-95"
              title="Abrir simulación en archivo HTML 100% autónomo sin dependencias"
            >
              <FileCode className="h-4 w-4 text-emerald-400" />
              <span>Abrir HTML Autónomo</span>
            </a>

            {/* Display Active Frequency status or instructions */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 font-mono text-[11px] text-slate-300 flex items-center space-x-2.5 shadow-xl backdrop-blur-md">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Freq: <strong className="text-sky-400 font-bold">{selectedWaveId === 'noise' ? 'FILTRADA' : audioSettings.frequency.toFixed(1) + ' Hz'}</strong></span>
              <span className="text-white/10">|</span>
              <span>Amp: <strong className="text-sky-400 font-bold">{Math.round(audioSettings.amplitude * 100)}%</strong></span>
            </div>
          </div>
        </header>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* LEFT SIDE: OSCILLOSCOPE, PANEL CONTROLS (8 COLS) */}
          <main className="flex flex-col space-y-6 lg:col-span-7 xl:col-span-8">
            
            {/* 1. Oscilloscope Component Screen with Circular Button Dock on the right */}
            <div className="flex flex-col md:flex-row items-stretch gap-4 w-full">
              <div className="flex-1 min-w-0">
                <Oscilloscope
                  analyserNode={analyserRef.current}
                  settings={scopeSettings}
                  isPlaying={audioSettings.isPlaying}
                  activeWaveId={selectedWaveId}
                  frequency={audioSettings.frequency}
                  isMicActive={isMicActive}
                />
              </div>

              {/* Dynamic Control Dock (7 Circular Buttons) */}
              <div className="flex flex-row md:flex-col items-center justify-center gap-3 bg-slate-950/45 border border-white/10 rounded-3xl p-3.5 shadow-2xl backdrop-blur-2xl md:w-20 w-full">
                
                {/* 1. Power Button */}
                <button
                  onClick={handlePowerToggle}
                  className={`relative flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 cursor-pointer group ${
                    audioSettings.isPlaying && isAudioInitialized
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                  title={audioSettings.isPlaying && isAudioInitialized ? "Apagar Laboratorio de Ondas" : "Encender Laboratorio de Ondas"}
                >
                  <Power className="h-5 w-5" />
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden md:group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 font-sans text-[10px] text-white shadow-xl border border-white/10">
                    {audioSettings.isPlaying && isAudioInitialized ? "Apagar Laboratorio" : "Encender Laboratorio"}
                  </span>
                </button>

                {/* 2. Mode Toggle Button */}
                <button
                  onClick={() =>
                    setScopeSettings((prev) => ({
                      ...prev,
                      mode: prev.mode === 'time' ? 'frequency' : (prev.mode === 'frequency' ? 'vu' : 'time')
                    }))
                  }
                  className={`relative flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 cursor-pointer group ${
                    scopeSettings.mode === 'time'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                      : scopeSettings.mode === 'frequency'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  }`}
                  title={`Modo: ${scopeSettings.mode === 'time' ? 'Tiempo 📈' : scopeSettings.mode === 'frequency' ? 'FFT Frecuencia 📊' : 'Columnas VU 📶'}`}
                >
                  <Activity className="h-5 w-5" />
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden md:group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 font-sans text-[10px] text-white shadow-xl border border-white/10">
                    Modo: {scopeSettings.mode === 'time' ? 'Tiempo' : scopeSettings.mode === 'frequency' ? 'Frecuencia' : 'Columnas VU'}
                  </span>
                </button>

                {/* 3. Grid Button */}
                <button
                  onClick={() => setScopeSettings((prev) => ({ ...prev, showGrid: !prev.showGrid }))}
                  className={`relative flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 cursor-pointer group ${
                    scopeSettings.showGrid
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.15)]'
                      : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/15 hover:text-slate-400'
                  }`}
                  title={scopeSettings.showGrid ? "Desactivar Grilla" : "Activar Grilla"}
                >
                  <Grid className="h-5 w-5" />
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden md:group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 font-sans text-[10px] text-white shadow-xl border border-white/10">
                    {scopeSettings.showGrid ? "Ocultar Grilla" : "Mostrar Grilla"}
                  </span>
                </button>

                {/* 4. Trigger Button */}
                <button
                  onClick={() => {
                    if (selectedWaveId !== 'noise') {
                      setScopeSettings((prev) => ({ ...prev, triggerEnabled: !prev.triggerEnabled }));
                    }
                  }}
                  disabled={selectedWaveId === 'noise'}
                  className={`relative flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 cursor-pointer group ${
                    selectedWaveId === 'noise'
                      ? 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed opacity-40'
                      : scopeSettings.triggerEnabled
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                      : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/15 hover:text-slate-400'
                  }`}
                  title={selectedWaveId === 'noise' ? "Trigger no disponible para ruido" : scopeSettings.triggerEnabled ? "Desactivar Trigger" : "Activar Trigger Sincrónico"}
                >
                  <Zap className="h-5 w-5" />
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden md:group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 font-sans text-[10px] text-white shadow-xl border border-white/10">
                    {selectedWaveId === 'noise' ? "Trigger Inactivo" : scopeSettings.triggerEnabled ? "Sincronización: ON" : "Sincronización: OFF"}
                  </span>
                </button>

                {/* 5. Freeze Button */}
                <button
                  onClick={() => setScopeSettings((prev) => ({ ...prev, freeze: !prev.freeze }))}
                  className={`relative flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 cursor-pointer group ${
                    scopeSettings.freeze
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  }`}
                  title={scopeSettings.freeze ? "Reanudar Captura (Correr)" : "Congelar Pantalla (Pausa)"}
                >
                  {scopeSettings.freeze ? <Play className="h-5 w-5 ml-0.5" /> : <Pause className="h-5 w-5" />}
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden md:group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 font-sans text-[10px] text-white shadow-xl border border-white/10">
                    {scopeSettings.freeze ? "Reanudar Pantalla" : "Congelar Pantalla"}
                  </span>
                </button>

                {/* 6. Microphone Button */}
                <button
                  onClick={toggleMicrophone}
                  className={`relative flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 cursor-pointer group ${
                    isMicActive
                      ? 'bg-purple-500/10 border-purple-500/40 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                      : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/15 hover:text-slate-400'
                  }`}
                  title={isMicActive ? "Desactivar Captura de Micrófono" : "Habilitar Micrófono Físico"}
                >
                  {isMicActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden md:group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 font-sans text-[10px] text-white shadow-xl border border-white/10">
                    {isMicActive ? "Apagar Micrófono" : "Encender Micrófono"}
                  </span>
                </button>

                {/* 7. Sound Mute Button */}
                <button
                  onClick={handleMuteToggle}
                  className={`relative flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 cursor-pointer group ${
                    audioSettings.isMuted || isMicActive
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                      : 'bg-sky-500/10 border-sky-500/30 text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.15)]'
                  }`}
                  disabled={isMicActive}
                  title={isMicActive ? "Sonido del altavoz desactivado durante el uso de micrófono" : audioSettings.isMuted ? "Activar Sonido del Parlante" : "Silenciar Parlante"}
                >
                  {audioSettings.isMuted || isMicActive ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden md:group-hover:block z-50 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 font-sans text-[10px] text-white shadow-xl border border-white/10">
                    {isMicActive ? "Muteado (Mic Activo)" : audioSettings.isMuted ? "Activar Sonido" : "Silenciar Sonido"}
                  </span>
                </button>

              </div>
            </div>

            {/* 2. Main Hardware Panel (Tactile sliders, presets, and scope calibration knobs) */}
            <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center space-x-2 border-b border-white/10 pb-3">
                <Sliders className="h-4.5 w-4.5 text-sky-400" />
                <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-slate-300">
                  Panel de Control del Instrumento
                </h2>
              </div>

              {/* Power State Warning Banner if not started */}
              {!isAudioInitialized && (
                <div className="mt-4 flex flex-col items-center justify-between rounded-2xl border border-white/10 bg-white/10 p-4 text-center md:flex-row md:text-left backdrop-blur-md">
                  <div className="mb-3 md:mb-0">
                    <h4 className="font-sans text-sm font-semibold text-white flex items-center justify-center md:justify-start gap-1.5">
                      <Zap className="h-4 w-4 text-sky-400" /> Laboratorio Apagado
                    </h4>
                    <p className="mt-0.5 font-sans text-xs text-slate-300">
                      Haz clic en Encender para activar el motor de audio y el osciloscopio en tiempo real.
                    </p>
                  </div>
                  <button
                    onClick={handlePowerToggle}
                    className="w-full rounded-xl bg-white text-[#080d16] hover:bg-slate-200 px-5 py-2.5 font-sans text-xs font-bold tracking-wide shadow-xl transition-all active:scale-95 md:w-auto cursor-pointer"
                  >
                    Encender Laboratorio
                  </button>
                </div>
              )}

              {/* Hardware Controls Grid */}
              <div className={`mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 transition-opacity duration-300 ${isAudioInitialized ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                
                {/* COLUMN 1: SIGNAL GENERATOR (Frecuencia, Amplitud) */}
                <div className="flex flex-col space-y-5">
                  <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Generador de Funciones
                  </h3>

                  {/* Frequency Slider */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between">
                      <label htmlFor="frequency-slider" className="font-sans text-xs font-medium text-slate-300">
                        {selectedWaveId === 'noise' ? 'Frecuencia de Corte Filtro' : 'Frecuencia Fundamental'}
                      </label>
                      <span className="font-mono text-xs font-bold text-sky-400">
                        {selectedWaveId === 'noise' ? 'Filtro Banda:' : ''} {audioSettings.frequency.toFixed(0)} Hz
                      </span>
                    </div>
                    <input
                      id="frequency-slider"
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={frequencySliderVal}
                      onChange={(e) => handleFrequencyChange(parseFloat(e.target.value))}
                      className="h-2 w-full cursor-ew-resize rounded-lg bg-black/45 accent-white"
                    />
                    <div className="flex justify-between font-mono text-[9px] text-slate-500">
                      <span>20 Hz (Subgrave)</span>
                      <span>2000 Hz (Agudo)</span>
                    </div>

                    {/* Quick Frequency Calibration Presets */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        onClick={() => handleApplyPreset(60)}
                        className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 font-mono text-[9px] text-slate-400 hover:border-white/25 hover:text-white cursor-pointer transition-all"
                        title="Frecuencia típica de la red eléctrica AC en América"
                      >
                        60 Hz (Red AC)
                      </button>
                      <button
                        onClick={() => handleApplyPreset(120)}
                        className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 font-mono text-[9px] text-slate-400 hover:border-white/25 hover:text-white cursor-pointer transition-all"
                        title="Frecuencia de rizado común de rectificación de onda completa"
                      >
                        120 Hz (Rizado)
                      </button>
                      <button
                        onClick={() => handleApplyPreset(440)}
                        className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 font-mono text-[9px] text-slate-400 hover:border-white/25 hover:text-white cursor-pointer transition-all"
                        title="Tono estándar de afinación La440"
                      >
                        440 Hz (Nota La)
                      </button>
                      <button
                        onClick={() => handleApplyPreset(1000)}
                        className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 font-mono text-[9px] text-slate-400 hover:border-white/25 hover:text-white cursor-pointer transition-all"
                        title="Frecuencia de prueba estándar de 1kHz en electrónica de audio"
                      >
                        1.0 kHz (Prueba)
                      </button>
                    </div>
                  </div>

                  {/* Amplitude Slider */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between">
                      <label htmlFor="amplitude-slider" className="font-sans text-xs font-medium text-slate-300">
                        Amplitud de Salida (Volumen)
                      </label>
                      <span className="font-mono text-xs font-bold text-sky-400">
                        {Math.round(audioSettings.amplitude * 100)} %
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        id="amplitude-slider"
                        type="range"
                        min="0"
                        max="1.0"
                        step="0.01"
                        value={audioSettings.amplitude}
                        onChange={(e) => handleAmplitudeChange(parseFloat(e.target.value))}
                        className="h-2 flex-1 cursor-ew-resize rounded-lg bg-black/45 accent-white"
                      />
                      
                      {/* Interactive level bar */}
                      <div className="h-3 w-8 overflow-hidden rounded bg-black/50 p-0.5 flex space-x-[1px]">
                        {[1, 2, 3, 4, 5].map((i) => {
                          const threshold = i / 5;
                          const active = audioSettings.amplitude >= threshold && !audioSettings.isMuted;
                          return (
                            <span
                              key={i}
                              className={`h-full flex-1 rounded-[1px] transition-all ${
                                active
                                  ? i > 4
                                    ? 'bg-rose-500 shadow-[0_0_4px_#ef4444]'
                                    : i > 3
                                    ? 'bg-amber-400 shadow-[0_0_4px_#f59e0b]'
                                    : 'bg-emerald-400 shadow-[0_0_4px_#34d399]'
                                  : 'bg-slate-800'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: OSCILLOSCOPE CONTROL KNOBS (Zoom, Grid, Freeze, etc) */}
                <div className="flex flex-col space-y-4">
                  <h3 className="font-sans text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Calibración de Visualización (Osciloscopio)
                  </h3>

                  {/* Horizontal Zoom (Timebase) */}
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex justify-between">
                      <label htmlFor="timebase-slider" className="font-sans text-xs text-slate-400">
                        Base de Tiempo (Zoom Horizontal)
                      </label>
                      <span className="font-mono text-[11px] font-semibold text-slate-300">
                        x{scopeSettings.timebase.toFixed(1)}
                      </span>
                    </div>
                    <input
                      id="timebase-slider"
                      type="range"
                      min="0.3"
                      max="6.0"
                      step="0.1"
                      value={scopeSettings.timebase}
                      onChange={(e) =>
                        setScopeSettings((prev) => ({ ...prev, timebase: parseFloat(e.target.value) }))
                      }
                      className="h-1.5 w-full cursor-ew-resize rounded bg-black/45 accent-white"
                    />
                  </div>

                  {/* Vertical Zoom (Gain) */}
                  <div className="flex flex-col space-y-1.5">
                    <div className="flex justify-between">
                      <label htmlFor="gain-slider" className="font-sans text-xs text-slate-400">
                        Ganancia Vertical (Zoom Vertical)
                      </label>
                      <span className="font-mono text-[11px] font-semibold text-slate-300">
                        x{scopeSettings.gain.toFixed(1)}
                      </span>
                    </div>
                    <input
                      id="gain-slider"
                      type="range"
                      min="0.4"
                      max="3.0"
                      step="0.1"
                      value={scopeSettings.gain}
                      onChange={(e) =>
                        setScopeSettings((prev) => ({ ...prev, gain: parseFloat(e.target.value) }))
                      }
                      className="h-1.5 w-full cursor-ew-resize rounded bg-black/45 accent-white"
                    />
                  </div>

                  {/* Trace Selection Mode (Ideal, Fourier, Comparison, Live Audio) */}
                  <div className="mt-4 border-t border-white/10 pt-3.5 space-y-2">
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Visualización en Pantalla (Física vs. Teoría)
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'comparison', label: 'Comparativa (Ambas)', desc: 'Comparar Ideal y Fourier' },
                        { id: 'ideal', label: 'Onda Real (Azul)', desc: 'Teórica limpia angular' },
                        { id: 'fourier', label: 'Fourier 5 Términos', desc: 'Curva naranja (Efecto Gibbs)' },
                        { id: 'audio', label: 'Señal Audio (HW)', desc: 'Hardware real de sonido' }
                      ].map((item) => {
                        const isSelected = (scopeSettings.traceMode || 'comparison') === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setScopeSettings((prev) => ({ ...prev, traceMode: item.id as any }))}
                            className={`flex flex-col items-center justify-center rounded-xl border py-1.5 px-2 text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-sky-500/40 bg-sky-950/20 text-sky-400 shadow-md shadow-sky-950/20'
                                : 'border-white/5 bg-black/10 text-slate-400 hover:border-white/15 hover:text-slate-300'
                            }`}
                            title={item.desc}
                          >
                            <span className="font-sans text-[10px] font-bold">{item.label}</span>
                            <span className="font-sans text-[8px] text-slate-500 line-clamp-1">{item.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

              {/* Master Control Panel Footer (Status Bar) */}
              {isAudioInitialized && (
                <div className="mt-5 flex flex-col justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${audioSettings.isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} style={{
                      boxShadow: audioSettings.isPlaying ? '0 0 8px #10b981' : '0 0 8px #ef4444'
                    }} />
                    <span className="font-mono text-[10px] text-slate-400">
                      ESTADO: <strong className={audioSettings.isPlaying ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{audioSettings.isPlaying ? 'ACTIVO (ON)' : 'STANDBY (OFF)'}</strong>
                    </span>
                  </div>
 
                  {/* Context-aware notification */}
                  <span className="font-sans text-[10px] leading-relaxed text-slate-400 sm:text-right max-w-md">
                    {audioSettings.isMuted
                      ? '🔇 Parlante SILENCIADO. Excelente para analizar señales visualmente en silencio.'
                      : audioSettings.isPlaying
                      ? '🔊 Parlante ACTIVO. Disminuye la amplitud si el volumen es demasiado alto.'
                      : '⚡ Generador en reposo. Usa los botones circulares de control rápido en la pantalla del osciloscopio.'}
                  </span>
 
                </div>
              )}
 
            </section>
 
          </main>

          {/* RIGHT SIDE: SELECTION GRID (4 COLS) */}
          <aside className="flex flex-col space-y-6 lg:col-span-5 xl:col-span-4">
            
            {/* 1. WaveSelector card grid */}
            <WaveSelector
              waves={waves}
              selectedWaveId={selectedWaveId}
              onSelectWave={handleSelectWave}
            />

          </aside>

        </div>

      </div>
    </div>
  );
}
