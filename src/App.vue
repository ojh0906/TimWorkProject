<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useDropdown } from './assets/script'
import { useDrawing } from './composables/useDrawing.ts'
import { useChat } from './composables/useChat.ts'
import './assets/dashboard.css'

// 로직 가져오기 (기존 코드 유지)
const {
  metadata, searchQuery, selectedDiscipline, filteredDrawings,
  sortedDrawingIds, selectedDrawing, currentImage, selectedDrawingId,
  selectDrawing, setRevision, selectedRevision, availableRevisions, availableRevisionsInfo,
  isDarkMode, toggleDarkMode, scale, position, resetZoom, handleWheel, updateScale,
  isCompareMode, compareRevision, compareImage, overlayOpacity, toggleCompareMode, setCompareRevision,
  isColorCoded
} = useDrawing()

const { isChatOpen, chatInput, messages, sendMessage } = useChat()
const { isOpen: isRevisionOpen, toggle: toggleRevision } = useDropdown()
const isSidebarOpen = ref(false)

// 이미지 실제 사이즈 저장 (좌표 정렬용)
const imageRef = ref(null)
const naturalSize = reactive({ width: 5000, height: 5000 })

const onImageLoad = (e) => {
  naturalSize.width = e.target.naturalWidth
  naturalSize.height = e.target.naturalHeight
}

// 상태 관리
const isSplitMode = ref(false)
const splitRatio = ref(0.5)
const isHandleDragging = ref(false)
const hoveredDrawingId = ref(null)

const formatVertices = (vertices) => {
  if (!vertices || !Array.isArray(vertices)) return ''
  return vertices.map(v => `${v[0]},${v[1]}`).join(' ')
}

const startHandleDrag = (e) => {
  isHandleDragging.value = true
  e.stopPropagation()
}

const onHandleMove = (e) => {
  if (!isHandleDragging.value) return
  const container = document.querySelector('.drawing-container')
  if (!container) return
  const rect = container.getBoundingClientRect()
  const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
  let newRatio = (clientX - rect.left) / rect.width
  splitRatio.value = Math.max(0, Math.min(1, newRatio))
}

const stopHandleDrag = () => { isHandleDragging.value = false }

onMounted(() => {
  window.addEventListener('mousemove', onHandleMove); window.addEventListener('mouseup', stopHandleDrag)
  window.addEventListener('touchmove', onHandleMove); window.addEventListener('touchend', stopHandleDrag)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onHandleMove); window.removeEventListener('mouseup', stopHandleDrag)
  window.removeEventListener('touchmove', onHandleMove); window.removeEventListener('touchend', stopHandleDrag)
})

const isDragging = ref(false)
const dragStart = reactive({ x: 0, y: 0 })

const handleSelectDrawing = (id) => {
  selectDrawing(id)
  if (window.innerWidth < 1024) isSidebarOpen.value = false
}

const startDrag = (e) => {
  if (isHandleDragging.value) return
  if (scale.value <= 1 && e.type !== 'touchstart') return
  isDragging.value = true
  const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX
  const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY
  dragStart.x = clientX - position.value.x
  dragStart.y = clientY - position.value.y
}

const onDrag = (e) => {
  if (!isDragging.value || isHandleDragging.value) return
  const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX
  const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY
  position.value.x = clientX - dragStart.x
  position.value.y = clientY - dragStart.y
}

const stopDrag = () => { isDragging.value = false }
const onSliderInput = (e) => { updateScale(parseFloat(e.target.value)) }
</script>

