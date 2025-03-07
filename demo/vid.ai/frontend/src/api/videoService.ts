import axios from 'axios'
import type { GalleryVideo, Session, PointData, LLMRequest, MaskData } from '@/types'

const API_URL = '/api'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default {
  // Video gallery and upload
  async getGalleryVideos(): Promise<GalleryVideo[]> {
    const response = await apiClient.get('/videos/gallery')
    return response.data
  },

  async uploadVideo(file: File): Promise<GalleryVideo> {
    const formData = new FormData()
    formData.append('video', file)
    
    const response = await apiClient.post('/videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  // Sessions
  async createSession(videoPath: string): Promise<Session> {
    const response = await apiClient.post('/sessions', { video_path: videoPath })
    return response.data
  },

  async endSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/sessions/${sessionId}`)
  },

  // Points and masks
  async addPoints(sessionId: string, frameIdx: number, points: [number, number][], labels: number[]): Promise<{ masks: MaskData[], frame_idx: number }> {
    const response = await apiClient.post(`/sessions/${sessionId}/points`, {
      frame_idx: frameIdx,
      points: points,
      labels: labels
    })
    return response.data
  },

  async propagateInVideo(sessionId: string, frameIdx: number): Promise<ReadableStreamDefaultReader> {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/propagate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ frame_idx: frameIdx })
    })
    
    if (!response.ok || !response.body) {
      throw new Error('Failed to propagate masks')
    }
    
    return response.body.getReader()
  },

  // LLM Integration
  async processLLMPrompt(prompt: string, provider: string = 'openai', videoContext?: string): Promise<any> {
    const response = await apiClient.post('/llm/process', {
      prompt,
      provider,
      video_context: videoContext
    })
    return response.data
  },

  async parseLLMInstructions(llmResponse: string | object): Promise<any> {
    const response = await apiClient.post('/llm/parse_instructions', {
      llm_response: llmResponse
    })
    return response.data
  }
}