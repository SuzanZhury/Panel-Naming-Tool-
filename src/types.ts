export interface MasterListSettings {
  returnAllowance: number; // e.g. 18 mm standard return
  widthAllowance: number; // e.g. 36 mm (+18 * 2 on width)
  slottedHeightAllowance: number; // e.g. 18 mm (+18 for slotted panel height)
  normalHeightAllowance: number; // e.g. 36 mm (+18 * 2 for standard panel height)
}

export interface Panel {
  id: string;
  x: number; // percentage from left (0 to 100)
  y: number; // percentage from top (0 to 100)
  width: number; // percentage of image width (0 to 100)
  height: number; // percentage of image height (0 to 100)
  realWidth: number; // real-world width, e.g. 1200
  realHeight: number; // real-world height, e.g. 600
  unit: string; // e.g. "mm", "in"
  label?: string; // calculated dynamically, e.g. "A428"
  customLabel?: string; // user-specified name override
  isSlotted?: boolean; // whether panel is a slotted panel (shorter girth)
}

export interface NamingRule {
  prefix: string; // e.g., "A"
  startNumber: number; // e.g., 428
  tolerance: number; // e.g., 2 (for matching similar sizes within e.g. 2mm)
  sortBy: "area" | "width" | "height" | "none"; // how to sort groups before numbering
  sortOrder: "asc" | "desc";
}

export interface PanelGroup {
  label: string;
  realWidth: number;
  realHeight: number;
  panels: Panel[];
  unit: string;
  isSlotted?: boolean;
  slottedCount?: number;
}

export interface AccessoryLine {
  id: string;
  x1: number; // percentage from left (0 to 100)
  y1: number; // percentage from top (0 to 100)
  x2: number; // percentage from left (0 to 100)
  y2: number; // percentage from top (0 to 100)
  type: "reveal_5_8" | "reveal_3_4" | "reveal_custom" | "base_track";
  label?: string;
}

export interface SavedProject {
  id: string;
  name: string;
  projectNumber?: string;
  releaseNo?: string;
  projectManager?: string;
  createdAt: string;
  updatedAt: string;
  imageName?: string;
  imageUrl?: string | null;
  dxfData?: any | null;
  panels: Panel[];
  accessoryLines: AccessoryLine[];
  revealWidths?: { [key: string]: number };
  accessoryColors?: { [key: string]: string };
  clipsSpacing?: number;
  clipCalculationMethod?: "border_plus_grid" | "perimeter_only" | "grid_intersections";
  referencePanel?: Panel | null;
  prefix?: string;
  startNumber?: number;
  tolerance?: number;
  sortBy?: "area" | "width" | "height" | "none";
  sortOrder?: "asc" | "desc";
  customGroupOrder?: string[];
  unit?: string;
  masterListSettings?: MasterListSettings;
}


