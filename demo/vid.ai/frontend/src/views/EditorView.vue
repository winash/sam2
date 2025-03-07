<template>
  <div class="container mx-auto px-4 py-8">
    <div v-if="!hasActiveSession" class="text-center py-16">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">No Video Selected</h2>
      <p class="text-gray-600 mb-8">Please select a video from the gallery or upload a new one.</p>
      <router-link to="/" class="btn btn-primary">Go to Gallery</router-link>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Video Editor Area -->
        <div class="lg:col-span-2">
          <div class="bg-white p-4 rounded-lg shadow-md mb-6">
            <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center justify-between">
              <span>Video Editor: {{ currentVideo?.name || 'Unknown' }}</span>
              <button 
                class="text-sm btn btn-outline btn-sm" 
                @click="returnToGallery"
              >
                Back to Gallery
              </button>
            </h2>

            <!-- Video display area -->
            <div class="video-container">
              <video 
                ref="videoElement" 
                class="w-full h-full"
                controls
                @loadedmetadata="onVideoLoaded"
                @timeupdate="onTimeUpdate"
              >
                <source :src="currentVideo?.path" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              <!-- Mask canvas overlay -->
              <canvas 
                ref="maskCanvas" 
                class="mask-canvas"
              ></canvas>

              <!-- Interaction canvas -->
              <canvas 
                ref="interactionCanvas" 
                class="interaction-canvas"
                @click="handleCanvasClick"
              ></canvas>

              <!-- Video controls -->
              <div class="video-controls">
                <div class="flex items-center space-x-2 w-full">
                  <button 
                    class="bg-white text-blue-600 p-1 rounded"
                    @click="togglePlayPause"
                  >
                    <span v-if="isPlaying">⏸️</span>
                    <span v-else>▶️</span>
                  </button>
                  <input 
                    type="range" 
                    class="w-full" 
                    min="0" 
                    :max="videoDuration" 
                    step="0.01"
                    v-model="currentTime"
                    @input="seekVideo"
                  />
                  <span class="text-white text-sm">
                    {{ formatTime(currentTime) }} / {{ formatTime(videoDuration) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Processing indicator -->
            <div v-if="isProcessing" class="mt-4 bg-blue-50 p-4 rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium">Processing video...</span>
                <span>{{ processingProgress }}%</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  class="bg-blue-600 h-2.5 rounded-full" 
                  :style="`width: ${processingProgress}%`"
                ></div>
              </div>
            </div>

            <!-- Control buttons -->
            <div class="mt-4 flex flex-wrap gap-2">
              <button 
                class="btn btn-primary"
                @click="startPointMode"
                :disabled="isProcessing"
              >
                Add Points
              </button>
              <button 
                class="btn btn-secondary"
                @click="startTracking"
                :disabled="isProcessing || !hasPoints"
              >
                Track Objects
              </button>
              <button 
                class="btn btn-outline"
                @click="clearPoints"
                :disabled="!hasPoints"
              >
                Clear Points
              </button>
              <button 
                class="btn btn-outline btn-error"
                @click="resetSession"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <!-- Chat & Instructions Area -->
        <div class="lg:col-span-1">
          <div class="bg-white p-4 rounded-lg shadow-md mb-6 h-[500px] flex flex-col">
            <h2 class="text-xl font-bold text-gray-800 mb-4">ChatGPT Interface</h2>

            <!-- Chat messages area -->
            <div class="flex-grow overflow-y-auto mb-4 p-2">
              <div v-if="chatMessages.length === 0" class="text-center text-gray-500 py-8">
                <p>No messages yet.</p>
                <p class="text-sm">Try asking the AI to help edit your video.</p>
              </div>
              <div 
                v-for="message in chatMessages" 
                :key="message.id"
                :class="[
                  'chat-message', 
                  message.role === 'user' ? 'chat-message-user' : 'chat-message-bot'
                ]"
              >
                <div class="font-medium mb-1">
                  {{ message.role === 'user' ? 'You' : 'AI Assistant' }}:
                </div>
                <div>{{ message.content }}</div>
              </div>
            </div>

            <!-- Chat input -->
            <div class="flex items-center">
              <input 
                v-model="chatInput" 
                type="text" 
                class="flex-grow border rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell the AI what you want to do with this video..."
                @keyup.enter="sendChatMessage"
                :disabled="isLoading"
              />
              <button 
                class="bg-blue-600 text-white p-2 rounded-r-lg hover:bg-blue-700"
                @click="sendChatMessage"
                :disabled="isLoading || !chatInput.trim()"
              >
                <span v-if="isLoading">...</span>
                <span v-else>Send</span>
              </button>
            </div>
          </div>

          <!-- Instructions panel when available -->
          <div v-if="instructions" class="bg-white p-4 rounded-lg shadow-md">
            <h2 class="text-xl font-bold text-gray-800 mb-4">Instructions</h2>
            
            <!-- Objects -->
            <div class="mb-4">
              <h3 class="font-medium text-gray-700 mb-2">Objects to Detect:</h3>
              <ul class="list-disc pl-5">
                <li v-for="(obj, idx) in instructions.objects" :key="idx">
                  {{ obj.name }}
                  <span v-if="obj.description" class="text-sm text-gray-500">
                    ({{ obj.description }})
                  </span>
                </li>
              </ul>
            </div>

            <!-- Effects -->
            <div class="mb-4">
              <h3 class="font-medium text-gray-700 mb-2">Effects to Apply:</h3>
              <ul class="list-disc pl-5">
                <li v-for="(effect, idx) in instructions.effects" :key="idx">
                  {{ effect.type }} on {{ effect.target }}
                  <div v-if="effect.parameters" class="text-sm text-gray-500">
                    Parameters: {{ JSON.stringify(effect.parameters) }}
                  </div>
                </li>
              </ul>
            </div>

            <!-- Tracking status -->
            <div>
              <p class="text-sm">
                <span class="font-medium">Tracking:</span>
                {{ instructions.tracking ? 'Enabled' : 'Disabled' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useEditorStore } from '@/stores/editorStore'
import type { CanvasPoint } from '@/types'

const router = useRouter()
const editorStore = useEditorStore()

// Video refs and state
const videoElement = ref<HTMLVideoElement | null>(null)
const maskCanvas = ref<HTMLCanvasElement | null>(null)
const interactionCanvas = ref<HTMLCanvasElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const videoDuration = ref(0)
const chatInput = ref('')
const pointMode = ref<'foreground' | 'background' | null>(null)

// Computed properties
const hasActiveSession = computed(() => editorStore.hasActiveSession)
const currentVideo = computed(() => editorStore.currentVideo)
const chatMessages = computed(() => editorStore.chatMessages)
const hasPoints = computed(() => {
  return Object.keys(editorStore.points).length > 0
})
const isLoading = computed(() => editorStore.isLoading)
const isProcessing = computed(() => editorStore.isProcessing)
const processingProgress = computed(() => editorStore.processingProgress)
const instructions = computed(() => editorStore.instructions)

// Video player functions
function onVideoLoaded() {
  if (!videoElement.value) return
  videoDuration.value = videoElement.value.duration
  resizeCanvas()
}

function onTimeUpdate() {
  if (!videoElement.value) return
  currentTime.value = videoElement.value.currentTime
  // Update the current frame based on time
  const fps = 30 // Assumed FPS
  const frameIdx = Math.floor(currentTime.value * fps)
  editorStore.currentFrame = frameIdx
}

function togglePlayPause() {
  if (!videoElement.value) return
  
  if (videoElement.value.paused) {
    videoElement.value.play()
    isPlaying.value = true
  } else {
    videoElement.value.pause()
    isPlaying.value = false
  }
}

function seekVideo() {
  if (!videoElement.value) return
  videoElement.value.currentTime = currentTime.value
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Canvas interaction
function resizeCanvas() {
  if (!videoElement.value || !maskCanvas.value || !interactionCanvas.value) return
  
  const videoWidth = videoElement.value.videoWidth
  const videoHeight = videoElement.value.videoHeight
  const containerWidth = videoElement.value.clientWidth
  const containerHeight = videoElement.value.clientHeight
  
  // Set canvas dimensions
  maskCanvas.value.width = containerWidth
  maskCanvas.value.height = containerHeight
  interactionCanvas.value.width = containerWidth
  interactionCanvas.value.height = containerHeight
  
  // Draw masks if available
  drawMasks()
}

function handleCanvasClick(event: MouseEvent) {
  if (!pointMode.value || !interactionCanvas.value) return
  
  // Get canvas coordinates
  const rect = interactionCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  // Create point based on mode
  const point: CanvasPoint = {
    x,
    y,
    label: pointMode.value === 'foreground' ? 1 : 0
  }
  
  // Add point to store
  editorStore.addPoint(point)
  
  // Draw point on canvas
  const ctx = interactionCanvas.value.getContext('2d')
  if (ctx) {
    const radius = 5
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = pointMode.value === 'foreground' ? '#3b82f6' : '#ef4444'
    ctx.fill()
    ctx.stroke()
  }
}

function startPointMode() {
  pointMode.value = 'foreground'
  if (interactionCanvas.value) {
    interactionCanvas.value.style.cursor = 'crosshair'
  }
}

function clearPoints() {
  pointMode.value = null
  if (interactionCanvas.value) {
    const ctx = interactionCanvas.value.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, interactionCanvas.value.width, interactionCanvas.value.height)
    }
    interactionCanvas.value.style.cursor = 'default'
  }
  
  // Clear points in store
  editorStore.resetEditorState()
}

// Mask rendering
function drawMasks() {
  if (!maskCanvas.value) return
  
  const ctx = maskCanvas.value.getContext('2d')
  if (!ctx) return
  
  // Clear canvas
  ctx.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
  
  // Get masks for current frame
  const frameMasks = editorStore.currentFrameMasks
  if (!frameMasks || frameMasks.length === 0) return
  
  // TODO: Implement RLE decoding and mask rendering with effects
  // This is a simplified placeholder - actual implementation would 
  // decode RLE masks and render them with proper effects
  
  ctx.fillStyle = 'rgba(59, 130, 246, 0.3)' // Blue semi-transparent
  ctx.fillRect(100, 100, 200, 200) // Placeholder mask
}

// Tracking operations
async function startTracking() {
  if (Object.keys(editorStore.points).length === 0) {
    alert('Please add points first!')
    return
  }
  
  // Pause video during processing
  if (videoElement.value && !videoElement.value.paused) {
    videoElement.value.pause()
    isPlaying.value = false
  }
  
  // Get the first frame with points
  const startFrame = parseInt(Object.keys(editorStore.points)[0])
  
  // Propagate masks
  await editorStore.propagateMasks(startFrame)
  
  // Reset point mode
  pointMode.value = null
  if (interactionCanvas.value) {
    interactionCanvas.value.style.cursor = 'default'
  }
}

// Chat operations
async function sendChatMessage() {
  if (!chatInput.value.trim()) return
  
  const message = chatInput.value
  chatInput.value = ''
  
  await editorStore.sendChatMessage(message)
}

// Navigation
function returnToGallery() {
  editorStore.endSession()
  router.push('/')
}

function resetSession() {
  editorStore.resetEditorState()
  clearPoints()
}

// Lifecycle hooks
onMounted(() => {
  window.addEventListener('resize', resizeCanvas)
  resizeCanvas()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
})

// Watch for changes
watch(() => editorStore.currentFrame, () => {
  drawMasks()
})

watch(() => editorStore.masks, () => {
  drawMasks()
})
</script>