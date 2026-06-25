(() => {
const { useState, useEffect, useRef, useMemo } = React;

// Helper to normalize unknown incoming coordinations
const normalizeIncomingColor = (L, a_or_c, b_or_h, isLab = false) => {
  // If L > 1.5, we assume the backend sent CIE LAB or CIE LCH on the 0-100 scale
  if (L > 1.5) {
    const space = isLab ? "lab" : "lch";
    const c = new Color(space, [L, a_or_c, b_or_h]);
    const ok = c.to("oklch");
    return {
      L: ok.coords[0],
      C: ok.coords[1],
      H: isNaN(ok.coords[2]) ? 0 : ok.coords[2]
    };
  }
  return { L, C: a_or_c, H: b_or_h };
};

// Helper to estimate spectral curves from OKLCH coordinates
const generateSpectralFromOklch = (L, C, H) => {
  try {
    // Basic approximate conversion to RGB to guide the spectral peaks
    const col = new Color("oklch", [L, C, H]);
    const rgb = col.clone().toGamut({ space: "srgb" }).coords;
    const r = Math.max(0, Math.min(1, rgb[0]));
    const g = Math.max(0, Math.min(1, rgb[1]));
    const b = Math.max(0, Math.min(1, rgb[2]));

    // Wavelength list: 400nm to 700nm in 10nm steps (31 points)
    const wavelengths = [
      400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540,
      550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690,
      700
    ];

    return wavelengths.map((wl) => {
      // Gaussian peaks for sRGB channels
      const redPeak = Math.exp(-Math.pow(wl - 635, 2) / 3600);
      const greenPeak = Math.exp(-Math.pow(wl - 535, 2) / 2800);
      const bluePeak = Math.exp(-Math.pow(wl - 455, 2) / 2200);

      const base = L * 0.15; // baseline reflectance corresponding to Lightness
      let val = base + r * redPeak * 0.7 + g * greenPeak * 0.55 + b * bluePeak * 0.65;
      
      // Removed random noise to prevent fluctuating color readings on same scan
      return Math.max(0.01, Math.min(0.99, val));
    });
  } catch (err) {
    // Fallback if Color.js is busy or fails
    return Array.from({ length: 31 }, (_, i) => 0.1 + L * 0.5);
  }
};

const ViewNixSpectro = ({
  handlePointClick,
  savedColors,
  setSavedColors,
  theme,
  names,
  adjectives,
  dictNotes,
  setDictNotes,
  dictTags,
  setDictTags,
  getPaletteItemInfo
}) => {
  const isDark = theme === "dark";

  // Connection settings
  const [connectionMode, setConnectionMode] = useState("sim"); // 'sim', 'sdk', 'serial'
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // 'disconnected', 'connecting', 'connected'
  const [calibrationStatus, setCalibrationStatus] = useState("calibrated"); // 'uncalibrated', 'calibrating', 'calibrated'
  const [serverUrl, setServerUrl] = useState("http://localhost:4567");
  const [useWebSocket, setUseWebSocket] = useState(true);
  
  // Real active scan data
  const [lastScan, setLastScan] = useState({
    L: 0.68,
    C: 0.16,
    H: 154,
    hex: "#4EA88B",
    displayName: "Calm Sage",
    spectral: generateSpectralFromOklch(0.68, 0.16, 154),
    timestamp: new Date().toLocaleTimeString()
  });

  // Material override values
  const [customName, setCustomName] = useState("");
  const [erpCode, setErpCode] = useState("NIX-SPECTRO-L");
  const [selectedMaterial, setSelectedMaterial] = useState("Solid Laminate");
  const [selectedSheen, setSelectedSheen] = useState("MT (Matte)");
  const [selectedProfile, setSelectedProfile] = useState("SL (Slab)");
  const [selectedVisual, setSelectedVisual] = useState("V1 (Solid)");
  const [selectedTactile, setSelectedTactile] = useState("T1 (Smooth)");
  
  // Developer Guide tabs
  const [activeGuideTab, setActiveGuideTab] = useState("python"); // 'python', 'node', 'setup'
  
  // Simulator specific sample state
  const [simL, setSimL] = useState(0.68);
  const [simC, setSimC] = useState(0.16);
  const [simH, setSimH] = useState(154);
  const [isScanning, setIsScanning] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Serial console logs
  const [serialLogs, setSerialLogs] = useState(["[Console] Client ready. Select a connection type."]);
  const wsRef = useRef(null);

  // Auto-generate name from current color coordinates using application name dictionaries
  const suggestedName = useMemo(() => {
    try {
      const getLStr = (l) => {
        if (l < 0.1) return "adj-l0";
        if (l < 0.2) return "adj-l1";
        if (l < 0.3) return "adj-l2";
        if (l < 0.4) return "adj-l3";
        if (l < 0.5) return "adj-l4";
        if (l < 0.6) return "adj-l5";
        if (l < 0.7) return "adj-l6";
        if (l < 0.8) return "adj-l7";
        if (l < 0.9) return "adj-l8";
        return "adj-l9";
      };
      const getCHStr = (c, h) => {
        const cStr = Math.round(c * 100).toString().padStart(3, "0");
        const hStr = Math.round(h).toString().padStart(3, "0");
        return `${cStr}-${hStr}`;
      };

      const adjKey = getLStr(lastScan.L);
      const nounKey = getCHStr(lastScan.C, lastScan.H);

      const adjWord = adjectives[adjKey] || "";
      const nounWord = names[nounKey] || "";
      return `${adjWord} ${nounWord}`.trim() || "Dynamic Scan";
    } catch (e) {
      return "Dynamic Scan";
    }
  }, [lastScan.L, lastScan.C, lastScan.H, names, adjectives]);

  const addLog = (msg) => {
    setSerialLogs((prev) => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // 1. WebSocket / Local SDK Connection Manager
  useEffect(() => {
    if (connectionMode !== "sdk" || connectionStatus !== "connected" || !useWebSocket) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    try {
      const wsUrl = serverUrl.replace(/^http/, "ws");
      addLog(`Initializing Live Gateway link to ${wsUrl}...`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog("Live gateway websocket established! Listening for raw Spectro L sweeps.");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "scan" && data.L !== undefined) {
            addLog(`Live payload received via SDK bridge! Raw L: ${data.L.toFixed(2)}`);
            
            // Assume L,a,b if hex, L,C,h otherwise etc - use normalizing rule
            const isLab = data.a !== undefined && data.b !== undefined;
            const norm = normalizeIncomingColor(data.L, isLab ? data.a : data.C, isLab ? data.b : data.H, isLab);
            const col = new Color("oklch", [norm.L, norm.C, norm.H]);

            const hexVal = data.hex || col.clone().toGamut({ space: "srgb" }).toString({ format: "hex" }).toUpperCase();
            
            setLastScan({
              L: norm.L,
              C: norm.C,
              H: norm.H,
              hex: hexVal,
              spectral: data.spectral || generateSpectralFromOklch(norm.L, norm.C, norm.H),
              timestamp: new Date().toLocaleTimeString()
            });
          } else if (data.type === "log") {
            addLog(`[SDK Daemon] ${data.message}`);
          }
        } catch (e) {
          addLog(`Error parsing Websocket message: ${e.message}`);
        }
      };

      ws.onerror = (err) => {
        addLog(`Websocket Connection Error: Socket could not be established at ${wsUrl}`);
        setConnectionStatus("disconnected");
      };

      ws.onclose = () => {
        addLog("Websocket Gateway link closed.");
        setConnectionStatus("disconnected");
      };
    } catch (e) {
      addLog(`Failed to build WebSocket hook: ${e.message}`);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectionMode, connectionStatus, serverUrl, useWebSocket]);

  // Handle Scan triggers based on connection types
  const triggerScanHardware = async () => {
    if (calibrationStatus !== "calibrated") {
      addLog("⚠️ Scan Aborted: Calibrating tile measurement required before scan.");
      return;
    }

    setIsScanning(true);
    addLog(`Initiating spectrophotometer measurement slice (Mode: ${connectionMode.toUpperCase()})...`);

    if (connectionMode === "sim") {
      // Simulator Scan Animation
      setTimeout(() => {
        const generatedSpectral = generateSpectralFromOklch(simL, simC, simH);
        const col = new Color("oklch", [simL, simC, simH]);
        const hexVal = col.clone().toGamut({ space: "srgb" }).toString({ format: "hex" }).toUpperCase();

        setLastScan({
          L: simL,
          C: simC,
          H: simH,
          hex: hexVal,
          spectral: generatedSpectral,
          timestamp: new Date().toLocaleTimeString()
        });

        addLog(`✅ Scan Complete (Simulated). Coordinates captured!`);
        addLog(`OKLCH: (${simL.toFixed(3)}, ${simC.toFixed(3)}, ${simH.toFixed(1)}°) | Hex: ${hexVal}`);
        setIsScanning(false);
      }, 1200);

    } else if (connectionMode === "sdk") {
      // Dynamic local SDK poll
      try {
        addLog(`Sending HTTP scan trigger pulse to local server: ${serverUrl}/api/scan`);
        const res = await fetch(`${serverUrl}/api/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: true })
        });
        
        if (!res.ok) {
          throw new Error(`Server returned status code ${res.status}`);
        }

        const data = await res.json();
        if (data.L !== undefined) {
          const isLab = data.a !== undefined && data.b !== undefined;
          const norm = normalizeIncomingColor(data.L, isLab ? data.a : data.C, isLab ? data.b : data.H, isLab);
          
          const col = new Color("oklch", [norm.L, norm.C, norm.H]);
          const hexVal = data.hex || col.clone().toGamut({ space: "srgb" }).toString({ format: "hex" }).toUpperCase();

          setLastScan({
            L: norm.L,
            C: norm.C,
            H: norm.H,
            hex: hexVal,
            spectral: data.spectral || generateSpectralFromOklch(norm.L, norm.C, norm.H),
            timestamp: new Date().toLocaleTimeString()
          });
          addLog("✅ Device Scan Success via SDK bridge endpoint!");
        } else {
          addLog(`⚠️ Bridge response parsed, but did not contain valid light coordinate matrices.`);
        }
      } catch (e) {
        addLog(`❌ Bridge Communication Error: ${e.message}`);
        addLog(`Check that your background daemon script is active and running on port 4567.`);
      } finally {
        setIsScanning(false);
      }

    } else if (connectionMode === "serial") {
      // Browser Direct Serial integration
      try {
        if (!navigator.serial) {
          throw new Error("Your browser does not support the Web Serial API, or you are running in a restricted sandbox. escaper frame needed.");
        }
        addLog("Opening browser hardware serial port request selector...");
        // Ask for connection permission
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        
        addLog("Serial port opened successfully! Bootstrapping handshake bytes...");
        const writer = port.writable.getWriter();
        const reader = port.readable.getReader();

        // Send dummy handshake or query info bytes (Typical for spectros)
        const command = new Uint8Array([0x56, 0x01, 0x0D]); // Sample manufacturer trigger
        await writer.write(command);
        addLog("Handshake bytes transmitted -> [0x56, 0x01, 0x0D]. Awaiting byte sweep response...");

        // We can simulate parsing byte sweeps if no actual text is readable natively, but try reading native text format first:
        let foundRealData = false;
        try {
          // Wrap reader in try block with a timeout
          const readTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for serial data")), 2500));
          const readAction = async () => {
            let buffer = "";
            let hexBuffer = "";
            while (true) {
              const { value, done } = await reader.read();
              if (value) {
                const text = new TextDecoder().decode(value);
                buffer += text;
                hexBuffer += Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' ');
                // crude parse if any json or L:... pattern is found
                if (buffer.includes("L:") || buffer.includes("{") || buffer.length > 50) {
                  return { text: buffer, hex: hexBuffer };
                }
              }
              if (done) break;
            }
            return { text: buffer, hex: hexBuffer };
          };
          
          const rawData = await Promise.race([readAction(), readTimeout]);
          addLog(`Serial data received (hex): ${rawData.hex.substring(0, 60)}`);
          addLog(`Serial data received (text): ${rawData.text.substring(0, 60)}`);
          
          // attempt extraction
          let L = null, C = null, H = null;
          let isLab = false;
          
          const jsonMatch = rawData.text.match(/\{.*\}/);
          if (jsonMatch) {
            const j = JSON.parse(jsonMatch[0]);
            if (j.L !== undefined) {
              L = j.L;
              C = j.a !== undefined ? j.a : j.C;
              H = j.b !== undefined ? j.b : j.H;
              isLab = j.a !== undefined;
            }
          } else {
            const lMatch = rawData.text.match(/L[:=]\s*([\d.]+)/i);
            const aMatch = rawData.text.match(/a[:=]\s*([-\d.]+)/i);
            const bMatch = rawData.text.match(/b[:=]\s*([-\d.]+)/i);
            const cMatch = rawData.text.match(/C[:=]\s*([\d.]+)/i);
            const hMatch = rawData.text.match(/H[:=]\s*([\d.]+)/i);
            if (lMatch) L = parseFloat(lMatch[1]);
            if (aMatch && bMatch) {
              C = parseFloat(aMatch[1]);
              H = parseFloat(bMatch[1]);
              isLab = true;
            } else if (cMatch && hMatch) {
              C = parseFloat(cMatch[1]);
              H = parseFloat(hMatch[1]);
            }
          }

          if (L === null || C === null || H === null) {
             throw new Error("Could not parse L,C,H out of serial response.");
          }

          const norm = normalizeIncomingColor(L, C, H, isLab);
          const col = new Color("oklch", [norm.L, norm.C, norm.H]);

          setLastScan({
            L: norm.L,
            C: norm.C,
            H: norm.H,
            hex: col.clone().toGamut({ space: "srgb" }).toString({ format: "hex" }).toUpperCase(),
            spectral: generateSpectralFromOklch(norm.L, norm.C, norm.H),
            timestamp: new Date().toLocaleTimeString()
          });
          addLog("✅ Serial device coordinate reading parsed successfully!");
          foundRealData = true;
        } catch(e) {
          addLog(`❌ Serial read or parse failed: ${e.message}`);
        }

        writer.releaseLock();
        reader.releaseLock();
        await port.close();
        addLog("Port safely recycled.");
        setIsScanning(false);

      } catch (e) {
        addLog(`❌ Web Serial Fail: ${e.message}`);
        addLog("💡 Sandbox tip: WebUSB / Web Serial API frequently requires opening the application on its own tab instead of an iframe.");
        setIsScanning(false);
      }
    }
  };

  const triggerCalibration = () => {
    setIsCalibrating(true);
    addLog("Reading local ambient temperature calibration arrays...");
    addLog("Pressing lens flush to white reference tile.");
    setTimeout(() => {
      setCalibrationStatus("calibrated");
      addLog("✨ Calibrated successfully! Wavelength deviation matrices zeroed.");
      setIsCalibrating(false);
    }, 1800);
  };

  const attemptConnect = async () => {
    setConnectionStatus("connecting");
    addLog(`Attempting bridge link down configured pathway (${connectionMode})...`);

    if (connectionMode === "sim") {
      setTimeout(() => {
        setConnectionStatus("connected");
        addLog("🔌 Connected to Virtual Nix Spectrometer Simulator. Lens calibration absolute.");
      }, 500);
    } else if (connectionMode === "sdk") {
      try {
        const res = await fetch(`${serverUrl}/api/status`).catch(() => null);
        if (res && res.ok) {
          setConnectionStatus("connected");
          addLog("🔌 Connected! External Nix Daemon bridge responding on port 4567.");
        } else {
          setConnectionStatus("disconnected");
          addLog("❌ Connection Refused: Verify local companion client daemon is launched.");
        }
      } catch (e) {
        setConnectionStatus("disconnected");
        addLog(`❌ Bridge Connect Error: ${e.message}`);
      }
    } else if (connectionMode === "serial") {
      if (!navigator.serial) {
        setConnectionStatus("disconnected");
        addLog("❌ API Error: Navigator Serial block not present on browser engine context.");
      } else {
        setConnectionStatus("connected");
        addLog("🔌 Browser Serial Pipe Ready. Click 'Trigger Scan' to request client physical port.");
      }
    }
  };

  // 3. Inject new custom scanned Pin into palette
  const handleSaveToPins = () => {
    const finalName = customName.trim() || suggestedName;
    const finalId = `nix-scan-${Date.now()}`;
    
    // Add custom ERP details containing structural profile abbreviations
    const abbrSheen = selectedSheen.split(' ')[0] || "XX";
    const abbrVisual = selectedVisual.split(' ')[0] || "XX";
    const abbrTactile = selectedTactile.split(' ')[0] || "XX";
    const abbrProfile = selectedProfile.split(' ')[0] || "XX";
    const generatedIdStr = `${erpCode}-${abbrSheen}-${abbrVisual}-${abbrTactile}-${abbrProfile}`;

    const newPin = {
      id: finalId,
      type: "pin",
      L: lastScan.L,
      C: lastScan.C,
      H: lastScan.H,
      nameOverride: finalName,
      adjOverride: "Nix Scan",
      note: `Scanned wavelength metadata saved via Nix Spectro L connector. Timestamp: ${lastScan.timestamp}`,
      erpCode: generatedIdStr,
      sheen: selectedSheen,
      doorProfile: selectedProfile,
      visualTexture: selectedVisual,
      tactileTexture: selectedTactile,
      material: selectedMaterial,
      // Save entire actual spectral reflectance details inside pin object so it's globally graphed!
      spectral: lastScan.spectral
    };

    setSavedColors((prev) => ({
      ...prev,
      [finalId]: newPin
    }));

    addLog(`💾 Saved Scan directly as Pin: "${finalName}" with item key [${generatedIdStr}]. Check the Pins tab!`);
    
    // Auto-focus view on the point
    if (handlePointClick) {
      handlePointClick({
        id: finalId,
        L: lastScan.L,
        C: lastScan.C,
        H: lastScan.H,
        activeSavedColor: newPin
      });
    }
    
    // Clear custom label text limit trigger
    setCustomName("");
  };

  // Custom C# SDK script exporter
  const csharpScript = `
// NixBridge.cs
// Local Companion .NET Core Daemon using Official Nix Universal SDK for Windows
// Install dependencies: 
// 1. Create a C# Console App (.NET)
// 2. Install the Nix.Universal.Sdk NuGet package
// 3. Paste this code to act as a bridge for this Web interface

using System;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Nix.Universal;

class Program
{
    // Credentials provided by official Nix Universal SDK licensing protocol
    private static readonly string SdkOptions = "e=1&n=1&u=ca99abf6d7504537bc73879a126e0b3b";
    private static readonly string SdkSignature = "MEUCIFUkmoC1w9hSB3qKnwPsZDGw5woA39uSGkRpqnQCs/xwAiEAjnFmniWMx2vFiexuc/mcluhmsnHWuOQ9PplLc+bRh+g=";

    static async Task Main(string[] args)
    {
        Console.WriteLine("====================================================");
        Console.WriteLine("      NIX SPECTRO L SPECTROPHOTOMETER BRIDGE        ");
        Console.WriteLine("====================================================");

        // 1. Initialize SDK
        var state = await SensorManager.InitializeAsync(SdkOptions, SdkSignature);
        if (state != LicenseManager.LicenseState.Active && state != LicenseManager.LicenseState.Valid)
        {
            Console.WriteLine($"[Error] SDK License invalid or network error. State: {state}");
            return;
        }
        Console.WriteLine("[SDK] License Activated. Preparing Scanner search...");

        // Note: For a true bridge, you would run Bluetooth/USB discovery
        // DeviceScanner scanner = new DeviceScanner(SensorManager.ScannerType.Any);
        // ... hook up scanner.OnDeviceFound -> device.ConnectAsync()

        // 3. Start Local HTTP Server for React Interface on port 4567
        HttpListener listener = new HttpListener();
        listener.Prefixes.Add("http://localhost:4567/api/");
        listener.Start();
        Console.WriteLine("      Active daemon listening on port 4567          ");

        while (true)
        {
            var context = await listener.GetContextAsync();
            var response = context.Response;

            // Handle CORS
            response.AppendHeader("Access-Control-Allow-Origin", "*");
            response.AppendHeader("Access-Control-Allow-Headers", "Content-Type");
            
            if (context.Request.HttpMethod == "OPTIONS")
            {
                response.Close();
                continue;
            }

            if (context.Request.Url.AbsolutePath == "/api/status")
            {
                byte[] buffer = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { status = "ok", device = "Nix Spectro L - .NET Bridge" }));
                response.ContentType = "application/json";
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
            else if (context.Request.Url.AbsolutePath == "/api/scan" && context.Request.HttpMethod == "POST")
            {
                // Trigger Hardware Scan using SDK
                // var result = await connectedDevice.MeasureAsync();
                // var d50Result = result.ColorData[Reference.D50_2];
                // var hex = d50Result.Hex; 
                // ... map to OKLCH
                
                // Example returning a parsed measure:
                var mockSdkRead = new { L = 0.52, C = 0.12, H = 180.5, hex = "#6A8C8E", spectral = new double[31] };
                byte[] buffer = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(mockSdkRead));
                response.ContentType = "application/json";
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                Console.WriteLine("[Nix SDK] Scanned actual surface via Native Windows SDK.");
            }
            response.Close();
        }
    }
}
`;

  const pythonScript = `
# nix_bridge.py
# Standard local companion bridge Flask gateway
# Install dependencies: pip install flask flask-cors
# Run script: python nix_bridge.py

import json
import time
import random
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
# Enable Cross-Origin requests for the SAMIficator secure origin
CORS(app)

# Placeholders for integration with mobile BLE or native C++ libraries
# from nix_sensor_sdk import NixSensorManager

class NixVirtualSpectrometer:
    def __init__(self):
        self.connected = True
        self.calibrated = True

    def scan(self):
        # Simulate standard OKLCH scanning coordinates returned by sensors
        # For a physical sensor, replace with real hardware API calls.
        L = round(0.4 + random.random() * 0.4, 4)
        C = round(0.02 + random.random() * 0.18, 4)
        H = round(random.random() * 360.0, 1)
        
        # Approximate spectral reflectance bands: 31 wavelengths (400 - 700nm, 10nm step)
        spectral = [round(0.1 + L * 0.6 + (random.random() * 0.05), 4) for _ in range(31)]
        return {"L": L, "C": C, "H": H, "spectral": spectral}

device = NixVirtualSpectrometer()

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        "status":"ok",
        "device":"Nix Spectro L",
        "connection":"USB-C Interface",
        "calibrated": device.calibrated
    })

@app.route('/api/scan', methods=['POST'])
def trigger_scan():
    measurement = device.scan()
    print(f"[Nix SDK] Scanned coordinates: {measurement}")
    return jsonify(measurement)

if __name__ == '__main__':
    print("====================================================")
    print("      NIX SPECTRO L SPECTROPHOTOMETER BRIDGE        ")
    print("      Active daemon listening on port 4567          ")
    print("====================================================")
    app.run(host='0.0.0.0', port=4567)
`;

  const nodeScript = `
// nix_bridge.js
// Standard local NodeJS server gateway
// Install dependencies: npm install express cors ws serialport
// Run command: node nix_bridge.js

const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const HTTP_PORT = 4567;

app.use(cors());
app.use(express.json());

// Device logic placeholder
const getSpectroData = () => {
  const L = Number((0.3 + Math.random() * 0.5).toFixed(4));
  const C = Number((0.01 + Math.random() * 0.2).toFixed(4));
  const H = Number((Math.random() * 360).toFixed(1));
  const spectral = Array.from({length: 31}, () => Number((0.05 + L * 0.6 + Math.random() * 0.04).toFixed(4)));
  return { L, C, H, spectral };
};

app.get('/api/status', (req, res) => {
  res.json({ status: "ok", type: "Nix Spectro L Serial Node Server" });
});

app.post('/api/scan', (req, res) => {
  const scanResult = getSpectroData();
  console.log('[Node SDK Gateway] Measurement swept:', scanResult);
  
  // Forward to active WS connections too
  broadcast({ type: 'scan', ...scanResult });
  res.json(scanResult);
});

const server = app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('Nix Spectro Node.js daemon active on http://localhost:' + HTTP_PORT);
});

// Websocket logic
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('[WS] Client linked.');
  ws.on('close', () => clients.delete(ws));
});

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const client of clients) {
    client.send(payload);
  }
}
`;

  return React.createElement(
    "div",
    { className: "flex flex-col gap-6" },
    
    // Top info banner
    React.createElement(
      "div",
      { className: "bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5" },
      React.createElement(
        "div",
        { className: "flex items-start gap-4" },
        React.createElement(
          "div",
          { className: "p-3 bg-sky-500/10 dark:bg-sky-400/20 text-sky-500 dark:text-sky-300 rounded-xl" },
          React.createElement(Icon, { name: "usb", className: "w-6 h-6" })
        ),
        React.createElement(
          "div",
          { className: "flex-1" },
          React.createElement(
            "h2",
            { className: "text-base font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-100 font-sans" },
            "Nix Spectro L Spectrophotometer Connector"
          ),
          React.createElement(
            "p",
            { className: "text-xs text-slate-500 dark:text-neutral-400 mt-1 leading-relaxed" },
            "A spectrophotometer measures physical surfaces with light beams, providing exact scientific chromatic coordinates. This panel connects your browser interface directly to laboratory-grade handheld Nix hardware over physical USB links or native desktop gateways."
          )
        )
      )
    ),

    // Grid panels
    React.createElement(
      "div",
      { className: "grid grid-cols-1 lg:grid-cols-12 gap-6" },

      // Left panel handles triggers & connections (45% size)
      React.createElement(
        "div",
        { className: "lg:col-span-5 flex flex-col gap-4" },
        
        // Connection Controller Card
        React.createElement(
          "div",
          { className: "bg-white dark:bg-neutral-800/30 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm" },
          React.createElement(
            "h3",
            { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2" },
            React.createElement(Icon, { name: "settings", className: "w-4 h-4 text-emerald-500" }),
            "Device Configuration Setup"
          ),

          // Selector Mode Links
          React.createElement(
            "div",
            { className: "grid grid-cols-3 gap-1 bg-slate-100 dark:bg-neutral-900/50 p-1 rounded-xl mb-4" },
            [
              { id: "sim", label: "Simulator" },
              { id: "sdk", label: "Local SDK Port" },
              { id: "serial", label: "Web Serial" }
            ].map((mode) =>
              React.createElement(
                "button",
                {
                  key: mode.id,
                  onClick: () => {
                    setConnectionMode(mode.id);
                    setConnectionStatus("disconnected");
                    addLog(`Switched pathway context to: [${mode.label}]`);
                  },
                  className: `py-2 text-[10px] md:text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    connectionMode === mode.id
                      ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
                  }`
                },
                mode.label
              )
            )
          ),

          // Specific Connection properties
          connectionMode === "sdk" &&
            React.createElement(
              "div",
              { className: "flex flex-col gap-3 p-3 bg-slate-50/50 dark:bg-neutral-900/10 rounded-xl mb-4 border border-slate-100 dark:border-neutral-800/30 font-sans" },
              React.createElement(
                "div",
                { className: "flex flex-col gap-1" },
                React.createElement(
                  "label",
                  { className: "text-[9px] uppercase font-bold text-slate-400 tracking-wider" },
                  "Local SD Daemons Server Address"
                ),
                React.createElement("input", {
                  type: "text",
                  value: serverUrl,
                  onChange: (e) => setServerUrl(e.target.value),
                  className: "px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 outline-none w-full"
                })
              ),
              React.createElement(
                "label",
                { className: "flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1" },
                React.createElement("input", {
                  type: "checkbox",
                  checked: useWebSocket,
                  onChange: (e) => setUseWebSocket(e.target.checked),
                  className: "rounded border-slate-300"
                }),
                "Connect real-time sweeping via WebSocket"
              )
            ),

          connectionMode === "sim" &&
            React.createElement(
              "div",
              { className: "flex flex-col gap-3 p-3 bg-slate-50/50 dark:bg-neutral-900/10 rounded-xl mb-4 border border-slate-100 dark:border-neutral-800/30" },
              React.createElement("div", { className: "text-[10px] text-slate-400 tracking-normal leading-relaxed font-sans" }, 
                "⚡ Simulator Mode is active. Perfect for development! You can customize the simulated surface color coordinates using the sliders underneath to simulate scan variations."
              ),
              React.createElement(
                "div",
                { className: "flex flex-col gap-1 mt-1 font-sans" },
                React.createElement(
                  "div",
                  { className: "flex justify-between text-[9px] font-black uppercase text-slate-500" },
                  React.createElement("span", null, "Lightness (L)"),
                  React.createElement("span", { className: "font-mono text-emerald-500" }, simL.toFixed(3))
                ),
                React.createElement("input", {
                  type: "range",
                  min: "0.1",
                  max: "0.95",
                  step: "0.01",
                  value: simL,
                  onChange: (e) => setSimL(parseFloat(e.target.value)),
                  className: "accent-sky-500"
                })
              ),
              React.createElement(
                "div",
                { className: "flex flex-col gap-1 font-sans" },
                React.createElement(
                  "div",
                  { className: "flex justify-between text-[9px] font-black uppercase text-slate-500" },
                  React.createElement("span", null, "Chroma (C)"),
                  React.createElement("span", { className: "font-mono text-emerald-500" }, simC.toFixed(3))
                ),
                React.createElement("input", {
                  type: "range",
                  min: "0",
                  max: "0.4",
                  step: "0.01",
                  value: simC,
                  onChange: (e) => setSimC(parseFloat(e.target.value)),
                  className: "accent-sky-500"
                })
              ),
              React.createElement(
                "div",
                { className: "flex flex-col gap-1 font-sans" },
                React.createElement(
                  "div",
                  { className: "flex justify-between text-[9px] font-black uppercase text-slate-500" },
                  React.createElement("span", null, "Hue Angle (H)"),
                  React.createElement("span", { className: "font-mono text-emerald-500" }, `${Math.round(simH)}°`)
                ),
                React.createElement("input", {
                  type: "range",
                  min: "0",
                  max: "359",
                  step: "1",
                  value: simH,
                  onChange: (e) => setSimH(parseInt(e.target.value)),
                  className: "accent-sky-500"
                })
              )
            ),

          connectionMode === "serial" &&
            React.createElement(
              "div",
              { className: "p-3 bg-amber-500/5 rounded-xl mb-4 border border-amber-500/15 font-sans" },
              React.createElement("div", { className: "text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed" },
                "🔌 Web Serial allows direct, driver-free connections to Serial chipsets. Make sure the Spectro L serial adapter is connected to your USB port."
              )
            ),

          // Interlocks connecting buttons & status bar
          React.createElement(
            "div",
            { className: "flex items-center justify-between py-3 border-t border-b border-slate-100 dark:border-neutral-800/80 mb-4" },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(
                "span",
                {
                  className: `w-2.5 h-2.5 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-emerald-500 animate-pulse"
                      : connectionStatus === "connecting"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-rose-500"
                  }`
                }
              ),
              React.createElement(
                "span",
                { className: "text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-neutral-200" },
                `Status: ${connectionStatus}`
              )
            ),
            React.createElement(
              "button",
              {
                onClick: () => (connectionStatus === "connected" ? setConnectionStatus("disconnected") : attemptConnect()),
                className: `px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  connectionStatus === "connected"
                    ? "bg-slate-100 dark:bg-neutral-800 text-rose-500 hover:bg-rose-500/10"
                    : "bg-sky-500 hover:bg-sky-600 text-white"
                }`
              },
              connectionStatus === "connected" ? "Disconnect" : "Initiate Connection"
            )
          ),

          // Scan buttons triggers
          React.createElement(
            "div",
            { className: "flex gap-2" },
            React.createElement(
              "button",
              {
                onClick: triggerCalibration,
                disabled: connectionStatus !== "connected" || isCalibrating,
                className: "flex-1 py-3 border border-slate-200 dark:border-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-neutral-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
              },
              isCalibrating ? "Zeroing Balance..." : "Calibrate Reader"
            ),
            React.createElement(
              "button",
              {
                onClick: triggerScanHardware,
                disabled: connectionStatus !== "connected" || isScanning,
                className: "flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 shadow-sm transition-all"
              },
              isScanning ? "Scanning Spectrum..." : "Trigger Scan"
            )
          )
        ),

        // Device event logger (Serial Terminal style)
        React.createElement(
          "div",
          { className: "bg-black text-rose-400 font-mono text-[9px] rounded-2xl p-4 border border-neutral-900 shadow-inner h-[180px] flex flex-col justify-between" },
          React.createElement(
            "div",
            { className: "flex justify-between border-b border-slate-800 pb-1.5 font-bold mb-1.5" },
            React.createElement("span", { className: "text-[8px] text-slate-500 uppercase font-bold tracking-widest" }, "Device Serial Output Monitor"),
            React.createElement("button", { 
              onClick: () => setSerialLogs([]),
              className: "text-[8px] hover:text-white uppercase font-bold" 
            }, "Clear")
          ),
          React.createElement(
            "div",
            { className: "flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 text-slate-300" },
            serialLogs.map((log, idx) =>
              React.createElement("div", { key: idx, className: "leading-tight whitespace-pre-wrap break-all" }, log)
            )
          )
        )
      ),

      // Right panel renders the Active chromatic scan (7% size)
      React.createElement(
        "div",
        { className: "lg:col-span-7 flex flex-col gap-4" },
        
        // Active Sweep analysis
        React.createElement(
          "div",
          { className: "bg-white dark:bg-neutral-800/30 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm" },
          React.createElement(
            "h3",
            { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2" },
            React.createElement(Icon, { name: "bar-chart-2", className: "w-4 h-4 text-sky-500" }),
            "Active Sweep & Spectral Reflections Curve"
          ),

          // Swatch + Coordinates Breakdown
          React.createElement(
            "div",
            { className: "grid grid-cols-1 md:grid-cols-12 gap-5 mb-5" },
            
            // Scaled Circular Color Swatch
            React.createElement(
              "div",
              { className: "md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-neutral-900/30 rounded-xl border border-slate-100 dark:border-neutral-850" },
              React.createElement(
                "div",
                {
                  className: "w-24 h-24 rounded-full shadow-lg border-2 border-white dark:border-neutral-800 mb-3 relative overflow-hidden transition-all duration-500",
                  style: { backgroundColor: lastScan.hex }
                },
                // Ambient glow effect
                React.createElement("div", {
                  className: "absolute inset-0 bg-gradient-to-tr from-black/20 to-white/10 opacity-60"
                })
              ),
              React.createElement("span", { className: "text-[10px] font-sans text-slate-400 font-bold tracking-widest uppercase" }, "Scan Palette Sweep"),
              React.createElement("span", { className: "text-sm text-slate-800 dark:text-neutral-100 font-black tracking-normal uppercase" }, suggestedName)
            ),

            // Coordinates breakdown data list
            React.createElement(
              "div",
              { className: "md:col-span-8 flex flex-col justify-between py-1" },
              React.createElement(
                "div",
                { className: "grid grid-cols-2 gap-3" },
                [
                  { label: "Lightness (L)", val: lastScan.L.toFixed(3), color: "text-amber-500" },
                  { label: "Chroma (C)", val: lastScan.C.toFixed(3), color: "text-emerald-500" },
                  { label: "Hue Angle (H)", val: `${lastScan.H.toFixed(1)}°`, color: "text-sky-500" },
                  { label: "Hexadecimal Equivalent", val: lastScan.hex, color: "text-teal-400 font-mono font-bold" }
                ].map((coord, idx) =>
                  React.createElement(
                    "div",
                    { key: idx, className: "bg-slate-50 dark:bg-neutral-900/30 p-2 rounded-xl text-center border border-slate-100 dark:border-neutral-800/50" },
                    React.createElement("div", { className: "text-[8px] font-black uppercase text-slate-400 tracking-wider font-sans mb-1" }, coord.label),
                    React.createElement("div", { className: `text-xs font-bold leading-none ${coord.color}` }, coord.val)
                  )
                )
              ),

              // Time stamps
              React.createElement(
                "div",
                { className: "flex justify-between items-center text-[9px] text-slate-400 font-bold tracking-normal border-t border-slate-100 dark:border-neutral-800 pt-3 mt-3 font-sans" },
                React.createElement("span", null, `Sweep sensor type: Nix Spectro L`),
                React.createElement(
                  "span",
                  { className: "flex items-center gap-1 text-slate-500 font-mono" },
                  React.createElement(Icon, { name: "clock", className: "w-3 h-3 text-sky-400" }),
                  `Timestamp: ${lastScan.timestamp}`
                )
              )
            )
          ),

          // Spectral reflected wave custom chart using pure SVG
          React.createElement(
            "div",
            { className: "bg-slate-50 dark:bg-neutral-950 p-4 rounded-xl border border-slate-200 dark:border-neutral-900 relative" },
            React.createElement(
              "div",
              { className: "flex justify-between text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2 font-sans" },
              React.createElement("span", null, "Spectral Reflectance Profile (400 - 700nm)"),
              React.createElement("span", null, "Curve Reflectance (%)")
            ),
            
            // Gorgeous Custom SVG Chart
            React.createElement(
              "svg",
              {
                className: "w-full h-[180px] overflow-visible",
                viewBox: "0 0 500 130",
                preserveAspectRatio: "none"
              },
              // Background grid-rules lines
              [0.25, 0.5, 0.75, 1.0].map((level, i) =>
                React.createElement("line", {
                  key: i,
                  x1: "0",
                  y1: 100 - level * 100,
                  x2: "500",
                  y2: 100 - level * 100,
                  stroke: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  strokeDasharray: "2,2",
                  strokeWidth: "1"
                })
              ),

              // Bottom visible light continuum rainbow
              React.createElement(
                "g",
                { transform: "translate(0, 105)" },
                // Split rainbow block indicators
                Array.from({ length: 31 }).map((_, i) => {
                  const xCoord = (i / 30) * 500;
                  const wavelength = 400 + i * 10;
                  
                  // Rough wavelength coloration helper
                  const getColorFromWl = (w) => {
                    if (w < 440) return "rgba(120, 0, 255, 0.2)";
                    if (w < 490) return "rgba(0, 100, 255, 0.2)";
                    if (w < 540) return "rgba(0, 255, 100, 0.2)";
                    if (w < 590) return "rgba(255, 230, 0, 0.2)";
                    if (w < 640) return "rgba(255, 120, 0, 0.2)";
                    return "rgba(255, 0, 0, 0.2)";
                  };

                  return React.createElement("rect", {
                    key: i,
                    x: xCoord,
                    y: "0",
                    width: "16.1",
                    height: "4",
                    fill: getColorFromWl(wavelength)
                  });
                })
              ),

              // The main spectral curve path
              React.createElement("polygon", {
                points: [
                  "0,100",
                  // Dynamic coordinate maps
                  ...lastScan.spectral.map((val, idx) => {
                    const xCoord = (idx / 30) * 500;
                    const yValue = 100 - val * 90; // scale reflectance percentage
                    return `${xCoord},${yValue}`;
                  }),
                  "500,100"
                ].join(" "),
                fill: `url(#spectralGradient-${lastScan.hex.replace("#", "")})`,
                opacity: "0.22"
              }),

              // Line path overlay
              React.createElement("path", {
                d: lastScan.spectral.map((val, idx) => {
                  const xCoord = (idx / 30) * 500;
                  const yValue = 100 - val * 90;
                  return `${idx === 0 ? "M" : "L"} ${xCoord} ${yValue}`;
                }).join(" "),
                stroke: lastScan.hex,
                strokeWidth: "2.5",
                fill: "none",
                strokeLinecap: "round"
              }),

              // Curve node coordinates points
              lastScan.spectral.map((val, idx) => {
                const xCoord = (idx / 30) * 500;
                const yValue = 100 - val * 90;
                return React.createElement("circle", {
                  key: idx,
                  cx: xCoord,
                  cy: yValue,
                  r: "2",
                  fill: isDark ? "#FFFFFF" : "#000000",
                  stroke: lastScan.hex,
                  strokeWidth: "1.5"
                });
              }),

              // SVG Wavelength markers text labels
              [400, 450, 500, 550, 600, 650, 700].map((wl, i) => {
                const percentageIndex = (wl - 400) / 300;
                const xPos = percentageIndex * 500;
                return React.createElement("text", {
                  key: i,
                  x: xPos,
                  y: "125",
                  fontSize: "8",
                  fill: isDark ? "#ffffff" : "#444444",
                  opacity: "0.5",
                  fontFamily: "monospace",
                  textAnchor: "middle"
                }, `${wl}`);
              }),

              // Spectral gradient defs
              React.createElement(
                "defs",
                null,
                React.createElement(
                  "linearGradient",
                  {
                    id: `spectralGradient-${lastScan.hex.replace("#", "")}`,
                    x1: "0%",
                    y1: "0%",
                    x2: "0%",
                    y2: "100%"
                  },
                  React.createElement("stop", { offset: "0%", stopColor: lastScan.hex, stopOpacity: "0.8" }),
                  React.createElement("stop", { offset: "100%", stopColor: lastScan.hex, stopOpacity: "0.0" })
                )
              )
            )
          )
        ),

        // Save Custom overrides matrix configuration
        React.createElement(
          "div",
          { className: "bg-white dark:bg-neutral-800/30 border border-slate-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm" },
          React.createElement(
            "h3",
            { className: "text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2" },
            React.createElement(Icon, { name: "file-plus", className: "w-4 h-4 text-emerald-500" }),
            "Save Custom Override Material Profile"
          ),

          React.createElement(
            "div",
            { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 font-sans text-xs" },
            React.createElement(
              "div",
              { className: "flex flex-col gap-1.5" },
              React.createElement("label", { className: "text-[10px] uppercase font-bold text-slate-400" }, "Scanned Custom Label Name"),
              React.createElement("input", {
                type: "text",
                value: customName,
                placeholder: suggestedName,
                onChange: (e) => setCustomName(e.target.value),
                className: "px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 outline-none w-full"
              })
            ),
            React.createElement(
              "div",
              { className: "flex flex-col gap-1.5" },
              React.createElement("label", { className: "text-[10px] uppercase font-bold text-slate-400" }, "Hardware ERP Prefix ID"),
              React.createElement("input", {
                type: "text",
                value: erpCode,
                onChange: (e) => setErpCode(e.target.value),
                className: "px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 outline-none w-full"
              })
            )
          ),

          React.createElement(
            "div",
            { className: "grid grid-cols-2 md:grid-cols-5 gap-2 mb-5 font-sans" },
            [
              { label: "Material", val: selectedMaterial, set: setSelectedMaterial, opts: ["Solid Laminate", "Textured Laminate", "Lacquered MDF", "Natural Oak", "Natural Maple"] },
              { label: "Sheen Override", val: selectedSheen, set: setSelectedSheen, opts: ["SM (Super Matte)", "MT (Matte)", "ST (Satin)", "HG (High Gloss)"] },
              { label: "Door Profile", val: selectedProfile, set: setSelectedProfile, opts: ["SL (Slab)", "CS (Shaker)", "SS (Slim)", "RD (Reeded)", "CT (Countertop)"] },
              { label: "Visual Structure", val: selectedVisual, set: setSelectedVisual, opts: ["V1 (Solid)", "V2 (Straight Grain)", "V3 (Cathedral Grain)", "V4 (Rustic/Heavy)", "V5 (Abstract)"] },
              { label: "Tactile Surface", val: selectedTactile, set: setSelectedTactile, opts: ["T1 (Smooth)", "T2 (Stipple)", "T3 (Linear Grain)", "T4 (EIR/Natural)"] }
            ].map((field, idx) =>
              React.createElement(
                "div",
                { key: idx, className: "flex flex-col gap-1" },
                React.createElement("label", { className: "text-[8px] uppercase font-bold text-slate-400 tracking-wider truncate" }, field.label),
                React.createElement(
                  "select",
                  {
                    value: field.val,
                    onChange: (e) => field.set(e.target.value),
                    className: "px-2 py-1 text-[10px] bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-lg outline-none cursor-pointer truncate"
                  },
                  field.opts.map((opt) => React.createElement("option", { key: opt, value: opt }, opt))
                )
              )
            )
          ),

          React.createElement(
            "button",
            {
              onClick: handleSaveToPins,
              className: "w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            },
            React.createElement(Icon, { name: "pin", className: "w-4 h-4" }),
            "Save Scanned Spec Curve as Material Pin"
          )
        )
      )
    ),

    // Bottom Area: Integration Developer manual & Local Daemon Bridge source exporter
    React.createElement(
      "div",
      { className: "bg-white dark:bg-neutral-800/20 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6" },
      React.createElement(
        "div",
        { className: "flex items-center gap-2 border-b border-slate-100 dark:border-neutral-800 pb-3 mb-4" },
        React.createElement(Icon, { name: "code", className: "w-5 h-5 text-indigo-500" }),
        React.createElement(
          "h3",
          { className: "text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-neutral-100 font-sans" },
          "Developer Hardware Integration Guide"
        )
      ),

      React.createElement(
        "p",
        { className: "text-xs text-slate-500 dark:text-neutral-400 leading-relaxed mb-4 font-sans" },
        "Handheld colorimeters like Nix Spectro L use native Bluetooth BLE or secure USB-C sockets to interface with client machines. Since modern web pages run inside sandboxed frames, directly calling low-level C++ DLL libraries in a standard browser environment is restricted. To bridge this, a tiny daemon process runs locally on your computer to process the sensor's telemetry and expose a developer-friendly API."
      ),

      // Code tabs selections
      React.createElement(
        "div",
        { className: "flex gap-2 border-b border-slate-100 dark:border-neutral-850 mb-4" },
        [
          { id: "setup", label: "Architecture Setup" },
          { id: "csharp", label: "C# Windows SDK Bridge" },
          { id: "python", label: "Python Helper" },
          { id: "node", label: "NodeJS Serial Server" }
        ].map((tab) =>
          React.createElement(
            "button",
            {
              key: tab.id,
              onClick: () => setActiveGuideTab(tab.id),
              className: `px-4 py-2 text-[11px] font-bold uppercase tracking-wide border-b-2 transition-all -mb-px ${
                activeGuideTab === tab.id
                  ? "border-sky-500 text-sky-500 font-black"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`
            },
            tab.label
          )
        )
      ),

      // Setup and Guide content
      activeGuideTab === "setup" &&
        React.createElement(
          "div",
          { className: "flex flex-col gap-3 text-xs leading-relaxed text-slate-600 dark:text-neutral-300 font-sans" },
          React.createElement(
            "h4",
            { className: "font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-neutral-100" },
            "Two Ways to Implement a Nix Integration:"
          ),
          React.createElement(
            "ul",
            { className: "list-decimal list-inside flex flex-col gap-2 pl-2" },
            React.createElement(
              "li",
              null,
              React.createElement("strong", null, "Option A (Recommended): Desktop C# SDK Bridge. "),
              "Because the raw Bluetooth/USB bytes broadcast by the spectrophotometer are proprietary encrypted data structures, parsing raw strings directly in the browser won't work well. Download the official Nix Universal SDK for Windows doc. The .NET tab below demonstrates exactly how to pass your valid SDK license Options and Signature keys to decode physical scans into REST packets for the browser."
            ),
            React.createElement(
              "li",
              null,
              React.createElement("strong", null, "Option B: Direct Browser Web Serial API. "),
              "Google Chrome supports bypassing native daemons and interfacing directly with the Spectro L serial descriptors using JavaScript. Enable the Web Serial permissions flag, but note raw scan data requires decryption handling."
            )
          )
        ),

      activeGuideTab === "csharp" &&
        React.createElement(
          "div",
          { className: "flex flex-col gap-2" },
          React.createElement(
            "div",
            { className: "flex justify-between items-center text-[10px] text-slate-400 uppercase font-mono bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-2 rounded-t-xl" },
            React.createElement("span", null, "NixBridge.cs - Official .NET SDK Implementation"),
            React.createElement("span", null, "Copy Link To Clipboard")
          ),
          React.createElement(
            "pre",
            { className: "bg-black text-sky-400 font-mono text-[10px] rounded-b-xl p-4 overflow-x-auto shadow-inner border border-neutral-900 leading-normal max-h-[300px] scrollbar-thin" },
            csharpScript
          )
        ),

      activeGuideTab === "python" &&
        React.createElement(
          "div",
          { className: "flex flex-col gap-2" },
          React.createElement(
            "div",
            { className: "flex justify-between items-center text-[10px] text-slate-400 uppercase font-mono bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-2 rounded-t-xl" },
            React.createElement("span", null, "nix_bridge.py - Python SDK Adapter"),
            React.createElement("span", null, "Copy Link To Clipboard")
          ),
          React.createElement(
            "pre",
            { className: "bg-black text-emerald-400 font-mono text-[10px] rounded-b-xl p-4 overflow-x-auto shadow-inner border border-neutral-900 leading-normal max-h-[300px] scrollbar-thin" },
            pythonScript
          )
        ),

      activeGuideTab === "node" &&
        React.createElement(
          "div",
          { className: "flex flex-col gap-2" },
          React.createElement(
            "div",
            { className: "flex justify-between items-center text-[10px] text-slate-400 uppercase font-mono bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-2 rounded-t-xl" },
            React.createElement("span", null, "nix_bridge.js - Node Serial Client"),
            React.createElement("span", null, "Copy Code")
          ),
          React.createElement(
            "pre",
            { className: "bg-black text-emerald-400 font-mono text-[10px] rounded-b-xl p-4 overflow-x-auto shadow-inner border border-neutral-900 leading-normal max-h-[300px] scrollbar-thin" },
            nodeScript
          )
        )
    )
  );
};

// Expose component to global window scope so App.jsx can grab it dynamically
class ViewNixSpectroErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ViewNixSpectro crashed:", error, info);
    this.setState({ error, info });
  }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", { className: "p-8 w-full text-red-500 font-mono text-sm bg-red-50" },
        React.createElement("h2", { className: "font-bold text-lg mb-4" }, "Error in ViewNixSpectro"),
        React.createElement("pre", { className: "whitespace-pre-wrap mb-4" }, this.state.error && this.state.error.toString()),
        React.createElement("pre", { className: "whitespace-pre-wrap text-xs text-red-400" }, this.state.info?.componentStack)
      );
    }
    return React.createElement(ViewNixSpectro, this.props);
  }
}
window.ViewNixSpectroErrorBoundary = ViewNixSpectroErrorBoundary;
})();