<template>
  <div :class="['flex h-screen w-full overflow-hidden font-sans relative transition-colors duration-500',
                isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-900']">

    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"></div>

    <aside :class="['fixed lg:relative inset-y-0 left-0 w-80 border-r flex flex-col z-40 transition-all duration-300 lg:translate-x-0',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
                    isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200']">
      <div class="p-8 pb-4 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">T</div>
          <h1 :class="['text-xl font-extrabold tracking-tight', isDarkMode ? 'text-slate-100' : 'text-slate-800']">TimWork</h1>
        </div>
        <button @click="isSidebarOpen = false" class="lg:hidden p-2 text-slate-400">✕</button>
      </div>

      <div class="px-6 mb-4">
        <div class="relative mb-4">
          <input v-model="searchQuery" type="text" placeholder="도면 이름 검색..."
                 :class="['w-full border rounded-xl pl-10 py-2.5 text-xs outline-none font-medium transition-colors',
                          isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-900']" />
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div class="horizontal-tabs custom-scrollbar-minimal">
          <button @click="selectedDiscipline = '전체'" :class="['whitespace-nowrap px-4 py-2 text-[11px] font-bold rounded-xl shrink-0 border transition-all', selectedDiscipline === '전체' ? (isDarkMode ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-900 text-white border-slate-900 shadow-md') : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white text-slate-500 border-slate-100')]">전체</button>
          <button v-for="d in metadata?.disciplines" :key="d.name" @click="selectedDiscipline = d.name" :class="['whitespace-nowrap px-4 py-2 text-[11px] font-bold rounded-xl shrink-0 border transition-all', selectedDiscipline === d.name ? 'bg-blue-600 text-white border-blue-600 shadow-md' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white text-slate-500 border-slate-100')]">{{ d.name }}</button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-4 custom-scrollbar">
        <h3 :class="['px-4 text-[11px] font-bold uppercase tracking-wider mb-3 italic', isDarkMode ? 'text-slate-500' : 'text-slate-400']">도면 목록</h3>
        <div class="space-y-1">
          <button v-for="id in sortedDrawingIds" :key="id" @click="handleSelectDrawing(id)"
                  :class="['w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all',
                           selectedDrawingId === id ? (isDarkMode ? 'bg-blue-900/40 text-blue-400 font-bold' : 'bg-blue-50 text-blue-700 font-bold') : (isDarkMode ? 'text-slate-400 hover:bg-slate-800/50' : 'text-slate-500 hover:bg-slate-50')]">
            <div class="flex items-center gap-3 truncate">
              <div :class="['w-1.5 h-1.5 rounded-full shrink-0', selectedDrawingId === id ? 'bg-blue-600' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-300')]"></div>
              <span class="text-sm truncate text-left">{{ filteredDrawings[id].name }}</span>
            </div>
          </button>
        </div>
      </div>
    </aside>

    <main class="flex-1 flex flex-col relative overflow-hidden w-full" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag" @touchmove="onDrag" @touchend="stopDrag">
      <header :class="['h-16 lg:h-20 flex items-center justify-between px-4 lg:px-10 border-b sticky top-0 z-[60] shadow-sm backdrop-blur-md transition-all',
                  isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200/60']">
        <div class="flex items-center gap-3">
          <button @click="isSidebarOpen = true" :class="['lg:hidden p-2 rounded-lg', isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100']">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold"><path stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h2 :class="['text-base lg:text-xl font-bold truncate', isDarkMode ? 'text-slate-100' : 'text-slate-800']">{{ selectedDrawing?.name }}</h2>
        </div>

        <div class="dropdown-container relative">
          <button @click.stop="toggleRevision" :class="['flex items-center gap-2 px-4 py-2 border rounded-xl transition-all shadow-sm active:scale-95', isRevisionOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')]">
            <span class="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">리비전</span>
            <span :class="['text-sm font-bold', isDarkMode ? 'text-slate-200' : 'text-slate-800']">{{ selectedRevision }}</span>
            <span v-if="availableRevisionsInfo.find(r => r.version === selectedRevision)?.isLatest" class="px-1.5 py-0.5 bg-green-500 text-[9px] text-white rounded-md font-bold leading-none">최신</span>
            <svg xmlns="http://www.w3.org/2000/svg" :class="['h-4 w-4 text-slate-400 transition-transform', isRevisionOpen ? 'rotate-180' : '']" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <transition name="dropdown-fade">
            <div v-if="isRevisionOpen" :class="['absolute right-0 mt-1 w-72 border rounded-2xl shadow-2xl z-[70] overflow-hidden', isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100']">
              <div class="p-2 max-h-80 overflow-y-auto custom-scrollbar-minimal">
                <template v-if="availableRevisionsInfo.length > 0">
                  <button v-for="rev in availableRevisionsInfo" :key="rev.version" @click="setRevision(rev.version); toggleRevision()" :class="['w-full flex flex-col p-4 rounded-xl mb-1 transition-all text-left', selectedRevision === rev.version ? (isDarkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-50 text-blue-700') : (isDarkMode ? 'hover:bg-slate-700/50 text-slate-400' : 'hover:bg-slate-50 text-slate-500')]">
                    <div class="w-full flex items-center justify-between mb-1.5">
                      <p :class="['text-xs font-bold', selectedRevision === rev.version ? (isDarkMode ? 'text-blue-400' : 'text-blue-700') : (isDarkMode ? 'text-slate-200' : 'text-slate-800')]">{{ rev.version }}</p>
                      <span class="text-[10px] text-slate-400 font-medium">{{ rev.date }}</span>
                    </div>
                    <p class="text-[11px] leading-relaxed opacity-80 line-clamp-2">{{ rev.description || '상세 변경 내역이 없습니다.' }}</p>
                  </button>
                </template>
              </div>
            </div>
          </transition>
        </div>
      </header>

      <div :class="['flex-1 overflow-hidden relative drawing-container shadow-inner transition-colors duration-500 cursor-grab active:cursor-grabbing',
                    isDarkMode ? 'bg-slate-950' : 'bg-[#f1f5f9]']"
           style="background-image: radial-gradient(#334155 1px, transparent 1px); background-size: 32px 32px;"
           @wheel="handleWheel" @mousedown="startDrag" @touchstart="startDrag">

        <transition name="fade">
          <div v-if="isCompareMode" @mousedown.stop @touchstart.stop class="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-6 py-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-500/30">
            <div class="flex items-center gap-2 mr-2">
              <button @click="isSplitMode = false" :class="['p-2 rounded-lg transition-all', !isSplitMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700']" title="오버레이 모드"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg></button>
              <button @click="isSplitMode = true" :class="['p-2 rounded-lg transition-all', isSplitMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700']" title="스플릿 모드"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M8 7l-4 4m0 0l4 4m-4-4h16m-4-4l4 4m0 0l-4 4"></path></svg></button>
            </div>
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
            <div class="flex flex-col min-w-[80px]">
              <span class="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">비교 대상</span>
              <select :value="compareRevision" @change="(e) => setCompareRevision(e.target.value)" class="bg-transparent text-sm font-bold outline-none cursor-pointer">
                <option v-for="rev in availableRevisions" :key="rev" :value="rev">{{ rev }}</option>
              </select>
            </div>
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
            <div class="flex flex-col w-32">
              <div class="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter"><span>{{ isSplitMode ? '스와이프' : '비교 비중' }}</span><span>{{ ((isSplitMode ? splitRatio : overlayOpacity) * 100).toFixed(0) }}%</span></div>
              <input v-if="isSplitMode" type="range" min="0" max="1" step="0.01" v-model="splitRatio" class="w-full accent-blue-600 h-1.5 mt-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              <input v-else type="range" min="0" max="1" step="0.01" v-model="overlayOpacity" class="w-full accent-blue-600 h-1.5 mt-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
            <button @click="isColorCoded = !isColorCoded" :class="['px-3 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap', isColorCoded ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300']">강조 {{ isColorCoded ? '켬' : '끎' }}</button>
          </div>
        </transition>

        <div class="w-full h-full flex items-center justify-center transition-transform duration-75 pointer-events-none"
             :style="{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }">
          <div class="relative w-full h-full flex items-center justify-center overflow-visible">

            <img v-if="isCompareMode && compareImage" :src="compareImage" class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] block rounded-lg object-contain transition-all"
                 :style="{ opacity: 1, filter: isCompareMode && isColorCoded ? 'invert(40%) sepia(100%) saturate(400%) hue-rotate(170deg) brightness(1.2)' : (isDarkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none'), zIndex: 1 }" />

            <img v-if="currentImage" :src="currentImage" @load="onImageLoad" class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] block shadow-2xl rounded-lg border border-white/40 object-contain transition-all duration-500"
                 :class="[isCompareMode && !isSplitMode ? (isDarkMode ? 'mix-blend-screen' : 'mix-blend-multiply') : '']"
                 :style="{ opacity: isCompareMode && !isSplitMode ? overlayOpacity : 1, filter: isCompareMode && isColorCoded ? 'invert(25%) sepia(100%) saturate(600%) hue-rotate(350deg) brightness(1.1)' : (isDarkMode ? 'invert(0.9) hue-rotate(180deg) brightness(1.1) contrast(1.2)' : 'none'), clipPath: isSplitMode ? `inset(0 0 0 ${splitRatio * 100}%)` : 'none', zIndex: 2 }" />

            <svg v-if="selectedDrawingId === '00' && metadata"
                 class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] w-full h-full pointer-events-none"
                 :viewBox="`0 0 ${naturalSize.width} ${naturalSize.height}`"
                 preserveAspectRatio="xMidYMid meet"
                 style="z-index: 10;">
              <g v-for="(drawing, id) in metadata.drawings" :key="id">

                <polygon v-if="drawing.position && drawing.position.vertices"
                         :points="formatVertices(drawing.position.vertices)"
                         class="pointer-events-auto cursor-pointer transition-all duration-300 interactive-polygon"
                         :class="[
                            hoveredDrawingId === id
                            ? 'polygon-active'
                            : 'polygon-guide'
                         ]"
                         @mouseenter="hoveredDrawingId = id"
                         @mouseleave="hoveredDrawingId = null"
                         @click="handleSelectDrawing(id)" />

                <template v-if="drawing.regions">
                  <polygon v-for="(region, rKey) in drawing.regions" :key="rKey"
                           v-if="region && region.polygon && region.polygon.vertices"
                           :points="formatVertices(region.polygon.vertices)"
                           class="pointer-events-auto cursor-pointer polygon-guide hover:polygon-active"
                           @click="handleSelectDrawing(id)" />
                </template>
              </g>
            </svg>

            <div v-if="isCompareMode && isSplitMode" class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] pointer-events-none z-30">
              <div class="absolute h-full w-0.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" :style="{ left: `${splitRatio * 100}%` }">
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl border-4 border-white pointer-events-auto"
                     @mousedown.stop="startHandleDrag" @touchstart.stop="startHandleDrag">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M8 7l-4 4m0 0l4 4m-4-4h16m-4-4l4 4m0 0l-4 4" /></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="absolute top-6 right-6 z-20 flex flex-col gap-3 shrink-0">
          <button @click="toggleDarkMode" class="p-3 rounded-2xl shadow-xl transition-all border" :class="isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600'"><svg v-if="!isDarkMode" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg><svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707-.707" /></svg></button>
          <button @click="toggleCompareMode" :class="['p-3 rounded-2xl shadow-xl transition-all border', isCompareMode ? 'bg-blue-600 border-blue-600 text-white' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600')]"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
          <button @click="resetZoom" class="w-12 h-12 rounded-full shadow-xl border-2 flex items-center justify-center font-bold" :class="isDarkMode ? 'bg-slate-800 border-blue-500/50 text-blue-400' : 'bg-white border-blue-600 text-blue-600'">1:1</button>
          <div :class="['flex flex-col items-center gap-4 p-3 border rounded-[2rem] shadow-2xl transition-all w-[46px] shrink-0', isDarkMode ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm' : 'bg-white/90 border-slate-100 backdrop-blur-sm']">
            <button @click="updateScale(scale + 0.2)" :class="[isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600']">＋</button>
            <div class="relative h-32 w-1.5 flex justify-center py-2" @mousedown.stop @touchstart.stop><input type="range" min="0.5" max="5" step="0.1" :value="scale" @input="onSliderInput" class="appearance-none w-32 h-1 bg-slate-200 rounded-lg absolute rotate-90 top-1/2 -translate-y-1/2 cursor-pointer accent-blue-600" /></div>
            <button @click="updateScale(scale - 0.2)" :class="[isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600']">－</button>
          </div>
        </div>
      </div>

      <div class="absolute bottom-6 right-6 lg:bottom-10 lg:right-10 flex flex-col items-end z-50">
        <transition name="chat-slide">
          <div v-if="isChatOpen" :class="['mb-5 w-[calc(100vw-3rem)] sm:w-96 h-[500px] lg:h-[600px] rounded-[2.5rem] shadow-2xl border flex flex-col overflow-hidden', isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100']">
            <div class="p-6 bg-slate-900 text-white flex justify-between items-center shadow-lg"><div><h3 class="font-bold text-lg leading-tight text-white">현장 AI 지원</h3><p class="text-[11px] text-slate-400 font-medium italic">분석 중: {{ selectedDrawing?.name }}</p></div><button @click="isChatOpen = false" class="p-2 opacity-60 hover:opacity-100 text-white">✕</button></div>
            <div :class="['flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar flex flex-col', isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50']"><div v-for="(msg, idx) in messages" :key="idx" :class="['max-w-[85%] p-4 rounded-2xl text-[13px] shadow-sm', msg.role === 'ai' ? (isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-200 self-start rounded-tl-none' : 'bg-white border border-slate-100 self-start rounded-tl-none') : 'bg-blue-600 text-white self-end ml-auto rounded-tr-none shadow-blue-200']">{{ msg.text }}</div></div>
            <div :class="['p-6 border-t', isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100']"><form @submit.prevent="sendMessage(selectedDrawing?.name)" class="relative flex items-center"><input v-model="chatInput" type="text" placeholder="도면 분석 질문하기..." :class="['w-full border-none rounded-2xl pl-5 pr-14 py-4 text-sm outline-none font-medium shadow-inner', isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700']" /><button type="submit" class="absolute right-2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></button></form></div>
          </div>
        </transition>
        <button @click="isChatOpen = !isChatOpen" :class="['h-14 w-14 lg:h-16 flex items-center justify-center transition-all duration-500 active:scale-95 group overflow-hidden relative shadow-2xl z-50', isChatOpen ? (isDarkMode ? 'bg-slate-800 text-slate-200 border border-slate-700 rounded-2xl w-14 lg:w-16' : 'bg-white text-slate-900 border border-slate-200 rounded-2xl w-14 lg:w-16') : 'bg-[#0f172a] text-white rounded-full lg:rounded-2xl lg:min-w-[160px] animate-ai-pulse hover:bg-[#1e293b]']"><template v-if="!isChatOpen"><span class="font-extrabold text-lg lg:text-xl tracking-tighter shrink-0 text-white">AI</span><span class="hidden lg:inline-block font-bold text-sm ml-1 text-white">어시스턴트</span></template><template v-else><span class="text-lg lg:text-xl font-light">✕</span></template></button>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 1. 상시 가이드 (대기 상태): "여기 클릭하세요!!!" 라고 외치는 디자인 */
