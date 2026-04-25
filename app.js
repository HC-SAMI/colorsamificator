const { useState, useEffect, useMemo, useRef, useCallback } = React;
         

        // --- UTILITIES --- //
        const Icon = ({ name, className = "w-4 h-4" }) => {
            const ref = useRef(null);
            useEffect(() => {
                if (ref.current && window.lucide) {
                    const temp = document.createElement('div');
                    temp.innerHTML = `<i data-lucide="${name}" class="${className}"></i>`;
                    window.lucide.createIcons({ root: temp });
                    ref.current.innerHTML = temp.innerHTML;
                }
            }, [name, className]);
            return <span ref={ref} style={{ display: 'contents' }} />;
        };

        const defaultGroupSettings = {
            lightL: 0.5,
            neutralC: 0.02,
            vividC: 0.1,
            neutrals: [
                { id: 'n1', name: 'Dark Neutral', maxL: 0.5 },
                { id: 'n2', name: 'Light Neutral', maxL: 1.0 }
            ],
            hues: [
                { id: 'h1', name: 'Red', maxH: 35 },
                { id: 'h2', name: 'Orange', maxH: 70 },
                { id: 'h3', name: 'Yellow', maxH: 115 },
                { id: 'h4', name: 'Green', maxH: 165 },
                { id: 'h5', name: 'Cyan', maxH: 225 },
                { id: 'h6', name: 'Blue', maxH: 285 },
                { id: 'h7', name: 'Magenta', maxH: 345 }
            ],
            overrides: [
                { id: 'o1', condition: 'Light Muted Yellow', name: 'Beige' },
                { id: 'o2', condition: 'Dark Vivid Blue', name: 'Navy' }
            ]
        };

        function getColorGroup(l, c, h, settings) {
            const { neutralC = 0.02, vividC = 0.1, lightL = 0.5, hues = defaultGroupSettings.hues, overrides = defaultGroupSettings.overrides, neutrals = defaultGroupSettings.neutrals } = settings || defaultGroupSettings;
            let baseName = "";
            if (c < neutralC) {
                const sortedNeutrals = [...(neutrals || defaultGroupSettings.neutrals)].sort((a, b) => a.maxL - b.maxL);
                let neutralName = "Neutral";
                let found = false;
                for (let i = 0; i < sortedNeutrals.length; i++) {
                    if (l <= sortedNeutrals[i].maxL) { neutralName = sortedNeutrals[i].name; found = true; break; }
                }
                if (!found && sortedNeutrals.length > 0) { neutralName = sortedNeutrals[sortedNeutrals.length - 1].name; }
                baseName = neutralName;
            } else {
                let hueName = "Unknown";
                const sortedHues = [...hues].sort((a, b) => a.maxH - b.maxH);
                let found = false;
                for (let i = 0; i < sortedHues.length; i++) {
                    if (h < sortedHues[i].maxH) { hueName = sortedHues[i].name; found = true; break; }
                }
                if (!found && sortedHues.length > 0) { hueName = sortedHues[0].name; }
                const lMod = l >= lightL ? "Light" : "Dark";
                const cMod = c >= vividC ? "Vivid" : "Muted";
                baseName = `${lMod} ${cMod} ${hueName}`;
            }
            if (overrides && overrides.length > 0) {
                const match = overrides.find(o => o.condition.trim().toLowerCase() === baseName.toLowerCase());
                if (match && match.name.trim() !== '') return match.name.trim();
            }
            return baseName;
        }

        function getNounPrefix(L, C) {
            if (C === 0) {
                if (L >= 0.95) return 'UL';
                if (L >= 0.5) return 'L';
                if (L >= 0.2) return 'D';
                return 'UD';
            }
            return L >= 0.5 ? 'L' : 'D';
        }

        function getLayerName(prefix) {
            switch(prefix) {
                case 'UL': return 'Ultra Light';
                case 'L': return 'Light';
                case 'D': return 'Dark';
                case 'UD': return 'Ultra Dark';
                default: return 'Unknown';
            }
        }

        function getLStr(L) {
            // Round to nearest 0.02 interval — adjectives are keyed at these buckets
            const lVal = Math.round(L * 50) * 2;
            return Math.min(100, Math.max(0, lVal)).toString().padStart(2, '0');
        }

        function getExactErpCode(L, C, H) {
            const lStr = Math.round(L * 100).toString().padStart(2, '0');
            const cStr = Math.round(C * 100).toString().padStart(2, '0');
            const hVal = isNaN(H) ? 0 : H;
            const hStr = Math.round(hVal).toString().padStart(3, '0');
            return `${lStr}${cStr}${hStr}`;
        }

        function getGlobalDuplicate(names, adjectives, currentKey, value, savedColors = {}, isOverride = true, ignoreAnchorId = null) {
            if (!value || !isOverride) return null;
            const normalizedVal = value.trim().toLowerCase();
            if (!normalizedVal) return null;
            for (const [key, val] of Object.entries(names)) {
                if (key !== currentKey && key !== ignoreAnchorId && val && val.trim().toLowerCase() === normalizedVal) { return `Noun (${key})`; }
            }
            for (const [key, val] of Object.entries(adjectives)) {
                if (key !== currentKey && key !== ignoreAnchorId && val && val.trim().toLowerCase() === normalizedVal) { return `Layer Adj (${key})`; }
            }
            for (const [id, pt] of Object.entries(savedColors)) {
                if (id !== currentKey) {
                    if (pt.nameOverride && pt.nameOverride.trim().toLowerCase() === normalizedVal) {
                        if (pt.anchorId === currentKey || pt.anchorId === ignoreAnchorId) continue;
                        return `Pin Noun (${pt.erpCode})`;
                    }
                    if (pt.adjOverride && pt.adjOverride.trim().toLowerCase() === normalizedVal) {
                        if (pt.adjId === currentKey || pt.adjId === ignoreAnchorId) continue;
                        return `Pin Adj (${pt.erpCode})`;
                    }
                }
            }
            return null;
        }

        function generateGridPoints(maxC = 0.3, maxL = 1.0) {
            const isMobile = window.innerWidth < 768;
            const allPoints = [];
            const baseAnchors = [];
            const sectors = [
                { minH: 0, maxH: 90.1, delta: isMobile ? 0.04 : 0.02 },
                { minH: 90.1, maxH: 360, delta: isMobile ? 0.08 : 0.04 }
            ];
            sectors.forEach(sector => {
                const baseDelta = sector.delta;
                
                const cValues = [];
                for (let c = 0; c <= maxC + 0.001; c += 0.02) {
                    if (c > 0.04 && Math.abs((c / baseDelta) - Math.round(c / baseDelta)) > 0.1) {
                        continue;
                    }
                    cValues.push(c);
                }
                
                cValues.forEach(C => {
                    const d = (C <= 0.04) ? (isMobile ? 0.04 : 0.02) : baseDelta;
                    const cStr = Math.round(C * 100).toString().padStart(2, '0');
                    
                    const cStepForH = Math.round(C / d);
                    const nH = (C === 0) ? 1 : 6 * cStepForH;
                    const stepH = 360 / nH;
                    
                    for (let hIndex = 0; hIndex < nH; hIndex++) {
                        const H = (hIndex * stepH) % 360;
                        if (H >= sector.minH - 0.001 && H < sector.maxH - 0.001) {
                            const hStr = Math.round(H).toString().padStart(3, '0');
                            const a = C * Math.sin(H * Math.PI / 180);
                            const b = C * Math.cos(H * Math.PI / 180);
                            let validUL = [], validL = [], validD = [], validUD = [];
                            
                            for (let L = 0; L <= maxL + 0.001; L += 0.02) {
                                const lStr = getLStr(L);
                                const cColor = new Color("oklch", [L, C, H]);
                                if (cColor.inGamut("srgb") || (C === 0 && L >= 0 && L <= 1)) {
                                    const pt = { L, C, H, a, b, lStr, cStr, hStr, erpCode: `${lStr}${cStr}${hStr}`, color: cColor.clone().toGamut({space: "srgb"}).toString({format: "hex"}), opacity: 1.0, ring: cStepForH, delta: d };
                                    allPoints.push(pt);
                                    if (C === 0) {
                                        if (L >= 0.95) validUL.push(pt);
                                        else if (L >= 0.5) validL.push(pt);
                                        else if (L >= 0.2) validD.push(pt);
                                        else validUD.push(pt);
                                    } else {
                                        if (L >= 0.5) validL.push(pt);
                                        else validD.push(pt);
                                    }
                                }
                            }
                            if (validL.length > 0 || validD.length > 0 || validUL.length > 0 || validUD.length > 0) {
                                const getBestDisplay = (pts, targetL) => { if (!pts || pts.length === 0) return null; return pts.reduce((prev, curr) => Math.abs(curr.L - targetL) < Math.abs(prev.L - targetL) ? curr : prev); };
                                baseAnchors.push({ C, H, a, b, cStr, hStr, ultraLightRef: getBestDisplay(validUL, 0.975), lightRef: getBestDisplay(validL, C === 0 ? 0.725 : 0.75), darkRef: getBestDisplay(validD, C === 0 ? 0.35 : 0.25), ultraDarkRef: getBestDisplay(validUD, 0.1), ulCount: validUL.length, lightCount: validL.length, darkCount: validD.length, udCount: validUD.length, delta: d });
                            }
                        }
                    }
                });
            });
            return { baseAnchors, allPoints };
        }

        function generateGridData() {
            return generateGridPoints(0.3, 1.0);
        }

        // --- ATOMIC COMPONENTS --- //

        const SliderGroup = ({ label, value, min, max, step, onChange, icon }) => (
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-neutral-200"><Icon name={icon} className="w-3.5 h-3.5 slider-icon" /> {label}</span>
                    <input type="number" step={step} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="w-16 text-right text-xs font-mono font-bold bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white" />
                </div>
                <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full" />
            </div>
        );

        const CollapsiblePanel = ({ title, icon, children, defaultOpen = false }) => {
            const [isOpen, setIsOpen] = useState(defaultOpen);
            return (
                <div className="border-b border-slate-200 dark:border-neutral-800">
                    <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-neutral-200"><Icon name={icon} className="w-4 h-4 slider-icon" /> {title}</div>
                        <Icon name={isOpen ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-slate-400" />
                    </button>
                    {isOpen && <div className="p-4 pt-0">{children}</div>}
                </div>
            );
        };

        const SPECTRAL_TABLES = {
            wavelengths: [400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700],
            cmf2: {
                x: [0.0143, 0.0435, 0.1344, 0.2839, 0.3483, 0.3362, 0.2908, 0.1954, 0.0956, 0.032, 0.0049, 0.0093, 0.0633, 0.1655, 0.2904, 0.4334, 0.5945, 0.7621, 0.9163, 1.0263, 1.0622, 1.0026, 0.8544, 0.6424, 0.4479, 0.2835, 0.1649, 0.0874, 0.0468, 0.0227, 0.0114],
                y: [0.0004, 0.0012, 0.004, 0.0116, 0.023, 0.038, 0.06, 0.091, 0.139, 0.208, 0.323, 0.503, 0.71, 0.862, 0.954, 0.995, 0.995, 0.952, 0.87, 0.757, 0.631, 0.503, 0.381, 0.265, 0.175, 0.107, 0.061, 0.032, 0.017, 0.008, 0.004],
                z: [0.0679, 0.2074, 0.6456, 1.3856, 1.7471, 1.7721, 1.6692, 1.2876, 0.813, 0.4652, 0.272, 0.1582, 0.0782, 0.0422, 0.0203, 0.0087, 0.0039, 0.0017, 0.0008, 0.0004, 0.0002, 0.0001, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            cmf10: {
                x: [0.0191, 0.0847, 0.2045, 0.3147, 0.3837, 0.3707, 0.3023, 0.1956, 0.0805, 0.0162, 0.0038, 0.0389, 0.134, 0.2541, 0.3929, 0.543, 0.7035, 0.8444, 0.9464, 1.031, 1.0456, 0.9298, 0.76, 0.57, 0.398, 0.2519, 0.1421, 0.0732, 0.0376, 0.0192, 0.0098],
                y: [0.002, 0.0088, 0.0214, 0.0387, 0.0621, 0.0895, 0.1282, 0.1852, 0.2536, 0.3391, 0.4608, 0.6067, 0.7618, 0.8752, 0.962, 0.9918, 0.9973, 0.9556, 0.8689, 0.76, 0.6285, 0.4831, 0.3621, 0.249, 0.1614, 0.0956, 0.0527, 0.0267, 0.0135, 0.0068, 0.0035],
                z: [0.086, 0.3894, 0.9725, 1.5523, 1.9673, 1.9948, 1.7454, 1.3171, 0.7721, 0.3713, 0.1859, 0.092, 0.041, 0.0178, 0.0076, 0.0031, 0.0012, 0.0005, 0.0002, 0.0001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            illuminants: {
                D50: [53.24, 65.75, 70.08, 63.63, 80.19, 93.45, 96.11, 95.77, 98.71, 94.75, 97.47, 98.48, 97.52, 102.15, 100.22, 101.44, 100.00, 98.34, 100.07, 95.04, 98.94, 98.54, 98.17, 95.12, 97.54, 95.47, 97.35, 101.37, 98.05, 88.58, 92.44],
                D65: [82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81, 109.35, 107.80, 104.79, 107.69, 104.41, 104.05, 100.00, 96.33, 95.79, 88.77, 90.01, 89.60, 87.70, 83.29, 83.70, 80.03, 80.21, 82.28, 78.28, 69.71, 71.61],
                A: [14.71, 17.68, 21.00, 24.67, 28.70, 33.09, 37.82, 42.87, 48.25, 53.91, 59.86, 66.06, 72.50, 79.13, 85.95, 92.91, 100.00, 107.18, 114.44, 121.73, 129.04, 136.34, 143.62, 150.83, 157.98, 165.03, 171.96, 178.77, 185.43, 191.93, 198.26],
                F2: [20.3, 31.5, 38.0, 58.0, 82.0, 54.0, 56.0, 60.0, 66.0, 75.0, 86.0, 95.0, 100.0, 102.0, 101.0, 96.0, 90.0, 94.0, 104.0, 89.0, 77.0, 65.0, 55.0, 46.0, 38.0, 31.0, 26.0, 21.0, 17.0, 14.0, 11.0],
                F11: [19.0, 10.0, 13.0, 38.0, 24.0, 16.0, 14.0, 14.0, 16.0, 22.0, 31.0, 41.0, 53.0, 66.0, 100.0, 91.0, 65.0, 50.0, 64.0, 53.0, 38.0, 100.0, 42.0, 22.0, 13.0, 8.0, 5.0, 3.0, 2.0, 1.0, 1.0]
            }
        };

        const calculateXYZFromSpectral = (spectral, observer, illuminant) => {
            const cmfs = observer === 10 ? SPECTRAL_TABLES.cmf10 : SPECTRAL_TABLES.cmf2;
            let illKey = String(illuminant || '').toUpperCase();
            if (illKey.includes('D50')) illKey = 'D50';
            else if (illKey.includes('D65')) illKey = 'D65';
            else if (illKey.includes('F2')) illKey = 'F2';
            else if (illKey.includes('F11')) illKey = 'F11';
            else if (illKey.startsWith('A')) illKey = 'A';
            const ill = SPECTRAL_TABLES.illuminants[illKey] || SPECTRAL_TABLES.illuminants.D50;
            let X = 0, Y = 0, Z = 0, sumY = 0;
            for (let i = 0; i < SPECTRAL_TABLES.wavelengths.length; i++) {
                const r = spectral[i] || 0;
                const weight = ill[i];
                X += r * weight * cmfs.x[i];
                Y += r * weight * cmfs.y[i];
                Z += r * weight * cmfs.z[i];
                sumY += weight * cmfs.y[i];
            }
            const k = 1 / sumY;
            return [X * k, Y * k, Z * k];
        };

        const getWhitePoint = (observer, illuminant) => {
            const perfectReflector = new Array(31).fill(1);
            return calculateXYZFromSpectral(perfectReflector, observer, illuminant);
        };

        const xyzToLab = (xyz, whitePoint) => {
            const f = t => t > 0.008856 ? Math.pow(t, 1/3) : 7.787 * t + 16/116;
            const fx = f(xyz[0] / whitePoint[0]);
            const fy = f(xyz[1] / whitePoint[1]);
            const fz = f(xyz[2] / whitePoint[2]);
            return [
                116 * fy - 16,
                500 * (fx - fy),
                200 * (fy - fz)
            ];
        };

        const labToLch = (lab) => {
            const [l, a, b] = lab;
            const c = Math.sqrt(a*a + b*b);
            let h = Math.atan2(b, a) * 180 / Math.PI;
            if (h < 0) h += 360;
            return [l, c, h];
        };

        const calculateDeltaEFromSpectral = (spectralA, spectralB, observer, illuminant) => {
            const xyzA = calculateXYZFromSpectral(spectralA, observer, illuminant);
            const xyzB = calculateXYZFromSpectral(spectralB, observer, illuminant);
            const wp = getWhitePoint(observer, illuminant);
            const labA = xyzToLab(xyzA, wp);
            const labB = xyzToLab(xyzB, wp);
            const cA = new Color("lab", labA);
            const cB = new Color("lab", labB);
            return cA.deltaE(cB, "2000");
        };

        const ColorConverter = ({ crosshair, onEdit, observer, setObserver, illuminant, setIlluminant, colorData }) => {
            if (!crosshair) return null;
            const c = new Color("oklch", [crosshair.rawL, crosshair.rawC, crosshair.rawH]);
            const hex = c.clone().toGamut({space: "srgb"}).toString({format: "hex"}).toUpperCase();
            const fmt = (v, d = 3) => isNaN(v) ? "0.000" : Number(v).toFixed(d);
            const wrap = (space) => `[${fmt(c.to(space).coords[0])}, ${fmt(c.to(space).coords[1])}, ${fmt(c.to(space).coords[2])}]`;
            
            const spectral = crosshair.activeSavedColor?.spectral || crosshair.temporarySpectral;
            
            let varXYZ = null;
            let varLab = null;
            let varLch = null;

            if (spectral) {
                varXYZ = calculateXYZFromSpectral(spectral, observer, illuminant);
                const wp = getWhitePoint(observer, illuminant);
                varLab = xyzToLab(varXYZ, wp);
                varLch = labToLch(varLab);
            } else {
                // Fallback to colorjs.io conversions if no spectral data
                const targetXyzSpace = illuminant === 'D50' ? 'xyz-d50' : 'xyz-d65';
                varXYZ = c.to(targetXyzSpace).coords;
                const wp = getWhitePoint(observer, illuminant);
                varLab = xyzToLab(varXYZ, wp);
                varLch = labToLch(varLab);
            }

            const EditableColorField = ({ label, value, space, onEdit, isOutOfGamut, readOnly = false }) => {
                const [localVal, setLocalVal] = useState(value);
                const [isFocused, setIsFocused] = useState(false);
                useEffect(() => { if (!isFocused) setLocalVal(value); }, [value, isFocused]);
                const applyChange = (val) => {
                    if (readOnly) return;
                    try {
                        let pc;
                        if (space === 'Hex') { const ch = val.trim(); if (/^#?[0-9a-fA-F]{3,8}$/.test(ch)) pc = new Color(ch.startsWith('#') ? ch : '#' + ch); }
                        else {
                            const p = val.replace(/[\[\]]/g, '').split(/[\s,;]+/).filter(x => x !== "").map(s => parseFloat(s));
                            if (p.length === 3 && p.every(v => !isNaN(v))) {
                                const sm = { 'OKLCH': 'oklch', 'OKLAB': 'oklab', 'CIE LAB': 'lab', 'XYZ D50': 'xyz-d50', 'XYZ D65': 'xyz-d65', 'CIE LCH': 'lch', 'HSL': 'hsl' };
                                if (space === 'RGB') pc = new Color('srgb', [p[0]/255, p[1]/255, p[2]/255]);
                                else if (sm[space]) pc = new Color(sm[space], p);
                            }
                        }
                        if (pc) { const o = pc.to('oklch'); onEdit([o.coords[0], o.coords[1], isNaN(o.coords[2]) ? 0 : o.coords[2]]); }
                    } catch (err) {}
                };
                return (
                    <div className="flex flex-col">
                        <label className="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase mb-0.5 tracking-tighter flex items-center justify-between">
                            <span>{label}</span>
                            {isOutOfGamut && space === 'Hex' && <Icon name="alert-triangle" className="w-3 h-3 text-red-500" title="Out of sRGB Gamut" />}
                        </label>
                        <input type="text" value={localVal} readOnly={readOnly} onFocus={() => setIsFocused(true)} onBlur={() => { setIsFocused(false); applyChange(localVal); }} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} onChange={(e) => setLocalVal(e.target.value)} spellCheck="false" className={`w-full bg-slate-100 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded px-1.5 py-1 font-mono text-[10px] ${readOnly ? 'text-slate-500 dark:text-neutral-500 cursor-not-allowed' : 'text-slate-800 dark:text-neutral-200'} focus:outline-none focus:border-sky-500 transition-all`} />
                    </div>
                );
            };
            return (
                <div className="flex flex-col gap-4">
                    {/* Fixed Spaces D65/2 */}
                    <div>
                        <div className="text-[10px] font-bold text-slate-600 dark:text-neutral-300 uppercase mb-2 border-b border-slate-200 dark:border-neutral-800 pb-1">Fixed Spaces (D65 / 2°)</div>
                        <div className="grid grid-cols-2 gap-3">
                            <EditableColorField label="OKLCH" space="OKLCH" value={`[${fmt(c.coords[0])}, ${fmt(c.coords[1])}, ${fmt(c.coords[2], 1)}]`} onEdit={onEdit} />
                            <EditableColorField label="OKLAB" space="OKLAB" value={wrap('oklab')} onEdit={onEdit} />
                            <EditableColorField label="RGB" space="RGB" value={`[${Math.round(c.to('srgb').coords[0]*255)}, ${Math.round(c.to('srgb').coords[1]*255)}, ${Math.round(c.to('srgb').coords[2]*255)}]`} onEdit={onEdit} />
                            <EditableColorField label="HEX" space="Hex" value={hex} onEdit={onEdit} isOutOfGamut={!c.inGamut('srgb')} />
                            <EditableColorField label="HSL" space="HSL" value={`[${fmt(c.to('hsl').coords[0], 1)}, ${fmt(c.to('hsl').coords[1])}%, ${fmt(c.to('hsl').coords[2])}%]` } onEdit={onEdit} />
                        </div>
                    </div>

                    {/* Variable Spaces */}
                    <div>
                        <div className="text-[10px] font-bold text-slate-600 dark:text-neutral-300 uppercase mb-2 border-b border-slate-200 dark:border-neutral-800 pb-1 flex justify-between items-center">
                            <span>Variable Spaces</span>
                            {!spectral && <span className="text-[8px] text-amber-500 font-normal normal-case flex items-center gap-1"><Icon name="info" className="w-3 h-3" /> Spectral data required</span>}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Observer</span>
                                <select 
                                    value={observer} 
                                    onChange={(e) => setObserver(parseInt(e.target.value))}
                                    disabled={!spectral}
                                    className="bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-sky-500 transition-all disabled:opacity-50"
                                >
                                    <option value={2}>2° (CIE 1931)</option>
                                    <option value={10}>10° (CIE 1964)</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">Illuminant</span>
                                <select 
                                    value={illuminant} 
                                    onChange={(e) => setIlluminant(e.target.value)}
                                    disabled={!spectral}
                                    className="bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-sky-500 transition-all disabled:opacity-50"
                                >
                                    <option value="D65">D65</option>
                                    <option value="D50">D50</option>
                                    <option value="A">A (Incandescent)</option>
                                    <option value="F2">F2 (Cool White)</option>
                                    <option value="F11">F11 (Narrow Band)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <EditableColorField label={`CIE LAB (${illuminant}/${observer}°)`} space="CIE LAB" value={`[${fmt(varLab[0])}, ${fmt(varLab[1])}, ${fmt(varLab[2])}]`} readOnly={true} />
                            <EditableColorField label={`CIE LCH (${illuminant}/${observer}°)`} space="CIE LCH" value={`[${fmt(varLch[0])}, ${fmt(varLch[1])}, ${fmt(varLch[2], 1)}]`} readOnly={true} />
                            <EditableColorField label={`XYZ (${illuminant}/${observer}°)`} space="XYZ" value={`[${fmt(varXYZ[0])}, ${fmt(varXYZ[1])}, ${fmt(varXYZ[2])}]`} readOnly={true} />
                        </div>
                    </div>
                </div>
            );
        };

        const CommercialMatches = ({ crosshair, colorData, onSelectColor }) => {
            if (!crosshair) return null;
            const c = new Color("oklch", [crosshair.rawL, crosshair.rawC, crosshair.rawH]);
            const hex = c.clone().toGamut({space: "srgb"}).toString({format: "hex"}).toUpperCase();
            const fmt = (v, d = 3) => isNaN(v) ? "0.000" : Number(v).toFixed(d);

            const [fullscreenImage, setFullscreenImage] = useState(null);
            const [maxDeltaE, setMaxDeltaE] = useState(5.0);
            const [searchQuery, setSearchQuery] = useState('');

            const filteredMatches = useMemo(() => {
                if (!colorData || Object.keys(colorData).length === 0) return null;
                
                const allMatches = [];
                
                const processList = (list, label) => {
                    if (!list || !Array.isArray(list)) return;
                    for (const item of list) {
                        try {
                            let hexVal = item.hex || '#000000';
                            let targetColor;
                            if (item.spectral && item.spectral.length === 31) {
                                const xyzStandard = calculateXYZFromSpectral(item.spectral, 2, 'D65');
                                targetColor = new Color('xyz-d65', xyzStandard).to('oklch');
                                hexVal = targetColor.to('srgb').toString({format: "hex"});
                            } else if (item.L !== undefined && item.C !== undefined && item.H !== undefined) {
                                targetColor = new Color("oklch", [item.L, item.C, item.H]);
                            } else {
                                targetColor = new Color(item.hex).to('oklch');
                            }
                            const d = c.deltaE(targetColor, "OK") * 100;
                            if (d <= maxDeltaE) {
                                allMatches.push({ label, match: { ...item, hex: hexVal, L: targetColor.coords[0], C: targetColor.coords[1], H: isNaN(targetColor.coords[2])?0:targetColor.coords[2], d } });
                            }
                        } catch (e) {}
                    }
                };

                // Dynamic: iterate every brand in colorData regardless of key name
                Object.entries(colorData).forEach(([brandKey, list]) => {
                    const label = getBrandDisplayName(brandKey);
                    processList(list, label);
                });

                const q = searchQuery.toLowerCase().trim();
                const searchedMatches = q ? allMatches.filter(item => 
                    item.label.toLowerCase().includes(q) || 
                    (item.match.name && item.match.name.toLowerCase().includes(q)) ||
                    (item.match.url && item.match.url.toLowerCase().includes(q))
                ) : allMatches;

                searchedMatches.sort((a, b) => {
                    const aVerified = a.match.spectral && a.match.spectral.length > 0 ? 1 : 0;
                    const bVerified = b.match.spectral && b.match.spectral.length > 0 ? 1 : 0;
                    if (aVerified !== bVerified) return bVerified - aVerified;
                    return a.match.d - b.match.d;
                });

                return searchedMatches.slice(0, 100);
            }, [c.coords[0], c.coords[1], c.coords[2], colorData, maxDeltaE, searchQuery]);

            const MatchRow = ({ label, match }) => {
                if (!match) return null;
                const isVerified = match.spectral && match.spectral.length > 0;
                
                const handleRowClick = () => {
                    if (onSelectColor) {
                        try {
                            const matchColor = new Color(match.hex);
                            const oklch = matchColor.to("oklch");
                            onSelectColor([oklch.l, oklch.c, oklch.h || 0], match.spectral);
                        } catch (e) {
                            console.error("Failed to convert match color to OKLCH", e);
                        }
                    }
                };
                
                return (
                    <div 
                        className={`flex items-center gap-3 p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${isVerified ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30' : 'bg-slate-50 dark:bg-neutral-800/50 border-slate-100 dark:border-neutral-800'}`}
                        onClick={handleRowClick}
                    >
                        {match.image ? (
                            <div className="relative group w-8 h-8 rounded shadow-sm shrink-0 border border-slate-200 dark:border-neutral-700 bg-cover bg-center" style={{ backgroundImage: `url(${match.image})` }}>
                                <button 
                                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFullscreenImage(match.image);
                                    }}
                                >
                                    <Icon name="maximize-2" className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded shadow-sm shrink-0 border border-slate-200 dark:border-neutral-700" style={{ backgroundColor: match.hex }}></div>
                        )}
                        <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <div className="text-[11px] font-medium text-slate-800 dark:text-neutral-200 truncate">{match.name}</div>
                                {isVerified && <Icon name="check-circle" className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Verified with Spectral Data" />}
                            </div>
                            <div className="text-[9px] text-slate-500 dark:text-neutral-500 uppercase tracking-wider">{label} &middot; ΔEok {fmt(match.d, 2)}</div>
                        </div>
                    </div>
                );
            };

            return (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2 p-2 bg-slate-50 dark:bg-neutral-800/50 rounded border border-slate-100 dark:border-neutral-800">
                        <div className="flex items-center gap-2">
                            <Icon name="search" className="w-3.5 h-3.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Filter by brand or name..." 
                                className="flex-1 bg-transparent text-[11px] outline-none text-slate-700 dark:text-neutral-300 placeholder:text-slate-400"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                                    <Icon name="x" className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-[10px] text-slate-500 w-12">ΔE &le; {maxDeltaE.toFixed(2)}</div>
                            <input 
                                type="range" 
                                min="0.00" 
                                max="0.25" 
                                step="0.01" 
                                value={maxDeltaE} 
                                onChange={e => setMaxDeltaE(parseFloat(e.target.value))}
                                className="flex-1 h-1 bg-slate-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {filteredMatches ? (
                        <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1">
                            {filteredMatches.map((item, idx) => (
                                <MatchRow key={item.label + idx + item.match.name} label={item.label} match={item.match} />
                            ))}
                            
                            {filteredMatches.length === 0 && (
                                <div className="text-[10px] text-slate-500 italic p-2 text-center">No commercial matches found (ΔE &le; {maxDeltaE.toFixed(2)}).</div>
                            )}
                        </div>
                    ) : (
                        <div className="text-[10px] text-slate-500 p-2 text-center">Loading color data...</div>
                    )}
                    
                    {fullscreenImage && (
                        <div 
                            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
                            onClick={() => setFullscreenImage(null)}
                        >
                            <img 
                                src={fullscreenImage} 
                                alt="Fullscreen Match" 
                                className="max-w-full max-h-full object-contain rounded shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button 
                                className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors"
                                onClick={() => setFullscreenImage(null)}
                            >
                                <Icon name="x" className="w-6 h-6" />
                            </button>
                        </div>
                    )}
                </div>
            );
        };

        const PlotlyChart = ({ data, layout, config = {}, onPointClick, onBgClick, onRelayout, theme }) => {
            const chartRef = useRef(null);
            useEffect(() => {
                const gd = chartRef.current; if (!gd || !Plotly) return;
                let activeLayout = JSON.parse(JSON.stringify(layout)); const is3D = !!activeLayout.scene;
                if (gd._fullLayout) {
                    if (is3D && gd._fullLayout.scene) {
                        if (gd._fullLayout.scene._scene && typeof gd._fullLayout.scene._scene.getCamera === 'function') {
                            activeLayout.scene.camera = gd._fullLayout.scene._scene.getCamera();
                        } else if (gd._fullLayout.scene.camera) {
                            activeLayout.scene.camera = JSON.parse(JSON.stringify(gd._fullLayout.scene.camera));
                        }
                    }
                    if (gd._fullLayout.xaxis && gd._fullLayout.xaxis.range && activeLayout.xaxis) {
                        activeLayout.xaxis.range = JSON.parse(JSON.stringify(gd._fullLayout.xaxis.range));
                    }
                    if (gd._fullLayout.yaxis && gd._fullLayout.yaxis.range && activeLayout.yaxis) {
                        activeLayout.yaxis.range = JSON.parse(JSON.stringify(gd._fullLayout.yaxis.range));
                    }
                }
                Plotly.react(gd, data, activeLayout, { responsive: true, displayModeBar: false, scrollZoom: true, ...config }).then(() => {
                    gd.removeAllListeners('plotly_click');
                    gd.removeAllListeners('plotly_relayout');
                    if (onPointClick) { 
                        gd.on('plotly_click', (e) => { 
                            gd.__pointClicked = true; 
                            if (e.points && e.points[0] && e.points[0].customdata) {
                                onPointClick(e.points[0].customdata); 
                            }
                            setTimeout(() => { gd.__pointClicked = false; }, 50); 
                        }); 
                    }
                    if (onRelayout) { gd.on('plotly_relayout', onRelayout); }
                });
                let isMiddleProxying = false;
                const proxyEvent = (e) => { if (e.__proxied) return; e.preventDefault(); e.stopPropagation(); const targetButton = is3D ? 2 : 0; const targetButtons = is3D ? 2 : 1; const clone = new (window.PointerEvent ? PointerEvent : MouseEvent)(e.type, { bubbles: true, cancelable: e.type !== 'pointermove' && e.type !== 'mousemove', view: window, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, movementX: e.movementX, movementY: e.movementY, button: (e.type.includes('move')) ? -1 : targetButton, buttons: targetButtons, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, relatedTarget: e.relatedTarget }); clone.__proxied = true; e.target.dispatchEvent(clone); };
                const handleMidDown = (e) => { if (e.button === 1 && !e.__proxied) { isMiddleProxying = true; proxyEvent(e); } };
                const handleMidMoveUp = (e) => { if (isMiddleProxying && !e.__proxied) { if ((e.buttons & 4) || (e.type.endsWith('up') && e.button === 1)) { proxyEvent(e); if (e.type.endsWith('up')) isMiddleProxying = false; } else if (e.buttons === 0) isMiddleProxying = false; } };
                let leftPointerDown = null;
                const handleLeftDown = (e) => { if (e.button === 0 && !e.__proxied) leftPointerDown = { x: e.clientX, y: e.clientY }; };
                const handleLeftUp = (e) => { 
                    if (e.button === 0 && !e.__proxied && leftPointerDown && onBgClick && !is3D) { 
                        const dx = e.clientX - leftPointerDown.x; 
                        const dy = e.clientY - leftPointerDown.y; 
                        if (Math.sqrt(dx * dx + dy * dy) < 10) { 
                            if (gd._fullLayout && gd._fullLayout.xaxis && gd._fullLayout.yaxis) { 
                                const rect = gd.getBoundingClientRect(); 
                                const xAxis = gd._fullLayout.xaxis; 
                                const yAxis = gd._fullLayout.yaxis; 
                                const xPx = e.clientX - rect.left - xAxis._offset; 
                                const yPx = e.clientY - rect.top - yAxis._offset; 
                                if (xPx >= 0 && xPx <= xAxis._length && yPx >= 0 && yPx <= yAxis._length) { 
                                    const xData = xAxis.p2d(xPx); 
                                    const yData = yAxis.p2d(yPx); 
                                    setTimeout(() => { 
                                        if (!gd.__pointClicked) onBgClick(xData, yData); 
                                    }, 50); 
                                } 
                            } 
                        } 
                    } 
                    leftPointerDown = null; 
                };
                const upEv = !!window.PointerEvent ? 'pointerup' : 'mouseup';
                gd.addEventListener(!!window.PointerEvent ? 'pointerdown' : 'mousedown', handleMidDown, { capture: true, passive: false });
                window.addEventListener(!!window.PointerEvent ? 'pointermove' : 'mousemove', handleMidMoveUp, { capture: true, passive: false });
                window.addEventListener(upEv, handleMidMoveUp, { capture: true, passive: false });
                gd.addEventListener(!!window.PointerEvent ? 'pointerdown' : 'mousedown', handleLeftDown, { capture: true });
                window.addEventListener(upEv, handleLeftUp, { capture: true });
                return () => { gd.removeEventListener(!!window.PointerEvent ? 'pointerdown' : 'mousedown', handleMidDown, { capture: true }); window.removeEventListener(!!window.PointerEvent ? 'pointermove' : 'mousemove', handleMidMoveUp, { capture: true }); window.removeEventListener(upEv, handleMidMoveUp, { capture: true }); gd.removeEventListener(!!window.PointerEvent ? 'pointerdown' : 'mousedown', handleLeftDown, { capture: true }); window.removeEventListener(upEv, handleLeftUp, { capture: true }); };
            }, [data, layout, theme, onPointClick, onBgClick, config]);
            return <div ref={chartRef} className="plotly-wrapper"></div>;
        };

        const View3D = ({ points, crosshair, handlePointClick, theme, names, adjectives, savedColors = {}, lockedNouns, lockedAdjectives, tetheringPinId }) => {
            const isDark = theme === 'dark';
            const data = useMemo(() => {
                const traces = [];
                traces.push({ type: 'scatter3d', mode: 'markers', x: points.map(p => p.a), y: points.map(p => p.b), z: points.map(p => p.L), text: points.map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; const name = `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed'; return `<b>${name}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`; }), hovertemplate: "%{text}<extra></extra>", customdata: points.map(p => [p.L, p.C, p.H]), marker: { size: 4, color: points.map(p => p.color), opacity: 0.8, line: { width: 0 } } });
                const gridLockedNodes = points.filter(p => !p.isCustomAnchor).filter(p => { const prefix = getNounPrefix(p.L, p.C); return !p.isPin && lockedNouns[`${prefix}-${p.cStr}-${p.hStr}`] && lockedAdjectives[p.lStr]; }).map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; return { ...p, displayName: `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed' }; });
                const customLockedNodes = Object.values(savedColors).filter(sc => sc.type === 'anchor').map(p => { const displayName = `${p.adjOverride || adjectives[p.adjId] || ''} ${p.nameOverride || names[p.anchorId] || ''}`.trim() || p.id || 'Custom Anchor'; return { ...p, a: p.C * Math.sin(p.H * Math.PI / 180), b: p.C * Math.cos(p.H * Math.PI / 180), displayName }; });
                const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
                Object.values(savedColors).filter(sc => sc.type === 'nounColumn').forEach(nc => {
                    const ncName = `${nc.nameOverride || names[nc.id] || 'Custom Noun'}`;
                    traces.push({
                        type: 'scatter3d', mode: 'lines',
                        x: [nc.a, nc.a], y: [nc.b, nc.b], z: [nc.minL, nc.maxL],
                        line: { color: isDark ? 'rgba(242, 232, 223, 0)' : 'rgba(1, 13, 0, 0)', width: 0 },
                        hoverinfo: 'text',
                        text: [`<b>[Range] ${ncName}</b><br>L: ${nc.minL.toFixed(2)} - ${nc.maxL.toFixed(2)}`, `<b>[Range] ${ncName}</b><br>L: ${nc.minL.toFixed(2)} - ${nc.maxL.toFixed(2)}`]
                    });
                });
                const pinNodes = Object.values(savedColors).filter(sc => sc.type === 'pin').map(p => { const displayName = `${p.adjOverride || adjectives[p.adjId] || ''} ${p.nameOverride || names[p.anchorId] || ''}`.trim() || 'Unnamed Pin'; return { ...p, a: p.C * Math.sin(p.H * Math.PI / 180), b: p.C * Math.cos(p.H * Math.PI / 180), displayName }; });
                traces.push({ type: 'scatter3d', mode: 'markers', x: lockedNodes.map(p => p.a), y: lockedNodes.map(p => p.b), z: lockedNodes.map(p => p.L), text: lockedNodes.map(p => `<b>[Lock] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`), hovertemplate: "%{text}<extra></extra>", customdata: lockedNodes.map(p => [p.L, p.C, p.H]), marker: { symbol: 'square', size: 6, color: lockedNodes.map(p => p.color), line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } } });
                traces.push({ type: 'scatter3d', mode: 'markers', x: pinNodes.map(p => p.a), y: pinNodes.map(p => p.b), z: pinNodes.map(p => p.L), text: pinNodes.map(p => `<b>[Pin] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`), hovertemplate: "%{text}<extra></extra>", customdata: pinNodes.map(p => [p.L, p.C, p.H]), marker: { symbol: 'x', size: 6, color: pinNodes.map(p => p.color), line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } } });
                traces.push({ type: 'scatter3d', mode: 'lines', x: crosshair?.snapTarget ? [crosshair.a, crosshair.snapTarget.a] : [], y: crosshair?.snapTarget ? [crosshair.b, crosshair.snapTarget.b] : [], z: crosshair?.snapTarget ? [crosshair.rawL, crosshair.snapTarget.L] : [], line: { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', width: 2, dash: 'dot' }, hoverinfo: 'skip' });
                traces.push({ type: 'scatter3d', mode: 'markers', x: [crosshair?.a], y: [crosshair?.b], z: [crosshair?.rawL], text: [`<b>Cursor</b><br>L: ${crosshair?.rawL.toFixed(3)} C: ${crosshair?.rawC.toFixed(3)} H: ${crosshair?.rawH.toFixed(1)}°`], hovertemplate: "%{text}<extra></extra>", marker: { symbol: 'cross', size: 8, color: isDark ? '#F2E8DF' : '#010D00', line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } }, hoverinfo: 'skip' });
                return traces;
            }, [points, crosshair, isDark, names, adjectives, savedColors, lockedNouns, lockedAdjectives]);
            const layout = useMemo(() => ({ uirevision: 'true', paper_bgcolor: 'rgba(0,0,0,0)', margin: { l: 0, r: 0, b: 0, t: 0 }, scene: { xaxis: { title: 'a', range: [-0.3, 0.3], backgroundcolor: isDark ? '#052212' : '#F2E8DF', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', zerolinecolor: isDark ? 'rgba(177,188,131,0.25)' : 'rgba(43,64,50,0.15)', showspikes: false, titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'} }, yaxis: { title: 'b', range: [-0.3, 0.3], backgroundcolor: isDark ? '#052212' : '#F2E8DF', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', zerolinecolor: isDark ? 'rgba(177,188,131,0.25)' : 'rgba(43,64,50,0.15)', showspikes: false, titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'} }, zaxis: { title: 'L', range: [0, 1], backgroundcolor: isDark ? '#052212' : '#F2E8DF', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', zerolinecolor: isDark ? 'rgba(177,188,131,0.25)' : 'rgba(43,64,50,0.15)', showspikes: false, titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'} }, camera: { eye: { x: 1.5, y: 1.5, z: 0.5 } } }, showlegend: false }), [isDark]);
            return <PlotlyChart data={data} layout={layout} onPointClick={handlePointClick} theme={theme} />;
        };
        const ViewVertical = ({ points, crosshair, handlePointClick, theme, names, adjectives, savedColors = {}, lockedNouns, lockedAdjectives, viewMode, tetheringPinId, swatchLayout, swatchZoom, viewportFilter, viewportSearchQuery, viewportTagFilter }) => {
            const isDark = theme === 'dark';
            const [showText, setShowText] = useState(false);
            const handleRelayout = (e) => { if (e['xaxis.range[0]'] !== undefined && e['xaxis.range[1]'] !== undefined) { setShowText((e['xaxis.range[1]'] - e['xaxis.range[0]']) < 0.15); } else if (e['xaxis.autorange']) { setShowText(false); } };
            const stableH = useMemo(() => {
                const allPoints = [...(points || [])];
                Object.values(savedColors).forEach(sc => {
                    if (sc.type === 'pin') allPoints.push(sc);
                });
                if (allPoints.length === 0) return 0;
                const target = crosshair?.rawH || 0;
                const uniqueH = [...new Set(allPoints.filter(p => p.C > 0).map(p => p.H))].sort((a, b) => a - b);
                if (uniqueH.length === 0) return 0;
                return uniqueH.reduce((prev, curr) => Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev);
            }, [crosshair?.rawH, points, savedColors]);

            const targetH = stableH;
            const filterFn = useCallback((p) => {
                if (p.C === 0) return true;

                if (p.isPin || p.isCustomAnchor || p.type === 'pin' || p.type === 'anchor') {
                    let hDiff = Math.abs(p.H - targetH);
                    hDiff = Math.min(hDiff, 360 - hDiff);
                    return hDiff <= 5;
                }

                const cStepForH = Math.max(1, Math.round(p.C / 0.02));
                const nH = 6 * cStepForH;
                const stepH = 360 / nH;
                const closestH = (Math.round(targetH / stepH) * stepH) % 360;
                
                if (Math.abs(p.H - closestH) > 0.1) return false;
                
                let hDiff = Math.abs(closestH - targetH);
                hDiff = Math.min(hDiff, 360 - hDiff);
                return hDiff <= 5;
            }, [targetH]);

            const swatchItems = useMemo(() => {
                if (viewMode !== 'swatches') return [];
                const res = [];
                points.filter(p => !p.isPin && filterFn(p)).forEach(p => {
                     const prefix = getNounPrefix(p.L, p.C);
                     const nounId = `${prefix}-${p.cStr}-${p.hStr}`;
                     res.push({
                          ...p,
                          type: 'grid',
                          displayName: `${adjectives[p.lStr]||''} ${names[nounId]||''}`.trim() || 'Unnamed',
                          hex: p.color
                     });
                });
                Object.values(savedColors).forEach(sc => {
                     if (filterFn(sc)) {
                          if (sc.type === 'anchor') {
                              res.push({ ...sc, displayName: `${sc.adjOverride || adjectives[sc.adjId] || ''} ${sc.nameOverride || names[sc.anchorId] || ''}`.trim() || sc.id, hex: sc.srgbHex || sc.color });
                          } else if (sc.type === 'pin') {
                              res.push({ ...sc, displayName: sc.id || 'Pin', hex: sc.srgbHex || sc.color }); 
                          }
                     }
                });
                return res;
            }, [points, savedColors, lockedNouns, lockedAdjectives, viewMode, names, adjectives, filterFn]);

            const finalSwatchItems = useMemo(() => {
                if (viewMode !== 'swatches') return [];
                return swatchItems.map(item => {
                    if (item.type === 'pin') {
                        const { displayAdj, displayName } = getInheritedPinNames(item, savedColors, names, adjectives);
                        return { ...item, displayName: `${displayAdj} ${displayName}`.trim() || item.id };
                    }
                    return item;
                });
            }, [swatchItems, viewMode, savedColors, names, adjectives]);

            const data = useMemo(() => {
                if (viewMode === 'swatches') return [];
                const filtered = points.filter(p => !p.isPin && filterFn(p));
                const filteredBurnt = Object.values(savedColors).filter(p => p.type === 'pin' && filterFn(p));
                const traces = [];
                traces.push({ type: 'scatter', mode: viewMode === 'bins' ? (showText ? 'text' : 'markers') : 'markers', x: filtered.map(p => p.C), y: filtered.map(p => p.L), text: filtered.map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; const adj = adjectives[p.lStr] || ''; const noun = names[nounId] || ''; const fullName = `${adj} ${noun}`.trim() || 'Unnamed'; const binText = adj && noun ? `<b>${adj}</b><br>${noun}` : `<b>${fullName}</b>`; return viewMode === 'bins' ? binText : `<b>${fullName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`; }), textposition: 'middle center', textfont: { size: 12, family: 'Inter, sans-serif', color: filtered.map(p => p.L > 0.55 ? '#010D00' : '#F2E8DF') }, hovertemplate: viewMode === 'bins' ? "<b>%{customdata[3]}</b><br>L: %{y:.3f} C: %{x:.3f}<extra></extra>" : "%{text}<extra></extra>", customdata: filtered.map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; const fullName = `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed'; return [p.L, p.C, p.H, fullName]; }), marker: { size: 10, color: filtered.map(p => p.color), opacity: viewMode === 'bins' ? (showText ? 0 : 0.3) : 0.8, line: { width: 0.5, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' } } });
                const gridLockedNodes = filtered.filter(p => !p.isCustomAnchor && lockedNouns[`${getNounPrefix(p.L, p.C)}-${p.cStr}-${p.hStr}`] && lockedAdjectives[p.lStr]).map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; return { ...p, displayName: `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed' }; });
                const customLockedNodes = Object.values(savedColors).filter(sc => sc.type === 'anchor' && filterFn(sc)).map(p => { const displayName = `${p.adjOverride || adjectives[p.adjId] || ''} ${p.nameOverride || names[p.anchorId] || ''}`.trim() || p.id || 'Custom Anchor'; return { ...p, displayName }; });
                const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
                const pinNodes = filteredBurnt.map(p => { const displayName = `${p.adjOverride || adjectives[p.adjId] || ''} ${p.nameOverride || names[p.anchorId] || ''}`.trim() || 'Unnamed Pin'; return { ...p, displayName }; });
                traces.push({ type: 'scatter', mode: 'markers', x: lockedNodes.map(p => p.C), y: lockedNodes.map(p => p.L), text: lockedNodes.map(p => `<b>[Lock] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`), hovertemplate: "%{text}<extra></extra>", customdata: lockedNodes.map(p => [p.L, p.C, p.H]), marker: { symbol: 'square', size: 10, color: lockedNodes.map(p => p.color), line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } } });
                traces.push({ type: 'scatter', mode: 'markers', x: pinNodes.map(p => p.C), y: pinNodes.map(p => p.L), text: pinNodes.map(p => `<b>[Pin] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`), hovertemplate: "%{text}<extra></extra>", customdata: pinNodes.map(p => [p.L, p.C, p.H]), marker: { symbol: 'x', size: 12, color: pinNodes.map(p => p.color), line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } } });
                traces.push({ type: 'scatter', mode: 'lines', x: crosshair?.snapTarget ? [crosshair.rawC, crosshair.snapTarget.C] : [], y: crosshair?.snapTarget ? [crosshair.rawL, crosshair.snapTarget.L] : [], line: { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', width: 2, dash: 'dot' }, hoverinfo: 'skip' });
                traces.push({ type: 'scatter', mode: 'markers', x: [crosshair?.rawC], y: [crosshair?.rawL], text: [`<b>Cursor</b><br>L: ${crosshair?.rawL.toFixed(3)} C: ${crosshair?.rawC.toFixed(3)} H: ${crosshair?.rawH.toFixed(1)}°`], hovertemplate: "%{text}<extra></extra>", marker: { symbol: 'cross', size: 12, color: isDark ? '#F2E8DF' : '#010D00', line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } }, hoverinfo: 'skip' });
                
                if (tetheringPinId && savedColors[tetheringPinId]) {
                    const p = savedColors[tetheringPinId];
                    traces.push({
                        type: 'scatter',
                        mode: 'lines',
                        x: [p.C, crosshair.rawC],
                        y: [p.L, crosshair.rawL],
                        line: { color: '#f59e0b', width: 2, dash: 'dash' },
                        hoverinfo: 'skip'
                    });
                }
                
                return traces;
            }, [points, crosshair, isDark, names, adjectives, savedColors, lockedNouns, lockedAdjectives, viewMode, showText, stableH, tetheringPinId]);
            const layout = useMemo(() => {
                const shapes = [{ type: 'line', x0: 0, x1: 0.3, y0: 0.5, y1: 0.5, line: { color: isDark ? '#F2E8DF' : '#2B4032', width: 1, dash: 'dot' } }];
                if (viewMode === 'bins') {
                    const targetH = stableH;
                    const filterFn = p => {
                        if (p.C === 0) return true;
                        const cStepForH = Math.max(1, Math.round(p.C / p.delta));
                        const nH = 6 * cStepForH;
                        const stepH = 360 / nH;
                        const closestH = Math.round(targetH / stepH) * stepH;
                        const h1 = closestH % 360;
                        const h2 = (closestH + 360) % 360;
                        return Math.abs(p.H - h1) < 0.1 || Math.abs(p.H - h2) < 0.1;
                    };
                    const filtered = points.filter(p => !p.isPin && filterFn(p));
                    if (filtered.length > 0) {
                        try {
                            const allVoronoiPoints = [...filtered];
                            const isMobile = window.innerWidth < 768;
                            const lStep = isMobile ? 0.05 : 0.01;
                            const boundaryPoints = [];
                            for (let l = 0; l <= 1.0; l += lStep) {
                                let low = 0, high = 0.4;
                                while (high - low > 0.001) {
                                    let mid = (low + high) / 2;
                                    if (new Color("oklch", [l, mid, targetH]).inGamut("srgb")) {
                                        low = mid;
                                    } else {
                                        high = mid;
                                    }
                                }
                                const maxC = Math.min(low, 0.3);
                                boundaryPoints.push([maxC, l]);
                                allVoronoiPoints.push({ C: maxC + 0.005, L: l, isDummy: true });
                                allVoronoiPoints.push({ C: maxC + 0.02, L: l, isDummy: true });
                            }
                            const cStep = isMobile ? 0.05 : 0.01;
                            for (let c = 0; c <= 0.35; c += cStep) {
                                allVoronoiPoints.push({ C: c, L: -0.01, isDummy: true });
                                allVoronoiPoints.push({ C: c, L: 1.01, isDummy: true });
                            }
                            
                            const scaleX = 1;
                            const scaleY = 0.3;
                            const delaunay = d3.Delaunay.from(allVoronoiPoints.map(p => [p.C * scaleX, p.L * scaleY]));
                            const voronoi = delaunay.voronoi([-0.1 * scaleX, -0.1 * scaleY, 0.4 * scaleX, 1.15 * scaleY]);
                            allVoronoiPoints.forEach((p, i) => {
                                if (p.isDummy) return;
                                const path = voronoi.renderCell(i);
                                if (path) {
                                    const pts = [];
                                    path.replace(/([ML])([^,]+),([^MLZ]+)/g, (match, cmd, x, y) => {
                                        pts.push([parseFloat(x), parseFloat(y)]);
                                        return match;
                                    });
                                    if (pts.length > 2) {
                                        const unscaledPts = pts.map(pt => [pt[0] / scaleX, pt[1] / scaleY]);
                                        const unscaledPath = 'M' + unscaledPts.map(pt => pt.join(',')).join('L') + 'Z';
                                        shapes.push({
                                            type: 'path',
                                            path: unscaledPath,
                                            fillcolor: p.color,
                                            line: { width: 1.5, color: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.4)' },
                                            layer: 'below'
                                        });
                                    }
                                }
                            });
                            const outerSquare = [[-0.1, -0.1], [0.4, -0.1], [0.4, 1.1], [-0.1, 1.1], [-0.1, -0.1]];
                            const innerBoundary = [[0, 1.1], ...boundaryPoints.reverse(), [0, -0.1]];
                            const maskPath = 'M' + outerSquare.map(p => p.join(',')).join('L') + 'Z ' + 
                                             'M' + innerBoundary.map(p => p.join(',')).join('L') + 'Z';
                            shapes.push({
                                type: 'path',
                                path: maskPath,
                                fillcolor: isDark ? '#052212' : '#F2E8DF',
                                line: { width: 0 },
                                layer: 'below'
                            });
                        } catch (e) {
                            console.error("Voronoi error:", e);
                        }
                    }
                }
                return { uirevision: 'true', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', dragmode: 'pan', xaxis: { title: 'Chroma', range: [0, 0.3], showgrid: viewMode !== 'bins', zeroline: viewMode !== 'bins', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'} }, yaxis: { title: 'Lightness', range: [0, 1.05], showgrid: viewMode !== 'bins', zeroline: viewMode !== 'bins', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'} }, margin: { l: 50, r: 20, b: 50, t: 20 }, shapes, showlegend: false };
            }, [isDark, viewMode, points, stableH]);
            const handleBgClick = (cValue, lValue) => { handlePointClick([Math.max(0, Math.min(1.0, lValue)), Math.max(0, Math.min(0.3, cValue)), crosshair?.rawH]); };
            if (viewMode === 'swatches') {
                return <ViewportSwatches items={finalSwatchItems} layout={swatchLayout} swatchZoom={swatchZoom} dim1="L" dim2="C" dim1Labels={v => `L: ${Number(v).toFixed(3)}`} dim2Labels={v => `C: ${Number(v).toFixed(2)}`} handlePointClick={handlePointClick} viewportFilter={viewportFilter} viewportSearchQuery={viewportSearchQuery} viewportTagFilter={viewportTagFilter} crosshair={crosshair} />;
            }
            return <PlotlyChart data={data} layout={layout} onPointClick={handlePointClick} onBgClick={handleBgClick} onRelayout={handleRelayout} theme={theme} />;
        };

        const ViewChromaRings = ({ points, crosshair, handlePointClick, theme, names, adjectives, savedColors = {}, lockedNouns, lockedAdjectives, viewMode, tetheringPinId, swatchLayout, swatchZoom, viewportFilter, viewportSearchQuery, viewportTagFilter }) => {
            const isDark = theme === 'dark';
            const [showText, setShowText] = useState(false);
            const handleRelayout = (e) => { if (e['xaxis.range[0]'] !== undefined && e['xaxis.range[1]'] !== undefined) { setShowText((e['xaxis.range[1]'] - e['xaxis.range[0]']) < 120); } else if (e['xaxis.autorange']) { setShowText(false); } };
            const stableC = useMemo(() => {
                const allPoints = [...(points || [])];
                Object.values(savedColors).forEach(sc => {
                    if (sc.type === 'pin') allPoints.push(sc);
                });
                if (allPoints.length === 0) return 0;
                const target = crosshair?.rawC || 0;
                const uniqueC = [...new Set(allPoints.map(p => p.C))].sort((a, b) => a - b);
                if (uniqueC.length === 0) return 0;
                return uniqueC.reduce((prev, curr) => Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev);
            }, [crosshair?.rawC, points, savedColors]);

            const filterFn = useCallback((p) => {
                const targetC = stableC;
                if (p.C === 0 && targetC === 0) return true;
                
                if (p.isPin || p.isCustomAnchor || p.type === 'pin' || p.type === 'anchor') {
                    return Math.abs(p.C - targetC) <= 0.02;
                }
                
                const gridC = Math.round(targetC / 0.02) * 0.02;
                if (Math.abs(p.C - gridC) > 0.001) return false;
                
                return Math.abs(gridC - targetC) <= 0.02;
            }, [stableC]);

            const swatchItems = useMemo(() => {
                if (viewMode !== 'swatches') return [];
                const res = [];
                const targetC = stableC;
                points.filter(p => !p.isPin && filterFn(p)).forEach(p => {
                     const prefix = getNounPrefix(p.L, p.C);
                     const nounId = `${prefix}-${p.cStr}-${p.hStr}`;
                     res.push({ ...p, type: 'grid', displayName: `${adjectives[p.lStr]||''} ${names[nounId]||''}`.trim() || 'Unnamed', hex: p.color });
                });
                Object.values(savedColors).forEach(sc => {
                     if (filterFn(sc)) {
                          if (sc.type === 'anchor') {
                              res.push({ ...sc, displayName: `${sc.adjOverride || adjectives[sc.adjId] || ''} ${sc.nameOverride || names[sc.anchorId] || ''}`.trim() || sc.id, hex: sc.srgbHex || sc.color });
                          } else if (sc.type === 'pin') {
                              res.push({ ...sc, displayName: sc.id || 'Pin', hex: sc.srgbHex || sc.color }); 
                          }
                     }
                });
                return res;
            }, [points, savedColors, lockedNouns, lockedAdjectives, viewMode, names, adjectives, stableC]);

            const finalSwatchItems = useMemo(() => {
                if (viewMode !== 'swatches') return [];
                return swatchItems.map(item => {
                    if (item.type === 'pin') {
                        const { displayAdj, displayName } = getInheritedPinNames(item, savedColors, names, adjectives);
                        return { ...item, displayName: `${displayAdj} ${displayName}`.trim() || item.id };
                    }
                    return item;
                });
            }, [swatchItems, viewMode, savedColors, names, adjectives]);

            const data = useMemo(() => {
                if (viewMode === 'swatches') return [];
                const filtered = points.filter(p => !p.isPin && filterFn(p));
                const filteredBurnt = Object.values(savedColors).filter(p => p.type === 'pin' && filterFn(p));
                const traces = [];
                traces.push({ type: 'scatter', mode: viewMode === 'bins' ? (showText ? 'text' : 'markers') : 'markers', x: filtered.map(p => p.H), y: filtered.map(p => p.L), text: filtered.map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; const adj = adjectives[p.lStr] || ''; const noun = names[nounId] || ''; const fullName = `${adj} ${noun}`.trim() || 'Unnamed'; const binText = adj && noun ? `<b>${adj}</b><br>${noun}` : `<b>${fullName}</b>`; return viewMode === 'bins' ? binText : `<b>${fullName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`; }), textposition: 'middle center', textfont: { size: 12, family: 'Inter, sans-serif', color: filtered.map(p => p.L > 0.55 ? '#010D00' : '#F2E8DF') }, hovertemplate: viewMode === 'bins' ? "<b>%{customdata[3]}</b><br>L: %{y:.3f} H: %{x:.1f}°<extra></extra>" : "%{text}<extra></extra>", customdata: filtered.map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; const fullName = `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed'; return [p.L, p.C, p.H, fullName]; }), marker: { size: 10, color: filtered.map(p => p.color), opacity: viewMode === 'bins' ? (showText ? 0 : 0.3) : 0.8, line: { width: 0.5, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' } } });
                const gridLockedNodes = filtered.filter(p => !p.isCustomAnchor && lockedNouns[`${getNounPrefix(p.L, p.C)}-${p.cStr}-${p.hStr}`] && lockedAdjectives[p.lStr]).map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; return { ...p, displayName: `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed' }; });
                const customLockedNodes = Object.values(savedColors).filter(sc => sc.type === 'anchor' && filterFn(sc)).map(p => { const displayName = `${p.adjOverride || adjectives[p.adjId] || ''} ${p.nameOverride || names[p.anchorId] || ''}`.trim() || p.id || 'Custom Anchor'; return { ...p, displayName }; });
                const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
                const pinNodes = filteredBurnt.map(p => { const displayName = `${p.adjOverride || adjectives[p.adjId] || ''} ${p.nameOverride || names[p.anchorId] || ''}`.trim() || 'Unnamed Pin'; return { ...p, displayName }; });
                traces.push({ type: 'scatter', mode: 'markers', x: lockedNodes.map(p => p.H), y: lockedNodes.map(p => p.L), text: lockedNodes.map(p => `<b>[Lock] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`), hovertemplate: "%{text}<extra></extra>", customdata: lockedNodes.map(p => [p.L, p.C, p.H]), marker: { symbol: 'square', size: 10, color: lockedNodes.map(p => p.color), line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } } });
                traces.push({ type: 'scatter', mode: 'markers', x: pinNodes.map(p => p.H), y: pinNodes.map(p => p.L), text: pinNodes.map(p => `<b>[Pin] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`), hovertemplate: "%{text}<extra></extra>", customdata: pinNodes.map(p => [p.L, p.C, p.H]), marker: { symbol: 'x', size: 12, color: pinNodes.map(p => p.color), line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } } });
                traces.push({ type: 'scatter', mode: 'lines', x: crosshair?.snapTarget ? [crosshair.rawH, crosshair.snapTarget.H] : [], y: crosshair?.snapTarget ? [crosshair.rawL, crosshair.snapTarget.L] : [], line: { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', width: 2, dash: 'dot' }, hoverinfo: 'skip' });
                traces.push({ type: 'scatter', mode: 'markers', x: [crosshair?.rawH], y: [crosshair?.rawL], text: [`<b>Cursor</b><br>L: ${crosshair?.rawL.toFixed(3)} C: ${crosshair?.rawC.toFixed(3)} H: ${crosshair?.rawH.toFixed(1)}°`], hovertemplate: "%{text}<extra></extra>", marker: { symbol: 'cross', size: 12, color: isDark ? '#F2E8DF' : '#010D00', line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } }, hoverinfo: 'skip' });
                
                if (tetheringPinId && savedColors[tetheringPinId]) {
                    const p = savedColors[tetheringPinId];
                    traces.push({
                        type: 'scatter',
                        mode: 'lines',
                        x: [p.H, crosshair.rawH],
                        y: [p.L, crosshair.rawL],
                        line: { color: '#f59e0b', width: 2, dash: 'dash' },
                        hoverinfo: 'none'
                    });
                }
                
                return traces;
            }, [points, crosshair, isDark, names, adjectives, savedColors, lockedNouns, lockedAdjectives, viewMode, showText, stableC, tetheringPinId]);
            const layout = useMemo(() => {
                const shapes = [{ type: 'line', x0: 0, x1: 360, y0: 0.5, y1: 0.5, line: { color: isDark ? '#F2E8DF' : '#2B4032', width: 1, dash: 'dot' } }];
                if (viewMode === 'bins') {
                    const gridC = Math.round(stableC / 0.02) * 0.02;
                    const filtered = points.filter(p => !p.isPin && p.C > 0 && Math.abs(p.C - gridC) <= 0.001);
                    if (filtered.length > 0) {
                        try {
                            const voronoiPoints = filtered.filter(p => p.C > 0);
                            if (voronoiPoints.length > 0) {
                                const allVoronoiPoints = [...voronoiPoints];
                                const isMobile = window.innerWidth < 768;
                                const lStep = isMobile ? 0.04 : 0.02;
                                const hStep = isMobile ? 10 : 5;
                                for (let l = -0.05; l <= 1.05; l += lStep) {
                                    for (let h = 0; h < 360; h += hStep) {
                                        if (l < 0 || l > 1) {
                                            allVoronoiPoints.push({ H: h, L: l, isDummy: true });
                                            continue;
                                        }
                                        const cColor = new Color("oklch", [l, gridC, h]);
                                        if (!cColor.inGamut("srgb")) {
                                            allVoronoiPoints.push({ H: h, L: l, isDummy: true });
                                        }
                                    }
                                }
                                const scaleX = 1;
                                const scaleY = 360;
                                const paddedVoronoi = [];
                                allVoronoiPoints.forEach(p => {
                                    paddedVoronoi.push({ ...p, H: p.H - 360 });
                                    paddedVoronoi.push(p);
                                    paddedVoronoi.push({ ...p, H: p.H + 360 });
                                });
                                const delaunay = d3.Delaunay.from(paddedVoronoi.map(p => [p.H * scaleX, p.L * scaleY]));
                                const voronoi = delaunay.voronoi([-360 * scaleX, -0.1 * scaleY, 720 * scaleX, 1.15 * scaleY]);
                                allVoronoiPoints.forEach((p, i) => {
                                    if (p.isDummy) return;
                                    const path = voronoi.renderCell(3 * i + 1);
                                    if (path) {
                                        const pts = [];
                                    path.replace(/([ML])([^,]+),([^MLZ]+)/g, (match, cmd, x, y) => {
                                        pts.push([parseFloat(x), parseFloat(y)]);
                                        return match;
                                    });
                                    if (pts.length > 2) {
                                        const unscaledPts = pts.map(pt => [pt[0] / scaleX, pt[1] / scaleY]);
                                        const unscaledPath = 'M' + unscaledPts.map(pt => pt.join(',')).join('L') + 'Z';
                                        shapes.push({
                                            type: 'path',
                                            path: unscaledPath,
                                            fillcolor: p.color,
                                            line: { width: 1.5, color: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.4)' },
                                            layer: 'below'
                                        });
                                    }
                                    }
                                });
                            }
                        } catch (e) {
                            console.error("Voronoi error:", e);
                        }
                    }
                }
                return { uirevision: 'true', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', dragmode: 'pan', xaxis: { title: 'Hue Angle (°)', range: [0, 360], showgrid: viewMode !== 'bins', zeroline: viewMode !== 'bins', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickmode: 'linear', dtick: 30 }, yaxis: { title: 'Lightness', range: [0, 1.05], showgrid: viewMode !== 'bins', zeroline: viewMode !== 'bins', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'} }, margin: { l: 50, r: 20, b: 50, t: 20 }, shapes, showlegend: false };
            }, [isDark, viewMode, points, stableC]);
            const handleBgClick = (hValue, lValue) => { handlePointClick([Math.max(0, Math.min(1.0, lValue)), crosshair?.rawC || 0, Math.max(0, Math.min(360, hValue))]); };
            if (viewMode === 'swatches') {
                return <ViewportSwatches items={finalSwatchItems} layout={swatchLayout} swatchZoom={swatchZoom} dim1="L" dim2="H" dim1Labels={v => `L: ${Number(v).toFixed(3)}`} dim2Labels={v => `H: ${Number(v).toFixed(0)}°`} handlePointClick={handlePointClick} viewportFilter={viewportFilter} viewportSearchQuery={viewportSearchQuery} viewportTagFilter={viewportTagFilter} crosshair={crosshair} />;
            }
            return <PlotlyChart data={data} layout={layout} onPointClick={handlePointClick} onBgClick={handleBgClick} onRelayout={handleRelayout} theme={theme} />;
        };

        function getInheritedPinNames(sc, savedColors, names, adjectives) {
            let baseAdj = sc.adjOverride || adjectives[sc.adjId];
            let baseName = sc.nameOverride || names[sc.anchorId];
            let source = 'anchor';
            let sourceId = sc.anchorId;

            if (!sc.nameOverride || !sc.adjOverride) {
                const nc = savedColors[sc.anchorId];
                if (nc && nc.type === 'nounColumn') {
                    source = 'nounColumn';
                    sourceId = nc.id;
                    if (!sc.nameOverride) baseName = nc.nameOverride || names[nc.id];
                    
                    if (!sc.adjOverride) {
                         const lStr = getLStr(sc.L);
                         baseAdj = adjectives[lStr] || `L ${nc.minL.toFixed(2)} - ${nc.maxL.toFixed(2)}`;
                    }

                } else if (nc && nc.type === 'anchor') {
                    if (!sc.nameOverride) baseName = nc.nameOverride || names[nc.anchorId];
                    if (!sc.adjOverride) baseAdj = nc.adjOverride || adjectives[nc.adjId];
                }
            }

            let inheritedAdj = baseAdj;
            let inheritedName = baseName;
            
            if (!inheritedName || !inheritedAdj) {
                let minDist = Infinity;
                let bestAnchor = null;
                Object.values(savedColors).forEach(other => {
                    if (other.type === 'anchor') {
                        const d = Math.pow(sc.L - other.L, 2) + Math.pow(sc.a - other.a, 2) + Math.pow(sc.b - other.b, 2);
                        if (d < minDist) { minDist = d; bestAnchor = other; }
                    } else if (other.type === 'nounColumn') {
                        const d = Math.pow(sc.a - other.a, 2) + Math.pow(sc.b - other.b, 2);
                        if (d < minDist && sc.L >= other.minL && sc.L <= other.maxL) {
                            minDist = d; bestAnchor = other;
                        }
                    }
                });
                if (bestAnchor && minDist < 0.01) {
                    source = bestAnchor.type === 'nounColumn' ? 'nounColumn' : 'anchor';
                    sourceId = bestAnchor.id;
                    if (bestAnchor.type === 'nounColumn') {
                        if (!inheritedAdj) {
                            const lStr = getLStr(sc.L);
                            inheritedAdj = adjectives[lStr] || `L ${bestAnchor.minL.toFixed(2)} - ${bestAnchor.maxL.toFixed(2)}`;
                        }
                        if (!inheritedName) inheritedName = bestAnchor.nameOverride || names[bestAnchor.id];
                    } else {
                        if (!inheritedAdj) inheritedAdj = bestAnchor.adjOverride || adjectives[bestAnchor.id] || adjectives[bestAnchor.adjId];
                        if (!inheritedName) inheritedName = bestAnchor.nameOverride || names[bestAnchor.id] || names[bestAnchor.anchorId];
                    }
                }
            }

            // Fallbacks to ensure the swatch isn't empty and displays the correct grid label when no custom anchor matches
            if (!inheritedAdj) {
                inheritedAdj = adjectives[sc.adjId] || `L=${sc.L?.toFixed(2) || '?'}`;
            }
            if (!inheritedName) {
                inheritedName = names[sc.anchorId] || 'Unnamed Noun';
            }

            return {
                displayAdj: (inheritedAdj).trim(),
                displayName: (inheritedName).trim(),
                source: source,
                sourceId: sourceId
            };
        };

        const ViewportSwatches = ({ items, layout, handlePointClick, dim1, dim2, dim1Labels, dim2Labels, viewportFilter, viewportSearchQuery, viewportTagFilter, swatchZoom, crosshair }) => {
            const [sortBy, setSortBy] = useState(dim1);
            const [sortAsc, setSortAsc] = useState(true);
            const baseMatrixSize = 48;
            const baseListSize = 48;
            const baseGallerySize = 72;

            const activeHex = useMemo(() => {
                if (!crosshair || items.length === 0) return null;
                let minDist = Infinity;
                let bestHex = null;
                items.forEach(item => {
                    let d1 = 0, d2 = 0;
                    if (dim1 === 'L') d1 = (item.L - crosshair.rawL);
                    else if (dim1 === 'C') d1 = (item.C - crosshair.rawC) * 3;
                    else if (dim1 === 'H') { d1 = Math.abs(item.H - crosshair.rawH); d1 = Math.min(d1, 360 - d1) / 360; }
                    
                    if (dim2 === 'L') d2 = (item.L - crosshair.rawL);
                    else if (dim2 === 'C') d2 = (item.C - crosshair.rawC) * 3;
                    else if (dim2 === 'H') { d2 = Math.abs(item.H - crosshair.rawH); d2 = Math.min(d2, 360 - d2) / 360; }
                    
                    let dist = d1*d1 + d2*d2;
                    if (dist < minDist) {
                        minDist = dist;
                        bestHex = item.hex;
                    }
                });
                return minDist < 0.05 ? bestHex : null;
            }, [items, crosshair, dim1, dim2]);

            useEffect(() => {
                if (activeHex) {
                    const el = document.getElementById(`swatch-${activeHex.replace('#', '')}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            }, [activeHex]);

            const sortedItems = useMemo(() => {
                let filtered = [...items];
                if (viewportFilter === 'pins') filtered = filtered.filter(x => x.type === 'pin');
                if (viewportFilter === 'anchors') filtered = filtered.filter(x => x.type === 'anchor' || x.type === 'grid');
                if (viewportSearchQuery) {
                    const q = viewportSearchQuery.toLowerCase();
                    filtered = filtered.filter(x => 
                        (x.displayName && x.displayName.toLowerCase().includes(q)) || 
                        (x.erpCode && x.erpCode.toLowerCase().includes(q)) ||
                        (x.note && x.note.toLowerCase().includes(q))
                    );
                }
                if (viewportTagFilter) {
                    const q = viewportTagFilter.toLowerCase();
                    filtered = filtered.filter(x => x.tags && x.tags.some(t => t.toLowerCase().includes(q)));
                }

                return filtered.sort((a, b) => {
                    let valA = a[sortBy];
                    let valB = b[sortBy];
                    if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    return sortAsc ? valA - valB : valB - valA;
                }).map(item => ({
                    ...item,
                    _inGamut: item.inSrgb !== undefined ? item.inSrgb : new Color("oklch", [item.L, item.C, item.H]).inGamut("srgb")
                }));
            }, [items, sortBy, sortAsc, viewportFilter, viewportSearchQuery]);

            if (layout === 'matrix') {
                const quantize = (v) => Math.round(v * 1000) / 1000;
                
                const d1ValsUniq = new Set();
                const d2ValsUniq = new Set();
                
                sortedItems.forEach(i => {
                    d1ValsUniq.add(quantize(i[dim1]));
                    d2ValsUniq.add(quantize(i[dim2]));
                });
                
                const d1Vals = [...d1ValsUniq].sort((a,b)=>a-b);
                const d2Vals = [...d2ValsUniq].sort((a,b)=>a-b);
                
                return (
                    <div className="absolute inset-0 overflow-auto custom-scrollbar p-4 bg-slate-50/50 dark:bg-neutral-900/50">
                        <table className="w-full border-collapse border-spacing-0">
                            <thead>
                                <tr>
                                    <td className="p-1 min-w-[50px] sticky left-0 top-0 z-50 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur border-b border-slate-200 dark:border-neutral-800 relative"></td>
                                    {d2Vals.map(val => <td key={val} className="p-1 text-center text-[9px] font-mono text-slate-400 dark:text-neutral-500 whitespace-nowrap sticky top-0 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur z-40 border-b border-slate-200 dark:border-neutral-800">{dim2Labels(val)}</td>)}
                                </tr>
                            </thead>
                            <tbody>
                                {d1Vals.map(v1 => (
                                    <tr key={v1}>
                                        <td className="p-1 text-right text-[9px] font-mono text-slate-400 dark:text-neutral-500 whitespace-nowrap sticky left-0 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur z-40 relative border-r border-slate-200 dark:border-neutral-800">
                                            {dim1Labels(v1)}
                                        </td>
                                        {d2Vals.map(v2 => {
                                            const cellItems = sortedItems.filter(i => Math.abs(quantize(i[dim1]) - v1) < 0.001 && Math.abs(quantize(i[dim2]) - v2) < 0.001);
                                            return (
                                                <td key={v2} className="p-1 text-center align-middle hover:bg-slate-100 dark:hover:bg-neutral-800/50 rounded transition-colors relative" style={{ minWidth: `${(baseMatrixSize + 12) * swatchZoom}px`, height: `${(baseMatrixSize + 12) * swatchZoom}px` }}>
                                            <div className="flex flex-wrap items-center justify-center gap-1 w-full h-full p-0.5">
                                            {cellItems.map((item, idx) => (
                                                <div key={idx} id={`swatch-${item.hex.replace('#','')}`} onClick={() => handlePointClick([item.L, item.C, item.H], item.spectral)} className={`rounded cursor-pointer hover:ring-2 hover:ring-sky-500 transition-all relative ${activeHex === item.hex ? 'ring-4 ring-sky-500 z-20 scale-110' : 'z-10'}`} style={{ backgroundColor: item.hex, width: `${baseMatrixSize * swatchZoom}px`, height: `${baseMatrixSize * swatchZoom}px` }} title={`${item.displayName}\n${item.erpCode}`}>
                                                    {!item._inGamut && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${6 * swatchZoom}px)` }}></div>}
                                                    {item.type === 'pin' && <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 border border-white dark:border-neutral-900 shadow-sm" style={{ width: `${8 * swatchZoom}px`, height: `${8 * swatchZoom}px` }}></div>}
                                                    {swatchZoom >= 1.0 && (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-[2px] leading-none space-y-0" style={{ color: item.L > 0.65 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)' }}>
                                                            {item.displayName.split(' ').map((word, wIdx) => (
                                                                <span key={wIdx} className="text-center font-bold uppercase tracking-[0.05em] truncate w-full" style={{ fontSize: `${Math.max(4, 5.5 * swatchZoom)}px` }}>
                                                                    {word}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            </div>
                                        </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedItems.length === 0 && <div className="text-center text-slate-400 text-xs w-full p-8 italic">No saved colors or pins found in this slice.</div>}
                    </div>
                );
            }
            
            if (layout === 'table') {
                return (
                    <div className="absolute inset-0 overflow-auto custom-scrollbar p-4 bg-slate-50/50 dark:bg-neutral-900/50">
                        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-700 overflow-hidden min-w-max">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-slate-50 dark:bg-neutral-900/50 font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-3 w-12 text-center">Color</th>
                                        <th className="p-3 cursor-pointer hover:text-sky-500" onClick={() => { setSortBy('name'); setSortAsc(!sortAsc); }}>Name {sortBy==='name'&&<Icon name={sortAsc?'chevron-up':'chevron-down'} className="w-3 h-3 inline"/>}</th>
                                        <th className="p-3 w-20 cursor-pointer hover:text-sky-500" onClick={() => { setSortBy('brand'); setSortAsc(!sortAsc); }}>Brand {sortBy==='brand'&&<Icon name={sortAsc?'chevron-up':'chevron-down'} className="w-3 h-3 inline"/>}</th>
                                        <th className="p-3 w-40">Web Link</th>
                                        <th className="p-3">Tags</th>
                                        <th className="p-3 w-16 text-right text-emerald-600 cursor-pointer hover:text-sky-500" onClick={() => { setSortBy('_d'); setSortAsc(!sortAsc); }}>ΔEok {sortBy==='_d'&&<Icon name={sortAsc?'chevron-up':'chevron-down'} className="w-3 h-3 inline"/>}</th>
                                        <th className="p-3 w-16 text-right cursor-pointer hover:text-sky-500" onClick={() => { setSortBy('L'); setSortAsc(!sortAsc); }}>L {sortBy==='L'&&<Icon name={sortAsc?'chevron-up':'chevron-down'} className="w-3 h-3 inline"/>}</th>
                                        <th className="p-3 w-16 text-right cursor-pointer hover:text-sky-500" onClick={() => { setSortBy('C'); setSortAsc(!sortAsc); }}>C {sortBy==='C'&&<Icon name={sortAsc?'chevron-up':'chevron-down'} className="w-3 h-3 inline"/>}</th>
                                        <th className="p-3 w-16 text-right cursor-pointer hover:text-sky-500" onClick={() => { setSortBy('H'); setSortAsc(!sortAsc); }}>H {sortBy==='H'&&<Icon name={sortAsc?'chevron-up':'chevron-down'} className="w-3 h-3 inline"/>}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/50">
                                    {sortedItems.map((item, i) => (
                                        <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-neutral-800/50 group cursor-pointer transition-colors ${activeHex === item.hex ? 'bg-sky-50 dark:bg-sky-900/20' : ''}`} onClick={() => handlePointClick([item.L, item.C, item.H], item.spectral)}>
                                            <td className="p-1 px-3">
                                                <div className="w-8 h-8 rounded relative shadow-sm" style={{backgroundColor: item.hex, backgroundImage: item.note?.startsWith('http') ? `url(${item.note})` : 'none', backgroundSize: 'cover' }}>
                                                    {item.hasSpectral && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500"></div>}
                                                    {item.type === 'pin' && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white dark:border-neutral-900 shadow-sm"></div>}
                                                </div>
                                            </td>
                                            <td className="p-2 font-medium">{item.displayName}</td>
                                            <td className="p-2 text-slate-500 font-mono text-[9px]">{item.brand || (item.type==='pin'?'pinned':'')}</td>
                                            <td className="p-2 max-w-[120px] truncate text-[9px] font-mono">
                                                {item.erpCode?.startsWith('http') ? <a href={item.erpCode} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline flex items-center gap-1" onClick={e=>e.stopPropagation()}><Icon name="external-link" className="w-3 h-3" /> Link</a> : item.erpCode}
                                            </td>
                                            <td className="p-2">
                                                {item.tags && item.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.tags.map(t => <span key={t} className="bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider">{t}</span>)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-2 text-right font-mono text-emerald-600 font-bold">{item._d !== undefined ? item._d.toFixed(2) : '-'}</td>
                                            <td className="p-2 text-right font-mono text-slate-500">{item.L.toFixed(3)}</td>
                                            <td className="p-2 text-right font-mono text-slate-500">{item.C.toFixed(3)}</td>
                                            <td className="p-2 text-right font-mono text-slate-500">{item.H.toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {items.length === 0 && <div className="text-center text-slate-400 text-xs w-full p-8 italic">No saved colors or pins found in this slice.</div>}
                    </div>
                );
            }

            // gallery
            return (
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-neutral-900/50 col-span-full">
                    <div className="flex items-center gap-2 mb-6 sticky top-0 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur z-10 p-2 rounded-lg border border-slate-200/50 dark:border-neutral-800/50 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 px-2">SORT BY:</span>
                        <button onClick={() => { setSortBy(dim1); setSortAsc(!sortAsc); }} className="text-[9px] font-bold uppercase text-slate-500 dark:text-neutral-400 hover:text-sky-600 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded flex items-center gap-1.5 transition-colors shadow-sm">{dim1} {sortBy === dim1 && <Icon name={sortAsc ? 'chevron-up' : 'chevron-down'} className="w-3 h-3" />}</button>
                        <button onClick={() => { setSortBy(dim2); setSortAsc(!sortAsc); }} className="text-[9px] font-bold uppercase text-slate-500 dark:text-neutral-400 hover:text-sky-600 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded flex items-center gap-1.5 transition-colors shadow-sm">{dim2} {sortBy === dim2 && <Icon name={sortAsc ? 'chevron-up' : 'chevron-down'} className="w-3 h-3" />}</button>
                    </div>
                    <div 
                        className="flex flex-wrap gap-4 md:gap-6 pb-8"
                    >
                        {sortedItems.map((item, i) => (
                            <div key={i} id={`swatch-${item.hex.replace('#','')}`} onClick={() => handlePointClick([item.L, item.C, item.H], item.spectral)} className={`flex flex-col gap-2 group cursor-pointer transition-all items-center`} style={{ width: `${Math.max(48, baseMatrixSize * swatchZoom)}px` }}>
                                <div className={`aspect-square rounded-2xl relative overflow-hidden transition-all group-hover:scale-[1.02] group-hover:shadow-md ${activeHex === item.hex ? 'ring-4 ring-sky-500' : ''}`} style={{ backgroundColor: item.hex, backgroundImage: item.note?.startsWith('http') ? `url(${item.note})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', width: '100%' }}>
                                    {!item._inGamut && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)' }}></div>}
                                    {item.type === 'pin' && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 border border-white dark:border-neutral-800 z-20"></div>}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-1 leading-none space-y-0.5 z-10" style={{ backgroundColor: item.note?.startsWith('http') ? 'rgba(0,0,0,0.3)' : 'transparent', color: item.note?.startsWith('http') ? 'white' : (item.L > 0.65 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)') }}>
                                        {item.displayName.split(' ').map((word, wIdx) => (
                                            <span key={wIdx} className="text-center font-bold uppercase tracking-[0.05em] truncate w-full px-0.5 drop-shadow-sm" style={{ fontSize: `${Math.max(4, 5.5 * swatchZoom)}px` }}>
                                                {word}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col items-center text-center px-0.5 pb-2 w-full">
                                    <span style={{ fontSize: `${Math.max(5, 6 * swatchZoom)}px` }} className="w-full font-mono text-slate-500 dark:text-neutral-400 truncate mt-0.5 group-hover:text-slate-800 dark:group-hover:text-neutral-200 transition-colors" title={item.erpCode}>
                                        {item.erpCode?.startsWith('http') ? (
                                            <a href={item.erpCode} target="_blank" rel="noopener noreferrer" className="hover:text-sky-500 flex items-center justify-center gap-1 drop-shadow-sm" onClick={(e) => e.stopPropagation()}>
                                                <Icon name="external-link" className="w-2.5 h-2.5" /> Web Reference
                                            </a>
                                        ) : item.erpCode}
                                    </span>
                                    {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap justify-center gap-1 w-full" style={{ marginTop: `${Math.max(1, 2 * swatchZoom)}px` }}>
                                            {item.tags.slice(0, 2).map(t => <span key={t} style={{ fontSize: `${Math.max(4, 5 * swatchZoom)}px` }} className="bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 px-0.5 py-[1px] rounded-[3px] font-bold uppercase tracking-wider truncate max-w-full">{t}</span>)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {items.length === 0 && <div className="text-center text-slate-400 text-xs w-full p-8 italic">No saved colors or pins found in this slice.</div>}
                </div>
            );
        };

        const ViewTopDown = ({ points, baseAnchors, crosshair, handlePointClick, theme, names, adjectives, savedColors = {}, lockedNouns, lockedAdjectives, viewMode, viewportFilter, tetheringPinId, swatchLayout, swatchZoom, viewportSearchQuery, viewportTagFilter }) => {
            const isDark = theme === 'dark';
            const [showText, setShowText] = useState(false);
            const handleRelayout = (e) => { if (e['xaxis.range[0]'] !== undefined && e['xaxis.range[1]'] !== undefined) { setShowText((e['xaxis.range[1]'] - e['xaxis.range[0]']) < 0.25); } else if (e['xaxis.autorange']) { setShowText(false); } };
            const stableL = useMemo(() => {
                const allPoints = [...(points || [])];
                Object.values(savedColors).forEach(sc => {
                    if (sc.type === 'pin') allPoints.push(sc);
                });
                if (allPoints.length === 0) return 0;
                const target = crosshair?.rawL || 0;
                const uniqueL = [...new Set(allPoints.map(p => p.L))].sort((a, b) => a - b);
                if (uniqueL.length === 0) return 0;
                return uniqueL.reduce((prev, curr) => Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev);
            }, [crosshair?.rawL, points, savedColors]);

            const filterFn = useCallback((p) => {
                const targetL = crosshair?.rawL || 0;
                if (p.isPin || p.isCustomAnchor || p.type === 'pin' || p.type === 'anchor') {
                    return Math.abs(p.L - targetL) <= 0.02;
                }
                const gridL = Math.round(targetL / 0.02) * 0.02;
                if (Math.abs(p.L - gridL) > 0.001) return false;
                
                return Math.abs(gridL - targetL) <= 0.02;
            }, [crosshair]);

            const validAnchors = useMemo(() => { 
                if (!crosshair) return []; 
                return baseAnchors.map(p => { 
                    const targetL = (p.L !== undefined && p.L !== null) ? p.L : crosshair.rawL;
                    const c = new Color("oklch", [targetL, p.C, p.H]); 
                    const isSpecificAnchor = (Math.abs(p.C - 0.04) < 0.001 && Math.abs(p.H - 90) < 0.1) || (Math.abs(p.C - 0.12) < 0.001 && Math.abs(p.H - 90) < 0.1); 
                    if (c.inGamut("srgb") || p.C === 0 || isSpecificAnchor) { 
                        return { ...p, L: targetL, color: c.clone().toGamut({space: "srgb"}).toString({format: "hex"}), inSrgb: true, isValid: true }; 
                    } 
                    return { isValid: false }; 
                }).filter(p => p.isValid && !p.isPin); 
            }, [baseAnchors, crosshair?.rawL, viewportFilter]);
            const stableAnchors = useMemo(() => { 
                if (!crosshair) return []; 
                return baseAnchors.map(p => { 
                    const c = new Color("oklch", [stableL, p.C, p.H]); 
                    if (c.inGamut("srgb") || p.C === 0) { 
                        return { ...p, L: stableL, color: c.clone().toGamut({space: "srgb"}).toString({format: "hex"}), inSrgb: true, isValid: true }; 
                    } 
                    return { isValid: false }; 
                }).filter(p => p.isValid && !p.isPin); 
            }, [baseAnchors, stableL]);
            
            const swatchItems = useMemo(() => {
                if (viewMode !== 'swatches') return [];
                const res = [];
                validAnchors.forEach(p => {
                     const prefix = getNounPrefix(p.L, p.C);
                     const lStr = getLStr(p.L);
                     const nounId = `${prefix}-${p.cStr}-${p.hStr}`;
                     res.push({
                          ...p,
                          type: 'grid',
                          displayName: `${adjectives[lStr]||''} ${names[nounId]||''}`.trim() || 'Unnamed',
                          hex: p.color
                     });
                });
                Object.values(savedColors).forEach(sc => {
                     if (filterFn(sc)) {
                          if (sc.type === 'anchor') {
                              res.push({ ...sc, displayName: `${sc.adjOverride || adjectives[sc.adjId] || ''} ${sc.nameOverride || names[sc.anchorId] || ''}`.trim() || sc.id, hex: sc.srgbHex || sc.color });
                          } else if (sc.type === 'pin') {
                              res.push({ ...sc, displayName: sc.id || 'Pin', hex: sc.srgbHex || sc.color }); // Will use getInheritedPinNames below 
                          }
                     }
                });
                return res;
            }, [validAnchors, stableL, savedColors, lockedNouns, lockedAdjectives, viewMode, names, adjectives]);

            const finalSwatchItems = useMemo(() => {
                if (viewMode !== 'swatches') return [];
                return swatchItems.map(item => {
                    if (item.type === 'pin') {
                        const { displayAdj, displayName } = getInheritedPinNames(item, savedColors, names, adjectives);
                        return { ...item, displayName: `${displayAdj} ${displayName}`.trim() || item.id };
                    }
                    return item;
                });
            }, [swatchItems, viewMode, savedColors, names, adjectives]);

            const data = useMemo(() => {
                if (viewMode === 'swatches') return [];
                const traces = [];
                traces.push({ type: 'scatter', mode: viewMode === 'bins' ? (showText ? 'text' : 'markers') : 'markers', x: validAnchors.map(p => p.a), y: validAnchors.map(p => p.b), text: validAnchors.map(p => { const prefix = getNounPrefix(p.L, p.C); const lStr = getLStr(p.L); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; const adj = adjectives[lStr] || ''; const noun = names[nounId] || ''; const fullName = `${adj} ${noun}`.trim() || 'Unnamed'; const binText = adj && noun ? `<b>${adj}</b><br>${noun}` : `<b>${fullName}</b>`; return viewMode === 'bins' ? (p.C === 0 ? `<b>${adj}</b>` : binText) : `<b>${fullName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`; }), textposition: 'middle center', textfont: { size: 12, family: 'Inter, sans-serif', color: validAnchors.map(p => p.L > 0.55 ? '#010D00' : '#F2E8DF') }, hovertemplate: viewMode === 'bins' ? "<b>%{customdata[3]}</b><br>C: %{customdata[1]:.3f} H: %{customdata[2]:.1f}°<extra></extra>" : "%{text}<extra></extra>", customdata: validAnchors.map(p => { const prefix = getNounPrefix(p.L, p.C); const lStr = getLStr(p.L); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; const fullName = `${adjectives[lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed'; return [p.L, p.C, p.H, fullName]; }), marker: { size: 14, color: validAnchors.map(p => p.color), opacity: viewMode === 'bins' ? (showText ? 0 : 0.3) : 1, line: { width: 0.5, color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' } } });
                const gridLockedNodes = baseAnchors.filter(p => !p.isCustomAnchor).map(p => ({...p, L: crosshair.rawL, lStr: getLStr(crosshair.rawL)})).filter(p => { const prefix = getNounPrefix(p.L, p.C); return !p.isPin && lockedNouns[`${prefix}-${p.cStr}-${p.hStr}`] && lockedAdjectives[p.lStr]; }).map(p => { const prefix = getNounPrefix(p.L, p.C); const nounId = `${prefix}-${p.cStr}-${p.hStr}`; const c = new Color("oklch", [p.L, p.C, p.H]); const nodeColor = c.inGamut("srgb") || p.C === 0 ? c.clone().toGamut({space: "srgb"}).toString({format: "hex"}) : '#010D00'; return { ...p, displayName: `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed', color: nodeColor }; });
                const customLockedNodes = Object.values(savedColors).filter(sc => sc.type === 'anchor' && filterFn(sc)).map(p => { const displayName = `${p.adjOverride || adjectives[p.adjId] || ''} ${p.nameOverride || names[p.anchorId] || ''}`.trim() || p.id || 'Custom Anchor'; return { ...p, a: p.C * Math.sin(p.H * Math.PI / 180), b: p.C * Math.cos(p.H * Math.PI / 180), displayName, color: p.color }; });
                const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
                const pinNodes = Object.values(savedColors).filter(sc => sc.type === 'pin' && filterFn(sc)).map(p => { 
                    const { displayAdj, displayName } = getInheritedPinNames(p, savedColors, names, adjectives);
                    return { ...p, displayAdj, displayName }; 
                });
                traces.push({ type: 'scatter', mode: 'markers', x: lockedNodes.map(p => p.a), y: lockedNodes.map(p => p.b), text: lockedNodes.map(p => `<b>[Lock] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`), hovertemplate: "%{text}<extra></extra>", customdata: lockedNodes.map(p => [p.L, p.C, p.H]), marker: { symbol: 'square', size: 10, color: lockedNodes.map(p => p.color), line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } } });
                traces.push({ type: 'scatter', mode: 'markers', x: pinNodes.map(p => p.a), y: pinNodes.map(p => p.b), text: pinNodes.map(p => `<b>[Pin] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}°`), hovertemplate: "%{text}<extra></extra>", customdata: pinNodes.map(p => [p.L, p.C, p.H]), marker: { symbol: 'x', size: 12, color: pinNodes.map(p => p.color), line: { color: isDark ? '#F2E8DF' : '#010D00', width: 2 } } });
                traces.push({ type: 'scatter', mode: 'lines', x: (crosshair?.snapTarget || crosshair?.activePullType) ? [crosshair.a, crosshair.snapTarget?.a || crosshair.gravityA] : [], y: (crosshair?.snapTarget || crosshair?.activePullType) ? [crosshair.b, crosshair.snapTarget?.b || crosshair.gravityB] : [], line: { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', width: 2, dash: 'dot' }, hoverinfo: 'skip' });
                traces.push({ type: 'scatter', mode: 'markers', x: [crosshair?.a], y: [crosshair?.b], text: [`<b>Cursor ${crosshair?.activePullType ? `(Tethered to ${crosshair.activePullType})` : ''}</b><br>L: ${crosshair?.rawL.toFixed(3)} C: ${crosshair?.rawC.toFixed(3)} H: ${crosshair?.rawH.toFixed(1)}°`], hovertemplate: "%{text}<extra></extra>", marker: { symbol: 'cross', size: 12, color: isDark ? '#F2E8DF' : '#2B4032', opacity: 0.8, line: { color: isDark ? '#F2E8DF' : '#2B4032', width: 2 } }, hoverinfo: 'skip' });
                
                if (tetheringPinId && savedColors[tetheringPinId]) {
                    const p = savedColors[tetheringPinId];
                    traces.push({
                        type: 'scatter',
                        mode: 'lines',
                        x: [p.a, crosshair.a],
                        y: [p.b, crosshair.b],
                        line: { color: '#f59e0b', width: 2, dash: 'dash' },
                        hoverinfo: 'skip'
                    });
                }
                
                return traces;
            }, [validAnchors, baseAnchors, crosshair, isDark, names, adjectives, savedColors, lockedNouns, lockedAdjectives, viewMode, showText, tetheringPinId]);
            const layout = useMemo(() => {
                const shapes = [];
                if (viewMode === 'bins') {
                    if (stableAnchors.length > 0) {
                        try {
                            const allVoronoiPoints = [...stableAnchors];
                            const isMobile = window.innerWidth < 768;
                            const angleStep = isMobile ? 10 : 2;
                            const boundaryPoints = [];
                            for (let angle = 0; angle < 360; angle += angleStep) {
                                let low = 0, high = 0.4;
                                while (high - low > 0.001) {
                                    let mid = (low + high) / 2;
                                    if (new Color("oklch", [stableL, mid, angle]).inGamut("srgb")) {
                                        low = mid;
                                    } else {
                                        high = mid;
                                    }
                                }
                                const maxC = Math.min(low, 0.3);
                                const rad = angle * Math.PI / 180;
                                boundaryPoints.push([maxC * Math.sin(rad), maxC * Math.cos(rad)]);
                                allVoronoiPoints.push({ a: (maxC + 0.005) * Math.sin(rad), b: (maxC + 0.005) * Math.cos(rad), isDummy: true });
                                allVoronoiPoints.push({ a: (maxC + 0.02) * Math.sin(rad), b: (maxC + 0.02) * Math.cos(rad), isDummy: true });
                            }
                            const delaunay = d3.Delaunay.from(allVoronoiPoints.map(p => [p.a, p.b]));
                            const voronoi = delaunay.voronoi([-0.4, -0.4, 0.4, 0.4]);
                            allVoronoiPoints.forEach((p, i) => {
                                if (p.isDummy) return;
                                const path = voronoi.renderCell(i);
                                if (path) {
                                    const pts = [];
                                    path.replace(/([ML])([^,]+),([^MLZ]+)/g, (match, cmd, x, y) => {
                                        pts.push([parseFloat(x), parseFloat(y)]);
                                        return match;
                                    });
                                    if (pts.length > 2) {
                                        const unscaledPath = 'M' + pts.map(pt => pt.join(',')).join('L') + 'Z';
                                        shapes.push({
                                            type: 'path',
                                            path: unscaledPath,
                                            fillcolor: p.color,
                                            line: { width: 1.5, color: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.4)' },
                                            layer: 'below'
                                        });
                                    }
                                }
                            });
                            const outerSquare = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]];
                            const innerBoundary = [...boundaryPoints];
                            const maskPath = 'M' + outerSquare.map(p => p.join(',')).join('L') + 'Z ' + 
                                             'M' + innerBoundary.map(p => p.join(',')).join('L') + 'Z';
                            shapes.push({
                                type: 'path',
                                path: maskPath,
                                fillcolor: isDark ? '#052212' : '#F2E8DF',
                                line: { width: 0 },
                                layer: 'below'
                            });
                        } catch (e) {
                            console.error("Voronoi error:", e);
                        }
                    }
                } else {
                    for (let c = 0.02; c <= 0.34; c += 0.02) {
                        shapes.push({
                            type: 'circle',
                            xref: 'x',
                            yref: 'y',
                            x0: -c,
                            y0: -c,
                            x1: c,
                            y1: c,
                            line: {
                                color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                width: 1,
                                dash: 'dot'
                            }
                        });
                    }
                }
                return { uirevision: 'true', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', dragmode: 'pan', xaxis: { title: 'a', range: [-0.3, 0.3], showgrid: viewMode !== 'bins', zeroline: viewMode !== 'bins', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', scaleanchor: 'y', titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'} }, yaxis: { title: 'b', range: [-0.3, 0.3], showgrid: viewMode !== 'bins', zeroline: viewMode !== 'bins', gridcolor: isDark ? 'rgba(177,188,131,0.12)' : 'rgba(43,64,50,0.10)', titlefont: {color: isDark ? '#B1BC83' : '#2B4032'}, tickfont: {color: isDark ? '#B1BC83' : '#2B4032'} }, margin: { l: 50, r: 50, b: 50, t: 50 }, showlegend: false, shapes };
            }, [isDark, viewMode, stableAnchors, stableL]);
            const handleBgClick = (a, b) => { const C = Math.min(0.3, Math.sqrt(a * a + b * b)); let H = Math.atan2(a, b) * (180 / Math.PI); if (H < 0) H += 360; handlePointClick([crosshair?.rawL, C, H]); };
            if (viewMode === 'swatches') {
                return <ViewportSwatches items={finalSwatchItems} layout={swatchLayout} swatchZoom={swatchZoom} dim1="C" dim2="H" dim1Labels={v => `C: ${Number(v).toFixed(2)}`} dim2Labels={v => `H: ${Number(v).toFixed(0)}°`} handlePointClick={handlePointClick} viewportFilter={viewportFilter} viewportSearchQuery={viewportSearchQuery} viewportTagFilter={viewportTagFilter} crosshair={crosshair} />;
            }
            return <PlotlyChart data={data} layout={layout} onPointClick={handlePointClick} onBgClick={handleBgClick} onRelayout={handleRelayout} theme={theme} />;
        };

        const ViewPalette = ({ baseAnchors, points = [], handlePointClick, names, setNames, adjectives, setAdjectives, dictNotes, lockedNouns, lockedAdjectives, savedColors = {}, setSavedColors, dictTags, onVisualize }) => {
            const [sortBy, setSortBy] = useState('ring'); const [sortAsc, setSortAsc] = useState(true);
            const [tagFilter, setTagFilter] = useState('');
            const [searchTerm, setSearchTerm] = useState('');
            const [isAdding, setIsAdding] = useState(false);
            const [editForm, setEditForm] = useState({ 
                name: '', C: 0.1, H: 180, minL: 0.2, maxL: 0.8, notes: ''
            });

            const handleAddCustomNoun = () => {
                const name = editForm.name.trim();
                const C = parseFloat(editForm.C);
                const H = parseFloat(editForm.H);
                let minL = parseFloat(editForm.minL);
                let maxL = parseFloat(editForm.maxL);
                if (isNaN(C) || isNaN(H) || isNaN(minL) || isNaN(maxL)) { return; }
                if (minL > maxL) { const temp = minL; minL = maxL; maxL = temp; }

                const id = editForm.id || `custom-noun-${crypto.randomUUID()}`;
                
                setSavedColors(prev => ({
                    ...prev,
                    [id]: {
                        id,
                        type: 'nounColumn',
                        nameOverride: name,
                        C, H, minL, maxL,
                        a: C * Math.sin(H * Math.PI / 180),
                        b: C * Math.cos(H * Math.PI / 180),
                        notes: editForm.notes || ''
                    }
                }));
                if(setNames && name) { setNames({...names, [id]: name}); } else if (name) { Object.assign(names, {[id]: name}); }
                setIsAdding(false);
                setEditForm({ id: null, name: '', C: 0.1, H: 180, minL: 0.2, maxL: 0.8, notes: '' });
            };

            const handleDeleteCustomNoun = (id, e) => {
                e.stopPropagation();
                setSavedColors(prev => { 
                    const next = {...prev}; 
                    delete next[id]; 
                    
                    let deletedAny = true;
                    while (deletedAny) {
                        deletedAny = false;
                        Object.values(next).forEach(sc => {
                            if (sc.type === 'anchor' && sc.anchorId === id && sc.isCustomAnchor) {
                                delete next[sc.id];
                                deletedAny = true;
                            } else if (sc.type === 'pin' && sc.anchorId === id) {
                                delete next[sc.id];
                                deletedAny = true;
                            } else if (sc.type === 'pin' && sc.parentPinId && !next[sc.parentPinId]) {
                                delete next[sc.id];
                                deletedAny = true;
                            }
                        });
                    }
                    
                    return next; 
                });
            };
            
            const handleEditCustomNoun = (item, e) => {
                e.stopPropagation();
                setEditForm({
                    id: item.id,
                    name: item.name || '',
                    C: item.C,
                    H: item.H,
                    minL: item.minL,
                    maxL: item.maxL,
                    notes: item.notes || ''
                });
                setIsAdding(true);
            };

            const flatItems = useMemo(() => {
                const items = [];
                Object.values(savedColors).forEach(sc => {
                    if (sc.type === 'nounColumn') {
                        const midL = (sc.minL + sc.maxL) / 2;
                        const cStr = Math.round(sc.C * 100).toString().padStart(2, '0');
                        const hStr = Math.round(sc.H).toString().padStart(3, '0');
                        
                        // Calculate occurrence count from current points
                        let count = 0;
                        points.forEach(p => {
                            if ((p.parentNounId === sc.id) || (Math.abs(p.C - sc.C) < 0.01 && Math.abs(p.H - sc.H) < 0.01 && p.L >= sc.minL && p.L <= sc.maxL && !p.isPin)) {
                                count++;
                            }
                        });

                        items.push({
                            ...sc,
                            L: midL, C: sc.C, H: sc.H, color: new Color("oklch", [midL, sc.C, sc.H]).toGamut({space: "srgb"}).toString({format: "hex"}),
                            id: sc.id,
                            fullCode: `NOUN-C${cStr}-H${hStr}`, 
                            layer: 'Custom Range',
                            count: count, 
                            cStr: cStr, hStr: hStr,
                            tags: dictTags[sc.id] || [],
                            name: names[sc.id] || sc.nameOverride,
                            note: dictNotes[sc.id] || sc.notes,
                            adj: `L ${sc.minL.toFixed(2)} - ${sc.maxL.toFixed(2)}`,
                            isCustomNoun: true
                        });
                    }
                });

                return items;
            }, [dictTags, names, dictNotes, adjectives, savedColors, points]);
            
            const rings = useMemo(() => {
                const r = {}; 
                flatItems.forEach(i => { if (!r[i.cStr]) r[i.cStr] = []; r[i.cStr].push(i); });
                return r;
            }, [flatItems]);

            const allTags = useMemo(() => Array.from(new Set(flatItems.flatMap(item => item.tags))).sort(), [flatItems]);

            const filterFn = (item) => {
                const matchesTag = !tagFilter || item.tags.includes(tagFilter);
                const q = searchTerm.toLowerCase().trim();
                const matchesSearch = !q || 
                    (item.name && item.name.toLowerCase().includes(q)) || 
                    (item.note && item.note.toLowerCase().includes(q)) ||
                    (item.adj && item.adj.toLowerCase().includes(q)) ||
                    (item.fullCode && item.fullCode.toLowerCase().includes(q));
                return matchesTag && matchesSearch;
            };
            const filteredItems = useMemo(() => flatItems.filter(filterFn), [flatItems, tagFilter, searchTerm]);

            const renderSingleSwatch = (item) => {
                if (!item) return null;
                const dupNoun = getGlobalDuplicate(names, adjectives, item.id, names[item.id], savedColors);
                return (
                    <div key={item.id} className="flex flex-col items-center gap-1.5 bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 shadow-sm w-24 flex-shrink-0 relative group transition-colors">
                        <div className="absolute -top-2 -right-2 flex gap-1 z-30">
                            <button onClick={(e) => handleEditCustomNoun(item, e)} className="bg-sky-500 hover:bg-sky-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" title="Edit Noun Column">
                                <Icon name="edit-2" className="w-3 h-3" />
                            </button>
                            <button onClick={(e) => handleDeleteCustomNoun(item.id, e)} className="bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" title="Delete Noun Column">
                                <Icon name="trash" className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold mb-1 tracking-wider">{item.fullCode}</div>
                        <div className="w-full text-[8px] font-bold uppercase tracking-wider bg-transparent text-center text-slate-500 dark:text-neutral-400 truncate" title={item.adj}>{item.adj}</div>
                        <input type="text" className={`w-full text-[11px] font-bold uppercase tracking-wider bg-transparent border-b border-slate-200 dark:border-neutral-700 text-center focus:outline-none placeholder:opacity-30 pb-0.5 disabled:opacity-50 ${dupNoun ? '!text-red-500 !border-red-500' : 'text-slate-800 dark:text-neutral-200 focus:border-sky-500'}`} placeholder="Unnamed Noun" value={names[item.id] || ''} onChange={(e) => setNames({...names, [item.id]: e.target.value})} disabled={lockedNouns[item.id]} title={dupNoun ? `Conflict: ${dupNoun}` : ''} />
                        <div onClick={() => handlePointClick([item.L, item.C, item.H], item.spectral)} className="relative w-14 h-14 rounded shadow-sm cursor-pointer overflow-hidden border border-slate-200 dark:border-neutral-700 hover:ring-2 hover:ring-sky-500 transition-all flex-shrink-0 group/swatch" style={{ backgroundColor: item.color }}>
                            {!new Color('oklch', [item.L, item.C, item.H]).inGamut('srgb') && (
                                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)' }}></div>
                            )}
                            <div className="absolute top-1 right-1 px-1 py-0.5 rounded-sm text-[9px] font-black font-mono leading-none z-10" style={{ color: item.L > 0.65 ? '#010D00' : '#F2E8DF', backgroundColor: item.L > 0.65 ? 'rgba(242, 232, 223, 0.7)' : 'rgba(1, 13, 0, 0.5)' }} title="Occurrences">{item.count}</div>
                            <button onClick={(e) => { e.stopPropagation(); onVisualize('noun', item.id, names[item.id] || item.id); }} className="absolute bottom-1 right-1 opacity-0 group-hover/swatch:opacity-100 bg-black/50 hover:bg-black/70 text-white p-1 rounded transition-opacity" title="Visualize all instances">
                                <Icon name="eye" className="w-3 h-3" />
                            </button>
                        </div>
                        <input type="text" className="w-full text-[9px] bg-transparent text-center text-slate-500 dark:text-neutral-400 italic focus:outline-none disabled:opacity-80 cursor-default" placeholder="No Notes" value={dictNotes[item.id] || ''} title={dictNotes[item.id] || ''} disabled={true} />
                        <div className="text-[8px] font-mono text-slate-400 dark:text-neutral-500 mt-0.5 flex flex-col items-center"><div>L: {item.minL.toFixed(2)}-{item.maxL.toFixed(2)}</div><div>C:{item.C.toFixed(2)}</div><div>H:{item.H.toFixed(1)}°</div></div>
                        {item.tags.length > 0 && (<div className="absolute top-0 left-0 w-full p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-wrap gap-1 justify-center z-20 backdrop-blur-sm bg-white/50 dark:bg-black/50 rounded-t-lg">{item.tags.map(t => <span key={t} className="bg-sky-500 text-white px-1 rounded text-[7px] font-bold uppercase">{t}</span>)}</div>)}
                    </div>
                );
            };
            const SortButton = ({ field, label, icon }) => (<button onClick={() => { if (sortBy === field) setSortAsc(!sortAsc); else { setSortBy(field); setSortAsc(true); } }} className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${sortBy === field ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-transparent'}`}><Icon name={icon} className="w-3.5 h-3.5" />{label}{sortBy === field && <Icon name={sortAsc ? "chevron-up" : "chevron-down"} className="w-3 h-3" />}</button>);
            let content;
            if (sortBy === 'ring') {
                content = Object.keys(rings).sort((a,b) => parseInt(a)-parseInt(b)).map(r => {
                    const ringItems = filteredItems.filter(i => i.cStr === r);
                    if (ringItems.length === 0) return null;
                    
                    const byHue = {};
                    ringItems.forEach(i => { if (!byHue[i.hStr]) byHue[i.hStr] = []; byHue[i.hStr].push(i); });
                    
                    return (
                        <div key={r} className="mb-8 last:mb-0">
                            <div className="flex items-center gap-4 mb-4"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{r === '00' ? "Neutral Spine" : `Chroma Ring (C:${(parseInt(r)/100).toFixed(2)})`}<span className="ml-2 px-1.5 py-0.5 bg-slate-100 dark:bg-neutral-800 rounded text-sky-500 font-mono text-[9px]">{ringItems.length} Nouns</span></span><div className="flex-1 h-px bg-slate-200 dark:bg-neutral-800"></div></div>
                            <div className="flex flex-wrap gap-x-8 gap-y-6">
                                {Object.keys(byHue).sort((a,b) => parseInt(a)-parseInt(b)).map(h => {
                                    return (<div key={h} className="flex flex-col items-center gap-2 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm"><div className="text-[10px] font-mono text-slate-400 dark:text-neutral-500 font-bold mb-1 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">Hue: {parseInt(h)}°</div><div className="flex gap-4 flex-wrap justify-center">{byHue[h].map(renderSingleSwatch)}</div></div>);
                                })}
                            </div>
                        </div>
                    );
                });
            } else {
                const sortedItems = [...filteredItems].sort((a, b) => { let valA, valB; switch(sortBy) { case 'name': valA = (names[a.id] || '').toLowerCase(); valB = (names[b.id] || '').toLowerCase(); if (valA === valB) return a.H - b.H; return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA); case 'count': valA = a.count; valB = b.count; break; case 'layer': valA = a.L; valB = b.L; break; case 'tag': valA = a.tags.join(', '); valB = b.tags.join(', '); if (valA === valB) return a.H - b.H; return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA); case 'hue': default: valA = a.H; valB = b.H; break; } if (valA === valB) return a.C - b.C; return sortAsc ? (valA < valB ? -1 : 1) : (valB < valA ? -1 : 1); });
                content = <div className="flex flex-wrap gap-4">{sortedItems.map(renderSingleSwatch)}</div>;
            }
            return (
                <div className="h-full flex flex-col overflow-hidden pt-2 relative">
                    <div className="flex flex-wrap items-center gap-2 px-4 pb-4 mb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0">
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search nouns, ranges..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[10px] font-bold uppercase tracking-wider rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                                    <Icon name="x" className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase mr-2 flex items-center gap-1.5"><Icon name="arrow-down-up" className="w-3.5 h-3.5" /> Sort By:</span>
                        <SortButton field="ring" label="Chroma Rings" icon="target" /><SortButton field="hue" label="Hue Angle" icon="palette" /><SortButton field="count" label="Occurrences" icon="bar-chart-2" /><SortButton field="name" label="Name" icon="type" /><SortButton field="tag" label="Tags" icon="tag" />
                        {allTags.length > 0 && (<div className="ml-4 flex items-center gap-2"><Icon name="filter" className="w-3.5 h-3.5 text-slate-400" /><select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[9px] font-bold uppercase tracking-wider rounded px-2 py-1 outline-none cursor-pointer"><option value="">All Tags</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select></div>)}
                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => setIsAdding(!isAdding)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] items-center gap-1.5 flex font-bold uppercase tracking-wider transition-colors">
                                <Icon name={isAdding ? "x" : "plus"} className="w-3.5 h-3.5" />
                                {isAdding ? "Cancel" : "Add Noun"}
                            </button>
                            <span className="px-2 py-1 bg-sky-500/10 text-sky-500 rounded text-[10px] font-black uppercase tracking-widest border border-sky-500/20">Total: {filteredItems.length} Nouns</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-10">
                        {isAdding && (
                            <div className="flex flex-col gap-3 bg-slate-50 dark:bg-neutral-800/80 p-4 rounded-xl border border-slate-200 dark:border-neutral-700 shadow-sm w-full mb-6">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Create Custom Noun Column</span>
                                <div className="flex gap-3">
                                    <input type="text" placeholder="Noun Name (Optional)" className="flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500 outline-none" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col flex-1"><span className="text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1">Chroma</span><input type="number" step="0.01" min="0" max="0.4" className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none font-mono" value={editForm.C} onChange={e => setEditForm({...editForm, C: e.target.value})} /></div>
                                    <div className="flex flex-col flex-1"><span className="text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1">Hue (0-360)</span><input type="number" step="1" min="0" max="360" className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none font-mono" value={editForm.H} onChange={e => setEditForm({...editForm, H: e.target.value})} /></div>
                                    <div className="flex flex-col flex-1"><span className="text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1">Min Lightness (0-1)</span><input type="number" step="0.01" min="0" max="1" className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none font-mono" value={editForm.minL} onChange={e => setEditForm({...editForm, minL: e.target.value})} /></div>
                                    <div className="flex flex-col flex-1"><span className="text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1">Max Lightness (0-1)</span><input type="number" step="0.01" min="0" max="1" className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none font-mono" value={editForm.maxL} onChange={e => setEditForm({...editForm, maxL: e.target.value})} /></div>
                                </div>
                                <textarea placeholder="Notes for this column..." className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-xs focus:ring-1 outline-none h-16 w-full resize-none font-mono" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})}></textarea>
                                <button onClick={handleAddCustomNoun} className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold uppercase tracking-wider text-xs transition-colors mt-2 shadow-sm">
                                    Save Custom Noun
                                </button>
                            </div>
                        )}
                        {content}
                    </div>
                </div>
            );
        };

        const ViewAdjectives = ({ gridData, names, adjectives, setAdjectives, handlePointClick, crosshair, savedColors = {}, lockedAdjectives, onVisualize }) => {
            const [sortBy, setSortBy] = useState('lightness'); const [sortAsc, setSortAsc] = useState(false);
            const [searchTerm, setSearchTerm] = useState('');
            const sortedSteps = useMemo(() => { 
                if (!gridData) return []; 
                const counts = {}; 
                gridData.allPoints.forEach(p => { counts[p.lStr] = (counts[p.lStr] || 0) + 1; }); 
                const steps = gridData.allPoints.filter(p => p.C === 0); 
                const unique = []; 
                const seen = new Set(); 
                steps.forEach(p => { 
                    if (!seen.has(p.lStr)) { 
                        seen.add(p.lStr); 
                        unique.push({ ...p, occurrences: counts[p.lStr] || 0 }); 
                    } 
                }); 
                
                let filtered = unique;
                if (searchTerm.trim()) {
                    const q = searchTerm.toLowerCase().trim();
                    filtered = filtered.filter(item => (adjectives[item.lStr] || '').toLowerCase().includes(q));
                }

                return filtered.sort((a, b) => { 
                    let valA, valB; 
                    switch(sortBy) { 
                        case 'adjective': 
                            valA = (adjectives[a.lStr] || '').toLowerCase(); 
                            valB = (adjectives[b.lStr] || '').toLowerCase(); 
                            if (valA === valB) return b.L - a.L; 
                            return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA); 
                        case 'count': 
                            valA = a.occurrences; 
                            valB = b.occurrences; 
                            break; 
                        case 'lightness': 
                        default: 
                            valA = a.L; 
                            valB = b.L; 
                            break; 
                    } 
                    if (valA === valB) return b.L - a.L; 
                    return sortAsc ? (valA < valB ? -1 : 1) : (valB < valA ? -1 : 1); 
                }); 
            }, [gridData, adjectives, sortBy, sortAsc, searchTerm]);
            const SortButton = ({ field, label, icon }) => (<button onClick={() => { if (sortBy === field) setSortAsc(!sortAsc); else { setSortBy(field); setSortAsc(field !== 'lightness'); } }} className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${sortBy === field ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-transparent'}`}><Icon name={icon} className="w-3.5 h-3.5" />{label}{sortBy === field && <Icon name={sortAsc ? "chevron-up" : "chevron-down"} className="w-3 h-3" />}</button>);
            return (
                <div className="h-full flex flex-col overflow-hidden pt-2">
                    <div className="flex flex-wrap justify-between items-center gap-4 px-4 pb-4 mb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative flex-1 min-w-[200px] max-w-xs mr-4">
                                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search adjectives..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[10px] font-bold uppercase tracking-wider rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                                        <Icon name="x" className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase mr-2 flex items-center gap-1.5"><Icon name="arrow-down-up" className="w-3.5 h-3.5" /> Sort By:</span>
                            <SortButton field="lightness" label="Lightness" icon="sun" /><SortButton field="count" label="Occurrences" icon="bar-chart-2" /><SortButton field="adjective" label="Adjective Name" icon="type" />
                        </div>
                        <div className="ml-auto flex items-center gap-2"><span className="px-2 py-1 bg-sky-500/10 text-sky-500 rounded text-[10px] font-black uppercase tracking-widest border border-sky-500/20">Total: {sortedSteps.length} Adjectives</span></div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-10">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
                            {sortedSteps.map(item => { 
                                const dynamicC = crosshair?.rawC || 0; 
                                const dynamicH = crosshair?.rawH || 0; 
                                const c = new Color("oklch", [item.L, dynamicC, dynamicH]); 
                                const hexColor = c.clone().toGamut({space: "srgb"}).toString({format: "hex"}); 
                                const dupAdj = getGlobalDuplicate(names, adjectives, item.lStr, adjectives[item.lStr], savedColors); 
                                return (<div key={item.lStr} className="flex flex-col items-center gap-2 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm hover:border-sky-500/50 transition-all"><div onClick={() => handlePointClick([item.L, dynamicC, dynamicH])} className="relative w-16 h-16 rounded-lg shadow-sm cursor-pointer overflow-hidden border border-slate-200 dark:border-neutral-700 hover:ring-2 hover:ring-sky-500 transition-all flex-shrink-0 group/swatch" style={{ backgroundColor: hexColor }}>{!c.inGamut('srgb') && (<div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)' }}></div>)}<div className="absolute top-1 right-1 px-1 py-0.5 rounded-sm text-[9px] font-black font-mono leading-none z-10" style={{ color: item.L > 0.65 ? '#010D00' : '#F2E8DF', backgroundColor: item.L > 0.65 ? 'rgba(242, 232, 223, 0.7)' : 'rgba(1, 13, 0, 0.5)' }}>{item.occurrences}</div><button onClick={(e) => { e.stopPropagation(); onVisualize('adjective', item.lStr, adjectives[item.lStr] || `L=${item.lStr}`); }} className="absolute bottom-1 right-1 opacity-0 group-hover/swatch:opacity-100 bg-black/50 hover:bg-black/70 text-white p-1 rounded transition-opacity" title="Visualize all instances"><Icon name="eye" className="w-3 h-3" /></button></div><input type="text" className={`w-full text-[11px] font-bold uppercase tracking-wider bg-transparent border-b border-slate-200 dark:border-neutral-700 text-center focus:outline-none placeholder:opacity-30 pb-0.5 mt-1 disabled:opacity-50 ${dupAdj ? '!text-red-500 !border-red-500' : 'text-slate-800 dark:text-neutral-200 focus:border-sky-500'}`} placeholder="Adjective" value={adjectives[item.lStr] || ''} onChange={(e) => setAdjectives({...adjectives, [item.lStr]: e.target.value})} disabled={lockedAdjectives[item.lStr]} title={dupAdj ? `Conflict: ${dupAdj}` : ''} /><div className="text-[8px] font-mono text-slate-400 dark:text-neutral-500 mt-0.5 flex flex-col items-center gap-0.5"><div>L:{item.L.toFixed(2)} C:{dynamicC.toFixed(2)}</div><div>H:{dynamicH.toFixed(1)}°</div></div></div>); 
                            })}
                        </div>
                    </div>
                </div>
            );
        };

const ViewPins = ({ handlePointClick, names, adjectives, dictNotes, savedColors = {}, setSavedColors, dictTags, selectedIds, setSelectedIds, handleBatchTag, handleBatchRemoveTag }) => {
            const [sortBy, setSortBy] = useState('layer'); const [sortAsc, setSortAsc] = useState(true);
            const [tagFilter, setTagFilter] = useState('');
            const [searchTerm, setSearchTerm] = useState('');
            const [isAdding, setIsAdding] = useState(false);
            const [editForm, setEditForm] = useState({ id: '', noun: '', adj: '', notes: '', erpCode: '', L: 0.5, C: 0.1, H: 180 });

            const handleAddCustomPin = () => {
                const id = editForm.id.trim() || crypto.randomUUID();
                if (savedColors[id]) { alert('Anchor or Pin with this ID already exists.'); return; }
                const L = parseFloat(editForm.L);
                const C = parseFloat(editForm.C);
                const H = parseFloat(editForm.H);
                if (isNaN(L) || isNaN(C) || isNaN(H)) { alert('L, C, and H must be valid numbers.'); return; }
                const a = C * Math.sin(H * Math.PI / 180);
                const b = C * Math.cos(H * Math.PI / 180);
                
                setSavedColors(prev => ({
                    ...prev,
                    [id]: {
                        id,
                        type: 'pin',
                        L, C, H, a, b,
                        erpCode: editForm.erpCode || '',
                        anchorId: '',   
                        adjId: '',
                        color: new Color("oklch", [L, C, H]).clone().toGamut({space: "srgb"}).toString({format: "hex"}),
                        nameOverride: editForm.noun || '',
                        adjOverride: editForm.adj || '',
                        notes: editForm.notes || ''
                    }
                }));
                setIsAdding(false);
                setEditForm({ id: '', noun: '', adj: '', notes: '', erpCode: '', L: 0.5, C: 0.1, H: 180 });
            };
            const pinItems = useMemo(() => {
                return Object.values(savedColors).filter(sc => sc.type === 'pin').map(sc => {
                    const { displayAdj, displayName } = getInheritedPinNames(sc, savedColors, names, adjectives);
                    return {
                        ...sc, 
                        displayAdj: (displayAdj || 'Unnamed').trim(),
                        displayName: (displayName || 'Unnamed').trim(),
                        isAdjOverridden: !!sc.adjOverride,
                        isNameOverridden: !!sc.nameOverride,
                        displayNotes: sc.notes || dictNotes[sc.anchorId] || '',
                        tags: dictTags[sc.id] || []
                    };
                });
            }, [savedColors, names, adjectives, dictNotes, dictTags]);
            const allTags = useMemo(() => Array.from(new Set(pinItems.flatMap(item => item.tags))).sort(), [pinItems]);
            const sortedItems = useMemo(() => {
                let items = [...pinItems];
                if (tagFilter) items = items.filter(item => item.tags.includes(tagFilter));
                if (searchTerm.trim()) {
                    const q = searchTerm.toLowerCase().trim();
                    items = items.filter(item => 
                        item.displayName.toLowerCase().includes(q) || 
                        item.displayAdj.toLowerCase().includes(q) || 
                        item.displayNotes.toLowerCase().includes(q) || 
                        item.erpCode.toLowerCase().includes(q)
                    );
                }
                return items.sort((a, b) => {
                    let valA, valB;
                    switch(sortBy) {
                        case 'name': valA = a.displayName.toLowerCase(); valB = b.displayName.toLowerCase(); if (valA === valB) return a.H - b.H; return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                        case 'layer': valA = a.L; valB = b.L; break;
                        case 'tag': valA = a.tags.join(', '); valB = b.tags.join(', '); if (valA === valB) return a.H - b.H; return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                        case 'hue': default: valA = a.H; valB = b.H; break;
                    }
                    if (valA === valB) return a.C - b.C; return sortAsc ? (valA < valB ? -1 : 1) : (valB < valA ? -1 : 1);
                });
            }, [pinItems, sortBy, sortAsc, tagFilter, searchTerm]);
            const handleUnlock = (id) => { setSavedColors(prev => { const next = {...prev}; delete next[id]; return next; }); };
            const SortButton = ({ field, label, icon }) => (
                <button onClick={() => { if (sortBy === field) setSortAsc(!sortAsc); else { setSortBy(field); setSortAsc(true); } }} className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${sortBy === field ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-transparent'}`}>
                    <Icon name={icon} className="w-3.5 h-3.5" />{label}{sortBy === field && <Icon name={sortAsc ? "chevron-up" : "chevron-down"} className="w-3 h-3" />}
                </button>
            );
            const revertOverride = (id, field) => {
                setSavedColors(prev => ({
                    ...prev,
                    [id]: { ...prev[id], [field]: '' }
                }));
            };
            const handleSelectAll = () => {
                if (selectedIds.length === pinItems.length) {
                    setSelectedIds([]);
                } else {
                    setSelectedIds(pinItems.map(i => i.id));
                }
            };
            if (pinItems.length === 0 && !isAdding) return <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-neutral-500 opacity-60"><div className="mb-4"><button onClick={() => setIsAdding(true)} className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded text-[10px] items-center gap-1.5 flex font-bold uppercase tracking-wider transition-colors"><Icon name="plus" className="w-3.5 h-3.5" />Add Pin</button></div><Icon name="map-pin" className="w-12 h-12 mb-4" /><div className="text-xs font-bold uppercase tracking-widest">No Pins Placed</div></div>;
            return (
                <div className="h-full flex flex-col overflow-hidden pt-2 relative">
                    <div className="flex flex-wrap items-center gap-2 px-4 pb-4 mb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0">
                        <button onClick={handleSelectAll} className="mr-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors" title="Select All">
                            <Icon name={selectedIds.length > 0 && selectedIds.length === pinItems.length ? "check-square" : "square"} className="w-4 h-4" />
                        </button>
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search names, notes, codes..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[10px] font-bold uppercase tracking-wider rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
                                    <Icon name="x" className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase mr-2 flex items-center gap-1.5"><Icon name="arrow-down-up" className="w-3.5 h-3.5" /> Sort By:</span>
                        <SortButton field="layer" label="Light / Dark" icon="layers" /><SortButton field="hue" label="Hue Angle" icon="palette" /><SortButton field="name" label="Name" icon="type" /><SortButton field="tag" label="Tags" icon="tag" />
                        {allTags.length > 0 && (<div className="ml-4 flex items-center gap-2"><Icon name="filter" className="w-3.5 h-3.5 text-slate-400" /><select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[9px] font-bold uppercase tracking-wider rounded px-2 py-1 outline-none cursor-pointer"><option value="">All Tags</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select></div>)}
                        <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => setIsAdding(!isAdding)} className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded text-[10px] items-center gap-1.5 flex font-bold uppercase tracking-wider transition-colors">
                                <Icon name={isAdding ? "x" : "plus"} className="w-3.5 h-3.5" />
                                {isAdding ? "Cancel" : "Add Pin"}
                            </button>
                            <span className="px-2 py-1 bg-sky-500/10 text-sky-500 rounded text-[10px] font-black uppercase tracking-widest border border-sky-500/20">Total: {sortedItems.length}</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-10">
                        <div className="flex flex-col gap-3">
                            {isAdding && (
                                <div className="flex flex-col gap-3 bg-slate-50 dark:bg-neutral-800/80 p-4 rounded-xl border border-slate-200 dark:border-neutral-700 shadow-sm w-full">
                                    <div className="flex gap-3">
                                        <input type="text" placeholder="Custom Pin ID (Optional)" className="flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none" value={editForm.id} onChange={e => setEditForm({...editForm, id: e.target.value})} />
                                        <input type="text" placeholder="ERP Code" className="w-1/3 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none" value={editForm.erpCode} onChange={e => setEditForm({...editForm, erpCode: e.target.value})} />
                                    </div>
                                    <div className="flex gap-3">
                                        <input type="text" placeholder="Overridden Noun" className="flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none" value={editForm.noun} onChange={e => setEditForm({...editForm, noun: e.target.value})} />
                                        <input type="text" placeholder="Overridden Adjective" className="flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none" value={editForm.adj} onChange={e => setEditForm({...editForm, adj: e.target.value})} />
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex flex-col flex-1"><span className="text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1">Lightness (0-1)</span><input type="number" step="0.01" min="0" max="1" className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 outline-none" value={editForm.L} onChange={e => setEditForm({...editForm, L: e.target.value})} /></div>
                                        <div className="flex flex-col flex-1"><span className="text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1">Chroma (0-0.4)</span><input type="number" step="0.01" min="0" max="0.4" className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 outline-none" value={editForm.C} onChange={e => setEditForm({...editForm, C: e.target.value})} /></div>
                                        <div className="flex flex-col flex-1"><span className="text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1">Hue (0-360)</span><input type="number" step="1" min="0" max="360" className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 outline-none" value={editForm.H} onChange={e => setEditForm({...editForm, H: e.target.value})} /></div>
                                    </div>
                                    <textarea placeholder="Notes..." className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-2 text-xs focus:ring-1 outline-none h-16 w-full resize-none" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})}></textarea>
                                    <button onClick={handleAddCustomPin} className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-bold uppercase tracking-wider text-[10px] transition-colors mt-1">
                                        Save Custom Pin
                                    </button>
                                </div>
                            )}
                            {sortedItems.map(item => (
                                <div key={item.id} className={`flex items-center gap-5 bg-white dark:bg-neutral-900 p-3.5 rounded-xl border shadow-sm w-full relative group transition-colors ${selectedIds.includes(item.id) ? 'border-sky-500 ring-1 ring-sky-500' : 'border-slate-200 dark:border-neutral-800'}`}>
                                    <div className={`absolute top-2 left-2 z-30 ${selectedIds.includes(item.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(e) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]); }} className="w-4 h-4 cursor-pointer accent-sky-500 rounded-sm" />
                                    </div>
                                    <div onClick={() => handlePointClick([item.L, item.C, item.H], item.spectral)} className="relative w-14 h-14 rounded-lg shadow-sm cursor-pointer border border-slate-200 dark:border-neutral-700 hover:ring-2 hover:ring-sky-500 transition-all flex-shrink-0 overflow-hidden ml-6" style={{ backgroundColor: item.color }}>
                                        {!new Color('oklch', [item.L, item.C, item.H]).inGamut('srgb') && (
                                            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)' }}></div>
                                        )}
                                        <div className="absolute -top-1.5 -left-1.5 bg-sky-500 text-white p-1 rounded-full shadow-sm z-10" title="Free Coordinate Pin"><Icon name="map-pin" className="w-2.5 h-2.5" /></div>
                                    </div>
                                    <div className="flex flex-col w-40 flex-shrink-0 border-r border-slate-100 dark:border-neutral-800 pr-4">
                                        <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold mb-1 tracking-wider">{item.erpCode}</div>
                                        <div className="w-full text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 truncate" title={item.displayAdj}>{item.displayAdj}</div>
                                        <div className="w-full text-xs font-black uppercase tracking-widest text-slate-800 dark:text-neutral-200 truncate" title={item.displayName}>{item.displayName}</div>
                                        {item.tags.length > 0 && (<div className="flex flex-wrap gap-1 mt-1.5">{item.tags.map(t => <span key={t} className="bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider border border-sky-200 dark:border-sky-500/30">{t}</span>)}</div>)}
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center min-w-0 pr-4"><div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-600 mb-0.5">Notes</div><div className="text-[11px] text-slate-600 dark:text-neutral-400 italic line-clamp-2 leading-relaxed" title={item.displayNotes}>{item.displayNotes || "No notes provided."}</div></div>
                                    <div className="flex flex-col items-end flex-shrink-0 w-24 pr-4"><div className="text-[9px] font-mono text-slate-400 dark:text-neutral-500 mb-0.5">L: {item.L.toFixed(3)}</div><div className="text-[9px] font-mono text-slate-400 dark:text-neutral-500 mb-0.5">C: {item.C.toFixed(3)}</div><div className="text-[9px] font-mono text-slate-400 dark:text-neutral-500">H: {item.H.toFixed(1)}°</div></div>
                                    <button onClick={() => handleUnlock(item.id)} className="absolute -top-2 -right-2 bg-slate-800 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500 shadow-sm" title="Remove Pin"><Icon name="x" className="w-3 h-3" /></button>
                                </div>
                            ))}
                                                </div>
                    </div>
                    
                    {selectedIds.length > 0 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 shadow-xl border border-slate-200 dark:border-neutral-700 rounded-full px-4 py-2 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider">{selectedIds.length} selected</span>
                            <div className="w-px h-4 bg-slate-300 dark:bg-neutral-600"></div>
                            <div className="flex items-center gap-2">
                                <Icon name="tag" className="w-3.5 h-3.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Add tag & press Enter..." 
                                    className="bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-sky-500 w-40 text-slate-800 dark:text-neutral-200"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                            handleBatchTag(e.target.value.trim());
                                            e.target.value = '';
                                        }
                                    }}
                                />
                                <div className="w-px h-4 bg-slate-300 dark:bg-neutral-600 mx-1"></div>
                                <Icon name="tag" className="w-3.5 h-3.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Remove tag & press Enter..." 
                                    className="bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-red-500 w-40 text-slate-800 dark:text-neutral-200"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                            handleBatchRemoveTag(e.target.value.trim());
                                            e.target.value = '';
                                        }
                                    }}
                                />
                                <button onClick={() => setSelectedIds([])} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300 ml-2 px-2 py-1">Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        const ViewGroups = ({ settings, setSettings }) => {
            const updateSetting = (key, val) => setSettings({ ...settings, [key]: val });
            const updateHue = (index, field, val) => { const newHues = [...settings.hues]; newHues[index] = { ...newHues[index], [field]: val }; setSettings({ ...settings, hues: newHues }); };
            const onBlurSort = () => { const newHues = [...settings.hues].sort((a,b) => a.maxH - b.maxH); setSettings({ ...settings, hues: newHues }); };
            const addHue = () => { const newHues = [...settings.hues, { id: crypto.randomUUID(), name: 'New Color', maxH: 360 }]; setSettings({ ...settings, hues: newHues }); };
            const removeHue = (index) => { const newHues = settings.hues.filter((_, i) => i !== index); setSettings({ ...settings, hues: newHues }); };
            
            const updateNeutral = (index, field, val) => { const newNeutrals = [...(settings.neutrals || defaultGroupSettings.neutrals)]; newNeutrals[index] = { ...newNeutrals[index], [field]: val }; setSettings({ ...settings, neutrals: newNeutrals }); };
            const onBlurSortNeutrals = () => { const newNeutrals = [...(settings.neutrals || defaultGroupSettings.neutrals)].sort((a,b) => a.maxL - b.maxL); setSettings({ ...settings, neutrals: newNeutrals }); };
            const addNeutral = () => { const newNeutrals = [...(settings.neutrals || defaultGroupSettings.neutrals), { id: crypto.randomUUID(), name: 'New Neutral', maxL: 1.0 }]; setSettings({ ...settings, neutrals: newNeutrals }); };
            const removeNeutral = (index) => { const newNeutrals = (settings.neutrals || defaultGroupSettings.neutrals).filter((_, i) => i !== index); setSettings({ ...settings, neutrals: newNeutrals }); };
            
            const addOverride = () => { const newOverrides = [...(settings.overrides || []), { id: crypto.randomUUID(), condition: 'Light Muted Yellow', name: 'Beige' }]; setSettings({ ...settings, overrides: newOverrides }); };
            const updateOverride = (index, field, val) => { const newOverrides = [...(settings.overrides || [])]; newOverrides[index] = { ...newOverrides[index], [field]: val }; setSettings({ ...settings, overrides: newOverrides }); };
            const removeOverride = (index) => { const newOverrides = (settings.overrides || []).filter((_, i) => i !== index); setSettings({ ...settings, overrides: newOverrides }); };
            
            return (
                <div className="h-full flex flex-col overflow-y-auto custom-scrollbar p-6">
                    <div className="mb-6"><div className="flex items-center gap-4 mb-4"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Global Thresholds</span><div className="flex-1 h-px bg-slate-200 dark:bg-neutral-800"></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-neutral-900 p-5 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm"><SliderGroup label="Light / Dark Boundary" value={settings.lightL} min={0} max={1} step={0.01} onChange={v => updateSetting('lightL', v)} icon="sun" /><SliderGroup label="Neutral Boundary" value={settings.neutralC} min={0} max={0.1} step={0.001} onChange={v => updateSetting('neutralC', v)} icon="circle" /><SliderGroup label="Vivid / Muted Boundary" value={settings.vividC} min={0.02} max={0.3} step={0.001} onChange={v => updateSetting('vividC', v)} icon="zap" /></div></div>
                    <div className="mb-6"><div className="flex items-center gap-4 mb-4"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Neutral Regions (L 0 - 1)</span><div className="flex-1 h-px bg-slate-200 dark:bg-neutral-800"></div><button onClick={addNeutral} className="text-[10px] font-bold uppercase tracking-wider text-sky-500 hover:text-sky-600 flex items-center gap-1 bg-sky-500/10 px-2 py-1 rounded transition-colors"><Icon name="plus" className="w-3 h-3"/> Add Region</button></div><div className="flex flex-col gap-3">{(settings.neutrals || defaultGroupSettings.neutrals).map((neu, i) => (<div key={neu.id} className="flex items-center gap-4 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm transition-all hover:border-sky-500/50"><div className="w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 flex-shrink-0" style={{backgroundColor: new Color('oklch', [Math.max(0, neu.maxL - 0.05), 0, 0]).toGamut({space:'srgb'}).toString({format:'hex'})}}></div><div className="flex-1"><label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Region Name</label><input type="text" value={neu.name} onChange={e => updateNeutral(i, 'name', e.target.value)} className="w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-bold text-slate-800 dark:text-neutral-200 py-1 transition-colors" /></div><div className="w-32"><label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Upper Bound (L)</label><input type="number" min={0} max={1} step={0.01} value={neu.maxL} onChange={e => updateNeutral(i, 'maxL', parseFloat(e.target.value)||0)} onBlur={onBlurSortNeutrals} className="w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-mono text-slate-800 dark:text-neutral-200 py-1 transition-colors" /></div><button onClick={() => removeNeutral(i)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Remove Region"><Icon name="trash-2" className="w-4 h-4" /></button></div>))}</div></div>
                    <div className="mb-6"><div className="flex items-center gap-4 mb-4"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Hue Regions (0° - 360°)</span><div className="flex-1 h-px bg-slate-200 dark:bg-neutral-800"></div><button onClick={addHue} className="text-[10px] font-bold uppercase tracking-wider text-sky-500 hover:text-sky-600 flex items-center gap-1 bg-sky-500/10 px-2 py-1 rounded transition-colors"><Icon name="plus" className="w-3 h-3"/> Add Region</button></div><div className="flex flex-col gap-3">{settings.hues.map((hue, i) => (<div key={hue.id} className="flex items-center gap-4 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm transition-all hover:border-sky-500/50"><div className="w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 flex-shrink-0" style={{backgroundColor: new Color('oklch', [settings.lightL + 0.15, settings.vividC + 0.05, hue.maxH - 15]).toGamut({space:'srgb'}).toString({format:'hex'})}}></div><div className="flex-1"><label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Region Name</label><input type="text" value={hue.name} onChange={e => updateHue(i, 'name', e.target.value)} className="w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-bold text-slate-800 dark:text-neutral-200 py-1 transition-colors" /></div><div className="w-32"><label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Upper Bound (H°)</label><input type="number" min={0} max={360} value={hue.maxH} onChange={e => updateHue(i, 'maxH', parseFloat(e.target.value)||0)} onBlur={onBlurSort} className="w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-mono text-slate-800 dark:text-neutral-200 py-1 transition-colors" /></div><button onClick={() => removeHue(i)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Remove Region"><Icon name="trash-2" className="w-4 h-4" /></button></div>))}</div></div>
                    <div className="mt-8"><div className="flex items-center gap-4 mb-4"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Combination Overrides</span><div className="flex-1 h-px bg-slate-200 dark:bg-neutral-800"></div><button onClick={addOverride} className="text-[10px] font-bold uppercase tracking-wider text-sky-500 hover:text-sky-600 flex items-center gap-1 bg-sky-500/10 px-2 py-1 rounded transition-colors"><Icon name="plus" className="w-3 h-3"/> Add Override</button></div><div className="flex flex-col gap-3">{(settings.overrides || []).map((ov, i) => (<div key={ov.id} className="flex items-center gap-4 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm transition-all hover:border-sky-500/50"><div className="flex-1"><label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Target Combination</label><input type="text" value={ov.condition} onChange={e => updateOverride(i, 'condition', e.target.value)} placeholder="e.g. Light Muted Yellow" className="w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-mono text-slate-800 dark:text-neutral-200 py-1 transition-colors" /></div><div className="flex-1"><label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">New Name</label><input type="text" value={ov.name} onChange={e => updateOverride(i, 'name', e.target.value)} placeholder="e.g. Beige" className="w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-bold text-slate-800 dark:text-neutral-200 py-1 transition-colors" /></div><button onClick={() => removeOverride(i)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors mt-4" title="Remove Override"><Icon name="trash-2" className="w-4 h-4" /></button></div>))}{(!settings.overrides || settings.overrides.length === 0) && (<div className="text-center p-4 text-[10px] uppercase tracking-widest text-slate-400 border border-dashed border-slate-200 dark:border-neutral-800 rounded-xl">No overrides configured</div>)}</div></div>
                </div>
            );
        };

        const ColorHarmonies = ({ L, C, H, handlePointClick }) => {
            const harmonies = useMemo(() => {
                const h = H || 0;
                return [
                    { name: 'Complementary', hues: [h, (h + 180) % 360] },
                    { name: 'Analogous', hues: [h, (h + 30) % 360, (h - 30 + 360) % 360] },
                    { name: 'Triadic', hues: [h, (h + 120) % 360, (h + 240) % 360] },
                    { name: 'Tetradic', hues: [h, (h + 90) % 360, (h + 180) % 360, (h + 270) % 360] },
                    { name: 'Split Complementary', hues: [h, (h + 150) % 360, (h + 210) % 360] },
                    { name: 'Monochromatic', hues: [h, h, h], Ls: [Math.max(0, L - 0.2), L, Math.min(1, L + 0.2)] }
                ];
            }, [L, C, H]);

            return (
                <div className="flex flex-col gap-4">
                    {harmonies.map(harmony => (
                        <div key={harmony.name} className="flex flex-col gap-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{harmony.name}</div>
                            <div className="flex gap-2">
                                {harmony.hues.map((hue, i) => {
                                    const l = harmony.Ls ? harmony.Ls[i] : L;
                                    const cObj = new Color("oklch", [l, C, hue]);
                                    const hex = cObj.clone().toGamut({space: "srgb"}).toString({format: 'hex'});
                                    return (
                                        <div 
                                            key={i} 
                                            className="h-8 flex-1 rounded-md shadow-sm cursor-pointer border border-slate-200 dark:border-neutral-700 hover:ring-2 hover:ring-sky-500 transition-all"
                                            style={{ backgroundColor: hex }}
                                            onClick={() => handlePointClick([l, C, hue])}
                                            title={`L: ${l.toFixed(2)} C: ${C.toFixed(2)} H: ${hue.toFixed(1)}`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            );
        };

        const SpectralGraph = ({ spectralData, theme, meta }) => {
            const isLight = theme === 'light';
            const [isFullscreen, setIsFullscreen] = useState(false);

            const wavelengthToColor = (w) => {
                if (w < 400 || w > 700) return 'rgba(0,0,0,0)';
                
                let r, g, b;
                if (w >= 380 && w < 440) {
                    r = -(w - 440) / (440 - 380);
                    g = 0.0;
                    b = 1.0;
                } else if (w >= 440 && w < 490) {
                    r = 0.0;
                    g = (w - 440) / (490 - 440);
                    b = 1.0;
                } else if (w >= 490 && w < 510) {
                    r = 0.0;
                    g = 1.0;
                    b = -(w - 510) / (510 - 490);
                } else if (w >= 510 && w < 580) {
                    r = (w - 510) / (580 - 510);
                    g = 1.0;
                    b = 0.0;
                } else if (w >= 580 && w < 645) {
                    r = 1.0;
                    g = -(w - 645) / (645 - 580);
                    b = 0.0;
                } else if (w >= 645 && w <= 780) {
                    r = 1.0;
                    g = 0.0;
                    b = 0.0;
                } else {
                    r = 0.0;
                    g = 0.0;
                    b = 0.0;
                }

                let factor;
                if (w >= 380 && w < 420) {
                    factor = 0.3 + 0.7 * (w - 380) / (420 - 380);
                } else if (w >= 420 && w < 701) {
                    factor = 1.0;
                } else if (w >= 701 && w <= 780) {
                    factor = 0.3 + 0.7 * (780 - w) / (780 - 700);
                } else {
                    factor = 0.0;
                }
                const gamma = 0.80;
                const R = r === 0.0 ? 0 : Math.round(255 * Math.pow(r * factor, gamma));
                const G = g === 0.0 ? 0 : Math.round(255 * Math.pow(g * factor, gamma));
                const B = b === 0.0 ? 0 : Math.round(255 * Math.pow(b * factor, gamma));
                return `rgba(${R},${G},${B},0.6)`;
            };

            const colors = useMemo(() => SPECTRAL_TABLES.wavelengths.map(w => wavelengthToColor(w)), []);

            const data = useMemo(() => {
                return [{
                    x: SPECTRAL_TABLES.wavelengths,
                    y: spectralData,
                    type: 'bar',
                    marker: {
                        color: colors,
                        line: { width: 0 }
                    },
                    width: 10,
                    hoverinfo: 'none'
                }, {
                    x: SPECTRAL_TABLES.wavelengths,
                    y: spectralData,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: isLight ? '#010D00' : '#F2E8DF', width: 2 },
                    hovertemplate: 'Wavelength: %{x}nm<br>Reflectance: %{y:.4f}<extra></extra>'
                }];
            }, [spectralData, colors, isLight]);

            const layout = useMemo(() => ({
                margin: isFullscreen ? { l: 50, r: 30, t: 30, b: 50 } : { l: 30, r: 10, t: 10, b: 30 },
                xaxis: { 
                    title: { text: 'Wavelength (nm)', font: { size: isFullscreen ? 14 : 10 } },
                    tickfont: { size: isFullscreen ? 12 : 9 },
                    gridcolor: !isLight ? 'rgba(177,188,131,0.18)' : 'rgba(43,64,50,0.12)',
                    zerolinecolor: !isLight ? 'rgba(177,188,131,0.25)' : 'rgba(43,64,50,0.15)',
                    range: [400, 700]
                },
                yaxis: { 
                    title: { text: 'Reflectance', font: { size: isFullscreen ? 14 : 10 } },
                    tickfont: { size: isFullscreen ? 12 : 9 },
                    range: [0, 1],
                    gridcolor: !isLight ? 'rgba(177,188,131,0.18)' : 'rgba(43,64,50,0.12)',
                    zerolinecolor: !isLight ? 'rgba(177,188,131,0.25)' : 'rgba(43,64,50,0.15)'
                },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                hovermode: 'x unified',
                showlegend: false,
                barmode: 'overlay'
            }), [isFullscreen, isLight, spectralData]);

            const metaItems = useMemo(() => {
                const items = [];
                if (meta?.illuminant) items.push(['Illuminant', meta.illuminant]);
                if (meta?.observer) items.push(['Observer', `${meta.observer}°`]);
                if (meta?.measurementMethod) items.push(['Method', meta.measurementMethod]);
                if (meta?.measurementDate) items.push(['Date', meta.measurementDate]);
                if (meta?.measurementDevice) items.push(['Device', meta.measurementDevice]);
                return items;
            }, [meta]);

            const MetaRibbon = ({ compact }) => {
                if (metaItems.length === 0) {
                    return (
                        <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-slate-400 dark:text-neutral-500 italic tracking-wide`}>
                            No measurement metadata provided
                        </div>
                    );
                }
                return (
                    <div className={`flex flex-wrap gap-x-3 gap-y-1 ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
                        {metaItems.map(([k, v]) => (
                            <div key={k} className="flex items-baseline gap-1">
                                <span className={`font-bold uppercase tracking-widest ${compact ? 'text-[8px]' : 'text-[9px]'} text-slate-400 dark:text-neutral-500`}>{k}</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{v}</span>
                            </div>
                        ))}
                    </div>
                );
            };

            if (isFullscreen) {
                return ReactDOM.createPortal(
                    <div className="fixed inset-0 z-[9999] p-4 flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
                        <div className="flex justify-between items-center mb-4 relative z-10">
                            <div className="flex flex-col gap-2">
                                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Spectral Response</h2>
                                <MetaRibbon />
                            </div>
                            <button onClick={() => setIsFullscreen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full text-slate-500 dark:text-slate-400 pointer-events-auto">
                                <Icon name="x" className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 relative z-0">
                            <PlotlyChart data={data} layout={layout} config={{ displayModeBar: false }} theme={theme} />
                        </div>
                    </div>,
                    document.body
                );
            }

            return (
                <div className="flex flex-col gap-2">
                    <div className="px-2 py-1.5 bg-slate-50 dark:bg-neutral-800/50 rounded-lg border border-slate-100 dark:border-neutral-800">
                        <MetaRibbon compact />
                    </div>
                    <div className="h-48 w-full bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 overflow-hidden relative group">
                        <button onClick={() => setIsFullscreen(true)} className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-neutral-900/80 hover:bg-white dark:hover:bg-neutral-900 rounded shadow-sm text-slate-500 dark:text-slate-400 z-10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <Icon name="maximize-2" className="w-4 h-4" />
                        </button>
                        <PlotlyChart data={data} layout={layout} config={{ displayModeBar: false }} theme={theme} />
                    </div>
                </div>
            );
        };

        function getBrandDisplayName(key) {
            const displayNames = {
                pantone:'Pantone', ral:'RAL', ncs:'NCS', behr:'Behr',
                benjaminMoore:'Benjamin Moore', farrowBall:'Farrow & Ball',
                ppg:'PPG', sherwinWilliams:'Sherwin Williams', dulux:'Dulux',
                tafisa:'Tafisa', uniboard:'Uniboard', agt:'AGT', egger:'Egger',
                finsa:'Finsa', arborite:'Arborite', pionite:'Pionite',
                swissKrono:'Swiss Krono', munsell:'Munsell', unknown:'Unknown'
            };
            if (displayNames[key]) return displayNames[key];
            // Prettify camelCase key: "myBrand" → "My Brand"
            return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
        }

        function normalizeBrandKey(s) {
            if (!s) return '';
            const knownBrands = {
                'pantone':'pantone','ral':'ral','ncs':'ncs','behr':'behr',
                'benjamin moore':'benjaminMoore','farrow & ball':'farrowBall',
                'farrow and ball':'farrowBall','ppg':'ppg',
                'sherwin williams':'sherwinWilliams','sherwin-williams':'sherwinWilliams',
                'dulux':'dulux','tafisa':'tafisa','uniboard':'uniboard',
                'agt':'agt','egger':'egger','finsa':'finsa','arborite':'arborite',
                'pionite':'pionite','swiss krono':'swissKrono','munsell':'munsell'
            };
            const lower = s.toLowerCase().trim();
            if (knownBrands[lower]) return knownBrands[lower];
            return lower.replace(/[^a-zA-Z0-9 ]/g, '').replace(/ +(.)/g, (_, c) => c.toUpperCase());
        }

        const parseCSV = (csvText) => {
            if (!window.Papa) {
                console.error("PapaParse library not loaded! Falling back to primitive parser.");
                // very basic fallback if Papa is missing
                const lines = csvText.split('\n');
                if (lines.length < 2) return [];
                const headers = lines[0].split(',').map(h => h.replace(/\r$/, '').trim());
                const result = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].replace(/\r$/, '');
                    if (!line.trim()) continue;
                    const row = [];
                    let inQuotes = false;
                    let currentVal = '';
                    for (let char of line) {
                        if (char === '"') inQuotes = !inQuotes;
                        else if (char === ',' && !inQuotes) { row.push(currentVal); currentVal = ''; }
                        else currentVal += char;
                    }
                    row.push(currentVal);
                    const obj = {};
                    headers.forEach((h, idx) => { obj[h] = row[idx] ? row[idx].trim() : ''; });
                    result.push(obj);
                }
                return result;
            }
            return window.Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
        };

        const processCSVData = (parsedData, currentColorData, currentSavedColors, currentNames = {}, currentAdjs = {}, currentNotes = {}, currentTags = {}, currentGroupSettings = null) => {
            const newColorData = currentColorData ? JSON.parse(JSON.stringify(currentColorData)) : {};
            const newSavedColors = currentSavedColors ? JSON.parse(JSON.stringify(currentSavedColors)) : {};
            const newNames = currentNames ? JSON.parse(JSON.stringify(currentNames)) : {};
            const newAdjs = currentAdjs ? JSON.parse(JSON.stringify(currentAdjs)) : {};
            const newNotes = currentNotes ? JSON.parse(JSON.stringify(currentNotes)) : {};
            const newTags = currentTags ? JSON.parse(JSON.stringify(currentTags)) : {};
            let newGroupSettings = currentGroupSettings ? JSON.parse(JSON.stringify(currentGroupSettings)) : null;
            let colorsAdded = 0;
            let pinsAdded = 0;
            let hasNeutrals = false;
            let hasHues = false;
            let hasOverrides = false;

            parsedData.forEach(row => {
                const targetType = String(row.Type || '').toUpperCase().trim();
                if (!targetType) return;
                
                if (targetType === 'SETTING') {
                    if (!newGroupSettings) newGroupSettings = { lightL: 0.5, neutralC: 0.02, vividC: 0.1, neutrals: [], hues: [], overrides: [] };
                    if (row.ID === 'lightL' && row.OKLCH_L) newGroupSettings.lightL = parseFloat(row.OKLCH_L);
                    if (row.ID === 'neutralC' && row.OKLCH_C) newGroupSettings.neutralC = parseFloat(row.OKLCH_C);
                    if (row.ID === 'vividC' && row.OKLCH_C) newGroupSettings.vividC = parseFloat(row.OKLCH_C);
                    return;
                }
                if (targetType === 'NEUTRAL_REGION') {
                    if (!newGroupSettings) newGroupSettings = { lightL: 0.5, neutralC: 0.02, vividC: 0.1, neutrals: [], hues: [], overrides: [] };
                    if (!hasNeutrals) { newGroupSettings.neutrals = []; hasNeutrals = true; }
                    newGroupSettings.neutrals.push({ id: row.ID || crypto.randomUUID(), name: row.Noun || '', maxL: parseFloat(row.OKLCH_L) || 0 });
                    return;
                }
                if (targetType === 'HUE_REGION') {
                    if (!newGroupSettings) newGroupSettings = { lightL: 0.5, neutralC: 0.02, vividC: 0.1, neutrals: [], hues: [], overrides: [] };
                    if (!hasHues) { newGroupSettings.hues = []; hasHues = true; }
                    newGroupSettings.hues.push({ id: row.ID || crypto.randomUUID(), name: row.Noun || '', maxH: parseFloat(row.OKLCH_H) || 0 });
                    return;
                }
                if (targetType === 'OVERRIDE') {
                    if (!newGroupSettings) newGroupSettings = { lightL: 0.5, neutralC: 0.02, vividC: 0.1, neutrals: [], hues: [], overrides: [] };
                    if (!hasOverrides) { newGroupSettings.overrides = []; hasOverrides = true; }
                    newGroupSettings.overrides.push({ id: row.ID || crypto.randomUUID(), condition: row.Adjective || '', name: row.Noun || '' });
                    return;
                }

                let pL = null, pC = null, pH = null;
                
                let spectral = [];
                let hasFullSpectral = true;
                for (let wl = 400; wl <= 700; wl += 10) {
                    const key = `R${wl} nm`;
                    const val = row[key];
                    if (val !== undefined && val !== '') {
                        spectral.push(parseFloat(val));
                    } else {
                        hasFullSpectral = false;
                    }
                }
                
                if (!hasFullSpectral && row.Spectral) {
                    try {
                        let text = String(row.Spectral).trim();
                        if (text.startsWith('"') && text.endsWith('"')) text = text.substring(1, text.length - 1);
                        if (text.startsWith('[')) {
                            spectral = JSON.parse(text);
                            hasFullSpectral = spectral.length === 31;
                        }
                    } catch(e) {}
                }
                
                if (hasFullSpectral && spectral.length === 31) {
                    try {
                        const xyzStandard = calculateXYZFromSpectral(spectral, 2, 'D65');
                        const tc = new Color('xyz-d65', xyzStandard).to('oklch');
                        pL = Math.max(0, Math.min(1, tc.coords[0]));
                        pC = Math.max(0, Math.min(0.3, tc.coords[1]));
                        pH = isNaN(tc.coords[2]) ? 0 : (tc.coords[2] % 360 + 360) % 360;
                    } catch(e) { }
                } else {
                    hasFullSpectral = false;
                    spectral = [];
                    try {
                        let tc;
                        if (row.OKLCH_L !== undefined && row.OKLCH_C !== undefined && row.OKLCH_H !== undefined && row.OKLCH_L !== '') { 
                            tc = new Color("oklch", [parseFloat(row.OKLCH_L), parseFloat(row.OKLCH_C), parseFloat(row.OKLCH_H)]); 
                        } else if (row.HEX) { 
                            let ch = String(row.HEX).trim(); if (!ch.startsWith('#')) ch = '#' + ch; tc = new Color(ch); 
                        }
                        if (tc) { 
                            const o = tc.to('oklch'); pL = Math.max(0, Math.min(1, o.coords[0])); pC = Math.max(0, Math.min(0.3, o.coords[1])); pH = isNaN(o.coords[2]) ? 0 : (o.coords[2] % 360 + 360) % 360; 
                        }
                    } catch(e) {}
                }

                let hex = row.HEX || '#B1BC83';
                if (pL !== null && (!row.HEX || row.HEX === '')) {
                   hex = new Color("oklch", [pL, pC, typeof pH === 'number' ? pH : 0]).clone().toGamut({space: "srgb"}).toString({format: "hex"});
                }

                if (targetType === 'DB' || targetType === 'BRAND' || targetType === 'SPECTRAL') {
                    const brandRaw = (row.Adjective || row.Brand || '').trim();
                    const name = (row.Noun || row.Name || '').trim() || 'Unnamed';
                    const url = (row.ERP_Code || row.URL || '').trim();
                    const image = (row.Note || row.Image || '').trim();

                    const finalBrand = normalizeBrandKey(brandRaw) || 'unknown';

                    if (finalBrand) {
                        if (!newColorData[finalBrand]) newColorData[finalBrand] = [];
                        const existingIdx = newColorData[finalBrand].findIndex(c => c.name.toLowerCase() === name.toLowerCase());
                        const colorObj = { name, hex, L: pL, C: pC, H: pH };
                        if (spectral.length > 0) colorObj.spectral = spectral;
                        if (url) colorObj.url = url;
                        if (image) colorObj.image = image;
                        // Measurement metadata
                        if (row.Illuminant) colorObj.illuminant = String(row.Illuminant).trim();
                        if (row.Observer) colorObj.observer = parseInt(row.Observer, 10) || undefined;
                        if (row.Measurement_Method) colorObj.measurementMethod = String(row.Measurement_Method).trim();
                        if (row.Measurement_Date) colorObj.measurementDate = String(row.Measurement_Date).trim();
                        if (row.Measurement_Device) colorObj.measurementDevice = String(row.Measurement_Device).trim();
                        
                        if (existingIdx >= 0) {
                            newColorData[finalBrand][existingIdx] = { ...newColorData[finalBrand][existingIdx], ...colorObj };
                        } else {
                            newColorData[finalBrand].push(colorObj);
                        }
                        colorsAdded++;
                    }
                } else if (targetType === 'PIN') {
                    const id = row.ID || crypto.randomUUID();
                    const L = pL !== null ? pL : 0.5;
                    const C = pC !== null ? pC : 0.1;
                    const H = pH !== null ? pH : 0;
                    const a = C * Math.sin(H * Math.PI / 180);
                    const b = C * Math.cos(H * Math.PI / 180);
                    newSavedColors[id] = {
                        id,
                        type: 'pin',
                        L, C, H, a, b,
                        erpCode: row.ERP_Code || '',
                        nameOverride: row.Noun || '',
                        adjOverride: row.Adjective || '',
                        notes: row.Note || '',
                        color: hex
                    };
                    if (hasFullSpectral) newSavedColors[id].spectral = spectral;
                    // Measurement metadata
                    if (row.Illuminant) newSavedColors[id].illuminant = String(row.Illuminant).trim();
                    if (row.Observer) newSavedColors[id].observer = parseInt(row.Observer, 10) || undefined;
                    if (row.Measurement_Method) newSavedColors[id].measurementMethod = String(row.Measurement_Method).trim();
                    if (row.Measurement_Date) newSavedColors[id].measurementDate = String(row.Measurement_Date).trim();
                    if (row.Measurement_Device) newSavedColors[id].measurementDevice = String(row.Measurement_Device).trim();
                    if (row.Tags) newTags[id] = row.Tags.split(',').map(t => t.trim()).filter(Boolean);
                    pinsAdded++;
                } else if ((targetType === 'GRID' || targetType === 'ANCHOR') && row.ID) {
                    if (row.Noun !== undefined && row.Noun !== '') newNames[row.ID] = row.Noun; 
                    if (row.Note !== undefined && row.Note !== '') newNotes[row.ID] = row.Note; 
                    if (row.Tags) newTags[row.ID] = row.Tags.split(',').map(t => t.trim()).filter(Boolean); 
                    
                    let lStr = null;
                    if (row.Adjective !== undefined && row.Adjective !== '') {
                        if (pL !== null) {
                            lStr = getLStr(pL);
                        } else if (row.ERP_Code && row.ERP_Code.length >= 2) {
                            lStr = row.ERP_Code.substring(0, 2);
                        }
                        if (lStr) newAdjs[lStr] = row.Adjective;
                    }
                    
                    if (String(row.Locked).toUpperCase() === 'TRUE' && pL !== null && pC !== null && pH !== null) {
                        const anchorId = row.ID;
                        const adjId = lStr || getLStr(pL);
                        const a = pC * Math.sin(pH * Math.PI / 180);
                        const b = pC * Math.cos(pH * Math.PI / 180);
                        newSavedColors[anchorId] = {
                            id: anchorId,
                            type: 'anchor',
                            L: pL, C: pC, H: pH, a, b,
                            erpCode: row.ERP_Code || getExactErpCode(pL, pC, pH),
                            adjId, anchorId,
                            nameOverride: '', adjOverride: '', notes: '',
                            color: new Color("oklch", [pL, pC, pH]).clone().toGamut({space: "srgb"}).toString({format: "hex"})
                        };
                    }
                } else if (targetType === 'ADJECTIVE') {
                    if (row.Adjective !== undefined && row.Adjective !== '') {
                        const lStr = (row.ID && row.ID.trim())
                            || (pL !== null ? getLStr(pL) : null)
                            || (row.ERP_Code && row.ERP_Code.length >= 2 ? row.ERP_Code.substring(0, 2) : null);
                        if (lStr) newAdjs[lStr.trim()] = row.Adjective;
                    }
                }
            });

            return { newColorData, newSavedColors, newNames, newAdjs, newNotes, newTags, colorsAdded, pinsAdded, newGroupSettings };
        };

        const App = () => {
            const [theme, setTheme] = useState('light'); 
            const [activeTab, setActiveTab] = useState('top'); 
            const [colorData, setColorData] = useState(null);

            const updateColorData = (newData) => {
                setColorData(newData);
            };

            const gridData = useMemo(() => generateGridData(), []);
            
            const initialState = useMemo(() => { 
                const el = document.getElementById('color-samificator-state'); 
                let parsed = {};
                if (el) { 
                    try { 
                        let raw = el.textContent; 
                        if (el.type === 'application/base64') { raw = decodeURIComponent(atob(raw.trim())); } 
                        parsed = JSON.parse(raw) || {}; 
                    } catch (e) { 
                        console.error('Failed to parse saved state:', e); 
                    } 
                }
                
                if (!parsed.savedColors) parsed.savedColors = {};
                if (!parsed.names) parsed.names = {};
                if (!parsed.dictNotes) parsed.dictNotes = {};
                
                if (!parsed.savedColors['__migrated_grid_nouns']) {
                    const newColors = { ...parsed.savedColors };
                    gridData.baseAnchors.forEach(a => {
                        const addN = (ref, pref, minL, maxL) => {
                            if (!ref) return;
                            const oldId = `${pref}-${a.cStr}-${a.hStr}`;
                            if (!newColors[oldId]) {
                                newColors[oldId] = {
                                    id: oldId,
                                    type: 'nounColumn',
                                    nameOverride: parsed.names[oldId] || '',
                                    C: a.C, H: a.H, minL, maxL,
                                    a: a.C * Math.sin(a.H * Math.PI / 180),
                                    b: a.C * Math.cos(a.H * Math.PI / 180),
                                    notes: parsed.dictNotes[oldId] || ''
                                };
                            }
                        };
                        addN(a.ultraLightRef, 'UL', 0.95, 1.0);
                        addN(a.lightRef, 'L', 0.5, 0.95);
                        addN(a.darkRef, 'D', 0.2, 0.5);
                        addN(a.ultraDarkRef, 'UD', 0.0, 0.2);
                    });
                    newColors['__migrated_grid_nouns'] = { type: 'system', migrated: true };
                    parsed.savedColors = newColors;
                }

                return parsed; 
            }, [gridData.baseAnchors]);

            const [names, setNames] = useState(initialState?.names || {}); 
            const [adjectives, setAdjectives] = useState(initialState?.adjectives || {}); 
            const [dictNotes, setDictNotes] = useState(initialState?.dictNotes || {}); 
            const [dictTags, setDictTags] = useState(initialState?.dictTags || {}); 
            const [savedColors, setSavedColors] = useState(initialState?.savedColors || {}); 
            const [tetheringPinId, setTetheringPinId] = useState(null);

            useEffect(() => {
                let needsCleanup = false;
                const next = { ...savedColors };
                let deletedAny = true;
                while (deletedAny) {
                    deletedAny = false;
                    Object.values(next).forEach(sc => {
                        if (sc.type === 'anchor' && sc.anchorId && sc.anchorId.startsWith('custom-noun-') && !next[sc.anchorId]) {
                            delete next[sc.id];
                            deletedAny = true;
                            needsCleanup = true;
                        } else if (sc.type === 'pin' && sc.anchorId && sc.anchorId.startsWith('custom-noun-') && !next[sc.anchorId]) {
                            delete next[sc.id];
                            deletedAny = true;
                            needsCleanup = true;
                        } else if (sc.type === 'pin' && sc.parentPinId && !next[sc.parentPinId]) {
                            delete next[sc.id];
                            deletedAny = true;
                            needsCleanup = true;
                        }
                    });
                }
                if (needsCleanup) {
                    setSavedColors(next);
                }
            }, [savedColors]);
            const lockedNouns = useMemo(() => { const res = {}; Object.values(savedColors).forEach(sc => { if (sc.type === 'anchor' && sc.locked !== false) res[sc.anchorId] = true; }); return res; }, [savedColors]);
            const lockedAdjectives = useMemo(() => { const res = {}; Object.values(savedColors).forEach(sc => { if (sc.type === 'anchor' && sc.locked !== false) res[sc.adjId] = true; }); return res; }, [savedColors]);
            const [groupSettings, setGroupSettings] = useState(initialState?.groupSettings || defaultGroupSettings); 
            const [palette, setPalette] = useState(initialState?.palette || []);
            const [savedPalettes, setSavedPalettes] = useState(initialState?.savedPalettes || []);
            const [selectedSavedPaletteId, setSelectedSavedPaletteId] = useState("");
            const [isSavingPalette, setIsSavingPalette] = useState(false);
            const [newPaletteName, setNewPaletteName] = useState("");
            const [searchQuery, setSearchQuery] = useState('');
            const [selectedIds, setSelectedIds] = useState([]);
            const [observer, setObserver] = useState(initialState?.observer || 10);
            const [illuminant, setIlluminant] = useState(initialState?.illuminant || 'D65');
            const [linkedFiles, setLinkedFiles] = useState(initialState?.linkedFiles || []);

            useEffect(() => {
                const loadInitialData = async () => {
                    let loadedColorData = null;
                    
                    if (window.__COLOR_DATA__) {
                        loadedColorData = window.__COLOR_DATA__;
                    }
                    
                    if (loadedColorData) setColorData(loadedColorData);

                    // Try to fetch companion CSV files
                    let currentColorData = loadedColorData || {};
                    let currentSavedColors = savedColors;
                    let currentNames = initialState?.names || {};
                    let currentAdjs = initialState?.adjectives || {};
                    let currentNotes = initialState?.dictNotes || {};
                    let currentTags = initialState?.dictTags || {};
                    let currentGroupSettings = initialState?.groupSettings || defaultGroupSettings;

                    const discoverCSVFiles = async () => {
                        // Strategy 1: "Here" (Express API endpoint)
                        try {
                            const resList = await fetch('/api/csv-files');
                            if (resList.ok) {
                                const csvFiles = await resList.json();
                                if (Array.isArray(csvFiles) && csvFiles.length > 0) {
                                    return csvFiles.filter(f => f.toLowerCase().endsWith('.csv'));
                                }
                            }
                        } catch (e) {}

                        // Strategy 2: "in GitHub" API
                        try {
                            if (window.location.hostname.includes('github.io')) {
                                const user = window.location.hostname.split('.')[0];
                                const repo = window.location.pathname.split('/')[1] || user + '.github.io';
                                if (user && repo) {
                                    let repoPath = window.location.pathname.split('/').slice(2).join('/');
                                    const lastSlashIndex = repoPath.lastIndexOf('/');
                                    if (lastSlashIndex !== -1) {
                                        repoPath = repoPath.substring(0, lastSlashIndex);
                                    } else if (repoPath.includes('.')) {
                                        // It's a file at the root of the repo (e.g. app.html)
                                        repoPath = '';
                                    }
                                    if (repoPath.endsWith('/')) repoPath = repoPath.slice(0, -1);
                                    
                                    const targetPath = repoPath ? `${repoPath}/data` : 'data';
                                    const apiPath = `https://api.github.com/repos/${user}/${repo}/contents/${targetPath}`;
                                        
                                    const res = await fetch(apiPath);
                                    if (res.ok) {
                                        const data = await res.json();
                                        if (Array.isArray(data)) {
                                            return data.filter(f => f.name && f.name.toLowerCase().endsWith('.csv')).map(f => f.name);
                                        }
                                    }
                                }
                            }
                        } catch(e) {}

                        // Strategy 3: "Locally offline" via fetch directory listing parse
                        // (Works for local simple HTTP servers, or Firefox file:// dir listings)
                        try {
                            const res = await fetch('./data/');
                            if (res.ok) {
                                const text = await res.text();
                                // Ignore if this is actually the app's index.html being served back
                                if (!text.includes('The ColorSAMificator')) {
                                    const regex = /href=["']?([^"'>]+\.csv)["'>]?/gi;
                                    let match;
                                    const parsedFiles = new Set();
                                    while ((match = regex.exec(text)) !== null) {
                                        const name = match[1].split('/').pop();
                                        if (name && name.toLowerCase().endsWith('.csv')) parsedFiles.add(name);
                                    }
                                    if (parsedFiles.size > 0) {
                                        return Array.from(parsedFiles);
                                    }
                                }
                            }
                        } catch(e) {}

                        // Strategy 4: Fallback for Vite / static bundler injections
                        if (window.__CSV_FILE_MAP__) {
                            return Object.keys(window.__CSV_FILE_MAP__).filter(f => f.toLowerCase().endsWith('.csv'));
                        }

                        // Last resort blind fallbacks
                        const initial = initialState?.linkedFiles || [];
                        if (initial.length > 0) return initial.filter(f => f.toLowerCase().endsWith('.csv'));
                        
                        return ['anchors.csv', 'pins.csv', 'Reference Colors.csv', 'agt.csv', 'arborite.csv', 'behr.csv', 'benjaminMoore.csv', 'dulux.csv', 'egger.csv', 'farrowBall.csv', 'finsa.csv', 'munsell.csv', 'ncs.csv', 'pantone.csv', 'pionite.csv', 'ppg.csv', 'ral.csv', 'sherwinWilliams.csv', 'swissKrono.csv', 'tafisa.csv', 'uniboard.csv'];
                    };

                    let discoveredFiles = await discoverCSVFiles();
                    
                    // Always order anchors.csv first, then pins.csv, then the rest
                    const filesToLoad = [];
                    const uniqueFiles = [...new Set([...discoveredFiles, ...(initialState?.linkedFiles || [])])];
                    if (uniqueFiles.includes('anchors.csv')) filesToLoad.push('anchors.csv');
                    if (uniqueFiles.includes('pins.csv')) filesToLoad.push('pins.csv');
                    
                    uniqueFiles.forEach(f => {
                         if (f !== 'anchors.csv' && f !== 'pins.csv') filesToLoad.push(f);
                    });
                    
                    // Update linked file state so the UI reflects auto-discovered files
                    setLinkedFiles(filesToLoad);

                    for (const file of filesToLoad) {
                        try {
                            // Safely resolve resource URL: use bundler blob if available, else plain filename
                            const csvKey = window.__CSV_FILE_MAP__ && window.__CSV_FILE_MAP__[file];
                            const blobUrl = csvKey && window.__resources && window.__resources[csvKey];
                            const resolvedUrl = blobUrl || (file.startsWith('data/') ? file : 'data/' + file);
                            const res = await fetch(resolvedUrl);
                            if (res.ok) {
                                const csvText = await res.text();
                                const fc = csvText.trimStart().slice(0, 5).toLowerCase();
                                if (fc === '<!doc' || fc === '<html') { console.warn('Skip ' + file + ': HTML response'); continue; }
                                const parsed = parseCSV(csvText);
                                if (!parsed.length) { continue; }
                                const { newColorData, newSavedColors, newNames, newAdjs, newNotes, newTags, newGroupSettings } = processCSVData(parsed, currentColorData, currentSavedColors, currentNames, currentAdjs, currentNotes, currentTags, currentGroupSettings);
                                currentColorData = newColorData; currentSavedColors = newSavedColors;
                                currentNames = newNames; currentAdjs = newAdjs;
                                currentNotes = newNotes; currentTags = newTags;
                                if (newGroupSettings) currentGroupSettings = newGroupSettings;
                            }
                        } catch (e) { console.warn('Failed: ' + file, e); }
                    }

                    // Only update colorData if we actually got some commercial data
                    // (don't replace pre-loaded window.__COLOR_DATA__ with empty object)
                    const hadPreloaded = !!window.__COLOR_DATA__;
                    const gotNewData = Object.keys(currentColorData).length > 0;
                    if (!hadPreloaded || gotNewData) {
                        setColorData(gotNewData ? currentColorData : null);
                    }
                    setSavedColors(currentSavedColors);
                    setNames(currentNames);
                    setAdjectives(currentAdjs);
                    setDictNotes(currentNotes);
                    setDictTags(currentTags);
                    setGroupSettings(currentGroupSettings);
                };
                
                loadInitialData();
            }, []);
            const getComparable = (obj) => {
                if (!obj) return null;
                const { createdAt, createdBy, updatedAt, updatedBy, ...rest } = obj;
                if (rest.spectral && Array.isArray(rest.spectral)) {
                    rest.spectral = [...rest.spectral];
                }
                return JSON.stringify(rest);
            };

            useEffect(() => {
                setSelectedIds([]);
            }, [activeTab]);

            const handleBatchTag = (tag) => {
                if (!tag || selectedIds.length === 0) return;
                setDictTags(prev => {
                    const next = { ...prev };
                    selectedIds.forEach(id => {
                        const currentTags = next[id] || [];
                        if (!currentTags.includes(tag)) {
                            next[id] = [...currentTags, tag];
                        }
                    });
                    return next;
                });
                setSelectedIds([]);
            };

            const handleBatchRemoveTag = (tag) => {
                if (!tag || selectedIds.length === 0) return;
                setDictTags(prev => {
                    const next = { ...prev };
                    selectedIds.forEach(id => {
                        const currentTags = next[id] || [];
                        if (currentTags.includes(tag)) {
                            next[id] = currentTags.filter(t => t !== tag);
                            if (next[id].length === 0) delete next[id];
                        }
                    });
                    return next;
                });
                setSelectedIds([]);
            };
            const [viewportFilter, setViewportFilter] = useState('all');
            const [viewportSearchQuery, setViewportSearchQuery] = useState('');
            const [viewMode, setViewMode] = useState('dots');
            const [swatchLayout, setSwatchLayout] = useState('gallery');
            const [viewportTagFilter, setViewportTagFilter] = useState('');
            const [swatchZoom, setSwatchZoom] = useState(1.0);
            const [scrubL, setScrubL] = useState(0.65); 
            const [scrubC, setScrubC] = useState(0.12); 
            const [scrubH, setScrubH] = useState(0);
            const [temporarySpectral, setTemporarySpectral] = useState(null);
            const [compSlotA, setCompSlotA] = useState(null); 
            const [compSlotB, setCompSlotB] = useState(null);
            const [showFullscreenPreview, setShowFullscreenPreview] = useState(false); 
            const [showCompareFullscreen, setShowCompareFullscreen] = useState(false); 
            const [showFullscreenPalette, setShowFullscreenPalette] = useState(false);
            const [showCompareDivider, setShowCompareDivider] = useState(true);
            const [showHelpPanel, setShowHelpPanel] = useState(false);
            const [showDatabaseManager, setShowDatabaseManager] = useState(false);
            const [showFileManager, setShowFileManager] = useState(false);
            const [visualizeData, setVisualizeData] = useState(null);

            

            // History System
            const [history, setHistory] = useState({
                list: [{
                    names: initialState?.names || {},
                    adjectives: initialState?.adjectives || {},
                    dictNotes: initialState?.dictNotes || {},
                    dictTags: initialState?.dictTags || {},
                    savedColors: initialState?.savedColors || {},
                    groupSettings: initialState?.groupSettings || defaultGroupSettings,
                    palette: initialState?.palette || [],
                    savedPalettes: initialState?.savedPalettes || []
                }],
                index: 0
            });
            const isUndoing = useRef(false);

            const currentStateStr = JSON.stringify({ names, adjectives, dictNotes, dictTags, savedColors, groupSettings, palette, savedPalettes, observer, illuminant });

            useEffect(() => {
                if (isUndoing.current) {
                    isUndoing.current = false;
                    return;
                }
                const timer = setTimeout(() => {
                    setHistory(prev => {
                        const currentRecordStr = JSON.stringify(prev.list[prev.index]);
                        if (currentRecordStr === currentStateStr) return prev;
                        const newList = prev.list.slice(0, prev.index + 1);
                        newList.push(JSON.parse(currentStateStr));
                        if (newList.length > 50) newList.shift();
                        return { list: newList, index: newList.length - 1 };
                    });
                }, 500); 
                return () => clearTimeout(timer);
            }, [currentStateStr]);

            
            const handleUndo = () => {
                setHistory(prev => {
                    if (prev.index > 0) {
                        isUndoing.current = true;
                        const newIndex = prev.index - 1;
                        const prevState = prev.list[newIndex];
                        setNames(prevState.names);
                        setAdjectives(prevState.adjectives);
                        setDictNotes(prevState.dictNotes);
                        setDictTags(prevState.dictTags);
                        setSavedColors(prevState.savedColors);
                        setGroupSettings(prevState.groupSettings);
                        setPalette(prevState.palette);
                        setSavedPalettes(prevState.savedPalettes || []);
                        if (prevState.observer !== undefined) setObserver(prevState.observer);
                        if (prevState.illuminant !== undefined) setIlluminant(prevState.illuminant);
                        return { ...prev, index: newIndex };
                    }
                    return prev;
                });
            };

            const handleRedo = () => {
                setHistory(prev => {
                    if (prev.index < prev.list.length - 1) {
                        isUndoing.current = true;
                        const newIndex = prev.index + 1;
                        const nextState = prev.list[newIndex];
                        setNames(nextState.names);
                        setAdjectives(nextState.adjectives);
                        setDictNotes(nextState.dictNotes);
                        setDictTags(nextState.dictTags);
                        setSavedColors(nextState.savedColors);
                        setGroupSettings(nextState.groupSettings);
                        setPalette(nextState.palette);
                        setSavedPalettes(nextState.savedPalettes || []);
                        if (nextState.observer !== undefined) setObserver(nextState.observer);
                        if (nextState.illuminant !== undefined) setIlluminant(nextState.illuminant);
                        return { ...prev, index: newIndex };
                    }
                    return prev;
                });
            };

            const canUndo = history.index > 0;
            const canRedo = history.index < history.list.length - 1;

            const handleUndoRef = useRef(handleUndo);
            const handleRedoRef = useRef(handleRedo);
            useEffect(() => {
                handleUndoRef.current = handleUndo;
                handleRedoRef.current = handleRedo;
            }, [handleUndo, handleRedo]);

            useEffect(() => {
                const handleKeyDown = (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                        if (e.shiftKey) { e.preventDefault(); handleRedoRef.current(); } 
                        else { e.preventDefault(); handleUndoRef.current(); }
                    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                        e.preventDefault(); handleRedoRef.current();
                    }
                };
                window.addEventListener('keydown', handleKeyDown);
                return () => window.removeEventListener('keydown', handleKeyDown);
            }, []);

            const filteredViewData = useMemo(() => {
                if (!gridData) return { points: [], baseAnchors: [], savedColors: {} };
                
                let points = [...gridData.allPoints];
                let baseAnchors = [...gridData.baseAnchors];
                
                const filteredSavedColors = { ...savedColors };
                
                Object.values(filteredSavedColors).forEach(sc => {
                    const adjId = sc.adjId || getLStr(sc.L);
                    const anchorId = sc.anchorId || `custom-${Math.round(sc.C*100).toString().padStart(2,'0')}-${Math.round(sc.H).toString().padStart(3,'0')}-${adjId}`;
                    
                    if (sc.type === 'pin' || sc.type === 'anchor') {
                        const pt = {
                            L: sc.L, C: sc.C, H: sc.H, a: sc.a, b: sc.b,
                            lStr: adjId, cStr: anchorId ? anchorId.split('-')[1] : '', hStr: anchorId ? anchorId.split('-')[2] : '',
                            erpCode: sc.erpCode, color: sc.color, opacity: 1.0, ring: 0, delta: 0,
                            isPin: sc.type === 'pin', pinId: sc.type === 'pin' ? sc.id : undefined, adjOverride: sc.adjOverride, nameOverride: sc.nameOverride,
                            anchorId: anchorId, adjId: adjId, isCustomAnchor: sc.type === 'anchor'
                        };
                        points.push(pt);
                        baseAnchors.push({
                            C: sc.C, H: sc.H, a: sc.a, b: sc.b, cStr: pt.cStr, hStr: pt.hStr,
                            isPin: sc.type === 'pin', pinId: sc.type === 'pin' ? sc.id : undefined, L: sc.L, color: sc.color,
                            anchorId: anchorId, adjId: adjId,
                            nameOverride: sc.nameOverride, adjOverride: sc.adjOverride, isCustomAnchor: sc.type === 'anchor'
                        });
                    }
                    else if (sc.type === 'nounColumn') {
                        // Dynamically inject points into the grid for this specific noun column
                        // This allows `occurrences` to accurately count even if C/H don't fall perfectly on generic grid
                        const dL = 0.02;
                        let countAdded = 0;
                        for (let L = Math.ceil(sc.minL / dL) * dL; L <= sc.maxL; L += dL) {
                            const cColor = new Color("oklch", [L, sc.C, sc.H]);
                            // Only inject if it doesn't already exist on the grid (prevents double items in ViewChroma!)
                            const exists = points.some(p => Math.abs(p.L - L) < 0.001 && Math.abs(p.C - sc.C) < 0.001 && Math.abs(p.H - sc.H) < 0.001);
                            if (!exists && cColor.inGamut("srgb")) {
                                const pt = {
                                    L, C: sc.C, H: sc.H, a: sc.a, b: sc.b,
                                    lStr: getLStr(L), cStr: Math.round(sc.C*100).toString().padStart(2,'0'), hStr: Math.round(sc.H).toString().padStart(3,'0'),
                                    erpCode: `NOUN-C${Math.round(sc.C*100).toString().padStart(2,'0')}-H${Math.round(sc.H).toString().padStart(3,'0')}`, 
                                    color: cColor.clone().toGamut({space: "srgb"}).toString({format: "hex"}), opacity: 1.0, ring: 0, delta: 0,
                                    isPin: false, isCustomNounGenerated: true, parentNounId: sc.id
                                };
                                points.push(pt);
                                countAdded++;
                            }
                        }
                        
                        // We also need to avoid appending duplicate baseAnchors
                        const anchorExists = baseAnchors.some(ba => Math.abs(ba.C - sc.C) < 0.001 && Math.abs(ba.H - sc.H) < 0.001);
                        if (!anchorExists) {
                            baseAnchors.push({
                                C: sc.C, H: sc.H, a: sc.a, b: sc.b, 
                                cStr: Math.round(sc.C*100).toString().padStart(2,'0'), hStr: Math.round(sc.H).toString().padStart(3,'0'),
                                isCustomNounGenerated: true, parentNounId: sc.id
                            });
                        }
                    }
                });
                
                const filterTags = viewportTagFilter.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
                const q = viewportSearchQuery.toLowerCase().trim();

                // 1. Filter by Type (Pins/Anchors)
                if (viewportFilter === 'pins') {
                    points = [];
                    baseAnchors = [];
                    Object.keys(filteredSavedColors).forEach(k => {
                        if (filteredSavedColors[k].type !== 'pin') delete filteredSavedColors[k];
                    });
                } else if (viewportFilter === 'anchors') {
                    // Remove pin points from visualisation arrays too
                    points = points.filter(p => !p.isPin);
                    baseAnchors = baseAnchors.filter(p => !p.isPin);
                    Object.keys(filteredSavedColors).forEach(k => {
                        if (filteredSavedColors[k].type !== 'anchor') delete filteredSavedColors[k];
                    });
                }

                // 2. Filter Points and SavedColors by Tags and Search Query
                if (filterTags.length > 0 || q) {
                    points = points.filter(p => {
                        const prefix = getNounPrefix(p.L, p.C);
                        const nounId = `${prefix}-${p.cStr}-${p.hStr}`;
                        
                        if (filterTags.length > 0) {
                            const tags = dictTags[nounId] || [];
                            if (!filterTags.some(ft => tags.some(t => t.toLowerCase().includes(ft)))) return false;
                        }
                        
                        if (q) {
                            const name = (names[nounId] || '').toLowerCase();
                            const adj = (adjectives[p.lStr] || '').toLowerCase();
                            const note = (dictNotes[nounId] || '').toLowerCase();
                            const erp = p.erpCode.toLowerCase();
                            if (!(name.includes(q) || adj.includes(q) || note.includes(q) || erp.includes(q))) return false;
                        }
                        
                        return true;
                    });

                    Object.keys(filteredSavedColors).forEach(k => {
                        const sc = filteredSavedColors[k];
                        const id = sc.type === 'pin' ? sc.id : sc.anchorId;
                        
                        if (filterTags.length > 0) {
                            const tags = dictTags[id] || [];
                            if (!filterTags.some(ft => tags.some(t => t.toLowerCase().includes(ft)))) {
                                delete filteredSavedColors[k];
                                return;
                            }
                        }
                        
                        if (q) {
                            const name = (sc.nameOverride || names[sc.anchorId] || '').toLowerCase();
                            const adj = (sc.adjOverride || adjectives[sc.adjId] || '').toLowerCase();
                            const note = (sc.notes || dictNotes[sc.anchorId] || '').toLowerCase();
                            const erp = (sc.erpCode || '').toLowerCase();
                            if (!(name.includes(q) || adj.includes(q) || note.includes(q) || erp.includes(q))) {
                                delete filteredSavedColors[k];
                                return;
                            }
                        }
                    });
                    
                    // 3. Filter baseAnchors based on remaining points or saved colors
                    const activeColumns = new Set();
                    points.forEach(p => activeColumns.add(`${p.cStr}-${p.hStr}`));
                    Object.values(filteredSavedColors).forEach(sc => {
                        if (sc.type === 'anchor') {
                            const parts = sc.anchorId.split('-');
                            if (parts.length === 3) activeColumns.add(`${parts[1]}-${parts[2]}`);
                        } else {
                            const cStr = Math.round(sc.C * 100).toString().padStart(2, '0');
                            const hStr = Math.round(sc.H).toString().padStart(3, '0');
                            activeColumns.add(`${cStr}-${hStr}`);
                        }
                    });
                    
                    baseAnchors = baseAnchors.filter(ba => activeColumns.has(`${ba.cStr}-${ba.hStr}`));
                }

                return { points, baseAnchors, savedColors: filteredSavedColors };
            }, [gridData, viewportFilter, viewportTagFilter, viewportSearchQuery, savedColors, dictTags, names, adjectives, dictNotes]);
            
            useEffect(() => { if (theme === 'dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }, [theme]);
            
            const handleUpdate = (pt, spectralData = null) => { 
                const L = Math.max(0, Math.min(1, pt[0])); 
                const C = Math.max(0, Math.min(0.3, pt[1])); 
                const rawH = pt[2] || 0; 
                const H = isNaN(rawH) ? 0 : (rawH % 360 + 360) % 360;
                setScrubL(L); 
                setScrubC(C); 
                setScrubH(H); 
                setTemporarySpectral(spectralData);
            };

            const crosshair = useMemo(() => {
                if (!gridData) return null;
                const a = scrubC * Math.sin(scrubH * Math.PI / 180);
                const b = scrubC * Math.cos(scrubH * Math.PI / 180);
                let closestSaved = null, minSavedDist = Infinity, closestPin = null, minPinDist = Infinity;
                Object.values(savedColors).forEach(savedCol => {
                    const d = Math.sqrt(Math.pow(scrubL - savedCol.L, 2) + Math.pow(a - savedCol.a, 2) + Math.pow(b - savedCol.b, 2));
                    if (d < minSavedDist - 1e-9 || (Math.abs(d - minSavedDist) <= 1e-9 && savedCol.type === 'pin' && closestSaved?.type !== 'pin')) { minSavedDist = d; closestSaved = savedCol; }
                    if (savedCol.type === 'pin' && d < minPinDist) { minPinDist = d; closestPin = savedCol; }
                });
                let minGridDist = Infinity, gridTieBreakers = [];
                for (const pt of filteredViewData.points) {
                    const d = Math.sqrt(Math.pow(scrubL - pt.L, 2) + Math.pow(a - pt.a, 2) + Math.pow(b - pt.b, 2));
                    const EPSILON = 1e-9;
                    if (d < minGridDist - EPSILON) { minGridDist = d; gridTieBreakers = [pt]; } 
                    else if (Math.abs(d - minGridDist) <= EPSILON) { gridTieBreakers.push(pt); }
                }
                if (gridTieBreakers.length > 1) { gridTieBreakers.sort((p1, p2) => { if (Math.abs(p2.L - p1.L) > 1e-9) return p2.L - p1.L; if (Math.abs(p1.C - p2.C) > 1e-9) return p1.C - p2.C; return p1.H - p2.H; }); }
                const closestGridPt = gridTieBreakers[0];
                const currentDelta = 0.02; // Enforced maximum of 0.02 delta E OK attraction
                const exactSavedColor = (closestSaved && minSavedDist < 0.0001) ? closestSaved : null;
                
                // Gravity Pull Logic
                let gravityL = scrubL, gravityC = scrubC, gravityH = scrubH;
                let gravityA = a, gravityB = b;
                let activePullType = null; // 'anchor' or 'pin'

                let closestCustomColumn = null, minCustomColumnDist = Infinity;
                Object.values(savedColors).forEach(sc => {
                    if (sc.type === 'nounColumn' && scrubL >= sc.minL && scrubL <= sc.maxL) {
                        const d = Math.sqrt(Math.pow(a - sc.a, 2) + Math.pow(b - sc.b, 2));
                        if (d < minCustomColumnDist) { minCustomColumnDist = d; closestCustomColumn = sc; }
                    }
                });

                if (minCustomColumnDist <= 0.02 && closestCustomColumn && minCustomColumnDist < minGridDist) {
                    gravityL = scrubL; // Continuous column, no vertical snap
                    gravityC = closestCustomColumn.C;
                    gravityH = closestCustomColumn.H;
                    gravityA = closestCustomColumn.a;
                    gravityB = closestCustomColumn.b;
                    activePullType = 'anchor';
                } else if (minGridDist <= 0.02 && closestGridPt) {
                    gravityL = closestGridPt.L;
                    gravityC = closestGridPt.C;
                    gravityH = closestGridPt.H;
                    gravityA = closestGridPt.a;
                    gravityB = closestGridPt.b;
                    activePullType = 'anchor';
                } else if (minPinDist <= 0.02 && closestPin) {
                    gravityL = closestPin.L;
                    gravityC = closestPin.C;
                    gravityH = closestPin.H;
                    gravityA = closestPin.a || (closestPin.C * Math.sin(closestPin.H * Math.PI / 180));
                    gravityB = closestPin.b || (closestPin.C * Math.cos(closestPin.H * Math.PI / 180));
                    activePullType = 'pin';
                }

                const isGridSnapped = minGridDist <= 0.02 || minCustomColumnDist <= 0.02; 
                let activeSavedColor = null;
                if (exactSavedColor && exactSavedColor.type === 'pin') { activeSavedColor = exactSavedColor; } 
                else if (activePullType === 'anchor' && minCustomColumnDist <= 0.02 && minCustomColumnDist < minGridDist) {
                    activeSavedColor = closestCustomColumn;
                } else if ((isGridSnapped || activePullType === 'anchor') && closestGridPt) {
                    if (closestGridPt.isPin) {
                        activeSavedColor = savedColors[closestGridPt.pinId];
                    } else {
                        const gridPrefix = getNounPrefix(closestGridPt.L, closestGridPt.C);
                        const aId = `${gridPrefix}-${closestGridPt.cStr}-${closestGridPt.hStr}`;
                        const anchorLock = Object.values(savedColors).find(sc => sc.type === 'anchor' && sc.anchorId === aId && sc.adjId === closestGridPt.lStr);
                        if (anchorLock) activeSavedColor = anchorLock;
                    }
                }
                
                let nearestAdjId, nearestAnchorId;
                const effectiveL = activePullType ? gravityL : scrubL;
                const effectiveC = activePullType ? gravityC : scrubC;
                const effectiveH = activePullType ? gravityH : scrubH;
                const effectiveA = activePullType ? gravityA : a;
                const effectiveB = activePullType ? gravityB : b;

                if (closestGridPt && closestGridPt.isPin && minGridDist < 0.001) {
                    nearestAdjId = closestGridPt.adjId;
                    nearestAnchorId = closestGridPt.anchorId;
                } else {
                    nearestAdjId = getLStr(effectiveL);
                    let min2d = Infinity, bestAnchor = null;
                    if (filteredViewData.baseAnchors) {
                        for (const ba of filteredViewData.baseAnchors) {
                            const dist = Math.pow(effectiveA - ba.a, 2) + Math.pow(effectiveB - ba.b, 2);
                            if (dist < min2d) { min2d = dist; bestAnchor = ba; }
                        }
                    }
                    
                    // Look for custom columns
                    Object.values(savedColors).filter(sc => sc.type === 'nounColumn').forEach(cc => {
                        const dist = Math.pow(effectiveA - cc.a, 2) + Math.pow(effectiveB - cc.b, 2);
                        // Only snap if effective L is within the column's range
                        if (dist <= min2d && effectiveL >= cc.minL && effectiveL <= cc.maxL) {
                            min2d = dist;
                            bestAnchor = cc;
                        }
                    });

                    if (bestAnchor) {
                        if (bestAnchor.type === 'nounColumn') {
                            nearestAnchorId = bestAnchor.id;
                        } else if (bestAnchor.isCustomAnchor) {
                            nearestAnchorId = `custom-${bestAnchor.cStr}-${bestAnchor.hStr}-${getLStr(effectiveL)}`;
                        } else {
                            const gridPrefix = getNounPrefix(effectiveL, bestAnchor.C);
                            nearestAnchorId = `${gridPrefix}-${bestAnchor.cStr}-${bestAnchor.hStr}`;
                        }
                    } else {
                        nearestAnchorId = '';
                    }
                }

                const exactErpCode = getExactErpCode(scrubL, scrubC, scrubH);
                const activeErpCode = exactErpCode; // Priority to cursor position as requested
                return {
                    rawL: scrubL, rawC: scrubC, rawH: scrubH, a, b,
                    gravityL, gravityC, gravityH, gravityA, gravityB, activePullType,
                    activeSavedColor, exactSavedColor, isGridSnapped, closestGridPt, activeErpCode,
                    nearestAdjId,
                    nearestAnchorId,
                    snapDist: minGridDist, snapTarget: closestGridPt, temporarySpectral
                };
            }, [gridData, filteredViewData.points, filteredViewData.baseAnchors, scrubL, scrubC, scrubH, savedColors, temporarySpectral]);

            const handlePointClick = (pt) => {
                if (!crosshair) return;
                const { exactSavedColor, isGridSnapped, closestGridPt, nearestAdjId, nearestAnchorId } = crosshair;
                
                if (tetheringPinId) {
                    let clickedItem = null;
                    if (exactSavedColor && exactSavedColor.type === 'pin') {
                        clickedItem = exactSavedColor;
                    } else if (isGridSnapped && closestGridPt) {
                        if (closestGridPt.isPin) {
                            clickedItem = savedColors[closestGridPt.pinId];
                        } else {
                            clickedItem = { 
                                type: 'anchor', 
                                anchorId: nearestAnchorId, 
                                adjId: nearestAdjId,
                                erpCode: closestGridPt.erpCode
                            };
                        }
                    }

                    if (clickedItem && clickedItem.id !== tetheringPinId) {
                        setSavedColors(prev => ({
                            ...prev,
                            [tetheringPinId]: {
                                ...prev[tetheringPinId],
                                parentPinId: clickedItem.type === 'pin' ? clickedItem.id : null,
                                anchorId: clickedItem.anchorId,
                                adjId: clickedItem.adjId
                            }
                        }));
                        setTetheringPinId(null);
                        return;
                    }
                }
                handleUpdate(pt);
            };

            const handleVisualize = (type, id, displayName) => {
                let items = [];
                if (type === 'adjective') {
                    items = gridData.allPoints.filter(p => p.lStr === id).map(p => {
                        const prefix = getNounPrefix(p.L, p.C);
                        const nounId = `${prefix}-${p.cStr}-${p.hStr}`;
                        return {
                            ...p,
                            displayName: `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || (p.erpCode ? `#${p.erpCode}` : '—'),
                            erpCode: p.erpCode
                        };
                    });
                } else if (type === 'noun') {
                    const sc = savedColors[id];
                    if (sc && sc.type === 'nounColumn') {
                        // include injected points for the custom column using parentNounId
                        // We also need to get the gridData.allPoints, wait, we injected them into filteredViewData.points!
                        // So we should filter filteredViewData.points instead of gridData.allPoints to see the dynamically generated occurrences!
                        items = filteredViewData.points.filter(p => {
                            return (p.parentNounId === sc.id) || (Math.abs(p.C - sc.C) < 0.01 && Math.abs(p.H - sc.H) < 0.01 && p.L >= sc.minL && p.L <= sc.maxL && !p.isPin);
                        }).map(p => {
                            return {
                                ...p,
                                displayName: `${adjectives[p.lStr] || ''} ${names[id] || sc.nameOverride || ''}`.trim() || (p.erpCode ? `#${p.erpCode}` : '—'),
                                erpCode: p.erpCode
                            };
                        });
                    } else {
                        items = gridData.allPoints.filter(p => {
                            const prefix = getNounPrefix(p.L, p.C);
                            const nounId = `${prefix}-${p.cStr}-${p.hStr}`;
                            return nounId === id;
                        }).map(p => {
                            const prefix = getNounPrefix(p.L, p.C);
                            const nounId = `${prefix}-${p.cStr}-${p.hStr}`;
                            return {
                                ...p,
                                displayName: `${adjectives[p.lStr] || ''} ${names[nounId] || ''}`.trim() || (p.erpCode ? `#${p.erpCode}` : '—'),
                                erpCode: p.erpCode
                            };
                        });
                    }
                }
                setVisualizeData({ title: `Visualizing ${displayName}`, items });
            };

            const tabs = useMemo(() => [ 
                {id: 'db', label: 'Commercial DB'},
                {id: 'top', label: 'Light Layers'}, 
                {id: 'chroma', label: 'CHROMA RINGS'}, 
                {id: 'slice', label: 'HUE SLICES'}, 
                {id: '3d', label: '3D VIEW'}, 
                {id: 'groups', label: 'Color Groups'}, 
                {id: 'adjectives', label: 'Adjectives'}, 
                {id: 'palette', label: 'Nouns'}, 
                {id: 'pins', label: 'Pins'} 
            ], []);

            const searchResults = useMemo(() => { 
                if (!searchQuery.trim() || !gridData) return []; 
                const q = searchQuery.toLowerCase().trim(); 
                const results = []; const seenCodes = new Set(); 
                Object.values(savedColors).forEach(sc => { 
                    const adj = (sc.type === 'nounColumn' ? `L ${sc.minL} - ${sc.maxL}` : (sc.adjOverride || adjectives[sc.adjId] || '')).toLowerCase(); 
                    const name = (sc.type === 'nounColumn' ? (sc.nameOverride || names[sc.id] || '') : (sc.nameOverride || names[sc.anchorId] || '')).toLowerCase(); 
                    const fullName = `${adj} ${name}`.trim(); 
                    const note = (sc.notes || (sc.type === 'nounColumn' ? dictNotes[sc.id] : dictNotes[sc.anchorId]) || '').toLowerCase(); 
                    const code = (sc.erpCode || '').toLowerCase(); 
                    const tagsStr = (dictTags[sc.id] || dictTags[sc.anchorId] || []).join(' ').toLowerCase(); 
                    if (adj.includes(q) || name.includes(q) || fullName.includes(q) || note.includes(q) || code.includes(q) || tagsStr.includes(q)) { 
                        let dn = 'Unnamed';
                        if (sc.type === 'nounColumn') {
                            dn = `[Grid Area] ${names[sc.id] || sc.nameOverride || 'Unnamed Column'}`;
                        } else {
                            dn = `${sc.adjOverride || adjectives[sc.adjId] || ''} ${sc.nameOverride || names[sc.anchorId] || ''}`.trim() || 'Unnamed';
                        }
                        const t = sc.type === 'pin' ? 'Pin' : (sc.type === 'nounColumn' ? 'Noun Column' : 'Locked Anchor');
                        const n = sc.type === 'nounColumn' ? (sc.notes || dictNotes[sc.id] || '') : (sc.notes || dictNotes[sc.anchorId] || '');
                        // use midpoint for L if nounColumn
                        const realL = sc.type === 'nounColumn' ? ((sc.minL + sc.maxL) / 2) : sc.L;
                        results.push({ key: `saved-${sc.id}`, L: realL, C: sc.C, H: sc.H, color: sc.color || '#010D00', displayName: dn, erpCode: sc.erpCode, type: t, note: n }); 
                        if (sc.erpCode) seenCodes.add(sc.erpCode); 
                    } 
                }); 
                for (const pt of gridData.allPoints) { 
                    if (results.length >= 100) break; 
                    if (seenCodes.has(pt.erpCode)) continue; 
                    const prefix = getNounPrefix(pt.L, pt.C); 
                    const nounId = `${prefix}-${pt.cStr}-${pt.hStr}`; 
                    const adjStr = (adjectives[pt.lStr] || '').toLowerCase(); 
                    const nameStr = (names[nounId] || '').toLowerCase(); 
                    const fullNameStr = `${adjStr} ${nameStr}`.trim(); 
                    const noteStr = (dictNotes[nounId] || '').toLowerCase(); 
                    const codeStr = pt.erpCode.toLowerCase(); 
                    const tagsStr = (dictTags[nounId] || []).join(' ').toLowerCase(); 
                    const hasDictMatch = (adjStr && adjStr.includes(q)) || (nameStr && nameStr.includes(q)) || (fullNameStr && fullNameStr.includes(q)) || (noteStr && noteStr.includes(q)) || (tagsStr && tagsStr.includes(q)); 
                    const isCodeSearch = q.length >= 2 && !isNaN(q) && codeStr.includes(q); 
                    if (hasDictMatch || isCodeSearch) { 
                        results.push({ key: `pt-${pt.erpCode}`, L: pt.L, C: pt.C, H: pt.H, color: pt.color, displayName: `${adjectives[pt.lStr] || ''} ${names[nounId] || ''}`.trim() || 'Unnamed', erpCode: pt.erpCode, type: 'Coordinate', note: dictNotes[nounId] || '' }); 
                        seenCodes.add(pt.erpCode); 
                    } 
                } 
                
                if (colorData && results.length < 100) {
                    // Dynamic: search all brands in colorData
                    for (const [brandKey, list] of Object.entries(colorData)) {
                        if (results.length >= 100) break;
                        if (!list || !Array.isArray(list)) continue;
                        const brandName = getBrandDisplayName(brandKey);
                        
                        for (const item of list) {
                            if (results.length >= 100) break;
                            const matchesName = item.name && item.name.toLowerCase().includes(q);
                            const matchesBrand = brandName.toLowerCase().includes(q);
                            if (matchesName || matchesBrand) {
                                try {
                                    const c = new Color(item.hex).to('oklch');
                                    results.push({
                                        key: `brand-${brandKey}-${item.name}`,
                                        L: c.coords[0],
                                        C: c.coords[1],
                                        H: isNaN(c.coords[2]) ? 0 : c.coords[2],
                                        color: item.hex,
                                        image: item.image || null,
                                        displayName: item.name,
                                        erpCode: '',
                                        type: brandName,
                                        note: item.spectral && item.spectral.length > 0 ? 'Verified Spectral Data' : ''
                                    });
                                } catch (e) {}
                            }
                        }
                    }
                }
                
                return results; 
            }, [searchQuery, gridData, names, adjectives, dictNotes, savedColors, dictTags, colorData]);

            if (!gridData || !crosshair) return <div className="min-h-screen flex items-center justify-center font-mono text-xs uppercase tracking-widest text-slate-400">Initializing Studio...</div>;

            const toggleAnchorLock = () => { 
                if (!crosshair) return; 
                const anchorId = crosshair.nearestAnchorId; 
                const adjId = crosshair.nearestAdjId;
                const existingAnchorLock = Object.values(savedColors).find(sc => sc.type === 'anchor' && sc.anchorId === anchorId && sc.adjId === adjId); 
                if (existingAnchorLock) { 
                    if (existingAnchorLock.isCustomAnchor) {
                        setSavedColors(prev => { 
                            const next = {...prev}; 
                            next[existingAnchorLock.id] = { ...next[existingAnchorLock.id], locked: existingAnchorLock.locked === false ? true : false }; 
                            return next; 
                        });
                    } else {
                        setSavedColors(prev => { const next = {...prev}; delete next[existingAnchorLock.id]; return next; }); 
                    }
                } else { 
                    const newId = `${anchorId}-${adjId}`; 
                    let ptToLock = crosshair.closestGridPt;
                    if (ptToLock && ptToLock.isPin) {
                        const cStr = anchorId.split('-')[1];
                        const hStr = anchorId.split('-')[2];
                        ptToLock = gridData.allPoints.find(p => p.lStr === adjId && p.cStr === cStr && p.hStr === hStr) || ptToLock;
                    }
                    if (ptToLock) {
                        setSavedColors(prev => ({ ...prev, [newId]: { id: newId, type: 'anchor', L: ptToLock.L, C: ptToLock.C, H: ptToLock.H, a: ptToLock.a, b: ptToLock.b, erpCode: ptToLock.erpCode, adjId, anchorId, nameOverride: '', adjOverride: '', notes: '', color: ptToLock.color } })); 
                    }
                } 
            };
            
            const togglePin = () => { 
                if (!crosshair) return; 
                if (crosshair.exactSavedColor?.type === 'pin') { 
                    setSavedColors(prev => { const next = {...prev}; delete next[crosshair.exactSavedColor.id]; return next; }); 
                } else { 
                    const newId = crypto.randomUUID(); 
                    setSavedColors(prev => ({ ...prev, [newId]: { id: newId, type: 'pin', L: scrubL, C: scrubC, H: scrubH, a: crosshair.a, b: crosshair.b, erpCode: getExactErpCode(scrubL, scrubC, scrubH), adjId: crosshair.nearestAdjId, anchorId: crosshair.nearestAnchorId, parentPinId: crosshair.closestGridPt?.isPin ? crosshair.closestGridPt.pinId : null, nameOverride: '', adjOverride: '', notes: '', color: new Color("oklch", [scrubL, scrubC, scrubH]).clone().toGamut({space: "srgb"}).toString({format: "hex"}), spectral: crosshair.temporarySpectral } })); 
                } 
            };
            
            const updateSavedColor = (field, val) => { 
                if (!crosshair?.activeSavedColor) return; 
                setSavedColors(prev => ({ ...prev, [crosshair.activeSavedColor.id]: { ...prev[crosshair.activeSavedColor.id], [field]: val } })); 
            };
            
            const onAdjChange = (val) => { 
                if (crosshair?.activeSavedColor?.type === 'pin') updateSavedColor('adjOverride', val); 
                else setAdjectives({...adjectives, [crosshair?.nearestAdjId]: val}); 
            };
            
            const onNameChange = (val) => { 
                if (crosshair?.activeSavedColor?.type === 'pin') {
                    updateSavedColor('nameOverride', val); 
                } else if (crosshair?.nearestAnchorId) {
                    const id = crosshair.nearestAnchorId;
                    setNames({...names, [id]: val}); 
                    
                    // If it's a grid slot and not yet a nounColumn, auto-recreate the nounColumn!
                    if (val && !savedColors[id] && !id.startsWith('custom-')) {
                        // Infer minL, maxL from the prefix
                        let minL = 0, maxL = 1;
                        if (id.startsWith('UL')) { minL = 0.95; maxL = 1.0; }
                        else if (id.startsWith('L')) { minL = 0.5; maxL = 0.95; }
                        else if (id.startsWith('D')) { minL = 0.2; maxL = 0.5; }
                        else if (id.startsWith('UD')) { minL = 0.0; maxL = 0.2; }
                        
                        setSavedColors(prev => ({
                            ...prev,
                            [id]: {
                                id, type: 'nounColumn', nameOverride: val,
                                C: crosshair.gravityC, H: crosshair.gravityH,
                                minL, maxL,
                                a: crosshair.gravityA, b: crosshair.gravityB,
                                notes: dictNotes[id] || ''
                            }
                        }));
                    }
                }
            };
            
            const onNotesChange = (val) => { 
                if (crosshair?.activeSavedColor?.type === 'pin') updateSavedColor('notes', val); 
                else setDictNotes({...dictNotes, [crosshair?.nearestAnchorId]: val}); 
            };
            
            const handleSaveApp = async () => { 
                try {
                    const now = new Date(); const pad = (n) => String(n).padStart(2, '0'); const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`; 
                    const filename = `The ColorSAMIficator ${ts}.html`; 
                    const stateData = { palette, savedPalettes, groupSettings, observer, illuminant, linkedFiles }; 
                    
                    let appCode = '';
                    let styleCode = '';
                    const inlineScript = document.querySelector('script[type="text/babel"]:not([src])');
                    if (inlineScript && inlineScript.textContent && inlineScript.textContent.trim().length > 100) {
                        appCode = inlineScript.textContent;
                    } else {
                        try {
                            const r2 = await fetch('app.js');
                            if (r2.ok) appCode = await r2.text();
                            else throw new Error('Cannot locate app code');
                        } catch(e2) { throw new Error('Export failed: ' + e2.message); }
                        try {
                            const rs = await fetch('styles.css');
                            if (rs.ok) styleCode = await rs.text();
                        } catch(e2) { console.warn('Could not fetch styles.css'); }
                    }

                    const clone = document.documentElement.cloneNode(true); 
                    const root = clone.querySelector('#root'); 
                    if (root) root.innerHTML = ''; 
                    
                    // Remove existing state and scripts
                    const oldState = clone.querySelector('#color-samificator-state'); 
                    if (oldState) oldState.remove(); 
                    const oldConfig = clone.querySelector('#color-samificator-config');
                    if (oldConfig) oldConfig.remove();

                    clone.querySelectorAll('script').forEach(el => { 
                        if (el.type === 'text/babel') { el.remove(); return; }
                        
                        // Remove unrecognized inline scripts (injected by extensions)
                        if (!el.src && 
                            !el.textContent.includes('tailwind.config') && 
                            el.id !== 'color-samificator-state' && 
                            el.id !== 'color-samificator-data') {
                            el.remove();
                        }
                    }); 

                    // Inline State
                    const stateScript = document.createElement('script'); 
                    stateScript.id = 'color-samificator-state'; 
                    stateScript.type = 'application/json';
                    stateScript.textContent = JSON.stringify(stateData).replace(/<\/script>/gi, '<\\/script>'); 
                    clone.querySelector('head').appendChild(stateScript); 

                    // Inline App Code
                    const appScript = document.createElement('script');
                    appScript.type = 'text/babel';
                    appScript.setAttribute('data-compact', 'true');
                    appScript.textContent = appCode.replace(/<\/script>/gi, '<\\/script>');
                    clone.querySelector('body').appendChild(appScript);

                    if (styleCode) {
                        const styleNode = document.createElement('style');
                        styleNode.textContent = styleCode;
                        clone.querySelector('head').appendChild(styleNode);
                        
                        // remove the link to styles.css since it's now embedded
                        const linkNode = clone.querySelector('link[href*="styles.css"]');
                        if (linkNode) linkNode.remove();
                    }

                    const htmlContent = "<!DOCTYPE html>\n" + clone.outerHTML; 
                    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' }); const url = URL.createObjectURL(blob); 
                    const a = document.createElement('a'); a.href = url; a.download = filename; 
                    document.body.appendChild(a);
                    a.click(); 
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url); 
                } catch (err) {
                    console.error("Export failed:", err);
                    alert("Export failed: " + err.message);
                }
            };
            
            const handleSystemExport = () => { 
                if (!gridData) return; 
                const fmt = (v, d = 4) => isNaN(v) ? "0" : Number(v).toFixed(d); 
                const addRow = (type, id, L, C, H, erpCode, layer, adj, noun, note, locked, tags, spectral, measMeta) => { 
                    const c = new Color("oklch", [L, C, H]); 
                    const oklab = c.to('oklab').coords;
                    const lab = c.to('lab').coords;
                    const lch = c.to('lch').coords;
                    const xyz50 = c.to('xyz-d50').coords;
                    const xyz65 = c.to('xyz-d65').coords;
                    const srgb = c.to('srgb').coords;
                    const hsl = c.to('hsl').coords;
                    const hex = c.clone().toGamut({space: "srgb"}).toString({format: "hex"}).toUpperCase();
                    const majorGroup = getColorGroup(L, C, H, groupSettings); 
                    const mm = measMeta || {};
                    const row = { Type: type, ID: id, ERP_Code: erpCode, Major_Group: majorGroup, Layer: layer, Adjective: adj || '', Noun: noun || '', Note: note || '', Locked: locked ? 'TRUE' : 'FALSE', Tags: tags ? tags.join(', ') : '', Illuminant: mm.illuminant || illuminant, Observer: mm.observer || observer, Measurement_Method: mm.method || '', Measurement_Date: mm.date || '', Measurement_Device: mm.device || '', OKLCH_L: fmt(L, 5), OKLCH_C: fmt(C, 5), OKLCH_H: fmt(H, 5), OKLAB_L: fmt(oklab[0], 5), OKLAB_a: fmt(oklab[1], 5), OKLAB_b: fmt(oklab[2], 5), CIE_LAB_L: fmt(lab[0], 5), CIE_LAB_a: fmt(lab[1], 5), CIE_LAB_b: fmt(lab[2], 5), CIE_LCH_L: fmt(lch[0], 5), CIE_LCH_C: fmt(lch[1], 5), CIE_LCH_H: fmt(lch[2], 5), XYZ_D50_X: fmt(xyz50[0], 5), XYZ_D50_Y: fmt(xyz50[1], 5), XYZ_D50_Z: fmt(xyz50[2], 5), XYZ_D65_X: fmt(xyz65[0], 5), XYZ_D65_Y: fmt(xyz65[1], 5), XYZ_D65_Z: fmt(xyz65[2], 5), HEX: hex, sRGB_R: Math.round(srgb[0]*255), sRGB_G: Math.round(srgb[1]*255), sRGB_B: Math.round(srgb[2]*255), HSL_H: fmt(hsl[0], 2), HSL_S: fmt(hsl[1], 2), HSL_L: fmt(hsl[2], 2) }; 
                    SPECTRAL_TABLES.wavelengths.forEach((w, i) => {
                        row[`R${w} nm`] = (spectral && Array.isArray(spectral) && spectral[i] !== undefined) ? spectral[i].toExponential(8) : '';
                    });
                    return row;
                };
                const rows = []; 
                gridData.baseAnchors.forEach(a => { 
                    const processL = (ref, pref) => { 
                        if (!ref) return; 
                        const id = `${pref}-${a.cStr}-${a.hStr}`; 
                        const lStr = ref.lStr;
                        const isLocked = lockedNouns[id] && lockedAdjectives[lStr]; 
                        rows.push(addRow('ANCHOR', id, ref.L, a.C, a.H, ref.erpCode, getLayerName(pref), adjectives[lStr] || '', names[id] || '', dictNotes[id] || '', isLocked, dictTags[id], ref.spectral)); 
                    }; 
                    processL(a.ultraLightRef, 'UL'); processL(a.lightRef, 'L'); processL(a.darkRef, 'D'); processL(a.ultraDarkRef, 'UD'); 
                }); 
                Object.entries(adjectives).forEach(([lStr, adj]) => {
                    if (adj) {
                        const L = parseInt(lStr, 10) / 100;
                        rows.push(addRow('ADJECTIVE', lStr, L, 0, 0, `${lStr}00000`, 'Layer', adj, '', '', false, []));
                    }
                });
                Object.values(savedColors).forEach(savedCol => { 
                    if (savedCol.type === 'pin') { 
                        rows.push(addRow('PIN', savedCol.id, savedCol.L, savedCol.C, savedCol.H, savedCol.erpCode, getLayerName(getNounPrefix(savedCol.L, savedCol.C)), savedCol.adjOverride, savedCol.nameOverride, savedCol.notes, true, dictTags[savedCol.id], savedCol.spectral, { illuminant: savedCol.illuminant, observer: savedCol.observer, method: savedCol.measurementMethod, date: savedCol.measurementDate, device: savedCol.measurementDevice })); 
                    } 
                }); 
                if (groupSettings) { 
                    rows.push({ Type: 'SETTING', ID: 'lightL', OKLCH_L: groupSettings.lightL }); 
                    rows.push({ Type: 'SETTING', ID: 'neutralC', OKLCH_C: groupSettings.neutralC }); 
                    rows.push({ Type: 'SETTING', ID: 'vividC', OKLCH_C: groupSettings.vividC }); 
                    (groupSettings.neutrals || []).forEach(n => rows.push({ Type: 'NEUTRAL_REGION', ID: n.id, Noun: n.name, OKLCH_L: n.maxL })); 
                    (groupSettings.hues || []).forEach(h => rows.push({ Type: 'HUE_REGION', ID: h.id, Noun: h.name, OKLCH_H: h.maxH })); 
                    (groupSettings.overrides || []).forEach(o => rows.push({ Type: 'OVERRIDE', ID: o.id, Adjective: o.condition, Noun: o.name })); 
                } 
                (savedPalettes || []).forEach(p => {
                    rows.push({ Type: 'PALETTE', ID: p.id, Noun: p.name, Note: JSON.stringify(p.colors) });
                });
                const csv = Papa.unparse(rows); 
                const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); 
                const a = document.createElement('a'); a.href = url; a.download = `oklch_studio_system.csv`; a.click(); 
            };
            
            const handleSyncToCSV = async () => {
                if (!gridData || !colorData) return;
                try {
                    const zip = new JSZip();

                    const anchorsCsv = [];
                    const pinsCsv = [];
                    
                    Object.values(savedColors).filter(sc => sc.type === 'anchor').forEach(sc => {
                        anchorsCsv.push({
                            Type: 'ANCHOR', ID: sc.anchorId, Noun: names[sc.anchorId] || '', Adjective: adjectives[sc.adjId] || '', Note: dictNotes[sc.anchorId] || '', Tags: (dictTags[sc.anchorId] || []).join(','), Locked: 'TRUE', OKLCH_L: sc.L, OKLCH_C: sc.C, OKLCH_H: sc.H, ERP_Code: sc.erpCode, Spectral: sc.spectral ? JSON.stringify(sc.spectral) : ''
                        });
                    });
                    
                    Object.keys(names).forEach(id => {
                        if (!anchorsCsv.find(a => a.ID === id && a.Type === 'ANCHOR')) {
                            anchorsCsv.push({ Type: 'GRID', ID: id, Noun: names[id] || '', Note: dictNotes[id] || '', Tags: (dictTags[id] || []).join(',') });
                        }
                    });
                    
                    Object.keys(adjectives).forEach(adjId => {
                        anchorsCsv.push({ Type: 'ADJECTIVE', ID: adjId, Adjective: adjectives[adjId] || '' });
                    });

                    Object.values(savedColors).filter(sc => sc.type === 'pin').forEach(sc => {
                        pinsCsv.push({
                            Type: 'PIN', ID: sc.id, Noun: sc.nameOverride || '', Adjective: sc.adjOverride || '', Note: sc.notes || '', Tags: (dictTags[sc.id] || []).join(','), OKLCH_L: sc.L, OKLCH_C: sc.C, OKLCH_H: sc.H, ERP_Code: sc.erpCode, Spectral: sc.spectral ? JSON.stringify(sc.spectral) : '', Illuminant: sc.illuminant || '', Observer: sc.observer || '', Measurement_Method: sc.measurementMethod || '', Measurement_Date: sc.measurementDate || '', Measurement_Device: sc.measurementDevice || ''
                        });
                    });
                    
                    zip.file('data/anchors.csv', Papa.unparse(anchorsCsv));
                    zip.file('data/pins.csv', Papa.unparse(pinsCsv));

                    Object.keys(colorData).forEach((brand) => {
                        const brandData = colorData[brand].map(color => {
                            const row = {
                                Type: 'DB', Adjective: brand, Noun: color.name || '', HEX: color.hex || '', OKLCH_L: color.L !== undefined ? color.L : '', OKLCH_C: color.C !== undefined ? color.C : '', OKLCH_H: color.H !== undefined ? color.H : '', ERP_Code: color.url || '', Note: color.image || '',
                                Illuminant: color.illuminant || '',
                                Observer: color.observer || '',
                                Measurement_Method: color.measurementMethod || '',
                                Measurement_Date: color.measurementDate || '',
                                Measurement_Device: color.measurementDevice || ''
                            };
                            SPECTRAL_TABLES.wavelengths.forEach((w, i) => {
                                row[`R${w} nm`] = (color.spectral && Array.isArray(color.spectral) && color.spectral[i] !== undefined) ? color.spectral[i].toExponential(8) : '';
                            });
                            row.Spectral = color.spectral ? JSON.stringify(color.spectral) : '';
                            return row;
                        });
                        zip.file(`data/${brand}.csv`, Papa.unparse(brandData));
                    });
                    
                    const content = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(content);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'color_samificator_csvs.zip';
                    a.click();
                    URL.revokeObjectURL(url);
                    
                } catch (e) {
                    console.error(e);
                    alert('Failed downloading CSVs: ' + e.message);
                }
            };

            const handleSystemImport = (e) => { 
                const file = e.target.files[0]; 
                if (!file) return; 
                Papa.parse(file, { 
                    header: true, skipEmptyLines: true, 
                    complete: (results) => { 
                        const newNames = { ...names }; const newAdjs = { ...adjectives }; const newNotes = { ...dictNotes }; const newSavedColors = { ...savedColors }; const newTags = { ...dictTags }; 
                        const newSavedPalettes = [...savedPalettes];
                        const newColorData = colorData ? JSON.parse(JSON.stringify(colorData)) : {};
                        const parsedSettings = { lightL: groupSettings.lightL, neutralC: groupSettings.neutralC, vividC: groupSettings.vividC, neutrals: [], hues: [], overrides: [] };
                        let hasImportedSettings = false, hasNeutrals = false, hasHues = false, hasOverrides = false, hasImportedPalettes = false;
                        results.data.forEach(row => { 
                            let targetType = String(row.Type || '').toUpperCase().trim();
                            if (targetType === 'SETTING') { 
                                hasImportedSettings = true; 
                                if (row.ID === 'lightL') parsedSettings.lightL = parseFloat(row.OKLCH_L); 
                                if (row.ID === 'neutralC') parsedSettings.neutralC = parseFloat(row.OKLCH_C); 
                                if (row.ID === 'vividC') parsedSettings.vividC = parseFloat(row.OKLCH_C); 
                            } 
                            else if (targetType === 'NEUTRAL_REGION') { hasImportedSettings = true; hasNeutrals = true; parsedSettings.neutrals.push({ id: row.ID || crypto.randomUUID(), name: row.Noun || '', maxL: parseFloat(row.OKLCH_L) || 0 }); } 
                            else if (targetType === 'HUE_REGION') { hasImportedSettings = true; hasHues = true; parsedSettings.hues.push({ id: row.ID || crypto.randomUUID(), name: row.Noun || '', maxH: parseFloat(row.OKLCH_H) || 0 }); } 
                            else if (targetType === 'OVERRIDE') { hasImportedSettings = true; hasOverrides = true; parsedSettings.overrides.push({ id: row.ID || crypto.randomUUID(), condition: row.Adjective || '', name: row.Noun || '' }); } 
                            else if (targetType === 'PALETTE') { 
                                hasImportedPalettes = true; 
                                try { 
                                    const colors = JSON.parse(row.Note || '[]'); 
                                    const existingIdx = newSavedPalettes.findIndex(p => p.id === row.ID); 
                                    if (existingIdx >= 0) { 
                                        newSavedPalettes[existingIdx] = { id: row.ID, name: row.Noun || 'Imported Palette', colors }; 
                                    } else { 
                                        newSavedPalettes.push({ id: row.ID || crypto.randomUUID(), name: row.Noun || 'Imported Palette', colors }); 
                                    } 
                                } catch (e) {} 
                            }
                        });
                        
                        const importGridData = generateGridData(parsedSettings.lightL, parsedSettings.neutralC, parsedSettings.vividC, 
                            hasNeutrals ? parsedSettings.neutrals : groupSettings.neutrals, 
                            hasHues ? parsedSettings.hues : groupSettings.hues, 
                            hasOverrides ? parsedSettings.overrides : groupSettings.overrides
                        );

                        results.data.forEach(row => { 
                            let pL = null, pC = null, pH = null;
                            let spectral = null;
                            const spectralValues = SPECTRAL_TABLES.wavelengths.map(w => {
                                const val = row[`R${w} nm`];
                                const parsed = parseFloat(val);
                                return isNaN(parsed) ? null : parsed;
                            });
                            if (spectralValues.every(v => v !== null)) {
                                spectral = spectralValues;
                                // For the internal OKLCH representation, always use D65/2deg as the standard reference.
                                // This ensures that the same spectral data always maps to the same OKLCH coordinates,
                                // regardless of the measurement conditions reported in the CSV.
                                const xyzStandard = calculateXYZFromSpectral(spectral, 2, 'D65');
                                const tc = new Color('xyz-d65', xyzStandard).to('oklch');
                                pL = Math.max(0, Math.min(1, tc.coords[0]));
                                pC = Math.max(0, Math.min(0.3, tc.coords[1]));
                                pH = isNaN(tc.coords[2]) ? 0 : (tc.coords[2] % 360 + 360) % 360;
                            } else {
                                try {
                                    let tc;
                                    if (row.OKLCH_L && row.OKLCH_C && row.OKLCH_H) { tc = new Color("oklch", [parseFloat(row.OKLCH_L), parseFloat(row.OKLCH_C), parseFloat(row.OKLCH_H)]); } 
                                    else if (row.HEX) { let ch = String(row.HEX).trim(); if (!ch.startsWith('#')) ch = '#' + ch; tc = new Color(ch); } 
                                    if (tc) { const o = tc.to('oklch'); pL = Math.max(0, Math.min(1, o.coords[0])); pC = Math.max(0, Math.min(0.3, o.coords[1])); pH = isNaN(o.coords[2]) ? 0 : (o.coords[2] % 360 + 360) % 360; }
                                } catch (err) {}
                            }
                            let targetType = String(row.Type || '').toUpperCase().trim(); if (!targetType && pL !== null) targetType = 'PIN';
                            
                            if (targetType === 'DB' || targetType === 'BRAND' || targetType === 'SPECTRAL') {
                                const brandRaw = (row.Adjective || row.Brand || '').trim();
                                const name = (row.Noun || row.Name || '').trim() || 'Unnamed';
                                const url = (row.ERP_Code || row.URL || '').trim();
                                const image = (row.Note || row.Image || '').trim();
                                
                                const finalBrand = normalizeBrandKey(brandRaw) || brandRaw;

                                if (finalBrand) {
                                    const hex = row.HEX || (pL !== null ? new Color("oklch", [pL, pC, pH]).clone().toGamut({space: "srgb"}).toString({format: "hex"}) : '#B1BC83');
                                    if (!newColorData[finalBrand]) newColorData[finalBrand] = [];
                                    const existingIdx = newColorData[finalBrand].findIndex(c => c.name.toLowerCase() === name.toLowerCase());
                                    const colorObj = { name, hex, L: pL !== null ? pL : 0.5, C: pC !== null ? pC : 0, H: pH !== null ? pH : 0 };
                                    if (spectral) colorObj.spectral = spectral;
                                    if (url) colorObj.url = url;
                                    if (image) colorObj.image = image;
                                    if (existingIdx >= 0) newColorData[finalBrand][existingIdx] = { ...newColorData[finalBrand][existingIdx], ...colorObj };
                                    else newColorData[finalBrand].push(colorObj);
                                }
                            } else if (targetType === 'PIN' && pL !== null && importGridData) { 
                                let pinId = row.ID || crypto.randomUUID(); 
                                const a = pC * Math.sin(pH * Math.PI / 180);
                                const b = pC * Math.cos(pH * Math.PI / 180);
                                let minGridDist = Infinity, closestGridPt = null;
                                for (const pt of importGridData.allPoints) {
                                    const d = Math.sqrt(Math.pow(pL - pt.L, 2) + Math.pow(a - pt.a, 2) + Math.pow(b - pt.b, 2));
                                    if (d < minGridDist) { minGridDist = d; closestGridPt = pt; }
                                }
                                if (closestGridPt) {
                                    const gridPrefix = getNounPrefix(closestGridPt.L, closestGridPt.C);
                                    const anchorId = `${gridPrefix}-${closestGridPt.cStr}-${closestGridPt.hStr}`;
                                    const adjId = closestGridPt.lStr;
                                    newSavedColors[pinId] = { id: pinId, type: 'pin', L: pL, C: pC, H: pH, nameOverride: row.Noun || '', adjOverride: row.Adjective || '', notes: row.Note || '', erpCode: getExactErpCode(pL, pC, pH), adjId, anchorId, color: new Color("oklch", [pL, pC, pH]).clone().toGamut({space: "srgb"}).toString({format: "hex"}), a, b, spectral }; 
                                    if (row.Tags) newTags[pinId] = row.Tags.split(',').map(t => t.trim()).filter(Boolean); 
                                }
                            } else if ((targetType === 'GRID' || targetType === 'ANCHOR') && row.ID) { 
                                if (row.Noun !== undefined && row.Noun !== '') newNames[row.ID] = row.Noun; 
                                if (row.Note !== undefined && row.Note !== '') newNotes[row.ID] = row.Note; 
                                if (row.Tags) newTags[row.ID] = row.Tags.split(',').map(t => t.trim()).filter(Boolean); 
                                
                                let lStr = null;
                                if (row.Adjective !== undefined && row.Adjective !== '') {
                                    if (pL !== null) {
                                        lStr = getLStr(pL);
                                    } else if (row.ERP_Code && row.ERP_Code.length >= 2) {
                                        lStr = row.ERP_Code.substring(0, 2);
                                    }
                                    if (lStr) newAdjs[lStr] = row.Adjective;
                                }
                                
                                if (String(row.Locked).toUpperCase() === 'TRUE' && pL !== null && pC !== null && pH !== null) {
                                    const anchorId = row.ID;
                                    const adjId = lStr || getLStr(pL);
                                    const a = pC * Math.sin(pH * Math.PI / 180);
                                    const b = pC * Math.cos(pH * Math.PI / 180);
                                    newSavedColors[anchorId] = {
                                        id: anchorId,
                                        type: 'anchor',
                                        L: pL, C: pC, H: pH, a, b,
                                        erpCode: row.ERP_Code || getExactErpCode(pL, pC, pH),
                                        adjId, anchorId,
                                        nameOverride: '', adjOverride: '', notes: '',
                                        color: new Color("oklch", [pL, pC, pH]).clone().toGamut({space: "srgb"}).toString({format: "hex"})
                                    };
                                }
                            } else if (targetType === 'ADJECTIVE') {
                                if (row.Adjective !== undefined && row.Adjective !== '') {
                                    let lStr = null;
                                    if (pL !== null) {
                                        lStr = getLStr(pL);
                                    } else if (row.ERP_Code && row.ERP_Code.length >= 2) {
                                        lStr = row.ERP_Code.substring(0, 2);
                                    } else {
                                        lStr = row.ID;
                                    }
                                    if (lStr) newAdjs[lStr] = row.Adjective;
                                }
                            } 
                        }); 
                        if (hasImportedSettings) { setGroupSettings({ lightL: parsedSettings.lightL, neutralC: parsedSettings.neutralC, vividC: parsedSettings.vividC, neutrals: hasNeutrals ? parsedSettings.neutrals : groupSettings.neutrals, hues: hasHues ? parsedSettings.hues : groupSettings.hues, overrides: hasOverrides ? parsedSettings.overrides : groupSettings.overrides }); }
                        if (hasImportedPalettes) { setSavedPalettes(newSavedPalettes); }
                        setNames(newNames); setAdjectives(newAdjs); setDictNotes(newNotes); setSavedColors(newSavedColors); setDictTags(newTags); if (Object.keys(newColorData).length > 0) { updateColorData(newColorData); } e.target.value = ''; 
                    } 
                }); 
            };
            
            const addToPalette = () => { 
                if (!crosshair) return; 
                const pinId = crosshair.activeSavedColor?.type === 'pin' ? crosshair.activeSavedColor.id : null;
                const newItem = { id: crypto.randomUUID(), L: scrubL, C: scrubC, H: scrubH, erpCode: crosshair.activeErpCode, adjId: crosshair.nearestAdjId, nounId: crosshair.nearestAnchorId, pinId }; 
                setPalette(prev => [...prev, newItem]); 
            };
            
            const removeFromPalette = (id) => setPalette(prev => prev.filter(item => item.id !== id));

            const saveCurrentPalette = () => {
                if (palette.length === 0) return;
                setIsSavingPalette(true);
                setNewPaletteName(`Palette ${savedPalettes.length + 1}`);
            };

            const confirmSavePalette = () => {
                if (!newPaletteName.trim()) return;
                const newPalette = { id: crypto.randomUUID(), name: newPaletteName.trim(), colors: [...palette], createdAt: new Date().toISOString() };
                setSavedPalettes(prev => [...prev, newPalette]);
                setSelectedSavedPaletteId(newPalette.id);
                setIsSavingPalette(false);
                setNewPaletteName("");
            };

            const cancelSavePalette = () => {
                setIsSavingPalette(false);
                setNewPaletteName("");
            };

            const loadPalette = (e) => {
                const id = e.target.value;
                setSelectedSavedPaletteId(id);
                if (!id) return;
                const p = savedPalettes.find(p => p.id === id);
                if (p) {
                    setPalette(p.colors);
                }
            };

            const deleteSavedPalette = () => {
                if (!selectedSavedPaletteId) return;
                setSavedPalettes(prev => prev.filter(p => p.id !== selectedSavedPaletteId));
                setSelectedSavedPaletteId("");
            };
            
            const replaceInPalette = (id) => { 
                if (!crosshair) return; 
                const pinId = crosshair.activeSavedColor?.type === 'pin' ? crosshair.activeSavedColor.id : null;
                setPalette(prev => prev.map(item => item.id === id ? { ...item, L: scrubL, C: scrubC, H: scrubH, erpCode: crosshair.activeErpCode, adjId: crosshair.nearestAdjId, nounId: crosshair.nearestAnchorId, pinId } : item)); 
            };

            const isLight = scrubL > 0.65; 
            const activeColorObj = new Color("oklch", [scrubL, scrubC, scrubH]); 
            let labCoords;
            const spectral = crosshair?.activeSavedColor?.spectral || crosshair?.temporarySpectral;
            if (spectral) {
                const varXYZ = calculateXYZFromSpectral(spectral, observer, illuminant);
                const wp = getWhitePoint(observer, illuminant);
                labCoords = xyzToLab(varXYZ, wp);
            } else {
                const targetXyzSpace = illuminant === 'D50' ? 'xyz-d50' : 'xyz-d65';
                const varXYZ = activeColorObj.to(targetXyzSpace).coords;
                const wp = getWhitePoint(observer, illuminant);
                labCoords = xyzToLab(varXYZ, wp);
            }
            const labValues = `${labCoords[0].toFixed(1)}, ${labCoords[1].toFixed(1)}, ${labCoords[2].toFixed(1)}`; 
            const colorGroup = getColorGroup(scrubL, scrubC, scrubH, groupSettings); 
            const isOutOfGamut = !activeColorObj.inGamut('srgb');
            const crosshairHex = activeColorObj.clone().toGamut({space: "srgb"}).toString({format: "hex"}).toUpperCase();
            
            const getInheritedData = (sc) => {
                if (!sc) return null;
                if (!sc.parentPinId || !savedColors[sc.parentPinId]) {
                    const cb = getInheritedPinNames(sc, savedColors, names, adjectives);
                    const parsedAdj = cb.displayAdj === 'Unnamed' ? '' : cb.displayAdj;
                    const parsedName = cb.displayName === 'Unnamed' ? '' : cb.displayName;
                    return {
                        adj: parsedAdj,
                        name: parsedName,
                        notes: sc.notes || dictNotes[cb.sourceId] || '',
                        source: cb.source,
                        sourceId: cb.sourceId
                    };
                }
                const parent = savedColors[sc.parentPinId];
                const parentData = getInheritedData(parent);
                return {
                    adj: parent.adjOverride || parentData.adj,
                    name: parent.nameOverride || parentData.name,
                    notes: parent.notes || parentData.notes,
                    source: 'pin',
                    sourceId: parent.id
                };
            };

            const activeData = useMemo(() => {
                if (!crosshair?.activeSavedColor) {
                    if (crosshair?.closestGridPt?.isPin) {
                        const pinSc = savedColors[crosshair.closestGridPt.pinId];
                        const inherited = getInheritedData(pinSc);
                        return {
                            adj: pinSc.adjOverride || inherited.adj,
                            name: pinSc.nameOverride || inherited.name,
                            notes: pinSc.notes || inherited.notes,
                            inherited
                        };
                    }
                    return {
                        adj: adjectives[crosshair?.nearestAdjId] || '',
                        name: names[crosshair?.nearestAnchorId] || '',
                        notes: dictNotes[crosshair?.nearestAnchorId] || ''
                    };
                }
                const sc = crosshair.activeSavedColor;
                if (sc.type === 'anchor') {
                    return {
                        adj: adjectives[sc.adjId] || '',
                        name: names[sc.anchorId] || '',
                        notes: dictNotes[sc.anchorId] || ''
                    };
                } else if (sc.type === 'nounColumn') {
                    return {
                        adj: adjectives[crosshair?.nearestAdjId] || adjectives[getLStr(crosshair?.rawL)] || '',
                        name: names[sc.id] || sc.nameOverride,
                        notes: dictNotes[sc.id] || sc.notes
                    };
                }
                // It's a pin
                const inherited = getInheritedData(sc);
                return {
                    adj: sc.adjOverride || inherited.adj,
                    name: sc.nameOverride || inherited.name,
                    notes: sc.notes || inherited.notes,
                    inherited
                };
            }, [crosshair, savedColors, adjectives, names, dictNotes]);

            const activeAdj = activeData.adj;
            const activeName = activeData.name;
            const activeNotes = activeData.notes;
            
            const isPinned = crosshair?.exactSavedColor?.type === 'pin'; 
            const isAnchorLocked = crosshair ? lockedAdjectives[crosshair.nearestAdjId] && lockedNouns[crosshair.nearestAnchorId] : false; 
            const isInputDisabled = crosshair?.activeSavedColor?.type === 'anchor' || (!crosshair?.activeSavedColor && crosshair && lockedAdjectives[crosshair.nearestAdjId] && lockedNouns[crosshair.nearestAnchorId]);
            
            const activeItemId = crosshair?.activeSavedColor?.type === 'pin' ? crosshair.activeSavedColor.id : crosshair?.nearestAnchorId; 
            const activeTags = activeItemId ? (dictTags[activeItemId] || []) : []; 
            const addTag = (tag) => { if (activeItemId) setDictTags(prev => ({...prev, [activeItemId]: Array.from(new Set([...(prev[activeItemId]||[]), tag]))})); };
            const removeTag = (tag) => { if (activeItemId) setDictTags(prev => ({...prev, [activeItemId]: (prev[activeItemId]||[]).filter(t => t !== tag)})); };
            
            const adjInputClass = `name-input w-full bg-transparent text-center text-xs font-bold uppercase tracking-[0.2em] focus:outline-none drop-shadow-md pointer-events-auto ${getGlobalDuplicate(names, adjectives, crosshair?.activeSavedColor?.type === 'pin' ? crosshair.activeSavedColor.id : crosshair?.nearestAdjId, activeAdj, savedColors, crosshair?.activeSavedColor?.type === 'pin' ? !!crosshair.activeSavedColor.adjOverride : true, crosshair?.activeSavedColor?.type === 'pin' ? crosshair?.nearestAdjId : null) ? '!text-red-500' : (isPinned && !crosshair?.exactSavedColor.adjOverride ? 'opacity-40 italic' : '')}`;
            const nounInputClass = `name-input w-full bg-transparent text-center text-2xl font-black uppercase tracking-widest focus:outline-none drop-shadow-md -mt-1 pointer-events-auto ${getGlobalDuplicate(names, adjectives, crosshair?.activeSavedColor?.type === 'pin' ? crosshair.activeSavedColor.id : crosshair?.nearestAnchorId, activeName, savedColors, crosshair?.activeSavedColor?.type === 'pin' ? !!crosshair.activeSavedColor.nameOverride : true, crosshair?.activeSavedColor?.type === 'pin' ? crosshair?.nearestAnchorId : null) ? '!text-red-500' : (isPinned && !crosshair?.exactSavedColor.nameOverride ? 'opacity-40 italic' : '')}`;

            let deltaEOK = null;
            let deltaE2000 = null; 
            if (compSlotA && compSlotB) { 
                const cA = new Color("oklch", [compSlotA.L, compSlotA.C, compSlotA.H]); 
                const cB = new Color("oklch", [compSlotB.L, compSlotB.C, compSlotB.H]); 
                deltaEOK = (cA.deltaE(cB, "OK") * 100).toFixed(2); 
                deltaE2000 = cA.deltaE(cB, "2000").toFixed(2); 
            }

            return (
                <AppUI 
                    theme={theme} setTheme={setTheme} activeTab={activeTab} setActiveTab={setActiveTab}
                    names={names} setNames={setNames} adjectives={adjectives} setAdjectives={setAdjectives}
                    dictNotes={dictNotes} setDictNotes={setDictNotes} dictTags={dictTags} setDictTags={setDictTags}
                    savedColors={savedColors} setSavedColors={setSavedColors} groupSettings={groupSettings} setGroupSettings={setGroupSettings}
                    palette={palette} setPalette={setPalette} savedPalettes={savedPalettes} setSavedPalettes={setSavedPalettes}
                    selectedSavedPaletteId={selectedSavedPaletteId} setSelectedSavedPaletteId={setSelectedSavedPaletteId}
                    isSavingPalette={isSavingPalette} setIsSavingPalette={setIsSavingPalette}
                    newPaletteName={newPaletteName} setNewPaletteName={setNewPaletteName}
                    searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                    selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                    observer={observer} setObserver={setObserver}
                    illuminant={illuminant} setIlluminant={setIlluminant}
                    handleBatchTag={handleBatchTag} handleBatchRemoveTag={handleBatchRemoveTag}
                    viewportFilter={viewportFilter} setViewportFilter={setViewportFilter}
                    viewportSearchQuery={viewportSearchQuery} setViewportSearchQuery={setViewportSearchQuery}
                    viewMode={viewMode} setViewMode={setViewMode}
                    swatchLayout={swatchLayout} setSwatchLayout={setSwatchLayout}
                    swatchZoom={swatchZoom} setSwatchZoom={setSwatchZoom}
                    viewportTagFilter={viewportTagFilter} setViewportTagFilter={setViewportTagFilter}
                    scrubL={scrubL} setScrubL={setScrubL} scrubC={scrubC} setScrubC={setScrubC} scrubH={scrubH} setScrubH={setScrubH} setTemporarySpectral={setTemporarySpectral}
                    compSlotA={compSlotA} setCompSlotA={setCompSlotA} compSlotB={compSlotB} setCompSlotB={setCompSlotB}
                    showFullscreenPreview={showFullscreenPreview} setShowFullscreenPreview={setShowFullscreenPreview}
                    showCompareFullscreen={showCompareFullscreen} setShowCompareFullscreen={setShowCompareFullscreen}
                    showFullscreenPalette={showFullscreenPalette} setShowFullscreenPalette={setShowFullscreenPalette}
                    showCompareDivider={showCompareDivider} setShowCompareDivider={setShowCompareDivider}
                    showHelpPanel={showHelpPanel} setShowHelpPanel={setShowHelpPanel}
                    showDatabaseManager={showDatabaseManager} setShowDatabaseManager={setShowDatabaseManager}
                    showFileManager={showFileManager} setShowFileManager={setShowFileManager}
                    linkedFiles={linkedFiles} setLinkedFiles={setLinkedFiles}
                    colorData={colorData} updateColorData={updateColorData}
                    visualizeData={visualizeData} setVisualizeData={setVisualizeData}
                    history={history} isUndoing={isUndoing} currentStateStr={currentStateStr}
                    handleUndo={handleUndo} handleRedo={handleRedo} canUndo={canUndo} canRedo={canRedo}
                    lockedNouns={lockedNouns} lockedAdjectives={lockedAdjectives}
                    filteredViewData={filteredViewData} handleUpdate={handleUpdate} handlePointClick={handlePointClick} handleVisualize={handleVisualize}
                    crosshair={crosshair} gridData={gridData}
                    isLight={isLight} activeColorObj={activeColorObj} labValues={labValues} colorGroup={colorGroup}
                    isOutOfGamut={isOutOfGamut} crosshairHex={crosshairHex}
                    activeData={activeData}
                    activeAdj={activeAdj} activeName={activeName} activeNotes={activeNotes}
                    isPinned={isPinned} isAnchorLocked={isAnchorLocked} isInputDisabled={isInputDisabled}
                    activeItemId={activeItemId} activeTags={activeTags} addTag={addTag} removeTag={removeTag}
                    adjInputClass={adjInputClass} nounInputClass={nounInputClass}
                    deltaEOK={deltaEOK} deltaE2000={deltaE2000} tabs={tabs} searchResults={searchResults}
                    handleSaveApp={handleSaveApp} handleSystemExport={handleSystemExport} handleImportCSV={handleSystemImport} handleSyncToCSV={handleSyncToCSV}
                    addToPalette={addToPalette} removeFromPalette={removeFromPalette}
                    saveCurrentPalette={saveCurrentPalette} confirmSavePalette={confirmSavePalette} cancelSavePalette={cancelSavePalette}
                    loadPalette={loadPalette} deleteSavedPalette={deleteSavedPalette} replaceInPalette={replaceInPalette}
                    onAdjChange={onAdjChange} onNameChange={onNameChange} onNotesChange={onNotesChange}
                    toggleAnchorLock={toggleAnchorLock} togglePin={togglePin}
                    updateSavedColor={updateSavedColor} spectral={spectral}
                    tetheringPinId={tetheringPinId} setTetheringPinId={setTetheringPinId}
                />
            );
        };
        
        
        

const ViewDatabase = ({ colorData, updateColorData, swatchLayout, swatchZoom, handlePointClick, crosshair, searchTerm, tagFilter }) => {
            const [sortBy, setSortBy] = useState('brand');
            const [sortAsc, setSortAsc] = useState(true);
            const [spectralFilter, setSpectralFilter] = useState(false);
            const [dbAxis, setDbAxis] = useState('HxL');
            const [brandFilter, setBrandFilter] = useState('');
            
            const [userEnableDeltaE, setUserEnableDeltaE] = useState(false);
            const [maxDeltaE, setMaxDeltaE] = useState(5.0);
            
            // Delta E is always active when "all brands" is selected
            const enableDeltaE = !brandFilter || userEnableDeltaE;
            
            const [fullscreenImage, setFullscreenImage] = useState(null);
            const [editingItem, setEditingItem] = useState(null);
            
            const baseMatrixSize = 48;
            const baseListSize = 48;

            const allDbItems = useMemo(() => {
                if (!colorData) return [];
                let items = [];
                Object.keys(colorData).forEach(brand => {
                    colorData[brand].forEach((c, idx) => {
                        let L = c.L;
                        let C = c.C;
                        let H = c.H;
                        
                        let hexVal = c.hex || '#000000';
                        // Fix LCH and recalculate hex if we have spectral info
                        if (c.spectral && c.spectral.length === 31) {
                            try {
                                const xyzStandard = calculateXYZFromSpectral(c.spectral, 2, 'D65');
                                const col = new Color('xyz-d65', xyzStandard).to('oklch');
                                L = Math.max(0, Math.min(1, col.coords[0]));
                                C = Math.max(0, Math.min(0.3, col.coords[1]));
                                H = isNaN(col.coords[2]) ? 0 : (col.coords[2] % 360 + 360) % 360;
                                hexVal = col.to('srgb').toString({format: "hex"});
                            } catch(e) {}
                        } else if (L === undefined || L === null) {
                            let tc;
                            if (c.hex) {
                                try { tc = new Color(c.hex).to('oklch'); } catch(e) {}
                            }
                            if (tc) {
                                L = Math.max(0, Math.min(1, tc.coords[0]));
                                C = Math.max(0, Math.min(0.3, tc.coords[1]));
                                H = isNaN(tc.coords[2]) ? 0 : (tc.coords[2] % 360 + 360) % 360;
                            } else {
                                L = 0.5; C = 0; H = 0;
                            }
                        }

                        items.push({
                            ...c,
                            brand,
                            originalIndex: idx,
                            id: `${brand}-${idx}`,
                            L, C, H,
                            hex: hexVal,
                            displayName: c.name || '',
                            erpCode: c.url || '',
                            hasSpectral: !!c.spectral && c.spectral.length > 0,
                            tags: c.tags || [],
                            spectral: c.spectral,
                            note: c.image || ''
                        });
                    });
                });
                return items;
            }, [colorData]);

            const allBrands = useMemo(() => Array.from(new Set(allDbItems.map(i => i.brand))).sort(), [allDbItems]);
            const allTags = useMemo(() => Array.from(new Set(allDbItems.flatMap(i => i.tags))).sort(), [allDbItems]);

            const sortedItems = useMemo(() => {
                let items = [...allDbItems];
                
                if (enableDeltaE && crosshair) {
                    const center = new Color("oklch", [crosshair.L, crosshair.C, crosshair.H]);
                    items = items.filter(item => {
                        try {
                            const d = center.deltaE(new Color("oklch", [item.L, item.C, item.H]), "OK") * 100;
                            item._d = d;
                            return d <= maxDeltaE;
                        } catch(e) { return false; }
                    });
                }
                
                if (brandFilter) items = items.filter(item => item.brand === brandFilter);
                if (tagFilter) items = items.filter(item => item.tags.includes(tagFilter));
                if (spectralFilter) items = items.filter(item => item.hasSpectral);
                
                if (searchTerm.trim()) {
                    const q = searchTerm.toLowerCase().trim();
                    items = items.filter(item => 
                        item.displayName.toLowerCase().includes(q) || 
                        item.brand.toLowerCase().includes(q) || 
                        item.erpCode.toLowerCase().includes(q) ||
                        (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
                    );
                }

                items = items.map(item => ({
                    ...item,
                    _inGamut: new Color("oklch", [item.L, item.C, item.H]).inGamut("srgb")
                }));

                return items.sort((a, b) => {
                    let valA, valB;
                    switch(sortBy) {
                        case 'deltae': valA = a._d ?? 999; valB = b._d ?? 999; break;
                        case 'name': valA = a.displayName.toLowerCase(); valB = b.displayName.toLowerCase(); break;
                        case 'brand': valA = a.brand.toLowerCase(); valB = b.brand.toLowerCase(); break;
                        case 'lightness': valA = a.L; valB = b.L; break;
                        case 'chroma': valA = a.C; valB = b.C; break;
                        case 'hue': valA = a.H; valB = b.H; break;
                        default: 
                            if (enableDeltaE) { valA = a._d ?? 999; valB = b._d ?? 999; }
                            else { valA = a.brand.toLowerCase(); valB = b.brand.toLowerCase(); }
                            break;
                    }
                    if (valA === valB) return a.H - b.H;
                    if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    return sortAsc ? valA - valB : valB - valA;
                });
            }, [allDbItems, sortBy, sortAsc, tagFilter, searchTerm, brandFilter, spectralFilter, enableDeltaE, maxDeltaE, crosshair]);

            const handleSaveEdit = (e) => {
                e.preventDefault();
                const updated = { ...colorData };
                updated[editingItem.brand][editingItem.originalIndex] = {
                    ...updated[editingItem.brand][editingItem.originalIndex],
                    name: editingItem.displayName,
                    url: editingItem.erpCode,
                    image: editingItem.note,
                    hex: editingItem.hex,
                    tags: editingItem.tags,
                    spectral: editingItem.spectralStr ? editingItem.spectralStr.split(',').map(Number) : updated[editingItem.brand][editingItem.originalIndex].spectral
                };
                
                // Recalculate LCH if Hex or Spectral changed
                let L = updated[editingItem.brand][editingItem.originalIndex].L;
                let C = updated[editingItem.brand][editingItem.originalIndex].C;
                let H = updated[editingItem.brand][editingItem.originalIndex].H;
                let tc;
                if (updated[editingItem.brand][editingItem.originalIndex].spectral && updated[editingItem.brand][editingItem.originalIndex].spectral.length === 31) {
                    try { tc = new Color('xyz-d65', calculateXYZFromSpectral(updated[editingItem.brand][editingItem.originalIndex].spectral, 2, 'D65')).to('oklch'); } catch(e) {}
                }
                if (!tc && editingItem.hex) {
                    try { tc = new Color(editingItem.hex).to('oklch'); } catch(e) {}
                }
                if (tc) {
                    updated[editingItem.brand][editingItem.originalIndex].L = Math.max(0, Math.min(1, tc.coords[0]));
                    updated[editingItem.brand][editingItem.originalIndex].C = Math.max(0, Math.min(0.3, tc.coords[1]));
                    updated[editingItem.brand][editingItem.originalIndex].H = isNaN(tc.coords[2]) ? 0 : (tc.coords[2] % 360 + 360) % 360;
                }
                
                updateColorData(updated);
                setEditingItem(null);
            };

            const handleDeleteItem = (item) => {
                if (confirm(`Delete ${item.displayName} from ${item.brand}?`)) {
                    const updated = { ...colorData };
                    updated[item.brand].splice(item.originalIndex, 1);
                    if (updated[item.brand].length === 0) delete updated[item.brand];
                    updateColorData(updated);
                    setEditingItem(null);
                }
            };
            
            const handleAddBrand = () => {
                const b = prompt("New Brand Name:");
                if (b && !colorData[b]) {
                    updateColorData({ ...colorData, [b]: [] });
                    setBrandFilter(b);
                }
            };
            
            const handleAddColor = () => {
                if (!brandFilter) return alert("Select a brand first");
                const n = prompt("Color Name:");
                if (n) {
                    const updated = { ...colorData };
                    updated[brandFilter].unshift({ name: n, hex: '#888888', L: 0.5, C: 0, H: 0, tags: [], url: '', image: '' });
                    updateColorData(updated);
                }
            };

            const SortButton = ({ field, label }) => (
                <button 
                    onClick={() => { if (sortBy === field) setSortAsc(!sortAsc); else { setSortBy(field); setSortAsc(true); } }} 
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${sortBy === field || (!sortBy && field === 'deltae' && enableDeltaE) ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-transparent'}`}
                >
                    {label}{(sortBy === field || (!sortBy && field === 'deltae' && enableDeltaE)) && <Icon name={sortAsc ? "chevron-up" : "chevron-down"} className="w-3 h-3" />}
                </button>
            );
            
            const renderItems = sortedItems.slice(0, 100);
            
            return (
                <div className="h-full flex flex-col overflow-hidden pt-2 relative bg-slate-50/50 dark:bg-neutral-900/50">
                    <div className="flex flex-col gap-2 px-4 pb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0">
                        <div className="flex flex-wrap items-center gap-2">
                            
                            
                            <SortButton field="brand" label="Brand" />
                            <SortButton field="name" label="Name" />
                            <SortButton field="lightness" label="L" />
                            <SortButton field="chroma" label="C" />
                            <SortButton field="hue" label="H" />
                            <SortButton field="deltae" label="ΔE" />
                            
                            <div className="h-4 w-px bg-slate-300 dark:bg-neutral-700 mx-1"></div>
                            
                            <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[9px] font-bold uppercase tracking-wider rounded px-2 py-1 outline-none">
                                <option value="">All Brands</option>
                                {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            
                            <button onClick={handleAddBrand} className="px-2 py-1 text-[9px] font-bold bg-white dark:bg-neutral-800 hover:bg-slate-100 border border-slate-200 dark:border-neutral-700 uppercase tracking-wider rounded flex items-center gap-1"><Icon name="plus" className="w-3 h-3" /> Brand</button>
                            {brandFilter && <button onClick={handleAddColor} className="px-2 py-1 text-[9px] font-bold bg-sky-500 hover:bg-sky-600 text-white border border-sky-600 uppercase tracking-wider rounded flex items-center gap-1"><Icon name="plus" className="w-3 h-3" /> Color</button>}
                            {brandFilter && <button onClick={() => { if(confirm(`Delete entire brand '${brandFilter}'?`)){ const c = {...colorData}; delete c[brandFilter]; updateColorData(c); setBrandFilter(''); } }} className="px-2 py-1 text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 uppercase tracking-wider rounded flex items-center gap-1"><Icon name="trash-2" className="w-3 h-3" /> Brand</button>}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <input type="checkbox" checked={enableDeltaE} onChange={e => { setUserEnableDeltaE(e.target.checked); if (!brandFilter) setBrandFilter(allBrands[0] || ''); }} disabled={!brandFilter} className="rounded text-sky-500 disabled:opacity-50" title={!brandFilter ? "Delta E is always active when viewing All Brands" : ""} />
                                Filter by &Delta;E to Crosshair {!brandFilter && "(Forced on 'All Brands')"}
                            </label>
                            {enableDeltaE && (
                                <div className="flex items-center gap-2">
                                    <input type="range" min="0" max="25" step="0.1" value={maxDeltaE} onChange={e => setMaxDeltaE(parseFloat(e.target.value))} className="w-32" />
                                    <span className="text-[10px] font-mono w-8">{maxDeltaE.toFixed(2)}</span>
                                </div>
                            )}
                            
                            
                            <button onClick={() => setSpectralFilter(!spectralFilter)} className={`flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded border ${spectralFilter ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-500 border-slate-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400'}`}>
                                <Icon name="activity" className="w-3 h-3" /> Spectral Only
                            </button>
                            <span className="ml-auto text-[10px] font-black uppercase text-slate-400">{sortedItems.length > 100 ? '100 of ' + sortedItems.length : sortedItems.length} matching</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar relative p-4">
                        {renderItems.length === 0 && (
                            <div className="text-center text-slate-400 text-xs w-full p-8 italic">No commercial colors found. Adjust filters or ΔE.</div>
                        )}
                        
                        {swatchLayout === 'matrix' && (
                            <div className="flex flex-col gap-2 h-full">
                                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 rounded-lg shrink-0">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">XY Axis:</span>
                                    <select value={dbAxis} onChange={(e) => setDbAxis(e.target.value)} className="bg-white dark:bg-neutral-800 text-xs font-bold border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 outline-none text-slate-700 dark:text-neutral-300">
                                        <option value="HxL">Hue × Lightness</option>
                                        <option value="CxL">Chroma × Lightness</option>
                                        <option value="HxC">Hue × Chroma</option>
                                    </select>
                                </div>
                                <div className="flex-1 relative">
                                    <ViewportSwatches 
                                        items={renderItems} 
                                        layout="matrix" 
                                        swatchZoom={swatchZoom} 
                                        dim1={dbAxis === 'HxL' ? 'L' : dbAxis === 'CxL' ? 'L' : 'C'}
                                        dim2={dbAxis === 'HxL' ? 'H' : dbAxis === 'CxL' ? 'C' : 'H'} 
                                        dim1Labels={v => (dbAxis === 'HxL' || dbAxis === 'CxL') ? `L: ${v.toFixed(2)}` : `C: ${v.toFixed(2)}`}
                                        dim2Labels={v => (dbAxis === 'HxL' || dbAxis === 'HxC') ? `H: ${v.toFixed(0)}°` : `C: ${v.toFixed(2)}`}
                                        handlePointClick={handlePointClick} 
                                        crosshair={crosshair} 
                                    />
                                </div>
                            </div>
                        )}

                        {swatchLayout === 'list' && (
                            <div className="flex flex-col gap-2">
                                {renderItems.map((item, i) => (
                                    <div key={i} onClick={() => handlePointClick([item.L, item.C, item.H], item.spectral)} className="flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-neutral-800/80 border shadow-sm cursor-pointer hover:border-sky-500 hover:shadow-md transition-all border-slate-200 dark:border-neutral-700/50 group">
                                        <div className="rounded relative flex-shrink-0" style={{ backgroundColor: item.hex, backgroundImage: item.note?.startsWith('http') ? `url(${item.note})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', width: `${baseListSize * swatchZoom}px`, height: `${baseListSize * swatchZoom}px` }}>
                                            {!item._inGamut && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${6 * swatchZoom}px)` }}></div>}
                                            {item.hasSpectral && <div className="absolute -top-1 -right-1 flex justify-center items-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow-sm" style={{ transform: `scale(${swatchZoom})` }}><Icon name="activity" className="w-2.5 h-2.5" /></div>}
                                            
                                            {item.note?.startsWith('http') && (
                                                <button onClick={(e) => { e.stopPropagation(); setFullscreenImage(item.note); }} className="absolute bottom-1 right-1 bg-black/60 hover:bg-black/80 text-white p-1 rounded backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Icon name="eye" className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 bg-slate-100 dark:bg-neutral-800 px-1.5 rounded">{item.brand}</span>
                                                <span className="text-[13px] font-bold uppercase tracking-widest text-slate-800 dark:text-neutral-200 truncate">{item.displayName}</span>
                                                <button onClick={(e) => { e.stopPropagation(); setEditingItem({...item, spectralStr: item.spectral ? item.spectral.join(',') : '' }); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-500 transition-opacity ml-2">
                                                    <Icon name="edit-2" className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <span className="text-[11px] font-mono text-slate-500 dark:text-neutral-400 mt-1 flex items-center gap-2">
                                                {item.erpCode?.startsWith('http') ? (
                                                    <a href={item.erpCode} target="_blank" rel="noopener noreferrer" className="hover:text-sky-500 flex items-center gap-1.5 truncate" onClick={(e) => e.stopPropagation()}>
                                                        <Icon name="external-link" className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{item.erpCode}</span>
                                                    </a>
                                                ) : item.erpCode || 'No Web Link'}
                                            </span>
                                            {item.tags && item.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {item.tags.map(t => <span key={t} className="bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider">{t}</span>)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col justify-center text-right text-[10px] font-mono text-slate-500 dark:text-neutral-400 flex-shrink-0 bg-slate-50 dark:bg-neutral-900 p-2 rounded">
                                            {enableDeltaE && item._d !== undefined && <div className="text-emerald-500 font-bold mb-1 border-b border-emerald-500/20 pb-0.5">ΔEok {item._d.toFixed(2)}</div>}
                                            <div>L: {item.L.toFixed(3)}</div>
                                            <div>C: {item.C.toFixed(3)}</div>
                                            <div>H: {item.H.toFixed(1)}°</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {swatchLayout === 'table' && (
                            <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-700 overflow-hidden">
                                <table className="w-full text-[10px] text-left">
                                    <thead className="bg-slate-50 dark:bg-neutral-900/50 font-bold uppercase tracking-wider">
                                        <tr>
                                            <th className="p-3 w-12 text-center">Color</th>
                                            <th className="p-3">Name</th>
                                            <th className="p-3 w-20">Brand</th>
                                            <th className="p-3 w-40">Web Link</th>
                                            {enableDeltaE && <th className="p-3 w-16 text-right text-emerald-600">ΔEok</th>}
                                            <th className="p-3 w-16 text-right">L</th>
                                            <th className="p-3 w-16 text-right">C</th>
                                            <th className="p-3 w-16 text-right">H</th>
                                            <th className="p-3 w-12">Edit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/50">
                                        {renderItems.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 group cursor-pointer" onClick={() => handlePointClick([item.L, item.C, item.H], item.spectral)}>
                                                <td className="p-1 px-3">
                                                    <div className="w-8 h-8 rounded relative shadow-sm" style={{backgroundColor: item.hex, backgroundImage: item.note?.startsWith('http') ? `url(${item.note})` : 'none', backgroundSize: 'cover' }}>
                                                        {item.note?.startsWith('http') && (
                                                            <button onClick={(e) => { e.stopPropagation(); setFullscreenImage(item.note); }} className="absolute inset-0 flex items-center justify-center bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Icon name="eye" className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {item.hasSpectral && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500"></div>}
                                                    </div>
                                                </td>
                                                <td className="p-2 font-medium">{item.displayName}</td>
                                                <td className="p-2 text-slate-500 font-mono text-[9px]">{item.brand}</td>
                                                <td className="p-2 max-w-[120px] truncate text-[9px] font-mono">
                                                    {item.erpCode?.startsWith('http') ? <a href={item.erpCode} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline" onClick={e=>e.stopPropagation()}>Link</a> : item.erpCode}
                                                </td>
                                                {enableDeltaE && <td className="p-2 text-right text-emerald-600 font-bold font-mono">{item._d?.toFixed(2)}</td>}
                                                <td className="p-2 text-right font-mono text-slate-500">{item.L.toFixed(3)}</td>
                                                <td className="p-2 text-right font-mono text-slate-500">{item.C.toFixed(3)}</td>
                                                <td className="p-2 text-right font-mono text-slate-500">{item.H.toFixed(1)}</td>
                                                <td className="p-2 text-center text-slate-300">
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingItem({...item, spectralStr: item.spectral ? item.spectral.join(',') : '' }); }} className="hover:text-sky-500">
                                                        <Icon name="edit-2" className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {swatchLayout === 'gallery' && (
                            <div className="flex flex-wrap gap-3 pb-8 content-start h-max justify-center">
                                {renderItems.map((item, i) => (
                                    <div key={i} onClick={() => handlePointClick([item.L, item.C, item.H], item.spectral)} className="flex flex-col group cursor-pointer transition-all items-center gap-2" style={{ width: `${Math.max(48, baseMatrixSize * swatchZoom)}px` }}>
                                        <div className={`aspect-square relative flex items-center justify-center overflow-hidden transition-all text-[0px] rounded-xl group-hover:scale-[1.05] group-hover:shadow-md`} style={{ backgroundColor: item.hex, backgroundImage: item.note?.startsWith('http') ? `url(${item.note})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', width: '100%' }}>
                                            {!item._inGamut && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) ${3*swatchZoom}px, rgba(255,255,255,0.2) ${3*swatchZoom}px, rgba(255,255,255,0.2) ${6*swatchZoom}px)` }}></div>}
                                            {item.hasSpectral && <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 z-10"></div>}
                                            
                                            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm">
                                                {item.note?.startsWith('http') && (
                                                    <button onClick={(e) => { e.stopPropagation(); setFullscreenImage(item.note); }} className="text-white hover:text-sky-300 p-1">
                                                        <Icon name="eye" className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); setEditingItem({...item, spectralStr: item.spectral ? item.spectral.join(',') : '' }); }} className="text-white hover:text-sky-300 p-1">
                                                    <Icon name="edit-2" className="w-5 h-5" />
                                                </button>
                                            </div>
                                            
                                            {swatchZoom >= 1.0 && (
                                                <div className="absolute inset-x-0 bottom-0 top-auto flex flex-col items-center justify-end pointer-events-none p-1 leading-none space-y-0.5 z-10 pb-2" style={{ backgroundColor: item.note?.startsWith('http') ? 'rgba(0,0,0,0.4)' : 'transparent', color: item.note?.startsWith('http') ? 'white' : (item.L > 0.65 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)') }}>
                                                    {item.displayName.split(' ').map((word, wIdx) => (
                                                        <span key={wIdx} className="text-center font-bold uppercase tracking-[0.05em] truncate w-full px-0.5 drop-shadow-sm" style={{ fontSize: `${Math.max(4, 5.5 * swatchZoom)}px` }}>
                                                            {word}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center text-center px-0.5 pb-2 w-full">
                                            {enableDeltaE && item._d !== undefined && <div className="text-[9px] text-emerald-500 font-bold flex items-center gap-0.5 justify-center"><Icon name="target" className="w-2.5 h-2.5" /> ΔEok {item._d.toFixed(2)}</div>}
                                            <span style={{ fontSize: `${Math.max(5, 6 * swatchZoom)}px` }} className="w-full font-mono text-slate-500 dark:text-neutral-400 truncate mt-0.5 group-hover:text-slate-800 dark:group-hover:text-neutral-200 transition-colors" title={item.erpCode}>
                                                {item.erpCode?.startsWith('http') ? (
                                                    <a href={item.erpCode} target="_blank" rel="noopener noreferrer" className="hover:text-sky-500 flex items-center justify-center gap-1 drop-shadow-sm" onClick={(e) => e.stopPropagation()}>
                                                        <Icon name="external-link" className="w-2.5 h-2.5" /> Web Ref
                                                    </a>
                                                ) : item.erpCode}
                                            </span>
                                            <span style={{ fontSize: `${Math.max(4, 5 * swatchZoom)}px` }} className="text-slate-400 uppercase font-bold tracking-widest truncate w-full mt-1">{item.brand}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {fullscreenImage && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-8 cursor-pointer" onClick={() => setFullscreenImage(null)}>
                            <img src={fullscreenImage} alt="Fullscreen Preview" className="max-w-full max-h-full object-contain cursor-default" onClick={e=>e.stopPropagation()} />
                            <button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 text-white hover:text-rose-400 w-12 h-12 flex items-center justify-center bg-black/50 rounded-full"><Icon name="x" className="w-8 h-8" /></button>
                        </div>
                    )}
                    
                    {editingItem && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4">
                            <div className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-neutral-800">
                                <div className="p-4 border-b border-slate-200 dark:border-neutral-800 flex justify-between items-center bg-slate-50 dark:bg-neutral-800/50 rounded-t-2xl">
                                    <h3 className="font-bold flex items-center gap-2"><Icon name="edit-2" className="w-4 h-4 text-sky-500" /> Edit Database Item</h3>
                                    <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600"><Icon name="x" className="w-5 h-5" /></button>
                                </div>
                                <form onSubmit={handleSaveEdit} className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded border border-slate-200 dark:border-neutral-700 shadow-sm" style={{backgroundColor: editingItem.hex, backgroundImage: editingItem.note?.startsWith('http') ? `url(${editingItem.note})` : 'none', backgroundSize: 'cover' }}></div>
                                        <div className="flex-1">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{editingItem.brand}</div>
                                            <input required type="text" value={editingItem.displayName} onChange={e=>setEditingItem({...editingItem, displayName: e.target.value})} className="text-lg font-bold w-full bg-transparent border-b-2 border-slate-200 focus:border-sky-500 outline-none pb-1" placeholder="Color Name" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Hex Code</label>
                                            <input required type="text" value={editingItem.hex} onChange={e=>setEditingItem({...editingItem, hex: e.target.value})} className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 font-mono text-sm" placeholder="#000000" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tags (comma sep)</label>
                                            <input type="text" value={editingItem.tags?.join(', ')} onChange={e=>setEditingItem({...editingItem, tags: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-sm" placeholder="tag1, tag2" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Web Link (erpCode)</label>
                                        <input type="text" value={editingItem.erpCode} onChange={e=>setEditingItem({...editingItem, erpCode: e.target.value})} className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-sm font-mono" placeholder="https://" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Image URL (note)</label>
                                        <input type="text" value={editingItem.note} onChange={e=>setEditingItem({...editingItem, note: e.target.value})} className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-sm font-mono" placeholder="https://" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Spectral Data (31 values, comma sep)</label>
                                        <textarea value={editingItem.spectralStr} onChange={e=>setEditingItem({...editingItem, spectralStr: e.target.value})} className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-xs font-mono h-24 custom-scrollbar" placeholder="0.21,0.22,..." />
                                    </div>
                                    <div className="flex gap-4 pt-4 mt-2 border-t border-slate-200 dark:border-neutral-800">
                                        <button type="button" onClick={() => handleDeleteItem(editingItem)} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded font-bold uppercase tracking-wider text-[11px] transition-colors"><Icon name="trash-2" className="w-3.5 h-3.5 inline mr-1" /> Delete Item</button>
                                        <button type="button" onClick={() => setEditingItem(null)} className="ml-auto px-4 py-2 text-slate-500 hover:text-slate-800 font-bold uppercase tracking-wider text-[11px]">Cancel</button>
                                        <button type="submit" className="px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-bold uppercase tracking-wider text-[11px] shadow-sm"><Icon name="save" className="w-3.5 h-3.5 inline mr-1" /> Save</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            );
        };
const FileManager = ({ linkedFiles, setLinkedFiles, onClose }) => {
            const [newFileName, setNewFileName] = useState('');

            const handleAddFile = () => {
                const trimmed = newFileName.trim();
                if (trimmed && !linkedFiles.includes(trimmed)) {
                    setLinkedFiles([...linkedFiles, trimmed]);
                    setNewFileName('');
                }
            };

            const handleRemoveFile = (fileToRemove) => {
                setLinkedFiles(linkedFiles.filter(f => f !== fileToRemove));
            };

            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-slate-200 dark:border-neutral-800 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-2">
                                <Icon name="folder" className="w-5 h-5 text-blue-500" />
                                Linked CSV Files
                            </h2>
                            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-500 transition-colors">
                                <Icon name="x" className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-4 flex-1 overflow-y-auto">
                            <p className="text-sm text-slate-600 dark:text-neutral-400 mb-4">
                                These CSV files will be automatically loaded when the application starts. 
                                When you export the app state to HTML, this list is saved.
                            </p>

                            <div className="space-y-2 mb-6">
                                {linkedFiles.map(file => (
                                    <div key={file} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg border border-slate-200 dark:border-neutral-700">
                                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-neutral-300">
                                            <Icon name="file-text" className="w-4 h-4 text-slate-400" />
                                            {file}
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveFile(file)}
                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                            title="Remove file link"
                                        >
                                            <Icon name="trash-2" className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {linkedFiles.length === 0 && (
                                    <div className="text-center p-4 text-sm text-slate-500 dark:text-neutral-500 italic border border-dashed border-slate-300 dark:border-neutral-700 rounded-lg">
                                        No files linked.
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newFileName}
                                    onChange={e => setNewFileName(e.target.value)}
                                    placeholder="e.g. Uniboard.csv"
                                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-neutral-200"
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddFile(); }}
                                />
                                <button 
                                    onClick={handleAddFile}
                                    disabled={!newFileName.trim()}
                                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                >
                                    <Icon name="plus" className="w-4 h-4" />
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        const AppUI = ({ theme, setTheme, activeTab, setActiveTab, names, setNames, adjectives, setAdjectives, dictNotes, setDictNotes, dictTags, setDictTags, savedColors, setSavedColors, groupSettings, setGroupSettings, palette, setPalette, savedPalettes, setSavedPalettes, selectedSavedPaletteId, setSelectedSavedPaletteId, isSavingPalette, setIsSavingPalette, newPaletteName, setNewPaletteName, searchQuery, setSearchQuery, selectedIds, setSelectedIds, observer, setObserver, illuminant, setIlluminant, handleBatchTag, handleBatchRemoveTag, viewportFilter, setViewportFilter, viewportSearchQuery, setViewportSearchQuery, viewMode, setViewMode, swatchLayout, setSwatchLayout, swatchZoom, setSwatchZoom, viewportTagFilter, setViewportTagFilter, scrubL, setScrubL, scrubC, setScrubC, scrubH, setScrubH, setTemporarySpectral, compSlotA, setCompSlotA, compSlotB, setCompSlotB, showFullscreenPreview, setShowFullscreenPreview, showCompareFullscreen, setShowCompareFullscreen, showFullscreenPalette, setShowFullscreenPalette, showCompareDivider, setShowCompareDivider, showHelpPanel, setShowHelpPanel, showDatabaseManager, setShowDatabaseManager, showFileManager, setShowFileManager, linkedFiles, setLinkedFiles, colorData, updateColorData, visualizeData, setVisualizeData, history, isUndoing, currentStateStr, handleUndo, handleRedo, canUndo, canRedo, lockedNouns, lockedAdjectives, filteredViewData, handleUpdate, handlePointClick, handleVisualize, crosshair, gridData, isLight, activeColorObj, labValues, colorGroup, isOutOfGamut, crosshairHex, activeData, activeAdj, activeName, activeNotes, isPinned, isAnchorLocked, isInputDisabled, activeItemId, activeTags, addTag, removeTag, adjInputClass, nounInputClass, deltaEOK, deltaE2000, tabs, searchResults, handleSaveApp, handleSystemExport, handleImportCSV, handleSyncToCSV, addToPalette, removeFromPalette, saveCurrentPalette, confirmSavePalette, cancelSavePalette, loadPalette, deleteSavedPalette, replaceInPalette, onAdjChange, onNameChange, onNotesChange, toggleAnchorLock, togglePin, updateSavedColor, spectral, tetheringPinId, setTetheringPinId }) => {
            const isDark = theme === 'dark';
            
            return (
                <div className="flex flex-col md:flex-row h-screen overflow-hidden">
                    <aside className="w-full md:w-96 flex flex-col bg-white dark:bg-neutral-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-800 z-10 h-[45vh] md:h-screen overflow-y-auto custom-scrollbar shrink-0">
                        <div className="p-4 border-b border-slate-200 dark:border-neutral-800 flex flex-col gap-3 sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-20">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-black tracking-tight text-slate-800 dark:text-neutral-100 leading-none truncate pr-2">
                                        The Color<span style={{ color: 'var(--c-dark)' }}>SAMI</span>ficator
                                    </h1>
                                    <button onClick={() => setShowFileManager(true)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full transition-colors" title="Manage Linked CSV Files">
                                        <Icon name="folder" className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setActiveTab('db')} className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-full transition-colors" title="Manage Color Database">
                                        <Icon name="database" className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setShowHelpPanel(true)} className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-full transition-colors" title="Help & Guide">
                                        <Icon name="help-circle" className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <Icon name="search" className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)} 
                                    placeholder="Omnisearch names, codes, notes..." 
                                    className="w-full bg-slate-100 dark:bg-neutral-800 border border-transparent rounded-md pl-8 pr-8 py-2 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-neutral-900 transition-all" 
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                        <Icon name="x" className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {searchQuery ? (
                            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                                {searchResults.length === 0 ? (
                                    <div className="p-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">No results found</div>
                                ) : (
                                    searchResults.map(res => (
                                        <button 
                                            key={res.key} 
                                            onClick={() => { handleUpdate([res.L, res.C, res.H]); setSearchQuery(''); }} 
                                            className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded-xl text-left transition-all border border-transparent hover:border-slate-200 dark:hover:border-neutral-700 group"
                                        >
                                            {res.image ? (
                                                <div className="w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 shrink-0 group-hover:scale-105 transition-transform bg-cover bg-center" style={{backgroundImage: `url(${res.image})`}}></div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 shrink-0 group-hover:scale-105 transition-transform" style={{backgroundColor: res.color}}></div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-neutral-200 truncate">{res.displayName}</div>
                                                    {res.note === 'Verified Spectral Data' && <Icon name="check-circle" className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Verified with Spectral Data" />}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {res.erpCode && <span className="text-[9px] font-mono text-sky-600 dark:text-sky-400 font-bold">{res.erpCode}</span>}
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{res.erpCode ? `• ${res.type}` : res.type}</span>
                                                </div>
                                                {res.note && res.note !== 'Verified Spectral Data' && <div className="text-[10px] text-slate-500 dark:text-neutral-400 italic mt-1 truncate">{res.note}</div>}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="p-3 bg-white dark:bg-neutral-900">
                                    <div className="h-44 w-full relative rounded-2xl shadow-inner border border-black/5 dark:border-white/5 overflow-hidden transition-colors duration-300" style={{ backgroundColor: crosshairHex }}>
                                        {isOutOfGamut && (
                                            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)' }}></div>
                                        )}
                                        <div className="absolute top-4 left-5 z-10 pointer-events-none" style={{ color: isLight ? '#010D00' : '#F2E8DF' }}>
                                            <div className="text-xl font-black tracking-tight drop-shadow-md font-mono">{crosshair?.activeErpCode || ''}</div>
                                            {isOutOfGamut && (
                                                <div className="mt-1 inline-block px-1.5 py-0.5 bg-red-500/90 text-white text-[8px] font-bold uppercase tracking-widest rounded shadow-sm backdrop-blur-sm border border-red-400/30">
                                                    Out of sRGB Gamut
                                                </div>
                                            )}
                                        </div>
                                        
                                        {((getGlobalDuplicate(names, adjectives, crosshair?.activeSavedColor?.type === 'pin' ? crosshair.activeSavedColor.id : crosshair?.nearestAdjId, activeAdj, savedColors, crosshair?.activeSavedColor?.type === 'pin' ? !!crosshair.activeSavedColor.adjOverride : true, crosshair?.activeSavedColor?.type === 'pin' ? crosshair?.nearestAdjId : null)) || 
                                          (getGlobalDuplicate(names, adjectives, crosshair?.activeSavedColor?.type === 'pin' ? crosshair.activeSavedColor.id : crosshair?.nearestAnchorId, activeName, savedColors, crosshair?.activeSavedColor?.type === 'pin' ? !!crosshair.activeSavedColor.nameOverride : true, crosshair?.activeSavedColor?.type === 'pin' ? crosshair?.nearestAnchorId : null))) && ( 
                                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white text-[9px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1.5 z-40 backdrop-blur-sm uppercase tracking-wider border border-red-400/30">
                                                <Icon name="alert-triangle" className="w-3 h-3" />Conflict
                                            </div> 
                                        )}
                                        
                                        <div className="absolute top-3.5 right-4 flex gap-1 z-30" style={{ color: isLight ? '#010D00' : '#F2E8DF' }}>
                                            <button onClick={toggleAnchorLock} className={`p-1.5 rounded-lg transition-colors ${isAnchorLocked ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`} title={isAnchorLocked ? "Unlock Grid Anchor" : "Lock Grid Anchor"}>
                                                <Icon name={isAnchorLocked ? "lock" : "unlock"} className="w-3.5 h-3.5 drop-shadow-sm" />
                                            </button>
                                            <button onClick={togglePin} className={`p-1.5 rounded-lg transition-colors ${isPinned ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`} title={isPinned ? "Remove Free Pin" : "Pin Free Coordinate"}>
                                                <Icon name="map-pin" className="w-3.5 h-3.5 drop-shadow-sm" />
                                            </button>
                                            <button onClick={() => setShowFullscreenPreview(true)} className="p-1.5 rounded-lg transition-colors opacity-60 hover:opacity-100">
                                                <Icon name="maximize" className="w-3.5 h-3.5 drop-shadow-sm" />
                                            </button>
                                            {isOutOfGamut && (
                                                <div className="p-1.5 text-red-500 dark:text-red-400" title="Out of sRGB Gamut">
                                                    <Icon name="alert-triangle" className="w-3.5 h-3.5 drop-shadow-sm" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 mt-1 z-20 pointer-events-none" style={{ color: isLight ? '#010D00' : '#F2E8DF' }}>
                                            <div className="relative w-full flex justify-center items-center group/adj">
                                                <input type="text" value={activeAdj} onChange={e => onAdjChange(e.target.value)} placeholder="Adjective" className={adjInputClass} disabled={isInputDisabled || (crosshair?.activeSavedColor?.type !== 'pin' && lockedAdjectives[crosshair?.nearestAdjId])} />
                                                {crosshair?.activeSavedColor?.type === 'pin' && crosshair.activeSavedColor.adjOverride && (
                                                    <button onClick={() => updateSavedColor('adjOverride', '')} className={`absolute right-0 opacity-0 group-hover/adj:opacity-100 transition-opacity p-1 rounded-full pointer-events-auto ${isLight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`} title="Revert to inherited adjective">
                                                        <Icon name="rotate-ccw" className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative w-full flex justify-center items-center group/noun">
                                                <input type="text" value={activeName} onChange={e => onNameChange(e.target.value)} placeholder="Noun" className={nounInputClass} disabled={isInputDisabled || (crosshair?.activeSavedColor?.type !== 'pin' && lockedNouns[crosshair?.nearestAnchorId])} />
                                                {crosshair?.activeSavedColor?.type === 'pin' && crosshair.activeSavedColor.nameOverride && (
                                                    <button onClick={() => updateSavedColor('nameOverride', '')} className={`absolute right-0 opacity-0 group-hover/noun:opacity-100 transition-opacity p-1 rounded-full pointer-events-auto ${isLight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`} title="Revert to inherited noun">
                                                        <Icon name="rotate-ccw" className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            {crosshair?.snapDist > 0.0001 && crosshair?.snapTarget && !crosshair.exactSavedColor && ( 
                                                <button onClick={() => handleUpdate([crosshair.snapTarget.L, crosshair.snapTarget.C, crosshair.snapTarget.H])} className={`mt-2 px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full border transition-all flex items-center justify-center gap-1.5 active:scale-95 pointer-events-auto`} style={{ color: isLight ? '#010D00' : '#F2E8DF', borderColor: isLight ? 'rgba(1,13,0,0.35)' : 'rgba(242,232,223,0.50)', backgroundColor: 'transparent' }}>
                                                    <Icon name="magnet" className="w-3 h-3" /> Snap ΔEok: {(crosshair.snapDist * 100).toFixed(2)}
                                                </button> 
                                            )}
                                        </div>
                                        
                                        <div className="absolute bottom-4 left-5 pointer-events-none z-10" style={{ color: isLight ? '#010D00' : '#F2E8DF' }}>
                                            <div className="text-[8px] font-black uppercase tracking-widest opacity-80 drop-shadow-md mb-0.5">CIELAB ({spectral ? `${illuminant}/${observer}°` : 'D50/2°'})</div>
                                            <div className="text-[10px] font-bold tracking-tight font-mono drop-shadow-md">{labValues}</div>
                                        </div>
                                        
                                        <div className="absolute bottom-4 right-5 pointer-events-none z-10" style={{ color: isLight ? '#010D00' : '#F2E8DF' }}>
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-80 drop-shadow-md text-right">{colorGroup}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-5 flex flex-col gap-6 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                                    <SliderGroup label="Lightness" value={scrubL} min={0} max={1} step={0.001} onChange={(v) => { setScrubL(v); setTemporarySpectral(null); }} icon="sun" />
                                    <SliderGroup label="Chroma" value={scrubC} min={0} max={0.3} step={0.001} onChange={(v) => { setScrubC(v); setTemporarySpectral(null); }} icon="zap" />
                                    <SliderGroup label="Hue" value={scrubH} min={0} max={360} step={0.1} onChange={(v) => { setScrubH(v); setTemporarySpectral(null); }} icon="compass" />
                                    
                                    {crosshair?.activeSavedColor?.type === 'pin' && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-neutral-800">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">Tethering</span>
                                                {tetheringPinId === crosshair.activeSavedColor.id ? (
                                                    <button onClick={() => setTetheringPinId(null)} className="text-[9px] font-bold uppercase text-red-500 hover:text-red-600 flex items-center gap-1">
                                                        <Icon name="x" className="w-3 h-3" /> Cancel
                                                    </button>
                                                ) : (
                                                    <button onClick={() => setTetheringPinId(crosshair.activeSavedColor.id)} className="text-[9px] font-bold uppercase text-sky-500 hover:text-sky-600 flex items-center gap-1">
                                                        <Icon name="link" className="w-3 h-3" /> Change Source
                                                    </button>
                                                )}
                                            </div>
                                            <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2 border border-slate-100 dark:border-neutral-800">
                                                <div className="text-[9px] text-slate-500 dark:text-neutral-400 flex items-center gap-2">
                                                    <Icon name="info" className="w-3 h-3" />
                                                    {tetheringPinId === crosshair.activeSavedColor.id ? (
                                                        <span className="text-sky-500 animate-pulse">Click any point on the map to tether...</span>
                                                    ) : (
                                                        <span>Inheriting from: <b className="text-slate-700 dark:text-neutral-200 uppercase">{activeData?.inherited?.source === 'pin' ? `Pin ${activeData.inherited.sourceId.substring(0,8)}` : `Anchor ${activeData?.inherited?.sourceId || 'None'}`}</b></span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                    <CollapsiblePanel title="Conversions" icon="sliders" defaultOpen={false}>
                                        <ColorConverter crosshair={{rawL: scrubL, rawC: scrubC, rawH: scrubH, L: scrubL, C: scrubC, H: scrubH, activeSavedColor: crosshair.activeSavedColor, temporarySpectral: crosshair.temporarySpectral}} onEdit={handleUpdate} observer={observer} setObserver={setObserver} illuminant={illuminant} setIlluminant={setIlluminant} colorData={colorData} />
                                    </CollapsiblePanel>
                                    
                                    <CollapsiblePanel title="Commercial Matches" icon="palette" defaultOpen={false}>
                                        <CommercialMatches crosshair={{rawL: scrubL, rawC: scrubC, rawH: scrubH, L: scrubL, C: scrubC, H: scrubH, activeSavedColor: crosshair.activeSavedColor}} colorData={colorData} onSelectColor={handleUpdate} />
                                    </CollapsiblePanel>
                                    
                                    {crosshair?.activeSavedColor?.spectral && (
                                        <CollapsiblePanel title="Spectral Response" icon="activity" defaultOpen={false}>
                                            <SpectralGraph spectralData={crosshair.activeSavedColor.spectral} theme={theme} meta={{
                                                illuminant: crosshair.activeSavedColor.illuminant || illuminant,
                                                observer: crosshair.activeSavedColor.observer || observer,
                                                measurementMethod: crosshair.activeSavedColor.measurementMethod,
                                                measurementDate: crosshair.activeSavedColor.measurementDate,
                                                measurementDevice: crosshair.activeSavedColor.measurementDevice,
                                            }} />
                                        </CollapsiblePanel>
                                    )}
                                    
                                    <CollapsiblePanel title="Harmonies" icon="aperture" defaultOpen={false}>
                                        <ColorHarmonies L={scrubL} C={scrubC} H={scrubH} handlePointClick={handlePointClick} />
                                    </CollapsiblePanel>
                                    
                                    <CollapsiblePanel title="Palette Playground" icon="palette" defaultOpen={false}>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between gap-2">
                                                {isSavingPalette ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <input 
                                                            type="text" 
                                                            value={newPaletteName} 
                                                            onChange={(e) => setNewPaletteName(e.target.value)} 
                                                            className="flex-1 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-neutral-300 outline-none focus:border-sky-500"
                                                            placeholder="Palette name..."
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') confirmSavePalette();
                                                                if (e.key === 'Escape') cancelSavePalette();
                                                            }}
                                                        />
                                                        <button onClick={confirmSavePalette} disabled={!newPaletteName.trim()} className="px-2 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:dark:bg-neutral-700 text-white rounded text-xs transition-colors" title="Confirm Save">
                                                            <Icon name="check" className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={cancelSavePalette} className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-slate-700 dark:text-neutral-300 rounded text-xs transition-colors" title="Cancel">
                                                            <Icon name="x" className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <select 
                                                            onChange={loadPalette} 
                                                            className="flex-1 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-neutral-300 outline-none focus:border-sky-500"
                                                            value={selectedSavedPaletteId}
                                                        >
                                                            <option value="" disabled>Load saved palette...</option>
                                                            {savedPalettes.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name} ({p.colors.length} colors)</option>
                                                            ))}
                                                        </select>
                                                        {selectedSavedPaletteId && (
                                                            <button 
                                                                onClick={deleteSavedPalette} 
                                                                className="px-2 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 rounded text-xs transition-colors flex items-center justify-center"
                                                                title="Delete saved palette"
                                                            >
                                                                <Icon name="trash-2" className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={saveCurrentPalette} 
                                                            disabled={palette.length === 0}
                                                            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 disabled:dark:bg-neutral-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                                                            title="Save current palette"
                                                        >
                                                            <Icon name="save" className="w-3.5 h-3.5" />
                                                            Save
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {palette.map(item => { 
                                                    const c = new Color("oklch", [item.L, item.C, item.H]); 
                                                    const h = c.clone().toGamut({space: "srgb"}).toString({format: "hex"}).toUpperCase(); 
                                                    let pin = item.pinId ? savedColors[item.pinId] : null;
                                                    if (!pin) {
                                                        pin = Object.values(savedColors).find(sc => sc.type === 'pin' && sc.erpCode === item.erpCode);
                                                    }
                                                    const adj = pin?.adjOverride || adjectives[item.adjId] || '';
                                                    const noun = pin?.nameOverride || names[item.nounId] || '';
                                                    const displayName = `${adj} ${noun}`.trim() || 'Unnamed';
                                                    return ( 
                                                        <div key={item.id} className="relative group w-10 h-10 rounded-md shadow-sm border border-slate-200 dark:border-neutral-700 cursor-pointer overflow-hidden flex-shrink-0" style={{backgroundColor: h}} onClick={() => handleUpdate([item.L, item.C, item.H])} title={`${displayName} (${item.erpCode})`}>
                                                            <button onClick={(e) => { e.stopPropagation(); removeFromPalette(item.id); }} className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-black/40 hover:bg-red-50 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10">
                                                                <Icon name="x" className="w-2.5 h-2.5" />
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); replaceInPalette(item.id); }} className="absolute bottom-0.5 left-0.5 w-3.5 h-3.5 bg-black/40 hover:bg-sky-500 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10" title="Replace with current color">
                                                                <Icon name="refresh-cw" className="w-2 h-2" />
                                                            </button>
                                                        </div> 
                                                    ); 
                                                })}
                                                <button onClick={addToPalette} className="w-10 h-10 rounded-md border border-dashed border-slate-300 dark:border-neutral-700 flex items-center justify-center text-slate-400 hover:text-sky-500 hover:border-sky-500 transition-colors bg-slate-50 dark:bg-neutral-800/50" title="Add Current Color">
                                                    <Icon name="plus" className="w-5 h-5" />
                                                </button>
                                            </div>
                                            {palette.length > 0 && (
                                                <div className="flex gap-2 mt-1">
                                                    <button onClick={() => setShowFullscreenPalette(true)} className="flex-1 py-2 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5">
                                                        <Icon name="maximize" className="w-3.5 h-3.5"/> Fullscreen
                                                    </button>
                                                    <button onClick={() => setPalette([])} className="py-2 px-3 border border-red-200 dark:border-red-900/30 hover:bg-red-50 text-red-500 font-bold text-[10px] uppercase tracking-wider rounded transition-colors">
                                                        <Icon name="trash-2" className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </CollapsiblePanel>
                                    
                                    <CollapsiblePanel title="Delta E Comparisons" icon="git-compare" defaultOpen={false}>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex gap-3">
                                                <div className="flex-1 border border-slate-200 dark:border-neutral-700 rounded-lg overflow-hidden flex flex-col relative group h-24 bg-white dark:bg-neutral-900">
                                                    {compSlotA ? ( 
                                                        <> 
                                                            <div className="flex-1 w-full relative cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleUpdate([compSlotA.L, compSlotA.C, compSlotA.H])} style={{backgroundColor: new Color('oklch', [compSlotA.L, compSlotA.C, compSlotA.H]).clone().toGamut({space:'srgb'}).toString({format:'hex'})}}>
                                                                {!new Color('oklch', [compSlotA.L, compSlotA.C, compSlotA.H]).inGamut('srgb') && (
                                                                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)' }}></div>
                                                                )}
                                                            </div>
                                                            <div className="p-1.5 text-center text-[9px] font-mono text-slate-600 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-800/50 border-t border-slate-200 dark:border-neutral-700 cursor-pointer flex items-center justify-center gap-1" onClick={() => handleUpdate([compSlotA.L, compSlotA.C, compSlotA.H])}>
                                                                {!new Color('oklch', [compSlotA.L, compSlotA.C, compSlotA.H]).inGamut('srgb') && <Icon name="alert-triangle" className="w-3 h-3 text-red-500" title="Out of sRGB Gamut" />}
                                                                <span>L:{compSlotA.L.toFixed(2)} C:{compSlotA.C.toFixed(2)} H:{compSlotA.H.toFixed(0)}°</span>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); setCompSlotA(null); }} className="absolute top-1.5 right-1.5 bg-black/40 hover:bg-black/60 text-white p-1 rounded opacity-0 group-hover:opacity-100 z-10"><Icon name="x" className="w-3 h-3"/></button> 
                                                        </> 
                                                    ) : ( 
                                                        <button onClick={() => setCompSlotA({ L: scrubL, C: scrubC, H: scrubH, erpCode: crosshair?.activeErpCode || '', adjId: crosshair?.activeSavedColor ? crosshair.activeSavedColor.adjId : crosshair?.nearestAdjId, nounId: crosshair?.activeSavedColor ? crosshair.activeSavedColor.anchorId : crosshair?.nearestAnchorId, adjOverride: crosshair?.activeSavedColor?.adjOverride, nameOverride: crosshair?.activeSavedColor?.nameOverride, type: crosshair?.activeSavedColor?.type, spectral: crosshair?.activeSavedColor?.spectral })} className="w-full h-full flex flex-col items-center justify-center hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-400 hover:text-sky-500 transition-colors">
                                                            <Icon name="plus" className="w-6 h-6 mb-1" />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider">Load Current</span>
                                                        </button> 
                                                    )}
                                                </div>
                                                <div className="flex-1 border border-slate-200 dark:border-neutral-700 rounded-lg overflow-hidden flex flex-col relative group h-24 bg-white dark:bg-neutral-900">
                                                    {compSlotB ? ( 
                                                        <> 
                                                            <div className="flex-1 w-full relative cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleUpdate([compSlotB.L, compSlotB.C, compSlotB.H])} style={{backgroundColor: new Color('oklch', [compSlotB.L, compSlotB.C, compSlotB.H]).clone().toGamut({space:'srgb'}).toString({format:'hex'})}}>
                                                                {!new Color('oklch', [compSlotB.L, compSlotB.C, compSlotB.H]).inGamut('srgb') && (
                                                                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)' }}></div>
                                                                )}
                                                            </div>
                                                            <div className="p-1.5 text-center text-[9px] font-mono text-slate-600 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-800/50 border-t border-slate-200 dark:border-neutral-700 cursor-pointer flex items-center justify-center gap-1" onClick={() => handleUpdate([compSlotB.L, compSlotB.C, compSlotB.H])}>
                                                                {!new Color('oklch', [compSlotB.L, compSlotB.C, compSlotB.H]).inGamut('srgb') && <Icon name="alert-triangle" className="w-3 h-3 text-red-500" title="Out of sRGB Gamut" />}
                                                                <span>L:{compSlotB.L.toFixed(2)} C:{compSlotB.C.toFixed(2)} H:{compSlotB.H.toFixed(0)}°</span>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); setCompSlotB(null); }} className="absolute top-1.5 right-1.5 bg-black/40 hover:bg-black/60 text-white p-1 rounded opacity-0 group-hover:opacity-100 z-10"><Icon name="x" className="w-3 h-3"/></button> 
                                                        </> 
                                                    ) : ( 
                                                        <button onClick={() => setCompSlotB({ L: scrubL, C: scrubC, H: scrubH, erpCode: crosshair?.activeErpCode || '', adjId: crosshair?.activeSavedColor ? crosshair.activeSavedColor.adjId : crosshair?.nearestAdjId, nounId: crosshair?.activeSavedColor ? crosshair.activeSavedColor.anchorId : crosshair?.nearestAnchorId, adjOverride: crosshair?.activeSavedColor?.adjOverride, nameOverride: crosshair?.activeSavedColor?.nameOverride, type: crosshair?.activeSavedColor?.type, spectral: crosshair?.activeSavedColor?.spectral })} className="w-full h-full flex flex-col items-center justify-center hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-400 hover:text-sky-500 transition-colors">
                                                            <Icon name="plus" className="w-6 h-6 mb-1" />
                                                            <span className="text-[9px] font-bold uppercase tracking-wider">Load Current</span>
                                                        </button> 
                                                    )}
                                                </div>
                                            </div>
                                            {compSlotA && compSlotB && (
                                                <div className="flex flex-col gap-3">
                                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                                        <div className="bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded p-2 text-center">
                                                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">Delta E OK</div>
                                                            <div className="text-lg font-mono font-black text-slate-800 dark:text-neutral-200">{deltaEOK}</div>
                                                        </div>
                                                        <div className="bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded p-2 text-center">
                                                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1">Delta E 2000</div>
                                                            <div className="text-lg font-mono font-black text-slate-800 dark:text-neutral-200">{deltaE2000}</div>
                                                        </div>
                                                    </div>
                                                    {compSlotA.spectral && compSlotB.spectral && (
                                                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded p-2">
                                                            <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1"><Icon name="activity" className="w-3 h-3" /> Metamerism Index (MI)</div>
                                                            <div className="grid grid-cols-3 gap-2 mt-1.5">
                                                                <div className="text-center">
                                                                    <div className="text-[8px] uppercase text-amber-600/70 dark:text-amber-500/70">Illuminant A</div>
                                                                    <div className="text-sm font-mono font-bold text-amber-800 dark:text-amber-300">{calculateDeltaEFromSpectral(compSlotA.spectral, compSlotB.spectral, observer, 'A').toFixed(2)}</div>
                                                                </div>
                                                                <div className="text-center border-l border-amber-200 dark:border-amber-800/30">
                                                                    <div className="text-[8px] uppercase text-amber-600/70 dark:text-amber-500/70">Illuminant F2</div>
                                                                    <div className="text-sm font-mono font-bold text-amber-800 dark:text-amber-300">{calculateDeltaEFromSpectral(compSlotA.spectral, compSlotB.spectral, observer, 'F2').toFixed(2)}</div>
                                                                </div>
                                                                <div className="text-center border-l border-amber-200 dark:border-amber-800/30">
                                                                    <div className="text-[8px] uppercase text-amber-600/70 dark:text-amber-500/70">Illuminant F11</div>
                                                                    <div className="text-sm font-mono font-bold text-amber-800 dark:text-amber-300">{calculateDeltaEFromSpectral(compSlotA.spectral, compSlotB.spectral, observer, 'F11').toFixed(2)}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-[8px] text-amber-600/80 dark:text-amber-500/80 mt-1.5 text-center italic">
                                                                MI &gt; 1.0 indicates a definite mismatch under the test illuminant.
                                                            </div>
                                                        </div>
                                                    )}
                                                    <button onClick={() => setShowCompareFullscreen(true)} className="w-full py-2.5 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 text-slate-700 dark:text-neutral-300 font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2">
                                                        <Icon name="columns" className="w-3.5 h-3.5"/> Fullscreen Compare
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </CollapsiblePanel>
                                    
                                    <CollapsiblePanel title="Tags" icon="tag" defaultOpen={false}>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {activeTags.map(tag => (
                                                    <span key={tag} className="flex items-center gap-1 bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border border-sky-200 dark:border-sky-500/30">
                                                        {tag}
                                                        <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors ml-0.5" disabled={isInputDisabled}>
                                                            <Icon name="x" className="w-2.5 h-2.5"/>
                                                        </button>
                                                    </span>
                                                ))}
                                                {activeTags.length === 0 && <span className="text-[9px] text-slate-400 italic">No tags added.</span>}
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="Add tag & press Enter..." 
                                                className="w-full bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded-lg p-2.5 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white transition-colors" 
                                                disabled={isInputDisabled} 
                                                onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { addTag(e.target.value.trim()); e.target.value = ''; } }} 
                                            />
                                        </div>
                                    </CollapsiblePanel>
                                    
                                    <CollapsiblePanel title="Anchor Notes" icon="sticky-note" defaultOpen={false}>
                                        <div className="flex flex-col gap-2">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1 flex justify-between items-center">
                                                <span>Notes for {crosshair?.activeSavedColor?.type === 'pin' ? 'Custom Pin' : crosshair?.nearestAnchorId}</span>
                                            </div>
                                            <textarea 
                                                className="w-full h-28 bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded-lg p-3 text-xs focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white custom-scrollbar resize-none transition-colors" 
                                                placeholder="Add notes..." 
                                                value={activeNotes} 
                                                onChange={(e) => onNotesChange(e.target.value)} 
                                                disabled={isInputDisabled} 
                                            />
                                        </div>
                                    </CollapsiblePanel>
                                </>
                            )}
                        </aside>
                    
                    <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-neutral-950 relative">
                        <div className="flex items-center justify-between px-4 pt-4 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10 flex-shrink-0">
                            <div className="flex-1 flex items-center min-w-0 mr-4 pb-1.5">
                                <div className="relative">
                                    <select
                                        value={activeTab}
                                        onChange={e => setActiveTab(e.target.value)}
                                        className="appearance-none pl-4 pr-10 py-2 text-[12px] font-black uppercase tracking-widest rounded-lg border-2 bg-white dark:bg-neutral-800 outline-none cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-neutral-700 min-w-[220px]"
                                        style={{ 
                                            textTransform: 'uppercase',
                                            color: isDark ? '#F2E8DF' : '#010D00',
                                            borderColor: isDark ? '#F2E8DF' : '#010D00'
                                        }}
                                    >
                                        {tabs.map(tab => (
                                            <option key={tab.id} value={tab.id} style={{ color: isDark ? '#F2E8DF' : '#010D00', background: isDark ? '#052212' : '#F2E8DF' }}>{tab.label}</option>
                                        ))}
                                    </select>
                                    <Icon name="chevron-down" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: isDark ? '#F2E8DF' : '#010D00' }} />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 pb-1.5">
                                
                                <button 
                                    onClick={handleUndo} 
                                    disabled={!canUndo} 
                                    className={`p-2 rounded-md transition-colors ${canUndo ? 'hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400' : 'text-slate-300 dark:text-neutral-700 cursor-not-allowed'}`} 
                                    title="Undo (Ctrl+Z)"
                                >
                                    <Icon name="undo" className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={handleRedo} 
                                    disabled={!canRedo} 
                                    className={`p-2 rounded-md transition-colors ${canRedo ? 'hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400' : 'text-slate-300 dark:text-neutral-700 cursor-not-allowed'}`} 
                                    title="Redo (Ctrl+Y)"
                                >
                                    <Icon name="redo" className="w-4 h-4" />
                                </button>
                                
                                <div className="w-px h-4 bg-slate-300 dark:bg-neutral-700 mx-1"></div>

                                <button onClick={handleSaveApp} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors" title="Save App State (.html)">
                                    <Icon name="save" className="w-4 h-4" />
                                </button>
                                <label className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 cursor-pointer transition-colors" title="Import CSV">
                                    <Icon name="upload" className="w-4 h-4" />
                                    <input type="file" accept=".csv,text/csv,application/csv,text/comma-separated-values,application/vnd.ms-excel" className="hidden" onChange={handleImportCSV} onClick={(e) => { e.target.value = null; }} />
                                </label>
                                <button onClick={handleSystemExport} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors" title="Export CSV">
                                    <Icon name="download" className="w-4 h-4" />
                                </button>
                                <button onClick={handleSyncToCSV} className="p-2 rounded-md hover:bg-sky-50 dark:hover:bg-sky-900/20 text-sky-500 transition-colors" title="Sync All Changes to Server CSVs">
                                    <Icon name="server" className="w-4 h-4" />
                                </button>
                                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors" title="Toggle Theme">
                                    <Icon name={theme === 'dark' ? "sun" : "moon"} className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 relative overflow-hidden p-4">
                            <div className="absolute inset-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm flex flex-col">
                                {['slice', 'chroma', 'top', '3d', 'db'].includes(activeTab) && (
                                    <div className="px-4 py-2 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/30 dark:bg-neutral-900/30 flex flex-wrap items-center gap-4 z-20">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">View:</span>
                                            <select value={viewMode} onChange={e => setViewMode(e.target.value)} className="bg-slate-200/50 dark:bg-neutral-800 rounded px-2 py-1.5 text-[10px] font-black uppercase tracking-tight text-slate-700 dark:text-neutral-300 outline-none hover:bg-slate-300/50 dark:hover:bg-neutral-700 transition-colors cursor-pointer border border-transparent focus:border-sky-500">
                                                <option value="dots">Dots</option>
                                                <option value="bins">Bins</option>
                                                <option value="swatches">Swatches</option>
                                            </select>
                                        </div>

                                        {(viewMode === 'swatches' || activeTab === 'db') && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Layout:</span>
                                                <select value={swatchLayout} onChange={e => setSwatchLayout(e.target.value)} className="bg-slate-200/50 dark:bg-neutral-800 rounded px-2 py-1.5 text-[10px] font-black uppercase tracking-tight text-slate-700 dark:text-neutral-300 outline-none hover:bg-slate-300/50 dark:hover:bg-neutral-700 transition-colors cursor-pointer border border-transparent focus:border-sky-500">
                                                    <option value="table">Table</option>
                                                    <option value="gallery">Gallery</option>
                                                    <option value="matrix">Matrix</option>
                                                </select>
                                            </div>
                                        )}

                                        <div className="h-4 w-px bg-slate-200 dark:bg-neutral-800"></div>

                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <Icon name="filter" className="w-3.5 h-3.5 text-slate-400" />
                                                <select 
                                                    value={viewportFilter}
                                                    onChange={e => setViewportFilter(e.target.value)}
                                                    className="bg-transparent border-none rounded text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-neutral-300 outline-none cursor-pointer"
                                                >
                                                    <option value="all">All Points</option>
                                                    <option value="pins">Pins Only</option>
                                                    <option value="anchors">Anchors Only</option>
                                                </select>
                                            </div>

                                            <div className="relative">
                                                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                                <input 
                                                    type="text"
                                                    value={viewportSearchQuery}
                                                    onChange={e => setViewportSearchQuery(e.target.value)}
                                                    placeholder="Search..."
                                                    className="w-32 bg-slate-200/40 dark:bg-neutral-800/50 border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                                                />
                                            </div>

                                            <div className="relative">
                                                <Icon name="tag" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                                <input 
                                                    type="text"
                                                    value={viewportTagFilter}
                                                    onChange={e => setViewportTagFilter(e.target.value)}
                                                    placeholder="Tags..."
                                                    className="w-32 bg-slate-200/40 dark:bg-neutral-800/50 border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {(viewMode === 'swatches' || activeTab === 'db') && (
                                            <div className="ml-auto flex items-center gap-3">
                                                <Icon name="zoom-in" className="w-3.5 h-3.5 text-slate-400" />
                                                <input 
                                                    type="range" 
                                                    min="0.3" 
                                                    max="2.5" 
                                                    step="0.1" 
                                                    value={swatchZoom} 
                                                    onChange={e => setSwatchZoom(parseFloat(e.target.value))}
                                                    className="w-24 accent-sky-500 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                                                />
                                                <span className="text-[10px] font-mono text-slate-400 min-w-[30px]">{Math.round(swatchZoom * 100)}%</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <div className="flex-1 relative overflow-hidden">
                                    {activeTab === 'db' && <ViewDatabase colorData={colorData} updateColorData={updateColorData} swatchLayout={swatchLayout} swatchZoom={swatchZoom} handlePointClick={handlePointClick} crosshair={{L: scrubL, C: scrubC, H: scrubH}} searchTerm={viewportSearchQuery} tagFilter={viewportTagFilter} />} 
                                    {activeTab === '3d' && <View3D points={filteredViewData.points} crosshair={crosshair} handlePointClick={handlePointClick} theme={theme} names={names} adjectives={adjectives} savedColors={filteredViewData.savedColors} lockedNouns={lockedNouns} lockedAdjectives={lockedAdjectives} tetheringPinId={tetheringPinId} />}
                                    {activeTab === 'slice' && <ViewVertical points={filteredViewData.points} crosshair={crosshair} handlePointClick={handlePointClick} theme={theme} names={names} adjectives={adjectives} savedColors={filteredViewData.savedColors} lockedNouns={lockedNouns} lockedAdjectives={lockedAdjectives} viewMode={viewMode} tetheringPinId={tetheringPinId} swatchLayout={swatchLayout} swatchZoom={swatchZoom} viewportFilter={viewportFilter} viewportSearchQuery={viewportSearchQuery} />}
                                    {activeTab === 'chroma' && <ViewChromaRings points={filteredViewData.points} crosshair={crosshair} handlePointClick={handlePointClick} theme={theme} names={names} adjectives={adjectives} savedColors={filteredViewData.savedColors} lockedNouns={lockedNouns} lockedAdjectives={lockedAdjectives} viewMode={viewMode} tetheringPinId={tetheringPinId} swatchLayout={swatchLayout} swatchZoom={swatchZoom} viewportFilter={viewportFilter} viewportSearchQuery={viewportSearchQuery} />}
                                    {activeTab === 'top' && <ViewTopDown points={filteredViewData.points} baseAnchors={filteredViewData.baseAnchors} crosshair={crosshair} handlePointClick={handlePointClick} theme={theme} names={names} adjectives={adjectives} savedColors={filteredViewData.savedColors} lockedNouns={lockedNouns} lockedAdjectives={lockedAdjectives} viewMode={viewMode} viewportFilter={viewportFilter} tetheringPinId={tetheringPinId} swatchLayout={swatchLayout} swatchZoom={swatchZoom} viewportSearchQuery={viewportSearchQuery} />}
                                    {activeTab === 'groups' && <ViewGroups settings={groupSettings} setSettings={setGroupSettings} />}
                                    {activeTab === 'adjectives' && <ViewAdjectives gridData={gridData} names={names} adjectives={adjectives} setAdjectives={setAdjectives} handlePointClick={handlePointClick} crosshair={crosshair} lockedAdjectives={lockedAdjectives} savedColors={savedColors} onVisualize={handleVisualize} />}
                                    {activeTab === 'palette' && <ViewPalette baseAnchors={gridData.baseAnchors} points={filteredViewData.points} handlePointClick={handlePointClick} names={names} setNames={setNames} adjectives={adjectives} setAdjectives={setAdjectives} dictNotes={dictNotes} lockedNouns={lockedNouns} lockedAdjectives={lockedAdjectives} savedColors={savedColors} setSavedColors={setSavedColors} dictTags={dictTags} onVisualize={handleVisualize} />}
                                                                        {activeTab === 'pins' && <ViewPins handlePointClick={handlePointClick} names={names} adjectives={adjectives} dictNotes={dictNotes} savedColors={savedColors} setSavedColors={setSavedColors} dictTags={dictTags} selectedIds={selectedIds} setSelectedIds={setSelectedIds} handleBatchTag={handleBatchTag} handleBatchRemoveTag={handleBatchRemoveTag} />}
                                </div>
                            </div>
                        </div>
                    </main>
                    
                    {showCompareFullscreen && compSlotA && compSlotB && (() => { 
                        const cA = new Color('oklch', [compSlotA.L, compSlotA.C, compSlotA.H]);
                        const hA = cA.clone().toGamut({space:'srgb'}).toString({format:'hex'}); 
                        const cB = new Color('oklch', [compSlotB.L, compSlotB.C, compSlotB.H]);
                        const hB = cB.clone().toGamut({space:'srgb'}).toString({format:'hex'}); 
                        const nA = compSlotA.type === 'pin' ? `${compSlotA.adjOverride || adjectives[compSlotA.adjId] || ''} ${compSlotA.nameOverride || names[compSlotA.nounId] || ''}`.trim() : `${adjectives[compSlotA.adjId] || ''} ${names[compSlotA.nounId] || ''}`.trim(); 
                        const nB = compSlotB.type === 'pin' ? `${compSlotB.adjOverride || adjectives[compSlotB.adjId] || ''} ${compSlotB.nameOverride || names[compSlotB.nounId] || ''}`.trim() : `${adjectives[compSlotB.adjId] || ''} ${names[compSlotB.nounId] || ''}`.trim(); 
                        const displayA = nA || (compSlotA.erpCode ? `#${compSlotA.erpCode}` : '—');
                        const displayB = nB || (compSlotB.erpCode ? `#${compSlotB.erpCode}` : '—');
                        return ( 
                            <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300">
                                <div className="absolute top-8 right-8 z-[110] flex gap-2">
                                    <button onClick={() => setShowCompareDivider(!showCompareDivider)} className="bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2">
                                        <Icon name={showCompareDivider ? "eye-off" : "eye"} className="w-4 h-4" />
                                        {showCompareDivider ? "Hide Divider" : "Show Divider"}
                                    </button>
                                    <button onClick={() => setShowCompareFullscreen(false)} className="bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg">
                                        Close Compare
                                    </button>
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-end p-20 relative transition-colors duration-300 cursor-pointer group" style={{ backgroundColor: hA, color: compSlotA.L > 0.65 ? '#010D00' : '#F2E8DF' }} onClick={() => { handleUpdate([compSlotA.L, compSlotA.C, compSlotA.H]); setShowCompareFullscreen(false); }}>
                                    {!cA.inGamut('srgb') && (
                                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 20px, rgba(255,255,255,0.2) 20px, rgba(255,255,255,0.2) 40px)' }}></div>
                                    )}
                                    <div className="text-center relative z-10 group-hover:scale-105 transition-transform">
                                        <div className="text-6xl font-black mb-4 tracking-tight uppercase drop-shadow-md flex items-center justify-center gap-4">
                                            {displayA}
                                            {!cA.inGamut('srgb') && <Icon name="alert-triangle" className="w-12 h-12 text-red-500 drop-shadow-md" title="Out of sRGB Gamut" />}
                                        </div>
                                        <div className="text-xl font-mono uppercase tracking-widest opacity-80 drop-shadow-sm">{compSlotA.erpCode}</div>
                                    </div>
                                </div>
                                {showCompareDivider && <div className="w-8 bg-black z-[105]"></div>}
                                <div className="flex-1 flex flex-col items-center justify-end p-20 relative transition-colors duration-300 cursor-pointer group" style={{ backgroundColor: hB, color: compSlotB.L > 0.65 ? '#010D00' : '#F2E8DF' }} onClick={() => { handleUpdate([compSlotB.L, compSlotB.C, compSlotB.H]); setShowCompareFullscreen(false); }}>
                                    {!cB.inGamut('srgb') && (
                                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 20px, rgba(255,255,255,0.2) 20px, rgba(255,255,255,0.2) 40px)' }}></div>
                                    )}
                                    <div className="text-center relative z-10 group-hover:scale-105 transition-transform">
                                        <div className="text-6xl font-black mb-4 tracking-tight uppercase drop-shadow-md flex items-center justify-center gap-4">
                                            {displayB}
                                            {!cB.inGamut('srgb') && <Icon name="alert-triangle" className="w-12 h-12 text-red-500 drop-shadow-md" title="Out of sRGB Gamut" />}
                                        </div>
                                        <div className="text-xl font-mono uppercase tracking-widest opacity-80 drop-shadow-sm">{compSlotB.erpCode}</div>
                                    </div>
                                </div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-2xl p-8 rounded-3xl text-center shadow-2xl text-white border border-white/10 flex flex-col gap-2 pointer-events-none z-[120]">
                                    <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-2">Delta Distance</div>
                                    <div className="text-5xl font-black font-mono text-sky-400 drop-shadow-md">{deltaEOK} <span className="text-sm text-white/50 tracking-normal ml-1">OK</span></div>
                                    <div className="text-2xl font-bold font-mono opacity-80 drop-shadow-md">{deltaE2000} <span className="text-[10px] text-white/50 tracking-normal ml-1">2000</span></div>
                                    
                                    {compSlotA.spectral && compSlotB.spectral && (
                                        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
                                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1">Metamerism Index</div>
                                            <div className="flex gap-4 justify-center">
                                                <div className="text-center">
                                                    <div className="text-[9px] uppercase text-amber-400/80 mb-0.5">Illum A</div>
                                                    <div className="text-lg font-mono font-bold text-amber-400">{calculateDeltaEFromSpectral(compSlotA.spectral, compSlotB.spectral, observer, 'A').toFixed(2)}</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[9px] uppercase text-amber-400/80 mb-0.5">Illum F2</div>
                                                    <div className="text-lg font-mono font-bold text-amber-400">{calculateDeltaEFromSpectral(compSlotA.spectral, compSlotB.spectral, observer, 'F2').toFixed(2)}</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[9px] uppercase text-amber-400/80 mb-0.5">Illum F11</div>
                                                    <div className="text-lg font-mono font-bold text-amber-400">{calculateDeltaEFromSpectral(compSlotA.spectral, compSlotB.spectral, observer, 'F11').toFixed(2)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div> 
                        ) 
                    })()}
                    
                    {showFullscreenPalette && palette.length > 0 && ( 
                        <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300 bg-neutral-950">
                            <button onClick={() => setShowFullscreenPalette(false)} className="absolute top-8 right-8 z-[110] bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg">
                                Close Palette
                            </button>
                            <div className="flex w-full h-full relative z-10">
                                {palette.map((item) => { 
                                    const c = new Color("oklch", [item.L, item.C, item.H]); 
                                    const h = c.clone().toGamut({space: "srgb"}).toString({format: "hex"}).toUpperCase(); 
                                    let pin = item.pinId ? savedColors[item.pinId] : null;
                                    if (!pin) {
                                        pin = Object.values(savedColors).find(sc => sc.type === 'pin' && sc.erpCode === item.erpCode);
                                    }
                                    const adj = pin?.adjOverride || adjectives[item.adjId] || '';
                                    const noun = pin?.nameOverride || names[item.nounId] || '';
                                    const displayName = `${adj} ${noun}`.trim() || (item.erpCode ? `#${item.erpCode}` : '—');
                                    return ( 
                                        <div key={item.id} className="flex-1 flex flex-col justify-end p-8 transition-all hover:flex-[1.2] cursor-pointer group relative" style={{ backgroundColor: h }} onClick={() => { handleUpdate([item.L, item.C, item.H]); setShowFullscreenPalette(false); }}>
                                            <div className="transition-opacity duration-300 flex flex-col gap-1 relative z-10" style={{ color: item.L > 0.65 ? '#010D00' : '#F2E8DF' }}>
                                                <div className="text-2xl font-black uppercase tracking-tight drop-shadow-md">{displayName}</div>
                                                <div className="text-sm font-mono font-bold tracking-widest opacity-80">{item.erpCode}</div>
                                            </div>
                                        </div> 
                                    ); 
                                })}
                            </div>
                        </div> 
                    )}
                    
                    {visualizeData && (
                        <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300 bg-neutral-950/60 backdrop-blur-xl items-center justify-center p-8">
                            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-neutral-800">
                                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-neutral-800">
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{visualizeData.title}</h2>
                                    <button onClick={() => setVisualizeData(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors">
                                        <Icon name="x" className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                                        {visualizeData.items.map((item, i) => {
                                            const c = new Color("oklch", [item.L, item.C, item.H]);
                                            const hex = c.clone().toGamut({space: "srgb"}).toString({format: "hex"}).toUpperCase();
                                            const isLight = item.L > 0.65;
                                            return (
                                                <div key={i} className="flex flex-col gap-2 group cursor-pointer" onClick={() => { handleUpdate([item.L, item.C, item.H]); setVisualizeData(null); }}>
                                                    <div className="w-full aspect-square rounded-xl shadow-sm border border-slate-200 dark:border-neutral-800 relative overflow-hidden transition-transform group-hover:scale-105" style={{ backgroundColor: hex }}>
                                                        {!c.inGamut('srgb') && (
                                                            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)' }}></div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider truncate text-slate-900 dark:text-white">{item.displayName}</div>
                                                        <div className="text-[9px] font-mono mt-0.5 text-slate-500 dark:text-neutral-400">{item.erpCode}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {showFullscreenPreview && !showCompareFullscreen && ( 
                        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-end p-20 animate-in fade-in duration-300 cursor-pointer" style={{ backgroundColor: crosshairHex }} onClick={() => setShowFullscreenPreview(false)}>
                            <button onClick={(e) => { e.stopPropagation(); setShowFullscreenPreview(false); }} className="absolute top-8 right-8 bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg z-20">
                                Close Preview
                            </button>
                            <div className="bg-black/10 backdrop-blur-xl p-10 rounded-2xl text-center shadow-2xl pointer-events-none relative z-20" style={{ color: isLight ? '#010D00' : '#F2E8DF' }}>
                                <div className="text-6xl font-black mb-4 tracking-tight uppercase drop-shadow-md">{activeAdj} {activeName}</div>
                                <div className="text-xl font-mono uppercase tracking-widest opacity-80 drop-shadow-sm">{crosshair?.activeErpCode || ''}</div>
                            </div>
                        </div> 
                    )}

                    {showHelpPanel && (
                        <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300 bg-neutral-950/80 backdrop-blur-md items-center justify-center p-4 md:p-8">
                            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-neutral-800">
                                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50">
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                                        <Icon name="help-circle" className="w-6 h-6 text-sky-500" />
                                        App Guide & OKLCH Concepts
                                    </h2>
                                    <button onClick={() => setShowHelpPanel(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors">
                                        <Icon name="x" className="w-6 h-6" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar text-slate-700 dark:text-neutral-300 space-y-10">
                                    
                                    <section>
                                        <h3 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-neutral-800 pb-2">What is OKLCH?</h3>
                                        <p className="mb-4 leading-relaxed">OKLCH is a perceptually uniform color space. Unlike RGB or HEX, which are built for screens, OKLCH is built for human eyes. It ensures that changes in color values match how we actually perceive those changes.</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-slate-50 dark:bg-neutral-800/50 p-5 rounded-xl border border-slate-100 dark:border-neutral-800">
                                                <div className="text-lg font-black text-sky-500 mb-2">L (Lightness)</div>
                                                <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">0 to 1 (or 0% to 100%)</div>
                                                <p className="text-sm leading-relaxed">How bright or dark the color is. 0 is pure black, 1 is pure white. Because it's perceptually uniform, a lightness of 0.5 always looks exactly halfway between black and white.</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-neutral-800/50 p-5 rounded-xl border border-slate-100 dark:border-neutral-800">
                                                <div className="text-lg font-black text-pink-500 mb-2">C (Chroma)</div>
                                                <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">0 to ~0.4 (or higher)</div>
                                                <p className="text-sm leading-relaxed">The intensity, purity, or saturation of the color. 0 is completely grayscale (white, gray, or black). Higher values are more vivid. The maximum chroma depends on the lightness and hue.</p>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-neutral-800/50 p-5 rounded-xl border border-slate-100 dark:border-neutral-800">
                                                <div className="text-lg font-black text-emerald-500 mb-2">H (Hue)</div>
                                                <div className="text-sm font-bold uppercase tracking-wider opacity-60 mb-2">0 to 360 degrees</div>
                                                <p className="text-sm leading-relaxed">The actual color family (red, green, blue, etc.), arranged in a circle. 0/360 is pinkish-red, 90 is yellow-green, 180 is cyan/teal, and 270 is blue.</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-neutral-800 pb-2">Navigation & Views</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="flex gap-4 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl">
                                                <div className="mt-1 text-sky-500"><Icon name="box" className="w-6 h-6" /></div>
                                                <div>
                                                    <div className="font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white">3D View</div>
                                                    <p className="text-sm leading-relaxed opacity-80">Explore the entire color gamut in a 3D scatter plot. Rotate, zoom, and pan to understand the shape of the color space.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl">
                                                <div className="mt-1 text-sky-500"><Icon name="align-center-vertical" className="w-6 h-6" /></div>
                                                <div>
                                                    <div className="font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white">Vertical Slice</div>
                                                    <p className="text-sm leading-relaxed opacity-80">A 2D cross-section showing Lightness (Y-axis) vs Chroma (X-axis) locked at the current Hue. Great for finding the most vivid color at a specific hue.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl">
                                                <div className="mt-1 text-sky-500"><Icon name="target" className="w-6 h-6" /></div>
                                                <div>
                                                    <div className="font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white">Chroma Rings</div>
                                                    <p className="text-sm leading-relaxed opacity-80">A polar view showing Hue (angle) vs Chroma (distance from center) locked at the current Lightness. Useful for finding complementary colors.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl">
                                                <div className="mt-1 text-sky-500"><Icon name="map" className="w-6 h-6" /></div>
                                                <div>
                                                    <div className="font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white">Top-Down</div>
                                                    <p className="text-sm leading-relaxed opacity-80">A flattened 2D map of Hue vs Chroma, ignoring Lightness. Gives a bird's-eye view of all available colors.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-neutral-800 pb-2">Tools & Features</h3>
                                        <div className="space-y-4">
                                            <div className="flex gap-4">
                                                <div className="mt-1 text-slate-400"><Icon name="map-pin" className="w-5 h-5" /></div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white">Pins & Anchors</div>
                                                    <p className="text-sm leading-relaxed opacity-80">Click the Pin icon to save a specific coordinate. Anchors are predefined grid points. You can lock anchors to prevent them from being renamed.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="mt-1 text-slate-400"><Icon name="palette" className="w-5 h-5" /></div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white">Palette & Compare</div>
                                                    <p className="text-sm leading-relaxed opacity-80">Add colors to your Palette for quick access. Use the Compare slots (A and B) to see two colors side-by-side and calculate their perceptual difference (Delta E).</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="mt-1 text-slate-400"><Icon name="type" className="w-5 h-5" /></div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white">Naming System</div>
                                                    <p className="text-sm leading-relaxed opacity-80">Colors are named using an Adjective (based on Lightness) and a Noun (based on Hue and Chroma). You can override these names for specific pins.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="mt-1 text-slate-400"><Icon name="activity" className="w-5 h-5" /></div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white">Delta E (ΔE)</div>
                                                    <p className="text-sm leading-relaxed opacity-80">A metric for understanding how different two colors look to the human eye. A Delta E &lt; 1 is generally imperceptible. Delta E OK uses the OKLCH space, while Delta E 2000 is an older, widely used standard.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    )}

                    {showFileManager && (
                        <FileManager 
                            linkedFiles={linkedFiles}
                            setLinkedFiles={setLinkedFiles}
                            onClose={() => setShowFileManager(false)}
                        />
                    )}

                    {showDatabaseManager && (
                        <DatabaseManager 
                            colorData={colorData} 
                            updateColorData={updateColorData} 
                            savedColors={savedColors}
                            setSavedColors={setSavedColors}
                            onClose={() => setShowDatabaseManager(false)} 
                        />
                    )}
                </div>
            );
        };
        
        
    
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
