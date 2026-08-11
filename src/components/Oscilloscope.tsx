import { useEffect, useRef } from 'react';
import { OscilloscopeSettings } from '../types';
import { Sparkles, Zap, Activity } from 'lucide-react';
import { waveMathFormulas } from '../waves';

interface OscilloscopeProps {
  analyserNode: AnalyserNode | null;
  settings: OscilloscopeSettings;
  isPlaying: boolean;
  activeWaveId: string;
  frequency: number;
  isMicActive?: boolean;
}

export default function Oscilloscope({
  analyserNode,
  settings,
  isPlaying,
  activeWaveId,
  frequency,
  isMicActive = false
}: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const newWidth = Math.floor(rect.width * window.devicePixelRatio);
      const newHeight = Math.floor(rect.height * window.devicePixelRatio);
      
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const draw = () => {
      if (settings.freeze) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // 1. Clear background with subtle phosphor glow style
      ctx.fillStyle = 'rgb(10, 18, 14)';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw CRT screen grid pattern
      if (settings.showGrid && settings.mode !== 'vu') {
        ctx.strokeStyle = 'rgba(0, 245, 120, 0.08)';
        ctx.lineWidth = 1;

        const gridCols = 10;
        const gridRows = 8;
        
        // Vertical lines
        for (let i = 1; i < gridCols; i++) {
          const x = (width / gridCols) * i;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }

        // Horizontal lines
        for (let i = 1; i < gridRows; i++) {
          const y = (height / gridRows) * i;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Center crosshair with fine subdivision ticks
        ctx.strokeStyle = 'rgba(0, 245, 120, 0.2)';
        ctx.lineWidth = 1.5;
        
        // Center X
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Center Y
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.stroke();

        // Crosshair tick marks
        ctx.strokeStyle = 'rgba(0, 245, 120, 0.3)';
        const tickSize = 4;
        
        // Draw ticks along central horizontal line
        for (let x = 0; x < width; x += width / (gridCols * 5)) {
          ctx.beginPath();
          ctx.moveTo(x, height / 2 - tickSize);
          ctx.lineTo(x, height / 2 + tickSize);
          ctx.stroke();
        }

        // Draw ticks along central vertical line
        for (let y = 0; y < height; y += height / (gridRows * 5)) {
          ctx.beginPath();
          ctx.moveTo(width / 2 - tickSize, y);
          ctx.lineTo(width / 2 + tickSize, y);
          ctx.stroke();
        }
      }

      // If no analyser or not playing, draw a flat baseline or empty columns
      if (!analyserNode || !isPlaying) {
        if (settings.mode === 'vu') {
          // Draw empty VU meter columns
          const numBars = 24;
          const numSegments = 16;
          const padX = 25;
          const padYTop = 45;
          const padYBottom = 35;
          const barGap = 4;
          
          const usableWidth = width - (padX * 2);
          const usableHeight = height - padYTop - padYBottom;
          const barWidth = (usableWidth - (numBars - 1) * barGap) / numBars;
          const segmentHeight = (usableHeight - (numSegments - 1) * 2) / numSegments;

          for (let i = 0; i < numBars; i++) {
            const x = padX + i * (barWidth + barGap);
            for (let s = 0; s < numSegments; s++) {
              const segmentMinAmp = s / numSegments;
              const y = height - padYBottom - (s + 1) * (segmentHeight + 2);

              let inactiveColor = 'rgba(16, 185, 129, 0.05)';
              if (segmentMinAmp >= 0.85) {
                inactiveColor = 'rgba(239, 68, 68, 0.05)';
              } else if (segmentMinAmp >= 0.6) {
                inactiveColor = 'rgba(245, 158, 11, 0.05)';
              }

              ctx.fillStyle = inactiveColor;
              ctx.fillRect(x, y, barWidth, segmentHeight);
            }
          }

          // Draw frequency labels below the bars
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.font = '8px ui-monospace, monospace';
          ctx.textAlign = 'center';
          
          const keyFrequencies = [
            { index: 0, label: '30Hz' },
            { index: Math.floor(numBars * 0.25), label: '250Hz' },
            { index: Math.floor(numBars * 0.5), label: '1kHz' },
            { index: Math.floor(numBars * 0.75), label: '3kHz' },
            { index: numBars - 1, label: '6kHz' }
          ];

          keyFrequencies.forEach((item) => {
            const x = padX + item.index * (barWidth + barGap) + barWidth / 2;
            ctx.fillText(item.label, x, height - 20);
          });
          ctx.textAlign = 'left';

          drawVuTelemetry(ctx, width, height, 0);
        } else if (settings.mode === 'frequency') {
          // Draw flat frequency baseline
          ctx.strokeStyle = 'rgb(6, 182, 212)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, height - 10);
          ctx.lineTo(width, height - 10);
          ctx.stroke();
          
          drawSpectrumTelemetry(ctx, width, height, 0);
        } else {
          // Draw flat time baseline
          ctx.strokeStyle = 'rgb(16, 185, 129)';
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
          
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.stroke();
          
          ctx.shadowBlur = 0; // reset
          drawInstrumentStatus(ctx, width, height, 0, 0);
        }

        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      // Read audio data based on display mode
      let calculatedMicFreq = 0;
      if (isMicActive && analyserNode) {
        const fftBufferLength = analyserNode.frequencyBinCount;
        const fftDataArray = new Uint8Array(fftBufferLength);
        analyserNode.getByteFrequencyData(fftDataArray);
        const binsToAnalyze = Math.min(fftBufferLength, 250);
        let maxVal = 0;
        let maxIdx = 0;
        for (let i = 2; i < binsToAnalyze; i++) {
          if (fftDataArray[i] > maxVal) {
            maxVal = fftDataArray[i];
            maxIdx = i;
          }
        }
        if (maxVal > 25) {
          const sampleRate = analyserNode.context.sampleRate;
          const binHz = sampleRate / (fftBufferLength * 2);
          calculatedMicFreq = maxIdx * binHz;
        }
      }

      if (settings.mode === 'time') {
        let vpp = 0;
        const traceMode = isMicActive ? 'audio' : (settings.traceMode || 'comparison');

        if (traceMode === 'audio' && analyserNode) {
          const bufferLength = analyserNode.fftSize;
          const dataArray = new Float32Array(bufferLength);
          analyserNode.getFloatTimeDomainData(dataArray);

          // Calculate Peak-to-Peak voltage
          let minVal = 1.0;
          let maxVal = -1.0;
          for (let i = 0; i < bufferLength; i++) {
            if (dataArray[i] < minVal) minVal = dataArray[i];
            if (dataArray[i] > maxVal) maxVal = dataArray[i];
          }
          vpp = maxVal - minVal;

          // Zero-crossing triggering for stabilization
          let triggerIndex = 0;
          if (settings.triggerEnabled && (isMicActive || activeWaveId !== 'noise')) {
            const triggerLevel = 0.0;
            // Look for positive-going slope crossing zero in first half of buffer
            for (let i = 0; i < bufferLength / 2; i++) {
              if (dataArray[i] <= triggerLevel && dataArray[i + 1] > triggerLevel) {
                triggerIndex = i;
                break;
              }
            }
          }

          // Adjust how many samples to display based on timebase zoom.
          const baseWindow = 800;
          const numSamplesToDraw = Math.min(
            bufferLength - triggerIndex,
            Math.max(40, Math.floor(baseWindow / settings.timebase))
          );

          // Drawing the trace with vector glow (Phosphor green)
          ctx.strokeStyle = 'rgb(16, 185, 129)';
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';

          ctx.beginPath();
          for (let x = 0; x < width; x++) {
            const sampleFraction = x / width;
            const bufferIdx = triggerIndex + Math.floor(sampleFraction * numSamplesToDraw);
            
            if (bufferIdx >= bufferLength) break;

            const signalValue = dataArray[bufferIdx];
            const y = (height / 2) - signalValue * (height / 2) * 0.8 * settings.gain;

            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

        } else {
          // MATHEMATICAL IDEAL / FOURIER MODE (Súper estable, limpia y fiel a libros técnicos / imagen)
          // Para que el cambio de frecuencia comprima/expanda la onda como en un osciloscopio real,
          // usamos una ventana de tiempo de referencia fija, escalada por la base de tiempo (timebase).
          const referenceFrequency = 440;
          const referencePeriod = 1 / referenceFrequency;
          const totalDuration = (3.5 * referencePeriod) / settings.timebase;
          
          // Fase desfasada en el tiempo para simular movimiento real si el trigger está desactivado
          const timeOffset = settings.triggerEnabled ? 0 : (performance.now() / 1000) * 0.1;

          const mathFormula = waveMathFormulas[activeWaveId] || waveMathFormulas.sine;

          // Fourier de 5 términos para la Onda Cuadrada (recrea la línea naranja de la imagen con efecto Gibbs)
          const getFourierSquare5 = (phase: number): number => {
            const angle = 2 * Math.PI * phase;
            const term1 = Math.sin(angle);
            const term2 = Math.sin(3 * angle) / 3;
            const term3 = Math.sin(5 * angle) / 5;
            const term4 = Math.sin(7 * angle) / 7;
            const term5 = Math.sin(9 * angle) / 9;
            return (4 / Math.PI) * (term1 + term2 + term3 + term4 + term5);
          };

          // Fourier de 5 términos para otras ondas para mantener la coherencia
          const getFourier5 = (waveId: string, phase: number): number => {
            if (waveId === 'sine') return Math.sin(2 * Math.PI * phase);
            if (waveId === 'square') return getFourierSquare5(phase);
            if (waveId === 'pulse') {
              const angle = 2 * Math.PI * phase;
              const d = 0.2; // 20% duty cycle
              let sum = 0;
              for (let n = 1; n <= 5; n++) {
                sum += (Math.sin(n * Math.PI * d) / n) * Math.cos(n * angle - n * Math.PI * d);
              }
              return (2 * d - 1) + (4 / Math.PI) * sum;
            }
            if (waveId === 'triangle') {
              const angle = 2 * Math.PI * phase;
              const term1 = Math.sin(angle);
              const term2 = -Math.sin(3 * angle) / 9;
              const term3 = Math.sin(5 * angle) / 25;
              const term4 = -Math.sin(7 * angle) / 49;
              const term5 = Math.sin(9 * angle) / 81;
              return (8 / (Math.PI * Math.PI)) * (term1 + term2 + term3 + term4 + term5);
            }
            if (waveId === 'sawtooth') {
              const angle = 2 * Math.PI * phase;
              const term1 = Math.sin(angle);
              const term2 = -Math.sin(2 * angle) / 2;
              const term3 = Math.sin(3 * angle) / 3;
              const term4 = -Math.sin(4 * angle) / 4;
              const term5 = Math.sin(5 * angle) / 5;
              return (2 / Math.PI) * (term1 + term2 + term3 + term4 + term5);
            }
            if (waveId === 'noise') {
              // Simulación de ruido filtrado con 5 frecuencias
              const angle = 2 * Math.PI * phase;
              return (Math.sin(angle * 1.3) + Math.sin(angle * 3.1) + Math.sin(angle * 5.7) + Math.sin(angle * 7.4) + Math.sin(angle * 11.2)) / 3.5;
            }
            const f = waveMathFormulas[waveId] || waveMathFormulas.sine;
            return f(phase);
          };

          const evaluateIdeal = (phase: number): number => {
            if (activeWaveId === 'noise') {
              return (Math.sin(15 * Math.PI * phase) * Math.cos(42 * Math.PI * phase)) * 0.7;
            }
            return mathFormula(phase);
          };

          // 1. Dibujar "Onda Real Pura / Ideal" (Línea Azul brillante idéntica a la imagen)
          if (traceMode === 'ideal' || traceMode === 'comparison') {
            ctx.strokeStyle = '#38bdf8'; // sky-400 (azul real de la imagen)
            ctx.lineWidth = 3.0;
            ctx.lineJoin = 'miter';
            ctx.lineCap = 'butt';
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';

            ctx.beginPath();
            let lastY = 0;
            for (let x = 0; x < width; x++) {
              const fraction = x / width;
              const t = fraction * totalDuration + timeOffset;
              const phase = (t * frequency) % 1.0;
              const val = evaluateIdeal(phase);
              const y = (height / 2) - val * (height / 2) * 0.75 * settings.gain;

              if (x === 0) {
                ctx.moveTo(x, y);
              } else {
                // Algoritmo de detección de transición para dibujar paredes 100% verticales (ángulos de 90 grados rectos)
                if (activeWaveId === 'square' || activeWaveId === 'pulse' || activeWaveId === 'staircase') {
                  const prevFraction = (x - 1) / width;
                  const prevT = prevFraction * totalDuration + timeOffset;
                  const prevPhase = (prevT * frequency) % 1.0;
                  const isTransition = (prevPhase < 0.5 && phase >= 0.5) || (prevPhase > phase);
                  
                  if (isTransition) {
                    ctx.lineTo(x, lastY); // mover verticalmente
                  }
                }
                ctx.lineTo(x, y);
              }
              lastY = y;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          // 2. Dibujar "Serie de Fourier (5 términos)" (Línea Naranja/Amarilla idéntica a la imagen)
          if (traceMode === 'fourier' || traceMode === 'comparison') {
            ctx.strokeStyle = '#f59e0b'; // amber-500 (naranja Fourier de la imagen)
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(245, 158, 11, 0.55)';

            ctx.beginPath();
            for (let x = 0; x < width; x++) {
              const fraction = x / width;
              const t = fraction * totalDuration + timeOffset;
              const phase = (t * frequency) % 1.0;
              const val = getFourier5(activeWaveId, phase);
              const y = (height / 2) - val * (height / 2) * 0.75 * settings.gain;

              if (x === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          vpp = activeWaveId === 'square' ? 2.0 : (activeWaveId === 'noise' ? 1.4 : 1.8);
        }

        // Render calibration telemetry values (real-time data)
        drawInstrumentStatus(ctx, width, height, isMicActive ? calculatedMicFreq : frequency, vpp, isMicActive);

      } else if (settings.mode === 'frequency') {
        // FREQUENCY MODE (FFT Spectrum)
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        // We only render frequencies up to ~5kHz because our fundamental waves are within 20Hz-2000Hz.
        // Sample rate is typically 44100Hz or 48000Hz.
        // Each bin represents (sampleRate / 2) / bufferLength Hz.
        // For 44100Hz and 1024 bins, each bin is 21.5 Hz.
        // Up to 5000Hz corresponds to around bin index 230.
        const binsToDraw = Math.min(bufferLength, 250);

        ctx.strokeStyle = 'rgb(6, 182, 212)'; // neon cyan
        ctx.fillStyle = 'rgba(6, 182, 212, 0.15)'; // glowing semi-transparent fill
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';

        ctx.beginPath();
        ctx.moveTo(0, height - 10);

        const barWidth = width / binsToDraw;

        for (let i = 0; i < binsToDraw; i++) {
          const x = i * barWidth;
          // Normalize value between 0.0 and 1.0
          const amplitude = dataArray[i] / 255;
          // Apply gain to make the spectrum zoomable
          const scaledAmp = Math.min(1.0, amplitude * settings.gain);
          // Calculate Y position
          const y = height - 10 - scaledAmp * (height - 30);

          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height - 10);
        ctx.stroke();
        ctx.fill();

        ctx.shadowBlur = 0;

        // Draw frequency vertical markers
        ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.font = '9px ui-monospace, monospace';
        const sampleRate = analyserNode.context.sampleRate;
        const binHz = sampleRate / (analyserNode.frequencyBinCount * 2);

        // Highlight key frequencies (e.g., 500Hz, 1kHz, 2kHz, 4kHz)
        const markersHz = [200, 500, 1000, 2000, 4000];
        markersHz.forEach((mHz) => {
          const binIndex = Math.round(mHz / binHz);
          const x = binIndex * barWidth;
          if (x < width) {
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height - 10);
            ctx.stroke();
            ctx.setLineDash([]); // Reset
            
            ctx.fillText(`${mHz >= 1000 ? (mHz/1000)+'kHz' : mHz+'Hz'}`, x + 4, height - 15);
          }
        });

        // Telemetry for Spectrum
        drawSpectrumTelemetry(ctx, width, height, isMicActive ? calculatedMicFreq : frequency, isMicActive);
      } else if (settings.mode === 'vu') {
        // VU METER MODE (Vertical LED-style columns with dynamic peaks)
        const numBars = 24;
        const numSegments = 16;
        const padX = 25;
        const padYTop = 45;
        const padYBottom = 35;
        const barGap = 4;
        
        const usableWidth = width - (padX * 2);
        const usableHeight = height - padYTop - padYBottom;
        const barWidth = (usableWidth - (numBars - 1) * barGap) / numBars;
        const segmentHeight = (usableHeight - (numSegments - 1) * 2) / numSegments;

        // Initialize peaks array if needed
        if (peaksRef.current.length !== numBars) {
          peaksRef.current = new Array(numBars).fill(0);
        }

        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        // Logarithmic frequency bin distribution
        const lowBin = 1; // ~21Hz
        const highBin = Math.min(bufferLength, 250); // ~5kHz

        for (let i = 0; i < numBars; i++) {
          const p1 = i / numBars;
          const p2 = (i + 1) / numBars;
          const startBin = Math.max(0, Math.floor(lowBin * Math.pow(highBin / lowBin, p1)));
          const endBin = Math.max(startBin + 1, Math.floor(lowBin * Math.pow(highBin / lowBin, p2)));

          let maxVal = 0;
          for (let b = startBin; b < endBin && b < bufferLength; b++) {
            if (dataArray[b] > maxVal) {
              maxVal = dataArray[b];
            }
          }

          // Normalize to 0..1
          let amplitude = maxVal / 255;
          // Root-scaling to make low levels show up naturally, amplified by gain
          amplitude = Math.min(1.0, Math.sqrt(amplitude) * settings.gain);

          // Decay peaks slowly
          peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 0.006);
          if (amplitude > peaksRef.current[i]) {
            peaksRef.current[i] = amplitude;
          }

          const x = padX + i * (barWidth + barGap);

          // Draw the stacked vertical segments
          for (let s = 0; s < numSegments; s++) {
            const segmentMinAmp = s / numSegments;
            const isActive = amplitude >= segmentMinAmp;
            
            // Y coordinate stacked from bottom upwards
            const y = height - padYBottom - (s + 1) * (segmentHeight + 2);

            let color = 'rgb(16, 185, 129)'; // neon green
            let shadowColor = 'rgba(16, 185, 129, 0.6)';
            let inactiveColor = 'rgba(16, 185, 129, 0.06)';

            if (segmentMinAmp >= 0.85) {
              color = 'rgb(239, 68, 68)'; // clipping red
              shadowColor = 'rgba(239, 68, 68, 0.6)';
              inactiveColor = 'rgba(239, 68, 68, 0.06)';
            } else if (segmentMinAmp >= 0.6) {
              color = 'rgb(245, 158, 11)'; // amber yellow
              shadowColor = 'rgba(245, 158, 11, 0.6)';
              inactiveColor = 'rgba(245, 158, 11, 0.06)';
            }

            if (isActive) {
              ctx.fillStyle = color;
              ctx.shadowBlur = 4;
              ctx.shadowColor = shadowColor;
            } else {
              ctx.fillStyle = inactiveColor;
              ctx.shadowBlur = 0;
            }

            ctx.fillRect(x, y, barWidth, segmentHeight);
          }
          ctx.shadowBlur = 0; // reset

          // Draw floating peak indicator segment
          const peakVal = peaksRef.current[i];
          if (peakVal > 0.05) {
            const peakSegmentIdx = Math.min(numSegments - 1, Math.floor(peakVal * numSegments));
            const py = height - padYBottom - (peakSegmentIdx + 1) * (segmentHeight + 2);

            let peakColor = 'rgb(16, 185, 129)';
            if (peakVal >= 0.85) {
              peakColor = 'rgb(239, 68, 68)';
            } else if (peakVal >= 0.6) {
              peakColor = 'rgb(245, 158, 11)';
            }

            ctx.fillStyle = peakColor;
            ctx.shadowBlur = 6;
            ctx.shadowColor = peakColor;
            ctx.fillRect(x, py, barWidth, 1.5);
            ctx.shadowBlur = 0;
          }
        }

        // Draw frequency markers under columns
        ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.font = '8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        
        const keyFrequencies = [
          { index: 0, label: '30Hz' },
          { index: Math.floor(numBars * 0.25), label: '250Hz' },
          { index: Math.floor(numBars * 0.5), label: '1kHz' },
          { index: Math.floor(numBars * 0.75), label: '3kHz' },
          { index: numBars - 1, label: '6kHz' }
        ];

        keyFrequencies.forEach((item) => {
          const x = padX + item.index * (barWidth + barGap) + barWidth / 2;
          ctx.fillText(item.label, x, height - 20);
        });
        ctx.textAlign = 'left';

        // Draw VU Telemetry values
        drawVuTelemetry(ctx, width, height, isMicActive ? calculatedMicFreq : frequency, isMicActive);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserNode, settings, isPlaying, activeWaveId, frequency, isMicActive]);

  // Helper to draw realistic dashboard text on the oscilloscope screen
  const drawInstrumentStatus = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    freq: number,
    vpp: number,
    isMic: boolean = false
  ) => {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

    // Top-Left Info: Timebase & Gain Calibration
    ctx.fillText(`CH1: 500mV/Div  x${settings.gain.toFixed(1)}`, 12, 20);
    const timeScale = (100 / settings.timebase).toFixed(1);
    ctx.fillText(`M: ${timeScale}ms/Div`, 12, 35);

    // Top-Right Info: Real Measurements
    ctx.textAlign = 'right';
    ctx.fillText(`TRIG: ${settings.triggerEnabled && (isMic || activeWaveId !== 'noise') ? 'AUTO (0.0V)' : 'OFF'}`, width - 12, 20);
    if (isPlaying) {
      if (isMic) {
        ctx.fillText(`ENTRADA: MICRÓFONO (ACÚSTICO)`, width - 12, 35);
        ctx.fillText(`Frec. Pico: ${freq > 0 ? freq.toFixed(0) + ' Hz' : 'CAPTANDO...'}`, width - 12, 50);
      } else {
        ctx.fillText(`Frecuencia: ${activeWaveId === 'noise' ? 'FILTRADA' : freq.toFixed(1) + ' Hz'}`, width - 12, 35);
        ctx.fillText(`Vpp: ${(vpp * 5).toFixed(2)} V`, width - 12, 50);
      }
    } else {
      ctx.fillText('ESTADO: PAUSADO', width - 12, 35);
      ctx.fillText('Vpp: 0.00 V', width - 12, 50);
    }

    // Bottom Status Bar
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.fillText(isMic ? 'MIC INPUT • AC COUPLED • 48 kSa/s' : 'DC COUPLED • 48 kSa/s', 12, height - 12);
    
    ctx.textAlign = 'right';
    ctx.fillText(isMic ? 'MIC_HW_IN_V1' : 'LAB_BENCH_OSC_V1', width - 12, height - 12);
    ctx.textAlign = 'left'; // Reset
  };

  const drawSpectrumTelemetry = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    freq: number,
    isMic: boolean = false
  ) => {
    ctx.fillStyle = 'rgba(6, 182, 212, 0.85)';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

    ctx.fillText(`REF: 0 dBm  GAIN x${settings.gain.toFixed(1)}`, 12, 20);
    ctx.fillText(`BW: 20 Hz - 5.3 kHz`, 12, 35);

    ctx.textAlign = 'right';
    ctx.fillText(`FFT: 2048 pts`, width - 12, 20);
    if (isPlaying) {
      if (isMic) {
        ctx.fillText(`ENTRADA: MICRÓFONO`, width - 12, 35);
        ctx.fillText(`PICO: ${freq > 0 ? freq.toFixed(0) + ' Hz' : 'CAPTANDO...'}`, width - 12, 50);
      } else {
        ctx.fillText(`PICO: ${activeWaveId === 'noise' ? 'BANDA FLT' : freq.toFixed(0) + ' Hz'}`, width - 12, 35);
      }
    } else {
      ctx.fillText('FFT INACTIVA', width - 12, 35);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
    ctx.fillText('RESOLUCIÓN DE FRECUENCIA • LIN SCALE', 12, height - 12);
    ctx.textAlign = 'right';
    ctx.fillText('SPECTRO_ANALYSER_V1', width - 12, height - 12);
    ctx.textAlign = 'left'; // Reset
  };

  const drawVuTelemetry = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    freq: number,
    isMic: boolean = false
  ) => {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

    ctx.fillText(`MODO: ANALIZADOR VU (24 BANDS)`, 12, 20);
    ctx.fillText(`GAIN x${settings.gain.toFixed(1)}  RANGO: 30Hz - 6kHz`, 12, 35);

    ctx.textAlign = 'right';
    ctx.fillText(`CAL: AUTO -60dB/0dB`, width - 12, 20);
    if (isPlaying) {
      if (isMic) {
        ctx.fillText(`ENTRADA: MICRÓFONO`, width - 12, 35);
        ctx.fillText(`PICO: ${freq > 0 ? freq.toFixed(0) + ' Hz' : 'CAPTANDO...'}`, width - 12, 50);
      } else {
        ctx.fillText(`PICO: ${activeWaveId === 'noise' ? 'BANDA ANCHA' : freq.toFixed(0) + ' Hz'}`, width - 12, 35);
      }
    } else {
      ctx.fillText('NIVEL: INACTIVO', width - 12, 35);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.fillText('FILTROS DE PASO DE BANDA DINÁMICOS CON MEDIDOR DE PICOS', 12, height - 12);
    ctx.textAlign = 'right';
    ctx.fillText('STEREO_VU_V1', width - 12, height - 12);
    ctx.textAlign = 'left'; // Reset
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-1 shadow-2xl backdrop-blur-2xl">
      {/* Oscilloscope Header with glowing LED lights */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 rounded-t-2xl">
        <div className="flex items-center space-x-2.5">
          <Activity className={`h-4.5 w-4.5 ${settings.mode === 'time' ? 'text-emerald-400 animate-pulse' : settings.mode === 'frequency' ? 'text-cyan-400 animate-pulse' : 'text-amber-400 animate-pulse'}`} />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-300">
            {settings.mode === 'time' 
              ? 'OSCILOSCOPIO DIGITAL' 
              : settings.mode === 'frequency' 
                ? 'ANALIZADOR DE ESPECTRO FFT' 
                : 'ANALIZADOR VU DE COLUMNAS'}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-slate-800" style={{
              backgroundColor: isPlaying ? (settings.mode === 'time' ? '#10b981' : settings.mode === 'frequency' ? '#06b6d4' : '#f59e0b') : '#334155',
              boxShadow: isPlaying ? `0 0 8px ${settings.mode === 'time' ? '#10b981' : settings.mode === 'frequency' ? '#06b6d4' : '#f59e0b'}` : 'none'
            }}></span>
            <span className="font-mono text-[10px] font-medium text-slate-400">SIG_GEN</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" style={{
              boxShadow: '0 0 8px #10b981'
            }}></span>
            <span className="font-mono text-[10px] font-medium text-slate-400">CAL_OK</span>
          </div>
        </div>
      </div>

      {/* Screen Canvas Container */}
      <div className="relative aspect-[16/10] w-full min-h-[220px] bg-slate-950/80 rounded-2xl overflow-hidden mt-1">
        <canvas
          id="oscilloscope-canvas"
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
        />
        
        {/* CRT Glass Reflection overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.04]" />
        
        {/* Subtle grid bezel shadowing */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.85)]" />
      </div>
    </div>
  );
}
