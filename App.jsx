const { useState, useEffect, useMemo, useRef, useCallback } = React;
// React 18 ships useDeferredValue; guard so an older UMD build still runs.
const useDeferredValue = React.useDeferredValue || ((v) => v);
// Resolving an icon used to mean building a throwaway div, running
// lucide.createIcons over it and copying innerHTML back — inside an effect, so
// every one of the ~200 icons cost a second paint. The markup only depends on
// name + className, so it is resolved once and reused.
const ICON_CACHE = new Map();
const resolveIconMarkup = (name, className) => {
  const key = `${name}|${className}`;
  if (ICON_CACHE.has(key)) return ICON_CACHE.get(key);
  let markup = "";
  if (typeof window !== "undefined" && window.lucide) {
    try {
      const temp = document.createElement("div");
      temp.innerHTML = `<i data-lucide="${name}" class="${className}"></i>`;
      window.lucide.createIcons({ root: temp });
      markup = temp.innerHTML;
    } catch (e) {
      markup = "";
    }
  }
  // Only cache a real result; lucide may not have loaded on the first paint.
  if (markup && markup.indexOf("<svg") !== -1) ICON_CACHE.set(key, markup);
  return markup;
};
const Icon = ({ name, className = "w-4 h-4" }) => {
  const markup = resolveIconMarkup(name, className);
  const ref = useRef(null);
  useEffect(() => {
    // Covers the case where lucide arrived after this icon first rendered.
    if (!markup && ref.current) {
      const late = resolveIconMarkup(name, className);
      if (late) ref.current.innerHTML = late;
    }
  }, [markup, name, className]);
  return React.createElement("span", {
    ref,
    style: { display: "contents" },
    dangerouslySetInnerHTML: { __html: markup },
  });
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
  // Regions are defined by their midpoint angle; a colour belongs to whichever
  // midpoint is nearest going round the circle. Boundaries fall halfway
  // between neighbours, so there is no wrap-around special case.
  hues: [
    { id: "h1", name: "Red", centerH: 10 },
    { id: "h2", name: "Orange", centerH: 52 },
    { id: "h3", name: "Yellow", centerH: 92 },
    { id: "h4", name: "Green", centerH: 140 },
    { id: "h5", name: "Cyan", centerH: 195 },
    { id: "h6", name: "Blue", centerH: 255 },
    { id: "h7", name: "Magenta", centerH: 315 },
  ],
  overrides: [
    { id: "o1", condition: "Light Muted Yellow", name: "Beige" },
    { id: "o2", condition: "Dark Vivid Blue", name: "Navy" },
  ],
};
// Older saved settings stored an upper bound per region. Derive a midpoint
// from those so existing files keep working without a migration step.
const hueCenterOf = (hue, all) => {
  if (hue && isFinite(hue.centerH)) return ((hue.centerH % 360) + 360) % 360;
  if (!hue || !isFinite(hue.maxH)) return 0;
  const sorted = [...(all || [])]
    .filter((x) => isFinite(x.maxH))
    .sort((a, b) => a.maxH - b.maxH);
  const i = sorted.findIndex((x) => x.id === hue.id);
  const prev = i > 0 ? sorted[i - 1].maxH : (sorted[sorted.length - 1]?.maxH ?? 0) - 360;
  const mid = (prev + hue.maxH) / 2;
  return ((mid % 360) + 360) % 360;
};
const hueArcDistance = (a, b) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
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
    // Nearest midpoint wins; ties go to the lower angle for stability.
    let best = null, bestD = Infinity;
    (hues || []).forEach((hu) => {
      const centre = hueCenterOf(hu, hues);
      const d = hueArcDistance(h, centre);
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) < 1e-9 && best && centre < hueCenterOf(best, hues))) {
        bestD = d; best = hu;
      }
    });
    if (best) hueName = best.name;
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
function getGlobalDuplicate(
  names,
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
      return `Anchor (${key})`;
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
        return `Pin (${pt.erpCode})`;
      }
    }
  }
  return null;
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
// Panel open/closed state used to reset to defaultOpen every time the sidebar
// remounted, so anything you opened closed itself as soon as you moved around.
const PANEL_OPEN_STATE = {};
const CollapsiblePanel = ({
  title,
  icon,
  children,
  summary,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(
    PANEL_OPEN_STATE[title] !== undefined ? PANEL_OPEN_STATE[title] : defaultOpen,
  );
  const toggle = () => {
    PANEL_OPEN_STATE[title] = !isOpen;
    setIsOpen(!isOpen);
  };
  return React.createElement(
    "div",
    { className: "border-b border-slate-200 dark:border-neutral-800" },
    React.createElement(
      "button",
      {
        onClick: toggle,
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
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        !isOpen && summary
          ? React.createElement(
              "span",
              {
                className:
                  "text-[10px] font-mono text-slate-400 dark:text-neutral-500 truncate max-w-[140px]",
              },
              summary,
            )
          : null,
        React.createElement(Icon, {
          name: isOpen ? "chevron-up" : "chevron-down",
          className: "w-4 h-4 text-slate-400",
        }),
      ),
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

// ─── Fast colour math ───────────────────────────────────────────────────────
// The same numbers colorjs gives for xyz-d65 → OkLab/OkLCH and ΔE OK (plain
// OkLab distance), without building Color objects. Bulk loops (imports,
// matches, filters) used to allocate several objects per colour per frame.
const FAST_XYZ_LMS = [
  0.819022437996703, 0.3619062600528904, -0.1288737815209879,
  0.0329836539323885, 0.9292868615863434, 0.0361446663506424,
  0.0481771893596242, 0.2642395317527308, 0.6335478284694309,
];
const FAST_LMS_LAB = [
  0.210454268309314, 0.7936177747023054, -0.0040720430116193,
  1.9779985324311684, -2.42859224204858, 0.450593709617411,
  0.0259040424655478, 0.7827717124575296, -0.8086757549230774,
];
// → [L, C, H] with H = NaN for achromatic colours, exactly like colorjs.
const fastXyzToOklch = (x, y, z) => {
  const M = FAST_XYZ_LMS, N = FAST_LMS_LAB;
  const l = Math.cbrt(M[0] * x + M[1] * y + M[2] * z);
  const m = Math.cbrt(M[3] * x + M[4] * y + M[5] * z);
  const s = Math.cbrt(M[6] * x + M[7] * y + M[8] * z);
  const L = N[0] * l + N[1] * m + N[2] * s;
  const a = N[3] * l + N[4] * m + N[5] * s;
  const b = N[6] * l + N[7] * m + N[8] * s;
  const C = Math.sqrt(a * a + b * b);
  let H = NaN;
  if (!(Math.abs(a) < 0.0002 && Math.abs(b) < 0.0002)) {
    H = (Math.atan2(b, a) * 180) / Math.PI;
    if (H < 0) H += 360;
  }
  return [L, C, H];
};
// "#rgb" / "#rrggbb" → [L, C, H] (null when it isn't a hex colour).
const fastHexToOklch = (hex) => {
  let ch = String(hex || "").replace("#", "").trim();
  if (ch.length === 3) ch = ch[0] + ch[0] + ch[1] + ch[1] + ch[2] + ch[2];
  const r = parseInt(ch.substring(0, 2), 16), g = parseInt(ch.substring(2, 4), 16), b = parseInt(ch.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  const xyz = srgbToXyzD65Raw(r, g, b);
  return fastXyzToOklch(xyz[0], xyz[1], xyz[2]);
};
// ΔE OK ×100 between two OkLCH colours (H in degrees; NaN hue counts as 0).
const fastDeltaEOK = (L1, C1, H1, L2, C2, H2) => {
  const h1 = ((isNaN(H1) ? 0 : H1) * Math.PI) / 180, h2 = ((isNaN(H2) ? 0 : H2) * Math.PI) / 180;
  const da = C1 * Math.cos(h1) - C2 * Math.cos(h2), db = C1 * Math.sin(h1) - C2 * Math.sin(h2), dL = L1 - L2;
  return Math.sqrt(dL * dL + da * da + db * db) * 100;
};
// A commercial colour's OkLCH (and display hex), worked out once per record:
// spectral data first, then stored L/C/H, then the hex.
const FAST_ITEM_LCH = new WeakMap();
const fastItemLch = (item) => {
  if (!item || typeof item !== "object") return null;
  let hit = FAST_ITEM_LCH.get(item);
  if (hit) return hit;
  let L, C, H, hex = item.hex || "#000000";
  try {
    if (item.spectral && item.spectral.length === 31) {
      const xyz = calculateXYZFromSpectral(item.spectral, 2, "D65");
      [L, C, H] = fastXyzToOklch(xyz[0], xyz[1], xyz[2]);
      hex = new Color("xyz-d65", xyz).to("srgb").toString({ format: "hex" });
    } else if (item.L !== undefined && item.C !== undefined && item.H !== undefined) {
      L = item.L; C = item.C; H = item.H;
    } else {
      const o = fastHexToOklch(item.hex);
      if (!o) return null;
      [L, C, H] = o;
    }
  } catch (e) {
    return null;
  }
  if (typeof L !== "number" || typeof C !== "number" || !isFinite(L) || !isFinite(C)) return null;
  hit = { L, C, H: isNaN(H) ? 0 : H, hex };
  FAST_ITEM_LCH.set(item, hit);
  return hit;
};
// Gamut test and display hex for an OkLCH point, via colorjs once per distinct
// coordinate (anchors are re-listed on every edit; their colours don't change).
const LCH_GAMUT_HEX = new Map();
const lchGamutHex = (L, C, H) => {
  const k = L + "|" + C + "|" + H;
  let hit = LCH_GAMUT_HEX.get(k);
  if (!hit) {
    const c = new Color("oklch", [L, C, H]);
    const inGamut = c.inGamut("srgb");
    hit = { inGamut, hex: inGamut ? c.clone().toGamut({ space: "srgb" }).toString({ format: "hex" }) : null };
    if (LCH_GAMUT_HEX.size > 50000) LCH_GAMUT_HEX.clear();
    LCH_GAMUT_HEX.set(k, hit);
  }
  return hit;
};
// colorjs's inGamut("srgb") (ε = 0.000075 on encoded channels) in plain maths.
const FAST_INV3 = (m) => {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det];
};
const FAST_LAB_LMS = FAST_INV3(FAST_LMS_LAB), FAST_LMS_XYZ = FAST_INV3(FAST_XYZ_LMS);
const FAST_XYZ_RGB = [
  3.2409699419045226, -1.537383177570094, -0.4986107602930034,
  -0.9692436362808796, 1.8759675015077202, 0.04155505740717559,
  0.05563007969699366, -0.20397695888897652, 1.0569715142428786,
];
const fastInGamutSrgb = (L, C, H) => {
  if (![L, C, H].every((v) => typeof v === "number" && isFinite(v))) return new Color("oklch", [L, C, H]).inGamut("srgb");
  const h = (H * Math.PI) / 180, A = C * Math.cos(h), B = C * Math.sin(h), M = FAST_LAB_LMS, X = FAST_LMS_XYZ, R = FAST_XYZ_RGB;
  let l = M[0] * L + M[1] * A + M[2] * B, m = M[3] * L + M[4] * A + M[5] * B, s = M[6] * L + M[7] * A + M[8] * B;
  l = l * l * l; m = m * m * m; s = s * s * s;
  const x = X[0] * l + X[1] * m + X[2] * s, y = X[3] * l + X[4] * m + X[5] * s, z = X[6] * l + X[7] * m + X[8] * s;
  const e = 0.000075;
  for (let k = 0; k < 3; k++) {
    const v = R[k * 3] * x + R[k * 3 + 1] * y + R[k * 3 + 2] * z, a = Math.abs(v);
    const g = a > 0.0031308 ? Math.sign(v) * (1.055 * Math.pow(a, 1 / 2.4) - 0.055) : 12.92 * v;
    if (g < -e || g > 1 + e) return false;
  }
  return true;
};
// toGamut(srgb) hex for an OkLCH point, cached per coordinate.
const LCH_DISPLAY_HEX = new Map();
const lchDisplayHex = (L, C, H) => {
  const k = L + "|" + C + "|" + H;
  let hex = LCH_DISPLAY_HEX.get(k);
  if (hex === undefined) {
    try {
      hex = new Color("oklch", [L, C, H]).toGamut({ space: "srgb" }).toString({ format: "hex" });
    } catch (e) {
      hex = "#cccccc";
    }
    if (LCH_DISPLAY_HEX.size > 50000) LCH_DISPLAY_HEX.clear();
    LCH_DISPLAY_HEX.set(k, hex);
  }
  return hex;
};

// History records never change once stored, so their JSON is cached.
const HISTORY_STR = new WeakMap();
const historyRecordStr = (rec) => {
  if (!rec || typeof rec !== "object") return JSON.stringify(rec);
  let s = HISTORY_STR.get(rec);
  if (s === undefined) { s = JSON.stringify(rec); HISTORY_STR.set(rec, s); }
  return s;
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
// Hoisted out of CommercialMatches: defined inline it got a fresh type on
// every render, so React unmounted and remounted every match row whenever
// the search box or the ΔE slider changed.
const MatchRow = ({ label, match, onSelectColor, setFullscreenImage, fmt }) => {
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
const CommercialMatches = ({
  crosshair,
  colorData,
  filterSameNoun,
  names,
  onSelectColor,
  savedColors = {},
}) => {
  // Hooks must run on every render, so they stay above any early return.
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [maxDeltaE, setMaxDeltaE] = useState(1.0);
  const [searchQuery, setSearchQuery] = useState("");
  const c = useMemo(
    () =>
      new Color("oklch", [
        crosshair?.rawL ?? 0,
        crosshair?.rawC ?? 0,
        crosshair?.rawH ?? 0,
      ]),
    [crosshair?.rawL, crosshair?.rawC, crosshair?.rawH],
  );
  const fmt = (v, d = 3) => (isNaN(v) ? "0.000" : Number(v).toFixed(d));
  const filteredMatches = useMemo(() => {
    if (!colorData || Object.keys(colorData).length === 0) return null;

    let sameGroup = null;
    if (filterSameNoun) {
      sameGroup = getSameGroupContext(crosshair.rawL, crosshair.rawC, crosshair.rawH, savedColors, names);
    }

    const allMatches = [];
    const cL = c.coords[0], cC = c.coords[1], cH = c.coords[2];
    const processList = (list, label, brandKey) => {
      if (!list || !Array.isArray(list)) return;
      for (let listIdx = 0; listIdx < list.length; listIdx++) {
        const item = list[listIdx];
        try {
          // Each record's OkLCH is worked out once and cached; ΔE OK is the
          // plain OkLab distance, so no Color objects per record per move.
          const lch = fastItemLch(item);
          if (!lch) continue;
          const hexVal = lch.hex;
          const d = fastDeltaEOK(cL, cC, cH, lch.L, lch.C, lch.H);
          if (d <= maxDeltaE) {
            if (filterSameNoun && sameGroup) {
              const itemL = lch.L;
              const itemC = lch.C;
              const itemH = lch.H;

              if (filterSameNoun && !matchesSameNoun(sameGroup, itemL, itemC, itemH)) {
                continue;
              }
            }

            allMatches.push({
              label,
              match: {
                ...item,
                hex: hexVal,
                L: lch.L,
                C: lch.C,
                H: lch.H,
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
    filterSameNoun,
    names,
    savedColors,
  ]);

  if (!crosshair) return null;

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
              onSelectColor,
              setFullscreenImage,
              fmt,
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

    // Plotly pans cartesian subplots on touch but has no pinch-to-zoom for
    // them — scrollZoom only covers the wheel. Two-finger zoom is done here by
    // rescaling the axis ranges about the pinch midpoint.
    let pinch = null;
    const pxToData = (ax, px) => {
      if (ax && typeof ax.p2d === "function") return ax.p2d(px);
      if (!ax || !ax.range) return 0;
      return (ax.range[0] + ax.range[1]) / 2;
    };
    const twoFinger = (e) => e.touches && e.touches.length === 2;
    const spread = (e) =>
      Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY,
      ) || 1;
    const onTouchStart = (e) => {
      if (is3D || !twoFinger(e)) {
        pinch = null;
        return;
      }
      const fl = gd._fullLayout;
      if (!fl || !fl.xaxis || !fl.yaxis) return;
      const rect = gd.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      pinch = {
        dist: spread(e),
        xr: [...fl.xaxis.range],
        yr: [...fl.yaxis.range],
        cx: pxToData(fl.xaxis, mx - (fl.xaxis._offset || 0)),
        cy: pxToData(fl.yaxis, my - (fl.yaxis._offset || 0)),
      };
      e.preventDefault();
    };
    const onTouchMove = (e) => {
      if (!pinch || !twoFinger(e)) return;
      const k = pinch.dist / spread(e);
      Plotly.relayout(gd, {
        "xaxis.range": [
          pinch.cx + (pinch.xr[0] - pinch.cx) * k,
          pinch.cx + (pinch.xr[1] - pinch.cx) * k,
        ],
        "yaxis.range": [
          pinch.cy + (pinch.yr[0] - pinch.cy) * k,
          pinch.cy + (pinch.yr[1] - pinch.cy) * k,
        ],
      });
      e.preventDefault();
    };
    const onTouchEnd = () => {
      pinch = null;
    };
    gd.addEventListener("touchstart", onTouchStart, { passive: false });
    gd.addEventListener("touchmove", onTouchMove, { passive: false });
    gd.addEventListener("touchend", onTouchEnd);
    gd.addEventListener("touchcancel", onTouchEnd);
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
      gd.removeEventListener("touchstart", onTouchStart);
      gd.removeEventListener("touchmove", onTouchMove);
      gd.removeEventListener("touchend", onTouchEnd);
      gd.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [data, layout, theme, configStr]);
  return React.createElement("div", {
    ref: chartRef,
    // touch-none hands pinch and drag to Plotly instead of letting the browser
    // treat them as page scrolling.
    className: "plotly-wrapper touch-none",
  });
};






// ─── Explore: OkLCH colour-space viewer ──────────────────────────────────────
// One 3D view and three 2D sections (L, C, H) of the anchors' cells. Each
// anchor owns the region of colour space that is nearer to it than to any
// other anchor (its Voronoi cell), clipped to the sRGB gamut. Inflation grows
// every cell from a small dot to that full region; the viewport tolerance
// sliders cut true sections through the solid.
//
// Coordinates follow the rest of the app: a = C·sin H, b = C·cos H, so hue 0°
// points up in the L section, as in the old Light layers view.
const SPACE_THREE_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
let SPACE_THREE_PROMISE = null;
const loadSpaceThree = () => {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (!SPACE_THREE_PROMISE) {
    SPACE_THREE_PROMISE = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SPACE_THREE_URL;
      s.async = true;
      s.onload = () =>
        window.THREE ? resolve(window.THREE) : reject(new Error("three.js did not load"));
      s.onerror = () => {
        SPACE_THREE_PROMISE = null;
        reject(new Error("Could not load three.js"));
      };
      document.head.appendChild(s);
    });
  }
  return SPACE_THREE_PROMISE;
};

// World units: chroma ×10 across, lightness ×7 up (the solid's familiar shape).
const SPACE_CW = 10, SPACE_LW = 7, SPACE_LC = 0.5, SPACE_AMAX = 0.34;
const spaceHueDist = (a, b) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};
const spaceToWorld = (L, C, H) => {
  const h = (H * Math.PI) / 180;
  return [C * Math.sin(h) * SPACE_CW, (L - SPACE_LC) * SPACE_LW, -C * Math.cos(h) * SPACE_CW];
};
const spaceWorldToLCH = (x, y, z) => {
  const a = x / SPACE_CW, b = -z / SPACE_CW;
  let H = (Math.atan2(a, b) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [y / SPACE_LW + SPACE_LC, Math.hypot(a, b), H];
};
// Is a world point a displayable sRGB colour? (OkLab a = C·cos H = b_app.)
const spaceInGamut = (x, y, z) => {
  const L = y / SPACE_LW + SPACE_LC;
  if (L < 0 || L > 1) return false;
  const A = -z / SPACE_CW, B = x / SPACE_CW;
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const l3 = l_ * l_ * l_, m3 = m_ * m_ * m_, s3 = s_ * s_ * s_;
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  const e = 0.002;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && bl >= -e && bl <= 1 + e;
};
// OkLCH → gamma-encoded sRGB, clipped. Used whenever a point has no usable hex.
const spaceLchToRgb = (L, C, H) => {
  const h = (H * Math.PI) / 180, A = C * Math.cos(h), B = C * Math.sin(h);
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const l3 = l_ * l_ * l_, m3 = m_ * m_ * m_, s3 = s_ * s_ * s_;
  const enc = (v) => { const x = Math.max(0, Math.min(1, v)); return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };
  return [
    enc(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    enc(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    enc(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3),
  ];
};
// A point's display colour as #rrggbb: its own hex when it has one, else computed.
const spaceHexFor = (hex, L, C, H) => {
  if (typeof hex === "string" && /^#?[0-9a-f]{6}$|^#?[0-9a-f]{3}$/i.test(hex.trim()))
    return hex.trim().startsWith("#") ? hex.trim() : "#" + hex.trim();
  const rgb = spaceLchToRgb(L, C, H);
  return "#" + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
};
const spaceHexToRgb = (hex) => {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (!isFinite(n)) return [0.6, 0.6, 0.6];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const spaceParseCss = (css, fallback) => {
  const m = String(css || "").match(/rgba?\(([^)]+)\)/);
  if (!m) return fallback;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  if (p.length >= 4 && p[3] === 0) return fallback; // transparent → use fallback
  return [p[0] / 255, p[1] / 255, p[2] / 255];
};

// A closed unit sphere (no seam duplicates), shared by every cell. Fewer facets
// when there are many anchors, so big libraries stay responsive.
const SPACE_TEMPLATES = {};
const spaceTemplate = (W, HS) => {
  const key = W + "x" + HS;
  if (SPACE_TEMPLATES[key]) return SPACE_TEMPLATES[key];
  const dirs = [0, 1, 0];
  for (let i = 1; i < HS; i++) {
    const v = (i / HS) * Math.PI;
    for (let j = 0; j < W; j++) {
      const u = (j / W) * 2 * Math.PI;
      dirs.push(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    }
  }
  dirs.push(0, -1, 0);
  const S = dirs.length / 3 - 1;
  const ring = (i, j) => 1 + (i - 1) * W + (((j % W) + W) % W);
  const tris = [];
  for (let j = 0; j < W; j++) tris.push(0, ring(1, j), ring(1, j + 1));
  for (let i = 1; i < HS - 1; i++)
    for (let j = 0; j < W; j++) {
      const a = ring(i, j), b = ring(i, j + 1), c = ring(i + 1, j), d = ring(i + 1, j + 1);
      tris.push(a, c, b, b, c, d);
    }
  for (let j = 0; j < W; j++) tris.push(S, ring(HS - 1, j + 1), ring(HS - 1, j));
  for (let t = 0; t < tris.length; t += 3) { const k = tris[t + 1]; tris[t + 1] = tris[t + 2]; tris[t + 2] = k; } // outward-facing
  return (SPACE_TEMPLATES[key] = { dirs: new Float32Array(dirs), tris, count: S + 1 });
};

// Clip a closed mesh against f(p) <= 0 and seal the opening with a flat cap.
// mesh = { P: [x,y,z,...], K: [1 = cap vertex], T: [triangle indices] }
const spaceClipMesh = (m, f) => {
  const nv = m.K.length, fv = new Float64Array(nv);
  let anyIn = false, anyOut = false;
  for (let v = 0; v < nv; v++) {
    const d = f(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]);
    fv[v] = d;
    if (d <= 0) anyIn = true; else anyOut = true;
  }
  if (!anyOut) return m;
  if (!anyIn) return null;
  const P = [], K = [], T = [], remap = new Int32Array(nv).fill(-1), edge = new Map(), segs = [];
  const keep = (v) => {
    if (remap[v] < 0) {
      remap[v] = K.length;
      P.push(m.P[v * 3], m.P[v * 3 + 1], m.P[v * 3 + 2]);
      K.push(m.K[v]);
    }
    return remap[v];
  };
  const cut = (u, v) => {
    const key = u < v ? u * 1e6 + v : v * 1e6 + u;
    let id = edge.get(key);
    if (id === undefined) {
      const t = fv[u] / (fv[u] - fv[v]);
      id = K.length;
      P.push(
        m.P[u * 3] + t * (m.P[v * 3] - m.P[u * 3]),
        m.P[u * 3 + 1] + t * (m.P[v * 3 + 1] - m.P[u * 3 + 1]),
        m.P[u * 3 + 2] + t * (m.P[v * 3 + 2] - m.P[u * 3 + 2]),
      );
      K.push(m.K[u]);
      edge.set(key, id);
    }
    return id;
  };
  for (let q = 0; q < m.T.length; q += 3) {
    const tri = [m.T[q], m.T[q + 1], m.T[q + 2]];
    const ins = [fv[tri[0]] <= 0, fv[tri[1]] <= 0, fv[tri[2]] <= 0];
    const nIn = ins[0] + ins[1] + ins[2];
    if (nIn === 3) { T.push(keep(tri[0]), keep(tri[1]), keep(tri[2])); continue; }
    if (nIn === 0) continue;
    const poly = [], cuts = [];
    for (let e = 0; e < 3; e++) {
      const u = tri[e], v = tri[(e + 1) % 3];
      if (ins[e]) poly.push(keep(u));
      if (ins[e] !== ins[(e + 1) % 3]) { const c = cut(u, v); poly.push(c); cuts.push(c); }
    }
    for (let k = 1; k + 1 < poly.length; k++) T.push(poly[0], poly[k], poly[k + 1]);
    if (cuts.length === 2) segs.push(cuts[0], cuts[1]);
  }
  if (segs.length) {
    let cx = 0, cy = 0, cz = 0;
    for (const id of segs) { cx += P[id * 3]; cy += P[id * 3 + 1]; cz += P[id * 3 + 2]; }
    cx /= segs.length; cy /= segs.length; cz /= segs.length;
    const c0 = K.length;
    P.push(cx, cy, cz); K.push(1);
    const dup = new Map();
    const capV = (id) => {
      let d = dup.get(id);
      if (d === undefined) { d = K.length; P.push(P[id * 3], P[id * 3 + 1], P[id * 3 + 2]); K.push(1); dup.set(id, d); }
      return d;
    };
    for (let k = 0; k < segs.length; k += 2) T.push(c0, capV(segs[k]), capV(segs[k + 1]));
  }
  return { P, K, T };
};

// Uniform grid for nearest-anchor queries in world space.
const spaceMakeGrid = (px, py, pz, n) => {
  const G = 0.6, MIN = -5, GD = Math.ceil(10 / G);
  const cells = Array.from({ length: GD * GD * GD }, () => []);
  const gi = (v) => Math.max(0, Math.min(GD - 1, Math.floor((v - MIN) / G)));
  for (let i = 0; i < n; i++) cells[(gi(px[i]) * GD + gi(py[i])) * GD + gi(pz[i])].push(i);
  // Exact nearest via per-cell candidate lists: the nearest anchor of any
  // point in a cell lies within (centre's nearest distance + cell diagonal) of
  // the centre. Built lazily, so a query costs a short scan instead of a
  // growing shell search (sections ask this for every pixel).
  const HALF_DIAG = (G * Math.sqrt(3)) / 2, MAX = MIN + GD * G;
  const cand = new Array(GD * GD * GD);
  const nearest = (x, y, z, skip = -1) => {
    if (skip < 0 && x >= MIN && x < MAX && y >= MIN && y < MAX && z >= MIN && z < MAX) {
      const ci = (gi(x) * GD + gi(y)) * GD + gi(z);
      let list = cand[ci];
      if (!list) {
        const ix = Math.floor(ci / (GD * GD)), iy = Math.floor(ci / GD) % GD, iz = ci % GD;
        const ox = MIN + (ix + 0.5) * G, oy = MIN + (iy + 0.5) * G, oz = MIN + (iz + 0.5) * G;
        const a0 = shellNearest(ox, oy, oz, -1);
        if (a0 < 0) list = [];
        else {
          const d0 = Math.hypot(px[a0] - ox, py[a0] - oy, pz[a0] - oz);
          list = within(ox, oy, oz, d0 + 2 * HALF_DIAG + 1e-6, -1).map((e) => e[1]);
        }
        cand[ci] = list;
      }
      let best = -1, bd = 1e18;
      for (let q = 0; q < list.length; q++) {
        const a = list[q], dx = px[a] - x, dy = py[a] - y, dz = pz[a] - z, d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = a; }
      }
      return best;
    }
    return shellNearest(x, y, z, skip);
  };
  const shellNearest = (x, y, z, skip = -1) => {
    const cx = gi(x), cy = gi(y), cz = gi(z);
    let best = -1, bd = 1e18;
    for (let k = 0; k < GD; k++) {
      for (let i = cx - k; i <= cx + k; i++) {
        if (i < 0 || i >= GD) continue;
        for (let j = cy - k; j <= cy + k; j++) {
          if (j < 0 || j >= GD) continue;
          for (let l = cz - k; l <= cz + k; l++) {
            if (l < 0 || l >= GD) continue;
            if (Math.max(Math.abs(i - cx), Math.abs(j - cy), Math.abs(l - cz)) !== k) continue;
            for (const a of cells[(i * GD + j) * GD + l]) {
              if (a === skip) continue;
              const dx = px[a] - x, dy = py[a] - y, dz = pz[a] - z, d = dx * dx + dy * dy + dz * dz;
              if (d < bd) { bd = d; best = a; }
            }
          }
        }
      }
      if (best >= 0 && Math.sqrt(bd) <= k * G) break;
    }
    return best;
  };
  // Every anchor within radius R of a point, sorted nearest first.
  const within = (x, y, z, R, skip) => {
    const out = [], k = Math.ceil(R / G), cx = gi(x), cy = gi(y), cz = gi(z), R2 = R * R;
    for (let i = Math.max(0, cx - k); i <= Math.min(GD - 1, cx + k); i++)
      for (let j = Math.max(0, cy - k); j <= Math.min(GD - 1, cy + k); j++)
        for (let l = Math.max(0, cz - k); l <= Math.min(GD - 1, cz + k); l++)
          for (const a of cells[(i * GD + j) * GD + l]) {
            if (a === skip) continue;
            const dx = px[a] - x, dy = py[a] - y, dz = pz[a] - z, d = dx * dx + dy * dy + dz * dz;
            if (d <= R2) out.push([d, a]);
          }
    out.sort((p, q) => p[0] - q[0]);
    return out;
  };
  return { nearest, within };
};

function createSpaceEngine(opts) {
  const THREE = window.THREE;
  const { glCanvas, views, onCursor, onHover, onPick, onStatus } = opts;
  const CW = SPACE_CW, LW = SPACE_LW, LC = SPACE_LC, AMAX = SPACE_AMAX;
  let TPL = spaceTemplate(28, 18), NV = TPL.count;

  // ── State ────────────────────────────────────────────────────────────────
  const S = {
    anchors: [], markers: [],
    cursor: [0.65, 0.12, 0], range: { hl: null, hc: null, hh: null },
    fill: 0.5, sep: 0, opacity: 1,
    dark: false, fg: [0.1, 0.1, 0.1], bg: [1, 1, 1],
    guide: { l: "#b7791f", c: "#0e7490", h: "#be185d" },
  };
  let N = 0, px, py, pz, cols, rCell, meanR, maxR, dotR, grid = null, ready = false, buildToken = 0;
  let selIdx = -1, disposed = false, anchorSig = null, markerSig = null;

  // ── Renderer ─────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const scene = new THREE.Scene(), overlay = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -LC * LW - 0.6, 0), new THREE.Vector3(0, (1 - LC) * LW + 0.6, 0)]),
    new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.35 }),
  );
  scene.add(axis);

  const cellVert = `
    attribute vec3 aCenter; attribute vec3 aColor; attribute float aCap;
    uniform float uSep;
    varying vec3 vColor; varying float vCap; varying vec3 vViewPos;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position + aCenter * (uSep - 1.0), 1.0);
      gl_Position = projectionMatrix * mv;
      vViewPos = mv.xyz; vColor = aColor; vCap = aCap;
    }`;
  const cellFrag = `
    precision highp float;
    varying vec3 vColor; varying float vCap; varying vec3 vViewPos;
    uniform vec3 uL1, uL2; uniform float uAlpha;
    void main() {
      vec3 col;
      if (vCap > 0.5) {
        col = vColor;                       // a cut face shows the anchor's exact colour
      } else {
        vec3 N = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
        vec3 V = normalize(-vViewPos);
        float d1 = max(dot(N, uL1), 0.0), d2 = max(dot(N, uL2), 0.0);
        float sp = pow(max(dot(N, normalize(uL1 + V)), 0.0), 55.0) * 0.28;
        col = vColor * (0.34 + d1 * 0.56 + d2 * 0.2) + sp;
      }
      gl_FragColor = vec4(col, uAlpha);
    }`;
  const shared = { uSep: { value: 1 }, uL1: { value: new THREE.Vector3() }, uL2: { value: new THREE.Vector3() } };
  const cellMat = new THREE.ShaderMaterial({
    vertexShader: cellVert, fragmentShader: cellFrag,
    uniforms: { ...shared, uAlpha: { value: 1 } },
    transparent: true, depthWrite: true, side: THREE.DoubleSide, extensions: { derivatives: true },
  });
  const activeMat = new THREE.ShaderMaterial({
    vertexShader: cellVert, fragmentShader: cellFrag,
    uniforms: { ...shared, uAlpha: { value: 1 } },
    side: THREE.DoubleSide, extensions: { derivatives: true },
  });
  const rimMat = new THREE.ShaderMaterial({
    vertexShader: `attribute vec3 aCenter; uniform float uSep, uGrow;
      void main() { vec3 d = position - aCenter; float l = length(d);
        vec3 p = position + (l > 1e-5 ? d / l : vec3(0.0)) * uGrow + aCenter * (uSep - 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    uniforms: { uSep: shared.uSep, uGrow: { value: 0.045 }, uColor: { value: new THREE.Color(0, 0, 0) } },
    // Outline = a slightly grown copy painted flat first; the cell then covers
    // all but its rim. No depth use, so it works for any triangle winding.
    side: THREE.DoubleSide, depthTest: false, depthWrite: false,
  });

  // Main cells: one merged, re-sliced geometry
  const geo = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(geo, cellMat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  let capV = 0, capI = 0, bPos, bCen, bCol, bCap, bIdx;
  const ensure = (nV, nI) => {
    if (nV <= capV && nI <= capI) return;
    capV = Math.max(nV, capV, 1024) * 1.5 | 0;
    capI = Math.max(nI, capI, 1024) * 1.5 | 0;
    bPos = new Float32Array(capV * 3); bCen = new Float32Array(capV * 3); bCol = new Float32Array(capV * 3);
    bCap = new Float32Array(capV); bIdx = new Uint32Array(capI);
    const dyn = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    geo.setAttribute("position", dyn(bPos, 3));
    geo.setAttribute("aCenter", dyn(bCen, 3));
    geo.setAttribute("aColor", dyn(bCol, 3));
    geo.setAttribute("aCap", dyn(bCap, 1));
    geo.setIndex(dyn(bIdx, 1));
  };

  // Active cell: drawn after a depth clear so it is never hidden
  const activeGeo = new THREE.BufferGeometry();
  let aCapV = 0, aCapI = 0;
  const activeMesh = new THREE.Mesh(activeGeo, activeMat);
  const activeRim = new THREE.Mesh(activeGeo, rimMat);
  activeMesh.frustumCulled = activeRim.frustumCulled = false;
  activeRim.renderOrder = 1; activeMesh.renderOrder = 2;
  overlay.add(activeRim, activeMesh);

  // Cursor marker
  const marker = new THREE.Group();
  const markerMats = [];
  {
    const m1 = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.9, depthTest: false });
    const m2 = new THREE.MeshBasicMaterial({ depthTest: false });
    markerMats.push(m1, m2);
    const ring = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(0.11, 12, 8)), m1);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), m2);
    const ax = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.22, 0, 0), new THREE.Vector3(0.22, 0, 0), new THREE.Vector3(0, -0.22, 0),
      new THREE.Vector3(0, 0.22, 0), new THREE.Vector3(0, 0, -0.22), new THREE.Vector3(0, 0, 0.22)]), m1);
    marker.add(ring, dot, ax);
    marker.traverse((o) => (o.renderOrder = 999));
  }
  overlay.add(marker);

  // Plane outlines (L, C, H)
  const planes = new THREE.Group();
  const lineMat = () => new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55, depthTest: false, depthWrite: false });
  const PN = 96;
  const fixedGeo = (n) => {
    const g = new THREE.BufferGeometry(), a = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    a.setUsage(THREE.DynamicDrawUsage); g.setAttribute("position", a); return g;
  };
  const plL = new THREE.LineLoop(fixedGeo(PN), lineMat());
  const plC = new THREE.LineSegments(fixedGeo(PN * 4 + 2), lineMat());
  const plH = new THREE.LineLoop(fixedGeo(4), lineMat());
  [plL, plC, plH].forEach((o) => { o.renderOrder = 998; planes.add(o); });
  overlay.add(planes);

  // Pins and commercial colours: round dots drawn before the cells
  const dotGeo = new THREE.BufferGeometry();
  const dotMat = new THREE.ShaderMaterial({
    vertexShader: `attribute vec3 aColor; attribute float aKind; attribute float aVis;
      uniform float uSep, uSize; varying vec3 vColor; varying float vKind;
      void main() { vColor = aColor; vKind = aKind;
        vec4 mv = modelViewMatrix * vec4(position * uSep, 1.0);
        gl_Position = aVis < 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
        gl_PointSize = uSize; }`,
    fragmentShader: `precision highp float; varying vec3 vColor; varying float vKind; uniform vec3 uRing;
      void main() { vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = vKind > 0.5 ? abs(p.x) + abs(p.y) : length(p);   // pins round, commercial diamonds
        if (d > 1.0) discard;
        gl_FragColor = vec4(d > 0.62 ? uRing : vColor, 1.0); }`,
    uniforms: { uSep: shared.uSep, uSize: { value: 12 * Math.min(window.devicePixelRatio || 1, 2) }, uRing: { value: new THREE.Color(0, 0, 0) } },
  });
  const dots = new THREE.Points(dotGeo, dotMat);
  dots.frustumCulled = false;
  dots.renderOrder = -1;
  scene.add(dots);
  // A faint copy drawn over everything, so pins buried inside the solid stay findable.
  const ghostMat = dotMat.clone();
  ghostMat.uniforms = { uSep: shared.uSep, uSize: dotMat.uniforms.uSize, uRing: dotMat.uniforms.uRing };
  ghostMat.fragmentShader = dotMat.fragmentShader.replace("gl_FragColor = vec4(d > 0.62 ? uRing : vColor, 1.0);", "gl_FragColor = vec4(d > 0.62 ? uRing : vColor, 0.8);");
  ghostMat.transparent = true; ghostMat.depthTest = false; ghostMat.depthWrite = false;
  const ghostDots = new THREE.Points(dotGeo, ghostMat);
  ghostDots.frustumCulled = false;
  ghostDots.renderOrder = -1;
  overlay.add(ghostDots);

  // ── Orbit camera ─────────────────────────────────────────────────────────
  // The pivot (t) follows the cursor; a right-drag pan adds an offset (o) that
  // clears as soon as the cursor moves, so the cursor is always back in view.
  const orb = { theta: 0.75, phi: 1.12, r: 14, tx: 0, ty: 0, tz: 0, ox: 0, oy: 0, oz: 0 };
  const goal = new THREE.Vector3();
  let camSnap = true, lastFrame = 0;
  const setGoal = () => {
    goal.set(marker.position.x + orb.ox, marker.position.y + orb.oy, marker.position.z + orb.oz);
    requestRender();
  };
  const placeCamera = () => {
    const sp = Math.sin(orb.phi);
    camera.position.set(orb.tx + orb.r * sp * Math.cos(orb.theta), orb.ty + orb.r * Math.cos(orb.phi), orb.tz + orb.r * sp * Math.sin(orb.theta));
    camera.lookAt(orb.tx, orb.ty, orb.tz);
    camera.updateMatrixWorld();
    const m3 = new THREE.Matrix3().setFromMatrix4(camera.matrixWorldInverse);
    shared.uL1.value.set(8, 16, 6).normalize().applyMatrix3(m3).normalize();
    shared.uL2.value.set(-6, -3, -5).normalize().applyMatrix3(m3).normalize();
  };
  const applyOrbit = () => {
    orb.phi = Math.max(0.12, Math.min(Math.PI - 0.12, orb.phi));
    requestRender();
  };

  // ── Render scheduling (only when something changed) ──────────────────────
  let rafId = 0;
  const frame = () => {
    rafId = 0;
    if (disposed) return;
    // Ease the pivot toward the cursor (snaps on first draw).
    const dx = goal.x - orb.tx, dy = goal.y - orb.ty, dz = goal.z - orb.tz;
    const now = performance.now(), dt = Math.min(200, now - (lastFrame || now));
    lastFrame = now;
    const far = dx * dx + dy * dy + dz * dz > 1e-8;
    const k = camSnap ? 1 : 1 - Math.exp(-dt / 80);   // time-based, so slow machines settle as fast
    orb.tx += dx * k; orb.ty += dy * k; orb.tz += dz * k;
    camSnap = false;
    placeCamera();
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(overlay, camera);
    if (far) requestRender(); else lastFrame = 0;
  };
  function requestRender() { if (!rafId && !disposed) rafId = requestAnimationFrame(frame); }

  const resize = () => {
    const el = glCanvas.parentElement;
    const w = Math.max(10, el.clientWidth), h = Math.max(10, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  };

  // ── Cells ────────────────────────────────────────────────────────────────
  const inflR = (i, r) => (r > dotR[i] ? dotR[i] + (r - dotR[i]) * S.fill : dotR[i]);
  const buildCells = () => {
    const token = ++buildToken;
    ready = false;
    const list = S.anchors;
    N = list.length;
    px = new Float32Array(N); py = new Float32Array(N); pz = new Float32Array(N); cols = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = list[i], w = spaceToWorld(a.L, a.C, a.H);
      px[i] = w[0]; py[i] = w[1]; pz[i] = w[2];
      const c = spaceHexToRgb(a.hex);
      cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2];
    }
    grid = spaceMakeGrid(px, py, pz, N);
    TPL = N > 1800 ? spaceTemplate(14, 9) : N > 700 ? spaceTemplate(20, 12) : spaceTemplate(28, 18);
    NV = TPL.count;
    rCell = new Float32Array(N * NV); meanR = new Float32Array(N); maxR = new Float32Array(N); dotR = new Float32Array(N);
    selIdx = -1;
    if (!N) { ready = true; onStatus({ phase: "empty" }); rebuild(); rebuildActive(); return; }
    const D = TPL.dirs;
    let i = 0;
    const step = () => {
      if (token !== buildToken || disposed) return;
      const t0 = performance.now();
      for (; i < N && performance.now() - t0 < 14; i++) {
        const X = px[i], Y = py[i], Z = pz[i];
        let near = grid.within(X, Y, Z, 1.2, i);
        dotR[i] = Math.max(0.035, Math.min(0.1, (near.length ? Math.sqrt(near[0][0]) : 1) * 0.45));
        const radii = rCell.subarray(i * NV, (i + 1) * NV);
        // Distance to the nearest bisector plane along direction v, starting from cap r0
        const voronoi = (v, cand, r0) => {
          const dx = D[v * 3], dy = D[v * 3 + 1], dz = D[v * 3 + 2];
          let r = r0;
          for (const [d2, j] of cand) {
            if (Math.sqrt(d2) * 0.5 >= r) break; // nobody further away can cut closer
            const den = (px[j] - X) * dx + (py[j] - Y) * dy + (pz[j] - Z) * dz;
            if (den > 1e-6) { const rv = d2 / (2 * den); if (rv < r) r = rv; }
          }
          return r;
        };
        // Pull r back inside the sRGB gamut (the gamut is star-shaped from inside)
        const gamut = (v, r) => {
          const dx = D[v * 3], dy = D[v * 3 + 1], dz = D[v * 3 + 2];
          if (spaceInGamut(X + dx * r, Y + dy * r, Z + dz * r)) return r;
          let lo = 0, hi = r;
          for (let k = 0; k < 15; k++) { const m = (lo + hi) / 2; if (spaceInGamut(X + dx * m, Y + dy * m, Z + dz * m)) lo = m; else hi = m; }
          return lo;
        };
        let need = 0;
        for (let v = 0; v < NV; v++) {
          let r = voronoi(v, near, 8);
          if (r > 0.6) { r = gamut(v, r); if (r > 0.6) need = Math.max(need, r); }
          radii[v] = r;
        }
        if (need) { // a few directions reach past the first search radius: widen it for those
          near = grid.within(X, Y, Z, 2 * need + 0.01, i);
          for (let v = 0; v < NV; v++) if (radii[v] > 0.6) radii[v] = voronoi(v, near, radii[v]);
        }
        let sum = 0, mx = 0;
        for (let v = 0; v < NV; v++) {
          const r = Math.max(gamut(v, radii[v]), 0.002);
          radii[v] = r; sum += r; if (r > mx) mx = r;
        }
        meanR[i] = sum / NV; maxR[i] = mx;
      }
      if (i < N) { onStatus({ phase: "building", progress: i / N }); setTimeout(step, 0); return; }
      ready = true;
      onStatus({ phase: "ready" });
      updateCursor();
      rebuild();
      rebuildActive();
    };
    onStatus({ phase: "building", progress: 0 });
    setTimeout(step, 0);
  };

  const constraints = () => {
    const cons = [], [lc, cc, hc] = S.cursor, { hl, hc: dc, hh } = S.range;
    if (hl !== null) {
      const lo = (lc - hl - LC) * LW, hi = (lc + hl - LC) * LW;
      cons.push((x, y) => lo - y, (x, y) => y - hi);
    }
    if (dc !== null) {
      const outer = (cc + dc) * CW, inner = (cc - dc) * CW;
      cons.push((x, y, z) => Math.hypot(x, z) - outer);
      if (inner > 0) cons.push((x, y, z) => inner - Math.hypot(x, z));
    }
    if (hh !== null) {
      // Hue direction θ points along (sin θ, −cos θ) in x/z
      if (hh < 90) {
        const t1 = ((hc - hh) * Math.PI) / 180, t2 = ((hc + hh) * Math.PI) / 180;
        cons.push((x, y, z) => -(Math.cos(t1) * x + Math.sin(t1) * z));
        cons.push((x, y, z) => Math.cos(t2) * x + Math.sin(t2) * z);
      } else {
        const t = (hc * Math.PI) / 180, ux = Math.sin(t), uz = -Math.cos(t), k = Math.cos((hh * Math.PI) / 180);
        cons.push((x, y, z) => k * Math.hypot(x, z) - (ux * x + uz * z));
      }
    }
    return cons;
  };
  const inRangeLCH = (L, C, H) => {
    const [lc, cc, hc] = S.cursor, { hl, hc: dc, hh } = S.range;
    return (hl === null || Math.abs(L - lc) <= hl) && (dc === null || Math.abs(C - cc) <= dc) &&
      (hh === null || C < 0.004 || spaceHueDist(H, hc) <= hh);
  };

  // A cell after inflation and slicing: null (sliced away), "whole" (untouched
  // template, written straight into the buffers) or a clipped mesh.
  // Every section function is at most 2-Lipschitz, so a cell whose bounding
  // sphere sits clearly on one side of a cut is decided without clipping.
  const cellMesh = (i, cons) => {
    const X = px[i], Y = py[i], Z = pz[i], R = inflR(i, maxR[i]) * 2 + 1e-4;
    const active = [];
    for (const f of cons) {
      const fc = f(X, Y, Z);
      if (fc > R) return null;
      if (fc >= -R) active.push(f);
    }
    if (!active.length) return "whole";
    const P = new Array(NV * 3), D = TPL.dirs;
    for (let v = 0; v < NV; v++) {
      const r = inflR(i, rCell[i * NV + v]);
      P[v * 3] = X + D[v * 3] * r; P[v * 3 + 1] = Y + D[v * 3 + 1] * r; P[v * 3 + 2] = Z + D[v * 3 + 2] * r;
    }
    let m = { P, K: new Array(NV).fill(0), T: TPL.tris };
    for (const f of active) { m = spaceClipMesh(m, f); if (!m) return null; }
    return m;
  };
  const wholeMesh = (i) => {
    const P = new Float32Array(NV * 3), D = TPL.dirs, X = px[i], Y = py[i], Z = pz[i];
    for (let v = 0; v < NV; v++) {
      const r = inflR(i, rCell[i * NV + v]);
      P[v * 3] = X + D[v * 3] * r; P[v * 3 + 1] = Y + D[v * 3 + 1] * r; P[v * 3 + 2] = Z + D[v * 3 + 2] * r;
    }
    return { P, K: new Float32Array(NV), T: TPL.tris };
  };

  // Every cell, sliced, in one buffer. The active cell is also in here; the
  // overlay draws it again on top.
  function rebuild() {
    if (!ready) return;
    const parts = [], cons = constraints();
    let nV = 0, nI = 0;
    const tl = TPL.tris.length;
    for (let i = 0; i < N; i++) {
      const m = cellMesh(i, cons);
      if (!m) continue;
      parts.push([i, m]);
      if (m === "whole") { nV += NV; nI += tl; } else { nV += m.K.length; nI += m.T.length; }
    }
    ensure(nV, nI);
    let vo = 0, io = 0;
    const D = TPL.dirs, T = TPL.tris;
    for (const [i, m] of parts) {
      const r = cols[i * 3], g = cols[i * 3 + 1], b = cols[i * 3 + 2], X = px[i], Y = py[i], Z = pz[i];
      if (m === "whole") {
        for (let v = 0; v < NV; v++) {
          const o = (vo + v) * 3, rr = inflR(i, rCell[i * NV + v]);
          bPos[o] = X + D[v * 3] * rr; bPos[o + 1] = Y + D[v * 3 + 1] * rr; bPos[o + 2] = Z + D[v * 3 + 2] * rr;
          bCen[o] = X; bCen[o + 1] = Y; bCen[o + 2] = Z;
          bCol[o] = r; bCol[o + 1] = g; bCol[o + 2] = b;
          bCap[vo + v] = 0;
        }
        for (let q = 0; q < tl; q++) bIdx[io + q] = T[q] + vo;
        vo += NV; io += tl;
        continue;
      }
      const nv = m.K.length;
      for (let v = 0; v < nv; v++) {
        const o = (vo + v) * 3;
        bPos[o] = m.P[v * 3]; bPos[o + 1] = m.P[v * 3 + 1]; bPos[o + 2] = m.P[v * 3 + 2];
        bCen[o] = X; bCen[o + 1] = Y; bCen[o + 2] = Z;
        bCol[o] = r; bCol[o + 1] = g; bCol[o + 2] = b;
        bCap[vo + v] = m.K[v];
      }
      for (let q = 0; q < m.T.length; q++) bIdx[io + q] = m.T[q] + vo;
      vo += nv; io += m.T.length;
    }
    ["position", "aCenter", "aColor", "aCap"].forEach((k) => {
      const a = geo.attributes[k];
      a.updateRange = { offset: 0, count: vo * a.itemSize };   // upload only what changed
      a.needsUpdate = true;
    });
    geo.index.updateRange = { offset: 0, count: io };
    geo.index.needsUpdate = true;
    geo.setDrawRange(0, io);
    updateDotVisibility();
    requestRender();
    scheduleSections();
  }
  // Just the highlighted cell (cheap: runs on every cursor move).
  function rebuildActive() {
    let m = ready && selIdx >= 0 ? cellMesh(selIdx, constraints()) : null;
    if (m === "whole") m = wholeMesh(selIdx);
    activeMesh.visible = activeRim.visible = !!m;
    if (m) {
      const nv = m.K.length, ni = m.T.length;
      if (nv > aCapV || ni > aCapI) {
        if (activeGeo.attributes.position) activeGeo.dispose();   // frees the old GPU buffers
        aCapV = Math.max(nv, aCapV) * 1.5 | 0; aCapI = Math.max(ni, aCapI) * 1.5 | 0;
        const dyn = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
        activeGeo.setAttribute("position", dyn(new Float32Array(aCapV * 3), 3));
        activeGeo.setAttribute("aCenter", dyn(new Float32Array(aCapV * 3), 3));
        activeGeo.setAttribute("aColor", dyn(new Float32Array(aCapV * 3), 3));
        activeGeo.setAttribute("aCap", dyn(new Float32Array(aCapV), 1));
        activeGeo.setIndex(dyn(new Uint32Array(aCapI), 1));
      }
      const A = activeGeo.attributes, pos = A.position.array, cen = A.aCenter.array, col = A.aColor.array, cap = A.aCap.array, idx = activeGeo.index.array;
      const X = px[selIdx], Y = py[selIdx], Z = pz[selIdx], r = cols[selIdx * 3], g = cols[selIdx * 3 + 1], b = cols[selIdx * 3 + 2];
      for (let v = 0; v < nv; v++) {
        pos[v * 3] = m.P[v * 3]; pos[v * 3 + 1] = m.P[v * 3 + 1]; pos[v * 3 + 2] = m.P[v * 3 + 2];
        cen[v * 3] = X; cen[v * 3 + 1] = Y; cen[v * 3 + 2] = Z;
        col[v * 3] = r; col[v * 3 + 1] = g; col[v * 3 + 2] = b;
        cap[v] = m.K[v];
      }
      for (let q = 0; q < ni; q++) idx[q] = m.T[q];
      ["position", "aCenter", "aColor", "aCap"].forEach((k) => { A[k].updateRange = { offset: 0, count: nv * A[k].itemSize }; A[k].needsUpdate = true; });
      activeGeo.index.updateRange = { offset: 0, count: ni };
      activeGeo.index.needsUpdate = true;
      activeGeo.setDrawRange(0, ni);
    }
    requestRender();
  }

  // ── Cursor ───────────────────────────────────────────────────────────────
  const cursorWorld = new THREE.Vector3();
  function updateCursor() {
    const [L, C, H] = S.cursor, w = spaceToWorld(L, C, H);
    cursorWorld.set(w[0], w[1], w[2]);
    const prev = selIdx;
    selIdx = ready && N ? grid.nearest(w[0], w[1], w[2]) : -1;
    orb.ox = orb.oy = orb.oz = 0;
    placeMarker();
    updatePlanes();
    return prev !== selIdx;
  }
  const placeMarker = () => {
    const k = S.sep, c = selIdx >= 0 ? [px[selIdx], py[selIdx], pz[selIdx]] : [0, 0, 0];
    marker.position.set(cursorWorld.x + c[0] * k, cursorWorld.y + c[1] * k, cursorWorld.z + c[2] * k);
    marker.scale.setScalar(orb.r / 14);
    setGoal();
  };
  const updatePlanes = () => {
    const [L, C, H] = S.cursor, R = AMAX * CW, y = (L - LC) * LW, y0 = -LC * LW, y1 = (1 - LC) * LW, n = PN;
    const hr = (H * Math.PI) / 180, sx = Math.sin(hr), cz = -Math.cos(hr);
    const put = (obj, arr) => { const a = obj.geometry.attributes.position; a.array.set(arr); a.needsUpdate = true; };
    const ring = (r, yy) => { const a = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; a.push(r * Math.sin(t), yy, -r * Math.cos(t)); } return a; };
    put(plL, ring(R, y));
    const rc = Math.max(C * CW, 0.001), segs = [];
    for (const yy of [y0, y1]) { const r = ring(rc, yy); for (let i = 0; i < n; i++) { const j = (i + 1) % n; segs.push(r[i * 3], r[i * 3 + 1], r[i * 3 + 2], r[j * 3], r[j * 3 + 1], r[j * 3 + 2]); } }
    segs.push(rc * sx, y0, rc * cz, rc * sx, y1, rc * cz);
    put(plC, segs);
    plC.visible = C > 0.002;
    put(plH, [0, y0, 0, R * sx, y0, R * cz, R * sx, y1, R * cz, 0, y1, 0]);
    planes.scale.setScalar(1 + S.sep);
    requestRender();
  };

  // ── Markers (pins, commercial) ───────────────────────────────────────────
  let mVis = null, markerPos = null, mVisAll = false;
  const setMarkerGeometry = () => {
    const M = S.markers, n = M.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), kind = new Float32Array(n);
    markerPos = pos;
    if (dotGeo.attributes.position) dotGeo.dispose();   // release the previous GPU buffers
    mVis = new Float32Array(n).fill(1); mVisAll = false;
    M.forEach((m, i) => {
      const w = spaceToWorld(m.L, m.C, m.H), c = spaceHexToRgb(m.hex);
      pos.set(w, i * 3); col.set(c, i * 3); kind[i] = m.kind === "brand" ? 1 : 0;
    });
    dotGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dotGeo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    dotGeo.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    dotGeo.setAttribute("aVis", new THREE.BufferAttribute(mVis, 1));
    updateDotVisibility();
  };
  function updateDotVisibility() {
    if (!mVis) return;
    const M = S.markers, { hl, hc, hh } = S.range;
    if (hl === null && hc === null && hh === null) { if (mVisAll) return; mVis.fill(1); mVisAll = true; }
    else { mVisAll = false; for (let i = 0; i < M.length; i++) mVis[i] = inRangeLCH(M[i].L, M[i].C, M[i].H) ? 1 : 0; }
    dotGeo.attributes.aVis.needsUpdate = true;
    requestRender();
  }

  // ── Picking ──────────────────────────────────────────────────────────────
  const rayDir = new THREE.Vector3(), projM = new THREE.Matrix4();
  const pick3D = (clientX, clientY) => {
    const rc = glCanvas.getBoundingClientRect();
    const nx = ((clientX - rc.left) / rc.width) * 2 - 1, ny = -((clientY - rc.top) / rc.height) * 2 + 1;
    // markers first: nearest projected dot within 7px
    let best = null, bd = 49;
    const k = 1 + S.sep;
    if (mVis && markerPos) {
      projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const e = projM.elements, hw = rc.width / 2, hh = rc.height / 2;
      for (let i = 0, n = S.markers.length; i < n; i++) {
        if (!mVis[i]) continue;
        const x = markerPos[i * 3] * k, y = markerPos[i * 3 + 1] * k, z = markerPos[i * 3 + 2] * k;
        const w = e[3] * x + e[7] * y + e[11] * z + e[15];
        if (w <= 0) continue;
        const sz = (e[2] * x + e[6] * y + e[10] * z + e[14]) / w;
        if (sz > 1) continue;
        const dx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w - nx) * hw, dy = ((e[1] * x + e[5] * y + e[9] * z + e[13]) / w - ny) * hh;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = S.markers[i]; }
      }
    }
    if (best) return best;
    if (!ready || !N) return null;
    const ro = camera.position;
    rayDir.set(nx, ny, 0.5).unproject(camera).sub(ro).normalize();
    let bt = 1e9, bi = -1;
    const kk = S.sep;
    for (let i = 0; i < N; i++) {
      const a = S.anchors[i];
      if (i !== selIdx && !inRangeLCH(a.L, a.C, a.H)) continue;
      const r = inflR(i, meanR[i]);
      const cx = px[i] * (1 + kk) - ro.x, cy = py[i] * (1 + kk) - ro.y, cz = pz[i] * (1 + kk) - ro.z;
      const b = cx * rayDir.x + cy * rayDir.y + cz * rayDir.z, disc = b * b - (cx * cx + cy * cy + cz * cz - r * r);
      if (disc < 0) continue;
      const t = b - Math.sqrt(disc);
      if (t > 0 && t < bt) { bt = t; bi = i; }
    }
    return bi >= 0 ? S.anchors[bi] : null;
  };

  // ── 3D pointer controls ──────────────────────────────────────────────────
  const listeners = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); listeners.push([el, ev, fn, o]); };
  {
    const ptrs = new Map();
    let mode = null, lx = 0, ly = 0, pinch = null, down = null;
    const pan = (dx, dy) => {
      const s = orb.r * 0.0016, right = new THREE.Vector3(), up = new THREE.Vector3();
      camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
      orb.ox -= (right.x * dx - up.x * dy) * s; orb.oy -= (right.y * dx - up.y * dy) * s; orb.oz -= (right.z * dx - up.z * dy) * s;
      setGoal(); camSnap = true;
    };
    on(glCanvas, "contextmenu", (e) => e.preventDefault());
    on(glCanvas, "pointerdown", (e) => {
      glCanvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      onHover(null);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
        mode = "pinch"; down = null; return;
      }
      mode = e.button === 1 || e.button === 2 || e.shiftKey ? "pan" : "rotate";
      lx = e.clientX; ly = e.clientY;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    on(glCanvas, "pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) {
        if (e.pointerType === "mouse") {
          const hit = pick3D(e.clientX, e.clientY);
          onHover(hit ? { item: hit, x: e.clientX, y: e.clientY } : null);
        }
        return;
      }
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (mode === "pinch" && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        orb.r = Math.max(3, Math.min(40, orb.r * (pinch.d / d)));
        pan(m[0] - pinch.m[0], m[1] - pinch.m[1]);
        pinch = { d, m }; placeMarker(); applyOrbit(); return;
      }
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (mode === "pan") pan(dx, dy);
      else if (mode === "rotate") { orb.theta += dx * 0.006; orb.phi -= dy * 0.006; }
      applyOrbit();
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && performance.now() - down.t < 400) {
        const hit = pick3D(e.clientX, e.clientY);
        if (hit) onPick(hit);
      }
      down = null;
      if (!ptrs.size) mode = null;
    };
    on(glCanvas, "pointerup", up);
    on(glCanvas, "pointercancel", up);
    on(glCanvas, "pointerleave", () => onHover(null));
    on(glCanvas, "wheel", (e) => {
      e.preventDefault();
      orb.r = Math.max(3, Math.min(40, orb.r * Math.exp(e.deltaY * 0.0012)));
      placeMarker(); applyOrbit();
    }, { passive: false });
  }

  // ── 2D sections ──────────────────────────────────────────────────────────
  const SV = {
    l: { cv: views.l, def: { x0: -AMAX, x1: AMAX, y0: -AMAX, y1: AMAX }, iso: true },
    c: { cv: views.c, def: { x0: -Math.PI * AMAX, x1: Math.PI * AMAX, y0: -0.05, y1: LW / CW + 0.05 }, iso: true },
    // H section at true proportions (chroma across, lightness up, same scale as 3D)
    h: { cv: views.h, def: { x0: -0.02, x1: AMAX + 0.02, y0: -0.03, y1: LW / CW + 0.03 }, iso: true },
  };
  // Show the whole default box, whatever the panel's shape.
  const fitContain = (v) => {
    const d = v.def, W = v.cv.width, H = v.cv.height;
    const s = Math.max((d.x1 - d.x0) / W, (d.y1 - d.y0) / H), cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
    v.dom = { x0: cx - (s * W) / 2, x1: cx + (s * W) / 2, y0: cy - (s * H) / 2, y1: cy + (s * H) / 2 };
    v.user = false;
  };
  const fitIso = (v) => {
    if (!v.iso) return;
    if (!v.user) { fitContain(v); return; }
    const d = v.dom, sx = (d.x1 - d.x0) / v.cv.width, cy = (d.y0 + d.y1) / 2;
    d.y0 = cy - (sx * v.cv.height) / 2; d.y1 = cy + (sx * v.cv.height) / 2;
  };
  const sizeView = (v) => {
    const W = Math.max(40, Math.round(v.cv.clientWidth)), H = Math.max(40, Math.round(v.cv.clientHeight));
    if (v.cv.width === W && v.cv.height === H && v.img) return false;
    v.cv.width = W; v.cv.height = H;
    v.ctx = v.cv.getContext("2d");
    v.img = v.ctx.createImageData(W, H);
    v.ids = new Int32Array(W * H); v.dim = new Float32Array(W * H);
    if (!v.dom) v.user = false;
    fitIso(v);
    return true;
  };
  Object.values(SV).forEach(sizeView);
  const px2u = (v, x) => v.dom.x0 + (x / v.cv.width) * (v.dom.x1 - v.dom.x0);
  const py2v = (v, y) => v.dom.y1 - (y / v.cv.height) * (v.dom.y1 - v.dom.y0);
  const u2px = (v, u) => ((u - v.dom.x0) / (v.dom.x1 - v.dom.x0)) * v.cv.width;
  const v2py = (v, w) => ((v.dom.y1 - w) / (v.dom.y1 - v.dom.y0)) * v.cv.height;

  const cursorInView = (k) => {
    const [L, C, H] = S.cursor, hr = (H * Math.PI) / 180;
    if (k === "l") return [C * Math.sin(hr), C * Math.cos(hr)];
    if (k === "c") return [((H - 180) * Math.PI / 180) * C, (L * LW) / CW];
    return [C, (L * LW) / CW];
  };
  // Pan a section just enough to keep the cursor inside it (with a margin).
  let dragView = null;
  const followCursor = (k) => {
    const v = SV[k];
    if (!v.dom || k === dragView) return false;
    const [u, w] = cursorInView(k), d = v.dom;
    const mx = (d.x1 - d.x0) * 0.06, my = (d.y1 - d.y0) * 0.06;
    let sx = 0, sy = 0;
    if (u < d.x0 + mx) sx = u - (d.x0 + mx); else if (u > d.x1 - mx) sx = u - (d.x1 - mx);
    if (w < d.y0 + my) sy = w - (d.y0 + my); else if (w > d.y1 - my) sy = w - (d.y1 - my);
    if (!sx && !sy) return false;
    d.x0 += sx; d.x1 += sx; d.y0 += sy; d.y1 += sy;
    v.user = true;
    return true;
  };
  const followAll = () => ["l", "c", "h"].forEach(followCursor);

  // Which cell (if any) covers a world point at the current inflation.
  const cellAt = (x, y, z) => {
    if (!ready || !N) return -1;
    const i = grid.nearest(x, y, z);
    if (S.fill >= 0.999) return spaceInGamut(x, y, z) ? i : -1;
    const dx = x - px[i], dy = y - py[i], dz = z - pz[i], dist = Math.sqrt(dx * dx + dy * dy + dz * dz), r0 = dotR[i];
    if (dist <= r0) return i;
    if (S.fill < 0.001) return -1;
    const k = (r0 + (dist - r0) / S.fill) / dist;
    const qx = px[i] + dx * k, qy = py[i] + dy * k, qz = pz[i] + dz * k;
    if (!spaceInGamut(qx, qy, qz)) return -1;
    return grid.nearest(qx, qy, qz) === i ? i : -1;
  };
  const mapping = {
    // L section: a → right, b → up, at the cursor's lightness
    l: (u, w, out) => { out[0] = u * CW; out[1] = (S.cursor[0] - LC) * LW; out[2] = -w * CW; return true; },
    // C section: the cylinder at the cursor's chroma, unrolled at true size (seam at 0°/360°)
    c: (s, w, out) => {
      const C = S.cursor[1], L = (w * CW) / LW;
      if (L < 0 || L > 1 || C < 0.002 || Math.abs(s) > Math.PI * C) return false;
      const p = spaceToWorld(L, C, 180 + ((s / C) * 180) / Math.PI);
      out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; return true;
    },
    // H section: chroma → right, lightness → up, at the cursor's hue
    h: (c, w, out) => {
      const L = (w * CW) / LW;
      if (c < 0 || L < 0 || L > 1) return false;
      const p = spaceToWorld(L, c, S.cursor[2]);
      out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; return true;
    },
  };
  const toByte = (c) => Math.round(Math.max(0, Math.min(1, c)) * 255);
  // Classify pixels of rows [y0, y1) at the given block size.
  const sampleRows = (k, step, y0, y1) => {
    const v = SV[k], W = v.cv.width, H = v.cv.height, ids = v.ids, dim = v.dim, P = [0, 0, 0];
    for (let y = y0; y < y1; y += step)
      for (let x = 0; x < W; x += step) {
        let id = -1, dm = 0;
        if (S.fill >= 0.001 && mapping[k](px2u(v, x + step / 2), py2v(v, y + step / 2), P)) {
          id = cellAt(P[0], P[1], P[2]);
          if (id >= 0) { const [L, C, Hh] = spaceWorldToLCH(P[0], P[1], P[2]); dm = inRangeLCH(L, C, Hh) ? 1 : 0; }
        }
        for (let yy = y; yy < Math.min(y + step, H); yy++)
          for (let xx = x; xx < Math.min(x + step, W); xx++) { ids[yy * W + xx] = id; dim[yy * W + xx] = dm; }
      }
  };
  // Turn classified pixels into colours, then draw the plane guides on top.
  const present = (k) => {
    const v = SV[k], W = v.cv.width, H = v.cv.height, d = v.img.data, ids = v.ids, dim = v.dim;
    const bg = S.bg, empty = S.dark ? [bg[0] * 0.75, bg[1] * 0.75, bg[2] * 0.75] : [bg[0] * 0.94, bg[1] * 0.94, bg[2] * 0.94];
    for (let i = 0, n = W * H; i < n; i++) {
      const id = ids[i], o = i * 4;
      d[o + 3] = 255;
      if (id < 0) { d[o] = toByte(empty[0]); d[o + 1] = toByte(empty[1]); d[o + 2] = toByte(empty[2]); continue; }
      const x = i % W, edge = (x > 0 && ids[i - 1] !== id) || (i >= W && ids[i - W] !== id);
      let r = cols[id * 3], g = cols[id * 3 + 1], b = cols[id * 3 + 2];
      if (!dim[i]) { r = r * 0.3 + empty[0] * 0.7; g = g * 0.3 + empty[1] * 0.7; b = b * 0.3 + empty[2] * 0.7; }
      if (edge) { const e = S.dark ? 0.55 : 0.7; r *= e; g *= e; b *= e; }
      d[o] = toByte(r); d[o + 1] = toByte(g); d[o + 2] = toByte(b);
    }
    v.ctx.putImageData(v.img, 0, 0);
    drawGuides(k);
  };
  const paint = (k, step) => { sampleRows(k, step, 0, SV[k].cv.height); present(k); };
  const fgCss = () => `rgb(${toByte(S.fg[0])},${toByte(S.fg[1])},${toByte(S.fg[2])})`;
  const line = (ctx, col, pts, dash) => {
    ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.25;
    if (dash) ctx.setLineDash([4, 3]);
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
  };
  const dot = (ctx, x, y, fill, r = 4.5) => {
    ctx.save(); ctx.fillStyle = fill; ctx.strokeStyle = S.dark ? "#000" : "#fff"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  };
  // Pins: outlined circles; commercial colours: diamonds. Halo keeps them off the cells.
  const markerShape = (ctx, x, y, fill, diamond) => {
    const r = 4;
    const path = () => {
      ctx.beginPath();
      if (diamond) { ctx.moveTo(x, y - r - 1); ctx.lineTo(x + r + 1, y); ctx.lineTo(x, y + r + 1); ctx.lineTo(x - r - 1, y); ctx.closePath(); }
      else ctx.arc(x, y, r, 0, Math.PI * 2);
    };
    ctx.save();
    path(); ctx.lineWidth = 4; ctx.strokeStyle = S.dark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.9)"; ctx.stroke();
    path(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = fgCss(); ctx.stroke();
    ctx.restore();
  };
  // At zero inflation every anchor whose dot touches the section plane is drawn
  // as a small round dot (screen-sized, so it reads the same in every view).
  const drawDots = (k) => {
    const v = SV[k], ctx = v.ctx, [L, C, Hh] = S.cursor, out = [];
    v.dots = out;
    if (S.fill >= 0.001 || !ready) return;
    const hr = (Hh * Math.PI) / 180, sh = Math.sin(hr), ch = Math.cos(hr), yPl = (L - LC) * LW;
    for (let i = 0; i < N; i++) {
      const X = px[i], Y = py[i], Z = pz[i], r = dotR[i];
      let u, w;
      if (k === "l") {
        if (Math.abs(Y - yPl) > r) continue;
        u = X / CW; w = -Z / CW;
      } else if (k === "c") {
        if (C < 0.002 || Math.abs(Math.hypot(X, Z) - C * CW) > r) continue;
        const lch = spaceWorldToLCH(X, Y, Z);
        u = ((lch[2] - 180) * Math.PI / 180) * C; w = (lch[0] * LW) / CW;
      } else {
        const along = X * sh - Z * ch, perp = X * ch + Z * sh;
        if (Math.abs(perp) > r || along < -r) continue;
        u = Math.max(0, along) / CW; w = ((Y / LW + LC) * LW) / CW;
      }
      const x = u2px(v, u), y = v2py(v, w);
      if (x < -6 || y < -6 || x > v.cv.width + 6 || y > v.cv.height + 6) continue;
      out.push([x, y, i]);
    }
    const empty = S.dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)";
    for (const [x, y, i] of out) {
      const lch = spaceWorldToLCH(px[i], py[i], pz[i]), on = inRangeLCH(lch[0], lch[1], lch[2]);
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.35;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${toByte(cols[i * 3])},${toByte(cols[i * 3 + 1])},${toByte(cols[i * 3 + 2])})`;
      ctx.fill();
      ctx.lineWidth = i === selIdx ? 2 : 1.25;
      ctx.strokeStyle = i === selIdx ? fgCss() : empty;
      ctx.stroke();
      ctx.restore();
    }
  };
  const dotAt = (k, x, y) => {
    let best = -1, bd = 49;
    for (const [dx, dy, i] of SV[k].dots || []) { const d = (dx - x) ** 2 + (dy - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const drawGuides = (k) => {
    const v = SV[k], ctx = v.ctx, W = v.cv.width, H = v.cv.height, [L, C, Hh] = S.cursor, G = S.guide;
    const hr = (Hh * Math.PI) / 180, TOL = 0.012;
    drawDots(k);
    // markers lying on this section
    S.markers.forEach((m, i) => {
      if (!mVis || !mVis[i]) return;
      let u, w;
      if (k === "l") { if (Math.abs(m.L - L) > TOL) return; const h = (m.H * Math.PI) / 180; u = m.C * Math.sin(h); w = m.C * Math.cos(h); }
      else if (k === "c") { if (Math.abs(m.C - C) > TOL || C < 0.002) return; u = ((m.H - 180) * Math.PI / 180) * C; w = (m.L * LW) / CW; }
      else { const dh = ((m.H - Hh) * Math.PI) / 180; if (Math.abs(m.C * Math.sin(dh)) > TOL || Math.cos(dh) < 0) return; u = m.C * Math.cos(dh); w = (m.L * LW) / CW; }
      markerShape(ctx, u2px(v, u), v2py(v, w), m.hex, m.kind === "brand");
    });
    if (k === "l") {
      const ox = u2px(v, 0), oy = v2py(v, 0), sc = W / (v.dom.x1 - v.dom.x0);
      ctx.save(); ctx.strokeStyle = G.l; ctx.globalAlpha = 0.7; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(ox, oy, AMAX * sc, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      if (C > 0.002) { ctx.save(); ctx.strokeStyle = G.c; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.arc(ox, oy, C * sc, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      line(ctx, G.h, [[ox, oy], [u2px(v, AMAX * Math.sin(hr)), v2py(v, AMAX * Math.cos(hr))]]);
      dot(ctx, u2px(v, C * Math.sin(hr)), v2py(v, C * Math.cos(hr)), fgCss());
    } else if (k === "c") {
      const half = Math.PI * C, xl = u2px(v, -half), xr = u2px(v, half), yt = v2py(v, LW / CW), yb = v2py(v, 0);
      const X = u2px(v, ((Hh - 180) * Math.PI / 180) * C), Y = v2py(v, (L * LW) / CW);
      line(ctx, G.c, [[xl, yb], [xr, yb], [xr, yt], [xl, yt], [xl, yb]], true);
      line(ctx, G.l, [[xl, Y], [xr, Y]]);
      line(ctx, G.h, [[X, yt], [X, yb]]);
      dot(ctx, X, Y, fgCss());
    } else {
      const X = u2px(v, C), Y = v2py(v, (L * LW) / CW), x0 = u2px(v, 0), x1 = u2px(v, AMAX), y0 = v2py(v, 0), y1 = v2py(v, LW / CW);
      line(ctx, G.h, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], true);
      line(ctx, G.l, [[0, Y], [W, Y]]);
      line(ctx, G.c, [[X, 0], [X, H]]);
      dot(ctx, X, Y, fgCss());
    }
  };
  // Sections redraw in two passes: a coarse one right away (cheap enough to
  // follow a drag), then a sharp one built a few rows per frame once input
  // pauses, so the page never stalls on it.
  let secTimer = 0, secRaf = 0, sharpJob = 0;
  function scheduleSections() {
    if (disposed) return;
    sharpJob++;
    if (!secRaf) secRaf = requestAnimationFrame(() => {
      secRaf = 0;
      let pxs = 0; Object.values(SV).forEach((v) => (pxs += v.cv.width * v.cv.height));
      const step = Math.max(3, Math.ceil(Math.sqrt(pxs / 18000)));
      ["l", "c", "h"].forEach((k) => paint(k, step));
      clearTimeout(secTimer);
      secTimer = setTimeout(sharpPass, 180);
    });
  }
  function sharpPass() {
    const job = ++sharpJob, keys = ["l", "c", "h"];
    let ki = 0, y = 0;
    const slice = () => {
      if (disposed || job !== sharpJob) return;
      const t0 = performance.now();
      while (ki < keys.length && performance.now() - t0 < 10) {
        const k = keys[ki], H = SV[k].cv.height, y1 = Math.min(H, y + 8);
        sampleRows(k, 1, y, y1);
        y = y1;
        if (y >= H) { present(k); ki++; y = 0; }
      }
      if (ki < keys.length) requestAnimationFrame(slice);
    };
    requestAnimationFrame(slice);
  }
  // Section interaction: drag = move cursor, wheel/pinch = zoom, right-drag/2 fingers = pan
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const setFromView = {
    l: (u, w) => { const C = clamp(Math.hypot(u, w), 0, 0.4); let H = (Math.atan2(u, w) * 180) / Math.PI; if (H < 0) H += 360; return [S.cursor[0], C, C < 1e-4 ? S.cursor[2] : H]; },
    c: (s, w) => { const C = S.cursor[1]; const H = C > 0.002 ? clamp(180 + ((s / C) * 180) / Math.PI, 0, 360) : S.cursor[2]; return [clamp((w * CW) / LW, 0, 1), C, H]; },
    h: (c, w) => [clamp((w * CW) / LW, 0, 1), clamp(c, 0, 0.4), S.cursor[2]],
  };
  // Rounded to the sidebar sliders' own steps so the app shows tidy values.
  const moveCursor = (lch) => {
    const L = Math.round(lch[0] * 1000) / 1000, C = Math.round(lch[1] * 1000) / 1000, H = Math.round(lch[2] * 10) / 10;
    api.setCursor(L, C, H);
    onCursor(L, C, H);
  };
  Object.keys(SV).forEach((k) => {
    const v = SV[k], cv = v.cv, ptrs = new Map();
    let mode = null, last = null, pinch = null;
    const rel = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * cv.width) / r.width, ((e.clientY - r.top) * cv.height) / r.height]; };
    const zoom = (x, y, f) => {
      const u = px2u(v, x), w = py2v(v, y), d = v.dom;
      d.x0 = u + (d.x0 - u) * f; d.x1 = u + (d.x1 - u) * f; d.y0 = w + (d.y0 - w) * f; d.y1 = w + (d.y1 - w) * f;
      v.user = true;
      fitIso(v); followCursor(k); scheduleSections();
    };
    const panV = (dx, dy) => {
      const d = v.dom, su = (d.x1 - d.x0) / cv.width, sv = (d.y1 - d.y0) / cv.height;
      d.x0 -= dx * su; d.x1 -= dx * su; d.y0 += dy * sv; d.y1 += dy * sv; v.user = true;
      followCursor(k); scheduleSections();
    };
    on(cv, "contextmenu", (e) => e.preventDefault());
    on(cv, "pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, rel(e));
      onHover(null);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; mode = "pinch"; return; }
      mode = e.button === 1 || e.button === 2 || e.shiftKey ? "pan" : "cursor";
      last = rel(e);
      if (mode === "cursor") dragView = k;
      if (mode === "cursor") moveCursor(setFromView[k](px2u(v, last[0]), py2v(v, last[1])));
    });
    on(cv, "pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) {
        if (e.pointerType === "mouse") {
          const p = rel(e), P = [0, 0, 0];
          const id = S.fill < 0.001 ? dotAt(k, p[0], p[1]) : mapping[k](px2u(v, p[0]), py2v(v, p[1]), P) ? cellAt(P[0], P[1], P[2]) : -1;
          onHover(id >= 0 ? { item: S.anchors[id], x: e.clientX, y: e.clientY } : null);
        }
        return;
      }
      const p = rel(e);
      ptrs.set(e.pointerId, p);
      if (mode === "pinch" && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        panV(m[0] - pinch.m[0], m[1] - pinch.m[1]); zoom(m[0], m[1], pinch.d / d); pinch = { d, m }; return;
      }
      if (mode === "pan") { panV(p[0] - last[0], p[1] - last[1]); last = p; }
      else if (mode === "cursor") moveCursor(setFromView[k](px2u(v, p[0]), py2v(v, p[1])));
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (!ptrs.size || mode === "pinch") mode = null;
      if (!ptrs.size && dragView === k) { dragView = null; if (followCursor(k)) scheduleSections(); }
    };
    on(cv, "pointerup", up);
    on(cv, "pointercancel", up);
    on(cv, "pointerleave", () => onHover(null));
    on(cv, "wheel", (e) => { e.preventDefault(); const [x, y] = rel(e); zoom(x, y, Math.exp(e.deltaY * 0.0015)); }, { passive: false });
    on(cv, "dblclick", () => api.resetView(k));
  });
  const ro = new ResizeObserver(() => {
    if (!glCanvas.parentElement || glCanvas.parentElement.clientWidth === 0) return;   // hidden tab
    let changed = false;
    Object.values(SV).forEach((v) => { if (sizeView(v)) { fitIso(v); changed = true; } });
    if (changed) followAll();
    if (changed) scheduleSections();
    resize();
  });
  Object.values(SV).forEach((v) => ro.observe(v.cv));
  ro.observe(glCanvas.parentElement);

  // ── Public API ───────────────────────────────────────────────────────────
  const api = {
    // Renames and other label-only changes keep the built cells.
    setAnchors(list) {
      const sig = list.map((a) => `${a.L},${a.C},${a.H},${a.hex}`).join(";");
      S.anchors = list;
      if (sig === anchorSig && N === list.length) return;
      anchorSig = sig;
      buildCells();
    },
    setMarkers(list) {
      const sig = list.length + ":" + list.map((m) => `${m.L},${m.C},${m.H},${m.hex},${m.kind}`).join(";");
      S.markers = list;
      if (sig === markerSig) return;
      markerSig = sig;
      setMarkerGeometry(); scheduleSections();
    },
    setCursor(L, C, H) {
      const [l0, c0, h0] = S.cursor;
      if (Math.abs(l0 - L) < 1e-6 && Math.abs(c0 - C) < 1e-6 && Math.abs(h0 - H) < 1e-6) return;
      S.cursor = [L, C, H];
      const changedCell = updateCursor();
      followAll();
      const sliced = S.range.hl !== null || S.range.hc !== null || S.range.hh !== null;
      if (sliced) { rebuild(); rebuildActive(); }
      else { if (changedCell) rebuildActive(); updateDotVisibility(); scheduleSections(); }
    },
    setRange(hl, hc, hh) {
      const r = S.range;
      if (r.hl === hl && r.hc === hc && r.hh === hh) return;
      S.range = { hl, hc, hh };
      rebuild(); rebuildActive();
    },
    setLook({ fill, sep, opacity }) {
      const geoChange = fill !== S.fill;
      S.fill = fill; S.sep = sep; S.opacity = opacity;
      shared.uSep.value = 1 + sep;
      cellMat.uniforms.uAlpha.value = opacity;
      placeMarker(); updatePlanes();
      if (geoChange) { rebuild(); rebuildActive(); } else requestRender();
    },
    setTheme({ dark, fg, bg }) {
      S.dark = dark; S.fg = fg; S.bg = bg;
      S.guide = dark ? { l: "#ffd27a", c: "#7ad7ff", h: "#ff8ad8" } : { l: "#b7791f", c: "#0e7490", h: "#be185d" };
      const fgc = new THREE.Color(fg[0], fg[1], fg[2]);
      rimMat.uniforms.uColor.value.copy(fgc);
      dotMat.uniforms.uRing.value.copy(fgc);
      markerMats.forEach((m) => m.color.copy(fgc));
      plL.material.color.set(S.guide.l); plC.material.color.set(S.guide.c); plH.material.color.set(S.guide.h);
      axis.material.color.copy(fgc);
      requestRender(); scheduleSections();
    },
    resetView(k) { const v = SV[k]; fitContain(v); followCursor(k); scheduleSections(); },
    resetCamera() { Object.assign(orb, { theta: 0.75, phi: 1.12, r: 14, ox: 0, oy: 0, oz: 0 }); placeMarker(); applyOrbit(); },
    resize,
    dispose() {
      disposed = true; buildToken++;
      cancelAnimationFrame(rafId); cancelAnimationFrame(secRaf); clearTimeout(secTimer); sharpJob++;
      ro.disconnect();
      listeners.forEach(([el, ev, fn, o]) => el.removeEventListener(ev, fn, o));
      scene.traverse((o) => { o.geometry && o.geometry.dispose(); });
      overlay.traverse((o) => { o.geometry && o.geometry.dispose(); });
      [cellMat, activeMat, rimMat, dotMat, ghostMat, axis.material, plL.material, plC.material, plH.material, ...markerMats].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  resize();
  applyOrbit();
  updatePlanes();
  return api;
}

// Display name for an Explore point: its own override, else its anchor's name.
const spacePointLabel = (p, names) => {
  const noun =
    p.nameOverride ||
    (p.parentNounId && names[p.parentNounId]) ||
    (p.anchorId && names[p.anchorId]) ||
    "";
  return String(noun).trim() || "Unnamed";
};
const SPACE_LOOK_KEY = "color-samificator-space-look";
const SPACE_PLANE_COLORS = {
  light: { l: "#b7791f", c: "#0e7490", h: "#be185d" },
  dark: { l: "#ffd27a", c: "#7ad7ff", h: "#ff8ad8" },
};

const SpaceSlider = ({ label, value, min, max, step, onChange, format }) =>
  React.createElement(
    "label",
    { className: "flex flex-col gap-1" },
    React.createElement(
      "div",
      { className: "flex justify-between items-center text-[10px] uppercase text-slate-400 font-mono" },
      React.createElement("span", { className: "font-bold tracking-wider" }, label),
      React.createElement(
        "span",
        { className: "bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-neutral-300" },
        format(value),
      ),
    ),
    React.createElement("input", {
      type: "range", min, max, step, value,
      onChange: (e) => onChange(Number(e.target.value)),
      className: "w-full accent-sky-500",
    }),
  );

const SpaceSection = ({ id, title, color, value, canvasRef, height, setHeight, axes, onReset, narrow }) =>
  React.createElement(
    "div",
    { className: narrow ? "shrink-0 w-40 flex flex-col" : "flex flex-col" },
    React.createElement(
      "div",
      { className: "flex items-center justify-between gap-2 mb-1.5" },
      React.createElement(
        "div",
        { className: "flex items-center gap-1.5 min-w-0" },
        React.createElement("span", { className: "w-2 h-2 rounded-full shrink-0", style: { background: color } }),
        React.createElement(
          "span",
          { className: "text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400 truncate" },
          title,
        ),
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-1.5 shrink-0" },
        !narrow &&
          React.createElement("span", { className: "text-[10px] font-mono text-slate-400" }, value),
        React.createElement(
          "button",
          {
            onClick: onReset,
            title: "Reset zoom",
            className: "p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors",
          },
          React.createElement(Icon, { name: "rotate-ccw", className: "w-3 h-3" }),
        ),
      ),
    ),
    React.createElement("canvas", {
      ref: canvasRef,
      "data-section": id,
      style: { height: narrow ? 120 : height, width: "100%", display: "block", touchAction: "none", cursor: "crosshair" },
      className: narrow
        ? "rounded-lg border border-slate-200 dark:border-neutral-800"
        : "rounded-t-lg border border-b-0 border-slate-200 dark:border-neutral-800",
    }),
    !narrow &&
      React.createElement("div", {
        title: "Drag to resize",
        className: "h-2.5 rounded-b-lg border border-t-0 border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/50 cursor-ns-resize flex items-center justify-center",
        style: { touchAction: "none" },
        onPointerDown: (e) => {
          const el = e.currentTarget, y0 = e.clientY, h0 = height;
          el.setPointerCapture(e.pointerId);
          const mv = (ev) => setHeight(Math.max(90, Math.min(900, h0 + ev.clientY - y0)));
          const end = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", end); };
          el.addEventListener("pointermove", mv);
          el.addEventListener("pointerup", end);
        },
      }, React.createElement("span", { className: "w-6 h-0.5 rounded bg-slate-300 dark:bg-neutral-600" })),
    !narrow &&
      React.createElement(
        "div",
        { className: "flex justify-between mt-1 text-[9px] font-mono uppercase tracking-wider text-slate-400" },
        axes.map((a, i) => React.createElement("span", { key: i }, a)),
      ),
  );

const ViewSpaceInner = ({
  active = true,
  points,
  colorData,
  names,
  theme,
  scrubL,
  scrubC,
  scrubH,
  filterL,
  filterC,
  filterH,
  onCursor,
  handlePointClick,
}) => {
  const rootRef = useRef(null), glRef = useRef(null);
  const lRef = useRef(null), cRef = useRef(null), hRef = useRef(null);
  const engineRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onCursor, handlePointClick };
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState({ phase: "loading" });
  const [hover, setHover] = useState(null);
  const [narrow, setNarrow] = useState(false);
  const [lookOpen, setLookOpen] = useState(true);
  const [secW, setSecW] = useState(250);
  const [heights, setHeights] = useState({ l: 230, c: 150, h: 230 });
  const [look, setLook] = useState(() => {
    const d = { fill: 0.5, sep: 0, opacity: 1 };
    try { return { ...d, ...JSON.parse(localStorage.getItem(SPACE_LOOK_KEY) || "{}") }; } catch (e) { return d; }
  });
  const isDark = theme === "dark";
  const planeCol = SPACE_PLANE_COLORS[isDark ? "dark" : "light"];

  // Anchors become cells; pins and commercial colours become dots.
  const anchors = useMemo(() => {
    const seen = new Set(), out = [];
    (points || []).forEach((p) => {
      if (p.isPin || !isFinite(p.L) || !isFinite(p.C) || !isFinite(p.H)) return;
      const key = `${p.L.toFixed(4)}|${p.C.toFixed(4)}|${p.C < 1e-4 ? 0 : p.H.toFixed(3)}`;
      if (seen.has(key)) return; // two anchors on one spot would share a cell
      seen.add(key);
      const label = spacePointLabel(p, names || {});
      const nounId = p.parentNounId || p.anchorId;
      out.push({
        L: p.L, C: p.C, H: p.H, hex: spaceHexFor(p.color, p.L, p.C, p.H), label, kind: "anchor",
        pick: [p.L, p.C, p.H, { anchorId: nounId, fullName: label }],
      });
    });
    return out;
  }, [points, names]);
  const markers = useMemo(() => {
    const out = [];
    (points || []).forEach((p) => {
      if (!p.isPin) return;
      out.push({ L: p.L, C: p.C, H: p.H, hex: spaceHexFor(p.color, p.L, p.C, p.H), kind: "pin",
        label: (() => {
          const n = spacePointLabel(p, names || {});
          return `Pin · ${n !== "Unnamed" ? n : p.erpCode || p.pinId || "unnamed"}`;
        })(),
        pick: [p.L, p.C, p.H, { pinId: p.pinId }] });
    });
    if (colorData) {
      Object.keys(colorData).forEach((brand) => {
        (colorData[brand] || []).forEach((c, idx) => {
          if (!isFinite(c.L) || !isFinite(c.C)) return;
          const H = isFinite(c.H) ? c.H : 0;
          const oi = c.originalIndex !== undefined ? c.originalIndex : idx;
          out.push({ L: c.L, C: c.C, H, hex: spaceHexFor(c.hex, c.L, c.C, H), kind: "brand",
            label: `${typeof getBrandDisplayName === "function" ? getBrandDisplayName(brand) : brand} · ${c.name}`,
            pick: [c.L, c.C, H, { brand, originalIndex: oi }] });
        });
      });
    }
    return out;
  }, [points, colorData, names]);

  // Engine lifetime: one WebGL context per mount, released on unmount.
  useEffect(() => {
    let dead = false;
    loadSpaceThree()
      .then(() => {
        if (dead) return;
        try {
          engineRef.current = createSpaceEngine({
            glCanvas: glRef.current,
            views: { l: lRef.current, c: cRef.current, h: hRef.current },
            onCursor: (L, C, H) => cbRef.current.onCursor && cbRef.current.onCursor(L, C, H),
            onHover: (h) => setHover(h),
            onPick: (item) => cbRef.current.handlePointClick && cbRef.current.handlePointClick(item.pick),
            onStatus: (s) => !dead && setStatus(s),
          });
          setReady(true);
        } catch (e) {
          setStatus({ phase: "error", message: "WebGL couldn't start here. Reload the page, or try another browser." });
        }
      })
      .catch(() => !dead && setStatus({ phase: "error", message: "The 3D library couldn't be loaded. Check your connection and reload." }));
    return () => {
      dead = true;
      if (engineRef.current) engineRef.current.dispose();
      engineRef.current = null;
    };
  }, []);

  // While another tab is showing, the view stays mounted (no rebuild, no new
  // WebGL context on return) but takes no updates; they apply when shown.
  const eng = active ? engineRef.current : null;
  useEffect(() => { ready && eng && eng.setAnchors(anchors); }, [ready, anchors, active]);
  useEffect(() => { ready && eng && eng.setMarkers(markers); }, [ready, markers, active]);
  useEffect(() => { ready && eng && eng.setCursor(scrubL, scrubC, ((scrubH % 360) + 360) % 360); }, [ready, scrubL, scrubC, scrubH, active]);
  useEffect(() => {
    if (!ready || !eng) return;
    // The tolerance sliders are half-widths; at their maximum they mean "everything".
    const hl = filterL >= 1 || (scrubL - filterL <= 0 && scrubL + filterL >= 1) ? null : filterL;
    const hc = filterC >= 0.4 || (scrubC - filterC <= 0 && scrubC + filterC >= 0.4) ? null : filterC;
    const hh = filterH >= 180 ? null : filterH;
    eng.setRange(hl, hc, hh);
  }, [ready, filterL, filterC, filterH, scrubL, scrubC, active]);
  useEffect(() => {
    ready && eng && eng.setLook(look);
    try { localStorage.setItem(SPACE_LOOK_KEY, JSON.stringify(look)); } catch (e) {}
  }, [ready, look, active]);
  useEffect(() => {
    if (!ready || !eng) return;
    // Read the theme's real colours once the app has applied its dark class.
    const id = requestAnimationFrame(() => {
      const el = rootRef.current;
      if (!el || !engineRef.current) return;
      const cs = getComputedStyle(el);
      let bgEl = el, bg = null;
      while (bgEl && !bg) { bg = spaceParseCss(getComputedStyle(bgEl).backgroundColor, null); bgEl = bgEl.parentElement; }
      engineRef.current.setTheme({
        dark: isDark,
        fg: spaceParseCss(cs.color, isDark ? [0.95, 0.91, 0.87] : [0.1, 0.12, 0.1]),
        bg: bg || (isDark ? [0.08, 0.08, 0.08] : [1, 1, 1]),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [ready, isDark, active]);

  // Narrow containers (phones) stack the sections under the 3D view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => { if (el.clientWidth > 0) setNarrow(el.clientWidth < 720); });   // 0 = hidden tab
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (narrow) setLookOpen(false); }, [narrow]);
  useEffect(() => { if (!active) setHover(null); }, [active]);

  const fmtL = (v) => v.toFixed(3), fmtC = (v) => v.toFixed(3), fmtH = (v) => `${(((v % 360) + 360) % 360).toFixed(1)}°`;
  const sections = [
    { id: "l", title: "L section", color: planeCol.l, value: `L ${fmtL(scrubL)}`, ref: lRef, axes: ["a −", "a → · b ↑", "a +"] },
    { id: "c", title: "C section", color: planeCol.c, value: `C ${fmtC(scrubC)}`, ref: cRef, axes: ["0°", "hue (true length) →", "360°"] },
    { id: "h", title: "H section", color: planeCol.h, value: `H ${fmtH(scrubH)}`, ref: hRef, axes: ["C 0", "chroma → · L ↑", "true scale"] },
  ];
  const overlayCard = "bg-white/90 dark:bg-neutral-900/90 backdrop-blur border border-slate-200 dark:border-neutral-800 rounded-xl shadow-sm";

  return React.createElement(
    "div",
    { ref: rootRef, className: `w-full h-full flex ${narrow ? "flex-col-reverse" : "flex-row"} text-slate-900 dark:text-neutral-100 overflow-hidden` },
    // ── Section views ──
    React.createElement(
      "div",
      {
        className: narrow
          ? "shrink-0 flex flex-row gap-3 overflow-x-auto no-scrollbar p-3 border-t border-slate-100 dark:border-neutral-800"
          : "shrink-0 h-full overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4 border-r border-slate-100 dark:border-neutral-800 relative",
        style: narrow ? undefined : { width: secW },
      },
      sections.map((s) =>
        React.createElement(SpaceSection, {
          key: s.id, id: s.id, title: s.title, color: s.color, value: s.value, canvasRef: s.ref,
          height: heights[s.id], narrow, axes: s.axes,
          setHeight: (h) => setHeights((prev) => ({ ...prev, [s.id]: h })),
          onReset: () => engineRef.current && engineRef.current.resetView(s.id),
        }),
      ),
      !narrow &&
        React.createElement(
          "p",
          { className: "text-[9px] leading-relaxed text-slate-400 uppercase tracking-wider" },
          "Drag to move the cursor · scroll or pinch to zoom · right-drag to pan · double-click to reset",
        ),
    ),
    // column resize handle
    !narrow &&
      React.createElement("div", {
        title: "Drag to resize",
        className: "w-1.5 -ml-1.5 shrink-0 cursor-ew-resize hover:bg-slate-300 dark:hover:bg-neutral-700 z-10",
        style: { touchAction: "none" },
        onPointerDown: (e) => {
          const el = e.currentTarget, x0 = e.clientX, w0 = secW;
          el.setPointerCapture(e.pointerId);
          const mv = (ev) => setSecW(Math.max(190, Math.min(640, w0 + ev.clientX - x0)));
          const end = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", end); };
          el.addEventListener("pointermove", mv);
          el.addEventListener("pointerup", end);
        },
      }),
    // ── 3D view ──
    React.createElement(
      "div",
      { className: "relative flex-1 min-w-0 min-h-0" },
      React.createElement("canvas", {
        ref: glRef,
        className: "absolute inset-0 w-full h-full",
        style: { touchAction: "none", cursor: "grab" },
      }),
      // appearance controls
      React.createElement(
        "div",
        { className: `absolute top-3 left-3 z-10 ${overlayCard} ${lookOpen ? "w-56 p-3" : "p-1"}` },
        React.createElement(
          "button",
          {
            onClick: () => setLookOpen(!lookOpen),
            className: `flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-white ${lookOpen ? "w-full mb-3" : "p-1.5"}`,
            title: lookOpen ? "Hide appearance" : "Appearance",
          },
          React.createElement(Icon, { name: "sliders-horizontal", className: "w-3.5 h-3.5" }),
          lookOpen && "Appearance",
          lookOpen && React.createElement("span", { className: "ml-auto" }, React.createElement(Icon, { name: "chevron-up", className: "w-3 h-3" })),
        ),
        lookOpen &&
          React.createElement(
            "div",
            { className: "flex flex-col gap-3" },
            React.createElement(SpaceSlider, {
              label: "Inflation", value: look.fill, min: 0, max: 1, step: 0.01,
              format: (v) => (v < 0.005 ? "dot" : `${Math.round(v * 100)}%`),
              onChange: (v) => setLook((p) => ({ ...p, fill: v })),
            }),
            React.createElement(SpaceSlider, {
              label: "Separation", value: look.sep, min: 0, max: 2, step: 0.02,
              format: (v) => v.toFixed(2),
              onChange: (v) => setLook((p) => ({ ...p, sep: v })),
            }),
            React.createElement(SpaceSlider, {
              label: "Opacity", value: look.opacity, min: 0.05, max: 1, step: 0.01,
              format: (v) => `${Math.round(v * 100)}%`,
              onChange: (v) => setLook((p) => ({ ...p, opacity: v })),
            }),
            React.createElement(
              "button",
              {
                onClick: () => engineRef.current && engineRef.current.resetCamera(),
                className: "mt-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors",
              },
              React.createElement(Icon, { name: "rotate-ccw", className: "w-3 h-3" }),
              "Reset camera",
            ),
          ),
      ),
      // plane legend
      React.createElement(
        "div",
        { className: "absolute bottom-3 left-3 z-10 flex items-center gap-3 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400 pointer-events-none " + overlayCard },
        [["l", "L plane"], ["c", "C plane"], ["h", "H plane"]].map(([k, t]) =>
          React.createElement(
            "span",
            { key: k, className: "flex items-center gap-1.5" },
            React.createElement("span", { className: "w-2 h-2 rounded-full", style: { background: planeCol[k] } }),
            t,
          ),
        ),
      ),
      // status
      status.phase !== "ready" &&
        React.createElement(
          "div",
          { className: "absolute inset-0 flex items-center justify-center pointer-events-none z-0" },
          React.createElement(
            "div",
            { className: "text-center max-w-xs px-6" },
            React.createElement(
              "div",
              { className: "text-[10px] font-bold uppercase tracking-widest text-slate-400" },
              status.phase === "loading" ? "Loading 3D view…"
                : status.phase === "building" ? `Shaping cells · ${Math.round((status.progress || 0) * 100)}%`
                : status.phase === "empty" ? "No anchors to show"
                : "3D view unavailable",
            ),
            (status.phase === "empty" || status.phase === "error") &&
              React.createElement(
                "p",
                { className: "mt-2 text-[11px] text-slate-500 dark:text-neutral-400" },
                status.phase === "empty"
                  ? "Load anchors, or clear the search, tag and visibility filters above."
                  : status.message,
              ),
          ),
        ),
      // hover card
      hover &&
        React.createElement(
          "div",
          {
            className: `fixed z-[300] pointer-events-none flex items-center gap-2.5 px-2.5 py-2 ${overlayCard} shadow-lg`,
            style: { left: hover.x + 14, top: hover.y + 14 },
          },
          React.createElement("span", {
            className: "w-7 h-7 rounded-md border border-black/10 dark:border-white/10 shrink-0",
            style: { background: hover.item.hex },
          }),
          React.createElement(
            "div",
            { className: "flex flex-col" },
            React.createElement("span", { className: "text-[11px] font-bold text-slate-800 dark:text-neutral-100" }, hover.item.label),
            React.createElement(
              "span",
              { className: "text-[10px] font-mono text-slate-500 dark:text-neutral-400" },
              `L ${hover.item.L.toFixed(3)} · C ${hover.item.C.toFixed(3)} · H ${hover.item.H.toFixed(1)}°`,
            ),
          ),
        ),
    ),
  );
};

// Hidden and staying hidden: nothing to redraw, so skip the render entirely.
const ViewSpace = React.memo(ViewSpaceInner, (prev, next) => !prev.active && !next.active && prev.active !== undefined);

// ─── Anchors: add, rename, move and delete the named points ─────────────────
// Distances are OkLab ΔE ×100 (so 1.0 ≈ a just-noticeable step).
const ANCHOR_CLOSE_DE = 1;
// Rows carry their OkLab a/b, so pair distances need no trigonometry.
const anchorRowDE = (p, q) => {
  const dL = p.L - q.L, da = p.oa - q.oa, db = p.ob - q.ob;
  return Math.sqrt(dL * dL + da * da + db * db) * 100;
};
// Fixed row height: the table only mounts the rows in view (plus a margin),
// so a few thousand anchors scroll as smoothly as a few dozen.
const ANCHOR_ROW_H = 38, ANCHOR_OVERSCAN = 12;

// A number cell that edits freely and commits on Enter or blur.
const AnchorNumberInput = ({ value, onCommit, step, min, max, digits, label, wide }) => {
  const [draft, setDraft] = useState(null);
  const shown = draft !== null ? draft : Number(value).toFixed(digits);
  const commit = () => {
    if (draft === null) return;
    const v = parseFloat(draft);
    setDraft(null);
    if (isFinite(v)) onCommit(Math.min(max, Math.max(min, v)));
  };
  return React.createElement("input", {
    type: "number", step, min, max, value: shown, "aria-label": label,
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(null); e.currentTarget.blur(); } },
    className: `${wide ? "w-20" : "w-16"} text-right text-[11px] font-mono tabular-nums bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-neutral-700 focus:border-sky-500 rounded px-1.5 py-1 outline-none text-slate-800 dark:text-neutral-200`,
  });
};

const AnchorNameInput = ({ value, onCommit, autoFocus }) => {
  const [draft, setDraft] = useState(null);
  const ref = useRef(null);
  useEffect(() => { if (autoFocus && ref.current) { ref.current.focus(); ref.current.select(); } }, [autoFocus]);
  const commit = () => { if (draft === null) return; const v = draft.trim(); setDraft(null); if (v !== value) onCommit(v); };
  return React.createElement("input", {
    ref, type: "text", value: draft !== null ? draft : value, placeholder: "Unnamed",
    "aria-label": "Anchor name",
    onChange: (e) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(null); e.currentTarget.blur(); } },
    className: "w-full min-w-[9rem] text-[12px] font-bold uppercase tracking-wide bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-neutral-700 focus:border-sky-500 rounded px-1.5 py-1 outline-none text-slate-900 dark:text-white placeholder:normal-case placeholder:font-normal",
  });
};

const AnchorIconButton = ({ icon, title, onClick, danger, active }) =>
  React.createElement(
    "button",
    {
      onClick, title, "aria-label": title,
      className: `p-1.5 rounded-md transition-colors ${
        danger
          ? active
            ? "bg-red-500 text-white"
            : "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          : "text-slate-400 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-neutral-800"
      }`,
    },
    React.createElement(Icon, { name: icon, className: "w-3.5 h-3.5" }),
  );


// One table row. Memoised: a row re-renders only when its own data, selection,
// confirm state or distance to the cursor changes.
const AnchorRow = React.memo(({ r, isHere, checked, confirming, autoFocus, deCursor, act }) =>
  React.createElement(
    "tr",
    {
      style: { height: ANCHOR_ROW_H },
      className: `border-b border-slate-100 dark:border-neutral-800/70 ${isHere ? "bg-slate-100 dark:bg-neutral-800" : ""} hover:bg-slate-50 dark:hover:bg-neutral-800/40`,
    },
    React.createElement(
      "td",
      { className: "px-2 py-1" },
      React.createElement("input", {
        type: "checkbox", "aria-label": `Select ${r.name || "unnamed anchor"}`, checked,
        onChange: (e) => act.select(r.id, e.target.checked),
        className: "rounded border-slate-300 text-sky-500 focus:ring-sky-500",
      }),
    ),
    React.createElement(
      "td",
      { className: "px-2 py-1" },
      React.createElement("button", {
        onClick: () => act.goTo(r), title: "Move the cursor here",
        className: `w-7 h-7 rounded-md border block ${isHere ? "border-slate-800 dark:border-white" : "border-black/10 dark:border-white/10"}`,
        style: { background: r.hex },
      }),
    ),
    React.createElement(
      "td",
      { className: "px-1 py-1" },
      React.createElement(AnchorNameInput, { value: r.name, autoFocus, onCommit: (v) => act.rename(r, v) }),
    ),
    React.createElement(
      "td",
      { className: "px-1 py-1 text-right whitespace-nowrap" },
      r.range
        ? React.createElement("span", { className: "text-[10px] font-mono text-slate-400 pr-1.5", title: "Legacy lightness range; editing L turns it into a point" },
            `${r.range[0].toFixed(2)}–${r.range[1].toFixed(2)}`)
        : null,
      React.createElement(AnchorNumberInput, { value: r.L, step: 0.001, min: 0, max: 1, digits: 3, label: "Lightness", onCommit: (v) => act.move(r, { L: v }) }),
    ),
    React.createElement(
      "td",
      { className: "px-1 py-1 text-right" },
      React.createElement(AnchorNumberInput, { value: r.C, step: 0.001, min: 0, max: 0.4, digits: 3, label: "Chroma", onCommit: (v) => act.move(r, { C: v }) }),
    ),
    React.createElement(
      "td",
      { className: "px-1 py-1 text-right" },
      React.createElement(AnchorNumberInput, { value: r.H, step: 0.1, min: 0, max: 360, digits: 1, label: "Hue", wide: true, onCommit: (v) => act.move(r, { H: v }) }),
    ),
    React.createElement(
      "td",
      { className: "px-2 py-1" },
      r.nn &&
        React.createElement(
          "button",
          {
            onClick: () => act.find(r.nn.name || ""),
            title: "Show this anchor",
            className: "flex items-center gap-2 text-left max-w-[14rem]",
          },
          React.createElement("span", { className: "w-3 h-3 rounded-sm shrink-0 border border-black/10", style: { background: r.nn.hex } }),
          React.createElement("span", { className: "text-[10px] font-bold uppercase text-slate-600 dark:text-neutral-300 truncate" }, r.nn.name || "Unnamed"),
          React.createElement(
            "span",
            {
              className: `text-[10px] font-mono tabular-nums px-1.5 rounded ${
                r.nnDE < ANCHOR_CLOSE_DE ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "text-slate-400"
              }`,
            },
            r.nnDE.toFixed(1),
          ),
        ),
    ),
    React.createElement(
      "td",
      { className: "px-2 py-1 text-right text-[10px] font-mono tabular-nums text-slate-500" },
      deCursor,
    ),
    React.createElement(
      "td",
      { className: "px-2 py-1" },
      React.createElement(
        "div",
        { className: "flex items-center justify-end gap-0.5" },
        React.createElement(AnchorIconButton, { icon: "crosshair", title: "Move the cursor here", onClick: () => act.goTo(r) }),
        React.createElement(AnchorIconButton, { icon: "move", title: "Move this anchor to the cursor", onClick: () => act.moveToCursor(r) }),
        React.createElement(AnchorIconButton, { icon: "box", title: "Show in Explore", onClick: () => act.explore(r) }),
        React.createElement(AnchorIconButton, {
          icon: "trash-2", danger: true, active: confirming,
          title: confirming ? "Click again to delete" : "Delete anchor",
          onClick: () => act.trash(r),
        }),
      ),
    ),
  ),
);

const ViewAnchors = ({
  savedColors, setSavedColors, names, setNames,
  scrubL, scrubC, scrubH, handleUpdate, setActiveTab,
}) => {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState({});
  const [confirm, setConfirm] = useState(null); // id or "bulk" awaiting a second click
  const [focusId, setFocusId] = useState(null);
  const scrollRef = useRef(null);
  const [view, setView] = useState({ top: 0, h: 800 });
  const [notice, setNotice] = useState("");
  useEffect(() => { if (!confirm) return undefined; const t = setTimeout(() => setConfirm(null), 3000); return () => clearTimeout(t); }, [confirm]);
  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(""), 2500); return () => clearTimeout(t); }, [notice]);

  // Every anchor as a flat record, plus its nearest neighbour (to spot near-duplicates).
  const rows = useMemo(() => {
    const list = anchorPointsOf(savedColors).map((an) => {
      const L = (an.minL + an.maxL) / 2, C = Number(an.sc.C) || 0, H = ((Number(an.sc.H) || 0) % 360 + 360) % 360;
      const h = (H * Math.PI) / 180;
      return {
        id: an.id, nameKey: an.nameKey, type: an.sc.type,
        L, C, H, oa: C * Math.cos(h), ob: C * Math.sin(h),
        range: an.maxL - an.minL > 1e-6 ? [an.minL, an.maxL] : null,
        name: anchorNameOf(an, names),
      };
    });
    list.forEach((r) => (r.hex = spaceHexFor(null, r.L, r.C, r.H)));
    // Nearest neighbour per anchor: sort by L once, then only scan while the
    // lightness gap alone is still smaller than the best distance found.
    const byL = list.slice().sort((p, q) => p.L - q.L);
    for (let i = 0; i < byL.length; i++) {
      const p = byL[i];
      let best = null, bd = Infinity;
      for (let dir = -1; dir <= 1; dir += 2)
        for (let j = i + dir; j >= 0 && j < byL.length; j += dir) {
          const q = byL[j];
          if (Math.abs(q.L - p.L) * 100 >= bd) break;
          const d = anchorRowDE(p, q);
          if (d < bd) { bd = d; best = q; }
        }
      p.nn = best; p.nnDE = bd;
    }
    return list;
  }, [savedColors, names]);

  const cursor = useMemo(() => {
    const H = ((scrubH % 360) + 360) % 360, h = (H * Math.PI) / 180;
    return { L: scrubL, C: scrubC, H, oa: scrubC * Math.cos(h), ob: scrubC * Math.sin(h) };
  }, [scrubL, scrubC, scrubH]);
  const cursorHex = spaceHexFor(null, cursor.L, cursor.C, cursor.H);
  const cursorAnchor = useMemo(() => {
    let best = null, bd = Infinity;
    rows.forEach((r) => { const d = anchorRowDE(r, cursor); if (d < bd) { bd = d; best = r; } });
    return best ? { ...best, de: bd } : null;
  }, [rows, cursor]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.hex.includes(q)) : rows.slice();
    const key = {
      name: (r) => r.name.toLowerCase() || "￿",
      L: (r) => r.L, C: (r) => r.C, H: (r) => r.H,
      cursor: (r) => anchorRowDE(r, cursor),
      nn: (r) => r.nnDE,
    }[sortBy];
    // Keys computed once per row, not once per comparison.
    const keyed = out.map((r) => [key(r), r]);
    keyed.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) * (sortAsc ? 1 : -1));
    return keyed.map((k) => k[1]);
  }, [rows, query, sortBy, sortAsc, sortBy === "cursor" ? cursor : null]);

  const closePairs = useMemo(() => rows.filter((r) => r.nnDE < ANCHOR_CLOSE_DE).length, [rows]);
  const unnamed = useMemo(() => rows.filter((r) => !r.name).length, [rows]);

  // ── edits ──
  const rename = (r, v) => {
    setSavedColors((prev) => (prev[r.id] ? { ...prev, [r.id]: { ...prev[r.id], nameOverride: v } } : prev));
    setNames((prev) => {
      const next = { ...prev };
      if (v) next[r.nameKey] = v; else delete next[r.nameKey];
      return next;
    });
  };
  const move = (r, patch) => {
    setSavedColors((prev) => {
      const sc = prev[r.id];
      if (!sc) return prev;
      const L = patch.L !== undefined ? patch.L : r.L, C = patch.C !== undefined ? patch.C : r.C, H = patch.H !== undefined ? patch.H : r.H;
      const h = (H * Math.PI) / 180;
      const next = { ...sc, C, H, a: C * Math.sin(h), b: C * Math.cos(h) };
      if (sc.type === "anchor") next.L = L;
      else if (patch.L !== undefined || !r.range) { next.minL = L; next.maxL = L; }
      return { ...prev, [r.id]: next };
    });
  };
  const remove = (ids) => {
    const set = new Set(ids);
    const keys = rows.filter((r) => set.has(r.id)).map((r) => r.nameKey);
    setSavedColors((prev) => { const next = { ...prev }; ids.forEach((id) => delete next[id]); return next; });
    setNames((prev) => { const next = { ...prev }; keys.forEach((k) => delete next[k]); return next; });
    setSelected({});
    setNotice(`Deleted ${ids.length} anchor${ids.length === 1 ? "" : "s"}`);
  };
  const addAtCursor = () => {
    const id = `custom-noun-${Date.now().toString(36)}`, h = (cursor.H * Math.PI) / 180;
    setSavedColors((prev) => ({
      ...prev,
      [id]: { id, type: "nounColumn", nameOverride: "", C: cursor.C, H: cursor.H, minL: cursor.L, maxL: cursor.L,
        a: cursor.C * Math.sin(h), b: cursor.C * Math.cos(h), notes: "" },
    }));
    setQuery(""); setSortBy("cursor"); setSortAsc(true); setFocusId(id);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;   // it sorts first (ΔE 0)
    setNotice("Anchor added at the cursor. Name it below.");
  };
  const goTo = (r) => handleUpdate([r.L, r.C, r.H]);
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  // Rows get one stable object of handlers that always calls the latest code,
  // so passing it never makes a memoised row re-render.
  const actRef = useRef({});
  actRef.current = {
    select: (id, v) => setSelected((p) => ({ ...p, [id]: v })),
    goTo, rename, move,
    find: (q) => setQuery(q),
    moveToCursor: (r) => { move(r, { L: cursor.L, C: cursor.C, H: cursor.H }); setNotice(`Moved ${r.name || "anchor"} to the cursor`); },
    explore: (r) => { goTo(r); setActiveTab("3d"); },
    trash: (r) => (confirm === r.id ? (remove([r.id]), setConfirm(null)) : setConfirm(r.id)),
  };
  const act = useMemo(() => {
    const o = {};
    ["select", "goTo", "rename", "move", "find", "moveToCursor", "explore", "trash"].forEach((k) => (o[k] = (...a) => actRef.current[k](...a)));
    return o;
  }, []);
  // Visible window of rows.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let raf = 0;
    const read = () => { raf = 0; setView((v) => (v.top === el.scrollTop && v.h === el.clientHeight ? v : { top: el.scrollTop, h: el.clientHeight })); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    read();
    return () => { el.removeEventListener("scroll", onScroll); ro.disconnect(); cancelAnimationFrame(raf); };
  }, [rows.length === 0]);
  const first = Math.max(0, Math.floor(view.top / ANCHOR_ROW_H) - ANCHOR_OVERSCAN);
  const last = Math.min(shown.length, Math.ceil((view.top + view.h) / ANCHOR_ROW_H) + ANCHOR_OVERSCAN);

  const th = "px-2 py-2 text-left text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap";
  const sortHeader = (id, label, right) =>
    React.createElement(
      "th",
      { className: th + (right ? " text-right" : "") },
      React.createElement(
        "button",
        {
          onClick: () => { if (sortBy === id) setSortAsc(!sortAsc); else { setSortBy(id); setSortAsc(true); } },
          className: `inline-flex items-center gap-1 uppercase tracking-widest hover:text-slate-700 dark:hover:text-neutral-200 ${sortBy === id ? "text-slate-700 dark:text-neutral-200" : ""}`,
        },
        label,
        sortBy === id && React.createElement(Icon, { name: sortAsc ? "arrow-up" : "arrow-down", className: "w-3 h-3" }),
      ),
    );

  return React.createElement(
    "div",
    { className: "w-full h-full flex flex-col min-h-0" },
    // ── header: cursor + actions ──
    React.createElement(
      "div",
      { className: "px-4 py-3 border-b border-slate-100 dark:border-neutral-800 flex flex-wrap items-center gap-x-6 gap-y-3" },
      React.createElement(
        "div",
        { className: "flex items-baseline gap-2" },
        React.createElement("span", { className: "text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-neutral-100" }, "Anchors"),
        React.createElement("span", { className: "text-[10px] font-mono text-slate-400" }, `${rows.length}`),
        unnamed > 0 && React.createElement("span", { className: "text-[10px] font-mono text-slate-400" }, `· ${unnamed} unnamed`),
        closePairs > 0 &&
          React.createElement(
            "button",
            {
              onClick: () => { setSortBy("nn"); setSortAsc(true); },
              title: `Anchors closer than ΔE ${ANCHOR_CLOSE_DE} to another anchor`,
              className: "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25",
            },
            `${closePairs} near-duplicate${closePairs === 1 ? "" : "s"}`,
          ),
      ),
      // cursor card
      React.createElement(
        "div",
        { className: "flex items-center gap-3 min-w-0" },
        React.createElement("button", {
          onClick: () => setActiveTab("3d"), title: "Open the cursor in Explore",
          className: "w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 shrink-0",
          style: { background: cursorHex },
        }),
        React.createElement(
          "div",
          { className: "flex flex-col min-w-0" },
          React.createElement("span", { className: "text-[9px] font-bold uppercase tracking-widest text-slate-400" }, "Cursor"),
          React.createElement(
            "span",
            { className: "text-[10px] font-mono text-slate-600 dark:text-neutral-300 whitespace-nowrap" },
            `L ${cursor.L.toFixed(3)} · C ${cursor.C.toFixed(3)} · H ${cursor.H.toFixed(1)}°`,
          ),
          cursorAnchor &&
            React.createElement(
              "span",
              { className: "text-[10px] text-slate-500 dark:text-neutral-400 truncate" },
              "Named ",
              React.createElement("b", { className: "uppercase text-slate-800 dark:text-neutral-100" }, cursorAnchor.name || "Unnamed"),
              ` · ΔE ${cursorAnchor.de.toFixed(1)}`,
            ),
        ),
        React.createElement(
          "button",
          {
            onClick: addAtCursor,
            className: "ml-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap",
          },
          React.createElement(Icon, { name: "plus", className: "w-3.5 h-3.5" }),
          "Add at cursor",
        ),
      ),
      React.createElement(
        "div",
        { className: "relative ml-auto" },
        React.createElement(Icon, { name: "search", className: "absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" }),
        React.createElement("input", {
          type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Find anchor…", id: "anchor-search",
          className: "w-44 bg-slate-200/40 dark:bg-neutral-800/50 border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-sky-500 outline-none text-slate-900 dark:text-white placeholder:text-slate-400",
        }),
      ),
    ),
    // ── selection bar ──
    (selectedIds.length > 0 || notice) &&
      React.createElement(
        "div",
        { className: "px-4 py-2 border-b border-slate-100 dark:border-neutral-800 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500" },
        selectedIds.length > 0 && React.createElement("span", null, `${selectedIds.length} selected`),
        selectedIds.length > 0 &&
          React.createElement(
            "button",
            {
              onClick: () => (confirm === "bulk" ? (remove(selectedIds), setConfirm(null)) : setConfirm("bulk")),
              className: `px-2.5 py-1 rounded-md transition-colors ${confirm === "bulk" ? "bg-red-500 text-white" : "text-red-600 hover:bg-red-50 dark:hover:bg-red-950"}`,
            },
            confirm === "bulk" ? `Click again to delete ${selectedIds.length}` : "Delete selected",
          ),
        selectedIds.length > 0 &&
          React.createElement("button", { onClick: () => setSelected({}), className: "px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800" }, "Clear"),
        notice && React.createElement("span", { className: "ml-auto normal-case tracking-normal font-medium text-slate-500 dark:text-neutral-400" }, notice),
      ),
    // ── table ──
    React.createElement(
      "div",
      { ref: scrollRef, className: "flex-1 min-h-0 overflow-auto custom-scrollbar" },
      rows.length === 0
        ? React.createElement(
            "div",
            { className: "h-full flex flex-col items-center justify-center gap-2 p-8 text-center" },
            React.createElement("span", { className: "text-[11px] font-bold uppercase tracking-widest text-slate-400" }, "No anchors yet"),
            React.createElement("p", { className: "text-[12px] text-slate-500 max-w-sm" }, "Move the cursor to a colour and press Add at cursor, or import an anchors CSV with Type NOUN rows."),
          )
        : React.createElement(
            "table",
            { className: "w-full border-collapse" },
            React.createElement(
              "thead",
              { className: "sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-slate-100 dark:border-neutral-800" },
              React.createElement(
                "tr",
                null,
                React.createElement(
                  "th",
                  { className: th + " w-8" },
                  React.createElement("input", {
                    type: "checkbox", "aria-label": "Select all shown",
                    checked: shown.length > 0 && shown.every((r) => selected[r.id]),
                    onChange: (e) => { const v = e.target.checked; setSelected((p) => { const n = { ...p }; shown.forEach((r) => (n[r.id] = v)); return n; }); },
                    className: "rounded border-slate-300 text-sky-500 focus:ring-sky-500",
                  }),
                ),
                React.createElement("th", { className: th + " w-10" }),
                sortHeader("name", "Name"),
                sortHeader("L", "L", true),
                sortHeader("C", "C", true),
                sortHeader("H", "H °", true),
                sortHeader("nn", "Nearest anchor"),
                sortHeader("cursor", "ΔE cursor", true),
                React.createElement("th", { className: th + " text-right" }, ""),
              ),
            ),
            React.createElement(
              "tbody",
              null,
              first > 0 && React.createElement("tr", { key: "pad-top", "aria-hidden": true, style: { height: first * ANCHOR_ROW_H } }),
              shown.slice(first, last).map((r) =>
                React.createElement(AnchorRow, {
                  key: r.id, r, act,
                  isHere: !!cursorAnchor && cursorAnchor.id === r.id,
                  checked: !!selected[r.id],
                  confirming: confirm === r.id,
                  autoFocus: focusId === r.id,
                  deCursor: anchorRowDE(r, cursor).toFixed(1),
                }),
              ),
              last < shown.length && React.createElement("tr", { key: "pad-bottom", "aria-hidden": true, style: { height: (shown.length - last) * ANCHOR_ROW_H } }),
            ),
          ),
    ),
  );
};


