import React, { useState, useRef } from "react";
import {
  FolderOpen,
  Save,
  Download,
  Upload,
  Trash2,
  Copy,
  Clock,
  Check,
  X,
  FileCode,
  Layers,
  Sparkles,
  AlertCircle,
  Plus,
  FilePlus
} from "lucide-react";
import { SavedProject, Panel, AccessoryLine } from "../types";

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Current active session state
  currentProjectState: {
    projectName: string;
    projectNumber: string;
    releaseNo: string;
    projectManager: string;
    imageName: string;
    imageUrl: string | null;
    dxfData: any | null;
    panels: Panel[];
    accessoryLines: AccessoryLine[];
    revealWidths: { [key: string]: number };
    accessoryColors: { [key: string]: string };
    clipsSpacing: number;
    clipCalculationMethod: "border_plus_grid" | "perimeter_only" | "grid_intersections";
    referencePanel: Panel | null;
    prefix: string;
    startNumber: number;
    tolerance: number;
    sortBy: "area" | "width" | "height" | "none";
    sortOrder: "asc" | "desc";
    customGroupOrder: string[];
    unit: string;
  };
  // Handlers
  onLoadProject: (project: SavedProject) => void;
  onSaveCurrentProject: (name: string, projectNumber: string, releaseNo: string) => void;
  onStartNewJob: () => void;
  savedProjects: SavedProject[];
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (project: SavedProject) => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  currentProjectState,
  onLoadProject,
  onSaveCurrentProject,
  onStartNewJob,
  savedProjects,
  onDeleteProject,
  onDuplicateProject,
}) => {
  const [activeTab, setActiveTab] = useState<"list" | "save" | "import">("list");
  const [saveName, setSaveName] = useState<string>(currentProjectState.projectName || "New Project");
  const [saveProjNum, setSaveProjNum] = useState<string>(currentProjectState.projectNumber || "");
  const [saveRelNo, setSaveRelNo] = useState<string>(currentProjectState.releaseNo || "Rev 01");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Import state
  const [importedProject, setImportedProject] = useState<SavedProject | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    onSaveCurrentProject(saveName.trim(), saveProjNum.trim(), saveRelNo.trim());
    setSaveSuccessMsg(`Project "${saveName.trim()}" saved successfully!`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setActiveTab("list");
    }, 1200);
  };

  const handleDownloadProjectJSON = (projectToDownload?: SavedProject) => {
    const proj: SavedProject = projectToDownload || {
      id: `proj-${Date.now()}`,
      name: currentProjectState.projectName || "Panelflow_Project",
      projectNumber: currentProjectState.projectNumber,
      releaseNo: currentProjectState.releaseNo,
      projectManager: currentProjectState.projectManager,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageName: currentProjectState.imageName,
      imageUrl: currentProjectState.imageUrl,
      dxfData: currentProjectState.dxfData,
      panels: currentProjectState.panels,
      accessoryLines: currentProjectState.accessoryLines,
      revealWidths: currentProjectState.revealWidths,
      accessoryColors: currentProjectState.accessoryColors,
      clipsSpacing: currentProjectState.clipsSpacing,
      clipCalculationMethod: currentProjectState.clipCalculationMethod,
      referencePanel: currentProjectState.referencePanel,
      prefix: currentProjectState.prefix,
      startNumber: currentProjectState.startNumber,
      tolerance: currentProjectState.tolerance,
      sortBy: currentProjectState.sortBy,
      sortOrder: currentProjectState.sortOrder,
      customGroupOrder: currentProjectState.customGroupOrder,
      unit: currentProjectState.unit,
    };

    const jsonStr = JSON.stringify(proj, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const cleanName = (proj.name || "panelflow_project").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.href = url;
    link.download = `${cleanName}_project.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportedProject(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Basic validation
        if (!parsed || (typeof parsed !== "object") || (!Array.isArray(parsed.panels) && !Array.isArray(parsed.accessoryLines) && !parsed.project)) {
          throw new Error("Invalid project JSON structure. Ensure file was exported from PanelLabeler.");
        }

        // Standardize into SavedProject format
        const projectObj: SavedProject = {
          id: parsed.id || `proj-imported-${Date.now()}`,
          name: parsed.name || parsed.project?.name || file.name.replace(".json", ""),
          projectNumber: parsed.projectNumber || parsed.project?.number || "",
          releaseNo: parsed.releaseNo || parsed.project?.release || "Rev 1",
          projectManager: parsed.projectManager || "",
          createdAt: parsed.createdAt || parsed.project?.exportedAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          imageName: parsed.imageName || "Imported Project",
          imageUrl: parsed.imageUrl || null,
          dxfData: parsed.dxfData || null,
          panels: Array.isArray(parsed.panels) ? parsed.panels : [],
          accessoryLines: Array.isArray(parsed.accessoryLines) ? parsed.accessoryLines : [],
          revealWidths: parsed.revealWidths || { reveal_5_8: 42, reveal_3_4: 25, reveal_custom: 25 },
          accessoryColors: parsed.accessoryColors || {},
          clipsSpacing: parsed.clipsSpacing ?? 12,
          clipCalculationMethod: parsed.clipCalculationMethod || "border_plus_grid",
          referencePanel: parsed.referencePanel || null,
          prefix: parsed.prefix || "A",
          startNumber: parsed.startNumber ?? 428,
          tolerance: parsed.tolerance ?? 0,
          sortBy: parsed.sortBy || "area",
          sortOrder: parsed.sortOrder || "desc",
          customGroupOrder: parsed.customGroupOrder || [],
          unit: parsed.unit || "mm",
        };

        setImportedProject(projectObj);
      } catch (err: any) {
        setImportError(err.message || "Failed to parse project JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importedProject) return;
    onLoadProject(importedProject);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-xs">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Project Progress & Saved Projects</h2>
              <p className="text-xs text-slate-400">Save, load, backup, or export your panel layout sessions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Navigation Tabs & Quick Action */}
        <div className="px-6 pt-3 pb-2 bg-slate-50 border-b border-gray-200 flex justify-between items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 bg-gray-200/80 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "list"
                  ? "bg-white text-blue-700 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Saved Projects ({savedProjects.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("save")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "save"
                  ? "bg-white text-emerald-700 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              <span>Save Progress</span>
            </button>

            <button
              onClick={() => setActiveTab("import")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "import"
                  ? "bg-white text-purple-700 shadow-xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-purple-600" />
              <span>Import Project File</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                onStartNewJob();
                onClose();
              }}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
              title="Auto-saves current job and opens a clean new project canvas"
            >
              <FilePlus className="w-3.5 h-3.5 text-amber-600" />
              <span>Start New Job</span>
            </button>

            <button
              onClick={() => handleDownloadProjectJSON()}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
              title="Download full project session as JSON file to your computer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Download .json</span>
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: SAVED PROJECTS LIST */}
          {activeTab === "list" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span>Saved Projects in App</span>
                  <span className="text-xs bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full font-mono text-gray-600">
                    {savedProjects.length}
                  </span>
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onStartNewJob();
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                    title="Auto-save current work and start a fresh new project"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>+ Start New Job</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("save")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Current Session</span>
                  </button>
                </div>
              </div>

              {savedProjects.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl space-y-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700">No saved projects yet</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Save your current progress to reload it anytime or export a downloadable project file.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("save")}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-xs transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Active Project</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {savedProjects.map((proj) => {
                    const formattedDate = new Date(proj.updatedAt || proj.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={proj.id}
                        className="p-4 bg-white border border-gray-200 hover:border-blue-300 rounded-xl transition-all shadow-2xs hover:shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                              {proj.name}
                            </h4>
                            {proj.releaseNo && (
                              <span className="text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                                {proj.releaseNo}
                              </span>
                            )}
                            {proj.projectNumber && (
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                                #{proj.projectNumber}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Clock className="w-3 h-3 text-gray-400" />
                              {formattedDate}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-semibold text-blue-800">
                              <Layers className="w-3 h-3 text-blue-500" />
                              {proj.panels?.length || 0} Panels
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-cyan-800">
                              {proj.accessoryLines?.length || 0} Lines/Reveals
                            </span>
                          </div>

                          {proj.imageName && (
                            <p className="text-[10px] text-gray-400 font-mono truncate max-w-md">
                              Source File: {proj.imageName}
                            </p>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => {
                              onLoadProject(proj);
                              onClose();
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-xs"
                            title="Load this project into the workspace"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Load</span>
                          </button>

                          <button
                            onClick={() => handleDownloadProjectJSON(proj)}
                            className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg transition-all"
                            title="Download project JSON file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDuplicateProject(proj)}
                            className="p-1.5 text-gray-600 hover:text-slate-800 hover:bg-slate-100 border border-gray-200 rounded-lg transition-all"
                            title="Duplicate project entry"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteProject(proj.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition-all"
                            title="Delete project entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SAVE CURRENT PROGRESS */}
          {activeTab === "save" && (
            <form onSubmit={handleSaveSubmit} className="space-y-4 max-w-xl mx-auto">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <Save className="w-4 h-4 text-emerald-600" />
                  <span>Save Progress to App Memory</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Store your current drawing, panel dimensions, accessories, DXF vectors, scale calibrations, and labels directly in your browser.
                </p>
              </div>

              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g. Block 22 West Elevation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Project Number / ID</label>
                    <input
                      type="text"
                      value={saveProjNum}
                      onChange={(e) => setSaveProjNum(e.target.value)}
                      placeholder="e.g. 21.202589"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Release Revision #</label>
                    <input
                      type="text"
                      value={saveRelNo}
                      onChange={(e) => setSaveRelNo(e.target.value)}
                      placeholder="e.g. 08.Rev 02"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5 text-xs text-gray-600">
                  <div className="font-bold text-gray-800">Current Session Summary:</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono">
                    <span>• Panels: <strong className="text-blue-700">{currentProjectState.panels.length}</strong></span>
                    <span>• J-Tracks & Reveals: <strong className="text-cyan-700">{currentProjectState.accessoryLines.length}</strong></span>
                    <span>• Source: <strong>{currentProjectState.imageName || "None"}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab("list")}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Project Progress</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: IMPORT PROJECT FILE */}
          {activeTab === "import" && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
                  <Upload className="w-4 h-4 text-purple-600" />
                  <span>Import Project JSON File</span>
                </div>
                <p className="text-xs text-purple-700">
                  Upload a previously saved `.json` project file to restore panels, reveal drawings, DXF coordinates, and project settings.
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".json"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/50 hover:bg-purple-50 rounded-xl text-center cursor-pointer transition-all space-y-2 group"
              >
                <div className="w-12 h-12 bg-white text-purple-600 border border-purple-200 rounded-full flex items-center justify-center mx-auto shadow-xs group-hover:scale-105 transition-transform">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-purple-900">Click to Select Project (.json) File</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Supports all Panelflow project exports</p>
                </div>
              </div>

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importedProject && (
                <div className="p-4 bg-white border border-purple-200 rounded-xl space-y-3 shadow-xs animate-fade-in">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Valid Project File Detected
                      </h4>
                      <p className="text-sm font-bold text-gray-900 mt-1">{importedProject.name}</p>
                    </div>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-mono font-bold px-2 py-0.5 rounded">
                      Ready to Load
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                    <div>Panels: <strong className="text-blue-700">{importedProject.panels?.length || 0}</strong></div>
                    <div>Reveals/Tracks: <strong className="text-cyan-700">{importedProject.accessoryLines?.length || 0}</strong></div>
                    <div>Source: <strong className="text-gray-800 truncate">{importedProject.imageName || "None"}</strong></div>
                    <div>Release: <strong className="text-gray-800">{importedProject.releaseNo || "Rev 1"}</strong></div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setImportedProject(null)}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-all"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={confirmImport}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirm & Load into Workspace</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span>Auto-save active in browser memory</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg transition-all text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
