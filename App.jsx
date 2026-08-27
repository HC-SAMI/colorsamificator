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
window.Icon = Icon;
const get7DigitOklch = (L, C, H) => {
  const lVal = Math.min(99, Math.max(0, Math.round((L ?? 0) * 100))).toString().padStart(2, "0");
  const cVal = Math.min(99, Math.max(0, Math.round((C ?? 0) * 100))).toString().padStart(2, "0");
  const hDeg = (((H ?? 0) % 360) + 360) % 360;
  const hVal = Math.min(359, Math.max(0, Math.round(hDeg)));
  const hStr = hVal.toString().padStart(3, "0");
  return `${lVal}${cVal}${hStr}`;
};

const extractCleanColorCode = (c) => {
  if (!c) return "";
  let val = c.code || c.erpCode || c.url || c.colorCode || c.number || "";
  return val;
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
const getWhitePoint = (observer, illuminant, isSpectral = false) => {
  if (!isSpectral) {
    let illKey = String(illuminant || "").toUpperCase();
    if (illKey.includes("D50")) {
      return observer === 10 ? [0.96720, 1.00000, 0.81427] : [0.96422, 1.00000, 0.82521];
    }
    if (illKey.includes("D65")) {
      return observer === 10 ? [0.94811, 1.00000, 1.07304] : [0.95047, 1.00000, 1.08883];
    }
  }
  const perfectReflector = new Array(31).fill(1);
  return calculateXYZFromSpectral(perfectReflector, observer, illuminant);
};
const xyzToLab = (xyz, whitePoint) => {
  const f = (t) => (t > 0.008856451679035631 ? Math.pow(t, 1 / 3) : (841 / 108) * t + 16 / 116);
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
  const wp = getWhitePoint(observer, illuminant, true);
  const labA = xyzToLab(xyzA, wp);
  const labB = xyzToLab(xyzB, wp);
  const cA = new Color("lab", labA);
  const cB = new Color("lab", labB);
  return cA.deltaE(cB, "2000");
};
const multiplyMatrixVector = (matrix, vector) => {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2]
  ];
};
const getGeneralBradfordAdaptationMatrix = (ws, wd) => {
  const MBFD = [
    [ 0.8951,  0.2664, -0.1614],
    [-0.7502,  1.7135,  0.0367],
    [ 0.0389, -0.0685,  1.0296]
  ];
  const MBFD_inv = [
    [ 0.9869929054667123, -0.14705425642099013, 0.15996265166373122 ],
    [ 0.43230526972339456, 0.5183602715367776, 0.0492912282128556 ],
    [ -0.008528664575177328, 0.04004282165408487, 0.9684866957875501 ]
  ];
  const lms_s = multiplyMatrixVector(MBFD, ws);
  const lms_d = multiplyMatrixVector(MBFD, wd);
  const rL = lms_s[0] === 0 ? 0 : lms_d[0] / lms_s[0];
  const rM = lms_s[1] === 0 ? 0 : lms_d[1] / lms_s[1];
  const rS = lms_s[2] === 0 ? 0 : lms_d[2] / lms_s[2];
  const intermediate = [
    [ MBFD[0][0] * rL, MBFD[0][1] * rL, MBFD[0][2] * rL ],
    [ MBFD[1][0] * rM, MBFD[1][1] * rM, MBFD[1][2] * rM ],
    [ MBFD[2][0] * rS, MBFD[2][1] * rS, MBFD[2][2] * rS ]
  ];
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      m[i][j] = MBFD_inv[i][0] * intermediate[0][j] +
                MBFD_inv[i][1] * intermediate[1][j] +
                MBFD_inv[i][2] * intermediate[2][j];
    }
  }
  return m;
};
const labToXyz = (lab, whitePoint) => {
  const fy = (lab[0] + 16) / 116;
  const fx = lab[1] / 500 + fy;
  const fz = fy - lab[2] / 200;
  const delta = 6 / 29;
  const fx3 = fx * fx * fx;
  const fz3 = fz * fz * fz;
  const k = 108 / 841;
  const x = fx > delta ? fx3 : (fx - 16 / 116) * k;
  const y = fy > delta ? fy * fy * fy : (fy - 16 / 116) * k;
  const z = fz > delta ? fz3 : (fz - 16 / 116) * k;
  return [x * whitePoint[0], y * whitePoint[1], z * whitePoint[2]];
};

const srgbToXyzD65Raw = (r, g, b) => {
  r = r / 255;
  g = g / 255;
  b = b / 255;
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  return [x, y, z];
};

