<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <nav class="bg-white shadow-md px-6 py-4">
      <div class="container mx-auto flex justify-between items-center">
        <div class="flex items-center">
          <h1 class="text-2xl font-bold text-blue-600">Vid.AI</h1>
          <span class="ml-2 text-sm text-gray-500">Powered by SAM2</span>
        </div>
        <div>
          <router-link
            to="/"
            class="px-4 py-2 text-gray-700 hover:text-blue-600"
            >Home</router-link
          >
          <router-link
            to="/editor"
            class="px-4 py-2 text-gray-700 hover:text-blue-600"
            >Editor</router-link
          >
          <router-link
            to="/about"
            class="px-4 py-2 text-gray-700 hover:text-blue-600"
            >About</router-link
          >
        </div>
      </div>
    </nav>

    <main class="flex-grow container mx-auto px-4 py-6">
      <router-view />
    </main>

    <footer class="bg-gray-800 text-white py-4">
      <div class="container mx-auto text-center">
        <p>
          &copy; {{ new Date().getFullYear() }} Vid.AI - Built with Vue and
          Segment Anything 2
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// App component setup
</script>

<style>
#app {
  font-family: 'Inter', Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>