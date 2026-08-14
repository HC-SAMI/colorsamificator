(() => {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;

  const TOURS = [
    {
      id: "search-sami",
      title: "Find Commercial Colors & SAMI Names",
      subtitle: "Search database catalogs and decode the SAMI naming formula",
      icon: "search",
      badge: "Lookup & Naming",
      category: "Discovery",
      steps: [
        {
          id: "omnisearch-input",
          targetId: "tour-omnisearch",
          title: "1. Global Omnisearch",
          content: "Use the top Omnisearch bar to instantly search across all loaded commercial catalogs (Sherwin Williams, Benjamin Moore, Uniboard, Egger, Tafisa, and more) by name, code, or brand.",
          tip: "You can also search by OKLCH code or manufacturer part number (e.g., 'K77', 'SW 7029', or 'Hale Navy').",
          placement: "bottom",
          interactiveActions: [
            {
              label: "Try 'Agreeable Gray'",
              action: (actions) => actions.setSearchQuery("Agreeable Gray"),
            },
            {
              label: "Try 'Hale Navy'",
              action: (actions) => actions.setSearchQuery("Hale Navy"),
            },
            {
              label: "Try 'K77 Dosha'",
              action: (actions) => actions.setSearchQuery("K77"),
            }
          ],
          onEnter: (actions) => {
            // Focus or ensure top area is visible
          }
        },
        {
          id: "search-results",
          targetId: "tour-search-results",
          fallbackId: "tour-omnisearch",
          title: "2. Select From Live Results",
          content: "Matching swatches appear in real time with manufacturer brand badges and color previews. Clicking any search result immediately focuses the crosshair and loads its full colorimetric specification.",
          tip: "Each result displays its RGB hex, brand catalog, and verified spectral badge if laboratory spectrophotometer data is present.",
          placement: "bottom",
          onEnter: (actions) => {
            if (!actions.searchQuery) {
              actions.setSearchQuery("Agreeable Gray");
            }
          },
          interactiveActions: [
            {
              label: "Select First Match",
              action: (actions) => {
                if (actions.searchResults && actions.searchResults.length > 0) {
                  const res = actions.searchResults[0];
                  actions.handleUpdate([res.L, res.C, res.H], res.spectral, res.commercial);
                  actions.setSearchQuery("");
                }
              }
            }
          ]
        },
        {
          id: "sami-name-header",
          targetId: "tour-sami-name-header",
          title: "3. The SAMI Name Classification",
          content: "Look at the top of the Left Color Inspector. The system assigns every color a structured SAMI (Adjective + Noun) name — for example, 'Muted Greige' or 'Deep Navy'.",
          tip: "• Adjective: Derived from perceptual OKLCH Lightness tiers (e.g., Pale, Light, Medium, Deep, Dark).\n• Noun: Anchored by chromatic Hue & Chroma families (e.g., Greige, Navy, Sage, Ochre, Rose).",
          placement: "right",
          onEnter: (actions) => {
            // Clear search query to show inspector cleanly
            actions.setSearchQuery("");
          }
        },
        {
          id: "color-spaces",
          targetId: "tour-color-spaces",
          title: "4. Perceptual Color Spaces & Gamut",
          content: "Below the SAMI name, the inspector displays complete colorimetric readings: OKLCH coordinates (L: Lightness, C: Chroma, H: Hue), sRGB HEX, CMYK, and CIELAB adapted to standard illuminants (D65, A, F2).",
          tip: "The gamut indicator warns if a color exceeds standard sRGB gamut boundaries for web display vs physical print.",
          placement: "right"
        }
      ]
    },
    {
      id: "commercial-matches",
      title: "Find Alternates with Commercial Matches",
      subtitle: "Discover perceptual twins and cross-brand substitutes using ΔEok",
      icon: "palette",
      badge: "Color Matching",
      category: "Analysis",
      steps: [
        {
          id: "reference-color",
          targetId: "tour-swatch-box",
          title: "1. Target Reference Color",
          content: "The active color in the Color Inspector acts as your reference baseline. You can pick any color from the interactive 2D/3D map, import spectrophotometer readings, or select a commercial swatch.",
          tip: "The perceptual distance (ΔEok) will be calculated against this exact coordinate.",
          placement: "right"
        },
        {
          id: "open-matches",
          targetId: "tour-commercial-matches-panel",
          title: "2. Commercial Matches Panel",
          content: "Open the Commercial Matches accordion in the left sidebar. The system automatically searches across all loaded manufacturer databases to find the closest commercial equivalents.",
          tip: "Calculations run in perceptually uniform OKLCH space (ΔEok) for visually authentic matching.",
          placement: "right",
          onEnter: (actions) => {
            actions.openCommercialMatches(true);
          }
        },
        {
          id: "match-controls",
          targetId: "tour-commercial-controls",
          title: "3. Adjust Tolerance (ΔEok) & Filters",
          content: "Use the ΔEok slider to dial in the matching precision:\n• ΔEok ≤ 1.0: Virtually indistinguishable visual twins.\n• ΔEok ≤ 3.0: Commercial matches suitable for interior surfaces.\n• ΔEok ≤ 5.0+: Neighboring tonal family options.",
          tip: "Use the filter input to narrow results by brand (e.g. 'egger', 'uniboard', 'benjamin moore') or material finish.",
          placement: "right",
          onEnter: (actions) => {
            actions.openCommercialMatches(true);
          }
        },
        {
          id: "match-list",
          targetId: "tour-commercial-list",
          title: "4. Review Alternates, Specs & Direct Links",
          content: "Each match card shows the brand name, product code, ΔE score, and spectral verification badge. Click any card to inspect that color, or click 'Link' to view the manufacturer's technical spec sheet.",
          tip: "You can also send swatches to Slot A / Slot B to calculate metamerism index across different illuminants!",
          placement: "right",
          onEnter: (actions) => {
            actions.openCommercialMatches(true);
          }
        }
      ]
    },
    {
      id: "print-labels",
      title: "Palette Playground & Print Avery Labels",
      subtitle: "Build 60-30-10 palettes, select pins, and generate printable spec sheets",
      icon: "printer",
      badge: "Spec Sheets & Print",
      category: "Production",
      steps: [
        {
          id: "switch-view",
          targetId: "tour-view-tabs",
          title: "1. Switch to Palette or Pins View",
          content: "The app supports multiple views for managing project colors. You can print professional Avery labels directly from the Palette Playground or from the Pins database table.",
          tip: "Use the view dropdown at the top of the main viewport to switch views anytime.",
          placement: "bottom",
          onEnter: (actions) => {
            actions.setActiveTab("palette");
          },
          interactiveActions: [
            {
              label: "Switch to Palette",
              action: (actions) => actions.setActiveTab("palette"),
            },
            {
              label: "Switch to Pins",
              action: (actions) => actions.setActiveTab("pins"),
            }
          ]
        },
        {
          id: "palette-slots",
          targetId: "tour-palette-slots",
          title: "2. Assemble 60-30-10 Interior Palette",
          content: "In the Left Sidebar Palette section, add colors to create a cohesive interior palette following the 60-30-10 rule:\n• 60% Dominant (Main surfaces / walls)\n• 30% Secondary (Millwork / cabinetry)\n• 10% Accent (Hardware / focal points)",
          tip: "You can use the 'Auto-Generate 60-30-10 Palette' dropdown for signature designer palettes with balanced lightness contrast.",
          placement: "right",
          onEnter: (actions) => {
            // If palette is empty, add current or generate sample
            if (!actions.palette || actions.palette.length === 0) {
              actions.generateAutoPalette("luxury_interior");
            }
          }
        },
        {
          id: "print-button",
          targetId: "tour-palette-print-btn",
          title: "3. Click 'Print Avery' / 'Print Labels'",
          content: "Click the 'Print Avery' button in the Palette section (or 'Print Labels' in the Pins view) to open the interactive label layout and spec sheet designer.",
          tip: "The label generator formats each swatch with SAMI names, OKLCH codes, RGB/CMYK values, sheen, door profile, and material metadata.",
          placement: "right",
          interactiveActions: [
            {
              label: "Open Print Dialog",
              action: (actions) => {
                actions.setAveryPrintSourceType("palette");
                if (actions.palette && actions.palette.length > 0) {
                  actions.setSelectedPrintIds(actions.palette.map((p) => p.id));
                }
                actions.setShowAveryModal(true);
              }
            }
          ]
        },
        {
          id: "avery-modal",
          targetId: "tour-avery-modal",
          fallbackId: "tour-palette-print-btn",
          title: "4. Customize Labels & Print PDF",
          content: "In the Avery Print dialog, customize your label metadata (Sheen, Door Profile, Material, Visual Pattern) and toggle visible fields. Then click 'Print Sheet' to print to physical Avery 5159 sheets or save as a high-resolution PDF spec sheet!",
          tip: "Make sure 'Background graphics' is enabled in your browser print settings so swatches print with accurate color fills.",
          placement: "left",
          onEnter: (actions) => {
            actions.setAveryPrintSourceType("palette");
            if (actions.palette && actions.palette.length > 0) {
              actions.setSelectedPrintIds(actions.palette.map((p) => p.id));
            }
            actions.setShowAveryModal(true);
          }
        }
      ]
    }
  ];

  // GuidedTour Component
  const GuidedTour = ({
    activeTourId,
    onClose,
    onSwitchTour,
    actions
  }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 100, left: 100 });
    const tooltipRef = useRef(null);

    const activeTour = useMemo(() => {
      return TOURS.find((t) => t.id === activeTourId) || null;
    }, [activeTourId]);

    const currentStep = useMemo(() => {
      if (!activeTour) return null;
      return activeTour.steps[stepIndex] || null;
    }, [activeTour, stepIndex]);

    // Reset step index when tour changes
    useEffect(() => {
      setStepIndex(0);
    }, [activeTourId]);

    // Trigger step onEnter action
    useEffect(() => {
      if (!currentStep || !actions) return;
      if (typeof currentStep.onEnter === "function") {
        try {
          currentStep.onEnter(actions);
        } catch (e) {
          console.warn("GuidedTour onEnter error:", e);
        }
      }
    }, [currentStep, actions]);

    // Measure target element position
    const updateTargetPosition = useCallback(() => {
      if (!currentStep) return;
      
      let el = document.getElementById(currentStep.targetId);
      if (!el && currentStep.fallbackId) {
        el = document.getElementById(currentStep.fallbackId);
      }
      
      if (el) {
        // Scroll element into view if not visible
        const rect = el.getBoundingClientRect();
        const isInViewport =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth);

        if (!isInViewport) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }

        // Re-get rect after potential scroll calculation
        setTimeout(() => {
          if (!el) return;
          const r = el.getBoundingClientRect();
          setTargetRect({
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom
          });
        }, 150);
      } else {
        // Target element not found, fallback to center screen
        setTargetRect(null);
      }
    }, [currentStep]);

    useEffect(() => {
      updateTargetPosition();
      const timer = setTimeout(updateTargetPosition, 350);
      window.addEventListener("resize", updateTargetPosition);
      window.addEventListener("scroll", updateTargetPosition, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateTargetPosition);
        window.removeEventListener("scroll", updateTargetPosition, true);
      };
    }, [currentStep, updateTargetPosition]);

    // Calculate tooltip position relative to target
    useEffect(() => {
      if (!tooltipRef.current) return;
      const tooltipEl = tooltipRef.current;
      const ttWidth = tooltipEl.offsetWidth || 380;
      const ttHeight = tooltipEl.offsetHeight || 260;
      const margin = 16;

      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      if (!targetRect) {
        // Center of viewport
        setTooltipPos({
          top: Math.max(margin, (viewportH - ttHeight) / 2),
          left: Math.max(margin, (viewportW - ttWidth) / 2)
        });
        return;
      }

      const placement = currentStep?.placement || "auto";
      let top = 0;
      let left = 0;

      if (placement === "bottom") {
        top = targetRect.bottom + margin;
        left = targetRect.left + (targetRect.width / 2) - (ttWidth / 2);
      } else if (placement === "top") {
        top = targetRect.top - ttHeight - margin;
        left = targetRect.left + (targetRect.width / 2) - (ttWidth / 2);
      } else if (placement === "right") {
        top = targetRect.top + (targetRect.height / 2) - (ttHeight / 2);
        left = targetRect.right + margin;
      } else if (placement === "left") {
        top = targetRect.top + (targetRect.height / 2) - (ttHeight / 2);
        left = targetRect.left - ttWidth - margin;
      } else {
        // Auto
        if (targetRect.right + ttWidth + margin < viewportW) {
          top = targetRect.top;
          left = targetRect.right + margin;
        } else if (targetRect.bottom + ttHeight + margin < viewportH) {
          top = targetRect.bottom + margin;
          left = targetRect.left;
        } else {
          top = Math.max(margin, targetRect.top - ttHeight - margin);
          left = Math.max(margin, targetRect.left);
        }
      }

      // Constrain within viewport bounds
      left = Math.max(margin, Math.min(viewportW - ttWidth - margin, left));
      top = Math.max(margin, Math.min(viewportH - ttHeight - margin, top));

      setTooltipPos({ top, left });
    }, [targetRect, currentStep]);

    // Keyboard navigation
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          onClose();
        } else if (e.key === "ArrowRight") {
          handleNext();
        } else if (e.key === "ArrowLeft") {
          handlePrev();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [stepIndex, activeTour]);

    if (!activeTour || !currentStep) return null;

    const totalSteps = activeTour.steps.length;
    const isFirstStep = stepIndex === 0;
    const isLastStep = stepIndex === totalSteps - 1;

    const handleNext = () => {
      if (isLastStep) {
        onClose();
      } else {
        setStepIndex((prev) => prev + 1);
      }
    };

    const handlePrev = () => {
      if (!isFirstStep) {
        setStepIndex((prev) => prev - 1);
      }
    };

    return ReactDOM.createPortal(
      React.createElement(
        "div",
        {
          className: "fixed inset-0 z-[10000] pointer-events-auto select-none",
          id: "interactive-guided-tour-overlay"
        },
        // Dimmed backdrop with cut-out / spotlight
        React.createElement("div", {
          className: "absolute inset-0 bg-neutral-950/60 backdrop-blur-[2px] transition-all duration-300 pointer-events-auto",
          onClick: onClose
        }),

        // Glowing target box & beacon if targetRect exists
        targetRect &&
          React.createElement(
            "div",
            {
              className:
                "absolute pointer-events-none transition-all duration-300 rounded-xl ring-4 ring-sky-500/80 shadow-[0_0_35px_rgba(14,165,233,0.45)] animate-pulse z-[10001]",
              style: {
                top: Math.max(0, targetRect.top - 6),
                left: Math.max(0, targetRect.left - 6),
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                boxShadow: "0 0 0 9999px rgba(1, 13, 0, 0.65), 0 0 25px rgba(56, 189, 248, 0.8)",
                borderRadius: "12px",
                border: "2px solid rgba(56, 189, 248, 0.9)"
              }
            },
            // Beacon badge marker
            React.createElement(
              "div",
              {
                className:
                  "absolute -top-3 -right-3 w-7 h-7 bg-sky-500 text-white rounded-full flex items-center justify-center font-black text-xs shadow-lg border-2 border-white animate-bounce"
              },
              stepIndex + 1
            )
          ),

        // Floating Tooltip Card
        React.createElement(
          "div",
          {
            ref: tooltipRef,
            className:
              "absolute z-[10002] w-full max-w-[420px] bg-white dark:bg-neutral-900 border-2 border-sky-500 dark:border-sky-400 rounded-2xl shadow-2xl p-6 text-slate-800 dark:text-neutral-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto",
            style: {
              top: `${tooltipPos.top}px`,
              left: `${tooltipPos.left}px`,
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 25px rgba(14, 165, 233, 0.25)"
            },
            onClick: (e) => e.stopPropagation()
          },
          // Header: Category, Progress & Close Button
          React.createElement(
            "div",
            { className: "flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-3" },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(
                "span",
                {
                  className:
                    "px-2.5 py-0.5 bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                },
                React.createElement(Icon, { name: activeTour.icon || "compass", className: "w-3 h-3" }),
                activeTour.badge
              ),
              React.createElement(
                "span",
                { className: "text-[11px] font-bold text-slate-400 dark:text-neutral-500" },
                `Step ${stepIndex + 1} of ${totalSteps}`
              )
            ),
            React.createElement(
              "button",
              {
                onClick: onClose,
                className:
                  "p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors",
                title: "Exit Tutorial (Esc)"
              },
              React.createElement(Icon, { name: "x", className: "w-4 h-4" })
            )
          ),

          // Title & Description
          React.createElement(
            "div",
            { className: "flex flex-col gap-2" },
            React.createElement(
              "h3",
              { className: "text-lg font-black text-slate-900 dark:text-white tracking-tight" },
              currentStep.title
            ),
            React.createElement(
              "p",
              { className: "text-xs text-slate-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line" },
              currentStep.content
            )
          ),

          // Pro-tip Callout Box
          currentStep.tip &&
            React.createElement(
              "div",
              {
                className:
                  "p-3 bg-sky-50/70 dark:bg-neutral-800/80 border border-sky-200/60 dark:border-neutral-700 rounded-xl text-[11px] text-slate-700 dark:text-neutral-300 flex items-start gap-2.5 leading-snug"
              },
              React.createElement(Icon, {
                name: "sparkles",
                className: "w-4 h-4 text-sky-500 shrink-0 mt-0.5"
              }),
              React.createElement("div", { className: "whitespace-pre-line font-medium" }, currentStep.tip)
            ),

          // Interactive Action Buttons (e.g. Try Search, Open Modal)
          currentStep.interactiveActions &&
            currentStep.interactiveActions.length > 0 &&
            React.createElement(
              "div",
              { className: "flex flex-wrap gap-2 pt-1" },
              currentStep.interactiveActions.map((act, i) =>
                React.createElement(
                  "button",
                  {
                    key: i,
                    onClick: () => {
                      if (typeof act.action === "function") act.action(actions);
                    },
                    className:
                      "px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/40 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5"
                  },
                  React.createElement(Icon, { name: "zap", className: "w-3 h-3 text-sky-500" }),
                  act.label
                )
              )
            ),

          // Step Progress Dots
          React.createElement(
            "div",
            { className: "flex items-center gap-1.5 my-1" },
            activeTour.steps.map((s, idx) =>
              React.createElement("button", {
                key: s.id,
                onClick: () => setStepIndex(idx),
                className: `h-1.5 rounded-full transition-all ${
                  idx === stepIndex
                    ? "w-6 bg-sky-500"
                    : idx < stepIndex
                    ? "w-2.5 bg-sky-400/60"
                    : "w-1.5 bg-slate-200 dark:bg-neutral-700"
                }`,
                title: `Go to step ${idx + 1}`
              })
            )
          ),

          // Footer Navigation Controls
          React.createElement(
            "div",
            {
              className:
                "flex items-center justify-between border-t border-slate-100 dark:border-neutral-800 pt-3 mt-1"
            },
            React.createElement(
              "button",
              {
                onClick: handlePrev,
                disabled: isFirstStep,
                className: `px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                  isFirstStep
                    ? "opacity-30 cursor-not-allowed text-slate-400"
                    : "hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200"
                }`
              },
              React.createElement(Icon, { name: "arrow-left", className: "w-3.5 h-3.5" }),
              "Back"
            ),

            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(
                "button",
                {
                  onClick: onClose,
                  className:
                    "px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors uppercase tracking-wider"
                },
                "Skip Tour"
              ),
              React.createElement(
                "button",
                {
                  onClick: handleNext,
                  className:
                    "px-5 py-2 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-sky-500/25 transition-all flex items-center gap-1.5"
                },
                isLastStep ? "Finish Tutorial" : "Next Step",
                React.createElement(Icon, {
                  name: isLastStep ? "check" : "arrow-right",
                  className: "w-3.5 h-3.5"
                })
              )
            )
          )
        )
      ),
      document.body
    );
  };

  // Export to window
  window.TOURS_DATA = TOURS;
  window.GuidedTour = GuidedTour;
})();