const createColorFromHex = (hex) => {
  let ch = hex.replace("#", "").trim();
  if (ch.length === 3) ch = ch.split("").map((c) => c + c).join("");
  const r = parseInt(ch.substring(0, 2), 16);
  const g = parseInt(ch.substring(2, 4), 16);
  const b = parseInt(ch.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) throw new Error("Invalid hex");
  const xyz = srgbToXyzD65Raw(r, g, b);
  return new Color("xyz-d65", xyz);
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
  
  // CMYK calculation
  const rCo = c.to("srgb").coords;
  const r_ = Math.max(0, Math.min(1, rCo[0]));
  const g_ = Math.max(0, Math.min(1, rCo[1]));
  const b_ = Math.max(0, Math.min(1, rCo[2]));
  const k_ = 1 - Math.max(r_, g_, b_);
  const c_ = k_ === 1 ? 0 : (1 - r_ - k_) / (1 - k_);
  const m_ = k_ === 1 ? 0 : (1 - g_ - k_) / (1 - k_);
  const y_ = k_ === 1 ? 0 : (1 - b_ - k_) / (1 - k_);
  const cmykStr = `[${Math.round(c_ * 100)}%, ${Math.round(m_ * 100)}%, ${Math.round(y_ * 100)}%, ${Math.round(k_ * 100)}%]`;

  const spectral =
    crosshair.activeSavedColor?.spectral || crosshair.temporarySpectral;
  let varXYZ = null;
  let varLab = null;
  let varLch = null;
  if (spectral) {
    varXYZ = calculateXYZFromSpectral(spectral, observer, illuminant);
    const wp = getWhitePoint(observer, illuminant, true);
    varLab = xyzToLab(varXYZ, wp);
    varLch = labToLch(varLab);
  } else {
    const xyzD65 = c.to("xyz-d65").coords;
    if (illuminant === "D65") {
      varXYZ = xyzD65;
    } else {
      const wpD65 = getWhitePoint(observer, "D65");
      const wpTarget = getWhitePoint(observer, illuminant);
      const M_adapt = getGeneralBradfordAdaptationMatrix(wpD65, wpTarget);
      varXYZ = [
        M_adapt[0][0] * xyzD65[0] + M_adapt[0][1] * xyzD65[1] + M_adapt[0][2] * xyzD65[2],
        M_adapt[1][0] * xyzD65[0] + M_adapt[1][1] * xyzD65[1] + M_adapt[1][2] * xyzD65[2],
        M_adapt[2][0] * xyzD65[0] + M_adapt[2][1] * xyzD65[1] + M_adapt[2][2] * xyzD65[2]
      ];
    }
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
    const isBlocked = observer === 10;
    const fieldReadOnly = readOnly || isBlocked;
    const [localVal, setLocalVal] = useState(value);
    const [isFocused, setIsFocused] = useState(false);
    useEffect(() => {
      if (!isFocused) setLocalVal(value);
    }, [value, isFocused]);
    const applyChange = (val) => {
      if (fieldReadOnly) return;
      try {
        let pc;
        if (space === "Hex") {
          const ch = val.trim();
          if (/^#?[0-9a-fA-F]{3,8}$/.test(ch))
            pc = createColorFromHex(ch.startsWith("#") ? ch : "#" + ch);
        } else if (space === "CMYK") {
          const p = val
            .replace(/[\[\]%]/g, "")
            .split(/[\s,;]+/)
            .filter((x) => x !== "")
            .map((s) => parseFloat(s));
          if (p.length === 4 && p.every((v) => !isNaN(v))) {
            const isZeroToHundred = p.some(v => v > 1.0) || val.includes("%");
            const div = isZeroToHundred ? 100 : 1;
            const cVal = Math.max(0, Math.min(1, p[0] / div));
            const mVal = Math.max(0, Math.min(1, p[1] / div));
            const yVal = Math.max(0, Math.min(1, p[2] / div));
            const kVal = Math.max(0, Math.min(1, p[3] / div));
            
            const r = (1 - cVal) * (1 - kVal);
            const g = (1 - mVal) * (1 - kVal);
            const b = (1 - yVal) * (1 - kVal);
            pc = new Color("xyz-d65", srgbToXyzD65Raw(r * 255, g * 255, b * 255));
          }
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
            if (space === "RGB") {
              pc = new Color("xyz-d65", srgbToXyzD65Raw(p[0], p[1], p[2]));
            } else if (space === "CIE LAB" || space === "CIE LCH" || space === "XYZ") {
              let xyzSource;
              if (space === "XYZ") {
                xyzSource = p;
              } else {
                let lab = p;
                if (space === "CIE LCH") {
                  const hRad = (p[2] * Math.PI) / 180;
                  lab = [p[0], p[1] * Math.cos(hRad), p[1] * Math.sin(hRad)];
                }
                const wpSource = getWhitePoint(observer, illuminant);
                xyzSource = labToXyz(lab, wpSource);
              }
              let xyz_d65;
              if (illuminant === "D65") {
                xyz_d65 = xyzSource;
              } else {
                const wpSource = getWhitePoint(observer, illuminant);
                const wpD65 = getWhitePoint(observer, "D65");
                const M_adapt = getGeneralBradfordAdaptationMatrix(wpSource, wpD65);
                xyz_d65 = [
                  M_adapt[0][0] * xyzSource[0] + M_adapt[0][1] * xyzSource[1] + M_adapt[0][2] * xyzSource[2],
                  M_adapt[1][0] * xyzSource[0] + M_adapt[1][1] * xyzSource[1] + M_adapt[1][2] * xyzSource[2],
                  M_adapt[2][0] * xyzSource[0] + M_adapt[2][1] * xyzSource[1] + M_adapt[2][2] * xyzSource[2]
                ];
              }
              if (xyz_d65) {
                pc = new Color("xyz-d65", xyz_d65);
              }
            } else if (sm[space]) {
              pc = new Color(sm[space], p);
            }
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
        readOnly: fieldReadOnly,
        onFocus: () => setIsFocused(true),
        onBlur: () => {
          setIsFocused(false);
          applyChange(localVal);
        },
        onKeyDown: (e) => e.key === "Enter" && e.target.blur(),
        onChange: (e) => setLocalVal(e.target.value),
        spellCheck: "false",
        className: `w-full bg-slate-100 dark:bg-neutral-800/50 border border-slate-200 dark:border-neutral-700/50 rounded px-1.5 py-1 font-mono text-[10px] ${fieldReadOnly ? "text-slate-500 dark:text-neutral-500 cursor-not-allowed" : "text-slate-800 dark:text-neutral-200"} focus:outline-none focus:border-sky-500 transition-all`,
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
        React.createElement(EditableColorField, {
          label: "CMYK",
          space: "CMYK",
          value: cmykStr,
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
      observer === 10 &&
        React.createElement(
          "div",
          { className: "mb-3 p-2 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-sans leading-snug" },
          React.createElement(Icon, { name: "lock", className: "w-3.5 h-3.5 shrink-0" }),
          "Manual input blocked for 10\xB0 observer."
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
      (observer !== 10 || !!spectral) ?
        React.createElement(
          "div",
          { className: "grid grid-cols-2 gap-3" },
          React.createElement(EditableColorField, {
            label: `CIE LAB (${illuminant}/${observer}\xB0)`,
            space: "CIE LAB",
            value: `[${fmt(varLab[0])}, ${fmt(varLab[1])}, ${fmt(varLab[2])}]`,
            onEdit,
          }),
          React.createElement(EditableColorField, {
            label: `CIE LCH (${illuminant}/${observer}\xB0)`,
            space: "CIE LCH",
            value: `[${fmt(varLch[0])}, ${fmt(varLch[1])}, ${fmt(varLch[2], 1)}]`,
            onEdit,
          }),
          React.createElement(EditableColorField, {
            label: `XYZ (${illuminant}/${observer}\xB0)`,
            space: "XYZ",
            value: `[${fmt(varXYZ[0], 5)}, ${fmt(varXYZ[1], 5)}, ${fmt(varXYZ[2], 5)}]`,
            onEdit,
          }),
        ) :
        React.createElement(
          "div",
          { className: "p-2 bg-slate-50 dark:bg-neutral-800/40 border border-slate-200/50 dark:border-neutral-700/40 rounded text-[10px] text-slate-500 dark:text-neutral-400 flex items-center justify-center gap-1.5 font-sans leading-snug" },
          React.createElement(Icon, { name: "eye-off", className: "w-3.5 h-3.5 shrink-0 text-slate-400" }),
          "10\xB0 conversions require spectral data"
        ),
    ),
  );
};
const CommercialMatches = ({
  crosshair,
  colorData,
  filterSameAdjective,
  filterSameNoun,
  names,
  adjectives,
  gridData,
  onSelectColor,
  savedColors = {},
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
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [maxDeltaE, setMaxDeltaE] = useState(1.0);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredMatches = useMemo(() => {
    if (!colorData || Object.keys(colorData).length === 0) return null;

    let binBounds = null;
    if (filterSameAdjective || filterSameNoun) {
      const unfilteredPts = getUnfilteredPoints(gridData, savedColors);
      binBounds = getCursorBinBoundaries(
        crosshair.rawL,
        crosshair.rawC,
        crosshair.rawH,
        savedColors,
        unfilteredPts
      );
    }

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
            targetColor = createColorFromHex(item.hex).to("oklch");
          }
          const d = c.deltaE(targetColor, "OK") * 100;
          if (d <= maxDeltaE) {
            if ((filterSameAdjective || filterSameNoun) && binBounds) {
              const itemL = targetColor.coords[0];
              const itemC = targetColor.coords[1];
              const itemH = isNaN(targetColor.coords[2]) ? 0 : targetColor.coords[2];

              if (filterSameAdjective && !isPointInSameAdjective(itemL, binBounds)) {
                continue;
              }
              if (filterSameNoun && !isPointInSameNoun(itemC, itemH, binBounds)) {
                continue;
              }
            }

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
    filterSameAdjective,
    filterSameNoun,
    names,
    adjectives,
    gridData,
    savedColors,
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
                "relative group w-8 h-8 rounded shadow-sm shrink-0 border border-slate-200 dark:border-neutral-700 overflow-hidden",
              style: { backgroundColor: match.hex },
            },
            React.createElement("div", {
              className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
              style: {
                backgroundImage: `url(${match.image})`,
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
              },
            }),
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
              "text-[9px] text-slate-500 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5",
          },
          label,
          " \xB7 \u0394Eok ",
          fmt(match.d, 2),
          (match.url || match.erpCode) && String(match.url || match.erpCode).startsWith("http") &&
            React.createElement(
              "a",
              {
                href: match.url || match.erpCode,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "text-sky-500 hover:underline flex items-center gap-0.5 lowercase tracking-normal font-medium ml-auto",
                onClick: (e) => e.stopPropagation(),
              },
              React.createElement(Icon, { name: "external-link", className: "w-2.5 h-2.5 shrink-0" }),
              "link"
            ),
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
          `${p.adjOverride || adjectives[p.adjId] || ""} ${names[p.anchorId] || names[p.id] || p.nameOverride || ""}`.trim() ||
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
        const ncName = `${names[nc.id] || nc.nameOverride || "Custom Noun"}`;
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
          (`${p.adjOverride || adjectives[p.adjId] || ""} ${p.nameOverride || names[p.anchorId] || ""}`.trim() ||
          "Unnamed Pin").toUpperCase();
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
  groupSettings,
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
          `${p.adjOverride || adjectives[p.adjId] || ""} ${names[p.anchorId] || names[p.id] || p.nameOverride || ""}`.trim() ||
          p.id ||
          "Custom Anchor";
        return { ...p, displayName };
      });
    const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
    const pinNodes = filteredBurnt.map((p) => {
      const { displayAdj, displayName } = getInheritedPinNames(
        p,
        savedColors,
        names,
        adjectives,
      );
      return { ...p, displayName: `${displayAdj} ${displayName}`.trim() || "Unnamed Pin" };
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
    const shapes = [];
    if (groupSettings) {
      const gC = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
      // Neutral C line
      if (groupSettings.neutralC) {
        shapes.push({
          type: "line",
          x0: groupSettings.neutralC,
          x1: groupSettings.neutralC,
          y0: -0.05,
          y1: 1.05,
          line: { color: gC, width: 1, dash: "dot" },
        });
      }
      // Vivid C line
      if (groupSettings.vividC) {
        shapes.push({
          type: "line",
          x0: groupSettings.vividC,
          x1: groupSettings.vividC,
          y0: -0.05,
          y1: 1.05,
          line: { color: gC, width: 1, dash: "dot" },
        });
      }
      // Light L line (for non-neutrals)
      if (groupSettings.lightL && groupSettings.neutralC) {
        shapes.push({
          type: "line",
          x0: groupSettings.neutralC,
          x1: 0.4,
          y0: groupSettings.lightL,
          y1: groupSettings.lightL,
          line: { color: gC, width: 1, dash: "dot" },
        });
      }
      // Neutrals maxL lines
      if (groupSettings.neutrals && groupSettings.neutralC) {
        groupSettings.neutrals.forEach(n => {
          shapes.push({
            type: "line",
            x0: 0,
            x1: groupSettings.neutralC,
            y0: n.maxL,
            y1: n.maxL,
            line: { color: gC, width: 1, dash: "dot" },
          });
        });
      }
    } else {
      shapes.push({
        type: "line",
        x0: 0,
        x1: 0.3,
        y0: 0.5,
        y1: 0.5,
        line: { color: isDark ? "#F2E8DF" : "#2B4032", width: 1, dash: "dot" },
      });
    }

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
  }, [isDark, viewMode, voronoiContent, filterPt, groupSettings]);
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
  groupSettings,
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
          `${p.adjOverride || adjectives[p.adjId] || ""} ${names[p.anchorId] || names[p.id] || p.nameOverride || ""}`.trim() ||
          p.id ||
          "Custom Anchor";
        return { ...p, displayName };
      });
    const lockedNodes = [...gridLockedNodes, ...customLockedNodes];
    const pinNodes = filteredBurnt.map((p) => {
      const { displayAdj, displayName } = getInheritedPinNames(
        p,
        savedColors,
        names,
        adjectives,
      );
      return { ...p, displayName: `${displayAdj} ${displayName}`.trim() || "Unnamed Pin" };
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
    const shapes = [];
    if (groupSettings) {
      const gC = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
      shapes.push({
        type: "line",
        x0: 0,
        x1: 360,
        y0: groupSettings.lightL || 0.5,
        y1: groupSettings.lightL || 0.5,
        line: { color: gC, width: 1, dash: "dot" },
      });
      if (groupSettings.hues) {
        groupSettings.hues.forEach(h => {
          shapes.push({
            type: "line",
            x0: h.maxH,
            x1: h.maxH,
            y0: 0,
            y1: 1.05,
            line: { color: gC, width: 1, dash: "dot" },
          });
        });
      }
    } else {
      shapes.push({
        type: "line",
        x0: 0,
        x1: 360,
        y0: 0.5,
        y1: 0.5,
        line: { color: isDark ? "#F2E8DF" : "#2B4032", width: 1, dash: "dot" },
      });
    }

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
  }, [isDark, viewMode, voronoiContent, filterPt, groupSettings]);
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
  savedColors = {},
  names = {},
  adjectives = {},
  colorData = {},
) {
  if (!sc) return { displayAdj: "", displayName: "", source: "anchor", sourceId: "" };

  if (sc.parentPinId && savedColors[sc.parentPinId]) {
    const parent = savedColors[sc.parentPinId];
    const parentRes = getInheritedPinNames(
      parent,
      savedColors,
      names,
      adjectives,
      colorData,
    );
    let finalAdj = (sc.adjOverride || parentRes.displayAdj || "").trim();
    let finalName = (sc.nameOverride || parentRes.displayName || "").trim();
    if (finalAdj.toLowerCase() === "unnamed" || finalAdj.toLowerCase() === "unnamed adj") finalAdj = "";
    if (finalName.toLowerCase() === "unnamed" || finalName.toLowerCase() === "unnamed noun") finalName = "";
    return {
      displayAdj: finalAdj.toUpperCase(),
      displayName: finalName.toUpperCase(),
      source: "pin",
      sourceId: parent.id,
    };
  }

  let source = sc.parentPinId ? "pin" : "anchor";
  let sourceId = sc.parentPinId || sc.anchorId || sc.nounId || sc.id || "";

  const checkDict = (id) => {
    if (!id || String(id).startsWith("commercial-")) return "";
    const val = names[id];
    if (val && typeof val === "string" && val.trim() && val.trim().toLowerCase() !== "unnamed" && val.trim().toLowerCase() !== "unnamed noun") {
      return val.trim();
    }
    return "";
  };

  // 1. Check user explicit overrides on PIN objects only
  let inheritedAdj = sc.adjOverride ? sc.adjOverride.trim() : "";
  let inheritedName = (sc.type === "pin" && sc.nameOverride) ? sc.nameOverride.trim() : "";

  // 2. Check direct dictionary matches by IDs if name is not set
  if (!inheritedName) {
    if (sc.anchorId && savedColors[sc.anchorId]) {
      const nc = savedColors[sc.anchorId];
      inheritedName = checkDict(nc.id) || checkDict(nc.anchorId) || checkDict(sc.anchorId) || (nc.nameOverride ? nc.nameOverride.trim() : "");
      source = nc.type || "anchor";
      sourceId = nc.id || nc.anchorId;
    } else if (sc.nounId && savedColors[sc.nounId]) {
      const nc = savedColors[sc.nounId];
      inheritedName = checkDict(nc.id) || checkDict(nc.anchorId) || checkDict(sc.nounId) || (nc.nameOverride ? nc.nameOverride.trim() : "");
      source = nc.type || "anchor";
      sourceId = nc.id || nc.anchorId;
    }

    if (!inheritedName) {
      inheritedName = checkDict(sc.anchorId) || checkDict(sc.nounId) || checkDict(sc.id) || (sc.nameOverride ? sc.nameOverride.trim() : "");
    }
  }

  // 3. Parametric coordinate lookup from C and H
  const scC = sc.C !== undefined ? sc.C : (sc.c !== undefined ? sc.c : null);
  const scH = sc.H !== undefined ? sc.H : (sc.h !== undefined ? sc.h : null);
  const scL = sc.L !== undefined ? sc.L : (sc.l !== undefined ? sc.l : null);

  if (!inheritedName && scC !== null && scH !== null) {
    const cStr = Math.round(scC * 100).toString().padStart(2, "0");
    const hStr = Math.round(scH).toString().padStart(3, "0");
    const baseNounId = `${cStr}-${hStr}`;
    let prefix = "L";
    if (scL !== null) {
      if (scL >= 0.95) prefix = "UL";
      else if (scL >= 0.5) prefix = "L";
      else if (scL >= 0.2) prefix = "D";
      else prefix = "UD";
    }
    const prefNounId = `${prefix}-${baseNounId}`;
    if (checkDict(prefNounId)) {
      inheritedName = checkDict(prefNounId);
      sourceId = prefNounId;
    } else if (checkDict(baseNounId)) {
      inheritedName = checkDict(baseNounId);
      sourceId = baseNounId;
    }
  }

  // 4. Spatial nearest-neighbor search across savedColors (nounColumns/anchors) and names dictionary
  if (!inheritedName && scC !== null && scH !== null) {
    let scA = sc.a;
    let scB = sc.b;
    if (scA === undefined || scB === undefined) {
      scA = scC * Math.cos((scH * Math.PI) / 180);
      scB = scC * Math.sin((scH * Math.PI) / 180);
    }

    let minDist = Infinity;
    let bestNoun = "";
    let bestSourceId = sourceId;
    let bestSourceType = source;

    // Check savedColors nounColumns and anchors
    Object.values(savedColors).forEach((other) => {
      if (other.type === "nounColumn" || other.type === "anchor") {
        const oName = (checkDict(other.id) || checkDict(other.anchorId) || other.nameOverride || "").trim();
        if (!oName || oName.toLowerCase() === "unnamed" || oName.toLowerCase() === "unnamed noun") return;
        const oA = other.a !== undefined ? other.a : (other.C || 0) * Math.cos(((other.H || 0) * Math.PI) / 180);
        const oB = other.b !== undefined ? other.b : (other.C || 0) * Math.sin(((other.H || 0) * Math.PI) / 180);
        const minL = other.minL !== undefined ? other.minL : (other.L !== undefined ? other.L - 0.05 : -0.01);
        const maxL = other.maxL !== undefined ? other.maxL : (other.L !== undefined ? other.L + 0.05 : 1.01);
        const midL = (minL + maxL) / 2;
        const inL = scL === null || (scL >= minL - 0.01 && scL <= maxL + 0.01);
        const dL = scL !== null ? (scL - midL) : 0;
        const d = Math.pow(scA - oA, 2) + Math.pow(scB - oB, 2) + Math.pow(dL * 0.4, 2);
        if (d < minDist && (inL || d < minDist * 0.5)) {
          minDist = d;
          bestNoun = oName;
          bestSourceId = other.id;
          bestSourceType = other.type;
        }
      }
    });

    // Check all entries in names dictionary
    Object.entries(names).forEach(([k, val]) => {
      if (!val || typeof val !== "string") return;
      const cleanVal = val.trim();
      if (!cleanVal || cleanVal.toLowerCase() === "unnamed" || cleanVal.toLowerCase() === "unnamed noun") return;
      if (String(k).startsWith("commercial-")) return;

      const parts = k.split("-");
      let nC = 0, nH = 0, nMidL = 0.5;
      if (parts.length === 2 && !isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10))) {
        nC = parseInt(parts[0], 10) / 100;
        nH = parseInt(parts[1], 10);
      } else if (parts.length === 3 && !isNaN(parseInt(parts[1], 10)) && !isNaN(parseInt(parts[2], 10))) {
        const pref = parts[0];
        nC = parseInt(parts[1], 10) / 100;
        nH = parseInt(parts[2], 10);
        if (pref === "UL") nMidL = 0.975;
        else if (pref === "L") nMidL = 0.725;
        else if (pref === "D") nMidL = 0.35;
        else if (pref === "UD") nMidL = 0.1;
      } else {
        return;
      }

      const nA = nC * Math.cos((nH * Math.PI) / 180);
      const nB = nC * Math.sin((nH * Math.PI) / 180);
      const dL = scL !== null ? (scL - nMidL) : 0;
      const d = Math.pow(scA - nA, 2) + Math.pow(scB - nB, 2) + Math.pow(dL * 0.4, 2);
      if (d < minDist) {
        minDist = d;
        bestNoun = cleanVal;
        bestSourceId = k;
        bestSourceType = "anchor";
      }
    });

    if (bestNoun) {
      inheritedName = bestNoun;
      sourceId = bestSourceId;
      source = bestSourceType;
    }
  }

  // 5. Resolve Adjective
  if (!inheritedAdj) {
    if (sc.adjId && adjectives[sc.adjId] && adjectives[sc.adjId].trim()) {
      inheritedAdj = adjectives[sc.adjId].trim();
    } else if (scL !== null) {
      const lStr = getLStr(scL);
      if (adjectives[lStr] && adjectives[lStr].trim()) {
        inheritedAdj = adjectives[lStr].trim();
      } else {
        let closestLDist = Infinity;
        let bestLAdj = "";
        Object.entries(adjectives).forEach(([k, v]) => {
          if (!v || typeof v !== "string" || !v.trim()) return;
          const numL = parseFloat(k);
          if (!isNaN(numL)) {
            const diff = Math.abs(numL - scL);
            if (diff < closestLDist) {
              closestLDist = diff;
              bestLAdj = v.trim();
            }
          }
        });
        if (bestLAdj) inheritedAdj = bestLAdj;
      }
    }
  }

  // Sanitize
  if (inheritedName.toLowerCase() === "unnamed" || inheritedName.toLowerCase() === "unnamed noun") {
    inheritedName = "";
  }
  if (inheritedAdj.toLowerCase() === "unnamed" || inheritedAdj.toLowerCase() === "unnamed adj") {
    inheritedAdj = "";
  }

  return {
    displayAdj: inheritedAdj.toUpperCase(),
    displayName: inheritedName.toUpperCase(),
    source,
    sourceId,
  };
}
const getUnfilteredPoints = (gridData, savedColors) => {
  if (!gridData) return [];
  const points = [...(gridData.allPoints || [])];
  Object.values(savedColors).forEach((sc) => {
    if (sc.type === "pin" || sc.type === "anchor") {
      const adjId = sc.adjId || getLStr(sc.L);
      const anchorId =
        sc.anchorId ||
        `custom-${Math.round(sc.C * 100)
          .toString()
          .padStart(2, "0")}-${Math.round(sc.H).toString().padStart(3, "0")}-${adjId}`;
      points.push({
        L: sc.L,
        C: sc.C,
        H: sc.H,
        a: sc.a || sc.C * Math.sin((sc.H * Math.PI) / 180),
        b: sc.b || sc.C * Math.cos((sc.H * Math.PI) / 180),
        lStr: adjId,
        cStr: anchorId ? anchorId.split("-")[1] : "",
        hStr: anchorId ? anchorId.split("-")[2] : "",
        parentNounId: sc.id,
        isPin: sc.type === "pin",
        isCustomAnchor: sc.type === "anchor",
      });
    } else if (sc.type === "nounColumn") {
      const dL = 0.02;
      if (sc.minL === sc.maxL && sc.minL !== null) {
        const L = sc.minL;
        points.push({
          L,
          C: sc.C,
          H: sc.H,
          a: sc.a || sc.C * Math.sin((sc.H * Math.PI) / 180),
          b: sc.b || sc.C * Math.cos((sc.H * Math.PI) / 180),
          lStr: getLStr(L),
          cStr: Math.round(sc.C * 100).toString().padStart(2, "0"),
          hStr: Math.round(sc.H).toString().padStart(3, "0"),
          parentNounId: sc.id,
        });
      } else {
        for (let L = Math.ceil(sc.minL / dL) * dL; L <= sc.maxL; L += dL) {
          points.push({
            L,
            C: sc.C,
            H: sc.H,
            a: sc.a || sc.C * Math.sin((sc.H * Math.PI) / 180),
            b: sc.b || sc.C * Math.cos((sc.H * Math.PI) / 180),
            lStr: getLStr(L),
            cStr: Math.round(sc.C * 100).toString().padStart(2, "0"),
            hStr: Math.round(sc.H).toString().padStart(3, "0"),
            parentNounId: sc.id,
          });
        }
      }
    }
  });
  return points;
};

const getCursorBinBoundaries = (L, C, H, savedColors, points = []) => {
  const normH = isNaN(H) || H === undefined ? 0 : ((H % 360) + 360) % 360;
  const a = C * Math.sin((normH * Math.PI) / 180);
  const b = C * Math.cos((normH * Math.PI) / 180);
  
  let minDist = Infinity;
  let closestPt = null;

  points.forEach((p) => {
    if (p.isPin) return; // skip pins, a bin boundary is defined by columns
    const d =
      Math.pow(L - p.L, 2) +
      Math.pow(a - p.a, 2) +
      Math.pow(b - p.b, 2);
    if (d < minDist) {
      minDist = d;
      closestPt = p;
    }
  });

  if (!closestPt) {
    return {
      minL: L - 0.015,
      maxL: L + 0.015,
      minC: Math.max(0, C - 0.005),
      maxC: C + 0.005,
      midLow: normH - 10,
      midHigh: normH + 10,
      hasAnchors: false
    };
  }

  // 1. Lightness (L) bounds (narrow bounds of exact same adjective level)
  const minL = closestPt.L - 0.0101;
  const maxL = closestPt.L + 0.0101;

  // 2. Chroma (C) bounds
  const allC = Array.from(new Set(points.map((p) => p.C))).sort((x, y) => x - y);
  const idxC = allC.indexOf(closestPt.C);
  let minC, maxC;
  if (idxC !== -1) {
    minC = idxC > 0 ? (allC[idxC - 1] + closestPt.C) / 2 : Math.max(0, closestPt.C - 0.01);
    maxC = idxC < allC.length - 1 ? (allC[idxC + 1] + closestPt.C) / 2 : closestPt.C + 0.01;
  } else {
    minC = Math.max(0, closestPt.C - 0.01);
    maxC = closestPt.C + 0.01;
  }

  // 3. Hue (H) bounds
  const sameChromaPts = points.filter((p) => Math.abs(p.C - closestPt.C) < 0.005);
  const colHVal = Array.from(new Set(sameChromaPts.map((p) => p.H))).sort((x, y) => x - y);
  const idxH = colHVal.indexOf(closestPt.H);
  let midLow, midHigh;
  if (idxH !== -1 && colHVal.length > 1) {
    const prevH = idxH > 0 ? colHVal[idxH - 1] : colHVal[colHVal.length - 1] - 360;
    const nextH = idxH < colHVal.length - 1 ? colHVal[idxH + 1] : colHVal[0] + 360;
    midLow = (prevH + closestPt.H) / 2;
    midHigh = (closestPt.H + nextH) / 2;
  } else {
    midLow = closestPt.H - 15;
    midHigh = closestPt.H + 15;
  }

  return {
    minL,
    maxL,
    minC,
    maxC,
    midLow,
    midHigh,
    hasAnchors: true,
    anchor: closestPt,
    allPoints: points
  };
};

const isPointInSameAdjective = (ptL, binBounds) => {
  return !(ptL < binBounds.minL || ptL > binBounds.maxL);
};

const isPointInSameNoun = (ptC, ptH, binBounds) => {
  if (binBounds.allPoints && binBounds.anchor) {
    const targetA = ptC * Math.sin((ptH * Math.PI) / 180);
    const targetB = ptC * Math.cos((ptH * Math.PI) / 180);
    const cursorL = binBounds.anchor.L;
    
    let minDist = Infinity;
    let closestPt = null;
    binBounds.allPoints.forEach((p) => {
      if (Math.abs(p.L - cursorL) > 0.001) return;
      if (p.isPin) return;
      const isSpecificAnchor =
        (Math.abs(p.C - 0.04) < 0.001 && Math.abs(p.H - 90) < 0.1) ||
        (Math.abs(p.C - 0.12) < 0.001 && Math.abs(p.H - 90) < 0.1);
      
      const cObj = new Color("oklch", [p.L, p.C, p.H]);
      if (!cObj.inGamut("srgb") && p.C !== 0 && !isSpecificAnchor) return;

      // Use existing a, b coordinates or compute them
      const pa = p.a !== undefined ? p.a : p.C * Math.sin((p.H * Math.PI) / 180);
      const pb = p.b !== undefined ? p.b : p.C * Math.cos((p.H * Math.PI) / 180);
      const d = Math.pow(targetA - pa, 2) + Math.pow(targetB - pb, 2);
      // We want strictly the closest column in 2D space.
      if (d < minDist) {
        minDist = d;
        closestPt = { a: pa, b: pb };
      }
    });
    
    if (closestPt) {
      const anchorA = binBounds.anchor.a !== undefined ? binBounds.anchor.a : binBounds.anchor.C * Math.sin((binBounds.anchor.H * Math.PI) / 180);
      const anchorB = binBounds.anchor.b !== undefined ? binBounds.anchor.b : binBounds.anchor.C * Math.cos((binBounds.anchor.H * Math.PI) / 180);
      return Math.abs(closestPt.a - anchorA) < 0.001 && Math.abs(closestPt.b - anchorB) < 0.001;
    }
  }

  if (ptC < binBounds.minC || ptC > binBounds.maxC) return false;
  
  const h = isNaN(ptH) ? 0 : ptH;
  let l = binBounds.midLow;
  let r = binBounds.midHigh;
  let range = r - l;
  let shifted = (h - l) % 360;
  if (shifted < 0) shifted += 360;
  if (shifted > range) return false;
  
  return true;
};
const isNounColumnInSameAdjective = (sc, binBounds) => {
  const minL = sc.minL !== undefined ? sc.minL : (sc.L !== undefined ? sc.L : 0);
  const maxL = sc.maxL !== undefined ? sc.maxL : (sc.L !== undefined ? sc.L : 1);
  return !(Math.max(minL, binBounds.minL) > Math.min(maxL, binBounds.maxL));
};

const isNounColumnInSameNoun = (sc, binBounds) => {
  return isPointInSameNoun(sc.C, sc.H, binBounds);
};

const doesItemMatchBinNounName = (item, binBounds, namesObj) => {
  if (!binBounds || !binBounds.anchor || !binBounds.anchor.parentNounId) return true;
  const nounName = namesObj[binBounds.anchor.parentNounId];
  if (!nounName) return true;
  const itemName = item.name || item.displayName;
  if (!itemName) return false;
  
  const itemStr = itemName.toLowerCase().replace(/[^a-z0-9]/g, " ");
  
  // Split nounName by slashes, commas, ampersands to get distinct alternative phrases
  const phrases = nounName.toLowerCase().split(/[\/,&]+/).map(s => s.trim()).filter(Boolean);
  if (phrases.length === 0) return true;

  // It matches if it matches AT LEAST ONE phrase
  return phrases.some(phrase => {
    const phraseWords = phrase.replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean);
    if (phraseWords.length === 0) return true;
    
    // All words in this phrase must be present in item name
    return phraseWords.every(w => {
      const regex = new RegExp(`\\b${w}\\b`, "i");
      return regex.test(itemName) || itemStr.includes(w);
    });
  });
};
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
                            width: `${baseMatrixSize * swatchZoom}px`,
                            height: `${baseMatrixSize * swatchZoom}px`,
                          },
                          title: `${item.displayName}
${item.erpCode}`,
                        },
                        (item.image || item.note?.startsWith("http")) &&
                          React.createElement("div", {
                            className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                            style: {
                              backgroundImage: `url(${item.image || item.note})`,
                              WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                              maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                            },
                          }),
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
                      },
                    },
                    (item.image || item.note?.startsWith("http")) &&
                      React.createElement("div", {
                        className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                        style: {
                          backgroundImage: `url(${item.image || item.note})`,
                          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                          maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                        },
                      }),
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
                      "p-2 w-full truncate text-[9px] font-mono",
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
            style: { width: `${72 * swatchZoom}px` },
          },
          React.createElement(
            "div",
            {
              className: `aspect-square rounded-2xl relative overflow-hidden transition-all group-hover:scale-[1.02] group-hover:shadow-md ${activeHex === item.hex ? "ring-4 ring-sky-500" : ""} ${selectedIds?.includes(item.id) ? "ring-2 ring-sky-500 shadow-md" : "hover:ring-2 hover:ring-sky-500"}`,
              style: {
                backgroundColor: item.hex,
                width: "100%",
              },
            },
            (item.image || item.note?.startsWith("http")) &&
              React.createElement("div", {
                className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                style: {
                  backgroundImage: `url(${item.image || item.note})`,
                  WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                  maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                },
              }),
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
          swatchZoom >= 0.9 && React.createElement(
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
  groupSettings,
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
      .filter((p) => p.isValid && !p.isPin);
  }, [baseAnchors, crosshair?.rawL, filterPt]);
  const swatchItems = useMemo(() => {
    if (viewMode !== "swatches") return [];
    const res = [];
    validAnchors.filter((p) => filterPt ? filterPt(p) : true).forEach((p) => {
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
    const displayAnchors = validAnchors.filter((p) => filterPt ? filterPt(p) : true);
    traces.push({
      type: "scatter",
      mode: viewMode === "bins" ? (showText ? "text" : "markers") : "markers",
      x: displayAnchors.map((p) => p.a),
      y: displayAnchors.map((p) => p.b),
      text: displayAnchors.map((p) => {
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
        color: displayAnchors.map((p) => (p.L > 0.55 ? "#010D00" : "#F2E8DF")),
      },
      hovertemplate:
        viewMode === "bins"
          ? "<b>%{customdata[3].fullName}</b><br>C: %{customdata[1]:.3f} H: %{customdata[2]:.1f}\xB0<extra></extra>"
          : "%{text}<extra></extra>",
      customdata: displayAnchors.map((p) => {
        const lStr = getLStr(p.L);
        const nounId = p.parentNounId || `${p.cStr}-${p.hStr}`;
        const fullName =
          `${adjectives[lStr] || ""} ${names[nounId] || ""}`.trim() ||
          "Unnamed";
        return [p.L, p.C, p.H, { anchorId: nounId, adjId: lStr, fullName }];
      }),
      marker: {
        size: 14,
        color: displayAnchors.map((p) => p.color),
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
          `${p.adjOverride || adjectives[p.adjId] || ""} ${names[p.anchorId] || names[p.id] || p.nameOverride || ""}`.trim() ||
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
            color: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
            width: 1,
            dash: "dot",
          },
        });
      }
    }
    
    if (groupSettings) {
      const gC = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
      if (groupSettings.neutralC) {
        shapes.push({
          type: "circle",
          xref: "x",
          yref: "y",
          x0: -groupSettings.neutralC,
          y0: -groupSettings.neutralC,
          x1: groupSettings.neutralC,
          y1: groupSettings.neutralC,
          line: { color: gC, width: 1.5, dash: "dot" },
        });
      }
      if (groupSettings.vividC) {
        shapes.push({
          type: "circle",
          xref: "x",
          yref: "y",
          x0: -groupSettings.vividC,
          y0: -groupSettings.vividC,
          x1: groupSettings.vividC,
          y1: groupSettings.vividC,
          line: { color: gC, width: 1.5, dash: "dot" },
        });
      }
      if (groupSettings.hues && groupSettings.neutralC) {
        groupSettings.hues.forEach(h => {
          const rad = (h.maxH * Math.PI) / 180;
          shapes.push({
             type: "line",
             x0: groupSettings.neutralC * Math.sin(rad),
             y0: groupSettings.neutralC * Math.cos(rad),
             x1: 0.4 * Math.sin(rad),
             y1: 0.4 * Math.cos(rad),
             line: { color: gC, width: 1.5, dash: "dot" },
          });
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
  }, [isDark, viewMode, validAnchors, crosshair?.rawL, filterPt, groupSettings]);
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
      Object.values(next).forEach((sc) => {
        if (sc.type === "anchor" && sc.anchorId === id && sc.isCustomAnchor) {
          delete next[sc.id];
        } else if (sc.type === "pin" && sc.anchorId === id) {
          sc.anchorId = null;
        } else if (sc.type === "pin" && sc.parentPinId === id) {
          sc.parentPinId = null;
        }
      });
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
        onChange: (e) => {
          const val = e.target.value;
          setNames((prev) => ({ ...prev, [item.id]: val }));
          if (setSavedColors) {
            setSavedColors((prev) => {
              if (prev[item.id]) {
                return {
                  ...prev,
                  [item.id]: {
                    ...prev[item.id],
                    nameOverride: val,
                  },
                };
              }
              return prev;
            });
          }
        },
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
          },
        },
        (item.image || item.note?.startsWith("http")) &&
          React.createElement("div", {
            className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
            style: {
              backgroundImage: `url(${item.image || item.note})`,
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
              maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
            },
          }),
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
  onOpenAveryModal,
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
          React.createElement("div", {
            className: "w-px h-4 bg-slate-300 dark:bg-neutral-600 mx-1",
          }),
          React.createElement(
            "button",
            {
              onClick: () => {
                if (onOpenAveryModal) onOpenAveryModal(selectedIds);
              },
              className:
                "px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer",
              title: "Print Avery 5159 Labels for selected swatches",
            },
            React.createElement(Icon, { name: "printer", className: "w-3.5 h-3.5" }),
            "Print Labels",
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
  let textToParse = csvText;
  const lines = csvText.split("\n");
  let headerIndex = -1;
  let isNix = false;

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (lines[i].includes("Custom Collection Name") && lines[i].includes("Color Name")) {
      headerIndex = i;
      isNix = true;
      break;
    }
  }

  if (isNix) {
    textToParse = lines.slice(headerIndex).join("\n");
  }

  let parsed = [];
  if (!window.Papa) {
    console.error(
      "PapaParse library not loaded! Falling back to primitive parser.",
    );
    const parseLines = textToParse.split("\n");
    if (parseLines.length < 2) return [];
    const headers = parseLines[0].split(",").map((h) => h.replace(/\r$/, "").trim());
    for (let i = 1; i < parseLines.length; i++) {
      const line = parseLines[i].replace(/\r$/, "");
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
      parsed.push(obj);
    }
  } else {
    parsed = window.Papa.parse(textToParse, { header: true, skipEmptyLines: true }).data;
  }

  if (isNix) {
    parsed = parsed.map((row) => {
      const newRow = { Type: "DB" };
      newRow.Tags = row["Custom Collection Name"] || "";
      newRow.Noun = row["Color Name"] || "";
      newRow.Adjective = row["Color Code"] || "";
      newRow.Measurement_Device = row["Nix Device"] || "";
      newRow.Measurement_Date = row["Date Saved"] || "";
      newRow.Measurement_Method = row["Measurement Mode"] || "";
      newRow.Illuminant = row["Illuminant"] || "";
      newRow.Observer = row["Observer"] || "";

      for (let i = 400; i <= 700; i += 10) {
        const key = `R${i} nm`;
        if (row[key] !== undefined) {
          newRow[key] = row[key];
        }
      }
      return newRow;
    });
  }

  return parsed;
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
  currentSavedPalettes = [],
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
  const newSavedPalettes = currentSavedPalettes
    ? JSON.parse(JSON.stringify(currentSavedPalettes))
    : [];
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
    if (targetType === "PALETTE") {
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
      return;
    }
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
        pL = tc.coords[0];
        pC = tc.coords[1];
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
          tc = createColorFromHex(ch);
        } else if (
          (row.CIE_L !== void 0 || row.Lab_L !== void 0 || row.LAB_L !== void 0) &&
          (row.CIE_A !== void 0 || row.CIE_a !== void 0 || row.Lab_A !== void 0 || row.Lab_a !== void 0) &&
          (row.CIE_B !== void 0 || row.CIE_b !== void 0 || row.Lab_B !== void 0 || row.Lab_b !== void 0) &&
          (row.CIE_L || row.Lab_L || row.LAB_L) !== ""
        ) {
          const lVal = parseFloat(row.CIE_L || row.Lab_L || row.LAB_L || 0);
          const aVal = parseFloat(row.CIE_A || row.CIE_a || row.Lab_A || row.Lab_a || 0);
          const bVal = parseFloat(row.CIE_B || row.CIE_b || row.Lab_B || row.Lab_b || 0);
          tc = new Color("lab", [lVal, aVal, bVal]);
        } else if (
          (row.RGB_R !== void 0 || row.RGB_r !== void 0) &&
          (row.RGB_G !== void 0 || row.RGB_g !== void 0) &&
          (row.RGB_B !== void 0 || row.RGB_b !== void 0) &&
          (row.RGB_R || row.RGB_r) !== ""
        ) {
          let rVal = parseFloat(row.RGB_R || row.RGB_r || 0);
          let gVal = parseFloat(row.RGB_G || row.RGB_g || 0);
          let bVal = parseFloat(row.RGB_B || row.RGB_b || 0);
          if (rVal > 1 || gVal > 1 || bVal > 1) {
            rVal /= 255;
            gVal /= 255;
            bVal /= 255;
          }
          tc = new Color("srgb", [rVal, gVal, bVal]);
        }
        if (tc) {
          const o = tc.to("oklch");
          pL = o.coords[0];
          pC = o.coords[1];
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
        const colorObj = {
          name,
          hex,
          L: pL,
          C: pC,
          H: pH,
          sheen: (row.Sheen || row.sheen || "").trim(),
          doorProfile: (row.Profile || row.Door_Profile || row.DoorProfile || row.doorProfile || "").trim(),
          visualTexture: (row.Visual_Pattern || row.VisualPattern || row.Visual_Texture || row.VisualTexture || row.visualTexture || "").trim(),
          tactileTexture: (row.Tactile_Texture || row.TactileTexture || row.tactileTexture || "").trim(),
          material: (row.Material || row.material || "").trim(),
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
        if (spectral.length > 0) colorObj.spectral = spectral;
        if (url) {
          colorObj.url = url;
          colorObj.erpCode = url;
        }
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
      const pinId =
        row.ID || row.Id || row.Pin_ID || row.PinId || crypto.randomUUID();
      const a = pC * Math.sin((pH * Math.PI) / 180);
      const b = pC * Math.cos((pH * Math.PI) / 180);
      const cStr = Math.round(pC * 100)
        .toString()
        .padStart(2, "0");
      const hStr = Math.round(pH).toString().padStart(3, "0");
      const defaultAnchorId = `${cStr}-${hStr}`;
      const explicitAnchorId =
        row.Anchor_ID || row.AnchorId || row.anchorId || (row.Anchor ? String(row.Anchor) : null);
      const anchorId = explicitAnchorId || defaultAnchorId;
      const parentPinId =
        row.Parent_Pin_ID ||
        row.ParentPinId ||
        row.parentPinId ||
        row.Parent_ID ||
        row.ParentId ||
        row.Parent ||
        null;
      const adjId =
        row.Adj_ID || row.AdjId || row.adjId || getLStr(pL);
      const brand =
        row.Brand || row.brand || row.Brand_Name || row.BrandName || undefined;
      const originalIndex =
        row.Original_Index !== undefined && row.Original_Index !== ""
          ? parseInt(row.Original_Index, 10)
          : row.originalIndex !== undefined && row.originalIndex !== ""
            ? parseInt(row.originalIndex, 10)
            : undefined;
      const image = row.Image || row.image || undefined;

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
        sheen: (row.Sheen || row.sheen || "").trim(),
        doorProfile: (row.Profile || row.Door_Profile || row.DoorProfile || row.doorProfile || "").trim(),
        visualTexture: (row.Visual_Pattern || row.VisualPattern || row.Visual_Texture || row.VisualTexture || row.visualTexture || "").trim(),
        tactileTexture: (row.Tactile_Texture || row.TactileTexture || row.tactileTexture || "").trim(),
        material: (row.Material || row.material || "").trim(),
        adjId,
        anchorId,
        parentPinId: parentPinId || null,
        brand: brand || undefined,
        originalIndex: isNaN(originalIndex) ? undefined : originalIndex,
        image: image || undefined,
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
      targetType === "GRID" ||
      targetType === "ANCHOR" ||
      targetType === "CUSTOM_ANCHOR" ||
      targetType === "NOUN_COLUMN"
    ) {
      const C = pC !== null ? pC : 0;
      const H = pH !== null ? pH : 0;
      const id =
        row.ID ||
        (pL !== null
          ? `anchor-${Math.round(C * 100).toString().padStart(2, "0")}-${Math.round(H).toString().padStart(3, "0")}-${getLStr(pL)}`
          : `noun-${crypto.randomUUID()}`);
      if (targetType === "NOUN_COLUMN") {
        const parts = (row.OKLCH_L || "").split("-");
        let minL = 0,
          maxL = 1;
        if (parts.length === 2) {
          minL = parseFloat(parts[0]) || 0;
          maxL = parseFloat(parts[1]) || 1;
        } else if (pL !== null) {
          minL = maxL = pL;
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
        if (row.Noun !== void 0 && row.Noun !== "") newNames[id] = row.Noun;
        if (row.Note !== void 0 && row.Note !== "") newNotes[id] = row.Note;
        if (row.Tags)
          newTags[id] = row.Tags.split(",")
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
        if (pL !== null && pC !== null && pH !== null) {
          const adjId = lStr || getLStr(pL);
          const a = pC * Math.sin((pH * Math.PI) / 180);
          const b = pC * Math.cos((pH * Math.PI) / 180);
          newSavedColors[id] = {
            id,
            type: "anchor",
            L: pL,
            C: pC,
            H: pH,
            a,
            b,
            erpCode: row.ERP_Code || getExactErpCode(pL, pC, pH),
            adjId,
            anchorId: id,
            isCustomAnchor: true,
            locked: String(row.Locked).toUpperCase() !== "FALSE",
            nameOverride: row.Noun || "",
            adjOverride: row.Adjective || "",
            notes: row.Note || "",
            color:
              row.HEX ||
              new Color("oklch", [pL, pC, pH])
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
    newSavedPalettes,
  };
};
const App = () => {
  const [theme, setTheme] = useState("light");
  const [activeTab, setActiveTab] = useState("top");
  const [colorData, setColorData] = useState(null);
  const [filterL, setFilterL] = useState(1);
  const [filterC, setFilterC] = useState(0.4);
  const [filterH, setFilterH] = useState(180);
  const [filterSameAdjective, setFilterSameAdjective] = useState(false);
  const [filterSameNoun, setFilterSameNoun] = useState(false);
  const [scrubL, setScrubL] = useState(0.65);
  const [scrubC, setScrubC] = useState(0.12);
  const [scrubH, setScrubH] = useState(0);
  const [scrubCommercial, setScrubCommercial] = useState(null);
  const [temporarySpectral, setTemporarySpectral] = useState(null);
  const [compSlotA, setCompSlotA] = useState(null);
  const [compSlotB, setCompSlotB] = useState(null);

  useEffect(() => {
    if (scrubCommercial && colorData) {
      const { brand, originalIndex } = scrubCommercial;
      const target = colorData[brand]?.[originalIndex];
      if (target) {
        const dL = Math.abs(scrubL - target.L);
        const dC = Math.abs(scrubC - target.C);
        let dH = Math.abs(scrubH - target.H);
        dH = Math.min(dH, 360 - dH);
        if (dL > 0.0001 || dC > 0.0001 || dH > 0.0001) {
          setScrubCommercial(null);
        }
      } else {
        setScrubCommercial(null);
      }
    }
  }, [scrubL, scrubC, scrubH, scrubCommercial, colorData]);

  useEffect(() => {
    switch (activeTab) {
      case "top":
        setFilterL(0.01);
        setFilterC(0.4);
        setFilterH(180);
        break;
      case "chroma":
        setFilterL(1);
        setFilterC(0.01);
        setFilterH(180);
        break;
      case "slice":
        setFilterL(1);
        setFilterC(0.4);
        setFilterH(5);
        break;
      default:
        setFilterL(1);
        setFilterC(0.4);
        setFilterH(180);
        break;
    }
  }, [activeTab]);
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
    if (!parsed || Object.keys(parsed).length === 0) {
      try {
        const localRaw = localStorage.getItem("color-samificator-state");
        if (localRaw) {
          const localParsed = JSON.parse(localRaw);
          if (localParsed && typeof localParsed === "object") {
            parsed = localParsed;
          }
        }
      } catch (e) {
        console.warn("Could not load state from localStorage:", e);
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
    Object.values(next).forEach((sc) => {
      if (
        sc.type === "anchor" &&
        sc.anchorId &&
        sc.anchorId.startsWith("custom-noun-") &&
        !next[sc.anchorId]
      ) {
        delete next[sc.id];
        needsCleanup = true;
      }
    });
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

  const getPaletteItemInfo = useCallback(
    (item) => {
      if (!item)
        return { hex: "#FFFFFF", displayName: "", erpCode: "", L: 0, C: 0, H: 0 };
      const c = new Color("oklch", [item.L, item.C, item.H]);
      const hex = c
        .clone()
        .toGamut({ space: "srgb" })
        .toString({ format: "hex" })
        .toUpperCase();
      let cleanErp = extractCleanColorCode(item);
      if (!cleanErp && item.brand !== undefined && item.originalIndex !== undefined) {
        const cItem = colorData[item.brand]?.[item.originalIndex];
        if (cItem) {
          cleanErp = extractCleanColorCode(cItem);
        }
      }
      let pin = item.pinId ? savedColors[item.pinId] : null;
      if (!pin && item.id && savedColors[item.id]?.type === "pin") {
        pin = savedColors[item.id];
      }
      if (!pin) {
        pin = Object.values(savedColors).find(
          (sc) => sc.type === "pin" && sc.erpCode === item.erpCode,
        );
      }

      const targetObj = pin || item;
      const inherited = getInheritedPinNames(
        targetObj,
        savedColors,
        names,
        adjectives,
        colorData,
      );
      let adj = (inherited.displayAdj || "").trim();
      let noun = (inherited.displayName || "").trim();

      if (adj.toUpperCase() === "UNNAMED" || adj.toUpperCase() === "UNNAMED ADJ") adj = "";
      if (
        noun.toUpperCase() === "UNNAMED" ||
        noun.toUpperCase() === "UNNAMED NOUN"
      ) {
        noun = "";
      }

      const derivedName = `${adj} ${noun}`.trim();
      const displayName = (derivedName || noun || adj || (cleanErp ? `#${cleanErp}` : "\u2014")).toUpperCase();

      let image = item.image;
      let sheen = item.sheen;
      let material = item.material;
      let visualTexture = item.visualTexture;
      let tactileTexture = item.tactileTexture;
      let doorProfile = item.doorProfile;

      if (pin) {
        if (!image)
          image =
            pin.image || (pin.notes?.startsWith("http") ? pin.notes : null);
        if (!sheen) sheen = pin.sheen;
        if (!material) material = pin.material;
        if (!visualTexture) visualTexture = pin.visualTexture;
        if (!tactileTexture) tactileTexture = pin.tactileTexture;
        if (!doorProfile) doorProfile = pin.doorProfile;
        if (pin.brand !== undefined && pin.originalIndex !== undefined) {
          const cItem = colorData[pin.brand]?.[pin.originalIndex];
          if (cItem) {
            if (!image) image = cItem.image || null;
            if (!sheen) sheen = cItem.sheen;
            if (!material) material = cItem.material;
            if (!visualTexture) visualTexture = cItem.visualTexture;
            if (!tactileTexture) tactileTexture = cItem.tactileTexture;
            if (!doorProfile) doorProfile = cItem.doorProfile;
          }
        }
      }

      if (item.brand !== undefined && item.originalIndex !== undefined) {
        const cItem = colorData[item.brand]?.[item.originalIndex];
        if (cItem) {
          if (!image) image = cItem.image || null;
          if (!sheen) sheen = cItem.sheen;
          if (!material) material = cItem.material;
          if (!visualTexture) visualTexture = cItem.visualTexture;
          if (!tactileTexture) tactileTexture = cItem.tactileTexture;
          if (!doorProfile) doorProfile = cItem.doorProfile;
        }
      }

      return {
        hex,
        displayName,
        erpCode: cleanErp || "N/A",
        L: item.L,
        C: item.C,
        H: item.H,
        pin,
        image,
        sheen,
        material,
        visualTexture,
        tactileTexture,
        doorProfile,
      };
    },
    [savedColors, adjectives, names, colorData],
  );

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
  const [printLabelBorders, setPrintLabelBorders] = useState(false);

  const [printLabelDoorProfile, setPrintLabelDoorProfile] = useState("SL (Slab)");
  const [printLabelSheen, setPrintLabelSheen] = useState("MT (Matte)");
  const [printLabelVisualTexture, setPrintLabelVisualTexture] = useState("V2 (Straight Grain)");
  const [printLabelTactileTexture, setPrintLabelTactileTexture] = useState("T3 (Linear Grain)");
  const [printLabelMaterial, setPrintLabelMaterial] = useState("Solid Laminate");

  const averySourceItems = useMemo(() => {
    if (averyPrintSourceType === "pins") {
      const pins = Object.values(savedColors).filter((sc) => sc.type === "pin").map((sc) => ({
        id: sc.id,
        L: sc.L,
        C: sc.C,
        H: sc.H,
        erpCode: sc.erpCode,
        adjId: sc.adjId,
        nounId: sc.anchorId,
        pinId: sc.id,
        brand: sc.brand,
        originalIndex: sc.originalIndex,
        sheen: sc.sheen,
        material: sc.material,
        visualTexture: sc.visualTexture,
        tactileTexture: sc.tactileTexture,
        doorProfile: sc.doorProfile,
      }));
      return pins;
    }
    if (averyPrintSourceType === "db" || averyPrintSourceType === "commercial") {
      if (!colorData) return [];
      const targetIds = new Set(
        selectedPrintIds && selectedPrintIds.length > 0
          ? selectedPrintIds
          : (selectedIds && selectedIds.length > 0 ? selectedIds : [])
      );
      if (targetIds.size === 0) return [];

      const dbItems = [];
      Object.keys(colorData).forEach((brand) => {
        (colorData[brand] || []).forEach((c, idx) => {
          const itemId = `${brand}-${idx}`;
          if (!targetIds.has(itemId)) return;

          let L = c.L;
          let C = c.C;
          let H = c.H;
          let hexVal = c.hex || "#000000";
          if (c.spectral && c.spectral.length === 31) {
            try {
              const xyzStandard = calculateXYZFromSpectral(c.spectral, 2, "D65");
              const col = new Color("xyz-d65", xyzStandard).to("oklch");
              L = col.coords[0];
              C = col.coords[1];
              H = isNaN(col.coords[2]) ? 0 : ((col.coords[2] % 360) + 360) % 360;
              hexVal = col.to("srgb").toString({ format: "hex" });
            } catch (e) {}
          } else if (L === undefined || L === null) {
            let tc;
            if (c.hex) {
              try { tc = createColorFromHex(c.hex).to("oklch"); } catch (e) {}
            }
            if (tc) {
              L = tc.coords[0];
              C = tc.coords[1];
              H = isNaN(tc.coords[2]) ? 0 : ((tc.coords[2] % 360) + 360) % 360;
            } else {
              L = 0.5; C = 0; H = 0;
            }
          }
          const cleanCode = extractCleanColorCode(c);
          dbItems.push({
            id: itemId,
            L,
            C,
            H,
            hex: hexVal,
            erpCode: cleanCode,
            url: c.url || "",
            commercialName: c.name || "",
            brand,
            originalIndex: idx,
            sheen: c.sheen,
            material: c.material,
            visualTexture: c.visualTexture,
            tactileTexture: c.tactileTexture,
            doorProfile: c.doorProfile,
            image: c.image || null,
          });
        });
      });
      return dbItems;
    }
    return palette;
  }, [averyPrintSourceType, savedColors, palette, colorData, selectedPrintIds, selectedIds]);

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
  const [observer, setObserver] = useState(initialState?.observer || 2);
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
    let currentSavedPalettes = savedPalettes || [];
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
      if (f !== "anchors.csv" && f !== "pins.csv" && f !== "template.csv") filesToLoad.push(f);
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
            currentSavedPalettes,
          );
          currentColorData = processed.newColorData;
          currentSavedColors = processed.newSavedColors;
          currentNames = processed.newNames;
          currentAdjs = processed.newAdjs;
          currentNotes = processed.newNotes;
          currentTags = processed.newTags;
          if (processed.newGroupSettings)
            currentGroupSettings = processed.newGroupSettings;
          if (processed.newSavedPalettes)
            currentSavedPalettes = processed.newSavedPalettes;
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
    setSavedPalettes(currentSavedPalettes);
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
    const isDb = activeTab === "db";

    let binBounds = null;
    if (filterSameAdjective || filterSameNoun) {
      const unfilteredPts = getUnfilteredPoints(gridData, savedColors);
      binBounds = getCursorBinBoundaries(
        scrubL,
        scrubC,
        scrubH,
        savedColors,
        unfilteredPts
      );
    }

    const filtered = {};
    for (const brand of Object.keys(colorData)) {
      const isVisible = isDb ? viewportVisibility.brands[brand] !== false : viewportVisibility.brands[brand] === true;
      if (isVisible) {
        let list = colorData[brand];
        if ((filterSameAdjective || filterSameNoun) && binBounds) {
          list = list.filter((c) => {
            let itemL, itemC, itemH;
            if (c.L !== undefined && c.L !== null && !isNaN(c.L)) {
              itemL = c.L;
              itemC = c.C;
              itemH = isNaN(c.H) ? 0 : c.H;
            } else {
              try {
                let targetColor;
                if (c.spectral && c.spectral.length === 31) {
                  const xyzStandard = calculateXYZFromSpectral(
                    c.spectral,
                    2,
                    "D65",
                  );
                  targetColor = new Color("xyz-d65", xyzStandard).to("oklch");
                } else {
                  targetColor = createColorFromHex(c.hex || "#000000").to("oklch");
                }
                itemL = targetColor.coords[0];
                itemC = targetColor.coords[1];
                itemH = isNaN(targetColor.coords[2]) ? 0 : targetColor.coords[2];
              } catch (e) {
                return false;
              }
            }
            if (filterSameAdjective && !isPointInSameAdjective(itemL, binBounds)) {
              return false;
            }
            if (filterSameNoun && !isPointInSameNoun(itemC, itemH, binBounds)) {
              return false;
            }
            return true;
          });
        }
        filtered[brand] = list;
      }
    }
    return filtered;
  }, [
    colorData,
    gridData,
    viewportVisibility,
    filterSameAdjective,
    filterSameNoun,
    savedColors,
    scrubL,
    scrubC,
    scrubH,
    names,
    activeTab,
  ]);
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
  const [swatchZoom, setSwatchZoom] = useState(2);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [showCompareFullscreen, setShowCompareFullscreen] = useState(false);
  const [showFullscreenSpectral, setShowFullscreenSpectral] = useState(true);
  const [showFullscreenPalette, setShowFullscreenPalette] = useState(false);
  const [showFullscreenImageOverlay, setShowFullscreenImageOverlay] = useState(true);
  const [showFullscreenSpaces, setShowFullscreenSpaces] = useState(false);
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
      try {
        localStorage.setItem("color-samificator-state", currentStateStr);
      } catch (e) {
        console.warn("Failed to persist state to localStorage:", e);
      }
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
          image: sc.image || (sc.notes?.startsWith("http") ? sc.notes : undefined),
          brand: sc.brand,
          originalIndex: sc.originalIndex,
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
    if (filterSameAdjective || filterSameNoun) {
      const binBounds = getCursorBinBoundaries(
        scrubL,
        scrubC,
        scrubH,
        savedColors,
        points
      );

      if (binBounds && binBounds.hasAnchors) {
        points = points.filter((p) => {
          if (filterSameAdjective && !isPointInSameAdjective(p.L, binBounds)) return false;
          if (filterSameNoun && !isPointInSameNoun(p.C, p.H, binBounds)) return false;
          return true;
        });

        Object.keys(filteredSavedColors).forEach((k) => {
          const sc = filteredSavedColors[k];
          if (sc.type === "nounColumn") {
            if (filterSameAdjective && !isNounColumnInSameAdjective(sc, binBounds)) {
              delete filteredSavedColors[k];
            } else if (filterSameNoun && !isNounColumnInSameNoun(sc, binBounds)) {
              delete filteredSavedColors[k];
            }
          } else {
            if (filterSameAdjective && !isPointInSameAdjective(sc.L, binBounds)) {
              delete filteredSavedColors[k];
            } else if (filterSameNoun && !isPointInSameNoun(sc.C, sc.H, binBounds)) {
              delete filteredSavedColors[k];
            }
          }
        });

        baseAnchors = baseAnchors.filter((ba) => {
          const minL = ba.minL !== undefined ? ba.minL : (ba.L !== undefined ? ba.L : 0);
          const maxL = ba.maxL !== undefined ? ba.maxL : (ba.L !== undefined ? ba.L : 1);
          if (filterSameAdjective && !isNounColumnInSameAdjective({ minL, maxL, C: ba.C, H: ba.H }, binBounds)) return false;
          if (filterSameNoun && !isNounColumnInSameNoun({ minL, maxL, C: ba.C, H: ba.H }, binBounds)) return false;
          return true;
        });
      }
    }
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
    filterSameAdjective,
    filterSameNoun,
    scrubL,
    scrubC,
    scrubH,
  ]);
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);
  const handleUpdate = (pt, spectralData = null, commercialData = null) => {
    const L = pt[0];
    const C = pt[1];
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
        const cStr = Math.round(effectiveC * 100).toString().padStart(2, "0");
        const hStr = Math.round(effectiveH).toString().padStart(3, "0");
        const baseId = `${cStr}-${hStr}`;
        const prefix =
          effectiveL >= 0.95
            ? "UL"
            : effectiveL >= 0.5
            ? "L"
            : effectiveL >= 0.2
            ? "D"
            : "UD";
        const prefId = `${prefix}-${baseId}`;
        nearestAnchorId = names[prefId] ? prefId : (names[baseId] ? baseId : prefId);
      }
    }
    const exactErpCode = getExactErpCode(scrubL, scrubC, scrubH);
    const activeErpCode = exactErpCode;
    let validatedCommercial = null;
    if (scrubCommercial && colorData) {
      const { brand, originalIndex } = scrubCommercial;
      const target = colorData[brand]?.[originalIndex];
      if (target) {
        const dL = Math.abs(scrubL - target.L);
        const dC = Math.abs(scrubC - target.C);
        let dH = Math.abs(scrubH - target.H);
        dH = Math.min(dH, 360 - dH);
        if (dL <= 0.0001 && dC <= 0.0001 && dH <= 0.0001) {
          validatedCommercial = scrubCommercial;
        }
      }
    }
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
      activeCommercial: validatedCommercial,
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
        const m = colorData[targetCommercial.brand]?.[targetCommercial.originalIndex];
        setSavedColors((prev) => ({
          ...prev,
          [tetheringPinId]: {
            ...prev[tetheringPinId],
            parentPinId: null,
            anchorId: `commercial-${targetCommercial.brand}-${targetCommercial.originalIndex}`,
            brand: targetCommercial.brand,
            originalIndex: targetCommercial.originalIndex,
            image: m?.image || null,
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
      { id: "nix", label: "Nix Spectro" },
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
                c = createColorFromHex(item.hex).to("oklch");
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
      let pinImage = null;
      let pinBrand = undefined;
      let pinOriginalIndex = undefined;
      let pinSheen = undefined;
      let pinMaterial = undefined;
      let pinDoorProfile = undefined;
      let pinTactileTexture = undefined;
      let pinVisualTexture = undefined;
      if (crosshair.activeCommercial) {
        const m = colorData[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
        pinImage = m?.image || null;
        pinBrand = crosshair.activeCommercial.brand;
        pinOriginalIndex = crosshair.activeCommercial.originalIndex;
        pinSheen = m?.sheen || "";
        pinMaterial = m?.material || "";
        pinDoorProfile = m?.doorProfile || "";
        pinTactileTexture = m?.tactileTexture || "";
        pinVisualTexture = m?.visualTexture || "";
      }
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
          brand: pinBrand,
          originalIndex: pinOriginalIndex,
          image: pinImage,
          sheen: pinSheen,
          material: pinMaterial,
          doorProfile: pinDoorProfile,
          tactileTexture: pinTactileTexture,
          visualTexture: pinVisualTexture,
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

      const getExtraColorValues = (L, C, H, hex) => {
        try {
          let col;
          if (L !== undefined && L !== "" && C !== undefined && H !== undefined) {
            col = new Color("oklch", [parseFloat(L), parseFloat(C), parseFloat(H)]);
          } else if (hex) {
            let ch = String(hex).trim();
            if (!ch.startsWith("#")) ch = "#" + ch;
            col = createColorFromHex(ch);
          }
          if (!col) return {};
          const srgb = col.to("srgb");
          const r = Math.round(Math.max(0, Math.min(1, srgb.coords[0])) * 255);
          const g = Math.round(Math.max(0, Math.min(1, srgb.coords[1])) * 255);
          const b = Math.round(Math.max(0, Math.min(1, srgb.coords[2])) * 255);

          const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
          const k_ = 1 - Math.max(rNorm, gNorm, bNorm);
          const c_ = k_ === 1 ? 0 : (1 - rNorm - k_) / (1 - k_);
          const m_ = k_ === 1 ? 0 : (1 - gNorm - k_) / (1 - k_);
          const y_ = k_ === 1 ? 0 : (1 - bNorm - k_) / (1 - k_);

          const cPerc = `${Math.round(c_ * 100)}%`;
          const mPerc = `${Math.round(m_ * 100)}%`;
          const yPerc = `${Math.round(y_ * 100)}%`;
          const kPerc = `${Math.round(k_ * 100)}%`;

          const lab = col.to("lab");
          const labL = lab.coords[0].toFixed(2);
          const labA = lab.coords[1].toFixed(2);
          const labB = lab.coords[2].toFixed(2);

          return {
            RGB_R: r,
            RGB_G: g,
            RGB_B: b,
            RGB: `[${r}, ${g}, ${b}]`,
            CMYK_C: cPerc,
            CMYK_M: mPerc,
            CMYK_Y: yPerc,
            CMYK_K: kPerc,
            CMYK: `[${cPerc}, ${mPerc}, ${yPerc}, ${kPerc}]`,
            CIE_L: labL,
            CIE_A: labA,
            CIE_B: labB,
            CIE_LAB: `[${labL}, ${labA}, ${labB}]`,
          };
        } catch (e) {
          return {};
        }
      };

      const exportedAnchorIds = new Set();
      Object.values(savedColors).forEach((sc) => {
        if (sc.type === "nounColumn") {
          exportedAnchorIds.add(sc.id);
          const nounName = names[sc.id] || sc.nameOverride || "";
          anchorsCsv.push({
            Type: "NOUN",
            ID: sc.id || "",
            Noun: nounName,
            Note: sc.notes || dictNotes[sc.id] || "",
            Tags: (dictTags[sc.id] || []).join(","),
            OKLCH_L:
              sc.minL !== undefined && sc.maxL !== undefined
                ? `${sc.minL}-${sc.maxL}`
                : sc.L !== undefined
                  ? sc.L
                  : "",
            OKLCH_C: sc.C !== undefined ? sc.C : "",
            OKLCH_H: sc.H !== undefined ? sc.H : "",
          });
        } else if (sc.type === "anchor") {
          exportedAnchorIds.add(sc.id);
          if (sc.anchorId) exportedAnchorIds.add(sc.anchorId);
          const extra = getExtraColorValues(sc.L, sc.C, sc.H, sc.color || sc.hex);
          const anchorNoun = names[sc.anchorId] || names[sc.id] || sc.nameOverride || "";
          const anchorAdj = sc.adjOverride || adjectives[sc.adjId] || adjectives[sc.id] || "";
          anchorsCsv.push({
            Type: "ANCHOR",
            ID: sc.id || sc.anchorId || "",
            Noun: anchorNoun,
            Adjective: anchorAdj,
            Note: sc.notes || dictNotes[sc.id] || dictNotes[sc.anchorId] || "",
            Tags: (dictTags[sc.id] || dictTags[sc.anchorId] || []).join(","),
            OKLCH_L: sc.L !== undefined ? sc.L : "",
            OKLCH_C: sc.C !== undefined ? sc.C : "",
            OKLCH_H: sc.H !== undefined ? sc.H : "",
            ...extra,
            HEX:
              sc.color ||
              (sc.L !== undefined && sc.C !== undefined && sc.H !== undefined
                ? new Color("oklch", [sc.L, sc.C, sc.H])
                    .clone()
                    .toGamut({ space: "srgb" })
                    .toString({ format: "hex" })
                : ""),
            Locked: sc.locked !== false ? "TRUE" : "FALSE",
            ERP_Code: sc.erpCode || "",
          });
        }
      });

      Object.keys(names).forEach((id) => {
        if (exportedAnchorIds.has(id)) return;
        const name = names[id];
        if (!name) return;
        const nc = savedColors[id];
        if (nc && nc.type === "nounColumn") {
          anchorsCsv.push({
            Type: "NOUN",
            ID: id,
            Noun: name,
            Note: dictNotes[id] || "",
            Tags: (dictTags[id] || []).join(","),
            OKLCH_L: `${nc.minL}-${nc.maxL}`,
            OKLCH_C: nc.C,
            OKLCH_H: nc.H,
          });
        } else {
          const parts = id.split("-");
          let cVal = "";
          let hVal = "";
          let lVal = "";
          if (parts.length === 2) {
            cVal = (parseInt(parts[0], 10) / 100).toString();
            hVal = parseInt(parts[1], 10).toString();
          } else if (parts.length === 3) {
            if (parts[0] === "UL") lVal = "0.95-1";
            else if (parts[0] === "L") lVal = "0.5-0.95";
            else if (parts[0] === "D") lVal = "0.2-0.5";
            else if (parts[0] === "UD") lVal = "0-0.2";
            cVal = (parseInt(parts[1], 10) / 100).toString();
            hVal = parseInt(parts[2], 10).toString();
          }
          anchorsCsv.push({
            Type: "NOUN",
            ID: id,
            Noun: name,
            Note: dictNotes[id] || "",
            Tags: (dictTags[id] || []).join(","),
            OKLCH_L: lVal,
            OKLCH_C: cVal,
            OKLCH_H: hVal,
          });
        }
      });

      Object.keys(adjectives).forEach((adjId) => {
        anchorsCsv.push({
          Type: "ADJECTIVE",
          ID: adjId,
          Adjective: adjectives[adjId] || "",
          OKLCH_L: adjId,
        });
      });

      Object.values(savedColors)
        .filter((sc) => sc.type === "pin")
        .forEach((sc) => {
          const extra = getExtraColorValues(sc.L, sc.C, sc.H, sc.hex);
          const pinNames = getInheritedPinNames(
            sc,
            savedColors,
            names,
            adjectives,
            colorData,
          );
          pinsCsv.push({
            Type: "PIN",
            ID: sc.id || "",
            Parent_Pin_ID: sc.parentPinId || "",
            Anchor_ID: sc.anchorId || pinNames.sourceId || "",
            Adj_ID: sc.adjId || "",
            Brand: sc.brand || "",
            Original_Index: sc.originalIndex !== undefined ? sc.originalIndex : "",
            Image: sc.image || "",
            Noun: sc.nameOverride || pinNames.displayName || "",
            Adjective: sc.adjOverride || pinNames.displayAdj || "",
            Note: sc.notes || "",
            Tags: (dictTags[sc.id] || []).join(","),
            OKLCH_L: sc.L,
            OKLCH_C: sc.C,
            OKLCH_H: sc.H,
            ...extra,
            ERP_Code: sc.erpCode,
            Sheen: sc.sheen || "",
            Profile: sc.doorProfile || "",
            Visual_Pattern: sc.visualTexture || "",
            Tactile_Texture: sc.tactileTexture || "",
            Material: sc.material || "",
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
      const palettesCsv = [];
      (savedPalettes || []).forEach((p) => {
        palettesCsv.push({
          Type: "PALETTE",
          Noun: p.name,
          Note: JSON.stringify(p.colors),
          Tags: p.id,
        });
      });
      const makeExportRow = (data) => {
        const base = {
          Type: "",
          ID: "",
          Parent_Pin_ID: "",
          Anchor_ID: "",
          Adj_ID: "",
          Brand: "",
          Original_Index: "",
          Image: "",
          Noun: "",
          Adjective: "",
          Note: "",
          Tags: "",
          Locked: "",
          HEX: "",
          OKLCH_L: "",
          OKLCH_C: "",
          OKLCH_H: "",
          RGB_R: "",
          RGB_G: "",
          RGB_B: "",
          RGB: "",
          CMYK_C: "",
          CMYK_M: "",
          CMYK_Y: "",
          CMYK_K: "",
          CMYK: "",
          CIE_L: "",
          CIE_A: "",
          CIE_B: "",
          CIE_LAB: "",
          ERP_Code: "",
          Sheen: "",
          Profile: "",
          Visual_Pattern: "",
          Tactile_Texture: "",
          Material: "",
          Spectral: "",
          Illuminant: "",
          Observer: "",
          Measurement_Method: "",
          Measurement_Date: "",
          Measurement_Device: "",
        };
        if (SPECTRAL_TABLES) {
          SPECTRAL_TABLES.wavelengths.forEach((w) => {
            base[`R${w} nm`] = "";
          });
        }
        return Object.assign(base, data);
      };
      const zip = new JSZip();
      zip.file("anchors.csv", Papa.unparse(anchorsCsv.map(makeExportRow)));
      zip.file("pins.csv", Papa.unparse(pinsCsv.map(makeExportRow)));
      zip.file("palettes.csv", Papa.unparse(palettesCsv.map(makeExportRow)));

      const templateExtra = getExtraColorValues(0.5, 0.1, 180, "#888888");
      const templateRows = [
        makeExportRow({
          Type: "DB",
          Noun: "Color Name",
          Adjective: "Brand Name",
          Note: "Image URL or Note",
          Tags: "tag1, tag2",
          Locked: "",
          HEX: "#888888",
          OKLCH_L: "0.5",
          OKLCH_C: "0.1",
          OKLCH_H: "180",
          ...templateExtra,
          ERP_Code: "https://example.com/color-link",
          Sheen: "Matte",
          Profile: "Flat",
          Visual_Pattern: "Solid",
          Tactile_Texture: "Smooth",
          Material: "Laminate",
          Spectral: "[0.1, 0.1, ...]",
          Illuminant: "D65",
          Observer: "2",
          Measurement_Method: "Reflection",
          Measurement_Date: "2026-01-01",
          Measurement_Device: "Spectrophotometer",
        }),
      ];
      zip.file("template.csv", Papa.unparse(templateRows));
      Object.keys(colorData || {}).forEach((brand) => {
        const brandData = colorData[brand].map((color, listIdx) => {
          const safeName = color.name || `unknown-${listIdx}`;
          const idUrl = color.url || safeName.replace(/\s+/g, "-");
          const customId = `brand-${brand}-${idUrl}`;
          const customName =
            names[customId] !== void 0 ? names[customId] : color.name;
          const customNote =
            dictNotes[customId] !== void 0 ? dictNotes[customId] : color.image;
          const extra = getExtraColorValues(color.L, color.C, color.H, color.hex);
          const row = {
            Type: "DB",
            Adjective: brand,
            Noun: customName || "",
            HEX: color.hex || "",
            OKLCH_L: color.L !== void 0 ? color.L : "",
            OKLCH_C: color.C !== void 0 ? color.C : "",
            OKLCH_H: color.H !== void 0 ? color.H : "",
            ...extra,
            ERP_Code: color.url || "",
            Note: customNote || "",
            Tags: (color.tags || dictTags[customId] || []).join(","),
            Sheen: color.sheen || "",
            Profile: color.doorProfile || "",
            Visual_Pattern: color.visualTexture || "",
            Tactile_Texture: color.tactileTexture || "",
            Material: color.material || "",
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
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const parsed = parseCSV(text);
      if (!parsed.length) {
        e.target.value = "";
        return;
      }
      const processed = processCSVData(
        parsed,
        colorData,
        savedColors,
        names,
        adjectives,
        dictNotes,
        dictTags,
        groupSettings,
        savedPalettes
      );
      if (processed.newGroupSettings) {
        setGroupSettings(processed.newGroupSettings);
      }
      setNames(processed.newNames);
      setAdjectives(processed.newAdjs);
      setDictNotes(processed.newNotes);
      setSavedColors(processed.newSavedColors);
      setDictTags(processed.newTags);
      setSavedPalettes(processed.newSavedPalettes);
      if (Object.keys(processed.newColorData).length > 0) {
        updateColorData(processed.newColorData);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };
  const addToPalette = () => {
    if (!crosshair) return;
    const pinId =
      crosshair.activeSavedColor?.type === "pin"
        ? crosshair.activeSavedColor.id
        : null;
    let imageSrc = null;
    let brand = undefined;
    let originalIndex = undefined;
    if (crosshair.activeCommercial) {
      const match = colorData[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
      imageSrc = match?.image || null;
      brand = crosshair.activeCommercial.brand;
      originalIndex = crosshair.activeCommercial.originalIndex;
    } else if (pinId && savedColors[pinId]) {
      const pinObj = savedColors[pinId];
      imageSrc = pinObj.image || (pinObj.notes?.startsWith("http") ? pinObj.notes : null);
      brand = pinObj.brand;
      originalIndex = pinObj.originalIndex;
    }
    const newItem = {
      id: crypto.randomUUID(),
      L: scrubL,
      C: scrubC,
      H: scrubH,
      erpCode: crosshair.activeErpCode,
      adjId: crosshair.nearestAdjId,
      nounId: crosshair.nearestAnchorId,
      pinId,
      image: imageSrc,
      brand,
      originalIndex,
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
    let imageSrc = null;
    let brand = undefined;
    let originalIndex = undefined;
    if (crosshair.activeCommercial) {
      const match = colorData[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
      imageSrc = match?.image || null;
      brand = crosshair.activeCommercial.brand;
      originalIndex = crosshair.activeCommercial.originalIndex;
    } else if (pinId && savedColors[pinId]) {
      const pinObj = savedColors[pinId];
      imageSrc = pinObj.image || (pinObj.notes?.startsWith("http") ? pinObj.notes : null);
      brand = pinObj.brand;
      originalIndex = pinObj.originalIndex;
    }
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
              image: imageSrc,
              brand,
              originalIndex,
            }
          : item,
      ),
    );
  };
  const generateAutoPalette = (type = "luxury_interior") => {
    const schemeType = type || "luxury_interior";
    const h0 = scrubH || 0;
    const l0 = scrubL !== undefined && scrubL !== null ? scrubL : 0.65;
    const c0 = scrubC !== undefined && scrubC !== null ? scrubC : 0.08;

    // Helper functions for pure relative OKLCH math
    const clampL = (val) => Math.max(0.06, Math.min(0.97, val));
    const clampC = (val) => Math.max(0.004, Math.min(0.30, val));
    const modH = (val) => ((val % 360) + 360) % 360;

    // 60-30-10 Rule Metadata:
    // 60% Dominant (4 swatches, 15% ratio each = 60%)
    // 30% Secondary (2 swatches, 15% ratio each = 30%)
    // 10% Accent (1 swatch, 10% ratio = 10%)
    const roles = [
      { group: "60%", name: "Dominant", ratio: 15 },
      { group: "60%", name: "Dominant", ratio: 15 },
      { group: "60%", name: "Dominant", ratio: 15 },
      { group: "60%", name: "Dominant", ratio: 15 },
      { group: "30%", name: "Secondary", ratio: 15 },
      { group: "30%", name: "Secondary", ratio: 15 },
      { group: "10%", name: "Accent", ratio: 10 }
    ];

    let hues = [];
    let Ls = [];
    let Cs = [];
    let names = [];

    switch (schemeType) {
      case "luxury_interior":
      case "creative_blend":
      default:
        // Signature 60-30-10 Architectural OKLCH Interior Suite
        // 60% DOMINANT (4 Swatches): Plaster Wall, Primary Cabinetry, Secondary Millwork, Dark Trim
        // 30% SECONDARY (2 Swatches): Island / Upholstery, Honed Marble Countertop
        // 10% ACCENT (1 Swatch): Brushed Metal Hardware & Pop
        hues = [
          h0,                     // Wall Plaster (60%)
          h0,                     // Primary Cabinetry (60%)
          modH(h0 + 10),          // Secondary Millwork (60%)
          h0,                     // Dark Trim & Base (60%)
          modH(h0 - 15),          // Island / Upholstery (30%)
          modH(h0 - 8),           // Marble Countertop (30%)
          modH(h0 + 38)           // Hardware Accent (10%)
        ];
        Ls = [
          clampL(l0 + 0.28),
          l0,
          clampL(l0 - 0.12),
          clampL(l0 - 0.30),
          clampL(l0 - 0.08),
          clampL(l0 + 0.22),
          clampL(l0 + 0.06)
        ];
        Cs = [
          clampC(c0 * 0.35),
          c0,
          clampC(c0 * 0.85),
          clampC(c0 * 0.65),
          clampC(c0 * 0.90),
          clampC(c0 * 0.40),
          clampC(c0 * 1.25)
        ];
        names = [
          "60% Dominant — Plaster Wall Canvas",
          "60% Dominant — Primary Cabinetry Finish",
          "60% Dominant — Secondary Millwork Tonal",
          "60% Dominant — Architectural Trim & Shade",
          "30% Secondary — Island & Upholstery",
          "30% Secondary — Honed Marble Countertop",
          "10% Accent — Metal Hardware & Pop"
        ];
        break;

      case "quiet_luxury":
      case "monochromatic":
      case "shades":
      case "monochromatic_layers":
        // Quiet Luxury Monochromatic Spectrum (60-30-10 Rule)
        // 60% DOMINANT (4 Swatches): Light Alabaster to Natural Wood
        // 30% SECONDARY (2 Swatches): Deep Oak to Smoked Walnut
        // 10% ACCENT (1 Swatch): Warm Bronze / Metallic Detail
        hues = [h0, h0, h0, h0, h0, h0, modH(h0 + 25)];
        Ls = [
          clampL(l0 + 0.28),
          clampL(l0 + 0.16),
          l0,
          clampL(l0 - 0.14),
          clampL(l0 - 0.26),
          clampL(l0 - 0.38),
          clampL(l0 - 0.05)
        ];
        Cs = [
          clampC(c0 * 0.35),
          clampC(c0 * 0.60),
          c0,
          clampC(c0 * 0.85),
          clampC(c0 * 0.75),
          clampC(c0 * 0.50),
          clampC(c0 * 1.20)
        ];
        names = [
          "60% Dominant — Alabaster Wall Finish",
          "60% Dominant — Sand Lime Plaster",
          "60% Dominant — Primary Cabinetry Finish",
          "60% Dominant — Natural Wood Grain",
          "30% Secondary — Deep Oak Millwork",
          "30% Secondary — Smoked Walnut Grounding",
          "10% Accent — Warm Bronze Metallic Pop"
        ];
        break;

      case "warm_wood_stone":
      case "analogous":
        // Warm Wood & Stone Organic Harmony (60-30-10 Rule)
        // 60% DOMINANT (4 Swatches): Limestone Wall, Primary Wood, Honey Oak, Walnut Shade
        // 30% SECONDARY (2 Swatches): Travertine Stone & Leather Upholstery
        // 10% ACCENT (1 Swatch): Aged Brass Detail
        hues = [
          modH(h0 - 15),
          h0,
          modH(h0 + 12),
          modH(h0 - 8),
          modH(h0 + 22),
          modH(h0 - 18),
          modH(h0 + 35)
        ];
        Ls = [
          clampL(l0 + 0.24),
          l0,
          clampL(l0 + 0.10),
          clampL(l0 - 0.22),
          clampL(l0 + 0.18),
          clampL(l0 - 0.10),
          clampL(l0 + 0.08)
        ];
        Cs = [
          clampC(c0 * 0.45),
          c0,
          clampC(c0 * 0.80),
          clampC(c0 * 0.70),
          clampC(c0 * 0.50),
          clampC(c0 * 0.90),
          clampC(c0 * 1.25)
        ];
        names = [
          "60% Dominant — Limestone Wall Base",
          "60% Dominant — Main Cabinetry Finish",
          "60% Dominant — Honey Oak Grain",
          "60% Dominant — Deep Walnut Shade",
          "30% Secondary — Travertine Stone Surface",
          "30% Secondary — Leather Upholstery",
          "10% Accent — Aged Brass Detail"
        ];
        break;

      case "statement_millwork":
      case "triadic":
        // High-Contrast Architectural Millwork (60-30-10 Rule)
        // 60% DOMINANT (4 Swatches): Crisp Architectural Wall, Deep Statement Cabinetry, Mid-Tone, Baseboard
        // 30% SECONDARY (2 Swatches): Calacatta Quartz & Secondary Island Finish
        // 10% ACCENT (1 Swatch): Polished Brass / Hardware Pop
        hues = [
          h0,                     // Wall (60%)
          h0,                     // Statement Dark Cabinetry (60%)
          modH(h0 + 8),           // Mid-Tone Transition (60%)
          h0,                     // Baseboard Trim (60%)
          modH(h0 - 12),          // Quartz Countertop (30%)
          modH(h0 + 15),          // Secondary Island (30%)
          modH(h0 + 40)           // Polished Brass (10%)
        ];
        Ls = [
          clampL(l0 + 0.32),
          clampL(l0 - 0.24),
          l0,
          clampL(l0 - 0.38),
          clampL(l0 + 0.26),
          clampL(l0 - 0.12),
          clampL(l0 + 0.08)
        ];
        Cs = [
          clampC(c0 * 0.30),
          c0,
          clampC(c0 * 0.85),
          clampC(c0 * 0.50),
          clampC(c0 * 0.35),
          clampC(c0 * 0.90),
          clampC(c0 * 1.30)
        ];
        names = [
          "60% Dominant — Pure Architectural Wall",
          "60% Dominant — Statement Dark Cabinetry",
          "60% Dominant — Mid-Tone Millwork Finish",
          "60% Dominant — Espresso Trim & Base",
          "30% Secondary — Calacatta Quartz Surface",
          "30% Secondary — Secondary Island Finish",
          "10% Accent — Polished Brass Hardware"
        ];
        break;

      case "muted_complement":
      case "complementary":
      case "split_complementary":
      case "tetradic":
        // Symmetrical OKLCH Complementary Matrix (60-30-10 Rule)
        // 60% DOMINANT (4 Swatches): Primary Wall, Main Cabinetry, Soft Base Tint, Dark Shade
        // 30% SECONDARY (2 Swatches): Muted Complement Accent Wall & Accent Cabinetry
        // 10% ACCENT (1 Swatch): Warm Metal Detail
        const hComp = modH(h0 + 180);
        hues = [
          h0,                     // Primary Wall (60%)
          h0,                     // Main Cabinetry (60%)
          h0,                     // Soft Base Tint (60%)
          h0,                     // Dark Shade (60%)
          hComp,                  // Complement Accent Wall (30%)
          hComp,                  // Complement Cabinetry (30%)
          modH(h0 + 32)           // Warm Metal Detail (10%)
        ];
        Ls = [
          clampL(l0 + 0.26),
          l0,
          clampL(l0 + 0.12),
          clampL(l0 - 0.26),
          clampL(l0 + 0.20),
          l0,
          clampL(l0 + 0.08)
        ];
        Cs = [
          clampC(c0 * 0.40),
          c0,
          clampC(c0 * 0.70),
          clampC(c0 * 0.75),
          clampC(c0 * 0.45),
          clampC(c0 * 0.75),
          clampC(c0 * 1.20)
        ];
        names = [
          "60% Dominant — Primary Wall Canvas",
          "60% Dominant — Main Cabinetry Finish",
          "60% Dominant — Soft Base Tint",
          "60% Dominant — Dark Millwork Shade",
          "30% Secondary — Organic Muted Accent Wall",
          "30% Secondary — Muted Accent Cabinetry",
          "10% Accent — Warm Metal Detail"
        ];
        break;

      case "atmospheric_interior":
      case "atmospheric":
        // Soft Atmospheric OKLCH Wash (60-30-10 Rule)
        // 60% DOMINANT (4 Swatches): Plaster, Trim, Core Selection, Ambient Shadow
        // 30% SECONDARY (2 Swatches): Marble Countertop, Secondary Wash
        // 10% ACCENT (1 Swatch): Focal Hardware Pop
        hues = [
          h0,                     // Plaster (60%)
          h0,                     // Linen Trim (60%)
          modH(h0 + 8),           // Core Selection (60%)
          modH(h0 - 8),           // Shadow (60%)
          modH(h0 + 15),          // Marble Countertop (30%)
          modH(h0 + 8),           // Secondary Wash (30%)
          modH(h0 + 35)           // Hardware Pop (10%)
        ];
        Ls = [
          clampL(l0 + 0.28),
          clampL(l0 + 0.14),
          l0,
          clampL(l0 - 0.18),
          clampL(l0 + 0.22),
          clampL(l0 - 0.08),
          clampL(l0 + 0.06)
        ];
        Cs = [
          clampC(c0 * 0.30),
          clampC(c0 * 0.55),
          c0,
          clampC(c0 * 0.80),
          clampC(c0 * 0.35),
          clampC(c0 * 0.90),
          clampC(c0 * 1.25)
        ];
        names = [
          "60% Dominant — Morning Light Plaster",
          "60% Dominant — Soft Linen Trim",
          "60% Dominant — Core Finish Selection",
          "60% Dominant — Ambient Shadow Tone",
          "30% Secondary — Soft Marble Countertop",
          "30% Secondary — Secondary Millwork Wash",
          "10% Accent — Focal Hardware Pop"
        ];
        break;
    }

    const newItems = hues.map((hue, i) => {
      const targetL = Ls[i];
      const targetC = Cs[i];
      return {
        id: crypto.randomUUID(),
        L: targetL,
        C: targetC,
        H: hue,
        erpCode: null,
        adjId: null,
        nounId: null,
        pinId: null,
        image: null,
        brand: undefined,
        originalIndex: undefined,
        nameOverride: names[i],
        roleGroup: roles[i].group,
        roleName: roles[i].name,
        ratio: roles[i].ratio
      };
    });
    setPalette(newItems);
  };
  const isLight = scrubL > 0.65;
  const activeColorObj = new Color("oklch", [scrubL, scrubC, scrubH]);
  let labCoords;
  const spectral =
    crosshair?.activeSavedColor?.spectral || crosshair?.temporarySpectral;
  if (spectral) {
    const varXYZ = calculateXYZFromSpectral(spectral, observer, illuminant);
    const wp = getWhitePoint(observer, illuminant, true);
    labCoords = xyzToLab(varXYZ, wp);
  } else {
    const xyzD65 = activeColorObj.to("xyz-d65").coords;
    let varXYZ;
    if (illuminant === "D65") {
      varXYZ = xyzD65;
    } else {
      const wpD65 = getWhitePoint(observer, "D65");
      const wpTarget = getWhitePoint(observer, illuminant);
      const M_adapt = getGeneralBradfordAdaptationMatrix(wpD65, wpTarget);
      varXYZ = [
        M_adapt[0][0] * xyzD65[0] + M_adapt[0][1] * xyzD65[1] + M_adapt[0][2] * xyzD65[2],
        M_adapt[1][0] * xyzD65[0] + M_adapt[1][1] * xyzD65[1] + M_adapt[1][2] * xyzD65[2],
        M_adapt[2][0] * xyzD65[0] + M_adapt[2][1] * xyzD65[1] + M_adapt[2][2] * xyzD65[2]
      ];
    }
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
      let activeNoun = names[crosshair?.nearestAnchorId] || "";
      let activeAdj = adjectives[crosshair?.nearestAdjId] || "";
      if (!activeNoun || activeNoun === "Unnamed" || activeNoun === "Unnamed Noun" || !activeAdj) {
        const derived = getInheritedPinNames(
          {
            L: crosshair?.rawL,
            C: crosshair?.rawC,
            H: crosshair?.rawH,
            a: crosshair?.a,
            b: crosshair?.b,
            anchorId: crosshair?.nearestAnchorId,
            adjId: crosshair?.nearestAdjId,
          },
          savedColors,
          names,
          adjectives,
          colorData,
        );
        if (!activeNoun || activeNoun === "Unnamed" || activeNoun === "Unnamed Noun") {
          activeNoun = derived.displayName;
        }
        if (!activeAdj) {
          activeAdj = derived.displayAdj;
        }
      }
      return {
        adj: activeAdj,
        name: activeNoun,
        notes: dictNotes[crosshair?.nearestAnchorId] || "",
      };
    }
    const sc = crosshair.activeSavedColor;
    if (sc.type === "anchor") {
      return {
        adj: adjectives[sc.adjId] || "",
        name: names[sc.anchorId] || names[sc.id] || sc.nameOverride || "",
        notes: dictNotes[sc.anchorId] || "",
      };
    } else if (sc.type === "nounColumn") {
      return {
        adj:
          adjectives[crosshair?.nearestAdjId] ||
          adjectives[getLStr(crosshair?.rawL)] ||
          "",
        name: names[sc.id] || sc.nameOverride || "",
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
    filterSameAdjective,
    setFilterSameAdjective,
    filterSameNoun,
    setFilterSameNoun,
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
    generateAutoPalette,
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
    showFullscreenImageOverlay,
    setShowFullscreenImageOverlay,
    showFullscreenSpaces,
    setShowFullscreenSpaces,
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
          fullColorData: colorData,
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
const CustomPromptModal = ({ title, value, setValue, onSubmit, onCancel }) => {
  return React.createElement(
    "div",
    { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" },
    React.createElement(
      "div",
      { className: "bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden" },
      React.createElement(
        "div",
        { className: "p-4 border-b border-slate-100 dark:border-neutral-800" },
        React.createElement("h3", { className: "font-bold text-slate-800 dark:text-neutral-200" }, title)
      ),
      React.createElement(
        "div",
        { className: "p-4" },
        React.createElement("input", {
          autoFocus: true,
          type: "text",
          value: value,
          onChange: (e) => setValue(e.target.value),
          onKeyDown: (e) => { if (e.key === "Enter") onSubmit(); if (e.key === "Escape") onCancel(); },
          className: "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-500 transition-colors"
        })
      ),
      React.createElement(
        "div",
        { className: "p-4 bg-slate-50 dark:bg-neutral-800/50 flex justify-end gap-2" },
        React.createElement("button", { onClick: onCancel, className: "px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors" }, "Cancel"),
        React.createElement("button", { onClick: onSubmit, className: "px-4 py-2 text-xs font-bold uppercase tracking-wider bg-sky-500 hover:bg-sky-600 text-white rounded transition-colors" }, "OK")
      )
    )
  );
};

const CustomConfirmModal = ({ message, onConfirm, onCancel }) => {
  return React.createElement(
    "div",
    { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" },
    React.createElement(
      "div",
      { className: "bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden" },
      React.createElement(
        "div",
        { className: "p-4 border-b border-slate-100 dark:border-neutral-800" },
        React.createElement("h3", { className: "font-bold text-slate-800 dark:text-neutral-200" }, "Confirm")
      ),
      React.createElement(
        "div",
        { className: "p-4" },
        React.createElement("p", { className: "text-sm text-slate-700 dark:text-neutral-300" }, message)
      ),
      React.createElement(
        "div",
        { className: "p-4 bg-slate-50 dark:bg-neutral-800/50 flex justify-end gap-2" },
        React.createElement("button", { onClick: onCancel, className: "px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors" }, "Cancel"),
        React.createElement("button", { autoFocus: true, onClick: onConfirm, className: "px-4 py-2 text-xs font-bold uppercase tracking-wider bg-rose-500 hover:bg-rose-600 text-white rounded transition-colors" }, "Delete")
      )
    )
  );
};

const ViewDatabase = ({
  colorData,
  fullColorData,
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
  onOpenAveryModal,
}) => {
  const dataForUpdates = fullColorData || colorData;
  const [sortBy, setSortBy] = useState("brand");
  const [sortAsc, setSortAsc] = useState(true);
  const [spectralFilter, setSpectralFilter] = useState(true);
  const [dbAxis, setDbAxis] = useState("HxL");
  const [brandFilter, setBrandFilter] = useState("");
  const [userEnableDeltaE, setUserEnableDeltaE] = useState(false);
  const [maxDeltaE, setMaxDeltaE] = useState(5);
  const enableDeltaE = userEnableDeltaE;
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [promptState, setPromptState] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [openFilterCol, setOpenFilterCol] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");

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
            L = col.coords[0];
            C = col.coords[1];
            H = isNaN(col.coords[2]) ? 0 : ((col.coords[2] % 360) + 360) % 360;
            hexVal = col.to("srgb").toString({ format: "hex" });
          } catch (e) {}
        } else if (L === void 0 || L === null) {
          let tc;
          if (c.hex) {
            try {
              tc = createColorFromHex(c.hex).to("oklch");
            } catch (e) {}
          }
          if (tc) {
            L = tc.coords[0];
            C = tc.coords[1];
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
          erpCode: c.url || c.erpCode || extractCleanColorCode(c) || "",
          url: c.url || c.erpCode || "",
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

  const colSortKeyMap = useMemo(
    () => ({
      displayName: "name",
      brand: "brand",
      sheen: "sheen",
      doorProfile: "doorProfile",
      visualTexture: "visualTexture",
      tactileTexture: "tactileTexture",
      material: "material",
      erpCode: "erpCode",
      deltaE: "deltae",
      L: "lightness",
      C: "chroma",
      H: "hue",
    }),
    []
  );

  const COLUMNS_DEF = useMemo(
    () => [
      { id: "displayName", label: "Name", isNumeric: false },
      { id: "brand", label: "Brand", isNumeric: false },
      { id: "sheen", label: "Sheen", isNumeric: false },
      { id: "doorProfile", label: "Profile", isNumeric: false },
      { id: "visualTexture", label: "Vis. Pat", isNumeric: false },
      { id: "tactileTexture", label: "Tac. Tex", isNumeric: false },
      { id: "material", label: "Material", isNumeric: false },
      { id: "erpCode", label: "Web Link", isNumeric: false },
      { id: "deltaE", label: "ΔEok", isNumeric: true },
      { id: "L", label: "L", isNumeric: true },
      { id: "C", label: "C", isNumeric: true },
      { id: "H", label: "H", isNumeric: true },
    ],
    []
  );

  const isColumnFiltered = useCallback(
    (colId) => {
      const f = columnFilters[colId];
      if (!f) return false;
      if (colId === "L" || colId === "C" || colId === "H" || colId === "deltaE") {
        return (
          (f.min !== undefined && f.min !== null && f.min !== "") ||
          (f.max !== undefined && f.max !== null && f.max !== "")
        );
      }
      if (f.textQuery && f.textQuery.trim() !== "") return true;
      if (f.selectedValues && f.selectedValues instanceof Set) return true;
      return false;
    },
    [columnFilters]
  );

  const getDistinctColumnValues = useCallback(
    (colId) => {
      const map = new Map();
      allDbItems.forEach((item) => {
        let passesOthers = true;
        for (const otherCol of Object.keys(columnFilters)) {
          if (otherCol === colId) continue;
          const f = columnFilters[otherCol];
          if (!f) continue;
          if (
            otherCol === "L" ||
            otherCol === "C" ||
            otherCol === "H" ||
            otherCol === "deltaE"
          ) {
            const val = otherCol === "deltaE" ? item._d : item[otherCol];
            const minVal =
              f.min !== "" && f.min !== null && f.min !== undefined
                ? parseFloat(f.min)
                : null;
            const maxVal =
              f.max !== "" && f.max !== null && f.max !== undefined
                ? parseFloat(f.max)
                : null;
            if (minVal !== null && (val === undefined || val === null || val < minVal))
              passesOthers = false;
            if (maxVal !== null && (val === undefined || val === null || val > maxVal))
              passesOthers = false;
          } else {
            const raw = item[otherCol];
            const strVal =
              raw !== undefined && raw !== null && String(raw).trim() !== ""
                ? String(raw).trim()
                : "(Blank)";
            if (
              f.textQuery &&
              !strVal.toLowerCase().includes(f.textQuery.toLowerCase().trim())
            )
              passesOthers = false;
            if (
              f.selectedValues &&
              f.selectedValues instanceof Set &&
              !f.selectedValues.has(strVal)
            )
              passesOthers = false;
          }
          if (!passesOthers) break;
        }

        if (!passesOthers) return;

        const raw = item[colId];
        const strVal =
          raw !== undefined && raw !== null && String(raw).trim() !== ""
            ? String(raw).trim()
            : "(Blank)";
        map.set(strVal, (map.get(strVal) || 0) + 1);
      });

      return Array.from(map.entries()).sort((a, b) => {
        if (a[0] === "(Blank)") return 1;
        if (b[0] === "(Blank)") return -1;
        return a[0].localeCompare(b[0]);
      });
    },
    [allDbItems, columnFilters]
  );

  const renderFilterPopover = (colId, label, isNumeric) => {
    const cf = columnFilters[colId] || {};
    const isFiltered = isColumnFiltered(colId);

    if (isNumeric) {
      return React.createElement(
        "div",
        {
          className:
            "absolute top-full left-0 mt-1 z-50 w-64 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 shadow-xl rounded-lg p-3 text-slate-800 dark:text-neutral-200 text-xs font-sans normal-case tracking-normal select-text text-left",
          onClick: (e) => e.stopPropagation(),
        },
        React.createElement(
          "div",
          { className: "flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-neutral-800 font-bold" },
          React.createElement("span", { className: "text-slate-700 dark:text-neutral-300" }, `Filter: ${label}`),
          React.createElement(
            "button",
            {
              onClick: () => setOpenFilterCol(null),
              className: "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 p-0.5 rounded",
            },
            React.createElement(Icon, { name: "x", className: "w-3.5 h-3.5" })
          )
        ),
        React.createElement(
          "div",
          { className: "flex flex-col gap-1 pb-2.5 mb-2 border-b border-slate-100 dark:border-neutral-800" },
          React.createElement(
            "button",
            {
              onClick: () => {
                setSortBy(colSortKeyMap[colId]);
                setSortAsc(true);
              },
              className: `flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 text-left font-medium ${
                sortBy === colSortKeyMap[colId] && sortAsc ? "text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-900/30" : ""
              }`,
            },
            React.createElement(Icon, { name: "arrow-up", className: "w-3.5 h-3.5" }),
            "Sort Smallest to Largest"
          ),
          React.createElement(
            "button",
            {
              onClick: () => {
                setSortBy(colSortKeyMap[colId]);
                setSortAsc(false);
              },
              className: `flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 text-left font-medium ${
                sortBy === colSortKeyMap[colId] && !sortAsc ? "text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-900/30" : ""
              }`,
            },
            React.createElement(Icon, { name: "arrow-down", className: "w-3.5 h-3.5" }),
            "Sort Largest to Smallest"
          )
        ),
        React.createElement(
          "div",
          { className: "flex flex-col gap-2" },
          React.createElement("span", { className: "text-[10px] uppercase font-bold text-slate-400 tracking-wider" }, "Number Range"),
          React.createElement(
            "div",
            { className: "grid grid-cols-2 gap-2" },
            React.createElement(
              "div",
              {},
              React.createElement("label", { className: "text-[10px] text-slate-500 dark:text-neutral-400 font-semibold block mb-0.5" }, "Min"),
              React.createElement("input", {
                type: "number",
                step: "any",
                placeholder: "Min...",
                value: cf.min ?? "",
                onChange: (e) => {
                  const val = e.target.value;
                  setColumnFilters((prev) => ({
                    ...prev,
                    [colId]: { ...prev[colId], min: val },
                  }));
                },
                className: "w-full px-2 py-1 text-xs border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 rounded outline-none focus:border-sky-500",
              })
            ),
            React.createElement(
              "div",
              {},
              React.createElement("label", { className: "text-[10px] text-slate-500 dark:text-neutral-400 font-semibold block mb-0.5" }, "Max"),
              React.createElement("input", {
                type: "number",
                step: "any",
                placeholder: "Max...",
                value: cf.max ?? "",
                onChange: (e) => {
                  const val = e.target.value;
                  setColumnFilters((prev) => ({
                    ...prev,
                    [colId]: { ...prev[colId], max: val },
                  }));
                },
                className: "w-full px-2 py-1 text-xs border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 rounded outline-none focus:border-sky-500",
              })
            )
          )
        ),
        isFiltered &&
          React.createElement(
            "button",
            {
              onClick: () => {
                setColumnFilters((prev) => {
                  const copy = { ...prev };
                  delete copy[colId];
                  return copy;
                });
              },
              className: "mt-3 w-full py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded border border-rose-200 dark:border-rose-900 font-medium transition-colors",
            },
            "Clear Filter"
          )
      );
    }

    const distinctPairs = getDistinctColumnValues(colId);
    const totalCount = distinctPairs.length;
    const filteredPairs = filterSearch.trim()
      ? distinctPairs.filter(([v]) => v.toLowerCase().includes(filterSearch.trim().toLowerCase()))
      : distinctPairs;

    const currentSelSet = cf.selectedValues instanceof Set
      ? cf.selectedValues
      : new Set(distinctPairs.map(([v]) => v));

    return React.createElement(
      "div",
      {
        className:
          "absolute top-full left-0 mt-1 z-50 w-64 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 shadow-xl rounded-lg p-3 text-slate-800 dark:text-neutral-200 text-xs font-sans normal-case tracking-normal select-text text-left",
        onClick: (e) => e.stopPropagation(),
      },
      React.createElement(
        "div",
        { className: "flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-neutral-800 font-bold" },
        React.createElement("span", { className: "text-slate-700 dark:text-neutral-300" }, `Filter: ${label}`),
        React.createElement(
          "button",
          {
            onClick: () => setOpenFilterCol(null),
            className: "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 p-0.5 rounded",
          },
          React.createElement(Icon, { name: "x", className: "w-3.5 h-3.5" })
        )
      ),
      React.createElement(
        "div",
        { className: "flex flex-col gap-1 pb-2 mb-2 border-b border-slate-100 dark:border-neutral-800" },
        React.createElement(
          "button",
          {
            onClick: () => {
              setSortBy(colSortKeyMap[colId]);
              setSortAsc(true);
            },
            className: `flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 text-left font-medium ${
              sortBy === colSortKeyMap[colId] && sortAsc ? "text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-900/30" : ""
            }`,
          },
          React.createElement(Icon, { name: "arrow-up", className: "w-3.5 h-3.5" }),
          "Sort A → Z"
        ),
        React.createElement(
          "button",
          {
            onClick: () => {
              setSortBy(colSortKeyMap[colId]);
              setSortAsc(false);
            },
            className: `flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 text-left font-medium ${
              sortBy === colSortKeyMap[colId] && !sortAsc ? "text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-900/30" : ""
            }`,
          },
          React.createElement(Icon, { name: "arrow-down", className: "w-3.5 h-3.5" }),
          "Sort Z → A"
        )
      ),
      React.createElement(
        "div",
        { className: "mb-2" },
        React.createElement("input", {
          type: "text",
          placeholder: "Search values...",
          value: filterSearch,
          onChange: (e) => setFilterSearch(e.target.value),
          className: "w-full px-2 py-1 text-xs border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 rounded outline-none focus:border-sky-500",
        })
      ),
      React.createElement(
        "div",
        { className: "flex items-center justify-between text-[11px] font-semibold text-sky-600 dark:text-sky-400 mb-1.5 px-1" },
        React.createElement(
          "button",
          {
            onClick: () => {
              setColumnFilters((prev) => ({
                ...prev,
                [colId]: { ...prev[colId], selectedValues: null },
              }));
            },
            className: "hover:underline",
          },
          "Select All"
        ),
        React.createElement(
          "button",
          {
            onClick: () => {
              setColumnFilters((prev) => ({
                ...prev,
                [colId]: { ...prev[colId], selectedValues: new Set() },
              }));
            },
            className: "hover:underline text-slate-500 dark:text-neutral-400",
          },
          "Deselect All"
        )
      ),
      React.createElement(
        "div",
        { className: "max-h-40 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-neutral-800 rounded divide-y divide-slate-50 dark:divide-neutral-800/50" },
        filteredPairs.length === 0
          ? React.createElement("div", { className: "p-2 text-slate-400 text-[11px] italic text-center" }, "No matching values")
          : filteredPairs.map(([val, count]) => {
              const isChecked = currentSelSet.has(val);
              return React.createElement(
                "label",
                {
                  key: val,
                  className: "flex items-center justify-between gap-2 px-2 py-1 hover:bg-slate-100 dark:hover:bg-neutral-800/70 cursor-pointer text-xs select-none",
                },
                React.createElement(
                  "div",
                  { className: "flex items-center gap-2 truncate min-w-0" },
                  React.createElement("input", {
                    type: "checkbox",
                    checked: isChecked,
                    onChange: () => {
                      const nextSet = new Set(currentSelSet);
                      if (isChecked) {
                        nextSet.delete(val);
                      } else {
                        nextSet.add(val);
                      }
                      setColumnFilters((prev) => ({
                        ...prev,
                        [colId]: { ...prev[colId], selectedValues: nextSet },
                      }));
                    },
                    className: "w-3.5 h-3.5 cursor-pointer accent-sky-500 shrink-0",
                  }),
                  React.createElement("span", { className: "truncate" }, val)
                ),
                React.createElement("span", { className: "text-[10px] text-slate-400 font-mono" }, count)
              );
            })
      ),
      isFiltered &&
        React.createElement(
          "button",
          {
            onClick: () => {
              setColumnFilters((prev) => {
                const copy = { ...prev };
                delete copy[colId];
                return copy;
              });
            },
            className: "mt-2.5 w-full py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded border border-rose-200 dark:border-rose-900 font-medium transition-colors",
          },
          "Clear Filter"
        )
    );
  };

  const renderFilterHeader = (colId, label, widthClass = "", alignRight = false, isNumeric = false) => {
    const isFiltered = isColumnFiltered(colId);
    const isOpen = openFilterCol === colId;
    const sortKey = colSortKeyMap[colId];
    const isSorted = sortBy === sortKey;

    return React.createElement(
      "th",
      {
        key: colId,
        className: `p-2 text-xs font-bold select-none relative ${widthClass} ${alignRight ? "text-right" : "text-left"}`,
      },
      React.createElement(
        "div",
        {
          className: `inline-flex items-center gap-1 cursor-pointer px-1.5 py-1 rounded transition-colors group ${
            alignRight ? "ml-auto" : ""
          } ${
            isFiltered
              ? "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-black border border-sky-300 dark:border-sky-700"
              : "hover:bg-slate-200/70 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300"
          }`,
          onClick: (e) => {
            e.stopPropagation();
            setFilterSearch("");
            setOpenFilterCol(isOpen ? null : colId);
          },
        },
        React.createElement("span", { className: "truncate" }, label),
        React.createElement(Icon, {
          name: isFiltered ? "filter-x" : "filter",
          className: `w-3 h-3 transition-opacity ${
            isFiltered ? "text-sky-600 dark:text-sky-400 opacity-100" : "opacity-40 group-hover:opacity-100"
          }`,
        }),
        isSorted &&
          React.createElement(Icon, {
            name: sortAsc ? "arrow-up" : "arrow-down",
            className: "w-3 h-3 text-sky-500 shrink-0",
          })
      ),
      isOpen && renderFilterPopover(colId, label, isNumeric)
    );
  };

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
            (item.sheen && item.sheen.toLowerCase().includes(w)) ||
            (item.doorProfile && item.doorProfile.toLowerCase().includes(w)) ||
            (item.visualTexture && item.visualTexture.toLowerCase().includes(w)) ||
            (item.tactileTexture && item.tactileTexture.toLowerCase().includes(w)) ||
            (item.material && item.material.toLowerCase().includes(w)) ||
            (item.tags && item.tags.some((t) => t.toLowerCase().includes(w))),
        ),
      );
    }
    if (Object.keys(columnFilters).length > 0) {
      items = items.filter((item) => {
        for (const colId of Object.keys(columnFilters)) {
          const f = columnFilters[colId];
          if (!f) continue;
          if (colId === "L" || colId === "C" || colId === "H" || colId === "deltaE") {
            const minVal = (f.min !== "" && f.min !== null && f.min !== undefined) ? parseFloat(f.min) : null;
            const maxVal = (f.max !== "" && f.max !== null && f.max !== undefined) ? parseFloat(f.max) : null;
            const val = colId === "deltaE" ? item._d : item[colId];
            if (minVal !== null && (val === undefined || val === null || isNaN(val) || val < minVal)) return false;
            if (maxVal !== null && (val === undefined || val === null || isNaN(val) || val > maxVal)) return false;
          } else {
            const textQ = (f.textQuery || "").trim().toLowerCase();
            const selSet = f.selectedValues && f.selectedValues instanceof Set ? f.selectedValues : null;
            const raw = item[colId];
            const strVal = raw !== undefined && raw !== null && String(raw).trim() !== "" ? String(raw).trim() : "(Blank)";

            if (textQ && !strVal.toLowerCase().includes(textQ)) return false;
            if (selSet && !selSet.has(strVal)) return false;
          }
        }
        return true;
      });
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
        case "sheen":
          valA = (a.sheen || "").toLowerCase();
          valB = (b.sheen || "").toLowerCase();
          break;
        case "doorProfile":
          valA = (a.doorProfile || "").toLowerCase();
          valB = (b.doorProfile || "").toLowerCase();
          break;
        case "visualTexture":
          valA = (a.visualTexture || "").toLowerCase();
          valB = (b.visualTexture || "").toLowerCase();
          break;
        case "tactileTexture":
          valA = (a.tactileTexture || "").toLowerCase();
          valB = (b.tactileTexture || "").toLowerCase();
          break;
        case "material":
          valA = (a.material || "").toLowerCase();
          valB = (b.material || "").toLowerCase();
          break;
        case "erpCode":
          valA = (a.erpCode || "").toLowerCase();
          valB = (b.erpCode || "").toLowerCase();
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
    columnFilters,
  ]);
  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updated = { ...dataForUpdates };
    
    const originalBrand = editingItem.originalBrand || editingItem.brand;
    const oldItem = updated[originalBrand][editingItem.originalIndex];

    const newItem = {
      ...oldItem,
      name: editingItem.displayName,
      url: editingItem.erpCode,
      erpCode: editingItem.erpCode,
      image: editingItem.note,
      hex: editingItem.hex,
      tags: editingItem.tags,
      brand: editingItem.brand,
      spectral: editingItem.spectralStr
        ? editingItem.spectralStr.split(",").map(Number)
        : oldItem.spectral,
    };
    
    let tc;
    if (newItem.spectral && newItem.spectral.length === 31) {
      try {
        tc = new Color("xyz-d65", calculateXYZFromSpectral(newItem.spectral, 2, "D65")).to("oklch");
      } catch (e2) {}
    }
    if (!tc && newItem.hex) {
      try { tc = createColorFromHex(newItem.hex).to("oklch"); } catch (e2) {}
    }
    if (tc) {
      newItem.L = tc.coords[0];
      newItem.C = tc.coords[1];
      newItem.H = isNaN(tc.coords[2]) ? 0 : ((tc.coords[2] % 360) + 360) % 360;
    }

    if (editingItem.brand !== originalBrand) {
      updated[originalBrand] = [...updated[originalBrand]];
      updated[originalBrand].splice(editingItem.originalIndex, 1);
      if (updated[originalBrand].length === 0) {
        delete updated[originalBrand];
      }
      
      if (!updated[editingItem.brand]) {
        updated[editingItem.brand] = [];
      } else {
        updated[editingItem.brand] = [...updated[editingItem.brand]];
      }
      updated[editingItem.brand].push(newItem);
    } else {
      updated[editingItem.brand] = [...updated[editingItem.brand]];
      updated[editingItem.brand][editingItem.originalIndex] = newItem;
    }

    updateColorData(updated);
    setEditingItem(null);
  };
  const handleInlineMetadataEdit = (item, field, value) => {
    const updated = { ...dataForUpdates };
    
    let itemsToUpdate = [];
    if (selectedIds && selectedIds.includes(item.id)) {
      itemsToUpdate = allDbItems.filter(i => selectedIds.includes(i.id));
    } else {
      itemsToUpdate = [item];
    }
    
    itemsToUpdate.forEach(i => {
      if (updated[i.brand]) {
        if (updated[i.brand] === dataForUpdates[i.brand]) {
            updated[i.brand] = [...updated[i.brand]];
        }
        updated[i.brand][i.originalIndex] = {
          ...updated[i.brand][i.originalIndex],
          [field]: value
        };
      }
    });
    
    updateColorData(updated);
  };
  const handleDeleteItem = (item) => {
    setConfirmState({
      message: `Delete ${item.displayName} from ${item.brand}?`,
      onConfirm: () => {
        const updated = { ...dataForUpdates };
        updated[item.brand] = [...updated[item.brand]];
        updated[item.brand].splice(item.originalIndex, 1);
        if (updated[item.brand].length === 0) delete updated[item.brand];
        updateColorData(updated);
        setEditingItem(null);
      }
    });
  };
  const handleAddBrand = () => {
    setPromptState({
      title: "New Brand Name:",
      value: "",
      onSubmit: (b) => {
        if (b && !dataForUpdates[b]) {
          updateColorData({ ...dataForUpdates, [b]: [] });
          setBrandFilter(b);
        }
      }
    });
  };
  const handleAddColor = () => {
    if (!brandFilter) return setConfirmState({ message: "Select a brand first", onConfirm: () => {} });
    setPromptState({
      title: "Color Name:",
      value: "",
      onSubmit: (n) => {
        if (n) {
          const updated = { ...dataForUpdates };
          updated[brandFilter] = [{
            name: n,
            hex: "#888888",
            L: 0.5,
            C: 0,
            H: 0,
            tags: [],
            url: "",
            image: "",
          }, ...(updated[brandFilter] || [])];
          updateColorData(updated);
        }
      }
    });
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
    promptState && React.createElement(CustomPromptModal, {
      title: promptState.title,
      value: promptState.value,
      setValue: (val) => setPromptState({ ...promptState, value: val }),
      onSubmit: () => {
        promptState.onSubmit(promptState.value);
        setPromptState(null);
      },
      onCancel: () => setPromptState(null)
    }),
    confirmState && React.createElement(CustomConfirmModal, {
      message: confirmState.message,
      onConfirm: () => {
        confirmState.onConfirm();
        setConfirmState(null);
      },
      onCancel: () => setConfirmState(null)
    }),
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
        React.createElement(SortButton, { field: "sheen", label: "Sheen" }),
        React.createElement(SortButton, { field: "doorProfile", label: "Profile" }),
        React.createElement(SortButton, { field: "visualTexture", label: "Vis. Pat" }),
        React.createElement(SortButton, { field: "tactileTexture", label: "Tac. Tex" }),
        React.createElement(SortButton, { field: "material", label: "Material" }),
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
                setConfirmState({
                  message: `Delete entire brand '${brandFilter}'?`,
                  onConfirm: () => {
                    const c = { ...dataForUpdates };
                    delete c[brandFilter];
                    updateColorData(c);
                    setBrandFilter("");
                  }
                });
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
        React.createElement(
          "button",
          {
            onClick: () => {
              if (onOpenAveryModal) onOpenAveryModal(selectedIds || []);
            },
            className:
              "px-2.5 py-1 text-[9px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white uppercase tracking-wider rounded flex items-center gap-1 shadow-sm transition-colors ml-auto",
            title: "Print Avery 5159 Labels for selected commercial database items",
          },
          React.createElement(Icon, { name: "printer", className: "w-3 h-3" }),
          selectedIds && selectedIds.length > 0 ? `Print Labels (${selectedIds.length})` : "Print Labels",
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
          " Verified Colors Only",
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
    openFilterCol &&
      React.createElement("div", {
        className: "fixed inset-0 z-40 bg-transparent",
        onClick: () => setOpenFilterCol(null),
      }),
    React.createElement(
      "div",
      { className: "flex-1 overflow-y-auto custom-scrollbar relative p-4" },
      (() => {
        const activeCols = Object.keys(columnFilters).filter(isColumnFiltered);
        if (activeCols.length === 0) return null;
        return React.createElement(
          "div",
          { className: "flex flex-wrap items-center gap-2 mb-3 p-2 bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 rounded-lg text-xs" },
          React.createElement("span", { className: "font-bold text-sky-900 dark:text-sky-200 text-[11px] uppercase tracking-wider flex items-center gap-1" },
            React.createElement(Icon, { name: "filter", className: "w-3 h-3 text-sky-600 dark:text-sky-400" }),
            "Active Column Filters:"
          ),
          activeCols.map((colId) => {
            const colLabel = COLUMNS_DEF.find((c) => c.id === colId)?.label || colId;
            return React.createElement(
              "span",
              {
                key: colId,
                className: "inline-flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-neutral-800 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700 rounded-full text-[11px] font-medium shadow-2xs",
              },
              colLabel,
              React.createElement(
                "button",
                {
                  onClick: () => {
                    setColumnFilters((prev) => {
                      const copy = { ...prev };
                      delete copy[colId];
                      return copy;
                    });
                  },
                  className: "hover:text-rose-500 rounded-full p-0.5",
                },
                React.createElement(Icon, { name: "x", className: "w-3 h-3" })
              )
            );
          }),
          React.createElement(
            "button",
            {
              onClick: () => setColumnFilters({}),
              className: "ml-auto text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline uppercase tracking-wider",
            },
            "Clear All Column Filters"
          )
        );
      })(),
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
                    width: `${baseListSize * swatchZoom}px`,
                    height: `${baseListSize * swatchZoom}px`,
                  },
                },
                (item.image || item.note?.startsWith("http")) &&
                  React.createElement("div", {
                    className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                    style: {
                      backgroundImage: `url(${item.image || item.note})`,
                      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                      maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                    },
                  }),
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
                          originalBrand: item.brand,
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
                renderFilterHeader("displayName", "Name"),
                renderFilterHeader("brand", "Brand", "w-24"),
                renderFilterHeader("sheen", "Sheen"),
                renderFilterHeader("doorProfile", "Profile"),
                renderFilterHeader("visualTexture", "Vis. Pat"),
                renderFilterHeader("tactileTexture", "Tac. Tex"),
                renderFilterHeader("material", "Material"),
                renderFilterHeader("erpCode", "Web Link", "w-40"),
                enableDeltaE && renderFilterHeader("deltaE", "\u0394Eok", "w-20", true, true),
                renderFilterHeader("L", "L", "w-16", true, true),
                renderFilterHeader("C", "C", "w-16", true, true),
                renderFilterHeader("H", "H", "w-16", true, true),
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
                        },
                      },
                      (item.image || item.note?.startsWith("http")) &&
                        React.createElement("div", {
                          className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                          style: {
                            backgroundImage: `url(${item.image || item.note})`,
                            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                            maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                          },
                        }),
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
                    { className: "p-2" },
                    React.createElement(
                      "select",
                      {
                        value: item.sheen || "",
                        onChange: (e) => handleInlineMetadataEdit(item, "sheen", e.target.value),
                        onClick: (e) => e.stopPropagation(),
                        className: "w-20 bg-transparent text-[9px] outline-none cursor-pointer"
                      },
                      LABEL_OPTIONS.sheen.map((opt) =>
                        React.createElement("option", { key: opt, value: opt === '-' ? '' : opt }, opt === '-' ? 'None' : opt)
                      )
                    )
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2" },
                    React.createElement(
                      "select",
                      {
                        value: item.doorProfile || "",
                        onChange: (e) => handleInlineMetadataEdit(item, "doorProfile", e.target.value),
                        onClick: (e) => e.stopPropagation(),
                        className: "w-20 bg-transparent text-[9px] outline-none cursor-pointer"
                      },
                      LABEL_OPTIONS.doorProfile.map((opt) =>
                        React.createElement("option", { key: opt, value: opt === '-' ? '' : opt }, opt === '-' ? 'None' : opt)
                      )
                    )
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2" },
                    React.createElement(
                      "select",
                      {
                        value: item.visualTexture || "",
                        onChange: (e) => handleInlineMetadataEdit(item, "visualTexture", e.target.value),
                        onClick: (e) => e.stopPropagation(),
                        className: "w-20 bg-transparent text-[9px] outline-none cursor-pointer"
                      },
                      LABEL_OPTIONS.visualPattern.map((opt) =>
                        React.createElement("option", { key: opt, value: opt === '-' ? '' : opt }, opt === '-' ? 'None' : opt)
                      )
                    )
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2" },
                    React.createElement(
                      "select",
                      {
                        value: item.tactileTexture || "",
                        onChange: (e) => handleInlineMetadataEdit(item, "tactileTexture", e.target.value),
                        onClick: (e) => e.stopPropagation(),
                        className: "w-20 bg-transparent text-[9px] outline-none cursor-pointer"
                      },
                      LABEL_OPTIONS.tactileTexture.map((opt) =>
                        React.createElement("option", { key: opt, value: opt === '-' ? '' : opt }, opt === '-' ? 'None' : opt)
                      )
                    )
                  ),
                  React.createElement(
                    "td",
                    { className: "p-2" },
                    React.createElement(
                      "select",
                      {
                        value: item.material || "",
                        onChange: (e) => handleInlineMetadataEdit(item, "material", e.target.value),
                        onClick: (e) => e.stopPropagation(),
                        className: "w-20 bg-transparent text-[9px] outline-none cursor-pointer"
                      },
                      LABEL_OPTIONS.material.map((opt) =>
                        React.createElement("option", { key: opt, value: opt === '-' ? '' : opt }, opt === '-' ? 'None' : opt)
                      )
                    )
                  ),
                  React.createElement(
                    "td",
                    {
                      className:
                        "p-2 w-full truncate text-[9px] font-mono",
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
                            originalBrand: item.brand,
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
                  width: `${72 * swatchZoom}px`,
                },
              },
              React.createElement(
                "div",
                {
                  className: `aspect-square relative flex items-center justify-center overflow-hidden transition-all text-[0px] rounded-xl group-hover:scale-[1.05] group-hover:shadow-md`,
                  style: {
                    backgroundColor: item.hex,
                    width: "100%",
                  },
                },
                (item.image || item.note?.startsWith("http")) &&
                  React.createElement("div", {
                    className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                    style: {
                      backgroundImage: `url(${item.image || item.note})`,
                      WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                      maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                    },
                  }),
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
                          originalBrand: item.brand,
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
              swatchZoom >= 0.9 && React.createElement(
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
          React.createElement("div", {
            className: "w-px h-4 bg-slate-300 dark:bg-neutral-600 mx-1",
          }),
          React.createElement(
            "button",
            {
              onClick: () => {
                if (onOpenAveryModal) onOpenAveryModal(selectedIds);
              },
              className:
                "px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer",
              title: "Print Avery 5159 Labels for selected swatches",
            },
            React.createElement(Icon, { name: "printer", className: "w-3.5 h-3.5" }),
            "Print Labels",
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
                    { className: "flex items-center gap-2 mb-1" },
                    React.createElement("input", {
                      className:
                        "text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-transparent border-b border-dashed border-slate-300 dark:border-neutral-600 outline-none focus:border-sky-500 w-full",
                      value: editingItem.brand,
                      onChange: (e) => setEditingItem({ ...editingItem, brand: e.target.value }),
                      list: "brand-options"
                    }),
                    React.createElement("datalist", { id: "brand-options" },
                      Object.keys(dataForUpdates).map(b => React.createElement("option", { key: b, value: b }))
                    )
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
                { className: "grid grid-cols-2 gap-3" },
                [
                  { label: "Sheen", key: "sheen", options: LABEL_OPTIONS.sheen },
                  { label: "Profile", key: "doorProfile", options: LABEL_OPTIONS.doorProfile },
                  { label: "Visual Pattern", key: "visualTexture", options: LABEL_OPTIONS.visualPattern },
                  { label: "Tactile Texture", key: "tactileTexture", options: LABEL_OPTIONS.tactileTexture },
                  { label: "Material", key: "material", options: LABEL_OPTIONS.material },
                ].map((field) => 
                  React.createElement(
                    "div",
                    { key: field.key },
                    React.createElement(
                      "label",
                      { className: "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1" },
                      field.label
                    ),
                    React.createElement("select", {
                      value: editingItem[field.key] || "",
                      onChange: (e) => setEditingItem({ ...editingItem, [field.key]: e.target.value }),
                      className: "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rox��}�v�H��{E�]]E��4I]�V��c�vY�}K]}f�>m��H�A���TU~�י3�{�a^�i��������O؈L$�	�$%��BwYD"�Ȍ�[FFF,c?���7"��ް�G��"�]d�oyyл?�K?в�Y�$Y�Q�8�2Y�Y��I�A��Q\���YD~?Y�ag�����o����M�M��$�kO�`�y���u����Cpy@�~�|��e@��ozߐ��o+�oԞ���O���k��K��k��6Z����N�MB�e5K�Z�6#oD�V	�Y	�I�e�Ko(C��(�|`s�v8X\�#gI���I��b�/H�z�a<흇~�����1���N}RvN���c/�Hwg�&5�&�d>�H,��5�A�v΃"D��
�0�����:�SU���h��Sx�l�*A����ɮz:���U_��U���a8� �Ӟ�_�� �u�;�3�F2��sɨ
�`��݃�')N:�STq�P����By�,9S�A�2*Y
E�y'd�����d��&iEc/ED)iy�`8 @:��h�������Mh4
4�O���њ�*��B@���V?
�i>�l�Yц+}�y���=ϑ��]>{��4´������K7D�An���qO3j��}�z����rOن�<Up�M���b�?��Lǀ*���@��r9��ۄ�3����;��?�A��=3����q�� �i?�����@�Q8���50(1W1��
v�T��Y\��� ��DJ�u���XW4^�9j]�\(�\ 2�ޣ"4
'@�� % N�(xDAPq)L�����.7 ��$��l�|��� DJ��nPɻ����(�_�'�J��r���!2#xg!*��I%i�o=�ұ�!D:��l��g,Q��F�c���<թsʹ�e��^�s��6��0��Ρ־2bΣ���R!hM�0\
Q�j�c-��#/�(��g��l9��:��D��%�g.h���٢uE�f����2"o�p3�c�Y��D��F-�
7��R]'�%/�Ϸ��O� '���0
^x�7�)x@�?܇��bX Y>�j�?��h����qp�U\�����;hw�'9�L�Ӂ��Xz�����e��F���9��"|���]�!���Z_M����$Z�A�+lm�� ��6���7�_!�1�q�lÿ��Cz́(�Qy�e<!�3�;M�a����݇7� �v�h�3r�;R+���i�/�X�>�C@A흳���c���'�TeR�g�I��&�#�"óK~�?��⇻Py�4Y@��9M��lA�'�y�*�R��8L}}�Z�."�IF�X}Ͻ��yo�?�$��Y�����ٻV+p���"��,�����%�2����+�+K��ge��A#�y���@������
� ���
��"�:3Y;���V�P�R/�
�&�+;)�%�	 T��.Hr�U~r��Fj�[�(/
�.��<��K<�ø 9:���dQg�r��B1��_�]+׍�>j���S�}�<�r�j
�YAw�>�m�;��$	he�&� mQ�1�(��ꜝ6���I��\ܾ�w�)e�#��s:@N#6����y��ǀ`/�^N�(�$Q�zv>�����b���̐,��<듿���dI��E��>�z����Ab�������*��
ח�2`��7	z��¨�k��'ZU��m���l�͡�H�m�FS�3*�N�{d3#��	��ٸ1��Z�Y�3M�M8-0kv��K�.�U���:v����~O����h�Ѯ��]u��j�hDӮU�T��*����*;  Ej��) ���du���#��t3��aᔰ�P�R�q�xb�)�d���JP�ɠ�a�9~hfzt��^�$1�+MZ��0� %kL����K,oǾS����:/�Bt28�7�ԋ���[i�u�ZP'�˼��ZXz̩؉��u�P�w��y���;�A�'��q�~�ՑG�gzUm/�D���So��!H��2;��+XQ����x��x��<=��\>N���uzA�E���e�	u�ؒ�"�� �.	+d�`%c������R?��ᇙ7����iZf�l�SM�X p��i	�|�K���_�8�M;$ηR������n�1���"Zf��
��V��w4ܽ��i��->����X(�������So\<x$�cw���K���h%��T��U'P�,/�=U?�^x	�Ө��p��L���{|x�M�g�v%c/*���nQ�D.��,N�7!x���e/�;��i)��#XQ����-��Q�Kߕ�" J���}^[�0̠:&��Y
Z�q��8{��K'�Z�e��Z	�ʱ��:W�$�,H�r����[X~.�a��9�T��͡�Of0a������ס?�Y8�0��A�`��W%/�xɻ�|�Q*y���l���f�	��"��Vy{�#z����C�^D��%I�R^�{�`�R�T�H�D[ϫG҃���3�����k��I��VO��u$����b~s̡�^z��0�|��'Q�?**����a��!���(���u ���V?�؊��s�%�3�5���OI�NH�{�}&=8�{��PU�]*�lT����L���Q5���Gܞk�C| �ςh�ڋr�������PU�;W�N�]��B�#�%И4r��w�A��O�e:	NAQ�rL�p[Zbִz����}��ga)P^׊h�����r!֒Ki����ŸA ��xPU)H���Ҫ�tѨV�U���}˪J�>D�Y�ZYZU<��y�wByU�q���ӄ�D�j�`�*b~�,�*�(X�� ��2m��xZ�x�zT��l>�^}�C�(�Z��T3(��3e��21��K�-�����mi�b�
��>&}��
x6��Y��	�~a���O@�_\�i@�9
_&ٱNu�&`w/��'/Ew��G}0�nU�g�,��>DGTݿF�y�Ʃ�����I�ͼ�vv��>o/̞�[���L��?�Ny��[5�3U�{������9��
�a��;]u�5���a�:��PœY�>��a%�h x\����)��\C�|�бRQ���6t�k,�a�?�r�ɫ?U�a=<�;��*���&ȖQ�UpG�V*B�e�{Bw��c��Ċ��4)������4M�5U��a�P:A^�α#b)�٩�f�p�S+Q-g����cQ�'1�&���[�O�g�*ȓ�V��|Ve0��V�:<A��X�����Za݇#��j��t��l�K��nx˴i��ϑAW�tY&�{�yQo�ԛN�u�nt��,��a�vP�Q6T�j�7u�*r��X�#��'�݌� >|����`�AC�o�r��I��"��R<+_U<�����;[�'�g�'���)��e�!̆T�L��迒QJ���wdP}P|�����e�N5������B�\x�`n�bs���Ao|�N~���G��.r�x=	Ĺ��4�B٭m2�&���^��^��0��m ����DE9��5��J~�z͕D�ۦ>X��ֿ�r��I���Ok��Nڛ��)��3xGnmK� W�Y#�UQ��΄W����C����Ew;�m���8��EG�;b/ bi���3L
��y�V[&����"Y���E�%�'�Y1p�r7����Q��A���h��lS:���.���aL<�����]����{#<K�Ch�<'h�w��J ��<��uߗ-|w���~����yTm['�bA����wt�'�^*�%���reT�,�tfy����E�h֟&	of}Xkߝd���7���h=8�w�?����߷��=���`�Uy��so��D:Y~	�'h�y����~��z+��+6��@�a| |�NHu/��Ш� } ��V�<������\0U������R�Ŕښ3<�jS4���0�\N(?�f�.'auG?2���!�����f�F�<��T-�B��`8��f@��֧��?.`͢���m|l���d�>�(��B5l�gó����Oh{@�����M)?L�P�_�=�%�4��m�D��9,.��#�O�uױ_- )G��om���E�yZ"��02ڃz�O:{�����p�%��	���W�Q}�n㥞.�Ѐ��u��'y���m�����=��4��0����-7�m~��U�,����߭S�By��S����Α3[���ɘ@�R�]�ͩ�c�)l=�8��,P�����-hS~��B[	8Q����`tgܬT��{g���@�����H�6ؚ�!�?��q/�DQ��wKWs�9��y�>r+�_�Y�0���Nl��{�s;����d�pWJZ��@P�jԠjB�C�0��������Qt"�����GY��5�a?�w@Fe;pD�*Q���8 E,�f��9�@�@y��Ø��� =ػ���POl��e�)��U��3��+��ǂ): �]��v-گ�*.��xy�[X|#o�26��֛zD��{��'�ʖ�������	|~�E�.���d8������,T|���z��N{���M��\^Q3p�W���������p���ܻ�\_�(�L���G���n�mL�m�0#/J�7	"ղ��/���e�Õ���I�X�/C�SDdY�\0�z�W�R6�z�]؜��kf�X�Ju��=����៽{�I�i��&ggY B���zK����,���yw�c3���毇$��g�4�rf҃��6ME���5�����;
��pw�3��QZ���ɽ�O7I��ߚ$c��J{�}�� [ӄn����`j�AI��Ck��L���q7���(�oj
)M�$���{�fR�@`ܩ����֑JV���!D,��N�jc];ڔ֙��-��HЩÏ��:Y0��@;.�Z4��#e���l�!!oߌ5���Bz`��T��"�ط��_X���D�l��M�a����^-f� �>]5�6�b�Fa0b�k������l�H��|�Z���P�J<������Qg���	��X���,4��@)0a�ï�VJoE9t���ƴFadWkH��S��^�7�v2����s@�R��q��eu��n鬏�(r�9�� �|�3
���]og|���ml*w��W�n������#;��S7���N}���ٰ�n�����������㗧��'���3X�S�}�C�x�>�:�wA�l�����󻻬�Z��� �CRn�4���ϲ�H�S<�_r�c�$y��b,���|�
c�;k����ezWy0����� ��]]��>m����i¯� �4�@�P�Rp�x_��t�`\ޡOd�^�� z�$Q��4I�Aٚj@e|�6!~��J�87��������k\��x�s��Ã�������;�`>ex�����qz~�0귻{��hB���h��e�Y�:�ye�}��{LC�!��w,j&.I�,z��w��)��@��	�5Z1ԏ�!�z����gb���/*���߬1�ά��ɛ���!�0vV/�ʶS����B���tO0�"U�hn?��I�Q�-�Z^T�$H���x磗v{�I� W�V�m4�8G�9��4�>o��EM4�����v ��W��0���������9݈���	�0�u����a��C *v9�х�0�͒᥏�Q? }�_�h��iW��lLzQk�9ǁ����KQ��p��D���I�N"Ux˵g�*�opk���1D�c']��1(K`ո �!@��_1ʨ!^�=�ê�Aj'��KD8��&4ȫy��A@R��'�C0��P!�t
U`CS>q�Kg���(<�	QG\c�g�%d(�p���X2����
ֲ�/�e��,�/��#L�*q����t:�yiIF��'ё��ʑ�O�a\6�/�<���6|��P�β�����p�4J]s�1lh���?)Um�}���跢�)�uo�5��Mp�">�Kt ���o?RE���� JcB#�l9�	C�!�Ր-� ��1�����뚒��;ɮ�������G�ϳw���5�3��z�	�<4�T���dn���L'nYX���]�K�Ztֆ)�G!\2[��^R Z4��SH���L4�N��/8/!��� ęs���q~�/�*�sάNC)�X�u�'n�b@�1g/BhO��r���E�V_�b�rD9b�zF%x�L��x*5W:)Π� ��{B}m�#��a�'�su���-[��\9 �i����S?m�7���P��^��h��j����蓃���tGh�0[��wے�����T���k~�_0c�.�* �V�G��Di�蚔��A�B��GY9����A�����y+v1��{�޴��5J)�I'%Tm,�� ��o$bĻ�o�:T�4����e>.��䆁O��U>��j��_�Bl2&�v)������C�Y���֐�⦷r��!,�䱛�����u��3�� C� ]%~�~��,]�'!�By�$ʉ���r�H�l�f\9Z?��I���M�ؖ�Ya�Q�'@�9��.t�z,���C�����`4"L�C[����㼈����m�'Rֹ�"/��¯0�XC��V����lH�!\[ϧ�ؖ����� �4���Ln���z��\';F�������.��T.t�V?��@Qo��f_����z�&�W_++�D�˔�J�d�0��b8B*��W�y�9n�Rӹ�w�����UP����a����}S�$�a�E,���U�1��%2�l[a������藖�}-ϰ�t������- W���0Һ�/mF��c#���5z��}�-�^�s�^��@S���w��`������G[�(�(��m����0ʃn��s�Zc\���0I���������^���GE�N�u���p�E|�8R�Y���o]�"���5 2��Q��B���j9���ސ/O
���_HGٔR�S��PZ�9��3J���Ggq��!��})�SR�n�DE����*S�K�����/_�Zl�O�3������iдᒢ��i�OS)<^��pʍ�2cD���Fԯ�UQM�u�-�X���!�+$U��W�s ~92L�#�G)��}1o��%������1 ��NS�1�8�K튡.CPӏ���-1:hu���l8���W�;��8�j��n^��P�X��`DC"nx*@�vH����[�Z�u**ixwD�~��\��ȪY�@܍P��"
��u{*���*�=k�t-E�F����6s�z��`�����گ�����������ָ{���X�Z6�0�ک�	J�J>I���*��h��\ǘ3�a���g9�>B$� �%��R���}�(V��5	�Dr�Z� ��sL5��1�{G�)��u��+_6����pZ����e�'.z2�n��T��׋�E$ˀ]Q�偸
$d-�ЯH��4�Z/�)��sV�(a�zK����X�/X&�W���_��B��8 ���k�/�y���п�i�iF�,ϻ\m�:���̽\m{�*.�T�5�Y��YP>�K{��-��+�ϗ���ن*����t�i��1P�K�	x��\��i�sU��dWug���,�g���E�^�%�*3u���F�)�U����W-����Į��q�� �>K��do5V�w���L���n�D���Ɍ�^&w��SOw���4��c��}�vjlP*)��.R�����MQL�̈́1����P7/�pj�������`h�����|'�1�@��H�Y	�����oe!�Y���drn��q���ζ�ZS�Q����D�ar�U��*��j��25���-7h~K��(l�7Mj���/Cl�=���X�%
���F�u�����d�� n��?�a � z�S��t���4 ���M�,4���~"�}k�(�
,���ּs��;�L���)mM }X�p�l�퓵qP�<?�Pl#�v����V�����ű��{*�a� ���&��I����"�ow����ޖބ��A��hw�=ځ�F�bo`>��p��^�����0gͽi�z�F{���9!]v��>I>h�����Lq�E��3o���ix��їm5c���C��
F���La�7�	E���=�ct�k��yt����C�)���0����ݯ~N�Y��n�������\ ����\<�#f2��NJR_��4�d��-]��6ie�d�@��>���qE�*���Oy���a[��=E`���Oջ�t��$B�*d��h�~���ً�L��{��˱B��d��r����YДm���`��=��մ3PGuxB�K/��.��)�>7��	���d�UnSMZ�G�4���q� W�d� �w��GW
�f������Re��Xέ�x��.��])�'���;@|M�����軸ȫٹ̉�zN��m#r�.� 4�f@�����_��̚�ڝ��p9r�\�S��-x����a|�S_ŉ�}�1�U�vz���u*��q
��lc1D�!!�&��P�M��Տ��E|S�-I�a�9��I�h��˂M�3�ϵ�:[
�r��1
c��s6BI����d�NL�_ήz#������C�B��UZ����UhH�)v�.5�uZ���LwRY�:6�����cd*i�K��p���XFY=8��c���K��0,���ai��=_�f�u��ll-�܆�;�'�r�v�a
�����E}���Z���5Ц-�X�c�����W�Bk�,��ϛb4����?�a?���z����x�㫟�������r��H���6���齵��9�Hm+:{���/�Y��a����xO�4�%Eނ�`��G��ҵ�(�A���$�:ۥы�Q��μe��ZP~�7q38R���	���%+U�/���s���>?����gzc!�ƍ-������P���:b���Ě�O�0?�<0���0�+�_iV�i����R6����39��^`>EN��r��h�nE�&լd��:S�喎��H	M�m���������\6�k"K��JL��W���!�O�-����5�mT�kIMF�.O~�4�:iB62T�>�˰�o�l�I���H���:vrT��r���������*h8�&�5�� �[�3=�U��X1c��hZ��/�d��xqqa ������-S
���H��ֆ�5ڰ~
f(0�V��`�1�h�t��67��׫��y�<��@�=XE���uUŲiMd�A��˚<�J5��L� �#�y~F�Ѯ.�!}0M,��A��#�r�L�µ�h䈶R%	���l$::;�:%��^.y�*v��ༀ�9��:��K�mד=x���(�Y̼��t�(Ge�#~�"#VS�N=�_�z��83��/�m���M�E�����bi�	�Sp�89��3��3��ɻ�y�	�_�����t����*ɺ��l[�b�����Ϸwք���T�B#wd2��i8WE�/�}3ɁnĜ��!^H��~�T�#����ہ_��VIN�h�K0b!4	�����<!�6�	�>&�f�v�v�9+�]K]����Z��F>�}��6>�1l�m��(߆��Q��Q�ݢ7��e�-jK,���G,��%��a:�u*BB�i~���s:],Tv�&'���,�譻�Ew;�6.�7jb�����H�%�u���0 Ud~]X}wV��t���]�C�C	o�[�z��V�C��>,XF<�Y��$�nKj�ʮ���7�	�A��w�K��>��x[�4Z5=��VJ ދ�����`pwT� ��݁�h���V���c
(��-/[�dU���`�����ïU���ٍ�gqr��)��m�V��[�^�AexGT�%gƢ`�+4v�0���܉,xJM7��0P;Q�U�əm1�yU�0����<����;�y�-��UN	T�@�&�a�5�~~����^=�Bچ�$�^�Bؐ�����ן�za��S�.{@|�Y�gLgE�Fio�m�O�F��XW�JJ6�9�i��B�Ä���:f�@A>c�@&1��$�����}/�Ni^� �g��y]jʾs�Q{j�<9a�b[F�a����T�GQ���{@:��cj {�Ā.��5�b yEwX��H�Y��l��l-����>�#v*�l��z�a�F�º�x o��YL���������s�]|�.�`���䊺�,� �{�n� zi�ͻ5��*�wk�.��.�=�75X�M�r|L��4b�2��F���~3�|-6�OYB3ƍy��h�⪞����2�WF�*��Q3���H~���z>�0��
��ml�@��/#Ç"���bօ�`��'n�鎳��P���5˳�Ҟ��&٪�:3�t,P�E��m&菊���?J%vK�{R���y�l�,?�l)�g�H*#���:�X$���gA��Dc�`{i��7�'(j�wd�a�;���J��d��t��w���b���	s��5r ��y��M=���[��y�?mA�.��H���k��2ZP��<��`;�(��
�U�*ԥ`�B��֎��/Ҧi�術y�:��"���ѝO�b]�����h�D���f���!��>+mcbZ��>9-^W�����	>K�Rg���i���4���)#��Y��ɜ�9��oUw�3*���/1C�t�f��SZ���͜���,C�(,֊~j޻�1�U���ͩo�q����L&I]+�s��& �#�B�������R�����A6뵊<"�m�+'���6��*䪸(&+f��G�q����p,��J�T:�����Z��s�Z����Ŀ7CW����+(����|�����}��Q츎I^�7GP0��wG>l�'��e��_@�Gr�@���ë��=h�z��<�?M,ۋ.A.�&#y"k֗��\Ӧa*��M�x*{��_��C{�-�b��b���Ϧ��-����O�3(ܵlW<"�����{�f��,�����2g�r�^mE̲J*��d���j�ÒDT#*����m�v�8���� ���9�B�#z�X���H�$-�/��֥��	��G:�������������  ��t!�|]y�iĈ����2����8����p{x����qQ��,Q���n��&#R�ɐ0��ֺ=��e�c�����A�	��sZLN�؋x�ʾ�YF�ڟ?����Γ��,�����/�xB�O����vR�r�]�0�>��<���$��z����,=ͷw ����(�l�sP���aDNV��?����G�U:��p��W�t�|�d�1N���NN���<��T���J��������@m����V��Y2�(��\ژ��5X![�;�B��D�4S���z�B�JQ\��B����5��++�s�p�ϬY��;��}T�m-�s��������X�dxz����i���I�{M8��nÏ�������H|/b�����-U�C�t^	��7ܻO�c�p�F}��HC���)[��'��t��uK�e����ߴL�qT_"�;�&~V��p�����K?�x�����G>c���A�{�	Uѽ4�h`�F�"��4�{4 ��ؽ� ��!�?�0�B�fe���*�
�5@ ��v�`إ͵3_�DI�H3�֑j]���õ�?�f�.��v�͡�b⋌��4Ռs�~�}����`U� �̚�ڄ�-� ]���#���;[/��b��߲��*6���jgBk_,a3���j8a��9)R'�ɬ�M�YO백$<�W��:�W7�9e�;}D���O�$�NU��{o�̻?�(�������W{�8��3�\���1�qpѱ���rb�����]+�_�v�@v9c��I�(�� ���_�]W�5�.�v��Y�u�`-X�3�x��cF܌����Jf�IG�N"��ZZ 4p�XG��=?�n��x�M��m5
�>�����6���lϮ��o�����E�!�͵*X���94R������5Utm#�n����Zh��Xl���(�U^�y�I/�F.�_�NF2:4��C��9I�H���CBGnO�aA�U��8dWqɯ���l9U$$��yZ&Gm�>j���6M?+�؛�<�W"��G�qr�ǫ�+>^��q�ۏ��e�Fڈw��ɰ����Yɾ�/�~���յ��c��b�O+��
xcsZ�9��0u�<��ӆ��[�T���W���bp�F҇*�Ȗ�ꋞ��Wˬo��������a�TGR��ٙ�����6��/N�'5��:�ܟb2\jep$�0��)�'_v�B��j�#tXH8Ҙ%)�]�a���K�$�� )�4���ng������-V��o;��;+� ��t٬ɢ��ϑ1��|�ȗ1�|��Ib��'4[�����?��f*�rX�=4%Р_phD��X�,����`��Q�,u��x�iB0�F�N�)#��r "h��ؘ��f;��Q;`35�)y�������i�0J,��N�`!p<�"���l[(�Q����#o��lY5g�=G_5�q�v���2��XQ��}��>��mɪ7��tIW��Ś-���t���c.������I����o9��ֿE��_�ˡ��p(�(��Q8\iG��uG�в�p���o9l��r�ο��ֿ��q�[�z��[o�[��пŁm�`���ֿ�v���(�[��[���u������o���ƭ˗��rxu�-�W��rx��r��-���-N#��oQ^��-��ֿ�z�ֿ�ֿ���k�o9��o��o��oY�˷�-��-��-��-��EQy�Fm+��R�{�E�.(�1�ԃ)�{��`�ި
I�ˮڲ/J5`1͸n8o �+e�f ��U���e�m?��܅D+����vC��0MˠV���Jn��h*lo		0��Svd1�a�#H����
�A�Fny@���� ���r���������fx�nds�Y_�2�ʧd:E �Cuڟ:�a��X P����39�/+�,F�a�ĸ�5&5]�������b|��"��Si��	��v_�<�����V#;B�|�W��]��މ���D���c_��u�cTy�G�"�}�J�6�o���-�{��Q�d�Fȣu���0�%��2�s)P�qp����{�d�*ձ�`�ՓB��}�V	{��+Y2΂�c��kvlh������u�]-�#r�J6�Yqc)�f�§&��[fx��WǊ7�ܐ�r�/�m�����6��q��~�VJF�5���&y(f�t�PO�{Q8Y�������~8�Ѓ�#�9]��a6��Ɍ:l�$�!��r�������fe%�<^,�KP�J�L&��Adq�m&g��̥W��"7�l9W&�i�������'�H�����Ȩ<�s�MH<3Q�M1kn#���R�^\A�!����[0[�ֲ���T, �I{l�s2��Q�Cpy@��r�ɞ���pY��+�Q��8k�{��`	2�2�v�/Z�7Ԙ�Z_��-G1@�ݎ��0�I�ɖ4�'�(b�İ�n����S�5��<���*v�ǋe��(�؆�}G��P���G�����ӳ�r��%��"�1�b�$4�$�hn�0����ʠ~�:/�P�| `�����wUl��w���`Fӽ^AT�B��R�`XP�W�p��'�ٳd���e�Qh���H�"�ܗ>;�d+|ۃ�IѪ|�_���Y0љ����'5
���N��Os��O�#7��br�����1��m'�6���S�kOob
���a��<�A��-x^�({��H�/(C����ͻ�c��|mޭ�j����`P~���"�&���2�J�+4� �|Mi�e�	҇�V����o4�j�N��O����<�r�K ����'�	��k,���Ἳe�3J.���s��F�h��R�nR�]v
��ĳ��)/֯��&�Gx�RQ�e�Uk.k�K+2��7�{ʌC�4�s����N�0����z�>H�b�Ӽ�u�jq�Y���s0J�䵾R�㑫k��}O#�,�T�xݻyTD���6%f&t.z�;��^
k�,��h�M�B���z�['�5��EDU��қĴ.+�k��ZƦL0	���c ���+⬰K�S<B��>�цM(v��l[~�d/F�Rc�"!h@aS����Eo�,r��@ɱ��cִ1�i��l���h����6$KS�)�}�a�;��Oq|c�9�ʾBM�x9�u�� t��&{�H��7)�A�Y�?���Th䞝�z!@S�]� ������ȂFTg��*��1	�Lb�� |���)e�3$y;�Ќ�|���}��@���x��t���c�J��>=���i�h緃��f��A�h��ZK� ���&�X��uU kz�Xl���f�W҆*�h�+C�*����`o4�XEk-�$�Ba䍛돍�y�&m�/9>�@;>�5�0�ШvA��%eD/�k�E��;"=J��/i�K<X>�n3W��'�P����QmQq	���Qn�ԧ�ܦ)��~R�_�Mݙx���0��x��3�j#����Vp��N���1:�B�eE!�*(�=/=+�;�q��Ҝ��{���?�K�0���.ȅ@'�E���CQ�}���M`�rU��S��|ISN�˦��ן�4�ؔ+cm�/.(-��3h���rQ;������6���aG!��.G�=��$��,�G���q��@u �}V��to�L�I�����g������'���Y�X�M&�"W �?�>n#���X,E�0�[=H�s��XF�07T�ͤ�c�JEp1i`��0���Q�Z2�e x+*Z��6��`���ו1����'8�/�;�ίEj�uyF#<�����c=�Ac��efilՏ�Te�E���2ѧ�t��s�S�Z��)��b5��?��l�*�]�߫n?]PV�ƢM�o�Mp��%�%�\D�� ���� ��TJOt��dY�o�v2 T;`ɞ&s���R��4���λ~O��d��X؈��b�Tm�5��l���h Tە�fXr���
�bq�g��,�%?��5r՛��~�����:�����Pk�wf���^��!�U����3x��ZX?BW^$�Ф*���.�S.;�%���N�ʂ]o���5���<G9�v�B2�ׄގ�?�5�i�)�2O�v�65��H}��;����<�_�S�����Y[��k�<�F����9K
2�_[��P=_�)��.'�(T]��jO�P"4�a��i֑Kn��b��pQ��d�w	$�Δ�&J��G\ *C�9��������W�9��mxl+]o�Ѣ̘�)������>�S/�������}QE]�:;;��4�0���Ѣ�.\��،�d?���E�R�SSov��&�+:xg՛5��#_ip��h��(�/_��Mp��d:�TX{�K]4'Jk�K���){���t�G}��	��;Y�l]�"�X�E�.ttE�V"֤��؅:բ������\����E2T#���9��8�f���E�C�R�3�g�#�'޽g��5C	�U���""?���;�j^�e�����EzW�l��&B�긶���`�ɿ���@ݦs��G+��aW�od9�0N,'S�z�7 *r�/`!lz���磰�ȟ�vi�wkn�~���M�;}PmZ�3��ik#ǚ9�4"cHyN�ڞ��0+��g�g�ס!�Ć��R*�n2��V_���;�Wv&#������UnE��E��Ş�B��/q��l�W� ��� G^
� ���3r�h�γ�|�i��^��a�%�%6t�J`�R�g�sW��ae�Ps��W� և�2떯l1Wp����3ZB��&]�e��G}��n	��Eڳ�&v�a���pd1�Ĭ���oeyŮ6R�]\v9@��A�D���-�sK�@]
J)���0�{�[	Mv�-:��(@�ņ�?��i� ��7)��VX�ˊ���Y�����< ?Ж_��b�[n[�� f4k��0[D�%�`��7W(�l����h��?�`��/��V�GQ�b��ƌНU)P`��ҵ�v.�nN(8�i����j/�m������E�I���]��آ�V<v���s���?��V`C�*@6�Zl�Ъm;�^�V���_|4KC8~��������I�ԛ>�\��D��˛�a�u��Ls��[sO�m�?����_hD�/��h��e�hv�tyuWdw?%ɼ�vŮeG�M�H��h�91xѠ�[yνx��f�������c�/ 0w��|�'�F��p4Zٓ�7ڥ}���,�	,�z�<�5/ʢ�(va%k�k�s�yj�K0aG/�O]���g}*��̓���f�:�[�	��[��i�ٜ��&]l���]�R���^���͞jd�yy�L�ɸ�GY�2=K����� 8��\���Ij���AKZ���O��h��a���G�(�IF���5
�Ʋ�ۡ$v�IeR�y=wm��{��ڲ�,Iß��x:K���R�9�eR��vqw���Y��Rw�fP��
7��)q�k�\��'4u���'^α�0&g�O�jN��L�V�	��)#�A��&�#��tٱ��j�i1�T�	=
]��}�u�`�b�:E�Xi��ΰ��Ж�&c�+�ݾ�ȾvMG�-�WH���\RE	��m������S6o�LkŸ�-�`���{L!Vu	~d<.!t�ak't�t�㡏8ȴ�];&�ả�צrq5O��6�����\C0v���׋á9���ϝ2��%����,xVSj�0�Ǘ����Va )������0���r�)�Mx�,�z"˦��.@���������k3���W�}��]+0ģU��-C�e��k=��l�=��k��/F����b�&�����=S���U��[~YE&�[���LK�r���Z&�X���|�Jmȁa[��	4J�褎>I�ـ�޹Q���Qv��S��Y��ўGޟ��YoO��-�,so�!��)F�2KE�1r\�W���0��F�^��s�j#¬tV/qRʓ�ܝL��b[��MƸ���T���X�B;���F�;�K��G��&gKOM�����n^�P��9�����cn���������gi|n7s�Fm����KN><��'���7�!{��<���۰��O�ˣꍉ��r�C/M�#�|�X`����F�J�F�-N�0=Op`*��9w�vr�f0|����cչ(ܵ5=gC>D���2������Z��o�Ycz�G/ߋ�W�n��H�t��YNB?#�P}p���tb�(�����$Y������  ���}�v�H��{E�eSsE��˜���ͶN�%K��u�@$�	 j)��̷̧͗LDd&����R�Ч�"�kdddd�d��� aDu��*t�-;�n��T�-OQ4��ȼ�6z3컍��w�wqQ�����L�_�q(�s�5��]Y��Tat�R5���|U�C�?$�ڏ{��Cf�����*=�n��<7�,����~�t-���z��c�S��a�?�:Z��B+��\b�3;�l�9�`��#.��\����z��gL�ϣ�t��/������G�}OF���J|}�ϻ#�,�;�n0�yOT�##h�$|Y~�_`�1>�0�*)�1�Νg�����y��o�v1nEo��L-��#����qq&��:3���P-��q�-��f�a]Z:6��n�I�� �4"nS�w�Nư<��
��N*�g�5-�a]VX�y��h��<�TNTc����7�B���%]�ďW�5�x��O���F�{G����(�����k�-�O�ǹ�v2�r���nU;'�qh����\���Y��?�x��0jƻ���n�8^�.|:s�p/�j?~U�fv��=��h�� �Պw�b�$�%j�~�wQ?H��p��P�����%�W��خ&�(��{o��a�+&V��=�A��V�@���{(�j%+� �6�O�u��/��~r��i�+���u�zc�^�ji4+�ʹ�k7���F@A�����KH��1�2ը���v�,���ȷé?f�/�b�[,�=K�®�/� �Q5���Z5�akc�q�	D��ǽ$֕
�A�L|���;0�W�x�0��0�/��~I�q� ��b����� C����_|ͽ��D��?��Fs���"�����.�5]�u!�^`2w&�>Z��4���ߌ��+ܧ#mz6u�X<rE*��������5��Ԗ�5��l\���j�hZ�Z��QQ�8�� =����ģI��)5�&�h>BI�0>V�1&E���6�Wo$��f��� X:�|w��e��0/�C���o�@D����e�RS��26�� ��e@#@t���m�i= >�rӸ.�>^t?#̢�|���ѼBw-]ʜe��\�u�y�7�[u���:f���\z�ϑ,�N1asn�'�\���+��i����w1�Tg�*�pytS�F�&~�x&_���fH�mx�ǏY�$�i�I���x(�L���@giO���ޤ�܎c��w1�v&�=i�r��r�ޡ�J�н�rх�͆{
�������Q���M�}��8v�߿k��+^���g?�i��ʼ��Ey��s)�.N�����n%�p+���l�u��r���m�{����Cd�o��`G�n��	e~f�!9�����J%͌�Q�D��hL�-ۿ8\\p����k(�8�F�j��D{��iWе\�GS����>!x����w���8�~Mi���ݹrVp%jW����k��9��c��h��|���Y2����t7��Z(?��s������Ų/�|jݷ'0V<������كu���u�_���{�Z�ɭx���Z��/��	��Z�2|��Eȴ *&�o�-�I��#��Ro�Q�֜�̟�� �s��hn۷n2�5u3��:f\�I�=�~U	.Xy�Q�S�P0��Ԟ���D,IX:?��r���-� ����)R^�6���NA���iȼ>>��g4��Q)��8y^��8Ca}�|��o��N0*�9�o0�ܮ��� ��,>�x廅��[��B=3�Y�z����L̵Yhb��K1��e����z��1����u��3��6�z���~f����U1׊S�Ԟ����i3��Ka�
�ͯ]5�D�ʮ�7�гt�WgVD�
?��t��b�"�ؗ��Y����m���%�
iU@�#[lG<��mg�����C�7��H���k0s�|tR��{ߚ� ���Pn��m��}�M�|�hZ��v�l�k�鱆�Ҳ���.Z7��o+��5�5����Q�푭�y<]Wlg�la!h'!��H��>�9e��[Q�Is� ����ޞ;���i[5�.��ZUP9��D��02��A98��A���p���"��j��a��m�nh�C'1����My+��es\�:LKn�=�����rp��,ǙhBQ)P�B����*�e#W��r��"˒o�R�h�;�ҰO嗩�h�h�,��6�b�g\.�)����3a����`�G��l�����4����T(�M+YpR~V%֛���*#�U>W0�}(�UW�G8�*��\~gȴ�FC���3��x�Mq�x�$ha|^<�0��AÐ�FG�r�����\u�� @����g�"H�>���v��Wr���F���~p��n�e�:�x�����I������*��]6���{�-�N���y�)+}�=�]��M���il��.l��SV���N�T��vfuA�Q[��ѳ��N�ȅx|E�R�=�C�����*�HI����Y2]�V��4�W��ː�t'Ü�ņA�>�)�m-�YBKZq��8!���תq<&�{[�\0
��ԤHIJ�2�Pc��F(^a�P�I5�k�Q.N��HNt[�n >���;v<�ځ3��S7u�P�k _���΋U������EZ�����9�%�`��;�F�������(��-��j&��F�T6`*g6�4��`�֣� ��#B��O�GybX�)&S�	��Pig�b5�ҷ){����:V�kyM|�;�Lj����T�y�<M�LS�t�A����D�,�/��*��貴R�1������~���,t�5���3�-ǿ}Q,�ŧ��`�5.���̈#\3�S�^��E�-r��?)���I%o#kR��XgN�Va7��`��^Eu3�©,8�T|��i����7P/��c7W!W�M�Z�2).t<�K��2H�E5�!���2�oUߝ�з�(��?��gc !���.�ZQ�TWN�~����[L�-ni�cN�~ d����E :Y��<���`�m����� FQ�?@\��tizX�zpMT]���:�p({[m����q���-~i\�)�8(���T�Uli*^a�&�ŕ���8֡Ie�.V�Z?b�]�������k�a��濯��G���r��t�;��48�]AC����6���+͟�n��?X��X��a�����_�_��/�|���z�[����Ӆ�>#�kJ����Fs-w��V1����ϔ�,��:k���p{+��p��O�ۻ?j=lD�Q�K�Z�*
mA�s���Ty����[��7�Yo�C���l��{B3��uփ7质:p�T�^CF��� �!2�^�ҷ�z�H�q�������@w�h���atk��	�M݇�`�A�7kx�]�4ѣ:��N��B�0��&������$l��� N�j�0N�vr�!H<��p6���7�'@���?SЋ�TA�@Y��,X!܈�<t�2�]���Yð4g������ϟ�ΏObճ^�����x�4���wç��ҕ}'���v���`RN�w�� GL��A3v��/���M8-?��U�޳B��$l��AI�w�d-�H�a`q ��U�c��@��\׻��T0�oEU{�s@U�2K��E&�`�����vߚ�a>��b���L�S�cBɉ}�9�59�l�Ygyb[׶�o�0��F�ހ����Ѭ����ay�%���)�������OX͠�@�Yր 6LS\H���g�4��̓_�J�2��Q�<l�{dќ��&)܃>��<�t;���2]93���<���0�Tm�����'o.Hb��ޛ��[4�t����i�K?H���T_o�})u)�@����0"�)�*��e�𤰚�l����k-�ܖ?�Go����*�N�Gt�O4�����4۫/R� ���>ӧ�n�J�gE�ô�L`���|5֭z��&ׁn��z�_��3�;)_c�Ğ�YR���rMnk(7k4�����G��,ԨqY�J	=��w&�k��/��܀��y�&���:P1"�YB�\��5ά9W8.�����3B�9M�jWj~?�=צ$@҇Z�J���2��s�][㡸�����T�\�W\4Jk����ֆyXx%%���!a��joE5�NY��R����f��Q\q� 	n3���<�H�����
Z˞a�F"EM@��BJ̜����0r ��1D5Q%VWb5�%��O��?�7w��M�S�O���i�e Ν��Q��	��j�ZZi�:�>�GL(
@i٘P�0����Fj�Nm��pH��JBi���� 4��>>Ő����ap�E��JƗ����4�q�Ͳ�_Z�Z�^�=y������	����]~)KG-KR]~8�E���������l�I�}�N�����җ�M"��Y��X��ڤ��ɓ*���Zf�C��0
Λ�U7E���v�dH��hӫ�x�E�)���G�ئ�t�aW�w.�����cx��Y�W�R���&�C�Yz��싢
��*)�-�љoBs*�jt73� �y���/����=[��D��?;���Kr8\�l���'X*(F�7���m	�ܗVbcq�$i�ſ7�5[r'-��+ʪ E�9��6ֶ�%����l�Q�;��C۬[�Հ��\�c坲*���wz��� �Q;���F���M�?�٭����	YV���$�Ռ�ֺ�5��ɨ����"�_��TҿDim�?u�f �R����	R��P�GW�|��n|fd�ڻ�S�N&��%�c�j�	%4���3��DT]Zɧ�.X�f�%)+���HYS~�Z�������,�^���x��?�Z6T��i^�-��Ň�e�;�hv��%��g	qI���G�������z��T6��"SO�C�D�����kI�Py�W>�%#�j���������6�%ɆF!:�'���$�s�_�%t���Y�E�.��f�f߾v�Ǌ�e2��*u.A.Z�Nx+D��i�z�p��	�� N!�߭s��a(�`�ДX��A#��g��_�ʹ�ܮ�b�n*�20HY'f�=ڍӚ�� l{�3�ӛ�fR�f�O;���)�s����;=ӈyk�aW�1�:߭h]���je��
��2��0�H`Wl{����F\�R��M�Z�B�V&�9�����C�/)�����J;�$�5ù�W���٬D):O^��R3	�Zsu*��3�y�,s�?��	�V��Vo��T�!��l~?WU{���9n��7O��"���й��'3�
�dA��K��|����j�w�z�RM��l�QU�Z(M<i�qQ�v���u��F�����ȷ0�@�b$���^�_9����e�7�o�x��"r�]^����SP��Xlw����SPm�(��ͪ�MT�<=�泆{7�4�[�_o��)�u������,t�C ���w�	�Z�جzK!~˳���Ʉ��"#���'-;��]{fY���fQ�9�دVu����g$4�>�FN��\�7JQ2�H�TƼ$K�(��ťɭ	J��,K~����_B,-��M�"nqv�>Qe(Qޔ*�-T�sʱ[ti,�I���̵��`tt):���-�P�6�\��M��`!c����\�����G��3�dw�P?ܙ:n��
��,�u5NG֘�wvPg�!�bS�X����1ܭ�#�^S�3`8B�/�762�|�4\J`;ī��\_����e,`�i��:��K;��h��-�M���#@����~�,m�ǟ��� 'b��㞧���*'�J�ޱj-��ʚ�*c���	0+s��,�G��?6Y�e�������,(}�G�����f? �T��/&P��z�@R5�"-C�Y���t`�پݵ���_Jz�tԕX��&Ql�7�]�\ϻ
�}`�
C���k&�_���U���=�OI\&���u9`Ճ�gҒ�H��n�7��a���S�,�C�u�6^i�֑bп�
Y�!1�ȍ�5�޵C����&n�J���P�lku���"�"d�F��ڹvzu�cY��h
La��{�24��c��Tf8}�1O��H�b2�U?L�g��h��������<^�¯=�Y�[#hFշ{H'�}@;�);��׀	�}��p. ���,�YN0�Q�������]5�Xs�ӧ;k�:�1���z�=�O:O �,�X�t�'����b�����7�j�^�S�#-��.ω����2ef�������(�uH��g�g�[{�#d�O�/�?*٭��?�ŷ������M�KQ��tK���!M�%�p�Ւk2�aG��id�a4�/Et�')L���T����g/��Y��C[><$'�9��>&��Q��Кة+������͙?SGsߥ�����Л&��=������/bYٙ��R���ɐ�=�:�v@5����F������u�k�:`\ƪ��W�׽�ެ��Fn��-����<Im�w�86*2�`iH�!()���*:}��l<S�?+U-`�����LFϣ'���|���'ED'�k��\�$�Ȫ�x��)��s���ڬ�gtT4��u�s`��n��r�3N� r;�g��L:��sd�w�3�T<��n�{�ڡw�r���	�̾�Wq,( *ޯ�hF�r��m��S�(p��5��X��{���}gs��1��um9.��XE|��?	���{��٨�-v�Z��[l�HƝ�Q����l���+9�� ��	�!�u�c��N(u�Ϣ��@p?9c�+{��Pe�͟'s|�E=1�0/�t=�b��0��P9c������b��25���Ζ�{Sֵ�Ď3KT@�n���qƽc�\:&�|�\�����d��$����p`�`�:��	$��;o�˔�t��}�$��v��ȍ�;\/Xu��F�kD}l(r��6��j���K����ؐ�',PY���m�&]�Um7����3U�w� T��<����|�M�1zv�v�_�?O����M�_W��N؉�޿l�f�\�zh�;+m��O�t���7a� ̎c�}�|$)@D�U��v$�,���)�9��<���|"�JV�Ǵ��v�H���=6�C61���
		z�I>!L2虂��'��\x���_�+���!�{ǜ��=�Z��r��E�|�p�#)�	�vT��h�%)#F߁��.��/�R�H�C�Gkll��"Q0��]g|e��cw���=�{{�����q��O�Pj����G��aM)F�A�Cp��'0�a���aT�[���e��_�H"E`Ȍ� �=8��>z=+B���� �'�-7ޱ�yy�	��s����y;`�����!����:D#�,R�$5��a��%H���ٽ�	U��O�/��$� &�0%�j�́3���k�(���ޖ�/#��d.�9�'�$��%�n�P$��D�L��VLh� M��y؃��7)M���\�9��}�0"kl����'2`'V�v�l��X���*�9�1&IuL��J���-�D�3��>��+bV�-��zw߄�H#i�G��+x��;|)���)�u+�d�x[�B*� sb�C�C|U9�����1�|��r���͈v�[�<Uz�ڗ�m�������-�$[IZ�Z�I�e~�]���_��uz�
���<J�W"}�;w�Ygg��4�D?y<̐*���y��,3����n��]�i*{מ�c7V@srqN�ܱ@N��I�����u��Z�B�����\S�rJ(Ƞ)料���gt%��6�#�֐«뮹p�P��(&*9��U���c�]��u�c�65����8���7,ۙѰ�M��F��[L�@�(Pp�X�<�g�#;ѳ�h�o����:�X�+��x۬�	� Ϻ�O�rI*�T�	�]�}"2ɵw��&e��{�q��Wz}��{�Ϧ�~�0��!�x�d�dt��q�Y����	�͠�xQe9�Ԏ����:ne`��іN~���ٗWgY�l
3e�l��:{��U�_g���Я�YC(���k�.tӏG�S;��R��8�N}[3�L��~i� =��� i�/X1�P�����e�U,��=��������l��p߼��/�Xu�ງ��Bg2q�RS=G��k31L�\E�d���=�َ</�P�i�b��{0a���$�a�Gǟ_�Dq4�RS9�����{}�U���ϚI�J$Q���iqhg�ch]�>G6��:#����ƶ��󢀈@ء�ЛЫ_��^�O�����9×����Z?�����m�A�����7͔����"n��_�������Ʒ���Z�ԺJ��h�Z��q�O��c�=8Uz��sey�~��n׋�b��]y�т�R-'s/�4Z���܌�Q���r�3X*�]�]
~��⨔e���$��*���lSSf`*�8	���RD.��V�1L Ol4�{��Z�a�����z��g�����Cz�|�z�i؋cG?]vk�θ����/�q�2A�JLQ#F�-�I�$a!2�SʞY��g<�������C�{e��^��'	f�@&+ǄMtP���*��0w#Rm:�&D������w&����Xc�TDy� ��LGt
��'.��F�F"�j�
�/]�<jrM9�� �)���ؒʑR��rx�,��`����x�_-��yS�kS:c�:�L�NZ�ֲ{��ǽ��g�I�ku~+�G�Ec��eiڑ.޺�����r��&��'̄S��0���`MqSϾ���k���=B|�􅧔`��О� ���ZB,���Baw��)"p>·I#ZN. �A|�	�8�sڅ��=fJ��;����=��f.��TV���y�S�CC�����g���&��5O�.%��3���ga�^'Q%N{���u��-�3
�"V��1����0�
�o�t�p� ��I��ĞwR��h��}�"��X���Ny®�P�9��1�� IGScA�(H�n4`?��ڣ��^PM�]�����ϯn6��y��;➴�t{�ғ������8�˗ɟ��c��l7U�;\�3Oh�hV���g�C��G���8{ɴ殷�4c�����b��"������2�nDz*��@w� `x��ŷS\0�AӃ8�=Qx��[H�u�}��9�-�����,0m0-�"�i�M�	Jd~q���:�3KKI��(͎{�IWXZ #�TA\�,���V� ]mq�@��Ǽ��(KPs��!R�f�����<߰di���Ԇ���K4@���+{���3��dJ��FH�+��2Sw��\,����^��Pme���ٞ���8�s6�!�� �j�/��;�"{��78����S!�)c��R�h��E#w!n��Y��ٶF��C~"�݉�R!�B��	-�4��Oɥ+�|\)6��;�"bG��b�r�&�5_D�B�!�;'��ù��=HM)�⧝�>#1��q��<V�����/θ���c`�⺏M�Kހ� *R���A�����݁7�;h�@�_D�\����6�Ms���qU���n��B.��b,U�p�U��P�ױ�	ϣI��������Qh�M¼Ll��0�_u�/�N��ǯ���\4f��Ƅ9�<	}�5Fi��N�"�׷�{��:�ɲ���ez�idnŕ9�cK?�(Y,Hݠ�3373��$PSK@h+������>DZ��g��{�;8��rm�E���"ь	8Əs�F�SVCʟHO�&syQ�t���}�y��d�*��qz:�(ʮ�;EfN�/G]�]���ϩ�~��΅���c߀�!9@����6��f��q8�DF��g�Ã�c`��Vl�X=�R<�"�ÖQf#Z��L\�;57.Ճ�$��yc/{G�`*�ˣϟPQL���Ɂ׳��?��F�%_�_�Ac���f �����vbѦ���j�J?Y��~�r�W5�Z��0�r���Lq�m�H=�\`�
��aH�|�]����
WaY98�t|t�oz.w�GG�x:�rX%)m�,*%��ݭ�E�c��[\3g���U+�Lk>���O�&?V'�2���S�t��Z�ML���f�����f
d�TF�y�F����Y�Y��t�����:��p�H�s��P}U~����Yuc�	>��;�r�z�	��7���O�����|�a�B9S��Mu�.�y�^|
��B9~��G�G�-��t�k��z��OY�(��"o	�4�N%��\�f��<��{�����/�(%UH��/>}�wAJ���(���&��P_)�Y����8R�s)w��:�a��|@�V�b^ �(i&���k�K����J���'� �6#Azv��ƬA�`�?�p�H@����[S7d�_3{�7Q�d��/����K�6���������+iT��E�R)�rຄ�&�/G��@�B8%3�y�Y�m��%r;��u�*G�L��${(o���XR�E1itj2u��Ry��p�5�0+p{YM�j��G��r�;h�N}�u�ya�A~��x���&<z���m�Sn��3�񯾴65�ր��j����5��h�X:��`����+k��
)�7��������Fh��|Q�����pv��Ք��"�HN���{J�)�@7��_?&���|���$C[���ka�#�C�ch0��1?����(Sd9�8�7��`�}C.l������Tx�@Si񚍬ɜ�e��pc�eI���N쉾�^8�g��f{�"u~܌��NY�PMœ��
����&�񊲿f׼`��5�Z2|aR��]gL������Lϳrv�L���LCO5w4��w��fG���J�z�7_ϙ����:	�(�ᓊ��LK����3�;i1�d�Ψ�� �q�jF�tU%�N�Ф ��MZ�K*'1���l��a%a7���1����jw��;�dO���FbW�>�_��_m6���U姵�	�2Է��7�5���~�P��k�]'tBȥ�ۓ��{�����.���6\7��k&"-!籈����0�P��y��K�(���a�V'��) ��h�[e0İ��X��H�Eu��o��Ȯ�x�I���`����Z�3��!b\��8{�↛Q �WA�:�l#MT�67������Մ�)���8� 2��*�}
�9�;ڱV�^�R��ۚ�2����pOX.}���w>��;��}h��ʗZ���кe��i���a:jw0ӕ��z8��V+㺳��?*��F���o+�cSF8D����e�h�	�b�6r��|��|W5��@�2�p��n&c��QXg���j�!�E�I1TF9�;�)+	]� 3#+,�=��:����H�ZV5+7449�)���
	����-�-� V���}I�$J9��/~���+X�rؠ��4��]i�j&t�;#�E�Ħ*&4�V�GPT��*8����;�O��Nq��N]Z|6�u�
�i� �4UN���5��Z$9���D��T���z����_`�>ɝ�sZg�p�f6���h��`�9�	�n�i�nb��2�qz(�۩o9cm����T�5��B���8"�J�n�Ε�8H	�kV��6�of�	�X#)���^)B!��^��ۨ��@�(G�E����G���k�
�z&	��[#4�#��o��n8]%�mdp��o֑sq�k�ʼ��&��zsg��4-

-q�.��t�9��z[���h�����o~骵rU]�<��K��)*��nk��m|��»5�>�k RW5�O�0-�ƺ�TpƘ��hπo�q����/N���,�PJ��WL�a��fm!��v,�RRl�f�N�9��@���}�/O�^�S�o�t}x��t�$�G�������@U�G@kS��ӱؾӟu%c�^Ka� +5�e<�����i �~���Y�]���Ң����^�f5ll�ѹv�F�qm��t�G�y���PNT����{ E)"�h��,�/�֜0�
�3����t\�����F�	������F�tDQ�w����w��7߆�Ic�leЂ����pf�^�y���ѳ��B�F�	^W�O �[��~~D0಍9��@֛-{������й9�1�0�iy�
����8�o7�����@gm@�r��z�9>v��V�}D)	#Q�C	)E6Rh��.԰��):�S��ؼ]�2�s
��z���B'S3�{w۰w����i�p�3�5r�n��ln��Q�ֹ?��УP�n��Y��ƒ9N}>� ������a�6kW��յ��{�[�<����
��*.�3	��A3q�� 8~�5���XN�M���q_i�C�1��("�.6`>�?����m���/&b�L�S ��9Î�a��Ke6Ir��P�u]��,��o7���N�d�_q`e_+2[G�t�qy>5*�;�v҂ӬD'�d��K��6xh����4�2��hݾiė6���^|�>U�I˖�=���\r���ߣȶB}�RD���h��381s�E���a^D�P�|͠*o�NNi�fP%�3� sE|��R�5+�m▥oN�x�FݾlB�E��,�'�w�~��1բ�۴�W�o�i,�8�^�s�Q]�	���߄�W�i��D[��4�S�9C�� ���ǹ�����/��o:��Ȥ&�7����NǗ�!�p�x�^�	3��o�UT���b ?��c�v�T,�l-ū�Y����!P�G>'o���^��!_�un,z ����jJ ���Y�CS�/�����-���!)	pȟb>���xF�&K�x *~���8�}4;�
�? {�� ��^y�v~8��*��c;!�j�{�v�J
\��V}���JU"KĊ�rT�%�/���1V0y].B�
-G�b��`��d�{��%�YG7�u�ڡ����<ׁ=v�k�W
�e08,)^&�M�5yS�� �¤^�l5~0��%�5m�֠Қ���nVྐྵ�����Ҭo�I94�j:}�H�B�B�r��0PU��J_^������Q��E�߂����R�;���d��m����V :�MN�����_A��B�\iM�"ce��4��x�gBVW��ujs�{��W��B3b�5�S�Y��5�U ����.��6;[[��&Q�p����d�P���Ϥ�p�6E��N(-�#� _�}!��$v�������#0)�m�:.�@5��>"Z�H�@�����)��Ȋ�ݻ������+�U$q>��h�bZܠ� ޵��CHÖ[B�v��~V�A�MFe��0>sl��S	�7��z|��jR��y��i�g%�Z�R˦����&)�6P��)�=F��Y��IҰ����� ����١���P�Ԣ�����e�5Y2yZ
��Q
��X+�BOm]H�rH�`x�����SS���h�#��y}W��g��<��ͽS����ݰf����Uߑ/>�3��oh�!8��|�D��`?����i��fmfl��?�0�;ǫ8�n#��o8c� Y��YV���^��tOuNON?����e.���:@@>-��m�?U��}8:�遡��g�f��5O����w�>흟}��O�>fY��6��l������������Tj#������6CU���
��S��>��@��	u�,�}�f���?���S��= �{'� ��2Zv(uF�8��x�&�:���4\(z�?��5��(%�#E�u;�޿;�U+X���ɉ,ϭN�6�>�������gx��ᏺoc
D{�	�caҗ���   �� C�E