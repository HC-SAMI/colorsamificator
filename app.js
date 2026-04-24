const { useState, useEffect, useMemo, useRef, useCallback } = React;
         

        // --- UTILITIES --- //
        const Icon = ({ name, className = "w-4 h-4" }) => {
            const ref = useRef(null);
            useEffect(() => {
    // Strict relative pathing for GitHub Pages
    const filesToLoad = [
        "./data/egger_decorative_collection_24_26.csv"
    ];

    filesToLoad.forEach(filePath => {
        window.Papa.parse(filePath, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.data && results.data.length > 0) {
                    updateColorData(prev => {
                        const existing = prev || [];
                        return [...existing, ...results.data];
                    });
                    console.log(`✅ Success: Auto-loaded ${results.data.length} colors from ${filePath}`);
                }
            },
            error: function(err) {
                console.warn(`❌ Failed to load from ${filePath}. Attempting fallback to root directory...`);
                
                // Fallback: If the data folder fails, try the root directory (where it used to work)
                const fallbackPath = "./" + filePath.split('/').pop();
                window.Papa.parse(fallbackPath, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    complete: function(fbResults) {
                        if (fbResults.data && fbResults.data.length > 0) {
                            updateColorData(prev => {
                                const existing = prev || [];
                                return [...existing, ...fbResults.data];
                            });
                            console.log(`✅ Fallback Success: Loaded ${fbResults.data.length} colors from ${fallbackPath}`);
                        }
                    },
                    error: function(fbErr) {
                         console.error(`❌ Fallback failed. Could not find CSV in data folder or root.`, fbErr);
                    }
                });
            }
        });
    });
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
                    const inlineScript = document.querySelector('script[type="text/babel"]:not([src])');
                    if (inlineScript && inlineScript.textContent && inlineScript.textContent.trim().length > 100) {
                        appCode = inlineScript.textContent;
                    } else {
                        try {
                            const r2 = await fetch('app.jsx');
                            if (r2.ok) appCode = await r2.text();
                            else throw new Error('Cannot locate app code');
                        } catch(e2) { throw new Error('Export failed: ' + e2.message); }
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
                    
                    zip.file('anchors.csv', Papa.unparse(anchorsCsv));
                    zip.file('pins.csv', Papa.unparse(pinsCsv));

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
                        zip.file(`${brand}.csv`, Papa.unparse(brandData));
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
                deltaEOK = cA.deltaE(cB, "OK").toFixed(3); 
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
                    deltaEOK={ deltaEOK != null && !isNaN(deltaEOK) ? Number(deltaEOK).toFixed(2) : deltaEOK } deltaE2000={deltaE2000} tabs={tabs} searchResults={searchResults}
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
            const [maxDeltaE, setMaxDeltaE] = useState(0.05);
            
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
                            const d = center.deltaE(new Color("oklch", [item.L, item.C, item.H]), "OK");
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
                                    <input type="range" min="0.00" max="0.25" step="0.01" value={maxDeltaE} onChange={e => setMaxDeltaE(parseFloat(e.target.value))} className="w-32" />
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
                                            {enableDeltaE && item._d !== undefined && <div className="text-emerald-500 font-bold mb-1 border-b border-emerald-500/20 pb-0.5">ΔEok {item._d.toFixed(3)}</div>}
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
                                                {enableDeltaE && <td className="p-2 text-right text-emerald-600 font-bold font-mono">{item._d?.toFixed(3)}</td>}
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
                                            {enableDeltaE && item._d !== undefined && <div className="text-[9px] text-emerald-500 font-bold flex items-center gap-0.5 justify-center"><Icon name="target" className="w-2.5 h-2.5" /> ΔE {item._d.toFixed(1)}</div>}
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
                                                    <Icon name="magnet" className="w-3 h-3" /> Snap ΔE: {crosshair.snapDist.toFixed(3)}
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
                                                            <div className="text-lg font-mono font-black text-slate-800 dark:text-neutral-200">{ deltaEOK != null && !isNaN(deltaEOK) ? Number(deltaEOK).toFixed(2) : deltaEOK }</div>
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
                                    <div className="text-5xl font-black font-mono text-sky-400 drop-shadow-md">{ deltaEOK != null && !isNaN(deltaEOK) ? Number(deltaEOK).toFixed(2) : deltaEOK } <span className="text-sm text-white/50 tracking-normal ml-1">OK</span></div>
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