// ─── Colour names ───────────────────────────────────────────────────────────
// One rule everywhere: a colour's own name override, else the name of the pin
// it is tethered to, else the name of the nearest anchor (the cell it sits in
// in Explore). Returned upper-case; "" when nothing names it.
const UNNAMED_RE = /^unnamed( noun)?$/i;
const cleanName = (v) => {
  const s = String(v || "").trim();
  return UNNAMED_RE.test(s) ? "" : s;
};
function getInheritedPinNames(sc, savedColors = {}, names = {}, depth = 0) {
  if (!sc) return { displayName: "", source: "anchor", sourceId: "" };
  const own = cleanName(sc.nameOverride);
  const parent = sc.parentPinId && depth < 20 ? savedColors[sc.parentPinId] : null;
  if (parent) {
    const p = getInheritedPinNames(parent, savedColors, names, depth + 1);
    return { displayName: (own || p.displayName).toUpperCase(), source: "pin", sourceId: parent.id };
  }
  if (own) return { displayName: own.toUpperCase(), source: sc.type || "pin", sourceId: sc.id || "" };
  const an = findNearestAnchor(Number(sc.L), Number(sc.C), Number(sc.H), savedColors);
  if (!an) return { displayName: "", source: "anchor", sourceId: "" };
  return { displayName: cleanName(anchorNameOf(an, names)).toUpperCase(), source: an.sc.type, sourceId: an.nameKey };
}

