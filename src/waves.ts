import { WaveType } from './types';

// Raw math formulas for one cycle (t in [0, 1))
// We will automatically DC-balance and normalize these waveforms in the generator.
export const waveDefinitions: Omit<WaveType, 'mathFormula'>[] = [
  {
    id: 'sine',
    name: 'Onda Sinusoidal',
    englishName: 'Sine Wave',
    formula: 'V(t) = V_0 \\cdot \\sin(2\\pi f t)',
    description: 'La forma de onda más fundamental. Representa una oscilación armónica simple sin sobretonos ni distorsión.',
    electronicsContext: 'Se utiliza como señal de prueba de referencia de RF y audio. Es la portadora básica en transmisiones de radio AM/FM y la base del análisis de Fourier.',
    harmonics: 'Ninguno. Es un tono puro con una sola frecuencia fundamental.',
    category: 'Analógica'
  },
  {
    id: 'square',
    name: 'Onda Cuadrada',
    englishName: 'Square Wave',
    formula: 'V(t) = V_0 \\cdot \\text{sgn}(\\sin(2\\pi f t))',
    description: 'Una onda simétrica que alterna instantáneamente entre dos niveles fijos de voltaje.',
    electronicsContext: 'Base de las señales de reloj digital (clock) en microprocesadores, transmisión de datos binarios y conmutación de fuentes de poder (SMPS).',
    harmonics: 'Solo armónicos impares (f, 3f, 5f, 7f...) con amplitudes decrecientes (1/n). Sonido muy brillante y hueco.',
    category: 'Digital'
  },
  {
    id: 'triangle',
    name: 'Onda Triangular',
    englishName: 'Triangle Wave',
    formula: 'V(t) = \\frac{2}{\\pi} \\cdot \\arcsin(\\sin(2\\pi f t))',
    description: 'Sube y baja de manera lineal y simétrica, formando pendientes constantes de carga y descarga.',
    electronicsContext: 'Utilizada en generadores de barrido de frecuencia, circuitos de rampa para modulación por ancho de pulso (PWM) y osciladores de sintetizadores analógicos.',
    harmonics: 'Solo armónicos impares (1/n²), lo que hace que sus armónicos superiores se apaguen muy rápido. Sonido suave y flautado.',
    category: 'Analógica'
  },
  {
    id: 'sawtooth',
    name: 'Diente de Sierra',
    englishName: 'Sawtooth Wave',
    formula: 'V(t) = 2 \\cdot (f t - \\lfloor f t \\rfloor) - 1',
    description: 'Sube linealmente como una rampa y cae instantáneamente a cero al final de cada ciclo.',
    electronicsContext: 'Históricamente vital para el barrido horizontal en tubos de rayos catódicos (CRTs) de televisores y monitores antiguos para mover el haz de electrones.',
    harmonics: 'Contiene todos los armónicos (tanto pares como impares: f, 2f, 3f, 4f...) decreciendo como 1/n. Sonido muy rico, raspado y metálico.',
    category: 'Analógica'
  },
  {
    id: 'pulse',
    name: 'Pulso Angosto (20%)',
    englishName: 'Pulse Wave',
    formula: 'V(t) = t < 0.2 ? V_0 : -V_0',
    description: 'Una onda rectangular asimétrica donde el voltaje está en estado alto solo el 20% del período total.',
    electronicsContext: 'Representa señales de control industrial, sistemas PWM para motores DC, o transmisiones digitales con ciclo de trabajo bajo para ahorrar energía.',
    harmonics: 'Contiene todos los armónicos con un patrón de cancelación que depende del ciclo de trabajo (el 5º armónico y sus múltiplos desaparecen). Sonido nasal y agudo.',
    category: 'Digital'
  },
  {
    id: 'rectified',
    name: 'Seno Rectificado',
    englishName: 'Full-Wave Rectified',
    formula: 'V(t) = |\\sin(\\pi f t)|',
    description: 'El resultado de tomar el valor absoluto de una onda senoidal. Se compone enteramente de lóbulos positivos.',
    electronicsContext: 'La señal que se obtiene inmediatamente después de un puente de diodos (rectificador de onda completa) al convertir corriente alterna (AC) a corriente directa (DC).',
    harmonics: 'Contiene armónicos pares fuertes. Al rectificar, la frecuencia fundamental efectiva se duplica (se escucha una octava más alta).',
    category: 'Analógica'
  },
  {
    id: 'rc_charge',
    name: 'Carga de Condensador',
    englishName: 'RC Charge Curve',
    formula: 'V(t) = V_{max} \\cdot (1 - e^{-t/RC})',
    description: 'Una rampa curva que modela la carga exponencial de un capacitor a través de una resistencia, seguida de una descarga instantánea.',
    electronicsContext: 'El bloque básico de los osciladores de relajación analógicos, temporizadores como el circuito integrado 555 y filtros pasa-bajos analógicos.',
    harmonics: 'Contiene tanto armónicos pares como impares con decaimiento curvo. Sonido intermedio entre sierra y triángulo, cálido.',
    category: 'Transitoria'
  },
  {
    id: 'staircase',
    name: 'Onda en Escalera',
    englishName: 'Staircase Wave (DAC)',
    formula: 'V(t) = \\lfloor N \\cdot t \\rfloor / (N-1)',
    description: 'Una señal escalonada en 4 niveles que imita una rampa analógica digitalizada.',
    electronicsContext: 'Demuestra el funcionamiento de un Convertidor Digital-Analógico (DAC) de baja resolución (2 bits) y los efectos de la cuantización digital.',
    harmonics: 'Contiene la fundamental combinada con ruido de cuantización y frecuencias de muestreo no filtradas. Sonido retro, de baja fidelidad (Lo-Fi).',
    category: 'Digital'
  },
  {
    id: 'damped',
    name: 'Senoidal Amortiguada',
    englishName: 'Damped Sine (Ringing)',
    formula: 'V(t) = e^{-\\alpha t} \\cdot \\sin(2\\pi f_r t)',
    description: 'Una oscilación senoidal que decae rápidamente en amplitud con el tiempo, repitiéndose en cada ciclo de disparo.',
    electronicsContext: 'Fenómeno de oscilación parásita o resonancia ("ringing") que ocurre en circuitos RLC inductivos o líneas de transmisión cuando hay un cambio abrupto de voltaje.',
    harmonics: 'Presenta un espectro complejo con bandas laterales debido a la modulación de amplitud exponencial. Sonido metálico, campanil o percusivo.',
    category: 'Transitoria'
  },
  {
    id: 'noise',
    name: 'Ruido Blanco',
    englishName: 'White Noise',
    formula: 'V(t) = \\text{Random}(-V_0, V_0)',
    description: 'Una señal electrónica completamente aleatoria que contiene todas las frecuencias con la misma potencia de energía.',
    electronicsContext: 'Producido naturalmente por el movimiento térmico de los electrones (ruido Johnson-Nyquist) en resistencias. Se usa para pruebas de acústica y calibración de filtros RF.',
    harmonics: 'Espectro continuo y plano. No tiene armónicos discretos; contiene absolutamente todas las frecuencias audibles en una mezcla caótica.',
    category: 'Ruido'
  }
];

