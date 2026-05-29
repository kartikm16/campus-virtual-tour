export interface Hotspot {
  id: string;
  yaw: number; // Horizontal angle in radians (0 to 2 * Math.PI)
  pitch: number; // Vertical offset angle in radians (-Math.PI/4 to Math.PI/4)
  label: string;
  targetAreaId?: string; // If set, clicking will teleport to this area
  info?: string; // Additional popover info
}

export interface CampusArea {
  id: string;
  name: string;
  title: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  location: string;
  facilities: string[];
  keyStats: {
    label: string;
    value: string;
  }[];
  hotspots: Hotspot[];
}
