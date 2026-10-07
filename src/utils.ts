import { Panel, NamingRule, PanelGroup, AccessoryLine, MasterListSettings } from "./types";
import * as XLSX from "xlsx";

export const DEFAULT_MASTER_LIST_SETTINGS: MasterListSettings = {
  returnAllowance: 18, // 18 mm standard return
  widthAllowance: 36, // 18 + 18 mm return on both sides
  slottedHeightAllowance: 18, // +18 mm for slotted panel height (single return / shorter girth)
  normalHeightAllowance: 36, // +36 mm (+18*2) for normal panel height (both top and bottom returns)
};

/**
 * Checks if a panel requires a stiffener based on rule:
 * If panel size in packing list is 1202*1202 or more, needs stiffener.
 */
export function checkNeedsStiffener(width: number, height: number): boolean {
  return width >= 1202 && height >= 1202;
}

/**
 * Calculates fabrication girth (stretch-out cut size) for a panel:
 * - Width Girth = Width + WidthAllowance (default +36, +18 on left & +18 on right)
 * - Slotted Panel Height Girth = Height + SlottedHeightAllowance (default +18, shorter girth)
 * - Normal Panel Height Girth = Height + NormalHeightAllowance (default +36, +18*2 from packing list)
 */
export function calculateGirth(
  width: number,
  height: number,
  isSlotted: boolean,
  settings: MasterListSettings = DEFAULT_MASTER_LIST_SETTINGS
): {
  girthWidth: number;
  girthHeight: number;
  widthAllowance: number;
  heightAllowance: number;
  formulaNote: string;
} {
  const widthAllowance = settings.widthAllowance ?? 36;
  const heightAllowance = isSlotted
    ? (settings.slottedHeightAllowance ?? 18)
    : (settings.normalHeightAllowance ?? 36);

  const girthWidth = Math.round(width + widthAllowance);
  const girthHeight = Math.round(height + heightAllowance);

  return {
    girthWidth,
    girthHeight,
    widthAllowance,
    heightAllowance,
    formulaNote: isSlotted
      ? `+${widthAllowance}W / +${heightAllowance}H (Slotted)`
      : `+${widthAllowance}W / +${heightAllowance}H (Standard)`,
  };
}

/**
 * Groups panels by identical real-world dimensions (within tolerance) and assigns sequential labels
 */