// --- Same-anchor filtering --------------------------------------------------
// "Same anchor" asks one question: is this colour named by the same anchor as
// the cursor? Names are compared rather than ids, so two anchors that share a
// name group together.
// ─── Anchors are points ─────────────────────────────────────────────────────
// An anchor names one colour. Any other colour takes the name of the anchor
// nearest to it in OkLab (straight-line distance over L, a, b), which is the
// same rule that shapes the cells in Explore. Old lightness-range columns still
// count: the distance is measured to the nearest point of their range.
const ANCHOR_LIST_CACHE = new WeakMap();
const anchorPointsOf = (savedColors) => {
  if (!savedColors) return [];
  const hit = ANCHOR_LIST_CACHE.get(savedColors);
  if (hit) return hit;
  const list = [];
  Object.values(savedColors).forEach((sc) => {
    if (!sc || (sc.type !== "nounColumn" && sc.type !== "anchor")) return;
    const C = Number(sc.C), H = Number(sc.H) || 0;
    if (!isFinite(C)) return;
    let minL, maxL;
    if (sc.type === "anchor") {
      minL = maxL = Number(sc.L);
    } else {
      minL = isFinite(sc.minL) ? sc.minL : 0;
      maxL = isFinite(sc.maxL) ? sc.maxL : 1;
    }
    if (!isFinite(minL) || !isFinite(maxL)) return;
    const h = (H * Math.PI) / 180;
    const nameKey =
      sc.type === "anchor"
        ? sc.anchorId || sc.id
        : sc.id;
    list.push({ id: sc.id, nameKey, sc, minL, maxL, a: C * Math.sin(h), b: C * Math.cos(h) });
  });
  ANCHOR_LIST_CACHE.set(savedColors, list);
  return list;
};
// Squared OkLab distance from a colour to an anchor (point or L range).
const anchorDist2 = (L, a, b, an) => {
  const dL = L < an.minL ? an.minL - L : L > an.maxL ? L - an.maxL : 0;
  return dL * dL + (a - an.a) * (a - an.a) + (b - an.b) * (b - an.b);
};
const findNearestAnchor = (L, C, H, savedColors, opts = {}) => {
  const list = anchorPointsOf(savedColors);
  if (!list.length || !isFinite(L) || !isFinite(C)) return null;
  const h = ((Number(H) || 0) * Math.PI) / 180, a = C * Math.sin(h), b = C * Math.cos(h);
  let best = null, bd = Infinity;
  for (const an of list) {
    if (opts.named && !opts.named(an)) continue;
    const d = anchorDist2(L, a, b, an);
    if (d < bd) { bd = d; best = an; }
  }
  return best ? { ...best, dist: Math.sqrt(bd) } : null;
};
const anchorNameOf = (an, names) =>
  String((names && names[an.nameKey]) || (names && names[an.id]) || an.sc.nameOverride || "").trim();