// Mathematical implementations for [0, 1) interval
export const waveMathFormulas: Record<string, (t: number) => number> = {
  sine: (t) => Math.sin(2 * Math.PI * t),
  
  square: (t) => (t < 0.5 ? 1.0 : -1.0),
  
  triangle: (t) => {
    if (t < 0.25) return 4 * t;
    if (t < 0.75) return 2 - 4 * t;
    return -4 + 4 * t;
  },
  
  sawtooth: (t) => 2 * t - 1,
  
  pulse: (t) => (t < 0.2 ? 1.0 : -1.0),
  
  rectified: (t) => Math.abs(Math.sin(Math.PI * t)), // standard period rectified
  
  rc_charge: (t) => 1.0 - Math.exp(-5 * t),
  
  staircase: (t) => {
    // 4 levels: -1, -0.33, 0.33, 1
    if (t < 0.25) return -1.0;
    if (t < 0.5) return -0.33;
    if (t < 0.75) return 0.33;
    return 1.0;
  },
  
  damped: (t) => {
    // 4 sub-cycles inside one period, decaying exponentially
    return Math.exp(-3 * t) * Math.sin(8 * Math.PI * t);
  },
  
  noise: () => Math.random() * 2 - 1
};

export const getFullWaveDefinitions = (): WaveType[] => {
  return waveDefinitions.map((def) => ({
    ...def,
    mathFormula: waveMathFormulas[def.id] || waveMathFormulas.sine
  }));
};