export function groupAndLabelPanels(
  panels: Panel[],
  rule: NamingRule = { prefix: "A", startNumber: 1, tolerance: 0, sortBy: "area", sortOrder: "desc" },
  customGroupOrder?: string[]
): {
  labeledPanels: Panel[];
  groups: PanelGroup[];
} {
  if (panels.length === 0) {
    return { labeledPanels: [], groups: [] };
  }

  // 1. Assign final labels to panels
  // Collect all active custom labels
  const allCustomLabels = new Set<string>();
  panels.forEach((p) => {
    if (p.customLabel && p.customLabel.trim() !== "") {
      allCustomLabels.add(p.customLabel.trim().toLowerCase());
    }
  });

  // Group unlabeled panels by dimensions AND slotted profile status
  // Slotted panels (shorter girth) MUST NEVER share the same autoGroup or label as regular panels even if dimensions match!
  const autoGroups: {
    realWidth: number;
    realHeight: number;
    isSlotted: boolean;
    panels: Panel[];
    unit: string;
  }[] = [];

  panels.forEach((panel) => {
    if (panel.customLabel && panel.customLabel.trim() !== "") {
      // Skip labeled panels for auto-grouping
      return;
    }

    const panelIsSlotted = Boolean(panel.isSlotted);

    let foundGroup = false;
    for (const group of autoGroups) {
      const widthDiff = Math.abs(group.realWidth - panel.realWidth);
      const heightDiff = Math.abs(group.realHeight - panel.realHeight);

      // Separate group if dimensions differ or if slotted status differs
      if (
        widthDiff <= rule.tolerance &&
        heightDiff <= rule.tolerance &&
        group.isSlotted === panelIsSlotted
      ) {
        group.panels.push(panel);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      autoGroups.push({
        realWidth: panel.realWidth,
        realHeight: panel.realHeight,
        isSlotted: panelIsSlotted,
        panels: [panel],
        unit: panel.unit || "mm",
      });
    }
  });

  // Sort autoGroups based on the rule (using drag order if sortBy is "none")
  autoGroups.sort((a, b) => {
    if (rule.sortBy === "none" && customGroupOrder && customGroupOrder.length > 0) {
      const keyAWithSlot = `${a.realWidth}_${a.realHeight}_${Boolean(a.isSlotted)}`;
      const keyBWithSlot = `${b.realWidth}_${b.realHeight}_${Boolean(b.isSlotted)}`;
      const keyAFallback = `${a.realWidth}_${a.realHeight}`;
      const keyBFallback = `${b.realWidth}_${b.realHeight}`;

      let idxA = customGroupOrder.indexOf(keyAWithSlot);
      if (idxA === -1) idxA = customGroupOrder.indexOf(keyAFallback);

      let idxB = customGroupOrder.indexOf(keyBWithSlot);
      if (idxB === -1) idxB = customGroupOrder.indexOf(keyBFallback);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
    }

    let valA = 0;
    let valB = 0;

    if (rule.sortBy === "area") {
      valA = a.realWidth * a.realHeight;
      valB = b.realWidth * b.realHeight;
    } else if (rule.sortBy === "width") {
      valA = a.realWidth;
      valB = b.realWidth;
    } else if (rule.sortBy === "height") {
      valA = a.realHeight;
      valB = b.realHeight;
    } else {
      return 0;
    }

    if (rule.sortOrder === "desc") {
      if (valB !== valA) return valB - valA;
      // If sizes identical, group standard panels first, then slotted panels
      return (a.isSlotted ? 1 : 0) - (b.isSlotted ? 1 : 0);
    } else {
      if (valA !== valB) return valA - valB;
      return (a.isSlotted ? 1 : 0) - (b.isSlotted ? 1 : 0);
    }
  });

  // Assign automatic labels to each autoGroup
  let currentLabelNum = rule.startNumber;
  const autoLabelsMap: { [panelId: string]: string } = {};

  autoGroups.forEach((group) => {
    let label = "";
    while (true) {
      label = `${rule.prefix}${currentLabelNum}`;
      currentLabelNum++;
      if (!allCustomLabels.has(label.toLowerCase())) {
        break;
      }
    }
    group.panels.forEach((p) => {
      autoLabelsMap[p.id] = label;
    });
  });

  // Map all panels to their final labeled panel objects
  const labeledPanels = panels.map((p) => {
    const finalLabel = (p.customLabel && p.customLabel.trim() !== "")
      ? p.customLabel.trim()
      : (autoLabelsMap[p.id] || `${rule.prefix}Auto`);
    return {
      ...p,
      label: finalLabel,
    };
  });

  // 2. Group ALL labeled panels by their assigned label to build PanelGroups
  const groupMap: { [label: string]: PanelGroup } = {};
  labeledPanels.forEach((p) => {
    const label = p.label;
    if (!groupMap[label]) {
      groupMap[label] = {
        label,
        realWidth: p.realWidth,
        realHeight: p.realHeight,
        panels: [],
        unit: p.unit || "mm",
        isSlotted: Boolean(p.isSlotted),
      };
    }
    groupMap[label].panels.push(p);
  });

  const finalGroups = Object.values(groupMap);

  // Enrich groups with slotted status
  finalGroups.forEach((group) => {
    const slottedCount = group.panels.filter((p) => p.isSlotted).length;
    group.slottedCount = slottedCount;
    group.isSlotted = slottedCount > 0 && slottedCount === group.panels.length;
  });

  // Sort finalGroups using custom drag order by dimensions if available, otherwise fallback to natural alphanumeric sort on label name
  finalGroups.sort((a, b) => {
    if (customGroupOrder && customGroupOrder.length > 0) {
      const keyAWithSlot = `${a.realWidth}_${a.realHeight}_${Boolean(a.isSlotted)}`;
      const keyBWithSlot = `${b.realWidth}_${b.realHeight}_${Boolean(b.isSlotted)}`;
      const keyAFallback = `${a.realWidth}_${a.realHeight}`;
      const keyBFallback = `${b.realWidth}_${b.realHeight}`;

      let idxA = customGroupOrder.indexOf(keyAWithSlot);
      if (idxA === -1) idxA = customGroupOrder.indexOf(keyAFallback);

      let idxB = customGroupOrder.indexOf(keyBWithSlot);
      if (idxB === -1) idxB = customGroupOrder.indexOf(keyBFallback);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
    }
    // Natural alphanumeric sort on label name
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
  });

  return { labeledPanels, groups: finalGroups };
}

/**
 * Exports panel data (labels, dimensions, and positions) to a JSON file for use in external project management tools
 */
export function exportToJSON(
  labeledPanels: Panel[],
  projectName: string = "",
  projectNumber: string = "",
  releaseNo: string = "",
  unit: string = "mm"
): void {
  const exportData = {
    project: {
      name: projectName || "Panelflow Project",
      number: projectNumber || "",
      release: releaseNo || "",
      exportedAt: new Date().toISOString(),
      totalPanels: labeledPanels.length,
      defaultUnit: unit,
    },
    panels: labeledPanels.map((p, idx) => ({
      id: p.id,
      label: p.customLabel || p.label || `Panel-${idx + 1}`,
      systemLabel: p.label || "",
      customLabel: p.customLabel || "",
      dimensions: {
        width: p.realWidth,
        height: p.realHeight,
        unit: p.unit || unit,
      },
      position: {
        xPercent: p.x,
        yPercent: p.y,
        widthPercent: p.width,
        heightPercent: p.height,
      },
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName = `${(projectName || "panels").trim().replace(/[^a-zA-Z0-9_-]/g, "_")}_panels_export.json`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports panels and BOM to packing-list formatted CSV text
 */
export function exportToCSV(
  groups: PanelGroup[],
  projectName: string = "",
  projectNumber: string = "",
  releaseNo: string = "",
  projectManager: string = "C.W",
  dueDate: string = "",
  panelType: string = "Reynobond",
  panelColour: string = "Bonewhite"
): string {
  const currentDate = new Date().toISOString().split('T')[0];
  const targetDueDate = dueDate || currentDate;

  let csv = "";
  
  // Row 1: PACKING LIST Title Block & Release Badge
  csv += `PACKING LIST,,,,,,,,,RELEASE,"${releaseNo || "08.Rev 02"}"\n`;
  
  // Row 2: PARKER JOHNSTON company title, Project Name, and main material spec
  csv += `PARKER JOHNSTON,,,Project Name :,"${projectName || "Block 22"}",,,,,,,"${panelType}","${panelColour}"\n`;
  
  // Row 3: Project Number & accessory header labels on the right
  csv += `,,,Project Number :,"${projectNumber || "21.202589"}",,,,,,Accessory,Colour,Size,LF/PCS\n`;
  
  // Row 4: Release and current date
  csv += `,,,Release #:,,"${releaseNo || "08.Rev 02"}",,,Date:,${currentDate}\n`;
  
  // Row 5: Project Manager & Due Date
  csv += `,,,Project Manager:,"${projectManager}",,,Due:,${targetDueDate}\n\n`;

  // Row 6: Main packing list columns
  csv += "Release #,Panel Label,Qty,Panel Type,Dim 1 (W),Dim 2 (H),Dim 3,Dim 4,Dim 5,Cut,Fab,Crate,Custom Reference\n";

  // Sort groups naturally so they list A1, A2, A3... consecutively by their label
  const sortedGroups = [...groups];
  sortedGroups.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

  // Print summary row with Total Qty (sum of all panels across all groups)
  const totalQty = groups.reduce((acc, g) => acc + g.panels.length, 0);
  csv += `,,${totalQty},,,,,,,,,,\n`;

  // Print all size group rows matching the UI Packing List
  sortedGroups.forEach((group) => {
    // Extract panel type prefix, e.g., "A" from "A428"
    const derivedType = group.label.trim().match(/^([A-Za-z_-]+)/)?.[1] || "A";
    
    // Find custom label if any of the panels in the group has one
    const customLabel = group.panels.find((p) => p.customLabel)?.customLabel || "";
    const needsStiffener = checkNeedsStiffener(group.realWidth, group.realHeight);
    let finalComment = customLabel;
    if (needsStiffener) {
      finalComment = finalComment ? `${finalComment} | Needs stiffener` : "Needs stiffener";
    }

    // Dim 1 = Width, Dim 2 = Height
    csv += `"${releaseNo || "08.Rev 02"}","${group.label}",${group.panels.length},"${derivedType}",${group.realWidth},${group.realHeight},,,,,"${finalComment.replace(/"/g, '""')}"\n`;
  });

  return csv;
}

/**
 * Exports Master List (Fabrication Girth Blank Schedule) to CSV text
 */
export function exportMasterListToCSV(
  groups: PanelGroup[],
  projectName: string = "",
  projectNumber: string = "",
  releaseNo: string = "",
  projectManager: string = "C.W",
  dueDate: string = "",
  panelType: string = "Reynobond",
  panelColour: string = "Bonewhite",
  settings: MasterListSettings = DEFAULT_MASTER_LIST_SETTINGS
): string {
  const currentDate = new Date().toISOString().split('T')[0];
  const targetDueDate = dueDate || currentDate;

  let csv = "";
  csv += `MASTER LIST (GIRTH BLANK CUT SIZES),,,,,,,,,RELEASE,"${releaseNo || "08.Rev 02"}"\n`;
  csv += `PARKER JOHNSTON,,,Project Name :,"${projectName || "Block 22"}",,,,,,,"${panelType}","${panelColour}"\n`;
  csv += `,,,Project Number :,"${projectNumber || "21.202589"}",,,,,,Return Allowance,${settings.returnAllowance} mm\n`;
  csv += `,,,Release #:,,"${releaseNo || "08.Rev 02"}",,,Date:,${currentDate}\n`;
  csv += `,,,Project Manager:,"${projectManager}",,,Due:,${targetDueDate}\n\n`;

  csv += "Release #,Panel Label,Qty,Profile,Packing W,Packing H,Girth W,Girth H,Girth Blank Size,Allowance,Girth Area (m2),Girth Area (sq ft),Stiffener Note,Cut,Fab,Custom Reference\n";

  const sortedGroups = [...groups];
  sortedGroups.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

  const totalQty = groups.reduce((acc, g) => acc + g.panels.length, 0);
  csv += `,,${totalQty},,,,,,,,,,,,,\n`;

  sortedGroups.forEach((group) => {
    const isGroupSlotted = group.isSlotted || (group.panels.length > 0 && group.panels.every(p => p.isSlotted));
    const girth = calculateGirth(group.realWidth, group.realHeight, Boolean(isGroupSlotted), settings);
    const needsStiffener = checkNeedsStiffener(group.realWidth, group.realHeight);
    const areaM2 = ((girth.girthWidth * girth.girthHeight) / 1000000) * group.panels.length;
    const areaSqFt = ((girth.girthWidth * girth.girthHeight) / 92903.04) * group.panels.length;
    const customLabel = group.panels.find((p) => p.customLabel)?.customLabel || "";
    const stiffenerNote = needsStiffener ? "Needs stiffener" : "";

    csv += `"${releaseNo || "08.Rev 02"}","${group.label}",${group.panels.length},"${isGroupSlotted ? "Slotted" : "Standard"}",${group.realWidth},${group.realHeight},${girth.girthWidth},${girth.girthHeight},"${girth.girthWidth} x ${girth.girthHeight} mm","${girth.formulaNote}",${areaM2.toFixed(2)},${areaSqFt.toFixed(1)},"${stiffenerNote}",,,"${customLabel.replace(/"/g, '""')}"\n`;
  });

  return csv;
}

/**
 * Exports dedicated standalone Master List (.xlsx) workbook
 */
export function exportMasterListToExcel(
  groups: PanelGroup[],
  projectName: string = "",
  projectNumber: string = "",
  releaseNo: string = "",
  projectManager: string = "C.W",
  dueDate: string = "",
  panelType: string = "Reynobond",
  panelColour: string = "Bonewhite",
  settings: MasterListSettings = DEFAULT_MASTER_LIST_SETTINGS
) {
  const currentDate = new Date().toISOString().split("T")[0];
  const targetDueDate = dueDate || currentDate;

  const masterListRows: any[][] = [];
  masterListRows.push(["MASTER LIST (GIRTH BLANK CUT SIZES)", "", "", "", "", "", "", "", "", "RELEASE", releaseNo || "08.Rev 02"]);
  masterListRows.push(["PARKER JOHNSTON", "", "", "Project Name :", projectName || "Block 22", "", "", "", "", "", panelType, panelColour]);
  masterListRows.push(["", "", "", "Project Number :", projectNumber || "21.202589", "", "", "", "", "", "Return Flange:", `${settings.returnAllowance} mm`]);
  masterListRows.push(["", "", "", "Release #:", "", releaseNo || "08.Rev 02", "", "", "Date:", currentDate]);
  masterListRows.push(["", "", "", "Project Manager:", projectManager || "C.W", "", "", "Due:", targetDueDate]);
  masterListRows.push([]);

  masterListRows.push([
    "Release #", "Panel Label", "Qty", "Profile Type",
    "Packing List W", "Packing List H", "Girth W", "Girth H",
    "Girth Blank Size", "Girth Allowance", "Girth Area (m²)", "Girth Area (sq ft)",
    "Stiffener Required", "Cut", "Fab", "Custom Reference"
  ]);

  const sortedGroups = [...groups];
  sortedGroups.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

  const totalQty = groups.reduce((acc, g) => acc + g.panels.length, 0);
  let totalAreaM2 = 0;
  let totalAreaSqFt = 0;
  let slottedPanelsCount = 0;
  let stiffenerPanelsCount = 0;

  sortedGroups.forEach((group) => {
    const isGroupSlotted = group.isSlotted || (group.panels.length > 0 && group.panels.every(p => p.isSlotted));
    const girth = calculateGirth(group.realWidth, group.realHeight, Boolean(isGroupSlotted), settings);
    const needsStiffener = checkNeedsStiffener(group.realWidth, group.realHeight);
    const areaM2 = ((girth.girthWidth * girth.girthHeight) / 1000000) * group.panels.length;
    const areaSqFt = ((girth.girthWidth * girth.girthHeight) / 92903.04) * group.panels.length;
    const customLabel = group.panels.find((p) => p.customLabel)?.customLabel || "";

    totalAreaM2 += areaM2;
    totalAreaSqFt += areaSqFt;
    if (isGroupSlotted) slottedPanelsCount += group.panels.length;
    if (needsStiffener) stiffenerPanelsCount += group.panels.length;

    masterListRows.push([
      releaseNo || "08.Rev 02",
      group.label,
      group.panels.length,
      isGroupSlotted ? "SLOTTED PANEL" : "STANDARD PANEL",
      group.realWidth,
      group.realHeight,
      girth.girthWidth,
      girth.girthHeight,
      `${girth.girthWidth} x ${girth.girthHeight} mm`,
      girth.formulaNote,
      Math.round(areaM2 * 100) / 100,
      Math.round(areaSqFt * 10) / 10,
      needsStiffener ? "Needs stiffener" : "No",
      "", "",
      customLabel
    ]);
  });

  // Summary Row
  masterListRows.push([
    "", "TOTAL", totalQty,
    `Slotted: ${slottedPanelsCount} | Std: ${totalQty - slottedPanelsCount}`,
    "", "", "", "", "",
    "",
    Math.round(totalAreaM2 * 100) / 100,
    Math.round(totalAreaSqFt * 10) / 10,
    stiffenerPanelsCount > 0 ? `${stiffenerPanelsCount} panels need stiffener` : "None",
    "", "", ""
  ]);

  const wsMasterList = XLSX.utils.aoa_to_sheet(masterListRows);
  wsMasterList['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 16 },
    { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 22 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMasterList, "Master List");
  const fileBase = projectName ? projectName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") : "master_list_girth_schedule";
  XLSX.writeFile(wb, `${fileBase}_release_${releaseNo || "1"}.xlsx`);
}

/**
 * Exports packing list, master list (girth), and accessories takeoffs to multi-sheet Microsoft Excel (.xlsx) file
 */
export function exportToExcel(
  groups: PanelGroup[],
  totalLengths: {
    reveal_5_8: { mm: number; lft: number; pieces: number };
    reveal_3_4: { mm: number; lft: number; pieces: number };
    reveal_custom: { mm: number; lft: number; pieces: number };
    base_track: { mm: number; lft: number; pieces: number };
  },
  revealWidths: { [key: string]: number },
  panelClipsCount: number,
  clipCalculationMethod: "excel" | "spacing",
  clipsSpacing: number,
  projectName: string = "",
  projectNumber: string = "",
  releaseNo: string = "",
  projectManager: string = "C.W",
  dueDate: string = "",
  panelType: string = "Reynobond",
  panelColour: string = "Bonewhite",
  settings: MasterListSettings = DEFAULT_MASTER_LIST_SETTINGS
) {
  const currentDate = new Date().toISOString().split("T")[0];
  const targetDueDate = dueDate || currentDate;

  // -------------------------------------------------------------
  // SHEET 1: PACKING LIST
  // -------------------------------------------------------------
  const packingListRows: any[][] = [];

  // Row 1: Title Block & Release
  packingListRows.push(["PACKING LIST", "", "", "", "", "", "", "", "", "RELEASE", releaseNo || "08.Rev 02"]);

  // Row 2: Company, Project Name, and material specs
  packingListRows.push(["PARKER JOHNSTON", "", "", "Project Name :", projectName || "Block 22", "", "", "", "", "", panelType, panelColour]);

  // Row 3: Project Number & accessory header labels
  packingListRows.push(["", "", "", "Project Number :", projectNumber || "21.202589", "", "", "", "", "", "Accessory", panelColour, "Size", "LF/PCS"]);

  // Row 4: Release and current date
  packingListRows.push(["", "", "", "Release #:", "", releaseNo || "08.Rev 02", "", "", "Date:", currentDate]);

  // Row 5: Project Manager & Due Date
  packingListRows.push(["", "", "", "Project Manager:", projectManager || "C.W", "", "", "Due:", targetDueDate]);

  // Blank row separator
  packingListRows.push([]);

  // Main table headers
  packingListRows.push(["Release #", "Panel Label", "Qty", "Panel Type", "Dim 1 (W)", "Dim 2 (H)", "Dim 3", "Dim 4", "Dim 5", "Cut", "Fab", "Crate", "Custom Reference"]);

  // Sort groups naturally
  const sortedGroups = [...groups];
  sortedGroups.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));

  // Total quantity
  const totalQty = groups.reduce((acc, g) => acc + g.panels.length, 0);
  packingListRows.push(["", "TOTAL", totalQty, "", "", "", "", "", "", "", "", "", ""]);

  // Panel size group rows
  sortedGroups.forEach((group) => {
    const derivedType = group.label.trim().match(/^([A-Za-z_-]+)/)?.[1] || "A";
    const customLabel = group.panels.find((p) => p.customLabel)?.customLabel || "";
    const needsStiffener = checkNeedsStiffener(group.realWidth, group.realHeight);
    let finalComment = customLabel;
    if (needsStiffener) {
      finalComment = finalComment ? `${finalComment} | Needs stiffener` : "Needs stiffener";
    }

    packingListRows.push([
      releaseNo || "08.Rev 02",
      group.label,
      group.panels.length,
      derivedType,
      group.realWidth,
      group.realHeight,
      "", "", "", "", "", "",
      finalComment
    ]);
  });

  // Create Sheet 1
  const wsPackingList = XLSX.utils.aoa_to_sheet(packingListRows);
  wsPackingList['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 26 }
  ];

  // -------------------------------------------------------------
  // SHEET 2: MASTER LIST (Fabrication Girth Blank Schedule)
  // -------------------------------------------------------------
  const masterListRows: any[][] = [];
  masterListRows.push(["MASTER LIST (GIRTH BLANK CUT SIZES)", "", "", "", "", "", "", "", "", "RELEASE", releaseNo || "08.Rev 02"]);
  masterListRows.push(["PARKER JOHNSTON", "", "", "Project Name :", projectName || "Block 22", "", "", "", "", "", panelType, panelColour]);
  masterListRows.push(["", "", "", "Project Number :", projectNumber || "21.202589", "", "", "", "", "", "Return Flange:", `${settings.returnAllowance} mm`]);
  masterListRows.push(["", "", "", "Release #:", "", releaseNo || "08.Rev 02", "", "", "Date:", currentDate]);
  masterListRows.push(["", "", "", "Project Manager:", projectManager || "C.W", "", "", "Due:", targetDueDate]);
  masterListRows.push([]);

  masterListRows.push([
    "Release #", "Panel Label", "Qty", "Profile Type",
    "Packing List W", "Packing List H", "Girth W", "Girth H",
    "Girth Blank Size", "Girth Allowance", "Girth Area (m²)", "Girth Area (sq ft)",
    "Stiffener Required", "Cut", "Fab", "Custom Reference"
  ]);

  let totalAreaM2 = 0;
  let totalAreaSqFt = 0;
  let slottedPanelsCount = 0;
  let stiffenerPanelsCount = 0;

  sortedGroups.forEach((group) => {
    const isGroupSlotted = group.isSlotted || (group.panels.length > 0 && group.panels.every(p => p.isSlotted));
    const girth = calculateGirth(group.realWidth, group.realHeight, Boolean(isGroupSlotted), settings);
    const needsStiffener = checkNeedsStiffener(group.realWidth, group.realHeight);
    const areaM2 = ((girth.girthWidth * girth.girthHeight) / 1000000) * group.panels.length;
    const areaSqFt = ((girth.girthWidth * girth.girthHeight) / 92903.04) * group.panels.length;
    const customLabel = group.panels.find((p) => p.customLabel)?.customLabel || "";

    totalAreaM2 += areaM2;
    totalAreaSqFt += areaSqFt;
    if (isGroupSlotted) slottedPanelsCount += group.panels.length;
    if (needsStiffener) stiffenerPanelsCount += group.panels.length;

    masterListRows.push([
      releaseNo || "08.Rev 02",
      group.label,
      group.panels.length,
      isGroupSlotted ? "SLOTTED PANEL" : "STANDARD PANEL",
      group.realWidth,
      group.realHeight,
      girth.girthWidth,
      girth.girthHeight,
      `${girth.girthWidth} x ${girth.girthHeight} mm`,
      girth.formulaNote,
      Math.round(areaM2 * 100) / 100,
      Math.round(areaSqFt * 10) / 10,
      needsStiffener ? "Needs stiffener" : "No",
      "", "",
      customLabel
    ]);
  });

  // Summary Row
  masterListRows.push([
    "", "TOTAL", totalQty,
    `Slotted: ${slottedPanelsCount} | Std: ${totalQty - slottedPanelsCount}`,
    "", "", "", "", "",
    "",
    Math.round(totalAreaM2 * 100) / 100,
    Math.round(totalAreaSqFt * 10) / 10,
    stiffenerPanelsCount > 0 ? `${stiffenerPanelsCount} panels need stiffener` : "None",
    "", "", ""
  ]);

  const wsMasterList = XLSX.utils.aoa_to_sheet(masterListRows);
  wsMasterList['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 16 },
    { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 22 }
  ];

  // -------------------------------------------------------------
  // SHEET 3: ACCESSORIES & TAKEOFFS (Matching Parker Johnston spec)
  // -------------------------------------------------------------
  const accessoriesRows: any[][] = [];

  // Title Banner
  accessoriesRows.push([`ACCESSORIES (${panelColour.toUpperCase() || "BONE WHITE"})`, "", "", "", "", "", ""]);

  // Header Info Block
  accessoriesRows.push(["PARKER JOHNSTON", "Project:", projectName || "Block 22", "Release #:", releaseNo || "22", "Date:", currentDate]);
  accessoriesRows.push(["", "PM:", projectManager || "C.W", "Due:", targetDueDate, "", ""]);
  accessoriesRows.push([]);

  // REVEALS section
  const rev58Mm = Math.round(totalLengths.reveal_5_8.mm);
  const rev34Mm = Math.round(totalLengths.reveal_3_4.mm);
  const revCustomMm = Math.round(totalLengths.reveal_custom.mm);
  const baseTrackMm = Math.round(totalLengths.base_track.mm);

  accessoriesRows.push(["REVEALS:", "5/8\" JOINT", `${rev58Mm} mm`, "", "PANEL CLIPS:", "3\" CLIPS", panelClipsCount]);
  accessoriesRows.push(["", "lft", "W", "L", "", "#", panelClipsCount]);
  accessoriesRows.push(["", Math.round(totalLengths.reveal_5_8.lft), `${revealWidths.reveal_5_8 || 42} mm`, "10 lft", "", "", ""]);
  accessoriesRows.push([]);

  accessoriesRows.push(["", "3/4\" JOINT", `${rev34Mm} mm`, "", "", "6\" CLIPS", ""]);
  accessoriesRows.push(["", "#", "W", "L", "", "#", "-"]);
  accessoriesRows.push(["", totalLengths.reveal_3_4.pieces, `${revealWidths.reveal_3_4 || 25} mm`, "10 lft", "", "", ""]);
  accessoriesRows.push([]);

  accessoriesRows.push(["", "CUSTOM JOINT", `${revCustomMm} mm`, "", "", "CUSTOM CLIPS", ""]);
  accessoriesRows.push(["", "#", "W", "L", "", "#", "L"]);
  accessoriesRows.push(["", totalLengths.reveal_custom.pieces, `${revealWidths.reveal_custom || 25} mm`, "10 lft", "", 0, "-"]);
  accessoriesRows.push([]);

  // BASE EXTRUSION section
  accessoriesRows.push(["BASE EXTRUSION:", "BASE TRACK", `${baseTrackMm} mm`, "", "MISC:", "CUSTOM", ""]);
  accessoriesRows.push(["", "LF", Math.round(totalLengths.base_track.lft), "", "", "#", "L"]);
  accessoriesRows.push(["", "#", "L", "", "", 0, "-"]);
  accessoriesRows.push(["", totalLengths.base_track.pieces, "10 lft", "", "", "", ""]);
  accessoriesRows.push([]);

  // TAKEOFF FORMULAS & SUMMARY NOTES
  accessoriesRows.push(["TAKEOFF SUMMARY & CALCULATIONS:"]);
  accessoriesRows.push(["Clip Calculation Method:", clipCalculationMethod === "excel" ? "LET Formula: =LET(W,Width,IF(W<=100,1,2+ROUNDUP((W-100)/600,0))) + LET(H,Height,(IF(H<=100,1,2+ROUNDUP((H-100)/600,0)))*2)" : `Grid Spacing (${clipsSpacing}" c-to-c)`]);
  accessoriesRows.push(["Total Panels Count:", totalQty]);
  accessoriesRows.push(["Base Track Total:", `${baseTrackMm} mm | ${Math.round(totalLengths.base_track.lft)} LF (${totalLengths.base_track.pieces} pcs @ 10')`]);
  accessoriesRows.push(["5/8\" Reveal Total:", `${rev58Mm} mm | ${Math.round(totalLengths.reveal_5_8.lft)} LF (${totalLengths.reveal_5_8.pieces} pcs @ 10')`]);
  accessoriesRows.push(["3/4\" Reveal Total:", `${rev34Mm} mm | ${Math.round(totalLengths.reveal_3_4.lft)} LF (${totalLengths.reveal_3_4.pieces} pcs @ 10')`]);
  accessoriesRows.push(["Custom Reveal Total:", `${revCustomMm} mm | ${Math.round(totalLengths.reveal_custom.lft)} LF (${totalLengths.reveal_custom.pieces} pcs @ 10')`]);

  // Create Sheet 3
  const wsAccessories = XLSX.utils.aoa_to_sheet(accessoriesRows);
  wsAccessories['!cols'] = [
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }
  ];

  // -------------------------------------------------------------
  // WRITE WORKBOOK
  // -------------------------------------------------------------
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsPackingList, "Packing List");
  XLSX.utils.book_append_sheet(wb, wsMasterList, "Master List");
  XLSX.utils.book_append_sheet(wb, wsAccessories, "Accessories Takeoff");

  const fileBase = projectName ? projectName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") : "panel_takeoff_bill_of_materials";
  XLSX.writeFile(wb, `${fileBase}_release_${releaseNo || "1"}.xlsx`);
}

/**
 * Default mock panels for initialization if the user has no layout uploaded yet
 * This is incredibly helpful so they can play around with the app right away!
 */
export const SAMPLE_PANELS: Panel[] = [
  { id: "p1", x: 10, y: 15, width: 22, height: 32, realWidth: 1200, realHeight: 600, unit: "mm" },
  { id: "p2", x: 34, y: 15, width: 22, height: 32, realWidth: 1200, realHeight: 600, unit: "mm" },
  { id: "p3", x: 58, y: 15, width: 22, height: 32, realWidth: 1200, realHeight: 600, unit: "mm" },
  { id: "p4", x: 10, y: 52, width: 15, height: 35, realWidth: 800, realHeight: 700, unit: "mm" },
  { id: "p5", x: 27, y: 52, width: 15, height: 35, realWidth: 800, realHeight: 700, unit: "mm" },
  { id: "p6", x: 44, y: 52, width: 15, height: 35, realWidth: 800, realHeight: 700, unit: "mm" },
  { id: "p7", x: 61, y: 52, width: 28, height: 35, realWidth: 1500, realHeight: 700, unit: "mm" },
];

export const SAMPLE_ACCESSORY_LINES = [
  { id: "sample-bt-p1", x1: 10, y1: 47, x2: 32, y2: 47, type: "base_track" },
  { id: "sample-bt-p2", x1: 34, y1: 47, x2: 56, y2: 47, type: "base_track" },
  { id: "sample-bt-p3", x1: 58, y1: 47, x2: 80, y2: 47, type: "base_track" },
  { id: "sample-bt-p4", x1: 10, y1: 87, x2: 25, y2: 87, type: "base_track" },
  { id: "sample-bt-p5", x1: 27, y1: 87, x2: 42, y2: 87, type: "base_track" },
  { id: "sample-bt-p6", x1: 44, y1: 87, x2: 59, y2: 87, type: "base_track" },
  { id: "sample-bt-p7", x1: 61, y1: 87, x2: 89, y2: 87, type: "base_track" },
  { id: "line-rev1", x1: 33, y1: 15, x2: 33, y2: 47, type: "reveal_5_8" },
  { id: "line-rev2", x1: 57, y1: 15, x2: 57, y2: 47, type: "reveal_5_8" },
  { id: "line-rev3", x1: 26, y1: 52, x2: 26, y2: 87, type: "reveal_5_8" },
  { id: "line-rev4", x1: 43, y1: 52, x2: 43, y2: 87, type: "reveal_5_8" },
  { id: "line-rev5", x1: 60, y1: 52, x2: 60, y2: 87, type: "reveal_5_8" }
];

export interface ParsedExcelPackingListResult {
  panels: Panel[];
  projectInfo: {
    projectName?: string;
    projectNumber?: string;
    releaseNo?: string;
    projectManager?: string;
    dueDate?: string;
    panelType?: string;
    panelColour?: string;
  };
  totalPanelsCount: number;
  groupsCount: number;
}

/**
 * Parses an Excel (.xlsx / .xls) or CSV file containing a packing list or schedule
 * and extracts panels, dimensions, quantities, and project metadata.
 */
export function parseExcelPackingList(
  data: ArrayBuffer | Uint8Array | string
): ParsedExcelPackingListResult {
  let wb: XLSX.WorkBook;
  if (typeof data === "string") {
    wb = XLSX.read(data, { type: "string" });
  } else {
    wb = XLSX.read(data, { type: "array" });
  }

  // Find best sheet: Prefer "Packing List", "Schedule", "Panels", or first sheet
  let targetSheetName = wb.SheetNames[0];
  for (const name of wb.SheetNames) {
    const lower = name.toLowerCase();
    if (lower.includes("packing") || lower.includes("panel") || lower.includes("schedule")) {
      targetSheetName = name;
      break;
    }
  }

  const sheet = wb.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error("No readable sheet found in Excel file.");
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!rows || rows.length === 0) {
    throw new Error("The selected Excel sheet contains no rows.");
  }

  const projectInfo: ParsedExcelPackingListResult["projectInfo"] = {};

  // 1. Scan metadata (top rows)
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cellStr = String(row[c] || "").trim();
      const nextCellStr = String(row[c + 1] || "").trim();

      if (/project\s*name/i.test(cellStr) && nextCellStr) {
        projectInfo.projectName = nextCellStr;
      } else if (/project\s*(number|#)/i.test(cellStr) && nextCellStr) {
        projectInfo.projectNumber = nextCellStr;
      } else if (/release\s*(#|no|number)?/i.test(cellStr) && nextCellStr) {
        projectInfo.releaseNo = nextCellStr;
      } else if (/(project\s*manager|pm:?)/i.test(cellStr) && nextCellStr) {
        projectInfo.projectManager = nextCellStr;
      } else if (/(due\s*date|due:?)/i.test(cellStr) && nextCellStr) {
        projectInfo.dueDate = nextCellStr;
      } else if (/panel\s*type/i.test(cellStr) && nextCellStr) {
        projectInfo.panelType = nextCellStr;
      } else if (/colou?r/i.test(cellStr) && nextCellStr) {
        projectInfo.panelColour = nextCellStr;
      }
    }
  }

  // 2. Identify header row for panel list
  let headerRowIndex = -1;
  let labelCol = -1;
  let qtyCol = -1;
  let widthCol = -1;
  let heightCol = -1;
  let customCol = -1;
  let slottedCol = -1;

  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r];
    let foundWidth = false;
    let foundHeight = false;

    row.forEach((cellVal: any, cIdx: number) => {
      const val = String(cellVal || "").toLowerCase().trim();
      if (
        val === "label" ||
        val === "panel label" ||
        val === "mark" ||
        val === "panel id" ||
        val === "panel mark" ||
        val === "tag" ||
        val === "id"
      ) {
        labelCol = cIdx;
      } else if (
        val === "qty" ||
        val === "quantity" ||
        val === "count" ||
        val === "pcs" ||
        val === "pieces" ||
        val === "total qty"
      ) {
        qtyCol = cIdx;
      } else if (
        val.includes("dim 1") ||
        val === "width" ||
        val.includes("dim 1 (w)") ||
        val === "w" ||
        val === "dim w" ||
        val === "realwidth"
      ) {
        widthCol = cIdx;
        foundWidth = true;
      } else if (
        val.includes("dim 2") ||
        val === "height" ||
        val.includes("dim 2 (h)") ||
        val === "h" ||
        val === "dim h" ||
        val === "realheight"
      ) {
        heightCol = cIdx;
        foundHeight = true;
      } else if (
        val.includes("custom") ||
        val.includes("reference") ||
        val.includes("description") ||
        val.includes("note") ||
        val.includes("remarks")
      ) {
        customCol = cIdx;
      } else if (
        val.includes("slott") ||
        val === "profile" ||
        val === "slot" ||
        val === "slotted?"
      ) {
        slottedCol = cIdx;
      }
    });

    if (foundWidth && foundHeight) {
      headerRowIndex = r;
      break;
    }
  }

  // Fallback if no header row found: search for first row with 2 numeric dimensions
  if (headerRowIndex === -1) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const numCols: number[] = [];
      row.forEach((cell: any, c: number) => {
        const n = parseFloat(cell);
        if (!isNaN(n) && n > 0) numCols.push(c);
      });
      if (numCols.length >= 2) {
        headerRowIndex = r - 1;
        widthCol = numCols[0];
        heightCol = numCols[1];
        if (numCols.length >= 3) {
          qtyCol = numCols[0];
          widthCol = numCols[1];
          heightCol = numCols[2];
        }
        break;
      }
    }
  }

  const parsedItems: {
    label?: string;
    width: number;
    height: number;
    qty: number;
    customLabel?: string;
    isSlotted?: boolean;
  }[] = [];

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Check if total summary row
    const rowText = row.map((c) => String(c || "").toLowerCase()).join(" ");
    if (rowText.includes("total") || rowText.includes("sum")) continue;

    const wVal = widthCol >= 0 ? parseFloat(String(row[widthCol]).replace(/[^0-9.]/g, "")) : 0;
    const hVal = heightCol >= 0 ? parseFloat(String(row[heightCol]).replace(/[^0-9.]/g, "")) : 0;

    if (isNaN(wVal) || isNaN(hVal) || wVal <= 0 || hVal <= 0) continue;

    let qVal = 1;
    if (qtyCol >= 0 && row[qtyCol] !== undefined && row[qtyCol] !== "") {
      const parsedQ = parseInt(String(row[qtyCol]).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedQ) && parsedQ > 0) {
        qVal = parsedQ;
      }
    }

    const lbl = labelCol >= 0 && row[labelCol] ? String(row[labelCol]).trim() : undefined;
    const cLbl = customCol >= 0 && row[customCol] ? String(row[customCol]).trim() : undefined;

    let isSlotted = false;
    if (slottedCol >= 0 && row[slottedCol] !== undefined) {
      const sVal = String(row[slottedCol]).toLowerCase().trim();
      if (sVal === "yes" || sVal === "y" || sVal === "true" || sVal.includes("slot")) {
        isSlotted = true;
      }
    }
    if (lbl && /slott?ed/i.test(lbl)) isSlotted = true;
    if (cLbl && /slott?ed/i.test(cLbl)) isSlotted = true;

    parsedItems.push({
      label: lbl,
      width: Math.round(wVal),
      height: Math.round(hVal),
      qty: qVal,
      customLabel: cLbl,
      isSlotted
    });
  }

  if (parsedItems.length === 0) {
    throw new Error("Could not find any panel dimensions in the Excel file. Please ensure there are columns for Width and Height (e.g. Dim 1, Dim 2, or Width, Height).");
  }

  // Generate individual panels with layout positions on canvas
  const panels: Panel[] = [];
  let panelIndex = 1;

  // Arrange on a clean 5-column grid
  const cols = 5;
  const colWidthPct = 15;
  const rowHeightPct = 12;
  const gapX = 3;
  const gapY = 3;
  const startX = 6;
  const startY = 8;

  let currentSlot = 0;

  parsedItems.forEach((item) => {
    for (let q = 0; q < item.qty; q++) {
      const col = currentSlot % cols;
      const row = Math.floor(currentSlot / cols);

      const x = startX + col * (colWidthPct + gapX);
      const y = startY + row * (rowHeightPct + gapY);

      panels.push({
        id: `panel-xl-${Date.now()}-${panelIndex}`,
        x: Math.min(x, 82),
        y: Math.min(y, 82),
        width: colWidthPct,
        height: rowHeightPct,
        realWidth: item.width,
        realHeight: item.height,
        unit: "mm",
        label: item.label,
        customLabel: item.customLabel,
        isSlotted: Boolean(item.isSlotted)
      });

      panelIndex++;
      currentSlot++;
    }
  });

  return {
    panels,
    projectInfo,
    totalPanelsCount: panels.length,
    groupsCount: parsedItems.length
  };
}