// CSV headers in any case or spacing ("NOUN", "noun", "Oklch L") map onto the
// names the importer reads, so a file exported elsewhere still loads its names.
const CSV_CANONICAL_KEYS = "Adjective Anchor AnchorId Anchor_ID Brand BrandName Brand_Name CIE_A CIE_B CIE_L DoorProfile Door_Profile ERP_Code HEX ID Illuminant Image LAB_L Lab_A Lab_B Lab_L Material Measurement_Date Measurement_Device Measurement_Method Name Note Noun NounOverride Noun_Override OKLCH_C OKLCH_H OKLCH_L Observer Original_Index Parent ParentId ParentPinId Parent_ID Parent_Pin_ID PinId Pin_ID Profile RGB_B RGB_G RGB_R Sheen Spectral TactileTexture Tactile_Texture Tags Type URL VisualPattern VisualTexture Visual_Pattern Visual_Texture".split(" ");
const CSV_KEY_LOOKUP = (() => {
  const m = {};
  CSV_CANONICAL_KEYS.forEach((k) => { const n = k.toLowerCase().replace(/[\s_-]+/g, ""); if (!m[n]) m[n] = k; });
  return m;
})();
// Header → canonical name, worked out once per distinct header (not per row).
const CSV_KEY_CANON = new Map();
const csvCanonKey = (k) => {
  let c = CSV_KEY_CANON.get(k);
  if (c === undefined) {
    c = CSV_KEY_LOOKUP[String(k).toLowerCase().replace(/[\s_-]+/g, "")] || null;
    CSV_KEY_CANON.set(k, c);
  }
  return c;
};
const normalizeCsvRow = (row) => {
  if (!row || typeof row !== "object") return row;
  let out = null;
  for (const k in row) {
    const canon = csvCanonKey(k);
    if (canon && canon !== k && row[canon] === undefined && (!out || out[canon] === undefined)) {
      if (!out) out = { ...row };
      out[canon] = row[k];
    }
  }
  return out || row;
};


// Which noun column does this colour fall under? Nearest column in the a/b
// plane, preferring columns whose lightness range actually contains it.
// Which anchor names this colour? The nearest one in OkLab.
const resolveNounKey = (L, C, H, savedColors, namesObj) => {
  const an = findNearestAnchor(L, C, H, savedColors);
  if (!an) return "id:none";
  const name = cleanName(anchorNameOf(an, namesObj));
  return name ? `name:${name.toLowerCase()}` : `id:${an.id}`;
};


// Bundles the cursor's keys with the column list so a filter pass resolves
// the cursor once and then only does per-item work.
const getSameGroupContext = (L, C, H, savedColors, namesObj) => ({
  savedColors,
  namesObj,
  nounKey: resolveNounKey(L, C, H, savedColors, namesObj),
});


const matchesSameNoun = (ctx, L, C, H) =>
  resolveNounKey(L, C, H, ctx.savedColors, ctx.namesObj) === ctx.nounKey;

// Every view grew its own row of sort buttons — eleven of them in the commercial
// DB. One control, one shape: pick a field, flip the direction. Views differ
// only in the fields they pass in.
// --- Global filter model ---------------------------------------------------
// Every filter is one row: a field, an operator, a value. Rows stack with AND.
// The "same anchor", "color match" and "exact material match" behaviours are not separate mechanisms any more — they are presets that push
// ordinary rows into this same stack, so they can be inspected and removed like
// anything else.

const FILTER_FIELDS = [
  { id: "name", label: "Name", type: "text", get: (it) => it.displayName || it.name || "" },
  { id: "brand", label: "Brand", type: "select", get: (it) => it.brand || "" },
  { id: "material", label: "Material", type: "select", get: (it) => it.material || "" },
  { id: "sheen", label: "Sheen", type: "select", get: (it) => it.sheen || "" },
  { id: "doorProfile", label: "Profile", type: "select", get: (it) => it.doorProfile || "" },
  { id: "visualTexture", label: "Visual pattern", type: "select", get: (it) => it.visualTexture || "" },
  { id: "tactileTexture", label: "Tactile texture", type: "select", get: (it) => it.tactileTexture || "" },
  { id: "tag", label: "Tag", type: "select", multi: true, get: (it) => (it.tags || []).join(", ") },
  { id: "noun", label: "Anchor", type: "text", get: (it, ctx) => (ctx ? nounNameOf(it, ctx) : "") },
  { id: "L", label: "Lightness", type: "number", get: (it) => it.L },
  { id: "C", label: "Chroma", type: "number", get: (it) => it.C },
  { id: "H", label: "Hue", type: "number", get: (it) => it.H },
  { id: "deltaE", label: "\u0394E to cursor", type: "number", get: (it) => it._d },
  {
    id: "spectral",
    label: "Has spectral data",
    type: "boolean",
    // DB rows carry a precomputed hasSpectral; raw colour records and grid
    // points only have the spectral array itself.
    get: (it) =>
      !!(
        it.hasSpectral ||
        (Array.isArray(it.spectral) && it.spectral.length > 0)
      ),
  },
];

const nounNameOf = (item, ctx) => {
  const key = resolveNounKey(item.L, item.C, item.H, ctx.savedColors, ctx.namesObj);
  return key.indexOf("name:") === 0 ? key.slice(5) : "";
};

const FILTER_OPS = {
  text: [
    { id: "contains", label: "contains" },
    { id: "not_contains", label: "does not contain" },
    { id: "is", label: "is" },
    { id: "is_not", label: "is not" },
    { id: "starts", label: "starts with" },
  ],
  select: [
    { id: "is", label: "is" },
    { id: "is_not", label: "is not" },
    { id: "contains", label: "contains" },
  ],
  number: [
    { id: "lte", label: "\u2264" },
    { id: "gte", label: "\u2265" },
    { id: "eq", label: "=" },
    { id: "between", label: "between" },
  ],
  boolean: [
    { id: "is_true", label: "is yes" },
    { id: "is_false", label: "is no" },
  ],
};

const defaultOpFor = (type) => FILTER_OPS[type][0].id;

const evalFilterRow = (item, row, ctx) => {
  const field = FILTER_FIELDS.find((f) => f.id === row.field);
  if (!field) return true;

  // A dynamic row tracks the cursor: the comparison target is whatever the
  // cursor resolves to at this moment, not a value captured when it was added.
  if (row.dynamic && row.field === "noun") {
    if (!ctx) return true;
    const mine = resolveNounKey(item.L, item.C, item.H, ctx.savedColors, ctx.namesObj);
    return row.op === "is_not" ? mine !== ctx.nounKey : mine === ctx.nounKey;
  }

  const raw = field.get(item, ctx);

  if (field.type === "boolean") {
    return row.op === "is_true" ? !!raw : !raw;
  }
  if (field.type === "number") {
    const v = Number(raw);
    if (!isFinite(v)) return false;
    const a = Number(row.value);
    if (row.op === "between") {
      const b = Number(row.value2);
      if (!isFinite(a) || !isFinite(b)) return true;
      return v >= Math.min(a, b) && v <= Math.max(a, b);
    }
    if (!isFinite(a)) return true;
    if (row.op === "lte") return v <= a;
    if (row.op === "gte") return v >= a;
    return Math.abs(v - a) < 1e-9;
  }
  const s = String(raw || "").toLowerCase();
  const q = String(row.value || "").toLowerCase().trim();
  if (!q) return true;
  // Multi-value fields (tags) arrive comma-joined; "is" should match any one
  // of them rather than the whole joined string.
  const field2 = FILTER_FIELDS.find((f) => f.id === row.field);
  if (field2 && field2.multi) {
    const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
    if (row.op === "is") return parts.indexOf(q) !== -1;
    if (row.op === "is_not") return parts.indexOf(q) === -1;
  }
  if (row.op === "is") return s === q;
  if (row.op === "is_not") return s !== q;
  if (row.op === "not_contains") return s.indexOf(q) === -1;
  if (row.op === "starts") return s.indexOf(q) === 0;
  return s.indexOf(q) !== -1;
};

// Rows combine either with AND (narrowing, one after another) or with OR (a
// union — an item survives if any single row matches it). The conjunction is
// one choice for the whole group rather than per row, so the result never
// depends on an invisible precedence rule between them.
const applyGlobalFilters = (items, rows, ctx, mode, scope) => {
  // A row may be scoped to one surface (the DB list) rather than everywhere.
  const active = (rows || []).filter(
    (r) => !r.scope || !scope || r.scope === scope,
  );
  if (active.length === 0) return { items, culprit: null };

  if (mode === "or") {
    const out = items.filter((it) =>
      active.some((row) => evalFilterRow(it, row, ctx)),
    );
    return { items: out, culprit: out.length === 0 ? { any: true } : null };
  }

  let out = items;
  let culprit = null;
  active.forEach((row) => {
    if (out.length === 0) return;
    const next = out.filter((it) => evalFilterRow(it, row, ctx));
    if (next.length === 0 && !culprit) culprit = row;
    out = next;
  });
  return { items: out, culprit };
};

const cursorValueFor = (fieldId, ctx) => {
  if (!ctx) return "cursor";
  const key = ctx.nounKey;
  return key && key.indexOf("name:") === 0 ? key.slice(5) : "cursor";
};

const describeFilterRow = (row, ctx) => {
  if (row && row.any) return "any of the active filters";
  const field = FILTER_FIELDS.find((f) => f.id === row.field);
  if (!field) return "filter";
  const tag = row.scope === "db" ? " (DB)" : "";
  if (row.dynamic) {
    return `${field.label} follows cursor (${cursorValueFor(row.field, ctx)})${tag}`;
  }
  const op = (FILTER_OPS[field.type] || []).find((o) => o.id === row.op);
  const opLabel = op ? op.label : "";
  if (field.type === "boolean") return `${field.label} ${opLabel}${tag}`;
  if (row.op === "between") {
    return `${field.label} ${opLabel} ${row.value}\u2013${row.value2}`;
  }
  return `${field.label} ${opLabel} ${row.value}`;
};

// Presets stack on top of whatever is already there, but adding a row that is
// already present would just duplicate it, so equivalents are skipped.
const sameRow = (a, b) =>
  a.field === b.field &&
  a.op === b.op &&
  !!a.dynamic === !!b.dynamic &&
  String(a.value) === String(b.value);
const mergeFilterRows = (rows, additions) => [
  ...rows,
  ...additions.filter((n) => !rows.some((r) => sameRow(r, n))),
];

let FILTER_ROW_SEQ = 0;
const newFilterRow = (fieldId, op, value, value2, dynamic, scope) => {
  const field = FILTER_FIELDS.find((f) => f.id === fieldId) || FILTER_FIELDS[0];
  return {
    id: `f${++FILTER_ROW_SEQ}`,
    field: field.id,
    op: op || defaultOpFor(field.type),
    value: value !== undefined ? value : "",
    value2: value2 !== undefined ? value2 : "",
    dynamic: !!dynamic,
    scope: scope || null,
  };
};

const FilterBuilder = ({
  rows,
  setRows,
  optionsFor,
  presets,
  mode,
  setMode,
  ctx,
}) => {
  const update = (id, patch) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return React.createElement(
    "div",
    { className: "flex flex-col gap-2 min-w-[260px]" },
    presets &&
      presets.length > 0 &&
      React.createElement(
        "div",
        { className: "flex flex-wrap gap-1 pb-2 border-b border-slate-200 dark:border-neutral-800" },
        React.createElement(
          "span",
          {
            className:
              "w-full text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-1",
          },
          "Presets",
        ),
        presets.map((p) =>
          React.createElement(
            "button",
            {
              key: p.id,
              onClick: p.apply,
              title: p.hint || "",
              className:
                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800",
            },
            p.label,
          ),
        ),
      ),
    rows.length === 0 &&
      React.createElement(
        "div",
        { className: "text-[11px] italic text-slate-400 py-1" },
        "No filters. Everything is shown.",
      ),
    rows.map((row, idx) => {
      const field = FILTER_FIELDS.find((f) => f.id === row.field) || FILTER_FIELDS[0];
      const ops = FILTER_OPS[field.type] || [];
      const options = field.type === "select" && optionsFor ? optionsFor(field.id) : null;
      const selectCls =
        "bg-transparent border border-slate-200 dark:border-neutral-700 rounded-md px-1.5 py-1 text-[10px] text-slate-600 dark:text-neutral-300 focus:outline-none";
      return React.createElement(
        "div",
        { key: row.id, className: "flex items-center gap-1 flex-wrap" },
        idx === 0
          ? React.createElement(
              "span",
              {
                className:
                  "text-[9px] uppercase tracking-widest text-slate-400 w-12",
              },
              "Where",
            )
          : React.createElement(
              "select",
              {
                value: mode === "or" ? "or" : "and",
                onChange: (e) => setMode && setMode(e.target.value),
                title: "Applies to every filter in this group",
                className:
                  "w-12 bg-transparent border border-slate-200 dark:border-neutral-700 rounded-md px-1 py-0.5 text-[9px] uppercase tracking-widest text-slate-500 focus:outline-none",
              },
              React.createElement("option", { value: "and" }, "And"),
              React.createElement("option", { value: "or" }, "Or"),
            ),
        React.createElement(
          "select",
          {
            value: row.field,
            onChange: (e) => {
              const nf = FILTER_FIELDS.find((f) => f.id === e.target.value);
              update(row.id, {
                field: e.target.value,
                op: defaultOpFor(nf.type),
                value: "",
                value2: "",
              });
            },
            className: selectCls,
          },
          FILTER_FIELDS.map((f) =>
            React.createElement("option", { key: f.id, value: f.id }, f.label),
          ),
        ),
        React.createElement(
          "select",
          {
            value: row.op,
            onChange: (e) => update(row.id, { op: e.target.value }),
            className: selectCls,
          },
          ops.map((o) =>
            React.createElement("option", { key: o.id, value: o.id }, o.label),
          ),
        ),
        row.dynamic
          ? React.createElement(
              "button",
              {
                onClick: () =>
                  update(row.id, {
                    dynamic: false,
                    value: cursorValueFor(row.field, ctx),
                  }),
                title: "Following the cursor \u2014 click to pin this value",
                className:
                  "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 max-w-[120px] truncate",
              },
              cursorValueFor(row.field, ctx),
            )
          : field.type !== "boolean" &&
          (options
            ? React.createElement(
                "select",
                {
                  value: row.value,
                  onChange: (e) => update(row.id, { value: e.target.value }),
                  className: selectCls + " max-w-[110px]",
                },
                React.createElement("option", { value: "" }, "any"),
                options.map((o) =>
                  React.createElement("option", { key: o, value: o }, o),
                ),
              )
            : React.createElement("input", {
                type: field.type === "number" ? "number" : "text",
                step: "any",
                value: row.value,
                placeholder: field.type === "number" ? "0" : "value",
                onChange: (e) => update(row.id, { value: e.target.value }),
                className: selectCls + " w-[74px]",
              })),
        row.op === "between" &&
          React.createElement("input", {
            type: "number",
            step: "any",
            value: row.value2,
            placeholder: "and",
            onChange: (e) => update(row.id, { value2: e.target.value }),
            className: selectCls + " w-[64px]",
          }),
        React.createElement(
          "button",
          {
            onClick: () => setRows(rows.filter((r) => r.id !== row.id)),
            title: "Remove this filter",
            className: "p-1 text-slate-400 hover:text-red-500",
          },
          React.createElement(Icon, { name: "x", className: "w-3 h-3" }),
        ),
      );
    }),
    React.createElement(
      "div",
      { className: "flex items-center gap-2 pt-1" },
      React.createElement(
        "button",
        {
          onClick: () => setRows([...rows, newFilterRow("name")]),
          className:
            "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400",
        },
        React.createElement(Icon, { name: "plus", className: "w-3 h-3" }),
        "Add filter",
      ),
      rows.length > 0 &&
        React.createElement(
          "button",
          {
            onClick: () => setRows([]),
            className:
              "ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600",
          },
          "Clear all",
        ),
    ),
  );
};

const SortControl = ({ fields, sortBy, setSortBy, sortAsc, setSortAsc, compact }) => {
  const active = fields.find((f) => f.field === sortBy) || fields[0];
  return React.createElement(
    "div",
    { className: "flex items-center gap-1 shrink-0" },
    React.createElement(
      "span",
      {
        className:
          "text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500",
      },
      "Sort",
    ),
    React.createElement(
      "select",
      {
        value: active ? active.field : "",
        onChange: (e) => setSortBy(e.target.value),
        className: `appearance-none bg-transparent border border-slate-200 dark:border-neutral-700 rounded-md py-1 pl-2 pr-6 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800 focus:outline-none ${
          compact ? "max-w-[104px]" : ""
        }`,
      },
      fields.map((f) =>
        React.createElement("option", { key: f.field, value: f.field }, f.label),
      ),
    ),
    React.createElement(
      "button",
      {
        onClick: () => setSortAsc(!sortAsc),
        title: sortAsc ? "Ascending" : "Descending",
        "aria-label": sortAsc ? "Sort ascending" : "Sort descending",
        className:
          "p-1 rounded-md border border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800",
      },
      React.createElement(Icon, {
        name: sortAsc ? "arrow-up-narrow-wide" : "arrow-down-wide-narrow",
        className: "w-3.5 h-3.5",
      }),
    ),
  );
};

// Applied filters, stated plainly and individually removable, so an unexpected
// result set is explainable without opening every control.
const FilterChips = ({ chips, onClearAll }) => {
  if (!chips || chips.length === 0) return null;
  return React.createElement(
    "div",
    { className: "flex items-center gap-1.5 flex-wrap" },
    chips.map((c) =>
      React.createElement(
        "button",
        {
          key: c.key,
          onClick: c.onClear,
          title: `Remove ${c.label}`,
          className:
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30",
        },
        c.label,
        React.createElement(Icon, { name: "x", className: "w-3 h-3" }),
      ),
    ),
    chips.length > 1 &&
      React.createElement(
        "button",
        {
          onClick: onClearAll,
          className:
            "text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 underline underline-offset-2",
        },
        "Clear all",
      ),
  );
};

// --- Swatch treatment ------------------------------------------------------
// Material and profile at a glance: a woodgrain hatch for grained visuals and
// an inset frame for Shaker profiles, drawn as an SVG overlay so it stays crisp
// at any size. Traits come from a full SKU (LLCCHHH-GG-Vn-Tn-PP) when one
// exists, otherwise from the row's own Visual_Pattern / Profile columns.

// A product photo is reference texture, not the colour itself. At full
// strength it replaced the swatch — wood decors photograph much darker than
// their anchor colour, so the tile read wrong. Keep it faint enough that the
// swatch still shows its true colour.
const SWATCH_PHOTO_OPACITY = 0.38;

const SWATCH_HATCH_VISUALS = ["V2", "V3", "V4"]; // grained; V1 and V5 stay plain
// A grained *feel* earns the hatch too: T3 linear grain, T4 embossed-in-register.
const SWATCH_HATCH_TACTILES = ["T3", "T4"];

const parseSwatchTraits = (code, item) => {
  let anchor = null, vis = null, prof = null, tac = null;

  if (typeof code === "string" && code.trim()) {
    const parts = code.trim().split("-");
    if (/^\d{7}$/.test(parts[0])) anchor = parts[0];
    parts.slice(1).forEach((p) => {
      const t = p.trim().toUpperCase();
      if (/^V\d$/.test(t)) vis = t;
      else if (/^T\d$/.test(t)) tac = t;
      else if (/^(SL|CS|SS|RD|WG)$/.test(t)) prof = t;
    });
  }

  if (item) {
    if (!vis) {
      // Items carry these as camelCase (visualTexture / doorProfile); the CSV
      // headers are Visual_Pattern / Profile. Accept both.
      const m = String(
        item.visualTexture || item.Visual_Pattern || item.visualPattern || "",
      ).match(/V\d/i);
      if (m) vis = m[0].toUpperCase();
    }
    if (!tac) {
      const m = String(
        item.tactileTexture || item.Tactile_Texture || "",
      ).match(/T\d/i);
      if (m) tac = m[0].toUpperCase();
    }
    if (!prof) {
      const raw = String(
        item.doorProfile || item.Profile || item.profile || "",
      ).toUpperCase();
      const m = raw.match(/\b(SL|CS|SS|RD|WG)\b/);
      if (m) prof = m[1];
      else if (raw.includes("SLIM")) prof = "SS";
      else if (raw.includes("SHAKER")) prof = "CS";
      else if (raw.includes("SLAB") || raw.includes("FLAT")) prof = "SL";
    }
    if (!anchor) {
      const e = String(item.erpCode || item.ERP_Code || "");
      const m = e.match(/^(\d{7})/);
      if (m) anchor = m[1];
    }
  }

  // Lightness drives whether the treatment reads dark-on-light or light-on-dark.
  let LL = null;
  if (anchor) LL = parseInt(anchor.slice(0, 2), 10);
  else if (item && typeof item.L === "number") LL = Math.round(item.L * 100);

  // TODO: RD (raised panel) and WG (glass) have no treatment yet — slab for now.
  if (prof === "RD" || prof === "WG") prof = "SL";

  return {
    hatch:
      (!!vis && SWATCH_HATCH_VISUALS.indexOf(vis) !== -1) ||
      (!!tac && SWATCH_HATCH_TACTILES.indexOf(tac) !== -1),
    profile: prof || "SL",
    light: LL === null ? true : LL >= 52, // >= 52 means a light colour -> dark ink
    visual: vis,
    tactile: tac,
  };
};

const swatchTraitLabel = (t) =>
  [
    t.hatch ? "wood or textured laminate" : null,
    t.profile === "CS" ? "Classic Shaker" : t.profile === "SS" ? "Slim Shaker" : "slab",
  ]
    .filter(Boolean)
    .join(", ");

// Wavy vertical strokes: 2–3 soft S-curves with small offsets so it reads as
// grain rather than stripes. Deterministic per index so it doesn't shimmer on
// re-render.
const swatchGrainPath = (x, seed) => {
  const wobble = (n) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1) * 6 - 3;
  const x0 = x + wobble(1) * 0.3;
  return (
    `M ${x0} 0 ` +
    `C ${x0 + wobble(2)} 20, ${x0 + wobble(3)} 30, ${x0 + wobble(4) * 0.6} 50 ` +
    `C ${x0 + wobble(5)} 68, ${x0 + wobble(6)} 78, ${x0 + wobble(7) * 0.4} 100`
  );
};

const SwatchTreatment = ({ code, item, size = 48, faded = 1 }) => {
  const t = parseSwatchTraits(code, item);
  if (!t.hatch && t.profile === "SL") return null;

  const px = Math.max(8, size);
  const kids = [];

  if (t.hatch) {
    // ~9 strokes on a large swatch, never fewer than 2, spacing roughly constant
    const n = Math.max(2, Math.min(9, Math.round(px / 14)));
    const step = 100 / (n + 1);
    const stroke = t.light ? "#000000" : "#FFFFFF";
    const op = (t.light ? 0.2 : 0.22) * faded;
    for (let i = 1; i <= n; i++) {
      kids.push(
        React.createElement("path", {
          key: `g${i}`,
          d: swatchGrainPath(step * i, i),
          fill: "none",
          stroke,
          strokeOpacity: op,
          strokeWidth: 0.67,
          vectorEffect: "non-scaling-stroke",
          strokeLinecap: "round",
        }),
      );
    }
  }

  if (t.profile === "CS" || t.profile === "SS") {
    // Inset mirrors real stile/rail widths: ~50–60 mm vs ~13–25 mm.
    const pct = t.profile === "CS" ? 20 : 6;
    const minPx = t.profile === "CS" ? 5 : 2;
    const inset = Math.max(pct, (minPx / px) * 100);
    kids.push(
      React.createElement("rect", {
        key: "frame",
        x: inset,
        y: inset,
        width: Math.max(0, 100 - inset * 2),
        height: Math.max(0, 100 - inset * 2),
        fill: "none",
        stroke: t.light ? "#000000" : "#FFFFFF",
        strokeOpacity: (t.light ? 0.45 : 0.55) * faded,
        strokeWidth: 1.33,
        vectorEffect: "non-scaling-stroke",
      }),
    );
  }

  return React.createElement(
    "svg",
    {
      className: "absolute inset-0 w-full h-full pointer-events-none",
      viewBox: "0 0 100 100",
      preserveAspectRatio: "none",
      "aria-hidden": "true",
      focusable: "false",
    },
    kids,
  );
};

// A complete swatch: colour fill, treatment overlay, rounded corners, border.
// Always square and always the same size regardless of profile.
const ColorSwatch = ({
  code, item, hex, size = 48, faded = 1, label,
  className = "", style = {}, onClick, title, children,
}) => {
  const t = parseSwatchTraits(code, item);
  const aria = label
    ? `${label}, ${swatchTraitLabel(t)}`
    : swatchTraitLabel(t);
  return React.createElement(
    "div",
    {
      className: `relative overflow-hidden rounded border border-black/10 dark:border-white/10 ${className}`,
      style: { width: `${size}px`, height: `${size}px`, backgroundColor: hex, ...style },
      onClick,
      title: title || aria,
      role: "img",
      "aria-label": aria,
    },
    React.createElement(SwatchTreatment, { code, item, size, faded }),
    children,
  );
};

