import fs from 'fs';
let appjs = fs.readFileSync('public/app.js', 'utf8');

// 1. calculateDeltaEFromSpectral return
appjs = appjs.replace(
  /return cA\.deltaE\(cB, "2000"\);/g,
  'return cA.deltaE(cB, "2000") * 100;'
);

// 2. deltaE in omnibar match
// const d = c.deltaE(targetColor, "OK");
appjs = appjs.replace(
  /const d = c\.deltaE\(targetColor, "OK"\);/g,
  'const d = c.deltaE(targetColor, "OK") * 100;'
);

// 3. deltaEOK and deltaE2000
appjs = appjs.replace(
  /deltaEOK = cA\.deltaE\(cB, "OK"\)\.toFixed\(2\);/g,
  'deltaEOK = (cA.deltaE(cB, "OK") * 100).toFixed(2);'
);
appjs = appjs.replace(
  /deltaE2000 = cA\.deltaE\(cB, "2000"\)\.toFixed\(2\);/g,
  'deltaE2000 = (cA.deltaE(cB, "2000") * 100).toFixed(2);'
);

// 4. item._d
appjs = appjs.replace(
  /const d = center\.deltaE\(new Color\("oklch", \[item\.L, item\.C, item\.H]\), "OK"\);/g,
  'const d = center.deltaE(new Color("oklch", [item.L, item.C, item.H]), "OK") * 100;'
);

// 5. maxDeltaE references
// useState(0.05) -> useState(5)
appjs = appjs.replace(/useState\(0\.05\);/g, 'useState(5.0);');

// <input type="range" min="0.00" max="0.25" step="0.01" value={maxDeltaE}
appjs = appjs.replace(
  /<input type="range" min="0\.00" max="0\.25" step="0\.01" value=\{maxDeltaE\}/g,
  '<input type="range" min="0" max="25" step="0.1" value={maxDeltaE}'
);

appjs = appjs.replace(
  /<input type="range".*?min="0\.00".*?max="0\.25".*?step="0\.01".*?value=\{maxDeltaE\}.*?\/>/g,
  (m) => m.replace('min="0.00"', 'min="0"').replace('max="0.25"', 'max="25"').replace('step="0.01"', 'step="0.1"')
);

fs.writeFileSync('public/app.js', appjs);
console.log('Fixed scales!');