.polygon-guide {
  /* 도면과 보색 대비를 이루는 선명한 블루 */
  fill: rgba(59, 130, 246, 0.15);
  stroke: #3b82f6;
  stroke-width: 8; /* 두께 대폭 강화 */

  /* 점선을 길게 설정하여 도면의 얇은 선들과 차별화 */
  stroke-dasharray: 20, 15;
  stroke-linecap: round;

  /* 네온 글로우 효과 추가 (상시 발광) */
  filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8));

  /* 흐르는 애니메이션과 맥동 애니메이션 동시 적용 */
  animation:
      dash-flow 3s linear infinite,
      neon-pulse 2s infinite ease-in-out;
}

/* 2. 활성화(Hover) 및 선택 시 스타일: 완전히 채워지며 강렬하게 하이라이트 */
.polygon-active {
  fill: rgba(59, 130, 246, 0.5) !important;
  stroke: #2563eb !important;
  stroke-width: 12 !important;
  stroke-dasharray: none !important; /* 실선으로 변경 */
  filter: drop-shadow(0 0 20px rgba(59, 130, 246, 1)) brightness(1.2);
  transition: all 0.3s ease;
}

/* 3. 점선이 테두리를 따라 계속 흐르는 애니메이션 (시선 강탈용) */
@keyframes dash-flow {
  to {
    stroke-dashoffset: -35;
  }
}

/* 4. 영역 자체가 숨쉬듯 깜빡이는 애니메이션 */
@keyframes neon-pulse {
  0% {
    stroke-opacity: 0.5;
    fill-opacity: 0.1;
    filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));
  }
  50% {
    stroke-opacity: 1;
    fill-opacity: 0.3; /* 색상이 진하게 차오름 */
    filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.9));
  }
  100% {
    stroke-opacity: 0.5;
    fill-opacity: 0.1;
    filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));
  }
}

.interactive-polygon {
  cursor: pointer;
  pointer-events: auto;
}
</style>
