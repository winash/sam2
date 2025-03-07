<template>
  <div class="container mx-auto px-4 py-8">
    <div class="text-center mb-12">
      <h1 class="text-4xl font-bold text-gray-800 mb-4">
        Vid.AI - Intelligent Video Editing
      </h1>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto">
        Edit videos with natural language using the power of SAM2 (Segment Anything 2) and LLM integration
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Gallery Videos</h2>
        <div v-if="isLoading" class="flex justify-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
        <div v-else-if="galleryVideos.length === 0" class="text-center text-gray-500 py-8">
          No videos available in the gallery
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="video in galleryVideos"
            :key="video.id"
            class="bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            @click="openEditor(video)"
          >
            <div class="aspect-video bg-gray-200 flex items-center justify-center">
              <span class="text-3xl text-gray-400">
                <span class="i-heroicons-video-camera"></span>
              </span>
            </div>
            <div class="p-4">
              <h3 class="font-semibold text-gray-800">{{ video.name }}</h3>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-lg">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Upload Video</h2>
        <div class="border-dashed border-2 border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            ref="fileInput"
            class="hidden"
            accept="video/mp4,video/avi,video/mov"
            @change="handleFileUpload"
          />
          <button
            class="btn btn-primary mb-4"
            @click="$refs.fileInput.click()"
            :disabled="isUploading"
          >
            {{ isUploading ? 'Uploading...' : 'Select Video' }}
          </button>
          <p class="text-sm text-gray-500">
            Supported formats: MP4, AVI, MOV (max 100MB)
          </p>
          <p v-if="uploadError" class="text-sm text-red-500 mt-2">
            {{ uploadError }}
          </p>
        </div>
      </div>
    </div>

    <div class="bg-blue-50 p-6 rounded-lg shadow-md mb-12">
      <h2 class="text-2xl font-bold text-blue-800 mb-4">How It Works</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-blue-600 text-4xl mb-2">1</div>
          <h3 class="font-bold text-gray-800 mb-2">Upload or Select a Video</h3>
          <p class="text-gray-600">
            Choose from our gallery or upload your own video to get started.
          </p>
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-blue-600 text-4xl mb-2">2</div>
          <h3 class="font-bold text-gray-800 mb-2">Mark Objects with Clicks</h3>
          <p class="text-gray-600">
            Click on objects you want to track or tell the AI what to look for.
          </p>
        </div>
        <div class="bg-white p-4 rounded-lg shadow">
          <div class="text-blue-600 text-4xl mb-2">3</div>
          <h3 class="font-bold text-gray-800 mb-2">Describe What You Want</h3>
          <p class="text-gray-600">
            Use natural language to tell the AI how to edit your video.
          </p>
        </div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-lg shadow-lg">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">Features</h2>
      <ul class="space-y-2">
        <li class="flex items-start">
          <span class="text-green-500 mr-2">✓</span>
          <span>Powered by Segment Anything 2 (SAM2) for precise object identification</span>
        </li>
        <li class="flex items-start">
          <span class="text-green-500 mr-2">✓</span>
          <span>Natural language interface using LLM technology</span>
        </li>
        <li class="flex items-start">
          <span class="text-green-500 mr-2">✓</span>
          <span>Multiple effects: highlight, blur, color change, and more</span>
        </li>
        <li class="flex items-start">
          <span class="text-green-500 mr-2">✓</span>
          <span>Automatic tracking of objects through video frames</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEditorStore } from '@/stores/editorStore'
import type { GalleryVideo } from '@/types'

const router = useRouter()
const editorStore = useEditorStore()
const galleryVideos = ref<GalleryVideo[]>([])
const isLoading = ref(false)
const isUploading = ref(false)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await loadGalleryVideos()
})

async function loadGalleryVideos() {
  isLoading.value = true
  try {
    galleryVideos.value = await editorStore.loadGalleryVideos()
  } catch (error) {
    console.error('Failed to load gallery videos:', error)
  } finally {
    isLoading.value = false
  }
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  
  const file = target.files[0]
  uploadError.value = ''
  
  // Validate file size
  if (file.size > 100 * 1024 * 1024) { // 100MB
    uploadError.value = 'File is too large. Maximum size is 100MB.'
    return
  }
  
  // Validate file type
  if (!['video/mp4', 'video/avi', 'video/quicktime'].includes(file.type)) {
    uploadError.value = 'Invalid file type. Please upload MP4, AVI, or MOV files.'
    return
  }
  
  isUploading.value = true
  try {
    const uploadedVideo = await editorStore.uploadVideo(file)
    galleryVideos.value.unshift(uploadedVideo)
    openEditor(uploadedVideo)
  } catch (error) {
    console.error('Upload failed:', error)
    uploadError.value = 'Upload failed. Please try again.'
  } finally {
    isUploading.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

function openEditor(video: GalleryVideo) {
  editorStore.selectVideo(video)
  router.push('/editor')
}
</script>