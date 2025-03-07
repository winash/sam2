<template>
  <div class="container mx-auto px-4 py-8">
    <div class="bg-white p-6 rounded-lg shadow-lg mb-8">
      <h1 class="text-3xl font-bold text-gray-800 mb-4">About Vid.AI</h1>
      <p class="text-lg text-gray-600 mb-6">
        Vid.AI is a demonstration project that showcases the capabilities of the Segment Anything 2 (SAM2) model
        combined with Large Language Models (LLMs) for intelligent video editing.
      </p>
      
      <h2 class="text-2xl font-bold text-gray-800 mb-3">Technology Stack</h2>
      <ul class="list-disc pl-5 mb-6 space-y-2">
        <li>
          <span class="font-medium">Frontend:</span> Vue.js 3 with TypeScript, Vite, Tailwind CSS, and DaisyUI
        </li>
        <li>
          <span class="font-medium">Backend:</span> Flask API server with SAM2 integration
        </li>
        <li>
          <span class="font-medium">AI Models:</span> Segment Anything 2 for video segmentation and OpenAI/Google Gemini for natural language processing
        </li>
      </ul>
      
      <h2 class="text-2xl font-bold text-gray-800 mb-3">How It Works</h2>
      <ol class="list-decimal pl-5 mb-6 space-y-2">
        <li>Upload or select a video from the gallery</li>
        <li>Mark objects of interest with clicks or describe them using natural language</li>
        <li>SAM2 identifies and tracks the objects throughout the video</li>
        <li>Apply effects like highlighting, blurring, or color changing to the objects</li>
        <li>Export the edited video (coming soon)</li>
      </ol>
      
      <h2 class="text-2xl font-bold text-gray-800 mb-3">SAM2 Model</h2>
      <p class="text-gray-600 mb-4">
        Segment Anything 2 (SAM2) is Meta AI's latest foundation model for image segmentation. It builds upon the 
        original SAM model with improved capabilities for tracking objects in videos, better handling of complex scenes, 
        and more efficient processing. Key features include:
      </p>
      <ul class="list-disc pl-5 mb-6 space-y-2">
        <li>Powerful prompt-based segmentation</li>
        <li>Zero-shot video segmentation</li>
        <li>Temporal coherence across video frames</li>
        <li>Real-time performance on modern hardware</li>
      </ul>
      
      <h2 class="text-2xl font-bold text-gray-800 mb-3">LLM Integration</h2>
      <p class="text-gray-600 mb-4">
        Vid.AI leverages Large Language Models to interpret natural language requests and convert them into 
        specific segmentation instructions. This allows users to describe what they want to do with the video 
        in plain language rather than through complex UI interactions.
      </p>
    </div>
    
    <div class="bg-white p-6 rounded-lg shadow-lg">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">Project Credits</h2>
      
      <div class="mb-6">
        <h3 class="text-xl font-semibold text-gray-700 mb-2">SAM2 Model</h3>
        <p class="text-gray-600">
          Segment Anything 2 was developed by Meta AI Research. Visit the 
          <a 
            href="https://github.com/facebookresearch/segment-anything-2" 
            class="text-blue-600 hover:underline"
            target="_blank"
          >
            official GitHub repository
          </a> 
          for more information.
        </p>
      </div>
      
      <div>
        <h3 class="text-xl font-semibold text-gray-700 mb-2">Vid.AI Project</h3>
        <p class="text-gray-600">
          This demonstration project was created to showcase how SAM2 can be combined with LLMs
          to create an intuitive video editing experience with minimal user input.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// About view component
</script>