// Legend for any view showing swatches in bulk; each entry is a mini swatch
// carrying its own treatment.
const SwatchLegend = ({ className = "" }) => {
  const entries = [
    { code: "5304059-ST-V3-T4-CS", label: "Shaker" },
    { code: "5304059-ST-V3-T4-SS", label: "Slim" },
    { code: "5304059-ST-V3-T4-SL", label: "Slab" },
    { code: "5604065-MT-V2-T3-SL", label: "Wood / textured" },
  ];
  return React.createElement(
    "div",
    {
      className: `flex items-center gap-3 flex-wrap text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 ${className}`,
    },
    entries.map((e) =>
      React.createElement(
        "span",
        { key: e.label, className: "flex items-center gap-1.5" },
        React.createElement(ColorSwatch, {
          code: e.code,
          hex: "#b9a88f",
          size: 18,
          label: e.label,
        }),
        e.label,
      ),
    ),
  );
};





// --- Cross-reference between two suppliers ---------------------------------
// "Which of my Tafisa colours could I get from Uniboard instead?" For every
// colour in the source brand, find its nearest colour in the target brand and
// report the distance, so overlaps and gaps are both visible.

const crossRefDeltaE = (p, q) => {
  // deltaE OK is euclidean distance in OKLab; the app reports it x100.
  const dL = p.L - q.L, da = p.a - q.a, db = p.b - q.b;
  return Math.sqrt(dL * dL + da * da + db * db) * 100;
};

// The same five traits the "Exact material match" preset copies, so the two
// features agree on what "same material" means.
const CROSSREF_SPEC_FIELDS = [
  "material",
  "sheen",
  "doorProfile",
  "visualTexture",
  "tactileTexture",
];
const crossRefSameSpec = (p, q) =>
  CROSSREF_SPEC_FIELDS.every(
    (f) => String(p[f] || "").trim() === String(q[f] || "").trim(),
  );

const crossRefPrep = (list) =>
  (list || [])
    .filter((c) => isFinite(c.L) && isFinite(c.C) && isFinite(c.H))
    .map((c) => {
      const rad = (c.H * Math.PI) / 180;
      return {
        ...c,
        a: c.C * Math.sin(rad),
        b: c.C * Math.cos(rad),
      };
    });

