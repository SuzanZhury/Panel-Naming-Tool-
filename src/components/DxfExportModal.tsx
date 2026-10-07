import React, { useState, useMemo } from "react";
import {
  X,
  Download,
  FileCode,
  Check,
  Info,
  Compass,
  LayoutGrid,
  Sparkles,
  Eye,
  Sliders,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileImage,
  AlertTriangle
} from "lucide-react";
import { Panel, AccessoryLine, PanelGroup } from "../types";
import { generatePanelsDxf, generatePanelsSvg } from "../utils";

interface DxfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  panels: Panel[];
  groups: PanelGroup[];
  accessoryLines: AccessoryLine[];
  dxfData: any | null;
  originalDxfText: string | null;
  projectName: string;
  projectNumber: string;
  releaseNo: string;
  onAnnotateOriginalDxf?: () => void;
}

export const DxfExportModal: React.FC<DxfExportModalProps> = ({
  isOpen,
  onClose,
  panels,
  groups,
  accessoryLines,
  dxfData,
  originalDxfText,
  projectName,
  projectNumber,
  releaseNo,
  onAnnotateOriginalDxf,
}) => {
  const [activeTab, setActiveTab] = useState<"export" | "preview">("export");
  const [exportMode, setExportMode] = useState<"elevation" | "fabrication" | "original">(
    dxfData && originalDxfText ? "original" : "elevation"
  );
  const [includeOutlines, setIncludeOutlines] = useState<boolean>(true);
  const [includeLabels, setIncludeLabels] = useState<boolean>(true);
  const [includeDimensions, setIncludeDimensions] = useState<boolean>(true);
  const [includeAccessories, setIncludeAccessories] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Preview zoom & theme state
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [cadTheme, setCadTheme] = useState<"dark" | "light">("dark");

  const svgData = useMemo(() => {
    if (!isOpen) return { svgString: "", width: 1000, height: 1000 };
    return generatePanelsSvg({
      panels,
      accessoryLines,
      dxfData,
      mode: exportMode === "original" ? "elevation" : exportMode,
      includeOutlines,
      includeLabels,
      includeDimensions,
      includeAccessories,
    });
  }, [isOpen, panels, accessoryLines, dxfData, exportMode, includeOutlines, includeLabels, includeDimensions, includeAccessories]);

  if (!isOpen) return null;

  const baseName = projectName
    ? projectName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
    : "panels_cad";
  const modeSuffix = exportMode === "fabrication" ? "fabrication_nest" : "elevation_layout";

  // Download DXF
  const handleDownloadDxf = () => {
    if (exportMode === "original" && onAnnotateOriginalDxf) {
      onAnnotateOriginalDxf();
      onClose();
      return;
    }

    const dxfContent = generatePanelsDxf({
      panels,
      accessoryLines,
      dxfData,
      projectName,
      projectNumber,
      releaseNo,
      mode: exportMode as "elevation" | "fabrication",
      includeOutlines,
      includeLabels,
      includeDimensions,
      includeAccessories,
    });

    const blob = new Blob([dxfContent], { type: "application/dxf;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}_${modeSuffix}_rel${releaseNo || "1"}.dxf`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess("DXF CAD file downloaded! Opens in AutoCAD, DWG TrueView, SolidWorks, etc.");
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  // Download SVG
  const handleDownloadSvg = () => {
    const blob = new Blob([svgData.svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}_${modeSuffix}_vector.svg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess("SVG Vector drawing downloaded! Opens immediately in any web browser.");
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  return (
    <div
      id="dxf-export-modal"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase">
                CAD Drawing Export (AutoCAD / DWG / DXF)
              </h2>
              <p className="text-[11px] text-gray-300">
                1:1 Real-world vector drawing with panel boundaries, labels, and dimensions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("export")}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "export"
                ? "border-blue-600 text-blue-600 bg-white rounded-t-md"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Export Settings &amp; Downloads</span>
          </button>

          <button
            onClick={() => setActiveTab("preview")}
            className={`py-2 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "preview"
                ? "border-blue-600 text-blue-600 bg-white rounded-t-md"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Interactive CAD Preview in Browser</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 text-left overflow-y-auto flex-1">
          {downloadSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs flex items-center gap-2 animate-fade-in font-medium">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {activeTab === "export" ? (
            <>
              {/* Summary Badges */}
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                <span className="font-bold text-slate-800">
                  Project: <span className="font-semibold text-blue-700">{projectName || "Untitled"}</span>
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-slate-600">
                  Panels: <strong className="text-slate-900">{panels.length}</strong>
                </span>
                <span className="text-gray-300">•</span>
                <span className="text-slate-600">
                  Unique Groups: <strong className="text-slate-900">{groups.length}</strong>
                </span>
                {accessoryLines.length > 0 && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-slate-600">
                      Accessories: <strong className="text-slate-900">{accessoryLines.length}</strong>
                    </span>
                  </>
                )}
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Choose CAD Layout Style:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Elevation Layout */}
                  <button
                    type="button"
                    onClick={() => setExportMode("elevation")}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      exportMode === "elevation"
                        ? "border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-blue-600" />
                        Elevation Layout (1:1 mm)
                      </span>
                      {exportMode === "elevation" && (
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Panels positioned exactly as shown in the architectural elevation drawing.
                    </p>
                  </button>

                  {/* Option 2: Fabrication Nesting Grid */}
                  <button
                    type="button"
                    onClick={() => setExportMode("fabrication")}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      exportMode === "fabrication"
                        ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
                        Fabrication / CNC Grid
                      </span>
                      {exportMode === "fabrication" && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Panels arranged in clean, spaced rows with dimensions and names. Ideal for CNC routers and cut sheets.
                    </p>
                  </button>

                  {/* Option 3: Original DXF Annotation (if available) */}
                  {dxfData && originalDxfText && (
                    <button
                      type="button"
                      onClick={() => setExportMode("original")}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer col-span-1 sm:col-span-2 ${
                        exportMode === "original"
                          ? "border-purple-600 bg-purple-50/70 ring-2 ring-purple-500/20"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          Annotate Uploaded CAD File
                        </span>
                        {exportMode === "original" && (
                          <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        Injects panel labels directly into your original CAD blueprint on layer <code>PANEL_LABELS</code>.
                      </p>
                    </button>
                  )}
                </div>
              </div>

              {/* Layer Options Checklist */}
              {exportMode !== "original" && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                    CAD Layers Included in Drawing:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeOutlines}
                        onChange={(e) => setIncludeOutlines(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>
                        <strong>PANELS:</strong> Closed boundaries (Cyan)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeLabels}
                        onChange={(e) => setIncludeLabels(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>
                        <strong>PANEL_LABELS:</strong> Panel names (Yellow)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeDimensions}
                        onChange={(e) => setIncludeDimensions(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>
                        <strong>PANEL_DIMENSIONS:</strong> W x H mm (Green)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeAccessories}
                        onChange={(e) => setIncludeAccessories(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>
                        <strong>REVEALS / TRACK:</strong> Joint lines (Red/Blue)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Important: How to Open on Your Computer */}
              <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3.5 space-y-2 text-xs text-amber-950">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Having trouble opening the downloaded CAD (.dxf) file?</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Computers without CAD software installed (like AutoCAD or SolidWorks) don't have a default program to double-click <code>.dxf</code> files. Here is how you can open it immediately:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-900">
                  <li>
                    <strong>Preview in Browser right now:</strong> Click the <strong>"Interactive CAD Preview"</strong> tab above to view your vector CAD drawing with zoom and pan without installing any software!
                  </li>
                  <li>
                    <strong>Download as SVG:</strong> Click <strong>"Download Vector SVG"</strong> below. Every web browser (Chrome, Edge, Safari) opens SVG immediately when double-clicked!
                  </li>
                  <li>
                    <strong>In AutoCAD or SolidWorks:</strong> Open AutoCAD, click <strong>Open</strong>, set file type to <em>DXF (*.dxf)</em>, and select your file. To save as DWG, click <strong>File &gt; Save As &gt; AutoCAD Drawing (*.dwg)</strong>.
                  </li>
                  <li>
                    <strong>Free Autodesk Online Viewer:</strong> Open <a href="https://viewer.autodesk.com" target="_blank" rel="noreferrer" className="underline font-bold text-blue-700 hover:text-blue-900">viewer.autodesk.com</a> in your browser to drag-and-drop and view 2D/3D DWG &amp; DXF files for free.
                  </li>
                </ul>
              </div>
            </>
          ) : (
            /* Interactive In-Browser CAD Preview */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-blue-600" />
                  Live In-Browser CAD Vector Preview
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-gray-200">
                    <button
                      onClick={() => setCadTheme("dark")}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                        cadTheme === "dark" ? "bg-slate-900 text-white" : "text-gray-600"
                      }`}
                    >
                      Dark CAD
                    </button>
                    <button
                      onClick={() => setCadTheme("light")}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                        cadTheme === "light" ? "bg-white text-slate-900 shadow-2xs" : "text-gray-600"
                      }`}
                    >
                      Light Paper
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewZoom((z) => Math.max(0.4, z - 0.2))}
                      className="p-1 rounded hover:bg-gray-100 border border-gray-200 text-gray-600 cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono px-1 font-semibold text-gray-600">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setPreviewZoom((z) => Math.min(3, z + 0.2))}
                      className="p-1 rounded hover:bg-gray-100 border border-gray-200 text-gray-600 cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPreviewZoom(1)}
                      className="p-1 rounded hover:bg-gray-100 border border-gray-200 text-gray-600 cursor-pointer"
                      title="Reset Zoom"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Viewport Frame */}
              <div
                className={`w-full h-80 rounded-lg border overflow-auto p-4 flex items-center justify-center transition-colors ${
                  cadTheme === "dark"
                    ? "bg-[#0b0f19] border-slate-700"
                    : "bg-white border-gray-300"
                }`}
              >
                <div
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: "center center",
                    transition: "transform 0.15s ease-out",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                  className="flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: svgData.svgString }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                <span>Drawing Size: {svgData.width} x {svgData.height} mm</span>
                <span>{panels.length} panels rendered in vector CAD scale</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2.5 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-300 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
            >
              Close
            </button>

            {/* Direct Vector SVG Download (Opens anywhere) */}
            <button
              onClick={handleDownloadSvg}
              disabled={panels.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-40"
              title="Download vector SVG file that opens in any browser (Chrome, Safari, Edge) without CAD software"
            >
              <FileImage className="w-3.5 h-3.5 text-blue-600" />
              <span>Download Vector SVG</span>
            </button>
          </div>

          {/* Primary CAD DXF Download Button */}
          <button
            onClick={handleDownloadDxf}
            disabled={panels.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>Download CAD (.dxf / AutoCAD / DWG)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