export interface DxfExportOptions {
  panels: Panel[];
  accessoryLines?: AccessoryLine[];
  dxfData?: any | null;
  projectName?: string;
  projectNumber?: string;
  releaseNo?: string;
  mode?: "elevation" | "fabrication";
  includeOutlines?: boolean;
  includeLabels?: boolean;
  includeDimensions?: boolean;
  includeAccessories?: boolean;
}

/**
 * Generates an AutoCAD-compliant DXF (Drawing Exchange Format, Release 12 / AC1009)
 * containing named panel boundaries, center label text, dimensions, and accessories.
 * AC1009 is universally supported by 100% of CAD and CAM programs without requiring complex handles.
 * Opens directly in AutoCAD, DWG TrueView, SolidWorks, Rhino, Revit, LibreCAD, etc.
 */
export function generatePanelsDxf(options: DxfExportOptions): string {
  const {
    panels,
    accessoryLines = [],
    dxfData = null,
    mode = "elevation",
    includeOutlines = true,
    includeLabels = true,
    includeDimensions = true,
    includeAccessories = true,
  } = options;

  const lines: string[] = [];

  // 1. HEADER SECTION (Release 12 AC1009 for universal AutoCAD / CAD viewer compatibility)
  lines.push(
    "0", "SECTION",
    "2", "HEADER",
    "9", "$ACADVER",
    "1", "AC1009",
    "9", "$INSUNITS",
    "70", "4", // 4 = Millimeters
    "9", "$MEASUREMENT",
    "70", "1", // 1 = Metric
    "0", "ENDSEC"
  );

  // 2. TABLES SECTION (LTYPE, LAYER, STYLE)
  lines.push(
    "0", "SECTION",
    "2", "TABLES",
    // Table 1: LTYPE (Line types) - Required by AutoCAD when layers specify CONTINUOUS
    "0", "TABLE",
    "2", "LTYPE",
    "70", "1",
    "0", "LTYPE",
    "2", "CONTINUOUS",
    "70", "0",
    "3", "Solid line",
    "72", "65",
    "73", "0",
    "40", "0.0",
    "0", "ENDTAB",
    // Table 2: LAYER (Layers) - Layer 0 is mandatory in AutoCAD
    "0", "TABLE",
    "2", "LAYER",
    "70", "6",
    // Standard Layer 0
    "0", "LAYER", "2", "0", "70", "0", "62", "7", "6", "CONTINUOUS",
    // Layer 1: PANELS (Cyan - 4)
    "0", "LAYER", "2", "PANELS", "70", "0", "62", "4", "6", "CONTINUOUS",
    // Layer 2: PANEL_LABELS (Yellow - 2)
    "0", "LAYER", "2", "PANEL_LABELS", "70", "0", "62", "2", "6", "CONTINUOUS",
    // Layer 3: PANEL_DIMENSIONS (Green - 3)
    "0", "LAYER", "2", "PANEL_DIMENSIONS", "70", "0", "62", "3", "6", "CONTINUOUS",
    // Layer 4: REVEALS (Red - 1)
    "0", "LAYER", "2", "REVEALS", "70", "0", "62", "1", "6", "CONTINUOUS",
    // Layer 5: BASE_TRACK (Blue - 5)
    "0", "LAYER", "2", "BASE_TRACK", "70", "0", "62", "5", "6", "CONTINUOUS",
    "0", "ENDTAB",
    // Table 3: STYLE (Text styles)
    "0", "TABLE",
    "2", "STYLE",
    "70", "1",
    "0", "STYLE",
    "2", "STANDARD",
    "70", "0",
    "40", "0.0",
    "41", "1.0",
    "50", "0.0",
    "71", "0",
    "42", "2.5",
    "3", "txt",
    "4", "",
    "0", "ENDTAB",
    "0", "ENDSEC"
  );

  // 3. BLOCKS SECTION
  lines.push(
    "0", "SECTION",
    "2", "BLOCKS",
    "0", "ENDSEC"
  );

  // 4. ENTITIES SECTION
  lines.push(
    "0", "SECTION",
    "2", "ENTITIES"
  );

  // Calculate coordinates based on mode
  if (mode === "fabrication") {
    // FABRICATION / CNC GRID: Lay out panels neatly row-by-row
    let currentX = 0;
    let currentY = 0;
    let maxRowHeight = 0;
    const spacingX = 80; // 80mm between panels
    const spacingY = 120; // 120mm between rows
    const maxRowWidth = 4500; // start new row when reaching 4.5 meters

    panels.forEach((p, idx) => {
      const w = p.realWidth > 0 ? p.realWidth : 1200;
      const h = p.realHeight > 0 ? p.realHeight : 600;

      if (currentX > 0 && currentX + w > maxRowWidth) {
        currentX = 0;
        currentY += maxRowHeight + spacingY;
        maxRowHeight = 0;
      }

      const x1 = currentX;
      const y1 = currentY;
      const x2 = currentX + w;
      const y2 = currentY + h;
      const centerX = currentX + w / 2;
      const centerY = currentY + h / 2;

      if (h > maxRowHeight) maxRowHeight = h;
      currentX += w + spacingX;

      const label = p.label || p.customLabel || `P${idx + 1}`;
      const textH = Math.max(Math.min(w, h) * 0.18, 40);

      // Panel boundary (Closed POLYLINE)
      if (includeOutlines) {
        lines.push(
          "0", "POLYLINE",
          "8", "PANELS",
          "66", "1",
          "70", "1",
          "0", "VERTEX", "8", "PANELS", "10", x1.toFixed(3), "20", y1.toFixed(3), "30", "0.0",
          "0", "VERTEX", "8", "PANELS", "10", x2.toFixed(3), "20", y1.toFixed(3), "30", "0.0",
          "0", "VERTEX", "8", "PANELS", "10", x2.toFixed(3), "20", y2.toFixed(3), "30", "0.0",
          "0", "VERTEX", "8", "PANELS", "10", x1.toFixed(3), "20", y2.toFixed(3), "30", "0.0",
          "0", "SEQEND",
          "8", "PANELS"
        );
      }

      // Panel Center Label (TEXT)
      if (includeLabels) {
        const labelY = includeDimensions ? centerY + textH * 0.4 : centerY;
        lines.push(
          "0", "TEXT",
          "8", "PANEL_LABELS",
          "10", centerX.toFixed(3),
          "20", labelY.toFixed(3),
          "30", "0.0",
          "40", textH.toFixed(3),
          "1", label,
          "72", "1",
          "11", centerX.toFixed(3),
          "21", labelY.toFixed(3),
          "31", "0.0"
        );
      }

      // Panel Dimension Subtext (TEXT)
      if (includeDimensions) {
        const dimH = textH * 0.55;
        const dimY = centerY - textH * 0.5;
        const dimStr = `${Math.round(w)} x ${Math.round(h)} mm`;
        lines.push(
          "0", "TEXT",
          "8", "PANEL_DIMENSIONS",
          "10", centerX.toFixed(3),
          "20", dimY.toFixed(3),
          "30", "0.0",
          "40", dimH.toFixed(3),
          "1", dimStr,
          "72", "1",
          "11", centerX.toFixed(3),
          "21", dimY.toFixed(3),
          "31", "0.0"
        );
      }
    });
  } else {
    // ELEVATION MODE: Position panels in their architectural elevation coordinates
    let scaleX = 50;
    let scaleY = 50;
    let totalCanvasH = 5000;
    let xMin = 0;
    let yMax = 5000;
    let isDxfCoord = false;

    if (dxfData && dxfData.bounds && dxfData.bounds.width > 0 && dxfData.bounds.height > 0) {
      isDxfCoord = true;
      xMin = dxfData.bounds.xMin || 0;
      yMax = dxfData.bounds.yMax || 0;
      scaleX = dxfData.bounds.width / 100;
      scaleY = dxfData.bounds.height / 100;
    } else {
      let mmPerPctX = 0;
      let countX = 0;
      panels.forEach((p) => {
        if (p.width > 0 && p.realWidth > 0) {
          mmPerPctX += p.realWidth / p.width;
          countX++;
        }
      });
      scaleX = countX > 0 ? mmPerPctX / countX : 50;

      let mmPerPctY = 0;
      let countY = 0;
      panels.forEach((p) => {
        if (p.height > 0 && p.realHeight > 0) {
          mmPerPctY += p.realHeight / p.height;
          countY++;
        }
      });
      scaleY = countY > 0 ? mmPerPctY / countY : 50;
      totalCanvasH = 100 * scaleY;
    }

    panels.forEach((p, idx) => {
      let x1: number, y1: number, x2: number, y2: number, w: number, h: number;

      if (isDxfCoord) {
        x1 = xMin + (p.x / 100) * dxfData.bounds.width;
        y2 = yMax - (p.y / 100) * dxfData.bounds.height; // top
        w = (p.width / 100) * dxfData.bounds.width;
        h = (p.height / 100) * dxfData.bounds.height;
        x2 = x1 + w;
        y1 = y2 - h; // bottom
      } else {
        w = p.realWidth > 0 ? p.realWidth : p.width * scaleX;
        h = p.realHeight > 0 ? p.realHeight : p.height * scaleY;
        x1 = p.x * scaleX;
        y2 = totalCanvasH - p.y * scaleY;
        x2 = x1 + w;
        y1 = y2 - h;
      }

      const centerX = x1 + w / 2;
      const centerY = y1 + h / 2;
      const label = p.label || p.customLabel || `P${idx + 1}`;
      const textH = Math.max(Math.min(w, h) * 0.18, 40);

      // Panel boundary (Closed POLYLINE)
      if (includeOutlines) {
        lines.push(
          "0", "POLYLINE",
          "8", "PANELS",
          "66", "1",
          "70", "1",
          "0", "VERTEX", "8", "PANELS", "10", x1.toFixed(3), "20", y1.toFixed(3), "30", "0.0",
          "0", "VERTEX", "8", "PANELS", "10", x2.toFixed(3), "20", y1.toFixed(3), "30", "0.0",
          "0", "VERTEX", "8", "PANELS", "10", x2.toFixed(3), "20", y2.toFixed(3), "30", "0.0",
          "0", "VERTEX", "8", "PANELS", "10", x1.toFixed(3), "20", y2.toFixed(3), "30", "0.0",
          "0", "SEQEND",
          "8", "PANELS"
        );
      }

      // Panel Center Label (TEXT)
      if (includeLabels) {
        const labelY = includeDimensions ? centerY + textH * 0.4 : centerY;
        lines.push(
          "0", "TEXT",
          "8", "PANEL_LABELS",
          "10", centerX.toFixed(3),
          "20", labelY.toFixed(3),
          "30", "0.0",
          "40", textH.toFixed(3),
          "1", label,
          "72", "1",
          "11", centerX.toFixed(3),
          "21", labelY.toFixed(3),
          "31", "0.0"
        );
      }

      // Panel Dimension Subtext (TEXT)
      if (includeDimensions) {
        const dimH = textH * 0.55;
        const dimY = centerY - textH * 0.5;
        const dimStr = `${Math.round(w)} x ${Math.round(h)} mm`;
        lines.push(
          "0", "TEXT",
          "8", "PANEL_DIMENSIONS",
          "10", centerX.toFixed(3),
          "20", dimY.toFixed(3),
          "30", "0.0",
          "40", dimH.toFixed(3),
          "1", dimStr,
          "72", "1",
          "11", centerX.toFixed(3),
          "21", dimY.toFixed(3),
          "31", "0.0"
        );
      }
    });

    // Accessories (LINE)
    if (includeAccessories && accessoryLines.length > 0) {
      accessoryLines.forEach((line) => {
        let cadX1 = 0, cadY1 = 0, cadX2 = 0, cadY2 = 0;
        if (isDxfCoord) {
          cadX1 = xMin + (line.x1 / 100) * dxfData.bounds.width;
          cadY1 = yMax - (line.y1 / 100) * dxfData.bounds.height;
          cadX2 = xMin + (line.x2 / 100) * dxfData.bounds.width;
          cadY2 = yMax - (line.y2 / 100) * dxfData.bounds.height;
        } else {
          cadX1 = line.x1 * scaleX;
          cadY1 = totalCanvasH - line.y1 * scaleY;
          cadX2 = line.x2 * scaleX;
          cadY2 = totalCanvasH - line.y2 * scaleY;
        }

        const layer = line.type === "base_track" ? "BASE_TRACK" : "REVEALS";
        lines.push(
          "0", "LINE",
          "8", layer,
          "10", cadX1.toFixed(3),
          "20", cadY1.toFixed(3),
          "30", "0.0",
          "11", cadX2.toFixed(3),
          "21", cadY2.toFixed(3),
          "31", "0.0"
        );
      });
    }
  }

  // 5. END ENTITIES & EOF
  lines.push(
    "0", "ENDSEC",
    "0", "EOF"
  );

  // AutoCAD requires Windows CRLF (\r\n) line termination
  return lines.join("\r\n") + "\r\n";
}