const CrossReference = ({ colorData, onSelectColor }) => {
  const brands = useMemo(
    () => Object.keys(colorData || {}).sort(),
    [colorData],
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [maxDE, setMaxDE] = useState(2);
  const [mode, setMode] = useState("matched");
  const [matchMaterial, setMatchMaterial] = useState(false);

  useEffect(() => {
    if (!from && brands.length) setFrom(brands[0]);
    if (!to && brands.length > 1) setTo(brands[1]);
  }, [brands, from, to]);

  const rows = useMemo(() => {
    if (!from || !to || from === to || !colorData) return [];
    const src = crossRefPrep(colorData[from]);
    const dst = crossRefPrep(colorData[to]);
    if (!src.length || !dst.length) return [];
    return src
      .map((s) => {
        let best = null, bestD = Infinity;
        for (const d of dst) {
          if (matchMaterial && !crossRefSameSpec(s, d)) continue;
          const dE = crossRefDeltaE(s, d);
          if (dE < bestD) { bestD = dE; best = d; }
        }
        return { source: s, match: best, dE: best ? bestD : Infinity };
      })
      .filter((r) => (mode === "matched" ? r.dE <= maxDE : r.dE > maxDE))
      .sort((x, y) => x.dE - y.dE);
  }, [colorData, from, to, maxDE, mode, matchMaterial]);

  const total = (colorData && colorData[from] && colorData[from].length) || 0;

  const swatch = (c, size) =>
    c
      ? React.createElement(ColorSwatch, {
          item: c,
          hex: c.hex ||
            (() => {
              try {
                return new Color("oklch", [c.L, c.C, c.H])
                  .toGamut({ space: "srgb" })
                  .toString({ format: "hex" });
              } catch (e) {
                return "#cccccc";
              }
            })(),
          size,
          label: c.name,
        })
      : null;

  const select = (c) => {
    if (c && onSelectColor) onSelectColor([c.L, c.C, c.H], c.spectral || null);
  };

  const sel = (value, onChange, opts, key) =>
    React.createElement(
      "select",
      {
        value,
        onChange: (e) => onChange(e.target.value),
        className:
          "flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1 text-[11px]",
        key,
      },
      opts.map((b) =>
        React.createElement("option", { key: b, value: b }, b),
      ),
    );

  return React.createElement(
    "div",
    { className: "flex flex-col gap-3" },
    React.createElement(
      "div",
      { className: "flex items-center gap-2" },
      sel(from, setFrom, brands, "from"),
      React.createElement(
        "span",
        { className: "text-[10px] font-bold text-slate-400 shrink-0" },
        "\u2192",
      ),
      sel(to, setTo, brands, "to"),
    ),
    React.createElement(
      "div",
      { className: "flex items-center gap-2" },
      React.createElement(
        "span",
        { className: "text-[10px] font-bold uppercase tracking-wider text-slate-400" },
        "\u0394E \u2264",
      ),
      React.createElement("input", {
        type: "range",
        min: "0.5",
        max: "10",
        step: "0.5",
        value: maxDE,
        onChange: (e) => setMaxDE(parseFloat(e.target.value)),
        className: "flex-1 accent-sky-500",
      }),
      React.createElement(
        "span",
        { className: "text-[10px] font-mono w-7 text-right" },
        maxDE.toFixed(1),
      ),
    ),
    React.createElement(
      "div",
      { className: "flex items-center gap-1" },
      ["matched", "gaps"].map((m) =>
        React.createElement(
          "button",
          {
            key: m,
            onClick: () => setMode(m),
            "aria-pressed": mode === m,
            className: `px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              mode === m
                ? "bg-slate-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
            }`,
          },
          m === "matched" ? "Has equivalent" : "No equivalent",
        ),
      ),
      React.createElement(
        "label",
        {
          className:
            "ml-auto flex items-center gap-1 text-[10px] text-slate-500 dark:text-neutral-400 cursor-pointer",
          title:
            "Match material, sheen, profile, visual pattern and tactile texture",
        },
        React.createElement("input", {
          type: "checkbox",
          checked: matchMaterial,
          onChange: (e) => setMatchMaterial(e.target.checked),
          className: "accent-sky-500",
        }),
        "Same spec",
      ),
    ),
    React.createElement(
      "div",
      { className: "text-[10px] text-slate-400 dark:text-neutral-500" },
      from === to
        ? "Pick two different brands."
        : `${rows.length} of ${total} ${from} colors ${
            mode === "matched" ? "have" : "have no"
          } a ${to} equivalent within \u0394E ${maxDE.toFixed(1)}`,
    ),
    React.createElement(
      "div",
      { className: "flex flex-col gap-1 max-h-72 overflow-y-auto custom-scrollbar" },
      rows.slice(0, 200).map((r, i) =>
        React.createElement(
          "div",
          {
            key: r.source.name + i,
            className:
              "flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-neutral-800/50",
          },
          React.createElement(
            "button",
            {
              onClick: () => select(r.source),
              className: "shrink-0",
              title: r.source.name,
            },
            swatch(r.source, 26),
          ),
          React.createElement(
            "div",
            { className: "flex-1 min-w-0" },
            React.createElement(
              "div",
              { className: "text-[10px] font-bold truncate" },
              r.source.name,
            ),
            React.createElement(
              "div",
              { className: "text-[9px] text-slate-400 truncate" },
              r.match ? r.match.name : "no candidate",
            ),
          ),
          r.match &&
            React.createElement(
              "span",
              {
                className: `text-[9px] font-mono shrink-0 ${
                  r.dE <= 1
                    ? "text-emerald-600"
                    : r.dE <= 2
                      ? "text-sky-600"
                      : "text-slate-400"
                }`,
              },
              r.dE === Infinity ? "\u2014" : r.dE.toFixed(2),
            ),
          r.match &&
            React.createElement(
              "button",
              {
                onClick: () => select(r.match),
                className: "shrink-0",
                title: r.match.name,
              },
              swatch(r.match, 26),
            ),
        ),
      ),
      rows.length > 200 &&
        React.createElement(
          "div",
          { className: "text-[9px] text-slate-400 p-1" },
          `Showing the closest 200 of ${rows.length}.`,
        ),
    ),
  );
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
  showSpecs,
  // Catalog sorts upstream with the global control; without this the swatches
  // re-sort themselves and the global control looks broken.
  externalSort,
  // Optional per-tile actions, so the swatch view can offer the same
  // duplicate/remove controls the table rows have.
  onDuplicateItem,
  onRemoveItem,
  onEditItem,
}) => {
  const [sortBy, setSortBy] = useState(dim1);
  const [sortAsc, setSortAsc] = useState(true);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const baseMatrixSize = 48;
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
    // A caller that has already ordered the list keeps that order — but still
    // needs the gamut flag, which is computed in the map after the sort below.
    const withGamut = (list) =>
      list.map((item) => ({
        ...item,
        _inGamut:
          item.inSrgb !== void 0
            ? item.inSrgb
            : new Color("oklch", [item.L, item.C, item.H]).inGamut("srgb"),
      }));
    if (externalSort) return withGamut(filtered);
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
  }, [
    items,
    sortBy,
    sortAsc,
    viewportSearchQuery,
    viewportTagFilter,
    externalSort,
  ]);
  // Full-size photo, opened from the eye button in any layout.
  const imagePreview =
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
          className: "max-w-full max-h-full object-contain rounded shadow-2xl",
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
    );
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
                        React.createElement(SwatchTreatment, {
                          item,
                          size: baseMatrixSize * swatchZoom,
                        }),
                        (item.image || item.note?.startsWith("http")) &&
                          React.createElement("div", {
                            className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                            style: {
                              backgroundImage: `url(${item.image || item.note})`,
                              opacity: SWATCH_PHOTO_OPACITY,
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
      imagePreview,
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
                      className: "w-8 h-8 rounded relative shadow-sm overflow-hidden",
                      style: {
                        backgroundColor: item.hex,
                      },
                    },
                    React.createElement(SwatchTreatment, { item, size: 32 }),
                    (item.image || item.note?.startsWith("http")) &&
                      React.createElement("div", {
                        className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                        style: {
                          backgroundImage: `url(${item.image || item.note})`,
                          opacity: SWATCH_PHOTO_OPACITY,
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
      imagePreview,
    );
  }
  return React.createElement(
    "div",
    {
      className:
        "absolute inset-0 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 dark:bg-neutral-900/50 col-span-full",
    },
    !externalSort &&
      React.createElement(
      "div",
      {
        className:
          "flex flex-wrap items-center gap-2 mb-6 sticky top-0 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur z-10 p-2 rounded-lg border border-slate-200/50 dark:border-neutral-800/50 shadow-sm",
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
            className: `flex flex-col gap-2 group cursor-pointer transition-all items-center ${
              showSpecs
                ? "border border-slate-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 p-2"
                : ""
            }`,
            style: { width: `${(showSpecs ? 82 : 72) * swatchZoom}px` },
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
            React.createElement(SwatchTreatment, { item, size: 96 }),
            (onDuplicateItem || onRemoveItem) &&
              React.createElement(
                "div",
                {
                  className:
                    "absolute top-1 right-1 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity",
                },
                onDuplicateItem &&
                  React.createElement(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        onDuplicateItem(item);
                      },
                      title: "Duplicate pin",
                      className:
                        "bg-sky-500 text-white p-1 rounded-full shadow hover:bg-sky-600",
                    },
                    React.createElement(Icon, { name: "copy", className: "w-3 h-3" }),
                  ),
                onRemoveItem &&
                  React.createElement(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        onRemoveItem(item);
                      },
                      title: "Remove pin",
                      className:
                        "bg-slate-800 text-white p-1 rounded-full shadow hover:bg-slate-900",
                    },
                    React.createElement(Icon, { name: "x", className: "w-3 h-3" }),
                  ),
              ),
            (item.image || item.note?.startsWith("http")) &&
              React.createElement("div", {
                className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                style: {
                  backgroundImage: `url(${item.image || item.note})`,
                  opacity: SWATCH_PHOTO_OPACITY,
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
                  color: item.L > 0.65 ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.95)",
                  textShadow:
                    item.image || item.note?.startsWith("http")
                      ? item.L > 0.65
                        ? "0 0 3px rgba(255,255,255,0.8)"
                        : "0 0 3px rgba(0,0,0,0.7)"
                      : undefined,
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
            // Catalog reads like the printed Avery labels: the spec line under
            // each swatch, in the same order as the label.
            showSpecs &&
              React.createElement(
                "div",
                {
                  className:
                    "w-full flex flex-col items-center text-slate-500 dark:text-neutral-400 leading-tight",
                  style: {
                    fontSize: `${Math.max(4.5, 5.5 * swatchZoom)}px`,
                    marginTop: `${Math.max(1, 2 * swatchZoom)}px`,
                  },
                },
                [
                  { label: "Material", key: "material", options: LABEL_OPTIONS.material },
                  { label: "Sheen", key: "sheen", options: LABEL_OPTIONS.sheen },
                  { label: "Vis. Pattern", key: "visualTexture", options: LABEL_OPTIONS.visualPattern },
                  { label: "Tac. Texture", key: "tactileTexture", options: LABEL_OPTIONS.tactileTexture },
                  { label: "Profile", key: "doorProfile", options: LABEL_OPTIONS.doorProfile },
                ].map((f) =>
                  // Editable here too, so the swatch view is not a read-only
                  // copy of the table.
                  onEditItem
                    ? React.createElement(
                        "select",
                        {
                          key: f.key,
                          value: item[f.key] || "-",
                          title: f.label,
                          onClick: (e) => e.stopPropagation(),
                          onChange: (e) => {
                            e.stopPropagation();
                            onEditItem(item, f.key, e.target.value === "-" ? "" : e.target.value);
                          },
                          className:
                            "w-full bg-transparent border border-slate-200 dark:border-neutral-700 rounded px-0.5 text-center cursor-pointer hover:border-slate-400",
                          style: { fontSize: "inherit" },
                        },
                        f.options.map((opt) =>
                          React.createElement("option", { key: opt, value: opt }, opt),
                        ),
                      )
                    : React.createElement(
                        "span",
                        { key: f.key, className: "truncate w-full text-center italic" },
                        `${f.label}: ${String(item[f.key] || "-").trim()}`,
                      ),
                ),
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
    imagePreview,
  );
};
// Wraps a view so it skips re-rendering when only callback identities changed
// (the parent recreates them on every render). Callbacks still reach the
// latest version through a ref, so nothing goes stale.
const withStableCallbacks = (Comp) => {
  const Inner = React.memo(Comp);
  return (props) => {
    const ref = useRef(props);
    ref.current = props;
    const cache = useRef({});
    const next = {};
    for (const k in props) {
      const v = props[k];
      if (typeof v === "function") {
        if (!cache.current[k]) cache.current[k] = (...a) => (ref.current[k] ? ref.current[k](...a) : undefined);
        next[k] = cache.current[k];
      } else next[k] = v;
    }
    return React.createElement(Inner, next);
  };
};
// Long lists mount a page at a time; the next page loads as the end of the
// list scrolls into view (or on click).
const LoadMoreSentinel = ({ onMore, left }) => {
  const ref = useRef(null);
  const cb = useRef(onMore);
  cb.current = onMore;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) cb.current(); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [left]);
  return React.createElement(
    "button",
    { ref, onClick: () => cb.current(), className: "w-full py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200" },
    `Show more (${left} more)`,
  );
};
const ViewPinsInner = ({
  handlePointClick,
  swatchZoom = 1,
  setSwatchZoom,
  globalSortBy,
  globalSortAsc,
  globalFilters,
  globalFilterMode,
  sameGroupContext,
  names,
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
  // Sorting is driven by the global bar; these remain only as a fallback for
  // any caller that does not supply it.
  const sortBy = globalSortBy !== undefined ? globalSortBy : "layer";
  const sortAsc = globalSortAsc !== undefined ? globalSortAsc : true;
  const [tagFilter, setTagFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  // Catalog now offers the same three presentations as the other views.
  const [catalogView, setCatalogView] = useState("table");
  const [tableLimit, setTableLimit] = useState(60);
  const [showSpecs, setShowSpecs] = useState(true);
  const [editForm, setEditForm] = useState({
    id: "",
    noun: "",
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
        color: new Color("oklch", [L, C, H])
          .clone()
          .toGamut({ space: "srgb" })
          .toString({ format: "hex" }),
        nameOverride: editForm.noun || "",
        notes: editForm.notes || "",
      },
    }));
    setIsAdding(false);
    setEditForm({
      id: "",
      noun: "",
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
        const { displayName } = getInheritedPinNames(sc, savedColors, names);
        return {
          ...sc,
          displayName: (displayName || "Unnamed").trim(),
          isNameOverridden: !!sc.nameOverride,
          displayNotes: sc.notes || dictNotes[sc.anchorId] || "",
          tags: dictTags[sc.id] || [],
        };
      });
  }, [savedColors, names, dictNotes, dictTags]);

  // The global filter bar has to reach the catalog too; pins were previously
  // the only surface it never touched. Pins are not DB rows, so this runs in
  // viewport scope (the DB-scoped spectral row must not hide them).
  const filteredPinItems = useMemo(() => {
    if (!globalFilters || !globalFilters.length) return pinItems;
    const decorated = pinItems.map((p, i) => ({
      ...p,
      __idx: i,
      displayName: p.displayName,
      name: p.displayName,
    }));
    return applyGlobalFilters(
      decorated,
      globalFilters,
      sameGroupContext,
      globalFilterMode,
      "viewport",
    ).items.map((k) => pinItems[k.__idx]);
  }, [pinItems, globalFilters, globalFilterMode, sameGroupContext]);

  const allTags = useMemo(
    () => Array.from(new Set(pinItems.flatMap((item) => item.tags))).sort(),
    [pinItems],
  );
  const sortedItems = useMemo(() => {
    let items = [...filteredPinItems];
    if (tagFilter) {
      // Tags are compared case-insensitively everywhere else; an exact
      // includes() here missed "Core" against a stored "core".
      const tf = String(tagFilter).toLowerCase().trim();
      items = items.filter((item) =>
        (item.tags || []).some((t) => String(t).toLowerCase().trim() === tf),
      );
    }
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
          valA = a.H;
          valB = b.H;
          break;
        // Fields coming from the global sort control
        case "lightness":
          valA = a.L;
          valB = b.L;
          break;
        case "chroma":
          valA = a.C;
          valB = b.C;
          break;
        case "deltae":
          valA = a._d ?? 999;
          valB = b._d ?? 999;
          break;
        case "brand":
        case "material":
        case "sheen":
        case "doorProfile":
        case "visualTexture":
        case "tactileTexture": {
          const sa = String(a[sortBy] || "").toLowerCase();
          const sb = String(b[sortBy] || "").toLowerCase();
          if (sa === sb) return a.H - b.H;
          return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
        }
        default:
          valA = a.H;
          valB = b.H;
          break;
      }
      if (valA === valB) return a.C - b.C;
      return sortAsc ? (valA < valB ? -1 : 1) : valB < valA ? -1 : 1;
    });
  }, [filteredPinItems, sortBy, sortAsc, tagFilter, searchTerm]);
  const handleUnlock = (id) => {
    setSavedColors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  // Plain render helper, not a component: defining a component inside render
  // gives it a new type each pass, so React remounted every header button.
  const handleSelectAll = () => {
    if (selectedIds.length === filteredPinItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPinItems.map((i) => i.id));
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
        React.createElement(SwatchLegend, { className: "ml-3" }),
        catalogView !== "table" &&
          setSwatchZoom &&
          React.createElement(
            "div",
            { className: "flex items-center gap-2 ml-3" },
            React.createElement(Icon, {
              name: "zoom-in",
              className: "w-3.5 h-3.5 text-slate-400",
            }),
            React.createElement("input", {
              type: "range",
              min: "0.1",
              max: "5",
              step: "0.1",
              value: swatchZoom,
              onChange: (e) => setSwatchZoom(parseFloat(e.target.value)),
              className:
                "w-24 accent-sky-500 opacity-60 hover:opacity-100 transition-opacity",
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
        catalogView === "swatches" &&
          React.createElement(
            "button",
            {
              onClick: () => setShowSpecs(!showSpecs),
              "aria-pressed": showSpecs,
              title: "Show material properties under each swatch",
              className: `ml-2 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                showSpecs
                  ? "bg-slate-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
              }`,
            },
            "Specs",
          ),
        React.createElement(
          "div",
          { className: "flex items-center gap-1 ml-2" },
          ["table", "matrix", "swatches"].map((m) =>
            React.createElement(
              "button",
              {
                key: m,
                onClick: () => setCatalogView(m),
                "aria-pressed": catalogView === m,
                className: `px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  catalogView === m
                    ? "bg-slate-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                }`,
              },
              m,
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      {
        // In swatch modes ViewportSwatches owns the scrolling, so this
        // container must not scroll too or the grid gets clipped.
        className: `flex-1 custom-scrollbar px-4 pb-10 ${
          catalogView === "table"
            ? "overflow-y-auto"
            : "overflow-hidden flex flex-col min-h-0"
        }`,
      },
      React.createElement(
        "div",
        {
          className: `flex flex-col gap-3 ${
            catalogView === "table" ? "" : "flex-1 min-h-0"
          }`,
        },
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
                placeholder: "Name (optional; otherwise the nearest anchor's)",
                className:
                  "flex-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs focus:ring-1 outline-none",
                value: editForm.noun,
                onChange: (e) =>
                  setEditForm({ ...editForm, noun: e.target.value }),
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
        catalogView !== "table"
          ? React.createElement(
              "div",
              {
                // ViewportSwatches roots every layout at `absolute inset-0`.
                // Without its own positioned box it escapes to the panel and
                // paints over the catalog's toolbar.
                className: "relative w-full flex-1 min-h-[420px] md:min-h-0",
              },
              React.createElement(ViewportSwatches, {
              // Same component the other views use, fed the catalog's own
              // already-filtered and sorted pins.
              items: sortedItems.map((item) => ({
                ...item,
                type: "pin",
                displayName: item.displayName || item.id,
                hex: lchDisplayHex(item.L, item.C, item.H),
              })),
              layout: catalogView === "matrix" ? "matrix" : "gallery",
              swatchZoom,
              externalSort: true,
              showSpecs: catalogView === "swatches" && showSpecs,
              onDuplicateItem: (it) => handleDuplicatePin(it.id),
              onRemoveItem: (it) => handleUnlock(it.id),
              onEditItem: (it, key, value) =>
                setSavedColors((prev) => ({
                  ...prev,
                  [it.id]: { ...prev[it.id], [key]: value },
                })),
              dim1: "L",
              dim2: "C",
              dim1Labels: (v) => `L: ${Number(v).toFixed(3)}`,
              dim2Labels: (v) => `C: ${Number(v).toFixed(2)}`,
              handlePointClick,
              viewportSearchQuery: "",
              viewportTagFilter: "",
              crosshair: null,
              selectedIds,
              setSelectedIds,
              }),
            )
          : null,
        catalogView === "table" &&
        sortedItems.slice(0, tableLimit).map((item) =>
          React.createElement(
            "div",
            {
              key: item.id,
              className: `flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-5 bg-white dark:bg-neutral-900 p-3.5 rounded-xl border shadow-sm w-full relative group transition-colors ${selectedIds.includes(item.id) ? "border-sky-500 ring-1 ring-sky-500" : "border-slate-200 dark:border-neutral-800"}`,
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
              React.createElement(SwatchTreatment, { item, size: 56 }),
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
                  "flex flex-col w-full sm:w-40 sm:flex-shrink-0 border-t sm:border-t-0 sm:border-r border-slate-100 dark:border-neutral-800 pt-2 sm:pt-0 sm:pr-4",
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
              { className: "flex-1 flex flex-col justify-center min-w-0 sm:pr-4 py-1" },
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
                { className: "grid grid-cols-4 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-auto" },
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
              { className: "flex flex-row sm:flex-col gap-3 sm:gap-0 items-center sm:items-end w-full sm:w-24 sm:flex-shrink-0 sm:pr-4" },
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
      catalogView === "table" &&
        sortedItems.length > tableLimit &&
        React.createElement(LoadMoreSentinel, {
          left: sortedItems.length - tableLimit,
          onMore: () => setTableLimit((n) => n + 150),
        }),
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
const ViewPins = withStableCallbacks(ViewPinsInner);
const ViewGroups = ({ settings, setSettings }) => {
  const updateSetting = (key, val) => setSettings({ ...settings, [key]: val });
  const updateHue = (index, field, val) => {
    const newHues = [...settings.hues];
    newHues[index] = { ...newHues[index], [field]: val };
    setSettings({ ...settings, hues: newHues });
  };
  const onBlurSort = () => {
    const newHues = [...settings.hues].sort(
      (a, b) => hueCenterOf(a, settings.hues) - hueCenterOf(b, settings.hues),
    );
    setSettings({ ...settings, hues: newHues });
  };
  const addHue = () => {
    const newHues = [
      ...settings.hues,
      { id: crypto.randomUUID(), name: "New Color", centerH: 0 },
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
                  hueCenterOf(hue, settings.hues),
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
                "Midpoint (H\u00b0)",
              ),
              React.createElement("input", {
                type: "number",
                min: 0,
                max: 360,
                value: hueCenterOf(hue, settings.hues),
                onChange: (e) =>
                  updateHue(i, "centerH", parseFloat(e.target.value) || 0),
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
  currentNotes = {},
  currentTags = {},
  currentGroupSettings = null,
  currentSavedPalettes = [],
) => {
  // Records are never edited in place below (each change writes a new object),
  // so shallow copies are enough. Deep-copying everything loaded so far, once
  // per file, made a 20-file load quadratic.
  const newColorData = currentColorData ? { ...currentColorData } : {};
  const newSavedColors = currentSavedColors ? { ...currentSavedColors } : {};
  const newNames = currentNames ? { ...currentNames } : {};
  const newNotes = currentNotes ? { ...currentNotes } : {};
  const newTags = currentTags ? { ...currentTags } : {};
  const newSavedPalettes = currentSavedPalettes ? currentSavedPalettes.slice() : [];
  // Brand lists are copied on first write; names are looked up through an index
  // instead of a scan of the whole list for every row.
  const brandCopied = new Set();
  const brandNameIdx = {};
  const brandListFor = (brand) => {
    if (!brandCopied.has(brand)) {
      newColorData[brand] = newColorData[brand] ? newColorData[brand].slice() : [];
      brandCopied.add(brand);
      const idx = new Map();
      newColorData[brand].forEach((c, i) => {
        const k = String((c && c.name) || "").toLowerCase();
        if (!idx.has(k)) idx.set(k, i);
      });
      brandNameIdx[brand] = idx;
    }
    return newColorData[brand];
  };
  let newGroupSettings = currentGroupSettings
    ? JSON.parse(JSON.stringify(currentGroupSettings))
    : null;
  let colorsAdded = 0;
  let pinsAdded2 = 0;
  let hasNeutrals = false;
  let hasHues = false;
  let hasOverrides = false;
  parsedData.forEach((rawRow) => {
    const row = normalizeCsvRow(rawRow);
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
          const hh = parseFloat(row.OKLCH_H);
          pL = parseFloat(row.OKLCH_L);
          pC = parseFloat(row.OKLCH_C);
          pH = isNaN(hh) ? 0 : ((hh % 360) + 360) % 360;
        } else if (row.HEX) {
          const f = fastHexToOklch(row.HEX);
          if (f) {
            pL = f[0];
            pC = f[1];
            pH = isNaN(f[2]) ? 0 : f[2];
          }
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
        brandListFor(finalBrand);
        const nameKeyLc = name.toLowerCase();
        const existingIdx = brandNameIdx[finalBrand].has(nameKeyLc)
          ? brandNameIdx[finalBrand].get(nameKeyLc)
          : -1;
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
          brandNameIdx[finalBrand].set(nameKeyLc, newColorData[finalBrand].length);
          newColorData[finalBrand].push(colorObj);
        }
        colorsAdded++;
      }
    } else if (targetType === "PIN" && pL !== null) {
      // Two pins can share a colour and differ only by profile (the same door
      // in Shaker and Slim), so the fallback id must include the traits or
      // they collide and one overwrites the other.
      const traitKey = [
        row.Profile || row.doorProfile || "",
        row.Sheen || row.sheen || "",
        row.Visual_Pattern || row.visualTexture || "",
        row.Tactile_Texture || row.tactileTexture || "",
        row.Material || row.material || "",
      ]
        .map((v) => String(v).trim())
        .join("|");
      const traitSlug = traitKey.replace(/[^A-Za-z0-9]+/g, "").slice(0, 24);
      const explicitId = row.ID || row.Id || row.Pin_ID || row.PinId;
      let pinId =
        explicitId ||
        `pin-${pL.toFixed(4)}-${pC.toFixed(4)}-${pH.toFixed(4)}${
          traitSlug ? "-" + traitSlug : ""
        }`;
      if (!explicitId) {
        // still colliding (identical colour and traits) — keep both
        let n = 2;
        const root = pinId;
        while (newSavedColors[pinId]) pinId = `${root}-${n++}`;
      }

      // Drop an existing pin only when it is the same colour AND the same
      // door: matching on coordinates alone deleted the Shaker when its Slim
      // twin was imported.
      const sameTraits = (sc) =>
        [
          [sc.doorProfile, row.Profile || row.doorProfile],
          [sc.sheen, row.Sheen || row.sheen],
          [sc.visualTexture, row.Visual_Pattern || row.visualTexture],
          [sc.tactileTexture, row.Tactile_Texture || row.tactileTexture],
          [sc.material, row.Material || row.material],
        ].every(
          ([a, b]) => String(a || "").trim() === String(b || "").trim(),
        );
      Object.keys(newSavedColors).forEach((k) => {
        const sc = newSavedColors[k];
        if (
          sc.type === "pin" &&
          Math.abs(sc.L - pL) < 0.0001 &&
          Math.abs(sc.C - pC) < 0.0001 &&
          Math.abs(sc.H - pH) < 0.0001 &&
          k !== pinId &&
          sameTraits(sc)
        ) {
          delete newSavedColors[k];
        }
      });

      const a = pC * Math.sin((pH * Math.PI) / 180);
      const b = pC * Math.cos((pH * Math.PI) / 180);
      const anchorId =
        row.Anchor_ID || row.AnchorId || row.anchorId || (row.Anchor ? String(row.Anchor) : null);
      const parentPinId =
        row.Parent_Pin_ID ||
        row.ParentPinId ||
        row.parentPinId ||
        row.Parent_ID ||
        row.ParentId ||
        row.Parent ||
        null;
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
        // A pin stores only its position; its name comes from whichever anchor
        // currently covers that position. Only an explicit override column
        // pins the name down, so re-importing never freezes stale names.
        nameOverride:
          row.Noun_Override || row.NounOverride || row.nameOverride || "",
        notes: row.Note || "",
        erpCode: row.ERP_Code || getExactErpCode(pL, pC, pC === 0 ? 0 : pH),
        sheen: (row.Sheen || row.sheen || "").trim(),
        doorProfile: (row.Profile || row.Door_Profile || row.DoorProfile || row.doorProfile || "").trim(),
        visualTexture: (row.Visual_Pattern || row.VisualPattern || row.Visual_Texture || row.VisualTexture || row.visualTexture || "").trim(),
        tactileTexture: (row.Tactile_Texture || row.TactileTexture || row.tactileTexture || "").trim(),
        material: (row.Material || row.material || "").trim(),
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
          ? `anchor-${Math.round(C * 100).toString().padStart(2, "0")}-${Math.round(H).toString().padStart(3, "0")}-${Math.round(pL * 100)}`
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
        if (pL !== null && pC !== null && pH !== null) {
          newSavedColors[id] = {
            id,
            type: "nounColumn",
            nameOverride: row.Noun || "",
            C: pC,
            H: pH,
            minL: pL,
            maxL: pL,
            a: pC * Math.sin((pH * Math.PI) / 180),
            b: pC * Math.cos((pH * Math.PI) / 180),
            notes: row.Note || "",
          };
        }
      }
    }
  });
  return {
    newColorData,
    newSavedColors,
    newNames,
    newNotes,
    newTags,
    colorsAdded,
    pinsAdded: pinsAdded2,
    newGroupSettings,
    newSavedPalettes,
  };
};
// --- GitHub sync -----------------------------------------------------------
// This app is a static page with no backend, so there is nowhere to keep an
// OAuth client secret and no server to run the code-for-token exchange.
// GitHub's device flow doesn't send CORS headers either, so it can't be driven
// from the browser. That leaves a fine-grained personal access token, scoped to
// this one repo with Contents: read and write, pasted by the user.
const GITHUB_API = "https://api.github.com";

// Modals previously had no keyboard dismiss at all.
// Nine flat tabs hid the fact that four of them are the same activity rendered
// differently. Grouping them into destinations changes only the selector —
// activeTab stays the source of truth, so routing and saved state are untouched.
const DESTINATIONS = [
  // Explore is one combined view now; old tab ids still route to it.
  { id: "explore", label: "Explore", tabs: ["3d"] },
  { id: "match", label: "Match", tabs: ["db"] },
  { id: "catalog", label: "Catalog", tabs: ["pins"] },
  // The adjective × noun grid gave way to free anchor points.
  { id: "names", label: "Anchors", tabs: ["anchors", "groups"] },
];
const destForTab = (tabId) =>
  DESTINATIONS.find((d) => d.tabs.indexOf(tabId) !== -1) || DESTINATIONS[0];

const useEscapeKey = (onClose) => {
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
};

const toBase64Utf8 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const CHUNK = 0x8000; // spreading the whole array overflows the stack
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const fromBase64Utf8 = (b64) => {
  const binary = atob(String(b64 || "").replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

const ghFetch = (cfg, path, options = {}) =>
  fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

const ghVerify = async (cfg) => {
  const res = await ghFetch(cfg, `/repos/${cfg.owner}/${cfg.repo}`);
  if (res.status === 401) {
    throw new Error("Token rejected (401) — check the value and its expiry.");
  }
  if (res.status === 404) {
    throw new Error(
      `${cfg.owner}/${cfg.repo} not found, or this token has no access to it.`,
    );
  }
  if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
  const repo = await res.json();
  return {
    defaultBranch: repo.default_branch || "main",
    permissions: repo.permissions || {},
  };
};

// The Contents API needs the existing blob sha to update a file. Omitting it
// creates; sending a stale one returns 409 instead of silently overwriting
// whatever landed in the meantime.
// Git's own object model, rather than the Contents API one file at a time.
// Blobs -> tree -> commit -> move the ref: either the whole sync lands as one
// commit or nothing does, so a failure can't leave data/ half rewritten.
const ghJson = async (cfg, path, options, what) => {
  const res = await ghFetch(cfg, path, options);
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).message || "";
    } catch (e) {}
    if (res.status === 403) {
      throw new Error(`${what} refused (403) — token likely lacks Contents: write.`);
    }
    throw new Error(`${what} failed: ${res.status} ${detail}`);
  }
  return res.json();
};

// A git blob sha is sha1("blob <bytelength>\0" + bytes). Computing it locally
// lets unchanged files be skipped without a request each.
const gitBlobSha = async (text) => {
  if (!(window.crypto && window.crypto.subtle)) return null;
  try {
    const body = new TextEncoder().encode(text);
    const header = new TextEncoder().encode(`blob ${body.length}\0`);
    const full = new Uint8Array(header.length + body.length);
    full.set(header, 0);
    full.set(body, header.length);
    const digest = await window.crypto.subtle.digest("SHA-1", full);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (e) {
    return null;
  }
};

const ghCommitFiles = async (cfg, branch, files, message, onProgress) => {
  const repo = `/repos/${cfg.owner}/${cfg.repo}`;
  const report = (m) => onProgress && onProgress(m);

  report("Reading branch...");
  const ref = await ghJson(
    cfg,
    `${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    {},
    "Reading branch",
  );
  const headSha = ref.object.sha;
  const headCommit = await ghJson(
    cfg,
    `${repo}/git/commits/${headSha}`,
    {},
    "Reading commit",
  );
  const baseTreeSha = headCommit.tree.sha;

  // One recursive read gives every existing path's blob sha.
  let existing = {};
  try {
    const tree = await ghJson(
      cfg,
      `${repo}/git/trees/${baseTreeSha}?recursive=1`,
      {},
      "Reading tree",
    );
    (tree.tree || []).forEach((e) => {
      if (e.type === "blob") existing[e.path] = e.sha;
    });
  } catch (e) {
    existing = {};
  }

  const names = Object.keys(files);
  const changed = [];
  const skipped = [];
  for (const path of names) {
    const localSha = await gitBlobSha(files[path]);
    if (localSha && existing[path] === localSha) {
      skipped.push(path);
    } else {
      changed.push(path);
    }
  }

  if (changed.length === 0) {
    return { commit: null, changed: [], skipped, branch };
  }

  const treeEntries = [];
  for (let i = 0; i < changed.length; i++) {
    const path = changed[i];
    report(`Uploading ${path.split("/").pop()} (${i + 1}/${changed.length})...`);
    const blob = await ghJson(
      cfg,
      `${repo}/git/blobs`,
      {
        method: "POST",
        body: JSON.stringify({
          content: toBase64Utf8(files[path]),
          encoding: "base64",
        }),
      },
      "Uploading blob",
    );
    treeEntries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
  }

  report("Building tree...");
  const newTree = await ghJson(
    cfg,
    `${repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    },
    "Creating tree",
  );

  // If blob-sha comparison was unavailable (no crypto.subtle outside a secure
  // context) every file gets re-uploaded, and the resulting tree can be
  // identical to the parent's. Committing that would add an empty commit.
  if (newTree.sha === baseTreeSha) {
    return { commit: null, changed: [], skipped: names, branch };
  }

  report("Committing...");
  const commit = await ghJson(
    cfg,
    `${repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [headSha],
      }),
    },
    "Creating commit",
  );

  report("Updating branch...");
  // force:false, so if someone else pushed since we read the head this is
  // rejected rather than silently discarding their commit.
  const res = await ghFetch(cfg, `${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  if (!res.ok) {
    if (res.status === 422) {
      throw new Error(
        `${branch} moved on the remote while syncing — nothing was changed. Reload and try again.`,
      );
    }
    throw new Error(`Updating ${branch} failed: ${res.status}`);
  }

  return { commit: commit.sha, changed, skipped, branch };
};

// The plain ./data/ fetch only ever sees what the site was deployed with.
// Reading through the API picks up commits made elsewhere since.
const ghReadDataFiles = async (cfg, branch, dir, onProgress) => {
  const repo = `/repos/${cfg.owner}/${cfg.repo}`;
  const ref = await ghJson(
    cfg,
    `${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    {},
    "Reading branch",
  );
  const commit = await ghJson(
    cfg,
    `${repo}/git/commits/${ref.object.sha}`,
    {},
    "Reading commit",
  );
  const tree = await ghJson(
    cfg,
    `${repo}/git/trees/${commit.tree.sha}?recursive=1`,
    {},
    "Reading tree",
  );
  const prefix = dir ? `${dir}/` : "";
  const wanted = (tree.tree || []).filter(
    (e) =>
      e.type === "blob" &&
      e.path.indexOf(prefix) === 0 &&
      e.path.toLowerCase().endsWith(".csv"),
  );
  const out = {};
  for (let i = 0; i < wanted.length; i++) {
    const entry = wanted[i];
    const short = entry.path.slice(prefix.length);
    if (onProgress) onProgress(`Reading ${short} (${i + 1}/${wanted.length})...`);
    const blob = await ghJson(
      cfg,
      `${repo}/git/blobs/${entry.sha}`,
      {},
      `Reading ${short}`,
    );
    out[short] = fromBase64Utf8(blob.content);
  }
  return { files: out, commit: ref.object.sha };
};

const GitHubSyncModal = ({ config, setConfig, status, onSync, onPull, onClose }) => {
  const [draft, setDraft] = useState(config);
  useEscapeKey(onClose);
  const busy = status && status.state === "running";

  const field = (label, key, placeholder, type = "text") =>
    React.createElement(
      "div",
      { className: "flex flex-col gap-1", key },
      React.createElement(
        "label",
        {
          className:
            "text-[10px] uppercase tracking-widest text-slate-400 font-mono",
        },
        label,
      ),
      React.createElement("input", {
        type,
        value: draft[key] || "",
        placeholder,
        disabled: busy,
        onChange: (e) => setDraft({ ...draft, [key]: e.target.value }),
        className:
          "px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono text-slate-700 focus:outline-none focus:border-sky-400",
      }),
    );

  return ReactDOM.createPortal(
    React.createElement(
      "div",
      {
        className:
          "fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md",
      },
      React.createElement(
        "div",
        {
          className:
            "bg-white rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200",
        },
        React.createElement(
          "div",
          {
            className:
              "px-6 py-4 border-b border-slate-200 flex items-center justify-between",
          },
          React.createElement(
            "h2",
            { className: "text-sm font-bold uppercase tracking-widest" },
            "Sync to GitHub",
          ),
          React.createElement(
            "button",
            { onClick: onClose, className: "text-slate-400 hover:text-slate-700" },
            React.createElement(Icon, { name: "x", className: "w-5 h-5" }),
          ),
        ),
        React.createElement(
          "div",
          { className: "px-6 py-5 flex flex-col gap-4 overflow-y-auto" },
          React.createElement(
            "p",
            { className: "text-xs text-slate-500 leading-relaxed" },
            "Writes every CSV in the export straight into the repo's data folder. Needs a fine-grained personal access token with Contents: read and write on this repository.",
          ),
          field("Owner", "owner", "HC-SAMI"),
          field("Repository", "repo", "colorsamificator"),
          field("Branch", "branch", "(default branch)"),
          field("Folder", "path", "data"),
          field("Token", "token", "github_pat_...", "password"),
          React.createElement(
            "label",
            {
              className:
                "flex items-center gap-2 text-xs text-slate-600 cursor-pointer",
            },
            React.createElement("input", {
              type: "checkbox",
              checked: !!draft.remember,
              disabled: busy,
              onChange: (e) => setDraft({ ...draft, remember: e.target.checked }),
            }),
            "Keep the token for this browser session only",
          ),
          React.createElement(
            "p",
            { className: "text-[10px] text-slate-400 leading-relaxed" },
            "The token stays in this browser and goes only to api.github.com. It is never written into an export or a saved state file. Revoke it from GitHub settings at any time.",
          ),
          status &&
            React.createElement(
              "div",
              {
                className: `text-xs rounded-xl px-3 py-2 font-mono ${
                  status.state === "error"
                    ? "bg-red-50 text-red-700"
                    : status.state === "done"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-50 text-slate-600"
                }`,
              },
              status.message,
              status.log && status.log.length
                ? React.createElement(
                    "div",
                    { className: "mt-2 flex flex-col gap-0.5 opacity-70" },
                    status.log.map((line, i) =>
                      React.createElement("div", { key: i }, line),
                    ),
                  )
                : null,
            ),
        ),
        React.createElement(
          "div",
          {
            className:
              "px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2",
          },
          React.createElement(
            "button",
            {
              onClick: onClose,
              disabled: busy,
              className:
                "px-4 py-2 rounded-xl text-xs uppercase tracking-widest text-slate-500 hover:text-slate-800 disabled:opacity-40 mr-auto",
            },
            "Close",
          ),
          React.createElement(
            "button",
            {
              disabled: busy || !draft.owner || !draft.repo || !draft.token,
              onClick: () => {
                setConfig(draft);
                onPull(draft);
              },
              className:
                "px-4 py-2 rounded-xl text-xs uppercase tracking-widest border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40",
              title: "Replace this session with what is in the repo",
            },
            "Pull",
          ),
          React.createElement(
            "button",
            {
              disabled: busy || !draft.owner || !draft.repo || !draft.token,
              onClick: () => {
                setConfig(draft);
                onSync(draft);
              },
              className:
                "px-4 py-2 rounded-xl text-xs uppercase tracking-widest bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40",
            },
            busy ? "Syncing..." : "Sync now",
          ),
        ),
      ),
    ),
    document.body,
  );
};

const App = () => {
  const [theme, setTheme] = useState("light");
  const [activeTab, setActiveTab] = useState("db");
  // Retired tabs (old Explore views, adjective/noun grids) open their replacements.
  useEffect(() => {
    const alias = { adjectives: "anchors", palette: "anchors", top: "3d", chroma: "3d", slice: "3d" }[activeTab];
    if (alias) setActiveTab(alias);
  }, [activeTab]);
  const [colorData, setColorData] = useState(null);
  const [filterL, setFilterL] = useState(1);
  const [filterC, setFilterC] = useState(0.4);
  const [filterH, setFilterH] = useState(180);
  const [filterSameNoun, setFilterSameNoun] = useState(false);
  // One stack of filter rows for the whole app, not per tab.
  // Verified colours only on load — the old default, now expressed as an
  // ordinary filter row so it shows in the stack and can be removed.
  const [globalFilters, setGlobalFilters] = useState(() => [
    // Scoped to the DB list: the Explore viewports show everything by default.
    newFilterRow("spectral", "is_true", "", "", false, "db"),
  ]);
  const [globalFilterMode, setGlobalFilterMode] = useState("and");
  const [globalSortBy, setGlobalSortBy] = useState("deltae");
  const [globalSortAsc, setGlobalSortAsc] = useState(true);
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
    return parsed;
  }, []);
  const [names, setNames] = useState(initialState?.names || {});
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
        const cItem = colorData?.[item.brand]?.[item.originalIndex];
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
      const inherited = getInheritedPinNames(targetObj, savedColors, names);
      const noun = inherited.displayName;
      const displayName = (noun || (cleanErp ? `#${cleanErp}` : "\u2014")).toUpperCase();

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
          const cItem = colorData?.[pin.brand]?.[pin.originalIndex];
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
        const cItem = colorData?.[item.brand]?.[item.originalIndex];
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
    [savedColors, names, colorData],
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
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [githubConfig, setGithubConfig] = useState(() => {
    // sessionStorage is unavailable in some sandboxes, so never let it throw.
    try {
      const raw = sessionStorage.getItem("csam-github");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { token: "", owner: "", repo: "", branch: "", path: "data", remember: false };
  });
  useEffect(() => {
    try {
      if (githubConfig.remember) {
        sessionStorage.setItem("csam-github", JSON.stringify(githubConfig));
      } else {
        sessionStorage.removeItem("csam-github");
      }
    } catch (e) {}
  }, [githubConfig]);
  const loadInitialData = useCallback(async () => {
    let loadedColorData = null;
    if (window.__COLOR_DATA__) {
      loadedColorData = window.__COLOR_DATA__;
    }
    if (loadedColorData) setColorData(loadedColorData);
    let currentColorData = loadedColorData || {};
    let currentSavedColors = { ...savedColors };
    const seenPinCoords = new Set();
    Object.keys(currentSavedColors).forEach((k) => {
      const sc = currentSavedColors[k];
      if (sc.type === "nounColumn" && !k.startsWith("custom-noun-")) {
        delete currentSavedColors[k];
      } else if (sc.type === "pin") {
        const coordKey = `${sc.L?.toFixed(4)}-${sc.C?.toFixed(4)}-${sc.H?.toFixed(4)}`;
        if (seenPinCoords.has(coordKey)) {
          delete currentSavedColors[k];
        } else {
          seenPinCoords.add(coordKey);
        }
      }
    });
    let currentNames = {};
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
    // Downloads run in parallel; processing still goes file by file, in order.
    const fetchText = async (file) => {
      let parsedUrl = new URL(window.location.href);
      let p = parsedUrl.pathname;
      if (!p.endsWith("/") && !p.split("/").pop().includes(".")) {
        p += "/";
      }
      let baseForFetch = parsedUrl.origin + p;
      const resolvedPath = file.startsWith("data/") ? file : "data/" + file;
      const resolvedUrl = new URL(resolvedPath, baseForFetch).href;
      const res = await fetch(resolvedUrl);
      return res.ok ? await res.text() : "";
    };
    const pendingTexts = filesToLoad.map((file) => fetchText(file).catch((e) => e));
    for (let fi = 0; fi < filesToLoad.length; fi++) {
      const file = filesToLoad[fi];
      try {
        const got = await pendingTexts[fi];
        if (got instanceof Error) throw got;
        let csvText = got || "";
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
            currentNotes,
            currentTags,
            currentGroupSettings,
            currentSavedPalettes,
          );
          currentColorData = processed.newColorData;
          currentSavedColors = processed.newSavedColors;
          currentNames = processed.newNames;
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
    setDictNotes(currentNotes);
    setDictTags(currentTags);
    setGroupSettings(currentGroupSettings);
    setSavedPalettes(currentSavedPalettes);
  }, [linkedFiles]);
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData, linkedFiles.length]);
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
  // Anchor-name rows in the global stack need the same resolution context
  // the labels use; the viewport memos previously had no access to one.
  const viewportGroupContext = useMemo(() => {
    try {
      return getSameGroupContext(scrubL, scrubC, scrubH, savedColors, names);
    } catch (e) {
      return null;
    }
  }, [scrubL, scrubC, scrubH, savedColors, names]);
  // Viewport filter rows that apply here, and whether any of them (or the
  // same-group toggles) depend on the cursor. Only then must the filtered lists
  // be rebuilt as the cursor moves; otherwise a drag rebuilt every list and,
  // through them, every Explore cell, on each step.
  const viewportRows = useMemo(
    () => (globalFilters || []).filter((r) => !r.scope || r.scope === "viewport"),
    [globalFilters],
  );
  const viewportCursorDep =
    filterSameNoun ||
    viewportRows.some((r) => r.dynamic || r.field === "deltaE" || r.field === "noun");
  const viewportCursorKey = viewportCursorDep ? `${scrubL}|${scrubC}|${scrubH}` : "";
  const viewportCtxDep = viewportCursorDep ? viewportGroupContext : null;
  const filteredColorData = useMemo(() => {
    if (!colorData) return null;
    const isDb = activeTab === "db";

    let sameGroup = null;
    if (filterSameNoun) {
      sameGroup = getSameGroupContext(scrubL, scrubC, scrubH, savedColors, names);
    }

    const filtered = {};
    for (const brand of Object.keys(colorData)) {
      const isVisible = isDb ? viewportVisibility.brands[brand] !== false : viewportVisibility.brands[brand] === true;
      if (isVisible) {
        let list = colorData[brand];
        if (filterSameNoun && sameGroup) {
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
            if (filterSameNoun && !matchesSameNoun(sameGroup, itemL, itemC, itemH)) {
              return false;
            }
            return true;
          });
        }
        if (viewportRows.length) {
          // Commercial rows carry no \u0394E of their own; measure against the
          // cursor first or a \u0394E row rejects every one of them.
          const decorated = list.map((c) => {
            const item = { ...c, brand, displayName: c.name || "" };
            if (item._d === undefined) {
              item._d = fastDeltaEOK(scrubL, scrubC, scrubH, c.L, c.C, c.H);
            }
            return item;
          });
          // Filter the decorated copies, then map back to the originals so
          // nothing downstream sees the temporary fields.
          decorated.forEach((d, i) => {
            d.__idx = i;
          });
          list = applyGlobalFilters(
            decorated,
            globalFilters,
            viewportGroupContext,
            globalFilterMode,
            "viewport",
          ).items.map((k) => list[k.__idx]);
        }
        filtered[brand] = list;
      }
    }
    return filtered;
  }, [
    colorData,
    viewportVisibility,
    filterSameNoun,
    savedColors,
    viewportCursorKey,
    names,
    activeTab,
    viewportRows,
    globalFilterMode,
    viewportCtxDep,
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
  const [history, setHistory] = useState({
    list: [
      {
        names: initialState?.names || {},
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
  // ~60KB of JSON with a full anchor set. Unmemoized this ran on every render,
  // including every frame of a slider drag.
  const currentStateStr = useMemo(
    () =>
      JSON.stringify({
        names,
        dictNotes,
        dictTags,
        savedColors,
        groupSettings,
        palette,
        savedPalettes,
        observer,
        illuminant,
      }),
    [
      names,
      dictNotes,
      dictTags,
      savedColors,
      groupSettings,
      palette,
      savedPalettes,
      observer,
      illuminant,
    ],
  );
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
        const currentRecordStr = historyRecordStr(prev.list[prev.index]);
        if (currentRecordStr === currentStateStr) return prev;
        const newList = prev.list.slice(0, prev.index + 1);
        const rec = JSON.parse(currentStateStr);
        HISTORY_STR.set(rec, currentStateStr);
        newList.push(rec);
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
    // Points are matched by near-equal L/C/H through a bucket index (was a scan
    // of every point for every anchor).
    const nearIdx = new Map();
    const nearKey = (L, C, H) => `${Math.round(L * 1000)}|${Math.round(C * 1000)}|${Math.round(H * 1000)}`;
    const indexPoint = (p, i) => {
      if (!isFinite(p.L) || !isFinite(p.C) || !isFinite(p.H)) return;
      const k = nearKey(p.L, p.C, p.H);
      const arr = nearIdx.get(k);
      if (arr) arr.push(i); else nearIdx.set(k, [i]);
    };
    const findNear = (L, C, H) => {
      let best = -1;
      const l0 = Math.round(L * 1000), c0 = Math.round(C * 1000), h0 = Math.round(H * 1000);
      for (let dl = -1; dl <= 1; dl++)
        for (let dc = -1; dc <= 1; dc++)
          for (let dh = -1; dh <= 1; dh++) {
            const arr = nearIdx.get(`${l0 + dl}|${c0 + dc}|${h0 + dh}`);
            if (!arr) continue;
            for (const i of arr) {
              const p = points[i];
              if (
                (best < 0 || i < best) &&
                Math.abs(p.L - L) < 0.001 &&
                Math.abs(p.C - C) < 0.001 &&
                Math.abs(p.H - H) < 0.001
              )
                best = i;
            }
          }
      return best;
    };
    let points = [];
    let baseAnchors = [];
    const filteredSavedColors = { ...savedColors };
    Object.values(filteredSavedColors).forEach((sc) => {
      const lStr = getLStr(sc.L);
      const anchorId =
        sc.anchorId ||
        `custom-${Math.round(sc.C * 100)
          .toString()
          .padStart(
            2,
            "0",
          )}-${Math.round(sc.H).toString().padStart(3, "0")}-${lStr}`;
      if (sc.type === "pin" || sc.type === "anchor") {
        const pt = {
          L: sc.L,
          C: sc.C,
          H: sc.H,
          a: sc.a,
          b: sc.b,
          lStr,
          cStr: anchorId ? anchorId.split("-")[1] : "",
          hStr: anchorId ? anchorId.split("-")[2] : "",
          erpCode: sc.erpCode,
          color: sc.color,
          opacity: 1,
          ring: 0,
          delta: 0,
          isPin: sc.type === "pin",
          pinId: sc.type === "pin" ? sc.id : void 0,
          nameOverride: sc.nameOverride,
          anchorId,
          isCustomAnchor: sc.type === "anchor",
          image: sc.image || (sc.notes?.startsWith("http") ? sc.notes : undefined),
          brand: sc.brand,
          originalIndex: sc.originalIndex,
        };
        indexPoint(pt, points.length);
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
          nameOverride: sc.nameOverride,
          isCustomAnchor: sc.type === "anchor",
        });
      } else if (sc.type === "nounColumn") {
        const dL = 0.02;
        if (sc.minL === sc.maxL && sc.minL !== null) {
          const L = sc.minL;
          const existingIdx = findNear(L, sc.C, sc.H);
          if (existingIdx >= 0) {
            points[existingIdx] = {
              ...points[existingIdx],
              parentNounId: sc.id,
              isCustomNounGenerated: true,
            };
          } else {
            indexPoint({ L, C: sc.C, H: sc.H }, points.length);
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
              color: lchDisplayHex(L, sc.C, sc.H),
              opacity: 1,
              ring: 0,
              delta: 0,
              isPin: false,
              isCustomNounGenerated: true,
              parentNounId: sc.id,
            });
          }
        } else {
          for (let L = Math.ceil(sc.minL / dL) * dL; L <= sc.maxL; L += dL) {
            const gh = lchGamutHex(L, sc.C, sc.H);
            const existingIdx = findNear(L, sc.C, sc.H);
            if (existingIdx >= 0) {
              points[existingIdx] = {
                ...points[existingIdx],
                parentNounId: sc.id,
                isCustomNounGenerated: true,
              };
            } else if (gh.inGamut) {
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
                color: gh.hex,
                opacity: 1,
                ring: 0,
                delta: 0,
                isPin: false,
                isCustomNounGenerated: true,
                parentNounId: sc.id,
              };
              indexPoint(pt, points.length);
              points.push(pt);
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
    if (filterSameNoun) {
      const sameGroup = getSameGroupContext(scrubL, scrubC, scrubH, savedColors, names);

      points = points.filter((p) => {
        if (filterSameNoun && !matchesSameNoun(sameGroup, p.L, p.C, p.H)) return false;
        return true;
      });

      Object.keys(filteredSavedColors).forEach((k) => {
        const sc = filteredSavedColors[k];
        if (sc.type === "nounColumn") {
          if (
            filterSameNoun &&
            !matchesSameNoun(sameGroup, sc.minL !== undefined ? sc.minL : sc.L, sc.C, sc.H)
          ) {
            delete filteredSavedColors[k];
          }
        } else {
          if (filterSameNoun && !matchesSameNoun(sameGroup, sc.L, sc.C, sc.H)) {
            delete filteredSavedColors[k];
          }
        }
      });

      baseAnchors = baseAnchors.filter((ba) => {
        const minL = ba.minL !== undefined ? ba.minL : (ba.L !== undefined ? ba.L : 0);
        if (filterSameNoun && !matchesSameNoun(sameGroup, minL, ba.C, ba.H)) return false;
        return true;
      });
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
          const name = (
            p.isPin
              ? getInheritedPinNames(savedColors[p.pinId] || p, savedColors, names).displayName
              : names[nounId] || ""
          ).toLowerCase();
          const note = (dictNotes[nounId] || "").toLowerCase();
          const erp = p.erpCode.toLowerCase();
          if (
            !qWords.every(
              (w) =>
                name.includes(w) ||
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
            sc.type === "pin"
              ? getInheritedPinNames(sc, savedColors, names).displayName
              : sc.nameOverride || names[sc.id] || names[sc.anchorId] || ""
          ).toLowerCase();
          const note = (sc.notes || dictNotes[sc.anchorId] || "").toLowerCase();
          const erp = (sc.erpCode || "").toLowerCase();
          if (
            !qWords.every(
              (w) =>
                name.includes(w) ||
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
    if (viewportRows.length) {
      // Points expose their name and L/C/H; \u0394E is measured
      // against the cursor so the same rows work here as in the list.
      const decorate = (p) => {
        const name =
          names[p.parentNounId || p.anchorId || p.id] ||
          names[`${p.cStr}-${p.hStr}`] ||
          p.nameOverride ||
          p.name ||
          "";
        const d = fastDeltaEOK(scrubL, scrubC, scrubH, p.L, p.C, p.H);
        return { ...p, displayName: name, _d: isFinite(d) ? d : undefined };
      };
      const strip = (p) => {
        const clean = { ...p };
        delete clean.displayName;
        delete clean._d;
        return clean;
      };
      points = applyGlobalFilters(
        points.map(decorate),
        globalFilters,
        viewportGroupContext,
        globalFilterMode,
        "viewport",
      ).items.map(strip);

      // Anchors, pins and saved entries are drawn from these two, not from
      // `points` — filtering only points left everything else on screen.
      const keep = (item) =>
        applyGlobalFilters(
          [decorate(item)],
          globalFilters,
          viewportGroupContext,
          globalFilterMode,
          "viewport",
        ).items.length > 0;

      baseAnchors = baseAnchors.filter(keep);
      Object.keys(filteredSavedColors).forEach((k) => {
        const sc = filteredSavedColors[k];
        if (sc && sc.L !== undefined && !keep(sc)) delete filteredSavedColors[k];
      });
    }
    return { points, baseAnchors, savedColors: filteredSavedColors };
  }, [
    viewportVisibility,
    viewportTagFilter,
    viewportSearchQuery,
    savedColors,
    dictTags,
    names,
    dictNotes,
    filterSameNoun,
    viewportCursorKey,
    viewportRows,
    globalFilterMode,
    viewportCtxDep,
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
      }
    }
    const effectiveL = activePullType ? gravityL : scrubL;
    const effectiveC = activePullType ? gravityC : scrubC;
    const effectiveH = activePullType ? gravityH : scrubH;
    // Anchors are points: the cursor takes the name of the nearest one in
    // OkLab, the same rule that draws the cells in Explore.
    const nearAnchor = findNearestAnchor(effectiveL, effectiveC, effectiveH, savedColors);
    const nearestAnchorId = nearAnchor ? nearAnchor.nameKey : null;
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
      nearestAnchorId,
      snapDist: minGridDist,
      snapTarget: closestGridPt,
      temporarySpectral,
      activeCommercial: validatedCommercial,
    };
  }, [
    filteredViewData.points,
    filteredViewData.baseAnchors,
    scrubL,
    scrubC,
    scrubH,
    savedColors,
    temporarySpectral,
    // Without these, selecting a different commercial colour that sits at the
    // same L/C/H leaves activeCommercial pointing at the previous one, and an
    // edit that moves a colour never revalidates.
    scrubCommercial,
    colorData,
    names,
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
        const m = colorData?.[targetCommercial.brand]?.[targetCommercial.originalIndex];
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
          },
        }));
        setTetheringPinId(null);
        return;
      }
    }
  };
  const tabs = useMemo(
    () => [
      { id: "db", label: "Commercial DB" },
      { id: "pins", label: "Catalog (pinned colors)" },
      { id: "3d", label: "Color space" },
      { id: "anchors", label: "Anchors" },
      { id: "groups", label: "Color groups" },
    ],
    [],
  );
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results = [];
    const qWords = q.split(/\s+/).filter(Boolean);
    Object.values(savedColors).forEach((sc) => {
      if (!sc || (sc.type !== "pin" && sc.type !== "nounColumn" && sc.type !== "anchor")) return;
      if (results.length >= 100) return;
      const isPin = sc.type === "pin";
      const key = sc.type === "anchor" ? sc.anchorId || sc.id : sc.id;
      const name = isPin
        ? getInheritedPinNames(sc, savedColors, names).displayName
        : cleanName(names[key] || sc.nameOverride);
      const note = sc.notes || dictNotes[key] || "";
      const tagsStr = (dictTags[sc.id] || dictTags[key] || []).join(" ");
      const hay = `${name} ${note} ${sc.erpCode || ""} ${tagsStr}`.toLowerCase();
      if (!qWords.every((w) => hay.includes(w))) return;
      const L = sc.type === "nounColumn" ? (sc.minL + sc.maxL) / 2 : sc.L;
      results.push({
        key: `saved-${sc.id}`,
        L,
        C: sc.C,
        H: sc.H,
        color: sc.color || lchDisplayHex(L, sc.C || 0, sc.H || 0),
        displayName: name || "Unnamed",
        erpCode: sc.erpCode,
        type: isPin ? "Pin" : "Anchor",
        note,
      });
    });
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
    names,
    dictNotes,
    savedColors,
    dictTags,
    colorData,
  ]);
  if (!crosshair)
    return React.createElement(
      "div",
      {
        className:
          "min-h-screen flex items-center justify-center font-mono text-xs uppercase tracking-widest text-slate-400",
      },
      "Initializing Studio...",
    );
  // Card button: add an anchor at the cursor, or remove the one it sits on.
  const toggleAnchorHere = () => {
    const an = findNearestAnchor(scrubL, scrubC, scrubH, savedColors);
    if (an && an.dist < 0.0005) {
      setSavedColors((prev) => {
        const next = { ...prev };
        delete next[an.id];
        return next;
      });
      setNames((prev) => {
        if (!(an.nameKey in prev)) return prev;
        const next = { ...prev };
        delete next[an.nameKey];
        return next;
      });
      return;
    }
    const id = `custom-noun-${Date.now().toString(36)}`;
    const h = (scrubH * Math.PI) / 180;
    setSavedColors((prev) => ({
      ...prev,
      [id]: {
        id,
        type: "nounColumn",
        nameOverride: "",
        C: scrubC,
        H: scrubH,
        minL: scrubL,
        maxL: scrubL,
        a: scrubC * Math.sin(h),
        b: scrubC * Math.cos(h),
        notes: "",
      },
    }));
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
        const m = colorData?.[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
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
          anchorId: crosshair.nearestAnchorId,
          parentPinId: crosshair.closestGridPt?.isPin
            ? crosshair.closestGridPt.pinId
            : null,
          nameOverride: "",
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
  // Builds every CSV that lives in the repo's data/ folder, keyed by filename.
  // Shared by the ZIP download and the GitHub sync so the two can't drift.
  const buildExportFiles = () => {
      const files = {};
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
          const nounName = sc.nameOverride || names[sc.id] || "";
          anchorsCsv.push({
            Type: "NOUN",
            ID: sc.id || "",
            Noun: nounName,
            Note: sc.notes || dictNotes[sc.id] || "",
            Tags: (dictTags[sc.id] || []).join(","),
            // A point anchor writes its lightness; a legacy range writes "min-max".
            OKLCH_L:
              sc.minL !== undefined && sc.maxL !== undefined
                ? sc.minL === sc.maxL
                  ? sc.minL
                  : `${sc.minL}-${sc.maxL}`
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
          const anchorNoun = sc.nameOverride || names[sc.anchorId] || names[sc.id] || "";
          anchorsCsv.push({
            Type: "ANCHOR",
            ID: sc.id || sc.anchorId || "",
            Noun: anchorNoun,
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
            ERP_Code: sc.erpCode || "",
          });
        }
      });

      Object.values(savedColors)
        .filter((sc) => sc.type === "pin")
        .forEach((sc) => {
          const extra = getExtraColorValues(sc.L, sc.C, sc.H, sc.hex);
          const pinNames = getInheritedPinNames(sc, savedColors, names);
          pinsCsv.push({
            Type: "PIN",
            ID: sc.id || "",
            Parent_Pin_ID: sc.parentPinId || "",
            // The anchor that names this pin now (for reading; naming is live).
            Anchor_ID: (findNearestAnchor(sc.L, sc.C, sc.H, savedColors) || {}).nameKey || "",
            Brand: sc.brand || "",
            Original_Index: sc.originalIndex !== undefined ? sc.originalIndex : "",
            Image: sc.image || "",
            // Noun is the resolved name, for reading only — it is not
            // re-imported. An override round-trips in its own column.
            Noun: sc.nameOverride || pinNames.displayName || "",
            Noun_Override: sc.nameOverride || "",
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
          Brand: "",
          Original_Index: "",
          Image: "",
          Noun: "",
          Adjective: "",
          Note: "",
          Tags: "",
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
      files["anchors.csv"] = Papa.unparse(anchorsCsv.map(makeExportRow));
      files["pins.csv"] = Papa.unparse(pinsCsv.map(makeExportRow));
      files["palettes.csv"] = Papa.unparse(palettesCsv.map(makeExportRow));

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
      files["template.csv"] = Papa.unparse(templateRows);
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
        files[`${brand}.csv`] = Papa.unparse(brandData);
      });
      return files;
  };
  const handleSystemExport = async () => {
    try {
      const files = buildExportFiles();
      const zip = new JSZip();
      Object.entries(files).forEach(([name, text]) => zip.file(name, text));
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
  const handlePullFromGitHub = async (override) => {
    const cfg = override || githubConfig;
    if (!cfg.token || !cfg.owner || !cfg.repo) {
      setShowGithubModal(true);
      return;
    }
    if (
      !window.confirm(
        "Replace the colors, anchors and palettes in this session with what is currently in the repo? Anything unsynced will be lost.",
      )
    ) {
      return;
    }
    setSyncStatus({ state: "running", message: "Checking access...", log: [] });
    try {
      const info = await ghVerify(cfg);
      const branch = (cfg.branch || "").trim() || info.defaultBranch;
      const dir = String(cfg.path || "data").replace(/^\/+|\/+$/g, "");
      const { files } = await ghReadDataFiles(cfg, branch, dir, (m) =>
        setSyncStatus({ state: "running", message: m, log: [] }),
      );
      const names = Object.keys(files);
      if (names.length === 0) {
        throw new Error(`No CSV files found in ${dir || "the repo root"}.`);
      }
      let cColorData = {};
      let cSaved = {};
      let cNames = {};
      let cNotes = {};
      let cTags = {};
      let cGroups = defaultGroupSettings;
      let cPalettes = [];
      const log = [];
      names.forEach((name) => {
        const parsed = parseCSV(files[name]);
        if (!parsed.length) {
          log.push(`${name} — empty, skipped`);
          return;
        }
        const processed = processCSVData(
          parsed,
          cColorData,
          cSaved,
          cNames,
          cNotes,
          cTags,
          cGroups,
          cPalettes,
        );
        cColorData = processed.newColorData;
        cSaved = processed.newSavedColors;
        cNames = processed.newNames;
        cNotes = processed.newNotes;
        cTags = processed.newTags;
        cGroups = processed.newGroupSettings || cGroups;
        cPalettes = processed.newSavedPalettes || cPalettes;
        log.push(`${name} — ${parsed.length} rows`);
      });
      setColorData(Object.keys(cColorData).length > 0 ? cColorData : null);
      setSavedColors(cSaved);
      setNames(cNames);
      setDictNotes(cNotes);
      setDictTags(cTags);
      setGroupSettings(cGroups);
      setSavedPalettes(cPalettes);
      setSyncStatus({
        state: "done",
        message: `Pulled ${names.length} file${names.length === 1 ? "" : "s"} from ${cfg.owner}/${cfg.repo}@${branch}.`,
        log,
      });
    } catch (e) {
      console.error(e);
      setSyncStatus({ state: "error", message: e.message, log: [] });
    }
  };
  const handleSyncToCSV = async (override) => {
    const cfg = override || githubConfig;
    if (!cfg.token || !cfg.owner || !cfg.repo) {
      setShowGithubModal(true);
      return;
    }
    setSyncStatus({ state: "running", message: "Checking access...", log: [] });
    try {
      const info = await ghVerify(cfg);
      if (info.permissions && info.permissions.push === false) {
        throw new Error("This token can read the repo but not write to it.");
      }
      const branch = (cfg.branch || "").trim() || info.defaultBranch;
      const dir = String(cfg.path || "data").replace(/^\/+|\/+$/g, "");
      const built = buildExportFiles();
      const files = {};
      Object.keys(built).forEach((name) => {
        files[dir ? `${dir}/${name}` : name] = built[name];
      });
      const result = await ghCommitFiles(
        cfg,
        branch,
        files,
        `ColorSAMificator: update ${Object.keys(files).length} data files`,
        (m) => setSyncStatus({ state: "running", message: m, log: [] }),
      );
      setSyncStatus({
        state: "done",
        message: result.commit
          ? `Committed ${result.changed.length} file${result.changed.length === 1 ? "" : "s"} to ${cfg.owner}/${cfg.repo}@${result.branch} (${result.commit.slice(0, 7)}).`
          : `Everything already matches ${cfg.owner}/${cfg.repo}@${result.branch}.`,
        log: [
          ...result.changed.map((p) => `${p} — committed`),
          ...result.skipped.map((p) => `${p} — unchanged`),
        ],
      });
    } catch (e) {
      console.error(e);
      setSyncStatus({ state: "error", message: e.message, log: [] });
    }
  };
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
        dictNotes,
        dictTags,
        groupSettings,
        savedPalettes
      );
      if (processed.newGroupSettings) {
        setGroupSettings(processed.newGroupSettings);
      }
      setNames(processed.newNames);
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
      const match = colorData?.[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
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
      const match = colorData?.[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
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
  const isOutOfGamut = !activeColorObj.inGamut("srgb", { epsilon: 0.001 });
  const crosshairHex = activeColorObj
    .clone()
    .toGamut({ space: "srgb" })
    .toString({ format: "hex" })
    .toUpperCase();
  // The card's name: a pin by its own rules (override, tethered parent,
  // nearest anchor); anything else by the nearest anchor.
  const getInheritedData = (sc, depth = 0) => {
    if (!sc) return null;
    const parent = sc.parentPinId && depth < 20 ? savedColors[sc.parentPinId] : null;
    if (parent) {
      const parentData = getInheritedData(parent, depth + 1);
      return {
        name: cleanName(parent.nameOverride) || parentData.name,
        notes: parent.notes || parentData.notes,
        source: "pin",
        sourceId: parent.id,
      };
    }
    const cb = getInheritedPinNames(sc, savedColors, names);
    return {
      name: cb.displayName,
      notes: sc.notes || dictNotes[cb.sourceId] || "",
      source: cb.source,
      sourceId: cb.sourceId,
    };
  };
  // Plain IIFE, not useMemo: this sits after an early return, so a hook
  // here would break hook ordering.
  const activeData = (() => {
    const pinSc =
      crosshair?.activeSavedColor?.type === "pin"
        ? crosshair.activeSavedColor
        : !crosshair?.activeSavedColor && crosshair?.closestGridPt?.isPin
          ? savedColors[crosshair.closestGridPt.pinId]
          : null;
    if (pinSc) {
      const inherited = getInheritedData(pinSc);
      return {
        name: cleanName(pinSc.nameOverride) || inherited.name,
        notes: pinSc.notes || inherited.notes,
        inherited,
      };
    }
    const id = crosshair?.nearestAnchorId;
    const sc = id ? savedColors[id] : null;
    return {
      name: cleanName(names[id] || (sc && sc.nameOverride)),
      notes: dictNotes[id] || (sc && sc.notes) || "",
    };
  })();
  const activeName = activeData.name;
  const activeNotes = activeData.notes;
  const isPinned = crosshair?.exactSavedColor?.type === "pin";
  const isAnchorHere = (() => {
    const an = findNearestAnchor(scrubL, scrubC, scrubH, savedColors);
    return !!an && an.dist < 0.0005;
  })();
  const activeCommercial = crosshair?.activeCommercial;
  const activeItemId = activeCommercial
    ? `commercial-${activeCommercial.brand}-${activeCommercial.originalIndex}`
    : crosshair?.activeSavedColor?.type === "pin"
      ? crosshair.activeSavedColor.id
      : crosshair?.nearestAnchorId;
  const activeTags = activeCommercial
    ? colorData?.[activeCommercial.brand]?.[activeCommercial.originalIndex]
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
  const nounInputClass = `name-input w-full bg-transparent text-center text-2xl font-black uppercase tracking-widest focus:outline-none drop-shadow-md -mt-1 pointer-events-auto ${getGlobalDuplicate(names, crosshair?.activeSavedColor?.type === "pin" ? crosshair.activeSavedColor.id : crosshair?.nearestAnchorId, activeName, savedColors, crosshair?.activeSavedColor?.type === "pin" ? !!crosshair.activeSavedColor.nameOverride : true, crosshair?.activeSavedColor?.type === "pin" ? crosshair?.nearestAnchorId : null) ? "!text-red-500" : isPinned && !crosshair?.exactSavedColor.nameOverride ? "opacity-40 italic" : ""}`;
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
    history,
    isUndoing,
    currentStateStr,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    filteredViewData,
    handleUpdate,
    handlePointClick,
    crosshair,
    isLight,
    activeColorObj,
    labValues,
    colorGroup,
    isOutOfGamut,
    crosshairHex,
    activeData,
    activeName,
    activeNotes,
    isPinned,
    isAnchorHere,
    activeItemId,
    activeTags,
    addTag,
    removeTag,
    nounInputClass,
    deltaEOK,
    deltaE2000,
    tabs,
    searchResults,
    handleSaveApp,
    handleSystemExport,
    handleImportCSV: handleSystemImport,
    handleSyncToCSV,
    handlePullFromGitHub,
    globalFilters,
    setGlobalFilters,
    globalFilterMode,
    setGlobalFilterMode,
    globalSortBy,
    setGlobalSortBy,
    globalSortAsc,
    setGlobalSortAsc,
    showGithubModal,
    setShowGithubModal,
    githubConfig,
    setGithubConfig,
    syncStatus,
    addToPalette,
    removeFromPalette,
    saveCurrentPalette,
    confirmSavePalette,
    cancelSavePalette,
    loadPalette,
    deleteSavedPalette,
    replaceInPalette,
    onNameChange,
    onNotesChange,
    toggleAnchorHere,
    togglePin,
    updateSavedColor,
    spectral,
    tetheringPinId,
    setTetheringPinId,
  });
};
// The working palette already existed, buried inside the Palette Playground
// panel. Surfacing it as a persistent shelf means colours can be collected from
// any destination without leaving it, and the same set doubles as the slots for
// a Delta E comparison.

const DatabaseManager = ({
  colorData,
  updateColorData,
  swatchLayout,
  swatchZoom,
  handlePointClick,
  crosshair,
  setFilterSameNoun,
  filterSameNoun,
  globalFilters,
  setGlobalFilters,
  globalFilterMode,
  globalSortBy,
  globalSortAsc,
  sameGroupContext,
  onClose,
}) => {
  useEscapeKey(onClose);
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md transition-all",
    },
    React.createElement(
      "div",
      {
        // framer-motion isn't loaded by index.html, so `motion.div` threw here.
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
                setFilterSameNoun,
                filterSameNoun,
                globalFilters,
                setGlobalFilters,
                globalFilterMode,
                globalSortBy,
                globalSortAsc,
                sameGroupContext,
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

const DB_SORT_FIELDS = [
  { field: "deltae", label: "\u0394E" },
  { field: "name", label: "Name" },
  { field: "brand", label: "Brand" },
  { field: "material", label: "Material" },
  { field: "sheen", label: "Sheen" },
  { field: "doorProfile", label: "Profile" },
  { field: "visualTexture", label: "Vis. pattern" },
  { field: "tactileTexture", label: "Tac. texture" },
  { field: "lightness", label: "Lightness" },
  { field: "chroma", label: "Chroma" },
  { field: "hue", label: "Hue" },
];

const ViewDatabase = ({
  setFilterSameNoun,
  filterSameNoun,
  globalFilters,
  setGlobalFilters,
  globalFilterMode,
  globalSortBy,
  globalSortAsc,
  sameGroupContext,
  colorData,
  fullColorData,
  updateColorData,
  swatchLayout,
  swatchZoom,
  handlePointClick,
  crosshair,
  searchTerm,
  setSearchTerm,
  tagFilter,
  setTagFilter,
  filterPt,
  selectedIds,
  setSelectedIds,
  handleBatchTag,
  handleBatchRemoveTag,
  globalTags,
  onOpenAveryModal,
}) => {
  const dataForUpdates = fullColorData || colorData;
  // Sort now lives in the global bar; this stays as the fallback for the
  // Database Manager modal, which renders outside that bar.
  const [localSortBy, setLocalSortBy] = useState("brand");
  const [localSortAsc, setLocalSortAsc] = useState(true);
  const sortBy = globalSortBy !== undefined ? globalSortBy : localSortBy;
  const sortAsc = globalSortAsc !== undefined ? globalSortAsc : localSortAsc;
  const setSortBy = setLocalSortBy;
  const setSortAsc = setLocalSortAsc;
  const [dbAxis, setDbAxis] = useState("HxL");
  const [brandFilter, setBrandFilter] = useState("");
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [promptState, setPromptState] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [columnFilters, setColumnFilters] = useState({});
  const [openFilterCol, setOpenFilterCol] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [showGuideModal, setShowGuideModal] = useState(false);
  // Sorting, brand, tags, the match buttons, print and \u0394E all live in one dense
  // strip. On a phone that strip is taller than the results it filters, so it
  // collapses behind a single control.
  const [showDbControls, setShowDbControls] = useState(false);

  const baseListSize = 48;

  const allDbItems = useMemo(() => {
    if (!colorData) return [];
    // `colorData` here can be a filtered view, but every write path (edit,
    // delete, inline tag) indexes into the unfiltered data via originalIndex.
    // Resolve each row's position in that full list rather than its position
    // in the filtered one, or the two disagree as soon as a filter is on.
    const source = dataForUpdates || colorData;
    const fullIndex = {};
    Object.keys(source).forEach((brand) => {
      const map = new Map();
      source[brand].forEach((c, i) => map.set(c, i));
      fullIndex[brand] = map;
    });
    let items = [];
    Object.keys(colorData).forEach((brand) => {
      colorData[brand].forEach((c, filteredIdx) => {
        const idx = fullIndex[brand] && fullIndex[brand].has(c)
          ? fullIndex[brand].get(c)
          : filteredIdx;
        if (filterPt && !filterPt(c)) return;
        let L = c.L;
        let C = c.C;
        let H = c.H;
        let hexVal = c.hex || "#000000";
        if (c.spectral && c.spectral.length === 31) {
          const sp = fastItemLch(c);   // cached per record
          if (sp) {
            L = sp.L;
            C = sp.C;
            H = sp.H;
            hexVal = sp.hex;
          }
        } else if (L === void 0 || L === null) {
          const tc = c.hex ? fastHexToOklch(c.hex) : null;
          if (tc) {
            L = tc[0];
            C = tc[1];
            H = isNaN(tc[2]) ? 0 : tc[2];
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
          // Depends only on L/C/H, so it is computed here once per item rather
          // than rebuilt for the whole list on every keystroke or slider move.
          _inGamut: (() => {
            try {
              return fastInGamutSrgb(L, C, H);
            } catch (e) {
              return true;
            }
          })(),
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
  }, [colorData, dataForUpdates, filterPt]);
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
    // Track which stage took the list to zero, so the empty state can name it
    // instead of leaving you to guess across seven stacked filters.
    let emptyReason = allDbItems.length === 0 ? "there are no colors loaded" : null;
    const stage = (name) => {
      if (!emptyReason && items.length === 0) emptyReason = name;
    };
    // Measuring and filtering are separate concerns: \u0394E is the number being
    // scanned for, so every row carries it whenever there is a cursor to measure
    // against, even when the \u0394E limit itself is switched off.
    if (crosshair) {
      const cL = crosshair.rawL, cC = crosshair.rawC, cH = crosshair.rawH;
      items.forEach((item) => {
        const d = fastDeltaEOK(cL, cC, cH, item.L, item.C, item.H);
        item._d = isFinite(d) ? d : undefined;
      });
    }
    if (brandFilter) {
      items = items.filter((item) => item.brand === brandFilter);
      stage(`the brand filter (${brandFilter})`);
    }
    if (tagFilter)
      items = items.filter((item) =>
        (item.tags || []).some(
          (t) => t.toLowerCase() === tagFilter.toLowerCase(),
        ),
      );
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
      stage(`the search for "${searchTerm.trim()}"`);
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
      stage("the column filters");
    }
    if (globalFilters && globalFilters.length) {
      const res = applyGlobalFilters(
        items,
        globalFilters,
        sameGroupContext,
        globalFilterMode,
        "db",
      );
      items = res.items;
      if (res.culprit && !emptyReason) {
        emptyReason = describeFilterRow(res.culprit, sameGroupContext);
      }
    }
    items.emptyReason = emptyReason;
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
          // \u0394E is always measured now, so it can always be the fallback.
          valA = a._d ?? 999;
          valB = b._d ?? 999;
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
    globalFilters,
    globalFilterMode,
    sameGroupContext,
    tagFilter,
    searchTerm,
    brandFilter,
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
  // Plain render helper, not a component (see note on the other SortButtons).
  const renderItems = sortedItems.slice(0, 300);
  // The table is unusable below ~640px — eight columns behind a horizontal
  // scroll. The existing card list says the same thing in one column, so narrow
  // viewports fall back to it rather than getting a second render path.
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const effectiveLayout =
    isNarrow && swatchLayout === "table" ? "list" : swatchLayout;
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
    showGuideModal &&
      React.createElement(
        "div",
        {
          className:
            "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200",
          onClick: () => setShowGuideModal(false),
        },
        React.createElement(
          "div",
          {
            className:
              "relative w-full max-w-5xl bg-[#F2E8DF] dark:bg-neutral-900 border border-[#B4A99E] dark:border-neutral-700 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden",
            onClick: (e) => e.stopPropagation(),
          },
          React.createElement(
            "div",
            {
              className:
                "flex items-center justify-between px-5 py-3.5 border-b border-[#B4A99E]/40 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xs shrink-0",
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-2.5" },
              React.createElement(
                "div",
                { className: "p-1.5 rounded-lg bg-[#2B4032] text-white" },
                React.createElement(Icon, { name: "help-circle", className: "w-4 h-4 text-[#F2E8DF]" })
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "h2",
                  { className: "text-sm font-extrabold text-[#010D00] dark:text-neutral-100 flex items-center gap-2" },
                  "Color & Material Matching Guide",
                  React.createElement(
                    "span",
                    {
                      className:
                        "text-[9px] px-2 py-0.5 rounded-full bg-[#B1BC83]/30 text-[#2B4032] dark:text-[#B1BC83] font-bold uppercase tracking-wider",
                    },
                    "Infographic"
                  )
                ),
                React.createElement(
                  "p",
                  { className: "text-[11px] text-slate-500 dark:text-neutral-400" },
                  "3-step guide: Search bar, Commercial Matches panel, & Commercial DB options"
                )
              )
            ),
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(
                "a",
                {
                  href: "matching-guide-infographic.svg",
                  download: "matching-guide-infographic.svg",
                  className:
                    "px-2.5 py-1.5 text-xs font-bold bg-[#2B4032] hover:bg-[#1e2e23] text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs",
                  title: "Download vector SVG infographic",
                },
                React.createElement(Icon, { name: "download", className: "w-3.5 h-3.5" }),
                "Download SVG"
              ),
              React.createElement(
                "a",
                {
                  href: "matching-guide-infographic.svg",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className:
                    "px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs",
                  title: "Open full-size image in new tab",
                },
                React.createElement(Icon, { name: "external-link", className: "w-3.5 h-3.5" }),
                "Open Full"
              ),
              React.createElement(
                "button",
                {
                  onClick: () => setShowGuideModal(false),
                  className:
                    "p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors ml-1",
                  title: "Close Guide",
                },
                React.createElement(Icon, { name: "x", className: "w-5 h-5" })
              )
            )
          ),
          React.createElement(
            "div",
            {
              className:
                "flex-1 overflow-auto p-4 flex items-center justify-center bg-[#EAE0D5]/40 dark:bg-black/40 custom-scrollbar",
            },
            React.createElement("img", {
              src: "matching-guide-infographic.svg",
              alt: "Matching Guide Infographic - Steps to get matches for a specific color or material",
              className:
                "w-full h-auto max-w-full rounded-xl shadow-md border border-[#B4A99E]/40 object-contain",
            })
          )
        )
      ),
    React.createElement(
      "button",
      {
        onClick: () => setShowDbControls(!showDbControls),
        className:
          "md:hidden w-full flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-neutral-800 text-[11px] font-bold uppercase tracking-widest text-slate-500",
      },
      React.createElement(Icon, {
        name: "sliders-horizontal",
        className: "w-4 h-4",
      }),
      showDbControls ? "Hide tools" : "Tools",
      React.createElement(
        "span",
        { className: "ml-auto font-mono text-[10px] text-slate-400" },
        sortedItems.length + " matching",
      ),
    ),
    React.createElement(
      "div",
      {
        className:
          (showDbControls ? "flex" : "hidden") +
          " md:flex flex-col gap-2 px-4 pb-4 border-b border-slate-200 dark:border-neutral-800 flex-shrink-0",
      },
      React.createElement(
        "div",
        { className: "flex flex-wrap items-center gap-2" },
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
            onClick: () => setShowGuideModal(true),
            className:
              "px-2.5 py-1 text-[9px] font-bold bg-[#B1BC83] hover:bg-[#9fa974] text-[#052212] uppercase tracking-wider rounded flex items-center gap-1 shadow-sm transition-colors",
            title: "View visual infographic guide on how to get color and material matches",
          },
          React.createElement(Icon, { name: "help-circle", className: "w-3 h-3" }),
          "Matching Guide"
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
        React.createElement(FilterChips, {
          chips: [
            brandFilter && {
              key: "brand",
              label: brandFilter,
              onClear: () => setBrandFilter(""),
            },
            searchTerm && {
              key: "search",
              label: `"${searchTerm}"`,
              onClear: () => setSearchTerm && setSearchTerm(""),
            },
            tagFilter && {
              key: "tag",
              label: tagFilter,
              onClear: () => setTagFilter && setTagFilter(""),
            },
            filterSameNoun && {
              key: "noun",
              label: "Same anchor",
              onClear: () => setFilterSameNoun && setFilterSameNoun(false),
            },
            ...Object.keys(columnFilters || {}).map((col) => ({
              key: `col-${col}`,
              label: col,
              onClear: () =>
                setColumnFilters((prev) => {
                  const next = { ...prev };
                  delete next[col];
                  return next;
                }),
            })),
            // Rows from the global builder show here too, so everything
            // narrowing the list is visible in one place.
            ...(globalFilters || []).map((row) => ({
              key: row.id,
              label: describeFilterRow(row, sameGroupContext),
              onClear: () =>
                setGlobalFilters(
                  (globalFilters || []).filter((r) => r.id !== row.id),
                ),
            })),
          ].filter(Boolean),
          onClearAll: () => {
            setBrandFilter("");
            setColumnFilters({});
            if (setFilterSameNoun) setFilterSameNoun(false);
            if (setSearchTerm) setSearchTerm("");
            if (setTagFilter) setTagFilter("");
            if (setGlobalFilters) setGlobalFilters([]);
          },
        }),
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
        React.createElement(SwatchLegend, { className: "ml-3" }),
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
          sortedItems.emptyReason
            ? `No commercial colors left after ${sortedItems.emptyReason}.`
            : "No commercial colors found. Adjust filters or \u0394E.",
        ),
      // The list is capped at 300 rows. That used to just stop with no
      // explanation, which reads as missing data rather than a cap.
      sortedItems.length > renderItems.length &&
        React.createElement(
          "div",
          {
            className:
              "text-center text-slate-400 text-[11px] w-full p-4 italic border-t border-slate-200 dark:border-neutral-800 mt-2",
          },
          `Showing the first ${renderItems.length} of ${sortedItems.length} by the current sort \u2014 narrow the filters to see the rest.`,
        ),
      effectiveLayout === "matrix" &&
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
      effectiveLayout === "list" &&
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
                React.createElement(SwatchTreatment, {
                  item,
                  size: baseListSize * swatchZoom,
                }),
                (item.image || item.note?.startsWith("http")) &&
                  React.createElement("div", {
                    className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                    style: {
                      backgroundImage: `url(${item.image || item.note})`,
                      opacity: SWATCH_PHOTO_OPACITY,
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
      effectiveLayout === "table" &&
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
                renderFilterHeader("deltaE", "\u0394Eok", "w-20", true, true),
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
                        className: "w-8 h-8 rounded relative shadow-sm overflow-hidden",
                        style: {
                          backgroundColor: item.hex,
                        },
                      },
                      React.createElement(SwatchTreatment, { item, size: 32 }),
                      (item.image || item.note?.startsWith("http")) &&
                        React.createElement("div", {
                          className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                          style: {
                            backgroundImage: `url(${item.image || item.note})`,
                            opacity: SWATCH_PHOTO_OPACITY,
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
                  React.createElement(
                    "td",
                    {
                      className:
                        "p-2 text-right text-emerald-600 font-bold font-mono",
                    },
                    item._d !== void 0 ? item._d.toFixed(2) : "\u2014",
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
      effectiveLayout === "gallery" &&
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
                React.createElement(SwatchTreatment, { item, size: 96 }),
                (item.image || item.note?.startsWith("http")) &&
                  React.createElement("div", {
                    className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                    style: {
                      backgroundImage: `url(${item.image || item.note})`,
                      opacity: SWATCH_PHOTO_OPACITY,
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
                      className: "w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none cursor-pointer"
                    }, field.options.map(opt => React.createElement("option", { key: opt, value: opt === '-' ? '' : opt }, opt === '-' ? 'None' : opt)))
                  )
                )
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
  useEscapeKey(onClose);
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
  history,
  isUndoing,
  currentStateStr,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  filteredViewData,
  handleUpdate,
  handlePointClick,
  crosshair,
  isLight,
  activeColorObj,
  labValues,
  colorGroup,
  isOutOfGamut,
  crosshairHex,
  activeData,
  activeName,
  activeNotes,
  isPinned,
  isAnchorHere,
  activeItemId,
  activeTags,
  addTag,
  removeTag,
  nounInputClass,
  deltaEOK,
  deltaE2000,
  tabs,
  searchResults,
  handleSaveApp,
  handleSystemExport,
  handleImportCSV,
  handleSyncToCSV,
  handlePullFromGitHub,
  globalFilters,
  setGlobalFilters,
  globalFilterMode,
  setGlobalFilterMode,
  globalSortBy,
  setGlobalSortBy,
  globalSortAsc,
  setGlobalSortAsc,
  showGithubModal,
  setShowGithubModal,
  githubConfig,
  setGithubConfig,
  syncStatus,
  addToPalette,
  removeFromPalette,
  saveCurrentPalette,
  confirmSavePalette,
  cancelSavePalette,
  loadPalette,
  deleteSavedPalette,
  replaceInPalette,
  onNameChange,
  onNotesChange,
  toggleAnchorHere,
  togglePin,
  updateSavedColor,
  spectral,
  tetheringPinId,
  setTetheringPinId,
}) => {
  const spaceSeenRef = useRef(false);
  if (["top", "chroma", "slice", "3d"].includes(activeTab)) spaceSeenRef.current = true;
  // The input stays bound to the raw value so typing never lags; the heavy
  // table/grid re-filter runs against this deferred copy instead.
  const deferredSearch = useDeferredValue(viewportSearchQuery);
  // On a phone the sidebar took a fixed 45vh whether or not you were using it,
  // leaving the view you navigated to squeezed into what was left.
  const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  // Resolved once here so the anchor filter rows and the presets all
  // agree with the labels shown beside the toggles.
  const sameGroupContext = useMemo(() => {
    try {
      return getSameGroupContext(scrubL, scrubC, scrubH, savedColors, names);
    } catch (e) {
      return null;
    }
  }, [scrubL, scrubC, scrubH, savedColors, names]);
  // Values already present in the loaded data, so select-type rows offer real
  // choices instead of asking you to type a brand exactly right.
  const filterOptionsFor = useCallback(
    (fieldId) => {
      const field = FILTER_FIELDS.find((f) => f.id === fieldId);
      // Only the field is required: pins and their tags exist even when no
      // commercial data is loaded, and bailing here hid them entirely.
      if (!field) return [];
      const seen = new Set();
      const collect = (v) =>
        String(v || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .forEach((x) => seen.add(x));
      Object.keys(colorData || {}).forEach((brand) => {
        (colorData[brand] || []).forEach((c) => collect(field.get({ ...c, brand })));
      });
      // Pins and their tags live outside colorData, so the Catalog's own
      // values would never appear in the dropdown without this.
      Object.values(savedColors || {}).forEach((sc) => {
        collect(field.get({ ...sc, tags: (dictTags || {})[sc.id] || [] }));
      });
      if (fieldId === "tag") (globalTags || []).forEach((t) => seen.add(t));
      return [...seen].sort().slice(0, 200);
    },
    [colorData, savedColors, dictTags, globalTags],
  );
  const compactHex = useMemo(() => {
    try {
      return new Color("oklch", [scrubL, scrubC, scrubH])
        .toGamut({ space: "srgb" })
        .toString({ format: "hex" });
    } catch (e) {
      return "#cccccc";
    }
  }, [scrubL, scrubC, scrubH]);
  const DEST_ICONS = {
    explore: "grid-3x3",
    match: "list",
    catalog: "bookmark",
    names: "anchor",
  };
  // Destinations render twice from one definition: a rail beside the content on
  // desktop, a thumb-height bar at the bottom on phones.
  const renderDestinations = (variant) => {
    const current = destForTab(activeTab).id;
    return DESTINATIONS.map((d) => {
      const on = d.id === current;
      const go = () => {
        setMobilePanelsOpen(false);
        if (!on) setActiveTab(d.tabs[0]);
      };
      const icon = React.createElement(Icon, {
        name: DEST_ICONS[d.id],
        className: "w-4 h-4",
      });
      if (variant === "top") {
        return React.createElement(
          "button",
          {
            key: d.id,
            onClick: go,
            "aria-current": on,
            className: `flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              on
                ? "bg-slate-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
            }`,
          },
          icon,
          d.label,
        );
      }
      if (variant === "bar") {
        return React.createElement(
          "button",
          {
            key: d.id,
            onClick: go,
            "aria-current": on && !mobilePanelsOpen,
            className: `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              on && !mobilePanelsOpen
                ? "text-slate-900 dark:text-neutral-100"
                : "text-slate-400 dark:text-neutral-500"
            }`,
          },
          icon,
          d.label,
        );
      }
      return React.createElement(
        "button",
        {
          key: d.id,
          onClick: go,
          "aria-current": on,
          className: `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${
            on
              ? "bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-neutral-100"
              : "text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800/50"
          }`,
        },
        icon,
        d.label,
      );
    });
  };
  const [showViewFilters, setShowViewFilters] = useState(false);
  useEscapeKey(showViewFilters ? () => setShowViewFilters(false) : null);
  useEscapeKey(showFilterBuilder ? () => setShowFilterBuilder(false) : null);
  // Surface what the group filters actually resolved to. These read as
  // geometry-free names, so a wrong match is visible instead of silent.
  const sameGroupLabels = useMemo(() => {
    // Previously gated on the popover being open; the rail shows these
    // permanently, so they have to resolve whether or not it is.

    const pretty = (k) =>
      k && k.indexOf("name:") === 0 ? k.slice(5).toUpperCase() : k === "any" ? "" : "unnamed";
    try {
      const ctx = getSameGroupContext(scrubL, scrubC, scrubH, savedColors, names);
      return { noun: pretty(ctx.nounKey) };
    } catch (e) {
      return { noun: "" };
    }
  }, [scrubL, scrubC, scrubH, savedColors, names]);
  const filterPresets = useMemo(
    () => [
      {
        id: "same-noun",
        label: "Same anchor",
        hint: "Colors named by the same anchor as the cursor",
        apply: () =>
          setGlobalFilters((rows) =>
            mergeFilterRows(rows, [newFilterRow("noun", "is", "", "", true)]),
          ),
      },
      {
        id: "verified",
        label: "Verified only",
        hint: "Colours with measured spectral data",
        apply: () =>
          setGlobalFilters((rows) =>
            mergeFilterRows(rows, [newFilterRow("spectral", "is_true")]),
          ),
      },
      {
        id: "color-match",
        label: "Color match",
        hint: "Within \u0394E 2 of the cursor, named by the same anchor",
        apply: () =>
          setGlobalFilters((rows) =>
            mergeFilterRows(rows, [
              newFilterRow("deltaE", "lte", "2"),
              newFilterRow("noun", "is", "", "", true),
            ]),
          ),
      },
      {
        id: "exact-material",
        label: "Exact material match",
        hint: "Same material, sheen, profile, visual pattern and tactile texture as the selected color, named by the same anchor",
        apply: () => {
          const sel =
            crosshair &&
            crosshair.activeCommercial &&
            colorData &&
            colorData[crosshair.activeCommercial.brand]
              ? colorData[crosshair.activeCommercial.brand][
                  crosshair.activeCommercial.originalIndex
                ]
              : null;
          if (!sel) {
            alert(
              "Select a commercial color first — this preset copies its material, sheen and profile.",
            );
            return;
          }
          setGlobalFilters((rows) =>
            mergeFilterRows(rows, [
              ...(sel.material
                ? [newFilterRow("material", "is", sel.material)]
                : []),
              ...(sel.sheen ? [newFilterRow("sheen", "is", sel.sheen)] : []),
              ...(sel.doorProfile
                ? [newFilterRow("doorProfile", "is", sel.doorProfile)]
                : []),
              ...(sel.visualTexture
                ? [newFilterRow("visualTexture", "is", sel.visualTexture)]
                : []),
              ...(sel.tactileTexture
                ? [newFilterRow("tactileTexture", "is", sel.tactileTexture)]
                : []),
              newFilterRow("noun", "is", "", "", true),
            ]),
          );
        },
      },
    ],
    [sameGroupLabels, crosshair, colorData, setGlobalFilters],
  );
  const [draggedPaletteIndex, setDraggedPaletteIndex] = useState(null);
  const [dragOverPaletteIndex, setDragOverPaletteIndex] = useState(null);

  const handleReorderPalette = useCallback((sourceIdx, targetIdx) => {
    if (
      sourceIdx === null ||
      targetIdx === null ||
      isNaN(sourceIdx) ||
      isNaN(targetIdx) ||
      sourceIdx === targetIdx
    )
      return;
    setPalette((prev) => {
      if (
        sourceIdx < 0 ||
        sourceIdx >= prev.length ||
        targetIdx < 0 ||
        targetIdx >= prev.length
      )
        return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  }, [setPalette]);

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
                grid-template-rows: repeat(7, 1.5in) !important;
                column-gap: 0.188in !important;
                row-gap: 0in !important;
                width: 8.5in !important;
                height: 11in !important;
                padding-top: calc(0.25in + 1mm) !important;
                padding-bottom: calc(0.25in - 1mm) !important;
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
                overflow: visible !important;
                background: white !important;
                border-radius: 0in !important;
                font-family: 'Bicyclette', 'Byciclette', 'Inter', system-ui, sans-serif !important;
              }
              .avery-label-border {
                outline: 1px dashed rgba(180, 169, 158, 0.4) !important;
                outline-offset: -1px !important;
              }
              .avery-label-borderless {
                outline: 1px solid transparent !important;
                outline-offset: -1px !important;
              }
              .sami-sidebar {
                width: 0.45in !important;
                height: 100% !important;
                box-sizing: border-box !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background-color: #2B4032 !important;
                color: #F2E8DF !important;
                border-radius: 0in !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .sami-sidebar span {
                transform: rotate(-90deg) !important;
                font-weight: 800 !important;
                font-size: 22pt !important;
                letter-spacing: 0.12em !important;
                color: #F2E8DF !important;
                line-height: 1 !important;
                display: inline-block !important;
              }
              .sami-content {
                flex-grow: 1 !important;
                padding: 0.08in 0.12in !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                height: 100% !important;
                box-sizing: border-box !important;
                position: relative !important;
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
                font-weight: 600 !important;
                width: 1.05in !important;
                flex-shrink: 0 !important;
                color: #374151 !important;
                font-size: 6.5pt !important;
              }
              .sami-label.right {
                width: auto !important;
                margin-left: auto !important;
                padding-left: 0.1in !important;
                padding-right: 0.05in !important;
              }
              .sami-value {
                font-weight: 400 !important;
                color: #374151 !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
              }
              .sami-value.sami-lg {
                font-size: 9.5pt !important;
                font-weight: 600 !important;
                text-transform: uppercase !important;
              }
              .sami-line {
                flex-grow: 1 !important;
                border-bottom: 0.5px solid #cbd5e1 !important;
                min-width: 0.5in !important;
                margin-bottom: 1pt !important;
              }
              .sami-id {
                margin-left: auto !important;
                font-size: 6pt !important;
                font-style: italic !important;
                font-weight: 400 !important;
                color: #94a3b8 !important;
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
  const filterPanel = React.createElement(
    "div",
    { className: "flex flex-col gap-4" },
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
                            filterH.toFixed(2),
                            "\xB0",
                          ),
                        ),
                        React.createElement("input", {
                          type: "range",
                          min: "0",
                          max: "180",
                          step: "0.01",
                          value: filterH,
                          onChange: (e) => setFilterH(Number(e.target.value)),
                          className: "w-full accent-sky-500",
                        }),
                      ),
  );
  return React.createElement(
    "div",
    { className: "flex flex-col md:flex-row h-screen overflow-hidden" },
    React.createElement(
      "div",
      {
        // Desktop gets the original single left pane again: colour card,
        // sliders and the accordion in one column. `contents` keeps the
        // stacked phone layout untouched.
        className:
          "contents md:flex md:flex-col md:w-[24rem] md:shrink-0 md:h-screen md:overflow-y-auto md:border-r md:border-slate-200 md:dark:border-neutral-800 custom-scrollbar",
      },
    React.createElement(
      "header",
      {
        className:
          "shrink-0 bg-white dark:bg-neutral-900 border-b border-slate-200 dark:border-neutral-800 z-30 md:border-b-0",
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
      React.createElement(
        "div",
        {
          className:
            "flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar",
        },
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
            onClick: () => setShowGithubModal(true),
            className:
              "p-2 rounded-md hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 dark:text-neutral-400 transition-colors",
            title: "Sync CSVs to GitHub",
          },
          // lucide dropped brand icons in v1, so there is no "github" glyph.
          React.createElement(Icon, {
            name: "cloud-upload",
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
      React.createElement(
        "button",
        {
          onClick: () => setHeaderExpanded(!headerExpanded),
          "aria-expanded": headerExpanded,
          title: headerExpanded ? "Collapse color panel" : "Expand color panel",
          className:
            "md:hidden w-full flex items-center gap-3 px-4 py-2 border-b border-slate-200 dark:border-neutral-800 text-left",
        },
        React.createElement("span", {
          className:
            "w-7 h-7 rounded-md border border-black/10 shrink-0",
          style: { backgroundColor: compactHex },
        }),
        React.createElement(
          "span",
          { className: "flex-1 min-w-0" },
          React.createElement(
            "span",
            {
              className:
                "block text-[10px] uppercase tracking-widest text-slate-400 truncate",
            },
            "Anchor",
          ),
          React.createElement(
            "span",
            {
              className:
                "block text-sm font-bold text-slate-800 dark:text-neutral-100 truncate leading-tight",
            },
            sameGroupLabels.noun || "\u2014",
          ),
        ),
        React.createElement(
          "span",
          { className: "text-[11px] font-mono text-slate-400" },
          crosshair?.activeErpCode || "",
        ),
        React.createElement(Icon, {
          name: headerExpanded ? "chevron-up" : "chevron-down",
          className: "w-4 h-4 text-slate-400",
        }),
      ),
      React.createElement(
        "div",
        {
          // On a phone the card and sliders are what push the content off
          // screen, so they collapse to a one-line strip by default.
          className: `${headerExpanded ? "block" : "hidden"} md:block`,
        },
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
                crosshair?.activeCommercial &&
                  (() => {
                    const m = colorData?.[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
                    return m?.image && React.createElement("div", {
                      className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                      style: {
                        backgroundImage: `url(${m.image})`,
                        WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                        maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                      },
                    });
                  })(),
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
                getGlobalDuplicate(
                    names,
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
                  ) &&
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
                      onClick: toggleAnchorHere,
                      className: `p-1.5 rounded-lg transition-colors ${isAnchorHere ? "opacity-100" : "opacity-60 hover:opacity-100"}`,
                      title: isAnchorHere
                        ? "Remove the anchor here"
                        : "Add an anchor here",
                    },
                    React.createElement(Icon, {
                      name: "anchor",
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
                        "relative w-full flex justify-center items-center group/noun",
                    },
                    React.createElement("input", {
                      type: "text",
                      value: activeName,
                      onChange: (e) => onNameChange(e.target.value),
                      placeholder: "Unnamed",
                      className: nounInputClass,
                    }),
                    crosshair?.activeSavedColor?.type === "pin" &&
                      crosshair.activeSavedColor.nameOverride &&
                      React.createElement(
                        "button",
                        {
                          onClick: () => updateSavedColor("nameOverride", ""),
                          className: `absolute right-0 opacity-0 group-hover/noun:opacity-100 transition-opacity p-1 rounded-full pointer-events-auto ${isLight ? "hover:bg-black/10" : "hover:bg-white/10"}`,
                          title: "Revert to the inherited name",
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
                    `CIELAB (${illuminant}/${observer}\xB0)`,
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
      ),
    ),
      React.createElement(
        "aside",
        {
          className: `w-full md:w-auto flex-col bg-white dark:bg-neutral-900 z-10 ${
            mobilePanelsOpen ? "flex flex-1 min-h-0" : "hidden"
          } md:flex md:flex-none md:h-auto overflow-y-visible custom-scrollbar`,
        },
      React.createElement(
            React.Fragment,
            null,
            React.createElement(
              CollapsiblePanel,
              {
                title: "Commercial Matches",
                icon: "palette",
                defaultOpen: true,
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
                filterSameNoun,
                globalFilters,
                setGlobalFilters,
                globalFilterMode,
                globalSortBy,
                globalSortAsc,
                sameGroupContext,
                names,
                savedColors,
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
              { title: "Cross-Reference", icon: "shuffle", defaultOpen: false },
              React.createElement(CrossReference, {
                colorData,
                onSelectColor: handlePointClick,
              }),
            ),
            React.createElement(
              CollapsiblePanel,
              {
                title: "Conversions",
                icon: "sliders",
                defaultOpen: false,
                summary: crosshair?.activeErpCode,
              },
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
                  palette.map((item, idx) => {
                    const info = getPaletteItemInfo(item);
                    const displayName = info.displayName;
                    const h = info.hex;
                    const isDragging = draggedPaletteIndex === idx;
                    const isDragOver = dragOverPaletteIndex === idx;
                    return React.createElement(
                      "div",
                      {
                        key: item.id || `pal-${idx}`,
                        draggable: true,
                        onDragStart: (e) => {
                          e.dataTransfer.setData("text/plain", idx.toString());
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedPaletteIndex(idx);
                        },
                        onDragOver: (e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverPaletteIndex !== idx) setDragOverPaletteIndex(idx);
                        },
                        onDragLeave: () => {
                          if (dragOverPaletteIndex === idx) setDragOverPaletteIndex(null);
                        },
                        onDragEnd: () => {
                          setDraggedPaletteIndex(null);
                          setDragOverPaletteIndex(null);
                        },
                        onDrop: (e) => {
                          e.preventDefault();
                          const sourceIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          setDraggedPaletteIndex(null);
                          setDragOverPaletteIndex(null);
                          handleReorderPalette(sourceIdx, idx);
                        },
                        className: `relative group w-10 h-10 rounded-md shadow-sm border transition-all cursor-grab active:cursor-grabbing overflow-hidden flex-shrink-0 ${
                          isDragging
                            ? "opacity-30 scale-90 border-dashed border-sky-400"
                            : isDragOver
                            ? "ring-2 ring-sky-500 scale-105 z-20 border-sky-400"
                            : "border-slate-200 dark:border-neutral-700 hover:border-slate-400 dark:hover:border-neutral-500"
                        }`,
                        style: { backgroundColor: h },
                        onClick: () => handleUpdate([item.L, item.C, item.H], item.spectral, item.brand !== undefined ? { brand: item.brand, originalIndex: item.originalIndex } : null),
                        title: `${displayName} (${item.roleGroup || (idx < 4 ? "60%" : idx < 6 ? "30%" : "10%")} ${item.roleName || (idx < 4 ? "Dominant" : idx < 6 ? "Secondary" : "Accent")} - #${item.erpCode}) - Drag to reorder`,
                      },
                      React.createElement(
                        "div",
                        { className: "absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-70 transition-opacity z-10 pointer-events-none text-white drop-shadow" },
                        React.createElement(Icon, { name: "grip-vertical", className: "w-2.5 h-2.5" })
                      ),
                      info.image &&
                        React.createElement("div", {
                          className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                          style: {
                            backgroundImage: `url(${info.image})`,
                            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                            maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                          },
                        }),
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
                      React.createElement(
                        "div",
                        {
                          className: `absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded text-[7px] font-black uppercase tracking-tight pointer-events-none drop-shadow ${
                            (item.roleGroup || (idx < 4 ? "60%" : idx < 6 ? "30%" : "10%")) === "60%"
                              ? "bg-amber-950/80 text-amber-200 border border-amber-500/30"
                              : (item.roleGroup || (idx < 4 ? "60%" : idx < 6 ? "30%" : "10%")) === "30%"
                              ? "bg-sky-950/80 text-sky-200 border border-sky-500/30"
                              : "bg-emerald-950/90 text-emerald-200 border border-emerald-500/30"
                          }`
                        },
                        item.roleGroup || (idx < 4 ? "60%" : idx < 6 ? "30%" : "10%")
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
                React.createElement(
                  "div",
                  { className: "flex gap-2 mt-1" },
                  React.createElement(
                    "select",
                    {
                      className: "flex-1 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded px-2 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-neutral-300 outline-none hover:bg-slate-100 hover:dark:bg-neutral-800 cursor-pointer transition-colors",
                      onChange: (e) => {
                        generateAutoPalette(e.target.value);
                        e.target.value = "";
                      },
                      value: ""
                    },
                    React.createElement("option", { value: "", disabled: true }, "🏛️ Auto-Generate 60-30-10 Palette..."),
                    React.createElement("option", { value: "luxury_interior" }, "🏛️ Signature 60-30-10 Interior Suite (4 Dominant, 2 Secondary, 1 Accent)"),
                    React.createElement("option", { value: "quiet_luxury" }, "🤍 Quiet Luxury Tonal Suite (60-30-10 Rule)"),
                    React.createElement("option", { value: "warm_wood_stone" }, "🪵 Warm Wood & Stone Harmony (60-30-10 Rule)"),
                    React.createElement("option", { value: "statement_millwork" }, "♟️ High-Contrast Millwork (60-30-10 Rule)"),
                    React.createElement("option", { value: "muted_complement" }, "🍃 Muted Organic Complement (60-30-10 Rule)"),
                    React.createElement("option", { value: "atmospheric_interior" }, "🌌 Soft Atmospheric Interior (60-30-10 Rule)")
                  )
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
                                handleUpdate(
                                  [compSlotA.L, compSlotA.C, compSlotA.H],
                                  compSlotA.spectral,
                                  compSlotA.brand !== undefined ? { brand: compSlotA.brand, originalIndex: compSlotA.originalIndex } : null
                                ),
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
                            compSlotA.image &&
                              React.createElement("div", {
                                className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                                style: {
                                  backgroundImage: `url(${compSlotA.image})`,
                                  WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                                  maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                                },
                              }),
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
                                handleUpdate(
                                  [compSlotA.L, compSlotA.C, compSlotA.H],
                                  compSlotA.spectral,
                                  compSlotA.brand !== undefined ? { brand: compSlotA.brand, originalIndex: compSlotA.originalIndex } : null
                                ),
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
                            onClick: () => {
                              let loadedImage = null;
                              let loadedBrand = undefined;
                              let loadedIndex = undefined;
                              if (crosshair?.activeCommercial) {
                                const m = colorData?.[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
                                loadedImage = m?.image || null;
                                loadedBrand = crosshair.activeCommercial.brand;
                                loadedIndex = crosshair.activeCommercial.originalIndex;
                              } else if (crosshair?.activeSavedColor?.type === "pin") {
                                const pinObj = savedColors[crosshair.activeSavedColor.id];
                                loadedImage = pinObj?.image || (pinObj?.notes?.startsWith("http") ? pinObj.notes : null);
                                loadedBrand = pinObj?.brand;
                                loadedIndex = pinObj?.originalIndex;
                              }
                              setCompSlotA({
                                L: scrubL,
                                C: scrubC,
                                H: scrubH,
                                erpCode: crosshair?.activeErpCode || "",
                                nounId: crosshair?.activeSavedColor
                                  ? crosshair.activeSavedColor.anchorId
                                  : crosshair?.nearestAnchorId,
                                nameOverride:
                                  crosshair?.activeSavedColor?.nameOverride,
                                type: crosshair?.activeSavedColor?.type,
                                spectral: crosshair?.activeSavedColor?.spectral,
                                image: loadedImage,
                                brand: loadedBrand,
                                originalIndex: loadedIndex,
                              });
                            },
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
                                handleUpdate(
                                  [compSlotB.L, compSlotB.C, compSlotB.H],
                                  compSlotB.spectral,
                                  compSlotB.brand !== undefined ? { brand: compSlotB.brand, originalIndex: compSlotB.originalIndex } : null
                                ),
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
                            compSlotB.image &&
                              React.createElement("div", {
                                className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
                                style: {
                                  backgroundImage: `url(${compSlotB.image})`,
                                  WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                                  maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                                },
                              }),
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
                                handleUpdate(
                                  [compSlotB.L, compSlotB.C, compSlotB.H],
                                  compSlotB.spectral,
                                  compSlotB.brand !== undefined ? { brand: compSlotB.brand, originalIndex: compSlotB.originalIndex } : null
                                ),
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
                            onClick: () => {
                              let loadedImage = null;
                              let loadedBrand = undefined;
                              let loadedIndex = undefined;
                              if (crosshair?.activeCommercial) {
                                const m = colorData?.[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
                                loadedImage = m?.image || null;
                                loadedBrand = crosshair.activeCommercial.brand;
                                loadedIndex = crosshair.activeCommercial.originalIndex;
                              } else if (crosshair?.activeSavedColor?.type === "pin") {
                                const pinObj = savedColors[crosshair.activeSavedColor.id];
                                loadedImage = pinObj?.image || (pinObj?.notes?.startsWith("http") ? pinObj.notes : null);
                                loadedBrand = pinObj?.brand;
                                loadedIndex = pinObj?.originalIndex;
                              }
                              setCompSlotB({
                                L: scrubL,
                                C: scrubC,
                                H: scrubH,
                                erpCode: crosshair?.activeErpCode || "",
                                nounId: crosshair?.activeSavedColor
                                  ? crosshair.activeSavedColor.anchorId
                                  : crosshair?.nearestAnchorId,
                                nameOverride:
                                  crosshair?.activeSavedColor?.nameOverride,
                                type: crosshair?.activeSavedColor?.type,
                                spectral: crosshair?.activeSavedColor?.spectral,
                                image: loadedImage,
                                brand: loadedBrand,
                                originalIndex: loadedIndex,
                              });
                            },
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
                summary: dictNotes?.[crosshair?.nearestAnchorId]
                  ? "has note"
                  : null,
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
                }),
              ),
            ),
          ),
      ),
    ),
    React.createElement(
      "div",
      {
        className:
          "contents md:flex md:flex-col md:flex-1 md:min-w-0 md:h-screen",
      },
    React.createElement(
      "div",
      {
        className:
          `${
            mobilePanelsOpen ? "hidden md:flex" : "flex"
          } shrink-0 items-center gap-2 px-4 py-1.5 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 relative z-20`,
      },
      React.createElement(
        "div",
        {
          className:
            "hidden md:flex items-center gap-1 flex-nowrap overflow-x-auto no-scrollbar",
        },
        renderDestinations("top"),
      ),
      React.createElement("div", { className: "ml-auto" }),
      React.createElement(SortControl, {
        fields: DB_SORT_FIELDS,
        sortBy: globalSortBy,
        setSortBy: setGlobalSortBy,
        sortAsc: globalSortAsc,
        setSortAsc: setGlobalSortAsc,
        compact: true,
      }),
      React.createElement(
        "button",
        {
          onClick: () => setShowFilterBuilder(!showFilterBuilder),
          className: `flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors ${
            globalFilters.length
              ? "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400"
              : "border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800"
          }`,
        },
        React.createElement(Icon, { name: "filter", className: "w-3.5 h-3.5" }),
        globalFilters.length
          ? `Filters \u00b7 ${globalFilters.length}`
          : "Filters",
      ),
      showFilterBuilder &&
        ReactDOM.createPortal(
          React.createElement(
            "div",
            {
              // Portalled to body: as an absolutely positioned child of the bar
              // it was painted under the panels below and clipped by their
              // stacking contexts.
              className:
                "fixed inset-0 z-[95] flex flex-col justify-end md:block",
            },
            React.createElement("div", {
              className: "absolute inset-0 bg-black/30",
              onClick: () => setShowFilterBuilder(false),
            }),
            React.createElement(
              "div",
              {
                className:
                  "relative md:absolute md:right-3 md:top-28 bg-white dark:bg-neutral-900 border-t md:border border-slate-200 dark:border-neutral-800 rounded-t-2xl md:rounded-xl shadow-2xl max-h-[80vh] md:max-h-[70vh] flex flex-col md:w-[420px]",
              },
              React.createElement("div", {
                className:
                  "md:hidden mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-slate-300 dark:bg-neutral-700",
              }),
              React.createElement(
                "div",
                {
                  className:
                    "flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-neutral-800",
                },
                React.createElement(
                  "span",
                  {
                    className:
                      "text-[11px] font-bold uppercase tracking-widest text-slate-500",
                  },
                  "Filters",
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => setShowFilterBuilder(false),
                    className: "text-slate-400 p-1",
                    title: "Close filters",
                  },
                  React.createElement(Icon, { name: "x", className: "w-4 h-4" }),
                ),
              ),
              React.createElement(
                "div",
                {
                  className:
                    "p-3 pb-8 overflow-y-auto custom-scrollbar flex flex-col gap-3",
                },
                React.createElement(FilterBuilder, {
                  rows: globalFilters,
                  setRows: setGlobalFilters,
                  optionsFor: filterOptionsFor,
                  presets: filterPresets,
                  mode: globalFilterMode,
                  setMode: setGlobalFilterMode,
                  ctx: sameGroupContext,
                }),
                React.createElement(
                  "div",
                  {
                    className:
                      "pt-3 border-t border-slate-200 dark:border-neutral-800",
                  },
                  React.createElement(
                    "span",
                    {
                      className:
                        "block text-[9px] font-bold uppercase tracking-widest text-slate-400 pb-2",
                    },
                    "Viewport tolerance",
                  ),
                  filterPanel,
                ),
              ),
            ),
          ),
          document.body,
        ),
    ),
    React.createElement(
      "div",
      {
        className:
          "flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 w-full",
      },
    React.createElement(
      "main",
      {
        className:
          `${
            mobilePanelsOpen ? "hidden md:flex" : "flex"
          } flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-neutral-950 relative`,
      },
      React.createElement(
        "div",
        {
          className:
            "flex flex-col md:flex-row md:items-center md:justify-between gap-1 px-4 pt-3 md:pt-4 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10 flex-shrink-0",
        },
        React.createElement(
          "div",
          { className: "flex-1 flex items-center min-w-0 md:mr-4 pb-1" },
          (() => {
            const dest = destForTab(activeTab);
            if (dest.tabs.length < 2) return null;
            return React.createElement(
              "div",
              {
                className:
                  "flex items-center gap-1 flex-nowrap overflow-x-auto no-scrollbar -mx-1 px-1",
              },
              dest.tabs.map((tid) => {
                const t = tabs.find((x) => x.id === tid);
                if (!t) return null;
                const on = tid === activeTab;
                return React.createElement(
                  "button",
                  {
                    key: tid,
                    onClick: () => setActiveTab(tid),
                    className: `px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full whitespace-nowrap transition-colors ${
                      on
                        ? "bg-slate-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
                        : "text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                    }`,
                  },
                  t.label,
                );
              }),
            );
          })(),
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
              !["top", "chroma", "slice", "3d"].includes(activeTab) &&
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
              !["top", "chroma", "slice", "3d"].includes(activeTab) &&
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
                        "details",
                        { className: "px-2 py-1.5", open: true },
                        React.createElement(
                          "summary",
                          { className: "cursor-pointer text-slate-700 dark:text-neutral-300 font-bold" },
                          "Commercial Colors"
                        ),
                        colorData &&
                          Object.keys(colorData).map((brand) =>
                            React.createElement(
                              "label",
                              {
                                key: brand,
                                className:
                                  "flex items-center gap-2 px-2 py-1 pl-4 hover:bg-slate-50 dark:hover:bg-neutral-800 rounded cursor-pointer text-slate-500 dark:text-neutral-400 mt-1",
                              },
                              React.createElement("input", {
                                type: "checkbox",
                                checked:
                                  activeTab === "db" ? viewportVisibility.brands[brand] !== false : viewportVisibility.brands[brand] === true,
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
                    min: "0.1",
                    max: "5",
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
            React.createElement(
              "div",
              { 
                style: { display: activeTab === "db" ? "block" : "none" },
                className: "w-full h-full"
              },
              React.createElement(ViewDatabase, {
                setFilterSameNoun,
                filterSameNoun,
                globalFilters,
                setGlobalFilters,
                globalFilterMode,
                globalSortBy,
                globalSortAsc,
                sameGroupContext,
                colorData: filteredColorData,
                fullColorData: colorData,
                updateColorData,
                swatchLayout,
                swatchZoom,
                handlePointClick,
                crosshair,
                searchTerm: deferredSearch,
                setSearchTerm: setViewportSearchQuery,
                tagFilter: viewportTagFilter,
                setTagFilter: setViewportTagFilter,
                filterPt,
                selectedIds,
                setSelectedIds,
                handleBatchTag,
                handleBatchRemoveTag,
                globalTags,
                onOpenAveryModal: (overrideIds) => {
                  const ids = overrideIds || selectedIds;
                  setAveryPrintSourceType("db");
                  setSelectedPrintIds(ids);
                  setShowAveryModal(true);
                },
              })
            ),
            spaceSeenRef.current &&
              React.createElement(
                "div",
                {
                  style: { display: ["top", "chroma", "slice", "3d"].includes(activeTab) ? "block" : "none" },
                  className: "w-full h-full",
                },
              React.createElement(ViewSpace, {
                active: ["top", "chroma", "slice", "3d"].includes(activeTab),
                points: filteredViewData.points,
                colorData: filteredColorData,
                names,
                theme,
                scrubL,
                scrubC,
                scrubH,
                filterL,
                filterC,
                filterH,
                handlePointClick,
                onCursor: (L, C, H) => {
                  setScrubL(L);
                  setScrubC(C);
                  setScrubH(H);
                  setTemporarySpectral(null);
                },
              })),
            activeTab === "groups" &&
              React.createElement(ViewGroups, {
                settings: groupSettings,
                setSettings: setGroupSettings,
              }),
            activeTab === "anchors" &&
              React.createElement(ViewAnchors, {
                savedColors,
                setSavedColors,
                names,
                setNames,
                scrubL,
                scrubC,
                scrubH,
                handleUpdate,
                setActiveTab,
              }),
            activeTab === "pins" &&
              React.createElement(ViewPins, {
                handlePointClick,
                swatchZoom,
                setSwatchZoom,
                globalSortBy,
                globalSortAsc,
                globalFilters,
                globalFilterMode,
                // Only rows that follow the cursor need its context; passing it
                // otherwise re-rendered the whole catalog on every cursor move.
                sameGroupContext: (globalFilters || []).some(
                  (r) => (!r.scope || r.scope === "viewport") && (r.dynamic || r.field === "noun"),
                )
                  ? sameGroupContext
                  : null,
                names,
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
                onOpenAveryModal: (overrideIds) => {
                  const ids = overrideIds || selectedIds;
                  setAveryPrintSourceType("pins");
                  setSelectedPrintIds(ids);
                  setShowAveryModal(true);
                },
              }),
          ),
        ),
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
        const nA = getInheritedPinNames(compSlotA, savedColors, names).displayName;
        const nB = getInheritedPinNames(compSlotB, savedColors, names).displayName;
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
            (compSlotA.image || compSlotB.image) &&
              React.createElement(
                "button",
                {
                  onClick: () =>
                    setShowFullscreenImageOverlay(!showFullscreenImageOverlay),
                  className:
                    "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2",
                },
                React.createElement(Icon, {
                  name: showFullscreenImageOverlay ? "image-off" : "image",
                  className: "w-4 h-4",
                }),
                showFullscreenImageOverlay ? "Hide Images" : "Show Images",
              ),
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
                "flex-1 flex flex-col justify-between p-16 relative transition-colors duration-300 cursor-pointer group overflow-hidden",
              style: {
                backgroundColor: hA,
                color: compSlotA.L > 0.65 ? "#010D00" : "#F2E8DF",
              },
              onClick: () => {
                handleUpdate(
                  [compSlotA.L, compSlotA.C, compSlotA.H],
                  compSlotA.spectral,
                  compSlotA.brand !== undefined ? { brand: compSlotA.brand, originalIndex: compSlotA.originalIndex } : null
                );
                setShowCompareFullscreen(false);
              },
            },
            compSlotA.image &&
              showFullscreenImageOverlay &&
              React.createElement("div", {
                className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none transition-transform duration-500 group-hover:scale-105",
                style: {
                  backgroundImage: `url(${compSlotA.image})`,
                  WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                  maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                },
              }),
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
                "flex-1 flex flex-col justify-between p-16 relative transition-colors duration-300 cursor-pointer group overflow-hidden",
              style: {
                backgroundColor: hB,
                color: compSlotB.L > 0.65 ? "#010D00" : "#F2E8DF",
              },
              onClick: () => {
                handleUpdate(
                  [compSlotB.L, compSlotB.C, compSlotB.H],
                  compSlotB.spectral,
                  compSlotB.brand !== undefined ? { brand: compSlotB.brand, originalIndex: compSlotB.originalIndex } : null
                );
                setShowCompareFullscreen(false);
              },
            },
            compSlotB.image &&
              showFullscreenImageOverlay &&
              React.createElement("div", {
                className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none transition-transform duration-500 group-hover:scale-105",
                style: {
                  backgroundImage: `url(${compSlotB.image})`,
                  WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                  maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                },
              }),
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
          "div",
          { className: "absolute top-8 left-8 z-[110] flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/20 px-5 py-2.5 rounded-full text-white shadow-xl pointer-events-none select-none" },
          React.createElement("span", { className: "text-amber-400 font-black text-xs tracking-wider uppercase flex items-center gap-1.5" },
            React.createElement(Icon, { name: "layers", className: "w-4 h-4" }),
            "60-30-10 Interior Design Rule"
          ),
          React.createElement("span", { className: "text-white/30 text-xs" }, "•"),
          React.createElement("span", { className: "text-amber-200 text-xs font-bold" }, "60% Dominant (4 Swatches)"),
          React.createElement("span", { className: "text-white/30 text-xs" }, "•"),
          React.createElement("span", { className: "text-sky-200 text-xs font-bold" }, "30% Secondary (2 Swatches)"),
          React.createElement("span", { className: "text-white/30 text-xs" }, "•"),
          React.createElement("span", { className: "text-emerald-300 text-xs font-bold" }, "10% Accent (1 Swatch)")
        ),
        React.createElement(
          "div",
          { className: "absolute top-8 right-8 z-[110] flex gap-2" },
          React.createElement(
            "button",
            {
              onClick: () => setShowFullscreenSpaces(!showFullscreenSpaces),
              className:
                "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2",
            },
            React.createElement(Icon, {
              name: showFullscreenSpaces ? "sliders-horizontal" : "sliders",
              className: "w-4 h-4",
            }),
            showFullscreenSpaces ? "Hide Values" : "Show Values"
          ),
          React.createElement(
            "button",
            {
              onClick: () => setShowFullscreenImageOverlay(!showFullscreenImageOverlay),
              className:
                "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2",
            },
            React.createElement(Icon, {
              name: showFullscreenImageOverlay ? "image-off" : "image",
              className: "w-4 h-4",
            }),
            showFullscreenImageOverlay ? "Hide Images" : "Show Images"
          ),
          React.createElement(
            "button",
            {
              onClick: () => setShowFullscreenPalette(false),
              className:
                "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg",
            },
            "Close Palette"
          )
        ),
        React.createElement(
          "div",
          { className: "flex w-full h-full relative z-10" },
          palette.map((item, idx) => {
            const info = getPaletteItemInfo(item);
            const displayName =
              info.displayName !== "Unnamed"
                ? info.displayName
                : item.erpCode
                  ? `#${item.erpCode}`
                  : "\u2014";
            const h = info.hex;
            const isDragging = draggedPaletteIndex === idx;
            const isDragOver = dragOverPaletteIndex === idx;

            // Compute extra color spaces
            const itemColor = new Color("oklch", [item.L, item.C, item.H]);
            const displayHex = info.hex;
            
            const rCo = itemColor.to("srgb").coords;
            const r_ = Math.max(0, Math.min(1, rCo[0]));
            const g_ = Math.max(0, Math.min(1, rCo[1]));
            const b_ = Math.max(0, Math.min(1, rCo[2]));
            const k_ = 1 - Math.max(r_, g_, b_);
            const c_ = k_ === 1 ? 0 : (1 - r_ - k_) / (1 - k_);
            const m_ = k_ === 1 ? 0 : (1 - g_ - k_) / (1 - k_);
            const y_ = k_ === 1 ? 0 : (1 - b_ - k_) / (1 - k_);
            const displayCmyk = `CMYK: [${Math.round(c_ * 100)}%, ${Math.round(m_ * 100)}%, ${Math.round(y_ * 100)}%, ${Math.round(k_ * 100)}%]`;
            
            let d65XYZ;
            if (item.spectral && item.spectral.length === 31) {
              d65XYZ = calculateXYZFromSpectral(item.spectral, 2, "D65");
            } else {
              d65XYZ = itemColor.to("xyz-d65").coords;
            }
            const labCoords = xyzToLab(d65XYZ, [0.95047, 1.00000, 1.08883]);
            const fmt = (v, d = 3) => (isNaN(v) ? "0.000" : Number(v).toFixed(d));
            const displayCielab = `CIELAB: [${fmt(labCoords[0], 1)}, ${fmt(labCoords[1], 1)}, ${fmt(labCoords[2], 1)}]`;
            
            const hsl = itemColor.to("hsl");
            const displayHsl = `HSL: [${fmt(hsl.coords[0], 1)}, ${fmt(hsl.coords[1], 1)}%, ${fmt(hsl.coords[2], 1)}%]`;
            
            const displayOklch = `OKLCH: [${fmt(itemColor.coords[0], 3)}, ${fmt(itemColor.coords[1], 3)}, ${fmt(itemColor.coords[2], 1)}]`;

            const L_ = itemColor.coords[0];
            const C_ = itemColor.coords[1];
            const satVal = L_ > 0 ? C_ / L_ : 0;
            const displaySat = `SATURATION (S=C/L): ${fmt(satVal, 3)}`;

            return React.createElement(
              "div",
              {
                key: item.id || `fsp-${idx}`,
                draggable: true,
                onDragStart: (e) => {
                  e.dataTransfer.setData("text/plain", idx.toString());
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedPaletteIndex(idx);
                },
                onDragOver: (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverPaletteIndex !== idx) setDragOverPaletteIndex(idx);
                },
                onDragLeave: () => {
                  if (dragOverPaletteIndex === idx) setDragOverPaletteIndex(null);
                },
                onDragEnd: () => {
                  setDraggedPaletteIndex(null);
                  setDragOverPaletteIndex(null);
                },
                onDrop: (e) => {
                  e.preventDefault();
                  const sourceIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                  setDraggedPaletteIndex(null);
                  setDragOverPaletteIndex(null);
                  handleReorderPalette(sourceIdx, idx);
                },
                className: `flex flex-col justify-end p-8 transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden ${
                  isDragging ? "opacity-30 scale-[0.97]" : ""
                } ${
                  isDragOver ? "ring-4 ring-sky-400 ring-inset z-30 scale-[0.99]" : ""
                }`,
                style: {
                  backgroundColor: h,
                  flex: `${item.ratio || (idx < 4 ? 15 : idx < 6 ? 15 : 10)} 1 0%`
                },
                onClick: () => {
                  handleUpdate(
                    [item.L, item.C, item.H],
                    item.spectral,
                    item.brand !== undefined ? { brand: item.brand, originalIndex: item.originalIndex } : null
                  );
                  setShowFullscreenPalette(false);
                },
              },
              React.createElement(
                "div",
                { className: "absolute top-4 left-4 z-20 flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[11px] font-bold tracking-wider uppercase pointer-events-none select-none shadow-md" },
                React.createElement(Icon, { name: "grip-vertical", className: "w-3.5 h-3.5" }),
                "Drag to reorder"
              ),
              React.createElement(
                "div",
                { className: `absolute top-4 right-4 z-20 flex items-center gap-1.5 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[11px] font-black tracking-widest uppercase pointer-events-none select-none shadow-md border border-white/20 ${
                  (item.roleGroup || (idx < 4 ? "60%" : idx < 6 ? "30%" : "10%")) === "60%"
                    ? "bg-amber-950/80 text-amber-200"
                    : (item.roleGroup || (idx < 4 ? "60%" : idx < 6 ? "30%" : "10%")) === "30%"
                    ? "bg-sky-950/80 text-sky-200"
                    : "bg-emerald-950/90 text-emerald-200"
                }` },
                `${item.roleGroup || (idx < 4 ? "60%" : idx < 6 ? "30%" : "10%")} ${item.roleName || (idx < 4 ? "Dominant" : idx < 6 ? "Secondary" : "Accent")}`
              ),
              info.image &&
                showFullscreenImageOverlay &&
                React.createElement("div", {
                  className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none transition-transform duration-500 group-hover:scale-105",
                  style: {
                    backgroundImage: `url(${info.image})`,
                    WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                    maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                  },
                }),
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
                showFullscreenSpaces && React.createElement(
                  "div",
                  {
                    onClick: (e) => e.stopPropagation(),
                    className:
                      "mt-3 pt-3 border-t border-current/20 font-mono text-xs flex flex-col gap-1.5 opacity-90 backdrop-blur-[2px] bg-black/5 p-2 rounded-lg max-w-fit cursor-text select-text",
                  },
                  React.createElement("div", { className: "font-bold" }, `HEX: ${displayHex}`),
                  React.createElement("div", {}, displayCmyk),
                  React.createElement("div", {}, displayCielab),
                  React.createElement("div", {}, displayHsl),
                  React.createElement("div", {}, displayOklch),
                  React.createElement("div", {}, displaySat),
                )
              ),
            );
          }),
        ),
      ),
    showFullscreenPreview &&
      !showCompareFullscreen &&
      (() => {
        let previewImage = null;
        if (crosshair?.activeCommercial) {
          const m = colorData?.[crosshair.activeCommercial.brand]?.[crosshair.activeCommercial.originalIndex];
          previewImage = m?.image || null;
        } else if (crosshair?.activeSavedColor?.type === "pin") {
          const pinObj = savedColors[crosshair.activeSavedColor.id];
          previewImage = pinObj?.image || (pinObj?.notes?.startsWith("http") ? pinObj.notes : null);
        }
        return React.createElement(
          "div",
          {
            className:
              "fixed inset-0 z-[100] flex flex-col items-center justify-end p-20 animate-in fade-in duration-300 cursor-pointer overflow-hidden",
            style: { backgroundColor: crosshairHex },
            onClick: () => setShowFullscreenPreview(false),
          },
          previewImage &&
            showFullscreenImageOverlay &&
            React.createElement("div", {
              className: "absolute inset-0 bg-cover bg-center rounded-[inherit] pointer-events-none",
              style: {
                backgroundImage: `url(${previewImage})`,
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
              },
            }),
          React.createElement(
            "div",
            { className: "absolute top-8 right-8 z-[110] flex gap-2" },
            previewImage &&
              React.createElement(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    setShowFullscreenImageOverlay(!showFullscreenImageOverlay);
                  },
                  className:
                    "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2",
                },
                React.createElement(Icon, {
                  name: showFullscreenImageOverlay ? "image-off" : "image",
                  className: "w-4 h-4",
                }),
                showFullscreenImageOverlay ? "Hide Images" : "Show Images",
              ),
            React.createElement(
              "button",
              {
                onClick: (e) => {
                  e.stopPropagation();
                  setShowFullscreenPreview(false);
                },
                className:
                  "bg-black/40 hover:bg-black/60 text-white px-6 py-3 rounded-md font-bold text-xs uppercase tracking-widest backdrop-blur-md shadow-lg",
              },
              "Close Preview",
            )
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
        );
      })(),
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
                      "Every color takes the name of the nearest anchor in OkLab, the same cells you see in Explore. Add, rename and move anchors in the Anchors tab; a pin can override its name.",
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
    React.createElement(
      "nav",
      {
        className:
          "md:hidden flex shrink-0 border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 order-last",
      },
      renderDestinations("bar"),
      React.createElement(
        "button",
        {
          onClick: () => setMobilePanelsOpen(!mobilePanelsOpen),
          "aria-current": mobilePanelsOpen,
          className: `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            mobilePanelsOpen
              ? "text-slate-900 dark:text-neutral-100"
              : "text-slate-400 dark:text-neutral-500"
          }`,
        },
        React.createElement(Icon, { name: "panel-right", className: "w-4 h-4" }),
        "Tools",
      ),
    ),
    searchQuery &&
      ReactDOM.createPortal(
        React.createElement(
          "div",
          {
            // Results used to render inside the inspector, which is hidden on
            // phones — so searching looked like it did nothing.
            className:
              "fixed inset-0 z-[97] flex flex-col",
          },
          React.createElement("div", {
            className: "absolute inset-0 bg-black/30",
            onClick: () => setSearchQuery(""),
          }),
          React.createElement(
            "div",
            {
              className:
                "relative mx-auto mt-[16vh] w-[92vw] md:w-[560px] max-h-[62vh] bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl shadow-2xl flex flex-col overflow-hidden",
            },
            React.createElement(
              "div",
              {
                className:
                  "flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-neutral-800",
              },
              React.createElement(
                "span",
                {
                  className:
                    "text-[11px] font-bold uppercase tracking-widest text-slate-500",
                },
                `Results for "${searchQuery}"`,
              ),
              React.createElement(
                "button",
                {
                  onClick: () => setSearchQuery(""),
                  className: "text-slate-400 p-1",
                  title: "Close search",
                },
                React.createElement(Icon, { name: "x", className: "w-4 h-4" }),
              ),
            ),
              React.createElement(
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
                            ? React.createElement(
                                "div",
                                {
                                  className:
                                    "w-10 h-10 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-700 shrink-0 group-hover:scale-105 transition-transform relative overflow-hidden",
                                  style: { backgroundColor: res.color },
                                },
                                React.createElement("div", {
                                  className: "absolute inset-0 bg-cover bg-center rounded-[inherit]",
                                  style: {
                                    backgroundImage: `url(${res.image})`,
                                    WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                                    maskImage: "linear-gradient(to bottom, black 0%, transparent 66%)",
                                  },
                                })
                              )
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
          ),
        ),
        document.body,
      ),
    showFileManager &&
      React.createElement(FileManager, {
        linkedFiles,
        setLinkedFiles,
        onClose: () => setShowFileManager(false),
      }),
    showGithubModal &&
      React.createElement(GitHubSyncModal, {
        config: githubConfig,
        setConfig: setGithubConfig,
        status: syncStatus,
        onSync: handleSyncToCSV,
        onPull: handlePullFromGitHub,
        onClose: () => setShowGithubModal(false),
      }),
    showDatabaseManager &&
      React.createElement(DatabaseManager, {
        colorData,
        updateColorData,
        swatchLayout,
        swatchZoom,
        handlePointClick,
        crosshair,
        setFilterSameNoun,
        filterSameNoun,
        globalFilters,
        setGlobalFilters,
        globalFilterMode,
        globalSortBy,
        globalSortAsc,
        sameGroupContext,
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
                    { className: "flex items-center gap-1 bg-slate-100 dark:bg-neutral-800 p-1 rounded-lg border border-slate-200 dark:border-neutral-700 text-[10px] font-bold uppercase tracking-wider shrink-0" },
                    [
                      { id: "palette", label: "Palette" },
                      { id: "pins", label: "Pins" },
                      { id: "db", label: "Commercial DB" },
                    ].map((src) =>
                      React.createElement(
                        "button",
                        {
                          key: src.id,
                          onClick: () => {
                            setAveryPrintSourceType(src.id);
                            if (src.id === "palette") {
                              setSelectedPrintIds(palette.map((p) => p.id));
                            } else if (src.id === "pins") {
                              const pins = Object.values(savedColors).filter((sc) => sc.type === "pin");
                              setSelectedPrintIds(pins.map((p) => p.id));
                            } else if (src.id === "db") {
                              const sel = selectedIds && selectedIds.length > 0 ? selectedIds : [];
                              setSelectedPrintIds(sel);
                            }
                          },
                          className: `flex-1 py-1 px-2.5 rounded transition-colors text-center cursor-pointer ${
                            averyPrintSourceType === src.id || (averyPrintSourceType === "commercial" && src.id === "db")
                              ? "bg-white dark:bg-neutral-700 text-sky-600 dark:text-sky-400 shadow-sm font-extrabold"
                              : "text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                          }`,
                        },
                        src.label
                      )
                    )
                  ),
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
                    averySourceItems.length === 0
                      ? React.createElement(
                          "div",
                          { className: "p-6 text-center text-xs text-slate-400 italic" },
                          averyPrintSourceType === "db" || averyPrintSourceType === "commercial"
                            ? "No colors selected from the Commercial DB. Select colors in the Database view to print labels."
                            : "No colors available to print."
                        )
                      : averySourceItems.map((item) => {
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
                          ].map((field) => {
                            const effectiveGlobal = info[field.key] || field.global;
                            return React.createElement(
                              "div",
                              { key: field.key, className: "flex items-center justify-between gap-2" },
                              React.createElement("span", { className: "text-[9px] uppercase font-bold text-slate-500 truncate" }, field.label),
                              React.createElement("select", {
                                value: myConfig[field.key] ?? "-",
                                onChange: (e) => updateMyConfig(field.key, e.target.value === "-" ? null : e.target.value),
                                className: "w-24 h-6 px-1.5 text-[9px] border border-slate-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 outline-none"
                              },
                                field.options.map(opt => React.createElement("option", { key: opt, value: opt }, opt === "-" ? `Default (${effectiveGlobal.split(" ")[0]})` : opt))
                              )
                            )
                          })
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
            grid-template-rows: repeat(7, 1.5in) !important;
            column-gap: 0.188in !important;
            row-gap: 0in !important;
            width: 8.5in !important;
            height: 11in !important;
            padding-top: calc(0.25in + 1mm) !important;
            padding-bottom: calc(0.25in - 1mm) !important;
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
            overflow: visible !important;
            background: white !important;
            border-radius: 0in !important;
            font-family: 'Bicyclette', 'Byciclette', 'Inter', system-ui, sans-serif !important;
          }
          .avery-label-border {
            outline: 1px dashed rgba(180, 169, 158, 0.4) !important;
            outline-offset: -1px !important;
          }
          .avery-label-borderless {
            outline: 1px solid transparent !important;
            outline-offset: -1px !important;
          }
          .sami-sidebar {
            width: 0.45in !important;
            height: 100% !important;
            box-sizing: border-box !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background-color: #2B4032 !important;
            color: #F2E8DF !important;
            border-radius: 0in !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sami-sidebar span {
            transform: rotate(-90deg) !important;
            font-weight: 800 !important;
            font-size: 22pt !important;
            letter-spacing: 0.12em !important;
            color: #F2E8DF !important;
            line-height: 1 !important;
            display: inline-block !important;
          }
          .sami-content {
            flex-grow: 1 !important;
            padding: 0.08in 0.12in !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 100% !important;
            box-sizing: border-box !important;
            position: relative !important;
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
            font-weight: 600 !important;
            width: 1.05in !important;
            flex-shrink: 0 !important;
            color: #374151 !important;
            font-size: 6.5pt !important;
          }
          .sami-label.right {
            width: auto !important;
            margin-left: auto !important;
            padding-left: 0.1in !important;
            padding-right: 0.05in !important;
          }
          .sami-value {
            font-weight: 400 !important;
            color: #374151 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .sami-value.sami-lg {
            font-size: 9.5pt !important;
            font-weight: 600 !important;
            text-transform: uppercase !important;
          }
          .sami-line {
            flex-grow: 1 !important;
            border-bottom: 0.5px solid #cbd5e1 !important;
            min-width: 0.5in !important;
            margin-bottom: 1pt !important;
          }
          .sami-id {
            margin-left: auto !important;
            font-size: 6pt !important;
            font-style: italic !important;
            font-weight: 400 !important;
            color: #94a3b8 !important;
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
            const itemSheen = config.sheen ?? (info.sheen || null) ?? printLabelSheen;
            const itemMaterial = config.material ?? (info.material || null) ?? printLabelMaterial;
            const itemVisualTexture = config.visualTexture ?? (info.visualTexture || null) ?? printLabelVisualTexture;
            const itemTactileTexture = config.tactileTexture ?? (info.tactileTexture || null) ?? printLabelTactileTexture;
            const itemDoorProfile = config.doorProfile ?? (info.doorProfile || null) ?? printLabelDoorProfile;
            
            // Build the ID string like [Color]-[Sheen]-[Visual Pattern]-[Tactile Texture]-[Profile]
            const abbrSheen = itemSheen.split(' ')[0] || "XX";
            const abbrVisual = itemVisualTexture.split(' ')[0] || "XX";
            const abbrTactile = itemTactileTexture.split(' ')[0] || "XX";
            const abbrProfile = itemDoorProfile.split(' ')[0] || "XX";
            const labelColorCode = get7DigitOklch(info.L, info.C, info.H);
            const generatedIdStr = `${labelColorCode}-${abbrSheen}-${abbrVisual}-${abbrTactile}-${abbrProfile}`;

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
                  style: { backgroundColor: "#2B4032", color: "#F2E8DF" }
                },
                React.createElement("span", null, "SAMI")
              ),
              React.createElement(
                "div",
                { className: "sami-content" },
                // Approval block in the right, vertically centered and enlarged
                React.createElement(
                  "div",
                  { 
                    style: { 
                      position: "absolute", 
                      top: "50%", 
                      transform: "translateY(-50%)", 
                      right: "0.06in", 
                      width: "1.36in", 
                      height: "0.88in", 
                      display: "flex", 
                      flexDirection: "column", 
                      justifyContent: "space-between", 
                      color: "#374151", 
                      fontSize: "5pt", 
                      zIndex: 10, 
                      backgroundColor: "white",
                      border: "0.6px solid #cbd5e1",
                      borderRadius: "2px",
                      padding: "3px 4px",
                      boxSizing: "border-box"
                    } 
                  },
                  React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: "4.5pt",
                        fontWeight: 700,
                        color: "#4b5563",
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                        textAlign: "center",
                        borderBottom: "0.5px solid #e2e8f0",
                        paddingBottom: "2px",
                        lineHeight: 1.1
                      }
                    },
                    "For use by SAMI Design only"
                  ),
                  React.createElement(
                    "div",
                    { style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "1px 2px" } },
                    React.createElement(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "3.5px" } },
                      React.createElement("div", { style: { width: "7.5px", height: "7.5px", border: "0.6px solid #6b7280", boxSizing: "border-box", borderRadius: "1px" } }),
                      React.createElement("span", { style: { fontWeight: 600, fontSize: "5pt", color: "#374151" } }, "Approved")
                    ),
                    React.createElement(
                      "div",
                      { style: { display: "flex", alignItems: "center", gap: "3.5px" } },
                      React.createElement("div", { style: { width: "7.5px", height: "7.5px", border: "0.6px solid #6b7280", boxSizing: "border-box", borderRadius: "1px" } }),
                      React.createElement("span", { style: { fontWeight: 600, fontSize: "5pt", color: "#374151" } }, "Rejected")
                    )
                  ),
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "flex-end", gap: "3px", width: "100%", padding: "1px 2px" } },
                    React.createElement("span", { style: { fontWeight: 600, fontSize: "5pt", color: "#374151", minWidth: "22px" } }, "Date:"),
                    React.createElement("div", { style: { flexGrow: 1, borderBottom: "0.6px solid #cbd5e1", height: "8px" } })
                  ),
                  React.createElement(
                    "div",
                    { style: { display: "flex", alignItems: "flex-end", gap: "3px", width: "100%", padding: "1px 2px" } },
                    React.createElement("span", { style: { fontWeight: 600, fontSize: "5pt", color: "#374151", minWidth: "22px" } }, "Sign:"),
                    React.createElement("div", { style: { flexGrow: 1, borderBottom: "0.6px solid #cbd5e1", height: "8px" } })
                  )
                ),
                // Row 1: Name (Full width available)
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "NAME:"),
                  React.createElement("span", { className: "sami-value sami-lg uppercase", style: { maxWidth: "2.3in" } }, info.displayName)
                ),
                // Row 2: Color Code
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "COLOR CODE:"),
                  React.createElement("span", { className: "sami-value", style: { maxWidth: "1.05in" } }, labelColorCode)
                ),
                // Row 3: Sheen
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "SHEEN:"),
                  React.createElement("span", { className: "sami-value", style: { maxWidth: "1.05in" } }, itemSheen)
                ),
                // Row 4: Visual Pattern
                React.createElement(
                  "div",
                  { className: "sami-row" },
                  React.createElement("span", { className: "sami-label" }, "VISUAL PATTERN:"),
                  React.createElement("span", { className: "sami-value", style: { maxWidth: "1.05in" } }, itemVisualTexture)
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
// Without this, a single bad render unmounts the whole tree and leaves a blank
// page with nothing but a console trace.
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("ColorSAMificator crashed:", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return React.createElement(
      "div",
      {
        className:
          "min-h-screen flex flex-col items-center justify-center gap-4 p-8 font-mono text-center",
      },
      React.createElement(
        "div",
        { className: "text-xs uppercase tracking-widest text-slate-400" },
        "Something broke",
      ),
      React.createElement(
        "pre",
        {
          className:
            "text-[11px] text-red-600 max-w-xl whitespace-pre-wrap text-left bg-red-50 rounded-xl p-4 overflow-auto",
        },
        String(this.state.error && this.state.error.message),
      ),
      React.createElement(
        "p",
        { className: "text-[11px] text-slate-500 max-w-md" },
        "Your work is still in this browser's saved state. Reloading usually recovers it.",
      ),
      React.createElement(
        "button",
        {
          onClick: () => window.location.reload(),
          className:
            "px-4 py-2 rounded-xl text-xs uppercase tracking-widest bg-slate-800 text-white hover:bg-slate-900",
        },
        "Reload",
      ),
    );
  }
}

const rootItem = document.getElementById("root");
if (rootItem) {
  const root = ReactDOM.createRoot(rootItem);
  root.render(
    React.createElement(RootErrorBoundary, null, React.createElement(App, null)),
  );
}
