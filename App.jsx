const { useState, useEffect, useMemo, useRef, useCallback } = React;
const Icon = ({ name, className = "w-4 h-4" }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      const temp = document.createElement("div");
      temp.innerHTML = `<i data-lucide="${name}" class="${className}"></i>`;
      window.lucide.createIcons({ root: temp });
      ref.current.innerHTML = temp.innerHTML;
    }
  }, [name, className]);
  return React.createElement("span", { ref, style: { display: "contents" } });
};
const LABEL_OPTIONS = {
  sheen: ['-', 'SM (Super Matte)', 'MT (Matte)', 'ST (Satin)', 'HG (High Gloss)'],
  visualPattern: ['-', 'V1 (Solid)', 'V2 (Straight Grain)', 'V3 (Cathedral Grain)', 'V4 (Rustic/Heavy)', 'V5 (Abstract/Stipple)'],
  tactileTexture: ['-', 'T1 (Smooth)', 'T2 (Stipple)', 'T3 (Linear Grain)', 'T4 (EIR/Natural)'],
  doorProfile: ['-', 'SL (Slab)', 'CS (Shaker)', 'SS (Slim)', 'RD (Reeded)', 'CT (Countertop)', 'WG (Wood-Framed Glass)', 'MG (Metal-framed Glass)'],
  material: ['-', 'Solid Laminate', 'Textured Laminate', 'Lacquered MDF', 'Natural Oak', 'Natural Maple']
};
const defaultGroupSettings = {
  lightL: 0.5,
  neutralC: 0.02,
  vividC: 0.1,
  neutrals: [
    { id: "n1", name: "Dark Neutral", maxL: 0.5 },
    { id: "n2", name: "Light Neutral", maxL: 1 },
  ],
  hues: [
    { id: "h1", name: "Red", maxH: 35 },
    { id: "h2", name: "Orange", maxH: 70 },
    { id: "h3", name: "Yellow", maxH: 115 },
    { id: "h4", name: "Green", maxH: 165 },
    { id: "h5", name: "Cyan", maxH: 225 },
    { id: "h6", name: "Blue", maxH: 285 },
    { id: "h7", name: "Magenta", maxH: 345 },
  ],
  overrides: [
    { id: "o1", condition: "Light Muted Yellow", name: "Beige" },
    { id: "o2", condition: "Dark Vivid Blue", name: "Navy" },
  ],
};
function getColorGroup(l, c, h, settings) {
  const {
    neutralC = 0.02,
    vividC = 0.1,
    lightL = 0.5,
    hues = defaultGroupSettings.hues,
    overrides = defaultGroupSettings.overrides,
    neutrals = defaultGroupSettings.neutrals,
  } = settings || defaultGroupSettings;
  let baseName = "";
  if (c < neutralC) {
    const sortedNeutrals = [
      ...(neutrals || defaultGroupSettings.neutrals),
    ].sort((a, b) => a.maxL - b.maxL);
    let neutralName = "Neutral";
    let found = false;
    for (let i = 0; i < sortedNeutrals.length; i++) {
      if (l <= sortedNeutrals[i].maxL) {
        neutralName = sortedNeutrals[i].name;
        found = true;
        break;
      }
    }
    if (!found && sortedNeutrals.length > 0) {
      neutralName = sortedNeutrals[sortedNeutrals.length - 1].name;
    }
    baseName = neutralName;
  } else {
    let hueName = "Unknown";
    const sortedHues = [...hues].sort((a, b) => a.maxH - b.maxH);
    let found = false;
    for (let i = 0; i < sortedHues.length; i++) {
      if (h < sortedHues[i].maxH) {
        hueName = sortedHues[i].name;
        found = true;
        break;
      }
    }
    if (!found && sortedHues.length > 0) {
      hueName = sortedHues[0].name;
    }
    const lMod = l >= lightL ? "Light" : "Dark";
    const cMod = c >= vividC ? "Vivid" : "Muted";
    baseName = `${lMod} ${cMod} ${hueName}`;
  }
  if (overrides && overrides.length > 0) {
    const match = overrides.find(
      (o) => o.condition.trim().toLowerCase() === baseName.toLowerCase(),
    );
    if (match && match.name.trim() !== "") return match.name.trim();
  }
  return baseName;
}
function getNounPrefix(L, C) {
  return "";
}
function getLayerName(prefix) {
  switch (prefix) {
    case "UL":
      return "Ultra Light";
    case "L":
      return "Light";
    case "D":
      return "Dark";
    case "UD":
      return "Ultra Dark";
    default:
      return "Unknown";
  }
}
function getLStr(L) {
  const lVal = Math.round(L * 50) * 2;
  return Math.min(100, Math.max(0, lVal)).toString().padStart(2, "0");
}
function getExactErpCode(L, C, H) {
  const lStr = Math.round(L * 100)
    .toString()
    .padStart(2, "0");
  const cStr = Math.round(C * 100)
    .toString()
    .padStart(2, "0");
  const hVal = isNaN(H) ? 0 : H;
  const hStr = Math.round(hVal).toString().padStart(3, "0");
  return `${lStr}${cStr}${hStr}`;
}
function applyJitter(items, xKey, yKey, zKey = null, jitterAmt = 0.003) {
  const placed = [];
  return items.map((item) => {
    let x = item[xKey],
      y = item[yKey],
      z = zKey ? item[zKey] : 0;
    if (isNaN(x) || isNaN(y)) return { ...item, _jX: x, _jY: y, _jZ: z };
    let overlapIdx = -1;
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const dx = p.x - x,
        dy = p.y - y,
        dz = zKey ? p.z - z : 0;
      if (
        Math.abs(dx) < 0.001 &&
        Math.abs(dy) < 0.001 &&
        Math.abs(dz) < 0.001
      ) {
        overlapIdx = i;
        break;
      }
    }
    if (overlapIdx >= 0) {
      placed[overlapIdx].collisions = (placed[overlapIdx].collisions || 0) + 1;
      const c = placed[overlapIdx].collisions;
      const angle = c * Math.PI * 0.5;
      const rad = Math.ceil(c / 4) * jitterAmt;
      x += Math.cos(angle) * rad;
      y += Math.sin(angle) * rad;
      if (zKey && c % 2 === 0) z += (c % 4 === 2 ? 1 : -1) * rad * 0.5;
    }
    placed.push({ x, y, z, collisions: 0 });
    return { ...item, _jX: x, _jY: y, _jZ: z };
  });
}
function getGlobalDuplicate(
  names,
  adjectives,
  currentKey,
  value,
  savedColors = {},
  isOverride = true,
  ignoreAnchorId = null,
) {
  if (!value || !isOverride) return null;
  const normalizedVal = value.trim().toLowerCase();
  if (!normalizedVal) return null;
  for (const [key, val] of Object.entries(names)) {
    if (
      key !== currentKey &&
      key !== ignoreAnchorId &&
      val &&
      val.trim().toLowerCase() === normalizedVal
    ) {
      return `Noun (${key})`;
    }
  }
  for (const [key, val] of Object.entries(adjectives)) {
    if (
      key !== currentKey &&
      key !== ignoreAnchorId &&
      val &&
      val.trim().toLowerCase() === normalizedVal
    ) {
      return `Layer Adj (${key})`;
    }
  }
  for (const [id, pt] of Object.entries(savedColors)) {
    if (id !== currentKey && pt.type === "pin") {
      if (
        pt.nameOverride &&
        pt.nameOverride.trim().toLowerCase() === normalizedVal
      ) {
        if (pt.anchorId === currentKey || pt.anchorId === ignoreAnchorId)
          continue;
        return `Pin Noun (${pt.erpCode})`;
      }
      if (
        pt.adjOverride &&
        pt.adjOverride.trim().toLowerCase() === normalizedVal
      ) {
        if (pt.adjId === currentKey || pt.adjId === ignoreAnchorId) continue;
        return `Pin Adj (${pt.erpCode})`;
      }
    }
  }
  return null;
}
function generateGridPoints(maxC = 0.3, maxL = 1) {
  return { baseAnchors: [], allPoints: [] };
}
function generateGridData() {
  return generateGridPoints(0.3, 1);
}
const SliderGroup = ({ label, value, min, max, step, onChange, icon }) =>
  React.createElement(
    "div",
    { className: "flex flex-col gap-2" },
    React.createElement(
      "div",
      { className: "flex justify-between items-center" },
      React.createElement(
        "span",
        {
          className:
            "text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 text-slate-700 dark:text-neutral-200",
        },
        React.createElement(Icon, {
          name: icon,
          className: "w-3.5 h-3.5 slider-icon",
        }),
        " ",
        label,
      ),
      React.createElement("input", {
        type: "number",
        step,
        value,
        onChange: (e) => onChange(parseFloat(e.target.value) || 0),
        className:
          "w-16 text-right text-xs font-mono font-bold bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white",
      }),
    ),
    React.createElement("input", {
      type: "range",
      min,
      max,
      step,
      value,
      onChange: (e) => onChange(parseFloat(e.target.value)),
      className: "w-full",
    }),
  );
const CollapsiblePanel = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return React.createElement(
    "div",
    { className: "border-b border-slate-200 dark:border-neutral-800" },
    React.createElement(
      "button",
      {
        onClick: () => setIsOpen(!isOpen),
        className:
          "w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors",
      },
      React.createElement(
        "div",
        {
          className:
            "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-neutral-200",
        },
        React.createElement(Icon, {
          name: icon,
          className: "w-4 h-4 slider-icon",
        }),
        " ",
        title,
      ),
      React.createElement(Icon, {
        name: isOpen ? "chevron-up" : "chevron-down",
        className: "w-4 h-4 text-slate-400",
      }),
    ),
    isOpen && React.createElement("div", { className: "p-4 pt-0" }, children),
  );
};
const SPECTRAL_TABLES = {
  wavelengths: [
    400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540,
    550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690,
    700,
  ],
  cmf2: {
    x: [
      0.0143, 0.0435, 0.1344, 0.2839, 0.3483, 0.3362, 0.2908, 0.1954, 0.0956,
      0.032, 0.0049, 0.0093, 0.0633, 0.1655, 0.2904, 0.4334, 0.5945, 0.7621,
      0.9163, 1.0263, 1.0622, 1.0026, 0.8544, 0.6424, 0.4479, 0.2835, 0.1649,
      0.0874, 0.0468, 0.0227, 0.0114,
    ],
    y: [
      4e-4, 0.0012, 0.004, 0.0116, 0.023, 0.038, 0.06, 0.091, 0.139, 0.208,
      0.323, 0.503, 0.71, 0.862, 0.954, 0.995, 0.995, 0.952, 0.87, 0.757, 0.631,
      0.503, 0.381, 0.265, 0.175, 0.107, 0.061, 0.032, 0.017, 0.008, 0.004,
    ],
    z: [
      0.0679, 0.2074, 0.6456, 1.3856, 1.7471, 1.7721, 1.6692, 1.2876, 0.813,
      0.4652, 0.272, 0.1582, 0.0782, 0.0422, 0.0203, 0.0087, 0.0039, 0.0017,
      8e-4, 4e-4, 2e-4, 1e-4, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
  },
  cmf10: {
    x: [
      0.0191, 0.0847, 0.2045, 0.3147, 0.3837, 0.3707, 0.3023, 0.1956, 0.0805,
      0.0162, 0.0038, 0.0389, 0.134, 0.2541, 0.3929, 0.543, 0.7035, 0.8444,
      0.9464, 1.031, 1.0456, 0.9298, 0.76, 0.57, 0.398, 0.2519, 0.1421, 0.0732,
      0.0376, 0.0192, 0.0098,
    ],
    y: [
      0.002, 0.0088, 0.0214, 0.0387, 0.0621, 0.0895, 0.1282, 0.1852, 0.2536,
      0.3391, 0.4608, 0.6067, 0.7618, 0.8752, 0.962, 0.9918, 0.9973, 0.9556,
      0.8689, 0.76, 0.6285, 0.4831, 0.3621, 0.249, 0.1614, 0.0956, 0.0527,
      0.0267, 0.0135, 0.0068, 0.0035,
    ],
    z: [
      0.086, 0.3894, 0.9725, 1.5523, 1.9673, 1.9948, 1.7454, 1.3171, 0.7721,
      0.3713, 0.1859, 0.092, 0.041, 0.0178, 0.0076, 0.0031, 0.0012, 5e-4, 2e-4,
      1e-4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
  },
  illuminants: {
    D50: [
      53.24, 65.75, 70.08, 63.63, 80.19, 93.45, 96.11, 95.77, 98.71, 94.75,
      97.47, 98.48, 97.52, 102.15, 100.22, 101.44, 100, 98.34, 100.07, 95.04,
      98.94, 98.54, 98.17, 95.12, 97.54, 95.47, 97.35, 101.37, 98.05, 88.58,
      92.44,
    ],
    D65: [
      82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92,
      108.81, 109.35, 107.8, 104.79, 107.69, 104.41, 104.05, 100, 96.33, 95.79,
      88.77, 90.01, 89.6, 87.7, 83.29, 83.7, 80.03, 80.21, 82.28, 78.28, 69.71,
      71.61,
    ],
    A: [
      14.71, 17.68, 21, 24.67, 28.7, 33.09, 37.82, 42.87, 48.25, 53.91, 59.86,
      66.06, 72.5, 79.13, 85.95, 92.91, 100, 107.18, 114.44, 121.73, 129.04,
      136.34, 143.62, 150.83, 157.98, 165.03, 171.96, 178.77, 185.43, 191.93,
      198.26,
    ],
    F2: [
      20.3, 31.5, 38, 58, 82, 54, 56, 60, 66, 75, 86, 95, 100, 102, 101, 96, 90,
      94, 104, 89, 77, 65, 55, 46, 38, 31, 26, 21, 17, 14, 11,
    ],
    F11: [
      19, 10, 13, 38, 24, 16, 14, 14, 16, 22, 31, 41, 53, 66, 100, 91, 65, 50,
      64, 53, 38, 100, 42, 22, 13, 8, 5, 3, 2, 1, 1,
    ],
  },
};
const calculateXYZFromSpectral = (spectral, observer, illuminant) => {
  const cmfs = observer === 10 ? SPECTRAL_TABLES.cmf10 : SPECTRAL_TABLES.cmf2;
  let illKey = String(illuminant || "").toUpperCase();
  if (illKey.includes("D50")) illKey = "D50";
  else if (illKey.includes("D65")) illKey = "D65";
  else if (illKey.includes("F2")) illKey = "F2";
  else if (illKey.includes("F11")) illKey = "F11";
  else if (illKey.startsWith("A")) illKey = "A";
  const ill =
    SPECTRAL_TABLES.illuminants[illKey] || SPECTRAL_TABLES.illuminants.D50;
  let X = 0,
    Y = 0,
    Z = 0,
    sumY = 0;
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
  const f = (t) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116);
  const fx = f(xyz[0] / whitePoint[0]);
  const fy = f(xyz[1] / whitePoint[1]);
  const fz = f(xyz[2] / whitePoint[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const labToLch = (lab) => {
  const [l, a, b] = lab;
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [l, c, h];
};
const calculateDeltaEFromSpectral = (
  spectralA,
  spectralB,
  observer,
  illuminant,
) => {
  const xyzA = calculateXYZFromSpectral(spectralA, observer, illuminant);
  const xyzB = calculateXYZFromSpectral(spectralB, observer, illuminant);
  const wp = getWhitePoint(observer, illuminant);
  const labA = xyzToLab(xyzA, wp);
  const labB = xyzToLab(xyzB, wp);
  const cA = new Color("lab", labA);
  const cB = new Color("lab", labB);
  return cA.deltaE(cB, "2000");
};
const ColorConverter = ({
  crosshair,
  onEdit,
  observer,
  setObserver,
  illuminant,
  setIlluminant,
  colorData,
}) => {
  if (!crosshair) return null;
  const c = new Color("oklch", [
    crosshair.rawL,
    crosshair.rawC,
    crosshair.rawH,
  ]);
  const hex = c
    .clone()
    .toGamut({ space: "srgb" })
    .toString({ format: "hex" })
    .toUpperCase();
  const fmt = (v, d = 3) => (isNaN(v) ? "0.000" : Number(v).toFixed(d));
  const wrap = (space) =>
    `[${fmt(c.to(space).coords[0])}, ${fmt(c.to(space).coords[1])}, ${fmt(c.to(space).coords[2])}]`;
  const spectral =
    crosshair.activeSavedColor?.spectral || crosshair.temporarySpectral;
  let varXYZ = null;
  let varLab = null;
  let varLch = null;
  if (spectral) {
    varXYZ = calculateXYZFromSpectral(spectral, observer, illuminant);
    const wp = getWhitePoint(observer, illuminant);
    varLab = xyzToLab(varXYZ, wp);
    varLch = labToLch(varLab);
  } else {
    const targetXyzSpace = illuminant === "D50" ? "xyz-d50" : "xyz-d65";
    varXYZ = c.to(targetXyzSpace).coords;
    const wp = getWhitePoint(observer, illuminant);
    varLab = xyzToLab(varXYZ, wp);
    varLch = labToLch(varLab);
  }
  const EditableColorField = ({
    label,
    value,
    space,
    onEdit: onEdit2,
    isOutOfGamut,
    readOnly = false,
  }) => {
    const [localVal, setLocalVal] = useState(value);
    const [isFocused, setIsFocused] = useState(false);
    useEffect(() => {
      if (!isFocused) setLocalVal(value);
    }, [value, isFocused]);
    const applyChange = (val) => {
      if (readOnly) return;
      try {
        let pc;
        if (space === "Hex") {
          const ch = val.trim();
          if (/^#?[0-9a-fA-F]{3,8}$/.test(ch))
            pc = new Color(ch.startsWith("#") ? ch : "#" + ch);
        } else {
          const p = val
            .replace(/[\[\]]/g, "")
            .split(/[\s,;]+/)
            .filter((x) => x !== "")
            .map((s) => parseFloat(s));
          if (p.length === 3 && p.every((v) => !isNaN(v))) {
            const sm = {
              OKLCH: "oklch",
              OKLAB: "oklab",
              "CIE LAB": "lab",
              "XYZ D50": "xyz-d50",
              "XYZ D65": "xyz-d65",
              "CIE LCH": "lch",
              HSL: "hsl",
            };
            if (space === "RGB")
              pc = new Color("srgb", [p[0] / 255, p[1] / 255, p[2] / 255]);
            else if (sm[space]) pc = new Color(sm[space], p);
          }
        }
        if (pc) {
          const o = pc.to("oklch");
          onEdit2([
            o.coords[0],
            o.coords[1],
            isNaN(o.coords[2]) ? 0 : o.coords[2],
          ]);
        }
      } catch (err) {}
    };
    return React.createElement(
      "div",
      { className: "flex flex-col" },
      React.createElement(
        "label",
        {
          className:
            "text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase mb-0.5 tracking-tighter flex items-center justify-between",
        },
        React.createElement("span", null, label),
        isOutOfGamut &&
          space === "Hex" &&
          React.createElement(Icon, {
            name: "alert-triangle",
            className: "w-3 h-3 text-red-500",
            title: "Out of sRGB Gamut",
          }),
      ),
      React.createElement("input", {
        type: "text",
        value: localVal,
        readOnly,
        onFocus: () => setIsFocused(true),
        onBlur: () => {
          setIsFocused(false);
          applyChange(localVal);
        },
        onKeyDown: (e) => e.key === "Enter" && e.target.blur(),
        onChange: (e) => setLocalVal(e.target.value),
        spellCheck: "false",
        className: `w-full bg-slate-100 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded px-1.5 py-1 font-mono text-[10px] ${readOnly ? "text-slate-500 dark:text-neutral-500 cursor-not-allowed" : "text-slate-800 dark:text-neutral-200"} focus:outline-none focus:border-sky-500 transition-all`,
      }),
    );
  };
  return React.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        {
          className:
            "text-[10px] font-bold text-slate-600 dark:text-neutral-300 uppercase mb-2 border-b border-slate-200 dark:border-neutral-800 pb-1",
        },
        "Fixed Spaces (D65 / 2\xB0)",
      ),
      React.createElement(
        "div",
        { className: "grid grid-cols-2 gap-3" },
        React.createElement(EditableColorField, {
          label: "OKLCH",
          space: "OKLCH",
          value: `[${fmt(c.coords[0])}, ${fmt(c.coords[1])}, ${fmt(c.coords[2], 1)}]`,
          onEdit,
        }),
        React.createElement(EditableColorField, {
          label: "OKLAB",
          space: "OKLAB",
          value: wrap("oklab"),
          onEdit,
        }),
        React.createElement(EditableColorField, {
          label: "RGB",
          space: "RGB",
          value: `[${Math.round(c.to("srgb").coords[0] * 255)}, ${Math.round(c.to("srgb").coords[1] * 255)}, ${Math.round(c.to("srgb").coords[2] * 255)}]`,
          onEdit,
        }),
        React.createElement(EditableColorField, {
          label: "HEX",
          space: "Hex",
          value: hex,
          onEdit,
          isOutOfGamut: !c.inGamut("srgb"),
        }),
        React.createElement(EditableColorField, {
          label: "HSL",
          space: "HSL",
          value: `[${fmt(c.to("hsl").coords[0], 1)}, ${fmt(c.to("hsl").coords[1])}%, ${fmt(c.to("hsl").coords[2])}%]`,
          onEdit,
        }),
      ),
    ),
    React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        {
          className:
            "text-[10px] font-bold text-slate-600 dark:text-neutral-300 uppercase mb-2 border-b border-slate-200 dark:border-neutral-800 pb-1 flex justify-between items-center",
        },
        React.createElement("span", null, "Variable Spaces"),
        !spectral &&
          React.createElement(
            "span",
            {
              className:
                "text-[8px] text-amber-500 font-normal normal-case flex items-center gap-1",
            },
            React.createElement(Icon, { name: "info", className: "w-3 h-3" }),
            " Spectral data required",
          ),
      ),
      React.createElement(
        "div",
        { className: "grid grid-cols-2 gap-2 mb-3" },
        React.createElement(
          "div",
          { className: "flex flex-col gap-1" },
          React.createElement(
            "span",
            {
              className:
                "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider",
            },
            "Observer",
          ),
          React.createElement(
            "select",
            {
              value: observer,
              onChange: (e) => setObserver(parseInt(e.target.value)),
              disabled: !spectral,
              className:
                "bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-sky-500 transition-all disabled:opacity-50",
            },
            React.createElement("option", { value: 2 }, "2\xB0 (CIE 1931)"),
            React.createElement("option", { value: 10 }, "10\xB0 (CIE 1964)"),
          ),
        ),
        React.createElement(
          "div",
          { className: "flex flex-col gap-1" },
          React.createElement(
            "span",
            {
              className:
                "text-[9px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider",
            },
            "Illuminant",
          ),
          React.createElement(
            "select",
            {
              value: illuminant,
              onChange: (e) => setIlluminant(e.target.value),
              disabled: !spectral,
              className:
                "bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-sky-500 transition-all disabled:opacity-50",
            },
            React.createElement("option", { value: "D65" }, "D65"),
            React.createElement("option", { value: "D50" }, "D50"),
            React.createElement("option", { value: "A" }, "A (Incandescent)"),
            React.createElement("option", { value: "F2" }, "F2 (Cool White)"),
            React.createElement(
              "option",
              { value: "F11" },
              "F11 (Narrow Band)",
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "grid grid-cols-2 gap-3" },
        React.createElement(EditableColorField, {
          label: `CIE LAB (${illuminant}/${observer}\xB0)`,
          space: "CIE LAB",
          value: `[${fmt(varLab[0])}, ${fmt(varLab[1])}, ${fmt(varLab[2])}]`,
          readOnly: true,
        }),
        React.createElement(EditableColorField, {
          label: `CIE LCH (${illuminant}/${observer}\xB0)`,
          space: "CIE LCH",
          value: `[${fmt(varLch[0])}, ${fmt(varLch[1])}, ${fmt(varLch[2], 1)}]`,
          readOnly: true,
        }),
        React.createElement(EditableColorField, {
          label: `XYZ (${illuminant}/${observer}\xB0)`,
          space: "XYZ",
          value: `[${fmt(varXYZ[0])}, ${fmt(varXYZ[1])}, ${fmt(varXYZ[2])}]`,
          readOnly: true,
        }),
      ),
    ),
  );
};
const CommercialMatches = ({ crosshair, colorData, onSelectColor }) => {
  if (!crosshair) return null;
  const c = new Color("oklch", [
    crosshair.rawL,
    crosshair.rawC,
    crosshair.rawH,
  ]);
  const hex = c
    .clone()
    .toGamut({ space: "srgb" })
    .toString({ format: "hex" })
    .toUpperCase();
  const fmt = (v, d = 3) => (isNaN(v) ? "0.000" : Number(v).toFixed(d));
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [maxDeltaE, setMaxDeltaE] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredMatches = useMemo(() => {
    if (!colorData || Object.keys(colorData).length === 0) return null;
    const allMatches = [];
    const processList = (list, label, brandKey) => {
      if (!list || !Array.isArray(list)) return;
      for (let listIdx = 0; listIdx < list.length; listIdx++) {
        const item = list[listIdx];
        try {
          let hexVal = item.hex || "#000000";
          let targetColor;
          if (item.spectral && item.spectral.length === 31) {
            const xyzStandard = calculateXYZFromSpectral(
              item.spectral,
              2,
              "D65",
            );
            targetColor = new Color("xyz-d65", xyzStandard).to("oklch");
            hexVal = targetColor.to("srgb").toString({ format: "hex" });
          } else if (
            item.L !== void 0 &&
            item.C !== void 0 &&
            item.H !== void 0
          ) {
            targetColor = new Color("oklch", [item.L, item.C, item.H]);
          } else {
            targetColor = new Color(item.hex).to("oklch");
          }
          const d = c.deltaE(targetColor, "OK") * 100;
          if (d <= maxDeltaE) {
            allMatches.push({
              label,
              match: {
                ...item,
                hex: hexVal,
                L: targetColor.coords[0],
                C: targetColor.coords[1],
                H: isNaN(targetColor.coords[2]) ? 0 : targetColor.coords[2],
                d,
                brand: brandKey,
                originalIndex: listIdx,
              },
            });
          }
        } catch (e) {}
      }
    };
    Object.entries(colorData).forEach(([brandKey, list]) => {
      const label = getBrandDisplayName(brandKey);
      processList(list, label, brandKey);
    });
    const qWords = searchQuery
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const searchedMatches =
      qWords.length > 0
        ? allMatches.filter((item) => {
            return qWords.every(
              (w) =>
                item.label.toLowerCase().includes(w) ||
                (item.match.name &&
                  item.match.name.toLowerCase().includes(w)) ||
                (item.match.url && item.match.url.toLowerCase().includes(w)) ||
                (item.match.tags &&
                  item.match.tags.some((t) => t.toLowerCase().includes(w))),
            );
          })
        : allMatches;
    searchedMatches.sort((a, b) => {
      const aVerified = a.match.spectral && a.match.spectral.length > 0 ? 1 : 0;
      const bVerified = b.match.spectral && b.match.spectral.length > 0 ? 1 : 0;
      if (aVerified !== bVerified) return bVerified - aVerified;
      return a.match.d - b.match.d;
    });
    return searchedMatches.slice(0, 100);
  }, [
    c.coords[0],
    c.coords[1],
    c.coords[2],
    colorData,
    maxDeltaE,
    searchQuery,
  ]);
  const MatchRow = ({ label, match }) => {
    if (!match) return null;
    const isVerified = match.spectral && match.spectral.length > 0;
    const handleRowClick = () => {
      if (onSelectColor) {
        onSelectColor(
          [match.L, match.C, isNaN(match.H) ? 0 : match.H],
          match.spectral,
          { brand: match.brand, originalIndex: match.originalIndex },
        );
      }
    };
    return React.createElement(
      "div",
      {
        className: `flex items-center gap-3 p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${isVerified ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30" : "bg-slate-50 dark:bg-neutral-800/50 border-slate-100 dark:border-neutral-800"}`,
        onClick: handleRowClick,
      },
      match.image
        ? React.createElement(
            "div",
            {
              className:
                "relative group w-8 h-8 rounded shadow-sm shrink-0 border border-slate-200 dark:border-neutral-700 bg-cover bg-center",
              style: { backgroundImage: `url(${match.image})` },
            },
            React.createElement(
              "button",
              {
                className:
                  "absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity",
                onClick: (e) => {
                  e.stopPropagation();
                  setFullscreenImage(match.image);
                },
              },
              React.createElement(Icon, {
                name: "maximize-2",
                className: "w-4 h-4 text-white",
              }),
            ),
          )
        : React.createElement("div", {
            className:
              "w-8 h-8 rounded shadow-sm shrink-0 border border-slate-200 dark:border-neutral-700",
            style: { backgroundColor: match.hex },
          }),
      React.createElement(
        "div",
        { className: "flex flex-col flex-1 min-w-0" },
        React.createElement(
          "div",
          { className: "flex items-center gap-1.5" },
          React.createElement(
            "div",
            {
              className:
                "text-[11px] font-medium text-slate-800 dark:text-neutral-200 truncate",
            },
            match.name,
          ),
          isVerified &&
            React.createElement(Icon, {
              name: "check-circle",
              className: "w-3.5 h-3.5 text-emerald-500 shrink-0",
              title: "Verified with Spectral Data",
            }),
        ),
        React.createElement(
          "div",
          {
            className:
              "text-[9px] text-slate-500 dark:text-neutral-500 uppercase tracking-wider",
          },
          label,
          " \xB7 \u0394Eok ",
          fmt(match.d, 2),
        ),
      ),
    );
  };
  return React.createElement(
    "div",
    { className: "flex flex-col gap-2" },
    React.createElement(
      "div",
      {
        className:
          "flex flex-col gap-2 p-2 bg-slate-50 dark:bg-neutral-800/50 rounded border border-slate-100 dark:border-neutral-800",
      },
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        React.createElement(Icon, {
          name: "search",
          className: "w-3.5 h-3.5 text-slate-400",
        }),
        React.createElement("input", {
          type: "text",
          placeholder: "Filter by brand or name...",
          className:
            "flex-1 bg-transparent text-[11px] outline-none text-slate-700 dark:text-neutral-300 placeholder:text-slate-400",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
        }),
        searchQuery &&
          React.createElement(
            "button",
            {
              onClick: () => setSearchQuery(""),
              className: "text-slate-400 hover:text-slate-600",
            },
            React.createElement(Icon, { name: "x", className: "w-3 h-3" }),
          ),
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        React.createElement(
          "div",
          { className: "text-[10px] text-slate-500 w-12" },
          "\u0394E \u2264 ",
          maxDeltaE.toFixed(2),
        ),
        React.createElement("input", {
          type: "range",
          min: "0.00",
          max: "50.00",
          step: "0.05",
          value: maxDeltaE,
          onChange: (e) => setMaxDeltaE(parseFloat(e.target.value)),
          className:
            "flex-1 h-1 bg-slate-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer",
        }),
      ),
    ),
    filteredMatches
      ? React.createElement(
          "div",
          {
            className:
              "flex flex-col gap-1.5 max-h-[400px] overflow-y-auto pr-1",
          },
          filteredMatches.map((item, idx) =>
            React.createElement(MatchRow, {
              key: item.label + idx + item.match.name,
              label: item.label,
              match: item.match,
            }),
          ),
          filteredMatches.length === 0 &&
            React.createElement(
              "div",
              {
                className: "text-[10px] text-slate-500 italic p-2 text-center",
              },
              "No commercial matches found (\u0394E \u2264 ",
              maxDeltaE.toFixed(2),
              ").",
            ),
        )
      : React.createElement(
          "div",
          { className: "text-[10px] text-slate-500 p-2 text-center" },
          "Loading color data...",
        ),
    fullscreenImage &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className:
              "fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 cursor-pointer",
            onClick: () => setFullscreenImage(null),
          },
          React.createElement("img", {
            src: fullscreenImage,
            alt: "Fullscreen Match",
            className:
              "max-w-full max-h-full object-contain rounded shadow-2xl",
            onClick: (e) => e.stopPropagation(),
          }),
          React.createElement(
            "button",
            {
              className:
                "absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full w-12 h-12 flex items-center justify-center transition-colors",
              onClick: () => setFullscreenImage(null),
            },
            React.createElement(Icon, { name: "x", className: "w-6 h-6" }),
          ),
        ),
        document.body,
      ),
  );
};
const PlotlyChart = ({
  data,
  layout,
  config = {},
  onPointClick,
  onBgClick,
  onRelayout,
  theme,
}) => {
  const chartRef = useRef(null);
  const cbRef = useRef({ onPointClick, onBgClick, onRelayout });
  useEffect(() => {
    cbRef.current = { onPointClick, onBgClick, onRelayout };
  });
  const configStr = JSON.stringify(config);
  useEffect(() => {
    const gd = chartRef.current;
    if (!gd || !Plotly) return;
    let activeLayout = { ...layout };
    if (activeLayout.scene) activeLayout.scene = { ...activeLayout.scene };
    if (activeLayout.xaxis) activeLayout.xaxis = { ...activeLayout.xaxis };
    if (activeLayout.yaxis) activeLayout.yaxis = { ...activeLayout.yaxis };
    const is3D = !!activeLayout.scene;
    if (gd._fullLayout) {
      if (is3D && gd._fullLayout.scene) {
        if (
          gd._fullLayout.scene._scene &&
          typeof gd._fullLayout.scene._scene.getCamera === "function"
        ) {
          activeLayout.scene.camera = gd._fullLayout.scene._scene.getCamera();
        } else if (gd._fullLayout.scene.camera) {
          activeLayout.scene.camera = JSON.parse(
            JSON.stringify(gd._fullLayout.scene.camera),
          );
        }
      }
      if (
        gd._fullLayout.xaxis &&
        gd._fullLayout.xaxis.range &&
        activeLayout.xaxis
      ) {
        activeLayout.xaxis.range = [...gd._fullLayout.xaxis.range];
      }
      if (
        gd._fullLayout.yaxis &&
        gd._fullLayout.yaxis.range &&
        activeLayout.yaxis
      ) {
        activeLayout.yaxis.range = [...gd._fullLayout.yaxis.range];
      }
    }
    Plotly.react(gd, data, activeLayout, {
      responsive: true,
      displayModeBar: false,
      scrollZoom: true,
      ...config,
    }).then(() => {
      gd.removeAllListeners("plotly_click");
      gd.removeAllListeners("plotly_relayout");
      gd.on("plotly_click", (e) => {
        gd.__pointClicked = true;
        if (e.points && e.points[0] && e.points[0].customdata) {
          if (cbRef.current.onPointClick) {
            cbRef.current.onPointClick(e.points[0].customdata);
          }
        }
        setTimeout(() => {
          gd.__pointClicked = false;
        }, 50);
      });
      gd.on("plotly_relayout", (e) => {
        if (cbRef.current.onRelayout) {
          cbRef.current.onRelayout(e);
        }
      });
    });
    let isMiddleProxying = false;
    const proxyEvent = (e) => {
      if (e.__proxied) return;
      e.preventDefault();
      e.stopPropagation();
      const targetButton = is3D ? 2 : 0;
      const targetButtons = is3D ? 2 : 1;
      const clone = new (window.PointerEvent ? PointerEvent : MouseEvent)(
        e.type,
        {
          bubbles: true,
          cancelable: e.type !== "pointermove" && e.type !== "mousemove",
          view: window,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          movementX: e.movementX,
          movementY: e.movementY,
          button: e.type.includes("move") ? -1 : targetButton,
          buttons: targetButtons,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          isPrimary: e.isPrimary,
          relatedTarget: e.relatedTarget,
        },
      );
      clone.__proxied = true;
      e.target.dispatchEvent(clone);
    };
    const handleMidDown = (e) => {
      if (e.button === 1 && !e.__proxied) {
        isMiddleProxying = true;
        proxyEvent(e);
      }
    };
    const handleMidMoveUp = (e) => {
      if (isMiddleProxying && !e.__proxied) {
        if (e.buttons & 4 || (e.type.endsWith("up") && e.button === 1)) {
          proxyEvent(e);
          if (e.type.endsWith("up")) isMiddleProxying = false;
        } else if (e.buttons === 0) isMiddleProxying = false;
      }
    };
    let leftPointerDown = null;
    const handleLeftDown = (e) => {
      if (e.button === 0 && !e.__proxied)
        leftPointerDown = { x: e.clientX, y: e.clientY };
    };
    const handleLeftUp = (e) => {
      if (
        e.button === 0 &&
        !e.__proxied &&
        leftPointerDown &&
        cbRef.current.onBgClick &&
        !is3D
      ) {
        const dx = e.clientX - leftPointerDown.x;
        const dy = e.clientY - leftPointerDown.y;
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
          if (gd._fullLayout && gd._fullLayout.xaxis && gd._fullLayout.yaxis) {
            const rect = gd.getBoundingClientRect();
            const xAxis = gd._fullLayout.xaxis;
            const yAxis = gd._fullLayout.yaxis;
            const xPx = e.clientX - rect.left - xAxis._offset;
            const yPx = e.clientY - rect.top - yAxis._offset;
            if (
              xPx >= 0 &&
              xPx <= xAxis._length &&
              yPx >= 0 &&
              yPx <= yAxis._length
            ) {
              const xData = xAxis.p2d(xPx);
              const yData = yAxis.p2d(yPx);
              setTimeout(() => {
                if (!gd.__pointClicked && cbRef.current.onBgClick) {
                  cbRef.current.onBgClick(xData, yData);
                }
              }, 50);
            }
          }
        }
      }
      leftPointerDown = null;
    };
    const upEv = !!window.PointerEvent ? "pointerup" : "mouseup";
    gd.addEventListener(
      !!window.PointerEvent ? "pointerdown" : "mousedown",
      handleMidDown,
      { capture: true, passive: false },
    );
    window.addEventListener(
      !!window.PointerEvent ? "pointermove" : "mousemove",
      handleMidMoveUp,
      { capture: true, passive: false },
    );
    window.addEventListener(upEv, handleMidMoveUp, {
      capture: true,
      passive: false,
    });
    gd.addEventListener(
      !!window.PointerEvent ? "pointerdown" : "mousedown",
      handleLeftDown,
      { capture: true },
    );
    window.addEventListener(upEv, handleLeftUp, { capture: true });
    return () => {
      gd.removeEventListener(
        !!window.PointerEvent ? "pointerdown" : "mousedown",
        handleMidDown,
        { capture: true },
      );
      window.removeEventListener(
        !!window.PointerEvent ? "pointermove" : "mousemove",
        handleMidMoveUp,
        { capture: true },
      );
      window.removeEventListener(upEv, handleMidMoveUp, { capture: true });
      gd.removeEventListener(
        !!window.PointerEvent ? "pointerdown" : "mousedown",
        handleLeftDown,
        { capture: true },
      );
      window.removeEventListener(upEv, handleLeftUp, { capture: true });
    };
  }, [data, layout, theme, configStr]);
  return React.createElement("div", {
    ref: chartRef,
    className: "plotly-wrapper",
  });
};
const View3D = ({
  colorData,
  points,
  crosshair,
  handlePointClick,
  theme,
  names,
  adjectives,
  savedColors = {},
  lockedNouns,
  lockedAdjectives,
  tetheringPinId,
  filterPt,
}) => {
  const isDark = theme === "dark";
  const baseTraces = useMemo(() => {
    const traces = [];
    const filteredPoints = points.filter(filterPt);
    traces.push({
      type: "scatter3d",
      mode: "markers",
      x: filteredPoints.map((p) => p.a),
      y: filteredPoints.map((p) => p.b),
      z: filteredPoints.map((p) => p.L),
      text: filteredPoints.map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const name =
          `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
          "Unnamed";
        return `<b>${name}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`;
      }),
      hovertemplate: "%{text}<extra></extra>",
      customdata: filteredPoints.map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const name =
          `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
          "Unnamed";
        return [
          p.L,
          p.C,
          p.H,
          { anchorId: nounId, adjId: p.lStr, fullName: name },
        ];
      }),
      marker: {
        size: 4,
        color: filteredPoints.map((p) => p.color),
        opacity: 0.8,
        line: { width: 0 },
      },
    });
    const gridLockedNodes = points
      .filter((p) => !p.isCustomAnchor && filterPt(p))
      .filter((p) => {
        return (
          !p.isPin &&
          lockedNouns[p.parentNounId || `${p.cStr}-${p.hStr}`] &&
          lockedAdjectives[p.lStr]
        );
      })
      .map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        return {
          ...p,
          displayName:
            `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
            "Unnamed",
        };
      });
    const customLockedNodes = Object.values(savedColors)
      .filter((sc) => sc.type === "anchor" && filterPt(sc))
      .map((p) => {
        const displayName =
          `${p.adjOverride || adjectives[p.adjId] || ""} ${p.nameOverride || names[p.anchorId] || ""}`.trim() ||
          p.id ||
          "Custom Anchor";
        return {
          ...p,
          a: p.C * Math.sin((p.H * Math.PI) / 180),
          b: p.C * Math.cos((p.H * Math.PI) / 180),
          displayName,
        };
      });
    const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
    Object.values(savedColors)
      .filter((sc) => {
        if (sc.type !== "nounColumn") return false;
        let H = Math.atan2(sc.a, sc.b) * (180 / Math.PI);
        if (H < 0) H += 360;
        return filterPt({
          L: (sc.minL + sc.maxL) / 2,
          C: Math.sqrt(sc.a * sc.a + sc.b * sc.b),
          H,
        });
      })
      .forEach((nc) => {
        const ncName = `${nc.nameOverride || names[nc.id] || "Custom Noun"}`;
        traces.push({
          type: "scatter3d",
          mode: "lines",
          x: [nc.a, nc.a],
          y: [nc.b, nc.b],
          z: [nc.minL, nc.maxL],
          line: {
            color: isDark ? "rgba(242, 232, 223, 0)" : "rgba(1, 13, 0, 0)",
            width: 0,
          },
          hoverinfo: "text",
          text: [
            `<b>[Range] ${ncName}</b><br>L: ${nc.minL.toFixed(2)} - ${nc.maxL.toFixed(2)}`,
            `<b>[Range] ${ncName}</b><br>L: ${nc.minL.toFixed(2)} - ${nc.maxL.toFixed(2)}`,
          ],
        });
      });
    const pinNodes = Object.values(savedColors)
      .filter((sc) => sc.type === "pin" && filterPt(sc))
      .map((p) => {
        const displayName =
          `${p.adjOverride || adjectives[p.adjId] || ""} ${p.nameOverride || names[p.anchorId] || ""}`.trim() ||
          "Unnamed Pin";
        return {
          ...p,
          a: p.C * Math.sin((p.H * Math.PI) / 180),
          b: p.C * Math.cos((p.H * Math.PI) / 180),
          displayName,
        };
      });
    traces.push({
      type: "scatter3d",
      mode: "markers",
      x: lockedNodes.map((p) => p.a),
      y: lockedNodes.map((p) => p.b),
      z: lockedNodes.map((p) => p.L),
      text: lockedNodes.map(
        (p) =>
          `<b>[Lock] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
      ),
      hovertemplate: "%{text}<extra></extra>",
      customdata: lockedNodes.map((p) => [
        p.L,
        p.C,
        p.H,
        { anchorId: p.anchorId || p.id, adjId: p.adjId },
      ]),
      marker: {
        symbol: "square",
        size: 6,
        color: lockedNodes.map((p) => p.color),
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
    });
    traces.push({
      type: "scatter3d",
      mode: "markers",
      x: pinNodes.map((p) => p.a),
      y: pinNodes.map((p) => p.b),
      z: pinNodes.map((p) => p.L),
      text: pinNodes.map(
        (p) =>
          `<b>[Pin] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
      ),
      hovertemplate: "%{text}<extra></extra>",
      customdata: pinNodes.map((p) => [p.L, p.C, p.H, { pinId: p.id }]),
      marker: {
        symbol: "x",
        size: 6,
        color: pinNodes.map((p) => p.color),
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
    });
    const commercialNodes = [];
    if (colorData) {
      Object.keys(colorData).forEach((brand) => {
        colorData[brand].forEach((c) => {
          if (filterPt(c)) {
            commercialNodes.push({
              ...c,
              a: c.C * Math.sin((c.H * Math.PI) / 180),
              b: c.C * Math.cos((c.H * Math.PI) / 180),
              color: new Color("oklch", [c.L, c.C, c.H])
                .to("srgb")
                .toString({ format: "hex" }),
              displayName: `${brand} - ${c.name}`,
            });
          }
        });
      });
    }
    if (commercialNodes.length > 0) {
      const jitteredCommercial = applyJitter(
        commercialNodes,
        "a",
        "b",
        "L",
        0.006,
      );
      traces.push({
        type: "scatter3d",
        mode: "markers",
        x: jitteredCommercial.map((p) => p._jX),
        y: jitteredCommercial.map((p) => p._jY),
        z: jitteredCommercial.map((p) => p._jZ),
        text: jitteredCommercial.map(
          (p) =>
            `<b>[Commercial] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
        ),
        hovertemplate: "%{text}<extra></extra>",
        customdata: jitteredCommercial.map((p) => [
          p.L,
          p.C,
          p.H,
          { brand: p.brand, originalIndex: p.originalIndex },
        ]),
        marker: {
          symbol: "diamond",
          size: 6,
          color: jitteredCommercial.map((p) => p.color),
          line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
        },
      });
    }
    return traces;
  }, [
    points,
    isDark,
    names,
    adjectives,
    savedColors,
    lockedNouns,
    lockedAdjectives,
    colorData,
    filterPt,
  ]);
  const data = useMemo(() => {
    return [
      ...baseTraces,
      {
        type: "scatter3d",
        mode: "lines",
        x: crosshair?.snapTarget ? [crosshair.a, crosshair.snapTarget.a] : [],
        y: crosshair?.snapTarget ? [crosshair.b, crosshair.snapTarget.b] : [],
        z: crosshair?.snapTarget
          ? [crosshair.rawL, crosshair.snapTarget.L]
          : [],
        line: {
          color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
          width: 2,
          dash: "dot",
        },
        hoverinfo: "skip",
      },
      {
        type: "scatter3d",
        mode: "markers",
        x: [crosshair?.a],
        y: [crosshair?.b],
        z: [crosshair?.rawL],
        text: [
          `<b>Cursor</b><br>L: ${crosshair?.rawL?.toFixed(3)} C: ${crosshair?.rawC?.toFixed(3)} H: ${crosshair?.rawH?.toFixed(1)}\xB0`,
        ],
        hovertemplate: "%{text}<extra></extra>",
        marker: {
          symbol: "cross",
          size: 8,
          color: isDark ? "#F2E8DF" : "#010D00",
          line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
        },
        hoverinfo: "skip",
      },
    ];
  }, [baseTraces, crosshair, isDark]);
  const layout = useMemo(
    () => ({
      uirevision: "true",
      paper_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 0, b: 0, t: 0 },
      scene: {
        xaxis: {
          title: "a",
          range: [-0.4, 0.4],
          backgroundcolor: isDark ? "#052212" : "#F2E8DF",
          gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
          zerolinecolor: isDark
            ? "rgba(177,188,131,0.25)"
            : "rgba(43,64,50,0.15)",
          showspikes: false,
          titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
          tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
        },
        yaxis: {
          title: "b",
          range: [-0.4, 0.4],
          backgroundcolor: isDark ? "#052212" : "#F2E8DF",
          gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
          zerolinecolor: isDark
            ? "rgba(177,188,131,0.25)"
            : "rgba(43,64,50,0.15)",
          showspikes: false,
          titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
          tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
        },
        zaxis: {
          title: "L",
          range: [0, 1],
          backgroundcolor: isDark ? "#052212" : "#F2E8DF",
          gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
          zerolinecolor: isDark
            ? "rgba(177,188,131,0.25)"
            : "rgba(43,64,50,0.15)",
          showspikes: false,
          titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
          tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
        },
        camera: { eye: { x: 1.5, y: 1.5, z: 0.5 } },
      },
      showlegend: false,
    }),
    [isDark],
  );
  return React.createElement(
    "div",
    { className: "relative w-full h-full" },
    React.createElement(PlotlyChart, {
      data,
      layout,
      onPointClick: handlePointClick,
      theme,
    }),
  );
};
const ViewVertical = ({
  colorData,
  points,
  crosshair,
  handlePointClick,
  theme,
  names,
  adjectives,
  savedColors = {},
  lockedNouns,
  lockedAdjectives,
  viewMode,
  tetheringPinId,
  swatchLayout,
  swatchZoom,
  viewportFilter,
  viewportSearchQuery,
  viewportTagFilter,
  filterPt,
  filterL,
  filterC,
  filterH,
}) => {
  const isDark = theme === "dark";
  const [showText, setShowText] = useState(false);
  const handleRelayout = (e) => {
    if (e["xaxis.range[0]"] !== void 0 && e["xaxis.range[1]"] !== void 0) {
      setShowText(e["xaxis.range[1]"] - e["xaxis.range[0]"] < 0.15);
    } else if (e["xaxis.autorange"]) {
      setShowText(false);
    }
  };
  const targetH = crosshair?.rawH || 0;
  const filterFn = useCallback(
    (p, isCommercial = false) => {
      if (filterPt && !filterPt(p)) return false;
      if (p.C === 0) return true;
      const allowedHueDiff = filterH !== void 0 ? Math.max(5, filterH) : 5;
      if (
        p.isPin ||
        p.isCustomAnchor ||
        p.type === "pin" ||
        p.type === "anchor" ||
        p.url !== void 0 ||
        p.hex !== void 0 ||
        isCommercial
      ) {
        let hDiff = Math.abs(p.H - targetH);
        hDiff = Math.min(hDiff, 360 - hDiff);
        return hDiff <= allowedHueDiff;
      }
      return true;
    },
    [targetH, filterPt, filterH],
  );
  const swatchItems = useMemo(() => {
    if (viewMode !== "swatches") return [];
    const res = [];
    points
      .filter((p) => !p.isPin && filterFn(p))
      .forEach((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        res.push({
          ...p,
          type: "grid",
          displayName:
            `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
            "Unnamed",
          hex: p.color,
        });
      });
    Object.values(savedColors).forEach((sc) => {
      if (filterFn(sc)) {
        if (sc.type === "anchor") {
          res.push({
            ...sc,
            displayName:
              `${sc.adjOverride || adjectives[sc.adjId] || ""} ${sc.nameOverride || names[sc.anchorId] || ""}`.trim() ||
              sc.id,
            hex: sc.srgbHex || sc.color,
          });
        } else if (sc.type === "pin") {
          res.push({
            ...sc,
            displayName: sc.id || "Pin",
            hex: sc.srgbHex || sc.color,
          });
        }
      }
    });
    if (colorData) {
      Object.keys(colorData).forEach((brand) => {
        colorData[brand].forEach((c) => {
          if (filterFn(c, true)) {
            res.push({
              ...c,
              type: "commercial",
              displayName: `${brand} - ${c.name}`,
              hex: new Color("oklch", [c.L, c.C, c.H])
                .to("srgb")
                .toString({ format: "hex" }),
            });
          }
        });
      });
    }
    return res;
  }, [
    points,
    savedColors,
    colorData,
    lockedNouns,
    lockedAdjectives,
    viewMode,
    names,
    adjectives,
    filterFn,
  ]);
  const finalSwatchItems = useMemo(() => {
    if (viewMode !== "swatches") return [];
    return swatchItems.map((item) => {
      if (item.type === "pin") {
        const { displayAdj, displayName } = getInheritedPinNames(
          item,
          savedColors,
          names,
          adjectives,
        );
        return {
          ...item,
          displayName: `${displayAdj} ${displayName}`.trim() || item.id,
        };
      }
      return item;
    });
  }, [swatchItems, viewMode, savedColors, names, adjectives]);
  const baseTraces = useMemo(() => {
    if (viewMode === "swatches") return [];
    const filtered = points.filter((p) => !p.isPin && filterFn(p));
    const filteredBurnt = Object.values(savedColors).filter(
      (p) => p.type === "pin" && filterFn(p),
    );
    const traces = [];
    traces.push({
      type: "scatter",
      mode: viewMode === "bins" ? (showText ? "text" : "markers") : "markers",
      x: filtered.map((p) => p.C),
      y: filtered.map((p) => p.L),
      text: filtered.map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const adj = adjectives[p.lStr] || "";
        const noun = names[nounId] || "";
        const fullName = `${adj} ${noun}`.trim() || "Unnamed";
        const binText =
          adj && noun ? `<b>${adj}</b><br>${noun}` : `<b>${fullName}</b>`;
        return viewMode === "bins"
          ? binText
          : `<b>${fullName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`;
      }),
      textposition: "middle center",
      textfont: {
        size: 12,
        family: "Inter, sans-serif",
        color: filtered.map((p) => (p.L > 0.55 ? "#010D00" : "#F2E8DF")),
      },
      hovertemplate:
        viewMode === "bins"
          ? "<b>%{customdata[3].fullName}</b><br>L: %{y:.3f} C: %{x:.3f}<extra></extra>"
          : "%{text}<extra></extra>",
      customdata: filtered.map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const fullName =
          `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
          "Unnamed";
        return [p.L, p.C, p.H, { anchorId: nounId, adjId: p.lStr, fullName }];
      }),
      marker: {
        size: 10,
        color: filtered.map((p) => p.color),
        opacity: viewMode === "bins" ? (showText ? 0 : 0.3) : 0.8,
        line: {
          width: 0.5,
          color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
        },
      },
    });
    const gridLockedNodes = filtered
      .filter(
        (p) =>
          !p.isCustomAnchor &&
          lockedNouns[p.parentNounId || `${p.cStr}-${p.hStr}`] &&
          lockedAdjectives[p.lStr],
      )
      .map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        return {
          ...p,
          displayName:
            `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
            "Unnamed",
        };
      });
    const customLockedNodes = Object.values(savedColors)
      .filter((sc) => sc.type === "anchor" && filterFn(sc))
      .map((p) => {
        const displayName =
          `${p.adjOverride || adjectives[p.adjId] || ""} ${p.nameOverride || names[p.anchorId] || ""}`.trim() ||
          p.id ||
          "Custom Anchor";
        return { ...p, displayName };
      });
    const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
    const pinNodes = filteredBurnt.map((p) => {
      const displayName =
        `${p.adjOverride || adjectives[p.adjId] || ""} ${p.nameOverride || names[p.anchorId] || ""}`.trim() ||
        "Unnamed Pin";
      return { ...p, displayName };
    });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: lockedNodes.map((p) => p.C),
      y: lockedNodes.map((p) => p.L),
      text: lockedNodes.map(
        (p) =>
          `<b>[Lock] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
      ),
      hovertemplate: "%{text}<extra></extra>",
      customdata: lockedNodes.map((p) => [
        p.L,
        p.C,
        p.H,
        { anchorId: p.anchorId || p.id, adjId: p.adjId },
      ]),
      marker: {
        symbol: "square",
        size: 10,
        color: lockedNodes.map((p) => p.color),
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
    });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: pinNodes.map((p) => p.C),
      y: pinNodes.map((p) => p.L),
      text: pinNodes.map(
        (p) =>
          `<b>[Pin] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
      ),
      hovertemplate: "%{text}<extra></extra>",
      customdata: pinNodes.map((p) => [p.L, p.C, p.H, { pinId: p.id }]),
      marker: {
        symbol: "x",
        size: 12,
        color: pinNodes.map((p) => p.color),
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
    });
    const commercialNodes = [];
    if (colorData) {
      Object.keys(colorData).forEach((brand) => {
        colorData[brand].forEach((c) => {
          if (filterFn(c, true)) {
            commercialNodes.push({
              ...c,
              color: new Color("oklch", [c.L, c.C, c.H])
                .to("srgb")
                .toString({ format: "hex" }),
              displayName: `${brand} - ${c.name}`,
            });
          }
        });
      });
    }
    if (commercialNodes.length > 0) {
      const jitteredCommercial = applyJitter(
        commercialNodes,
        "C",
        "L",
        null,
        0.006,
      );
      traces.push({
        type: "scatter",
        mode: "markers",
        x: jitteredCommercial.map((p) => p._jX),
        y: jitteredCommercial.map((p) => p._jY),
        text: jitteredCommercial.map(
          (p) =>
            `<b>[Commercial] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
        ),
        hovertemplate: "%{text}<extra></extra>",
        customdata: jitteredCommercial.map((p) => [
          p.L,
          p.C,
          p.H,
          { brand: p.brand, originalIndex: p.originalIndex },
        ]),
        marker: {
          symbol: "triangle-up",
          size: 10,
          color: jitteredCommercial.map((p) => p.color),
          line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
        },
      });
    }
    return traces;
  }, [
    points,
    isDark,
    names,
    adjectives,
    savedColors,
    lockedNouns,
    lockedAdjectives,
    viewMode,
    showText,
    targetH,
    colorData,
    filterFn,
  ]);
  const data = useMemo(() => {
    if (viewMode === "swatches") return [];
    const traces = [...baseTraces];
    traces.push({
      type: "scatter",
      mode: "lines",
      x: crosshair?.snapTarget ? [crosshair.rawC, crosshair.snapTarget.C] : [],
      y: crosshair?.snapTarget ? [crosshair.rawL, crosshair.snapTarget.L] : [],
      line: {
        color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
        width: 2,
        dash: "dot",
      },
      hoverinfo: "skip",
    });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: [crosshair?.rawC],
      y: [crosshair?.rawL],
      text: [
        `<b>Cursor</b><br>L: ${crosshair?.rawL?.toFixed(3)} C: ${crosshair?.rawC?.toFixed(3)} H: ${crosshair?.rawH?.toFixed(1)}\xB0`,
      ],
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        symbol: "cross",
        size: 12,
        color: isDark ? "#F2E8DF" : "#010D00",
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
      hoverinfo: "skip",
    });
    if (tetheringPinId && savedColors[tetheringPinId]) {
      const p = savedColors[tetheringPinId];
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [p.C, crosshair?.rawC],
        y: [p.L, crosshair?.rawL],
        line: { color: "#f59e0b", width: 2, dash: "dash" },
        hoverinfo: "skip",
      });
    }
    return traces;
  }, [baseTraces, crosshair, isDark, viewMode, tetheringPinId, savedColors]);
  const voronoiContent = useMemo(() => {
    if (viewMode !== "bins") return { cells: [], mask: null };
    try {
      const filterFnSlice = (p) => {
        if (p.C === 0) return true;
        const cStepForH = Math.max(1, Math.round(p.C / 0.02));
        const nH = 6 * cStepForH;
        const stepH = 360 / nH;
        const closestH = Math.round(targetH / stepH) * stepH;
        const h1 = closestH % 360;
        const h2 = (closestH + 360) % 360;
        return Math.abs(p.H - h1) < 0.1 || Math.abs(p.H - h2) < 0.1;
      };
      const slicePoints = points.filter((p) => !p.isPin && filterFnSlice(p));
      if (slicePoints.length === 0) return { cells: [], mask: null };
      const allVoronoiPoints = [...slicePoints];
      const isMobile = window.innerWidth < 768;
      const lStep = isMobile ? 0.05 : 0.01;
      const boundaryPoints = [];
      for (let l = 0; l <= 1; l += lStep) {
        let low = 0,
          high = 0.4;
        while (high - low > 0.001) {
          let mid = (low + high) / 2;
          if (new Color("oklch", [l, mid, targetH]).inGamut("srgb")) {
            low = mid;
          } else {
            high = mid;
          }
        }
        const maxC = Math.min(low, 0.4);
        boundaryPoints.push([maxC, l]);
        allVoronoiPoints.push({ C: maxC + 0.005, L: l, isDummy: true });
        allVoronoiPoints.push({ C: maxC + 0.02, L: l, isDummy: true });
      }
      const cStep = isMobile ? 0.05 : 0.01;
      for (let c = 0; c <= 0.45; c += cStep) {
        allVoronoiPoints.push({ C: c, L: -0.01, isDummy: true });
        allVoronoiPoints.push({ C: c, L: 1.01, isDummy: true });
      }
      const scaleX = 1;
      const scaleY = 0.3;
      const delaunay = d3.Delaunay.from(
        allVoronoiPoints.map((p) => [p.C * scaleX, p.L * scaleY]),
      );
      const voronoi = delaunay.voronoi([
        -0.1 * scaleX,
        -0.1 * scaleY,
        0.5 * scaleX,
        1.15 * scaleY,
      ]);
      const cells = [];
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
            const unscaledPts = pts.map((pt) => [
              pt[0] / scaleX,
              pt[1] / scaleY,
            ]);
            const unscaledPath =
              "M" + unscaledPts.map((pt) => pt.join(",")).join("L") + "Z";
            cells.push({ path: unscaledPath, color: p.color, p });
          }
        }
      });
      const outerSquare = [
        [-0.5, -0.5],
        [1, -0.5],
        [1, 1.5],
        [-0.5, 1.5],
        [-0.5, -0.5],
      ];
      const innerBoundary = [[0, 1.2], ...boundaryPoints.reverse(), [0, -0.2]];
      const maskPath =
        "M" +
        outerSquare.map((p) => p.join(",")).join("L") +
        "Z M" +
        innerBoundary.map((p) => p.join(",")).join("L") +
        "Z";
      return { cells, mask: maskPath };
    } catch (e) {
      console.error("Voronoi error:", e);
      return { cells: [], mask: null };
    }
  }, [points, targetH, viewMode]);
  const layout = useMemo(() => {
    const shapes = [
      {
        type: "line",
        x0: 0,
        x1: 0.3,
        y0: 0.5,
        y1: 0.5,
        line: { color: isDark ? "#F2E8DF" : "#2B4032", width: 1, dash: "dot" },
      },
    ];
    if (viewMode === "bins" && voronoiContent.cells.length > 0) {
      voronoiContent.cells.forEach((cell) => {
        if (filterPt && !filterPt(cell.p)) return;
        shapes.push({
          type: "path",
          path: cell.path,
          fillcolor: cell.color,
          line: {
            width: 1.5,
            color: isDark ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.4)",
          },
          layer: "below",
        });
      });
      if (voronoiContent.mask) {
        shapes.push({
          type: "path",
          path: voronoiContent.mask,
          fillcolor: isDark ? "#052212" : "#F2E8DF",
          line: { width: 0 },
          layer: "below",
          fillrule: "evenodd",
        });
      }
    }
    return {
      uirevision: "true",
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      dragmode: "pan",
      xaxis: {
        title: "Chroma",
        range: [0, 0.4],
        showgrid: viewMode !== "bins",
        zeroline: viewMode !== "bins",
        gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
        titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
        tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
      },
      yaxis: {
        title: "Lightness",
        range: [0, 1.05],
        showgrid: viewMode !== "bins",
        zeroline: viewMode !== "bins",
        gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
        titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
        tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
      },
      margin: { l: 50, r: 20, b: 50, t: 20 },
      shapes,
      showlegend: false,
    };
  }, [isDark, viewMode, voronoiContent, filterPt]);
  const handleBgClick = (cValue, lValue) => {
    handlePointClick([
      Math.max(0, Math.min(1, lValue)),
      Math.max(0, Math.min(0.4, cValue)),
      crosshair?.rawH,
    ]);
  };
  if (viewMode === "swatches") {
    return React.createElement(ViewportSwatches, {
      items: finalSwatchItems,
      layout: swatchLayout,
      swatchZoom,
      dim1: "L",
      dim2: "C",
      dim1Labels: (v) => `L: ${Number(v).toFixed(3)}`,
      dim2Labels: (v) => `C: ${Number(v).toFixed(2)}`,
      handlePointClick,
      viewportSearchQuery,
      viewportTagFilter,
      crosshair,
    });
  }
  return React.createElement(PlotlyChart, {
    data,
    layout,
    onPointClick: handlePointClick,
    onBgClick: handleBgClick,
    onRelayout: handleRelayout,
    theme,
  });
};
const ViewChromaRings = ({
  colorData,
  points,
  crosshair,
  handlePointClick,
  theme,
  names,
  adjectives,
  savedColors = {},
  lockedNouns,
  lockedAdjectives,
  viewMode,
  tetheringPinId,
  swatchLayout,
  swatchZoom,
  viewportFilter,
  viewportSearchQuery,
  viewportTagFilter,
  filterPt,
  filterL,
  filterC,
  filterH,
}) => {
  const isDark = theme === "dark";
  const [showText, setShowText] = useState(false);
  const handleRelayout = (e) => {
    if (e["xaxis.range[0]"] !== void 0 && e["xaxis.range[1]"] !== void 0) {
      setShowText(e["xaxis.range[1]"] - e["xaxis.range[0]"] < 120);
    } else if (e["xaxis.autorange"]) {
      setShowText(false);
    }
  };
  const targetC = crosshair?.rawC || 0;
  const filterFn = useCallback(
    (p, isCommercial = false) => {
      if (filterPt && !filterPt(p)) return false;
      if (p.C === 0 && targetC === 0) return true;
      if (
        p.isPin ||
        p.isCustomAnchor ||
        p.type === "pin" ||
        p.type === "anchor" ||
        p.url !== void 0 ||
        p.hex !== void 0 ||
        isCommercial
      ) {
        return Math.abs(p.C - targetC) <= Math.max(0.02, filterC);
      }
      return true;
    },
    [targetC, filterPt, filterC],
  );
  const swatchItems = useMemo(() => {
    if (viewMode !== "swatches") return [];
    const res = [];
    points
      .filter((p) => !p.isPin && filterFn(p))
      .forEach((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        res.push({
          ...p,
          type: "grid",
          displayName:
            `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
            "Unnamed",
          hex: p.color,
        });
      });
    Object.values(savedColors).forEach((sc) => {
      if (filterFn(sc)) {
        if (sc.type === "anchor") {
          res.push({
            ...sc,
            displayName:
              `${sc.adjOverride || adjectives[sc.adjId] || ""} ${sc.nameOverride || names[sc.anchorId] || ""}`.trim() ||
              sc.id,
            hex: sc.srgbHex || sc.color,
          });
        } else if (sc.type === "pin") {
          res.push({
            ...sc,
            displayName: sc.id || "Pin",
            hex: sc.srgbHex || sc.color,
          });
        }
      }
    });
    if (colorData) {
      Object.keys(colorData).forEach((brand) => {
        colorData[brand].forEach((c) => {
          if (filterFn(c, true)) {
            res.push({
              ...c,
              type: "commercial",
              displayName: `${brand} - ${c.name}`,
              hex: new Color("oklch", [c.L, c.C, c.H])
                .to("srgb")
                .toString({ format: "hex" }),
            });
          }
        });
      });
    }
    return res;
  }, [
    points,
    savedColors,
    colorData,
    lockedNouns,
    lockedAdjectives,
    viewMode,
    names,
    adjectives,
    targetC,
  ]);
  const finalSwatchItems = useMemo(() => {
    if (viewMode !== "swatches") return [];
    return swatchItems.map((item) => {
      if (item.type === "pin") {
        const { displayAdj, displayName } = getInheritedPinNames(
          item,
          savedColors,
          names,
          adjectives,
        );
        return {
          ...item,
          displayName: `${displayAdj} ${displayName}`.trim() || item.id,
        };
      }
      return item;
    });
  }, [swatchItems, viewMode, savedColors, names, adjectives]);
  const baseTraces = useMemo(() => {
    if (viewMode === "swatches") return [];
    const filtered = points.filter((p) => !p.isPin && filterFn(p));
    const filteredBurnt = Object.values(savedColors).filter(
      (p) => p.type === "pin" && filterFn(p),
    );
    const traces = [];
    traces.push({
      type: "scatter",
      mode: viewMode === "bins" ? (showText ? "text" : "markers") : "markers",
      x: filtered.map((p) => p.H),
      y: filtered.map((p) => p.L),
      text: filtered.map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const adj = adjectives[p.lStr] || "";
        const noun = names[nounId] || "";
        const fullName = `${adj} ${noun}`.trim() || "Unnamed";
        const binText =
          adj && noun ? `<b>${adj}</b><br>${noun}` : `<b>${fullName}</b>`;
        return viewMode === "bins"
          ? binText
          : `<b>${fullName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`;
      }),
      textposition: "middle center",
      textfont: {
        size: 12,
        family: "Inter, sans-serif",
        color: filtered.map((p) => (p.L > 0.55 ? "#010D00" : "#F2E8DF")),
      },
      hovertemplate:
        viewMode === "bins"
          ? "<b>%{customdata[3].fullName}</b><br>L: %{y:.3f} H: %{x:.1f}\xB0<extra></extra>"
          : "%{text}<extra></extra>",
      customdata: filtered.map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const fullName =
          `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
          "Unnamed";
        return [p.L, p.C, p.H, { anchorId: nounId, adjId: p.lStr, fullName }];
      }),
      marker: {
        size: 10,
        color: filtered.map((p) => p.color),
        opacity: viewMode === "bins" ? (showText ? 0 : 0.3) : 0.8,
        line: {
          width: 0.5,
          color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
        },
      },
    });
    const gridLockedNodes = filtered
      .filter(
        (p) =>
          !p.isCustomAnchor &&
          lockedNouns[p.parentNounId || `${p.cStr}-${p.hStr}`] &&
          lockedAdjectives[p.lStr],
      )
      .map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        return {
          ...p,
          displayName:
            `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
            "Unnamed",
        };
      });
    const customLockedNodes = Object.values(savedColors)
      .filter((sc) => sc.type === "anchor" && filterFn(sc))
      .map((p) => {
        const displayName =
          `${p.adjOverride || adjectives[p.adjId] || ""} ${p.nameOverride || names[p.anchorId] || ""}`.trim() ||
          p.id ||
          "Custom Anchor";
        return { ...p, displayName };
      });
    const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
    const pinNodes = filteredBurnt.map((p) => {
      const displayName =
        `${p.adjOverride || adjectives[p.adjId] || ""} ${p.nameOverride || names[p.anchorId] || ""}`.trim() ||
        "Unnamed Pin";
      return { ...p, displayName };
    });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: lockedNodes.map((p) => p.H),
      y: lockedNodes.map((p) => p.L),
      text: lockedNodes.map(
        (p) =>
          `<b>[Lock] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
      ),
      hovertemplate: "%{text}<extra></extra>",
      customdata: lockedNodes.map((p) => [
        p.L,
        p.C,
        p.H,
        { anchorId: p.anchorId || p.id, adjId: p.adjId },
      ]),
      marker: {
        symbol: "square",
        size: 10,
        color: lockedNodes.map((p) => p.color),
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
    });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: pinNodes.map((p) => p.H),
      y: pinNodes.map((p) => p.L),
      text: pinNodes.map(
        (p) =>
          `<b>[Pin] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
      ),
      hovertemplate: "%{text}<extra></extra>",
      customdata: pinNodes.map((p) => [p.L, p.C, p.H, { pinId: p.id }]),
      marker: {
        symbol: "x",
        size: 12,
        color: pinNodes.map((p) => p.color),
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
    });
    const commercialNodes = [];
    if (colorData) {
      Object.keys(colorData).forEach((brand) => {
        colorData[brand].forEach((c) => {
          if (filterFn(c, true)) {
            commercialNodes.push({
              ...c,
              color: new Color("oklch", [c.L, c.C, c.H])
                .to("srgb")
                .toString({ format: "hex" }),
              displayName: `${brand} - ${c.name}`,
            });
          }
        });
      });
    }
    if (commercialNodes.length > 0) {
      traces.push({
        type: "scatter",
        mode: "markers",
        x: commercialNodes.map((p) => p.H),
        y: commercialNodes.map((p) => p.L),
        text: commercialNodes.map(
          (p) =>
            `<b>[Commercial] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
        ),
        hovertemplate: "%{text}<extra></extra>",
        customdata: commercialNodes.map((p) => [
          p.L,
          p.C,
          p.H,
          { brand: p.brand, originalIndex: p.originalIndex },
        ]),
        marker: {
          symbol: "triangle-up",
          size: 10,
          color: commercialNodes.map((p) => p.color),
          line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
        },
      });
    }
    return traces;
  }, [
    points,
    isDark,
    names,
    adjectives,
    savedColors,
    lockedNouns,
    lockedAdjectives,
    viewMode,
    showText,
    targetC,
    colorData,
    filterFn,
  ]);
  const data = useMemo(() => {
    if (viewMode === "swatches") return [];
    const traces = [...baseTraces];
    traces.push({
      type: "scatter",
      mode: "lines",
      x: crosshair?.snapTarget ? [crosshair.rawH, crosshair.snapTarget.H] : [],
      y: crosshair?.snapTarget ? [crosshair.rawL, crosshair.snapTarget.L] : [],
      line: {
        color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
        width: 2,
        dash: "dot",
      },
      hoverinfo: "skip",
    });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: [crosshair?.rawH],
      y: [crosshair?.rawL],
      text: [
        `<b>Cursor</b><br>L: ${crosshair?.rawL?.toFixed(3)} C: ${crosshair?.rawC?.toFixed(3)} H: ${crosshair?.rawH?.toFixed(1)}\xB0`,
      ],
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        symbol: "cross",
        size: 12,
        color: isDark ? "#F2E8DF" : "#010D00",
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
      hoverinfo: "skip",
    });
    if (tetheringPinId && savedColors[tetheringPinId]) {
      const p = savedColors[tetheringPinId];
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [p.H, crosshair?.rawH],
        y: [p.L, crosshair?.rawL],
        line: { color: "#f59e0b", width: 2, dash: "dash" },
        hoverinfo: "none",
      });
    }
    return traces;
  }, [baseTraces, crosshair, isDark, viewMode, tetheringPinId, savedColors]);
  const voronoiContent = useMemo(() => {
    if (viewMode !== "bins") return { cells: [] };
    try {
      const gridC = Math.round(targetC / 0.02) * 0.02;
      const slicePoints = points.filter(
        (p) => !p.isPin && p.C > 0 && Math.abs(p.C - gridC) <= 0.001,
      );
      if (slicePoints.length === 0) return { cells: [] };
      const allVoronoiPoints = [...slicePoints];
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
      allVoronoiPoints.forEach((p) => {
        paddedVoronoi.push({ ...p, H: p.H - 360 });
        paddedVoronoi.push(p);
        paddedVoronoi.push({ ...p, H: p.H + 360 });
      });
      const delaunay = d3.Delaunay.from(
        paddedVoronoi.map((p) => [p.H * scaleX, p.L * scaleY]),
      );
      const voronoi = delaunay.voronoi([
        -360 * scaleX,
        -0.1 * scaleY,
        720 * scaleX,
        1.15 * scaleY,
      ]);
      const cells = [];
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
            const unscaledPts = pts.map((pt) => [
              pt[0] / scaleX,
              pt[1] / scaleY,
            ]);
            const unscaledPath =
              "M" + unscaledPts.map((pt) => pt.join(",")).join("L") + "Z";
            cells.push({ path: unscaledPath, color: p.color, p });
          }
        }
      });
      return { cells };
    } catch (e) {
      console.error("Voronoi error:", e);
      return { cells: [] };
    }
  }, [points, targetC, viewMode]);
  const layout = useMemo(() => {
    const shapes = [
      {
        type: "line",
        x0: 0,
        x1: 360,
        y0: 0.5,
        y1: 0.5,
        line: { color: isDark ? "#F2E8DF" : "#2B4032", width: 1, dash: "dot" },
      },
    ];
    if (viewMode === "bins" && voronoiContent.cells.length > 0) {
      voronoiContent.cells.forEach((cell) => {
        if (filterPt && !filterPt(cell.p)) return;
        shapes.push({
          type: "path",
          path: cell.path,
          fillcolor: cell.color,
          line: {
            width: 1.5,
            color: isDark ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.4)",
          },
          layer: "below",
        });
      });
    }
    return {
      uirevision: "true",
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      dragmode: "pan",
      xaxis: {
        title: "Hue Angle (\xB0)",
        range: [0, 360],
        showgrid: viewMode !== "bins",
        zeroline: viewMode !== "bins",
        gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
        titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
        tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
        tickmode: "linear",
        dtick: 30,
      },
      yaxis: {
        title: "Lightness",
        range: [0, 1.05],
        showgrid: viewMode !== "bins",
        zeroline: viewMode !== "bins",
        gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
        titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
        tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
      },
      margin: { l: 50, r: 20, b: 50, t: 20 },
      shapes,
      showlegend: false,
    };
  }, [isDark, viewMode, voronoiContent, filterPt]);
  const handleBgClick = (hValue, lValue) => {
    handlePointClick([
      Math.max(0, Math.min(1, lValue)),
      crosshair?.rawC || 0,
      Math.max(0, Math.min(360, hValue)),
    ]);
  };
  if (viewMode === "swatches") {
    return React.createElement(ViewportSwatches, {
      items: finalSwatchItems,
      layout: swatchLayout,
      swatchZoom,
      dim1: "L",
      dim2: "H",
      dim1Labels: (v) => `L: ${Number(v).toFixed(3)}`,
      dim2Labels: (v) => `H: ${Number(v).toFixed(0)}\xB0`,
      handlePointClick,
      viewportSearchQuery,
      viewportTagFilter,
      crosshair,
    });
  }
  return React.createElement(PlotlyChart, {
    data,
    layout,
    onPointClick: handlePointClick,
    onBgClick: handleBgClick,
    onRelayout: handleRelayout,
    theme,
  });
};
function getInheritedPinNames(
  sc,
  savedColors,
  names,
  adjectives,
  colorData = {},
) {
  let baseAdj = sc.adjOverride || adjectives[sc.adjId];
  let baseName = sc.nameOverride || names[sc.anchorId];
  let source = "anchor";
  let sourceId = sc.anchorId;
  if (sc.anchorId && sc.anchorId.startsWith("commercial-")) {
    const parts = sc.anchorId.split("-");
    const brand = parts[1];
    const index = parseInt(parts[2]);
    const item = colorData[brand]?.[index];
    if (item) {
      source = "commercial";
      sourceId = sc.anchorId;
      if (!sc.nameOverride) baseName = item.displayName || item.name;
      if (!sc.adjOverride) {
        const lStr = getLStr(sc.L);
        baseAdj = adjectives[lStr] || getBrandDisplayName(brand);
      }
    }
  } else if (!sc.nameOverride || !sc.adjOverride) {
    const nc = savedColors[sc.anchorId];
    if (nc && nc.type === "nounColumn") {
      source = "nounColumn";
      sourceId = nc.id;
      if (!sc.nameOverride) baseName = nc.nameOverride || names[nc.id];
      if (!sc.adjOverride) {
        const lStr = getLStr(sc.L);
        baseAdj =
          adjectives[lStr] || `L ${nc.minL.toFixed(2)} - ${nc.maxL.toFixed(2)}`;
      }
    } else if (nc && nc.type === "anchor") {
      if (!sc.nameOverride) baseName = nc.nameOverride || names[nc.anchorId];
      if (!sc.adjOverride) baseAdj = nc.adjOverride || adjectives[nc.adjId];
    }
  }
  let inheritedAdj = baseAdj;
  let inheritedName = baseName;
  if (!inheritedName || !inheritedAdj) {
    let minDist = Infinity;
    let bestAnchor = null;
    Object.values(savedColors).forEach((other) => {
      if (other.type === "anchor") {
        const d =
          Math.pow(sc.L - other.L, 2) +
          Math.pow(sc.a - other.a, 2) +
          Math.pow(sc.b - other.b, 2);
        if (d < minDist) {
          minDist = d;
          bestAnchor = other;
        }
      } else if (other.type === "nounColumn") {
        const d = Math.pow(sc.a - other.a, 2) + Math.pow(sc.b - other.b, 2);
        if (d < minDist && sc.L >= other.minL && sc.L <= other.maxL) {
          minDist = d;
          bestAnchor = other;
        }
      }
    });
    if (bestAnchor && minDist < 0.01) {
      source = bestAnchor.type === "nounColumn" ? "nounColumn" : "anchor";
      sourceId = bestAnchor.id;
      if (bestAnchor.type === "nounColumn") {
        if (!inheritedAdj) {
          const lStr = getLStr(sc.L);
          inheritedAdj =
            adjectives[lStr] ||
            `L ${bestAnchor.minL.toFixed(2)} - ${bestAnchor.maxL.toFixed(2)}`;
        }
        if (!inheritedName)
          inheritedName = bestAnchor.nameOverride || names[bestAnchor.id];
      } else {
        if (!inheritedAdj)
          inheritedAdj =
            bestAnchor.adjOverride ||
            adjectives[bestAnchor.id] ||
            adjectives[bestAnchor.adjId];
        if (!inheritedName)
          inheritedName =
            bestAnchor.nameOverride ||
            names[bestAnchor.id] ||
            names[bestAnchor.anchorId];
      }
    }
  }
  if (!inheritedAdj) {
    inheritedAdj = adjectives[sc.adjId] || `L=${sc.L?.toFixed(2) || "?"}`;
  }
  if (!inheritedName) {
    inheritedName = names[sc.anchorId] || "Unnamed Noun";
  }
  return {
    displayAdj: inheritedAdj.trim(),
    displayName: inheritedName.trim(),
    source,
    sourceId,
  };
}
const ViewportSwatches = ({
  items,
  layout,
  handlePointClick,
  dim1,
  dim2,
  dim1Labels,
  dim2Labels,
  viewportSearchQuery,
  viewportTagFilter,
  swatchZoom,
  crosshair,
  selectedIds,
  setSelectedIds,
}) => {
  const [sortBy, setSortBy] = useState(dim1);
  const [sortAsc, setSortAsc] = useState(true);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const baseMatrixSize = 48;
  const baseListSize = 48;
  const baseGallerySize = 72;
  const activeHex = useMemo(() => {
    if (!crosshair || items.length === 0) return null;
    let minDist = Infinity;
    let bestHex = null;
    items.forEach((item) => {
      let d1 = 0,
        d2 = 0;
      const targetL = crosshair.rawL;
      const targetC = crosshair.rawC;
      const targetH = crosshair.rawH;
      if (dim1 === "L") d1 = item.L - targetL;
      else if (dim1 === "C") d1 = (item.C - targetC) * 3;
      else if (dim1 === "H") {
        d1 = Math.abs(item.H - targetH);
        d1 = Math.min(d1, 360 - d1) / 360;
      }
      if (dim2 === "L") d2 = item.L - targetL;
      else if (dim2 === "C") d2 = (item.C - targetC) * 3;
      else if (dim2 === "H") {
        d2 = Math.abs(item.H - targetH);
        d2 = Math.min(d2, 360 - d2) / 360;
      }
      let dist = d1 * d1 + d2 * d2;
      if (dist < minDist) {
        minDist = dist;
        bestHex = item.hex;
      }
    });
    return minDist < 0.05 ? bestHex : null;
  }, [items, crosshair, dim1, dim2]);
  useEffect(() => {
    if (activeHex) {
      const el = document.getElementById(
        `swatch-${activeHex.replace("#", "")}`,
      );
      if (el)
        el.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
    }
  }, [activeHex]);
  const sortedItems = useMemo(() => {
    let filtered = [...items];
    if (viewportSearchQuery) {
      const qWords = viewportSearchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      filtered = filtered.filter((x) =>
        qWords.every(
          (w) =>
            (x.displayName && x.displayName.toLowerCase().includes(w)) ||
            (x.erpCode && x.erpCode.toLowerCase().includes(w)) ||
            (x.note && x.note.toLowerCase().includes(w)),
        ),
      );
    }
    if (viewportTagFilter) {
      const q = viewportTagFilter.toLowerCase();
      filtered = filtered.filter(
        (x) => x.tags && x.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return filtered
      .sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        if (typeof valA === "string")
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortAsc ? valA - valB : valB - valA;
      })
      .map((item) => ({
        ...item,
        _inGamut:
          item.inSrgb !== void 0
            ? item.inSrgb
            : new Color("oklch", [item.L, item.C, item.H]).inGamut("srgb"),
      }));
  }, [items, sortBy, sortAsc, viewportSearchQuery, viewportTagFilter]);
  if (layout === "matrix") {
    const quantize = (v) => Math.round(v * 1e3) / 1e3;
    const d1ValsUniq = new Set();
    const d2ValsUniq = new Set();
    sortedItems.forEach((i) => {
      d1ValsUniq.add(quantize(i[dim1]));
      d2ValsUniq.add(quantize(i[dim2]));
    });
    const d1Vals = [...d1ValsUniq].sort((a, b) => a - b);
    const d2Vals = [...d2ValsUniq].sort((a, b) => a - b);
    return React.createElement(
      "div",
      {
        className:
          "absolute inset-0 overflow-auto custom-scrollbar p-4 bg-slate-50/50 dark:bg-neutral-900/50",
      },
      React.createElement(
        "table",
        { className: "w-full border-collapse border-spacing-0" },
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("td", {
              className:
                "p-1 min-w-[50px] sticky left-0 top-0 z-50 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur border-b border-slate-200 dark:border-neutral-800 relative",
            }),
            d2Vals.map((val) =>
              React.createElement(
                "td",
                {
                  key: val,
                  className:
                    "p-1 text-center text-[9px] font-mono text-slate-400 dark:text-neutral-500 whitespace-nowrap sticky top-0 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur z-40 border-b border-slate-200 dark:border-neutral-800",
                },
                dim2Labels(val),
              ),
            ),
          ),
        ),
        React.createElement(
          "tbody",
          null,
          d1Vals.map((v1) =>
            React.createElement(
              "tr",
              { key: v1 },
              React.createElement(
                "td",
                {
                  className:
                    "p-1 text-right text-[9px] font-mono text-slate-400 dark:text-neutral-500 whitespace-nowrap sticky left-0 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur z-40 relative border-r border-slate-200 dark:border-neutral-800",
                },
                dim1Labels(v1),
              ),
              d2Vals.map((v2) => {
                const cellItems = sortedItems.filter(
                  (i) =>
                    Math.abs(quantize(i[dim1]) - v1) < 0.001 &&
                    Math.abs(quantize(i[dim2]) - v2) < 0.001,
                );
                return React.createElement(
                  "td",
                  {
                    key: v2,
                    className:
                      "p-1 text-center align-middle hover:bg-slate-100 dark:hover:bg-neutral-800/50 rounded transition-colors relative",
                    style: {
                      minWidth: `${(baseMatrixSize + 12) * swatchZoom}px`,
                      height: `${(baseMatrixSize + 12) * swatchZoom}px`,
                    },
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "flex flex-wrap items-center justify-center gap-1 w-full h-full p-0.5",
                    },
                    cellItems.map((item, idx) =>
                      React.createElement(
                        "div",
                        {
                          key: idx,
                          id: `swatch-${item.hex.replace("#", "")}`,
                          onClick: () =>
                            handlePointClick(
                              [item.L, item.C, item.H],
                              item.spectral,
                              {
                                brand: item.brand,
                                originalIndex: item.originalIndex,
                              },
                            ),
                          className: `group rounded cursor-pointer transition-all relative ${activeHex === item.hex ? "ring-4 ring-sky-500 z-20 scale-110" : "z-10"} ${selectedIds?.includes(item.id) ? "ring-2 ring-sky-500 shadow-md" : "hover:ring-2 hover:ring-sky-500"}`,
                          style: {
                            backgroundColor: item.hex,
                            backgroundImage: item.image
                              ? `url(${item.image})`
                              : item.note?.startsWith("http")
                                ? `url(${item.note})`
                                : "none",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            width: `${baseMatrixSize * swatchZoom}px`,
                            height: `${baseMatrixSize * swatchZoom}px`,
                          },
                          title: `${item.displayName}
${item.erpCode}`,
                        },
                        !item._inGamut &&
                          React.createElement("div", {
                            className: "absolute inset-0 pointer-events-none",
                            style: {
                              backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${6 * swatchZoom}px)`,
                            },
                          }),
                        selectedIds &&
                          React.createElement(
                            "div",
                            {
                              className: `absolute top-0.5 left-0.5 z-30 ${selectedIds.includes(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`,
                              onClick: (e) => {
                                e.stopPropagation();
                                setSelectedIds((prev) =>
                                  prev.includes(item.id)
                                    ? prev.filter((id) => id !== item.id)
                                    : [...prev, item.id],
                                );
                              },
                            },
                            React.createElement(
                              "div",
                              {
                                className: `rounded border flex items-center justify-center transition-colors cursor-pointer ${selectedIds.includes(item.id) ? "bg-sky-500 border-sky-500 text-white" : "border-white/50 bg-black/20 hover:border-white/80"}`,
                                style: {
                                  width: `${Math.max(12, 16 * swatchZoom)}px`,
                                  height: `${Math.max(12, 16 * swatchZoom)}px`,
                                },
                              },
                              selectedIds.includes(item.id) &&
                                React.createElement(Icon, {
                                  name: "check",
                                  className: "w-[80%] h-[80%]",
                                }),
                            ),
                          ),
                        item.type === "pin" &&
                          React.createElement("div", {
                            className:
                              "absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 border border-white dark:border-neutral-900 shadow-sm",
                            style: {
                              width: `${8 * swatchZoom}px`,
                              height: `${8 * swatchZoom}px`,
                            },
                          }),
                        React.createElement(
                          "div",
                          {
                            className:
                              "absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm rounded",
                          },
                          (item.image || item.note?.startsWith("http")) &&
                            React.createElement(
                              "button",
                              {
                                onClick: (e) => {
                                  e.stopPropagation();
                                  setFullscreenImage(item.image || item.note);
                                },
                                className: "text-white hover:text-sky-300 p-1",
                              },
                              React.createElement(Icon, {
                                name: "eye",
                                className: "w-4 h-4",
                              }),
                            ),
                        ),
                        swatchZoom >= 1 &&
                          React.createElement(
                            "div",
                            {
                              className:
                                "absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-[2px] leading-none space-y-0",
                              style: {
                                color:
                                  item.L > 0.65
                                    ? "rgba(0,0,0,0.85)"
                                    : "rgba(255,255,255,0.95)",
                              },
                            },
                            item.displayName
                              .split(" ")
                              .map((word, wIdx) =>
                                React.createElement(
                                  "span",
                                  {
                                    key: wIdx,
                                    className:
                                      "text-center font-bold uppercase tracking-[0.05em] truncate w-full",
                                    style: {
                                      fontSize: `${Math.max(4, 5.5 * swatchZoom)}px`,
                                    },
                                  },
                                  word,
                                ),
                              ),
                          ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
      sortedItems.length === 0 &&
        React.createElement(
          "div",
          { className: "text-center text-slate-400 text-xs w-full p-8 italic" },
          "No saved colors or pins found in this slice.",
        ),
    );
  }
  if (layout === "table") {
    return React.createElement(
      "div",
      {
        className:
          "absolute inset-0 overflow-auto custom-scrollbar p-4 bg-slate-50/50 dark:bg-neutral-900/50",
      },
      React.createElement(
        "div",
        {
          className:
            "bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-700 overflow-hidden min-w-max",
        },
        React.createElement(
          "table",
          { className: "w-full text-[10px] text-left" },
          React.createElement(
            "thead",
            {
              className:
                "bg-slate-50 dark:bg-neutral-900/50 font-bold uppercase tracking-wider",
            },
            React.createElement(
              "tr",
              null,
              React.createElement(
                "th",
                { className: "p-3 w-12 text-center" },
                "Color",
              ),
              React.createElement(
                "th",
                {
                  className: "p-3 cursor-pointer hover:text-sky-500",
                  onClick: () => {
                    setSortBy("name");
                    setSortAsc(!sortAsc);
                  },
                },
                "Name",
                " ",
                sortBy === "name" &&
                  React.createElement(Icon, {
                    name: sortAsc ? "chevron-up" : "chevron-down",
                    className: "w-3 h-3 inline",
                  }),
              ),
              React.createElement(
                "th",
                {
                  className: "p-3 w-20 cursor-pointer hover:text-sky-500",
                  onClick: () => {
                    setSortBy("brand");
                    setSortAsc(!sortAsc);
                  },
                },
                "Brand",
                " ",
                sortBy === "brand" &&
                  React.createElement(Icon, {
                    name: sortAsc ? "chevron-up" : "chevron-down",
                    className: "w-3 h-3 inline",
                  }),
              ),
              React.createElement("th", { className: "p-3 w-40" }, "Web Link"),
              React.createElement("th", { className: "p-3" }, "Tags"),
              React.createElement(
                "th",
                {
                  className:
                    "p-3 w-16 text-right text-emerald-600 cursor-pointer hover:text-sky-500",
                  onClick: () => {
                    setSortBy("_d");
                    setSortAsc(!sortAsc);
                  },
                },
                "\u0394Eok",
                " ",
                sortBy === "_d" &&
                  React.createElement(Icon, {
                    name: sortAsc ? "chevron-up" : "chevron-down",
                    className: "w-3 h-3 inline",
                  }),
              ),
              React.createElement(
                "th",
                {
                  className:
                    "p-3 w-16 text-right cursor-pointer hover:text-sky-500",
                  onClick: () => {
                    setSortBy("L");
                    setSortAsc(!sortAsc);
                  },
                },
                "L",
                " ",
                sortBy === "L" &&
                  React.createElement(Icon, {
                    name: sortAsc ? "chevron-up" : "chevron-down",
                    className: "w-3 h-3 inline",
                  }),
              ),
              React.createElement(
                "th",
                {
                  className:
                    "p-3 w-16 text-right cursor-pointer hover:text-sky-500",
                  onClick: () => {
                    setSortBy("C");
                    setSortAsc(!sortAsc);
                  },
                },
                "C",
                " ",
                sortBy === "C" &&
                  React.createElement(Icon, {
                    name: sortAsc ? "chevron-up" : "chevron-down",
                    className: "w-3 h-3 inline",
                  }),
              ),
              React.createElement(
                "th",
                {
                  className:
                    "p-3 w-16 text-right cursor-pointer hover:text-sky-500",
                  onClick: () => {
                    setSortBy("H");
                    setSortAsc(!sortAsc);
                  },
                },
                "H",
                " ",
                sortBy === "H" &&
                  React.createElement(Icon, {
                    name: sortAsc ? "chevron-up" : "chevron-down",
                    className: "w-3 h-3 inline",
                  }),
              ),
            ),
          ),
          React.createElement(
            "tbody",
            {
              className: "divide-y divide-slate-100 dark:divide-neutral-800/50",
            },
            sortedItems.map((item, i) =>
              React.createElement(
                "tr",
                {
                  key: i,
                  className: `hover:bg-slate-50 dark:hover:bg-neutral-800/50 group cursor-pointer transition-colors ${activeHex === item.hex ? "bg-sky-50 dark:bg-sky-900/20" : ""}`,
                  onClick: () =>
                    handlePointClick([item.L, item.C, item.H], item.spectral, {
                      brand: item.brand,
                      originalIndex: item.originalIndex,
                    }),
                },
                React.createElement(
                  "td",
                  { className: "p-1 px-3" },
                  React.createElement(
                    "div",
                    {
                      className: "w-8 h-8 rounded relative shadow-sm",
                      style: {
                        backgroundColor: item.hex,
                        backgroundImage: item.image
                          ? `url(${item.image})`
                          : item.note?.startsWith("http")
                            ? `url(${item.note})`
                            : "none",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      },
                    },
                    item.hasSpectral &&
                      React.createElement("div", {
                        className:
                          "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500",
                      }),
                    item.type === "pin" &&
                      React.createElement("div", {
                        className:
                          "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white dark:border-neutral-900 shadow-sm",
                      }),
                    React.createElement(
                      "div",
                      {
                        className:
                          "absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm rounded",
                      },
                      (item.image || item.note?.startsWith("http")) &&
                        React.createElement(
                          "button",
                          {
                            onClick: (e) => {
                              e.stopPropagation();
                              setFullscreenImage(item.image || item.note);
                            },
                            className:
                              "text-white hover:text-sky-300 w-full h-full flex items-center justify-center",
                          },
                          React.createElement(Icon, {
                            name: "eye",
                            className: "w-4 h-4",
                          }),
                        ),
                    ),
                  ),
                ),
                React.createElement(
                  "td",
                  { className: "p-2 font-medium" },
                  item.displayName,
                ),
                React.createElement(
                  "td",
                  { className: "p-2 text-slate-500 font-mono text-[9px]" },
                  item.brand || (item.type === "pin" ? "pinned" : ""),
                ),
                React.createElement(
                  "td",
                  {
                    className:
                      "p-2 max-w-[120px] truncate text-[9px] font-mono",
                  },
                  item.erpCode?.startsWith("http")
                    ? React.createElement(
                        "a",
                        {
                          href: item.erpCode,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          className:
                            "text-sky-500 hover:underline flex items-center gap-1",
                          onClick: (e) => e.stopPropagation(),
                        },
                        React.createElement(Icon, {
                          name: "external-link",
                          className: "w-3 h-3",
                        }),
                        " Link",
                      )
                    : item.erpCode,
                ),
                React.createElement(
                  "td",
                  { className: "p-2" },
                  item.tags &&
                    item.tags.length > 0 &&
                    React.createElement(
                      "div",
                      { className: "flex flex-wrap gap-1" },
                      item.tags.map((t) =>
                        React.createElement(
                          "span",
                          {
                            key: t,
                            className:
                              "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider",
                          },
                          t,
                        ),
                      ),
                    ),
                ),
                React.createElement(
                  "td",
                  {
                    className:
                      "p-2 text-right font-mono text-emerald-600 font-bold",
                  },
                  item._d !== void 0 ? item._d.toFixed(2) : "-",
                ),
                React.createElement(
                  "td",
                  { className: "p-2 text-right font-mono text-slate-500" },
                  item.L.toFixed(3),
                ),
                React.createElement(
                  "td",
                  { className: "p-2 text-right font-mono text-slate-500" },
                  item.C.toFixed(3),
                ),
                React.createElement(
                  "td",
                  { className: "p-2 text-right font-mono text-slate-500" },
                  item.H.toFixed(1),
                ),
              ),
            ),
          ),
        ),
      ),
      items.length === 0 &&
        React.createElement(
          "div",
          { className: "text-center text-slate-400 text-xs w-full p-8 italic" },
          "No saved colors or pins found in this slice.",
        ),
    );
  }
  return React.createElement(
    "div",
    {
      className:
        "absolute inset-0 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-neutral-900/50 col-span-full",
    },
    React.createElement(
      "div",
      {
        className:
          "flex items-center gap-2 mb-6 sticky top-0 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur z-10 p-2 rounded-lg border border-slate-200/50 dark:border-neutral-800/50 shadow-sm",
      },
      React.createElement(
        "span",
        { className: "text-[10px] font-bold text-slate-400 px-2" },
        "SORT BY:",
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            setSortBy(dim1);
            setSortAsc(!sortAsc);
          },
          className:
            "text-[9px] font-bold uppercase text-slate-500 dark:text-neutral-400 hover:text-sky-600 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded flex items-center gap-1.5 transition-colors shadow-sm",
        },
        dim1,
        " ",
        sortBy === dim1 &&
          React.createElement(Icon, {
            name: sortAsc ? "chevron-up" : "chevron-down",
            className: "w-3 h-3",
          }),
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            setSortBy(dim2);
            setSortAsc(!sortAsc);
          },
          className:
            "text-[9px] font-bold uppercase text-slate-500 dark:text-neutral-400 hover:text-sky-600 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded flex items-center gap-1.5 transition-colors shadow-sm",
        },
        dim2,
        " ",
        sortBy === dim2 &&
          React.createElement(Icon, {
            name: sortAsc ? "chevron-up" : "chevron-down",
            className: "w-3 h-3",
          }),
      ),
    ),
    React.createElement(
      "div",
      { className: "flex flex-wrap gap-4 md:gap-6 pb-8" },
      sortedItems.map((item, i) =>
        React.createElement(
          "div",
          {
            key: i,
            id: `swatch-${item.hex.replace("#", "")}`,
            onClick: () =>
              handlePointClick([item.L, item.C, item.H], item.spectral, {
                brand: item.brand,
                originalIndex: item.originalIndex,
              }),
            className: `flex flex-col gap-2 group cursor-pointer transition-all items-center`,
            style: { width: `${Math.max(48, baseMatrixSize * swatchZoom)}px` },
          },
          React.createElement(
            "div",
            {
              className: `aspect-square rounded-2xl relative overflow-hidden transition-all group-hover:scale-[1.02] group-hover:shadow-md ${activeHex === item.hex ? "ring-4 ring-sky-500" : ""} ${selectedIds?.includes(item.id) ? "ring-2 ring-sky-500 shadow-md" : "hover:ring-2 hover:ring-sky-500"}`,
              style: {
                backgroundColor: item.hex,
                backgroundImage: item.image
                  ? `url(${item.image})`
                  : item.note?.startsWith("http")
                    ? `url(${item.note})`
                    : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                width: "100%",
              },
            },
            !item._inGamut &&
              React.createElement("div", {
                className: "absolute inset-0 pointer-events-none",
                style: {
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)",
                },
              }),
            selectedIds &&
              React.createElement(
                "div",
                {
                  className: `absolute top-1 left-1 z-30 ${selectedIds.includes(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`,
                  onClick: (e) => {
                    e.stopPropagation();
                    setSelectedIds((prev) =>
                      prev.includes(item.id)
                        ? prev.filter((id) => id !== item.id)
                        : [...prev, item.id],
                    );
                  },
                },
                React.createElement(
                  "div",
                  {
                    className: `w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${selectedIds.includes(item.id) ? "bg-sky-500 border-sky-500 text-white" : "border-white/50 bg-black/20 hover:border-white/80"}`,
                  },
                  selectedIds.includes(item.id) &&
                    React.createElement(Icon, {
                      name: "check",
                      className: "w-3.5 h-3.5",
                    }),
                ),
              ),
            item.type === "pin" &&
              React.createElement("div", {
                className:
                  "absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 border border-white dark:border-neutral-800 z-20",
              }),
            React.createElement(
              "div",
              {
                className:
                  "absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm pointer-events-none",
              },
              (item.image || item.note?.startsWith("http")) &&
                React.createElement(
                  "button",
                  {
                    onClick: (e) => {
                      e.stopPropagation();
                      setFullscreenImage(item.image || item.note);
                    },
                    className:
                      "text-white hover:text-sky-300 p-1 pointer-events-auto",
                  },
                  React.createElement(Icon, {
                    name: "eye",
                    className: "w-6 h-6",
                  }),
                ),
            ),
            React.createElement(
              "div",
              {
                className:
                  "absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-1 leading-none space-y-0.5 z-10",
                style: {
                  backgroundColor:
                    item.image || item.note?.startsWith("http")
                      ? "rgba(0,0,0,0.3)"
                      : "transparent",
                  color:
                    item.image || item.note?.startsWith("http")
                      ? "white"
                      : item.L > 0.65
                        ? "rgba(0,0,0,0.85)"
                        : "rgba(255,255,255,0.95)",
                },
              },
              item.displayName
                .split(" ")
                .map((word, wIdx) =>
                  React.createElement(
                    "span",
                    {
                      key: wIdx,
                      className:
                        "text-center font-bold uppercase tracking-[0.05em] truncate w-full px-0.5 drop-shadow-sm",
                      style: { fontSize: `${Math.max(4, 5.5 * swatchZoom)}px` },
                    },
                    word,
                  ),
                ),
            ),
          ),
          React.createElement(
            "div",
            {
              className:
                "flex flex-col items-center text-center px-0.5 pb-2 w-full",
            },
            React.createElement(
              "span",
              {
                style: { fontSize: `${Math.max(5, 6 * swatchZoom)}px` },
                className:
                  "w-full font-mono text-slate-500 dark:text-neutral-400 truncate mt-0.5 group-hover:text-slate-800 dark:group-hover:text-neutral-200 transition-colors",
                title: item.erpCode,
              },
              item.erpCode?.startsWith("http")
                ? React.createElement(
                    "a",
                    {
                      href: item.erpCode,
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className:
                        "hover:text-sky-500 flex items-center justify-center gap-1 drop-shadow-sm",
                      onClick: (e) => e.stopPropagation(),
                    },
                    React.createElement(Icon, {
                      name: "external-link",
                      className: "w-2.5 h-2.5",
                    }),
                    " Web Reference",
                  )
                : item.erpCode,
            ),
            item.tags &&
              item.tags.length > 0 &&
              React.createElement(
                "div",
                {
                  className: "flex flex-wrap justify-center gap-1 w-full",
                  style: { marginTop: `${Math.max(1, 2 * swatchZoom)}px` },
                },
                item.tags
                  .slice(0, 2)
                  .map((t) =>
                    React.createElement(
                      "span",
                      {
                        key: t,
                        style: { fontSize: `${Math.max(4, 5 * swatchZoom)}px` },
                        className:
                          "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 px-0.5 py-[1px] rounded-[3px] font-bold uppercase tracking-wider truncate max-w-full",
                      },
                      t,
                    ),
                  ),
              ),
          ),
        ),
      ),
    ),
    items.length === 0 &&
      React.createElement(
        "div",
        { className: "text-center text-slate-400 text-xs w-full p-8 italic" },
        "No saved colors or pins found in this slice.",
      ),
    fullscreenImage &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className:
              "fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 cursor-pointer",
            onClick: () => setFullscreenImage(null),
          },
          React.createElement("img", {
            src: fullscreenImage,
            alt: "Fullscreen Image",
            className:
              "max-w-full max-h-full object-contain rounded shadow-2xl",
            onClick: (e) => e.stopPropagation(),
          }),
          React.createElement(
            "button",
            {
              className:
                "absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full w-12 h-12 flex items-center justify-center transition-colors",
              onClick: () => setFullscreenImage(null),
            },
            React.createElement(Icon, { name: "x", className: "w-6 h-6" }),
          ),
        ),
        document.body,
      ),
  );
};
const ViewTopDown = ({
  colorData,
  points,
  baseAnchors,
  crosshair,
  handlePointClick,
  theme,
  names,
  adjectives,
  savedColors = {},
  lockedNouns,
  lockedAdjectives,
  viewMode,
  tetheringPinId,
  swatchLayout,
  swatchZoom,
  viewportSearchQuery,
  viewportTagFilter,
  filterPt,
  filterL,
  filterC,
  filterH,
}) => {
  const isDark = theme === "dark";
  const [showText, setShowText] = useState(false);
  const handleRelayout = (e) => {
    if (e["xaxis.range[0]"] !== void 0 && e["xaxis.range[1]"] !== void 0) {
      setShowText(e["xaxis.range[1]"] - e["xaxis.range[0]"] < 0.25);
    } else if (e["xaxis.autorange"]) {
      setShowText(false);
    }
  };
  const targetL = crosshair?.rawL || 0;
  const filterFn = useCallback(
    (p, isCommercial = false) => {
      if (filterPt && !filterPt(p)) return false;
      const targetL2 = crosshair?.rawL || 0;
      if (
        p.isPin ||
        p.isCustomAnchor ||
        p.type === "pin" ||
        p.type === "anchor" ||
        p.url !== void 0 ||
        p.hex !== void 0 ||
        isCommercial
      ) {
        return Math.abs(p.L - targetL2) <= Math.max(0.02, filterL);
      }
      return true;
    },
    [crosshair, filterPt, filterL],
  );
  const validAnchors = useMemo(() => {
    if (!crosshair) return [];
    return baseAnchors
      .map((p) => {
        const targetL2 = p.L !== void 0 && p.L !== null ? p.L : crosshair.rawL;
        const minL = p.minL !== void 0 ? p.minL : -0.01;
        const maxL = p.maxL !== void 0 ? p.maxL : 1.01;
        const inRange = targetL2 >= minL - 0.001 && targetL2 <= maxL + 0.001;
        const c = new Color("oklch", [targetL2, p.C, p.H]);
        const isSpecificAnchor =
          (Math.abs(p.C - 0.04) < 0.001 && Math.abs(p.H - 90) < 0.1) ||
          (Math.abs(p.C - 0.12) < 0.001 && Math.abs(p.H - 90) < 0.1);
        if ((c.inGamut("srgb") || p.C === 0 || isSpecificAnchor) && inRange) {
          return {
            ...p,
            L: targetL2,
            color: c
              .clone()
              .toGamut({ space: "srgb" })
              .toString({ format: "hex" }),
            inSrgb: true,
            isValid: true,
          };
        }
        return { isValid: false };
      })
      .filter((p) => p.isValid && !p.isPin && (filterPt ? filterPt(p) : true));
  }, [baseAnchors, crosshair?.rawL, filterPt]);
  const swatchItems = useMemo(() => {
    if (viewMode !== "swatches") return [];
    const res = [];
    validAnchors.forEach((p) => {
      const lStr = getLStr(p.L);
      const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
      res.push({
        ...p,
        type: "grid",
        displayName:
          `${adjectives[lStr] || ""} ${names[nounId] || ""}`.trim() ||
          "Unnamed",
        hex: p.color,
      });
    });
    Object.values(savedColors).forEach((sc) => {
      if (filterFn(sc)) {
        if (sc.type === "anchor") {
          res.push({
            ...sc,
            displayName:
              `${sc.adjOverride || adjectives[sc.adjId] || ""} ${sc.nameOverride || names[sc.anchorId] || ""}`.trim() ||
              sc.id,
            hex: sc.srgbHex || sc.color,
          });
        } else if (sc.type === "pin") {
          res.push({
            ...sc,
            displayName: sc.id || "Pin",
            hex: sc.srgbHex || sc.color,
          });
        }
      }
    });
    if (colorData) {
      Object.keys(colorData).forEach((brand) => {
        colorData[brand].forEach((c) => {
          if (filterFn(c, true)) {
            res.push({
              ...c,
              type: "commercial",
              displayName: `${brand} - ${c.name}`,
              hex: new Color("oklch", [c.L, c.C, c.H])
                .to("srgb")
                .toString({ format: "hex" }),
            });
          }
        });
      });
    }
    return res;
  }, [
    validAnchors,
    savedColors,
    colorData,
    lockedNouns,
    lockedAdjectives,
    viewMode,
    names,
    adjectives,
    filterFn,
  ]);
  const finalSwatchItems = useMemo(() => {
    if (viewMode !== "swatches") return [];
    return swatchItems.map((item) => {
      if (item.type === "pin") {
        const { displayAdj, displayName } = getInheritedPinNames(
          item,
          savedColors,
          names,
          adjectives,
        );
        return {
          ...item,
          displayName: `${displayAdj} ${displayName}`.trim() || item.id,
        };
      }
      return item;
    });
  }, [swatchItems, viewMode, savedColors, names, adjectives]);
  const baseTraces = useMemo(() => {
    if (viewMode === "swatches") return [];
    const traces = [];
    traces.push({
      type: "scatter",
      mode: viewMode === "bins" ? (showText ? "text" : "markers") : "markers",
      x: validAnchors.map((p) => p.a),
      y: validAnchors.map((p) => p.b),
      text: validAnchors.map((p) => {
        const lStr = getLStr(p.L);
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const adj = adjectives[lStr] || "";
        const noun = names[nounId] || "";
        const fullName = `${adj} ${noun}`.trim() || "Unnamed";
        const binText =
          adj && noun ? `<b>${adj}</b><br>${noun}` : `<b>${fullName}</b>`;
        return viewMode === "bins"
          ? p.C === 0
            ? `<b>${adj}</b>`
            : binText
          : `<b>${fullName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`;
      }),
      textposition: "middle center",
      textfont: {
        size: 12,
        family: "Inter, sans-serif",
        color: validAnchors.map((p) => (p.L > 0.55 ? "#010D00" : "#F2E8DF")),
      },
      hovertemplate:
        viewMode === "bins"
          ? "<b>%{customdata[3].fullName}</b><br>C: %{customdata[1]:.3f} H: %{customdata[2]:.1f}\xB0<extra></extra>"
          : "%{text}<extra></extra>",
      customdata: validAnchors.map((p) => {
        const lStr = getLStr(p.L);
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const fullName =
          `${adjectives[lStr] || ""} ${names[nounId] || ""}`.trim() ||
          "Unnamed";
        return [p.L, p.C, p.H, { anchorId: nounId, adjId: lStr, fullName }];
      }),
      marker: {
        size: 14,
        color: validAnchors.map((p) => p.color),
        opacity: viewMode === "bins" ? (showText ? 0 : 0.3) : 1,
        line: {
          width: 0.5,
          color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
        },
      },
    });
    const gridLockedNodes = baseAnchors
      .filter((p) => !p.isCustomAnchor)
      .map((p) => ({
        ...p,
        L: crosshair?.rawL || 0,
        lStr: getLStr(crosshair?.rawL || 0),
      }))
      .filter((p) => {
        return (
          !p.isPin &&
          lockedNouns[p.parentNounId || `${p.cStr}-${p.hStr}`] &&
          lockedAdjectives[p.lStr] &&
          (filterPt ? filterPt(p) : true)
        );
      })
      .map((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const c = new Color("oklch", [p.L, p.C, p.H]);
        const nodeColor =
          c.inGamut("srgb") || p.C === 0
            ? c.clone().toGamut({ space: "srgb" }).toString({ format: "hex" })
            : "#010D00";
        return {
          ...p,
          displayName:
            `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
            "Unnamed",
          color: nodeColor,
        };
      });
    const customLockedNodes = Object.values(savedColors)
      .filter((sc) => sc.type === "anchor" && filterFn(sc))
      .map((p) => {
        const displayName =
          `${p.adjOverride || adjectives[p.adjId] || ""} ${p.nameOverride || names[p.anchorId] || ""}`.trim() ||
          p.id ||
          "Custom Anchor";
        return {
          ...p,
          a: p.C * Math.sin((p.H * Math.PI) / 180),
          b: p.C * Math.cos((p.H * Math.PI) / 180),
          displayName,
          color: p.color,
        };
      });
    const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
    const pinNodes = Object.values(savedColors)
      .filter((sc) => sc.type === "pin" && filterFn(sc))
      .map((p) => {
        const { displayAdj, displayName } = getInheritedPinNames(
          p,
          savedColors,
          names,
          adjectives,
        );
        return { ...p, displayAdj, displayName };
      });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: lockedNodes.map((p) => p.a),
      y: lockedNodes.map((p) => p.b),
      text: lockedNodes.map(
        (p) =>
          `<b>[Lock] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
      ),
      hovertemplate: "%{text}<extra></extra>",
      customdata: lockedNodes.map((p) => [
        p.L,
        p.C,
        p.H,
        { anchorId: p.anchorId || p.id, adjId: p.adjId },
      ]),
      marker: {
        symbol: "square",
        size: 10,
        color: lockedNodes.map((p) => p.color),
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
    });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: pinNodes.map((p) => p.a),
      y: pinNodes.map((p) => p.b),
      text: pinNodes.map(
        (p) =>
          `<b>[Pin] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
      ),
      hovertemplate: "%{text}<extra></extra>",
      customdata: pinNodes.map((p) => [p.L, p.C, p.H, { pinId: p.id }]),
      marker: {
        symbol: "x",
        size: 12,
        color: pinNodes.map((p) => p.color),
        line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
      },
    });
    const commercialNodes = [];
    if (colorData) {
      Object.keys(colorData).forEach((brand) => {
        colorData[brand].forEach((c) => {
          if (filterFn(c, true)) {
            commercialNodes.push({
              ...c,
              a: c.C * Math.sin((c.H * Math.PI) / 180),
              b: c.C * Math.cos((c.H * Math.PI) / 180),
              color: new Color("oklch", [c.L, c.C, c.H])
                .to("srgb")
                .toString({ format: "hex" }),
              displayName: `${brand} - ${c.name}`,
            });
          }
        });
      });
    }
    if (commercialNodes.length > 0) {
      const jitteredCommercial = applyJitter(
        commercialNodes,
        "a",
        "b",
        null,
        0.006,
      );
      traces.push({
        type: "scatter",
        mode: "markers",
        x: jitteredCommercial.map((p) => p._jX),
        y: jitteredCommercial.map((p) => p._jY),
        text: jitteredCommercial.map(
          (p) =>
            `<b>[Commercial] ${p.displayName}</b><br>L: ${p.L.toFixed(3)} C: ${p.C.toFixed(3)} H: ${p.H.toFixed(1)}\xB0`,
        ),
        hovertemplate: "%{text}<extra></extra>",
        customdata: jitteredCommercial.map((p) => [
          p.L,
          p.C,
          p.H,
          { brand: p.brand, originalIndex: p.originalIndex },
        ]),
        marker: {
          symbol: "triangle-up",
          size: 10,
          color: jitteredCommercial.map((p) => p.color),
          line: { color: isDark ? "#F2E8DF" : "#010D00", width: 2 },
        },
      });
    }
    return traces;
  }, [
    validAnchors,
    baseAnchors,
    crosshair,
    isDark,
    names,
    adjectives,
    savedColors,
    lockedNouns,
    lockedAdjectives,
    viewMode,
    showText,
    colorData,
    filterFn,
    filterPt,
  ]);
  const data = useMemo(() => {
    if (viewMode === "swatches") return [];
    const traces = [...baseTraces];
    traces.push({
      type: "scatter",
      mode: "lines",
      x:
        crosshair?.snapTarget || crosshair?.activePullType
          ? [crosshair.a, crosshair.snapTarget?.a || crosshair.gravityA]
          : [],
      y:
        crosshair?.snapTarget || crosshair?.activePullType
          ? [crosshair.b, crosshair.snapTarget?.b || crosshair.gravityB]
          : [],
      line: {
        color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
        width: 2,
        dash: "dot",
      },
      hoverinfo: "skip",
    });
    traces.push({
      type: "scatter",
      mode: "markers",
      x: [crosshair?.a],
      y: [crosshair?.b],
      text: [
        `<b>Cursor ${crosshair?.activePullType ? `(Tethered to ${crosshair.activePullType})` : ""}</b><br>L: ${crosshair?.rawL?.toFixed(3)} C: ${crosshair?.rawC?.toFixed(3)} H: ${crosshair?.rawH?.toFixed(1)}\xB0`,
      ],
      hovertemplate: "%{text}<extra></extra>",
      marker: {
        symbol: "cross",
        size: 12,
        color: isDark ? "#F2E8DF" : "#2B4032",
        opacity: 0.8,
        line: { color: isDark ? "#F2E8DF" : "#2B4032", width: 2 },
      },
      hoverinfo: "skip",
    });
    if (tetheringPinId && savedColors[tetheringPinId]) {
      const p = savedColors[tetheringPinId];
      traces.push({
        type: "scatter",
        mode: "lines",
        x: [p.a, crosshair?.a],
        y: [p.b, crosshair?.b],
        line: { color: "#f59e0b", width: 2, dash: "dash" },
        hoverinfo: "skip",
      });
    }
    return traces;
  }, [baseTraces, crosshair, isDark, viewMode, tetheringPinId, savedColors]);
  const layout = useMemo(() => {
    const shapes = [];
    if (viewMode === "bins") {
      if (validAnchors.length > 0) {
        try {
          const allVoronoiPoints = [...validAnchors];
          const isMobile = window.innerWidth < 768;
          const angleStep = isMobile ? 10 : 2;
          const boundaryPoints = [];
          for (let angle = 0; angle < 360; angle += angleStep) {
            let low = 0,
              high = 0.4;
            while (high - low > 0.001) {
              let mid = (low + high) / 2;
              if (
                new Color("oklch", [crosshair?.rawL || 0, mid, angle]).inGamut(
                  "srgb",
                )
              ) {
                low = mid;
              } else {
                high = mid;
              }
            }
            const maxC = Math.min(low, 0.3);
            const rad = (angle * Math.PI) / 180;
            boundaryPoints.push([maxC * Math.sin(rad), maxC * Math.cos(rad)]);
            allVoronoiPoints.push({
              a: (maxC + 0.005) * Math.sin(rad),
              b: (maxC + 0.005) * Math.cos(rad),
              isDummy: true,
            });
            allVoronoiPoints.push({
              a: (maxC + 0.02) * Math.sin(rad),
              b: (maxC + 0.02) * Math.cos(rad),
              isDummy: true,
            });
          }
          const delaunay = d3.Delaunay.from(
            allVoronoiPoints.map((p) => [p.a, p.b]),
          );
          const voronoi = delaunay.voronoi([-0.4, -0.4, 0.4, 0.4]);
          allVoronoiPoints.forEach((p, i) => {
            if (p.isDummy) return;
            if (filterPt && !filterPt(p)) return;
            const path = voronoi.renderCell(i);
            if (path) {
              const pts = [];
              path.replace(/([ML])([^,]+),([^MLZ]+)/g, (match, cmd, x, y) => {
                pts.push([parseFloat(x), parseFloat(y)]);
                return match;
              });
              if (pts.length > 2) {
                const unscaledPath =
                  "M" + pts.map((pt) => pt.join(",")).join("L") + "Z";
                shapes.push({
                  type: "path",
                  path: unscaledPath,
                  fillcolor: p.color,
                  line: {
                    width: 1.5,
                    color: isDark ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.4)",
                  },
                  layer: "below",
                });
              }
            }
          });
          const outerSquare = [
            [-0.5, -0.5],
            [0.5, -0.5],
            [0.5, 0.5],
            [-0.5, 0.5],
            [-0.5, -0.5],
          ];
          const innerBoundary = [...boundaryPoints];
          const maskPath =
            "M" +
            outerSquare.map((p) => p.join(",")).join("L") +
            "Z M" +
            innerBoundary.map((p) => p.join(",")).join("L") +
            "Z";
          shapes.push({
            type: "path",
            path: maskPath,
            fillcolor: isDark ? "#052212" : "#F2E8DF",
            line: { width: 0 },
            layer: "below",
          });
        } catch (e) {
          console.error("Voronoi error:", e);
        }
      }
    } else {
      for (let c = 0.02; c <= 0.34; c += 0.02) {
        shapes.push({
          type: "circle",
          xref: "x",
          yref: "y",
          x0: -c,
          y0: -c,
          x1: c,
          y1: c,
          line: {
            color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            width: 1,
            dash: "dot",
          },
        });
      }
    }
    return {
      uirevision: "true",
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      dragmode: "pan",
      xaxis: {
        title: "a",
        range: [-0.3, 0.3],
        showgrid: viewMode !== "bins",
        zeroline: viewMode !== "bins",
        gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
        scaleanchor: "y",
        titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
        tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
      },
      yaxis: {
        title: "b",
        range: [-0.3, 0.3],
        showgrid: viewMode !== "bins",
        zeroline: viewMode !== "bins",
        gridcolor: isDark ? "rgba(177,188,131,0.12)" : "rgba(43,64,50,0.10)",
        titlefont: { color: isDark ? "#B1BC83" : "#2B4032" },
        tickfont: { color: isDark ? "#B1BC83" : "#2B4032" },
      },
      margin: { l: 50, r: 50, b: 50, t: 50 },
      showlegend: false,
      shapes,
    };
  }, [isDark, viewMode, validAnchors, crosshair?.rawL, filterPt]);
  const handleBgClick = (a, b) => {
    const C = Math.min(0.4, Math.sqrt(a * a + b * b));
    let H = Math.atan2(a, b) * (180 / Math.PI);
    if (H < 0) H += 360;
    handlePointClick([crosshair?.rawL, C, H]);
  };
  if (viewMode === "swatches") {
    return React.createElement(ViewportSwatches, {
      items: finalSwatchItems,
      layout: swatchLayout,
      swatchZoom,
      dim1: "C",
      dim2: "H",
      dim1Labels: (v) => `C: ${Number(v).toFixed(2)}`,
      dim2Labels: (v) => `H: ${Number(v).toFixed(0)}\xB0`,
      handlePointClick,
      viewportSearchQuery,
      viewportTagFilter,
      crosshair,
    });
  }
  return React.createElement(PlotlyChart, {
    data,
    layout,
    onPointClick: handlePointClick,
    onBgClick: handleBgClick,
    onRelayout: handleRelayout,
    theme,
  });
};
const ViewPalette = ({
  baseAnchors,
  points = [],
  handlePointClick,
  names,
  setNames,
  adjectives,
  setAdjectives,
  dictNotes,
  lockedNouns,
  lockedAdjectives,
  savedColors = {},
  setSavedColors,
  dictTags,
  onVisualize,
}) => {
  const [sortBy, setSortBy] = useState("ring");
  const [sortAsc, setSortAsc] = useState(true);
  const [tagFilter, setTagFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    C: 0.1,
    H: 180,
    minL: 0.2,
    maxL: 0.8,
    notes: "",
  });
  const handleAddCustomNoun = () => {
    const name = editForm.name.trim();
    const C = parseFloat(editForm.C);
    const H = parseFloat(editForm.H);
    let minL = parseFloat(editForm.minL);
    let maxL = parseFloat(editForm.maxL);
    if (isNaN(C) || isNaN(H) || isNaN(minL) || isNaN(maxL)) {
      return;
    }
    if (minL > maxL) {
      const temp = minL;
      minL = maxL;
      maxL = temp;
    }
    const id = editForm.id || `custom-noun-${crypto.randomUUID()}`;
    setSavedColors((prev) => ({
      ...prev,
      [id]: {
        id,
        type: "nounColumn",
        nameOverride: name,
        C,
        H,
        minL,
        maxL,
        a: C * Math.sin((H * Math.PI) / 180),
        b: C * Math.cos((H * Math.PI) / 180),
        notes: editForm.notes || "",
      },
    }));
    if (setNames && name) {
      setNames({ ...names, [id]: name });
    } else if (name) {
      Object.assign(names, { [id]: name });
    }
    setIsAdding(false);
    setEditForm({
      id: null,
      name: "",
      C: 0.1,
      H: 180,
      minL: 0.2,
      maxL: 0.8,
      notes: "",
    });
  };
  const handleDeleteCustomNoun = (id, e) => {
    e.stopPropagation();
    setSavedColors((prev) => {
      const next = { ...prev };
      delete next[id];
      let deletedAny = true;
      while (deletedAny) {
        deletedAny = false;
        Object.values(next).forEach((sc) => {
          if (sc.type === "anchor" && sc.anchorId === id && sc.isCustomAnchor) {
            delete next[sc.id];
            deletedAny = true;
          } else if (sc.type === "pin" && sc.anchorId === id) {
            delete next[sc.id];
            deletedAny = true;
          } else if (
            sc.type === "pin" &&
            sc.parentPinId &&
            !next[sc.parentPinId]
          ) {
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
      name: item.name || "",
      C: item.C,
      H: item.H,
      minL: item.minL,
      maxL: item.maxL,
      notes: item.notes || "",
    });
    setIsAdding(true);
  };
  const flatItems = useMemo(() => {
    const items = [];
    Object.values(savedColors).forEach((sc) => {
      if (sc.type === "nounColumn") {
        const midL = (sc.minL + sc.maxL) / 2;
        const cStr = Math.round(sc.C * 100)
          .toString()
          .padStart(2, "0");
        const hStr = Math.round(sc.H).toString().padStart(3, "0");
        let count = 0;
        points.forEach((p) => {
          if (
            p.parentNounId === sc.id ||
            (Math.abs(p.C - sc.C) < 0.01 &&
              Math.abs(p.H - sc.H) < 0.01 &&
              p.L >= sc.minL &&
              p.L <= sc.maxL &&
              !p.isPin)
          ) {
            count++;
          }
        });
        items.push({
          ...sc,
          L: midL,
          C: sc.C,
          H: sc.H,
          color: new Color("oklch", [midL, sc.C, sc.H])
            .toGamut({ space: "srgb" })
            .toString({ format: "hex" }),
          id: sc.id,
          fullCode: `NOUN-C${cStr}-H${hStr}`,
          layer: "Custom Range",
          count,
          cStr,
          hStr,
          tags: dictTags[sc.id] || [],
          name: names[sc.id] || sc.nameOverride,
          note: dictNotes[sc.id] || sc.notes,
          adj: `L ${sc.minL.toFixed(2)} - ${sc.maxL.toFixed(2)}`,
          isCustomNoun: true,
        });
      }
    });
    return items;
  }, [dictTags, names, dictNotes, adjectives, savedColors, points]);
  const rings = useMemo(() => {
    const r = {};
    flatItems.forEach((i) => {
      if (!r[i.cStr]) r[i.cStr] = [];
      r[i.cStr].push(i);
    });
    return r;
  }, [flatItems]);
  const allTags = useMemo(
    () => Array.from(new Set(flatItems.flatMap((item) => item.tags))).sort(),
    [flatItems],
  );
  const filterFn = (item) => {
    const matchesTag = !tagFilter || item.tags.includes(tagFilter);
    const qWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchesSearch =
      qWords.length === 0 ||
      qWords.every(
        (w) =>
          (item.name && item.name.toLowerCase().includes(w)) ||
          (item.note && item.note.toLowerCase().includes(w)) ||
          (item.adj && item.adj.toLowerCase().includes(w)) ||
          (item.fullCode && item.fullCode.toLowerCase().includes(w)),
      );
    return matchesTag && matchesSearch;
  };
  const filteredItems = useMemo(
    () => flatItems.filter(filterFn),
    [flatItems, tagFilter, searchTerm],
  );
  const renderSingleSwatch = (item) => {
    if (!item) return null;
    const dupNoun = getGlobalDuplicate(
      names,
      adjectives,
      item.id,
      names[item.id],
      savedColors,
    );
    return React.createElement(
      "div",
      {
        key: item.id,
        className:
          "flex flex-col items-center gap-1.5 bg-white dark:bg-neutral-900 p-2.5 rounded-lg border border-slate-200 dark:border-neutral-800 shadow-sm w-24 flex-shrink-0 relative group transition-colors",
      },
      React.createElement(
        "div",
        { className: "absolute -top-2 -right-2 flex gap-1 z-30" },
        React.createElement(
          "button",
          {
            onClick: (e) => handleEditCustomNoun(item, e),
            className:
              "bg-sky-500 hover:bg-sky-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm",
            title: "Edit Noun Column",
          },
          React.createElement(Icon, { name: "edit-2", className: "w-3 h-3" }),
        ),
        React.createElement(
          "button",
          {
            onClick: (e) => handleDeleteCustomNoun(item.id, e),
            className:
              "bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm",
            title: "Delete Noun Column",
          },
          React.createElement(Icon, { name: "trash", className: "w-3 h-3" }),
        ),
      ),
      React.createElement(
        "div",
        {
          className:
            "text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold mb-1 tracking-wider",
        },
        item.fullCode,
      ),
      React.createElement(
        "div",
        {
          className:
            "w-full text-[8px] font-bold uppercase tracking-wider bg-transparent text-center text-slate-500 dark:text-neutral-400 truncate",
          title: item.adj,
        },
        item.adj,
      ),
      React.createElement("input", {
        type: "text",
        className: `w-full text-[11px] font-bold uppercase tracking-wider bg-transparent border-b border-slate-200 dark:border-neutral-700 text-center focus:outline-none placeholder:opacity-30 pb-0.5 disabled:opacity-50 ${dupNoun ? "!text-red-500 !border-red-500" : "text-slate-800 dark:text-neutral-200 focus:border-sky-500"}`,
        placeholder: "Unnamed Noun",
        value: names[item.id] || "",
        onChange: (e) => setNames({ ...names, [item.id]: e.target.value }),
        disabled: lockedNouns[item.id],
        title: dupNoun ? `Conflict: ${dupNoun}` : "",
      }),
      React.createElement(
        "div",
        {
          onClick: () =>
            handlePointClick([item.L, item.C, item.H], item.spectral, {
              brand: item.brand,
              originalIndex: item.originalIndex,
            }),
          className:
            "relative w-14 h-14 rounded shadow-sm cursor-pointer overflow-hidden border border-slate-200 dark:border-neutral-700 hover:ring-2 hover:ring-sky-500 transition-all flex-shrink-0 group/swatch",
          style: {
            backgroundColor: item.color,
            backgroundImage: item.image ? `url(${item.image})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          },
        },
        !new Color("oklch", [item.L, item.C, item.H]).inGamut("srgb") &&
          React.createElement("div", {
            className: "absolute inset-0 pointer-events-none",
            style: {
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)",
            },
          }),
        React.createElement(
          "div",
          {
            className:
              "absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover/swatch:opacity-100 transition-opacity z-20 backdrop-blur-sm rounded",
          },
          (item.image || item.note?.startsWith("http")) &&
            React.createElement(
              "button",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  setFullscreenImage(item.image || item.note);
                },
                className: "text-white hover:text-sky-300 p-1",
              },
              React.createElement(Icon, { name: "eye", className: "w-5 h-5" }),
            ),
        ),
        React.createElement(
          "div",
          {
            className:
              "absolute top-1 right-1 px-1 py-0.5 rounded-sm text-[9px] font-black font-mono leading-none z-10",
            style: {
              color: item.L > 0.65 ? "#010D00" : "#F2E8DF",
              backgroundColor:
                item.L > 0.65
                  ? "rgba(242, 232, 223, 0.7)"
                  : "rgba(1, 13, 0, 0.5)",
            },
            title: "Occurrences",
          },
          item.count,
        ),
        React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              onVisualize("noun", item.id, names[item.id] || item.id);
            },
            className:
              "absolute bottom-1 right-1 opacity-0 group-hover/swatch:opacity-100 bg-black/50 hover:bg-black/70 text-white p-1 rounded transition-opacity z-30",
            title: "Visualize all instances",
          },
          React.createElement(Icon, { name: "eye", className: "w-3 h-3" }),
        ),
      ),
      React.createElement("input", {
        type: "text",
        className:
          "w-full text-[9px] bg-transparent text-center text-slate-500 dark:text-neutral-400 italic focus:outline-none disabled:opacity-80 cursor-default",
        placeholder: "No Notes",
        value: dictNotes[item.id] || "",
        title: dictNotes[item.id] || "",
        disabled: true,
      }),
      React.createElement(
        "div",
        {
          className:
            "text-[8px] font-mono text-slate-400 dark:text-neutral-500 mt-0.5 flex flex-col items-center",
        },
        React.createElement(
          "div",
          null,
          "L: ",
          item.minL.toFixed(2),
          "-",
          item.maxL.toFixed(2),
        ),
        React.createElement("div", null, "C:", item.C.toFixed(2)),
        React.createElement("div", null, "H:", item.H.toFixed(1), "\xB0"),
      ),
      item.tags.length > 0 &&
        React.createElement(
          "div",
          {
            className:
              "absolute top-0 left-0 w-full p-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-wrap gap-1 justify-center z-20 backdrop-blur-sm bg-white/50 dark:bg-black/50 rounded-t-lg",
          },
          item.tags.map((t) =>
            React.createElement(
              "span",
              {
                key: t,
                className:
                  "bg-sky-500 text-white px-1 rounded text-[7px] font-bold uppercase",
              },
              t,
            ),
          ),
        ),
    );
  };
  const SortButton = ({ field, label, icon }) =>
    React.createElement(
      "button",
      {
        onClick: () => {
          if (sortBy === field) setSortAsc(!sortAsc);
          else {
            setSortBy(field);
            setSortAsc(true);
          }
        },
        className: `flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${sortBy === field ? "bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30" : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-transparent"}`,
      },
      React.createElement(Icon, { name: icon, className: "w-3.5 h-3.5" }),
      label,
      sortBy === field &&
        React.createElement(Icon, {
          name: sortAsc ? "chevron-up" : "chevron-down",
          className: "w-3 h-3",
        }),
    );
  let content;
  if (sortBy === "ring") {
    content = Object.keys(rings)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((r) => {
        const ringItems = filteredItems.filter((i) => i.cStr === r);
        if (ringItems.length === 0) return null;
        const byHue = {};
        ringItems.forEach((i) => {
          if (!byHue[i.hStr]) byHue[i.hStr] = [];
          byHue[i.hStr].push(i);
        });
        return React.createElement(
          "div",
          { key: r, className: "mb-8 last:mb-0" },
          React.createElement(
            "div",
            { className: "flex items-center gap-4 mb-4" },
            React.createElement(
              "span",
              {
                className:
                  "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400",
              },
              r === "00"
                ? "Neutral Spine"
                : `Chroma Ring (C:${(parseInt(r) / 100).toFixed(2)})`,
              React.createElement(
                "span",
                {
                  className:
                    "ml-2 px-1.5 py-0.5 bg-slate-100 dark:bg-neutral-800 rounded text-sky-500 font-mono text-[9px]",
                },
                ringItems.length,
                " Nouns",
              ),
            ),
            React.createElement("div", {
              className: "flex-1 h-px bg-slate-200 dark:bg-neutral-800",
            }),
          ),
          React.createElement(
            "div",
            { className: "flex flex-wrap gap-x-8 gap-y-6" },
            Object.keys(byHue)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map((h) => {
                return React.createElement(
                  "div",
                  {
                    key: h,
                    className:
                      "flex flex-col items-center gap-2 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm",
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-[10px] font-mono text-slate-400 dark:text-neutral-500 font-bold mb-1 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full",
                    },
                    "Hue: ",
                    parseInt(h),
                    "\xB0",
                  ),
                  React.createElement(
                    "div",
                    { className: "flex gap-4 flex-wrap justify-center" },
                    byHue[h].map(renderSingleSwatch),
                  ),
                );
              }),
          ),
        );
      });
  } else {
    const sortedItems = [...filteredItems].sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case "name":
          valA = (names[a.id] || "").toLowerCase();
          valB = (names[b.id] || "").toLowerCase();
          if (valA === valB) return a.H - b.H;
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "count":
          valA = a.count;
          valB = b.count;
          break;
        case "layer":
          valA = a.L;
          valB = b.L;
          break;
        case "tag":
          valA = a.tags.join(", ");
          valB = b.tags.join(", ");
          if (valA === valB) return a.H - b.H;
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "hue":
        default:
          valA = a.H;
          valB = b.H;
          break;
      }
      if (valA === valB) return a.C - b.C;
      return sortAsc ? (valA < valB ? -1 : 1) : valB < valA ? -1 : 1;
    });
    content = React.createElement(
      "div",
      { className: "flex flex-wrap gap-4" },
      sortedItems.map(renderSingleSwatch),
    );
  }
  return React.createElement(
    "div",
    { className: "h-full flex flex-col overflow-hidden pt-2 relative" },
    React.createElement(
      "div",
      {
        className:
          "flex flex-wrap items-center gap-2 px-4 pb-4 mb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0",
      },
      React.createElement(
        "div",
        { className: "relative flex-1 min-w-[200px] max-w-xs" },
        React.createElement(Icon, {
          name: "search",
          className:
            "absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400",
        }),
        React.createElement("input", {
          type: "text",
          placeholder: "Search nouns, ranges...",
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
          className:
            "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[10px] font-bold uppercase tracking-wider rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all",
        }),
        searchTerm &&
          React.createElement(
            "button",
            {
              onClick: () => setSearchTerm(""),
              className:
                "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200",
            },
            React.createElement(Icon, { name: "x", className: "w-3 h-3" }),
          ),
      ),
      React.createElement(
        "span",
        {
          className:
            "text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase mr-2 flex items-center gap-1.5",
        },
        React.createElement(Icon, {
          name: "arrow-down-up",
          className: "w-3.5 h-3.5",
        }),
        " Sort By:",
      ),
      React.createElement(SortButton, {
        field: "ring",
        label: "Chroma Rings",
        icon: "target",
      }),
      React.createElement(SortButton, {
        field: "hue",
        label: "Hue Angle",
        icon: "palette",
      }),
      React.createElement(SortButton, {
        field: "count",
        label: "Occurrences",
        icon: "bar-chart-2",
      }),
      React.createElement(SortButton, {
        field: "name",
        label: "Name",
        icon: "type",
      }),
      React.createElement(SortButton, {
        field: "tag",
        label: "Tags",
        icon: "tag",
      }),
      allTags.length > 0 &&
        React.createElement(
          "div",
          { className: "ml-4 flex items-center gap-2" },
          React.createElement(Icon, {
            name: "filter",
            className: "w-3.5 h-3.5 text-slate-400",
          }),
          React.createElement(
            "select",
            {
              value: tagFilter,
              onChange: (e) => setTagFilter(e.target.value),
              className:
                "bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[9px] font-bold uppercase tracking-wider rounded px-2 py-1 outline-none cursor-pointer",
            },
            React.createElement("option", { value: "" }, "All Tags"),
            allTags.map((t) =>
              React.createElement("option", { key: t, value: t }, t),
            ),
          ),
        ),
      React.createElement(
        "div",
        { className: "ml-auto flex items-center gap-2" },
        React.createElement(
          "button",
          {
            onClick: () => setIsAdding(!isAdding),
            className:
              "px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] items-center gap-1.5 flex font-bold uppercase tracking-wider transition-colors",
          },
          React.createElement(Icon, {
            name: isAdding ? "x" : "plus",
            className: "w-3.5 h-3.5",
          }),
          isAdding ? "Cancel" : "Add Noun",
        ),
        React.createElement(
          "span",
          {
            className:
              "px-2 py-1 bg-sky-500/10 text-sky-500 rounded text-[10px] font-black uppercase tracking-widest border border-sky-500/20",
          },
          "Total: ",
          filteredItems.length,
          " Nouns",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "flex-1 overflow-y-auto custom-scrollbar px-4 pb-10" },
      isAdding &&
        React.createElement(
          "div",
          {
            className:
              "flex flex-col gap-3 bg-slate-50 dark:bg-neutral-800/80 p-4 rounded-xl border border-slate-200 dark:border-neutral-700 shadow-sm w-full mb-6",
          },
          React.createElement(
            "span",
            {
              className:
                "text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1",
            },
            "Create Custom Noun Column",
          ),
          React.createElement(
            "div",
            { className: "flex gap-3" },
            React.createElement("input", {
              type: "text",
              placeholder: "Noun Name (Optional)",
              className:
                "flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500 outline-none",
              value: editForm.name,
              onChange: (e) =>
                setEditForm({ ...editForm, name: e.target.value }),
            }),
          ),
          React.createElement(
            "div",
            { className: "flex gap-4" },
            React.createElement(
              "div",
              { className: "flex flex-col flex-1" },
              React.createElement(
                "span",
                {
                  className:
                    "text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1",
                },
                "Chroma",
              ),
              React.createElement("input", {
                type: "number",
                step: "0.01",
                min: "0",
                max: "0.4",
                className:
                  "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none font-mono",
                value: editForm.C,
                onChange: (e) =>
                  setEditForm({ ...editForm, C: e.target.value }),
              }),
            ),
            React.createElement(
              "div",
              { className: "flex flex-col flex-1" },
              React.createElement(
                "span",
                {
                  className:
                    "text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1",
                },
                "Hue (0-360)",
              ),
              React.createElement("input", {
                type: "number",
                step: "1",
                min: "0",
                max: "360",
                className:
                  "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none font-mono",
                value: editForm.H,
                onChange: (e) =>
                  setEditForm({ ...editForm, H: e.target.value }),
              }),
            ),
            React.createElement(
              "div",
              { className: "flex flex-col flex-1" },
              React.createElement(
                "span",
                {
                  className:
                    "text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1",
                },
                "Min Lightness (0-1)",
              ),
              React.createElement("input", {
                type: "number",
                step: "0.01",
                min: "0",
                max: "1",
                className:
                  "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none font-mono",
                value: editForm.minL,
                onChange: (e) =>
                  setEditForm({ ...editForm, minL: e.target.value }),
              }),
            ),
            React.createElement(
              "div",
              { className: "flex flex-col flex-1" },
              React.createElement(
                "span",
                {
                  className:
                    "text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1",
                },
                "Max Lightness (0-1)",
              ),
              React.createElement("input", {
                type: "number",
                step: "0.01",
                min: "0",
                max: "1",
                className:
                  "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none font-mono",
                value: editForm.maxL,
                onChange: (e) =>
                  setEditForm({ ...editForm, maxL: e.target.value }),
              }),
            ),
          ),
          React.createElement("textarea", {
            placeholder: "Notes for this column...",
            className:
              "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-xs focus:ring-1 outline-none h-16 w-full resize-none font-mono",
            value: editForm.notes,
            onChange: (e) =>
              setEditForm({ ...editForm, notes: e.target.value }),
          }),
          React.createElement(
            "button",
            {
              onClick: handleAddCustomNoun,
              className:
                "w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold uppercase tracking-wider text-xs transition-colors mt-2 shadow-sm",
            },
            "Save Custom Noun",
          ),
        ),
      content,
    ),
    fullscreenImage &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className:
              "fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 cursor-pointer",
            onClick: () => setFullscreenImage(null),
          },
          React.createElement("img", {
            src: fullscreenImage,
            alt: "Fullscreen Match",
            className:
              "max-w-full max-h-full object-contain rounded shadow-2xl",
            onClick: (e) => e.stopPropagation(),
          }),
          React.createElement(
            "button",
            {
              className:
                "absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full w-12 h-12 flex items-center justify-center transition-colors",
              onClick: () => setFullscreenImage(null),
            },
            React.createElement(Icon, { name: "x", className: "w-6 h-6" }),
          ),
        ),
        document.body,
      ),
  );
};
const ViewAdjectives = ({
  points,
  names,
  adjectives,
  setAdjectives,
  handlePointClick,
  crosshair,
  savedColors = {},
  lockedAdjectives,
  onVisualize,
}) => {
  const [sortBy, setSortBy] = useState("lightness");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const sortedSteps = useMemo(() => {
    const counts = {};
    points.forEach((p) => {
      if (!p.isPin) counts[p.lStr] = (counts[p.lStr] || 0) + 1;
    });
    const steps = points.filter((p) => p.C === 0);
    const unique = [];
    const seen = new Set();
    steps.forEach((p) => {
      if (!seen.has(p.lStr)) {
        seen.add(p.lStr);
        unique.push({ ...p, occurrences: counts[p.lStr] || 0 });
      }
    });
    let filtered = unique;
    if (searchTerm.trim()) {
      const qWords = searchTerm
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      filtered = filtered.filter((item) => {
        const itemAdj = (adjectives[item.lStr] || "").toLowerCase();
        return qWords.every((w) => itemAdj.includes(w));
      });
    }
    return filtered.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case "adjective":
          valA = (adjectives[a.lStr] || "").toLowerCase();
          valB = (adjectives[b.lStr] || "").toLowerCase();
          if (valA === valB) return b.L - a.L;
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "count":
          valA = a.occurrences;
          valB = b.occurrences;
          break;
        case "lightness":
        default:
          valA = a.L;
          valB = b.L;
          break;
      }
      if (valA === valB) return b.L - a.L;
      return sortAsc ? (valA < valB ? -1 : 1) : valB < valA ? -1 : 1;
    });
  }, [points, adjectives, sortBy, sortAsc, searchTerm]);
  const SortButton = ({ field, label, icon }) =>
    React.createElement(
      "button",
      {
        onClick: () => {
          if (sortBy === field) setSortAsc(!sortAsc);
          else {
            setSortBy(field);
            setSortAsc(field !== "lightness");
          }
        },
        className: `flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${sortBy === field ? "bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30" : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-transparent"}`,
      },
      React.createElement(Icon, { name: icon, className: "w-3.5 h-3.5" }),
      label,
      sortBy === field &&
        React.createElement(Icon, {
          name: sortAsc ? "chevron-up" : "chevron-down",
          className: "w-3 h-3",
        }),
    );
  return React.createElement(
    "div",
    { className: "h-full flex flex-col overflow-hidden pt-2" },
    React.createElement(
      "div",
      {
        className:
          "flex flex-wrap justify-between items-center gap-4 px-4 pb-4 mb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0",
      },
      React.createElement(
        "div",
        { className: "flex flex-wrap items-center gap-2" },
        React.createElement(
          "div",
          { className: "relative flex-1 min-w-[200px] max-w-xs mr-4" },
          React.createElement(Icon, {
            name: "search",
            className:
              "absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400",
          }),
          React.createElement("input", {
            type: "text",
            placeholder: "Search adjectives...",
            value: searchTerm,
            onChange: (e) => setSearchTerm(e.target.value),
            className:
              "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[10px] font-bold uppercase tracking-wider rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all",
          }),
          searchTerm &&
            React.createElement(
              "button",
              {
                onClick: () => setSearchTerm(""),
                className:
                  "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200",
              },
              React.createElement(Icon, { name: "x", className: "w-3 h-3" }),
            ),
        ),
        React.createElement(
          "span",
          {
            className:
              "text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase mr-2 flex items-center gap-1.5",
          },
          React.createElement(Icon, {
            name: "arrow-down-up",
            className: "w-3.5 h-3.5",
          }),
          " Sort By:",
        ),
        React.createElement(SortButton, {
          field: "lightness",
          label: "Lightness",
          icon: "sun",
        }),
        React.createElement(SortButton, {
          field: "count",
          label: "Occurrences",
          icon: "bar-chart-2",
        }),
        React.createElement(SortButton, {
          field: "adjective",
          label: "Adjective Name",
          icon: "type",
        }),
      ),
      React.createElement(
        "div",
        { className: "ml-auto flex items-center gap-2" },
        React.createElement(
          "span",
          {
            className:
              "px-2 py-1 bg-sky-500/10 text-sky-500 rounded text-[10px] font-black uppercase tracking-widest border border-sky-500/20",
          },
          "Total: ",
          sortedSteps.length,
          " Adjectives",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "flex-1 overflow-y-auto custom-scrollbar px-4 pb-10" },
      React.createElement(
        "div",
        {
          className:
            "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6",
        },
        sortedSteps.map((item) => {
          const dynamicC = crosshair?.activePullType
            ? crosshair.gravityC
            : crosshair?.rawC || 0;
          const dynamicH = crosshair?.activePullType
            ? crosshair.gravityH
            : crosshair?.rawH || 0;
          const c = new Color("oklch", [item.L, dynamicC, dynamicH]);
          const hexColor = c
            .clone()
            .toGamut({ space: "srgb" })
            .toString({ format: "hex" });
          const dupAdj = getGlobalDuplicate(
            names,
            adjectives,
            item.lStr,
            adjectives[item.lStr],
            savedColors,
          );
          return React.createElement(
            "div",
            {
              key: item.lStr,
              className:
                "flex flex-col items-center gap-2 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm hover:border-sky-500/50 transition-all",
            },
            React.createElement(
              "div",
              {
                onClick: () => handlePointClick([item.L, dynamicC, dynamicH]),
                className:
                  "relative w-16 h-16 rounded-lg shadow-sm cursor-pointer overflow-hidden border border-slate-200 dark:border-neutral-700 hover:ring-2 hover:ring-sky-500 transition-all flex-shrink-0 group/swatch",
                style: { backgroundColor: hexColor },
              },
              !c.inGamut("srgb") &&
                React.createElement("div", {
                  className: "absolute inset-0 pointer-events-none",
                  style: {
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)",
                  },
                }),
              React.createElement(
                "div",
                {
                  className:
                    "absolute top-1 right-1 px-1 py-0.5 rounded-sm text-[9px] font-black font-mono leading-none z-10",
                  style: {
                    color: item.L > 0.65 ? "#010D00" : "#F2E8DF",
                    backgroundColor:
                      item.L > 0.65
                        ? "rgba(242, 232, 223, 0.7)"
                        : "rgba(1, 13, 0, 0.5)",
                  },
                },
                item.occurrences,
              ),
              React.createElement(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    onVisualize(
                      "adjective",
                      item.lStr,
                      adjectives[item.lStr] || `L=${item.lStr}`,
                    );
                  },
                  className:
                    "absolute bottom-1 right-1 opacity-0 group-hover/swatch:opacity-100 bg-black/50 hover:bg-black/70 text-white p-1 rounded transition-opacity z-30",
                  title: "Visualize all instances",
                },
                React.createElement(Icon, {
                  name: "eye",
                  className: "w-3 h-3",
                }),
              ),
            ),
            React.createElement("input", {
              type: "text",
              className: `w-full text-[11px] font-bold uppercase tracking-wider bg-transparent border-b border-slate-200 dark:border-neutral-700 text-center focus:outline-none placeholder:opacity-30 pb-0.5 mt-1 disabled:opacity-50 ${dupAdj ? "!text-red-500 !border-red-500" : "text-slate-800 dark:text-neutral-200 focus:border-sky-500"}`,
              placeholder: "Adjective",
              value: adjectives[item.lStr] || "",
              onChange: (e) =>
                setAdjectives({ ...adjectives, [item.lStr]: e.target.value }),
              disabled: lockedAdjectives[item.lStr],
              title: dupAdj ? `Conflict: ${dupAdj}` : "",
            }),
            React.createElement(
              "div",
              {
                className:
                  "text-[8px] font-mono text-slate-400 dark:text-neutral-500 mt-0.5 flex flex-col items-center gap-0.5",
              },
              React.createElement(
                "div",
                null,
                "L:",
                item.L.toFixed(2),
                " C:",
                dynamicC.toFixed(2),
              ),
              React.createElement(
                "div",
                null,
                "H:",
                dynamicH.toFixed(1),
                "\xB0",
              ),
            ),
          );
        }),
      ),
    ),
  );
};
const ViewPins = ({
  handlePointClick,
  names,
  adjectives,
  dictNotes,
  savedColors = {},
  setSavedColors,
  dictTags,
  setDictTags,
  globalTags = [],
  selectedIds,
  setSelectedIds,
  handleBatchTag,
  handleBatchRemoveTag,
  setShowAveryModal,
  setSelectedPrintIds,
  setAveryPrintSourceType,
}) => {
  const [sortBy, setSortBy] = useState("layer");
  const [sortAsc, setSortAsc] = useState(true);
  const [tagFilter, setTagFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "",
    noun: "",
    adj: "",
    notes: "",
    erpCode: "",
    L: 0.5,
    C: 0.1,
    H: 180,
  });
  const handleAddCustomPin = () => {
    const id = editForm.id.trim() || crypto.randomUUID();
    if (savedColors[id]) {
      alert("Anchor or Pin with this ID already exists.");
      return;
    }
    const L = parseFloat(editForm.L);
    const C = parseFloat(editForm.C);
    const H = parseFloat(editForm.H);
    if (isNaN(L) || isNaN(C) || isNaN(H)) {
      alert("L, C, and H must be valid numbers.");
      return;
    }
    const a = C * Math.sin((H * Math.PI) / 180);
    const b = C * Math.cos((H * Math.PI) / 180);
    setSavedColors((prev) => ({
      ...prev,
      [id]: {
        id,
        type: "pin",
        L,
        C,
        H,
        a,
        b,
        erpCode: editForm.erpCode || "",
        anchorId: "",
        adjId: "",
        color: new Color("oklch", [L, C, H])
          .clone()
          .toGamut({ space: "srgb" })
          .toString({ format: "hex" }),
        nameOverride: editForm.noun || "",
        adjOverride: editForm.adj || "",
        notes: editForm.notes || "",
      },
    }));
    setIsAdding(false);
    setEditForm({
      id: "",
      noun: "",
      adj: "",
      notes: "",
      erpCode: "",
      L: 0.5,
      C: 0.1,
      H: 180,
    });
  };
  const handleDuplicatePin = (sourceId) => {
    const sourcePin = savedColors[sourceId];
    if (!sourcePin) return;
    const newId = crypto.randomUUID();
    setSavedColors((prev) => ({
      ...prev,
      [newId]: {
        ...sourcePin,
        id: newId,
      },
    }));
    setDictTags((prev) => {
      const sourceTags = prev[sourceId];
      if (!sourceTags || sourceTags.length === 0) return prev;
      return {
        ...prev,
        [newId]: [...sourceTags],
      };
    });
  };
  const pinItems = useMemo(() => {
    return Object.values(savedColors)
      .filter((sc) => sc.type === "pin")
      .map((sc) => {
        const { displayAdj, displayName } = getInheritedPinNames(
          sc,
          savedColors,
          names,
          adjectives,
        );
        return {
          ...sc,
          displayAdj: (displayAdj || "Unnamed").trim(),
          displayName: (displayName || "Unnamed").trim(),
          isAdjOverridden: !!sc.adjOverride,
          isNameOverridden: !!sc.nameOverride,
          displayNotes: sc.notes || dictNotes[sc.anchorId] || "",
          tags: dictTags[sc.id] || [],
        };
      });
  }, [savedColors, names, adjectives, dictNotes, dictTags]);
  const allTags = useMemo(
    () => Array.from(new Set(pinItems.flatMap((item) => item.tags))).sort(),
    [pinItems],
  );
  const sortedItems = useMemo(() => {
    let items = [...pinItems];
    if (tagFilter)
      items = items.filter((item) => item.tags.includes(tagFilter));
    if (searchTerm.trim()) {
      const qWords = searchTerm
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      items = items.filter((item) =>
        qWords.every(
          (w) =>
            item.displayName.toLowerCase().includes(w) ||
            item.displayAdj.toLowerCase().includes(w) ||
            item.displayNotes.toLowerCase().includes(w) ||
            item.erpCode.toLowerCase().includes(w),
        ),
      );
    }
    return items.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case "name":
          valA = a.displayName.toLowerCase();
          valB = b.displayName.toLowerCase();
          if (valA === valB) return a.H - b.H;
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "layer":
          valA = a.L;
          valB = b.L;
          break;
        case "tag":
          valA = a.tags.join(", ");
          valB = b.tags.join(", ");
          if (valA === valB) return a.H - b.H;
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "hue":
        default:
          valA = a.H;
          valB = b.H;
          break;
      }
      if (valA === valB) return a.C - b.C;
      return sortAsc ? (valA < valB ? -1 : 1) : valB < valA ? -1 : 1;
    });
  }, [pinItems, sortBy, sortAsc, tagFilter, searchTerm]);
  const handleUnlock = (id) => {
    setSavedColors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const SortButton = ({ field, label, icon }) =>
    React.createElement(
      "button",
      {
        onClick: () => {
          if (sortBy === field) setSortAsc(!sortAsc);
          else {
            setSortBy(field);
            setSortAsc(true);
          }
        },
        className: `flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${sortBy === field ? "bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30" : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-transparent"}`,
      },
      React.createElement(Icon, { name: icon, className: "w-3.5 h-3.5" }),
      label,
      sortBy === field &&
        React.createElement(Icon, {
          name: sortAsc ? "chevron-up" : "chevron-down",
          className: "w-3 h-3",
        }),
    );
  const revertOverride = (id, field) => {
    setSavedColors((prev) => ({ ...prev, [id]: { ...prev[id], [field]: "" } }));
  };
  const handleSelectAll = () => {
    if (selectedIds.length === pinItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pinItems.map((i) => i.id));
    }
  };
  if (pinItems.length === 0 && !isAdding)
    return React.createElement(
      "div",
      {
        className:
          "h-full flex flex-col items-center justify-center text-slate-400 dark:text-neutral-500 opacity-60",
      },
      React.createElement(
        "div",
        { className: "mb-4" },
        React.createElement(
          "button",
          {
            onClick: () => setIsAdding(true),
            className:
              "px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded text-[10px] items-center gap-1.5 flex font-bold uppercase tracking-wider transition-colors",
          },
          React.createElement(Icon, { name: "plus", className: "w-3.5 h-3.5" }),
          "Add Pin",
        ),
      ),
      React.createElement(Icon, {
        name: "map-pin",
        className: "w-12 h-12 mb-4",
      }),
      React.createElement(
        "div",
        { className: "text-xs font-bold uppercase tracking-widest" },
        "No Pins Placed",
      ),
    );
  return React.createElement(
    "div",
    { className: "h-full flex flex-col overflow-hidden pt-2 relative" },
    React.createElement(
      "div",
      {
        className:
          "flex flex-wrap items-center gap-2 px-4 pb-4 mb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0",
      },
      React.createElement(
        "button",
        {
          onClick: handleSelectAll,
          className:
            "mr-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors",
          title: "Select All",
        },
        React.createElement(Icon, {
          name:
            selectedIds.length > 0 && selectedIds.length === pinItems.length
              ? "check-square"
              : "square",
          className: "w-4 h-4",
        }),
      ),
      React.createElement(
        "div",
        { className: "relative flex-1 min-w-[200px] max-w-xs" },
        React.createElement(Icon, {
          name: "search",
          className:
            "absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400",
        }),
        React.createElement("input", {
          type: "text",
          placeholder: "Search names, notes, codes...",
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
          className:
            "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[10px] font-bold uppercase tracking-wider rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all",
        }),
        searchTerm &&
          React.createElement(
            "button",
            {
              onClick: () => setSearchTerm(""),
              className:
                "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200",
            },
            React.createElement(Icon, { name: "x", className: "w-3 h-3" }),
          ),
      ),
      React.createElement(
        "span",
        {
          className:
            "text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase mr-2 flex items-center gap-1.5",
        },
        React.createElement(Icon, {
          name: "arrow-down-up",
          className: "w-3.5 h-3.5",
        }),
        " Sort By:",
      ),
      React.createElement(SortButton, {
        field: "layer",
        label: "Light / Dark",
        icon: "layers",
      }),
      React.createElement(SortButton, {
        field: "hue",
        label: "Hue Angle",
        icon: "palette",
      }),
      React.createElement(SortButton, {
        field: "name",
        label: "Name",
        icon: "type",
      }),
      React.createElement(SortButton, {
        field: "tag",
        label: "Tags",
        icon: "tag",
      }),
      allTags.length > 0 &&
        React.createElement(
          "div",
          { className: "ml-4 flex items-center gap-2" },
          React.createElement(Icon, {
            name: "filter",
            className: "w-3.5 h-3.5 text-slate-400",
          }),
          React.createElement(
            "select",
            {
              value: tagFilter,
              onChange: (e) => setTagFilter(e.target.value),
              className:
                "bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-[9px] font-bold uppercase tracking-wider rounded px-2 py-1 outline-none cursor-pointer",
            },
            React.createElement("option", { value: "" }, "All Tags"),
            allTags.map((t) =>
              React.createElement("option", { key: t, value: t }, t),
            ),
          ),
        ),
      React.createElement(
        "div",
        { className: "ml-auto flex items-center gap-2" },
        React.createElement(
          "button",
          {
            onClick: () => setIsAdding(!isAdding),
            className:
              "px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded text-[10px] items-center gap-1.5 flex font-bold uppercase tracking-wider transition-colors",
          },
          React.createElement(Icon, {
            name: isAdding ? "x" : "plus",
            className: "w-3.5 h-3.5",
          }),
          isAdding ? "Cancel" : "Add Pin",
        ),
        selectedIds.length > 0 &&
          React.createElement(
            "button",
            {
              onClick: () => {
                setAveryPrintSourceType("pins");
                setSelectedPrintIds(selectedIds);
                setShowAveryModal(true);
              },
              className:
                "px-3 py-1.5 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-bold text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 rounded",
              title: "Print Avery 5159 Labels",
            },
            React.createElement(Icon, {
              name: "printer",
              className: "w-3.5 h-3.5",
            }),
            "Print Labels (" + selectedIds.length + ")",
          ),
        React.createElement(
          "span",
          {
            className:
              "px-2 py-1 bg-sky-500/10 text-sky-500 rounded text-[10px] font-black uppercase tracking-widest border border-sky-500/20",
          },
          "Total: ",
          sortedItems.length,
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "flex-1 overflow-y-auto custom-scrollbar px-4 pb-10" },
      React.createElement(
        "div",
        { className: "flex flex-col gap-3" },
        isAdding &&
          React.createElement(
            "div",
            {
              className:
                "flex flex-col gap-3 bg-slate-50 dark:bg-neutral-800/80 p-4 rounded-xl border border-slate-200 dark:border-neutral-700 shadow-sm w-full",
            },
            React.createElement(
              "div",
              { className: "flex gap-3" },
              React.createElement("input", {
                type: "text",
                placeholder: "Custom Pin ID (Optional)",
                className:
                  "flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none",
                value: editForm.id,
                onChange: (e) =>
                  setEditForm({ ...editForm, id: e.target.value }),
              }),
              React.createElement("input", {
                type: "text",
                placeholder: "ERP Code",
                className:
                  "w-1/3 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none",
                value: editForm.erpCode,
                onChange: (e) =>
                  setEditForm({ ...editForm, erpCode: e.target.value }),
              }),
            ),
            React.createElement(
              "div",
              { className: "flex gap-3" },
              React.createElement("input", {
                type: "text",
                placeholder: "Overridden Noun",
                className:
                  "flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none",
                value: editForm.noun,
                onChange: (e) =>
                  setEditForm({ ...editForm, noun: e.target.value }),
              }),
              React.createElement("input", {
                type: "text",
                placeholder: "Overridden Adjective",
                className:
                  "flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none",
                value: editForm.adj,
                onChange: (e) =>
                  setEditForm({ ...editForm, adj: e.target.value }),
              }),
            ),
            React.createElement(
              "div",
              { className: "flex gap-3" },
              React.createElement(
                "div",
                { className: "flex flex-col flex-1" },
                React.createElement(
                  "span",
                  {
                    className:
                      "text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1",
                  },
                  "Lightness (0-1)",
                ),
                React.createElement("input", {
                  type: "number",
                  step: "0.01",
                  min: "0",
                  max: "1",
                  className:
                    "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 outline-none",
                  value: editForm.L,
                  onChange: (e) =>
                    setEditForm({ ...editForm, L: e.target.value }),
                }),
              ),
              React.createElement(
                "div",
                { className: "flex flex-col flex-1" },
                React.createElement(
                  "span",
                  {
                    className:
                      "text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1",
                  },
                  "Chroma (0-0.4)",
                ),
                React.createElement("input", {
                  type: "number",
                  step: "0.01",
                  min: "0",
                  max: "0.4",
                  className:
                    "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 outline-none",
                  value: editForm.C,
                  onChange: (e) =>
                    setEditForm({ ...editForm, C: e.target.value }),
                }),
              ),
              React.createElement(
                "div",
                { className: "flex flex-col flex-1" },
                React.createElement(
                  "span",
                  {
                    className:
                      "text-[9px] uppercase font-bold text-slate-500 dark:text-neutral-400 mb-1",
                  },
                  "Hue (0-360)",
                ),
                React.createElement("input", {
                  type: "number",
                  step: "1",
                  min: "0",
                  max: "360",
                  className:
                    "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 text-xs focus:ring-1 outline-none",
                  value: editForm.H,
                  onChange: (e) =>
                    setEditForm({ ...editForm, H: e.target.value }),
                }),
              ),
            ),
            React.createElement("textarea", {
              placeholder: "Notes...",
              className:
                "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-2 text-xs focus:ring-1 outline-none h-16 w-full resize-none",
              value: editForm.notes,
              onChange: (e) =>
                setEditForm({ ...editForm, notes: e.target.value }),
            }),
            React.createElement(
              "button",
              {
                onClick: handleAddCustomPin,
                className:
                  "w-full py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-bold uppercase tracking-wider text-[10px] transition-colors mt-1",
              },
              "Save Custom Pin",
            ),
          ),
        sortedItems.map((item) =>
          React.createElement(
            "div",
            {
              key: item.id,
              className: `flex items-center gap-5 bg-white dark:bg-neutral-900 p-3.5 rounded-xl border shadow-sm w-full relative group transition-colors ${selectedIds.includes(item.id) ? "border-sky-500 ring-1 ring-sky-500" : "border-slate-200 dark:border-neutral-800"}`,
            },
            React.createElement(
              "div",
              {
                className: `absolute top-2 left-2 z-30 ${selectedIds.includes(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`,
              },
              React.createElement("input", {
                type: "checkbox",
                checked: selectedIds.includes(item.id),
                onChange: (e) => {
                  e.stopPropagation();
                  setSelectedIds((prev) =>
                    prev.includes(item.id)
                      ? prev.filter((id) => id !== item.id)
                      : [...prev, item.id],
                  );
                },
                className: "w-4 h-4 cursor-pointer accent-sky-500 rounded-sm",
              }),
            ),
            React.createElement(
              "div",
              {
                onClick: () =>
                  handlePointClick([item.L, item.C, item.H], item.spectral, {
                    brand: item.brand,
                    originalIndex: item.originalIndex,
                  }),
                className:
                  "relative w-14 h-14 rounded-lg shadow-sm cursor-pointer border border-slate-200 dark:border-neutral-700 hover:ring-2 hover:ring-sky-500 transition-all flex-shrink-0 overflow-hidden ml-6",
                style: { backgroundColor: item.color },
              },
              !new Color("oklch", [item.L, item.C, item.H]).inGamut("srgb") &&
                React.createElement("div", {
                  className: "absolute inset-0 pointer-events-none",
                  style: {
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)",
                  },
                }),
              React.createElement(
                "div",
                {
                  className:
                    "absolute -top-1.5 -left-1.5 bg-sky-500 text-white p-1 rounded-full shadow-sm z-10",
                  title: "Free Coordinate Pin",
                },
                React.createElement(Icon, {
                  name: "map-pin",
                  className: "w-2.5 h-2.5",
                }),
              ),
            ),
            React.createElement(
              "div",
              {
                className:
                  "flex flex-col w-40 flex-shrink-0 border-r border-slate-100 dark:border-neutral-800 pr-4",
              },
              React.createElement(
                "div",
                {
                  className:
                    "text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold mb-1 tracking-wider",
                },
                item.erpCode,
              ),
              React.createElement(
                "div",
                {
                  className:
                    "w-full text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 truncate",
                  title: item.displayAdj,
                },
                item.displayAdj,
              ),
              React.createElement(
                "div",
                {
                  className:
                    "w-full text-xs font-black uppercase tracking-widest text-slate-800 dark:text-neutral-200 truncate",
                  title: item.displayName,
                },
                item.displayName,
              ),
              item.tags.length > 0 &&
                React.createElement(
                  "div",
                  { className: "flex flex-wrap gap-1 mt-1.5" },
                  item.tags.map((t) =>
                    React.createElement(
                      "span",
                      {
                        key: t,
                        className:
                          "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider border border-sky-200 dark:border-sky-500/30",
                      },
                      t,
                    ),
                  ),
                ),
            ),
            React.createElement(
              "div",
              { className: "flex-1 flex flex-col justify-center min-w-0 pr-4 py-1" },
              React.createElement(
                "div",
                {
                  className:
                    "text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-600 mb-0.5",
                },
                "Notes",
              ),
              React.createElement(
                "div",
                {
                  className:
                    "text-[11px] text-slate-600 dark:text-neutral-400 italic line-clamp-2 leading-relaxed mb-2",
                  title: item.displayNotes,
                },
                item.displayNotes || "No notes provided.",
              ),
              React.createElement(
                "div",
                { className: "grid grid-cols-2 lg:grid-cols-5 gap-2 mt-auto" },
                [
                  { label: "Sheen", key: "sheen", options: LABEL_OPTIONS.sheen },
                  { label: "Profile", key: "doorProfile", options: LABEL_OPTIONS.doorProfile },
                  { label: "Vis. Pattern", key: "visualTexture", options: LABEL_OPTIONS.visualPattern },
                  { label: "Tac. Texture", key: "tactileTexture", options: LABEL_OPTIONS.tactileTexture },
                  { label: "Material", key: "material", options: LABEL_OPTIONS.material }
                ].map(field => 
                  React.createElement(
                    "div",
                    { key: field.key, className: "flex flex-col gap-0.5" },
                    React.createElement("label", { className: "text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500" }, field.label),
                    React.createElement("select", {
                      value: item[field.key] || "-",
                      onChange: (e) => setSavedColors(prev => ({
                        ...prev,
                        [item.id]: {
                          ...prev[item.id],
                          [field.key]: e.target.value === "-" ? "" : e.target.value
                        }
                      })),
                      onClick: (e) => e.stopPropagation(),
                      className: "bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 outline-none text-[9px] font-medium text-slate-700 dark:text-neutral-300 w-full p-1 rounded-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-700"
                    },
                      field.options.map(opt => React.createElement("option", { key: opt, value: opt }, opt === "-" ? "Default" : opt))
                    )
                  )
                )
              )
            ),
            React.createElement(
              "div",
              { className: "flex flex-col items-end flex-shrink-0 w-24 pr-4" },
              React.createElement(
                "div",
                {
                  className:
                    "text-[9px] font-mono text-slate-400 dark:text-neutral-500 mb-0.5",
                },
                "L: ",
                item.L.toFixed(3),
              ),
              React.createElement(
                "div",
                {
                  className:
                    "text-[9px] font-mono text-slate-400 dark:text-neutral-500 mb-0.5",
                },
                "C: ",
                item.C.toFixed(3),
              ),
              React.createElement(
                "div",
                {
                  className:
                    "text-[9px] font-mono text-slate-400 dark:text-neutral-500",
                },
                "H: ",
                item.H.toFixed(1),
                "\xB0",
              ),
            ),
            React.createElement(
              "div",
              {
                className: "absolute -top-2 -right-2 flex gap-1 z-10"
              },
              React.createElement(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    handleDuplicatePin(item.id);
                  },
                  className:
                    "bg-sky-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-sky-600 shadow-sm",
                  title: "Duplicate Pin",
                },
                React.createElement(Icon, { name: "copy", className: "w-3 h-3" })
              ),
              React.createElement(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    handleUnlock(item.id);
                  },
                  className:
                    "bg-slate-800 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 shadow-sm",
                  title: "Remove Pin",
                },
                React.createElement(Icon, { name: "x", className: "w-3 h-3" }),
              )
            ),
          ),
        ),
      ),
    ),
    selectedIds.length > 0 &&
      React.createElement(
        "div",
        {
          className:
            "absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 shadow-xl border border-slate-200 dark:border-neutral-700 rounded-full px-4 py-2 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4",
        },
        React.createElement(
          "span",
          {
            className:
              "text-[11px] font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider",
          },
          selectedIds.length,
          " selected",
        ),
        React.createElement("div", {
          className: "w-px h-4 bg-slate-300 dark:bg-neutral-600",
        }),
        React.createElement(
          "div",
          { className: "flex items-center gap-2" },
          React.createElement(Icon, {
            name: "tag",
            className: "w-3.5 h-3.5 text-slate-400",
          }),
          React.createElement(
            "div",
            {
              className:
                "flex items-center bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded overflow-hidden",
            },
            React.createElement(
              "select",
              {
                className:
                  "bg-transparent px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none border-r border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-neutral-200 cursor-pointer appearance-none",
                onChange: (e) => {
                  if (e.target.value) {
                    handleBatchTag(e.target.value);
                    e.target.value = "";
                  }
                },
              },
              React.createElement("option", { value: "" }, "Apply..."),
              globalTags.map((t) =>
                React.createElement("option", { key: t, value: t }, t),
              ),
            ),
            React.createElement("input", {
              type: "text",
              placeholder: "Or new tag...",
              className:
                "bg-transparent px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:bg-white dark:focus:bg-neutral-800 w-24 text-slate-800 dark:text-neutral-200",
              onKeyDown: (e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  handleBatchTag(e.target.value.trim());
                  e.target.value = "";
                }
              },
            }),
          ),
          React.createElement("div", {
            className: "w-px h-4 bg-slate-300 dark:bg-neutral-600 mx-1",
          }),
          React.createElement(Icon, {
            name: "tag",
            className: "w-3.5 h-3.5 text-slate-400",
          }),
          React.createElement(
            "div",
            {
              className:
                "flex items-center bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded overflow-hidden",
            },
            React.createElement(
              "select",
              {
                className:
                  "bg-transparent px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none text-slate-800 dark:text-neutral-200 cursor-pointer appearance-none",
                onChange: (e) => {
                  if (e.target.value) {
                    handleBatchRemoveTag(e.target.value);
                    e.target.value = "";
                  }
                },
              },
              React.createElement("option", { value: "" }, "Remove..."),
              globalTags.map((t) =>
                React.createElement("option", { key: t, value: t }, t),
              ),
            ),
          ),
          React.createElement(
            "button",
            {
              onClick: () => setSelectedIds([]),
              className:
                "text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300 ml-2 px-2 py-1",
            },
            "Cancel",
          ),
        ),
      ),
  );
};
const ViewGroups = ({ settings, setSettings }) => {
  const updateSetting = (key, val) => setSettings({ ...settings, [key]: val });
  const updateHue = (index, field, val) => {
    const newHues = [...settings.hues];
    newHues[index] = { ...newHues[index], [field]: val };
    setSettings({ ...settings, hues: newHues });
  };
  const onBlurSort = () => {
    const newHues = [...settings.hues].sort((a, b) => a.maxH - b.maxH);
    setSettings({ ...settings, hues: newHues });
  };
  const addHue = () => {
    const newHues = [
      ...settings.hues,
      { id: crypto.randomUUID(), name: "New Color", maxH: 360 },
    ];
    setSettings({ ...settings, hues: newHues });
  };
  const removeHue = (index) => {
    const newHues = settings.hues.filter((_, i) => i !== index);
    setSettings({ ...settings, hues: newHues });
  };
  const updateNeutral = (index, field, val) => {
    const newNeutrals = [
      ...(settings.neutrals || defaultGroupSettings.neutrals),
    ];
    newNeutrals[index] = { ...newNeutrals[index], [field]: val };
    setSettings({ ...settings, neutrals: newNeutrals });
  };
  const onBlurSortNeutrals = () => {
    const newNeutrals = [
      ...(settings.neutrals || defaultGroupSettings.neutrals),
    ].sort((a, b) => a.maxL - b.maxL);
    setSettings({ ...settings, neutrals: newNeutrals });
  };
  const addNeutral = () => {
    const newNeutrals = [
      ...(settings.neutrals || defaultGroupSettings.neutrals),
      { id: crypto.randomUUID(), name: "New Neutral", maxL: 1 },
    ];
    setSettings({ ...settings, neutrals: newNeutrals });
  };
  const removeNeutral = (index) => {
    const newNeutrals = (
      settings.neutrals || defaultGroupSettings.neutrals
    ).filter((_, i) => i !== index);
    setSettings({ ...settings, neutrals: newNeutrals });
  };
  const addOverride = () => {
    const newOverrides = [
      ...(settings.overrides || []),
      {
        id: crypto.randomUUID(),
        condition: "Light Muted Yellow",
        name: "Beige",
      },
    ];
    setSettings({ ...settings, overrides: newOverrides });
  };
  const updateOverride = (index, field, val) => {
    const newOverrides = [...(settings.overrides || [])];
    newOverrides[index] = { ...newOverrides[index], [field]: val };
    setSettings({ ...settings, overrides: newOverrides });
  };
  const removeOverride = (index) => {
    const newOverrides = (settings.overrides || []).filter(
      (_, i) => i !== index,
    );
    setSettings({ ...settings, overrides: newOverrides });
  };
  return React.createElement(
    "div",
    { className: "h-full flex flex-col overflow-y-auto custom-scrollbar p-6" },
    React.createElement(
      "div",
      { className: "mb-6" },
      React.createElement(
        "div",
        { className: "flex items-center gap-4 mb-4" },
        React.createElement(
          "span",
          {
            className:
              "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400",
          },
          "Global Thresholds",
        ),
        React.createElement("div", {
          className: "flex-1 h-px bg-slate-200 dark:bg-neutral-800",
        }),
      ),
      React.createElement(
        "div",
        {
          className:
            "grid grid-cols-1 md:grid-cols-3 gap-6 bg-white dark:bg-neutral-900 p-5 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm",
        },
        React.createElement(SliderGroup, {
          label: "Light / Dark Boundary",
          value: settings.lightL,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (v) => updateSetting("lightL", v),
          icon: "sun",
        }),
        React.createElement(SliderGroup, {
          label: "Neutral Boundary",
          value: settings.neutralC,
          min: 0,
          max: 0.1,
          step: 0.001,
          onChange: (v) => updateSetting("neutralC", v),
          icon: "circle",
        }),
        React.createElement(SliderGroup, {
          label: "Vivid / Muted Boundary",
          value: settings.vividC,
          min: settings.neutralC,
          max: 0.4,
          step: 0.001,
          onChange: (v) => updateSetting("vividC", v),
          icon: "zap",
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "mb-6" },
      React.createElement(
        "div",
        { className: "flex items-center gap-4 mb-4" },
        React.createElement(
          "span",
          {
            className:
              "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400",
          },
          "Neutral Regions (L 0 - 1)",
        ),
        React.createElement("div", {
          className: "flex-1 h-px bg-slate-200 dark:bg-neutral-800",
        }),
        React.createElement(
          "button",
          {
            onClick: addNeutral,
            className:
              "text-[10px] font-bold uppercase tracking-wider text-sky-500 hover:text-sky-600 flex items-center gap-1 bg-sky-500/10 px-2 py-1 rounded transition-colors",
          },
          React.createElement(Icon, { name: "plus", className: "w-3 h-3" }),
          " Add Region",
        ),
      ),
      React.createElement(
        "div",
        { className: "flex flex-col gap-3" },
        (settings.neutrals || defaultGroupSettings.neutrals).map((neu, i) =>
          React.createElement(
            "div",
            {
              key: neu.id,
              className:
                "flex items-center gap-4 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm transition-all hover:border-sky-500/50",
            },
            React.createElement("div", {
              className:
                "w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 flex-shrink-0",
              style: {
                backgroundColor: new Color("oklch", [
                  Math.max(0, neu.maxL - 0.05),
                  0,
                  0,
                ])
                  .toGamut({ space: "srgb" })
                  .toString({ format: "hex" }),
              },
            }),
            React.createElement(
              "div",
              { className: "flex-1" },
              React.createElement(
                "label",
                {
                  className:
                    "text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1",
                },
                "Region Name",
              ),
              React.createElement("input", {
                type: "text",
                value: neu.name,
                onChange: (e) => updateNeutral(i, "name", e.target.value),
                className:
                  "w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-bold text-slate-800 dark:text-neutral-200 py-1 transition-colors",
              }),
            ),
            React.createElement(
              "div",
              { className: "w-32" },
              React.createElement(
                "label",
                {
                  className:
                    "text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1",
                },
                "Upper Bound (L)",
              ),
              React.createElement("input", {
                type: "number",
                min: 0,
                max: 1,
                step: 0.01,
                value: neu.maxL,
                onChange: (e) =>
                  updateNeutral(i, "maxL", parseFloat(e.target.value) || 0),
                onBlur: onBlurSortNeutrals,
                className:
                  "w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-mono text-slate-800 dark:text-neutral-200 py-1 transition-colors",
              }),
            ),
            React.createElement(
              "button",
              {
                onClick: () => removeNeutral(i),
                className:
                  "p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors",
                title: "Remove Region",
              },
              React.createElement(Icon, {
                name: "trash-2",
                className: "w-4 h-4",
              }),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "mb-6" },
      React.createElement(
        "div",
        { className: "flex items-center gap-4 mb-4" },
        React.createElement(
          "span",
          {
            className:
              "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400",
          },
          "Hue Regions (0\xB0 - 360\xB0)",
        ),
        React.createElement("div", {
          className: "flex-1 h-px bg-slate-200 dark:bg-neutral-800",
        }),
        React.createElement(
          "button",
          {
            onClick: addHue,
            className:
              "text-[10px] font-bold uppercase tracking-wider text-sky-500 hover:text-sky-600 flex items-center gap-1 bg-sky-500/10 px-2 py-1 rounded transition-colors",
          },
          React.createElement(Icon, { name: "plus", className: "w-3 h-3" }),
          " Add Region",
        ),
      ),
      React.createElement(
        "div",
        { className: "flex flex-col gap-3" },
        settings.hues.map((hue, i) =>
          React.createElement(
            "div",
            {
              key: hue.id,
              className:
                "flex items-center gap-4 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm transition-all hover:border-sky-500/50",
            },
            React.createElement("div", {
              className:
                "w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 flex-shrink-0",
              style: {
                backgroundColor: new Color("oklch", [
                  settings.lightL + 0.15,
                  settings.vividC + 0.05,
                  hue.maxH - 15,
                ])
                  .toGamut({ space: "srgb" })
                  .toString({ format: "hex" }),
              },
            }),
            React.createElement(
              "div",
              { className: "flex-1" },
              React.createElement(
                "label",
                {
                  className:
                    "text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1",
                },
                "Region Name",
              ),
              React.createElement("input", {
                type: "text",
                value: hue.name,
                onChange: (e) => updateHue(i, "name", e.target.value),
                className:
                  "w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-bold text-slate-800 dark:text-neutral-200 py-1 transition-colors",
              }),
            ),
            React.createElement(
              "div",
              { className: "w-32" },
              React.createElement(
                "label",
                {
                  className:
                    "text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1",
                },
                "Upper Bound (H\xB0)",
              ),
              React.createElement("input", {
                type: "number",
                min: 0,
                max: 360,
                value: hue.maxH,
                onChange: (e) =>
                  updateHue(i, "maxH", parseFloat(e.target.value) || 0),
                onBlur: onBlurSort,
                className:
                  "w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-mono text-slate-800 dark:text-neutral-200 py-1 transition-colors",
              }),
            ),
            React.createElement(
              "button",
              {
                onClick: () => removeHue(i),
                className:
                  "p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors",
                title: "Remove Region",
              },
              React.createElement(Icon, {
                name: "trash-2",
                className: "w-4 h-4",
              }),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "mt-8" },
      React.createElement(
        "div",
        { className: "flex items-center gap-4 mb-4" },
        React.createElement(
          "span",
          {
            className:
              "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400",
          },
          "Combination Overrides",
        ),
        React.createElement("div", {
          className: "flex-1 h-px bg-slate-200 dark:bg-neutral-800",
        }),
        React.createElement(
          "button",
          {
            onClick: addOverride,
            className:
              "text-[10px] font-bold uppercase tracking-wider text-sky-500 hover:text-sky-600 flex items-center gap-1 bg-sky-500/10 px-2 py-1 rounded transition-colors",
          },
          React.createElement(Icon, { name: "plus", className: "w-3 h-3" }),
          " Add Override",
        ),
      ),
      React.createElement(
        "div",
        { className: "flex flex-col gap-3" },
        (settings.overrides || []).map((ov, i) =>
          React.createElement(
            "div",
            {
              key: ov.id,
              className:
                "flex items-center gap-4 bg-white dark:bg-neutral-900 p-3 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm transition-all hover:border-sky-500/50",
            },
            React.createElement(
              "div",
              { className: "flex-1" },
              React.createElement(
                "label",
                {
                  className:
                    "text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1",
                },
                "Target Combination",
              ),
              React.createElement("input", {
                type: "text",
                value: ov.condition,
                onChange: (e) => updateOverride(i, "condition", e.target.value),
                placeholder: "e.g. Light Muted Yellow",
                className:
                  "w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-mono text-slate-800 dark:text-neutral-200 py-1 transition-colors",
              }),
            ),
            React.createElement(
              "div",
              { className: "flex-1" },
              React.createElement(
                "label",
                {
                  className:
                    "text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1",
                },
                "New Name",
              ),
              React.createElement("input", {
                type: "text",
                value: ov.name,
                onChange: (e) => updateOverride(i, "name", e.target.value),
                placeholder: "e.g. Beige",
                className:
                  "w-full bg-transparent border-b border-slate-300 dark:border-neutral-600 focus:border-sky-500 outline-none text-xs font-bold text-slate-800 dark:text-neutral-200 py-1 transition-colors",
              }),
            ),
            React.createElement(
              "button",
              {
                onClick: () => removeOverride(i),
                className:
                  "p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors mt-4",
                title: "Remove Override",
              },
              React.createElement(Icon, {
                name: "trash-2",
                className: "w-4 h-4",
              }),
            ),
          ),
        ),
        (!settings.overrides || settings.overrides.length === 0) &&
          React.createElement(
            "div",
            {
              className:
                "text-center p-4 text-[10px] uppercase tracking-widest text-slate-400 border border-dashed border-slate-200 dark:border-neutral-800 rounded-xl",
            },
            "No overrides configured",
          ),
      ),
    ),
  );
};
const ColorHarmonies = ({ L, C, H, handlePointClick }) => {
  const harmonies = useMemo(() => {
    const h = H || 0;
    return [
      { name: "Complementary", hues: [h, (h + 180) % 360] },
      { name: "Analogous", hues: [h, (h + 30) % 360, (h - 30 + 360) % 360] },
      { name: "Triadic", hues: [h, (h + 120) % 360, (h + 240) % 360] },
      {
        name: "Tetradic",
        hues: [h, (h + 90) % 360, (h + 180) % 360, (h + 270) % 360],
      },
      {
        name: "Split Complementary",
        hues: [h, (h + 150) % 360, (h + 210) % 360],
      },
      {
        name: "Monochromatic",
        hues: [h, h, h],
        Ls: [Math.max(0, L - 0.2), L, Math.min(1, L + 0.2)],
      },
    ];
  }, [L, C, H]);
  return React.createElement(
    "div",
    { className: "flex flex-col gap-4" },
    harmonies.map((harmony) =>
      React.createElement(
        "div",
        { key: harmony.name, className: "flex flex-col gap-1.5" },
        React.createElement(
          "div",
          {
            className:
              "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400",
          },
          harmony.name,
        ),
        React.createElement(
          "div",
          { className: "flex gap-2" },
          harmony.hues.map((hue, i) => {
            const l = harmony.Ls ? harmony.Ls[i] : L;
            const cObj = new Color("oklch", [l, C, hue]);
            const hex = cObj
              .clone()
              .toGamut({ space: "srgb" })
              .toString({ format: "hex" });
            return React.createElement("div", {
              key: i,
              className:
                "h-8 flex-1 rounded-md shadow-sm cursor-pointer border border-slate-200 dark:border-neutral-700 hover:ring-2 hover:ring-sky-500 transition-all",
              style: { backgroundColor: hex },
              onClick: () => handlePointClick([l, C, hue]),
              title: `L: ${l.toFixed(2)} C: ${C.toFixed(2)} H: ${hue.toFixed(1)}`,
            });
          }),
        ),
      ),
    ),
  );
};
const SpectralGraph = ({
  spectralData,
  spectralDataB,
  colorA,
  colorB,
  theme,
  meta,
  metaB,
}) => {
  const isLight = theme === "light";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wavelengthToColor = (w) => {
    if (w < 400 || w > 700) return "rgba(0,0,0,0)";
    let r, g, b;
    if (w >= 380 && w < 440) {
      r = -(w - 440) / (440 - 380);
      g = 0;
      b = 1;
    } else if (w >= 440 && w < 490) {
      r = 0;
      g = (w - 440) / (490 - 440);
      b = 1;
    } else if (w >= 490 && w < 510) {
      r = 0;
      g = 1;
      b = -(w - 510) / (510 - 490);
    } else if (w >= 510 && w < 580) {
      r = (w - 510) / (580 - 510);
      g = 1;
      b = 0;
    } else if (w >= 580 && w < 645) {
      r = 1;
      g = -(w - 645) / (645 - 580);
      b = 0;
    } else if (w >= 645 && w <= 780) {
      r = 1;
      g = 0;
      b = 0;
    } else {
      r = 0;
      g = 0;
      b = 0;
    }
    let factor;
    if (w >= 380 && w < 420) {
      factor = 0.3 + (0.7 * (w - 380)) / (420 - 380);
    } else if (w >= 420 && w < 701) {
      factor = 1;
    } else if (w >= 701 && w <= 780) {
      factor = 0.3 + (0.7 * (780 - w)) / (780 - 700);
    } else {
      factor = 0;
    }
    const gamma = 0.8;
    const R = r === 0 ? 0 : Math.round(255 * Math.pow(r * factor, gamma));
    const G = g === 0 ? 0 : Math.round(255 * Math.pow(g * factor, gamma));
    const B = b === 0 ? 0 : Math.round(255 * Math.pow(b * factor, gamma));
    return `rgba(${R},${G},${B},0.6)`;
  };
  const colors = useMemo(
    () => SPECTRAL_TABLES.wavelengths.map((w) => wavelengthToColor(w)),
    [],
  );
  const data = useMemo(() => {
    if (spectralDataB) {
      return [
        {
          x: SPECTRAL_TABLES.wavelengths,
          y: spectralData,
          type: "scatter",
          mode: "lines",
          line: {
            color: colorA || (isLight ? "#010D00" : "#F2E8DF"),
            width: 3,
          },
          name: "Color A",
          hovertemplate:
            "<b>Color A</b><br>Wavelength: %{x}nm<br>Reflectance: %{y:.4f}<extra></extra>",
        },
        {
          x: SPECTRAL_TABLES.wavelengths,
          y: spectralDataB,
          type: "scatter",
          mode: "lines",
          line: {
            color: colorB || (isLight ? "#666666" : "#aaaaaa"),
            width: 3,
          },
          name: "Color B",
          hovertemplate:
            "<b>Color B</b><br>Wavelength: %{x}nm<br>Reflectance: %{y:.4f}<extra></extra>",
        },
      ];
    }
    return [
      {
        x: SPECTRAL_TABLES.wavelengths,
        y: spectralData,
        type: "bar",
        marker: { color: colors, line: { width: 0 } },
        width: 10,
        hoverinfo: "none",
      },
      {
        x: SPECTRAL_TABLES.wavelengths,
        y: spectralData,
        type: "scatter",
        mode: "lines",
        line: { color: isLight ? "#010D00" : "#F2E8DF", width: 2 },
        hovertemplate:
          "Wavelength: %{x}nm<br>Reflectance: %{y:.4f}<extra></extra>",
      },
    ];
  }, [spectralData, spectralDataB, colors, isLight, colorA, colorB]);
  const layout = useMemo(
    () => ({
      margin: isFullscreen
        ? { l: 50, r: 30, t: 30, b: 50 }
        : { l: 30, r: 10, t: 10, b: 30 },
      xaxis: {
        title: {
          text: "Wavelength (nm)",
          font: { size: isFullscreen ? 14 : 10 },
        },
        tickfont: { size: isFullscreen ? 12 : 9 },
        gridcolor: !isLight ? "rgba(177,188,131,0.18)" : "rgba(43,64,50,0.12)",
        zerolinecolor: !isLight
          ? "rgba(177,188,131,0.25)"
          : "rgba(43,64,50,0.15)",
        range: [400, 700],
        fixedrange: true,
      },
      yaxis: {
        title: { text: "Reflectance", font: { size: isFullscreen ? 14 : 10 } },
        tickfont: { size: isFullscreen ? 12 : 9 },
        range: [0, 1],
        fixedrange: true,
        autorange: false,
        gridcolor: !isLight ? "rgba(177,188,131,0.18)" : "rgba(43,64,50,0.12)",
        zerolinecolor: !isLight
          ? "rgba(177,188,131,0.25)"
          : "rgba(43,64,50,0.15)",
      },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      hovermode: "x unified",
      showlegend: !!spectralDataB,
      legend: { orientation: "h", y: 1.1, x: 0.5, xanchor: "center" },
      barmode: "overlay",
    }),
    [isFullscreen, isLight, spectralDataB],
  );
  const metaItems = useMemo(() => {
    const items = [];
    if (meta?.illuminant) items.push(["Illuminant", meta.illuminant]);
    if (meta?.observer) items.push(["Observer", `${meta.observer}\xB0`]);
    if (meta?.measurementMethod) items.push(["Method", meta.measurementMethod]);
    if (meta?.measurementDate) items.push(["Date", meta.measurementDate]);
    if (meta?.measurementDevice) items.push(["Device", meta.measurementDevice]);
    return items;
  }, [meta]);
  const metaItemsB = useMemo(() => {
    if (!metaB) return [];
    const items = [];
    if (metaB?.illuminant) items.push(["Illuminant", metaB.illuminant]);
    if (metaB?.observer) items.push(["Observer", `${metaB.observer}\xB0`]);
    if (metaB?.measurementMethod)
      items.push(["Method", metaB.measurementMethod]);
    if (metaB?.measurementDate) items.push(["Date", metaB.measurementDate]);
    if (metaB?.measurementDevice)
      items.push(["Device", metaB.measurementDevice]);
    return items;
  }, [metaB]);
  const MetaRibbon = ({ compact, items, label }) => {
    if (!items || items.length === 0) {
      if (spectralDataB && !label) return null;
      return React.createElement(
        "div",
        {
          className: `${compact ? "text-[9px]" : "text-[10px]"} text-slate-400 dark:text-neutral-500 italic tracking-wide`,
        },
        label ? `${label} - ` : "",
        "No measurement metadata provided",
      );
    }
    return React.createElement(
      "div",
      { className: "flex flex-col gap-1" },
      label &&
        React.createElement(
          "div",
          {
            className: `font-bold ${compact ? "text-[9px]" : "text-[11px]"} text-slate-700 dark:text-slate-300`,
          },
          label,
        ),
      React.createElement(
        "div",
        {
          className: `flex flex-wrap gap-x-3 gap-y-1 ${compact ? "text-[9px]" : "text-[11px]"}`,
        },
        items.map(([k, v]) =>
          React.createElement(
            "div",
            { key: k, className: "flex items-baseline gap-1" },
            React.createElement(
              "span",
              {
                className: `font-bold uppercase tracking-widest ${compact ? "text-[8px]" : "text-[9px]"} text-slate-400 dark:text-neutral-500`,
              },
              k,
            ),
            React.createElement(
              "span",
              {
                className:
                  "font-mono font-bold text-slate-800 dark:text-slate-200",
              },
              v,
            ),
          ),
        ),
      ),
    );
  };
  if (isFullscreen) {
    return ReactDOM.createPortal(
      React.createElement(
        "div",
        {
          className: "fixed inset-0 z-[9999] p-4 flex flex-col",
          style: { backgroundColor: "var(--bg)" },
        },
        React.createElement(
          "div",
          {
            className:
              "flex justify-between items-center mb-4 relative z-10 p-4",
          },
          React.createElement(
            "div",
            { className: "flex flex-col gap-4" },
            React.createElement(
              "h2",
              {
                className:
                  "text-lg font-semibold text-slate-800 dark:text-slate-200",
              },
              "Spectral Response",
            ),
            React.createElement(
              "div",
              { className: "flex gap-8" },
              React.createElement(MetaRibbon, {
                items: metaItems,
                label: spectralDataB ? "Color A" : null,
              }),
              spectralDataB &&
                React.createElement(MetaRibbon, {
                  items: metaItemsB,
                  label: "Color B",
                }),
            ),
          ),
          React.createElement(
            "button",
            {
              onClick: () => setIsFullscreen(false),
              className:
                "p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full text-slate-500 dark:text-slate-400 pointer-events-auto shrink-0 self-start",
            },
            React.createElement(Icon, { name: "x", className: "w-5 h-5" }),
          ),
        ),
        React.createElement(
          "div",
          { className: "flex-1 min-h-0 relative z-0" },
          React.createElement(PlotlyChart, {
            data,
            layout,
            config: { displayModeBar: false },
            theme,
          }),
        ),
      ),
      document.body,
    );
  }
  return React.createElement(
    "div",
    { className: "flex flex-col gap-2" },
    React.createElement(
      "div",
      {
        className:
          "px-2 py-1.5 bg-slate-50 dark:bg-neutral-800/50 rounded-lg border border-slate-100 dark:border-neutral-800",
      },
      React.createElement(MetaRibbon, {
        compact: true,
        items: metaItems,
        label: spectralDataB ? "Color A" : null,
      }),
      spectralDataB &&
        React.createElement(
          "div",
          {
            className:
              "mt-2 pt-2 border-t border-slate-200 dark:border-neutral-700",
          },
          React.createElement(MetaRibbon, {
            compact: true,
            items: metaItemsB,
            label: "Color B",
          }),
        ),
    ),
    React.createElement(
      "div",
      {
        className:
          "h-48 w-full bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 overflow-hidden relative group",
      },
      React.createElement(
        "button",
        {
          onClick: () => setIsFullscreen(true),
          className:
            "absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-neutral-900/80 hover:bg-white dark:hover:bg-neutral-900 rounded shadow-sm text-slate-500 dark:text-slate-400 z-10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity",
        },
        React.createElement(Icon, { name: "maximize-2", className: "w-4 h-4" }),
      ),
      React.createElement(PlotlyChart, {
        data,
        layout,
        config: { displayModeBar: false },
        theme,
      }),
    ),
  );
};
function getBrandDisplayName(key) {
  const displayNames = {
    pantone: "Pantone",
    ral: "RAL",
    ncs: "NCS",
    behr: "Behr",
    benjaminMoore: "Benjamin Moore",
    farrowBall: "Farrow & Ball",
    ppg: "PPG",
    sherwinWilliams: "Sherwin Williams",
    dulux: "Dulux",
    tafisa: "Tafisa",
    uniboard: "Uniboard",
    agt: "AGT",
    egger: "Egger",
    finsa: "Finsa",
    arborite: "Arborite",
    pionite: "Pionite",
    swissKrono: "Swiss Krono",
    munsell: "Munsell",
    unknown: "Unknown",
  };
  if (displayNames[key]) return displayNames[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
function normalizeBrandKey(s) {
  if (!s) return "";
  const knownBrands = {
    pantone: "pantone",
    ral: "ral",
    ncs: "ncs",
    behr: "behr",
    "benjamin moore": "benjaminMoore",
    "farrow & ball": "farrowBall",
    "farrow and ball": "farrowBall",
    ppg: "ppg",
    "sherwin williams": "sherwinWilliams",
    "sherwin-williams": "sherwinWilliams",
    dulux: "dulux",
    tafisa: "tafisa",
    uniboard: "uniboard",
    agt: "agt",
    egger: "egger",
    finsa: "finsa",
    arborite: "arborite",
    pionite: "pionite",
    "swiss krono": "swissKrono",
    munsell: "munsell",
  };
  const lower = s.toLowerCase().trim();
  if (knownBrands[lower]) return knownBrands[lower];
  return lower
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/ +(.)/g, (_, c) => c.toUpperCase());
}
const parseCSV = (csvText) => {
  if (!window.Papa) {
    console.error(
      "PapaParse library not loaded! Falling back to primitive parser.",
    );
    const lines = csvText.split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.replace(/\r$/, "").trim());
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/\r$/, "");
      if (!line.trim()) continue;
      const row = [];
      let inQuotes = false;
      let currentVal = "";
      for (let char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === "," && !inQuotes) {
          row.push(currentVal);
          currentVal = "";
        } else currentVal += char;
      }
      row.push(currentVal);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] ? row[idx].trim() : "";
      });
      result.push(obj);
    }
    return result;
  }
  return window.Papa.parse(csvText, { header: true, skipEmptyLines: true })
    .data;
};
const processCSVData = (
  parsedData,
  currentColorData,
  currentSavedColors,
  currentNames = {},
  currentAdjs = {},
  currentNotes = {},
  currentTags = {},
  currentGroupSettings = null,
) => {
  const newColorData = currentColorData
    ? JSON.parse(JSON.stringify(currentColorData))
    : {};
  const newSavedColors = currentSavedColors
    ? JSON.parse(JSON.stringify(currentSavedColors))
    : {};
  const newNames = currentNames ? JSON.parse(JSON.stringify(currentNames)) : {};
  const newAdjs = currentAdjs ? JSON.parse(JSON.stringify(currentAdjs)) : {};
  const newNotes = currentNotes ? JSON.parse(JSON.stringify(currentNotes)) : {};
  const newTags = currentTags ? JSON.parse(JSON.stringify(currentTags)) : {};
  let newGroupSettings = currentGroupSettings
    ? JSON.parse(JSON.stringify(currentGroupSettings))
    : null;
  let colorsAdded = 0;
  let pinsAdded2 = 0;
  let hasNeutrals = false;
  let hasHues = false;
  let hasOverrides = false;
  parsedData.forEach((row) => {
    const targetType = String(row.Type || "")
      .toUpperCase()
      .trim();
    if (!targetType) return;
    if (targetType === "SETTING") {
      if (!newGroupSettings)
        newGroupSettings = {
          lightL: 0.5,
          neutralC: 0.02,
          vividC: 0.1,
          neutrals: [],
          hues: [],
          overrides: [],
        };
      const prop = row.Noun || row.ID;
      if (prop === "lightL" && row.OKLCH_L)
        newGroupSettings.lightL = parseFloat(row.OKLCH_L);
      if (prop === "neutralC" && row.OKLCH_C)
        newGroupSettings.neutralC = parseFloat(row.OKLCH_C);
      if (prop === "vividC" && row.OKLCH_C)
        newGroupSettings.vividC = parseFloat(row.OKLCH_C);
      return;
    }
    if (targetType === "NEUTRAL_REGION") {
      if (!newGroupSettings)
        newGroupSettings = {
          lightL: 0.5,
          neutralC: 0.02,
          vividC: 0.1,
          neutrals: [],
          hues: [],
          overrides: [],
        };
      if (!hasNeutrals) {
        newGroupSettings.neutrals = [];
        hasNeutrals = true;
      }
      newGroupSettings.neutrals.push({
        id: row.ID || crypto.randomUUID(),
        name: row.Noun || "",
        maxL: parseFloat(row.OKLCH_L) || 0,
      });
      return;
    }
    if (targetType === "HUE_REGION") {
      if (!newGroupSettings)
        newGroupSettings = {
          lightL: 0.5,
          neutralC: 0.02,
          vividC: 0.1,
          neutrals: [],
          hues: [],
          overrides: [],
        };
      if (!hasHues) {
        newGroupSettings.hues = [];
        hasHues = true;
      }
      newGroupSettings.hues.push({
        id: row.ID || crypto.randomUUID(),
        name: row.Noun || "",
        maxH: parseFloat(row.OKLCH_H) || 0,
      });
      return;
    }
    if (targetType === "OVERRIDE") {
      if (!newGroupSettings)
        newGroupSettings = {
          lightL: 0.5,
          neutralC: 0.02,
          vividC: 0.1,
          neutrals: [],
          hues: [],
          overrides: [],
        };
      if (!hasOverrides) {
        newGroupSettings.overrides = [];
        hasOverrides = true;
      }
      newGroupSettings.overrides.push({
        id: row.ID || crypto.randomUUID(),
        condition: row.Adjective || "",
        name: row.Noun || "",
      });
      return;
    }
    let pL = null,
      pC = null,
      pH = null;
    let spectral = [];
    let hasFullSpectral = true;
    for (let wl = 400; wl <= 700; wl += 10) {
      const key = `R${wl} nm`;
      const val = row[key];
      if (val !== void 0 && val !== "") {
        spectral.push(parseFloat(val));
      } else {
        hasFullSpectral = false;
      }
    }
    if (!hasFullSpectral && row.Spectral) {
      try {
        let text = String(row.Spectral).trim();
        if (text.startsWith('"') && text.endsWith('"'))
          text = text.substring(1, text.length - 1);
        if (text.startsWith("[")) {
          spectral = JSON.parse(text);
          hasFullSpectral = spectral.length === 31;
        }
      } catch (e) {}
    }
    if (hasFullSpectral && spectral.length === 31) {
      try {
        const xyzStandard = calculateXYZFromSpectral(spectral, 2, "D65");
        const tc = new Color("xyz-d65", xyzStandard).to("oklch");
        pL = Math.max(0, Math.min(1, tc.coords[0]));
        pC = Math.max(0, Math.min(0.4, tc.coords[1]));
        pH = isNaN(tc.coords[2]) ? 0 : ((tc.coords[2] % 360) + 360) % 360;
      } catch (e) {}
    } else {
      hasFullSpectral = false;
      spectral = [];
      try {
        let tc;
        if (
          row.OKLCH_L !== void 0 &&
          row.OKLCH_C !== void 0 &&
          row.OKLCH_H !== void 0 &&
          row.OKLCH_L !== ""
        ) {
          tc = new Color("oklch", [
            parseFloat(row.OKLCH_L),
            parseFloat(row.OKLCH_C),
            parseFloat(row.OKLCH_H),
          ]);
        } else if (row.HEX) {
          let ch = String(row.HEX).trim();
          if (!ch.startsWith("#")) ch = "#" + ch;
          tc = new Color(ch);
        }
        if (tc) {
          const o = tc.to("oklch");
          pL = Math.max(0, Math.min(1, o.coords[0]));
          pC = Math.max(0, Math.min(0.4, o.coords[1]));
          pH = isNaN(o.coords[2]) ? 0 : ((o.coords[2] % 360) + 360) % 360;
        }
      } catch (e) {}
    }
    let hex = row.HEX || "#B1BC83";
    if (pL !== null && (!row.HEX || row.HEX === "")) {
      hex = new Color("oklch", [pL, pC, typeof pH === "number" ? pH : 0])
        .clone()
        .toGamut({ space: "srgb" })
        .toString({ format: "hex" });
    }
    if (
      targetType === "DB" ||
      targetType === "BRAND" ||
      targetType === "SPECTRAL"
    ) {
      const brandRaw = (row.Adjective || row.Brand || "").trim();
      const name = (row.Noun || row.Name || "").trim() || "Unnamed";
      const url = (row.ERP_Code || row.URL || "").trim();
      let image = (row.Note || row.Image || "").trim();
      if (image.includes("placehold") || image.includes("dummy")) image = "";
      const finalBrand = normalizeBrandKey(brandRaw) || "unknown";
      if (finalBrand) {
        if (!newColorData[finalBrand]) newColorData[finalBrand] = [];
        const existingIdx = newColorData[finalBrand].findIndex(
          (c) => c.name.toLowerCase() === name.toLowerCase(),
        );
        const colorObj = { name, hex, L: pL, C: pC, H: pH };
        if (row.Tags)
          colorObj.tags =
            typeof row.Tags === "string"
              ? row.Tags.split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
              : Array.isArray(row.Tags)
                ? row.Tags
                : [];
        if (spectral.length > 0) colorObj.spectral = spectral;
        if (url) colorObj.url = url;
        if (image) colorObj.image = image;
        if (row.Illuminant) colorObj.illuminant = String(row.Illuminant).trim();
        if (row.Observer)
          colorObj.observer = parseInt(row.Observer, 10) || void 0;
        if (row.Measurement_Method)
          colorObj.measurementMethod = String(row.Measurement_Method).trim();
        if (row.Measurement_Date)
          colorObj.measurementDate = String(row.Measurement_Date).trim();
        if (row.Measurement_Device)
          colorObj.measurementDevice = String(row.Measurement_Device).trim();
        if (existingIdx >= 0) {
          newColorData[finalBrand][existingIdx] = {
            ...newColorData[finalBrand][existingIdx],
            ...colorObj,
          };
        } else {
          newColorData[finalBrand].push(colorObj);
        }
        colorsAdded++;
      }
    } else if (targetType === "PIN" && pL !== null) {
      const pinId = row.ID || crypto.randomUUID();
      const a = pC * Math.sin((pH * Math.PI) / 180);
      const b = pC * Math.cos((pH * Math.PI) / 180);
      const cStr = Math.round(pC * 100)
        .toString()
        .padStart(2, "0");
      const hStr = Math.round(pH).toString().padStart(3, "0");
      const anchorId = `${cStr}-${hStr}`;
      const adjId = getLStr(pL);
      newSavedColors[pinId] = {
        id: pinId,
        type: "pin",
        L: pL,
        C: pC,
        H: pH,
        nameOverride: row.Noun || "",
        adjOverride: row.Adjective || "",
        notes: row.Note || "",
        erpCode: row.ERP_Code || getExactErpCode(pL, pC, pC === 0 ? 0 : pH),
        adjId,
        anchorId,
        color:
          row.HEX ||
          new Color("oklch", [pL, pC, pH])
            .clone()
            .toGamut({ space: "srgb" })
            .toString({ format: "hex" }),
        a,
        b,
        spectral,
      };
      if (row.Illuminant)
        newSavedColors[pinId].illuminant = String(row.Illuminant).trim();
      if (row.Observer)
        newSavedColors[pinId].observer = parseInt(row.Observer, 10) || void 0;
      if (row.Measurement_Method)
        newSavedColors[pinId].measurementMethod = String(
          row.Measurement_Method,
        ).trim();
      if (row.Measurement_Date)
        newSavedColors[pinId].measurementDate = String(
          row.Measurement_Date,
        ).trim();
      if (row.Measurement_Device)
        newSavedColors[pinId].measurementDevice = String(
          row.Measurement_Device,
        ).trim();
      if (row.Tags)
        newTags[pinId] = row.Tags.split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      if (typeof pinsAdded2 !== "undefined") pinsAdded2++;
    } else if (targetType === "NOUN") {
      const parts = String(row.OKLCH_L || "").split("-");
      let minL = 0,
        maxL = 1;
      if (parts.length === 2) {
        minL = parseFloat(parts[0]) || 0;
        maxL = parseFloat(parts[1]) || 1;
      } else if (parts.length === 1 && parts[0] !== "") {
        minL = parseFloat(parts[0]) || 0;
        maxL = parseFloat(parts[0]) || 1;
      } else if (pL !== null) {
        minL = maxL = pL;
      }
      const C = pC !== null ? pC : 0;
      const H = pH !== null ? pH : 0;
      let id = row.ID;
      if (!id) {
        id = `col-${minL}-${maxL}-${C.toFixed(2)}-${H.toFixed(2)}`;
      }
      newSavedColors[id] = {
        id,
        type: "nounColumn",
        nameOverride: row.Noun || "",
        C,
        H,
        minL,
        maxL,
        a: C * Math.sin((H * Math.PI) / 180),
        b: C * Math.cos((H * Math.PI) / 180),
        notes: row.Note || "",
      };
      if (row.Noun !== void 0 && row.Noun !== "") newNames[id] = row.Noun;
      if (row.Note !== void 0 && row.Note !== "") newNotes[id] = row.Note;
      if (row.Tags)
        newTags[id] = row.Tags.split(",")
          .map((t) => t.trim())
          .filter(Boolean);
    } else if (
      (targetType === "GRID" ||
        targetType === "ANCHOR" ||
        targetType === "NOUN_COLUMN") &&
      row.ID
    ) {
      const C = pC !== null ? pC : 0;
      const H = pH !== null ? pH : 0;
      if (targetType === "NOUN_COLUMN") {
        const id = row.ID;
        const parts = (row.OKLCH_L || "").split("-");
        let minL = 0,
          maxL = 1;
        if (parts.length === 2) {
          minL = parseFloat(parts[0]);
          maxL = parseFloat(parts[1]);
        }
        newSavedColors[id] = {
          id,
          type: "nounColumn",
          nameOverride: row.Noun || "",
          C,
          H,
          minL,
          maxL,
          a: C * Math.sin((H * Math.PI) / 180),
          b: C * Math.cos((H * Math.PI) / 180),
          notes: row.Note || "",
        };
        if (row.Noun !== void 0 && row.Noun !== "") newNames[id] = row.Noun;
        if (row.Note !== void 0 && row.Note !== "") newNotes[id] = row.Note;
        if (row.Tags)
          newTags[id] = row.Tags.split(",")
            .map((t) => t.trim())
            .filter(Boolean);
      } else {
        if (row.Noun !== void 0 && row.Noun !== "") newNames[row.ID] = row.Noun;
        if (row.Note !== void 0 && row.Note !== "") newNotes[row.ID] = row.Note;
        if (row.Tags)
          newTags[row.ID] = row.Tags.split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        let lStr = null;
        if (row.Adjective !== void 0 && row.Adjective !== "") {
          if (pL !== null) {
            lStr = getLStr(pL);
          } else if (row.ERP_Code && row.ERP_Code.length >= 2) {
            lStr = row.ERP_Code.substring(0, 2);
          }
          if (lStr) newAdjs[lStr] = row.Adjective;
        }
        if (
          String(row.Locked).toUpperCase() === "TRUE" &&
          pL !== null &&
          pC !== null &&
          pH !== null
        ) {
          const anchorId = row.ID;
          const adjId = lStr || getLStr(pL);
          const a = pC * Math.sin((pH * Math.PI) / 180);
          const b = pC * Math.cos((pH * Math.PI) / 180);
          newSavedColors[anchorId] = {
            id: anchorId,
            type: "anchor",
            L: pL,
            C: pC,
            H: pH,
            a,
            b,
            erpCode: row.ERP_Code || getExactErpCode(pL, pC, pH),
            adjId,
            anchorId,
            nameOverride: "",
            adjOverride: "",
            notes: "",
            color: new Color("oklch", [pL, pC, pH])
              .clone()
              .toGamut({ space: "srgb" })
              .toString({ format: "hex" }),
          };
        }
      }
    } else if (targetType === "ADJECTIVE") {
      if (row.Adjective !== void 0 && row.Adjective !== "") {
        const lStr =
          (row.ID && row.ID.trim()) ||
          (row.OKLCH_L &&
            typeof row.OKLCH_L === "string" &&
            row.OKLCH_L.trim()) ||
          (pL !== null ? getLStr(pL) : null) ||
          (row.ERP_Code && row.ERP_Code.length >= 2
            ? row.ERP_Code.substring(0, 2)
            : null);
        if (lStr) newAdjs[lStr.trim()] = row.Adjective;
      }
    }
  });
  return {
    newColorData,
    newSavedColors,
    newNames,
    newAdjs,
    newNotes,
    newTags,
    colorsAdded,
    pinsAdded: pinsAdded2,
    newGroupSettings,
  };
};
const App = () => {
  const [theme, setTheme] = useState("light");
  const [activeTab, setActiveTab] = useState("top");
  const [colorData, setColorData] = useState(null);
  const [filterL, setFilterL] = useState(1);
  const [filterC, setFilterC] = useState(0.4);
  const [filterH, setFilterH] = useState(180);
  const updateColorData = (newData) => {
    setColorData(newData);
  };
  const gridData = useMemo(() => generateGridData(), []);
  const initialState = useMemo(() => {
    const el = document.getElementById("color-samificator-state");
    let parsed = {};
    if (el) {
      try {
        let raw = el.textContent;
        if (el.type === "application/base64") {
          raw = decodeURIComponent(atob(raw.trim()));
        }
        parsed = JSON.parse(raw) || {};
      } catch (e) {
        console.error("Failed to parse saved state:", e);
      }
    }
    if (!parsed.savedColors) parsed.savedColors = {};
    if (!parsed.names) parsed.names = {};
    if (!parsed.dictNotes) parsed.dictNotes = {};
    if (!parsed.savedColors["__migrated_grid_nouns"]) {
      const newColors = { ...parsed.savedColors };
      gridData.baseAnchors.forEach((a) => {
        const addN = (ref, pref, minL, maxL) => {
          if (!ref) return;
          const oldId = `${pref}-${a.cStr}-${a.hStr}`;
          if (!newColors[oldId]) {
            newColors[oldId] = {
              id: oldId,
              type: "nounColumn",
              nameOverride: parsed.names[oldId] || "",
              C: a.C,
              H: a.H,
              minL,
              maxL,
              a: a.C * Math.sin((a.H * Math.PI) / 180),
              b: a.C * Math.cos((a.H * Math.PI) / 180),
              notes: parsed.dictNotes[oldId] || "",
            };
          }
        };
        addN(a.ultraLightRef, "UL", 0.95, 1);
        addN(a.lightRef, "L", 0.5, 0.95);
        addN(a.darkRef, "D", 0.2, 0.5);
        addN(a.ultraDarkRef, "UD", 0, 0.2);
      });
      newColors["__migrated_grid_nouns"] = { type: "system", migrated: true };
      parsed.savedColors = newColors;
    }
    return parsed;
  }, [gridData.baseAnchors]);
  const [names, setNames] = useState(initialState?.names || {});
  const [adjectives, setAdjectives] = useState(initialState?.adjectives || {});
  const [dictNotes, setDictNotes] = useState(initialState?.dictNotes || {});
  const [dictTags, setDictTags] = useState(initialState?.dictTags || {});
  const globalTags = useMemo(() => {
    const tags = new Set();
    Object.values(dictTags).forEach((tagList) => {
      if (Array.isArray(tagList)) {
        tagList.forEach((t) => tags.add(t));
      }
    });
    if (colorData) {
      Object.values(colorData).forEach((brandColors) => {
        if (Array.isArray(brandColors)) {
          brandColors.forEach((c) => {
            if (Array.isArray(c.tags)) c.tags.forEach((t) => tags.add(t));
          });
        }
      });
    }
    return Array.from(tags).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }, [dictTags, colorData]);
  const [savedColors, setSavedColors] = useState(
    initialState?.savedColors || {},
  );
  const [tetheringPinId, setTetheringPinId] = useState(null);
  useEffect(() => {
    let needsCleanup = false;
    const next = { ...savedColors };
    let deletedAny = true;
    while (deletedAny) {
      deletedAny = false;
      Object.values(next).forEach((sc) => {
        if (
          sc.type === "anchor" &&
          sc.anchorId &&
          sc.anchorId.startsWith("custom-noun-") &&
          !next[sc.anchorId]
        ) {
          delete next[sc.id];
          deletedAny = true;
          needsCleanup = true;
        } else if (
          sc.type === "pin" &&
          sc.anchorId &&
          sc.anchorId.startsWith("custom-noun-") &&
          !next[sc.anchorId]
        ) {
          delete next[sc.id];
          deletedAny = true;
          needsCleanup = true;
        } else if (
          sc.type === "pin" &&
          sc.parentPinId &&
          !next[sc.parentPinId]
        ) {
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
  const lockedNouns = useMemo(() => {
    const res = {};
    Object.values(savedColors).forEach((sc) => {
      if (sc.type === "anchor" && sc.locked !== false) res[sc.anchorId] = true;
    });
    return res;
  }, [savedColors]);
  const lockedAdjectives = useMemo(() => {
    const res = {};
    Object.values(savedColors).forEach((sc) => {
      if (sc.type === "anchor" && sc.locked !== false) res[sc.adjId] = true;
    });
    return res;
  }, [savedColors]);

  const getPaletteItemInfo = useCallback((item) => {
    if (!item) return { hex: "#FFFFFF", displayName: "", erpCode: "", L: 0, C: 0, H: 0 };
    const c = new Color("oklch", [item.L, item.C, item.H]);
    const hex = c
      .clone()
      .toGamut({ space: "srgb" })
      .toString({ format: "hex" })
      .toUpperCase();
    let pin = item.pinId ? savedColors[item.pinId] : null;
    if (!pin) {
      pin = Object.values(savedColors).find(
        (sc) => sc.type === "pin" && sc.erpCode === item.erpCode,
      );
    }
    
    let adj = "";
    let noun = "";
    if (pin) {
      const inherited = getInheritedPinNames(pin, savedColors, names, adjectives, colorData);
      adj = inherited.displayAdj;
      noun = inherited.displayName;
    } else {
      adj = adjectives[item.adjId] || "";
      noun = names[item.nounId] || "";
    }
    
    const displayName = `${adj} ${noun}`.trim() || "Unnamed";
    return { hex, displayName, erpCode: item.erpCode || "N/A", L: item.L, C: item.C, H: item.H, pin };
  }, [savedColors, adjectives, names, colorData]);

  const [groupSettings, setGroupSettings] = useState(
    initialState?.groupSettings || defaultGroupSettings,
  );
  const [palette, setPalette] = useState(initialState?.palette || []);
  const [savedPalettes, setSavedPalettes] = useState(
    initialState?.savedPalettes || [],
  );
  const [selectedSavedPaletteId, setSelectedSavedPaletteId] = useState("");
  const [isSavingPalette, setIsSavingPalette] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAveryModal, setShowAveryModal] = useState(false);
  const [averyPrintSourceType, setAveryPrintSourceType] = useState("palette");
  const [selectedPrintIds, setSelectedPrintIds] = useState([]);
  const [printConfigs, setPrintConfigs] = useState({});
  const [printStartIndex, setPrintStartIndex] = useState(1);
  const [printLabelSwatches, setPrintLabelSwatches] = useState(true);
  const [printLabelNames, setPrintLabelNames] = useState(true);
  const [printLabelErp, setPrintLabelErp] = useState(true);
  const [printLabelHex, setPrintLabelHex] = useState(true);
  const [printLabelOklch, setPrintLabelOklch] = useState(true);
  const [printLabelBorders, setPrintLabelBorders] = useState(true);

  const [printLabelDoorProfile, setPrintLabelDoorProfile] = useState("SL (Slab)");
  const [printLabelSheen, setPrintLabelSheen] = useState("MT (Matte)");
  const [printLabelVisualTexture, setPrintLabelVisualTexture] = useState("V2 (Straight Grain)");
  const [printLabelTactileTexture, setPrintLabelTactileTexture] = useState("T3 (Linear Grain)");
  const [printLabelMaterial, setPrintLabelMaterial] = useState("Solid Laminate");

  const averySourceItems = useMemo(() => {
    if (averyPrintSourceType === "pins") {
      return Object.values(savedColors).filter((sc) => sc.type === "pin").map((sc) => ({
        id: sc.id,
        L: sc.L,
        C: sc.C,
        H: sc.H,
        erpCode: sc.erpCode,
        adjId: sc.adjId,
        nounId: sc.anchorId,
        pinId: sc.id,
      }));
    }
    return palette;
  }, [averyPrintSourceType, savedColors, palette]);

  const generateAveryPages = useCallback(() => {
    const activeItems = averySourceItems.filter((item) => selectedPrintIds.includes(item.id));
    const pages = [];
    let currentPage = [];
    
    const offset = Math.max(0, printStartIndex - 1);
    for (let i = 0; i < offset; i++) {
      currentPage.push(null);
    }
    
    activeItems.forEach((item) => {
      const config = printConfigs[item.id] || {};
      const count = Math.max(1, parseInt(config.count) || 1);
      
      for (let j = 0; j < count; j++) {
        if (currentPage.length === 14) {
          pages.push(currentPage);
          currentPage = [];
        }
        currentPage.push(item);
      }
    });
    
    if (currentPage.length > 0) {
      while (currentPage.length < 14) {
        currentPage.push(null);
      }
      pages.push(currentPage);
    }
    
    return pages.length > 0 ? pages : [Array(14).fill(null)];
  }, [averySourceItems, selectedPrintIds, printStartIndex, printConfigs]);
  const [observer, setObserver] = useState(initialState?.observer || 10);
  const [illuminant, setIlluminant] = useState(
    initialState?.illuminant || "D65",
  );
  const [linkedFiles, setLinkedFiles] = useState(
    initialState?.linkedFiles || [],
  );
  const loadInitialData = useCallback(async () => {
    let loadedColorData = null;
    if (window.__COLOR_DATA__) {
      loadedColorData = window.__COLOR_DATA__;
    }
    if (loadedColorData) setColorData(loadedColorData);
    let currentColorData = loadedColorData || {};
    let currentSavedColors = savedColors;
    let currentNames = initialState?.names || {};
    let currentAdjs = initialState?.adjectives || {};
    let currentNotes = initialState?.dictNotes || {};
    let currentTags = initialState?.dictTags || {};
    let currentGroupSettings =
      initialState?.groupSettings || defaultGroupSettings;
    const discoverCSVFiles = async () => {
      try {
        const res = await fetch("./data/");
        if (res.ok) {
          const text = await res.text();
          if (!text.includes("The ColorSAMificator")) {
            const regex = /href=["']?([^"'>]+\.csv)["'>]?/gi;
            let match;
            const parsedFiles = new Set();
            while ((match = regex.exec(text)) !== null) {
              const name = match[1].split("/").pop();
              if (name && name.toLowerCase().endsWith(".csv"))
                parsedFiles.add(decodeURIComponent(name));
            }
            if (parsedFiles.size > 0) {
              return Array.from(parsedFiles);
            }
          }
        }
      } catch (e) {}
      try {
        if (window.location.hostname.includes("github.io")) {
          const user = window.location.hostname.split(".")[0];
          const repo =
            window.location.pathname.split("/")[1] || user + ".github.io";
          if (user && repo) {
            let repoPath = window.location.pathname
              .split("/")
              .slice(2)
              .join("/");
            const lastSlashIndex = repoPath.lastIndexOf("/");
            if (lastSlashIndex !== -1) {
              repoPath = repoPath.substring(0, lastSlashIndex);
            } else if (repoPath.includes(".")) {
              repoPath = "";
            }
            if (repoPath.endsWith("/")) repoPath = repoPath.slice(0, -1);
            const targetPath = repoPath ? `${repoPath}/data` : "data";
            const apiPath = `https://api.github.com/repos/${user}/${repo}/contents/${targetPath}`;
            const res = await fetch(apiPath);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) {
                return data
                  .filter(
                    (f) => f.name && f.name.toLowerCase().endsWith(".csv"),
                  )
                  .map((f) => f.name);
              }
            }
          }
        }
      } catch (e) {}
      const knownDataFiles = [
        "Reference Colors.csv",
        "agt.csv",
        "anchors.csv",
        "arborite.csv",
        "behr.csv",
        "benjaminMoore.csv",
        "dulux.csv",
        "egger.csv",
        "farrowball.csv",
        "finsa.csv",
        "munsell.csv",
        "ncs.csv",
        "pantone.csv",
        "pins.csv",
        "pionite.csv",
        "ppg.csv",
        "ral.csv",
        "sherwinWilliams.csv",
        "swissKrono.csv",
        "tafisa.csv",
        "uniboard.csv",
      ];
      const initial = initialState?.linkedFiles || [];
      const union = [
        ...new Set([...knownDataFiles, ...initial, ...linkedFiles]),
      ];
      return union.filter((f) => f.toLowerCase().endsWith(".csv"));
    };
    let discoveredFiles = await discoverCSVFiles();
    const filesToLoad = [];
    const uniqueFiles = [...new Set([...discoveredFiles, ...linkedFiles])];
    if (uniqueFiles.includes("anchors.csv")) filesToLoad.push("anchors.csv");
    if (uniqueFiles.includes("pins.csv")) filesToLoad.push("pins.csv");
    uniqueFiles.forEach((f) => {
      if (f !== "anchors.csv" && f !== "pins.csv") filesToLoad.push(f);
    });
    if (
      filesToLoad.length !== linkedFiles.length ||
      !filesToLoad.every((f, i) => f === linkedFiles[i])
    ) {
      setLinkedFiles(filesToLoad);
    }
    for (const file of filesToLoad) {
      try {
        let csvText = "";
        let parsedUrl = new URL(window.location.href);
        let p = parsedUrl.pathname;
        if (!p.endsWith("/") && !p.split("/").pop().includes(".")) {
          p += "/";
        }
        let baseForFetch = parsedUrl.origin + p;
        const resolvedPath = file.startsWith("data/") ? file : "data/" + file;
        const resolvedUrl = new URL(resolvedPath, baseForFetch).href;
        const res = await fetch(resolvedUrl);
        if (res.ok) {
          csvText = await res.text();
        }
        if (csvText) {
          const fc = csvText.trimStart().slice(0, 5).toLowerCase();
          if (fc === "<!doc" || fc === "<html") continue;
          const parsed = parseCSV(csvText);
          if (!parsed.length) continue;
          const processed = processCSVData(
            parsed,
            currentColorData,
            currentSavedColors,
            currentNames,
            currentAdjs,
            currentNotes,
            currentTags,
            currentGroupSettings,
          );
          currentColorData = processed.newColorData;
          currentSavedColors = processed.newSavedColors;
          currentNames = processed.newNames;
          currentAdjs = processed.newAdjs;
          currentNotes = processed.newNotes;
          currentTags = processed.newTags;
          if (processed.newGroupSettings)
            currentGroupSettings = processed.newGroupSettings;
        }
      } catch (e) {
        console.warn("Failed: " + file, e);
      }
    }
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
  }, [linkedFiles]);
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData, linkedFiles.length]);
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
    const normalizedTag = tag.toLowerCase().trim();
    if (activeTab === "db") {
      const updated = { ...colorData };
      let changed = false;
      selectedIds.forEach((id) => {
        const lastDashIdx = id.lastIndexOf("-");
        if (lastDashIdx === -1) return;
        const brand = id.substring(0, lastDashIdx);
        const idx = parseInt(id.substring(lastDashIdx + 1), 10);
        if (updated[brand] && updated[brand][idx]) {
          updated[brand] = [...updated[brand]];
          updated[brand][idx] = { ...updated[brand][idx] };
          const currentTags = updated[brand][idx].tags || [];
          if (!currentTags.some((t) => t.toLowerCase() === normalizedTag)) {
            updated[brand][idx].tags = [...currentTags, tag.trim()];
            changed = true;
          }
        }
      });
      if (changed) updateColorData(updated);
    } else {
      setDictTags((prev) => {
        const next = { ...prev };
        selectedIds.forEach((id) => {
          const currentTags = (next[id] || []).map((t) => t.toLowerCase());
          if (!currentTags.includes(normalizedTag)) {
            next[id] = [...(next[id] || []), tag.trim()];
          }
        });
        return next;
      });
    }
    setSelectedIds([]);
  };
  const handleBatchRemoveTag = (tag) => {
    if (!tag || selectedIds.length === 0) return;
    const normalizedTag = tag.toLowerCase().trim();
    if (activeTab === "db") {
      const updated = { ...colorData };
      let changed = false;
      selectedIds.forEach((id) => {
        const lastDashIdx = id.lastIndexOf("-");
        if (lastDashIdx === -1) return;
        const brand = id.substring(0, lastDashIdx);
        const idx = parseInt(id.substring(lastDashIdx + 1), 10);
        if (updated[brand] && updated[brand][idx]) {
          updated[brand] = [...updated[brand]];
          updated[brand][idx] = { ...updated[brand][idx] };
          const currentTags = updated[brand][idx].tags || [];
          if (currentTags.some((t) => t.toLowerCase() === normalizedTag)) {
            updated[brand][idx].tags = currentTags.filter(
              (t) => t.toLowerCase() !== normalizedTag,
            );
            changed = true;
          }
        }
      });
      if (changed) updateColorData(updated);
    } else {
      setDictTags((prev) => {
        const next = { ...prev };
        selectedIds.forEach((id) => {
          const currentTags = next[id] || [];
          next[id] = currentTags.filter(
            (t) => t.toLowerCase() !== normalizedTag,
          );
          if (next[id].length === 0) delete next[id];
        });
        return next;
      });
    }
    setSelectedIds([]);
  };
  const [viewportVisibility, setViewportVisibility] = useState({
    pins: true,
    anchors: true,
    commercial: false,
    brands: {},
  });
  const filteredColorData = useMemo(() => {
    if (!colorData) return null;
    if (viewportVisibility.commercial === false) return {};
    const filtered = {};
    for (const brand of Object.keys(colorData)) {
      if (viewportVisibility.brands[brand] === true) {
        filtered[brand] = colorData[brand];
      }
    }
    return filtered;
  }, [colorData, viewportVisibility]);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const visibilityMenuRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        visibilityMenuRef.current &&
        !visibilityMenuRef.current.contains(event.target)
      ) {
        setShowVisibilityMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [viewportSearchQuery, setViewportSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("dots");
  const [swatchLayout, setSwatchLayout] = useState("gallery");
  const [viewportTagFilter, setViewportTagFilter] = useState("");
  const [swatchZoom, setSwatchZoom] = useState(1);
  const [scrubL, setScrubL] = useState(0.65);
  const [scrubC, setScrubC] = useState(0.12);
  const [scrubH, setScrubH] = useState(0);
  const [scrubCommercial, setScrubCommercial] = useState(null);
  const [temporarySpectral, setTemporarySpectral] = useState(null);
  const [compSlotA, setCompSlotA] = useState(null);
  const [compSlotB, setCompSlotB] = useState(null);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [showCompareFullscreen, setShowCompareFullscreen] = useState(false);
  const [showFullscreenSpectral, setShowFullscreenSpectral] = useState(true);
  const [showFullscreenPalette, setShowFullscreenPalette] = useState(false);
  const [showCompareDivider, setShowCompareDivider] = useState(true);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showDatabaseManager, setShowDatabaseManager] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [visualizeData, setVisualizeData] = useState(null);
  const [history, setHistory] = useState({
    list: [
      {
        names: initialState?.names || {},
        adjectives: initialState?.adjectives || {},
        dictNotes: initialState?.dictNotes || {},
        dictTags: initialState?.dictTags || {},
        savedColors: initialState?.savedColors || {},
        groupSettings: initialState?.groupSettings || defaultGroupSettings,
        palette: initialState?.palette || [],
        savedPalettes: initialState?.savedPalettes || [],
      },
    ],
    index: 0,
  });
  const isUndoing = useRef(false);
  const currentStateStr = JSON.stringify({
    names,
    adjectives,
    dictNotes,
    dictTags,
    savedColors,
    groupSettings,
    palette,
    savedPalettes,
    observer,
    illuminant,
  });
  useEffect(() => {
    if (isUndoing.current) {
      isUndoing.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setHistory((prev) => {
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
    setHistory((prev) => {
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
        if (prevState.observer !== void 0) setObserver(prevState.observer);
        if (prevState.illuminant !== void 0)
          setIlluminant(prevState.illuminant);
        return { ...prev, index: newIndex };
      }
      return prev;
    });
  };
  const handleRedo = () => {
    setHistory((prev) => {
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
        if (nextState.observer !== void 0) setObserver(nextState.observer);
        if (nextState.illuminant !== void 0)
          setIlluminant(nextState.illuminant);
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
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedoRef.current();
        } else {
          e.preventDefault();
          handleUndoRef.current();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedoRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const filteredViewData = useMemo(() => {
    if (!gridData) return { points: [], baseAnchors: [], savedColors: {} };
    let points = [...gridData.allPoints];
    let baseAnchors = [...gridData.baseAnchors];
    const filteredSavedColors = { ...savedColors };
    Object.values(filteredSavedColors).forEach((sc) => {
      const adjId = sc.adjId || getLStr(sc.L);
      const anchorId =
        sc.anchorId ||
        `custom-${Math.round(sc.C * 100)
          .toString()
          .padStart(
            2,
            "0",
          )}-${Math.round(sc.H).toString().padStart(3, "0")}-${adjId}`;
      if (sc.type === "pin" || sc.type === "anchor") {
        const pt = {
          L: sc.L,
          C: sc.C,
          H: sc.H,
          a: sc.a,
          b: sc.b,
          lStr: adjId,
          cStr: anchorId ? anchorId.split("-")[1] : "",
          hStr: anchorId ? anchorId.split("-")[2] : "",
          erpCode: sc.erpCode,
          color: sc.color,
          opacity: 1,
          ring: 0,
          delta: 0,
          isPin: sc.type === "pin",
          pinId: sc.type === "pin" ? sc.id : void 0,
          adjOverride: sc.adjOverride,
          nameOverride: sc.nameOverride,
          anchorId,
          adjId,
          isCustomAnchor: sc.type === "anchor",
        };
        points.push(pt);
        baseAnchors.push({
          C: sc.C,
          H: sc.H,
          a: sc.a,
          b: sc.b,
          cStr: pt.cStr,
          hStr: pt.hStr,
          isPin: sc.type === "pin",
          pinId: sc.type === "pin" ? sc.id : void 0,
          L: sc.L,
          minL: sc.L,
          maxL: sc.L,
          color: sc.color,
          anchorId,
          adjId,
          nameOverride: sc.nameOverride,
          adjOverride: sc.adjOverride,
          isCustomAnchor: sc.type === "anchor",
        });
      } else if (sc.type === "nounColumn") {
        const dL = 0.02;
        let countAdded = 0;
        if (sc.minL === sc.maxL && sc.minL !== null) {
          const L = sc.minL;
          const cColor = new Color("oklch", [L, sc.C, sc.H]);
          const existingIdx = points.findIndex(
            (p) =>
              Math.abs(p.L - L) < 0.001 &&
              Math.abs(p.C - sc.C) < 0.001 &&
              Math.abs(p.H - sc.H) < 0.001,
          );
          if (existingIdx >= 0) {
            points[existingIdx] = {
              ...points[existingIdx],
              parentNounId: sc.id,
              isCustomNounGenerated: true,
            };
            countAdded++;
          } else if (cColor.inGamut("srgb")) {
            points.push({
              L,
              C: sc.C,
              H: sc.H,
              a: sc.a,
              b: sc.b,
              lStr: getLStr(L),
              cStr: Math.round(sc.C * 100)
                .toString()
                .padStart(2, "0"),
              hStr: Math.round(sc.H).toString().padStart(3, "0"),
              erpCode: `NOUN-C${Math.round(sc.C * 100)
                .toString()
                .padStart(
                  2,
                  "0",
                )}-H${Math.round(sc.H).toString().padStart(3, "0")}`,
              color: cColor
                .clone()
                .toGamut({ space: "srgb" })
                .toString({ format: "hex" }),
              opacity: 1,
              ring: 0,
              delta: 0,
              isPin: false,
              isCustomNounGenerated: true,
              parentNounId: sc.id,
            });
            countAdded++;
          }
        } else {
          for (let L = Math.ceil(sc.minL / dL) * dL; L <= sc.maxL; L += dL) {
            const cColor = new Color("oklch", [L, sc.C, sc.H]);
            const existingIdx = points.findIndex(
              (p) =>
                Math.abs(p.L - L) < 0.001 &&
                Math.abs(p.C - sc.C) < 0.001 &&
                Math.abs(p.H - sc.H) < 0.001,
            );
            if (existingIdx >= 0) {
              points[existingIdx] = {
                ...points[existingIdx],
                parentNounId: sc.id,
                isCustomNounGenerated: true,
              };
              countAdded++;
            } else if (cColor.inGamut("srgb")) {
              const pt = {
                L,
                C: sc.C,
                H: sc.H,
                a: sc.a,
                b: sc.b,
                lStr: getLStr(L),
                cStr: Math.round(sc.C * 100)
                  .toString()
                  .padStart(2, "0"),
                hStr: Math.round(sc.H).toString().padStart(3, "0"),
                erpCode: `NOUN-C${Math.round(sc.C * 100)
                  .toString()
                  .padStart(
                    2,
                    "0",
                  )}-H${Math.round(sc.H).toString().padStart(3, "0")}`,
                color: cColor
                  .clone()
                  .toGamut({ space: "srgb" })
                  .toString({ format: "hex" }),
                opacity: 1,
                ring: 0,
                delta: 0,
                isPin: false,
                isCustomNounGenerated: true,
                parentNounId: sc.id,
              };
              points.push(pt);
              countAdded++;
            }
          }
        }
        const anchorExists = baseAnchors.some(
          (ba) =>
            Math.abs(ba.C - sc.C) < 0.001 &&
            Math.abs(ba.H - sc.H) < 0.001 &&
            Math.abs((ba.minL || 0) - sc.minL) < 0.001 &&
            Math.abs((ba.maxL || 1) - sc.maxL) < 0.001,
        );
        if (!anchorExists) {
          baseAnchors.push({
            C: sc.C,
            H: sc.H,
            a: sc.a,
            b: sc.b,
            minL: sc.minL,
            maxL: sc.maxL,
            cStr: Math.round(sc.C * 100)
              .toString()
              .padStart(2, "0"),
            hStr: Math.round(sc.H).toString().padStart(3, "0"),
            isCustomNounGenerated: true,
            parentNounId: sc.id,
          });
        }
      }
    });
    const filterTags = viewportTagFilter
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    const q = viewportSearchQuery.toLowerCase().trim();
    if (!viewportVisibility.pins) {
      Object.keys(filteredSavedColors).forEach((k) => {
        if (filteredSavedColors[k].type === "pin")
          delete filteredSavedColors[k];
      });
      points = points.filter((p) => !p.isPin);
      baseAnchors = baseAnchors.filter((p) => !p.isPin);
    }
    if (!viewportVisibility.anchors) {
      Object.keys(filteredSavedColors).forEach((k) => {
        if (filteredSavedColors[k].type === "anchor")
          delete filteredSavedColors[k];
      });
      points = points.filter((p) => p.isPin);
      baseAnchors = baseAnchors.filter((p) => p.isPin);
    }
    if (filterTags.length > 0 || q) {
      points = points.filter((p) => {
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        if (filterTags.length > 0) {
          const tags = dictTags[nounId] || [];
          if (
            !filterTags.some((ft) =>
              tags.some((t) => t.toLowerCase().includes(ft)),
            )
          )
            return false;
        }
        if (q) {
          const qWords = q.split(/\s+/).filter(Boolean);
          const name = (names[nounId] || "").toLowerCase();
          const adj = (adjectives[p.lStr] || "").toLowerCase();
          const note = (dictNotes[nounId] || "").toLowerCase();
          const erp = p.erpCode.toLowerCase();
          if (
            !qWords.every(
              (w) =>
                name.includes(w) ||
                adj.includes(w) ||
                note.includes(w) ||
                erp.includes(w),
            )
          )
            return false;
        }
        return true;
      });
      Object.keys(filteredSavedColors).forEach((k) => {
        const sc = filteredSavedColors[k];
        const id = sc.type === "pin" ? sc.id : sc.anchorId;
        if (filterTags.length > 0) {
          const tags = dictTags[id] || [];
          if (
            !filterTags.some((ft) =>
              tags.some((t) => t.toLowerCase().includes(ft)),
            )
          ) {
            delete filteredSavedColors[k];
            return;
          }
        }
        if (q) {
          const qWords = q.split(/\s+/).filter(Boolean);
          const name = (
            sc.nameOverride ||
            names[sc.anchorId] ||
            ""
          ).toLowerCase();
          const adj = (
            sc.adjOverride ||
            adjectives[sc.adjId] ||
            ""
          ).toLowerCase();
          const note = (sc.notes || dictNotes[sc.anchorId] || "").toLowerCase();
          const erp = (sc.erpCode || "").toLowerCase();
          if (
            !qWords.every(
              (w) =>
                name.includes(w) ||
                adj.includes(w) ||
                note.includes(w) ||
                erp.includes(w),
            )
          ) {
            delete filteredSavedColors[k];
            return;
          }
        }
      });
      const activeColumns = new Set();
      points.forEach((p) => activeColumns.add(`${p.cStr}-${p.hStr}`));
      Object.values(filteredSavedColors).forEach((sc) => {
        if (sc.type === "anchor") {
          const parts = sc.anchorId.split("-");
          if (parts.length === 3) activeColumns.add(`${parts[1]}-${parts[2]}`);
        } else {
          const cStr = Math.round(sc.C * 100)
            .toString()
            .padStart(2, "0");
          const hStr = Math.round(sc.H).toString().padStart(3, "0");
          activeColumns.add(`${cStr}-${hStr}`);
        }
      });
      baseAnchors = baseAnchors.filter((ba) =>
        activeColumns.has(`${ba.cStr}-${ba.hStr}`),
      );
    }
    return { points, baseAnchors, savedColors: filteredSavedColors };
  }, [
    gridData,
    viewportVisibility,
    viewportTagFilter,
    viewportSearchQuery,
    savedColors,
    dictTags,
    names,
    adjectives,
    dictNotes,
  ]);
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);
  const handleUpdate = (pt, spectralData = null, commercialData = null) => {
    const L = Math.max(0, Math.min(1, pt[0]));
    const C = Math.max(0, Math.min(0.4, pt[1]));
    const rawH = pt[2] || 0;
    const H = isNaN(rawH) ? 0 : ((rawH % 360) + 360) % 360;
    setScrubL(L);
    setScrubC(C);
    setScrubH(H);
    setTemporarySpectral(spectralData);
    setScrubCommercial(commercialData);
  };
  const crosshair = useMemo(() => {
    if (!gridData) return null;
    const a = scrubC * Math.sin((scrubH * Math.PI) / 180);
    const b = scrubC * Math.cos((scrubH * Math.PI) / 180);
    let closestSaved = null,
      minSavedDist = Infinity,
      closestPin = null,
      minPinDist = Infinity;
    Object.values(savedColors).forEach((savedCol) => {
      const d = Math.sqrt(
        Math.pow(scrubL - savedCol.L, 2) +
          Math.pow(a - savedCol.a, 2) +
          Math.pow(b - savedCol.b, 2),
      );
      if (
        d < minSavedDist - 1e-9 ||
        (Math.abs(d - minSavedDist) <= 1e-9 &&
          savedCol.type === "pin" &&
          closestSaved?.type !== "pin")
      ) {
        minSavedDist = d;
        closestSaved = savedCol;
      }
      if (savedCol.type === "pin" && d < minPinDist) {
        minPinDist = d;
        closestPin = savedCol;
      }
    });
    let minGridDist = Infinity,
      gridTieBreakers = [];
    for (const pt of filteredViewData.points) {
      const d = Math.sqrt(
        Math.pow(scrubL - pt.L, 2) +
          Math.pow(a - pt.a, 2) +
          Math.pow(b - pt.b, 2),
      );
      const EPSILON = 1e-9;
      const allowedRadius = pt.isPin ? 0.002 : 0.02;
      if (d <= allowedRadius) {
        if (d < minGridDist - EPSILON) {
          minGridDist = d;
          gridTieBreakers = [pt];
        } else if (Math.abs(d - minGridDist) <= EPSILON) {
          gridTieBreakers.push(pt);
        }
      }
    }
    if (gridTieBreakers.length > 1) {
      gridTieBreakers.sort((p1, p2) => {
        if (Math.abs(p2.L - p1.L) > 1e-9) return p2.L - p1.L;
        if (Math.abs(p1.C - p2.C) > 1e-9) return p1.C - p2.C;
        return p1.H - p2.H;
      });
    }
    const closestGridPt = gridTieBreakers[0];
    const currentDelta = 0.02;
    const exactSavedColor =
      closestSaved && minSavedDist < 1e-4 ? closestSaved : null;
    let gravityL = scrubL,
      gravityC = scrubC,
      gravityH = scrubH;
    let gravityA = a,
      gravityB = b;
    let activePullType = null;
    let closestCustomColumn = null,
      minCustomColumnDist = Infinity;
    Object.values(savedColors).forEach((sc) => {
      if (sc.type === "nounColumn" && scrubL >= sc.minL && scrubL <= sc.maxL) {
        const d = Math.sqrt(Math.pow(a - sc.a, 2) + Math.pow(b - sc.b, 2));
        if (d < minCustomColumnDist) {
          minCustomColumnDist = d;
          closestCustomColumn = sc;
        }
      }
    });
    if (
      minCustomColumnDist <= 0.02 &&
      closestCustomColumn &&
      minCustomColumnDist < minGridDist
    ) {
      gravityL = scrubL;
      gravityC = closestCustomColumn.C;
      gravityH = closestCustomColumn.H;
      gravityA = closestCustomColumn.a;
      gravityB = closestCustomColumn.b;
      activePullType = "anchor";
    } else if (minGridDist <= 0.02 && closestGridPt) {
      gravityL = closestGridPt.L;
      gravityC = closestGridPt.C;
      gravityH = closestGridPt.H;
      gravityA = closestGridPt.a;
      gravityB = closestGridPt.b;
      activePullType = "anchor";
    } else if (minPinDist <= 0.002 && closestPin) {
      gravityL = closestPin.L;
      gravityC = closestPin.C;
      gravityH = closestPin.H;
      gravityA =
        closestPin.a || closestPin.C * Math.sin((closestPin.H * Math.PI) / 180);
      gravityB =
        closestPin.b || closestPin.C * Math.cos((closestPin.H * Math.PI) / 180);
      activePullType = "pin";
    }
    const isGridSnapped = minGridDist <= 0.02 || minCustomColumnDist <= 0.02;
    let activeSavedColor = null;
    if (exactSavedColor && exactSavedColor.type === "pin") {
      activeSavedColor = exactSavedColor;
    } else if (
      activePullType === "anchor" &&
      minCustomColumnDist <= 0.02 &&
      minCustomColumnDist < minGridDist
    ) {
      activeSavedColor = closestCustomColumn;
    } else if (
      (isGridSnapped || activePullType === "anchor") &&
      closestGridPt
    ) {
      if (closestGridPt.isPin) {
        activeSavedColor = savedColors[closestGridPt.pinId];
      } else {
        const aId = `${closestGridPt.cStr}-${closestGridPt.hStr}`;
        const anchorLock = Object.values(savedColors).find(
          (sc) =>
            sc.type === "anchor" &&
            sc.anchorId === aId &&
            sc.adjId === closestGridPt.lStr,
        );
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
      let min2d = Infinity,
        bestAnchor = null;
      if (filteredViewData.baseAnchors) {
        for (const ba of filteredViewData.baseAnchors) {
          const dist =
            Math.pow(effectiveA - ba.a, 2) + Math.pow(effectiveB - ba.b, 2);
          const minL = ba.minL !== void 0 ? ba.minL : -0.01;
          const maxL = ba.maxL !== void 0 ? ba.maxL : 1.01;
          const inRange =
            effectiveL >= minL - 0.001 && effectiveL <= maxL + 0.001;
          if (dist < min2d && inRange) {
            min2d = dist;
            bestAnchor = ba;
          }
        }
      }
      Object.values(savedColors)
        .filter((sc) => sc.type === "nounColumn")
        .forEach((cc) => {
          const dist =
            Math.pow(effectiveA - cc.a, 2) + Math.pow(effectiveB - cc.b, 2);
          if (dist <= min2d && effectiveL >= cc.minL && effectiveL <= cc.maxL) {
            min2d = dist;
            bestAnchor = cc;
          }
        });
      if (bestAnchor) {
        if (bestAnchor.type === "nounColumn") {
          nearestAnchorId = bestAnchor.id;
        } else if (bestAnchor.isCustomAnchor) {
          nearestAnchorId = `custom-${bestAnchor.cStr}-${bestAnchor.hStr}-${getLStr(effectiveL)}`;
        } else {
          nearestAnchorId =
            bestAnchor.parentNounId || `${bestAnchor.cStr}-${bestAnchor.hStr}`;
        }
      } else {
        nearestAnchorId = "";
      }
    }
    const exactErpCode = getExactErpCode(scrubL, scrubC, scrubH);
    const activeErpCode = exactErpCode;
    return {
      rawL: scrubL,
      rawC: scrubC,
      rawH: scrubH,
      a,
      b,
      gravityL,
      gravityC,
      gravityH,
      gravityA,
      gravityB,
      activePullType,
      activeSavedColor,
      exactSavedColor,
      isGridSnapped,
      closestGridPt,
      activeErpCode,
      nearestAdjId,
      nearestAnchorId,
      snapDist: minGridDist,
      snapTarget: closestGridPt,
      temporarySpectral,
      activeCommercial: scrubCommercial,
    };
  }, [
    gridData,
    filteredViewData.points,
    filteredViewData.baseAnchors,
    scrubL,
    scrubC,
    scrubH,
    savedColors,
    temporarySpectral,
  ]);
  const filterPt = useCallback(
    (p) => {
      const lDiff = Math.abs(p.L - scrubL);
      const cDiff = Math.abs(p.C - scrubC);
      let hDiff = Math.abs(p.H - scrubH);
      hDiff = Math.min(hDiff, 360 - hDiff);
      return lDiff <= filterL && cDiff <= filterC && hDiff <= filterH;
    },
    [scrubL, scrubC, scrubH, filterL, filterC, filterH],
  );
  const handlePointClick = (pt, spectralData = null, commercialData = null) => {
    const coords = Array.isArray(pt) ? pt.slice(0, 3) : pt;
    let explicitCommercial = commercialData;
    let explicitPinId = null;
    let explicitAnchorId = null;
    if (Array.isArray(pt) && pt.length > 3) {
      const extra = pt[3];
      if (extra && typeof extra === "object") {
        if (extra.brand !== void 0) explicitCommercial = extra;
        if (extra.pinId) explicitPinId = extra.pinId;
        if (extra.anchorId) explicitAnchorId = extra.anchorId;
      }
    }
    handleUpdate(coords, spectralData, explicitCommercial);
    if (!crosshair) return;
    if (tetheringPinId) {
      const targetCommercial = explicitCommercial;
      if (targetCommercial) {
        setSavedColors((prev) => ({
          ...prev,
          [tetheringPinId]: {
            ...prev[tetheringPinId],
            parentPinId: null,
            anchorId: `commercial-${targetCommercial.brand}-${targetCommercial.originalIndex}`,
          },
        }));
        setTetheringPinId(null);
        return;
      }
      if (explicitPinId && explicitPinId !== tetheringPinId) {
        setSavedColors((prev) => ({
          ...prev,
          [tetheringPinId]: {
            ...prev[tetheringPinId],
            parentPinId: explicitPinId,
            anchorId: savedColors[explicitPinId]?.anchorId || null,
          },
        }));
        setTetheringPinId(null);
        return;
      }
      if (explicitAnchorId) {
        setSavedColors((prev) => ({
          ...prev,
          [tetheringPinId]: {
            ...prev[tetheringPinId],
            parentPinId: null,
            anchorId: explicitAnchorId,
          },
        }));
        setTetheringPinId(null);
        return;
      }
      const {
        exactSavedColor,
        isGridSnapped,
        closestGridPt,
        nearestAdjId,
        nearestAnchorId,
      } = crosshair;
      let clickedItem = null;
      if (exactSavedColor && exactSavedColor.type === "pin") {
        clickedItem = exactSavedColor;
      } else if (isGridSnapped && closestGridPt) {
        if (closestGridPt.isPin) {
          clickedItem = savedColors[closestGridPt.pinId];
        } else {
          clickedItem = {
            type: "anchor",
            anchorId: nearestAnchorId,
            adjId: nearestAdjId,
            erpCode: closestGridPt.erpCode,
          };
        }
      }
      if (clickedItem && clickedItem.id !== tetheringPinId) {
        setSavedColors((prev) => ({
          ...prev,
          [tetheringPinId]: {
            ...prev[tetheringPinId],
            parentPinId: clickedItem.type === "pin" ? clickedItem.id : null,
            anchorId: clickedItem.anchorId || clickedItem.id,
            adjId: clickedItem.adjId,
          },
        }));
        setTetheringPinId(null);
        return;
      }
    }
  };
  const handleVisualize = (type, id, displayName) => {
    let items = [];
    if (type === "adjective") {
      items = filteredViewData.points
        .filter((p) => p.lStr === id)
        .map((p) => {
          const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
          return {
            ...p,
            displayName:
              `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
              (p.erpCode ? `#${p.erpCode}` : "\u2014"),
            erpCode: p.erpCode,
          };
        });
    } else if (type === "noun") {
      const sc = savedColors[id];
      if (sc && sc.type === "nounColumn") {
        items = filteredViewData.points
          .filter((p) => {
            return (
              p.parentNounId === sc.id ||
              (Math.abs(p.C - sc.C) < 0.01 &&
                Math.abs(p.H - sc.H) < 0.01 &&
                p.L >= sc.minL &&
                p.L <= sc.maxL &&
                !p.isPin)
            );
          })
          .map((p) => {
            return {
              ...p,
              displayName:
                `${adjectives[p.lStr] || ""} ${names[id] || sc.nameOverride || ""}`.trim() ||
                (p.erpCode ? `#${p.erpCode}` : "\u2014"),
              erpCode: p.erpCode,
            };
          });
      } else {
        items = filteredViewData.points
          .filter((p) => {
            const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
            return nounId === id;
          })
          .map((p) => {
            const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
            return {
              ...p,
              displayName:
                `${adjectives[p.lStr] || ""} ${names[nounId] || ""}`.trim() ||
                (p.erpCode ? `#${p.erpCode}` : "\u2014"),
              erpCode: p.erpCode,
            };
          });
      }
    }
    setVisualizeData({ title: `Visualizing ${displayName}`, items });
  };
  const tabs = useMemo(
    () => [
      { id: "db", label: "Commercial DB" },
      { id: "top", label: "Light Layers" },
      { id: "chroma", label: "CHROMA RINGS" },
      { id: "slice", label: "HUE SLICES" },
      { id: "3d", label: "3D VIEW" },
      { id: "groups", label: "Color Groups" },
      { id: "adjectives", label: "Adjectives" },
      { id: "palette", label: "Nouns" },
      { id: "pins", label: "Pins" },
    ],
    [],
  );
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !gridData) return [];
    const q = searchQuery.toLowerCase().trim();
    const results = [];
    const seenCodes = new Set();
    Object.values(savedColors).forEach((sc) => {
      const adj = (
        sc.type === "nounColumn"
          ? `L ${sc.minL} - ${sc.maxL}`
          : sc.adjOverride || adjectives[sc.adjId] || ""
      ).toLowerCase();
      const name = (
        sc.type === "nounColumn"
          ? names[sc.id] || sc.nameOverride || ""
          : sc.nameOverride || names[sc.anchorId] || ""
      ).toLowerCase();
      const fullName = `${adj} ${name}`.trim();
      const note = (
        sc.notes ||
        (sc.type === "nounColumn"
          ? dictNotes[sc.id]
          : dictNotes[sc.anchorId]) ||
        ""
      ).toLowerCase();
      const code = (sc.erpCode || "").toLowerCase();
      const tagsStr = (dictTags[sc.id] || dictTags[sc.anchorId] || [])
        .join(" ")
        .toLowerCase();
      const qWords = q.split(/\s+/).filter(Boolean);
      const isMatch =
        qWords.length === 0 ||
        qWords.every(
          (w) =>
            adj.includes(w) ||
            name.includes(w) ||
            fullName.includes(w) ||
            note.includes(w) ||
            code.includes(w) ||
            tagsStr.includes(w),
        );
      if (isMatch) {
        let dn = "Unnamed";
        if (sc.type === "nounColumn") {
          dn = `[Grid Area] ${names[sc.id] || sc.nameOverride || "Unnamed Column"}`;
        } else {
          dn =
            `${sc.adjOverride || adjectives[sc.adjId] || ""} ${sc.nameOverride || names[sc.anchorId] || ""}`.trim() ||
            "Unnamed";
        }
        const t =
          sc.type === "pin"
            ? "Pin"
            : sc.type === "nounColumn"
              ? "Noun Column"
              : "Locked Anchor";
        const n =
          sc.type === "nounColumn"
            ? sc.notes || dictNotes[sc.id] || ""
            : sc.notes || dictNotes[sc.anchorId] || "";
        const realL = sc.type === "nounColumn" ? (sc.minL + sc.maxL) / 2 : sc.L;
        const cFallback = new Color("oklch", [realL, sc.C || 0, sc.H || 0])
          .toGamut({ space: "srgb" })
          .toString({ format: "hex" });
        results.push({
          key: `saved-${sc.id}`,
          L: realL,
          C: sc.C,
          H: sc.H,
          color: sc.color || cFallback,
          displayName: dn,
          erpCode: sc.erpCode,
          type: t,
          note: n,
        });
        if (sc.erpCode) seenCodes.add(sc.erpCode);
      }
    });
    for (const pt of filteredViewData.points) {
      if (results.length >= 100) break;
      if (seenCodes.has(pt.erpCode)) continue;
      const nounId = pt.parentNounId || `${pt.cStr}-${pt.hStr}`;
      const adjStr = (adjectives[pt.lStr] || "").toLowerCase();
      const nameStr = (names[nounId] || "").toLowerCase();
      const fullNameStr = `${adjStr} ${nameStr}`.trim();
      const noteStr = (dictNotes[nounId] || "").toLowerCase();
      const codeStr = pt.erpCode.toLowerCase();
      const tagsStr = (dictTags[nounId] || []).join(" ").toLowerCase();
      const qWords = q.split(/\s+/).filter(Boolean);
      const hasDictMatch =
        qWords.length === 0 ||
        qWords.every(
          (w) =>
            (adjStr && adjStr.includes(w)) ||
            (nameStr && nameStr.includes(w)) ||
            (fullNameStr && fullNameStr.includes(w)) ||
            (noteStr && noteStr.includes(w)) ||
            (tagsStr && tagsStr.includes(w)),
        );
      const isCodeSearch = q.length >= 2 && !isNaN(q) && codeStr.includes(q);
      if (hasDictMatch || isCodeSearch) {
        const validPtColor = new Color("oklch", [pt.L, pt.C, pt.H])
          .toGamut({ space: "srgb" })
          .toString({ format: "hex" });
        results.push({
          key: `pt-${pt.erpCode}`,
          L: pt.L,
          C: pt.C,
          H: pt.H,
          color: validPtColor,
          displayName:
            `${adjectives[pt.lStr] || ""} ${names[nounId] || ""}`.trim() ||
            "Unnamed",
          erpCode: pt.erpCode,
          type: "Coordinate",
          note: dictNotes[nounId] || "",
        });
        seenCodes.add(pt.erpCode);
      }
    }
    for (const [adjId, adjName] of Object.entries(adjectives)) {
      if (results.length >= 100) break;
      const adjStr = (adjName || "").toLowerCase();
      const idStr = adjId.toLowerCase();
      const qWords = q.split(/\s+/).filter(Boolean);
      if (
        qWords.length === 0 ||
        qWords.every((w) => adjStr.includes(w) || idStr.includes(w))
      ) {
        let alreadyAdded = false;
        for (const r of results) {
          if (r.key === `adj-${adjId}`) {
            alreadyAdded = true;
            break;
          }
        }
        if (!alreadyAdded) {
          let lVal = 0.5;
          if (adjId.includes("-"))
            lVal = parseFloat(adjId.split("-")[1]) || 0.5;
          else if (!isNaN(parseFloat(adjId))) lVal = parseFloat(adjId) / 100;
          results.push({
            key: `adj-${adjId}`,
            L: lVal,
            C: 0,
            H: 0,
            color: new Color("oklch", [lVal, 0, 0])
              .toGamut({ space: "srgb" })
              .toString({ format: "hex" }),
            displayName: `${adjName} [Adjective]`.trim(),
            erpCode: "",
            type: "Adjective Definition",
            note: "",
          });
        }
      }
    }
    for (const [nId, nName] of Object.entries(names)) {
      if (results.length >= 200) break;
      const nameStr = (nName || "").toLowerCase();
      const idStr = nId.toLowerCase();
      const noteStr = (dictNotes[nId] || "").toLowerCase();
      const tagsStr = (dictTags[nId] || []).join(" ").toLowerCase();
      let cVal = 0.1,
        hVal = 180,
        baseL = 0.5;
      let sc = savedColors[nId];
      if (sc) {
        cVal = sc.C;
        hVal = sc.H;
        baseL = sc.type === "nounColumn" ? (sc.minL + sc.maxL) / 2 : sc.L;
      } else {
        const parts = nId.split("-");
        if (parts.length >= 3) {
          const rawC = parts[parts.length - 2].replace("C", "");
          const rawH = parts[parts.length - 1].replace("H", "");
          cVal = parseFloat(rawC) / 100;
          hVal = parseFloat(rawH);
          if (parts[0] === "UL") baseL = 0.96;
          else if (parts[0] === "L") baseL = 0.65;
          else if (parts[0] === "D") baseL = 0.35;
          else if (parts[0] === "UD") baseL = 0.15;
          else if (parts[0] === "ALL" || cVal === 0) {
            cVal = 0;
            hVal = 0;
          }
          if (isNaN(cVal)) cVal = 0.1;
          if (isNaN(hVal)) hVal = 180;
        }
      }
      let matchedCombo = false;
      for (const [adjId, adjName] of Object.entries(adjectives)) {
        if (results.length >= 200) break;
        const comboName = `${adjName} ${nName}`.trim().toLowerCase();
        const qWords2 = q.split(/\s+/).filter(Boolean);
        if (
          qWords2.length === 0 ||
          qWords2.every((w) => comboName.includes(w))
        ) {
          matchedCombo = true;
          let lVal = baseL;
          if (adjId.includes("-"))
            lVal = parseFloat(adjId.split("-")[1]) || baseL;
          else if (!isNaN(parseFloat(adjId))) lVal = parseFloat(adjId) / 100;
          if (sc) {
            if (sc.type !== "nounColumn") continue;
            if (lVal < sc.minL - 0.001 || lVal > sc.maxL + 0.001) continue;
          }
          const inferredC = new Color("oklch", [lVal, cVal, hVal]);
          if (cVal > 0 && !inferredC.inGamut("srgb", { epsilon: 0.01 }))
            continue;
          const validColor = inferredC
            .clone()
            .toGamut({ space: "srgb" })
            .toString({ format: "hex" });
          results.push({
            key: `combo-${adjId}-${nId}`,
            L: lVal,
            C: cVal,
            H: hVal,
            color: validColor,
            displayName: `${adjName} ${nName}`.trim(),
            erpCode: `NOUN-C${Math.round(cVal * 100)
              .toString()
              .padStart(
                2,
                "0",
              )}-H${Math.round(hVal).toString().padStart(3, "0")}`,
            type: "Coordinate",
            note: dictNotes[nId] || "",
          });
        }
      }
      const qWords = q.split(/\s+/).filter(Boolean);
      const nounMatch =
        qWords.length === 0 ||
        qWords.every(
          (w) =>
            nameStr.includes(w) ||
            idStr.includes(w) ||
            noteStr.includes(w) ||
            tagsStr.includes(w),
        );
      if (nounMatch) {
        let sc2 = savedColors[nId];
        let alreadyAdded = false;
        for (const r of results) {
          if (r.key === `noun-${nId}` || (sc2 && r.key === `saved-${sc2.id}`)) {
            alreadyAdded = true;
            break;
          }
        }
        if (!alreadyAdded && !sc2) {
          const inferredC = new Color("oklch", [baseL, cVal, hVal]);
          const validColor = inferredC
            .clone()
            .toGamut({ space: "srgb" })
            .toString({ format: "hex" });
          results.push({
            key: `noun-${nId}`,
            L: baseL,
            C: cVal,
            H: hVal,
            color: validColor,
            displayName: nName.trim() || nId,
            erpCode: "",
            type: "Noun Definition",
            note: dictNotes[nId] || "",
          });
        }
      }
    }
    if (colorData) {
      for (const [brandKey, list] of Object.entries(colorData)) {
        if (results.length >= 200) break;
        if (!list || !Array.isArray(list)) continue;
        const brandName = getBrandDisplayName(brandKey);
        for (let listIdx = 0; listIdx < list.length; listIdx++) {
          const item = list[listIdx];
          if (results.length >= 200) break;
          const safeName = item.name || `unknown-${listIdx}`;
          const idUrl = item.url || safeName.replace(/\s+/g, "-");
          const customId = `brand-${brandKey}-${idUrl}`;
          const customName = names[customId] || "";
          const customNote = dictNotes[customId] || "";
          const qWords = q.split(/\s+/).filter(Boolean);
          const allWordsMatch =
            qWords.length === 0 ||
            qWords.every((w) => {
              const matchesName =
                item.name && item.name.toLowerCase().includes(w);
              const matchesCustomName = customName.toLowerCase().includes(w);
              const matchesBrand = brandName.toLowerCase().includes(w);
              const itemTags = (item.tags || []).join(" ").toLowerCase();
              const matchesNote =
                (item.image && item.image.toLowerCase().includes(w)) ||
                customNote.toLowerCase().includes(w) ||
                itemTags.includes(w) ||
                (item.url && item.url.toLowerCase().includes(w));
              const matchesHex = (item.hex || "").toLowerCase().includes(w);
              return (
                matchesName ||
                matchesCustomName ||
                matchesBrand ||
                matchesNote ||
                matchesHex
              );
            });
          if (allWordsMatch) {
            try {
              let l = 0.5,
                cVal = 0,
                h = 0;
              let c;
              if (item.spectral && item.spectral.length === 31) {
                const xyzStandard = calculateXYZFromSpectral(
                  item.spectral,
                  2,
                  "D65",
                );
                c = new Color("xyz-d65", xyzStandard).to("oklch");
              } else {
                c = new Color(item.hex).to("oklch");
              }
              l = c.coords[0];
              cVal = c.coords[1];
              h = isNaN(c.coords[2]) ? 0 : c.coords[2];
              results.push({
                key: `${customId}-${listIdx}`,
                commercial: { brand: brandKey, originalIndex: listIdx },
                L: l,
                C: cVal,
                H: h,
                color: item.hex || "#000000",
                image: item.image || null,
                displayName: customName || item.name,
                erpCode: brandKey === "REFERENCE" ? "REF" : brandKey,
                type: "Commercial Item",
                note:
                  customNote ||
                  (item.spectral && item.spectral.length > 0
                    ? "Verified Spectral Data"
                    : ""),
              });
            } catch (e) {}
          }
        }
      }
    }
    return results;
  }, [
    searchQuery,
    gridData,
    names,
    adjectives,
    dictNotes,
    savedColors,
    dictTags,
    colorData,
  ]);
  if (!gridData || !crosshair)
    return React.createElement(
      "div",
      {
        className:
          "min-h-screen flex items-center justify-center font-mono text-xs uppercase tracking-widest text-slate-400",
      },
      "Initializing Studio...",
    );
  const toggleAnchorLock = () => {
    if (!crosshair) return;
    const anchorId = crosshair.nearestAnchorId;
    const adjId = crosshair.nearestAdjId;
    const existingAnchorLock = Object.values(savedColors).find(
      (sc) =>
        sc.type === "anchor" && sc.anchorId === anchorId && sc.adjId === adjId,
    );
    if (existingAnchorLock) {
      if (existingAnchorLock.isCustomAnchor) {
        setSavedColors((prev) => {
          const next = { ...prev };
          next[existingAnchorLock.id] = {
            ...next[existingAnchorLock.id],
            locked: existingAnchorLock.locked === false ? true : false,
          };
          return next;
        });
      } else {
        setSavedColors((prev) => {
          const next = { ...prev };
          delete next[existingAnchorLock.id];
          return next;
        });
      }
    } else {
      const newId = `${anchorId}-${adjId}`;
      let ptToLock = crosshair.closestGridPt;
      if (ptToLock && ptToLock.isPin) {
        const cStr = anchorId.split("-")[1];
        const hStr = anchorId.split("-")[2];
        ptToLock =
          filteredViewData.points.find(
            (p) => p.lStr === adjId && p.cStr === cStr && p.hStr === hStr,
          ) || ptToLock;
      }
      if (ptToLock) {
        setSavedColors((prev) => ({
          ...prev,
          [newId]: {
            id: newId,
            type: "anchor",
            L: ptToLock.L,
            C: ptToLock.C,
            H: ptToLock.H,
            a: ptToLock.a,
            b: ptToLock.b,
            erpCode: ptToLock.erpCode,
            adjId,
            anchorId,
            nameOverride: "",
            adjOverride: "",
            notes: "",
            color: ptToLock.color,
          },
        }));
      }
    }
  };
  const togglePin = () => {
    if (!crosshair) return;
    if (crosshair.exactSavedColor?.type === "pin") {
      setSavedColors((prev) => {
        const next = { ...prev };
        delete next[crosshair.exactSavedColor.id];
        return next;
      });
    } else {
      const newId = crypto.randomUUID();
      setSavedColors((prev) => ({
        ...prev,
        [newId]: {
          id: newId,
          type: "pin",
          L: scrubL,
          C: scrubC,
          H: scrubH,
          a: crosshair.a,
          b: crosshair.b,
          erpCode: getExactErpCode(scrubL, scrubC, scrubH),
          adjId: crosshair.nearestAdjId,
          anchorId: crosshair.nearestAnchorId,
          parentPinId: crosshair.closestGridPt?.isPin
            ? crosshair.closestGridPt.pinId
            : null,
          nameOverride: "",
          adjOverride: "",
          notes: "",
          color: new Color("oklch", [scrubL, scrubC, scrubH])
            .clone()
            .toGamut({ space: "srgb" })
            .toString({ format: "hex" }),
          spectral: crosshair.temporarySpectral,
        },
      }));
    }
  };
  const updateSavedColor = (field, val) => {
    if (!crosshair?.activeSavedColor) return;
    setSavedColors((prev) => ({
      ...prev,
      [crosshair.activeSavedColor.id]: {
        ...prev[crosshair.activeSavedColor.id],
        [field]: val,
      },
    }));
  };
  const onAdjChange = (val) => {
    if (crosshair?.activeSavedColor?.type === "pin")
      updateSavedColor("adjOverride", val);
    else {
      setAdjectives({ ...adjectives, [crosshair?.nearestAdjId]: val });
      if (
        crosshair?.nearestAnchorId &&
        savedColors[crosshair.nearestAnchorId] &&
        savedColors[crosshair.nearestAnchorId].type === "anchor"
      ) {
        setSavedColors((prev) => ({
          ...prev,
          [crosshair.nearestAnchorId]: {
            ...prev[crosshair.nearestAnchorId],
            adjOverride: val,
          },
        }));
      }
    }
  };
  const onNameChange = (val) => {
    if (crosshair?.activeSavedColor?.type === "pin") {
      updateSavedColor("nameOverride", val);
    } else if (crosshair?.nearestAnchorId) {
      const id = crosshair.nearestAnchorId;
      setNames({ ...names, [id]: val });
      if (
        savedColors[id] &&
        (savedColors[id].type === "nounColumn" ||
          savedColors[id].type === "anchor")
      ) {
        setSavedColors((prev) => ({
          ...prev,
          [id]: { ...prev[id], nameOverride: val },
        }));
      }
      if (val && !savedColors[id] && !id.startsWith("custom-")) {
        let minL = 0,
          maxL = 1;
        if (id.startsWith("UL")) {
          minL = 0.95;
          maxL = 1;
        } else if (id.startsWith("L")) {
          minL = 0.5;
          maxL = 0.95;
        } else if (id.startsWith("D")) {
          minL = 0.2;
          maxL = 0.5;
        } else if (id.startsWith("UD")) {
          minL = 0;
          maxL = 0.2;
        }
        setSavedColors((prev) => ({
          ...prev,
          [id]: {
            id,
            type: "nounColumn",
            nameOverride: val,
            C: crosshair.gravityC,
            H: crosshair.gravityH,
            minL,
            maxL,
            a: crosshair.gravityA,
            b: crosshair.gravityB,
            notes: dictNotes[id] || "",
          },
        }));
      }
    }
  };
  const onNotesChange = (val) => {
    if (crosshair?.activeSavedColor?.type === "pin")
      updateSavedColor("notes", val);
    else {
      setDictNotes({ ...dictNotes, [crosshair?.nearestAnchorId]: val });
      const id = crosshair?.nearestAnchorId;
      if (
        id &&
        savedColors[id] &&
        (savedColors[id].type === "nounColumn" ||
          savedColors[id].type === "anchor")
      ) {
        setSavedColors((prev) => ({
          ...prev,
          [id]: { ...prev[id], notes: val },
        }));
      }
    }
  };
  const handleSaveApp = async () => {
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const filename = `The ColorSAMIficator ${ts}.html`;
      const stateData = {
        names,
        adjectives,
        dictNotes,
        dictTags,
        savedColors,
        palette,
        savedPalettes,
        groupSettings,
        observer,
        illuminant,
        linkedFiles,
      };
      let appCode = "";
      let styleCode = "";
      const inlineScript = document.querySelector(
        'script[type="text/babel"]:not([src])',
      );
      if (
        inlineScript &&
        inlineScript.textContent &&
        inlineScript.textContent.trim().length > 100
      ) {
        appCode = inlineScript.textContent;
      } else {
        try {
          let r2 = await fetch("App.jsx");
          if (!r2.ok) r2 = await fetch("app.js");
          if (r2.ok) appCode = await r2.text();
          else throw new Error("Cannot locate app code");
        } catch (e2) {
          throw new Error("Export failed: " + e2.message);
        }
        try {
          const rs = await fetch("styles.css");
          if (rs.ok) styleCode = await rs.text();
        } catch (e2) {
          console.warn("Could not fetch styles.css");
        }
      }
      const clone = document.documentElement.cloneNode(true);
      const root = clone.querySelector("#root");
      if (root) root.innerHTML = "";
      const oldState = clone.querySelector("#color-samificator-state");
      if (oldState) oldState.remove();
      const oldConfig = clone.querySelector("#color-samificator-config");
      if (oldConfig) oldConfig.remove();
      clone.querySelectorAll("script").forEach((el) => {
        if (el.type === "text/babel") {
          el.remove();
          return;
        }
        if (el.src && el.src.includes("@babel/standalone")) {
          el.remove();
          return;
        }
        if (
          !el.src &&
          !el.textContent.includes("tailwind.config") &&
          el.id !== "color-samificator-state" &&
          el.id !== "color-samificator-data"
        ) {
          el.remove();
        }
      });
      const stateScript = document.createElement("script");
      stateScript.id = "color-samificator-state";
      stateScript.type = "application/json";
      stateScript.textContent = JSON.stringify(stateData).replace(
        /<\/script>/gi,
        "<\\/script>",
      );
      clone.querySelector("head").appendChild(stateScript);
      const appScript = document.createElement("script");
      appScript.type = "text/javascript";
      appScript.textContent = appCode.replace(/<\/script>/gi, "<\\/script>");
      clone.querySelector("body").appendChild(appScript);
      if (styleCode) {
        const styleNode = document.createElement("style");
        styleNode.textContent = styleCode;
        clone.querySelector("head").appendChild(styleNode);
        const linkNode = clone.querySelector('link[href*="styles.css"]');
        if (linkNode) linkNode.remove();
      }
      const htmlContent = "<!DOCTYPE html>\n" + clone.outerHTML;
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (window.self !== window.top) {
        alert(
          "Export completed. If your download did not start, it may be blocked by your browser's preview mode. Try opening the app in a new tab to download.",
        );
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + err.message);
    }
  };
  const handleSystemExport = async () => {
    if (!gridData) {
      alert("Missing gridData!");
      return;
    }
    try {
      const anchorsCsv = [];
      const pinsCsv = [];
      Object.keys(names).forEach((id) => {
        const name = names[id];
        if (!name) return;
        const nc = savedColors[id];
        if (nc && nc.type === "nounColumn") {
          anchorsCsv.push({
            Type: "NOUN",
            Noun: name,
            Note: dictNotes[id] || "",
            Tags: (dictTags[id] || []).join(","),
            OKLCH_L: `${nc.minL}-${nc.maxL}`,
            OKLCH_C: nc.C,
            OKLCH_H: nc.H,
          });
        }
      });
      Object.keys(adjectives).forEach((adjId) => {
        anchorsCsv.push({
          Type: "ADJECTIVE",
          Adjective: adjectives[adjId] || "",
          OKLCH_L: adjId,
        });
      });
      Object.values(savedColors)
        .filter((sc) => sc.type === "pin")
        .forEach((sc) => {
          pinsCsv.push({
            Type: "PIN",
            Noun: sc.nameOverride || "",
            Adjective: sc.adjOverride || "",
            Note: sc.notes || "",
            Tags: (dictTags[sc.id] || []).join(","),
            OKLCH_L: sc.L,
            OKLCH_C: sc.C,
            OKLCH_H: sc.H,
            ERP_Code: sc.erpCode,
            Spectral: sc.spectral ? JSON.stringify(sc.spectral) : "",
            Illuminant: sc.illuminant || "",
            Observer: sc.observer || "",
            Measurement_Method: sc.measurementMethod || "",
            Measurement_Date: sc.measurementDate || "",
            Measurement_Device: sc.measurementDevice || "",
          });
        });
      if (groupSettings) {
        anchorsCsv.push({
          Type: "SETTING",
          Noun: "lightL",
          OKLCH_L: groupSettings.lightL,
        });
        anchorsCsv.push({
          Type: "SETTING",
          Noun: "neutralC",
          OKLCH_C: groupSettings.neutralC,
        });
        anchorsCsv.push({
          Type: "SETTING",
          Noun: "vividC",
          OKLCH_C: groupSettings.vividC,
        });
        (groupSettings.neutrals || []).forEach((n) =>
          anchorsCsv.push({
            Type: "NEUTRAL_REGION",
            Adjective: n.id,
            Noun: n.name,
            OKLCH_L: n.maxL,
          }),
        );
        (groupSettings.hues || []).forEach((h) =>
          anchorsCsv.push({
            Type: "HUE_REGION",
            Adjective: h.id,
            Noun: h.name,
            OKLCH_H: h.maxH,
          }),
        );
        (groupSettings.overrides || []).forEach((o) =>
          anchorsCsv.push({
            Type: "OVERRIDE",
            Adjective: o.condition,
            Noun: o.name,
            Tags: o.id,
          }),
        );
      }
      (savedPalettes || []).forEach((p) => {
        anchorsCsv.push({
          Type: "PALETTE",
          Noun: p.name,
          Note: JSON.stringify(p.colors),
          Tags: p.id,
        });
      });
      const makeExportRow = (data) =>
        Object.assign(
          {
            Type: "",
            Noun: "",
            Adjective: "",
            Note: "",
            Tags: "",
            Locked: "",
            HEX: "",
            OKLCH_L: "",
            OKLCH_C: "",
            OKLCH_H: "",
            ERP_Code: "",
            Spectral: "",
            Illuminant: "",
            Observer: "",
            Measurement_Method: "",
            Measurement_Date: "",
            Measurement_Device: "",
          },
          data,
        );
      const zip = new JSZip();
      zip.file("anchors.csv", Papa.unparse(anchorsCsv.map(makeExportRow)));
      zip.file("pins.csv", Papa.unparse(pinsCsv.map(makeExportRow)));
      Object.keys(colorData || {}).forEach((brand) => {
        const brandData = colorData[brand].map((color, listIdx) => {
          const safeName = color.name || `unknown-${listIdx}`;
          const idUrl = color.url || safeName.replace(/\s+/g, "-");
          const customId = `brand-${brand}-${idUrl}`;
          const customName =
            names[customId] !== void 0 ? names[customId] : color.name;
          const customNote =
            dictNotes[customId] !== void 0 ? dictNotes[customId] : color.image;
          const row = {
            Type: "DB",
            Adjective: brand,
            Noun: customName || "",
            HEX: color.hex || "",
            OKLCH_L: color.L !== void 0 ? color.L : "",
            OKLCH_C: color.C !== void 0 ? color.C : "",
            OKLCH_H: color.H !== void 0 ? color.H : "",
            ERP_Code: color.url || "",
            Note: customNote || "",
            Tags: (color.tags || dictTags[customId] || []).join(","),
            Illuminant: color.illuminant || "",
            Observer: color.observer || "",
            Measurement_Method: color.measurementMethod || "",
            Measurement_Date: color.measurementDate || "",
            Measurement_Device: color.measurementDevice || "",
          };
          if (SPECTRAL_TABLES) {
            SPECTRAL_TABLES.wavelengths.forEach((w, i) => {
              row[`R${w} nm`] =
                color.spectral &&
                Array.isArray(color.spectral) &&
                color.spectral[i] !== void 0
                  ? color.spectral[i].toExponential(8)
                  : "";
            });
          }
          row.Spectral = color.spectral ? JSON.stringify(color.spectral) : "";
          return row;
        });
        zip.file(`${brand}.csv`, Papa.unparse(brandData));
      });
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "color_samificator_csvs.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (window.self !== window.top) {
        alert(
          "Export completed. If your download did not start, it may be blocked by your browser's preview mode. Try opening the app in a new tab to download.",
        );
      }
    } catch (e) {
      console.error(e);
      alert("Failed downloading CSVs: " + e.message);
    }
  };
  const handleSyncToCSV = async () => {};
  const handleSystemImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newNames = { ...names };
        const newAdjs = { ...adjectives };
        const newNotes = { ...dictNotes };
        const newSavedColors = { ...savedColors };
        const newTags = { ...dictTags };
        const newSavedPalettes = [...savedPalettes];
        const newColorData = colorData
          ? JSON.parse(JSON.stringify(colorData))
          : {};
        const parsedSettings = {
          lightL: groupSettings.lightL,
          neutralC: groupSettings.neutralC,
          vividC: groupSettings.vividC,
          neutrals: [],
          hues: [],
          overrides: [],
        };
        let hasImportedSettings = false,
          hasNeutrals = false,
          hasHues = false,
          hasOverrides = false,
          hasImportedPalettes = false;
        results.data.forEach((row) => {
          let targetType = String(row.Type || "")
            .toUpperCase()
            .trim();
          if (targetType === "SETTING") {
            hasImportedSettings = true;
            const prop = row.Noun || row.ID;
            if (prop === "lightL" && row.OKLCH_L)
              parsedSettings.lightL = parseFloat(row.OKLCH_L);
            if (prop === "neutralC" && row.OKLCH_C)
              parsedSettings.neutralC = parseFloat(row.OKLCH_C);
            if (prop === "vividC" && row.OKLCH_C)
              parsedSettings.vividC = parseFloat(row.OKLCH_C);
          } else if (targetType === "NEUTRAL_REGION") {
            hasImportedSettings = true;
            hasNeutrals = true;
            parsedSettings.neutrals.push({
              id: row.Adjective || row.ID || crypto.randomUUID(),
              name: row.Noun || "",
              maxL: parseFloat(row.OKLCH_L) || 0,
            });
          } else if (targetType === "HUE_REGION") {
            hasImportedSettings = true;
            hasHues = true;
            parsedSettings.hues.push({
              id: row.Adjective || row.ID || crypto.randomUUID(),
              name: row.Noun || "",
              maxH: parseFloat(row.OKLCH_H) || 0,
            });
          } else if (targetType === "OVERRIDE") {
            hasImportedSettings = true;
            hasOverrides = true;
            parsedSettings.overrides.push({
              id: row.Tags || row.ID || crypto.randomUUID(),
              condition: row.Adjective || "",
              name: row.Noun || "",
            });
          } else if (targetType === "PALETTE") {
            hasImportedPalettes = true;
            try {
              const colors = JSON.parse(row.Note || "[]");
              const paletteId = row.Tags || row.ID || crypto.randomUUID();
              const existingIdx = newSavedPalettes.findIndex(
                (p) => p.id === paletteId,
              );
              if (existingIdx >= 0) {
                newSavedPalettes[existingIdx] = {
                  id: paletteId,
                  name: row.Noun || "Imported Palette",
                  colors,
                };
              } else {
                newSavedPalettes.push({
                  id: paletteId,
                  name: row.Noun || "Imported Palette",
                  colors,
                });
              }
            } catch (e2) {}
          }
        });
        const importGridData = generateGridData(
          parsedSettings.lightL,
          parsedSettings.neutralC,
          parsedSettings.vividC,
          hasNeutrals ? parsedSettings.neutrals : groupSettings.neutrals,
          hasHues ? parsedSettings.hues : groupSettings.hues,
          hasOverrides ? parsedSettings.overrides : groupSettings.overrides,
        );
        results.data.forEach((row) => {
          let pL = null,
            pC = null,
            pH = null;
          let spectral2 = null;
          const spectralValues = SPECTRAL_TABLES.wavelengths.map((w) => {
            const val = row[`R${w} nm`];
            const parsed = parseFloat(val);
            return isNaN(parsed) ? null : parsed;
          });
          if (spectralValues.every((v) => v !== null)) {
            spectral2 = spectralValues;
            const xyzStandard = calculateXYZFromSpectral(spectral2, 2, "D65");
            const tc = new Color("xyz-d65", xyzStandard).to("oklch");
            pL = Math.max(0, Math.min(1, tc.coords[0]));
            pC = Math.max(0, Math.min(0.4, tc.coords[1]));
            pH = isNaN(tc.coords[2]) ? 0 : ((tc.coords[2] % 360) + 360) % 360;
          } else {
            try {
              let tc;
              if (row.OKLCH_L && row.OKLCH_C && row.OKLCH_H) {
                tc = new Color("oklch", [
                  parseFloat(row.OKLCH_L),
                  parseFloat(row.OKLCH_C),
                  parseFloat(row.OKLCH_H),
                ]);
              } else if (row.HEX) {
                let ch = String(row.HEX).trim();
                if (!ch.startsWith("#")) ch = "#" + ch;
                tc = new Color(ch);
              }
              if (tc) {
                const o = tc.to("oklch");
                pL = Math.max(0, Math.min(1, o.coords[0]));
                pC = Math.max(0, Math.min(0.4, o.coords[1]));
                pH = isNaN(o.coords[2]) ? 0 : ((o.coords[2] % 360) + 360) % 360;
              }
            } catch (err) {}
          }
          let targetType = String(row.Type || "")
            .toUpperCase()
            .trim();
          if (!targetType && pL !== null) targetType = "PIN";
          if (
            targetType === "DB" ||
            targetType === "BRAND" ||
            targetType === "SPECTRAL"
          ) {
            const brandRaw = (row.Adjective || row.Brand || "").trim();
            const name = (row.Noun || row.Name || "").trim() || "Unnamed";
            const url = (row.ERP_Code || row.URL || "").trim();
            const image = (row.Note || row.Image || "").trim();
            const finalBrand = normalizeBrandKey(brandRaw) || brandRaw;
            if (finalBrand) {
              const hex =
                row.HEX ||
                (pL !== null
                  ? new Color("oklch", [pL, pC, pH])
                      .clone()
                      .toGamut({ space: "srgb" })
                      .toString({ format: "hex" })
                  : "#B1BC83");
              if (!newColorData[finalBrand]) newColorData[finalBrand] = [];
              const existingIdx = newColorData[finalBrand].findIndex(
                (c) => c.name.toLowerCase() === name.toLowerCase(),
              );
              const colorObj = {
                name,
                hex,
                L: pL !== null ? pL : 0.5,
                C: pC !== null ? pC : 0,
                H: pH !== null ? pH : 0,
              };
              if (row.Tags)
                colorObj.tags =
                  typeof row.Tags === "string"
                    ? row.Tags.split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                    : Array.isArray(row.Tags)
                      ? row.Tags
                      : [];
              if (spectral2) colorObj.spectral = spectral2;
              if (url) colorObj.url = url;
              if (image) colorObj.image = image;
              if (row.Illuminant)
                colorObj.illuminant = String(row.Illuminant).trim();
              if (row.Observer)
                colorObj.observer = parseInt(row.Observer, 10) || void 0;
              if (row.Measurement_Method)
                colorObj.measurementMethod = String(
                  row.Measurement_Method,
                ).trim();
              if (row.Date) colorObj.measurementDate = String(row.Date).trim();
              else if (row.Measurement_Date)
                colorObj.measurementDate = String(row.Measurement_Date).trim();
              if (row.Device)
                colorObj.measurementDevice = String(row.Device).trim();
              else if (row.Measurement_Device)
                colorObj.measurementDevice = String(
                  row.Measurement_Device,
                ).trim();
              if (row.Method)
                colorObj.measurementMethod = String(row.Method).trim();
              if (existingIdx >= 0)
                newColorData[finalBrand][existingIdx] = {
                  ...newColorData[finalBrand][existingIdx],
                  ...colorObj,
                };
              else newColorData[finalBrand].push(colorObj);
            }
          } else if (targetType === "PIN" && pL !== null) {
            const pinId = row.ID || crypto.randomUUID();
            const a = pC * Math.sin((pH * Math.PI) / 180);
            const b = pC * Math.cos((pH * Math.PI) / 180);
            const cStr = Math.round(pC * 100)
              .toString()
              .padStart(2, "0");
            const hStr = Math.round(pH).toString().padStart(3, "0");
            const anchorId = `${cStr}-${hStr}`;
            const adjId = getLStr(pL);
            newSavedColors[pinId] = {
              id: pinId,
              type: "pin",
              L: pL,
              C: pC,
              H: pH,
              nameOverride: row.Noun || "",
              adjOverride: row.Adjective || "",
              notes: row.Note || "",
              erpCode:
                row.ERP_Code || getExactErpCode(pL, pC, pC === 0 ? 0 : pH),
              adjId,
              anchorId,
              color:
                row.HEX ||
                new Color("oklch", [pL, pC, pH])
                  .clone()
                  .toGamut({ space: "srgb" })
                  .toString({ format: "hex" }),
              a,
              b,
              spectral: spectral2,
            };
            if (row.Illuminant)
              newSavedColors[pinId].illuminant = String(row.Illuminant).trim();
            if (row.Observer)
              newSavedColors[pinId].observer =
                parseInt(row.Observer, 10) || void 0;
            if (row.Measurement_Method)
              newSavedColors[pinId].measurementMethod = String(
                row.Measurement_Method,
              ).trim();
            if (row.Measurement_Date)
              newSavedColors[pinId].measurementDate = String(
                row.Measurement_Date,
              ).trim();
            if (row.Measurement_Device)
              newSavedColors[pinId].measurementDevice = String(
                row.Measurement_Device,
              ).trim();
            if (row.Tags)
              newTags[pinId] = row.Tags.split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            if (typeof pinsAdded !== "undefined") pinsAdded++;
          } else if (targetType === "NOUN") {
            const parts = String(row.OKLCH_L || "").split("-");
            let minL = 0,
              maxL = 1;
            if (parts.length === 2) {
              minL = parseFloat(parts[0]) || 0;
              maxL = parseFloat(parts[1]) || 1;
            } else if (parts.length === 1 && parts[0] !== "") {
              minL = parseFloat(parts[0]) || 0;
              maxL = parseFloat(parts[0]) || 1;
            } else if (pL !== null) {
              minL = maxL = pL;
            }
            const C = pC !== null ? pC : 0;
            const H = pH !== null ? pH : 0;
            let id = row.ID;
            if (!id) {
              id = `col-${minL}-${maxL}-${C.toFixed(2)}-${H.toFixed(2)}`;
            }
            newSavedColors[id] = {
              id,
              type: "nounColumn",
              nameOverride: row.Noun || "",
              C,
              H,
              minL,
              maxL,
              a: C * Math.sin((H * Math.PI) / 180),
              b: C * Math.cos((H * Math.PI) / 180),
              notes: row.Note || "",
            };
            if (row.Noun !== void 0 && row.Noun !== "") newNames[id] = row.Noun;
            if (row.Note !== void 0 && row.Note !== "") newNotes[id] = row.Note;
            if (row.Tags)
              newTags[id] = row.Tags.split(",")
                .map((t) => t.trim())
                .filter(Boolean);
          } else if (
            (targetType === "GRID" ||
              targetType === "ANCHOR" ||
              targetType === "NOUN_COLUMN") &&
            row.ID
          ) {
            const C = pC !== null ? pC : 0;
            const H = pH !== null ? pH : 0;
            if (targetType === "NOUN_COLUMN") {
              const id = row.ID;
              const parts = (row.OKLCH_L || "").split("-");
              let minL = 0,
                maxL = 1;
              if (parts.length === 2) {
                minL = parseFloat(parts[0]);
                maxL = parseFloat(parts[1]);
              }
              newSavedColors[id] = {
                id,
                type: "nounColumn",
                nameOverride: row.Noun || "",
                C,
                H,
                minL,
                maxL,
                a: C * Math.sin((H * Math.PI) / 180),
                b: C * Math.cos((H * Math.PI) / 180),
                notes: row.Note || "",
              };
              if (row.Noun !== void 0 && row.Noun !== "")
                newNames[id] = row.Noun;
              if (row.Note !== void 0 && row.Note !== "")
                newNotes[id] = row.Note;
              if (row.Tags)
                newTags[id] = row.Tags.split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
            } else {
              if (row.Noun !== void 0 && row.Noun !== "")
                newNames[row.ID] = row.Noun;
              if (row.Note !== void 0 && row.Note !== "")
                newNotes[row.ID] = row.Note;
              if (row.Tags)
                newTags[row.ID] = row.Tags.split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
              let lStr = null;
              if (row.Adjective !== void 0 && row.Adjective !== "") {
                if (pL !== null) {
                  lStr = getLStr(pL);
                } else if (row.ERP_Code && row.ERP_Code.length >= 2) {
                  lStr = row.ERP_Code.substring(0, 2);
                }
                if (lStr) newAdjs[lStr] = row.Adjective;
              }
              if (
                String(row.Locked).toUpperCase() === "TRUE" &&
                pL !== null &&
                pC !== null &&
                pH !== null
              ) {
                const anchorId = row.ID;
                const adjId = lStr || getLStr(pL);
                const a = pC * Math.sin((pH * Math.PI) / 180);
                const b = pC * Math.cos((pH * Math.PI) / 180);
                newSavedColors[anchorId] = {
                  id: anchorId,
                  type: "anchor",
                  L: pL,
                  C: pC,
                  H: pH,
                  a,
                  b,
                  erpCode: row.ERP_Code || getExactErpCode(pL, pC, pH),
                  adjId,
                  anchorId,
                  nameOverride: "",
                  adjOverride: "",
                  notes: "",
                  color: new Color("oklch", [pL, pC, pH])
                    .clone()
                    .toGamut({ space: "srgb" })
                    .toString({ format: "hex" }),
                };
              }
            }
          } else if (targetType === "ADJECTIVE") {
            if (row.Adjective !== void 0 && row.Adjective !== "") {
              const lStr =
                (row.ID && row.ID.trim()) ||
                (row.OKLCH_L &&
                  typeof row.OKLCH_L === "string" &&
                  row.OKLCH_L.trim()) ||
                (pL !== null ? getLStr(pL) : null) ||
                (row.ERP_Code && row.ERP_Code.length >= 2
                  ? row.ERP_Code.substring(0, 2)
                  : null);
              if (lStr) newAdjs[lStr.trim()] = row.Adjective;
            }
          }
        });
        if (hasImportedSettings) {
          setGroupSettings({
            lightL: parsedSettings.lightL,
            neutralC: parsedSettings.neutralC,
            vividC: parsedSettings.vividC,
            neutrals: hasNeutrals
              ? parsedSettings.neutrals
              : groupSettings.neutrals,
            hues: hasHues ? parsedSettings.hues : groupSettings.hues,
            overrides: hasOverrides
              ? parsedSettings.overrides
              : groupSettings.overrides,
          });
        }
        if (hasImportedPalettes) {
          setSavedPalettes(newSavedPalettes);
        }
        setNames(newNames);
        setAdjectives(newAdjs);
        setDictNotes(newNotes);
        setSavedColors(newSavedColors);
        setDictTags(newTags);
        if (Object.keys(newColorData).length > 0) {
          updateColorData(newColorData);
        }
        e.target.value = "";
      },
    });
  };
  const addToPalette = () => {
    if (!crosshair) return;
    const pinId =
      crosshair.activeSavedColor?.type === "pin"
        ? crosshair.activeSavedColor.id
        : null;
    const newItem = {
      id: crypto.randomUUID(),
      L: scrubL,
      C: scrubC,
      H: scrubH,
      erpCode: crosshair.activeErpCode,
      adjId: crosshair.nearestAdjId,
      nounId: crosshair.nearestAnchorId,
      pinId,
    };
    setPalette((prev) => [...prev, newItem]);
  };
  const removeFromPalette = (id) =>
    setPalette((prev) => prev.filter((item) => item.id !== id));
  const saveCurrentPalette = () => {
    if (palette.length === 0) return;
    setIsSavingPalette(true);
    setNewPaletteName(`Palette ${savedPalettes.length + 1}`);
  };
  const confirmSavePalette = () => {
    if (!newPaletteName.trim()) return;
    const newPalette = {
      id: crypto.randomUUID(),
      name: newPaletteName.trim(),
      colors: [...palette],
      createdAt: new Date().toISOString(),
    };
    setSavedPalettes((prev) => [...prev, newPalette]);
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
    const p = savedPalettes.find((p2) => p2.id === id);
    if (p) {
      setPalette(p.colors);
    }
  };
  const deleteSavedPalette = () => {
    if (!selectedSavedPaletteId) return;
    setSavedPalettes((prev) =>
      prev.filter((p) => p.id !== selectedSavedPaletteId),
    );
    setSelectedSavedPaletteId("");
  };
  const replaceInPalette = (id) => {
    if (!crosshair) return;
    const pinId =
      crosshair.activeSavedColor?.type === "pin"
        ? crosshair.activeSavedColor.id
        : null;
    setPalette((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              L: scrubL,
              C: scrubC,
              H: scrubH,
              erpCode: crosshair.activeErpCode,
              adjId: crosshair.nearestAdjId,
              nounId: crosshair.nearestAnchorId,
              pinId,
            }
          : item,
      ),
    );
  };
  const isLight = scrubL > 0.65;
  const activeColorObj = new Color("oklch", [scrubL, scrubC, scrubH]);
  let labCoords;
  const spectral =
    crosshair?.activeSavedColor?.spectral || crosshair?.temporarySpectral;
  if (spectral) {
    const varXYZ = calculateXYZFromSpectral(spectral, observer, illuminant);
    const wp = getWhitePoint(observer, illuminant);
    labCoords = xyzToLab(varXYZ, wp);
  } else {
    const targetXyzSpace = illuminant === "D50" ? "xyz-d50" : "xyz-d65";
    const varXYZ = activeColorObj.to(targetXyzSpace).coords;
    const wp = getWhitePoint(observer, illuminant);
    labCoords = xyzToLab(varXYZ, wp);
  }
  const labValues = `${labCoords[0].toFixed(1)}, ${labCoords[1].toFixed(1)}, ${labCoords[2].toFixed(1)}`;
  const colorGroup = getColorGroup(scrubL, scrubC, scrubH, groupSettings);
  const isOutOfGamut = !activeColorObj.inGamut("srgb");
  const crosshairHex = activeColorObj
    .clone()
    .toGamut({ space: "srgb" })
    .toString({ format: "hex" })
    .toUpperCase();
  const getInheritedData = (sc) => {
    if (!sc) return null;
    if (!sc.parentPinId || !savedColors[sc.parentPinId]) {
      const cb = getInheritedPinNames(
        sc,
        savedColors,
        names,
        adjectives,
        colorData,
      );
      const parsedAdj = cb.displayAdj === "Unnamed" ? "" : cb.displayAdj;
      const parsedName = cb.displayName === "Unnamed" ? "" : cb.displayName;
      return {
        adj: parsedAdj,
        name: parsedName,
        notes: sc.notes || dictNotes[cb.sourceId] || "",
        source: cb.source,
        sourceId: cb.sourceId,
      };
    }
    const parent = savedColors[sc.parentPinId];
    const parentData = getInheritedData(parent);
    return {
      adj: parent.adjOverride || parentData.adj,
      name: parent.nameOverride || parentData.name,
      notes: parent.notes || parentData.notes,
      source: "pin",
      sourceId: parent.id,
    };
  };
  const activeData = useMemo(() => {
    if (!crosshair?.activeSavedColor) {
      if (crosshair?.closestGridPt?.isPin) {
        const pinSc = savedColors[crosshair.closestGridPt.pinId];
        const inherited2 = getInheritedData(pinSc);
        return {
          adj: pinSc.adjOverride || inherited2.adj,
          name: pinSc.nameOverride || inherited2.name,
          notes: pinSc.notes || inherited2.notes,
          inherited: inherited2,
        };
      }
      return {
        adj: adjectives[crosshair?.nearestAdjId] || "",
        name: names[crosshair?.nearestAnchorId] || "",
        notes: dictNotes[crosshair?.nearestAnchorId] || "",
      };
    }
    const sc = crosshair.activeSavedColor;
    if (sc.type === "anchor") {
      return {
        adj: adjectives[sc.adjId] || "",
        name: names[sc.anchorId] || "",
        notes: dictNotes[sc.anchorId] || "",
      };
    } else if (sc.type === "nounColumn") {
      return {
        adj:
          adjectives[crosshair?.nearestAdjId] ||
          adjectives[getLStr(crosshair?.rawL)] ||
          "",
        name: names[sc.id] || sc.nameOverride,
        notes: dictNotes[sc.id] || sc.notes,
      };
    }
    const inherited = getInheritedData(sc);
    return {
      adj: sc.adjOverride || inherited.adj,
      name: sc.nameOverride || inherited.name,
      notes: sc.notes || inherited.notes,
      inherited,
    };
  }, [crosshair, savedColors, adjectives, names, dictNotes]);
  const activeAdj = activeData.adj;
  const activeName = activeData.name;
  const activeNotes = activeData.notes;
  const isPinned = crosshair?.exactSavedColor?.type === "pin";
  const isAnchorLocked = crosshair
    ? lockedAdjectives[crosshair.nearestAdjId] &&
      lockedNouns[crosshair.nearestAnchorId]
    : false;
  const isInputDisabled =
    crosshair?.activeSavedColor?.type === "anchor" ||
    (!crosshair?.activeSavedColor &&
      crosshair &&
      lockedAdjectives[crosshair.nearestAdjId] &&
      lockedNouns[crosshair.nearestAnchorId]);
  const activeCommercial = crosshair?.activeCommercial;
  const activeItemId = activeCommercial
    ? `commercial-${activeCommercial.brand}-${activeCommercial.originalIndex}`
    : crosshair?.activeSavedColor?.type === "pin"
      ? crosshair.activeSavedColor.id
      : crosshair?.nearestAnchorId;
  const activeTags = activeCommercial
    ? colorData[activeCommercial.brand]?.[activeCommercial.originalIndex]
        ?.tags || []
    : activeItemId
      ? dictTags[activeItemId] || []
      : [];
  const addTag = (tag) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (activeCommercial) {
      const updated = { ...colorData };
      if (
        updated[activeCommercial.brand] &&
        updated[activeCommercial.brand][activeCommercial.originalIndex]
      ) {
        updated[activeCommercial.brand] = [...updated[activeCommercial.brand]];
        updated[activeCommercial.brand][activeCommercial.originalIndex] = {
          ...updated[activeCommercial.brand][activeCommercial.originalIndex],
        };
        const currentTags =
          updated[activeCommercial.brand][activeCommercial.originalIndex]
            .tags || [];
        if (!currentTags.some((t) => t.toLowerCase() === normalizedTag)) {
          updated[activeCommercial.brand][activeCommercial.originalIndex].tags =
            [...currentTags, tag.trim()];
          updateColorData(updated);
        }
      }
    } else if (activeItemId) {
      setDictTags((prev) => {
        const currentTags = prev[activeItemId] || [];
        if (currentTags.some((t) => t.toLowerCase() === normalizedTag))
          return prev;
        return { ...prev, [activeItemId]: [...currentTags, tag.trim()] };
      });
    }
  };
  const removeTag = (tag) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (activeCommercial) {
      const updated = { ...colorData };
      if (
        updated[activeCommercial.brand] &&
        updated[activeCommercial.brand][activeCommercial.originalIndex]
      ) {
        updated[activeCommercial.brand] = [...updated[activeCommercial.brand]];
        updated[activeCommercial.brand][activeCommercial.originalIndex] = {
          ...updated[activeCommercial.brand][activeCommercial.originalIndex],
        };
        const currentTags =
          updated[activeCommercial.brand][activeCommercial.originalIndex]
            .tags || [];
        updated[activeCommercial.brand][activeCommercial.originalIndex].tags =
          currentTags.filter((t) => t.toLowerCase() !== normalizedTag);
        updateColorData(updated);
      }
    } else if (activeItemId) {
      setDictTags((prev) => ({
        ...prev,
        [activeItemId]: (prev[activeItemId] || []).filter(
          (t) => t.toLowerCase() !== normalizedTag,
        ),
      }));
    }
  };
  const adjInputClass = `name-input w-full bg-transparent text-center text-xs font-bold uppercase tracking-[0.2em] focus:outline-none drop-shadow-md pointer-events-auto ${getGlobalDuplicate(names, adjectives, crosshair?.activeSavedColor?.type === "pin" ? crosshair.activeSavedColor.id : crosshair?.nearestAdjId, activeAdj, savedColors, crosshair?.activeSavedColor?.type === "pin" ? !!crosshair.activeSavedColor.adjOverride : true, crosshair?.activeSavedColor?.type === "pin" ? crosshair?.nearestAdjId : null) ? "!text-red-500" : isPinned && !crosshair?.exactSavedColor.adjOverride ? "opacity-40 italic" : ""}`;
  const nounInputClass = `name-input w-full bg-transparent text-center text-2xl font-black uppercase tracking-widest focus:outline-none drop-shadow-md -mt-1 pointer-events-auto ${getGlobalDuplicate(names, adjectives, crosshair?.activeSavedColor?.type === "pin" ? crosshair.activeSavedColor.id : crosshair?.nearestAnchorId, activeName, savedColors, crosshair?.activeSavedColor?.type === "pin" ? !!crosshair.activeSavedColor.nameOverride : true, crosshair?.activeSavedColor?.type === "pin" ? crosshair?.nearestAnchorId : null) ? "!text-red-500" : isPinned && !crosshair?.exactSavedColor.nameOverride ? "opacity-40 italic" : ""}`;
  let deltaEOK = null;
  let deltaE2000 = null;
  if (compSlotA && compSlotB) {
    const cA = new Color("oklch", [compSlotA.L, compSlotA.C, compSlotA.H]);
    const cB = new Color("oklch", [compSlotB.L, compSlotB.C, compSlotB.H]);
    deltaEOK = (cA.deltaE(cB, "OK") * 100).toFixed(2);
    deltaE2000 = cA.deltaE(cB, "2000").toFixed(2);
  }
  return React.createElement(AppUI, {
    theme,
    setTheme,
    activeTab,
    setActiveTab,
    names,
    setNames,
    adjectives,
    setAdjectives,
    dictNotes,
    setDictNotes,
    dictTags,
    setDictTags,
    globalTags,
    savedColors,
    setSavedColors,
    groupSettings,
    setGroupSettings,
    palette,
    setPalette,
    savedPalettes,
    setSavedPalettes,
    selectedSavedPaletteId,
    setSelectedSavedPaletteId,
    isSavingPalette,
    setIsSavingPalette,
    newPaletteName,
    setNewPaletteName,
    searchQuery,
    setSearchQuery,
    selectedIds,
    setSelectedIds,
    observer,
    setObserver,
    illuminant,
    setIlluminant,
    handleBatchTag,
    handleBatchRemoveTag,
    viewportVisibility,
    setViewportVisibility,
    showVisibilityMenu,
    setShowVisibilityMenu,
    visibilityMenuRef,
    viewportSearchQuery,
    setViewportSearchQuery,
    viewMode,
    setViewMode,
    swatchLayout,
    setSwatchLayout,
    swatchZoom,
    setSwatchZoom,
    viewportTagFilter,
    setViewportTagFilter,
    filterL,
    setFilterL,
    filterC,
    setFilterC,
    filterH,
    setFilterH,
    filterPt,
    scrubL,
    setScrubL,
    scrubC,
    setScrubC,
    scrubH,
    setScrubH,
    setTemporarySpectral,
    compSlotA,
    setCompSlotA,
    compSlotB,
    setCompSlotB,
    showFullscreenPreview,
    setShowFullscreenPreview,
    showCompareFullscreen,
    setShowCompareFullscreen,
    showFullscreenSpectral,
    setShowFullscreenSpectral,
    showFullscreenPalette,
    setShowFullscreenPalette,
    showCompareDivider,
    setShowCompareDivider,
    showHelpPanel,
    setShowHelpPanel,
    showDatabaseManager,
    setShowDatabaseManager,
    showFileManager,
    setShowFileManager,
    showAveryModal,
    setShowAveryModal,
    averyPrintSourceType,
    setAveryPrintSourceType,
    averySourceItems,
    selectedPrintIds,
    setSelectedPrintIds,
    printConfigs,
    setPrintConfigs,
    printStartIndex,
    setPrintStartIndex,
    printLabelSwatches,
    setPrintLabelSwatches,
    printLabelNames,
    setPrintLabelNames,
    printLabelErp,
    setPrintLabelErp,
    printLabelHex,
    setPrintLabelHex,
    printLabelOklch,
    setPrintLabelOklch,
    printLabelBorders,
    setPrintLabelBorders,
    printLabelDoorProfile,
    setPrintLabelDoorProfile,
    printLabelSheen,
    setPrintLabelSheen,
    printLabelVisualTexture,
    setPrintLabelVisualTexture,
    printLabelTactileTexture,
    setPrintLabelTactileTexture,
    printLabelMaterial,
    setPrintLabelMaterial,
    generateAveryPages,
    getPaletteItemInfo,
    linkedFiles,
    setLinkedFiles,
    colorData,
    filteredColorData,
    updateColorData,
    visualizeData,
    setVisualizeData,
    history,
    isUndoing,
    currentStateStr,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    lockedNouns,
    lockedAdjectives,
    filteredViewData,
    handleUpdate,
    handlePointClick,
    handleVisualize,
    crosshair,
    crosshair,
    gridData,
    isLight,
    activeColorObj,
    labValues,
    colorGroup,
    isOutOfGamut,
    crosshairHex,
    activeData,
    activeAdj,
    activeName,
    activeNotes,
    isPinned,
    isAnchorLocked,
    isInputDisabled,
    activeItemId,
    activeTags,
    addTag,
    removeTag,
    adjInputClass,
    nounInputClass,
    deltaEOK,
    deltaE2000,
    tabs,
    searchResults,
    handleSaveApp,
    handleSystemExport,
    handleImportCSV: handleSystemImport,
    handleSyncToCSV,
    addToPalette,
    removeFromPalette,
    saveCurrentPalette,
    confirmSavePalette,
    cancelSavePalette,
    loadPalette,
    deleteSavedPalette,
    replaceInPalette,
    onAdjChange,
    onNameChange,
    onNotesChange,
    toggleAnchorLock,
    togglePin,
    updateSavedColor,
    spectral,
    tetheringPinId,
    setTetheringPinId,
  });
};
const DatabaseManager = ({
  colorData,
  updateColorData,
  swatchLayout,
  swatchZoom,
  handlePointClick,
  crosshair,
  onClose,
}) => {
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md transition-all",
    },
    React.createElement(
      motion.div,
      {
        initial: { opacity: 0, scale: 0.9, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9, y: 20 },
        className:
          "bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-neutral-800",
      },
      React.createElement(
        "div",
        {
          className:
            "p-8 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center bg-slate-50/50 dark:bg-neutral-900/50",
        },
        React.createElement(
          "div",
          null,
          React.createElement(
            "h2",
            {
              className:
                "text-2xl font-black tracking-tight text-slate-800 dark:text-neutral-100",
            },
            "Color Inventory",
          ),
          React.createElement(
            "p",
            {
              className:
                "text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400",
            },
            "System Database & Brand Assets",
          ),
        ),
        React.createElement(
          "button",
          {
            onClick: onClose,
            className:
              "p-3 hover:bg-slate-200 dark:hover:bg-neutral-800 rounded-2xl transition-all text-slate-400 hover:text-slate-600 active:scale-95",
          },
          React.createElement(Icon, { name: "x", className: "w-6 h-6" }),
        ),
      ),
      React.createElement(
        "div",
        { className: "flex-1 overflow-hidden" },
        React.createElement(ViewDatabase, {
          colorData,
          updateColorData,
          swatchLayout,
          swatchZoom,
          handlePointClick,
          crosshair,
        }),
      ),
      React.createElement(
        "div",
        {
          className:
            "p-4 bg-slate-50 dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800 flex justify-end",
        },
        React.createElement(
          "button",
          {
            onClick: onClose,
            className:
              "px-6 py-2.5 bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg",
          },
          "Close Manager",
        ),
      ),
    ),
  );
};
const ViewDatabase = ({
  colorData,
  updateColorData,
  swatchLayout,
  swatchZoom,
  handlePointClick,
  crosshair,
  searchTerm,
  tagFilter,
  filterPt,
  selectedIds,
  setSelectedIds,
  handleBatchTag,
  handleBatchRemoveTag,
  globalTags,
}) => {
  const [sortBy, setSortBy] = useState("brand");
  const [sortAsc, setSortAsc] = useState(true);
  const [spectralFilter, setSpectralFilter] = useState(false);
  const [dbAxis, setDbAxis] = useState("HxL");
  const [brandFilter, setBrandFilter] = useState("");
  const [userEnableDeltaE, setUserEnableDeltaE] = useState(false);
  const [maxDeltaE, setMaxDeltaE] = useState(5);
  const enableDeltaE = userEnableDeltaE;
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const baseMatrixSize = 48;
  const baseListSize = 48;
  const allDbItems = useMemo(() => {
    if (!colorData) return [];
    let items = [];
    Object.keys(colorData).forEach((brand) => {
      colorData[brand].forEach((c, idx) => {
        if (filterPt && !filterPt(c)) return;
        let L = c.L;
        let C = c.C;
        let H = c.H;
        let hexVal = c.hex || "#000000";
        if (c.spectral && c.spectral.length === 31) {
          try {
            const xyzStandard = calculateXYZFromSpectral(c.spectral, 2, "D65");
            const col = new Color("xyz-d65", xyzStandard).to("oklch");
            L = Math.max(0, Math.min(1, col.coords[0]));
            C = Math.max(0, Math.min(0.4, col.coords[1]));
            H = isNaN(col.coords[2]) ? 0 : ((col.coords[2] % 360) + 360) % 360;
            hexVal = col.to("srgb").toString({ format: "hex" });
          } catch (e) {}
        } else if (L === void 0 || L === null) {
          let tc;
          if (c.hex) {
            try {
              tc = new Color(c.hex).to("oklch");
            } catch (e) {}
          }
          if (tc) {
            L = Math.max(0, Math.min(1, tc.coords[0]));
            C = Math.max(0, Math.min(0.4, tc.coords[1]));
            H = isNaN(tc.coords[2]) ? 0 : ((tc.coords[2] % 360) + 360) % 360;
          } else {
            L = 0.5;
            C = 0;
            H = 0;
          }
        }
        items.push({
          ...c,
          brand,
          originalIndex: idx,
          id: `${brand}-${idx}`,
          L,
          C,
          H,
          hex: hexVal,
          displayName: c.name || "",
          erpCode: c.url || "",
          hasSpectral: !!c.spectral && c.spectral.length > 0,
          tags: c.tags || [],
          spectral: c.spectral,
          note: c.image || "",
        });
      });
    });
    return items;
  }, [colorData, filterPt]);
  const allBrands = useMemo(
    () => Array.from(new Set(allDbItems.map((i) => i.brand))).sort(),
    [allDbItems],
  );
  const allTags = useMemo(
    () =>
      Array.from(
        new Set(
          allDbItems.flatMap((i) => (i.tags || []).map((t) => t.toLowerCase())),
        ),
      ).sort(),
    [allDbItems],
  );
  const sortedItems = useMemo(() => {
    let items = [...allDbItems];
    if (enableDeltaE && crosshair) {
      const cL = crosshair.rawL;
      const cC = crosshair.rawC;
      const cH = crosshair.rawH;
      const center = new Color("oklch", [cL, cC, cH]);
      items = items.filter((item) => {
        try {
          const d =
            center.deltaE(new Color("oklch", [item.L, item.C, item.H]), "OK") *
            100;
          item._d = d;
          return d <= maxDeltaE;
        } catch (e) {
          return false;
        }
      });
    }
    if (brandFilter) items = items.filter((item) => item.brand === brandFilter);
    if (tagFilter)
      items = items.filter((item) =>
        (item.tags || []).some(
          (t) => t.toLowerCase() === tagFilter.toLowerCase(),
        ),
      );
    if (spectralFilter) items = items.filter((item) => item.hasSpectral);
    if (searchTerm.trim()) {
      const qWords = searchTerm
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      items = items.filter((item) =>
        qWords.every(
          (w) =>
            item.displayName.toLowerCase().includes(w) ||
            item.brand.toLowerCase().includes(w) ||
            item.erpCode.toLowerCase().includes(w) ||
            (item.tags && item.tags.some((t) => t.toLowerCase().includes(w))),
        ),
      );
    }
    items = items.map((item) => ({
      ...item,
      _inGamut: new Color("oklch", [item.L, item.C, item.H]).inGamut("srgb"),
    }));
    return items.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case "deltae":
          valA = a._d ?? 999;
          valB = b._d ?? 999;
          break;
        case "name":
          valA = a.displayName.toLowerCase();
          valB = b.displayName.toLowerCase();
          break;
        case "brand":
          valA = a.brand.toLowerCase();
          valB = b.brand.toLowerCase();
          break;
        case "lightness":
          valA = a.L;
          valB = b.L;
          break;
        case "chroma":
          valA = a.C;
          valB = b.C;
          break;
        case "hue":
          valA = a.H;
          valB = b.H;
          break;
        default:
          if (enableDeltaE) {
            valA = a._d ?? 999;
            valB = b._d ?? 999;
          } else {
            valA = a.brand.toLowerCase();
            valB = b.brand.toLowerCase();
          }
          break;
      }
      if (valA === valB) return a.H - b.H;
      if (typeof valA === "string")
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [
    allDbItems,
    sortBy,
    sortAsc,
    tagFilter,
    searchTerm,
    brandFilter,
    spectralFilter,
    enableDeltaE,
    maxDeltaE,
    crosshair,
  ]);
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
      spectral: editingItem.spectralStr
        ? editingItem.spectralStr.split(",").map(Number)
        : updated[editingItem.brand][editingItem.originalIndex].spectral,
    };
    let L = updated[editingItem.brand][editingItem.originalIndex].L;
    let C = updated[editingItem.brand][editingItem.originalIndex].C;
    let H = updated[editingItem.brand][editingItem.originalIndex].H;
    let tc;
    if (
      updated[editingItem.brand][editingItem.originalIndex].spectral &&
      updated[editingItem.brand][editingItem.originalIndex].spectral.length ===
        31
    ) {
      try {
        tc = new Color(
          "xyz-d65",
          calculateXYZFromSpectral(
            updated[editingItem.brand][editingItem.originalIndex].spectral,
            2,
            "D65",
          ),
        ).to("oklch");
      } catch (e2) {}
    }
    if (!tc && editingItem.hex) {
      try {
        tc = new Color(editingItem.hex).to("oklch");
      } catch (e2) {}
    }
    if (tc) {
      updated[editingItem.brand][editingItem.originalIndex].L = Math.max(
        0,
        Math.min(1, tc.coords[0]),
      );
      updated[editingItem.brand][editingItem.originalIndex].C = Math.max(
        0,
        Math.min(0.4, tc.coords[1]),
      );
      updated[editingItem.brand][editingItem.originalIndex].H = isNaN(
        tc.coords[2],
      )
        ? 0
        : ((tc.coords[2] % 360) + 360) % 360;
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
      updated[brandFilter].unshift({
        name: n,
        hex: "#888888",
        L: 0.5,
        C: 0,
        H: 0,
        tags: [],
        url: "",
        image: "",
      });
      updateColorData(updated);
    }
  };
  const SortButton = ({ field, label }) =>
    React.createElement(
      "button",
      {
        onClick: () => {
          if (sortBy === field) setSortAsc(!sortAsc);
          else {
            setSortBy(field);
            setSortAsc(true);
          }
        },
        className: `flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-colors ${sortBy === field || (!sortBy && field === "deltae" && enableDeltaE) ? "bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30" : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 border border-transparent"}`,
      },
      label,
      (sortBy === field || (!sortBy && field === "deltae" && enableDeltaE)) &&
        React.createElement(Icon, {
          name: sortAsc ? "chevron-up" : "chevron-down",
          className: "w-3 h-3",
        }),
    );
  const renderItems = sortedItems.slice(0, 300);
  return React.createElement(
    "div",
    {
      className:
        "h-full flex flex-col overflow-hidden pt-2 relative bg-slate-50/50 dark:bg-neutral-900/50",
    },
    React.createElement(
      "div",
      {
        className:
          "flex flex-col gap-2 px-4 pb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0",
      },
      React.createElement(
        "div",
        { className: "flex flex-wrap items-center gap-2" },
        React.createElement(SortButton, { field: "brand", label: "Brand" }),
        React.createElement(SortButton, { field: "name", label: "Name" }),
        React.createElement(SortButton, { field: "lightness", label: "L" }),
        React.createElement(SortButton, { field: "chroma", label: "C" }),
        React.createElement(SortButton, { field: "hue", label: "H" }),
        React.createElement(SortButton, { field: "deltae", label: "\u0394E" }),
        React.createElement("div", {
          className: "h-4 w-px bg-slate-300 dark:bg-neutral-700 mx-1",
        }),
        React.createElement(
          "select",
          {
            value: brandFilter,
            onChange: (e) => setBrandFilter(e.target.value),
            className:
              "bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[9px] font-bold uppercase tracking-wider rounded px-2 py-1 outline-none",
          },
          React.createElement("option", { value: "" }, "All Brands"),
          allBrands.map((b) =>
            React.createElement(
              "option",
              { key: b, value: b },
              getBrandDisplayName(b),
            ),
          ),
        ),
        React.createElement(
          "button",
          {
            onClick: handleAddBrand,
            className:
              "px-2 py-1 text-[9px] font-bold bg-white dark:bg-neutral-800 hover:bg-slate-100 border border-slate-200 dark:border-neutral-700 uppercase tracking-wider rounded flex items-center gap-1",
          },
          React.createElement(Icon, { name: "plus", className: "w-3 h-3" }),
          " Brand",
        ),
        brandFilter &&
          React.createElement(
            "button",
            {
              onClick: handleAddColor,
              className:
                "px-2 py-1 text-[9px] font-bold bg-sky-500 hover:bg-sky-600 text-white border border-sky-600 uppercase tracking-wider rounded flex items-center gap-1",
            },
            React.createElement(Icon, { name: "plus", className: "w-3 h-3" }),
            " Color",
          ),
        brandFilter &&
          React.createElement(
            "button",
            {
              onClick: () => {
                if (confirm(`Delete entire brand '${brandFilter}'?`)) {
                  const c = { ...colorData };
                  delete c[brandFilter];
                  updateColorData(c);
                  setBrandFilter("");
                }
              },
              className:
                "px-2 py-1 text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 uppercase tracking-wider rounded flex items-center gap-1",
            },
            React.createElement(Icon, {
              name: "trash-2",
              className: "w-3 h-3",
            }),
            " Brand",
          ),
      ),
      React.createElement(
        "div",
        { className: "flex flex-wrap items-center gap-3" },
        React.createElement(
          "label",
          {
            className:
              "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500",
          },
          React.createElement("input", {
            type: "checkbox",
            checked: enableDeltaE,
            onChange: (e) => {
              setUserEnableDeltaE(e.target.checked);
            },
            className: "rounded text-sky-500",
            title: "",
          }),
          "Filter by \u0394E to Crosshair",
        ),
        enableDeltaE &&
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement("input", {
              type: "range",
              min: "0",
              max: "50",
              step: "0.1",
              value: maxDeltaE,
              onChange: (e) => setMaxDeltaE(parseFloat(e.target.value)),
              className: "w-32",
            }),
            React.createElement(
              "span",
              { className: "text-[10px] font-mono w-8" },
              maxDeltaE.toFixed(2),
            ),
          ),
        React.createElement(
          "button",
          {
            onClick: () => setSpectralFilter(!spectralFilter),
            className: `flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded border ${spectralFilter ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-slate-500 border-slate-200 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400"}`,
          },
          React.createElement(Icon, { name: "activity", className: "w-3 h-3" }),
          " Spectral Only",
        ),
        React.createElement(
          "span",
          {
            className:
              "ml-auto text-[10px] font-black uppercase text-slate-400",
          },
          sortedItems.length > 300
            ? "300 of " + sortedItems.length
            : sortedItems.length,
          " ",
          "matching",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "flex-1 overflow-y-auto custom-scrollbar relative p-4" },
      renderItems.length === 0 &&
        React.createElement(
          "div",
          { className: "text-center text-slate-400 text-xs w-full p-8 italic" },
          "No commercial colors found. Adjust filters or \u0394E.",
        ),
      swatchLayout === "matrix" &&
        React.createElement(
          "div",
          { className: "flex flex-col gap-2 h-full" },
          React.createElement(
            "div",
            {
              className:
                "flex items-center gap-2 p-2 bg-slate-50 dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 rounded-lg shrink-0",
            },
            React.createElement(
              "span",
              { className: "text-[10px] font-bold text-slate-400 uppercase" },
              "XY Axis:",
            ),
            React.createElement(
              "select",
              {
                value: dbAxis,
                onChange: (e) => setDbAxis(e.target.value),
                className:
                  "bg-white dark:bg-neutral-800 text-xs font-bold border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 outline-none text-slate-700 dark:text-neutral-300",
              },
              React.createElement(
                "option",
                { value: "HxL" },
                "Hue \xD7 Lightness",
              ),
              React.createElement(
                "option",
                { value: "CxL" },
                "Chroma \xD7 Lightness",
              ),
              React.createElement(
                "option",
                { value: "HxC" },
                "Hue \xD7 Chroma",
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "flex-1 relative" },
            React.createElement(ViewportSwatches, {
              items: renderItems,
              layout: "matrix",
              swatchZoom,
              dim1: dbAxis === "HxL" ? "L" : dbAxis === "CxL" ? "L" : "C",
              dim2: dbAxis === "HxL" ? "H" : dbAxis === "CxL" ? "C" : "H",
              dim1Labels: (v) =>
                dbAxis === "HxL" || dbAxis === "CxL"
                  ? `L: ${v.toFixed(2)}`
                  : `C: ${v.toFixed(2)}`,
              dim2Labels: (v) =>
                dbAxis === "HxL" || dbAxis === "HxC"
                  ? `H: ${v.toFixed(0)}\xB0`
                  : `C: ${v.toFixed(2)}`,
              handlePointClick,
              crosshair,
              selectedIds,
              setSelectedIds,
            }),
          ),
        ),
      swatchLayout === "list" &&
        React.createElement(
          "div",
          { className: "flex flex-col gap-2" },
          renderItems.map((item, i) =>
            React.createElement(
              "div",
              {
                key: i,
                onClick: () =>
                  handlePointClick([item.L, item.C, item.H], item.spectral, {
                    brand: item.brand,
                    originalIndex: item.originalIndex,
                  }),
                className: `relative flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-neutral-800/80 border shadow-sm cursor-pointer transition-all group ${selectedIds?.includes(item.id) ? "border-sky-500 ring-1 ring-sky-500 shadow-md" : "border-slate-200 dark:border-neutral-700/50 hover:border-sky-500 hover:shadow-md"}`,
              },
              React.createElement(
                "div",
                {
                  className: `absolute top-2 left-2 z-30 ${selectedIds?.includes(item.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`,
                  onClick: (e) => e.stopPropagation(),
                },
                React.createElement("input", {
                  type: "checkbox",
                  checked: selectedIds?.includes(item.id) || false,
                  onChange: (e) => {
                    e.stopPropagation();
                    if (selectedIds) {
                      setSelectedIds((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((id) => id !== item.id)
                          : [...prev, item.id],
                      );
                    }
                  },
                  className: "w-4 h-4 cursor-pointer accent-sky-500",
                }),
              ),
              React.createElement(
                "div",
                {
                  className: "rounded relative flex-shrink-0",
                  style: {
                    backgroundColor: item.hex,
                    backgroundImage: item.image
                      ? `url(${item.image})`
                      : item.note?.startsWith("http")
                        ? `url(${item.note})`
                        : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    width: `${baseListSize * swatchZoom}px`,
                    height: `${baseListSize * swatchZoom}px`,
                  },
                },
                !item._inGamut &&
                  React.createElement("div", {
                    className: "absolute inset-0 pointer-events-none",
                    style: {
                      backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${6 * swatchZoom}px)`,
                    },
                  }),
                item.hasSpectral &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "absolute -top-1 -right-1 flex justify-center items-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow-sm",
                      style: { transform: `scale(${swatchZoom})` },
                    },
                    React.createElement(Icon, {
                      name: "activity",
                      className: "w-2.5 h-2.5",
                    }),
                  ),
                (item.image || item.note?.startsWith("http")) &&
                  React.createElement(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        setFullscreenImage(item.image || item.note);
                      },
                      className:
                        "absolute bottom-1 right-1 bg-black/60 hover:bg-black/80 text-white p-1 rounded backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity",
                    },
                    React.createElement(Icon, {
                      name: "eye",
                      className: "w-3 h-3",
                    }),
                  ),
              ),
              React.createElement(
                "div",
                { className: "flex flex-col flex-1 min-w-0" },
                React.createElement(
                  "div",
                  { className: "flex items-center gap-2" },
                  React.createElement(
                    "span",
                    {
                      className:
                        "text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 bg-slate-100 dark:bg-neutral-800 px-1.5 rounded",
                    },
                    getBrandDisplayName(item.brand),
                  ),
                  React.createElement(
                    "span",
                    {
                      className:
                        "text-[13px] font-bold uppercase tracking-widest text-slate-800 dark:text-neutral-200 truncate",
                    },
                    item.displayName,
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        setEditingItem({
                          ...item,
                          spectralStr: item.spectral
                            ? item.spectral.join(",")
                            : "",
                        });
                      },
                      className:
                        "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-500 transition-opacity ml-2",
                    },
                    React.createElement(Icon, {
                      name: "edit-2",
                      className: "w-3.5 h-3.5",
                    }),
                  ),
                ),
                React.createElement(
                  "span",
                  {
                    className:
                      "text-[11px] font-mono text-slate-500 dark:text-neutral-400 mt-1 flex items-center gap-2",
                  },
                  item.erpCode?.startsWith("http")
                    ? React.createElement(
                        "a",
                        {
                          href: item.erpCode,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          className:
                            "hover:text-sky-500 flex items-center gap-1.5 truncate",
                          onClick: (e) => e.stopPropagation(),
                        },
                        React.createElement(Icon, {
                          name: "external-link",
                          className: "w-3.5 h-3.5 shrink-0",
                        }),
                        " ",
                        React.createElement(
                          "span",
                          { className: "truncate" },
                          item.erpCode,
                        ),
                      )
                    : item.erpCode || "No Web Link",
                ),
                item.tags &&
                  item.tags.length > 0 &&
                  React.createElement(
                    "div",
                    { className: "flex flex-wrap gap-1 mt-1" },
                    item.tags.map((t) =>
                      React.createElement(
                        "span",
                        {
                          key: t,
                          className:
                            "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider",
                        },
                        t,
                      ),
                    ),
                  ),
              ),
              React.createElement(
                "div",
                {
                  className:
                    "flex flex-col justify-center text-right text-[10px] font-mono text-slate-500 dark:text-neutral-400 flex-shrink-0 bg-slate-50 dark:bg-neutral-900 p-2 rounded",
                },
                enableDeltaE &&
                  item._d !== void 0 &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-emerald-500 font-bold mb-1 border-b border-emerald-500/20 pb-0.5",
                    },
                    "\u0394Eok ",
                    item._d.toFixed(2),
                  ),
                React.createElement("div", null, "L: ", item.L.toFixed(3)),
                React.createElement("div", null, "C: ", item.C.toFixed(3)),
                React.createElement(
                  "div",
                  null,
                  "H: ",
                  item.H.toFixed(1),
                  "\xB0",
                ),
              ),
            ),
          ),
        ),
      swatchLayout === "table" &&
        React.createElement(
          "div",
          {
            className:
              "bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-slate-200 dark:border-neutral-700 overflow-hidden",
          },
          React.createElement(
            "table",
            { className: "w-full text-[10px] text-left" },
            React.createElement(
              "thead",
              {
                className:
                  "bg-slate-50 dark:bg-neutral-900/50 font-bold uppercase tracking-wider",
              },
              React.createElement(
                "tr",
                null,
                React.createElement(
                  "th",
                  { className: "p-3 w-10 text-center relative z-20" },
                  React.createElement("input", {
                    type: "checkbox",
                    className: "w-3.5 h-3.5 cursor-pointer accent-sky-500",
                    checked:
                      selectedIds?.length > 0 &&
                      renderItems.every((i) => selectedIds.includes(i.id)),
                    onChange: (e) => {
                      if (e.target.checked) {
                        const newIds = new Set([
                          ...(selectedIds || []),
                          ...renderItems.map((i) => i.id),
                        ]);
                        setSelectedIds(Array.from(newIds));
                      } else {
                        const current = new Set(selectedIds || []);
                        renderItems.forEach((i) => current.delete(i.id));
                        setSelectedIds(Array.from(current));
                      }
                    },
                  }),
                ),
                React.createElement(
                  "th",
                  { className: "p-3 w-12 text-center" },
                  "Color",
                ),
                React.createElement("th", { className: "p-3" }, "Name"),
                React.createElement("th", { className: "p-3 w-20" }, "Brand"),
                React.createElement(
                  "th",
                  { className: "p-3 w-40" },
                  "Web Link",
                ),
                enableDeltaE &&
                  React.createElement(
                    "th",
                    { className: "p-3 w-16 text-right text-emerald-600" },
                    "\u0394Eok",
                  ),
                React.createElement(
                  "th",
                  { className: "p-3 w-16 text-right" },
                  "L",
                ),
                React.createElement(
                  "th",
                  { className: "p-3 w-16 text-right" },
                  "C",
                ),
                React.createElement(
                  "th",
                  { className: "p-3 w-16 text-right" },
                  "H",
                ),
                React.createElement("th", { className: "p-3 w-12" }, "Edit"),
              ),
            ),
            React.createElement(
              "tbody",
              {
                className:
                  "divide-y divide-slate-100 dark:divide-neutral-800/50",
              },
              renderItems.map((item, i) =>
                React.createElement(
                  "tr",
                  {
                    key: i,
                    className: `group cursor-pointer ${selectedIds?.includes(item.id) ? "bg-sky-50/50 dark:bg-sky-900/10" : "hover:bg-slate-50 dark:hover:bg-neutral-800/50"}`,
                    onClick: () =>
                      handlePointClick(
                        [item.L, item.C, item.H],
                        item.spectral,
                        {
                          brand: item.brand,
                          originalIndex: item.originalIndex,
                        },
                      ),
                  },
                  React.createElement(
                    "td",
                    {
                      className:
                        "p-3 text-center align-middle relative z-20 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors",
                      onClick: (e) => e.stopPropagation(),
                    },
                    React.createElement("input", {
                      type: "checkbox",
                      checked: selectedIds?.includes(item.id) || false,
                      onChange: (e) => {
                        e.stopPropagation();
                        if (selectedIds) {
                          setSelectedIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id],
                          );
                        }
                      },
                      className: "w-3.5 h-3.5 cursor-pointer accent-sky-500",
                    }),
                  ),
                  React.createElement(
                    "td",
                    { className: "p-1 px-3" },
                    React.createElement(
                      "div",
                      {
                        className: "w-8 h-8 rounded relative shadow-sm",
                        style: {
                          backgroundColor: item.hex,
                          backgroundImage: item.image
                            ? `url(${item.image})`
                            : item.note?.startsWith("http")
                              ? `url(${item.note})`
                              : "none",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        },
                      },
                      (item.image || item.note?.startsWith("http")) &&
                        React.createElement(
                          "button",
                          {
                            onClick: (e) => {
                              e.stopPropagation();
                              setFullscreenImage(item.image || item.note);
                            },
                            className:
                              "absolute inset-0 flex items-center justify-center bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity",
                          },
                          React.createElement(Icon, {
                            name: "eye",
                            className: "w-4 h-4",
                          }),
                        ),
                      item.hasSpectral &&
                        React.createElement("div", {
                          className:
                            "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500",
                        }),
                    ),
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2 font-medium" },
                    item.displayName,
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2 text-slate-500 font-mono text-[9px]" },
                    getBrandDisplayName(item.brand),
                  ),
                  React.createElement(
                    "td",
                    {
                      className:
                        "p-2 max-w-[120px] truncate text-[9px] font-mono",
                    },
                    item.erpCode?.startsWith("http")
                      ? React.createElement(
                          "a",
                          {
                            href: item.erpCode,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            className: "text-sky-500 hover:underline",
                            onClick: (e) => e.stopPropagation(),
                          },
                          "Link",
                        )
                      : item.erpCode,
                  ),
                  enableDeltaE &&
                    React.createElement(
                      "td",
                      {
                        className:
                          "p-2 text-right text-emerald-600 font-bold font-mono",
                      },
                      item._d?.toFixed(2),
                    ),
                  React.createElement(
                    "td",
                    { className: "p-2 text-right font-mono text-slate-500" },
                    item.L.toFixed(3),
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2 text-right font-mono text-slate-500" },
                    item.C.toFixed(3),
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2 text-right font-mono text-slate-500" },
                    item.H.toFixed(1),
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2 text-center text-slate-300" },
                    React.createElement(
                      "button",
                      {
                        onClick: (e) => {
                          e.stopPropagation();
                          setEditingItem({
                            ...item,
                            spectralStr: item.spectral
                              ? item.spectral.join(",")
                              : "",
                          });
                        },
                        className: "hover:text-sky-500",
                      },
                      React.createElement(Icon, {
                        name: "edit-2",
                        className: "w-4 h-4",
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      swatchLayout === "gallery" &&
        React.createElement(
          "div",
          {
            className:
              "flex flex-wrap gap-3 pb-8 content-start h-max justify-center",
          },
          renderItems.map((item, i) =>
            React.createElement(
              "div",
              {
                key: i,
                onClick: () =>
                  handlePointClick([item.L, item.C, item.H], item.spectral, {
                    brand: item.brand,
                    originalIndex: item.originalIndex,
                  }),
                className:
                  "flex flex-col group cursor-pointer transition-all items-center gap-2",
                style: {
                  width: `${Math.max(48, baseMatrixSize * swatchZoom)}px`,
                },
              },
              React.createElement(
                "div",
                {
                  className: `aspect-square relative flex items-center justify-center overflow-hidden transition-all text-[0px] rounded-xl group-hover:scale-[1.05] group-hover:shadow-md`,
                  style: {
                    backgroundColor: item.hex,
                    backgroundImage: item.image
                      ? `url(${item.image})`
                      : item.note?.startsWith("http")
                        ? `url(${item.note})`
                        : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    width: "100%",
                  },
                },
                !item._inGamut &&
                  React.createElement("div", {
                    className: "absolute inset-0 pointer-events-none",
                    style: {
                      backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${3 * swatchZoom}px, rgba(255,255,255,0.2) ${6 * swatchZoom}px)`,
                    },
                  }),
                item.hasSpectral &&
                  React.createElement("div", {
                    className:
                      "absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-500 z-10",
                  }),
                React.createElement(
                  "div",
                  {
                    className: "absolute top-1 left-1 z-30",
                    onClick: (e) => {
                      e.stopPropagation();
                      if (selectedIds) {
                        setSelectedIds((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((id) => id !== item.id)
                            : [...prev, item.id],
                        );
                      }
                    },
                  },
                  React.createElement(
                    "div",
                    {
                      className: `w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${selectedIds?.includes(item.id) ? "bg-sky-500 border-sky-500 text-white" : "border-white/50 bg-black/20 hover:border-white/80"} ${!selectedIds?.includes(item.id) && "opacity-0 group-hover:opacity-100"}`,
                    },
                    selectedIds?.includes(item.id) &&
                      React.createElement(Icon, {
                        name: "check",
                        className: "w-3 h-3",
                      }),
                  ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-sm pointer-events-none",
                  },
                  (item.image || item.note?.startsWith("http")) &&
                    React.createElement(
                      "button",
                      {
                        onClick: (e) => {
                          e.stopPropagation();
                          setFullscreenImage(item.image || item.note);
                        },
                        className:
                          "text-white hover:text-sky-300 p-1 pointer-events-auto",
                      },
                      React.createElement(Icon, {
                        name: "eye",
                        className: "w-5 h-5",
                      }),
                    ),
                  React.createElement(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        setEditingItem({
                          ...item,
                          spectralStr: item.spectral
                            ? item.spectral.join(",")
                            : "",
                        });
                      },
                      className:
                        "text-white hover:text-sky-300 p-1 pointer-events-auto",
                    },
                    React.createElement(Icon, {
                      name: "edit-2",
                      className: "w-5 h-5",
                    }),
                  ),
                ),
                swatchZoom >= 1 &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "absolute inset-x-0 bottom-0 top-auto flex flex-col items-center justify-end pointer-events-none p-1 leading-none space-y-0.5 z-10 pb-2",
                      style: {
                        backgroundColor:
                          item.image || item.note?.startsWith("http")
                            ? "rgba(0,0,0,0.4)"
                            : "transparent",
                        color:
                          item.image || item.note?.startsWith("http")
                            ? "white"
                            : item.L > 0.65
                              ? "rgba(0,0,0,0.85)"
                              : "rgba(255,255,255,0.95)",
                      },
                    },
                    item.displayName
                      .split(" ")
                      .map((word, wIdx) =>
                        React.createElement(
                          "span",
                          {
                            key: wIdx,
                            className:
                              "text-center font-bold uppercase tracking-[0.05em] truncate w-full px-0.5 drop-shadow-sm",
                            style: {
                              fontSize: `${Math.max(4, 5.5 * swatchZoom)}px`,
                            },
                          },
                          word,
                        ),
                      ),
                  ),
              ),
              React.createElement(
                "div",
                {
                  className:
                    "flex flex-col items-center text-center px-0.5 pb-2 w-full",
                },
                enableDeltaE &&
                  item._d !== void 0 &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-[9px] text-emerald-500 font-bold flex items-center gap-0.5 justify-center",
                    },
                    React.createElement(Icon, {
                      name: "target",
                      className: "w-2.5 h-2.5",
                    }),
                    " \u0394Eok",
                    " ",
                    item._d.toFixed(2),
                  ),
                React.createElement(
                  "span",
                  {
                    style: { fontSize: `${Math.max(5, 6 * swatchZoom)}px` },
                    className:
                      "w-full font-mono text-slate-500 dark:text-neutral-400 truncate mt-0.5 group-hover:text-slate-800 dark:group-hover:text-neutral-200 transition-colors",
                    title: item.erpCode,
                  },
                  item.erpCode?.startsWith("http")
                    ? React.createElement(
                        "a",
                        {
                          href: item.erpCode,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          className:
                            "hover:text-sky-500 flex items-center justify-center gap-1 drop-shadow-sm",
                          onClick: (e) => e.stopPropagation(),
                        },
                        React.createElement(Icon, {
                          name: "external-link",
                          className: "w-2.5 h-2.5",
                        }),
                        " ",
                        "Web Ref",
                      )
                    : item.erpCode,
                ),
                React.createElement(
                  "span",
                  {
                    style: { fontSize: `${Math.max(4, 5 * swatchZoom)}px` },
                    className:
                      "text-slate-400 uppercase font-bold tracking-widest truncate w-full mt-1",
                  },
                  getBrandDisplayName(item.brand),
                ),
              ),
            ),
          ),
        ),
    ),
    selectedIds &&
      selectedIds.length > 0 &&
      React.createElement(
        "div",
        {
          className:
            "absolute bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 shadow-xl border border-slate-200 dark:border-neutral-700 rounded-full px-4 py-2 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4",
        },
        React.createElement(
          "span",
          {
            className:
              "text-[11px] font-bold text-slate-700 dark:text-neutral-300 uppercase tracking-wider",
          },
          selectedIds.length,
          " selected",
        ),
        React.createElement("div", {
          className: "w-px h-4 bg-slate-300 dark:bg-neutral-600",
        }),
        React.createElement(
          "div",
          { className: "flex items-center gap-2" },
          React.createElement(Icon, {
            name: "tag",
            className: "w-3.5 h-3.5 text-slate-400",
          }),
          React.createElement(
            "div",
            {
              className:
                "flex items-center bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded overflow-hidden",
            },
            React.createElement(
              "select",
              {
                className:
                  "bg-transparent px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none border-r border-slate-200 dark:border-neutral-700 text-slate-800 dark:text-neutral-200 cursor-pointer appearance-none",
                onChange: (e) => {
                  if (e.target.value) {
                    handleBatchTag(e.target.value);
                    e.target.value = "";
                  }
                },
              },
              React.createElement("option", { value: "" }, "Apply..."),
              globalTags.map((t) =>
                React.createElement("option", { key: t, value: t }, t),
              ),
            ),
            React.createElement("input", {
              type: "text",
              placeholder: "Or new tag...",
              className:
                "bg-transparent px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:bg-white dark:focus:bg-neutral-800 w-24 text-slate-800 dark:text-neutral-200",
              onKeyDown: (e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  handleBatchTag(e.target.value.trim());
                  e.target.value = "";
                }
              },
            }),
          ),
          React.createElement("div", {
            className: "w-px h-4 bg-slate-300 dark:bg-neutral-600 mx-1",
          }),
          React.createElement(Icon, {
            name: "tag",
            className: "w-3.5 h-3.5 text-slate-400",
          }),
          React.createElement(
            "div",
            {
              className:
                "flex items-center bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded overflow-hidden",
            },
            React.createElement(
              "select",
              {
                className:
                  "bg-transparent px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider focus:outline-none text-slate-800 dark:text-neutral-200 cursor-pointer appearance-none",
                onChange: (e) => {
                  if (e.target.value) {
                    handleBatchRemoveTag(e.target.value);
                    e.target.value = "";
                  }
                },
              },
              React.createElement("option", { value: "" }, "Remove..."),
              globalTags.map((t) =>
                React.createElement("option", { key: t, value: t }, t),
              ),
            ),
          ),
          React.createElement(
            "button",
            {
              onClick: () => setSelectedIds([]),
              className:
                "text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-neutral-300 ml-2 px-2 py-1",
            },
            "Cancel",
          ),
        ),
      ),
    fullscreenImage &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className:
              "fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-8 cursor-pointer",
            onClick: () => setFullscreenImage(null),
          },
          React.createElement("img", {
            src: fullscreenImage,
            alt: "Fullscreen Preview",
            className: "max-w-full max-h-full object-contain cursor-default",
            onClick: (e) => e.stopPropagation(),
          }),
          React.createElement(
            "button",
            {
              onClick: () => setFullscreenImage(null),
              className:
                "absolute top-4 right-4 text-white hover:text-rose-400 w-12 h-12 flex items-center justify-center bg-black/50 rounded-full",
            },
            React.createElement(Icon, { name: "x", className: "w-8 h-8" }),
          ),
        ),
        document.body,
      ),
    editingItem &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className:
              "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4",
          },
          React.createElement(
            "div",
            {
              className:
                "bg-white dark:bg-neutral-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-neutral-800",
            },
            React.createElement(
              "div",
              {
                className:
                  "p-4 border-b border-slate-200 dark:border-neutral-800 flex justify-between items-center bg-slate-50 dark:bg-neutral-800/50 rounded-t-2xl",
              },
              React.createElement(
                "h3",
                { className: "font-bold flex items-center gap-2" },
                React.createElement(Icon, {
                  name: "edit-2",
                  className: "w-4 h-4 text-sky-500",
                }),
                " Edit Database Item",
              ),
              React.createElement(
                "button",
                {
                  onClick: () => setEditingItem(null),
                  className: "text-slate-400 hover:text-slate-600",
                },
                React.createElement(Icon, { name: "x", className: "w-5 h-5" }),
              ),
            ),
            React.createElement(
              "form",
              {
                onSubmit: handleSaveEdit,
                className:
                  "p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4",
              },
              React.createElement(
                "div",
                { className: "flex items-center gap-4" },
                React.createElement("div", {
                  className:
                    "w-16 h-16 rounded border border-slate-200 dark:border-neutral-700 shadow-sm",
                  style: {
                    backgroundColor: editingItem.hex,
                    backgroundImage: editingItem.note?.startsWith("http")
                      ? `url(${editingItem.note})`
                      : "none",
                    backgroundSize: "cover",
                  },
                }),
                React.createElement(
                  "div",
                  { className: "flex-1" },
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-[10px] font-bold text-slate-400 uppercase tracking-widest",
                    },
                    editingItem.brand,
                  ),
                  React.createElement("input", {
                    required: true,
                    type: "text",
                    value: editingItem.displayName,
                    onChange: (e) =>
                      setEditingItem({
                        ...editingItem,
                        displayName: e.target.value,
                      }),
                    className:
                      "text-lg font-bold w-full bg-transparent border-b-2 border-slate-200 focus:border-sky-500 outline-none pb-1",
                    placeholder: "Color Name",
                  }),
                ),
              ),
              React.createElement(
                "div",
                { className: "grid grid-cols-2 gap-4 mt-2" },
                React.createElement(
                  "div",
                  null,
                  React.createElement(
                    "label",
                    {
                      className:
                        "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1",
                    },
                    "Hex Code",
                  ),
                  React.createElement("input", {
                    required: true,
                    type: "text",
                    value: editingItem.hex,
                    onChange: (e) =>
                      setEditingItem({ ...editingItem, hex: e.target.value }),
                    className:
                      "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 font-mono text-sm",
                    placeholder: "#000000",
                  }),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement(
                    "label",
                    {
                      className:
                        "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1",
                    },
                    "Tags",
                  ),
                  React.createElement(
                    "div",
                    { className: "flex flex-col gap-2" },
                    React.createElement(
                      "div",
                      {
                        className:
                          "flex flex-wrap gap-1.5 p-1.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded min-h-[38px]",
                      },
                      (editingItem.tags || []).map((tag) =>
                        React.createElement(
                          "span",
                          {
                            key: tag,
                            className:
                              "flex items-center gap-1 bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border border-sky-200 dark:border-sky-500/30",
                          },
                          tag,
                          React.createElement(
                            "button",
                            {
                              type: "button",
                              onClick: () =>
                                setEditingItem({
                                  ...editingItem,
                                  tags: editingItem.tags.filter(
                                    (t) => t !== tag,
                                  ),
                                }),
                              className:
                                "hover:text-red-500 transition-colors ml-0.5",
                            },
                            React.createElement(Icon, {
                              name: "x",
                              className: "w-2.5 h-2.5",
                            }),
                          ),
                        ),
                      ),
                      (!editingItem.tags || editingItem.tags.length === 0) &&
                        React.createElement(
                          "span",
                          { className: "text-[10px] text-slate-400 italic" },
                          "No tags added.",
                        ),
                    ),
                    React.createElement(
                      "select",
                      {
                        className:
                          "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white transition-colors appearance-none cursor-pointer",
                        onChange: (e) => {
                          if (e.target.value) {
                            const val = e.target.value;
                            const currentTags = editingItem.tags || [];
                            if (!currentTags.includes(val)) {
                              setEditingItem({
                                ...editingItem,
                                tags: [...currentTags, val],
                              });
                            }
                            e.target.value = "";
                          }
                        },
                      },
                      React.createElement(
                        "option",
                        { value: "" },
                        "Apply existing tag...",
                      ),
                      allTags
                        .filter((t) => !(editingItem.tags || []).includes(t))
                        .map((t) =>
                          React.createElement(
                            "option",
                            { key: t, value: t },
                            t,
                          ),
                        ),
                    ),
                    React.createElement("input", {
                      type: "text",
                      placeholder: "Or type new tag & press Enter...",
                      className:
                        "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white transition-colors",
                      onKeyDown: (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = e.target.value.trim();
                          if (val) {
                            const currentTags = editingItem.tags || [];
                            if (!currentTags.includes(val)) {
                              setEditingItem({
                                ...editingItem,
                                tags: [...currentTags, val],
                              });
                            }
                            e.target.value = "";
                          }
                        }
                      },
                    }),
                  ),
                ),
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "label",
                  {
                    className:
                      "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1",
                  },
                  "Web Link (erpCode)",
                ),
                React.createElement("input", {
                  type: "text",
                  value: editingItem.erpCode,
                  onChange: (e) =>
                    setEditingItem({ ...editingItem, erpCode: e.target.value }),
                  className:
                    "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-sm font-mono",
                  placeholder: "https://",
                }),
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "label",
                  {
                    className:
                      "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1",
                  },
                  "Image URL (note)",
                ),
                React.createElement("input", {
                  type: "text",
                  value: editingItem.note,
                  onChange: (e) =>
                    setEditingItem({ ...editingItem, note: e.target.value }),
                  className:
                    "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-sm font-mono",
                  placeholder: "https://",
                }),
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "label",
                  {
                    className:
                      "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1",
                  },
                  "Spectral Data (31 values, comma sep)",
                ),
                React.createElement("textarea", {
                  value: editingItem.spectralStr,
                  onChange: (e) =>
                    setEditingItem({
                      ...editingItem,
                      spectralStr: e.target.value,
                    }),
                  className:
                    "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-xs font-mono h-24 custom-scrollbar mb-2",
                  placeholder: "0.21,0.22,...",
                }),
              ),
              editingItem.spectralStr &&
                editingItem.spectralStr.split(",").length === 31 &&
                React.createElement(
                  "div",
                  {
                    className:
                      "mt-2 pt-4 border-t border-slate-200 dark:border-neutral-800",
                  },
                  React.createElement(
                    "label",
                    {
                      className:
                        "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2",
                    },
                    "Spectral Graph & Meta",
                  ),
                  React.createElement(SpectralGraph, {
                    spectralData: editingItem.spectralStr
                      .split(",")
                      .map(Number),
                    theme: document.documentElement.classList.contains("dark")
                      ? "dark"
                      : "light",
                    meta: editingItem,
                  }),
                ),
              React.createElement(
                "div",
                {
                  className:
                    "flex gap-4 pt-4 mt-2 border-t border-slate-200 dark:border-neutral-800",
                },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    onClick: () => handleDeleteItem(editingItem),
                    className:
                      "px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded font-bold uppercase tracking-wider text-[11px] transition-colors",
                  },
                  React.createElement(Icon, {
                    name: "trash-2",
                    className: "w-3.5 h-3.5 inline mr-1",
                  }),
                  " ",
                  "Delete Item",
                ),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    onClick: () => setEditingItem(null),
                    className:
                      "ml-auto px-4 py-2 text-slate-500 hover:text-slate-800 font-bold uppercase tracking-wider text-[11px]",
                  },
                  "Cancel",
                ),
                React.createElement(
                  "button",
                  {
                    type: "submit",
                    className:
                      "px-6 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded font-bold uppercase tracking-wider text-[11px] shadow-sm",
                  },
                  React.createElement(Icon, {
                    name: "save",
                    className: "w-3.5 h-3.5 inline mr-1",
                  }),
                  " ",
                  "Save",
                ),
              ),
            ),
          ),
        ),
        document.body,
      ),
  );
};
const FileManager = ({ linkedFiles, setLinkedFiles, onClose }) => {
  const [newFileName, setNewFileName] = useState("");
  const handleAddFile = () => {
    const trimmed = newFileName.trim();
    if (trimmed && !linkedFiles.includes(trimmed)) {
      setLinkedFiles([...linkedFiles, trimmed]);
      setNewFileName("");
    }
  };
  const handleRemoveFile = async (fileToRemove) => {
    setLinkedFiles(linkedFiles.filter((f) => f !== fileToRemove));
  };
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4",
    },
    React.createElement(
      "div",
      {
        className:
          "bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-slate-200 dark:border-neutral-800 overflow-hidden",
      },
      React.createElement(
        "div",
        {
          className:
            "flex items-center justify-between p-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50",
        },
        React.createElement(
          "h2",
          {
            className:
              "text-lg font-bold text-slate-800 dark:text-neutral-100 flex items-center gap-2",
          },
          React.createElement(Icon, {
            name: "folder",
            className: "w-5 h-5 text-blue-500",
          }),
          "Linked CSV Files",
        ),
        React.createElement(
          "button",
          {
            onClick: onClose,
            className:
              "p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-500 transition-colors",
          },
          React.createElement(Icon, { name: "x", className: "w-5 h-5" }),
        ),
      ),
      React.createElement(
        "div",
        { className: "p-4 flex-1 overflow-y-auto" },
        React.createElement(
          "p",
          { className: "text-sm text-slate-600 dark:text-neutral-400 mb-4" },
          "These CSV files will be automatically loaded when the application starts. When you export the app state to HTML, this list is saved.",
        ),
        React.createElement(
          "div",
          { className: "space-y-2 mb-6" },
          linkedFiles.map((file) =>
            React.createElement(
              "div",
              {
                key: file,
                className:
                  "flex items-center justify-between p-2 bg-slate-50 dark:bg-neutral-800/50 rounded-lg border border-slate-200 dark:border-neutral-700",
              },
              React.createElement(
                "div",
                {
                  className:
                    "flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-neutral-300",
                },
                React.createElement(Icon, {
                  name: "file-text",
                  className: "w-4 h-4 text-slate-400",
                }),
                file,
              ),
              React.createElement(
                "button",
                {
                  onClick: () => handleRemoveFile(file),
                  className:
                    "p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors",
                  title: "Remove file link",
                },
                React.createElement(Icon, {
                  name: "trash-2",
                  className: "w-4 h-4",
                }),
              ),
            ),
          ),
          linkedFiles.length === 0 &&
            React.createElement(
              "div",
              {
                className:
                  "text-center p-4 text-sm text-slate-500 dark:text-neutral-500 italic border border-dashed border-slate-300 dark:border-neutral-700 rounded-lg",
              },
              "No files linked.",
            ),
        ),
        React.createElement(
          "div",
          { className: "flex gap-2" },
          React.createElement("input", {
            type: "text",
            value: newFileName,
            onChange: (e) => setNewFileName(e.target.value),
            placeholder: "e.g. Uniboard.csv",
            className:
              "flex-1 px-3 py-2 text-sm bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-neutral-200",
            onKeyDown: (e) => {
              if (e.key === "Enter") handleAddFile();
            },
          }),
          React.createElement(
            "button",
            {
              onClick: handleAddFile,
              disabled: !newFileName.trim(),
              className:
                "px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1",
            },
            React.createElement(Icon, { name: "plus", className: "w-4 h-4" }),
            "Add",
          ),
        ),
      ),
    ),
  );
};
const AppUI = ({
  theme,
  setTheme,
  activeTab,
  setActiveTab,
  names,
  setNames,
  adjectives,
  setAdjectives,
  dictNotes,
  setDictNotes,
  dictTags,
  setDictTags,
  globalTags,
  savedColors,
  setSavedColors,
  groupSettings,
  setGroupSettings,
  palette,
  setPalette,
  savedPalettes,
  setSavedPalettes,
  selectedSavedPaletteId,
  setSelectedSavedPaletteId,
  isSavingPalette,
  setIsSavingPalette,
  newPaletteName,
  setNewPaletteName,
  searchQuery,
  setSearchQuery,
  selectedIds,
  setSelectedIds,
  observer,
  setObserver,
  illuminant,
  setIlluminant,
  handleBatchTag,
  handleBatchRemoveTag,
  viewportVisibility,
  setViewportVisibility,
  showVisibilityMenu,
  setShowVisibilityMenu,
  visibilityMenuRef,
  viewportSearchQuery,
  setViewportSearchQuery,
  viewMode,
  setViewMode,
  swatchLayout,
  setSwatchLayout,
  swatchZoom,
  setSwatchZoom,
  viewportTagFilter,
  setViewportTagFilter,
  filterL,
  setFilterL,
  filterC,
  setFilterC,
  filterH,
  setFilterH,
  filterPt,
  scrubL,
  setScrubL,
  scrubC,
  setScrubC,
  scrubH,
  setScrubH,
  setTemporarySpectral,
  compSlotA,
  setCompSlotA,
  compSlotB,
  setCompSlotB,
  showFullscreenPreview,
  setShowFullscreenPreview,
  showCompareFullscreen,
  setShowCompareFullscreen,
  showFullscreenSpectral,
  setShowFullscreenSpectral,
  showFullscreenPalette,
  setShowFullscreenPalette,
  showCompareDivider,
  setShowCompareDivider,
  showHelpPanel,
  setShowHelpPanel,
  showDatabaseManager,
  setShowDatabaseManager,
  showFileManager,
  setShowFileManager,
  showAveryModal,
  setShowAveryModal,
  averyPrintSourceType,
  setAveryPrintSourceType,
  averySourceItems,
  selectedPrintIds,
  setSelectedPrintIds,
  printConfigs,
  setPrintConfigs,
  printStartIndex,
  setPrintStartIndex,
  printLabelSwatches,
  setPrintLabelSwatches,
  printLabelNames,
  setPrintLabelNames,
  printLabelErp,
  setPrintLabelErp,
  printLabelHex,
  setPrintLabelHex,
  printLabelOklch,
  setPrintLabelOklch,
  printLabelBorders,
  setPrintLabelBorders,
  printLabelDoorProfile,
  setPrintLabelDoorProfile,
  printLabelSheen,
  setPrintLabelSheen,
  printLabelVisualTexture,
  setPrintLabelVisualTexture,
  printLabelTactileTexture,
  setPrintLabelTactileTexture,
  printLabelMaterial,
  setPrintLabelMaterial,
  generateAveryPages,
  getPaletteItemInfo,
  linkedFiles,
  setLinkedFiles,
  colorData,
  filteredColorData,
  updateColorData,
  visualizeData,
  setVisualizeData,
  history,
  isUndoing,
  currentStateStr,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  lockedNouns,
  lockedAdjectives,
  filteredViewData,
  handleUpdate,
  handlePointClick,
  handleVisualize,
  crosshair,
  gridData,
  isLight,
  activeColorObj,
  labValues,
  colorGroup,
  isOutOfGamut,
  crosshairHex,
  activeData,
  activeAdj,
  activeName,
  activeNotes,
  isPinned,
  isAnchorLocked,
  isInputDisabled,
  activeItemId,
  activeTags,
  addTag,
  removeTag,
  adjInputClass,
  nounInputClass,
  deltaEOK,
  deltaE2000,
  tabs,
  searchResults,
  handleSaveApp,
  handleSystemExport,
  handleImportCSV,
  handleSyncToCSV,
  addToPalette,
  removeFromPalette,
  saveCurrentPalette,
  confirmSavePalette,
  cancelSavePalette,
  loadPalette,
  deleteSavedPalette,
  replaceInPalette,
  onAdjChange,
  onNameChange,
  onNotesChange,
  toggleAnchorLock,
  togglePin,
  updateSavedColor,
  spectral,
  tetheringPinId,
  setTetheringPinId,
}) => {
  const isDark = theme === "dark";
  const [showViewFilters, setShowViewFilters] = useState(false);

  const handlePrintAvery = () => {
    try {
      const printContainer = document.querySelector('.print-avery-container');
      if (!printContainer) {
        window.print();
        return;
      }
      
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Your browser blocked the pop-up print window. Standard printing will be used. Please enable pop-ups for this site, or open the app in a new tab to bypass this iframe restriction.");
        window.print();
        return;
      }
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>SAMI Color Labels</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
              body, html {
                margin: 0 !important;
                padding: 0 !important;
                width: 8.5in !important;
                height: 11in !important;
                background: white !important;
                font-family: 'Bicyclette', 'Byciclette', 'Inter', system-ui, sans-serif !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page {
                size: 8.5in 11in;
                margin: 0;
              }
              body {
                background-color: #f1f5f9;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px 0;
                overflow-y: auto;
              }
              .print-avery-container {
                display: block !important;
                background: white !important;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                border-radius: 8px;
                padding: 0;
                margin-bottom: 20px;
              }
              
              /* Print only styles to remove background, shadows and custom margins */
              @media print {
                body {
                  background: white !important;
                  padding: 0 !important;
                }
                .print-avery-container {
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  margin-bottom: 0 !important;
                }
                .no-print {
                  display: none !important;
                }
              }
              
              .no-print-header {
                width: 8.5in;
                background: #1e293b;
                color: #f8fafc;
                padding: 12px 20px;
                border-radius: 8px;
                margin-bottom: 12px;
                box-sizing: border-box;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              }
              .no-print-header h1 {
                margin: 0;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 0.05em;
              }
              .print-btn {
                background: #10b981;
                color: white;
                border: none;
                padding: 6px 16px;
                border-radius: 6px;
                font-weight: 700;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
              }
              .print-btn:hover {
                background: #059669;
              }
              
              .avery-print-page {
                display: grid !important;
                grid-template-columns: 4in 4in !important;
                column-gap: 0.188in !important;
                row-gap: 0in !important;
                width: 8.5in !important;
                height: 11in !important;
                padding-top: 0.25in !important;
                padding-bottom: 0.25in !important;
                padding-left: 0.156in !important;
                padding-right: 0.156in !important;
                box-sizing: border-box !important;
                page-break-after: always !important;
                page-break-inside: avoid !important;
                align-content: start !important;
                background: white !important;
              }
              .avery-label-cell {
                width: 4in !important;
                height: 1.5in !important;
                box-sizing: border-box !important;
                padding: 0 !important;
                display: flex !important;
                overflow: hidden !important;
                background: white !important;
                border-radius: 0.125in !important;
                font-family: 'Bicyclette', 'Byciclette', 'Inter', system-ui, sans-serif !important;
              }
              .avery-label-border {
                border: 1px dashed rgba(180, 169, 158, 0.4) !important;
              }
              .avery-label-borderless {
                border: 1px solid transparent !important;
              }
              .sami-sidebar {
                width: 0.45in !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .sami-sidebar span {
                transform: rotate(-90deg) !important;
                font-weight: 900 !important;
                font-size: 13pt !important;
                letter-spacing: 0.1em !important;
              }
              .sami-content {
                flex-grow: 1 !important;
                padding: 0.1in 0.15in !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                height: 100% !important;
                box-sizing: border-box !important;
              }
              .sami-row {
                display: flex !important;
                align-items: baseline !important;
                font-size: 6.5pt !important;
                line-height: 1.1 !important;
                width: 100% !important;
                position: relative !important;
              }
              .sami-label {
                font-weight: 800 !important;
                width: 0.85in !important;
                flex-shrink: 0 !important;
                color: #1a201c !important;
                font-size: 6.5pt !important;
              }
              .sami-label.right {
                width: auto !important;
                margin-left: auto !important;
                padding-left: 0.1in !important;
                padding-right: 0.05in !important;
              }
              .sami-value {
                font-weight: 500 !important;
                color: #2b332d !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
              }
              .sami-value.sami-lg {
                font-size: 9.5pt !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
              }
              .sami-line {
                flex-grow: 1 !important;
                border-bottom: 0.5px solid #a0a8a3 !important;
                min-width: 0.5in !important;
                margin-bottom: 1pt !important;
              }
              .sami-id {
                margin-left: auto !important;
                font-size: 6pt !important;
                font-style: italic !important;
                color: #88908a !important;
              }
            </style>
          </head>
          <body>
            <div class="no-print-header no-print">
              <h1>SAMI COLOR LABEL PRINT VIEW</h1>
              <button class="print-btn" onclick="window.print()">Print This Page</button>
            </div>
            <div class="print-avery-container">
              ${printContainer.innerHTML}
            </div>
            <script>
              window.addEventListener('load', () => {
                setTimeout(() => {
                  window.print();
                }, 500);
              });
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (e) {
      console.error(e);
      window.print();
    }
  };
  return React.createElement(
    "div",
    { className: "flex flex-col md:flex-row h-screen overflow-hidden" },
    React.createElement(
      "aside",
      {
        className:
          "w-full md:w-96 flex flex-col bg-white dark:bg-neutral-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-800 z-10 h-[45vh] md:h-screen overflow-y-auto custom-scrollbar shrink-0",
      },
      React.createElement(
        "div",
        {
          className:
            "p-4 border-b border-slate-200 dark:border-neutral-800 flex flex-col gap-3 sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-20",
        },
        React.createElement(
          "div",
          { className: "flex justify-between items-center" },
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(
              "h1",
              {
                className:
                  "text-lg font-black tracking-tight text-slate-800 dark:text-neutral-100 leading-none truncate pr-2",
              },
              "The Color",
              React.createElement(
                "span",
                { style: { color: "var(--c-dark)" } },
                "SAMI",
              ),
              "ficator",
            ),
            React.createElement(
              "button",
              {
                onClick: () => setShowFileManager(true),
                className:
                  "p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-full transition-colors",
                title: "Manage Linked CSV Files",
              },
              React.createElement(Icon, {
                name: "folder",
                className: "w-4 h-4",
              }),
            ),
            React.createElement(
              "button",
              {
                onClick: () => setShowHelpPanel(true),
                className:
                  "p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-full transition-colors",
                title: "Help & Guide",
              },
              React.createElement(Icon, {
                name: "help-circle",
                className: "w-4 h-4",
              }),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "relative" },
          React.createElement(Icon, {
            name: "search",
            className: "absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400",
          }),
          React.createElement("input", {
            type: "text",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            placeholder: "Omnisearch names, codes, notes...",
            className:
              "w-full bg-slate-100 dark:bg-neutral-800 border border-transparent rounded-md pl-8 pr-8 py-2 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-neutral-900 transition-all",
          }),
          searchQuery &&
            React.createElement(
              "button",
              {
                onClick: () => setSearchQuery(""),
                className:
                  "absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
              },
              React.createElement(Icon, {
                name: "x",
                className: "w-3.5 h-3.5",
              }),
            ),
        ),
      ),
      searchQuery
        ? React.createElement(
            "div",
            { className: "flex-1 overflow-y-auto p-2 flex flex-col gap-1" },
            searchResults.length === 0
              ? React.createElement(
                  "div",
                  {
                    className:
                      "p-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center",
                  },
                  "No results found",
                )
              : searchResults.map((res) =>
                  React.createElement(
                    "button",
                    {
                      key: res.key,
                      onClick: () => {
                        handleUpdate(
                          [res.L, res.C, res.H],
                          res.spectral,
                          res.commercial,
                        );
                        setSearchQuery("");
                      },
                      className:
                        "flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded-xl text-left transition-all border border-transparent hover:border-slate-200 dark:hover:border-neutral-700 group",
                    },
                    res.image
                      ? React.createElement("div", {
                          className:
                            "w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 shrink-0 group-hover:scale-105 transition-transform bg-cover bg-center",
                          style: { backgroundImage: `url(${res.image})` },
                        })
                      : React.createElement("div", {
                          className:
                            "w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 shrink-0 group-hover:scale-105 transition-transform",
                          style: { backgroundColor: res.color },
                        }),
                    React.createElement(
                      "div",
                      { className: "min-w-0 flex-1" },
                      React.createElement(
                        "div",
                        { className: "flex items-center gap-1.5" },
                        React.createElement(
                          "div",
                          {
                            className:
                              "text-xs font-black uppercase tracking-widest text-slate-800 dark:text-neutral-200 truncate",
                          },
                          res.displayName,
                        ),
                        res.note === "Verified Spectral Data" &&
                          React.createElement(Icon, {
                            name: "check-circle",
                            className: "w-3.5 h-3.5 text-emerald-500 shrink-0",
                            title: "Verified with Spectral Data",
                          }),
                      ),
                      React.createElement(
                        "div",
                        { className: "flex items-center gap-2 mt-1" },
                        res.erpCode &&
                          React.createElement(
                            "span",
                            {
                              className:
                                "text-[9px] font-mono text-sky-600 dark:text-sky-400 font-bold",
                            },
                            res.erpCode,
                          ),
                        React.createElement(
                          "span",
                          {
                            className:
                              "text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500",
                          },
                          res.erpCode ? `\u2022 ${res.type}` : res.type,
                        ),
                      ),
                      res.note &&
                        res.note !== "Verified Spectral Data" &&
                        React.createElement(
                          "div",
                          {
                            className:
                              "text-[10px] text-slate-500 dark:text-neutral-400 italic mt-1 truncate",
                          },
                          res.note,
                        ),
                    ),
                  ),
                ),
          )
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "div",
              { className: "p-3 bg-white dark:bg-neutral-900" },
              React.createElement(
                "div",
                {
                  className:
                    "h-44 w-full relative rounded-2xl shadow-inner border border-black/5 dark:border-white/5 overflow-hidden transition-colors duration-300",
                  style: { backgroundColor: crosshairHex },
                },
                isOutOfGamut &&
                  React.createElement("div", {
                    className: "absolute inset-0 pointer-events-none",
                    style: {
                      backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)",
                    },
                  }),
                React.createElement(
                  "div",
                  {
                    className: "absolute top-4 left-5 z-10 pointer-events-none",
                    style: { color: isLight ? "#010D00" : "#F2E8DF" },
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-xl font-black tracking-tight drop-shadow-md font-mono",
                    },
                    crosshair?.activeErpCode || "",
                  ),
                  isOutOfGamut &&
                    React.createElement(
                      "div",
                      {
                        className:
                          "mt-1 inline-block px-1.5 py-0.5 bg-red-500/90 text-white text-[8px] font-bold uppercase tracking-widest rounded shadow-sm backdrop-blur-sm border border-red-400/30",
                      },
                      "Out of sRGB Gamut",
                    ),
                ),
                (getGlobalDuplicate(
                  names,
                  adjectives,
                  crosshair?.activeSavedColor?.type === "pin"
                    ? crosshair.activeSavedColor.id
                    : crosshair?.nearestAdjId,
                  activeAdj,
                  savedColors,
                  crosshair?.activeSavedColor?.type === "pin"
                    ? !!crosshair.activeSavedColor.adjOverride
                    : true,
                  crosshair?.activeSavedColor?.type === "pin"
                    ? crosshair?.nearestAdjId
                    : null,
                ) ||
                  getGlobalDuplicate(
                    names,
                    adjectives,
                    crosshair?.activeSavedColor?.type === "pin"
                      ? crosshair.activeSavedColor.id
                      : crosshair?.nearestAnchorId,
                    activeName,
                    savedColors,
                    crosshair?.activeSavedColor?.type === "pin"
                      ? !!crosshair.activeSavedColor.nameOverride
                      : true,
                    crosshair?.activeSavedColor?.type === "pin"
                      ? crosshair?.nearestAnchorId
                      : null,
                  )) &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white text-[9px] font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1.5 z-40 backdrop-blur-sm uppercase tracking-wider border border-red-400/30",
                    },
                    React.createElement(Icon, {
                      name: "alert-triangle",
                      className: "w-3 h-3",
                    }),
                    "Conflict",
                  ),
                React.createElement(
                  "div",
                  {
                    className: "absolute top-3.5 right-4 flex gap-1 z-30",
                    style: { color: isLight ? "#010D00" : "#F2E8DF" },
                  },
                  React.createElement(
                    "button",
                    {
                      onClick: toggleAnchorLock,
                      className: `p-1.5 rounded-lg transition-colors ${isAnchorLocked ? "opacity-100" : "opacity-60 hover:opacity-100"}`,
                      title: isAnchorLocked
                        ? "Unlock Grid Anchor"
                        : "Lock Grid Anchor",
                    },
                    React.createElement(Icon, {
                      name: isAnchorLocked ? "lock" : "unlock",
                      className: "w-3.5 h-3.5 drop-shadow-sm",
                    }),
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: togglePin,
                      className: `p-1.5 rounded-lg transition-colors ${isPinned ? "opacity-100" : "opacity-60 hover:opacity-100"}`,
                      title: isPinned
                        ? "Remove Free Pin"
                        : "Pin Free Coordinate",
                    },
                    React.createElement(Icon, {
                      name: "map-pin",
                      className: "w-3.5 h-3.5 drop-shadow-sm",
                    }),
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => setShowFullscreenPreview(true),
                      className:
                        "p-1.5 rounded-lg transition-colors opacity-60 hover:opacity-100",
                    },
                    React.createElement(Icon, {
                      name: "maximize",
                      className: "w-3.5 h-3.5 drop-shadow-sm",
                    }),
                  ),
                  isOutOfGamut &&
                    React.createElement(
                      "div",
                      {
                        className: "p-1.5 text-red-500 dark:text-red-400",
                        title: "Out of sRGB Gamut",
                      },
                      React.createElement(Icon, {
                        name: "alert-triangle",
                        className: "w-3.5 h-3.5 drop-shadow-sm",
                      }),
                    ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "absolute inset-0 flex flex-col items-center justify-center p-6 mt-1 z-20 pointer-events-none",
                    style: { color: isLight ? "#010D00" : "#F2E8DF" },
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "relative w-full flex justify-center items-center group/adj",
                    },
                    React.createElement("input", {
                      type: "text",
                      value: activeAdj,
                      onChange: (e) => onAdjChange(e.target.value),
                      placeholder: "Adjective",
                      className: adjInputClass,
                      disabled:
                        isInputDisabled ||
                        (crosshair?.activeSavedColor?.type !== "pin" &&
                          lockedAdjectives[crosshair?.nearestAdjId]),
                    }),
                    crosshair?.activeSavedColor?.type === "pin" &&
                      crosshair.activeSavedColor.adjOverride &&
                      React.createElement(
                        "button",
                        {
                          onClick: () => updateSavedColor("adjOverride", ""),
                          className: `absolute right-0 opacity-0 group-hover/adj:opacity-100 transition-opacity p-1 rounded-full pointer-events-auto ${isLight ? "hover:bg-black/10" : "hover:bg-white/10"}`,
                          title: "Revert to inherited adjective",
                        },
                        React.createElement(Icon, {
                          name: "rotate-ccw",
                          className: "w-3 h-3",
                        }),
                      ),
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "relative w-full flex justify-center items-center group/noun",
                    },
                    React.createElement("input", {
                      type: "text",
                      value: activeName,
                      onChange: (e) => onNameChange(e.target.value),
                      placeholder: "Noun",
                      className: nounInputClass,
                      disabled:
                        isInputDisabled ||
                        (crosshair?.activeSavedColor?.type !== "pin" &&
                          lockedNouns[crosshair?.nearestAnchorId]),
                    }),
                    crosshair?.activeSavedColor?.type === "pin" &&
                      crosshair.activeSavedColor.nameOverride &&
                      React.createElement(
                        "button",
                        {
                          onClick: () => updateSavedColor("nameOverride", ""),
                          className: `absolute right-0 opacity-0 group-hover/noun:opacity-100 transition-opacity p-1 rounded-full pointer-events-auto ${isLight ? "hover:bg-black/10" : "hover:bg-white/10"}`,
                          title: "Revert to inherited noun",
                        },
                        React.createElement(Icon, {
                          name: "rotate-ccw",
                          className: "w-4 h-4",
                        }),
                      ),
                  ),
                  crosshair?.snapDist > 1e-4 &&
                    crosshair?.snapTarget &&
                    !crosshair.exactSavedColor &&
                    React.createElement(
                      "button",
                      {
                        onClick: () =>
                          handleUpdate([
                            crosshair.snapTarget.L,
                            crosshair.snapTarget.C,
                            crosshair.snapTarget.H,
                          ]),
                        className: `mt-2 px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full border transition-all flex items-center justify-center gap-1.5 active:scale-95 pointer-events-auto`,
                        style: {
                          color: isLight ? "#010D00" : "#F2E8DF",
                          borderColor: isLight
                            ? "rgba(1,13,0,0.35)"
                            : "rgba(242,232,223,0.50)",
                          backgroundColor: "transparent",
                        },
                      },
                      React.createElement(Icon, {
                        name: "magnet",
                        className: "w-3 h-3",
                      }),
                      " Snap \u0394Eok:",
                      " ",
                      (crosshair.snapDist * 100).toFixed(2),
                    ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "absolute bottom-4 left-5 pointer-events-none z-10",
                    style: { color: isLight ? "#010D00" : "#F2E8DF" },
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-[8px] font-black uppercase tracking-widest opacity-80 drop-shadow-md mb-0.5",
                    },
                    "CIELAB (",
                    spectral ? `${illuminant}/${observer}\xB0` : "D50/2\xB0",
                    ")",
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-[10px] font-bold tracking-tight font-mono drop-shadow-md",
                    },
                    labValues,
                  ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "absolute bottom-4 right-5 pointer-events-none z-10",
                    style: { color: isLight ? "#010D00" : "#F2E8DF" },
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-[10px] font-black uppercase tracking-widest opacity-80 drop-shadow-md text-right",
                    },
                    colorGroup,
                  ),
                ),
              ),
            ),
            React.createElement(
              "div",
              {
                className:
                  "p-5 flex flex-col gap-6 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900",
              },
              React.createElement(SliderGroup, {
                label: "Lightness",
                value: scrubL,
                min: 0,
                max: 1,
                step: 0.001,
                onChange: (v) => {
                  setScrubL(v);
                  setTemporarySpectral(null);
                },
                icon: "sun",
              }),
              React.createElement(SliderGroup, {
                label: "Chroma",
                value: scrubC,
                min: 0,
                max: 0.4,
                step: 0.001,
                onChange: (v) => {
                  setScrubC(v);
                  setTemporarySpectral(null);
                },
                icon: "zap",
              }),
              React.createElement(SliderGroup, {
                label: "Hue",
                value: scrubH,
                min: 0,
                max: 360,
                step: 0.1,
                onChange: (v) => {
                  setScrubH(v);
                  setTemporarySpectral(null);
                },
                icon: "compass",
              }),
              crosshair?.activeSavedColor?.type === "pin" &&
                React.createElement(
                  "div",
                  {
                    className:
                      "mt-4 pt-4 border-t border-slate-100 dark:border-neutral-800",
                  },
                  React.createElement(
                    "div",
                    { className: "flex items-center justify-between mb-2" },
                    React.createElement(
                      "span",
                      {
                        className:
                          "text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500",
                      },
                      "Tethering",
                    ),
                    tetheringPinId === crosshair.activeSavedColor.id
                      ? React.createElement(
                          "button",
                          {
                            onClick: () => setTetheringPinId(null),
                            className:
                              "text-[9px] font-bold uppercase text-red-500 hover:text-red-600 flex items-center gap-1",
                          },
                          React.createElement(Icon, {
                            name: "x",
                            className: "w-3 h-3",
                          }),
                          " Cancel",
                        )
                      : React.createElement(
                          "button",
                          {
                            onClick: () =>
                              setTetheringPinId(crosshair.activeSavedColor.id),
                            className:
                              "text-[9px] font-bold uppercase text-sky-500 hover:text-sky-600 flex items-center gap-1",
                          },
                          React.createElement(Icon, {
                            name: "link",
                            className: "w-3 h-3",
                          }),
                          " Change Source",
                        ),
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "bg-slate-50 dark:bg-neutral-800/50 rounded-lg p-2 border border-slate-100 dark:border-neutral-800",
                    },
                    React.createElement(
                      "div",
                      {
                        className:
                          "text-[9px] text-slate-500 dark:text-neutral-400 flex items-center gap-2",
                      },
                      React.createElement(Icon, {
                        name: "info",
                        className: "w-3 h-3",
                      }),
                      tetheringPinId === crosshair.activeSavedColor.id
                        ? React.createElement(
                            "span",
                            { className: "text-sky-500 animate-pulse" },
                            "Click any point on the map to tether...",
                          )
                        : React.createElement(
                            "span",
                            null,
                            "Inheriting from:",
                            " ",
                            React.createElement(
                              "b",
                              {
                                className:
                                  "text-slate-700 dark:text-neutral-200 uppercase",
                              },
                              activeData?.inherited?.source === "pin"
                                ? `Pin ${activeData.inherited.sourceId.substring(0, 8)}`
                                : `Anchor ${activeData?.inherited?.sourceId || "None"}`,
                            ),
                          ),
                    ),
                  ),
                ),
            ),
            React.createElement(
              CollapsiblePanel,
              { title: "Conversions", icon: "sliders", defaultOpen: false },
              React.createElement(ColorConverter, {
                crosshair: {
                  rawL: scrubL,
                  rawC: scrubC,
                  rawH: scrubH,
                  L: scrubL,
                  C: scrubC,
                  H: scrubH,
                  activeSavedColor: crosshair.activeSavedColor,
                  temporarySpectral: crosshair.temporarySpectral,
                },
                onEdit: handleUpdate,
                observer,
                setObserver,
                illuminant,
                setIlluminant,
                colorData,
              }),
            ),
            React.createElement(
              CollapsiblePanel,
              {
                title: "Commercial Matches",
                icon: "palette",
                defaultOpen: false,
              },
              React.createElement(CommercialMatches, {
                crosshair: {
                  rawL: scrubL,
                  rawC: scrubC,
                  rawH: scrubH,
                  L: scrubL,
                  C: scrubC,
                  H: scrubH,
                  activeSavedColor: crosshair.activeSavedColor,
                },
                colorData,
                onSelectColor: handlePointClick,
              }),
            ),
            crosshair?.activeSavedColor?.spectral &&
              React.createElement(
                CollapsiblePanel,
                {
                  title: "Spectral Response",
                  icon: "activity",
                  defaultOpen: false,
                },
                React.createElement(SpectralGraph, {
                  spectralData: crosshair.activeSavedColor.spectral,
                  theme,
                  meta: {
                    illuminant:
                      crosshair.activeSavedColor.illuminant || illuminant,
                    observer: crosshair.activeSavedColor.observer || observer,
                    measurementMethod:
                      crosshair.activeSavedColor.measurementMethod,
                    measurementDate: crosshair.activeSavedColor.measurementDate,
                    measurementDevice:
                      crosshair.activeSavedColor.measurementDevice,
                  },
                }),
              ),
            React.createElement(
              CollapsiblePanel,
              { title: "Harmonies", icon: "aperture", defaultOpen: false },
              React.createElement(ColorHarmonies, {
                L: scrubL,
                C: scrubC,
                H: scrubH,
                handlePointClick,
              }),
            ),
            React.createElement(
              CollapsiblePanel,
              {
                title: "Palette Playground",
                icon: "palette",
                defaultOpen: false,
              },
              React.createElement(
                "div",
                { className: "flex flex-col gap-3" },
                React.createElement(
                  "div",
                  { className: "flex items-center justify-between gap-2" },
                  isSavingPalette
                    ? React.createElement(
                        "div",
                        { className: "flex items-center gap-2 w-full" },
                        React.createElement("input", {
                          type: "text",
                          value: newPaletteName,
                          onChange: (e) => setNewPaletteName(e.target.value),
                          className:
                            "flex-1 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-neutral-300 outline-none focus:border-sky-500",
                          placeholder: "Palette name...",
                          autoFocus: true,
                          onKeyDown: (e) => {
                            if (e.key === "Enter") confirmSavePalette();
                            if (e.key === "Escape") cancelSavePalette();
                          },
                        }),
                        React.createElement(
                          "button",
                          {
                            onClick: confirmSavePalette,
                            disabled: !newPaletteName.trim(),
                            className:
                              "px-2 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:dark:bg-neutral-700 text-white rounded text-xs transition-colors",
                            title: "Confirm Save",
                          },
                          React.createElement(Icon, {
                            name: "check",
                            className: "w-3.5 h-3.5",
                          }),
                        ),
                        React.createElement(
                          "button",
                          {
                            onClick: cancelSavePalette,
                            className:
                              "px-2 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-slate-700 dark:text-neutral-300 rounded text-xs transition-colors",
                            title: "Cancel",
                          },
                          React.createElement(Icon, {
                            name: "x",
                            className: "w-3.5 h-3.5",
                          }),
                        ),
                      )
                    : React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                          "select",
                          {
                            onChange: loadPalette,
                            className:
                              "flex-1 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-neutral-300 outline-none focus:border-sky-500",
                            value: selectedSavedPaletteId,
                          },
                          React.createElement(
                            "option",
                            { value: "", disabled: true },
                            "Load saved palette...",
                          ),
                          savedPalettes.map((p) =>
                            React.createElement(
                              "option",
                              { key: p.id, value: p.id },
                              p.name,
                              " (",
                              p.colors.length,
                              " colors)",
                            ),
                          ),
                        ),
                        selectedSavedPaletteId &&
                          React.createElement(
                            "button",
                            {
                              onClick: deleteSavedPalette,
                              className:
                                "px-2 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 rounded text-xs transition-colors flex items-center justify-center",
                              title: "Delete saved palette",
                            },
                            React.createElement(Icon, {
                              name: "trash-2",
                              className: "w-3.5 h-3.5",
                            }),
                          ),
                        React.createElement(
                          "button",
                          {
                            onClick: saveCurrentPalette,
                            disabled: palette.length === 0,
                            className:
                              "px-3 py-1.5 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 disabled:dark:bg-neutral-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5",
                            title: "Save current palette",
                          },
                          React.createElement(Icon, {
                            name: "save",
                            className: "w-3.5 h-3.5",
                          }),
                          "Save",
                        ),
                      ),
                ),
                React.createElement(
                  "div",
                  { className: "flex flex-wrap gap-2" },
                  palette.map((item) => {
                    const info = getPaletteItemInfo(item);
                    const displayName = info.displayName;
                    const h = info.hex;
                    return React.createElement(
                      "div",
                      {
                        key: item.id,
                        className:
                          "relative group w-10 h-10 rounded-md shadow-sm border border-slate-200 dark:border-neutral-700 cursor-pointer overflow-hidden flex-shrink-0",
                        style: { backgroundColor: h },
                        onClick: () => handleUpdate([item.L, item.C, item.H]),
                        title: `${displayName} (${item.erpCode})`,
                      },
                      React.createElement(
                        "button",
                        {
                          onClick: (e) => {
                            e.stopPropagation();
                            removeFromPalette(item.id);
                          },
                          className:
                            "absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-black/40 hover:bg-red-50 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10",
                        },
                        React.createElement(Icon, {
                          name: "x",
                          className: "w-2.5 h-2.5",
                        }),
                      ),
                      React.createElement(
                        "button",
                        {
                          onClick: (e) => {
                            e.stopPropagation();
                            replaceInPalette(item.id);
                          },
                          className:
                            "absolute bottom-0.5 left-0.5 w-3.5 h-3.5 bg-black/40 hover:bg-sky-500 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10",
                          title: "Replace with current color",
                        },
                        React.createElement(Icon, {
                          name: "refresh-cw",
                          className: "w-2 h-2",
                        }),
                      ),
                    );
                  }),
                  React.createElement(
                    "button",
                    {
                      onClick: addToPalette,
                      className:
                        "w-10 h-10 rounded-md border border-dashed border-slate-300 dark:border-neutral-700 flex items-center justify-center text-slate-400 hover:text-sky-500 hover:border-sky-500 transition-colors bg-slate-50 dark:bg-neutral-800/50",
                      title: "Add Current Color",
                    },
                    React.createElement(Icon, {
                      name: "plus",
                      className: "w-5 h-5",
                    }),
                  ),
                ),
                palette.length > 0 &&
                  React.createElement(
                    "div",
                    { className: "flex gap-2 mt-1" },
                    React.createElement(
                      "button",
                      {
                        onClick: () => setShowFullscreenPalette(true),
                        className:
                          "flex-1 py-1.5 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1",
                        title: "Fullscreen Palette",
                      },
                      React.createElement(Icon, {
                        name: "maximize",
                        className: "w-3.5 h-3.5",
                      }),
                      "Fullscreen",
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          setAveryPrintSourceType("palette");
                          setSelectedPrintIds(palette.map((item) => item.id));
                          setShowAveryModal(true);
                        },
                        className:
                          "flex-1 py-1.5 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1",
                        title: "Print Avery 5159 Labels",
                      },
                      React.createElement(Icon, {
                        name: "printer",
                        className: "w-3.5 h-3.5",
                      }),
                      "Print Avery",
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => setPalette([]),
                        className:
                          "py-1.5 px-3 border border-red-200 dark:border-red-900/30 hover:bg-red-50 text-red-500 font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center",
                        title: "Clear Palette",
                      },
                      React.createElement(Icon, {
                        name: "trash-2",
                        className: "w-3.5 h-3.5",
                      }),
                    ),
                  ),
              ),
            ),
            React.createElement(
              CollapsiblePanel,
              {
                title: "Delta E Comparisons",
                icon: "git-compare",
                defaultOpen: false,
              },
              React.createElement(
                "div",
                { className: "flex flex-col gap-4" },
                React.createElement(
                  "div",
                  { className: "flex gap-3" },
                  React.createElement(
                    "div",
                    {
                      className:
                        "flex-1 border border-slate-200 dark:border-neutral-700 rounded-lg overflow-hidden flex flex-col relative group h-24 bg-white dark:bg-neutral-900",
                    },
                    compSlotA
                      ? React.createElement(
                          React.Fragment,
                          null,
                          React.createElement(
                            "div",
                            {
                              className:
                                "flex-1 w-full relative cursor-pointer hover:opacity-90 transition-opacity",
                              onClick: () =>
                                handleUpdate([
                                  compSlotA.L,
                                  compSlotA.C,
                                  compSlotA.H,
                                ]),
                              style: {
                                backgroundColor: new Color("oklch", [
                                  compSlotA.L,
                                  compSlotA.C,
                                  compSlotA.H,
                                ])
                                  .clone()
                                  .toGamut({ space: "srgb" })
                                  .toString({ format: "hex" }),
                              },
                            },
                            !new Color("oklch", [
                              compSlotA.L,
                              compSlotA.C,
                              compSlotA.H,
                            ]).inGamut("srgb") &&
                              React.createElement("div", {
                                className:
                                  "absolute inset-0 pointer-events-none",
                                style: {
                                  backgroundImage:
                                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)",
                                },
                              }),
                          ),
                          React.createElement(
                            "div",
                            {
                              className:
                                "p-1.5 text-center text-[9px] font-mono text-slate-600 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-800/50 border-t border-slate-200 dark:border-neutral-700 cursor-pointer flex items-center justify-center gap-1",
                              onClick: () =>
                                handleUpdate([
                                  compSlotA.L,
                                  compSlotA.C,
                                  compSlotA.H,
                                ]),
                            },
                            !new Color("oklch", [
                              compSlotA.L,
                              compSlotA.C,
                              compSlotA.H,
                            ]).inGamut("srgb") &&
                              React.createElement(Icon, {
                                name: "alert-triangle",
                                className: "w-3 h-3 text-red-500",
                                title: "Out of sRGB Gamut",
                              }),
                            React.createElement(
                              "span",
                              null,
                              "L:",
                              compSlotA.L.toFixed(2),
                              " C:",
                              compSlotA.C.toFixed(2),
                              " H:",
                              compSlotA.H.toFixed(0),
                              "\xB0",
                            ),
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: (e) => {
                                e.stopPropagation();
                                setCompSlotA(null);
                              },
                              className:
                                "absolute top-1.5 right-1.5 bg-black/40 hover:bg-black/60 text-white p-1 rounded opacity-0 group-hover:opacity-100 z-10",
                            },
                            React.createElement(Icon, {
                              name: "x",
                              className: "w-3 h-3",
                            }),
                          ),
                        )
                      : React.createElement(
                          "button",
                          {
                            onClick: () =>
                              setCompSlotA({
                                L: scrubL,
                                C: scrubC,
                                H: scrubH,
                                erpCode: crosshair?.activeErpCode || "",
                                adjId: crosshair?.activeSavedColor
                                  ? crosshair.activeSavedColor.adjId
                                  : crosshair?.nearestAdjId,
                                nounId: crosshair?.activeSavedColor
                                  ? crosshair.activeSavedColor.anchorId
                                  : crosshair?.nearestAnchorId,
                                adjOverride:
                                  crosshair?.activeSavedColor?.adjOverride,
                                nameOverride:
                                  crosshair?.activeSavedColor?.nameOverride,
                                type: crosshair?.activeSavedColor?.type,
                                spectral: crosshair?.activeSavedColor?.spectral,
                              }),
                            className:
                              "w-full h-full flex flex-col items-center justify-center hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-400 hover:text-sky-500 transition-colors",
                          },
                          React.createElement(Icon, {
                            name: "plus",
                            className: "w-6 h-6 mb-1",
                          }),
                          React.createElement(
                            "span",
                            {
                              className:
                                "text-[9px] font-bold uppercase tracking-wider",
                            },
                            "Load Current",
                          ),
                        ),
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "flex-1 border border-slate-200 dark:border-neutral-700 rounded-lg overflow-hidden flex flex-col relative group h-24 bg-white dark:bg-neutral-900",
                    },
                    compSlotB
                      ? React.createElement(
                          React.Fragment,
                          null,
                          React.createElement(
                            "div",
                            {
                              className:
                                "flex-1 w-full relative cursor-pointer hover:opacity-90 transition-opacity",
                              onClick: () =>
                                handleUpdate([
                                  compSlotB.L,
                                  compSlotB.C,
                                  compSlotB.H,
                                ]),
                              style: {
                                backgroundColor: new Color("oklch", [
                                  compSlotB.L,
                                  compSlotB.C,
                                  compSlotB.H,
                                ])
                                  .clone()
                                  .toGamut({ space: "srgb" })
                                  .toString({ format: "hex" }),
                              },
                            },
                            !new Color("oklch", [
                              compSlotB.L,
                              compSlotB.C,
                              compSlotB.H,
                            ]).inGamut("srgb") &&
                              React.createElement("div", {
                                className:
                                  "absolute inset-0 pointer-events-none",
                                style: {
                                  backgroundImage:
                                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 10px, rgba(255,255,255,0.2) 10px, rgba(255,255,255,0.2) 20px)",
                                },
                              }),
                          ),
                          React.createElement(
                            "div",
                            {
                              className:
                                "p-1.5 text-center text-[9px] font-mono text-slate-600 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-800/50 border-t border-slate-200 dark:border-neutral-700 cursor-pointer flex items-center justify-center gap-1",
                              onClick: () =>
                                handleUpdate([
                                  compSlotB.L,
                                  compSlotB.C,
                                  compSlotB.H,
                                ]),
                            },
                            !new Color("oklch", [
                              compSlotB.L,
                              compSlotB.C,
                              compSlotB.H,
                            ]).inGamut("srgb") &&
                              React.createElement(Icon, {
                                name: "alert-triangle",
                                className: "w-3 h-3 text-red-500",
                                title: "Out of sRGB Gamut",
                              }),
                            React.createElement(
                              "span",
                              null,
                              "L:",
                              compSlotB.L.toFixed(2),
                              " C:",
                              compSlotB.C.toFixed(2),
                              " H:",
                              compSlotB.H.toFixed(0),
                              "\xB0",
                            ),
                          ),
                          React.createElement(
                            "button",
                            {
                              onClick: (e) => {
                                e.stopPropagation();
                                setCompSlotB(null);
                              },
                              className:
                                "absolute top-1.5 right-1.5 bg-black/40 hover:bg-black/60 text-white p-1 rounded opacity-0 group-hover:opacity-100 z-10",
                            },
                            React.createElement(Icon, {
                              name: "x",
                              className: "w-3 h-3",
                            }),
                          ),
                        )
                      : React.createElement(
                          "button",
                          {
                            onClick: () =>
                              setCompSlotB({
                                L: scrubL,
                                C: scrubC,
                                H: scrubH,
                                erpCode: crosshair?.activeErpCode || "",
                                adjId: crosshair?.activeSavedColor
                                  ? crosshair.activeSavedColor.adjId
                                  : crosshair?.nearestAdjId,
                                nounId: crosshair?.activeSavedColor
                                  ? crosshair.activeSavedColor.anchorId
                                  : crosshair?.nearestAnchorId,
                                adjOverride:
                                  crosshair?.activeSavedColor?.adjOverride,
                                nameOverride:
                                  crosshair?.activeSavedColor?.nameOverride,
                                type: crosshair?.activeSavedColor?.type,
                                spectral: crosshair?.activeSavedColor?.spectral,
                              }),
                            className:
                              "w-full h-full flex flex-col items-center justify-center hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-400 hover:text-sky-500 transition-colors",
                          },
                          React.createElement(Icon, {
                            name: "plus",
                            className: "w-6 h-6 mb-1",
                          }),
                          React.createElement(
                            "span",
                            {
                              className:
                                "text-[9px] font-bold uppercase tracking-wider",
                            },
                            "Load Current",
                          ),
                        ),
                  ),
                ),
                compSlotA &&
                  compSlotB &&
                  React.createElement(
                    "div",
                    { className: "flex flex-col gap-3" },
                    React.createElement(
                      "div",
                      { className: "grid grid-cols-2 gap-2 mt-2" },
                      React.createElement(
                        "div",
                        {
                          className:
                            "bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded p-2 text-center",
                        },
                        React.createElement(
                          "div",
                          {
                            className:
                              "text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1",
                          },
                          "Delta E OK",
                        ),
                        React.createElement(
                          "div",
                          {
                            className:
                              "text-lg font-mono font-black text-slate-800 dark:text-neutral-200",
                          },
                          deltaEOK,
                        ),
                      ),
                      React.createElement(
                        "div",
                        {
                          className:
                            "bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded p-2 text-center",
                        },
                        React.createElement(
                          "div",
                          {
                            className:
                              "text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1",
                          },
                          "Delta E 2000",
                        ),
                        React.createElement(
                          "div",
                          {
                            className:
                              "text-lg font-mono font-black text-slate-800 dark:text-neutral-200",
                          },
                          deltaE2000,
                        ),
                      ),
                    ),
                    compSlotA.spectral &&
                      compSlotB.spectral &&
                      React.createElement(
                        "div",
                        {
                          className:
                            "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded p-2",
                        },
                        React.createElement(
                          "div",
                          {
                            className:
                              "text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1",
                          },
                          React.createElement(Icon, {
                            name: "activity",
                            className: "w-3 h-3",
                          }),
                          " ",
                          "Metamerism Index (MI)",
                        ),
                        React.createElement(
                          "div",
                          { className: "grid grid-cols-3 gap-2 mt-1.5" },
                          React.createElement(
                            "div",
                            { className: "text-center" },
                            React.createElement(
                              "div",
                              {
                                className:
                                  "text-[8px] uppercase text-amber-600/70 dark:text-amber-500/70",
                              },
                              "Illuminant A",
                            ),
                            React.createElement(
                              "div",
                              {
                                className:
                                  "text-sm font-mono font-bold text-amber-800 dark:text-amber-300",
                              },
                              calculateDeltaEFromSpectral(
                                compSlotA.spectral,
                                compSlotB.spectral,
                                observer,
                                "A",
                              ).toFixed(2),
                            ),
                          ),
                          React.createElement(
                            "div",
                            {
                              className:
                                "text-center border-l border-amber-200 dark:border-amber-800/30",
                            },
                            React.createElement(
                              "div",
                              {
                                className:
                                  "text-[8px] uppercase text-amber-600/70 dark:text-amber-500/70",
                              },
                              "Illuminant F2",
                            ),
                            React.createElement(
                              "div",
                              {
                                className:
                                  "text-sm font-mono font-bold text-amber-800 dark:text-amber-300",
                              },
                              calculateDeltaEFromSpectral(
                                compSlotA.spectral,
                                compSlotB.spectral,
                                observer,
                                "F2",
                              ).toFixed(2),
                            ),
                          ),
                          React.createElement(
                            "div",
                            {
                              className:
                                "text-center border-l border-amber-200 dark:border-amber-800/30",
                            },
                            React.createElement(
                              "div",
                              {
                                className:
                                  "text-[8px] uppercase text-amber-600/70 dark:text-amber-500/70",
                              },
                              "Illuminant F11",
                            ),
                            React.createElement(
                              "div",
                              {
                                className:
                                  "text-sm font-mono font-bold text-amber-800 dark:text-amber-300",
                              },
                              calculateDeltaEFromSpectral(
                                compSlotA.spectral,
                                compSlotB.spectral,
                                observer,
                                "F11",
                              ).toFixed(2),
                            ),
                          ),
                        ),
                        React.createElement(
                          "div",
                          {
                            className:
                              "text-[8px] text-amber-600/80 dark:text-amber-500/80 mt-1.5 text-center italic",
                          },
                          "MI > 1.0 indicates a definite mismatch under the test illuminant.",
                        ),
                      ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => setShowCompareFullscreen(true),
                        className:
                          "w-full py-2.5 border border-slate-300 dark:border-neutral-700 hover:bg-slate-100 text-slate-700 dark:text-neutral-300 font-bold text-[10px] uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2",
                      },
                      React.createElement(Icon, {
                        name: "columns",
                        className: "w-3.5 h-3.5",
                      }),
                      " Fullscreen Compare",
                    ),
                  ),
              ),
            ),
            React.createElement(
              CollapsiblePanel,
              { title: "Tags", icon: "tag", defaultOpen: false },
              React.createElement(
                "div",
                { className: "flex flex-col gap-3" },
                React.createElement(
                  "div",
                  { className: "flex flex-wrap gap-1.5" },
                  activeTags.map((tag) =>
                    React.createElement(
                      "span",
                      {
                        key: tag,
                        className:
                          "flex items-center gap-1 bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border border-sky-200 dark:border-sky-500/30",
                      },
                      tag,
                      React.createElement(
                        "button",
                        {
                          onClick: () => removeTag(tag),
                          className:
                            "hover:text-red-500 transition-colors ml-0.5",
                          disabled: isInputDisabled,
                        },
                        React.createElement(Icon, {
                          name: "x",
                          className: "w-2.5 h-2.5",
                        }),
                      ),
                    ),
                  ),
                  activeTags.length === 0 &&
                    React.createElement(
                      "span",
                      { className: "text-[9px] text-slate-400 italic" },
                      "No tags added.",
                    ),
                ),
                React.createElement(
                  "div",
                  { className: "flex flex-col gap-2" },
                  React.createElement(
                    "select",
                    {
                      className:
                        "w-full bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded-lg p-2.5 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white transition-colors appearance-none cursor-pointer",
                      disabled: isInputDisabled,
                      onChange: (e) => {
                        if (e.target.value) {
                          addTag(e.target.value);
                          e.target.value = "";
                        }
                      },
                    },
                    React.createElement(
                      "option",
                      { value: "" },
                      "Apply existing tag...",
                    ),
                    globalTags.map((t) =>
                      React.createElement("option", { key: t, value: t }, t),
                    ),
                  ),
                  React.createElement("input", {
                    type: "text",
                    placeholder: "Or type new tag & press Enter...",
                    className:
                      "w-full bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded-lg p-2.5 text-[10px] uppercase font-bold tracking-wider focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white transition-colors",
                    disabled: isInputDisabled,
                    onKeyDown: (e) => {
                      if (e.key === "Enter" && e.target.value.trim()) {
                        addTag(e.target.value.trim());
                        e.target.value = "";
                      }
                    },
                  }),
                ),
              ),
            ),
            React.createElement(
              CollapsiblePanel,
              {
                title: "Anchor Notes",
                icon: "sticky-note",
                defaultOpen: false,
              },
              React.createElement(
                "div",
                { className: "flex flex-col gap-2" },
                React.createElement(
                  "div",
                  {
                    className:
                      "text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 mb-1 flex justify-between items-center",
                  },
                  React.createElement(
                    "span",
                    null,
                    "Notes for",
                    " ",
                    crosshair?.activeSavedColor?.type === "pin"
                      ? "Custom Pin"
                      : crosshair?.nearestAnchorId,
                  ),
                ),
                React.createElement("textarea", {
                  className:
                    "w-full h-28 bg-slate-50 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded-lg p-3 text-xs focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white custom-scrollbar resize-none transition-colors",
                  placeholder: "Add notes...",
                  value: activeNotes,
                  onChange: (e) => onNotesChange(e.target.value),
                  disabled: isInputDisabled,
                }),
              ),
            ),
          ),
    ),
    React.createElement(
      "main",
      {
        className:
          "flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-neutral-950 relative",
      },
      React.createElement(
        "div",
        {
          className:
            "flex items-center justify-between px-4 pt-4 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10 flex-shrink-0",
        },
        React.createElement(
          "div",
          { className: "flex-1 flex items-center min-w-0 mr-4 pb-1.5" },
          React.createElement(
            "div",
            { className: "relative" },
            React.createElement(
              "select",
              {
                value: activeTab,
                onChange: (e) => setActiveTab(e.target.value),
                className:
                  "appearance-none pl-4 pr-10 py-2 text-[12px] font-black uppercase tracking-widest rounded-lg border-2 bg-white dark:bg-neutral-800 outline-none cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-neutral-700 min-w-[220px]",
                style: {
                  textTransform: "uppercase",
                  color: isDark ? "#F2E8DF" : "#010D00",
                  borderColor: isDark ? "#F2E8DF" : "#010D00",
                },
              },
              tabs.map((tab) =>
                React.createElement(
                  "option",
                  {
                    key: tab.id,
                    value: tab.id,
                    style: {
                      color: isDark ? "#F2E8DF" : "#010D00",
                      background: isDark ? "#052212" : "#F2E8DF",
                    },
                  },
                  tab.label,
                ),
              ),
            ),
            React.createElement(Icon, {
              name: "chevron-down",
              className:
                "w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none",
              style: { color: isDark ? "#F2E8DF" : "#010D00" },
            }),
          ),
        ),
        React.createElement(
          "div",
          { className: "flex items-center gap-1 shrink-0 pb-1.5" },
          React.createElement(
            "button",
            {
              onClick: handleUndo,
              disabled: !canUndo,
              className: `p-2 rounded-md transition-colors ${canUndo ? "hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400" : "text-slate-300 dark:text-neutral-700 cursor-not-allowed"}`,
              title: "Undo (Ctrl+Z)",
            },
            React.createElement(Icon, { name: "undo", className: "w-4 h-4" }),
          ),
          React.createElement(
            "button",
            {
              onClick: handleRedo,
              disabled: !canRedo,
              className: `p-2 rounded-md transition-colors ${canRedo ? "hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400" : "text-slate-300 dark:text-neutral-700 cursor-not-allowed"}`,
              title: "Redo (Ctrl+Y)",
            },
            React.createElement(Icon, { name: "redo", className: "w-4 h-4" }),
          ),
          React.createElement("div", {
            className: "w-px h-4 bg-slate-300 dark:bg-neutral-700 mx-1",
          }),
          React.createElement(
            "button",
            {
              onClick: handleSaveApp,
              className:
                "p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors",
              title: "Save App State (.html)",
            },
            React.createElement(Icon, { name: "save", className: "w-4 h-4" }),
          ),
          React.createElement(
            "label",
            {
              className:
                "p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 cursor-pointer transition-colors",
              title: "Import CSV",
            },
            React.createElement(Icon, { name: "upload", className: "w-4 h-4" }),
            React.createElement("input", {
              type: "file",
              accept:
                ".csv,text/csv,application/csv,text/comma-separated-values,application/vnd.ms-excel",
              className: "hidden",
              onChange: handleImportCSV,
              onClick: (e) => {
                e.target.value = null;
              },
            }),
          ),
          React.createElement(
            "button",
            {
              onClick: handleSystemExport,
              className:
                "p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors",
              title: "Export CSV",
            },
            React.createElement(Icon, {
              name: "download",
              className: "w-4 h-4",
            }),
          ),
          React.createElement(
            "button",
            {
              onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
              className:
                "p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors",
              title: "Toggle Theme",
            },
            React.createElement(Icon, {
              name: theme === "dark" ? "sun" : "moon",
              className: "w-4 h-4",
            }),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "flex-1 relative overflow-hidden p-4" },
        React.createElement(
          "div",
          {
            className:
              "absolute inset-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm flex flex-col",
          },
          ["slice", "chroma", "top", "3d", "db"].includes(activeTab) &&
            React.createElement(
              "div",
              {
                className:
                  "px-4 py-2 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/30 dark:bg-neutral-900/30 flex flex-wrap items-center gap-4 z-20",
              },
              React.createElement(
                "div",
                { className: "flex items-center gap-2" },
                React.createElement(
                  "span",
                  {
                    className: "text-[10px] font-bold text-slate-400 uppercase",
                  },
                  "View:",
                ),
                React.createElement(
                  "select",
                  {
                    value: viewMode,
                    onChange: (e) => setViewMode(e.target.value),
                    className:
                      "bg-slate-200/50 dark:bg-neutral-800 rounded px-2 py-1.5 text-[10px] font-black uppercase tracking-tight text-slate-700 dark:text-neutral-300 outline-none hover:bg-slate-300/50 dark:hover:bg-neutral-700 transition-colors cursor-pointer border border-transparent focus:border-sky-500",
                  },
                  React.createElement("option", { value: "dots" }, "Dots"),
                  React.createElement("option", { value: "bins" }, "Bins"),
                  React.createElement(
                    "option",
                    { value: "swatches" },
                    "Swatches",
                  ),
                ),
              ),
              (viewMode === "swatches" || activeTab === "db") &&
                React.createElement(
                  "div",
                  { className: "flex items-center gap-2" },
                  React.createElement(
                    "span",
                    {
                      className:
                        "text-[10px] font-bold text-slate-400 uppercase",
                    },
                    "Layout:",
                  ),
                  React.createElement(
                    "select",
                    {
                      value: swatchLayout,
                      onChange: (e) => setSwatchLayout(e.target.value),
                      className:
                        "bg-slate-200/50 dark:bg-neutral-800 rounded px-2 py-1.5 text-[10px] font-black uppercase tracking-tight text-slate-700 dark:text-neutral-300 outline-none hover:bg-slate-300/50 dark:hover:bg-neutral-700 transition-colors cursor-pointer border border-transparent focus:border-sky-500",
                    },
                    React.createElement("option", { value: "table" }, "Table"),
                    React.createElement(
                      "option",
                      { value: "gallery" },
                      "Gallery",
                    ),
                    React.createElement(
                      "option",
                      { value: "matrix" },
                      "Matrix",
                    ),
                  ),
                ),
              React.createElement("div", {
                className: "h-4 w-px bg-slate-200 dark:bg-neutral-800",
              }),
              React.createElement(
                "div",
                { className: "flex items-center gap-3" },
                React.createElement(
                  "div",
                  {
                    className: "flex items-center gap-2 relative",
                    ref: visibilityMenuRef,
                  },
                  React.createElement(Icon, {
                    name: "eye",
                    className: "w-3.5 h-3.5 text-slate-400",
                  }),
                  React.createElement(
                    "button",
                    {
                      onClick: () => setShowVisibilityMenu(!showVisibilityMenu),
                      className:
                        "bg-transparent border-none rounded text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:text-neutral-300 outline-none cursor-pointer flex items-center gap-1",
                    },
                    "Visibility",
                    React.createElement(Icon, {
                      name: "chevron-down",
                      className: "w-3 h-3",
                    }),
                  ),
                  showVisibilityMenu &&
                    React.createElement(
                      "div",
                      {
                        className:
                          "absolute top-full left-0 mt-2 w-48 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg shadow-xl z-[200] flex flex-col p-2 text-xs",
                      },
                      React.createElement(
                        "label",
                        {
                          className:
                            "flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded cursor-pointer text-slate-700 dark:text-neutral-300",
                        },
                        React.createElement("input", {
                          type: "checkbox",
                          checked: viewportVisibility.pins,
                          onChange: (e) =>
                            setViewportVisibility((prev) => ({
                              ...prev,
                              pins: e.target.checked,
                            })),
                          className:
                            "rounded border-slate-300 text-sky-500 focus:ring-sky-500",
                        }),
                        "Pins",
                      ),
                      React.createElement(
                        "label",
                        {
                          className:
                            "flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded cursor-pointer text-slate-700 dark:text-neutral-300",
                        },
                        React.createElement("input", {
                          type: "checkbox",
                          checked: viewportVisibility.anchors,
                          onChange: (e) =>
                            setViewportVisibility((prev) => ({
                              ...prev,
                              anchors: e.target.checked,
                            })),
                          className:
                            "rounded border-slate-300 text-sky-500 focus:ring-sky-500",
                        }),
                        "Anchors (Grid)",
                      ),
                      React.createElement("div", {
                        className: "h-px bg-slate-200 dark:bg-neutral-800 my-1",
                      }),
                      React.createElement(
                        "label",
                        {
                          className:
                            "flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded cursor-pointer text-slate-700 dark:text-neutral-300 font-bold",
                        },
                        React.createElement("input", {
                          type: "checkbox",
                          checked: viewportVisibility.commercial,
                          onChange: (e) =>
                            setViewportVisibility((prev) => ({
                              ...prev,
                              commercial: e.target.checked,
                            })),
                          className:
                            "rounded border-slate-300 text-sky-500 focus:ring-sky-500",
                        }),
                        "Commercial Colors",
                      ),
                      viewportVisibility.commercial &&
                        colorData &&
                        Object.keys(colorData).map((brand) =>
                          React.createElement(
                            "label",
                            {
                              key: brand,
                              className:
                                "flex items-center gap-2 px-2 py-1 pl-6 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded cursor-pointer text-slate-500 dark:text-neutral-400",
                            },
                            React.createElement("input", {
                              type: "checkbox",
                              checked:
                                viewportVisibility.brands[brand] === true,
                              onChange: (e) =>
                                setViewportVisibility((prev) => ({
                                  ...prev,
                                  brands: {
                                    ...prev.brands,
                                    [brand]: e.target.checked,
                                  },
                                })),
                              className:
                                "rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 w-3 h-3",
                            }),
                            getBrandDisplayName(brand),
                          ),
                        ),
                    ),
                ),
                React.createElement(
                  "div",
                  { className: "relative" },
                  React.createElement(Icon, {
                    name: "search",
                    className:
                      "absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400",
                  }),
                  React.createElement("input", {
                    type: "text",
                    value: viewportSearchQuery,
                    onChange: (e) => setViewportSearchQuery(e.target.value),
                    placeholder: "Search...",
                    className:
                      "w-32 bg-slate-200/40 dark:bg-neutral-800/50 border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400 transition-all",
                  }),
                ),
                React.createElement(
                  "div",
                  { className: "relative" },
                  React.createElement(Icon, {
                    name: "tag",
                    className:
                      "absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400",
                  }),
                  React.createElement(
                    "select",
                    {
                      value: viewportTagFilter,
                      onChange: (e) => setViewportTagFilter(e.target.value),
                      className:
                        "w-32 bg-slate-200/40 dark:bg-neutral-800/50 border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white transition-all appearance-none cursor-pointer",
                    },
                    React.createElement("option", { value: "" }, "All Tags"),
                    globalTags.map((t) =>
                      React.createElement("option", { key: t, value: t }, t),
                    ),
                  ),
                ),
              ),
              (viewMode === "swatches" || activeTab === "db") &&
                React.createElement(
                  "div",
                  { className: "ml-auto flex items-center gap-3" },
                  React.createElement(Icon, {
                    name: "zoom-in",
                    className: "w-3.5 h-3.5 text-slate-400",
                  }),
                  React.createElement("input", {
                    type: "range",
                    min: "0.3",
                    max: "2.5",
                    step: "0.1",
                    value: swatchZoom,
                    onChange: (e) => setSwatchZoom(parseFloat(e.target.value)),
                    className:
                      "w-24 accent-sky-500 opacity-60 hover:opacity-100 transition-opacity cursor-pointer",
                  }),
                  React.createElement(
                    "span",
                    {
                      className:
                        "text-[10px] font-mono text-slate-400 min-w-[30px]",
                    },
                    Math.round(swatchZoom * 100),
                    "%",
                  ),
                ),
            ),
          React.createElement(
            "div",
            { className: "flex-1 relative overflow-hidden" },
            ["slice", "chroma", "top", "3d", "db"].includes(activeTab) &&
              React.createElement(
                "div",
                { className: "absolute top-4 left-4 z-50" },
                React.createElement(
                  "button",
                  {
                    onClick: () => setShowViewFilters(!showViewFilters),
                    className:
                      "flex justify-center items-center w-8 h-8 bg-white/80 dark:bg-neutral-900/80 rounded-lg border border-slate-200 dark:border-neutral-800 backdrop-blur-md shadow-sm text-slate-500 hover:text-sky-600 dark:text-neutral-400 dark:hover:text-sky-400 transition-colors",
                    title: "View Filters",
                  },
                  React.createElement(Icon, {
                    name: "sliders-horizontal",
                    className: "w-4 h-4",
                  }),
                ),
                showViewFilters &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "mt-2 flex flex-col gap-4 bg-white/95 dark:bg-neutral-900/95 p-4 rounded-xl border border-slate-200 dark:border-neutral-800 backdrop-blur-md shadow-xl w-56 animate-in fade-in zoom-in-95 duration-200 origin-top-left",
                    },
                    React.createElement(
                      "div",
                      {
                        className:
                          "flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2",
                      },
                      React.createElement(
                        "label",
                        {
                          className:
                            "text-xs font-semibold tracking-wider text-slate-500 dark:text-neutral-400",
                        },
                        "View Filters",
                      ),
                      React.createElement(
                        "button",
                        {
                          onClick: () => setShowViewFilters(false),
                          className:
                            "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200",
                          title: "Close Filters",
                        },
                        React.createElement(Icon, {
                          name: "x",
                          className: "w-3.5 h-3.5",
                        }),
                      ),
                    ),
                    React.createElement(
                      "div",
                      { className: "flex flex-col gap-2" },
                      React.createElement(
                        "div",
                        {
                          className:
                            "flex justify-between items-center text-[10px] uppercase text-slate-400 font-mono",
                        },
                        React.createElement("span", null, "Lightness"),
                        React.createElement(
                          "span",
                          {
                            className:
                              "bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded",
                          },
                          "\xB1 ",
                          filterL.toFixed(2),
                        ),
                      ),
                      React.createElement("input", {
                        type: "range",
                        min: "0",
                        max: "1",
                        step: "0.01",
                        value: filterL,
                        onChange: (e) => setFilterL(Number(e.target.value)),
                        className: "w-full accent-sky-500",
                      }),
                    ),
                    React.createElement(
                      "div",
                      { className: "flex flex-col gap-2" },
                      React.createElement(
                        "div",
                        {
                          className:
                            "flex justify-between items-center text-[10px] uppercase text-slate-400 font-mono",
                        },
                        React.createElement("span", null, "Chroma"),
                        React.createElement(
                          "span",
                          {
                            className:
                              "bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded",
                          },
                          "\xB1 ",
                          filterC.toFixed(2),
                        ),
                      ),
                      React.createElement("input", {
                        type: "range",
                        min: "0",
                        max: "0.4",
                        step: "0.01",
                        value: filterC,
                        onChange: (e) => setFilterC(Number(e.target.value)),
                        className: "w-full accent-sky-500",
                      }),
                    ),
                    React.createElement(
                      "div",
                      { className: "flex flex-col gap-2" },
                      React.createElement(
                        "div",
                        {
                          className:
                            "flex justify-between items-center text-[10px] uppercase text-slate-400 font-mono",
                        },
                        React.createElement("span", null, "Hue"),
                        React.createElement(
                          "span",
                          {
                            className:
                              "bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded",
                          },
                          "\xB1 ",
                          filterH.toFixed(0),
                          "\xB0",
                        ),
                      ),
                      React.createElement("input", {
                        type: "range",
                        min: "0",
                        max: "180",
                        step: "1",
                        value: filterH,
                        onChange: (e) => setFilterH(Number(e.target.value)),
                        className: "w-full accent-sky-500",
                      }),
                    ),
                  ),
              ),
            activeTab === "db" &&
              React.createElement(ViewDatabase, {
                colorData,
                updateColorData,
                swatchLayout,
                swatchZoom,
                handlePointClick,
                crosshair,
                searchTerm: viewportSearchQuery,
                tagFilter: viewportTagFilter,
                filterPt,
                selectedIds,
                setSelectedIds,
                handleBatchTag,
                handleBatchRemoveTag,
                globalTags,
              }),
            activeTab === "3d" &&
              React.createElement(View3D, {
                colorData: filteredColorData,
                points: filteredViewData.points,
                crosshair,
                handlePointClick,
                theme,
                names,
                adjectives,
                savedColors: filteredViewData.savedColors,
                lockedNouns,
                lockedAdjectives,
                tetheringPinId,
                filterPt,
              }),
            activeTab === "slice" &&
              React.createElement(ViewVertical, {
                colorData: filteredColorData,
                points: filteredViewData.points,
                crosshair,
                handlePointClick,
                theme,
                names,
                adjectives,
                savedColors: filteredViewData.savedColors,
                lockedNouns,
                lockedAdjectives,
                viewMode,
                tetheringPinId,
                swatchLayout,
                swatchZoom,
                viewportSearchQuery,
                filterPt,
                filterL,
                filterC,
                filterH,
              }),
            activeTab === "chroma" &&
              React.createElement(ViewChromaRings, {
                colorData: filteredColorData,
                points: filteredViewData.points,
                crosshair,
                handlePointClick,
                theme,
                names,
                adjectives,
                savedColors: filteredViewData.savedColors,
                lockedNouns,
                lockedAdjectives,
                viewMode,
                tetheringPinId,
                swatchLayout,
                swatchZoom,
                viewportSearchQuery,
                filterPt,
                filterL,
                filterC,
                filterH,
              }),
            activeTab === "top" &&
              React.createElement(ViewTopDown, {
                colorData: filteredColorData,
                points: filteredViewData.points,
                baseAnchors: filteredViewData.baseAnchors,
                crosshair,
                handlePointClick,
                theme,
                names,
                adjectives,
                savedColors: filteredViewData.savedColors,
                lockedNouns,
                lockedAdjectives,
                viewMode,
                tetheringPinId,
                swatchLayout,
                swatchZoom,
                viewportSearchQuery,
                filterPt,
                filterL,
                filterC,
                filterH,
              }),
            activeTab === "groups" &&
              React.createElement(ViewGroups, {
                settings: groupSettings,
                setSettings: setGroupSettings,
              }),
            activeTab === "adjectives" &&
              React.createElement(ViewAdjectives, {
                points: filteredViewData.points,
                names,
                adjectives,
                setAdjectives,
                handlePointClick,
                crosshair,
                lockedAdjectives,
                savedColors,
                onVisualize: handleVisualize,
              }),
            activeTab === "palette" &&
              React.createElement(ViewPalette, {
                baseAnchors: filteredViewData.baseAnchors,
                points: filteredViewData.points,
                handlePointClick,
                names,
                setNames,
                adjectives,
                setAdjectives,
                dictNotes,
                lockedNouns,
                lockedAdjectives,
                savedColors,
                setSavedColors,
                dictTags,
                onVisualize: handleVisualize,
              }),
            activeTab === "pins" &&
              React.createElement(ViewPins, {
                handlePointClick,
                names,
                adjectives,
                dictNotes,
                savedColors,
                setSavedColors,
                dictTags,
                setDictTags,
                globalTags,
                selectedIds,
                setSelectedIds,
                handleBatchTag,
                handleBatchRemoveTag,
                setShowAveryModal,
                setSelectedPrintIds,
                setAveryPrintSourceType,
              }),
          ),
        ),
      ),
    ),
    showCompareFullscreen &&
      compSlotA &&
      compSlotB &&
      (() => {
        const cA = new Color("oklch", [compSlotA.L, compSlotA.C, compSlotA.H]);
        const hA = cA
          .clone()
          .toGamut({ space: "srgb" })
          .toString({ format: "hex" });
        const cB = new Color("oklch", [compSlotB.L, compSlotB.C, compSlotB.H]);
        const hB = cB
          .clone()
          .toGamut({ space: "srgb" })
          .toString({ format: "hex" });
        const nA =
          compSlotA.type === "pin"
            ? `${compSlotA.adjOverride || adjectives[compSlotA.adjId] || ""} ${compSlotA.nameOverride || names[compSlotA.nounId] || ""}`.trim()
            : `${adjectives[compSlotA.adjId] || ""} ${names[compSlotA.nounId] || ""}`.trim();
        const nB =
          compSlotB.type === "pin"
            ? `${compSlotB.adjOverride || adjectives[compSlotB.adjId] || ""} ${compSlotB.nameOverride || names[compSlotB.nounId] || ""}`.trim()
            : `${adjectives[compSlotB.adjId] || ""} ${names[compSlotB.nounId] || ""}`.trim();
        const displayA =
          nA || (compSlotA.erpCode ? `#${compSlotA.erpCode}` : "\u2014");
        const displayB =
          nB || (compSlotB.erpCode ? `#${compSlotB.erpCode}` : "\u2014");
        return React.createElement(
          "div",
          {
            className:
              "fixed inset-0 z-[100] flex animate-in fade-in duration-300",
          },
          React.createElement(
            "div",
            { className: "absolute top-8 right-8 z-[110] flex gap-2" },
            (compSlotA.spectral || compSlotB.spectral) &&
              React.createElement(
                "button",
                {
                  onClick: () =>
                    setShowFullscreenSpectral(!showFullscreenSpectral),
                  className:
                    "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2",
                },
                React.createElement(Icon, {
                  name: "activity",
                  className: "w-4 h-4",
                }),
                showFullscreenSpectral ? "Hide Spectral" : "Show Spectral",
              ),
            React.createElement(
              "button",
              {
                onClick: () => setShowCompareDivider(!showCompareDivider),
                className:
                  "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2",
              },
              React.createElement(Icon, {
                name: showCompareDivider ? "eye-off" : "eye",
                className: "w-4 h-4",
              }),
              showCompareDivider ? "Hide Divider" : "Show Divider",
            ),
            React.createElement(
              "button",
              {
                onClick: () => setShowCompareFullscreen(false),
                className:
                  "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg",
              },
              "Close Compare",
            ),
          ),
          React.createElement(
            "div",
            {
              className:
                "flex-1 flex flex-col justify-between p-16 relative transition-colors duration-300 cursor-pointer group",
              style: {
                backgroundColor: hA,
                color: compSlotA.L > 0.65 ? "#010D00" : "#F2E8DF",
              },
              onClick: () => {
                handleUpdate([compSlotA.L, compSlotA.C, compSlotA.H]);
                setShowCompareFullscreen(false);
              },
            },
            !cA.inGamut("srgb") &&
              React.createElement("div", {
                className: "absolute inset-0 pointer-events-none",
                style: {
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 20px, rgba(255,255,255,0.2) 20px, rgba(255,255,255,0.2) 40px)",
                },
              }),
            React.createElement(
              "div",
              {
                className:
                  "text-center relative z-10 group-hover:scale-105 transition-transform mb-12",
              },
              React.createElement(
                "div",
                {
                  className:
                    "text-6xl font-black mb-4 tracking-tight uppercase drop-shadow-md flex items-center justify-center gap-4",
                },
                displayA,
                !cA.inGamut("srgb") &&
                  React.createElement(Icon, {
                    name: "alert-triangle",
                    className: "w-12 h-12 text-red-500 drop-shadow-md",
                    title: "Out of sRGB Gamut",
                  }),
              ),
              React.createElement(
                "div",
                {
                  className:
                    "text-xl font-mono uppercase tracking-widest opacity-80 drop-shadow-sm",
                },
                compSlotA.erpCode,
              ),
            ),
          ),
          showCompareDivider &&
            React.createElement("div", { className: "w-8 bg-black z-[105]" }),
          React.createElement(
            "div",
            {
              className:
                "flex-1 flex flex-col justify-between p-16 relative transition-colors duration-300 cursor-pointer group",
              style: {
                backgroundColor: hB,
                color: compSlotB.L > 0.65 ? "#010D00" : "#F2E8DF",
              },
              onClick: () => {
                handleUpdate([compSlotB.L, compSlotB.C, compSlotB.H]);
                setShowCompareFullscreen(false);
              },
            },
            !cB.inGamut("srgb") &&
              React.createElement("div", {
                className: "absolute inset-0 pointer-events-none",
                style: {
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 20px, rgba(255,255,255,0.2) 20px, rgba(255,255,255,0.2) 40px)",
                },
              }),
            React.createElement(
              "div",
              {
                className:
                  "text-center relative z-10 group-hover:scale-105 transition-transform mb-12",
              },
              React.createElement(
                "div",
                {
                  className:
                    "text-6xl font-black mb-4 tracking-tight uppercase drop-shadow-md flex items-center justify-center gap-4",
                },
                displayB,
                !cB.inGamut("srgb") &&
                  React.createElement(Icon, {
                    name: "alert-triangle",
                    className: "w-12 h-12 text-red-500 drop-shadow-md",
                    title: "Out of sRGB Gamut",
                  }),
              ),
              React.createElement(
                "div",
                {
                  className:
                    "text-xl font-mono uppercase tracking-widest opacity-80 drop-shadow-sm",
                },
                compSlotB.erpCode,
              ),
            ),
          ),
          showFullscreenSpectral &&
            (compSlotA.spectral || compSlotB.spectral) &&
            React.createElement(
              "div",
              {
                onClick: (e) => e.stopPropagation(),
                className:
                  "absolute bottom-16 left-1/2 -translate-x-1/2 w-[800px] max-w-[90vw] bg-black/60 backdrop-blur-2xl p-6 rounded-3xl shadow-2xl border border-white/10 z-[120] pointer-events-auto",
              },
              React.createElement(SpectralGraph, {
                spectralData: compSlotA.spectral || compSlotB.spectral,
                spectralDataB:
                  compSlotA.spectral && compSlotB.spectral
                    ? compSlotB.spectral
                    : void 0,
                colorA: compSlotA.spectral ? hA : void 0,
                colorB: compSlotB.spectral ? hB : void 0,
                theme: "dark",
                meta: compSlotA.spectral ? compSlotA : compSlotB,
                metaB:
                  compSlotA.spectral && compSlotB.spectral ? compSlotB : void 0,
              }),
            ),
          React.createElement(
            "div",
            {
              className:
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-2xl p-8 rounded-3xl text-center shadow-2xl text-white border border-white/10 flex flex-col gap-2 pointer-events-none z-[120]",
            },
            React.createElement(
              "div",
              {
                className:
                  "text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-2",
              },
              "Delta Distance",
            ),
            React.createElement(
              "div",
              {
                className:
                  "text-5xl font-black font-mono text-sky-400 drop-shadow-md",
              },
              deltaEOK,
              " ",
              React.createElement(
                "span",
                { className: "text-sm text-white/50 tracking-normal ml-1" },
                "OK",
              ),
            ),
            React.createElement(
              "div",
              {
                className:
                  "text-2xl font-bold font-mono opacity-80 drop-shadow-md",
              },
              deltaE2000,
              " ",
              React.createElement(
                "span",
                { className: "text-[10px] text-white/50 tracking-normal ml-1" },
                "2000",
              ),
            ),
            compSlotA.spectral &&
              compSlotB.spectral &&
              React.createElement(
                "div",
                {
                  className:
                    "mt-4 pt-4 border-t border-white/10 flex flex-col gap-2",
                },
                React.createElement(
                  "div",
                  {
                    className:
                      "text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1",
                  },
                  "Metamerism Index",
                ),
                React.createElement(
                  "div",
                  { className: "flex gap-4 justify-center" },
                  React.createElement(
                    "div",
                    { className: "text-center" },
                    React.createElement(
                      "div",
                      {
                        className:
                          "text-[9px] uppercase text-amber-400/80 mb-0.5",
                      },
                      "Illum A",
                    ),
                    React.createElement(
                      "div",
                      {
                        className: "text-lg font-mono font-bold text-amber-400",
                      },
                      calculateDeltaEFromSpectral(
                        compSlotA.spectral,
                        compSlotB.spectral,
                        observer,
                        "A",
                      ).toFixed(2),
                    ),
                  ),
                  React.createElement(
                    "div",
                    { className: "text-center" },
                    React.createElement(
                      "div",
                      {
                        className:
                          "text-[9px] uppercase text-amber-400/80 mb-0.5",
                      },
                      "Illum F2",
                    ),
                    React.createElement(
                      "div",
                      {
                        className: "text-lg font-mono font-bold text-amber-400",
                      },
                      calculateDeltaEFromSpectral(
                        compSlotA.spectral,
                        compSlotB.spectral,
                        observer,
                        "F2",
                      ).toFixed(2),
                    ),
                  ),
                  React.createElement(
                    "div",
                    { className: "text-center" },
                    React.createElement(
                      "div",
                      {
                        className:
                          "text-[9px] uppercase text-amber-400/80 mb-0.5",
                      },
                      "Illum F11",
                    ),
                    React.createElement(
                      "div",
                      {
                        className: "text-lg font-mono font-bold text-amber-400",
                      },
                      calculateDeltaEFromSpectral(
                        compSlotA.spectral,
                        compSlotB.spectral,
                        observer,
                        "F11",
                      ).toFixed(2),
                    ),
                  ),
                ),
              ),
          ),
        );
      })(),
    showFullscreenPalette &&
      palette.length > 0 &&
      React.createElement(
        "div",
        {
          className:
            "fixed inset-0 z-[100] flex animate-in fade-in duration-300 bg-neutral-950",
        },
        React.createElement(
          "button",
          {
            onClick: () => setShowFullscreenPalette(false),
            className:
              "absolute top-8 right-8 z-[110] bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg",
          },
          "Close Palette",
        ),
        React.createElement(
          "div",
          { className: "flex w-full h-full relative z-10" },
          palette.map((item) => {
            const info = getPaletteItemInfo(item);
            const displayName =
              info.displayName !== "Unnamed"
                ? info.displayName
                : item.erpCode
                  ? `#${item.erpCode}`
                  : "\u2014";
            const h = info.hex;
            return React.createElement(
              "div",
              {
                key: item.id,
                className:
                  "flex-1 flex flex-col justify-end p-8 transition-all hover:flex-[1.2] cursor-pointer group relative",
                style: { backgroundColor: h },
                onClick: () => {
                  handleUpdate([item.L, item.C, item.H]);
                  setShowFullscreenPalette(false);
                },
              },
              React.createElement(
                "div",
                {
                  className:
                    "transition-opacity duration-300 flex flex-col gap-1 relative z-10",
                  style: { color: item.L > 0.65 ? "#010D00" : "#F2E8DF" },
                },
                React.createElement(
                  "div",
                  {
                    className:
                      "text-2xl font-black uppercase tracking-tight drop-shadow-md",
                  },
                  displayName,
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "text-sm font-mono font-bold tracking-widest opacity-80",
                  },
                  item.erpCode,
                ),
              ),
            );
          }),
        ),
      ),
    visualizeData &&
      React.createElement(
        "div",
        {
          className:
            "fixed inset-0 z-[100] flex animate-in fade-in duration-300 bg-neutral-950/60 backdrop-blur-xl items-center justify-center p-8",
        },
        React.createElement(
          "div",
          {
            className:
              "bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-neutral-800",
          },
          React.createElement(
            "div",
            {
              className:
                "flex items-center justify-between p-6 border-b border-slate-200 dark:border-neutral-800",
            },
            React.createElement(
              "h2",
              {
                className:
                  "text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white",
              },
              visualizeData.title,
            ),
            React.createElement(
              "button",
              {
                onClick: () => setVisualizeData(null),
                className:
                  "p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors",
              },
              React.createElement(Icon, { name: "x", className: "w-6 h-6" }),
            ),
          ),
          React.createElement(
            "div",
            { className: "flex-1 overflow-y-auto p-6 custom-scrollbar" },
            React.createElement(
              "div",
              {
                className:
                  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4",
              },
              visualizeData.items.map((item, i) => {
                const c = new Color("oklch", [item.L, item.C, item.H]);
                const hex = c
                  .clone()
                  .toGamut({ space: "srgb" })
                  .toString({ format: "hex" })
                  .toUpperCase();
                const isLight2 = item.L > 0.65;
                return React.createElement(
                  "div",
                  {
                    key: i,
                    className: "flex flex-col gap-2 group cursor-pointer",
                    onClick: () => {
                      handleUpdate([item.L, item.C, item.H]);
                      setVisualizeData(null);
                    },
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "w-full aspect-square rounded-xl shadow-sm border border-slate-200 dark:border-neutral-800 relative overflow-hidden transition-transform group-hover:scale-105",
                      style: { backgroundColor: hex },
                    },
                    !c.inGamut("srgb") &&
                      React.createElement("div", {
                        className: "absolute inset-0 pointer-events-none",
                        style: {
                          backgroundImage:
                            "repeating-linear-gradient(45deg, rgba(0,0,0,0.2), rgba(0,0,0,0.2) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px)",
                        },
                      }),
                  ),
                  React.createElement(
                    "div",
                    { className: "flex flex-col" },
                    React.createElement(
                      "div",
                      {
                        className:
                          "text-[10px] font-bold uppercase tracking-wider truncate text-slate-900 dark:text-white",
                      },
                      item.displayName,
                    ),
                    React.createElement(
                      "div",
                      {
                        className:
                          "text-[9px] font-mono mt-0.5 text-slate-500 dark:text-neutral-400",
                      },
                      item.erpCode,
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    showFullscreenPreview &&
      !showCompareFullscreen &&
      React.createElement(
        "div",
        {
          className:
            "fixed inset-0 z-[100] flex flex-col items-center justify-end p-20 animate-in fade-in duration-300 cursor-pointer",
          style: { backgroundColor: crosshairHex },
          onClick: () => setShowFullscreenPreview(false),
        },
        React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              setShowFullscreenPreview(false);
            },
            className:
              "absolute top-8 right-8 bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg z-20",
          },
          "Close Preview",
        ),
        React.createElement(
          "div",
          {
            className:
              "bg-black/10 backdrop-blur-xl p-10 rounded-2xl text-center shadow-2xl pointer-events-none relative z-20",
            style: { color: isLight ? "#010D00" : "#F2E8DF" },
          },
          React.createElement(
            "div",
            {
              className:
                "text-6xl font-black mb-4 tracking-tight uppercase drop-shadow-md",
            },
            activeAdj,
            " ",
            activeName,
          ),
          React.createElement(
            "div",
            {
              className:
                "text-xl font-mono uppercase tracking-widest opacity-80 drop-shadow-sm",
            },
            crosshair?.activeErpCode || "",
          ),
        ),
      ),
    showHelpPanel &&
      React.createElement(
        "div",
        {
          className:
            "fixed inset-0 z-[100] flex animate-in fade-in duration-300 bg-neutral-950/80 backdrop-blur-md items-center justify-center p-4 md:p-8",
        },
        React.createElement(
          "div",
          {
            className:
              "bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-neutral-800",
          },
          React.createElement(
            "div",
            {
              className:
                "flex items-center justify-between p-6 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50",
            },
            React.createElement(
              "h2",
              {
                className:
                  "text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-3",
              },
              React.createElement(Icon, {
                name: "help-circle",
                className: "w-6 h-6 text-sky-500",
              }),
              "App Guide & OKLCH Concepts",
            ),
            React.createElement(
              "button",
              {
                onClick: () => setShowHelpPanel(false),
                className:
                  "p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors",
              },
              React.createElement(Icon, { name: "x", className: "w-6 h-6" }),
            ),
          ),
          React.createElement(
            "div",
            {
              className:
                "flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar text-slate-700 dark:text-neutral-300 space-y-10",
            },
            React.createElement(
              "section",
              null,
              React.createElement(
                "h3",
                {
                  className:
                    "text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-neutral-800 pb-2",
                },
                "What is OKLCH?",
              ),
              React.createElement(
                "p",
                { className: "mb-4 leading-relaxed" },
                "OKLCH is a perceptually uniform color space. Unlike RGB or HEX, which are built for screens, OKLCH is built for human eyes. It ensures that changes in color values match how we actually perceive those changes.",
              ),
              React.createElement(
                "div",
                { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
                React.createElement(
                  "div",
                  {
                    className:
                      "bg-slate-50 dark:bg-neutral-800/50 p-5 rounded-xl border border-slate-100 dark:border-neutral-800",
                  },
                  React.createElement(
                    "div",
                    { className: "text-lg font-black text-sky-500 mb-2" },
                    "L (Lightness)",
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-sm font-bold uppercase tracking-wider opacity-60 mb-2",
                    },
                    "0 to 1 (or 0% to 100%)",
                  ),
                  React.createElement(
                    "p",
                    { className: "text-sm leading-relaxed" },
                    "How bright or dark the color is. 0 is pure black, 1 is pure white. Because it's perceptually uniform, a lightness of 0.5 always looks exactly halfway between black and white.",
                  ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "bg-slate-50 dark:bg-neutral-800/50 p-5 rounded-xl border border-slate-100 dark:border-neutral-800",
                  },
                  React.createElement(
                    "div",
                    { className: "text-lg font-black text-pink-500 mb-2" },
                    "C (Chroma)",
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-sm font-bold uppercase tracking-wider opacity-60 mb-2",
                    },
                    "0 to ~0.4 (or higher)",
                  ),
                  React.createElement(
                    "p",
                    { className: "text-sm leading-relaxed" },
                    "The intensity, purity, or saturation of the color. 0 is completely grayscale (white, gray, or black). Higher values are more vivid. The maximum chroma depends on the lightness and hue.",
                  ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "bg-slate-50 dark:bg-neutral-800/50 p-5 rounded-xl border border-slate-100 dark:border-neutral-800",
                  },
                  React.createElement(
                    "div",
                    { className: "text-lg font-black text-emerald-500 mb-2" },
                    "H (Hue)",
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-sm font-bold uppercase tracking-wider opacity-60 mb-2",
                    },
                    "0 to 360 degrees",
                  ),
                  React.createElement(
                    "p",
                    { className: "text-sm leading-relaxed" },
                    "The actual color family (red, green, blue, etc.), arranged in a circle. 0/360 is pinkish-red, 90 is yellow-green, 180 is cyan/teal, and 270 is blue.",
                  ),
                ),
              ),
            ),
            React.createElement(
              "section",
              null,
              React.createElement(
                "h3",
                {
                  className:
                    "text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-neutral-800 pb-2",
                },
                "Navigation & Views",
              ),
              React.createElement(
                "div",
                { className: "grid grid-cols-1 sm:grid-cols-2 gap-4" },
                React.createElement(
                  "div",
                  {
                    className:
                      "flex gap-4 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl",
                  },
                  React.createElement(
                    "div",
                    { className: "mt-1 text-sky-500" },
                    React.createElement(Icon, {
                      name: "box",
                      className: "w-6 h-6",
                    }),
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      {
                        className:
                          "font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white",
                      },
                      "3D View",
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm leading-relaxed opacity-80" },
                      "Explore the entire color gamut in a 3D scatter plot. Rotate, zoom, and pan to understand the shape of the color space.",
                    ),
                  ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "flex gap-4 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl",
                  },
                  React.createElement(
                    "div",
                    { className: "mt-1 text-sky-500" },
                    React.createElement(Icon, {
                      name: "align-center-vertical",
                      className: "w-6 h-6",
                    }),
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      {
                        className:
                          "font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white",
                      },
                      "Vertical Slice",
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm leading-relaxed opacity-80" },
                      "A 2D cross-section showing Lightness (Y-axis) vs Chroma (X-axis) locked at the current Hue. Great for finding the most vivid color at a specific hue.",
                    ),
                  ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "flex gap-4 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl",
                  },
                  React.createElement(
                    "div",
                    { className: "mt-1 text-sky-500" },
                    React.createElement(Icon, {
                      name: "target",
                      className: "w-6 h-6",
                    }),
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      {
                        className:
                          "font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white",
                      },
                      "Chroma Rings",
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm leading-relaxed opacity-80" },
                      "A polar view showing Hue (angle) vs Chroma (distance from center) locked at the current Lightness. Useful for finding complementary colors.",
                    ),
                  ),
                ),
                React.createElement(
                  "div",
                  {
                    className:
                      "flex gap-4 p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl",
                  },
                  React.createElement(
                    "div",
                    { className: "mt-1 text-sky-500" },
                    React.createElement(Icon, {
                      name: "map",
                      className: "w-6 h-6",
                    }),
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      {
                        className:
                          "font-black uppercase tracking-widest mb-1 text-slate-900 dark:text-white",
                      },
                      "Top-Down",
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm leading-relaxed opacity-80" },
                      "A flattened 2D map of Hue vs Chroma, ignoring Lightness. Gives a bird's-eye view of all available colors.",
                    ),
                  ),
                ),
              ),
            ),
            React.createElement(
              "section",
              null,
              React.createElement(
                "h3",
                {
                  className:
                    "text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-neutral-800 pb-2",
                },
                "Tools & Features",
              ),
              React.createElement(
                "div",
                { className: "space-y-4" },
                React.createElement(
                  "div",
                  { className: "flex gap-4" },
                  React.createElement(
                    "div",
                    { className: "mt-1 text-slate-400" },
                    React.createElement(Icon, {
                      name: "map-pin",
                      className: "w-5 h-5",
                    }),
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "font-bold text-slate-900 dark:text-white" },
                      "Pins & Anchors",
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm leading-relaxed opacity-80" },
                      "Click the Pin icon to save a specific coordinate. Anchors are predefined grid points. You can lock anchors to prevent them from being renamed.",
                    ),
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "flex gap-4" },
                  React.createElement(
                    "div",
                    { className: "mt-1 text-slate-400" },
                    React.createElement(Icon, {
                      name: "palette",
                      className: "w-5 h-5",
                    }),
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "font-bold text-slate-900 dark:text-white" },
                      "Palette & Compare",
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm leading-relaxed opacity-80" },
                      "Add colors to your Palette for quick access. Use the Compare slots (A and B) to see two colors side-by-side and calculate their perceptual difference (Delta E).",
                    ),
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "flex gap-4" },
                  React.createElement(
                    "div",
                    { className: "mt-1 text-slate-400" },
                    React.createElement(Icon, {
                      name: "type",
                      className: "w-5 h-5",
                    }),
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "font-bold text-slate-900 dark:text-white" },
                      "Naming System",
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm leading-relaxed opacity-80" },
                      "Colors are named using an Adjective (based on Lightness) and a Noun (based on Hue and Chroma). You can override these names for specific pins.",
                    ),
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "flex gap-4" },
                  React.createElement(
                    "div",
                    { className: "mt-1 text-slate-400" },
                    React.createElement(Icon, {
                      name: "activity",
                      className: "w-5 h-5",
                    }),
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "font-bold text-slate-900 dark:text-white" },
                      "Delta E (\u0394E)",
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm leading-relaxed opacity-80" },
                      "A metric for understanding how different two colors look to the human eye. A Delta E < 1 is generally imperceptible. Delta E OK uses the OKLCH space, while Delta E 2000 is an older, widely used standard.",
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    showFileManager &&
      React.createElement(FileManager, {
        linkedFiles,
        setLinkedFiles,
        onClose: () => setShowFileManager(false),
      }),
    showDatabaseManager &&
      React.createElement(DatabaseManager, {
        colorData,
        updateColorData,
        swatchLayout,
        swatchZoom,
        handlePointClick,
        crosshair,
        onClose: () => setShowDatabaseManager(false),
      }),
    showAveryModal &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            className:
              "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-300",
          },
          React.createElement(
            "div",
            {
              className:
                "bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 rounded-2xl w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col border border-slate-200 dark:border-neutral-800 overflow-hidden",
            },
            // Header
            React.createElement(
              "div",
              {
                className:
                  "p-4 border-b border-slate-200 dark:border-neutral-800 flex justify-between items-center bg-slate-50 dark:bg-neutral-800/50 rounded-t-2xl",
              },
              React.createElement(
                "h3",
                { className: "font-bold flex items-center gap-2 text-slate-900 dark:text-white" },
                React.createElement(Icon, {
                  name: "printer",
                  className: "w-5 h-5 text-sky-500",
                }),
                " Avery 5159 Color Label Designer",
              ),
              React.createElement(
                "button",
                {
                  onClick: () => setShowAveryModal(false),
                  className: "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200",
                },
                React.createElement(Icon, { name: "x", className: "w-5 h-5" }),
              ),
            ),
            // Body
            React.createElement(
              "div",
              {
                className:
                  "flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-neutral-800 overflow-hidden",
              },
              // Left Panel (Design & Settings)
              React.createElement(
                "div",
                {
                  className:
                    "w-full md:w-[360px] p-5 overflow-y-auto flex flex-col gap-5 bg-slate-50/50 dark:bg-neutral-900/10 custom-scrollbar",
                },
                React.createElement(
                  "div",
                  { className: "flex flex-col gap-1.5" },
                  React.createElement(
                    "h4",
                    { className: "text-xs font-bold uppercase tracking-wider text-slate-400" },
                    "1. Starting Label Position"
                  ),
                  React.createElement(
                    "p",
                    { className: "text-xs text-slate-500 leading-normal" },
                    "Avoid wasting labels by starting from any slot. Click a slot in the preview grid or select below."
                  ),
                  React.createElement(
                    "select",
                    {
                      value: printStartIndex,
                      onChange: (e) => setPrintStartIndex(parseInt(e.target.value) || 1),
                      className:
                        "w-full mt-1.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-3 py-2 text-xs text-slate-700 dark:text-neutral-300 outline-none focus:border-sky-500",
                    },
                    Array.from({ length: 14 }).map((_, i) =>
                      React.createElement("option", { key: i, value: i + 1 }, `Label Slot ${i + 1}`)
                    )
                  )
                ),
                React.createElement(
                  "div",
                  { className: "flex flex-col gap-3" },
                  React.createElement(
                    "h4",
                    { className: "text-xs font-bold uppercase tracking-wider text-slate-400" },
                    "2. SAMI Label Details"
                  ),
                  [
                    { label: "Sheen", value: printLabelSheen, setter: setPrintLabelSheen, options: ['SM (Super Matte)', 'MT (Matte)', 'ST (Satin)', 'HG (High Gloss)'] },
                    { label: "Visual Pattern", value: printLabelVisualTexture, setter: setPrintLabelVisualTexture, options: ['V1 (Solid)', 'V2 (Straight Grain)', 'V3 (Cathedral Grain)', 'V4 (Rustic/Heavy)', 'V5 (Abstract/Stipple)'] },
                    { label: "Tactile Texture", value: printLabelTactileTexture, setter: setPrintLabelTactileTexture, options: ['T1 (Smooth)', 'T2 (Stipple)', 'T3 (Linear Grain)', 'T4 (EIR/Natural)'] },
                    { label: "Door Profile", value: printLabelDoorProfile, setter: setPrintLabelDoorProfile, options: ['SL (Slab)', 'CS (Shaker)', 'SS (Slim)', 'RD (Reeded)', 'CT (Countertop)', 'WG (Wood-Framed Glass)', 'MG (Metal-framed Glass)'] },
                    { label: "Material", value: printLabelMaterial, setter: setPrintLabelMaterial, options: ['Solid Laminate', 'Textured Laminate', 'Lacquered MDF', 'Natural Oak', 'Natural Maple'] },
                  ].map((field, idx) =>
                    React.createElement(
                      "div",
                      { key: idx, className: "flex flex-col gap-1" },
                      React.createElement("label", { className: "text-[10px] uppercase font-bold text-slate-500" }, field.label),
                      React.createElement("select", {
                        value: field.value,
                        onChange: (e) => field.setter(e.target.value),
                        className: "bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-neutral-300 w-full outline-none focus:border-sky-500 transition-colors"
                      },
                        field.options.map(opt => React.createElement("option", { key: opt, value: opt }, opt))
                      )
                    )
                  )
                ),
                React.createElement(
                  "div",
                  { className: "flex flex-col gap-3 py-2 border-t border-slate-200 dark:border-neutral-800" },
                  React.createElement(
                    "h4",
                    { className: "text-xs font-bold uppercase tracking-wider text-slate-400" },
                    "3. Layout Alignment"
                  ),
                  React.createElement(
                    "label",
                    { className: "flex items-center gap-2.5 cursor-pointer text-xs select-none" },
                    React.createElement("input", {
                      type: "checkbox",
                      checked: printLabelBorders,
                      onChange: (e) => setPrintLabelBorders(e.target.checked),
                      className: "rounded border-slate-300 text-sky-500 focus:ring-sky-500 h-3.5 w-3.5",
                    }),
                    React.createElement("span", { className: "text-slate-700 dark:text-neutral-300 font-medium" }, "Show layout guidelines (dashed)")
                  )
                ),
                React.createElement(
                  "div",
                  { className: "mt-auto pt-4 border-t border-slate-200 dark:border-neutral-800 text-xs text-slate-500 flex flex-col gap-1" },
                  React.createElement("div", null, `Checked Colors: ${averySourceItems.filter((p) => selectedPrintIds.includes(p.id)).length} of ${averySourceItems.length}`),
                  React.createElement("div", null, `Sheets needed: ${generateAveryPages().length} page(s)`)
                )
              ),
              // Right Panel (Interactive sheet grid and Selector)
              React.createElement(
                "div",
                {
                  className:
                    "flex-1 p-5 overflow-y-auto flex flex-col lg:flex-row gap-6 custom-scrollbar bg-white dark:bg-neutral-900",
                },
                // Selection list
                React.createElement(
                  "div",
                  { className: "flex-1 flex flex-col gap-3" },
                  React.createElement(
                    "div",
                    { className: "flex items-center justify-between" },
                    React.createElement(
                      "h4",
                      { className: "font-semibold text-xs uppercase tracking-wider text-slate-400" },
                      "Select Colors to Print"
                    ),
                    React.createElement(
                      "div",
                      { className: "flex gap-2" },
                      React.createElement(
                        "button",
                        {
                          onClick: () => setSelectedPrintIds(averySourceItems.map((p) => p.id)),
                          className: "text-[10px] text-sky-500 hover:underline hover:text-sky-600 font-bold uppercase tracking-wider",
                        },
                        "All"
                      ),
                      React.createElement("span", { className: "text-slate-300 dark:text-neutral-700" }, "|"),
                      React.createElement(
                        "button",
                        {
                          onClick: () => setSelectedPrintIds([]),
                          className: "text-[10px] text-slate-500 hover:underline hover:text-slate-600 font-bold uppercase tracking-wider",
                        },
                        "None"
                      )
                    )
                  ),
                  React.createElement(
                    "div",
                    { className: "flex-1 min-h-[160px] max-h-[220px] lg:max-h-[380px] overflow-y-auto border border-slate-200 dark:border-neutral-800 rounded-lg p-2 flex flex-col gap-1 bg-slate-50/50 dark:bg-neutral-900/20 custom-scrollbar" },
                    averySourceItems.map((item) => {
                      const info = getPaletteItemInfo(item);
                      const isChecked = selectedPrintIds.includes(item.id);
                      const myConfig = printConfigs[item.id] || {};
                      
                      const updateMyConfig = (key, val) => {
                        setPrintConfigs(prev => ({
                          ...prev,
                          [item.id]: {
                            ...prev[item.id],
                            [key]: val
                          }
                        }));
                      };

                      return React.createElement(
                        "div",
                        {
                          key: item.id,
                          className: `flex flex-col rounded-md transition-colors ${isChecked ? "bg-white dark:bg-neutral-800/50 shadow-sm border border-slate-200 dark:border-neutral-700" : "hover:bg-slate-100 dark:hover:bg-neutral-800/80 cursor-pointer"}`,
                        },
                        React.createElement(
                          "div",
                          {
                            className: "flex items-center gap-3 p-2 cursor-pointer",
                            onClick: () => {
                              setSelectedPrintIds((prev) =>
                                prev.includes(item.id) ? prev.filter((pId) => pId !== item.id) : [...prev, item.id]
                              );
                            },
                          },
                          React.createElement("input", {
                            type: "checkbox",
                            checked: isChecked,
                            readOnly: true,
                            className: "rounded border-slate-300 text-sky-500 focus:ring-sky-500 h-3.5 w-3.5 pointer-events-none",
                          }),
                          React.createElement("div", {
                            className: "w-6 h-6 rounded border border-slate-200/50 flex-shrink-0 shadow-sm",
                            style: { backgroundColor: info.hex },
                          }),
                          React.createElement(
                            "div",
                            { className: "flex-1 overflow-hidden" },
                            React.createElement(
                              "div",
                              { className: "text-xs font-bold truncate text-slate-800 dark:text-neutral-200" },
                              info.displayName
                            ),
                            React.createElement(
                              "div",
                              { className: "text-[10px] font-mono text-slate-400 truncate" },
                              `ERP: ${info.erpCode} \u2022 ${info.hex}`
                            )
                          )
                        ),
                        // Expanded settings panel
                        isChecked && React.createElement(
                          "div",
                          { className: "px-2 pb-2 pt-1 border-t border-slate-100 dark:border-neutral-800 flex flex-col gap-2 bg-slate-50 dark:bg-neutral-900/50 rounded-b-md" },
                          React.createElement(
                            "div",
                            { className: "flex items-center justify-between" },
                            React.createElement("span", { className: "text-[10px] font-bold text-slate-500" }, "COPIES"),
                            React.createElement("input", {
                              type: "number",
                              min: 1,
                              value: myConfig.count ?? 1,
                              onChange: (e) => updateMyConfig("count", parseInt(e.target.value) || 1),
                              className: "w-16 h-6 px-1 text-xs text-right border border-slate-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 outline-none"
                            })
                          ),
                          // Override Fields
                          [
                            { label: "Sheen", key: "sheen", global: printLabelSheen, options: ['-', 'SM (Super Matte)', 'MT (Matte)', 'ST (Satin)', 'HG (High Gloss)'] },
                            { label: "Vis. Pattern", key: "visualTexture", global: printLabelVisualTexture, options: ['-', 'V1 (Solid)', 'V2 (Straight Grain)', 'V3 (Cathedral Grain)', 'V4 (Rustic/Heavy)', 'V5 (Abstract/Stipple)'] },
                            { label: "Tac. Texture", key: "tactileTexture", global: printLabelTactileTexture, options: ['-', 'T1 (Smooth)', 'T2 (Stipple)', 'T3 (Linear Grain)', 'T4 (EIR/Natural)'] },
                            { label: "Profile", key: "doorProfile", global: printLabelDoorProfile, options: ['-', 'SL (Slab)', 'CS (Shaker)', 'SS (Slim)', 'RD (Reeded)', 'CT (Countertop)', 'WG (Wood-Framed Glass)', 'MG (Metal-framed Glass)'] },
                            { label: "Material", key: "material", global: printLabelMaterial, options: ['-', 'Solid Laminate', 'Textured Laminate', 'Lacquered MDF', 'Natural Oak', 'Natural Maple'] }
                          ].map((field) => (
                            React.createElement(
                              "div",
                              { key: field.key, className: "flex items-center justify-between gap-2" },
                              React.createElement("span", { className: "text-[9px] uppercase font-bold text-slate-500 truncate" }, field.label),
                              React.createElement("select", {
                                value: myConfig[field.key] ?? "-",
                                onChange: (e) => updateMyConfig(field.key, e.target.value === "-" ? null : e.target.value),
                                className: "w-24 h-6 px-1.5 text-[9px] border border-slate-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 outline-none"
                              },
                                field.options.map(opt => React.createElement("option", { key: opt, value: opt }, opt === "-" ? `Default (${field.global.split(" ")[0]})` : opt))
                              )
                            )
                          ))
                        )
                      );
                    })
                  )
                ),
                // Visual Sheet preview container
                React.createElement(
                  "div",
                  { className: "w-full lg:w-[280px] flex flex-col gap-3 justify-center items-center" },
                  React.createElement(
                    "h4",
                    { className: "font-semibold text-xs uppercase tracking-wider text-slate-400 text-center w-full animate-pulse-none" },
                    "First Sheet Layout"
                  ),
                  React.createElement(
                    "div",
                    {
                      className:
                        "relative w-full aspect-[8.5/11] bg-slate-100 dark:bg-neutral-950/45 p-1.5 border border-slate-300 dark:border-neutral-800 rounded-lg shadow-inner max-w-[240px] flex flex-col gap-0.5 justify-between",
                    },
                    // Grid template for 14 slots
                    React.createElement(
                      "div",
                      { className: "grid grid-cols-2 grid-rows-7 gap-1 h-full w-full" },
                      Array.from({ length: 14 }).map((_, slotIdx) => {
                        const printPages = generateAveryPages();
                        const firstPageColors = printPages[0] || Array(14).fill(null);
                        const maybeItem = firstPageColors[slotIdx];
                        const isStart = printStartIndex === slotIdx + 1;
                        let cellBg = "bg-white/80 dark:bg-neutral-800/10 text-slate-400";
                        let innerText = "";
                        let colorHex = null;
                        
                        if (maybeItem) {
                          const info = getPaletteItemInfo(maybeItem);
                          colorHex = info.hex;
                          innerText = info.displayName;
                        } else if (slotIdx + 1 < printStartIndex) {
                          cellBg = "bg-slate-300/40 dark:bg-neutral-900/40 text-slate-400/50 line-through";
                          innerText = "Skip";
                        } else {
                          innerText = "Empty";
                        }
                        
                        return React.createElement(
                          "div",
                          {
                            key: slotIdx,
                            onClick: () => setPrintStartIndex(slotIdx + 1),
                            className: `relative flex flex-col justify-center items-center p-0.5 text-[8px] font-bold rounded cursor-pointer transition-all border overflow-hidden select-none ${isStart ? "border-sky-500 ring-2 ring-sky-500/50 z-10" : "border-slate-200 dark:border-neutral-800/50 hover:border-slate-400 dark:hover:border-neutral-600"} ${cellBg}`,
                            style: colorHex ? { backgroundColor: colorHex, color: new Color(colorHex).L > 0.65 ? "#000" : "#fff" } : {},
                            title: `Slot ${slotIdx + 1}. Click to set as starting label.`,
                          },
                          React.createElement(
                            "div",
                            { className: "truncate max-w-full text-[7px]" },
                            innerText
                          ),
                          isStart &&
                            React.createElement(
                              "div",
                              { className: "absolute bottom-0 right-0 bg-sky-500 text-white rounded-tl px-0.5 text-[6px] text-center" },
                              "Start"
                            )
                        );
                      })
                    )
                  ),
                  React.createElement(
                    "p",
                    { className: "text-[10px] text-slate-400 text-center italic leading-tight" },
                    "Slots 1\u201314 on Sheet 1. Checked colors are filled sequentially starting at 'Start'. Click slots to reposition."
                  )
                )
              )
            ),
            // Footer
            React.createElement(
              "div",
              {
                className:
                  "p-4 border-t border-slate-200 dark:border-neutral-800 flex justify-between items-center bg-slate-50 dark:bg-neutral-800/50 rounded-b-2xl",
              },
              React.createElement(
                "div",
                { className: "text-xs text-slate-400 hidden sm:block" },
                "Fits Avery 5159 standard (4\" \u00d7 1.5\" \u00d7 14 labels per page)"
              ),
              React.createElement(
                "div",
                { className: "flex gap-2 ml-auto" },
                React.createElement(
                  "button",
                  {
                    onClick: () => setShowAveryModal(false),
                    className:
                      "px-4 py-2 border border-slate-200 hover:bg-slate-100 dark:border-neutral-700 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 rounded-lg text-xs font-bold transition-colors",
                  },
                  "Cancel"
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => handlePrintAvery(),
                    disabled: averySourceItems.filter((p) => selectedPrintIds.includes(p.id)).length === 0,
                    className:
                      "px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:dark:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm",
                  },
                  React.createElement(Icon, { name: "printer", className: "w-4 h-4" }),
                  "Print Labels"
                )
              )
            )
          )
        ),
        document.body
      ),
    React.createElement(
      "div",
      { className: "hidden print:block print-avery-container font-sans bg-white" },
      React.createElement("style", null, `
        @media print {
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            width: 8.5in !important;
            height: 11in !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #root {
            display: none !important;
          }
          .print-avery-container {
            display: block !important;
            background: white !important;
          }
          .avery-print-page {
            display: grid !important;
            grid-template-columns: 4in 4in !important;
            column-gap: 0.188in !important;
            row-gap: 0in !important;
            width: 8.5in !important;
            height: 11in !important;
            padding-top: 0.25in !important;
            padding-bottom: 0.25in !important;
            padding-left: 0.156in !important;
            padding-right: 0.156in !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            align-content: start !important;
            background: white !important;
          }
          .avery-label-cell {
            width: 4in !important;
            height: 1.5in !important;
            box-sizing: border-box !important;
            padding: 0 !important;
            display: flex !important;
            overflow: hidden !important;
            background: white !important;
            border-radius: 0.125in !important;
            font-family: 'Bicyclette', 'Byciclette', 'Inter', system-ui, sans-serif !important;
          }
          .avery-label-border {
            border: 1px dashed rgba(180, 169, 158, 0.4) !important;
          }
          .avery-label-borderless {
            border: 1px solid transparent !important;
          }
          .sami-sidebar {
            width: 0.45in !important;
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sami-sidebar span {
            transform: rotate(-90deg) !important;
            font-weight: 900 !important;
            font-size: 13pt !important;
            letter-spacing: 0.1em !important;
          }
          .sami-content {
            flex-grow: 1 !important;
            padding: 0.1in 0.15in !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }
          .sami-row {
            display: flex !important;
            align-items: baseline !important;
            font-size: 6.5pt !important;
            line-height: 1.1 !important;
            width: 100% !important;
            position: relative !important;
          }
          .sami-label {
            font-weight: 800 !important;
            width: 0.85in !important;
            flex-shrink: 0 !important;
            color: #1a201c !important;
            font-size: 6.5pt !important;
          }
          .sami-label.right {
            width: auto !important;
            margin-left: auto !important;
            padding-left: 0.1in !important;
            padding-right: 0.05in !important;
          }
          .sami-value {
            font-weight: 500 !important;
            color: #2b332d !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .sami-value.sami-lg {
            font-size: 9.5pt !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
          }
          .sami-line {
            flex-grow: 1 !important;
            border-bottom: 0.5px solid #a0a8a3 !important;
            min-width: 0.5in !important;
            margin-bottom: 1pt !important;
          }
          .sami-id {
            margin-left: auto !important;
            font-size: 6pt !important;
            font-style: italic !important;
            color: #88908a !important;
          }
        }
      `),
      generateAveryPages().map((pageColors, pIdx) =>
        React.createElement(
          "div",
          { key: pIdx, className: "avery-print-page" },
          pageColors.map((item, cIdx) => {
            if (!item) {
              return React.createElement("div", {
                key: `empty-${cIdx}`,
                className: `avery-label-cell ${printLabelBorders ? "avery-label-border" : "avery-label-borderless"}`,
              });
            }
            const info = getPaletteItemInfo(item);
            
            const config = printConfigs[item.id] || {};
            const itemSheen = config.sheen ?? (info.pin?.sheen || null) ?? printLabelSheen;
            const itemMaterial = config.material ?? (info.pin?.material || null) ?? printLabelMaterial;
            const itemVisualTexture = config.visualTexture ?? (info.pin?.visualTexture || null) ?? printLabelVisualTexture;
            const itemTactileTexture = config.tactileTexture ?? (info.pin?.tactileTexture || null) ?? printLabelTactileTexture;
            const itemDoorProfile = config.doorProfile ?? (info.pin?.doorProfile || null) ?? printLabelDoorProfile;
            
            // Build the ID string like [Color]-[Sheen]-[Visual Pattern]-[Tactile Texture]-[Profile]
            const abbrSheen = itemSheen.split(' ')[0] || "XX";
            const abbrVisual = itemVisualTexture.split(' ')[0] || "XX";
            const abbrTactile = itemTactileTexture.split(' ')[0] || "XX";
            const abbrProfile = itemDoorProfile.split(' ')[0] || "XX";
            const generatedIdStr = `${info.erpCode}-${abbrSheen}-${abbrVisual}-${abbrTactile}-${abbrProfile}`;

            // Determine if the text in sidebar should be black or white for contrast
            // We use a simple luminous check, L from OKLCH is convenient (info.L)
            const sidebarTextColor = info.L > 0.65 ? "#000000" : "#FFFFFF";

            return React.createElement(
              "div",
              {
                // Must ensure unique keys for duplicates
                key: `${item.id}-${cIdx}`,
                className: `avery-label-cell ${printLabelBorders ? "avery-label-border" : "avery-label-borderless"}`,
              },
              React.createElement(
                "div",
                {
                  className: "sami-sidebar",
                  style: { backgroundColor: info.hex, color: sidebarTextColor }
                },
                React.createElement("span", null, "SAMI")
              ),
              React.createElement(
                "div",
                { className: "sami-content" },
                // Row 1: Name
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "NAME:"),
                  React.createElement("span", { className: "sami-value sami-lg uppercase" }, info.displayName)
                ),
                // Row 2: Color Code
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "COLOR CODE:"),
                  React.createElement("span", { className: "sami-value" }, info.erpCode)
                ),
                // Row 3: Sheen
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "SHEEN:"),
                  React.createElement("span", { className: "sami-value" }, itemSheen)
                ),
                // Row 4: Visual Pattern
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "VISUAL PATTERN:"),
                  React.createElement("span", { className: "sami-value" }, itemVisualTexture)
                ),
                // Row 5: Tactile Texture
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "TACTILE TEXTURE:"),
                  React.createElement("span", { className: "sami-value" }, itemTactileTexture)
                ),
                // Row 6: Door Profile
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "DOOR PROFILE:"),
                  React.createElement("span", { className: "sami-value" }, itemDoorProfile)
                ),
                // Row 7: Material + ID
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "MATERIAL:"),
                  React.createElement("span", { className: "sami-value" }, itemMaterial),
                  React.createElement("span", { className: "sami-id" }, generatedIdStr)
                )
              )
            );
          })
        )
      )
    ),
  );
};
const rootItem = document.getElementById("root");
if (rootItem) {
  const root = ReactDOM.createRoot(rootItem);
  root.render(React.createElement(App, null));
}
