export default function App() {
  // State for inputs
  const [sRated, setSRated] = useState(500); // kVA
  const [vLine, setVLine] = useState(3300); // Volts
  const [ra, setRa] = useState(0.3); // Ohms
  const [xs, setXs] = useState(4.0); // Ohms
  const [pf, setPf] = useState(0.8); // Power Factor
  const [pfType, setPfType] = useState('lagging'); // lagging or leading

  // State for calculations
  const [results, setResults] = useState(null);

  // Canvas Ref
  const canvasRef = useRef(null);

  // Constants
  const SCALE_PADDING = 40;

  // Calculate values whenever inputs change
  useEffect(() => {
    calculateValues();
  }, [sRated, vLine, ra, xs, pf, pfType]);

  // Redraw canvas whenever results change
  useEffect(() => {
    if (results) {
      drawPhasorDiagram();
    }
  }, [results]);

  const calculateValues = () => {
    // Basic calculations
    // Vph = VL / sqrt(3)
    const vPh = vLine / Math.sqrt(3);
    
    // IL = S * 1000 / (sqrt(3) * VL)
    // For star connection Ia = IL
    const ia = (sRated * 1000) / (Math.sqrt(3) * vLine);

    // Angle phi
    const phiRad = Math.acos(pf);
    const phiDeg = phiRad * (180 / Math.PI);
    
    // Sin phi
    const sinPhi = Math.sin(phiRad);

    // Drops
    const dropRa = ia * ra;
    const dropXs = ia * xs;

    // Calculate E_ph (Complex number math)
    // Reference V_ph at angle 0
    // I_a angle depends on lag/lead
    // Lagging: I_a = Ia angle -phi
    // Leading: I_a = Ia angle +phi
    
    let iaAngleRad = pfType === 'lagging' ? -phiRad : phiRad;

    // Phasor V = vPh + j0
    // Phasor I = Ia * cos(angle) + j * Ia * sin(angle)
    const iReal = ia * Math.cos(iaAngleRad);
    const iImag = ia * Math.sin(iaAngleRad);

    // E = V + I(Ra + jXs)
    // E = V + (IRa + jIXs)
    // I * Ra = (iReal + j iImag) * Ra = iReal*Ra + j iImag*Ra
    // I * jXs = (iReal + j iImag) * jXs = j iReal*Xs - iImag*Xs
    
    // Components of E
    const eReal = vPh + (iReal * ra) - (iImag * xs);
    const eImag = 0 + (iImag * ra) + (iReal * xs);

    const ePhMagnitude = Math.sqrt(eReal * eReal + eImag * eImag);
    const eLineMagnitude = ePhMagnitude * Math.sqrt(3);
    const loadAngleRad = Math.atan2(eImag, eReal);
    const loadAngleDeg = loadAngleRad * (180 / Math.PI);

    // Voltage Regulation
    const regulation = ((ePhMagnitude - vPh) / vPh) * 100;

    setResults({
      vPh,
      ia,
      phiDeg,
      dropRa,
      dropXs,
      ePh: ePhMagnitude,
      eLine: eLineMagnitude,
      loadAngleDeg,
      regulation,
      vectors: {
        v: { x: vPh, y: 0 },
        i: { mag: ia, angle: iaAngleRad },
        iRa: { x: iReal * ra, y: iImag * ra }, // Drop across Ra (parallel to I)
        iXs: { x: -iImag * xs, y: iReal * xs }, // Drop across Xs (leads I by 90)
        e: { x: eReal, y: eImag }
      }
    });
  };

  const drawPhasorDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas || !results) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc'; // light bg
    ctx.fillRect(0, 0, width, height);

    // Coordinate system setup
    // Find max magnitude to scale properly
    // Points to plot: Origin, V tip, (V+IRa) tip, (V+IRa+IXs) tip = E tip
    const points = [
      { x: 0, y: 0 },
      { x: results.vectors.v.x, y: results.vectors.v.y },
      { x: results.vectors.v.x + results.vectors.iRa.x, y: results.vectors.v.y + results.vectors.iRa.y },
      { x: results.vectors.e.x, y: results.vectors.e.y }
    ];

    // Determine bounds
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    // Add some padding factor
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    
    // Determine scale to fit in canvas with padding
    const scaleX = (width - 2 * SCALE_PADDING) / rangeX;
    const scaleY = (height - 2 * SCALE_PADDING) / rangeY;
    const scale = Math.min(scaleX, scaleY);

    // Center the diagram
    const offsetX = (width - rangeX * scale) / 2 - minX * scale;
    const offsetY = (height - rangeY * scale) / 2 - minY * scale; // Note: Y axis is inverted in canvas normally

    // Helper to transform coordinates
    // Canvas Y is down, Phasor Y is up. We need to invert Y.
    // Let's assume the center of the drawing area is vertically centered.
    // Actually, easier to just flip Y in transformation.
    const toCanvas = (x, y) => {
      return {
        x: offsetX + x * scale,
        y: height - (offsetY + y * scale) // Flip Y
      };
    };

    // Draw Grid (Optional, subtle)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height/2); ctx.lineTo(width, height/2); // X-axis visual approximation
    ctx.moveTo(width/2, 0); ctx.lineTo(width/2, height); // Y-axis visual approximation
    ctx.stroke();

    // Drawing Functions
    const drawArrow = (from, to, color, label, isDashed = false) => {
      const headLength = 10;
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (isDashed) ctx.setLineDash([5, 5]);
      else ctx.setLineDash([]);
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
      ctx.lineTo(to.x, to.y);
      ctx.fillStyle = color;
      ctx.fill();

      // Label
      if (label) {
        ctx.fillStyle = color;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(label, (from.x + to.x)/2, (from.y + to.y)/2 - 10);
      }
    };

    const origin = toCanvas(0, 0);
    const vTip = toCanvas(results.vectors.v.x, results.vectors.v.y);
    const irTip = toCanvas(results.vectors.v.x + results.vectors.iRa.x, results.vectors.v.y + results.vectors.iRa.y);
    const eTip = toCanvas(results.vectors.e.x, results.vectors.e.y);

    // 1. Draw Reference Voltage V (Blue)
    drawArrow(origin, vTip, '#2563eb', 'Vph');

    // 2. Draw Current I (Green) - Scaled purely for visualization
    // Since I magnitude is usually much smaller or different unit than V, we normalize it to look good
    const iVisScale = (results.vPh * 0.4) / results.ia; 
    const iTip = toCanvas(
      results.vectors.i.mag * Math.cos(results.vectors.i.angle) * iVisScale, 
      results.vectors.i.mag * Math.sin(results.vectors.i.angle) * iVisScale
    );
    drawArrow(origin, iTip, '#16a34a', 'Ia', false);

    // 3. Draw IRa drop (Orange) - From V tip
    drawArrow(vTip, irTip, '#f97316', 'IaRa');

    // 4. Draw IXs drop (Red) - From IRa tip to E tip
    drawArrow(irTip, eTip, '#dc2626', 'IaXs');

    // 5. Draw E (Purple) - From Origin
    drawArrow(origin, eTip, '#9333ea', 'E0 (Eph)');

    // 6. Draw dashed projection for Delta (load angle)
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    // Arc for load angle
    // (Complex to draw perfect arc in transformed coords, skipping for simplicity)
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans" dir="rtl">
      
      {/* Header */}
      <header className="bg-blue-700 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8" />
            <h1 className="text-2xl font-bold">حاسبة ومخطط المولد التزامني (Alternator)</h1>
          </div>
          <div className="text-sm opacity-90 hidden md:block">
            تحليل المتجهات للقدرة المتقدمة والمتأخرة
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex items-center gap-2 mb-4 text-blue-800 border-b pb-2">
              <Settings className="w-5 h-5" />
              <h2 className="text-lg font-bold">المعطيات (Input Data)</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">القدرة الظاهرة S (kVA)</label>
                <input 
                  type="number" 
                  value={sRated} 
                  onChange={(e) => setSRated(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">جهد الخط Vline (Volts)</label>
                <input 
                  type="number" 
                  value={vLine} 
                  onChange={(e) => setVLine(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المقاومة Ra (Ω)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={ra} 
                    onChange={(e) => setRa(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المفاعلة Xs (Ω)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={xs} 
                    onChange={(e) => setXs(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">عامل القدرة P.F</label>
                  <input 
                    type="number" 
                    step="0.1"
                    max="1"
                    min="0"
                    value={pf} 
                    onChange={(e) => setPf(Number(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                  <select 
                    value={pfType} 
                    onChange={(e) => setPfType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="lagging">Lagging (حثي)</option>
                    <option value="leading">Leading (سعوي)</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={calculateValues}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition flex items-center justify-center gap-2 mt-2"
              >
                <Calculator className="w-5 h-5" />
                أعد الحساب
              </button>
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 mt-0.5 shrink-0" />
              <p>
                <strong>ملاحظة:</strong> يتم اعتبار التوصيل نجمي (Star Connection) بشكل افتراضي، حيث تيار الخط يساوي تيار الطور.
              </p>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Calculation Cards */}
          {results && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                <div className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">تيار الحمل (Ia)</div>
                <div className="text-xl font-bold text-gray-900">{results.ia.toFixed(2)} A</div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                <div className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">فولتية الطور (Vph)</div>
                <div className="text-xl font-bold text-blue-600">{results.vPh.toFixed(1)} V</div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center ring-2 ring-purple-100">
                <div className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">E.M.F للطور (Eph)</div>
                <div className="text-2xl font-bold text-purple-700">{results.ePh.toFixed(1)} V</div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                <div className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">E.M.F للخط (Eline)</div>
                <div className="text-xl font-bold text-gray-900">{results.eLine.toFixed(1)} V</div>
              </div>
            </div>
          )}

          {/* Detailed Results */}
          {results && (
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse divide-gray-100">
                 <div className="p-4 text-center">
                   <span className="block text-gray-500 text-sm">هبوط الجهد IaRa</span>
                   <span className="font-semibold text-orange-600">{results.dropRa.toFixed(2)} V</span>
                 </div>
                 <div className="p-4 text-center">
                   <span className="block text-gray-500 text-sm">هبوط الجهد IaXs</span>
                   <span className="font-semibold text-red-600">{results.dropXs.toFixed(2)} V</span>
                 </div>
                 <div className="p-4 text-center">
                   <span className="block text-gray-500 text-sm">زاوية الحمل (δ)</span>
                   <span className="font-semibold text-gray-800">{results.loadAngleDeg.toFixed(2)}°</span>
                 </div>
                 <div className="p-4 text-center">
                   <span className="block text-gray-500 text-sm">تنظيم الجهد (V.R)</span>
                   <span className="font-semibold text-gray-800">{results.regulation.toFixed(2)}%</span>
                 </div>
               </div>
             </div>
          )}

          {/* Canvas */}
          <div className="bg-white p-1 rounded-xl shadow-md border border-gray-200">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                مخطط الطور (Phasor Diagram)
              </h3>
              <div className="text-xs flex gap-3">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600"></span>Vph</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600"></span>Ia</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500"></span>IaRa</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600"></span>IaXs</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-600"></span>E0</span>
              </div>
            </div>
            <div className="relative w-full h-[400px] bg-slate-50 overflow-hidden rounded-b-xl">
              <canvas 
                ref={canvasRef} 
                width={800} 
                height={400} 
                className="w-full h-full object-contain cursor-crosshair"
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
                * الرسم تقريبي للتوضيح (Scale Auto-fit)
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
