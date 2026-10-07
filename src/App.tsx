import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Upload,
  Sparkles,
  Plus,
  Trash2,
  Sliders,
  Download,
  Edit,
  X,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  Info,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  FileImage,
  ChevronDown,
  ChevronUp,
  Compass,
  GripVertical,
  Package,
  FileDown,
  Construction,
  Grid,
  Ruler,
  FolderOpen,
  Save,
  FilePlus,
  FileCode,
  Wrench
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Panel, NamingRule, PanelGroup, AccessoryLine, SavedProject, MasterListSettings } from "./types";
import {
  groupAndLabelPanels,
  exportToCSV,
  exportToExcel,
  exportToJSON,
  SAMPLE_PANELS,
  SAMPLE_ACCESSORY_LINES,
  parseExcelPackingList,
  checkNeedsStiffener,
  calculateGirth,
  DEFAULT_MASTER_LIST_SETTINGS,
  exportMasterListToExcel,
  exportMasterListToCSV
} from "./utils";
import DxfParser from "dxf-parser";
import { DxfSvgRenderer } from "./components/DxfSvgRenderer";
import { ProjectManagerModal } from "./components/ProjectManagerModal";
import { DxfExportModal } from "./components/DxfExportModal";

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

function convertOklchAndOklabToRgb(cssString: string): string {
  if (typeof cssString !== "string") return cssString;

  // Replace oklch(...)
  let result = cssString.replace(
    /oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/gi,
    (_match, L_str, C_str, h_str, alpha_str) => {
      const L = L_str.endsWith("%") ? parseFloat(L_str) / 100 : parseFloat(L_str);
      const C = parseFloat(C_str);
      const h = parseFloat(h_str);
      let alpha = 1;
      if (alpha_str) {
        alpha = alpha_str.endsWith("%") ? parseFloat(alpha_str) / 100 : parseFloat(alpha_str);
      }

      const rad = (h * Math.PI) / 180;
      const a = C * Math.cos(rad);
      const b = C * Math.sin(rad);

      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

      const l = l_ * l_ * l_;
      const m = m_ * m_ * m_;
      const s = s_ * s_ * s_;

      const rLinear = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

      const gamma = (c: number) => c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;

      const r_val = Math.min(255, Math.max(0, Math.round(gamma(rLinear) * 255)));
      const g_val = Math.min(255, Math.max(0, Math.round(gamma(gLinear) * 255)));
      const b_val = Math.min(255, Math.max(0, Math.round(gamma(bLinear) * 255)));

      return alpha === 1 ? `rgb(${r_val}, ${g_val}, ${b_val})` : `rgba(${r_val}, ${g_val}, ${b_val}, ${alpha})`;
    }
  );

  // Replace oklab(...)
  result = result.replace(
    /oklab\(\s*([0-9.]+%?)\s+([0-9.-]+)\s+([0-9.-]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/gi,
    (_match, L_str, a_str, b_str, alpha_str) => {
      const L = L_str.endsWith("%") ? parseFloat(L_str) / 100 : parseFloat(L_str);
      const a = parseFloat(a_str);
      const b = parseFloat(b_str);
      let alpha = 1;
      if (alpha_str) {
        alpha = alpha_str.endsWith("%") ? parseFloat(alpha_str) / 100 : parseFloat(alpha_str);
      }

      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

      const l = l_ * l_ * l_;
      const m = m_ * m_ * m_;
      const s = s_ * s_ * s_;

      const rLinear = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

      const gamma = (c: number) => c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;

      const r_val = Math.min(255, Math.max(0, Math.round(gamma(rLinear) * 255)));
      const g_val = Math.min(255, Math.max(0, Math.round(gamma(gLinear) * 255)));
      const b_val = Math.min(255, Math.max(0, Math.round(gamma(bLinear) * 255)));

      return alpha === 1 ? `rgb(${r_val}, ${g_val}, ${b_val})` : `rgba(${r_val}, ${g_val}, ${b_val}, ${alpha})`;
    }
  );

  // Sweep up ANY remaining oklch/oklab containing variables or fallback structures
  // to ensure html2canvas NEVER sees them and crashes!
  result = result.replace(/oklch\((?:[^()]+|\([^()]*\))*\)/gi, "rgb(0, 82, 204)");
  result = result.replace(/oklab\((?:[^()]+|\([^()]*\))*\)/gi, "rgb(0, 82, 204)");

  return result;
}

const InlineRenameInput = ({ panel, onSave }: { panel: Panel, onSave: (name: string) => void }) => {
  const [val, setVal] = useState(panel.customLabel || panel.label || "");
  
  // Keep in sync if panel's label/customLabel updates from outside
  useEffect(() => {
    setVal(panel.customLabel || panel.label || "");
  }, [panel.customLabel, panel.label]);

  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSave(val);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Rename panel..."
      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#0052CC] text-[#1A1C1E]"
    />
  );
};

interface ColumnInfo {
  columnIndex: number;
  avgX: number;
  panels: Panel[];
  role: string;
}

function getAreaColumnsAndNaming(
  selectedPanels: Panel[],
  prefix: string,
  startNumber: number,
  mode: "sequential" | "column-smart" | "global-grouped" | "row-sequential" | "row-smart",
  tolerance: number = 0,
  allPanels: Panel[] = []
): {
  columns: ColumnInfo[];
  panelLabels: { [id: string]: string };
} {
  if (selectedPanels.length === 0) {
    return { columns: [], panelLabels: {} };
  }

  // Find any existing label for a panel size in allPanels
  const getExistingLabelForSize = (p: Panel): string | null => {
    const matchedPanel = allPanels.find((other) => {
      if (!other.customLabel) return false;
      return (
        Math.abs(other.realWidth - p.realWidth) <= tolerance &&
        Math.abs(other.realHeight - p.realHeight) <= tolerance
      );
    });
    return matchedPanel ? matchedPanel.customLabel : null;
  };

  // 1. Group panels into columns (used for column-based strategies)
  const sortedByCenterX = [...selectedPanels].sort((a, b) => {
    const cxA = a.x + a.width / 2;
    const cxB = b.x + b.width / 2;
    return cxA - cxB;
  });

  const columnsList: Panel[][] = [];
  const xPercentTolerance = 4.0; // 4% of drawing width as horizontal tolerance

  sortedByCenterX.forEach((panel) => {
    const cx = panel.x + panel.width / 2;
    let placed = false;
    for (const col of columnsList) {
      const colAvgCx = col.reduce((sum, p) => sum + (p.x + p.width / 2), 0) / col.length;
      if (Math.abs(cx - colAvgCx) < xPercentTolerance) {
        col.push(panel);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columnsList.push([panel]);
    }
  });

  // Sort columns: left-to-right based on average center x
  columnsList.sort((colA, colB) => {
    const avgA = colA.reduce((sum, p) => sum + (p.x + p.width / 2), 0) / colA.length;
    const avgB = colB.reduce((sum, p) => sum + (p.x + p.width / 2), 0) / colB.length;
    return avgA - avgB;
  });

  // Sort panels within each column top-to-bottom
  columnsList.forEach((col) => {
    col.sort((a, b) => {
      const cyA = a.y + a.height / 2;
      const cyB = b.y + b.height / 2;
      return cyA - cyB;
    });
  });

  const columns: ColumnInfo[] = columnsList.map((col, idx) => {
    const avgX = col.reduce((sum, p) => sum + (p.x + p.width / 2), 0) / col.length;
    let role = "Other Column";
    if (col.length === 4) {
      role = "Wall Column (4 Panels)";
    } else if (col.length === 2) {
      role = "Window Column (Top & Bottom)";
    } else if (col.length === 1) {
      role = "Door / Window Top Header";
    } else if (col.length === 3) {
      role = "Wall Column (3 Panels)";
    }
    return {
      columnIndex: idx + 1,
      avgX,
      panels: col,
      role
    };
  });

  // 2. Group panels into horizontal rows (used for row-based strategies)
  const sortedByCenterY = [...selectedPanels].sort((a, b) => {
    const cyA = a.y + a.height / 2;
    const cyB = b.y + b.height / 2;
    return cyA - cyB;
  });

  const rowsList: Panel[][] = [];
  const yPercentTolerance = 4.0; // 4% of drawing height as vertical tolerance

  sortedByCenterY.forEach((panel) => {
    const cy = panel.y + panel.height / 2;
    let placed = false;
    for (const row of rowsList) {
      const rowAvgCy = row.reduce((sum, p) => sum + (p.y + p.height / 2), 0) / row.length;
      if (Math.abs(cy - rowAvgCy) < yPercentTolerance) {
        row.push(panel);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rowsList.push([panel]);
    }
  });

  // Sort rows from top-to-bottom
  rowsList.sort((rowA, rowB) => {
    const avgA = rowA.reduce((sum, p) => sum + (p.y + p.height / 2), 0) / rowA.length;
    const avgB = rowB.reduce((sum, p) => sum + (p.y + p.height / 2), 0) / rowB.length;
    return avgA - avgB;
  });

  // Sort panels within each row left-to-right
  rowsList.forEach((row) => {
    row.sort((a, b) => {
      const cxA = a.x + a.width / 2;
      const cxB = b.x + b.width / 2;
      return cxA - cxB;
    });
  });

  const panelLabels: { [id: string]: string } = {};
  let currentNum = startNumber;

  // Build the ordered array of panels according to the selected mode's scanning direction
  const orderedPanels: Panel[] = [];
  if (mode === "row-smart" || mode === "row-sequential") {
    // Traverse top-to-bottom rows, left-to-right within each row
    rowsList.forEach((row) => {
      row.forEach((p) => orderedPanels.push(p));
    });
  } else {
    // Traverse left-to-right columns, top-to-bottom within each column (sequential, column-smart, global-grouped)
    columns.forEach((col) => {
      col.panels.forEach((p) => orderedPanels.push(p));
    });
  }

  // Global size matching map for this naming session so panels with identical dimensions share the exact same label
  const seenSizes: { realWidth: number; realHeight: number; label: string }[] = [];

  orderedPanels.forEach((p) => {
    // 1. Check if we already assigned a label to this panel size in the current selection
    const matched = seenSizes.find(
      (s) =>
        Math.abs(s.realWidth - p.realWidth) <= tolerance &&
        Math.abs(s.realHeight - p.realHeight) <= tolerance
    );

    if (matched) {
      panelLabels[p.id] = matched.label;
    } else {
      // 2. Check if an existing label exists in the drawing outside this selection for this size
      const existingLabel = getExistingLabelForSize(p);
      if (existingLabel) {
        panelLabels[p.id] = existingLabel;
        seenSizes.push({
          realWidth: p.realWidth,
          realHeight: p.realHeight,
          label: existingLabel,
        });
      } else {
        // 3. Assign a new sequential label for this new distinct dimension
        const label = `${prefix}${currentNum}`;
        panelLabels[p.id] = label;
        seenSizes.push({
          realWidth: p.realWidth,
          realHeight: p.realHeight,
          label,
        });
        currentNum++;
      }
    }
  });

  return { columns, panelLabels };
}

const GROUP_COLORS = [
  { border: "border-blue-600", text: "text-blue-800", bg: "bg-blue-50/30", badge: "bg-blue-600 text-white", borderHover: "hover:border-blue-700", fill: "#0052CC", indicator: "bg-blue-500" },
  { border: "border-emerald-600", text: "text-emerald-800", bg: "bg-emerald-50/30", badge: "bg-emerald-600 text-white", borderHover: "hover:border-emerald-700", fill: "#00875A", indicator: "bg-emerald-500" },
  { border: "border-amber-600", text: "text-amber-800", bg: "bg-amber-50/30", badge: "bg-amber-600 text-white", borderHover: "hover:border-amber-700", fill: "#FFAB00", indicator: "bg-amber-500" },
  { border: "border-purple-600", text: "text-purple-800", bg: "bg-purple-50/30", badge: "bg-purple-600 text-white", borderHover: "hover:border-purple-700", fill: "#5243AA", indicator: "bg-purple-500" },
  { border: "border-rose-600", text: "text-rose-800", bg: "bg-rose-50/30", badge: "bg-rose-600 text-white", borderHover: "hover:border-rose-700", fill: "#DE350B", indicator: "bg-rose-500" },
  { border: "border-teal-600", text: "text-teal-800", bg: "bg-teal-50/30", badge: "bg-teal-600 text-white", borderHover: "hover:border-teal-700", fill: "#00B8D9", indicator: "bg-teal-500" },
  { border: "border-indigo-600", text: "text-indigo-800", bg: "bg-indigo-50/30", badge: "bg-indigo-600 text-white", borderHover: "hover:border-indigo-700", fill: "#4C51BF", indicator: "bg-indigo-500" },
  { border: "border-orange-600", text: "text-orange-800", bg: "bg-orange-50/30", badge: "bg-orange-600 text-white", borderHover: "hover:border-orange-700", fill: "#DD6B20", indicator: "bg-orange-500" },
];

const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function App() {
  // Container refs
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dxfFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const prevSyncPanelIdRef = useRef<string | null>(null);
  const prevSyncPanelIdsRef = useRef<Set<string>>(new Set());
  const lastAutoFillPanelIdRef = useRef<string | null>(null);

  // Application State - Clean initial state showing upload options on open
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedPanelIds, setSelectedPanelIds] = useState<Set<string>>(new Set());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dxfData, setDxfData] = useState<any>(null);
  const [originalDxfText, setOriginalDxfText] = useState<string | null>(null);
  const [hoveredCandidateId, setHoveredCandidateId] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1.777); // Default 16:9
  const [imageName, setImageName] = useState<string>("No drawing loaded");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [systemMessage, setSystemMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [scaleReferenceId, setScaleReferenceId] = useState<string | null>(null);

  // Drawing assistance: Ortho Mode & Object Snapping states
  const [isOrthoMode, setIsOrthoMode] = useState<boolean>(false);
  const [isObjectSnapActive, setIsObjectSnapActive] = useState<boolean>(true);

  // Visibility and display options (layer filters & line scaling)
  const [showBaseTracks, setShowBaseTracks] = useState<boolean>(true);
  const [showReveals, setShowReveals] = useState<boolean>(true);
  const [showPanelLayout, setShowPanelLayout] = useState<boolean>(true);
  const [panelBorderMode, setPanelBorderMode] = useState<"thick" | "thin" | "none">("none");
  const [showPanelLabels, setShowPanelLabels] = useState<boolean>(true);
  const [showAccessoryLineBadges, setShowAccessoryLineBadges] = useState<boolean>(false);
  const [showLegendOnExport, setShowLegendOnExport] = useState<boolean>(true);
  const [accessoryLineThickness, setAccessoryLineThickness] = useState<number>(0.0);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Compact Header & Toolbar States
  const [isCompactToolbar, setIsCompactToolbar] = useState<boolean>(() => {
    return localStorage.getItem("panelflow_compact_toolbar") === "true";
  });
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);

  // Accessories (Reveals & Base Tracks) States
  const [accessoryLines, setAccessoryLines] = useState<AccessoryLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [activeAccessoryDrawMode, setActiveAccessoryDrawMode] = useState<"reveal_5_8" | "reveal_3_4" | "reveal_custom" | "base_track" | null>(null);
  
  // Custom specifications for Reveals matching the bone-white accessories layout
  const [revealWidths, setRevealWidths] = useState<{ [key: string]: number }>(() => {
    try {
      const saved = localStorage.getItem("panelflow_reveal_widths");
      return saved ? JSON.parse(saved) : {
        reveal_5_8: 42,
        reveal_3_4: 48,
        reveal_custom: 25,
      };
    } catch {
      return {
        reveal_5_8: 42,
        reveal_3_4: 48,
        reveal_custom: 25,
      };
    }
  });
  const [accessoryColors, setAccessoryColors] = useState<{ [key: string]: string }>(() => {
    try {
      const saved = localStorage.getItem("panelflow_accessory_colors");
      return saved ? JSON.parse(saved) : {
        reveal_5_8: "#06B6D4",
        reveal_3_4: "#6366F1",
        reveal_custom: "#EC4899",
        base_track: "#A855F7", // Default purple matching the screenshot!
      };
    } catch {
      return {
        reveal_5_8: "#06B6D4",
        reveal_3_4: "#6366F1",
        reveal_custom: "#EC4899",
        base_track: "#A855F7",
      };
    }
  });
  const [clipsSpacing, setClipsSpacing] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("panelflow_clips_spacing");
      return saved ? parseInt(saved, 10) : 12;
    } catch {
      return 12;
    }
  });
  const [clipCalculationMethod, setClipCalculationMethod] = useState<"excel" | "spacing">("excel");

  // Local Storage persistence watchers
  useEffect(() => {
    try {
      localStorage.setItem("panelflow_panels", JSON.stringify(panels));
    } catch (e) {
      console.warn("Failed to save panels to localStorage:", e);
    }
  }, [panels]);

  useEffect(() => {
    try {
      localStorage.setItem("panelflow_accessory_lines", JSON.stringify(accessoryLines));
    } catch (e) {
      console.warn("Failed to save accessoryLines to localStorage:", e);
    }
  }, [accessoryLines]);

  useEffect(() => {
    try {
      localStorage.setItem("panelflow_accessory_colors", JSON.stringify(accessoryColors));
    } catch (e) {
      console.warn("Failed to save accessoryColors to localStorage:", e);
    }
  }, [accessoryColors]);

  useEffect(() => {
    try {
      localStorage.setItem("panelflow_reveal_widths", JSON.stringify(revealWidths));
    } catch (e) {
      console.warn("Failed to save revealWidths to localStorage:", e);
    }
  }, [revealWidths]);

  useEffect(() => {
    try {
      localStorage.setItem("panelflow_clips_spacing", clipsSpacing.toString());
    } catch (e) {
      console.warn("Failed to save clipsSpacing to localStorage:", e);
    }
  }, [clipsSpacing]);

  useEffect(() => {
    try {
      localStorage.setItem("panelflow_clip_calc_method", clipCalculationMethod);
    } catch (e) {
      console.warn("Failed to save clipCalculationMethod to localStorage:", e);
    }
  }, [clipCalculationMethod]);

  // Project Manager States & Saved Projects list
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState<boolean>(false);
  const [isDxfExportModalOpen, setIsDxfExportModalOpen] = useState<boolean>(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    try {
      const saved = localStorage.getItem("panelflow_saved_projects");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("panelflow_saved_projects", JSON.stringify(savedProjects));
    } catch (e) {
      console.warn("Failed to save savedProjects to localStorage:", e);
    }
  }, [savedProjects]);

  const handleSaveCurrentProject = (name: string, pNum: string, relNo: string) => {
    const finalName = name || projectName || "My Panel Project";
    setProjectName(finalName);
    if (pNum) setProjectNumber(pNum);
    if (relNo) setReleaseNo(relNo);

    const newProj: SavedProject = {
      id: `proj-${Date.now()}`,
      name: finalName,
      projectNumber: pNum || projectNumber,
      releaseNo: relNo || releaseNo,
      projectManager,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageName,
      imageUrl,
      dxfData,
      panels,
      accessoryLines,
      revealWidths,
      accessoryColors,
      clipsSpacing,
      clipCalculationMethod,
      referencePanel,
      prefix,
      startNumber,
      tolerance,
      sortBy,
      sortOrder,
      customGroupOrder,
      unit: referencePanel?.unit || "mm",
      masterListSettings,
    };

    setSavedProjects((prev) => {
      const existingIdx = prev.findIndex((p) => p.name.toLowerCase() === finalName.toLowerCase());
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...newProj, id: prev[existingIdx].id };
        return updated;
      } else {
        return [newProj, ...prev];
      }
    });
  };

  const handleLoadProject = (proj: SavedProject) => {
    if (proj.name) setProjectName(proj.name);
    if (proj.projectNumber !== undefined) setProjectNumber(proj.projectNumber);
    if (proj.releaseNo !== undefined) setReleaseNo(proj.releaseNo);
    if (proj.projectManager !== undefined) setProjectManager(proj.projectManager);
    if (proj.imageName !== undefined) setImageName(proj.imageName);
    if (proj.imageUrl !== undefined) setImageUrl(proj.imageUrl);
    if (proj.dxfData !== undefined) setDxfData(proj.dxfData);
    if (proj.panels) setPanels(proj.panels);
    if (proj.accessoryLines) setAccessoryLines(proj.accessoryLines);
    if (proj.revealWidths) setRevealWidths(proj.revealWidths);
    if (proj.accessoryColors) setAccessoryColors(proj.accessoryColors);
    if (proj.clipsSpacing !== undefined) setClipsSpacing(proj.clipsSpacing);
    if (proj.clipCalculationMethod !== undefined) setClipCalculationMethod(proj.clipCalculationMethod);
    if (proj.referencePanel) setScaleReferenceId(proj.referencePanel.id);
    if (proj.prefix !== undefined) setPrefix(proj.prefix);
    if (proj.startNumber !== undefined) setStartNumber(proj.startNumber);
    if (proj.tolerance !== undefined) setTolerance(proj.tolerance);
    if (proj.sortBy !== undefined) setSortBy(proj.sortBy);
    if (proj.sortOrder !== undefined) setSortOrder(proj.sortOrder);
    if (proj.customGroupOrder !== undefined) setCustomGroupOrder(proj.customGroupOrder);
    if (proj.masterListSettings) setMasterListSettings(proj.masterListSettings);
    // User request: always set due date as today
    setDueDate(getTodayDateString());
  };

  const handleDeleteProject = (id: string) => {
    setSavedProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDuplicateProject = (proj: SavedProject) => {
    const dup: SavedProject = {
      ...proj,
      id: `proj-${Date.now()}`,
      name: `${proj.name} (Copy)`,
      updatedAt: new Date().toISOString(),
    };
    setSavedProjects((prev) => [dup, ...prev]);
  };

  const handleStartNewJob = (skipAutoSave: boolean = false) => {
    // 1. Auto-save current work if there are panels or accessory lines
    if (!skipAutoSave && (panels.length > 0 || accessoryLines.length > 0)) {
      handleSaveCurrentProject(projectName || "Saved Project Progress", projectNumber, releaseNo);
    }

    // 2. Clear canvas and project state cleanly
    setPanels([]);
    setAccessoryLines([]);
    setImageUrl(null);
    setImageName("");
    setDxfData(null);
    setScaleReferenceId(null);
    setSelectedPanelId(null);
    setSelectedPanelIds(new Set());
    setSelectedLineId(null);
    setActiveAccessoryDrawMode(null);
    setDueDate(getTodayDateString());
    try {
      localStorage.removeItem("panelflow_accessory_lines");
      localStorage.removeItem("panelflow_panels");
    } catch {}

    // 3. Reset project details
    setProjectName("New Project");
    setProjectNumber("");
    setReleaseNo("Rev 01");
  };

  // Identify active scale reference panel (defaulting to the first panel if none is explicitly selected)
  const referencePanel = useMemo(() => {
    return panels.find((p) => p.id === scaleReferenceId) || (panels.length > 0 ? panels[0] : null);
  }, [panels, scaleReferenceId]);

  // Calculates physical length of drawn line on the canvas based on current scale
  const calculateLineMm = (x1: number, y1: number, x2: number, y2: number) => {
    if (dxfData && dxfData.bounds && typeof dxfData.bounds.width === "number" && dxfData.bounds.width > 0 && typeof dxfData.bounds.height === "number" && dxfData.bounds.height > 0) {
      const xMin = typeof dxfData.bounds.xMin === "number" && !isNaN(dxfData.bounds.xMin) ? dxfData.bounds.xMin : 0;
      const yMax = typeof dxfData.bounds.yMax === "number" && !isNaN(dxfData.bounds.yMax) ? dxfData.bounds.yMax : 0;
      const cadX1 = xMin + (x1 / 100) * dxfData.bounds.width;
      const cadY1 = yMax - (y1 / 100) * dxfData.bounds.height;
      const cadX2 = xMin + (x2 / 100) * dxfData.bounds.width;
      const cadY2 = yMax - (y2 / 100) * dxfData.bounds.height;
      const len = Math.round(Math.hypot(cadX2 - cadX1, cadY2 - cadY1));
      return isNaN(len) || !isFinite(len) ? 0 : len;
    } else if (referencePanel && referencePanel.width > 0 && referencePanel.height > 0 && !isNaN(referencePanel.realWidth) && !isNaN(referencePanel.realHeight)) {
      const scaleFactorX = referencePanel.realWidth / referencePanel.width;
      const scaleFactorY = referencePanel.realHeight / referencePanel.height;
      const dxReal = (x2 - x1) * scaleFactorX;
      const dyReal = (y2 - y1) * scaleFactorY;
      const len = Math.round(Math.hypot(dxReal, dyReal));
      return isNaN(len) || !isFinite(len) ? 0 : len;
    } else {
      const dx = (x2 - x1) * 10;
      const dy = (y2 - y1) * 10;
      const len = Math.round(Math.hypot(dx, dy));
      return isNaN(len) || !isFinite(len) ? 0 : len;
    }
  };

  // Memoized accessory lines with their current calculated lengths
  const accessoryLinesWithLengths = useMemo(() => {
    return accessoryLines.map((line) => {
      const length = calculateLineMm(line.x1, line.y1, line.x2, line.y2);
      return {
        ...line,
        realLength: length,
      };
    });
  }, [accessoryLines, dxfData, referencePanel]);

  const totalLengths = useMemo(() => {
    const init = {
      reveal_5_8: { mm: 0, lft: 0, pieces: 0 },
      reveal_3_4: { mm: 0, lft: 0, pieces: 0 },
      reveal_custom: { mm: 0, lft: 0, pieces: 0 },
      base_track: { mm: 0, lft: 0, pieces: 0 },
    };

    accessoryLinesWithLengths.forEach((line) => {
      const type = line.type;
      if (init[type]) {
        init[type].mm += line.realLength;
      }
    });

    // Compute LFT and pieces
    (Object.keys(init) as Array<keyof typeof init>).forEach((key) => {
      const mm = init[key].mm;
      const lft = mm / 304.8;
      // Round up LFT to the nearest multiple of 10, then divide by 10 to get 10ft pieces
      const pieces = Math.ceil(lft / 10);
      init[key].lft = lft;
      init[key].pieces = pieces;
    });

    return init;
  }, [accessoryLinesWithLengths]);

  const panelClipsCount = useMemo(() => {
    let count = 0;
    if (clipCalculationMethod === "excel") {
      panels.forEach((p) => {
        const w = p.realWidth;
        const h = p.realHeight;
        
        // =LET(W,E8,IF(W<=100,1,2+ROUNDUP((W-100)/600,0)))*[@Qty]
        const wClips = w <= 100 ? 1 : 2 + Math.ceil((w - 100) / 600);
        
        // =LET(H,F8,(IF(H<=100,1,2+ROUNDUP((H-100)/600,0)))*2)*[@Qty]
        const hClips = (h <= 100 ? 1 : 2 + Math.ceil((h - 100) / 600)) * 2;
        
        count += wClips + hClips;
      });
    } else {
      const spacing_mm = clipsSpacing * 25.4;
      panels.forEach((p) => {
        const topBottomClips = Math.max(2, Math.ceil(p.realWidth / spacing_mm) + 1);
        const leftRightClips = Math.max(2, Math.ceil(p.realHeight / spacing_mm) + 1);
        count += 2 * topBottomClips + 2 * leftRightClips;
      });
    }
    return count;
  }, [panels, clipsSpacing, clipCalculationMethod]);

  // Naming & Sequence Config State
  const [startNameInput, setStartNameInput] = useState<string>("A428");
  const [userManualStartNameInput, setUserManualStartNameInput] = useState<string>("A428");
  const [prefix, setPrefix] = useState<string>("A");
  const [startNumber, setStartNumber] = useState<number>(428);
  const [tolerance, setTolerance] = useState<number>(0); // e.g. ±0mm
  const [sortBy, setSortBy] = useState<"area" | "width" | "height" | "none">("area");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [customGroupOrder, setCustomGroupOrder] = useState<string[]>([]);
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  
  // Resizable Sidebar State (Default to 400px width)
  const [sidebarWidth, setSidebarWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isPackingListDetailsOpen, setIsPackingListDetailsOpen] = useState<boolean>(false);
  const [isLabelSettingsOpen, setIsLabelSettingsOpen] = useState<boolean>(false);
  
  // Project & Packing List State
  const [releaseNo, setReleaseNo] = useState<string>("08.Rev 02");
  const [projectName, setProjectName] = useState<string>("Block 22");
  const [projectNumber, setProjectNumber] = useState<string>("21.202589");
  const [projectManager, setProjectManager] = useState<string>("C.W");
  const [dueDate, setDueDate] = useState<string>(getTodayDateString);
  const [panelType, setPanelType] = useState<string>("Reynobond");
  const [panelColour, setPanelColour] = useState<string>("Bonewhite");

  // Synchronize custom group order keys when panels/tolerance changes
  useEffect(() => {
    const uniqueKeys: string[] = [];
    const tempGroups: { w: number; h: number; isSlotted: boolean }[] = [];

    panels.forEach((p) => {
      const pIsSlotted = Boolean(p.isSlotted);
      const isMatched = tempGroups.some(
        (g) =>
          Math.abs(g.w - p.realWidth) <= tolerance &&
          Math.abs(g.h - p.realHeight) <= tolerance &&
          g.isSlotted === pIsSlotted
      );
      if (!isMatched) {
        tempGroups.push({ w: p.realWidth, h: p.realHeight, isSlotted: pIsSlotted });
        uniqueKeys.push(`${p.realWidth}_${p.realHeight}_${pIsSlotted}`);
      }
    });

    setCustomGroupOrder((prev) => {
      // Filter out keys that are no longer present
      const activeKeys = prev.filter((k) => {
        const parts = k.split("_");
        const w = parseFloat(parts[0]);
        const h = parseFloat(parts[1]);
        const hasSlotInfo = parts.length > 2;
        const slotFlag = hasSlotInfo ? parts[2] === "true" : undefined;
        return tempGroups.some(
          (g) =>
            Math.abs(g.w - w) <= tolerance &&
            Math.abs(g.h - h) <= tolerance &&
            (slotFlag === undefined || g.isSlotted === slotFlag)
        );
      });

      // Add any missing keys
      const missingKeys = uniqueKeys.filter((uk) => {
        const parts = uk.split("_");
        const uW = parseFloat(parts[0]);
        const uH = parseFloat(parts[1]);
        const uSlot = parts[2] === "true";
        return !activeKeys.some((ak) => {
          const aParts = ak.split("_");
          const akW = parseFloat(aParts[0]);
          const akH = parseFloat(aParts[1]);
          const aHasSlot = aParts.length > 2;
          const akSlot = aHasSlot ? aParts[2] === "true" : undefined;
          return (
            Math.abs(akW - uW) <= tolerance &&
            Math.abs(akH - uH) <= tolerance &&
            (akSlot === undefined || akSlot === uSlot)
          );
        });
      });

      if (missingKeys.length > 0 || activeKeys.length !== prev.length) {
        return [...activeKeys, ...missingKeys];
      }
      return prev;
    });
  }, [panels, tolerance]);

  // Interaction State
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanToolActive, setIsPanToolActive] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  
  // CAD Experience states
  const [isCadDarkMode, setIsCadDarkMode] = useState<boolean>(true);
  const [cursorMm, setCursorMm] = useState<{ x: number; y: number } | null>(null);
  const dragDistanceRef = useRef<number>(0);
  const mouseDownClientRef = useRef<{ x: number; y: number } | null>(null);
  const [isTwoClickSelecting, setIsTwoClickSelecting] = useState<boolean>(false);

  // Area Selection & Sequential Naming State (Defaults to true for fluid CAD selection experience)
  const [isAreaSelectActive, setIsAreaSelectActive] = useState<boolean>(true);
  const [selectedAreaPanels, setSelectedAreaPanels] = useState<Panel[]>([]);
  const [showAreaNamingModal, setShowAreaNamingModal] = useState<boolean>(false);
  const [areaPrefix, setAreaPrefix] = useState<string>("B");
  const [areaStartNumber, setAreaStartNumber] = useState<number>(1);
  const [areaSortDir, setAreaSortDir] = useState<"vertical" | "horizontal">("vertical");
  const [areaNamingMode, setAreaNamingMode] = useState<"sequential" | "column-smart" | "global-grouped" | "row-sequential" | "row-smart">("row-smart");

  // Zoom Extent (Fit to Screen) - Automatically fits and centers the entire drawing & all panels within view
  const handleZoomExtent = () => {
    const viewport = document.getElementById("drawing-canvas-viewport");
    if (!viewport) return;
    const vRect = viewport.getBoundingClientRect();
    if (!vRect || vRect.width <= 0 || vRect.height <= 0) return;

    const margin = 48; // comfortable padding around the layout
    const availW = Math.max(100, vRect.width - margin * 2);
    const availH = Math.max(100, vRect.height - margin * 2);

    const baseW = 1000;
    let aspect = 16 / 9;
    if (dxfData && dxfData.bounds && dxfData.bounds.width > 0 && dxfData.bounds.height > 0) {
      aspect = dxfData.bounds.width / dxfData.bounds.height;
    } else if (imageUrl && imageAspectRatio > 0) {
      aspect = imageAspectRatio;
    }

    const baseH = baseW / Math.max(0.0001, aspect);

    const scaleX = availW / baseW;
    const scaleY = availH / baseH;
    const targetZoom = Math.max(0.001, Math.min(3.0, Math.min(scaleX, scaleY)));

    // Since drawing-canvas-viewport uses flex items-center justify-center,
    // the unscaled container is initially centered at (vRect.width - baseW)/2, (vRect.height - baseH)/2.
    // To position the scaled container's center exactly at the viewport's center:
    const targetPanX = (baseW / 2) * (1 - targetZoom);
    const targetPanY = (baseH / 2) * (1 - targetZoom);

    setZoomLevel(targetZoom);
    setPanOffset({ x: targetPanX, y: targetPanY });
  };

  // Handle sidebar resize dragging
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Sidebar is on the right, so dragging left (smaller e.clientX) increases width
      const newWidth = window.innerWidth - e.clientX;
      // Boundaries: min 300px, max 80% of screen width
      if (newWidth > 280 && newWidth < window.innerWidth * 0.8) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Create refs to avoid stale closures in window event listeners
  const selectedPanelIdsRef = useRef(selectedPanelIds);
  selectedPanelIdsRef.current = selectedPanelIds;
  const selectedPanelIdRef = useRef(selectedPanelId);
  selectedPanelIdRef.current = selectedPanelId;
  const selectedLineIdRef = useRef(selectedLineId);
  selectedLineIdRef.current = selectedLineId;

  // Spacebar, Escape, and Delete key tracking for CAD Experience
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputField = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.getAttribute("contenteditable") === "true"
      );

      if (isInputField) return;

      if (e.code === "Space") {
        setIsSpacePressed(true);
        e.preventDefault();
      }

      // Z key triggers Zoom Extent in CAD
      if ((e.key === "z" || e.key === "Z") && !e.ctrlKey && !e.metaKey) {
        handleZoomExtent();
      }

      // Escape key clears drawing/selection in CAD
      if (e.key === "Escape") {
        setSelectedPanelIds(new Set());
        setSelectedPanelId(null);
        setSelectedLineId(null);
        setActiveAccessoryDrawMode(null);
        setIsDrawing(false);
        setIsTwoClickSelecting(false);
        setDrawStart(null);
        setDrawCurrent(null);
        setTempRect(null);
        setIsPanning(false);
        setSystemMessage({ text: "Selection and drawing modes cleared.", type: "info" });
      }

      // Delete/Backspace key deletes the selected panels or accessory lines in CAD
      if (e.key === "Delete" || e.key === "Backspace") {
        const currentSelectedIds = selectedPanelIdsRef.current;
        const currentSelectedId = selectedPanelIdRef.current;
        const currentSelectedLineId = selectedLineIdRef.current;

        if (currentSelectedLineId) {
          setAccessoryLines((prev) => prev.filter((l) => l.id !== currentSelectedLineId));
          setSelectedLineId(null);
          setSystemMessage({ text: "Accessory line deleted.", type: "success" });
        } else if (currentSelectedIds.size > 0) {
          setPanels((prev) => prev.filter((p) => !currentSelectedIds.has(p.id)));
          setSelectedPanelIds(new Set());
          setSelectedPanelId(null);
          setSystemMessage({ text: `Deleted ${currentSelectedIds.size} panels.`, type: "success" });
        } else if (currentSelectedId) {
          setPanels((prev) => prev.filter((p) => p.id !== currentSelectedId));
          setSelectedPanelId(null);
          setSystemMessage({ text: "Panel deleted.", type: "success" });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Scroll wheel zoom effect on drawing viewport (zooms centered on the mouse cursor like CAD)
  useEffect(() => {
    const viewport = document.getElementById("drawing-canvas-viewport");
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      // Only capture scroll zoom if there is an image or dxf loaded
      if (!imageUrl && !dxfData) return;
      e.preventDefault();
      
      const container = workspaceRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      setZoomLevel((prevZoom) => {
        // CAD zoom zooms exponentially for smooth navigation across massive and tiny scales
        const zoomMultiplier = 1.15;
        const nextZoom = Math.max(0.001, Math.min(20.0, e.deltaY < 0 ? prevZoom * zoomMultiplier : prevZoom / zoomMultiplier));
        
        const ratio = nextZoom / prevZoom;

        // Shift panOffset based on exact screen distance to the workspace's top-left
        setPanOffset((prevPan) => {
          return {
            x: prevPan.x + (e.clientX - containerRect.left) * (1 - ratio),
            y: prevPan.y + (e.clientY - containerRect.top) * (1 - ratio)
          };
        });

        return nextZoom;
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [imageUrl, dxfData]);
  const [editPanelId, setEditPanelId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"packing" | "master" | "accessories" | "groups" | "panels">("packing");
  const [packingListViewMode, setPackingListViewMode] = useState<"groups" | "individual">("groups");
  const [packingListSearch, setPackingListSearch] = useState<string>("");
  const [masterListSettings, setMasterListSettings] = useState<MasterListSettings>(DEFAULT_MASTER_LIST_SETTINGS);
  const [isMasterListSettingsOpen, setIsMasterListSettingsOpen] = useState<boolean>(false);
  const [masterListFilter, setMasterListFilter] = useState<"all" | "slotted" | "standard" | "stiffener">("all");
  const [masterListSearch, setMasterListSearch] = useState<string>("");
  const [draggedPanelIndex, setDraggedPanelIndex] = useState<number | null>(null);

  // Auto-generate reveals (deduplicated horizontal and vertical panel joints)
  const autoGenerateReveals = () => {
    if (panels.length === 0) {
      setSystemMessage({ text: "No panels drawn yet to generate joints from.", type: "error" });
      return;
    }
    const newLines: AccessoryLine[] = [];
    panels.forEach((p) => {
      const segments = [
        { x1: p.x, y1: p.y, x2: p.x + p.width, y2: p.y }, // Top
        { x1: p.x, y1: p.y + p.height, x2: p.x + p.width, y2: p.y + p.height }, // Bottom
        { x1: p.x, y1: p.y, x2: p.x, y2: p.y + p.height }, // Left
        { x1: p.x + p.width, y1: p.y, x2: p.x + p.width, y2: p.y + p.height }, // Right
      ];

      segments.forEach((seg) => {
        const isDuplicate = newLines.some((existing) => {
          const isHoriz1 = Math.abs(seg.y1 - seg.y2) < 0.1;
          const isHoriz2 = Math.abs(existing.y1 - existing.y2) < 0.1;
          if (isHoriz1 && isHoriz2) {
            if (Math.abs(seg.y1 - existing.y1) < 2.0) {
              const minS = Math.min(seg.x1, seg.x2);
              const maxS = Math.max(seg.x1, seg.x2);
              const minE = Math.min(existing.x1, existing.x2);
              const maxE = Math.max(existing.x1, existing.x2);
              return minS <= maxE + 1.0 && maxS >= minE - 1.0;
            }
          }
          const isVert1 = Math.abs(seg.x1 - seg.x2) < 0.1;
          const isVert2 = Math.abs(existing.x1 - existing.x2) < 0.1;
          if (isVert1 && isVert2) {
            if (Math.abs(seg.x1 - existing.x1) < 2.0) {
              const minS = Math.min(seg.y1, seg.y2);
              const maxS = Math.max(seg.y1, seg.y2);
              const minE = Math.min(existing.y1, existing.y2);
              const maxE = Math.max(existing.y1, existing.y2);
              return minS <= maxE + 1.0 && maxS >= minE - 1.0;
            }
          }
          return false;
        });

        if (!isDuplicate) {
          newLines.push({
            id: `auto-rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            x1: parseFloat((seg.x1 ?? 0).toFixed(3)),
            y1: parseFloat((seg.y1 ?? 0).toFixed(3)),
            x2: parseFloat((seg.x2 ?? 0).toFixed(3)),
            y2: parseFloat((seg.y2 ?? 0).toFixed(3)),
            type: "reveal_5_8",
          });
        }
      });
    });

    setAccessoryLines((prev) => [...prev, ...newLines]);
    setSystemMessage({
      text: `Auto-generated ${newLines.length} joint reveals (with duplication filtering) from active layout panels!`,
      type: "success",
    });
  };

  // Auto-generate base tracks under the bottom edges of panels that don't overlap vertically
  const autoGenerateBaseTracks = () => {
    if (panels.length === 0) {
      setSystemMessage({ text: "No panels drawn yet to generate base tracks from.", type: "error" });
      return;
    }
    const newLines: AccessoryLine[] = [];
    panels.forEach((p) => {
      // Draw a base track on the bottom edge of the panel
      newLines.push({
        id: `auto-bt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        x1: parseFloat((p.x ?? 0).toFixed(3)),
        y1: parseFloat(((p.y ?? 0) + (p.height ?? 0)).toFixed(3)),
        x2: parseFloat(((p.x ?? 0) + (p.width ?? 0)).toFixed(3)),
        y2: parseFloat(((p.y ?? 0) + (p.height ?? 0)).toFixed(3)),
        type: "base_track",
      });
    });

    setAccessoryLines((prev) => [...prev, ...newLines]);
    setSystemMessage({
      text: `Auto-generated ${newLines.length} base track lines along the bottom flanges of all panels!`,
      type: "success",
    });
  };

  const clearAllAccessories = () => {
    setAccessoryLines([]);
    setSelectedLineId(null);
    setSystemMessage({ text: "All custom accessory lines cleared.", type: "info" });
  };

  // New manual panel specifications modal/popover state
  const [showManualSpecModal, setShowManualSpecModal] = useState<boolean>(false);
  const [tempRect, setTempRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [newWidth, setNewWidth] = useState<number>(1200);
  const [newHeight, setNewHeight] = useState<number>(600);
  const [newUnit, setNewUnit] = useState<string>("mm");

  // Form states for modifying an existing panel
  const [modWidth, setModWidth] = useState<number>(1200);
  const [modHeight, setModHeight] = useState<number>(600);
  const [modUnit, setModUnit] = useState<string>("mm");
  const [modCustomLabel, setModCustomLabel] = useState<string>("");
  const [modIsSlotted, setModIsSlotted] = useState<boolean>(false);

  // Parse start label e.g., "A428" -> Prefix "A", Number "428"
  useEffect(() => {
    const match = startNameInput.match(/^([a-zA-Z_-]*?)(\d+)$/);
    if (match) {
      setPrefix(match[1] || "");
      setStartNumber(parseInt(match[2], 10));
    } else {
      setPrefix(startNameInput);
      setStartNumber(1);
    }
  }, [startNameInput]);

  // Helper to compare Set values without relying on reference equality
  const areSetsEqual = (setA: Set<string>, setB: Set<string>) => {
    if (setA.size !== setB.size) return false;
    for (const elem of setA) {
      if (!setB.has(elem)) return false;
    }
    return true;
  };

  // Synchronize selectedPanelId and selectedPanelIds cleanly using ref-guard to prevent infinite re-render loops
  useEffect(() => {
    const idChanged = selectedPanelId !== prevSyncPanelIdRef.current;
    const idsChanged = !areSetsEqual(selectedPanelIds, prevSyncPanelIdsRef.current);

    if (idChanged && !idsChanged) {
      // selectedPanelId was explicitly changed
      if (selectedPanelId) {
        if (!selectedPanelIds.has(selectedPanelId)) {
          setSelectedPanelIds(new Set([selectedPanelId]));
        }
      } else {
        if (selectedPanelIds.size === 1) {
          setSelectedPanelIds(new Set());
        }
      }
    } else if (idsChanged && !idChanged) {
      // selectedPanelIds was explicitly changed
      if (selectedPanelIds.size === 1) {
        const firstId = Array.from(selectedPanelIds)[0];
        if (selectedPanelId !== firstId) {
          setSelectedPanelId(firstId);
        }
      } else if (selectedPanelIds.size === 0) {
        if (selectedPanelId !== null) {
          setSelectedPanelId(null);
        }
      }
    }

    prevSyncPanelIdRef.current = selectedPanelId;
    prevSyncPanelIdsRef.current = new Set(selectedPanelIds);
  }, [selectedPanelId, selectedPanelIds]);

  // Dynamically calculate labeled panels and unique groups with useMemo to prevent unnecessary calculations and reference changes
  const { labeledPanels, groups } = useMemo(() => {
    const rule: NamingRule = {
      prefix,
      startNumber,
      tolerance,
      sortBy,
      sortOrder,
    };
    return groupAndLabelPanels(panels, rule, customGroupOrder);
  }, [panels, prefix, startNumber, tolerance, sortBy, sortOrder, customGroupOrder]);

  const namingRule = useMemo<NamingRule>(() => ({
    prefix,
    startNumber,
    tolerance,
    sortBy,
    sortOrder,
  }), [prefix, startNumber, tolerance, sortBy, sortOrder]);

  // Helper to retrieve color assignment for a group label
  const getGroupColor = (label: string | undefined) => {
    if (!label) return GROUP_COLORS[0];
    const idx = groups.findIndex((g) => g.label === label);
    if (idx === -1) {
      // Fallback: try finding by looking at panels
      const panel = labeledPanels.find((p) => p.label === label);
      if (panel) {
        const foundIdx = groups.findIndex((g) => g.panels.some((gp) => gp.id === panel.id));
        if (foundIdx !== -1) return GROUP_COLORS[foundIdx % GROUP_COLORS.length];
      }
      return GROUP_COLORS[0];
    }
    return GROUP_COLORS[idx % GROUP_COLORS.length];
  };

  // Auto-fill form values when selecting a panel
  useEffect(() => {
    if (selectedPanelId && selectedPanelId !== lastAutoFillPanelIdRef.current) {
      const panel = labeledPanels.find((p) => p.id === selectedPanelId);
      if (panel) {
        setModWidth(panel.realWidth);
        setModHeight(panel.realHeight);
        setModUnit(panel.unit || "mm");
        setModCustomLabel(panel.customLabel || "");
        setModIsSlotted(Boolean(panel.isSlotted));
        lastAutoFillPanelIdRef.current = selectedPanelId;
      }
    } else if (!selectedPanelId) {
      lastAutoFillPanelIdRef.current = null;
    }
  }, [selectedPanelId, labeledPanels]);

  // Process and load any supported file (DXF, PDF, Image, or Excel)
  const processUploadedFile = async (file: File) => {
    setImageName(file.name);
    setIsProcessing(true);
    setSystemMessage({ text: `Loading file: ${file.name}...`, type: "info" });
    setDueDate(getTodayDateString());

    // Cleanly clear existing panels, accessories, and selections when a file is uploaded
    // (Never draw accessories on an uploaded file until the user draws them manually)
    setPanels([]);
    setAccessoryLines([]);
    setSelectedLineId(null);
    setSelectedPanelId(null);
    setSelectedPanelIds(new Set());
    setActiveAccessoryDrawMode(null);
    try {
      localStorage.removeItem("panelflow_accessory_lines");
      localStorage.removeItem("panelflow_panels");
    } catch {}

    try {
      if (file.name.toLowerCase().endsWith(".dxf")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const dxfText = event.target?.result as string;
            const parser = new DxfParser();
            const parsedDxf = parser.parseSync(dxfText);

            if (!parsedDxf || !parsedDxf.entities) {
              throw new Error("No entities found in DXF file.");
            }

            // Gather coordinate coordinates
            const xCoords: number[] = [];
            const yCoords: number[] = [];

            parsedDxf.entities.forEach((entity: any) => {
              if (entity.vertices && entity.vertices.length > 0) {
                entity.vertices.forEach((v: any) => {
                  xCoords.push(v.x);
                  yCoords.push(v.y);
                });
              } else if (entity.type === "CIRCLE" || entity.type === "ARC") {
                const cx = entity.center?.x ?? 0;
                const cy = entity.center?.y ?? 0;
                const r = entity.radius ?? 0;
                xCoords.push(cx - r, cx + r);
                yCoords.push(cy - r, cy + r);
              } else if (entity.position) {
                xCoords.push(entity.position.x);
                yCoords.push(entity.position.y);
              }
            });

            if (xCoords.length === 0) {
              throw new Error("No coordinate data found in DXF file.");
            }

            const xMin = Math.min(...xCoords);
            const xMax = Math.max(...xCoords);
            const yMin = Math.min(...yCoords);
            const yMax = Math.max(...yCoords);
            const width = xMax - xMin;
            const height = yMax - yMin;

            if (width === 0 || height === 0) {
              throw new Error("DXF drawing has empty dimensions.");
            }

            // Detect closed polygon candidates (usually LWPOLYLINE or POLYLINE)
            const rawCandidates: any[] = [];
            parsedDxf.entities.forEach((entity: any) => {
              if (
                (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") &&
                entity.vertices &&
                entity.vertices.length >= 3
              ) {
                const isClosed =
                  entity.shape === true ||
                  Math.hypot(
                    entity.vertices[0].x - entity.vertices[entity.vertices.length - 1].x,
                    entity.vertices[0].y - entity.vertices[entity.vertices.length - 1].y
                  ) < (width * 0.005);

                if (isClosed) {
                  const xs = entity.vertices.map((v: any) => v.x);
                  const ys = entity.vertices.map((v: any) => v.y);
                  const minX = Math.min(...xs);
                  const maxX = Math.max(...xs);
                  const minY = Math.min(...ys);
                  const maxY = Math.max(...ys);
                  const candW = maxX - minX;
                  const candH = maxY - minY;

                  if (candW >= 50 && candH >= 50) {
                    rawCandidates.push({
                      minX,
                      maxX,
                      minY,
                      maxY,
                      w_cad: candW,
                      h_cad: candH,
                      vertices: entity.vertices,
                    });
                  }
                }
              }
            });

            // Deduplicate matching candidates
            const candidates: any[] = [];
            rawCandidates.forEach((raw) => {
              const isDup = candidates.some(
                (c) =>
                  Math.abs(c.xMin - raw.minX) < (width * 0.005) &&
                  Math.abs(c.xMax - raw.maxX) < (width * 0.005) &&
                  Math.abs(c.yMin - raw.minY) < (height * 0.005) &&
                  Math.abs(c.yMax - raw.maxY) < (height * 0.005)
              );

              if (!isDup) {
                candidates.push({
                  id: `dxf-candidate-${candidates.length}-${Date.now()}`,
                  xMin: raw.minX,
                  xMax: raw.maxX,
                  yMin: raw.minY,
                  yMax: raw.maxY,
                  width: raw.w_cad,
                  height: raw.h_cad,
                  points: raw.vertices,
                });
              }
            });

            // Set state for DXF
            setImageUrl(null);
            setOriginalDxfText(dxfText);
            setDxfData({
              fileName: file.name,
              entities: parsedDxf.entities,
              bounds: { xMin, xMax, yMin, yMax, width, height },
              candidates,
            });

            setPanels([]);
            setAccessoryLines([]);
            setSelectedLineId(null);
            setIsProcessing(false);
            setSystemMessage({
              text: `Successfully parsed DXF file! Found ${parsedDxf.entities.length} vector elements and ${candidates.length} candidate panels. Click "Auto-Detect Panels" or toggle them individually on the drawing canvas!`,
              type: "success",
            });
            setTimeout(() => {
              handleZoomExtent();
            }, 80);
          } catch (err: any) {
            console.error(err);
            setSystemMessage({ text: `Failed to parse DXF: ${err.message}`, type: "error" });
            setIsProcessing(false);
          }
        };
        reader.readAsText(file);
      } else if (file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls") || file.name.toLowerCase().endsWith(".csv")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const buffer = event.target?.result as ArrayBuffer;
            const parsed = parseExcelPackingList(buffer);
            setPanels(parsed.panels);
            setAccessoryLines([]);
            setSelectedLineId(null);
            if (parsed.projectInfo.projectName) setProjectName(parsed.projectInfo.projectName);
            if (parsed.projectInfo.projectNumber) setProjectNumber(parsed.projectInfo.projectNumber);
            if (parsed.projectInfo.releaseNo) setReleaseNo(parsed.projectInfo.releaseNo);
            if (parsed.projectInfo.projectManager) setProjectManager(parsed.projectInfo.projectManager);
            setDueDate(getTodayDateString());
            if (parsed.projectInfo.panelType) setPanelType(parsed.projectInfo.panelType);
            if (parsed.projectInfo.panelColour) setPanelColour(parsed.projectInfo.panelColour);
            setDxfData(null);
            setSystemMessage({
              text: `Successfully imported ${parsed.totalPanelsCount} panels (${parsed.groupsCount} size groups) from Excel packing list "${file.name}"!`,
              type: "success"
            });
            setIsProcessing(false);
          } catch (err: any) {
            console.error(err);
            setSystemMessage({ text: `Failed to import Excel file: ${err.message}`, type: "error" });
            setIsProcessing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        await renderPdfPage(file);
        setDxfData(null);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const resultUrl = event.target.result as string;
            setImageUrl(resultUrl);
            setDxfData(null);
            setSystemMessage({
              text: `Loaded image successfully! Ready to run auto-detection or add manual labels.`,
              type: "success"
            });
            setPanels([]);
            setAccessoryLines([]);
            setSelectedLineId(null);
            setIsProcessing(false);
            const img = new Image();
            img.onload = () => {
              if (img.naturalWidth && img.naturalHeight) {
                setImageAspectRatio(img.naturalWidth / img.naturalHeight);
              }
              setTimeout(() => {
                handleZoomExtent();
              }, 80);
            };
            img.src = resultUrl;
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.error(err);
      setSystemMessage({ text: `Failed to load file. Error: ${err.message}`, type: "error" });
      setIsProcessing(false);
    }
  };

  // Handle PDF, Image or DXF Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processUploadedFile(files[0]);
    if (e.target) e.target.value = "";
  };

  // Dedicated handler for importing Excel/CSV packing list directly
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsProcessing(true);
    setSystemMessage({ text: `Importing packing list from ${file.name}...`, type: "info" });

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsed = parseExcelPackingList(buffer);
        setPanels(parsed.panels);
        setAccessoryLines([]);
        setSelectedLineId(null);
        if (parsed.projectInfo.projectName) setProjectName(parsed.projectInfo.projectName);
        if (parsed.projectInfo.projectNumber) setProjectNumber(parsed.projectInfo.projectNumber);
        if (parsed.projectInfo.releaseNo) setReleaseNo(parsed.projectInfo.releaseNo);
        if (parsed.projectInfo.projectManager) setProjectManager(parsed.projectInfo.projectManager);
        setDueDate(getTodayDateString());
        if (parsed.projectInfo.panelType) setPanelType(parsed.projectInfo.panelType);
        if (parsed.projectInfo.panelColour) setPanelColour(parsed.projectInfo.panelColour);
        setSystemMessage({
          text: `Successfully imported ${parsed.totalPanelsCount} panels (${parsed.groupsCount} size groups) from "${file.name}"!`,
          type: "success"
        });
        setIsProcessing(false);
      } catch (err: any) {
        console.error(err);
        setSystemMessage({ text: `Failed to import Excel packing list: ${err.message}`, type: "error" });
        setIsProcessing(false);
      }
      if (e.target) e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  // Convert PDF first page to Base64 image via client PDF.js
  const renderPdfPage = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = function () {
        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) {
          reject(new Error("PDF.js library is not ready. Please try again."));
          return;
        }

        pdfjsLib.getDocument(typedarray).promise.then((pdf: any) => {
          // Fetch the first page
          pdf.getPage(1).then((page: any) => {
            const viewport = page.getViewport({ scale: 2.0 }); // High res scaling
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };

            page.render(renderContext).promise.then(() => {
              const imgDataUrl = canvas.toDataURL("image/png");
              setImageUrl(imgDataUrl);
              setImageAspectRatio(viewport.width / viewport.height);
              setPanels([]); // clear previous
              setAccessoryLines([]); // clear previous accessories
              setSelectedLineId(null);
              setSystemMessage({
                text: "PDF page rendered successfully! Ready to run auto-detection or define panels.",
                type: "success",
              });
              setIsProcessing(false);
              setTimeout(() => {
                handleZoomExtent();
              }, 80);
              resolve();
            });
          });
        }).catch((err: any) => {
          reject(err);
        });
      };
      fileReader.readAsArrayBuffer(file);
    });
  };

  // Run auto-labeling via server proxy call to Gemini
  const runAutoDetection = async () => {
    if (!imageUrl) {
      setSystemMessage({ text: "Please upload an elevation PDF or image layout first.", type: "error" });
      return;
    }

    setIsProcessing(true);
    setSystemMessage({ text: "Analyzing elevation layout with Gemini to auto-detect panel bounds and dimensions...", type: "info" });

    try {
      const response = await fetch("/api/detect-panels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageUrl,
          mimeType: "image/png"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.details || "Failed response from server");
      }

      const result = await response.json();
      if (result.panels && Array.isArray(result.panels)) {
        const formattedPanels: Panel[] = result.panels.map((p: any, idx: number) => ({
          id: `p-${Date.now()}-${idx}`,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          realWidth: p.realWidth || 1000,
          realHeight: p.realHeight || 500,
          unit: p.unit || "mm"
        }));

        setPanels(formattedPanels);
        setSystemMessage({
          text: `Auto-labeled ${formattedPanels.length} panels! Grouped and serialized sequentially using start label ${startNameInput}.`,
          type: "success"
        });
      } else {
        setSystemMessage({ text: "No panels were detected. You can draw them manually.", type: "error" });
      }
    } catch (err: any) {
      console.error(err);
      setSystemMessage({
        text: `Auto-labeling failed: ${err.message}. To test the full sequential labeling and grouping engine immediately without configuring an API key, you can click the "Simulate Demo" button.`,
        type: "error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Simulate auto-detection of rectangular panels for quick demo
  const simulateAutoDetection = () => {
    setIsProcessing(true);
    setSystemMessage({ text: "Simulating elevation panel layout scanning and label extraction...", type: "info" });
    
    setTimeout(() => {
      // Create a set of realistic elevation panels matching typical drawing shapes
      const simulated: Panel[] = [
        { id: `sim-${Date.now()}-1`, x: 10, y: 15, width: 22, height: 32, realWidth: 1200, realHeight: 600, unit: "mm" },
        { id: `sim-${Date.now()}-2`, x: 34, y: 15, width: 22, height: 32, realWidth: 1200, realHeight: 600, unit: "mm" },
        { id: `sim-${Date.now()}-3`, x: 58, y: 15, width: 22, height: 32, realWidth: 1200, realHeight: 600, unit: "mm" },
        { id: `sim-${Date.now()}-4`, x: 10, y: 52, width: 15, height: 35, realWidth: 800, realHeight: 700, unit: "mm" },
        { id: `sim-${Date.now()}-5`, x: 27, y: 52, width: 15, height: 35, realWidth: 800, realHeight: 700, unit: "mm" },
        { id: `sim-${Date.now()}-6`, x: 44, y: 52, width: 15, height: 35, realWidth: 800, realHeight: 700, unit: "mm" },
        { id: `sim-${Date.now()}-7`, x: 61, y: 52, width: 28, height: 35, realWidth: 1500, realHeight: 700, unit: "mm" },
      ];
      
      setPanels(simulated);
      setSystemMessage({
        text: `Demo scan complete! Mapped ${simulated.length} panels into distinct identical physical size groups. Serialized sequentially from ${startNameInput}.`,
        type: "success"
      });
      setIsProcessing(false);
    }, 1000);
  };

  // Compute which DXF candidates are active panels based on current canvas panels
  const activeCandidateIds = React.useMemo(() => {
    const active = new Set<string>();
    if (!dxfData) return active;

    dxfData.candidates.forEach((cand: any) => {
      const candX = ((cand.xMin - dxfData.bounds.xMin) / dxfData.bounds.width) * 100;
      const candY = ((dxfData.bounds.yMax - cand.yMax) / dxfData.bounds.height) * 100;

      const exists = panels.some((p) => 
        Math.abs(p.x - candX) < 0.5 && 
        Math.abs(p.y - candY) < 0.5
      );
      if (exists) {
        active.add(cand.id);
      }
    });

    return active;
  }, [dxfData, panels]);

  // Compute real-time drag-selection intersecting panel IDs to provide instant CAD highlight
  const intersectingPanelIds = React.useMemo(() => {
    if (!isAreaSelectActive || !isDrawing || !drawStart || !drawCurrent) {
      return new Set<string>();
    }
    const x1 = Math.min(drawStart.x, drawCurrent.x);
    const y1 = Math.min(drawStart.y, drawCurrent.y);
    const w = Math.abs(drawStart.x - drawCurrent.x);
    const h = Math.abs(drawStart.y - drawCurrent.y);
    const isLtr = drawStart.x <= drawCurrent.x;

    const set = new Set<string>();
    panels.forEach((p) => {
      let isSelected = false;
      if (isLtr) {
        // Window selection: panel must be completely within the selection box
        isSelected = (
          p.x >= x1 &&
          p.x + p.width <= x1 + w &&
          p.y >= y1 &&
          p.y + p.height <= y1 + h
        );
      } else {
        // Crossing selection: panel intersects/overlaps with the selection box
        isSelected = (
          p.x <= x1 + w &&
          p.x + p.width >= x1 &&
          p.y <= y1 + h &&
          p.y + p.height >= y1
        );
      }
      if (isSelected) {
        set.add(p.id);
      }
    });
    return set;
  }, [isAreaSelectActive, isDrawing, drawStart, drawCurrent, panels]);

  // Toggle a single DXF candidate box
  const toggleDxfCandidate = (candidate: any) => {
    if (!dxfData || !showPanelLayout || activeAccessoryDrawMode) return;

    const candX = ((candidate.xMin - dxfData.bounds.xMin) / dxfData.bounds.width) * 100;
    const candY = ((dxfData.bounds.yMax - candidate.yMax) / dxfData.bounds.height) * 100;

    const existingIndex = panels.findIndex((p) => 
      Math.abs(p.x - candX) < 0.5 && 
      Math.abs(p.y - candY) < 0.5
    );

    if (existingIndex > -1) {
      const updated = [...panels];
      updated.splice(existingIndex, 1);
      setPanels(updated);
      setSystemMessage({
        text: `Removed panel (${Math.round(candidate.width)} x ${Math.round(candidate.height)}) from sequence list.`,
        type: "info",
      });
    } else {
      const newPanel: Panel = {
        id: `dxf-single-${Date.now()}`,
        x: parseFloat((candX ?? 0).toFixed(3)),
        y: parseFloat((candY ?? 0).toFixed(3)),
        width: parseFloat((((candidate.width || 0) / (dxfData.bounds.width || 1)) * 100).toFixed(3)),
        height: parseFloat((((candidate.height || 0) / (dxfData.bounds.height || 1)) * 100).toFixed(3)),
        realWidth: Math.round(candidate.width),
        realHeight: Math.round(candidate.height),
        unit: "mm",
      };
      setPanels((prev) => [...prev, newPanel]);
      setSystemMessage({
        text: `Added panel (${newPanel.realWidth} x ${newPanel.realHeight} mm) from DXF vector coordinate.`,
        type: "success",
      });
    }
  };

  // Import all candidates at once
  const importDxfPanels = () => {
    if (!dxfData || dxfData.candidates.length === 0) {
      setSystemMessage({ text: "No candidate panels found in this DXF file.", type: "error" });
      return;
    }

    const imported = dxfData.candidates.map((c: any, index: number) => {
      const x = ((c.xMin - dxfData.bounds.xMin) / dxfData.bounds.width) * 100;
      const y = ((dxfData.bounds.yMax - c.yMax) / dxfData.bounds.height) * 100;
      const w = (c.width / dxfData.bounds.width) * 100;
      const h = (c.height / dxfData.bounds.height) * 100;

      return {
        id: `dxf-${index}-${Date.now()}`,
        x: parseFloat((x ?? 0).toFixed(3)),
        y: parseFloat((y ?? 0).toFixed(3)),
        width: parseFloat((w ?? 0).toFixed(3)),
        height: parseFloat((h ?? 0).toFixed(3)),
        realWidth: Math.round(c.width),
        realHeight: Math.round(c.height),
        unit: "mm",
      };
    });

    setPanels(imported);
    setSystemMessage({
      text: `Instantly imported ${imported.length} physical panels from DXF layout geometry with exact CAD scale!`,
      type: "success",
    });
  };

  // Helper to snap cursor percentages to the nearest DXF vertex
  const snapToDxfVertex = (xPct: number, yPct: number) => {
    if (!dxfData) return { x: xPct, y: yPct };

    const cadX = dxfData.bounds.xMin + (xPct / 100) * dxfData.bounds.width;
    const cadY = dxfData.bounds.yMax - (yPct / 100) * dxfData.bounds.height;

    // Snapping tolerance (approx 2.5% of drawing width)
    const toleranceValue = dxfData.bounds.width * 0.025;

    let closestVertex: { x: number; y: number } | null = null;
    let minDistance = Infinity;

    dxfData.entities.forEach((entity: any) => {
      if (entity.vertices && entity.vertices.length > 0) {
        entity.vertices.forEach((v: any) => {
          const dist = Math.hypot(v.x - cadX, v.y - cadY);
          if (dist < minDistance && dist < toleranceValue) {
            minDistance = dist;
            closestVertex = v;
          }
        });
      }
    });

    if (closestVertex) {
      const snappedX_pct = ((closestVertex.x - dxfData.bounds.xMin) / dxfData.bounds.width) * 100;
      const snappedY_pct = ((dxfData.bounds.yMax - closestVertex.y) / dxfData.bounds.height) * 100;
      return { x: snappedX_pct, y: snappedY_pct };
    }

    return { x: xPct, y: yPct };
  };

  // Helper to snap to both DXF vertices AND existing panels' corners/edges
  const snapToElements = (xPct: number, yPct: number) => {
    if (!isObjectSnapActive) {
      return { x: xPct, y: yPct };
    }

    // 1. If DXF data is loaded, try snapping to CAD vertices first (within a 2.5% tolerance)
    if (dxfData) {
      const snappedDxf = snapToDxfVertex(xPct, yPct);
      if (snappedDxf.x !== xPct || snappedDxf.y !== yPct) {
        return snappedDxf;
      }
    }

    // 2. Otherwise/also snap to existing Panels' edges and corners
    // Snapping tolerance (in percentage points, e.g. 1.2% of viewport width/height)
    const thresholdX = 1.2;
    const thresholdY = 1.2;
    let bestX = xPct;
    let bestY = yPct;
    let minDistanceX = thresholdX;
    let minDistanceY = thresholdY;

    panels.forEach((p) => {
      const left = p.x;
      const right = p.x + p.width;
      const top = p.y;
      const bottom = p.y + p.height;

      // Check vertical alignments (X coordinates)
      const distLeft = Math.abs(xPct - left);
      if (distLeft < minDistanceX) {
        minDistanceX = distLeft;
        bestX = left;
      }
      const distRight = Math.abs(xPct - right);
      if (distRight < minDistanceX) {
        minDistanceX = distRight;
        bestX = right;
      }

      // Check horizontal alignments (Y coordinates)
      const distTop = Math.abs(yPct - top);
      if (distTop < minDistanceY) {
        minDistanceY = distTop;
        bestY = top;
      }
      const distBottom = Math.abs(yPct - bottom);
      if (distBottom < minDistanceY) {
        minDistanceY = distBottom;
        bestY = bottom;
      }
    });

    return { x: bestX, y: bestY };
  };

  // Drawing & Selection Interaction handlers (AutoCAD-style navigation & selection)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isProcessing) return;
    if (!workspaceRef.current) return;

    // Track starting screen coordinates for drag vs click detection
    mouseDownClientRef.current = { x: e.clientX, y: e.clientY };
    dragDistanceRef.current = 0;

    // Support middle click (1), right click (2), Spacebar held, or active Pan Tool for Panning
    if (e.button === 1 || e.button === 2 || isPanToolActive || isSpacePressed) {
      if (isTwoClickSelecting) {
        setIsTwoClickSelecting(false);
        setIsDrawing(false);
        setDrawStart(null);
        setDrawCurrent(null);
      }
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
      return;
    }

    // Only allow left click (button 0) for drawing or selection
    if (e.button !== 0) return;

    const rect = workspaceRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const { x, y } = isAreaSelectActive ? { x: rawX, y: rawY } : snapToElements(rawX, rawY);

    // If we are already in two-click selection mode, the second click completes the selection!
    if (isTwoClickSelecting) {
      setIsTwoClickSelecting(false);
      setIsDrawing(false);
      completeAreaOrPanelSelection(drawStart || { x, y }, { x, y });
      return;
    }

    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
    
    // Clear selected panel ID on fresh drag unless using additive selection
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !isAreaSelectActive) {
      setSelectedPanelId(null);
      setSelectedLineId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // 1. Calculate live cursor coordinates in CAD millimeters
    if (workspaceRef.current) {
      const rect = workspaceRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const rawX = ((e.clientX - rect.left) / rect.width) * 100;
        const rawY = ((e.clientY - rect.top) / rect.height) * 100;
        
        let calculatedX = 0;
        let calculatedY = 0;

        if (dxfData && dxfData.bounds && typeof dxfData.bounds.width === "number" && dxfData.bounds.width > 0 && typeof dxfData.bounds.height === "number" && dxfData.bounds.height > 0) {
          const xMin = typeof dxfData.bounds.xMin === "number" && !isNaN(dxfData.bounds.xMin) ? dxfData.bounds.xMin : 0;
          const yMax = typeof dxfData.bounds.yMax === "number" && !isNaN(dxfData.bounds.yMax) ? dxfData.bounds.yMax : 0;
          const cadX = xMin + (rawX / 100) * dxfData.bounds.width;
          const cadY = yMax - (rawY / 100) * dxfData.bounds.height;
          calculatedX = Math.round(cadX);
          calculatedY = Math.round(cadY);
        } else if (referencePanel && referencePanel.width > 0 && referencePanel.height > 0 && !isNaN(referencePanel.realWidth) && !isNaN(referencePanel.realHeight)) {
          const scaleFactorX = referencePanel.realWidth / referencePanel.width;
          const scaleFactorY = referencePanel.realHeight / referencePanel.height;
          calculatedX = Math.round(rawX * scaleFactorX);
          calculatedY = Math.round(rawY * scaleFactorY);
        } else {
          calculatedX = Math.round(rawX * 10);
          calculatedY = Math.round(rawY * 10);
        }

        if (isNaN(calculatedX) || !isFinite(calculatedX)) calculatedX = 0;
        if (isNaN(calculatedY) || !isFinite(calculatedY)) calculatedY = 0;

        setCursorMm({ x: calculatedX, y: calculatedY });
      }
    }

    // 2. Handle viewport panning
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (!isDrawing || !drawStart || !workspaceRef.current) return;

    // 3. Track drag distance to differentiate single clicks from drag selections
    if (mouseDownClientRef.current) {
      dragDistanceRef.current = Math.hypot(
        e.clientX - mouseDownClientRef.current.x,
        e.clientY - mouseDownClientRef.current.y
      );
    }

    const rect = workspaceRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const { x, y } = isAreaSelectActive ? { x: rawX, y: rawY } : snapToElements(rawX, rawY);

    // Apply Ortho snap if shift is pressed, or Ortho mode is active, and we are drawing a line
    let targetX = x;
    let targetY = y;
    if (activeAccessoryDrawMode && (e.shiftKey || isOrthoMode) && drawStart) {
      const dx = Math.abs(x - drawStart.x);
      const dy = Math.abs(y - drawStart.y);
      if (dx > dy) {
        targetY = drawStart.y;
      } else {
        targetX = drawStart.x;
      }
    }

    setDrawCurrent({ x: targetX, y: targetY });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing || !drawStart || !drawCurrent) return;

    // Track drag distance for click vs drag
    if (mouseDownClientRef.current) {
      dragDistanceRef.current = Math.hypot(
        e.clientX - mouseDownClientRef.current.x,
        e.clientY - mouseDownClientRef.current.y
      );
    }

    // If mouse travelled less than 5px, count it as a click, not a drag-select box
    if (dragDistanceRef.current < 5) {
      if (isAreaSelectActive && !isTwoClickSelecting) {
        setIsTwoClickSelecting(true);
        return;
      } else if (!isAreaSelectActive && !activeAccessoryDrawMode) {
        setIsDrawing(false);
        setDrawStart(null);
        setDrawCurrent(null);
        return;
      }
    }

    // If we are in two-click selection mode, ignore MouseUp (wait for second click)
    if (isTwoClickSelecting) {
      return;
    }

    setIsDrawing(false);

    if (activeAccessoryDrawMode) {
      // Calculate final point with optional ortho snap
      let endX = drawCurrent.x;
      let endY = drawCurrent.y;
      if ((e.shiftKey || isOrthoMode) && drawStart) {
        const dx = Math.abs(drawCurrent.x - drawStart.x);
        const dy = Math.abs(drawCurrent.y - drawStart.y);
        if (dx > dy) {
          endY = drawStart.y;
        } else {
          endX = drawStart.x;
        }
      }
      
      const distance = Math.hypot(endX - drawStart.x, endY - drawStart.y);
      if (distance > 0.5) {
        const newLine: AccessoryLine = {
          id: `line-${activeAccessoryDrawMode}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          x1: parseFloat((drawStart?.x ?? 0).toFixed(3)),
          y1: parseFloat((drawStart?.y ?? 0).toFixed(3)),
          x2: parseFloat((endX ?? 0).toFixed(3)),
          y2: parseFloat((endY ?? 0).toFixed(3)),
          type: activeAccessoryDrawMode,
        };
        setAccessoryLines((prev) => [...prev, newLine]);
        
        const lengthMm = calculateLineMm(newLine.x1, newLine.y1, newLine.x2, newLine.y2);
        const displayType = newLine.type === "base_track" ? "Base Track" : newLine.type === "reveal_5_8" ? '5/8" Reveal' : newLine.type === "reveal_3_4" ? '3/4" Reveal' : "Custom Reveal";
        setSystemMessage({
          text: `Added ${displayType} segment: ${lengthMm ?? 0} mm (${((lengthMm || 0) / 304.8).toFixed(1)} lft).`,
          type: "success"
        });
      }
      setDrawStart(null);
      setDrawCurrent(null);
      return;
    }

    completeAreaOrPanelSelection(drawStart, drawCurrent);
  };

  const completeAreaOrPanelSelection = (start: { x: number; y: number }, current: { x: number; y: number }) => {
    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const w = Math.abs(start.x - current.x);
    const h = Math.abs(start.y - current.y);

    // Filter out micro-clicks
    if (w > 0.5 && h > 0.5) {
      if (isAreaSelectActive) {
        if (!showPanelLayout) return;
        const isLtr = start.x <= current.x;
        // Find panels based on CAD drag direction
        const inside = panels.filter((p) => {
          if (isLtr) {
            // Window selection: panel must be completely within the selection box
            return (
              p.x >= x1 &&
              p.x + p.width <= x1 + w &&
              p.y >= y1 &&
              p.y + p.height <= y1 + h
            );
          } else {
            // Crossing selection: panel intersects/overlaps with the selection box
            return (
              p.x <= x1 + w &&
              p.x + p.width >= x1 &&
              p.y <= y1 + h &&
              p.y + p.height >= y1
            );
          }
        });

        if (inside.length > 0) {
          setSelectedAreaPanels(inside);
          setSelectedPanelIds(new Set(inside.map((p) => p.id)));
          setAreaPrefix(prefix || "B");
          setAreaStartNumber(startNumber || 1);
          setShowAreaNamingModal(true);
        } else {
          setSystemMessage({
            text: isLtr
              ? "Window Selection: No panels were completely enclosed. Try selection from Right-to-Left for Crossing Selection (touches anything)."
              : "Crossing Selection: No panels touched your selection path.",
            type: "info",
          });
        }
      } else {
        setTempRect({ x: x1, y: y1, w, h });
        
        // Calculate scaled dimensions if a calibration reference panel exists or if DXF is active
        if (dxfData && dxfData.bounds && typeof dxfData.bounds.width === "number" && dxfData.bounds.width > 0 && typeof dxfData.bounds.height === "number" && dxfData.bounds.height > 0) {
          const calculatedWidth = Math.round((w / 100) * dxfData.bounds.width);
          const calculatedHeight = Math.round((h / 100) * dxfData.bounds.height);
          setNewWidth(isNaN(calculatedWidth) || !isFinite(calculatedWidth) ? 1200 : calculatedWidth);
          setNewHeight(isNaN(calculatedHeight) || !isFinite(calculatedHeight) ? 600 : calculatedHeight);
          setNewUnit("mm");
        } else if (referencePanel && referencePanel.width > 0 && referencePanel.height > 0 && !isNaN(referencePanel.realWidth) && !isNaN(referencePanel.realHeight)) {
          const scaleFactorX = referencePanel.realWidth / referencePanel.width;
          const scaleFactorY = referencePanel.realHeight / referencePanel.height;
          const calculatedWidth = Math.round(w * scaleFactorX);
          const calculatedHeight = Math.round(h * scaleFactorY);
          setNewWidth(isNaN(calculatedWidth) || !isFinite(calculatedWidth) ? 1200 : calculatedWidth);
          setNewHeight(isNaN(calculatedHeight) || !isFinite(calculatedHeight) ? 600 : calculatedHeight);
          setNewUnit(referencePanel.unit || "mm");
        } else {
          setNewWidth(1200);
          setNewHeight(600);
          setNewUnit("mm");
        }
        setShowManualSpecModal(true);
      }
    }

    setDrawStart(null);
    setDrawCurrent(null);
  };

  const saveManualPanel = () => {
    if (!tempRect) return;

    const finalW = isNaN(newWidth) ? 0 : newWidth;
    const finalH = isNaN(newHeight) ? 0 : newHeight;

    const newPanel: Panel = {
      id: `manual-${Date.now()}`,
      x: tempRect.x,
      y: tempRect.y,
      width: tempRect.w,
      height: tempRect.h,
      realWidth: finalW,
      realHeight: finalH,
      unit: newUnit,
    };

    setPanels((prev) => [...prev, newPanel]);
    setTempRect(null);
    setShowManualSpecModal(false);
    setSystemMessage({
      text: `Added new panel dimensions: ${finalW} x ${finalH} ${newUnit}.`,
      type: "success"
    });
  };

  // Delete a panel
  const deletePanel = (id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
    if (selectedPanelId === id) setSelectedPanelId(null);
    if (scaleReferenceId === id) setScaleReferenceId(null);
    setSystemMessage({ text: "Panel deleted from elevation layout.", type: "success" });
  };

  // Apply sequential naming to the selected area panels
  const applySequentialNaming = () => {
    const { panelLabels } = getAreaColumnsAndNaming(
      selectedAreaPanels,
      areaPrefix,
      areaStartNumber,
      areaNamingMode,
      namingRule.tolerance,
      panels
    );

    setPanels((prev) =>
      prev.map((p) => {
        if (panelLabels[p.id] !== undefined) {
          return { ...p, customLabel: panelLabels[p.id] };
        }
        return p;
      })
    );

    // Auto-calculate the next sequential starting number based on the maximum number used in the new labels
    let maxNumUsed = areaStartNumber - 1;
    Object.values(panelLabels).forEach((lbl) => {
      const match = lbl.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNumUsed) {
          maxNumUsed = num;
        }
      }
    });
    const nextStartNum = maxNumUsed + 1;
    setAreaStartNumber(nextStartNum);
    setStartNumber(nextStartNum);
    setStartNameInput(`${areaPrefix}${nextStartNum}`);

    setShowAreaNamingModal(false);
    setSelectedAreaPanels([]);
    // Do NOT disable Area Select Active! Keep it active so the user can seamlessly proceed to the next column or group.
    setSystemMessage({
      text: `Sequentially labeled ${selectedAreaPanels.length} panels starting from "${areaPrefix}${areaStartNumber}"! Next sequence will automatically start at "${areaPrefix}${nextStartNum}".`,
      type: "success"
    });
  };

  // Modify current panel's width/height and custom name/label
  const updatePanelDimensions = () => {
    if (!selectedPanelId) return;
    const finalW = isNaN(modWidth) ? 0 : modWidth;
    const finalH = isNaN(modHeight) ? 0 : modHeight;
    const targetPanel = panels.find((p) => p.id === selectedPanelId);
    if (!targetPanel) return;

    // Check if the size of the target panel is unmodified but the label is updated.
    // If so, we should propagate the label change to all panels of the same size.
    const isSameSize = 
      Math.abs(targetPanel.realWidth - finalW) <= namingRule.tolerance &&
      Math.abs(targetPanel.realHeight - finalH) <= namingRule.tolerance;

    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === selectedPanelId) {
          return {
            ...p,
            realWidth: finalW,
            realHeight: finalH,
            unit: modUnit,
            customLabel: modCustomLabel.trim() || undefined,
            isSlotted: modIsSlotted
          };
        }
        if (
          isSameSize &&
          Math.abs(p.realWidth - targetPanel.realWidth) <= namingRule.tolerance &&
          Math.abs(p.realHeight - targetPanel.realHeight) <= namingRule.tolerance &&
          Boolean(p.isSlotted) === Boolean(targetPanel.isSlotted)
        ) {
          return { ...p, customLabel: modCustomLabel.trim() || undefined };
        }
        return p;
      })
    );
    setSystemMessage({ text: "Panel specifications, label, and profile updated successfully.", type: "success" });
  };

  // Toggle slotted profile status for an individual panel
  const togglePanelSlotted = (panelId: string, forceState?: boolean) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id === panelId) {
          const nextState = forceState !== undefined ? forceState : !p.isSlotted;
          return { ...p, isSlotted: nextState };
        }
        return p;
      })
    );
  };

  // Toggle slotted profile status for all panels in a size group
  const toggleGroupSlotted = (groupLabel: string, forceState?: boolean) => {
    const grp = groups.find((g) => g.label === groupLabel);
    if (!grp) return;
    const currentSlotted = grp.panels.length > 0 && grp.panels.every((p) => p.isSlotted);
    const targetState = forceState !== undefined ? forceState : !currentSlotted;
    const memberIds = new Set(grp.panels.map((p) => p.id));
    setPanels((prev) =>
      prev.map((p) => (memberIds.has(p.id) ? { ...p, isSlotted: targetState } : p))
    );
    setSystemMessage({
      text: `${grp.panels.length} panels in group "${groupLabel}" set to ${targetState ? "Slotted (Shorter Girth: +18H)" : "Standard Normal (+36H)"}`,
      type: "success",
    });
  };

  // Bulk mark selected panels on canvas as slotted or standard
  const markSelectedPanelsSlotted = (slotted: boolean) => {
    const idsToUpdate = selectedPanelIds.size > 0 
      ? selectedPanelIds 
      : selectedPanelId ? new Set([selectedPanelId]) : new Set<string>();
    
    if (idsToUpdate.size === 0) return;

    setPanels((prev) =>
      prev.map((p) => (idsToUpdate.has(p.id) ? { ...p, isSlotted: slotted } : p))
    );
    setSystemMessage({
      text: `${idsToUpdate.size} panel(s) marked as ${slotted ? "Slotted (Shorter Girth: +18H)" : "Standard Normal (+36H)"}`,
      type: "success",
    });
  };

  // Bulk mark all panels in project as slotted or standard
  const markAllPanelsSlotted = (slotted: boolean) => {
    setPanels((prev) => prev.map((p) => ({ ...p, isSlotted: slotted })));
    setSystemMessage({
      text: `All ${panels.length} panels marked as ${slotted ? "Slotted (Shorter Girth: +18H)" : "Standard Normal (+36H)"}`,
      type: "success",
    });
  };

  // Rename a single panel's custom label/name (and propagate to all panels in the same size group to prevent splitting)
  const renamePanel = (panelId: string, newLabel: string) => {
    const targetPanel = panels.find((p) => p.id === panelId);
    if (!targetPanel) return;

    setPanels((prev) =>
      prev.map((p) => {
        if (
          Math.abs(p.realWidth - targetPanel.realWidth) <= namingRule.tolerance &&
          Math.abs(p.realHeight - targetPanel.realHeight) <= namingRule.tolerance
        ) {
          return { ...p, customLabel: newLabel.trim() || undefined };
        }
        return p;
      })
    );
    setSystemMessage({
      text: `Panel and size group updated to "${newLabel.trim() || "auto-assigned"}".`,
      type: "success"
    });
  };

  // Rename all panels in a group
  const renameGroup = (oldLabel: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    setPanels((prev) =>
      prev.map((p) => {
        const lp = labeledPanels.find((x) => x.id === p.id);
        if (lp && lp.label === oldLabel) {
          return { ...p, customLabel: newLabel.trim() };
        }
        return p;
      })
    );
    setSystemMessage({
      text: `Group renamed to "${newLabel.trim()}".`,
      type: "success"
    });
  };

  // Drag and drop reordering of panels list
  const reorderPanels = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setPanels((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, removed);
      return copy;
    });
    setSystemMessage({
      text: "Reordered panels sequential hierarchy. Labels have been dynamically updated on layout.",
      type: "success"
    });
  };

  // Modify dimensions for an entire group
  const updateGroupDimensions = (oldW: number, oldH: number, newW: number, newH: number, unit: string, isSlotted?: boolean) => {
    const finalNewW = isNaN(newW) ? 0 : newW;
    const finalNewH = isNaN(newH) ? 0 : newH;
    setPanels((prev) =>
      prev.map((p) => {
        const widthDiff = Math.abs(p.realWidth - oldW);
        const heightDiff = Math.abs(p.realHeight - oldH);
        const slottedMatch = isSlotted === undefined || Boolean(p.isSlotted) === Boolean(isSlotted);
        if (widthDiff <= tolerance && heightDiff <= tolerance && slottedMatch) {
          return { ...p, realWidth: finalNewW, realHeight: finalNewH, unit };
        }
        return p;
      })
    );
    setEditPanelId(null);
    setSystemMessage({
      text: `Updated dimensions for ${isSlotted ? "slotted" : "standard"} panels group: ${finalNewW} x ${finalNewH} ${unit}.`,
      type: "success"
    });
  };

  // Trigger browser download of multi-sheet Excel Workbook (.xlsx)
  const handleExportExcel = () => {
    exportToExcel(
      groups,
      totalLengths,
      revealWidths,
      panelClipsCount,
      clipCalculationMethod,
      clipsSpacing,
      projectName,
      projectNumber,
      releaseNo,
      projectManager,
      dueDate,
      panelType,
      panelColour,
      masterListSettings
    );
    setSystemMessage({ text: "Exported multi-sheet Excel workbook (.xlsx) containing Packing List, Master List (Girth) & Accessories sheets!", type: "success" });
  };

  // Trigger browser download of dedicated Master List (.xlsx)
  const handleExportMasterListExcel = () => {
    exportMasterListToExcel(
      groups,
      projectName,
      projectNumber,
      releaseNo,
      projectManager,
      dueDate,
      panelType,
      panelColour,
      masterListSettings
    );
    setSystemMessage({ text: "Exported Master List with girth dimensions (.xlsx) successfully!", type: "success" });
  };

  // Trigger browser download of dedicated Master List (.csv)
  const handleExportMasterListCSV = () => {
    const csvContent = exportMasterListToCSV(
      groups,
      projectName,
      projectNumber,
      releaseNo,
      projectManager,
      dueDate,
      panelType,
      panelColour,
      masterListSettings
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileBase = projectName ? projectName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") : "master_list_girth";
    link.setAttribute("download", `${fileBase}_release_${releaseNo || "1"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSystemMessage({ text: "Exported Master List CSV successfully!", type: "success" });
  };

  // Trigger browser download of CSV Bill of Materials
  const handleExportCSV = () => {
    const csvContent = exportToCSV(
      groups, 
      projectName, 
      projectNumber, 
      releaseNo,
      projectManager,
      dueDate,
      panelType,
      panelColour
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileBase = projectName ? projectName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") : "panel_packing_list";
    link.setAttribute("download", `${fileBase}_release_${releaseNo || "1"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSystemMessage({ text: "Packing list CSV exported successfully with project headers and sequential label references.", type: "success" });
  };

  // Trigger browser download of JSON panel data for project management tools
  const handleExportJSON = () => {
    if (labeledPanels.length === 0) {
      setSystemMessage({ text: "No panels available to export.", type: "error" });
      return;
    }
    exportToJSON(labeledPanels, projectName, projectNumber, releaseNo, newUnit);
    setSystemMessage({
      text: `Exported JSON data for ${labeledPanels.length} panels containing labels, dimensions, and positions!`,
      type: "success"
    });
  };

  // Export annotated original DXF file containing the panel labels on layer 'PANEL_LABELS'
  const exportAnnotatedDxf = () => {
    if (!dxfData || !originalDxfText) {
      setSystemMessage({ text: "No DXF layout is loaded to export.", type: "error" });
      return;
    }

    try {
      // Determine line ending format used in original DXF
      const isCrlf = originalDxfText.includes("\r\n");
      const newline = isCrlf ? "\r\n" : "\n";
      const lines = originalDxfText.split(/\r?\n/);

      // Detect group code padding (like leading spaces) from an existing line
      let padding = "  "; // default to 2 spaces
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "ENTITIES") {
          if (i > 0) {
            const match = lines[i - 1].match(/^(\s*)/);
            if (match) {
              padding = match[1];
            }
          }
          break;
        }
      }

      // Create properly-formatted text entities list with maximum compatibility
      let textEntitiesList: string[] = [];
      labeledPanels.forEach((panel) => {
        const cadX = dxfData.bounds.xMin + (panel.x / 100) * dxfData.bounds.width;
        // DXF/CAD coordinates have Y-axis going upwards, so subtract from yMax
        const cadY_top = dxfData.bounds.yMax - (panel.y / 100) * dxfData.bounds.height;
        const cadWidth = (panel.width / 100) * dxfData.bounds.width;
        const cadHeight = (panel.height / 100) * dxfData.bounds.height;

        const centerX = cadX + cadWidth / 2;
        const centerY = cadY_top - cadHeight / 2;
        const textHeight = Math.max(Math.min(cadWidth, cadHeight) * 0.25, dxfData.bounds.height * 0.015);

        // Standard left-aligned/start TEXT entity with maximum CAD viewer compatibility
        textEntitiesList.push(
          `${padding}0`,
          "TEXT",
          `${padding}8`,
          "PANEL_LABELS",
          `${padding}10`,
          (centerX ?? 0).toFixed(4),
          `${padding}20`,
          (centerY ?? 0).toFixed(4),
          `${padding}30`,
          "0.0",
          `${padding}40`,
          (textHeight ?? 0).toFixed(4),
          `${padding}1`,
          panel.label || ""
        );
      });

      // Find the ENTITIES section start line index
      let entitiesSectionIndex = -1;
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].trim() === "2" && lines[i+1].trim() === "ENTITIES") {
          entitiesSectionIndex = i + 1;
          break;
        }
      }

      if (entitiesSectionIndex === -1) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim() === "ENTITIES") {
            entitiesSectionIndex = i;
            break;
          }
        }
      }

      if (entitiesSectionIndex === -1) {
        throw new Error("Could not find the ENTITIES section in the DXF file.");
      }

      // Find the ENDSEC group code that closes the ENTITIES section
      let insertLineIndex = -1;
      for (let i = entitiesSectionIndex; i < lines.length - 1; i++) {
        if (lines[i].trim() === "0" && lines[i+1].trim() === "ENDSEC") {
          insertLineIndex = i; // Insert our text block immediately before the "0" code
          break;
        }
      }

      if (insertLineIndex === -1) {
        throw new Error("Could not find ENDSEC terminating the ENTITIES section.");
      }

      // Splice the text entities safely without disrupting group structure
      const resultLines = [
        ...lines.slice(0, insertLineIndex),
        ...textEntitiesList,
        ...lines.slice(insertLineIndex)
      ];

      const newDxfContent = resultLines.join(newline);
      downloadDxfFile(newDxfContent);
    } catch (err: any) {
      console.error(err);
      setSystemMessage({ text: `Failed to insert panel label entities: ${err.message}`, type: "error" });
    }
  };

  const downloadDxfFile = (content: string) => {
    const blob = new Blob([content], { type: "application/dxf;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const nameWithoutExt = dxfData?.fileName.replace(/\.dxf$/i, "") || "annotated_layout";
    link.download = `${nameWithoutExt}_labeled.dxf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSystemMessage({
      text: "Successfully generated and downloaded the annotated DXF file containing the panel names on layer 'PANEL_LABELS'!",
      type: "success"
    });
  };

  // Export annotated layout as a high-quality PDF
  const exportAnnotatedPdf = async () => {
    const element = document.getElementById("drawing-canvas-container");
    if (!element) {
      setSystemMessage({ text: "No drawing canvas layout found to export.", type: "error" });
      return;
    }

    setSystemMessage({ text: "Generating high-quality PDF layout... Please wait.", type: "success" });

    // Enable clean export mode and clear active selections so selection rings don't appear in PDF
    setIsExportingPdf(true);
    setSelectedPanelId(null);
    setSelectedPanelIds(new Set());
    setSelectedLineId(null);

    // Save viewport zoom & pan states before resetting for 1:1 exact capture
    const savedZoom = zoomLevel;
    const savedPan = panOffset;
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;

    // Temporarily reset canvas container to 1:1 native scale & zero translate
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    element.style.transform = "none";
    element.style.transition = "none";

    // Wait for DOM layout and state updates to settle at 1:1 resolution
    await new Promise((r) => setTimeout(r, 150));

    // Backup and patch all <style> tags to convert any oklch/oklab rules that make html2canvas crash
    const styleElements = Array.from(document.querySelectorAll("style"));
    const styleBackups = styleElements.map(style => ({
      element: style,
      originalText: style.textContent || ""
    }));

    styleElements.forEach(style => {
      if (style.textContent && (style.textContent.includes("oklch") || style.textContent.includes("oklab"))) {
        style.textContent = convertOklchAndOklabToRgb(style.textContent);
      }
    });

    // Backup original window.getComputedStyle to avoid oklch parser errors in html2canvas
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (elt, pseudoElt) {
      const style = originalGetComputedStyle(elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          const value = Reflect.get(target, prop);
          if (typeof value === "string" && (value.includes("oklch") || value.includes("oklab"))) {
            return convertOklchAndOklabToRgb(value);
          }
          if (typeof value === "function") {
            return function (this: any, ...args: any[]) {
              const res = value.apply(target, args);
              if (typeof res === "string" && (res.includes("oklch") || res.includes("oklab"))) {
                return convertOklchAndOklabToRgb(res);
              }
              return res;
            };
          }
          return value;
        }
      });
    };

    try {
      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        scale: 2, // High resolution scale for sharp labels and crisp borders
        backgroundColor: "#ffffff",
        logging: false
      });

      // Restore zoom, pan, and transform styles immediately after capture
      element.style.transform = originalTransform;
      element.style.transition = originalTransition;
      setZoomLevel(savedZoom);
      setPanOffset(savedPan);

      const imgData = canvas.toDataURL("image/png");
      const pdfWidth = canvas.width / 2; // scale factor 2
      const pdfHeight = canvas.height / 2;

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
        unit: "pt",
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

      // Page 2: Dedicated Takeoff Schedule & Color Legend Page
      if (showLegendOnExport) {
        pdf.addPage([pdfWidth, pdfHeight], pdfWidth > pdfHeight ? "landscape" : "portrait");

        // Clean white background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, pdfHeight, "F");

        const hexToRgb = (hex: string): [number, number, number] => {
          const clean = (hex || "").replace("#", "");
          if (clean.length === 6) {
            return [
              parseInt(clean.substring(0, 2), 16),
              parseInt(clean.substring(2, 4), 16),
              parseInt(clean.substring(4, 6), 16)
            ];
          }
          return [6, 182, 212];
        };

        // Header Banner
        pdf.setFillColor(15, 23, 42); // slate-900
        pdf.rect(20, 20, pdfWidth - 40, 50, "F");

        pdf.setFontSize(14);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.text("PROJECT TAKEOFF SCHEDULE & COLOR LEGEND", 35, 42);

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(203, 213, 225);
        pdf.text(`Project: ${projectName || "Block 22"}  |  Release #: ${releaseNo || "08.Rev 02"}  |  Date: ${new Date().toISOString().split("T")[0]}  |  PM: ${projectManager || "C.W"}`, 35, 58);

        // SECTION 1: COLOR & ACCESSORY LINE LEGEND
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text("1. COLOR & ACCESSORY LINE LEGEND KEY", 35, 92);

        let legendY = 104;
        const colW = (pdfWidth - 80) / 2;

        // Card 1: J-Track / Base
        const rgbBase = hexToRgb(accessoryColors.base_track || "#A855F7");
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(35, legendY, colW, 36, 4, 4, "FD");
        pdf.setDrawColor(rgbBase[0], rgbBase[1], rgbBase[2]);
        pdf.setLineWidth(3);
        pdf.line(45, legendY + 18, 75, legendY + 18);
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text("J-Track / Base Extrusion", 85, legendY + 15);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${(totalLengths?.base_track?.lft ?? 0).toFixed(1)} LF  |  ${totalLengths?.base_track?.pieces ?? 0} pcs (@ 10')  |  ${Math.round(totalLengths?.base_track?.mm ?? 0)} mm`, 85, legendY + 27);

        // Card 2: 5/8" Reveal Joint
        const rgb58 = hexToRgb(accessoryColors.reveal_5_8 || "#06B6D4");
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(45 + colW, legendY, colW, 36, 4, 4, "FD");
        pdf.setDrawColor(rgb58[0], rgb58[1], rgb58[2]);
        pdf.setLineWidth(2.5);
        pdf.line(55 + colW, legendY + 18, 85 + colW, legendY + 18);
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text(`5/8" Reveal Joint (${revealWidths.reveal_5_8 || 42}mm)`, 95 + colW, legendY + 15);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${(totalLengths?.reveal_5_8?.lft ?? 0).toFixed(1)} LF  |  ${totalLengths?.reveal_5_8?.pieces ?? 0} pcs (@ 10')  |  ${Math.round(totalLengths?.reveal_5_8?.mm ?? 0)} mm`, 95 + colW, legendY + 27);

        legendY += 42;

        // Card 3: 3/4" Reveal Joint
        const rgb34 = hexToRgb(accessoryColors.reveal_3_4 || "#6366F1");
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(35, legendY, colW, 36, 4, 4, "FD");
        pdf.setDrawColor(rgb34[0], rgb34[1], rgb34[2]);
        pdf.setLineWidth(2.5);
        pdf.line(45, legendY + 18, 75, legendY + 18);
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text(`3/4" Reveal Joint (${revealWidths.reveal_3_4 || 25}mm)`, 85, legendY + 15);
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${(totalLengths?.reveal_3_4?.lft ?? 0).toFixed(1)} LF  |  ${totalLengths?.reveal_3_4?.pieces ?? 0} pcs (@ 10')  |  ${Math.round(totalLengths?.reveal_3_4?.mm ?? 0)} mm`, 85, legendY + 27);

        // Card 4: Custom Reveal or Panel Clips
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(45 + colW, legendY, colW, 36, 4, 4, "FD");
        if ((totalLengths?.reveal_custom?.mm ?? 0) > 0) {
          const rgbCustom = hexToRgb(accessoryColors.reveal_custom || "#EC4899");
          pdf.setDrawColor(rgbCustom[0], rgbCustom[1], rgbCustom[2]);
          pdf.setLineWidth(2.5);
          pdf.line(55 + colW, legendY + 18, 85 + colW, legendY + 18);
          pdf.setFontSize(9.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(15, 23, 42);
          pdf.text(`Custom Reveal (${revealWidths.reveal_custom || 25}mm)`, 95 + colW, legendY + 15);
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(71, 85, 105);
          pdf.text(`${(totalLengths?.reveal_custom?.lft ?? 0).toFixed(1)} LF  |  ${totalLengths?.reveal_custom?.pieces ?? 0} pcs (@ 10')  |  ${Math.round(totalLengths?.reveal_custom?.mm ?? 0)} mm`, 95 + colW, legendY + 27);
        } else {
          pdf.setFontSize(9.5);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(4, 120, 87);
          pdf.text(`3" Panel Clips Total`, 95 + colW, legendY + 15);
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(71, 85, 105);
          pdf.text(`${panelClipsCount} pcs (${clipCalculationMethod === "excel" ? "LET Formula" : `Spacing: ${clipsSpacing}" c-to-c`})`, 95 + colW, legendY + 27);
        }

        // SECTION 2: ACCESSORIES TAKEOFF SUMMARY TABLE
        let tableY = legendY + 52;
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text("2. ACCESSORIES & EXTRUSIONS TAKEOFF SUMMARY", 35, tableY);

        tableY += 10;
        pdf.setFillColor(241, 245, 249);
        pdf.rect(35, tableY, pdfWidth - 70, 20, "F");
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(51, 65, 85);
        pdf.text("ITEM / ACCESSORY TYPE", 45, tableY + 13);
        pdf.text("JOINT WIDTH", 200, tableY + 13);
        pdf.text("TOTAL MM", 300, tableY + 13);
        pdf.text("TOTAL LF", 400, tableY + 13);
        pdf.text("STOCK PIECES (10')", 500, tableY + 13);

        const tableRows = [
          { item: "J-Track / Base Extrusion", width: "N/A", mm: `${Math.round(totalLengths?.base_track?.mm ?? 0)} mm`, lft: `${(totalLengths?.base_track?.lft ?? 0).toFixed(1)} LF`, pcs: `${totalLengths?.base_track?.pieces ?? 0} pcs` },
          { item: "5/8\" Reveal Joint", width: `${revealWidths.reveal_5_8 || 42} mm`, mm: `${Math.round(totalLengths?.reveal_5_8?.mm ?? 0)} mm`, lft: `${(totalLengths?.reveal_5_8?.lft ?? 0).toFixed(1)} LF`, pcs: `${totalLengths?.reveal_5_8?.pieces ?? 0} pcs` },
          { item: "3/4\" Reveal Joint", width: `${revealWidths.reveal_3_4 || 25} mm`, mm: `${Math.round(totalLengths?.reveal_3_4?.mm ?? 0)} mm`, lft: `${(totalLengths?.reveal_3_4?.lft ?? 0).toFixed(1)} LF`, pcs: `${totalLengths?.reveal_3_4?.pieces ?? 0} pcs` },
          { item: "Custom Reveal Joint", width: `${revealWidths.reveal_custom || 25} mm`, mm: `${Math.round(totalLengths?.reveal_custom?.mm ?? 0)} mm`, lft: `${(totalLengths?.reveal_custom?.lft ?? 0).toFixed(1)} LF`, pcs: `${totalLengths?.reveal_custom?.pieces ?? 0} pcs` },
          { item: "3\" Panel Attachment Clips", width: "3 inches", mm: "N/A", lft: "N/A", pcs: `${panelClipsCount} pcs` }
        ];

        tableY += 20;
        tableRows.forEach((row, idx) => {
          if (idx % 2 === 1) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(35, tableY, pdfWidth - 70, 18, "F");
          }
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(15, 23, 42);
          pdf.text(row.item, 45, tableY + 12);
          pdf.text(row.width, 200, tableY + 12);
          pdf.text(row.mm, 300, tableY + 12);
          pdf.text(row.lft, 400, tableY + 12);
          pdf.setFont("helvetica", "bold");
          pdf.text(row.pcs, 500, tableY + 12);

          tableY += 18;
        });

        // SECTION 3: PANEL BILL OF MATERIALS SUMMARY
        tableY += 12;
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text("3. PANEL GROUP & QUANTITY BREAKDOWN", 35, tableY);

        tableY += 10;
        pdf.setFillColor(241, 245, 249);
        pdf.rect(35, tableY, pdfWidth - 70, 18, "F");
        pdf.setFontSize(8.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(51, 65, 85);
        pdf.text("PANEL GROUP LABEL", 45, tableY + 12);
        pdf.text("QTY", 200, tableY + 12);
        pdf.text("REAL WIDTH (W)", 280, tableY + 12);
        pdf.text("REAL HEIGHT (H)", 400, tableY + 12);
        pdf.text("TYPE / MATERIAL", 510, tableY + 12);

        tableY += 18;
        groups.slice(0, 7).forEach((g, idx) => {
          if (idx % 2 === 1) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(35, tableY, pdfWidth - 70, 16, "F");
          }
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(15, 23, 42);
          pdf.text(g.label, 45, tableY + 11);
          pdf.setFont("helvetica", "normal");
          pdf.text(`${g.panels.length}`, 200, tableY + 11);
          pdf.text(`${g.realWidth} mm`, 280, tableY + 11);
          pdf.text(`${g.realHeight} mm`, 400, tableY + 11);
          pdf.text(`${panelType} (${panelColour})`, 510, tableY + 11);

          tableY += 16;
        });

        if (groups.length > 7) {
          pdf.setFontSize(7.5);
          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(100, 116, 139);
          pdf.text(`+ ${groups.length - 7} additional panel groups listed in attached Excel/CSV BOM sheet.`, 45, tableY + 10);
        }
      }
      
      const fileBase = dxfData?.fileName.replace(/\.dxf$/i, "") || imageName.replace(/\.[a-z0-9]+$/i, "") || "panel_layout";
      pdf.save(`${fileBase}_labeled_layout.pdf`);

      setSystemMessage({ text: "Successfully generated and downloaded labeled PDF layout!", type: "success" });
    } catch (err: any) {
      console.error(err);
      setSystemMessage({ text: `Failed to export PDF: ${err.message}`, type: "error" });
    } finally {
      setIsExportingPdf(false);

      // Restore original getComputedStyle
      window.getComputedStyle = originalGetComputedStyle;

      // Restore original style tags text content
      styleBackups.forEach(backup => {
        backup.element.textContent = backup.originalText;
      });
    }
  };

  // Clear all panels
  const clearAllPanels = () => {
    setPanels([]);
    setAccessoryLines([]);
    setSelectedLineId(null);
    setSelectedPanelId(null);
    setSelectedPanelIds(new Set());
    setStartNameInput(userManualStartNameInput);
    setSystemMessage({ text: `All panel boundaries and accessories cleared. Sequencer reset back to your manual start label "${userManualStartNameInput}".`, type: "info" });
  };

  // Delete the uploaded layout file and clear all panels
  const deleteUploadedFile = () => {
    setImageUrl(null);
    setDxfData(null);
    setHoveredCandidateId(null);
    setImageName("No drawing loaded");
    setPanels([]);
    setAccessoryLines([]);
    setScaleReferenceId(null);
    setSelectedPanelId(null);
    setSelectedPanelIds(new Set());
    setSelectedLineId(null);
    setActiveAccessoryDrawMode(null);
    setDueDate(getTodayDateString());
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (dxfFileInputRef.current) dxfFileInputRef.current.value = "";
    if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
    try {
      localStorage.removeItem("panelflow_accessory_lines");
      localStorage.removeItem("panelflow_panels");
    } catch {}
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setStartNameInput(userManualStartNameInput);
    setSystemMessage({ text: "Drawing layout removed.", type: "info" });
  };

  return (
    <div id="panel-labeling-root" className="w-full h-screen bg-[#F8F9FA] flex flex-col font-sans text-[#1A1C1E] overflow-hidden select-none relative">
      
      {/* Full screen capture overlay during active sidebar resizing */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none pointer-events-auto bg-transparent" />
      )}
      
      {/* Top Banner & Header (High Density & Collapsible Toolbar) */}
      {isHeaderCollapsed ? (
        <header id="app-header-collapsed" className="h-7 border-b border-slate-700 bg-slate-900 text-white flex items-center justify-between px-3 shrink-0 z-30 shadow-sm text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#0052CC] rounded flex items-center justify-center text-white">
              <Layers className="w-3 h-3" />
            </div>
            <span className="font-bold tracking-tight text-slate-100 text-[11px]">
              PanelLabeler <span className="text-blue-400 font-mono text-[9px] px-1 bg-slate-800 rounded">v2.5</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono border-l border-slate-700 pl-2">
              {labeledPanels.length} Panels | {groups.length} Groups
            </span>
          </div>

          <button
            onClick={() => setIsHeaderCollapsed(false)}
            className="flex items-center gap-1 text-[10px] font-semibold bg-[#0052CC] hover:bg-blue-600 px-2 py-0.5 rounded text-white transition-all shadow-xs"
            title="Expand full top toolbar"
          >
            <ChevronDown className="w-3 h-3" />
            <span>Expand Toolbar</span>
          </button>
        </header>
      ) : (
        <header
          id="app-header"
          className={`${
            isCompactToolbar ? "h-10 px-3" : "h-14 px-6"
          } border-b border-[#DDE2E5] bg-white flex items-center justify-between shrink-0 z-10 shadow-sm transition-all duration-150 select-none`}
        >
          {/* Logo & Version & Quick Project Actions */}
          <div className="flex items-center gap-3">
            <div className={`${isCompactToolbar ? "w-6 h-6" : "w-8 h-8"} bg-[#0052CC] rounded flex items-center justify-center text-white shadow-sm shrink-0 transition-all`}>
              <Layers className={`${isCompactToolbar ? "w-3.5 h-3.5" : "w-5 h-5"}`} />
            </div>
            <div className="flex items-center gap-2">
              <h1 className={`${isCompactToolbar ? "text-sm" : "text-lg"} font-bold tracking-tight text-[#002152] flex items-center gap-1.5 transition-all`}>
                PanelLabeler <span className="text-[#0052CC] font-mono text-[10px] px-1 py-0.2 bg-blue-50 border border-blue-100 rounded">v2.5</span>
              </h1>

              <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>

              {/* Save Progress Button */}
              <button
                onClick={() => handleSaveCurrentProject(projectName || "My Panel Project", projectNumber, releaseNo)}
                className={`flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded font-bold transition-all shadow-xs ${
                  isCompactToolbar ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
                }`}
                title="Save current progress instantly to browser memory"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Progress</span>
              </button>

              {/* Start New Job Button */}
              <button
                onClick={() => handleStartNewJob()}
                className={`flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded font-bold transition-all shadow-2xs active:scale-95 ${
                  isCompactToolbar ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
                }`}
                title="Auto-saves current job and opens a blank new project canvas"
              >
                <FilePlus className="w-3.5 h-3.5 text-amber-600" />
                <span>Start New Job</span>
              </button>

              {/* Open Saved Projects Modal */}
              <button
                onClick={() => setIsProjectManagerOpen(true)}
                className={`flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded font-bold transition-all shadow-xs ${
                  isCompactToolbar ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
                }`}
                title="View saved projects, backup files, or import project .json"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Projects ({savedProjects.length})</span>
              </button>
            </div>
          </div>

          {/* Controls & Action Buttons */}
          <div className={`flex items-center ${isCompactToolbar ? "gap-2" : "gap-3"}`}>
            {/* Start sequence input */}
            <div className={`flex items-center gap-1.5 bg-[#EDF1F7] ${isCompactToolbar ? "px-2 py-0.5" : "px-3 py-1"} rounded border border-[#DDE2E5]`}>
              <span className={`${isCompactToolbar ? "text-[9px]" : "text-[10px]"} font-bold text-[#5E6C84] uppercase tracking-wider`}>
                {isCompactToolbar ? "Start #" : "Start Sequence Label"}
              </span>
              <input
                id="start-name-input"
                type="text"
                value={startNameInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartNameInput(val);
                  setUserManualStartNameInput(val);
                }}
                className={`bg-transparent border-none focus:outline-none font-mono ${
                  isCompactToolbar ? "w-16 text-xs" : "w-24 text-sm"
                } text-[#0052CC] font-bold uppercase`}
                placeholder="A428"
                title="Enter starting code, e.g. A428"
              />
            </div>

            {/* AI Auto Detect Button */}
            <button
              id="run-auto-labeling-btn"
              onClick={dxfData ? importDxfPanels : runAutoDetection}
              disabled={isProcessing}
              className={`flex items-center gap-1.5 ${
                isCompactToolbar ? "px-2.5 py-1 text-xs" : "px-4 py-1.5 text-sm"
              } rounded font-semibold text-white shadow-sm transition-all ${
                isProcessing
                  ? "bg-gray-400 cursor-not-allowed"
                  : dxfData
                  ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                  : "bg-[#0052CC] hover:bg-[#0747A6] active:scale-95"
              }`}
            >
              <Sparkles className={`${isCompactToolbar ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
              <span>{dxfData ? (isCompactToolbar ? "Import CAD" : "Import CAD Panels") : (isCompactToolbar ? "Auto-Detect" : "AI Auto-Detect")}</span>
            </button>

            {/* Export Excel (Multi-sheet with Packing List, Master List, and Accessories) */}
            <button
              id="export-excel-btn"
              onClick={handleExportExcel}
              disabled={groups.length === 0}
              className={`flex items-center gap-1.5 border border-emerald-400 text-emerald-900 font-bold ${
                isCompactToolbar ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
              } rounded bg-emerald-100 hover:bg-emerald-200 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Download Complete Multi-Sheet Workbook (.xlsx) containing Packing List, Master List (Girth), and Accessories Takeoff"
            >
              <FileSpreadsheet className={`${isCompactToolbar ? "w-3.5 h-3.5" : "w-4 h-4"} text-emerald-700`} />
              <span>{isCompactToolbar ? "Packing List (.xlsx)" : "Download Packing List (.xlsx)"}</span>
            </button>

            {/* Export Master List Excel */}
            <button
              id="export-master-excel-btn"
              onClick={handleExportMasterListExcel}
              disabled={groups.length === 0}
              className={`flex items-center gap-1.5 border border-blue-400 text-blue-900 font-bold ${
                isCompactToolbar ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
              } rounded bg-blue-100 hover:bg-blue-200 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Download Master List (Panel Girth Cut Schedule with Slotted identification) as Excel Workbook (.xlsx)"
            >
              <Layers className={`${isCompactToolbar ? "w-3.5 h-3.5" : "w-4 h-4"} text-blue-700`} />
              <span>{isCompactToolbar ? "Master List (.xlsx)" : "Master List (.xlsx)"}</span>
            </button>

            {/* Export JSON */}
            <button
              id="export-json-btn"
              onClick={handleExportJSON}
              disabled={labeledPanels.length === 0}
              className={`flex items-center gap-1 border border-purple-300 text-purple-800 font-semibold ${
                isCompactToolbar ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
              } rounded bg-purple-50 hover:bg-purple-100 active:scale-95 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Export panel labels, dimensions, and positions as JSON for external project management tools"
            >
              <FileJson className={`${isCompactToolbar ? "w-3.5 h-3.5" : "w-4 h-4"} text-purple-700`} />
              <span>{isCompactToolbar ? "JSON" : "JSON Data"}</span>
            </button>

            {/* Export CAD (DXF / DWG) */}
            <button
              id="export-dxf-btn"
              onClick={() => setIsDxfExportModalOpen(true)}
              disabled={labeledPanels.length === 0}
              className={`flex items-center gap-1.5 border border-teal-300 text-teal-800 font-semibold ${
                isCompactToolbar ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
              } rounded bg-teal-50 hover:bg-teal-100 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
              title="Download named panels and boundaries as DXF (compatible with AutoCAD, DWG TrueView, SolidWorks, etc.)"
            >
              <FileCode className={`${isCompactToolbar ? "w-3.5 h-3.5" : "w-4 h-4"} text-teal-700`} />
              <span>{isCompactToolbar ? "CAD (DXF/DWG)" : "Export CAD (DXF / DWG)"}</span>
            </button>

            {/* Toolbar Density Controls */}
            <div className="flex items-center gap-1 border-l border-[#DDE2E5] pl-2 ml-1">
              <button
                onClick={() => {
                  const nextVal = !isCompactToolbar;
                  setIsCompactToolbar(nextVal);
                  localStorage.setItem("panelflow_compact_toolbar", String(nextVal));
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border transition-all ${
                  isCompactToolbar
                    ? "bg-slate-800 text-white border-slate-700"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
                title={isCompactToolbar ? "Expand toolbar height" : "Reduce top toolbar size (Compact Mode)"}
              >
                {isCompactToolbar ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                <span>{isCompactToolbar ? "Full" : "Compact"}</span>
              </button>

              <button
                onClick={() => setIsHeaderCollapsed(true)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all"
                title="Hide top toolbar for maximum drawing canvas space"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main interactive area */}
      <main id="app-workspace" className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Interactive Viewport (PDF/Image Canvas & Drag-to-Draw) */}
        <section id="layout-viewport" className="flex-1 min-w-0 bg-[#E9EBEE] flex flex-col relative">
          
          {/* Top Panel Stats and zoom bar */}
          <div className="p-3 bg-white border-b border-[#DDE2E5] flex justify-between items-center z-10 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#5E6C84] uppercase tracking-wider font-mono">
                {imageName}
              </span>
              <span className="text-[10px] bg-blue-100 text-[#0052CC] px-2 py-0.5 rounded-full font-bold">
                {labeledPanels.length} Panels
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-[#F4F5F7] p-1 rounded border border-[#DDE2E5]">
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(0.001, prev * 0.8))}
                  className="p-1 hover:bg-white rounded transition-all text-[#5E6C84]"
                  title="Zoom Out (Down to 0.1%)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold px-1 min-w-[3rem] text-center text-[#5E6C84]">
                  {zoomLevel < 0.1 ? (zoomLevel * 100).toFixed(1) : Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(20.0, prev * 1.25))}
                  className="p-1 hover:bg-white rounded transition-all text-[#5E6C84]"
                  title="Zoom In (Up to 2000%)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleZoomExtent}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0052CC] font-bold text-xs rounded border border-blue-200 transition-all shadow-2xs ml-1 cursor-pointer"
                  title="Zoom Extent: Fit entire layout in view (Shortcut: Z)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Zoom Extent</span>
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="p-1 hover:bg-white rounded transition-all text-[#5E6C84]"
                  title="Reset 100% Zoom"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".dxf,.pdf"
                className="hidden"
              />
              <input
                type="file"
                ref={dxfFileInputRef}
                onChange={handleFileChange}
                accept=".dxf"
                className="hidden"
              />
              <input
                type="file"
                ref={pdfFileInputRef}
                onChange={handleFileChange}
                accept=".pdf,application/pdf"
                className="hidden"
              />
              <input
                type="file"
                ref={excelFileInputRef}
                onChange={handleExcelImport}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-white border border-[#DDE2E5] hover:bg-[#F4F5F7] px-3 py-1 rounded text-xs font-semibold text-[#333] transition-colors shadow-sm cursor-pointer"
                title="Upload DXF or PDF blueprint layout"
              >
                <Upload className="w-3.5 h-3.5 text-[#0052CC]" />
                <span>Upload DXF / PDF</span>
              </button>

              <button
                onClick={() => excelFileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 px-3 py-1 rounded text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                title="Import existing packing list or panel schedule from Excel (.xlsx) or CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Import Excel / CSV</span>
              </button>

              <button
                onClick={clearAllPanels}
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1 rounded text-xs font-semibold text-red-700 transition-colors"
                title="Clear all bounding boxes"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>

              {(imageUrl || dxfData) && (
                <button
                  onClick={deleteUploadedFile}
                  className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-3 py-1 rounded text-xs font-semibold text-rose-700 transition-colors shadow-sm animate-fade-in"
                  title="Remove uploaded blueprint layout and clear all panels"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Delete File</span>
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Scaling Calibration Alert */}
          {dxfData && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-800 flex justify-between items-center z-10 font-medium shrink-0 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-sm select-none">⚡</span>
                <span>
                  <strong>Exact Vector CAD Scale Active:</strong> Physical sizes are mapped directly from DXF line coordinates in millimeters. Vertex snap-to-grid is enabled.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-200 rounded px-2 py-0.5 font-mono text-right select-none font-semibold">
                  CAD Bounds: {Math.round(dxfData.bounds.width)} x {Math.round(dxfData.bounds.height)} mm
                </span>
              </div>
            </div>
          )}

          {imageUrl && referencePanel && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex justify-between items-center z-10 font-medium shrink-0 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="text-sm select-none">📐</span>
                <span>
                  <strong>Dynamic Scaling Calibrated:</strong> Baseline scaled from panel{" "}
                  <span className="font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                    {referencePanel.label || "First Panel"}
                  </span>{" "}
                  ({referencePanel.realWidth} x {referencePanel.realHeight} {referencePanel.unit || "mm"}). Drawn panels will scale proportionally!
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 rounded px-2 py-0.5 font-mono text-right select-none font-semibold">
                  Scale: {Math.round(referencePanel.realWidth / referencePanel.width)} {referencePanel.unit || "mm"}/% width
                </span>
              </div>
            </div>
          )}

          {/* Interactive drawing stage */}
          <div className={`flex-1 overflow-hidden relative select-none ${
            isCadDarkMode 
              ? "bg-[#0b0b0d] bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)]" 
              : "bg-[#F4F6F8] bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)]"
          } bg-[size:24px_24px] flex flex-col justify-between`}>
            
            {(imageUrl || dxfData) ? (
              <div
                id="drawing-canvas-viewport"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDoubleClick={(e) => {
                  if (
                    e.target === e.currentTarget ||
                    (e.target as HTMLElement).id === "drawing-canvas-container" ||
                    (e.target as HTMLElement).tagName === "svg" ||
                    (e.target as HTMLElement).tagName === "IMG"
                  ) {
                    handleZoomExtent();
                  }
                }}
                className="w-full h-full relative overflow-hidden flex items-center justify-center p-16"
                style={{
                  cursor: isPanToolActive || isPanning || isSpacePressed ? "grab" : "crosshair",
                }}
              >
                {/* CAD HUD Overlay (Top Right) */}
                <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
                  <button
                    onClick={() => setIsCadDarkMode((prev) => !prev)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-semibold shadow-md flex items-center gap-1.5 hover:bg-slate-800 transition-all border border-slate-700/50"
                  >
                    {isCadDarkMode ? "☀️ Light Mode" : "🌙 Dark CAD Mode"}
                  </button>
                  <div className="bg-slate-900/90 backdrop-blur-xs text-emerald-400 font-mono text-[11px] px-3 py-1.5 rounded-md border border-slate-700/50 shadow-md flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span>CURSOR:</span>
                    <span>X: {cursorMm && !isNaN(cursorMm.x) && isFinite(cursorMm.x) ? cursorMm.x : 0} mm</span>
                    <span className="text-slate-600">|</span>
                    <span>Y: {cursorMm && !isNaN(cursorMm.y) && isFinite(cursorMm.y) ? cursorMm.y : 0} mm</span>
                  </div>
                </div>

                {/* Float Toolbar for CAD Navigation */}
                <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-xs p-1.5 rounded-lg shadow-lg border border-[#B3BAC5]">
                  <button
                    onClick={() => {
                      setIsPanToolActive(false);
                      setIsAreaSelectActive(true);
                      setActiveAccessoryDrawMode(null);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
                      !isPanToolActive && isAreaSelectActive && !activeAccessoryDrawMode
                        ? "bg-[#0052CC] text-white"
                        : "text-[#172B4D] hover:bg-gray-100"
                    }`}
                    title="Left click & drag to select multiple panels (Window/Crossing Selection)"
                  >
                    <span>↖️ Select Area</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsPanToolActive(false);
                      setIsAreaSelectActive(false);
                      setActiveAccessoryDrawMode(null);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
                      !isPanToolActive && !isAreaSelectActive && !activeAccessoryDrawMode
                        ? "bg-[#0052CC] text-white"
                        : "text-[#172B4D] hover:bg-gray-100"
                    }`}
                    title="Left click & drag to draw new panel bounding boxes"
                  >
                    <span>✏️ Draw Panel</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsPanToolActive(true);
                      setIsAreaSelectActive(false);
                      setActiveAccessoryDrawMode(null);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
                      isPanToolActive && !activeAccessoryDrawMode
                        ? "bg-[#0052CC] text-white"
                        : "text-[#172B4D] hover:bg-gray-100"
                    }`}
                    title="Left click & drag to pan layout (or hold Spacebar)"
                  >
                    <span>✋ Pan Layout</span>
                  </button>
                  
                  <div className="w-px h-5 bg-gray-200 mx-1"></div>

                  <button
                    onClick={() => setZoomLevel((prev) => Math.max(0.01, prev * 0.8))}
                    className="p-1 hover:bg-gray-100 rounded text-gray-700 text-xs font-bold font-mono"
                    title="Zoom Out (Down to 1%)"
                  >
                    ➖
                  </button>
                  <span className="text-xs font-mono font-bold text-gray-700 min-w-[3.5rem] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((prev) => Math.min(10.0, prev * 1.25))}
                    className="p-1 hover:bg-gray-100 rounded text-gray-700 text-xs font-bold font-mono"
                    title="Zoom In (Up to 1000%)"
                  >
                    ➕
                  </button>
                  
                  <button
                    onClick={handleZoomExtent}
                    className="px-2.5 py-0.5 hover:bg-blue-100 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-300 flex items-center gap-1 shadow-2xs transition-all"
                    title="Zoom Extent: Fit entire drawing and panels to screen (Shortcut: Z)"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Zoom Extent</span>
                  </button>

                  <button
                    onClick={() => {
                      setZoomLevel(1);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className="px-2 py-0.5 hover:bg-gray-100 text-gray-600 rounded text-[10px] font-bold border border-gray-200"
                    title="Restore 100% 1:1 scale"
                  >
                    100%
                  </button>

                  <div className="w-px h-5 bg-gray-200 mx-1"></div>

                  <button
                    onClick={() => setIsOrthoMode((prev) => !prev)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all flex items-center gap-1 ${
                      isOrthoMode
                        ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                    title="Lock sketches/reveals to perfectly straight horizontal/vertical lines (Ortho Mode)"
                  >
                    <span>🔒 Ortho Lock</span>
                  </button>

                  <button
                    onClick={() => setIsObjectSnapActive((prev) => !prev)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all flex items-center gap-1 ${
                      isObjectSnapActive
                        ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                    title="Snap sketches to panel edges, joints and intersections"
                  >
                    <span>🎯 Joint Snap</span>
                  </button>

                  <div className="w-px h-5 bg-gray-200 mx-1"></div>

                  <button
                    onClick={() => setShowBaseTracks((prev) => !prev)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all flex items-center gap-1 ${
                      showBaseTracks
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold"
                        : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                    }`}
                    title="Toggle Base Tracks (J-Tracks) layer visibility on layout"
                  >
                    <span>{showBaseTracks ? "👁️" : "🙈"} J-Tracks</span>
                  </button>

                  <button
                    onClick={() => setShowReveals((prev) => !prev)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all flex items-center gap-1 ${
                      showReveals
                        ? "bg-cyan-100 text-cyan-800 border-cyan-300 font-bold"
                        : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                    }`}
                    title="Toggle Joint Reveals layer visibility on layout"
                  >
                    <span>{showReveals ? "👁️" : "🙈"} Reveals</span>
                  </button>

                  <button
                    onClick={() => setShowPanelLayout((prev) => !prev)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all flex items-center gap-1 ${
                      showPanelLayout
                        ? "bg-purple-100 text-purple-800 border-purple-300 font-bold"
                        : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                    }`}
                    title="Toggle Panel Layout overlay visibility on layout (hide layout to freely draw J-Tracks and Reveals)"
                  >
                    <span>{showPanelLayout ? "👁️" : "🙈"} Panel Layout</span>
                  </button>

                  <button
                    onClick={() => setShowPanelLabels((prev) => !prev)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all flex items-center gap-1 ${
                      showPanelLabels
                        ? "bg-blue-100 text-blue-800 border-blue-300 font-bold"
                        : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                    }`}
                    title="Toggle Panel Labels layer visibility on layout"
                  >
                    <span>{showPanelLabels ? "🏷️" : "🙈"} Labels</span>
                  </button>

                  <div className="flex items-center bg-gray-100/90 rounded border border-gray-200 p-0.5 gap-0.5">
                    <span className="text-[9px] font-bold text-gray-400 px-1 uppercase tracking-wider">Borders:</span>
                    <button
                      onClick={() => setPanelBorderMode("thick")}
                      className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all ${
                        panelBorderMode === "thick"
                          ? "bg-white text-indigo-700 shadow-xs border border-indigo-200"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                      title="Thick 2px borders with subtle fill"
                    >
                      🖼️ Thick
                    </button>
                    <button
                      onClick={() => setPanelBorderMode("thin")}
                      className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all ${
                        panelBorderMode === "thin"
                          ? "bg-slate-800 text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                      title="Thin 1px hairline borders"
                    >
                      📐 Thin
                    </button>
                    <button
                      onClick={() => setPanelBorderMode("none")}
                      className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded transition-all ${
                        panelBorderMode === "none"
                          ? "bg-rose-100 text-rose-700 border border-rose-300 shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                      title="No border (0px border-width)"
                    >
                      🚫 No Border
                    </button>
                  </div>
                </div>

                <div
                  id="drawing-canvas-container"
                  ref={workspaceRef}
                  className="relative shrink-0 select-none bg-transparent border-0 shadow-none"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transformOrigin: "0 0",
                    width: "1000px",
                    height: "auto",
                    maxWidth: "none",
                    maxHeight: "none",
                    aspectRatio: dxfData ? `${dxfData.bounds.width} / ${dxfData.bounds.height}` : imageUrl ? `${imageAspectRatio}` : "16/9",
                    transition: "none"
                  }}
                >
                {/* Background layout image or vector DXF workspace */}
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Elevation drawing background"
                    className="w-full h-full object-fill pointer-events-none"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight) {
                        setImageAspectRatio(img.naturalWidth / img.naturalHeight);
                      }
                    }}
                  />
                ) : dxfData ? (
                  <div className={`absolute inset-0 w-full h-full ${isCadDarkMode ? "bg-[#141416]" : "bg-[#FAFAFA]"}`}>
                    <DxfSvgRenderer
                      dxfData={dxfData}
                      hoveredCandidateId={showPanelLayout && !activeAccessoryDrawMode ? hoveredCandidateId : null}
                      onCandidateClick={showPanelLayout && !activeAccessoryDrawMode ? toggleDxfCandidate : undefined}
                      activePanelIds={showPanelLayout ? activeCandidateIds : new Set()}
                      isDarkTheme={isCadDarkMode}
                    />
                  </div>
                ) : null}

                {/* Drawn Panels List superimposed over elevation */}
                {showPanelLayout && labeledPanels.map((panel) => {
                  const isHoveredGroup = hoveredGroupId && panel.label === hoveredGroupId;
                  const isSelected = selectedPanelIds.has(panel.id) || selectedPanelId === panel.id;
                  const isScaleRef = referencePanel && referencePanel.id === panel.id;
                  const groupColor = getGroupColor(panel.label);
                  const isDrawingAccessory = Boolean(activeAccessoryDrawMode);

                  return (
                    <div
                      key={panel.id}
                      onClick={(e) => {
                        if (isDrawingAccessory) return;
                        if (dragDistanceRef.current > 5) {
                          // Ignore click if we were dragging a selection box
                          return;
                        }
                        e.stopPropagation();
                        if (e.shiftKey || e.ctrlKey || e.metaKey) {
                          setSelectedPanelIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(panel.id)) {
                              next.delete(panel.id);
                            } else {
                              next.add(panel.id);
                            }
                            return next;
                          });
                        } else {
                          setSelectedPanelIds(new Set([panel.id]));
                          setSelectedPanelId(panel.id);
                        }
                      }}
                      className={`absolute transition-all group flex flex-col items-center justify-center cursor-pointer ${
                        isDrawingAccessory ? "pointer-events-none" : ""
                      } ${
                        intersectingPanelIds.has(panel.id)
                          ? isCadDarkMode
                            ? "border-2 border-emerald-400 bg-emerald-400/20 scale-102 ring-4 ring-emerald-400/30 z-20"
                            : "border-2 border-purple-600 bg-purple-100/50 scale-102 ring-4 ring-purple-500/50 z-20"
                          : isSelected
                          ? isCadDarkMode
                            ? "border-2 border-amber-400 bg-amber-500/10 z-20 shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-102 ring-4 ring-amber-400/40"
                            : "border-2 border-amber-500 bg-amber-50/40 z-20 shadow-lg scale-102 ring-4 ring-amber-300/50"
                          : isHoveredGroup
                          ? `border-2 ${groupColor.border} bg-[#F4F5F7]/30 z-10 shadow-md ring-4 ring-blue-500/30 scale-101`
                          : panelBorderMode === "none"
                          ? "border-0 bg-transparent shadow-none"
                          : panelBorderMode === "thin"
                          ? isCadDarkMode
                            ? "border border-sky-400/80 bg-transparent shadow-none hover:border-sky-300"
                            : `border ${groupColor.border} bg-transparent shadow-none ${groupColor.borderHover}`
                          : isCadDarkMode
                          ? "border-2 border-sky-400 bg-sky-500/5 hover:border-sky-300 hover:bg-sky-500/15"
                          : `border-2 ${groupColor.border} ${groupColor.bg} ${groupColor.borderHover}`
                      }`}
                      style={{
                        left: `${typeof panel.x === "number" && !isNaN(panel.x) ? panel.x : 0}%`,
                        top: `${typeof panel.y === "number" && !isNaN(panel.y) ? panel.y : 0}%`,
                        width: `${typeof panel.width === "number" && !isNaN(panel.width) ? panel.width : 0}%`,
                        height: `${typeof panel.height === "number" && !isNaN(panel.height) ? panel.height : 0}%`,
                      }}
                      title={`${panel.label}: ${panel.realWidth} x ${panel.realHeight} ${panel.unit || "mm"}${isScaleRef ? " (Scale Calibration Reference)" : ""}`}
                    >
                      {/* Scale calibration visual icon on reference panel */}
                      {isScaleRef && (
                        <div className="absolute top-1 left-1 bg-amber-500 text-white rounded p-0.5 text-[8px] font-bold shadow-xs flex items-center justify-center" title="Scale Calibration Base">
                          📐
                        </div>
                      )}

                      {/* Serial Label (Adaptive size on zoom, scaled for PDF export) */}
                      {showPanelLabels && (
                        <span
                          className={`font-bold font-mono tracking-tight rounded shadow-none transition-all duration-75 ${
                            isSelected 
                              ? "bg-amber-600 text-white" 
                              : groupColor.badge
                          }`}
                          style={{
                            fontSize: isExportingPdf ? "7px" : `${Math.max(4, Math.min(14, 10 / zoomLevel))}px`,
                            padding: isExportingPdf ? "0.5px 2.5px" : `${Math.max(1, 2 / zoomLevel)}px ${Math.max(2, 6 / zoomLevel)}px`,
                            maxWidth: "92%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {panel.label || "Pending"}
                        </span>
                      )}

                      {/* Slotted profile badge on canvas */}
                      {panel.isSlotted && (
                        <span 
                          className="absolute top-0.5 right-0.5 bg-cyan-700/95 text-white font-mono font-bold rounded shadow-xs select-none pointer-events-none z-10"
                          style={{
                            fontSize: `${Math.max(4, Math.min(9, 7 / zoomLevel))}px`,
                            padding: "0px 2.5px"
                          }}
                          title="Slotted Panel (Shorter Girth: +18H)"
                        >
                          ⚡ SLOT
                        </span>
                      )}

                      {/* Stiffener required badge on canvas (≥1202×1202) */}
                      {checkNeedsStiffener(panel.realWidth, panel.realHeight) && (
                        <span 
                          className="absolute bottom-0.5 right-0.5 bg-amber-600/95 text-white font-mono font-bold rounded shadow-xs select-none pointer-events-none z-10"
                          style={{
                            fontSize: `${Math.max(4, Math.min(9, 7 / zoomLevel))}px`,
                            padding: "0px 2.5px"
                          }}
                          title="Panel size ≥1202×1202: Needs stiffener"
                        >
                          🔧 STIFF
                        </span>
                      )}

                      {/* Delete Quick Button (Hidden during PDF export or accessory drawing) */}
                      {showPanelLabels && !isExportingPdf && !isDrawingAccessory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePanel(panel.id);
                          }}
                          className="absolute -top-2 -right-2 bg-red-600 text-white p-0.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-all z-30"
                          title="Delete panel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Render active dragging selection preview box (for panels/area naming) */}
                {isDrawing && drawStart && drawCurrent && !activeAccessoryDrawMode && (
                  <div
                    className={`absolute border-2 pointer-events-none transition-colors ${
                      isAreaSelectActive
                        ? drawStart.x <= drawCurrent.x
                          ? "border-solid border-[#0052CC] bg-[#0052CC]/20" // Window select (Solid Blue)
                          : "border-dashed border-emerald-500 bg-emerald-500/20" // Crossing select (Dashed Green)
                        : "border-solid border-[#0052CC] bg-[#0052CC]/10"
                    }`}
                    style={{
                      left: `${isNaN(Math.min(drawStart.x, drawCurrent.x)) ? 0 : Math.min(drawStart.x, drawCurrent.x)}%`,
                      top: `${isNaN(Math.min(drawStart.y, drawCurrent.y)) ? 0 : Math.min(drawStart.y, drawCurrent.y)}%`,
                      width: `${isNaN(Math.abs(drawStart.x - drawCurrent.x)) ? 0 : Math.abs(drawStart.x - drawCurrent.x)}%`,
                      height: `${isNaN(Math.abs(drawStart.y - drawCurrent.y)) ? 0 : Math.abs(drawStart.y - drawCurrent.y)}%`,
                    }}
                  />
                )}

                {/* Accessory Lines SVG Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-15" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                  {accessoryLinesWithLengths
                    .filter((line) => {
                      if (line.type === "base_track") return showBaseTracks;
                      return showReveals;
                    })
                    .map((line) => {
                      const isSelected = selectedLineId === line.id && !isExportingPdf;
                      let strokeColor = accessoryColors[line.type] || "#06B6D4";

                      // Scale 0..100% coordinates to 0..1000 SVG viewBox safely
                      const lx1 = typeof line.x1 === "number" && !isNaN(line.x1) ? line.x1 : 0;
                      const ly1 = typeof line.y1 === "number" && !isNaN(line.y1) ? line.y1 : 0;
                      const lx2 = typeof line.x2 === "number" && !isNaN(line.x2) ? line.x2 : 0;
                      const ly2 = typeof line.y2 === "number" && !isNaN(line.y2) ? line.y2 : 0;

                      const x1 = lx1 * 10;
                      const y1 = ly1 * 10;
                      const x2 = lx2 * 10;
                      const y2 = ly2 * 10;

                      const safeThickness = typeof accessoryLineThickness === "number" && !isNaN(accessoryLineThickness) && accessoryLineThickness >= 0 ? accessoryLineThickness : 0.0;

                      // Crisp ultra-thin hairline stroke sizing with non-scaling-stroke
                      const visualStrokeWidth = isSelected
                        ? (safeThickness === 0 ? 2.5 : Math.max(2.5, safeThickness * 2))
                        : (safeThickness === 0 ? 0.75 : Math.max(0.75, safeThickness * 1.2));

                      const fatStrokeWidth = Math.max(16, safeThickness * 10);

                      const dashPattern = line.type === "base_track"
                        ? "none"
                        : safeThickness === 0
                        ? "4 3"
                        : `${Math.max(4, safeThickness * 3.5)} ${Math.max(2.5, safeThickness * 2.5)}`;

                      return (
                        <g key={line.id} className="pointer-events-auto cursor-pointer" onClick={(e) => {
                          if (isExportingPdf) return;
                          e.stopPropagation();
                          setSelectedLineId(line.id);
                          setSelectedPanelId(null);
                          setSelectedPanelIds(new Set());
                        }}>
                          {/* Fat invisible line for easier hover/clicking */}
                          {!isExportingPdf && (
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="transparent"
                              strokeWidth={fatStrokeWidth}
                            />
                          )}
                          {/* Visual vector line */}
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={isSelected ? "#F59E0B" : strokeColor}
                            strokeWidth={visualStrokeWidth}
                            strokeDasharray={dashPattern}
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        </g>
                      );
                    })}
                </svg>

                {/* Selected line endpoint handles (crisp, non-stretching HTML dots) */}
                {selectedLineId && !isExportingPdf && (
                  (() => {
                    const line = accessoryLinesWithLengths.find(l => l.id === selectedLineId);
                    if (!line) return null;
                    if (line.type === "base_track" && !showBaseTracks) return null;
                    if (line.type !== "base_track" && !showReveals) return null;
                    const dotSize = Math.max(6, Math.min(14, 10 / zoomLevel));
                    return (
                      <>
                        <div
                          className="absolute bg-amber-500 border border-white rounded-full shadow-md pointer-events-none z-20"
                          style={{
                            left: `${line.x1}%`,
                            top: `${line.y1}%`,
                            width: `${dotSize}px`,
                            height: `${dotSize}px`,
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                        <div
                          className="absolute bg-amber-500 border border-white rounded-full shadow-md pointer-events-none z-20"
                          style={{
                            left: `${line.x2}%`,
                            top: `${line.y2}%`,
                            width: `${dotSize}px`,
                            height: `${dotSize}px`,
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      </>
                    );
                  })()
                )}

                {/* Accessory Crisp HTML Labels Layer */}
                {accessoryLinesWithLengths
                  .filter((line) => {
                    if (line.type === "base_track" && !showBaseTracks) return false;
                    if (line.type !== "base_track" && !showReveals) return false;
                    if (isExportingPdf) {
                      return showAccessoryLineBadges;
                    }
                    return showAccessoryLineBadges || selectedLineId === line.id;
                  })
                  .map((line) => {
                    const midX = (line.x1 + line.x2) / 2;
                    const midY = (line.y1 + line.y2) / 2;
                    const isSelected = selectedLineId === line.id && !isExportingPdf;

                    const labelBgColor = isSelected ? "#F59E0B" : accessoryColors[line.type] || "#06B6D4";

                    return (
                      <div
                        key={`label-${line.id}`}
                        className={`absolute font-mono pointer-events-none select-none z-20 flex items-center gap-0.5 transition-all ${
                          isExportingPdf
                            ? "px-0.8 py-0.1 rounded-xs text-[6.5px] font-semibold text-white bg-slate-900/85 border border-slate-700/60 shadow-none"
                            : "px-1 py-0.2 rounded shadow-xs text-[7.5px] text-white font-semibold"
                        }`}
                        style={{
                          left: `${midX}%`,
                          top: `${midY}%`,
                          backgroundColor: isExportingPdf ? undefined : labelBgColor,
                          border: isExportingPdf ? undefined : isSelected ? "1.5px solid #FFFFFF" : "0.5px solid rgba(255,255,255,0.4)",
                          boxShadow: isExportingPdf ? "none" : isSelected ? "0 0 8px rgba(245, 158, 11, 0.6)" : "0 1px 2px rgba(0,0,0,0.15)",
                          transform: `translate(-50%, -50%)`,
                        }}
                      >
                        {line.type === "base_track" && <span className={isExportingPdf ? "text-[6.5px]" : "text-[8px]"}>📐</span>}
                        <span>{line.realLength}mm</span>
                      </div>
                    );
                  })}

                {/* Live Drawing Accessory Line Preview */}
                {isDrawing && drawStart && drawCurrent && activeAccessoryDrawMode && (
                  <>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <line
                        x1={typeof drawStart.x === "number" && !isNaN(drawStart.x) ? drawStart.x : 0}
                        y1={typeof drawStart.y === "number" && !isNaN(drawStart.y) ? drawStart.y : 0}
                        x2={typeof drawCurrent.x === "number" && !isNaN(drawCurrent.x) ? drawCurrent.x : 0}
                        y2={typeof drawCurrent.y === "number" && !isNaN(drawCurrent.y) ? drawCurrent.y : 0}
                        stroke="#F59E0B"
                        strokeWidth={typeof accessoryLineThickness === "number" && !isNaN(accessoryLineThickness) && accessoryLineThickness > 0 ? accessoryLineThickness : 1}
                        strokeDasharray={`${Math.max(1, (isNaN(accessoryLineThickness) ? 1 : accessoryLineThickness) * 1.5)} ${Math.max(1, (isNaN(accessoryLineThickness) ? 1 : accessoryLineThickness) * 1.5)}`}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    {(() => {
                      const midX = (drawStart.x + drawCurrent.x) / 2;
                      const midY = (drawStart.y + drawCurrent.y) / 2;
                      const lengthMm = calculateLineMm(drawStart.x, drawStart.y, drawCurrent.x, drawCurrent.y);
                      return (
                        <div
                          className="absolute px-1 rounded shadow-md text-[8.5px] font-mono font-bold bg-amber-500 text-white pointer-events-none select-none z-30"
                          style={{
                            left: `${midX}%`,
                            top: `${midY}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          {lengthMm ?? 0}mm ({((lengthMm || 0) / 304.8).toFixed(1)}ft)
                        </div>
                      );
                    })()}

                    {/* Snap Target Indicator Box (endpoints are snapped to panel bounds or dxf lines) */}
                    {isObjectSnapActive && (
                      <div
                        className="absolute w-2.5 h-2.5 border-2 border-emerald-500 bg-emerald-400/40 pointer-events-none select-none z-30 animate-pulse"
                        style={{
                          left: `${drawCurrent.x}%`,
                          top: `${drawCurrent.y}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    )}
                  </>
                )}

                {/* Floating Multi-Selection Actions Bar */}
                {selectedPanelIds.size > 1 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 z-40 border border-gray-700 animate-fade-in text-xs font-sans">
                    <span className="font-bold font-mono text-amber-300 flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      {selectedPanelIds.size} panels
                    </span>
                    <div className="h-4 w-px bg-gray-700" />
                    <button
                      onClick={() => markSelectedPanelsSlotted(true)}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-2.5 py-1 rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title="Set selected panels as Slotted (Shorter girth: height +18mm)"
                    >
                      ⚡ Mark Slotted (+18H)
                    </button>
                    <button
                      onClick={() => markSelectedPanelsSlotted(false)}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-2.5 py-1 rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title="Set selected panels as Standard (Normal girth: height +36mm)"
                    >
                      ✓ Mark Standard (+36H)
                    </button>
                    <div className="h-4 w-px bg-gray-700" />
                    <button
                      onClick={() => {
                        selectedPanelIds.forEach((id) => deletePanel(id));
                        setSelectedPanelIds(new Set());
                        setSelectedPanelId(null);
                      }}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/40 px-2 py-1 rounded text-[11px] flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      title="Delete selected panels"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPanelIds(new Set());
                        setSelectedPanelId(null);
                      }}
                      className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                      title="Deselect all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
              /* Clean Empty Uploader - Upload DXF or PDF and that's it */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    processUploadedFile(e.dataTransfer.files[0]);
                  }
                }}
                className="w-full max-w-xl bg-white rounded-2xl border-2 border-dashed border-[#CBD5E1] p-10 flex flex-col items-center justify-center text-center shadow-sm mx-auto my-auto self-center transition-all animate-fade-in"
              >
                <div className="w-14 h-14 bg-blue-50 text-[#0052CC] rounded-2xl flex items-center justify-center mb-4 border border-blue-100 shadow-2xs">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-[#0F172A] mb-1.5 tracking-tight">Upload Drawing Layout</h3>
                <p className="text-sm text-[#64748B] max-w-sm mb-7">
                  Choose a vector CAD drawing or blueprint PDF file to begin labeling and takeoff.
                </p>

                {/* The 2 Primary Options: DXF or PDF */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-5">
                  {/* Option 1: DXF */}
                  <div
                    onClick={() => {
                      if (dxfFileInputRef.current) dxfFileInputRef.current.click();
                      else fileInputRef.current?.click();
                    }}
                    className="p-5 rounded-xl border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 text-left cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
                        <FileCode className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-base text-emerald-950 mb-1">Upload DXF</h4>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        Vector CAD layout (.dxf) with exact physical millimeter coordinates
                      </p>
                    </div>
                    <button className="mt-4 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors text-center shadow-xs flex items-center justify-center gap-1.5 pointer-events-none">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select DXF</span>
                    </button>
                  </div>

                  {/* Option 2: PDF */}
                  <div
                    onClick={() => {
                      if (pdfFileInputRef.current) pdfFileInputRef.current.click();
                      else fileInputRef.current?.click();
                    }}
                    className="p-5 rounded-xl border-2 border-blue-200 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/80 text-left cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between group"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-lg bg-[#0052CC] text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
                        <FileDown className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-base text-blue-950 mb-1">Upload PDF</h4>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        Architectural elevation blueprint or shop drawing (.pdf)
                      </p>
                    </div>
                    <button className="mt-4 w-full py-2 px-3 bg-[#0052CC] hover:bg-[#0747A6] text-white rounded-lg text-xs font-bold transition-colors text-center shadow-xs flex items-center justify-center gap-1.5 pointer-events-none">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Select PDF</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#94A3B8] font-medium">
                  Or drag and drop your <span className="font-semibold text-[#475569]">.dxf</span> or <span className="font-semibold text-[#475569]">.pdf</span> file here
                </p>
              </div>
            )}
          </div>

          {/* Quick-Draw Help tooltip bar */}
          <div className="p-2.5 bg-blue-50 border-t border-[#DDE2E5] flex items-center gap-2 px-4 text-xs text-blue-800 z-10 shrink-0">
            <Info className="w-4 h-4 text-[#0052CC] shrink-0" />
            <span>
              <strong>Tip:</strong> You can edit any bounding box by clicking it. To add a panel manually, click and drag over the elevation blueprint to define its dimensions.
            </span>
          </div>
        </section>

        {/* Draggable Divider Splitter */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          className={`w-1.5 hover:w-2 bg-[#DDE2E5] hover:bg-blue-400 active:bg-[#0052CC] cursor-col-resize self-stretch shrink-0 transition-all z-30 flex items-center justify-center relative ${
            isResizing ? "bg-blue-500 w-2" : ""
          }`}
          title="Drag left/right to resize the list sidebar"
        >
          {/* Visual Grip Handle */}
          <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 items-center justify-center pointer-events-none">
            <div className="w-0.5 h-1 bg-gray-400 rounded-full" />
            <div className="w-0.5 h-1 bg-gray-400 rounded-full" />
            <div className="w-0.5 h-1 bg-gray-400 rounded-full" />
            <div className="w-0.5 h-1 bg-gray-400 rounded-full" />
          </div>
        </div>

        {/* Right Side: Data Controls, Sorting, & Identical Dimensions Grouping Table */}
        <section
          id="sidebar-controls"
          className="bg-white flex flex-col shrink-0 overflow-hidden shadow-2xl relative"
          style={{ width: `${sidebarWidth}px`, minWidth: "280px" }}
        >
             {/* Section: Project & Packing List Info */}
          <div className="border-b border-[#DDE2E5] bg-[#EBF4FF] shrink-0">
            <button
              onClick={() => setIsPackingListDetailsOpen(!isPackingListDetailsOpen)}
              className="w-full py-2 px-3 flex items-center justify-between text-left hover:bg-[#E1EDFE] transition-colors focus:outline-none"
              title="Click to toggle packing list details panel"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0052CC] shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-[11px] font-bold text-[#0052CC] uppercase tracking-wider">
                    Packing List Details
                  </h2>
                  {!isPackingListDetailsOpen && (
                    <p className="text-[9px] text-[#0747A6] mt-0.5 truncate max-w-[280px]">
                      {projectName || "Untitled"} • {projectNumber || "No #"} • {releaseNo || "No Rev"}
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-[#0052CC] transition-transform duration-200 shrink-0 ${isPackingListDetailsOpen ? "rotate-180" : ""}`} />
            </button>
            
            {isPackingListDetailsOpen && (
              <div className="px-3 pb-3 pt-1 space-y-2 border-t border-blue-100/50 bg-[#F4F8FF]">
                {/* 2-column very compact grid */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-12 shrink-0">Project:</span>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Name"
                      className="bg-white border border-[#B3BAC5] px-1.5 py-0.5 rounded flex-1 font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0052CC] placeholder:text-gray-400 text-[10px]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-12 shrink-0">Number:</span>
                    <input
                      type="text"
                      value={projectNumber}
                      onChange={(e) => setProjectNumber(e.target.value)}
                      placeholder="Number"
                      className="bg-white border border-[#B3BAC5] px-1.5 py-0.5 rounded flex-1 font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0052CC] placeholder:text-gray-400 text-[10px]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-12 shrink-0">Release:</span>
                    <input
                      type="text"
                      value={releaseNo}
                      onChange={(e) => setReleaseNo(e.target.value)}
                      placeholder="Release"
                      className="bg-white border border-[#B3BAC5] px-1.5 py-0.5 rounded flex-1 font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0052CC] placeholder:text-gray-400 text-[10px]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-12 shrink-0">Manager:</span>
                    <input
                      type="text"
                      value={projectManager}
                      onChange={(e) => setProjectManager(e.target.value)}
                      placeholder="Manager"
                      className="bg-white border border-[#B3BAC5] px-1.5 py-0.5 rounded flex-1 font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0052CC] placeholder:text-gray-400 text-[10px]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-12 shrink-0">Due Date:</span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-white border border-[#B3BAC5] px-1 py-0.5 rounded flex-1 font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0052CC] text-[10px]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-500 w-12 shrink-0">Type:</span>
                    <input
                      type="text"
                      value={panelType}
                      onChange={(e) => setPanelType(e.target.value)}
                      placeholder="Type"
                      className="bg-white border border-[#B3BAC5] px-1.5 py-0.5 rounded flex-1 font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0052CC] placeholder:text-gray-400 text-[10px]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <span className="font-semibold text-gray-500 w-12 shrink-0">Colour:</span>
                    <input
                      type="text"
                      value={panelColour}
                      onChange={(e) => setPanelColour(e.target.value)}
                      placeholder="Colour Spec"
                      className="bg-white border border-[#B3BAC5] px-1.5 py-0.5 rounded flex-1 font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0052CC] placeholder:text-gray-400 text-[10px]"
                    />
                  </div>
                </div>

                {/* Packing List Quick Actions: Download & Import */}
                <div className="pt-2 border-t border-blue-200/70 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleExportExcel}
                      disabled={groups.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-2 rounded text-[11px] shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Download complete multi-sheet Excel workbook (.xlsx) containing Packing List & Accessories Takeoff sheet"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                      <span>Download Packing List (.xlsx)</span>
                    </button>
                    <button
                      onClick={handleExportCSV}
                      disabled={groups.length === 0}
                      className="flex items-center justify-center gap-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-semibold py-1.5 px-2.5 rounded text-[11px] shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                      title="Download Packing List as CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-gray-600" />
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={() => setIsDxfExportModalOpen(true)}
                      disabled={labeledPanels.length === 0}
                      className="flex items-center justify-center gap-1 bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-800 font-semibold py-1.5 px-2.5 rounded text-[11px] shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                      title="Download named panels and boundaries as DXF (AutoCAD / DWG compatible)"
                    >
                      <FileCode className="w-3.5 h-3.5 text-teal-700" />
                      <span>CAD (DXF)</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                    <span className="font-medium text-blue-900 font-mono">
                      {groups.length} groups • {labeledPanels.length} panels
                    </span>
                    <button
                      onClick={() => excelFileInputRef.current?.click()}
                      className="text-[#0052CC] hover:text-[#0747A6] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      title="Upload an Excel (.xlsx/.xls) or CSV packing list file"
                    >
                      <Upload className="w-3 h-3 text-[#0052CC]" />
                      <span>Import Excel / CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Configuration & Settings Header */}
          <div className="border-b border-[#DDE2E5] bg-[#F8F9FA] shrink-0">
            <button
              onClick={() => setIsLabelSettingsOpen(!isLabelSettingsOpen)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-gray-100 transition-colors focus:outline-none"
              title="Click to toggle label settings panel"
            >
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#0052CC]" />
                <div>
                  <h2 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                    Label Settings
                  </h2>
                  {!isLabelSettingsOpen && (
                    <p className="text-[10px] text-[#5E6C84] mt-0.5">
                      Tolerance: ±{tolerance}mm • Sort: {sortBy === "area" ? "Area" : sortBy === "width" ? "Width" : sortBy === "height" ? "Height" : "Custom"}
                    </p>
                  )}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#5E6C84] transition-transform duration-200 shrink-0 ${isLabelSettingsOpen ? "rotate-180" : ""}`} />
            </button>

            {isLabelSettingsOpen && (
              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
                <p className="text-[11px] text-[#5E6C84]">Configure identical size matching bounds</p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider mb-1">
                      Dimension Tolerance (±)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={isNaN(tolerance) ? "" : tolerance}
                        onChange={(e) => setTolerance(parseInt(e.target.value) || 0)}
                        className="w-full h-1.5 bg-[#DDE2E5] rounded-lg appearance-none cursor-pointer accent-[#0052CC]"
                      />
                      <span className="font-mono text-xs font-bold text-[#172B4D] bg-white border border-[#DDE2E5] px-1.5 py-0.5 rounded min-w-[2.5rem] text-center">
                        {tolerance}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider mb-1">
                      Sort Sequence By
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={sortBy}
                        onChange={(e: any) => setSortBy(e.target.value)}
                        className="bg-white border border-[#DDE2E5] text-xs px-2 py-1 rounded w-full font-medium text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
                      >
                        <option value="area">Area (Width * Height)</option>
                        <option value="width">Width</option>
                        <option value="height">Height</option>
                        <option value="none">No Sorting</option>
                      </select>
                      <button
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                        className="p-1 border border-[#DDE2E5] hover:bg-gray-100 rounded text-xs"
                        title={`Toggle sort order (current: ${sortOrder.toUpperCase()})`}
                      >
                        {sortOrder === "asc" ? "▲" : "▼"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Tab Selection Header */}
          <div className="flex border-b border-[#DDE2E5] bg-[#F4F5F7] shrink-0">
            <button
              onClick={() => {
                setSidebarTab("packing");
                setActiveAccessoryDrawMode(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                sidebarTab === "packing" || sidebarTab === "groups" || sidebarTab === "panels"
                  ? "border-[#0052CC] text-[#0052CC] bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Packing List
            </button>
            <button
              onClick={() => {
                setSidebarTab("master");
                setActiveAccessoryDrawMode(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                sidebarTab === "master"
                  ? "border-indigo-600 text-indigo-700 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Ruler className="w-3.5 h-3.5" /> Master List
            </button>
            <button
              onClick={() => {
                setSidebarTab("accessories");
              }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                sidebarTab === "accessories"
                  ? "border-amber-600 text-amber-700 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Construction className="w-3.5 h-3.5" /> Accessories
            </button>
          </div>

          {/* COMBINED PACKING LIST TAB (Panels & Size Groups Combined) */}
          {(sidebarTab === "packing" || sidebarTab === "groups" || sidebarTab === "panels") && (
            <div className="flex-1 flex flex-col min-h-0 bg-white">
              {/* View Switcher: Size Groups vs Individual Panels */}
              <div className="p-1.5 bg-[#F4F5F7] border-b border-[#DDE2E5] flex items-center justify-between gap-1 shrink-0">
                <div className="flex bg-[#E1E4E8] p-0.5 rounded-md gap-0.5 w-full">
                  <button
                    onClick={() => setPackingListViewMode("groups")}
                    className={`flex-1 py-1 px-2 text-[11px] font-bold rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      packingListViewMode === "groups"
                        ? "bg-white text-[#0052CC] shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Size Groups ({groups.length})</span>
                  </button>
                  <button
                    onClick={() => setPackingListViewMode("individual")}
                    className={`flex-1 py-1 px-2 text-[11px] font-bold rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      packingListViewMode === "individual"
                        ? "bg-white text-purple-700 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>All Panels ({labeledPanels.length})</span>
                  </button>
                </div>
              </div>

              {/* VIEW 1: SIZE GROUPS */}
              {packingListViewMode === "groups" && (
                <>
                  {/* Sequence Sorting Control Bar */}
                  <div className="flex items-center justify-between p-2 bg-white border-b border-[#DDE2E5] shrink-0 gap-1 flex-wrap">
                    <span className="text-[10px] font-bold text-[#5E6C84] uppercase tracking-wider pl-1">Sequence Sort:</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSortBy("area");
                          setSortOrder("desc");
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
                          sortBy === "area" && sortOrder === "desc"
                            ? "bg-[#0052CC] text-white border-[#0052CC]"
                            : "bg-white text-gray-700 border-[#DDE2E5] hover:bg-gray-50"
                        }`}
                      >
                        📐 Big to Small
                      </button>
                      <button
                        onClick={() => {
                          setSortBy("area");
                          setSortOrder("asc");
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
                          sortBy === "area" && sortOrder === "asc"
                            ? "bg-[#0052CC] text-white border-[#0052CC]"
                            : "bg-white text-gray-700 border-[#DDE2E5] hover:bg-gray-50"
                        }`}
                      >
                        📏 Small to Big
                      </button>
                      <button
                        onClick={() => {
                          setSortBy("none");
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
                          sortBy === "none"
                            ? "bg-[#0052CC] text-white border-[#0052CC]"
                            : "bg-white text-gray-700 border-[#DDE2E5] hover:bg-gray-50"
                        }`}
                        title="Custom Sequence Order via Dragging"
                      >
                        🎛️ Drag Order
                      </button>
                    </div>
                  </div>

                  {/* Packing List Download & Search Bar */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border-b border-emerald-200 shrink-0 gap-2">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1 font-mono shrink-0">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Packing List</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={handleExportExcel}
                        disabled={groups.length === 0}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow-2xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="Download complete packing list and master list as multi-sheet Excel (.xlsx)"
                      >
                        <Download className="w-3 h-3" />
                        <span>Excel</span>
                      </button>
                      <button
                        onClick={handleExportCSV}
                        disabled={groups.length === 0}
                        className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-semibold text-[10px] px-1.5 py-0.5 rounded shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                        title="Download packing list as CSV"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => setIsDxfExportModalOpen(true)}
                        disabled={groups.length === 0}
                        className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 font-semibold text-[10px] px-1.5 py-0.5 rounded shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                        title="Download named panels as DXF (AutoCAD / DWG compatible)"
                      >
                        <FileCode className="w-3 h-3 text-teal-600" />
                        <span>CAD</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Input for Groups */}
                  <div className="p-1.5 bg-white border-b border-gray-200 shrink-0">
                    <input
                      type="text"
                      placeholder="Search groups by label or size..."
                      value={packingListSearch}
                      onChange={(e) => setPackingListSearch(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 px-2 py-1 rounded text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
                    />
                  </div>

                  {/* Table Headers */}
                  <div className="grid grid-cols-12 gap-0 text-[10px] font-bold text-[#5E6C84] uppercase bg-[#F4F5F7] border-b border-[#DDE2E5] py-2 px-3 shrink-0 font-mono tracking-wider">
                    <div className="col-span-1 text-center font-bold">Drag</div>
                    <div className="col-span-3">Label ID</div>
                    <div className="col-span-4 text-right">Dimensions</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-center">Edit</div>
                  </div>

                  {/* Groups List Body */}
                  <div id="packing-list" className="flex-1 overflow-y-auto divide-y divide-[#EDF1F7]">
                    {groups.length > 0 ? (
                      groups
                        .filter((g) => {
                          if (!packingListSearch.trim()) return true;
                          const s = packingListSearch.toLowerCase().trim();
                          return (
                            g.label.toLowerCase().includes(s) ||
                            `${g.realWidth}x${g.realHeight}`.includes(s) ||
                            `${g.realWidth} x ${g.realHeight}`.includes(s)
                          );
                        })
                        .map((group, index) => {
                          const isEditingThisGroup = editPanelId === group.label;
                          const groupColor = getGroupColor(group.label);
                          const isDragged = draggedGroupIndex === index;
                          const needsStiffener = checkNeedsStiffener(group.realWidth, group.realHeight);
                          const isSlotted = Boolean(group.isSlotted || (group.panels.length > 0 && group.panels.every(p => p.isSlotted)));

                          return (
                            <div
                              key={group.label}
                              draggable
                              onDragStart={(e) => {
                                setDraggedGroupIndex(index);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedGroupIndex !== null && draggedGroupIndex !== index) {
                                  const currentKeys = groups.map((g) => `${g.realWidth}_${g.realHeight}_${Boolean(g.isSlotted)}`);
                                  const copy = [...currentKeys];
                                  const [removed] = copy.splice(draggedGroupIndex, 1);
                                  copy.splice(index, 0, removed);
                                  
                                  setCustomGroupOrder(copy);
                                  setSortBy("none");
                                  setSystemMessage({
                                    text: `Custom sequence reordered. Panel labels updated automatically on layout!`,
                                    type: "success"
                                  });
                                }
                                setDraggedGroupIndex(null);
                              }}
                              onDragEnd={() => {
                                setDraggedGroupIndex(null);
                              }}
                              onMouseEnter={() => setHoveredGroupId(group.label)}
                              onMouseLeave={() => setHoveredGroupId(null)}
                              className={`transition-colors duration-150 ${
                                hoveredGroupId === group.label ? "bg-amber-50/40" : ""
                              } ${
                                isDragged ? "opacity-30 bg-blue-50 border-dashed border border-blue-300" : ""
                              }`}
                            >
                              {/* Group Row */}
                              <div className="grid grid-cols-12 items-center px-3 py-2.5">
                                {/* Drag Handle */}
                                <div className="col-span-1 flex items-center justify-center">
                                  <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600 shrink-0" />
                                </div>

                                {/* Label ID */}
                                <div className="col-span-3 font-mono text-xs font-bold flex items-center gap-1.5 truncate">
                                  <span className={`w-2 h-2 ${groupColor.indicator} rounded-full shrink-0 shadow-xs`}></span>
                                  <span className={groupColor.text}>{group.label}</span>
                                </div>

                                {/* Dimensions + Badges */}
                                <div className="col-span-4 text-right pr-1">
                                  <div className="text-xs font-mono font-semibold text-gray-700 truncate">
                                    {group.realWidth} x {group.realHeight} {group.unit || "mm"}
                                  </div>
                                  <div className="flex items-center justify-end gap-1 mt-0.5 flex-wrap">
                                    {/* Stiffener Indicator (≥1202×1202) */}
                                    {needsStiffener && (
                                      <span
                                        className="bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded text-[9px] font-bold font-mono"
                                        title="Panel size ≥ 1202×1202: Needs stiffener"
                                      >
                                        🔧 Stiffener
                                      </span>
                                    )}
                                    {/* Slotted Profile Toggle Button */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleGroupSlotted(group.label);
                                      }}
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono transition-all cursor-pointer ${
                                        isSlotted
                                          ? "bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300"
                                          : "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
                                      }`}
                                      title={isSlotted ? "Slotted Panel (Shorter girth: +18H). Click to switch to Standard" : "Standard Panel (+36H). Click to mark as Slotted"}
                                    >
                                      {isSlotted ? "⚡ Slotted" : "Standard"}
                                    </button>
                                  </div>
                                </div>

                                {/* Qty */}
                                <div className="col-span-2 text-right font-mono">
                                  <span className={`${groupColor.badge} px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs`}>
                                    {group.panels.length}
                                  </span>
                                </div>

                                {/* Action */}
                                <div className="col-span-2 text-right">
                                  <button
                                    onClick={() => {
                                      setEditPanelId(isEditingThisGroup ? null : group.label);
                                      setModWidth(group.realWidth);
                                      setModHeight(group.realHeight);
                                      setModUnit(group.unit || "mm");
                                    }}
                                    className="text-[#0052CC] hover:text-[#0747A6] text-[10px] font-bold hover:underline cursor-pointer"
                                  >
                                    {isEditingThisGroup ? "CLOSE" : "EDIT"}
                                  </button>
                                </div>
                              </div>

                              {/* Collapsible Section for Editing and Individual Panels list */}
                              {isEditingThisGroup && (
                                <div className="bg-blue-50/50 border-t border-b border-blue-100 p-3 space-y-3 text-xs text-left" onClick={(e) => e.stopPropagation()}>
                                  {/* Modify Group Specifications Form */}
                                  <div className="space-y-1.5">
                                    <div className="font-semibold text-blue-900">
                                      Modify Specifications ({group.panels.length} panels):
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="block text-[9px] text-[#5E6C84] uppercase font-bold mb-0.5">Width</label>
                                        <input
                                          type="number"
                                          value={isNaN(modWidth) ? "" : modWidth}
                                          onChange={(e) => setModWidth(parseFloat(e.target.value))}
                                          className="w-full bg-white border border-[#DDE2E5] p-1 rounded font-mono text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] text-[#5E6C84] uppercase font-bold mb-0.5">Height</label>
                                        <input
                                          type="number"
                                          value={isNaN(modHeight) ? "" : modHeight}
                                          onChange={(e) => setModHeight(parseFloat(e.target.value))}
                                          className="w-full bg-white border border-[#DDE2E5] p-1 rounded font-mono text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] text-[#5E6C84] uppercase font-bold mb-0.5">Unit</label>
                                        <input
                                          type="text"
                                          value={modUnit}
                                          onChange={(e) => setModUnit(e.target.value)}
                                          className="w-full bg-white border border-[#DDE2E5] p-1 rounded font-mono text-xs"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-1">
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => toggleGroupSlotted(group.label, true)}
                                          className="text-[10px] bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300 px-2 py-0.5 rounded font-bold"
                                        >
                                          ⚡ Set Group Slotted (+18H)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleGroupSlotted(group.label, false)}
                                          className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-2 py-0.5 rounded font-medium"
                                        >
                                          Set Group Standard (+36H)
                                        </button>
                                      </div>
                                      <button
                                        onClick={() => {
                                          updateGroupDimensions(group.realWidth, group.realHeight, modWidth, modHeight, modUnit, group.isSlotted);
                                        }}
                                        className="bg-[#0052CC] text-white px-2.5 py-1 rounded text-[10px] font-semibold hover:bg-[#0747A6]"
                                      >
                                        Apply to Group
                                      </button>
                                    </div>
                                  </div>

                                  {/* Rename entire Group */}
                                  <div className="border-t border-blue-100 pt-2 space-y-1.5">
                                    <div className="font-semibold text-blue-900">
                                      Rename Group (Sets label override for all member panels):
                                    </div>
                                    <div className="flex gap-1.5">
                                      <input
                                        type="text"
                                        placeholder="e.g., Door Panel A, Spandrel, etc."
                                        defaultValue={group.panels[0].customLabel || ""}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            renameGroup(group.label, (e.target as HTMLInputElement).value);
                                          }
                                        }}
                                        className="flex-1 bg-white border border-[#DDE2E5] px-2 py-1 rounded font-mono text-xs focus:outline-none"
                                        id={`rename-group-input-${group.label}`}
                                      />
                                      <button
                                        onClick={() => {
                                          const el = document.getElementById(`rename-group-input-${group.label}`) as HTMLInputElement;
                                          if (el) renameGroup(group.label, el.value);
                                        }}
                                        className="bg-blue-600 text-white px-3 py-1 rounded text-[10px] font-semibold hover:bg-blue-700 shrink-0 cursor-pointer"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>

                                  {/* Clips info badge based on Excel formula */}
                                  <div className="border-t border-blue-100 pt-2.5 space-y-1.5">
                                    <div className="p-2 bg-purple-50/80 border border-purple-100 rounded-md space-y-1 text-purple-900 text-[11px] font-sans">
                                      <div className="font-bold flex items-center justify-between">
                                        <span className="flex items-center gap-1">📋 Clip Count ({clipCalculationMethod === "excel" ? "Excel Formula" : "Grid Spacing"}):</span>
                                        <span className="font-mono text-xs bg-purple-200/60 px-1.5 py-0.5 rounded font-bold text-purple-800">
                                          {clipCalculationMethod === "excel" ? (
                                            (() => {
                                              const w = group.realWidth;
                                              const h = group.realHeight;
                                              const wClips = w <= 100 ? 1 : 2 + Math.ceil((w - 100) / 600);
                                              const hClips = (h <= 100 ? 1 : 2 + Math.ceil((h - 100) / 600)) * 2;
                                              return (wClips + hClips) * group.panels.length;
                                            })()
                                          ) : (
                                            (() => {
                                              const spacing_mm = clipsSpacing * 25.4;
                                              const topBottomClips = Math.max(2, Math.ceil(group.realWidth / spacing_mm) + 1);
                                              const leftRightClips = Math.max(2, Math.ceil(group.realHeight / spacing_mm) + 1);
                                              return (2 * topBottomClips + 2 * leftRightClips) * group.panels.length;
                                            })()
                                          )} pcs
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* List of Member Panels */}
                                  <div className="border-t border-blue-100 pt-2 space-y-1.5">
                                    <div className="text-[10px] uppercase tracking-wider font-bold text-blue-800 flex items-center justify-between">
                                      <span>Individual Member Panels ({group.panels.length}):</span>
                                      <span className="text-[9px] text-gray-500 font-normal">Click panel to select on canvas</span>
                                    </div>
                                    <div className="space-y-1 max-h-48 overflow-y-auto bg-white p-1.5 rounded border border-blue-100">
                                      {group.panels.map((p, pIdx) => {
                                        const isSelected = selectedPanelId === p.id;
                                        return (
                                          <div
                                            key={p.id}
                                            onClick={() => setSelectedPanelId(p.id)}
                                            className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors border ${
                                              isSelected
                                                ? "bg-amber-100/80 border-amber-300 text-amber-900 font-medium"
                                                : "hover:bg-blue-50 border-transparent text-gray-700"
                                            }`}
                                            title="Click to select & highlight on canvas"
                                          >
                                            <div className="flex flex-col min-w-0 pr-2">
                                              <span className="font-mono text-[10px] font-bold text-gray-800 truncate">
                                                {p.customLabel || p.label || `Panel-${pIdx + 1}`}
                                              </span>
                                              <div className="flex items-center gap-1.5 text-[8px] text-gray-500 font-mono">
                                                <span>Pos: ({(p.x ?? 0).toFixed(0)}%, {(p.y ?? 0).toFixed(0)}%)</span>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePanelSlotted(p.id);
                                                  }}
                                                  className={`px-1 py-0.2 rounded font-bold ${
                                                    p.isSlotted
                                                      ? "bg-cyan-100 text-cyan-800 border border-cyan-300"
                                                      : "bg-gray-100 text-gray-600 border border-gray-200"
                                                  }`}
                                                >
                                                  {p.isSlotted ? "⚡ Slotted" : "Standard"}
                                                </button>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                              <input
                                                type="text"
                                                placeholder={p.label || "Rename..."}
                                                defaultValue={p.customLabel || ""}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    renamePanel(p.id, (e.target as HTMLInputElement).value);
                                                  }
                                                }}
                                                className="px-1 py-0.5 text-[9px] border border-gray-300 rounded font-mono bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-24"
                                                id={`rename-panel-${p.id}`}
                                              />
                                              <button
                                                onClick={() => {
                                                  const el = document.getElementById(`rename-panel-${p.id}`) as HTMLInputElement;
                                                  if (el) renamePanel(p.id, el.value);
                                                }}
                                                className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-[9px] px-1.5 py-0.5 rounded font-semibold text-gray-700 cursor-pointer"
                                              >
                                                Save
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  deletePanel(p.id);
                                                }}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                                                title="Delete Panel"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                    ) : (
                      <div className="p-8 text-center text-sm text-[#5E6C84]">
                        No panels mapped yet. Add panels manually by clicking and dragging on the layout canvas, or run AI Auto-Detect on your uploaded blueprint.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* VIEW 2: ALL INDIVIDUAL PANELS (COMBINED VIEW) */}
              {packingListViewMode === "individual" && (
                <div className="flex-1 overflow-y-auto divide-y divide-[#EDF1F7] bg-white flex flex-col">
                  {/* Top action bar */}
                  <div className="p-2.5 bg-gray-50 border-b border-[#DDE2E5] flex items-center justify-between gap-2 shrink-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#5E6C84] font-bold">
                      Individual Layout Panels ({labeledPanels.length})
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setIsDxfExportModalOpen(true)}
                        disabled={labeledPanels.length === 0}
                        className="flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-2 py-1 rounded text-[10px] font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                        title="Export panels as DXF (AutoCAD / DWG compatible)"
                      >
                        <FileCode className="w-3.5 h-3.5 text-teal-600" />
                        <span>CAD (DXF)</span>
                      </button>
                      <button
                        id="sidebar-export-json-btn"
                        onClick={handleExportJSON}
                        disabled={labeledPanels.length === 0}
                        className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 rounded text-[10px] font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                        title="Export a JSON file of all panel data including labels, dimensions, and positions"
                      >
                        <FileJson className="w-3.5 h-3.5 text-purple-600" />
                        <span>JSON</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Input for Individual Panels */}
                  <div className="p-1.5 bg-white border-b border-gray-200 shrink-0">
                    <input
                      type="text"
                      placeholder="Search panels by label or size..."
                      value={packingListSearch}
                      onChange={(e) => setPackingListSearch(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 px-2 py-1 rounded text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
                    />
                  </div>

                  {/* Panels List Body */}
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                    {labeledPanels.length > 0 ? (
                      labeledPanels
                        .filter((p) => {
                          if (!packingListSearch.trim()) return true;
                          const s = packingListSearch.toLowerCase().trim();
                          const lbl = (p.customLabel || p.label || "").toLowerCase();
                          return lbl.includes(s) || `${p.realWidth}x${p.realHeight}`.includes(s);
                        })
                        .map((p, idx) => {
                          const isSelected = selectedPanelId === p.id;
                          const groupColor = getGroupColor(p.label || "A");
                          const needsStiffener = checkNeedsStiffener(p.realWidth, p.realHeight);

                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedPanelId(p.id);
                                setSelectedPanelIds(new Set([p.id]));
                                setSelectedLineId(null);
                              }}
                              className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors border-b border-gray-100 ${
                                isSelected ? "bg-amber-50" : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-2.5 h-2.5 rounded-full ${groupColor.indicator} shrink-0 shadow-xs`}></span>
                                <div className="min-w-0 text-left">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs font-bold text-gray-900 truncate">
                                      {p.customLabel || p.label || `Panel-${idx+1}`}
                                    </span>
                                    {needsStiffener && (
                                      <span className="bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded text-[8px] font-bold font-mono">
                                        🔧 Stiffener
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] text-gray-500 font-mono">
                                      Size: {p.realWidth} x {p.realHeight} {p.unit || "mm"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        togglePanelSlotted(p.id);
                                      }}
                                      className={`px-1 py-0.2 rounded text-[8.5px] font-mono font-bold transition-all cursor-pointer ${
                                        p.isSlotted
                                          ? "bg-cyan-100 text-cyan-800 border border-cyan-300"
                                          : "bg-gray-100 text-gray-600 border border-gray-200"
                                      }`}
                                      title={p.isSlotted ? "Slotted (+18H). Click to set standard" : "Standard (+36H). Click to set slotted"}
                                    >
                                      {p.isSlotted ? "⚡ Slotted" : "Standard"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  placeholder="Label Override"
                                  defaultValue={p.customLabel || ""}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      renamePanel(p.id, (e.target as HTMLInputElement).value);
                                    }
                                  }}
                                  className="px-1.5 py-0.5 text-[10px] border border-gray-300 rounded font-mono bg-white focus:outline-none w-20"
                                  id={`all-panels-rename-${p.id}`}
                                />
                                <button
                                  onClick={() => {
                                    const el = document.getElementById(`all-panels-rename-${p.id}`) as HTMLInputElement;
                                    if (el) renamePanel(p.id, el.value);
                                  }}
                                  className="bg-gray-100 border border-gray-300 text-[9px] px-1.5 py-0.5 rounded font-semibold text-gray-700 hover:bg-gray-200 cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => deletePanel(p.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div className="p-8 text-center text-gray-500 text-xs font-sans">
                        No panels mapped yet. Add panels manually or run AI Auto-Detect on your uploaded blueprint.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DEDICATED MASTER LIST TAB (Fabrication Girth Blank Schedule) */}
          {sidebarTab === "master" && (
            <div className="flex-1 flex flex-col min-h-0 bg-white">
              {/* Header Title & Info Banner */}
              <div className="p-3 bg-indigo-50/80 border-b border-indigo-200 space-y-2 shrink-0 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-indigo-700" />
                    <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                      Master List (Girth Blank Cut Sizes)
                    </span>
                  </div>
                  <button
                    onClick={() => setIsMasterListSettingsOpen(!isMasterListSettingsOpen)}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-2xs cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>{isMasterListSettingsOpen ? "Hide Settings" : "Girth Settings"}</span>
                  </button>
                </div>

                {/* Clear explanation of user's rules */}
                <div className="p-2 bg-white rounded border border-indigo-100 text-[11px] text-gray-700 space-y-1">
                  <div className="font-semibold text-indigo-900 flex items-center justify-between">
                    <span>⚡ Slotted Panel Shorter Girth Rule:</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-mono font-bold">
                      Height +18mm vs Standard +36mm
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-600 leading-snug">
                    Standard panels add <strong>+{masterListSettings.widthAllowance}W</strong> (+18 each side) & <strong>+{masterListSettings.normalHeightAllowance}H</strong> (+18×2). Slotted panels have shorter girth: they add only <strong>+{masterListSettings.slottedHeightAllowance}H</strong> (+18 flange return).
                  </p>
                  <p className="text-[10px] text-indigo-800 font-mono bg-indigo-50/60 p-1 rounded">
                    Example: Size 1211 (196+1015) × 1348 mm → Girth 1247 × 1366 mm (Slotted) vs 1247 × 1384 mm (Standard).
                  </p>
                  <div className="text-[10px] text-amber-800 font-semibold flex items-center gap-1 pt-0.5 border-t border-indigo-50">
                    <span>🔧 Stiffener Rule:</span>
                    <span>Any packing list size ≥ 1202×1202 mm automatically tagged "Needs stiffener".</span>
                  </div>
                </div>

                {/* Collapsible Girth Settings Accordion */}
                {isMasterListSettingsOpen && (
                  <div className="p-2.5 bg-white rounded border border-indigo-200 space-y-2 text-xs">
                    <span className="font-bold text-indigo-900 block text-[11px] uppercase tracking-wider">
                      Fabrication Flange Allowances (mm)
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="block text-[9px] text-gray-500 font-bold uppercase mb-0.5">Return Flange</label>
                        <input
                          type="number"
                          value={masterListSettings.returnAllowance}
                          onChange={(e) => setMasterListSettings({ ...masterListSettings, returnAllowance: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-gray-50 border border-gray-300 p-1 rounded font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-gray-500 font-bold uppercase mb-0.5">Total Width Allowance</label>
                        <input
                          type="number"
                          value={masterListSettings.widthAllowance}
                          onChange={(e) => setMasterListSettings({ ...masterListSettings, widthAllowance: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-gray-50 border border-gray-300 p-1 rounded font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-cyan-700 font-bold uppercase mb-0.5">Slotted Height (+18)</label>
                        <input
                          type="number"
                          value={masterListSettings.slottedHeightAllowance}
                          onChange={(e) => setMasterListSettings({ ...masterListSettings, slottedHeightAllowance: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-cyan-50 border border-cyan-300 p-1 rounded font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-gray-600 font-bold uppercase mb-0.5">Standard Height (+36)</label>
                        <input
                          type="number"
                          value={masterListSettings.normalHeightAllowance}
                          onChange={(e) => setMasterListSettings({ ...masterListSettings, normalHeightAllowance: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-gray-50 border border-gray-300 p-1 rounded font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Master List Download & Actions Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-100/60 border-b border-indigo-200 shrink-0 gap-1 flex-wrap">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1 font-mono">
                  <Download className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Export Master List</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleExportMasterListExcel}
                    disabled={groups.length === 0}
                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                    title="Export standalone Master List (.xlsx) with Girth blank cut sizes, areas, and stiffener notes"
                  >
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={handleExportMasterListCSV}
                    disabled={groups.length === 0}
                    className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-semibold text-[10px] px-1.5 py-0.5 rounded shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                    title="Export Master List as CSV"
                  >
                    CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={groups.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                    title="Export full multi-sheet Excel workbook with Packing List + Master List + Accessories"
                  >
                    Full Workbook
                  </button>
                </div>
              </div>

              {/* Filter Tabs & Bulk Actions */}
              <div className="p-2 bg-gray-50 border-b border-gray-200 space-y-1.5 shrink-0 text-left">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  {/* Filter chips */}
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => setMasterListFilter("all")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        masterListFilter === "all"
                          ? "bg-indigo-700 text-white shadow-2xs"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      All ({groups.length})
                    </button>
                    <button
                      onClick={() => setMasterListFilter("slotted")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        masterListFilter === "slotted"
                          ? "bg-cyan-700 text-white shadow-2xs"
                          : "bg-white text-cyan-800 border border-cyan-200 hover:bg-cyan-50"
                      }`}
                    >
                      ⚡ Slotted ({groups.filter(g => g.isSlotted || (g.panels.length > 0 && g.panels.every(p => p.isSlotted))).length})
                    </button>
                    <button
                      onClick={() => setMasterListFilter("standard")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        masterListFilter === "standard"
                          ? "bg-gray-700 text-white shadow-2xs"
                          : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      Standard ({groups.filter(g => !g.isSlotted && !(g.panels.length > 0 && g.panels.every(p => p.isSlotted))).length})
                    </button>
                    <button
                      onClick={() => setMasterListFilter("stiffener")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        masterListFilter === "stiffener"
                          ? "bg-amber-600 text-white shadow-2xs"
                          : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
                      }`}
                    >
                      🔧 Stiffener ({groups.filter(g => checkNeedsStiffener(g.realWidth, g.realHeight)).length})
                    </button>
                  </div>

                  {/* Bulk Mark Slotted / Standard */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => markAllPanelsSlotted(true)}
                      className="text-[9px] bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer"
                      title="Set all panels in project as Slotted (+18H)"
                    >
                      All Slotted
                    </button>
                    <button
                      onClick={() => markAllPanelsSlotted(false)}
                      className="text-[9px] bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 px-1.5 py-0.5 rounded font-medium transition-all cursor-pointer"
                      title="Set all panels in project as Standard (+36H)"
                    >
                      All Standard
                    </button>
                  </div>
                </div>

                {/* Search Input for Master List */}
                <input
                  type="text"
                  placeholder="Filter master list by label or dimensions..."
                  value={masterListSearch}
                  onChange={(e) => setMasterListSearch(e.target.value)}
                  className="w-full bg-white border border-gray-300 px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Master List Schedule Body */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {groups.length > 0 ? (
                  groups
                    .filter((group) => {
                      const isSlotted = Boolean(group.isSlotted || (group.panels.length > 0 && group.panels.every(p => p.isSlotted)));
                      const needsStiffener = checkNeedsStiffener(group.realWidth, group.realHeight);

                      if (masterListFilter === "slotted" && !isSlotted) return false;
                      if (masterListFilter === "standard" && isSlotted) return false;
                      if (masterListFilter === "stiffener" && !needsStiffener) return false;

                      if (!masterListSearch.trim()) return true;
                      const s = masterListSearch.toLowerCase().trim();
                      return (
                        group.label.toLowerCase().includes(s) ||
                        `${group.realWidth}x${group.realHeight}`.includes(s) ||
                        `${group.realWidth} x ${group.realHeight}`.includes(s)
                      );
                    })
                    .map((group) => {
                      const groupColor = getGroupColor(group.label);
                      const isSlotted = Boolean(group.isSlotted || (group.panels.length > 0 && group.panels.every(p => p.isSlotted)));
                      const girth = calculateGirth(group.realWidth, group.realHeight, isSlotted, masterListSettings);
                      const needsStiffener = checkNeedsStiffener(group.realWidth, group.realHeight);
                      const areaM2 = ((girth.girthWidth * girth.girthHeight) / 1000000) * group.panels.length;
                      const areaSqFt = ((girth.girthWidth * girth.girthHeight) / 92903.04) * group.panels.length;
                      const isExpanded = editPanelId === `ml-${group.label}`;

                      return (
                        <div key={`master-${group.label}`} className="p-3 hover:bg-indigo-50/20 transition-colors text-left space-y-2">
                          {/* Top Row: Label, Qty, Profile Button */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${groupColor.indicator} shrink-0 shadow-xs`} />
                              <span className="font-mono text-xs font-bold text-gray-900">
                                {group.label}
                              </span>
                              <span className={`${groupColor.badge} px-2 py-0.2 rounded-full text-[10px] font-bold font-mono shadow-xs`}>
                                Qty: {group.panels.length}
                              </span>
                            </div>

                            {/* One-click profile identifier toggle */}
                            <button
                              type="button"
                              onClick={() => toggleGroupSlotted(group.label)}
                              className={`px-2.5 py-1 rounded text-[10.5px] font-bold font-mono transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 ${
                                isSlotted
                                  ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                              }`}
                              title="Click to toggle between Slotted (shorter girth: +18H) and Standard (+36H)"
                            >
                              <span>{isSlotted ? "⚡ SLOTTED PANEL" : "🏷️ STANDARD PANEL"}</span>
                              <span className="text-[9px] opacity-80">({isSlotted ? "+18H" : "+36H"})</span>
                            </button>
                          </div>

                          {/* Dimensions Comparison Grid */}
                          <div className="grid grid-cols-2 gap-2 bg-gray-50/80 p-2 rounded border border-gray-200 text-xs font-mono">
                            {/* Packing List Finished Size */}
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-gray-500 font-bold uppercase block">Packing List Size:</span>
                              <span className="text-gray-800 font-bold block">
                                {group.realWidth} × {group.realHeight} {group.unit || "mm"}
                              </span>
                              {needsStiffener && (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                  🔧 Needs stiffener (≥1202×1202)
                                </span>
                              )}
                            </div>

                            {/* Fabrication Girth Blank Cut Size */}
                            <div className="space-y-0.5 text-right">
                              <span className="text-[9px] text-indigo-700 font-bold uppercase block">Girth Blank Cut Size:</span>
                              <span className="text-indigo-900 font-extrabold text-xs block">
                                {girth.girthWidth} × {girth.girthHeight} mm
                              </span>
                              <span className="text-[9.5px] text-gray-500 block">
                                {girth.formulaNote}
                              </span>
                            </div>
                          </div>

                          {/* Bottom Row: Total Blank Area & Expand details */}
                          <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono pt-1">
                            <div>
                              <span>Total Blank Area: </span>
                              <strong className="text-gray-800">{areaM2.toFixed(2)} m²</strong>
                              <span className="text-gray-400"> ({areaSqFt.toFixed(1)} sq ft)</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setEditPanelId(isExpanded ? null : `ml-${group.label}`)}
                              className="text-indigo-600 hover:text-indigo-800 font-bold text-[10px] cursor-pointer"
                            >
                              {isExpanded ? "Hide Member Panels" : `Show ${group.panels.length} Panels`}
                            </button>
                          </div>

                          {/* Expanded Member Panels List for individual toggling */}
                          {isExpanded && (
                            <div className="mt-2 p-2 bg-indigo-50/50 rounded border border-indigo-100 space-y-1.5">
                              <div className="text-[10px] font-bold text-indigo-900 uppercase">
                                Individual Panels in Group {group.label}:
                              </div>
                              <div className="space-y-1 max-h-36 overflow-y-auto">
                                {group.panels.map((p, pIdx) => (
                                  <div
                                    key={p.id}
                                    onClick={() => setSelectedPanelId(p.id)}
                                    className="p-1.5 bg-white rounded border border-gray-200 flex items-center justify-between cursor-pointer hover:border-indigo-300"
                                  >
                                    <span className="text-[10px] font-mono font-bold text-gray-800">
                                      {p.customLabel || p.label || `Panel-${pIdx + 1}`}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePanelSlotted(p.id);
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                                          p.isSlotted
                                            ? "bg-cyan-100 text-cyan-800 border border-cyan-300"
                                            : "bg-gray-100 text-gray-600 border border-gray-200"
                                        }`}
                                      >
                                        {p.isSlotted ? "⚡ Slotted" : "Standard"}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="p-8 text-center text-sm text-gray-500">
                    No panels mapped yet to calculate girth.
                  </div>
                )}
              </div>

              {/* Master List Summary Bar */}
              <div className="p-3 bg-indigo-900 text-white border-t border-indigo-950 shrink-0 text-left font-mono text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-indigo-200">Total Panels:</span>
                  <span className="font-bold">{labeledPanels.length} panels</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-200">Slotted vs Standard:</span>
                  <span className="font-bold text-cyan-300">
                    {labeledPanels.filter(p => p.isSlotted).length} Slotted · {labeledPanels.filter(p => !p.isSlotted).length} Standard
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-200">Panels Needing Stiffeners:</span>
                  <span className="font-bold text-amber-300">
                    {labeledPanels.filter(p => checkNeedsStiffener(p.realWidth, p.realHeight)).length} panels
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-indigo-800 text-xs">
                  <span className="text-indigo-200 font-bold">Total Girth Blank Area:</span>
                  <span className="font-extrabold text-white">
                    {(
                      groups.reduce((acc, g) => {
                        const isSlotted = Boolean(g.isSlotted || (g.panels.length > 0 && g.panels.every(p => p.isSlotted)));
                        const girth = calculateGirth(g.realWidth, g.realHeight, isSlotted, masterListSettings);
                        return acc + ((girth.girthWidth * girth.girthHeight) / 1000000) * g.panels.length;
                      }, 0)
                    ).toFixed(2)} m²
                  </span>
                </div>
              </div>
            </div>
          )}

          {sidebarTab === "accessories" && (
            <div className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-white">
              {/* Accessories tab UI Panel */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
                {/* Drawing and Auto-Generation controls block */}
                <div className="bg-[#FAFBFC] border border-[#DDE2E5] p-3.5 rounded-lg space-y-3 shadow-xs">
                  <div className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
                    <Construction className="w-4 h-4 text-amber-600" />
                    <span>Line Sketching Tools</span>
                  </div>
                  <p className="text-[11px] text-[#5E6C84]">
                    Select a tool below, then click and drag on the layout canvas to draw lengths. 
                    <strong className="text-amber-700"> Hold Shift for Ortho (straight line) snap.</strong> Press <strong className="text-red-700">Esc</strong> to exit tool.
                  </p>

                  {/* Ortho Lock & Object Snap Control Checks */}
                  <div className="grid grid-cols-2 gap-2 p-2 bg-white border border-gray-200 rounded-md text-[10.5px]">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none font-semibold text-amber-800">
                      <input
                        type="checkbox"
                        checked={isOrthoMode}
                        onChange={(e) => setIsOrthoMode(e.target.checked)}
                        className="rounded border-gray-300 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                      />
                      <span>🔒 Ortho Lock</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none font-semibold text-emerald-800">
                      <input
                        type="checkbox"
                        checked={isObjectSnapActive}
                        onChange={(e) => setIsObjectSnapActive(e.target.checked)}
                        className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                      <span>🎯 Joint Snap</span>
                    </label>
                  </div>

                  {/* Button Tool Selector Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <button
                      onClick={() => {
                        setActiveAccessoryDrawMode(activeAccessoryDrawMode === "reveal_5_8" ? null : "reveal_5_8");
                        setIsPanToolActive(false);
                        setIsAreaSelectActive(false);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded font-semibold border-2 text-left transition-all ${
                        activeAccessoryDrawMode === "reveal_5_8"
                          ? "bg-[#E0F2FE] border-cyan-500 text-cyan-950 font-bold"
                          : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block border border-cyan-600"></span>
                      <span>5/8" Joint Reveal</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveAccessoryDrawMode(activeAccessoryDrawMode === "reveal_3_4" ? null : "reveal_3_4");
                        setIsPanToolActive(false);
                        setIsAreaSelectActive(false);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded font-semibold border-2 text-left transition-all ${
                        activeAccessoryDrawMode === "reveal_3_4"
                          ? "bg-[#E0F2FE] border-indigo-500 text-indigo-950 font-bold"
                          : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block border border-indigo-600"></span>
                      <span>3/4" Joint Reveal</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveAccessoryDrawMode(activeAccessoryDrawMode === "reveal_custom" ? null : "reveal_custom");
                        setIsPanToolActive(false);
                        setIsAreaSelectActive(false);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded font-semibold border-2 text-left transition-all ${
                        activeAccessoryDrawMode === "reveal_custom"
                          ? "bg-[#E0F2FE] border-rose-500 text-rose-950 font-bold"
                          : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block border border-rose-600"></span>
                      <span>Custom Reveal</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveAccessoryDrawMode(activeAccessoryDrawMode === "base_track" ? null : "base_track");
                        setIsPanToolActive(false);
                        setIsAreaSelectActive(false);
                      }}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded font-semibold border-2 text-left transition-all ${
                        activeAccessoryDrawMode === "base_track"
                          ? "bg-[#E0F2FE] border-emerald-500 text-emerald-950 font-bold"
                          : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-emerald-600"></span>
                      <span>Base Track</span>
                    </button>
                  </div>

                  {activeAccessoryDrawMode && (
                    <div className="bg-amber-50 text-amber-950 p-2 rounded text-[10px] font-medium border border-amber-200 flex justify-between items-center animate-pulse">
                      <span>Active: Drawing {activeAccessoryDrawMode === "base_track" ? "Base Track" : "Reveals"}...</span>
                      <button onClick={() => setActiveAccessoryDrawMode(null)} className="text-amber-800 font-bold hover:underline">Cancel</button>
                    </div>
                  )}

                  {/* Panel layout hide/show toggle button for clean sketch workspace */}
                  <div className="flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded-md text-xs font-semibold text-purple-900">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <span>🖼️</span> Panel Layout Overlay
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPanelLayout((prev) => !prev)}
                      className={`px-2 py-1 text-[10.5px] font-bold rounded transition-all shadow-2xs ${
                        showPanelLayout
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {showPanelLayout ? "Hide Panel Layout" : "Show Panel Layout"}
                    </button>
                  </div>

                  {/* Auto generator row */}
                  <div className="flex gap-2 pt-1 border-t border-gray-200">
                    <button
                      onClick={autoGenerateReveals}
                      className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0052CC] rounded text-[10px] font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      ⚡ Auto-Joints
                    </button>
                    <button
                      onClick={autoGenerateBaseTracks}
                      className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded text-[10px] font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      ⚡ Auto-Base
                    </button>
                    <button
                      onClick={clearAllAccessories}
                      className="py-1.5 px-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded text-[10px] font-bold transition-colors"
                      title="Clear all line markings"
                    >
                      🗑️ Clear
                    </button>
                  </div>
                </div>

                {/* Display Layers & Styling block */}
                <div className="bg-[#FAFBFC] border border-[#DDE2E5] p-3.5 rounded-lg space-y-3 shadow-xs">
                  <div className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-cyan-600" />
                    <span>Display Layers & Line Styling</span>
                  </div>
                  <p className="text-[11px] text-[#5E6C84]">
                    Toggle layer visibility or adjust thickness to unclutter your workspace view.
                  </p>

                  {/* Toggle controls */}
                  <div className="space-y-2 p-2 bg-white border border-gray-200 rounded-md text-[11px]">
                    <label className="flex items-center justify-between cursor-pointer select-none font-medium text-gray-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: accessoryColors.base_track }}></span>
                        Show J-Tracks / Base Tracks
                      </span>
                      <input
                        type="checkbox"
                        checked={showBaseTracks}
                        onChange={(e) => setShowBaseTracks(e.target.checked)}
                        className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 w-3.5 h-3.5"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer select-none font-medium text-gray-700 pt-1.5 border-t border-gray-100">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: accessoryColors.reveal_5_8 }}></span>
                        Show Joint Reveals
                      </span>
                      <input
                        type="checkbox"
                        checked={showReveals}
                        onChange={(e) => setShowReveals(e.target.checked)}
                        className="rounded border-gray-300 text-cyan-500 focus:ring-cyan-500 w-3.5 h-3.5"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer select-none font-medium text-gray-700 pt-1.5 border-t border-gray-100">
                      <span className="flex items-center gap-1.5 font-semibold text-purple-900">
                        <span className="text-xs">🖼️</span>
                        Show Panel Layout Overlay
                      </span>
                      <input
                        type="checkbox"
                        checked={showPanelLayout}
                        onChange={(e) => setShowPanelLayout(e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer select-none font-medium text-gray-700 pt-1.5 border-t border-gray-100">
                      <span className="flex items-center gap-1.5 font-semibold text-blue-800">
                        <span className="text-xs">🏷️</span>
                        Show Panel Labels
                      </span>
                      <input
                        type="checkbox"
                        checked={showPanelLabels}
                        onChange={(e) => setShowPanelLabels(e.target.checked)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                    </label>

                    <div className="pt-2 border-t border-gray-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold text-indigo-900 text-xs">
                          <span className="text-xs">🔳</span>
                          Panel Border Style
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {panelBorderMode === "thick" ? "2px + Tint" : panelBorderMode === "thin" ? "1px Hairline" : "0px (No Border)"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg text-xs">
                        <button
                          type="button"
                          onClick={() => setPanelBorderMode("thick")}
                          className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all ${
                            panelBorderMode === "thick"
                              ? "bg-white text-indigo-700 shadow-xs font-bold"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          🖼️ Thick
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanelBorderMode("thin")}
                          className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all ${
                            panelBorderMode === "thin"
                              ? "bg-slate-800 text-white shadow-xs font-bold"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          📐 Thin
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanelBorderMode("none")}
                          className={`py-1.5 px-2 rounded-md font-semibold text-center transition-all ${
                            panelBorderMode === "none"
                              ? "bg-rose-600 text-white shadow-xs font-bold"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          🚫 No Border
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center justify-between cursor-pointer select-none font-medium text-gray-700 pt-1.5 border-t border-gray-100">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <span className="text-xs">📏</span>
                        Show Line Segment Length Badges
                      </span>
                      <input
                        type="checkbox"
                        checked={showAccessoryLineBadges}
                        onChange={(e) => setShowAccessoryLineBadges(e.target.checked)}
                        className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer select-none font-medium text-gray-700 pt-1.5 border-t border-gray-100">
                      <span className="flex items-center gap-1.5 font-semibold text-indigo-900">
                        <span className="text-xs">🎨</span>
                        Include Page 2 Legend & Schedule in PDF
                      </span>
                      <input
                        type="checkbox"
                        checked={showLegendOnExport}
                        onChange={(e) => setShowLegendOnExport(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                    </label>
                  </div>

                  {/* Line thickness slider */}
                  <div className="p-2 bg-white border border-gray-200 rounded-md space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-gray-700 font-medium">
                      <span>📏 Line & Joint Thickness</span>
                      <span className="font-mono bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {(accessoryLineThickness ?? 0.0) === 0 ? "0.0 mm (No Thickness)" : `${(accessoryLineThickness).toFixed(1)} px`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="5.0"
                      step="0.5"
                      value={accessoryLineThickness}
                      onChange={(e) => setAccessoryLineThickness(parseFloat(e.target.value))}
                      className="w-full accent-cyan-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                      <span>0.0mm (No Thickness)</span>
                      <span>1.5px</span>
                      <span>5.0px</span>
                    </div>
                  </div>

                  {/* Custom Line Colors Assignment */}
                  <div className="p-2.5 bg-white border border-gray-200 rounded-md space-y-2 text-[11px]">
                    <div className="text-gray-700 font-bold flex items-center gap-1">
                      <span>🎨 Assign Line Colors</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accessoryColors.reveal_5_8}
                          onChange={(e) => setAccessoryColors({ ...accessoryColors, reveal_5_8: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border border-gray-200 p-0 overflow-hidden shrink-0"
                          title="Choose color for 5/8 Joint Reveal"
                        />
                        <span className="text-[10px] text-gray-700 font-medium truncate">5/8" Joint</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accessoryColors.reveal_3_4}
                          onChange={(e) => setAccessoryColors({ ...accessoryColors, reveal_3_4: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border border-gray-200 p-0 overflow-hidden shrink-0"
                          title="Choose color for 3/4 Joint Reveal"
                        />
                        <span className="text-[10px] text-gray-700 font-medium truncate">3/4" Joint</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accessoryColors.reveal_custom}
                          onChange={(e) => setAccessoryColors({ ...accessoryColors, reveal_custom: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border border-gray-200 p-0 overflow-hidden shrink-0"
                          title="Choose color for Custom Joint Reveal"
                        />
                        <span className="text-[10px] text-gray-700 font-medium truncate">Custom Joint</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accessoryColors.base_track}
                          onChange={(e) => setAccessoryColors({ ...accessoryColors, base_track: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border border-gray-200 p-0 overflow-hidden shrink-0"
                          title="Choose color for J-Track / Base Track"
                        />
                        <span className="text-[10px] text-emerald-800 font-bold truncate">J-Track / Base</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section: Formula Formula reference */}
                <div className="bg-amber-50/50 border border-amber-200/50 p-2.5 rounded-lg flex items-start gap-2 text-[10.5px] text-amber-900 font-medium font-sans">
                  <span className="text-sm">ℹ️</span>
                  <div>
                    <strong>Formula:</strong> 10ft ACM reveals are rounded up: <code>=ROUNDUP(Length_mm/304.8,-1)</code>. Linear feet is rounded up to the nearest multiple of 10.
                  </div>
                </div>

                {/* Material takeoff summary table */}
                <div className="border border-[#DDE2E5] rounded-lg overflow-hidden bg-white shadow-xs">
                  <div className="bg-[#F4F5F7] p-2.5 border-b border-[#DDE2E5] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1">
                      <Ruler className="w-3.5 h-3.5" /> Take-off Summary
                    </span>
                  </div>

                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-[#DDE2E5] text-[10px] font-mono uppercase text-[#5E6C84]">
                        <th className="p-2 font-bold">Accessory Type</th>
                        <th className="p-2 text-right">Length (mm)</th>
                        <th className="p-2 text-right">LFT</th>
                        <th className="p-2 text-right">Width</th>
                        <th className="p-2 text-right font-bold text-gray-900">10ft Pcs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDF1F7] font-mono text-[11px] text-gray-700">
                      <tr>
                        <td className="p-2 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accessoryColors.reveal_5_8 }}></span>
                          <span className="font-sans font-medium text-gray-900">5/8" Joint</span>
                        </td>
                        <td className="p-2 text-right">{totalLengths?.reveal_5_8?.mm ?? 0}</td>
                        <td className="p-2 text-right">{(totalLengths?.reveal_5_8?.lft ?? 0).toFixed(1)}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={revealWidths.reveal_5_8}
                            onChange={(e) => setRevealWidths({ ...revealWidths, reveal_5_8: parseInt(e.target.value) || 0 })}
                            className="w-10 bg-gray-50 border border-gray-200 text-right text-[10px] p-0.5 rounded focus:outline-none"
                          />
                        </td>
                        <td className="p-2 text-right font-bold" style={{ color: accessoryColors.reveal_5_8 }}>{totalLengths?.reveal_5_8?.pieces ?? 0}</td>
                      </tr>
                      <tr>
                        <td className="p-2 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accessoryColors.reveal_3_4 }}></span>
                          <span className="font-sans font-medium text-gray-900">3/4" Joint</span>
                        </td>
                        <td className="p-2 text-right">{totalLengths?.reveal_3_4?.mm ?? 0}</td>
                        <td className="p-2 text-right">{(totalLengths?.reveal_3_4?.lft ?? 0).toFixed(1)}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={revealWidths.reveal_3_4}
                            onChange={(e) => setRevealWidths({ ...revealWidths, reveal_3_4: parseInt(e.target.value) || 0 })}
                            className="w-10 bg-gray-50 border border-gray-200 text-right text-[10px] p-0.5 rounded focus:outline-none"
                          />
                        </td>
                        <td className="p-2 text-right font-bold" style={{ color: accessoryColors.reveal_3_4 }}>{totalLengths?.reveal_3_4?.pieces ?? 0}</td>
                      </tr>
                      <tr>
                        <td className="p-2 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accessoryColors.reveal_custom }}></span>
                          <span className="font-sans font-medium text-gray-900">Custom Joint</span>
                        </td>
                        <td className="p-2 text-right">{totalLengths?.reveal_custom?.mm ?? 0}</td>
                        <td className="p-2 text-right">{(totalLengths?.reveal_custom?.lft ?? 0).toFixed(1)}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={revealWidths.reveal_custom}
                            onChange={(e) => setRevealWidths({ ...revealWidths, reveal_custom: parseInt(e.target.value) || 0 })}
                            className="w-10 bg-gray-50 border border-gray-200 text-right text-[10px] p-0.5 rounded focus:outline-none"
                          />
                        </td>
                        <td className="p-2 text-right font-bold" style={{ color: accessoryColors.reveal_custom }}>{totalLengths?.reveal_custom?.pieces ?? 0}</td>
                      </tr>
                      <tr className="bg-emerald-50/20">
                        <td className="p-2 flex items-center gap-1.5 font-semibold">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accessoryColors.base_track }}></span>
                          <span className="font-sans font-medium text-gray-900">Base Track</span>
                        </td>
                        <td className="p-2 text-right">{totalLengths?.base_track?.mm ?? 0}</td>
                        <td className="p-2 text-right">{(totalLengths?.base_track?.lft ?? 0).toFixed(1)}</td>
                        <td className="p-2 text-right text-gray-400">-</td>
                        <td className="p-2 text-right font-bold" style={{ color: accessoryColors.base_track }}>{totalLengths?.base_track?.pieces ?? 0}</td>
                      </tr>
                      <tr className="bg-[#F8F9FA] border-t border-gray-200">
                        <td className="p-2 font-sans font-bold text-gray-800" colSpan={2}>
                          <div>Panel Clips (Takeoff)</div>
                          <div className="text-[9px] font-normal text-gray-500 max-w-[220px] leading-tight mt-0.5">
                            {clipCalculationMethod === "excel" ? "Using Excel formulas: W<=100 ? 1 : 2+ceil((W-100)/600) & H<=100 ? 1 : (2+ceil((H-100)/600))*2" : "Using grid-spacing method"}
                          </div>
                        </td>
                        <td className="p-2 text-right" colSpan={2}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setClipCalculationMethod("excel")}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                clipCalculationMethod === "excel"
                                  ? "bg-purple-600 border-purple-600 text-white shadow-xs"
                                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                              title="Calculate clip count using Excel LET formulas based on panel dimensions"
                            >
                              LET Formula
                            </button>
                            <button
                              onClick={() => setClipCalculationMethod("spacing")}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                clipCalculationMethod === "spacing"
                                  ? "bg-purple-600 border-purple-600 text-white shadow-xs"
                                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                              title="Calculate clip count using legacy grid spacing"
                            >
                              Spacing
                            </button>
                            {clipCalculationMethod === "spacing" && (
                              <select
                                value={clipsSpacing}
                                onChange={(e) => setClipsSpacing(parseInt(e.target.value) || 12)}
                                className="bg-white border border-gray-200 text-[9px] p-0.5 rounded focus:outline-none font-sans ml-1 shrink-0"
                              >
                                <option value={12}>12"</option>
                                <option value={16}>16"</option>
                                <option value={24}>24"</option>
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-right font-bold text-purple-700 text-xs shrink-0">{panelClipsCount} pcs</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Custom Hand-Drawn list */}
                <div className="border border-[#DDE2E5] rounded-lg overflow-hidden bg-white shadow-xs">
                  <div className="bg-[#F4F5F7] p-2.5 border-b border-[#DDE2E5] flex justify-between items-center">
                    <span className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                      Sketched Segments ({accessoryLines.length})
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-[#EDF1F7] font-mono text-xs">
                    {accessoryLinesWithLengths.length > 0 ? (
                      accessoryLinesWithLengths.map((line) => {
                        const isSelected = selectedLineId === line.id;
                        let displayType = line.type === "base_track" ? "Base Track" : line.type === "reveal_5_8" ? '5/8" Reveal' : line.type === "reveal_3_4" ? '3/4" Reveal' : "Custom Reveal";
                        let bulletColor = "bg-cyan-500";
                        if (line.type === "reveal_3_4") bulletColor = "bg-indigo-500";
                        else if (line.type === "reveal_custom") bulletColor = "bg-rose-500";
                        else if (line.type === "base_track") bulletColor = "bg-emerald-500";

                        return (
                          <div
                            key={line.id}
                            onClick={() => {
                              setSelectedLineId(line.id);
                              setSelectedPanelId(null);
                              setSelectedPanelIds(new Set());
                            }}
                            className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected ? "bg-amber-50" : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-2 h-2 rounded-full ${bulletColor} shrink-0`}></span>
                              <div className="min-w-0 truncate">
                                <span className="font-sans font-medium text-gray-900 text-left block">{displayType}</span>
                                <span className="text-[9px] text-gray-400 block truncate text-left">Coords: ({(line.x1 ?? 0).toFixed(0)}%, {(line.y1 ?? 0).toFixed(0)}%) to ({(line.x2 ?? 0).toFixed(0)}%, {(line.y2 ?? 0).toFixed(0)}%)</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-[#0052CC]">{line.realLength} mm</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAccessoryLines(accessoryLines.filter((l) => l.id !== line.id));
                                  if (selectedLineId === line.id) setSelectedLineId(null);
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                title="Delete line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-[11px] font-sans">
                        No sketches drawn yet. Use the sketching tools above to trace joints or base tracks on your blueprint!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel Inspector Widget for currently clicked single-panel box */}
          {selectedPanelId && (
            <div id="inspector-widget" className="p-4 bg-amber-50 border-t border-amber-200 shrink-0 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Selected Panel Inspector
                </span>
                <button
                  onClick={() => setSelectedPanelId(null)}
                  className="p-0.5 text-amber-700 hover:bg-amber-100 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <label className="block text-[9px] text-amber-700 font-bold uppercase mb-0.5">Panel Name / Custom Label</label>
                  <input
                    type="text"
                    value={modCustomLabel}
                    onChange={(e) => setModCustomLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updatePanelDimensions();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="e.g., Door Panel A, Spandrel Glass, etc."
                    className="w-full bg-white border border-amber-300 p-1.5 rounded font-mono text-xs text-[#1A1C1E] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-amber-700 font-bold uppercase mb-0.5">Width Dimension</label>
                  <input
                    type="number"
                    value={isNaN(modWidth) ? "" : modWidth}
                    onChange={(e) => setModWidth(parseFloat(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updatePanelDimensions();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full bg-white border border-amber-300 p-1 rounded font-mono text-xs text-[#1A1C1E] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-amber-700 font-bold uppercase mb-0.5">Height Dimension</label>
                  <input
                    type="number"
                    value={isNaN(modHeight) ? "" : modHeight}
                    onChange={(e) => setModHeight(parseFloat(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updatePanelDimensions();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full bg-white border border-amber-300 p-1 rounded font-mono text-xs text-[#1A1C1E] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-amber-700 font-bold uppercase mb-0.5">Measurement Unit</label>
                  <input
                    type="text"
                    value={modUnit}
                    onChange={(e) => setModUnit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updatePanelDimensions();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full bg-white border border-amber-300 p-1 rounded font-mono text-xs text-[#1A1C1E] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Profile Type Toggle (Slotted vs Standard) */}
                <div className="col-span-3 flex items-center justify-between bg-white border border-amber-300 p-2 rounded">
                  <div>
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      {modIsSlotted ? "⚡ Slotted Panel (Shorter Girth)" : "🏷️ Standard Panel"}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono block">
                      {modIsSlotted 
                        ? `Height Girth: +${masterListSettings.slottedHeightAllowance}mm (Shorter)` 
                        : `Height Girth: +${masterListSettings.normalHeightAllowance}mm (+18*2)`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModIsSlotted(!modIsSlotted)}
                    className={`px-2.5 py-1 rounded text-[10.5px] font-bold font-mono transition-all shadow-xs cursor-pointer ${
                      modIsSlotted
                        ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
                    }`}
                  >
                    {modIsSlotted ? "Slotted (Active)" : "Mark Slotted"}
                  </button>
                </div>

                {/* Live Girth Blank Dimensions Card & Stiffener Alert */}
                {(() => {
                  const girth = calculateGirth(modWidth || 0, modHeight || 0, modIsSlotted, masterListSettings);
                  const needsStiff = checkNeedsStiffener(modWidth || 0, modHeight || 0);
                  return (
                    <div className="col-span-3 bg-white border border-amber-200 p-2 rounded space-y-1 font-mono text-left">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-500 uppercase font-bold">Girth Blank Size:</span>
                        <span className="font-extrabold text-indigo-700 text-xs">
                          {girth.girthWidth} × {girth.girthHeight} mm
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-500">
                        <span>Allowance:</span>
                        <span>{girth.formulaNote}</span>
                      </div>
                      {needsStiff && (
                        <div className="mt-1 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <span>🔧</span> Needs stiffener (Packing list size ≥1202×1202)
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-amber-200/60">
                <button
                  onClick={() => deletePanel(selectedPanelId)}
                  className="flex items-center gap-1 text-red-700 hover:text-red-800 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Box
                </button>

                {scaleReferenceId === selectedPanelId ? (
                  <span className="text-[10px] bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-1 rounded font-bold flex items-center gap-1 select-none shadow-xs">
                    📐 Calibration Base
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setScaleReferenceId(selectedPanelId);
                      setSystemMessage({
                        text: "Scale calibration base updated successfully! All new drawn panels will now scale relative to this box.",
                        type: "success"
                      });
                    }}
                    className="bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 px-2.5 py-1 rounded text-[10px] font-bold transition-all shadow-xs flex items-center gap-1"
                    title="Calibrate future manual panel dimensions relative to this box"
                  >
                    📐 Set as Scale Base
                  </button>
                )}

                <button
                  onClick={updatePanelDimensions}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors shadow-xs"
                >
                  Save Dimensions
                </button>
              </div>
            </div>
          )}

          {/* Summary Footer Widget */}
          <div id="sidebar-summary" className="p-4 bg-[#F8F9FA] border-t border-[#DDE2E5] space-y-2 shrink-0">
            <div className="flex justify-between text-xs">
              <span className="text-[#5E6C84]">Total Panels Mapped:</span>
              <span className="font-bold text-[#172B4D]">{labeledPanels.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#5E6C84]">Unique Groupings:</span>
              <span className="font-bold text-[#172B4D]">{groups.length}</span>
            </div>
            <div className="pt-1.5">
              <div className="w-full bg-[#DDE2E5] h-1.5 rounded-full">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: groups.length > 0 ? "100%" : "0%" }}
                ></div>
              </div>
              <p className="text-[10px] text-emerald-600 mt-1 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {groups.length > 0 ? "All panels labeled successfully." : "Ready for layout upload."}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* System message banner */}
      {systemMessage && (
        <div
          id="system-banner"
          className={`px-6 py-2 flex items-center justify-between text-xs transition-all shrink-0 ${
            systemMessage.type === "success"
              ? "bg-emerald-50 border-t border-emerald-200 text-emerald-800"
              : systemMessage.type === "error"
              ? "bg-red-50 border-t border-red-200 text-red-800"
              : "bg-blue-50 border-t border-blue-200 text-blue-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {systemMessage.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : systemMessage.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-600" />
            ) : (
              <Info className="w-4 h-4 text-[#0052CC]" />
            )}
            <span>{systemMessage.text}</span>
          </div>
          <button
            onClick={() => setSystemMessage(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Architectural Action Bar (High Density Style) */}
      <footer id="app-footer" className="h-10 bg-[#172B4D] flex items-center px-6 justify-between text-white shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`}></div>
            <span className="text-[10px] uppercase font-bold tracking-wider">
              {isProcessing ? "Processing..." : "System Ready"}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            Tolerance: {tolerance}mm | Serial prefix: {prefix} | Start: {startNumber}
          </span>
        </div>
        <div className="text-[10px] text-gray-400 font-medium italic">
          Elevation Labeler Workspace | suzansaddun@gmail.com
        </div>
      </footer>

      {/* Drawing Bounding Box Dimensions Input Modal */}
      {showManualSpecModal && tempRect && (
        <div id="spec-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-[#DDE2E5] space-y-4">
            <div className="flex justify-between items-center border-b border-[#DDE2E5] pb-3">
              <h3 className="text-sm font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#0052CC]" /> Specify Panel Dimensions
              </h3>
              <button
                onClick={() => {
                  setTempRect(null);
                  setShowManualSpecModal(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#5E6C84]">
              You've drawn a panel. Please specify its physical real-world dimensions to match and group with identical panels.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#5E6C84] uppercase mb-1">
                  Width
                </label>
                <input
                  type="number"
                  value={isNaN(newWidth) ? "" : newWidth}
                  onChange={(e) => setNewWidth(parseFloat(e.target.value))}
                  className="w-full bg-white border border-[#DDE2E5] p-2 rounded font-mono text-sm"
                  placeholder="e.g. 1200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#5E6C84] uppercase mb-1">
                  Height
                </label>
                <input
                  type="number"
                  value={isNaN(newHeight) ? "" : newHeight}
                  onChange={(e) => setNewHeight(parseFloat(e.target.value))}
                  className="w-full bg-white border border-[#DDE2E5] p-2 rounded font-mono text-sm"
                  placeholder="e.g. 600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#5E6C84] uppercase mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full bg-white border border-[#DDE2E5] p-2 rounded font-mono text-sm"
                  placeholder="mm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setTempRect(null);
                  setShowManualSpecModal(false);
                }}
                className="px-4 py-2 border border-[#DDE2E5] rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveManualPanel}
                className="px-4 py-2 bg-[#0052CC] hover:bg-[#0747A6] text-white rounded text-xs font-semibold shadow-sm"
              >
                Add Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Area Selection Sequential Naming Modal */}
      {showAreaNamingModal && selectedAreaPanels.length > 0 && (() => {
        const { columns, panelLabels } = getAreaColumnsAndNaming(
          selectedAreaPanels,
          areaPrefix,
          areaStartNumber,
          areaNamingMode,
          namingRule.tolerance,
          panels
        );

        return (
          <div id="area-naming-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg border border-[#DDE2E5] space-y-4">
              <div className="flex justify-between items-center border-b border-[#DDE2E5] pb-3">
                <h3 className="text-sm font-bold text-[#172B4D] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-lg">🎯</span> Area Sequential Naming
                </h3>
                <button
                  onClick={() => {
                    setShowAreaNamingModal(false);
                    setSelectedAreaPanels([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-[#5E6C84]">
                You've selected <strong className="text-purple-700">{selectedAreaPanels.length} panels</strong>. Configure sequential naming rules to label them instantly.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6C84] uppercase mb-1">
                    Label Prefix
                  </label>
                  <input
                    type="text"
                    value={areaPrefix}
                    onChange={(e) => setAreaPrefix(e.target.value)}
                    className="w-full bg-white border border-[#DDE2E5] p-2 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="e.g. B"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#5E6C84] uppercase mb-1">
                    Start Number
                  </label>
                  <input
                    type="number"
                    value={isNaN(areaStartNumber) ? "" : areaStartNumber}
                    onChange={(e) => setAreaStartNumber(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white border border-[#DDE2E5] p-2 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="e.g. 1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#5E6C84] uppercase mb-1.5">
                  Naming Strategy (Architectural Sizing)
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setAreaNamingMode("row-smart")}
                    className={`p-2.5 text-left text-xs rounded-lg border transition-all flex flex-col gap-1 ${
                      areaNamingMode === "row-smart"
                        ? "bg-purple-50 text-purple-900 border-purple-500 shadow-xs ring-1 ring-purple-500"
                        : "bg-white text-gray-700 border-[#DDE2E5] hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1 text-purple-800">
                      <span>🪜</span> Row-Smart Top-to-Bottom (Recommended)
                    </span>
                    <span className="text-[10px] text-gray-500 leading-normal">
                      Sorts top-to-bottom rows first, then left-to-right. Identical panel dimensions on the same level share the same label (perfect for floor-by-floor panel layouts).
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAreaNamingMode("row-sequential")}
                    className={`p-2.5 text-left text-xs rounded-lg border transition-all flex flex-col gap-1 ${
                      areaNamingMode === "row-sequential"
                        ? "bg-purple-50 text-purple-900 border-purple-500 shadow-xs ring-1 ring-purple-500"
                        : "bg-white text-gray-700 border-[#DDE2E5] hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1">
                      <span>🔢</span> Row-Sequential Top-to-Bottom
                    </span>
                    <span className="text-[10px] text-gray-500 leading-normal">
                      Sorts top-to-bottom rows, then left-to-right. Every panel gets an individual sequential name.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAreaNamingMode("column-smart")}
                    className={`p-2.5 text-left text-xs rounded-lg border transition-all flex flex-col gap-1 ${
                      areaNamingMode === "column-smart"
                        ? "bg-purple-50 text-purple-900 border-purple-500 shadow-xs ring-1 ring-purple-500"
                        : "bg-white text-gray-700 border-[#DDE2E5] hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1">
                      <span>🧱</span> Column-Smart Architectural
                    </span>
                    <span className="text-[10px] text-gray-500 leading-normal">
                      Sorts left-to-right columns, then top-to-bottom. Equal adjacent panel dimensions within a vertical column share the same label.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAreaNamingMode("global-grouped")}
                    className={`p-2.5 text-left text-xs rounded-lg border transition-all flex flex-col gap-1 ${
                      areaNamingMode === "global-grouped"
                        ? "bg-purple-50 text-purple-900 border-purple-500 shadow-xs ring-1 ring-purple-500"
                        : "bg-white text-gray-700 border-[#DDE2E5] hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1">
                      <span>🌍</span> Global Size Grouping
                    </span>
                    <span className="text-[10px] text-gray-500 leading-normal">
                      Identical panels anywhere in this selection share a matching label. Ideal if you want a strict global mark list.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAreaNamingMode("sequential")}
                    className={`p-2.5 text-left text-xs rounded-lg border transition-all flex flex-col gap-1 ${
                      areaNamingMode === "sequential"
                        ? "bg-purple-50 text-purple-900 border-purple-500 shadow-xs ring-1 ring-purple-500"
                        : "bg-white text-gray-700 border-[#DDE2E5] hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-bold flex items-center gap-1">
                      <span>📊</span> Column-Sequential
                    </span>
                    <span className="text-[10px] text-gray-500 leading-normal">
                      Every panel gets a unique sequence number, sorted by column from left to right, then top to bottom.
                    </span>
                  </button>
                </div>
              </div>

              {/* Live Naming Preview List */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[#5E6C84] uppercase">
                  Detected Architectural Grid & Label Preview
                </label>
                <div className="max-h-52 overflow-y-auto border border-[#DDE2E5] rounded p-3 bg-gray-50 space-y-3 font-sans text-xs text-gray-700">
                  {columns.map((col) => (
                    <div key={col.columnIndex} className="border-b border-gray-200/60 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-1 rounded border border-purple-100 mb-2">
                        <span>Column {col.columnIndex}: {col.role}</span>
                        <span className="text-gray-500 font-mono">x ~ {Math.round(col.avgX)}%</span>
                      </div>
                      <div className="pl-2.5 space-y-1.5">
                        {col.panels.map((p, idx) => {
                          const label = panelLabels[p.id];
                          // Identify the layout role in the column
                          let rowRole = `Panel ${idx + 1}`;
                          if (col.panels.length === 4) {
                            if (idx === 0) rowRole = "Top Panel";
                            else if (idx === 3) rowRole = "Bottom Panel";
                            else rowRole = `Middle Panel ${idx}`;
                          } else if (col.panels.length === 2) {
                            rowRole = idx === 0 ? "Window Top" : "Window Bottom";
                          } else if (col.panels.length === 1) {
                            rowRole = "Door Top Header";
                          }

                          return (
                            <div key={p.id} className="flex justify-between items-center py-0.5 font-mono text-[11px] text-gray-600">
                              <span className="flex items-center gap-1.5">
                                <span className="text-[10px] bg-gray-200/80 text-gray-600 px-1 rounded font-sans font-semibold">
                                  {rowRole}
                                </span>
                                <span>{p.realWidth} x {p.realHeight} mm</span>
                              </span>
                              <span className="text-purple-700 font-bold">➔ {label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#DDE2E5]">
                <button
                  onClick={() => {
                    setShowAreaNamingModal(false);
                    setSelectedAreaPanels([]);
                  }}
                  className="px-4 py-2 border border-[#DDE2E5] rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={applySequentialNaming}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow-sm"
                >
                  Apply Sequence
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Project Progress & Saved Projects Modal */}
      <ProjectManagerModal
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        currentProjectState={{
          projectName,
          projectNumber,
          releaseNo,
          projectManager,
          imageName,
          imageUrl,
          dxfData,
          panels,
          accessoryLines,
          revealWidths,
          accessoryColors,
          clipsSpacing,
          clipCalculationMethod,
          referencePanel,
          prefix,
          startNumber,
          tolerance,
          sortBy,
          sortOrder,
          customGroupOrder,
          unit: referencePanel?.unit || "mm",
        }}
        onLoadProject={handleLoadProject}
        onSaveCurrentProject={handleSaveCurrentProject}
        onStartNewJob={handleStartNewJob}
        savedProjects={savedProjects}
        onDeleteProject={handleDeleteProject}
        onDuplicateProject={handleDuplicateProject}
      />

      {/* CAD / DXF / DWG Export Modal */}
      <DxfExportModal
        isOpen={isDxfExportModalOpen}
        onClose={() => setIsDxfExportModalOpen(false)}
        panels={labeledPanels}
        groups={groups}
        accessoryLines={accessoryLines}
        dxfData={dxfData}
        originalDxfText={originalDxfText}
        projectName={projectName}
        projectNumber={projectNumber}
        releaseNo={releaseNo}
        onAnnotateOriginalDxf={exportAnnotatedDxf}
      />
    </div>
  );
}
