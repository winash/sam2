import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GalleryVideo, Session, ChatMessage, FrameMasks, CanvasPoint, VideoFrame, ModelInstructions } from '@/types'
import videoService from '@/api/videoService'
import { v4 as uuidv4 } from 'uuid'

export const useEditorStore = defineStore('editor', () => {
  // State
  const isLoading = ref(false)
  const currentVideo = ref<GalleryVideo | null>(null)
  const sessionId = ref<string | null>(null)
  const chatMessages = ref<ChatMessage[]>([])
  const currentFrame = ref<number>(0)
  const points = ref<{ [frameIdx: number]: CanvasPoint[] }>({})
  const masks = ref<{ [frameIdx: number]: FrameMasks }>({})
  const videoFrames = ref<VideoFrame[]>([])
  const isProcessing = ref(false)
  const processingProgress = ref(0)
  const instructions = ref<ModelInstructions | null>(null)

  // Getters
  const hasActiveSession = computed(() => sessionId.value !== null)
  const currentFramePoints = computed(() => points.value[currentFrame.value] || [])
  const currentFrameMasks = computed(() => masks.value[currentFrame.value]?.masks || [])
  
  // Actions
  async function loadGalleryVideos() {
    isLoading.value = true
    try {
      return await videoService.getGalleryVideos()
    } catch (error) {
      console.error('Failed to load gallery videos:', error)
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function uploadVideo(file: File) {
    isLoading.value = true
    try {
      const video = await videoService.uploadVideo(file)
      return video
    } catch (error) {
      console.error('Failed to upload video:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function selectVideo(video: GalleryVideo) {
    // Close existing session if any
    if (sessionId.value) {
      await endSession()
    }
    
    currentVideo.value = video
    // Start a new session
    isLoading.value = true
    try {
      const session = await videoService.createSession(video.path)
      sessionId.value = session.session_id
      // Reset state
      resetEditorState()
    } catch (error) {
      console.error('Failed to create session:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function endSession() {
    if (!sessionId.value) return
    
    try {
      await videoService.endSession(sessionId.value)
    } catch (error) {
      console.error('Failed to end session:', error)
    } finally {
      sessionId.value = null
      currentVideo.value = null
      resetEditorState()
    }
  }

  function resetEditorState() {
    points.value = {}
    masks.value = {}
    currentFrame.value = 0
    videoFrames.value = []
    chatMessages.value = []
    isProcessing.value = false
    processingProgress.value = 0
    instructions.value = null
  }

  async function addPoint(point: CanvasPoint) {
    const frameIdx = currentFrame.value
    
    // Store point locally
    if (!points.value[frameIdx]) {
      points.value[frameIdx] = []
    }
    points.value[frameIdx].push(point)
    
    if (!sessionId.value) return
    
    // Send to backend
    try {
      const pointsArray = points.value[frameIdx].map(p => [p.x, p.y] as [number, number])
      const labels = points.value[frameIdx].map(p => p.label)
      
      const result = await videoService.addPoints(
        sessionId.value,
        frameIdx,
        pointsArray,
        labels
      )
      
      // Store masks
      if (!masks.value[frameIdx]) {
        masks.value[frameIdx] = { frame_idx: frameIdx, masks: [] }
      }
      masks.value[frameIdx].masks = result.masks
    } catch (error) {
      console.error('Failed to add point:', error)
    }
  }

  async function propagateMasks(startFrame: number) {
    if (!sessionId.value || !points.value[startFrame] || points.value[startFrame].length === 0) {
      return
    }
    
    isProcessing.value = true
    processingProgress.value = 0
    
    try {
      const reader = await videoService.propagateInVideo(sessionId.value, startFrame)
      
      let receivedFrames = 0
      const totalFrames = videoFrames.value.length || 100 // Fallback if frames not loaded
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        // Parse the chunks (each line is a separate frame)
        const text = new TextDecoder().decode(value)
        const lines = text.trim().split('\n')
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line) as FrameMasks
            masks.value[data.frame_idx] = data
            
            // Update progress
            receivedFrames++
            processingProgress.value = Math.min(100, Math.floor((receivedFrames / totalFrames) * 100))
          } catch (e) {
            console.error('Error parsing propagation result:', e)
          }
        }
      }
    } catch (error) {
      console.error('Error propagating masks:', error)
    } finally {
      isProcessing.value = false
      processingProgress.value = 100
    }
  }

  async function sendChatMessage(content: string) {
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date()
    }
    chatMessages.value.push(userMessage)
    
    isLoading.value = true
    
    try {
      // Send to LLM
      const videoContext = currentVideo.value ? 
        `Processing video: ${currentVideo.value.name}` : undefined
      
      const llmResponse = await videoService.processLLMPrompt(
        content, 
        'openai', // or could be configurable
        videoContext
      )
      
      if (llmResponse.error) {
        throw new Error(llmResponse.error)
      }
      
      // Parse the LLM response to get model instructions
      const parsedInstructions = await videoService.parseLLMInstructions(llmResponse.response)
      instructions.value = parsedInstructions
      
      // Add bot message to chat
      const botMessage: ChatMessage = {
        id: uuidv4(),
        role: 'bot',
        content: `I'll help you with that! I'll ${
          parsedInstructions.objects.map(obj => `find the ${obj.name}`).join(', ')
        } and apply ${
          parsedInstructions.effects.map(effect => effect.type).join(', ')
        } effects.`,
        timestamp: new Date()
      }
      chatMessages.value.push(botMessage)
      
      // Auto-process if we have instructions and points
      if (Object.keys(points.value).length > 0) {
        const firstPointFrame = parseInt(Object.keys(points.value)[0])
        await propagateMasks(firstPointFrame)
      }
      
      return parsedInstructions
    } catch (error) {
      console.error('Error processing chat message:', error)
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'bot',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      chatMessages.value.push(errorMessage)
      
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    isLoading,
    currentVideo,
    sessionId,
    chatMessages,
    currentFrame,
    points,
    masks,
    videoFrames,
    isProcessing,
    processingProgress,
    instructions,
    
    // Getters
    hasActiveSession,
    currentFramePoints,
    currentFrameMasks,
    
    // Actions
    loadGalleryVideos,
    uploadVideo,
    selectVideo,
    endSession,
    resetEditorState,
    addPoint,
    propagateMasks,
    sendChatMessage
  }
})