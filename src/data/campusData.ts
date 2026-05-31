import { CampusArea } from "../types";

const makerSpacePanorama = "/images/maker_space_360_panorama_1779278754046.png";
const evLabPanorama = "/images/ev-lab-projects.jpg";

export const CAMPUS_AREAS: CampusArea[] = [
  {
    id: "makers-studio",
    name: "Makers Studio",
    title: "Makers Innovation Studio",
    description: "A modern innovation space where students build robotics, embedded systems, coding projects, AI applications, and engineering prototypes. The environment is designed to feel creative, futuristic, and technology focused.",
    imageUrl: makerSpacePanorama,
    thumbnailUrl: makerSpacePanorama,
    location: "Ground Floor, Innovation Wing",
    facilities: [
      "IoT Prototyping & Soldering Benches",
      "AI Robotics and Embedded Control Assemblies",
      "High-Performance Edge-Computing Nodes",
      "Rapid Materials & 3D Fabrication Stations"
    ],
    keyStats: [
      { label: "Active Nodes", value: "32 Workstations" },
      { label: "Team Space", value: "12 Collab Pods" },
      { label: "Mentors Available", value: "24/7 Digital" }
    ],
    hotspots: [
      {
        id: "makers-to-ev",
        yaw: 1.2,
        pitch: -0.05,
        label: "EV Laboratory",
        targetAreaId: "ev-lab",
        info: "Teleport directly across structural blocks to our high-tech Electric Vehicle development and battery test lab."
      }
    ]
  },
  {
    id: "ev-lab",
    name: "EV Lab",
    title: "Electric Vehicle (EV) Engineering Laboratory",
    description: "An advanced Electric Vehicle laboratory where students learn EV technology, battery systems, motor control, charging systems, and sustainable transportation concepts. The environment is designed to feel high-tech and engineering focused.",
    imageUrl: evLabPanorama,
    thumbnailUrl: "https://images.unsplash.com/photo-1558441719-ff34b0524a24?auto=format&fit=crop&w=600&h=450&q=80",
    location: "Power Electronics Block, Ground Floor",
    facilities: [
      "EV Battery Pack BMS Diagnostics Kits",
      "High-Power PMSM Motor Dynamometer Testing Rig",
      "Smart Regen Braking Efficiency Analyzers",
      "Fast Charger & Sustainable Grid Simulators"
    ],
    keyStats: [
      { label: "Test Chassis", value: "3 Custom Karts" },
      { label: "BMS Testing Nodes", value: "8 Active Bench Rigs" },
      { label: "Max Capacity", value: "48 Students" }
    ],
    hotspots: [
      {
        id: "ev-to-makers",
        yaw: 4.4,
        pitch: -0.04,
        label: "Makers Studio",
        targetAreaId: "makers-studio",
        info: "Head back to the Innovation and Robotics hub to work on coding control programs."
      }
    ]
  }
];