/**
 * Generates a clean standalone vector SVG representation of the panels CAD drawing.
 * Can be opened immediately in any browser (Chrome, Safari, Edge) or vector software.
 */
export function generatePanelsSvg(options: DxfExportOptions): { svgString: string; width: number; height: number } {
  const {
    panels,
    accessoryLines = [],
    dxfData = null,
    mode = "elevation",
    includeOutlines = true,
    includeLabels = true,
    includeDimensions = true,
    includeAccessories = true,
  } = options;

  interface SvgItem {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    dimStr: string;
  }

  const items: SvgItem[] = [];

  if (mode === "fabrication") {
    let currentX = 0;
    let currentY = 0;
    let maxRowHeight = 0;
    const spacingX = 80;
    const spacingY = 120;
    const maxRowWidth = 4500;

    panels.forEach((p, idx) => {
      const w = p.realWidth > 0 ? p.realWidth : 1200;
      const h = p.realHeight > 0 ? p.realHeight : 600;

      if (currentX > 0 && currentX + w > maxRowWidth) {
        currentX = 0;
        currentY += maxRowHeight + spacingY;
        maxRowHeight = 0;
      }

      items.push({
        x: currentX,
        y: currentY,
        w,
        h,
        label: p.label || p.customLabel || `P${idx + 1}`,
        dimStr: `${Math.round(w)} x ${Math.round(h)} mm`,
      });

      if (h > maxRowHeight) maxRowHeight = h;
      currentX += w + spacingX;
    });
  } else {
    // Elevation mode
    let scaleX = 50;
    let scaleY = 50;

    if (dxfData && dxfData.bounds && dxfData.bounds.width > 0 && dxfData.bounds.height > 0) {
      scaleX = dxfData.bounds.width / 100;
      scaleY = dxfData.bounds.height / 100;
    } else {
      let mmPerPctX = 0;
      let countX = 0;
      panels.forEach((p) => {
        if (p.width > 0 && p.realWidth > 0) {
          mmPerPctX += p.realWidth / p.width;
          countX++;
        }
      });
      scaleX = countX > 0 ? mmPerPctX / countX : 50;

      let mmPerPctY = 0;
      let countY = 0;
      panels.forEach((p) => {
        if (p.height > 0 && p.realHeight > 0) {
          mmPerPctY += p.realHeight / p.height;
          countY++;
        }
      });
      scaleY = countY > 0 ? mmPerPctY / countY : 50;
    }

    panels.forEach((p, idx) => {
      const w = p.realWidth > 0 ? p.realWidth : p.width * scaleX;
      const h = p.realHeight > 0 ? p.realHeight : p.height * scaleY;
      const x = p.x * scaleX;
      const y = p.y * scaleY;

      items.push({
        x,
        y,
        w,
        h,
        label: p.label || p.customLabel || `P${idx + 1}`,
        dimStr: `${Math.round(w)} x ${Math.round(h)} mm`,
      });
    });
  }

  // Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  items.forEach((item) => {
    if (item.x < minX) minX = item.x;
    if (item.y < minY) minY = item.y;
    if (item.x + item.w > maxX) maxX = item.x + item.w;
    if (item.y + item.h > maxY) maxY = item.y + item.h;
  });

  if (items.length === 0) {
    minX = 0; minY = 0; maxX = 1000; maxY = 1000;
  }

  const margin = 100;
  const viewBoxX = minX - margin;
  const viewBoxY = minY - margin;
  const viewBoxW = Math.max(maxX - minX + margin * 2, 200);
  const viewBoxH = Math.max(maxY - minY + margin * 2, 200);

  let svgElements = "";

  // Panels layer
  if (includeOutlines) {
    items.forEach((item) => {
      svgElements += `<rect x="${item.x.toFixed(1)}" y="${item.y.toFixed(1)}" width="${item.w.toFixed(1)}" height="${item.h.toFixed(1)}" fill="#0284c7" fill-opacity="0.08" stroke="#0284c7" stroke-width="3" rx="4" />`;
    });
  }

  // Labels layer
  if (includeLabels) {
    items.forEach((item) => {
      const centerX = item.x + item.w / 2;
      const textH = Math.max(Math.min(item.w, item.h) * 0.16, 28);
      const centerY = includeDimensions ? (item.y + item.h / 2 - textH * 0.25) : (item.y + item.h / 2);

      svgElements += `<text x="${centerX.toFixed(1)}" y="${centerY.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="monospace, sans-serif" font-size="${textH.toFixed(1)}px" font-weight="bold" fill="#0f172a">${item.label}</text>`;
    });
  }

  // Dimensions layer
  if (includeDimensions) {
    items.forEach((item) => {
      const centerX = item.x + item.w / 2;
      const textH = Math.max(Math.min(item.w, item.h) * 0.16, 28);
      const dimH = textH * 0.65;
      const dimY = item.y + item.h / 2 + textH * 0.7;

      svgElements += `<text x="${centerX.toFixed(1)}" y="${dimY.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="monospace, sans-serif" font-size="${dimH.toFixed(1)}px" fill="#475569">${item.dimStr}</text>`;
    });
  }

  // Accessories layer
  if (includeAccessories && mode === "elevation" && accessoryLines.length > 0) {
    const scaleX = (maxX - minX) / 100 || 50;
    const scaleY = (maxY - minY) / 100 || 50;

    accessoryLines.forEach((line) => {
      const x1 = line.x1 * scaleX;
      const y1 = line.y1 * scaleY;
      const x2 = line.x2 * scaleX;
      const y2 = line.y2 * scaleY;
      const color = line.type === "base_track" ? "#2563eb" : "#dc2626";

      svgElements += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="4" stroke-dasharray="${line.type === 'base_track' ? 'none' : '6 4'}" />`;
    });
  }

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxX.toFixed(1)} ${viewBoxY.toFixed(1)} ${viewBoxW.toFixed(1)} ${viewBoxH.toFixed(1)}" width="100%" height="100%">
  <rect x="${viewBoxX.toFixed(1)}" y="${viewBoxY.toFixed(1)}" width="${viewBoxW.toFixed(1)}" height="${viewBoxH.toFixed(1)}" fill="#ffffff" />
  ${svgElements}
</svg>`;

  return {
    svgString,
    width: Math.round(viewBoxW),
    height: Math.round(viewBoxH),
  };
}
