export interface Profile {
    id: string;
    name: string;
    image?: string;
}

export type RingSizeSystem = '' | 'Universal' | 'UK' | 'USA';

export interface Dimensions {
    profileWidth: number;
    profileHeight: number;
    ringSize: string | number;
    ringSizeSystem: RingSizeSystem;
}

export type ColorType = '' | 'single' | 'two' | 'three';

export type ShapeCategory = 'vertical' | 'sine' | 'diagonal' | 'segment' | 'horizontal';
export type WaveCount = 2 | 3 | 4;
export type HeightPercentage = 30 | 50 | 70;

export interface ShapeConfig {
    category: ShapeCategory;
    variant: string;
    waveCount?: WaveCount;
    heightPercentage?: HeightPercentage;
}
export type MetalColor = 
    | ''
    | 'yellow gold'
    | 'white gold'
    | 'red gold'
    | 'rose gold'
    | 'white gold with palladium'
    | 'silver/ rhodium plated'
    | 'silver/ yellow gold plated'
    | 'silver/ red gold plated'
    | 'zirconium (black)'
    | 'zirconium (grey)';

export type PolishType = 
    | ''
    | 'Polished'
    | 'Vertical matte'
    | 'Horizontal matte'
    | 'Crossed matte'
    | 'Sandblasted'
    | 'Double crossed'
    | 'Ice matte'
    | 'Honeycomb'
    | 'Hammered tight'
    | 'Hammered wide'
    | 'Bark cross'
    | 'Wave'
    | 'MA3'
    | 'MA2-2'
    | 'Hammered tight (polished)'
    | 'Hammered wide (polished)';

export type Fineness = '' | '8K' | '9K' | '10K' | '14K' | '18K' | '21K' | '22K';

export interface ColorConfig {
    metalColor: MetalColor;
    polishType: PolishType;
    fineness: Fineness;
}

export interface PreciousMetal {
    colorType: ColorType;
    shape?: ShapeConfig; // For two/three colors
    colors: ColorConfig[];
}

export type StoneSettingType = 
    | ''
    | 'No stone'
    | 'American'
    | 'Pave'
    | 'Channel'
    | 'Cross American'
    | 'Cross pave'
    | 'Cross channel'
    | 'Open channel'
    | 'Side American'
    | 'Side pave'
    | 'Free Stone Spreading'
    | 'Tensionring'
    | 'Tensionring (diagonal)'
    | 'Eye (vertical)'
    | 'Eye (horizontal)'
    | 'Eye (diagonal)';

export type StoneType = '' | 'Brillant' | 'Princess' | 'Baguette' | 'Emerald';
export type StoneSize = '' | '0.01 ct.' | '0.02 ct.' | '0.03 ct.' | '0.05 ct.' | '0.10 ct.';
export type StoneQuality = '' | 'G-H/VS-SI' | 'F-G/VVS' | 'D-E/IF-VVS1';
export type StonePosition = '' | 'Left' | 'Center' | 'Right' | 'Free';

export interface Stone {
    id: number;
    size: string;
    quality: string;
    x: number;
    y: number;
}

export interface StoneSettings {
    settingType: StoneSettingType;
    stoneType?: StoneType;
    stoneSize?: StoneSize;
    stoneQuality?: StoneQuality;
    numberOfStones?: number;
    position?: StonePosition;
    offset?: number;
    stones?: Stone[]; // Percentage offset from center (-50 to 50) when position is 'Free'
}

export type GrooveType = 
    | ''
    | 'V-groove (110°)'
    | 'U-groove'
    | 'Convex'
    | 'Square groove'
    | 'Carbon-groove'
    | 'Milgrain';

export type EdgeType = '' | 'none' | 'step' | 'carbon' | 'milgrain';
export type GrooveAlignment = '' | 'left' | 'center' | 'right';
export type SurfaceType = '' | 'Polished' | 'Sandblasted';

export type Direction = 'vertical' | 'wave';

export interface GrooveSettings {
    id: number;
    grooveType: GrooveType;
    width: number;
    depth: number;
    surface: SurfaceType;
    direction: Direction;
    position: number;
    numberOfWaves?: 1 | 2 | 3;
    waveHeight?: number; // 5-95
}

export interface EdgeSettings {
    type: EdgeType;
    width?: number; // in mm, optional as it's only needed when type is not 'none'
    depth?: number; // in mm, optional as it's only needed when type is not 'none'
    surface?: SurfaceType; // optional as it's only needed when type is not 'none'
}

export interface GroovesAndEdges {
    groove: GrooveSettings[];
    leftEdge: EdgeSettings;
    rightEdge: EdgeSettings;
}

export type FontFamily = 'Arial' | 'Corsiva' | 'Lucida' | 'Times New Roman' | 'Nanum Brush';

export interface EngravingSymbol {
    id: string;
    symbol: string;
}

export const engravingSymbols: EngravingSymbol[] = [
    { id: 'cross', symbol: '†' },
    { id: 'infinity', symbol: '∞' },
    { id: 'rings', symbol: '⚭' },
    { id: 'heart', symbol: '♥' },
    { id: 'double-heart', symbol: '💕' },
    { id: 'diamond', symbol: '💎' },
    { id: 'paw1', symbol: '🐾' },
    { id: 'paw2', symbol: '🐾' },
    { id: 'flower', symbol: '❀' },
    { id: 'smiley', symbol: '☺' },
    { id: 'star-outline', symbol: '☆' },
    { id: 'star-filled', symbol: '★' },
    { id: 'dot', symbol: '•' },
];

export interface EngravingSettings {
    text: string;
    fontFamily: FontFamily;
}

export class ConfiguratorState {
    selectedProfile: string | null;
    dimensions: Dimensions;
    preciousMetal: PreciousMetal;
    stoneSettings: StoneSettings;
    groovesAndEdges: GroovesAndEdges;
    engraving: EngravingSettings;
    weight: number;
}
