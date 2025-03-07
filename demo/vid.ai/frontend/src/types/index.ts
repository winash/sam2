// Video types
export interface GalleryVideo {
  id: string
  name: string
  path: string
}

export interface Session {
  session_id: string
}

export interface PointData {
  frame_idx: number
  points: [number, number][]
  labels: number[]
}

export interface RLE {
  counts: string
  size: [number, number]
}

export interface MaskData {
  rle: RLE
  score: number
  id?: number
  object_id?: number
}

export interface FrameMasks {
  frame_idx: number
  masks: MaskData[]
}

// LLM types
export interface LLMRequest {
  prompt: string
  provider: string
  video_context?: string
}

export interface LLMResponse {
  response: string
  provider: string
  error?: string
  raw_response?: string
}

export interface ObjectInstruction {
  name: string
  description?: string
  prompt_words?: string[]
}

export interface EffectInstruction {
  type: string
  target: string
  parameters?: Record<string, any>
}

export interface ModelInstructions {
  objects: ObjectInstruction[]
  effects: EffectInstruction[]
  tracking: boolean
}

// Chat types
export interface ChatMessage {
  id: string
  role: 'user' | 'bot'
  content: string
  timestamp: Date
}

// Canvas types
export interface CanvasPoint {
  x: number
  y: number
  label: number
}

export interface VideoFrame {
  index: number
  timestamp: number
  url?: string 
  dataUrl?: string
}

export interface CanvasSize {
  width: number
  height: number
}