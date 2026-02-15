<script setup>
import { ref, reactive } from 'vue'
import { useDropdown } from './assets/script'
import { useDrawing } from './composables/useDrawing.ts'
import { useChat } from './composables/useChat.ts'
import './assets/dashboard.css'

// 로직 가져오기 (확대/축소 관련 상태 추가)
const {
  metadata, searchQuery, selectedDiscipline, filteredDrawings,
  sortedDrawingIds, selectedDrawing, currentImage, selectedDrawingId,
  selectDrawing, setRevision, selectedRevision, availableRevisions, availableRevisionsInfo,
  isDarkMode, toggleDarkMode, scale, position, resetZoom, handleWheel, updateScale
} = useDrawing()

const { isChatOpen, chatInput, messages, sendMessage } = useChat()
const { isOpen: isRevisionOpen, toggle: toggleRevision } = useDropdown()
const isSidebarOpen = ref(false)

// 드래그 상태 관리
const isDragging = ref(false)
const dragStart = reactive({ x: 0, y: 0 })

const handleSelectDrawing = (id) => {
  selectDrawing(id)
  if (window.innerWidth < 1024) isSidebarOpen.value = false
}

// 드래그 시작
const startDrag = (e) => {
  if (scale.value <= 1 && e.type !== 'touchstart') return
  isDragging.value = true
  const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX
  const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY
  dragStart.x = clientX - position.value.x
  dragStart.y = clientY - position.value.y
}

// 드래그 중
const onDrag = (e) => {
  if (!isDragging.value) return
  const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX
  const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY
  position.value.x = clientX - dragStart.x
  position.value.y = clientY - dragStart.y
}

// 드래그 종료
const stopDrag = () => {
  isDragging.value = false
}

// 슬라이더 입력 핸들러
const onSliderInput = (e) => {
  updateScale(parseFloat(e.target.value))
}
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
        <h3 :class="['px-4 text-[11px] font-bold uppercase tracking-wider mb-3 italic', isDarkMode ? 'text-slate-500' : 'text-slate-400']">Drawing List</h3>
        <div class="space-y-1">
          <button v-for="id in sortedDrawingIds" :key="id" @click="handleSelectDrawing(id)"
                  :class="['w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all',
                           selectedDrawingId === id ? (isDarkMode ? 'bg-blue-900/40 text-blue-400 font-bold' : 'bg-blue-50 text-blue-700 font-bold') : (isDarkMode ? 'text-slate-400 hover:bg-slate-800/50' : 'text-slate-500 hover:bg-slate-50')]">
            <div class="flex items-center gap-3 truncate">
              <div :class="['w-1.5 h-1.5 rounded-full shrink-0', selectedDrawingId === id ? 'bg-blue-600' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-300')]"></div>
              <span class="text-sm truncate text-left">{{ filteredDrawings[id].name }}</span>
            </div>
            <span v-if="filteredDrawings[id].isRecentlyUpdated"
                  class="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
          </button>
        </div>
      </div>
    </aside>

    <main class="flex-1 flex flex-col relative overflow-hidden w-full" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag" @touchmove="onDrag" @touchend="stopDrag">
      <header :class="['h-16 lg:h-20 flex items-center justify-between px-4 lg:px-10 border-b sticky top-0 z-10 shadow-sm backdrop-blur-md transition-all',
                        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200/60']">
        <div class="flex items-center gap-3">
          <button @click="isSidebarOpen = true" :class="['lg:hidden p-2 rounded-lg', isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100']">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold"><path stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h2 :class="['text-base lg:text-xl font-bold truncate', isDarkMode ? 'text-slate-100' : 'text-slate-800']">{{ selectedDrawing?.name }}</h2>
        </div>

        <div class="dropdown-container relative">
          <button
              @click.stop="toggleRevision"
              :class="['flex items-center gap-2 px-4 py-2 border rounded-xl transition-all shadow-sm active:scale-95',
                       isRevisionOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')]"
          >
            <span class="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Version</span>
            <span :class="['text-sm font-bold', isDarkMode ? 'text-slate-200' : 'text-slate-800']">{{ selectedRevision }}</span>
            <span v-if="availableRevisionsInfo.find(r => r.version === selectedRevision)?.isLatest"
                  class="px-1.5 py-0.5 bg-green-500 text-[9px] text-white rounded-md font-bold leading-none">LATEST</span>
            <svg xmlns="http://www.w3.org/2000/svg" :class="['h-4 w-4 text-slate-400 transition-transform', isRevisionOpen ? 'rotate-180' : '']" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>

          <transition name="dropdown-fade">
            <div v-if="isRevisionOpen" :class="['absolute right-0 mt-2 w-72 border rounded-2xl shadow-2xl z-50 overflow-hidden', isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100']">
              <div class="p-2 max-h-80 overflow-y-auto custom-scrollbar-minimal">
                <template v-if="availableRevisionsInfo.length > 0">
                  <button
                      v-for="rev in availableRevisionsInfo"
                      :key="rev.version"
                      @click="setRevision(rev.version); toggleRevision()"
                      :class="['w-full flex flex-col p-4 rounded-xl mb-1 transition-all text-left',
                               selectedRevision === rev.version ? (isDarkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-50 text-blue-700') : (isDarkMode ? 'hover:bg-slate-700/50 text-slate-400' : 'hover:bg-slate-50 text-slate-500')]"
                  >
                    <div class="w-full flex items-center justify-between mb-1.5">
                      <div class="flex items-center gap-2">
                        <p :class="['text-xs font-bold', selectedRevision === rev.version ? (isDarkMode ? 'text-blue-400' : 'text-blue-700') : (isDarkMode ? 'text-slate-200' : 'text-slate-800')]">{{ rev.version }}</p>
                        <span v-if="rev.isLatest" class="text-[9px] font-black text-green-600 bg-green-100 px-1 rounded">NEW</span>
                      </div>
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

      <transition name="fade">
        <div v-if="selectedRevision && availableRevisionsInfo.length > 0 && !availableRevisionsInfo.find(r => r.version === selectedRevision)?.isLatest"
             :class="['w-full border-b px-6 py-2 flex items-center justify-between z-10 shadow-sm transition-all',
                      isDarkMode ? 'bg-amber-950/40 border-amber-900/50' : 'bg-amber-50 border-amber-200/50']">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-6 h-6 bg-amber-500 rounded-full text-white font-bold shrink-0">!</div>
            <p :class="['text-[13px] font-bold', isDarkMode ? 'text-amber-200' : 'text-amber-800']">
              현재 구버전({{ selectedRevision }}) 도면을 검토 중입니다.
              <span class="hidden md:inline font-medium opacity-70 ml-1">오시공 방지를 위해 최신본을 확인하십시오.</span>
            </p>
          </div>
          <button @click="setRevision(availableRevisionsInfo[0].version)"
                  class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg text-xs font-black transition-all active:scale-95 shadow-sm shrink-0">
            최신본 바로가기
          </button>
        </div>
      </transition>

      <div :class="['flex-1 overflow-hidden relative shadow-inner transition-colors duration-500 cursor-grab active:cursor-grabbing',
                    isDarkMode ? 'bg-slate-950' : 'bg-[#f1f5f9]']"
           style="background-image: radial-gradient(#334155 1px, transparent 1px); background-size: 32px 32px;"
           @wheel="handleWheel" @mousedown="startDrag" @touchstart="startDrag">

        <div class="absolute top-6 right-6 z-20 flex flex-col gap-3 shrink-0">
          <button @click="toggleDarkMode"
                  class="p-3 rounded-2xl shadow-xl transition-all active:scale-90 border flex-shrink-0"
                  :class="isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600'">
            <svg v-if="!isDarkMode" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707-.707" /></svg>
          </button>

          <div class="flex flex-col items-center gap-1.5">
            <button @click="resetZoom"
                    class="group relative flex items-center justify-center w-12 h-12 rounded-full shadow-xl transition-all active:scale-90 border-2 flex-shrink-0 overflow-hidden"
                    :class="isDarkMode
                        ? 'bg-slate-800 border-blue-500/50 text-blue-400 shadow-blue-900/20'
                        : 'bg-white border-blue-600 text-blue-600 shadow-blue-200/50 hover:bg-blue-50'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                <circle cx="12" cy="12" r="3" stroke-width="2" />
                <path stroke-width="2" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>

              <div class="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
            <span :class="['text-[10px] font-black tracking-widest leading-none px-1.5 py-0.5 rounded',
                       isDarkMode ? 'text-blue-400 bg-blue-900/30' : 'text-blue-700 bg-blue-50']">1:1</span>
          </div>

          <div :class="['flex flex-col items-center gap-4 p-3 border rounded-[2rem] shadow-2xl transition-all w-[46px] shrink-0', isDarkMode ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm' : 'bg-white/90 border-slate-100 backdrop-blur-sm']">
            <button @click="updateScale(scale + 0.2)" :class="[isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600']">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold"><path d="M12 4v16m8-8H4" /></svg>
            </button>
            <div class="relative h-32 w-1.5 flex justify-center py-2">
              <input type="range" min="0.5" max="5" step="0.1" :value="scale" @input="onSliderInput"
                     class="appearance-none w-32 h-1 bg-slate-200 rounded-lg absolute rotate-90 top-1/2 -translate-y-1/2 cursor-pointer accent-blue-600" />
            </div>
            <button @click="updateScale(scale - 0.2)" :class="[isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600']">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold"><path d="M20 12H4" /></svg>
            </button>
            <div :class="['mt-1 pt-2 border-t w-full text-center', isDarkMode ? 'border-slate-700' : 'border-slate-100']">
              <span :class="['text-[9px] font-bold leading-none', isDarkMode ? 'text-slate-400' : 'text-slate-500']">{{ (scale * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>

        <div class="w-full h-full flex items-center justify-center transition-transform duration-75 pointer-events-none" :style="{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }">
          <img v-if="currentImage" :key="selectedDrawingId + selectedRevision" :src="currentImage"
               class="max-w-[90%] max-h-[90%] block shadow-2xl rounded-lg border border-white/40 shadow-slate-400/50 object-contain transition-all duration-500"
               :class="isDarkMode ? 'invert-[0.9] hue-rotate-180 brightness-110 contrast-125' : ''" />
          <div v-else class="text-slate-300 font-bold text-xl animate-pulse italic">이미지를 로딩 중이거나 선택된 도면이 없습니다.</div>
        </div>
      </div>

      <div class="absolute bottom-6 right-6 lg:bottom-10 lg:right-10 flex flex-col items-end z-50">
        <transition name="chat-slide">
          <div v-if="isChatOpen" :class="['mb-5 w-[calc(100vw-3rem)] sm:w-96 h-[500px] lg:h-[600px] rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border flex flex-col overflow-hidden',
                                        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100']">
            <div class="p-6 bg-slate-900 text-white flex justify-between items-center shadow-lg">
              <div><h3 class="font-bold text-lg leading-tight text-white">Construction AI</h3><p class="text-[11px] text-slate-400 font-medium italic">Analyzing: {{ selectedDrawing?.name }}</p></div>
              <button @click="isChatOpen = false" class="p-2 opacity-60 hover:opacity-100 text-white">✕</button>
            </div>
            <div :class="['flex-1 p-6 overflow-y-auto space-y-6 scroll-smooth custom-scrollbar', isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50']">
              <div v-for="(msg, idx) in messages" :key="idx" :class="['max-w-[85%] p-4 rounded-2xl text-[13px] shadow-sm', msg.role === 'ai' ? (isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-200 self-start rounded-tl-none' : 'bg-white border border-slate-100 self-start rounded-tl-none') : 'bg-blue-600 text-white self-end ml-auto rounded-tr-none shadow-blue-200']">{{ msg.text }}</div>
            </div>
            <div :class="['p-6 border-t', isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100']">
              <form @submit.prevent="sendMessage(selectedDrawing?.name)" class="relative flex items-center">
                <input v-model="chatInput" type="text" placeholder="도면 분석 질문하기..." :class="['w-full border-none rounded-2xl pl-5 pr-14 py-4 text-sm outline-none font-medium shadow-inner', isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700']" />
                <button type="submit" class="absolute right-2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></button>              </form>
            </div>
          </div>
        </transition>

        <button @click="isChatOpen = !isChatOpen" :class="['h-14 w-14 lg:h-16 flex items-center justify-center transition-all duration-500 active:scale-95 group overflow-hidden relative shadow-2xl z-50', isChatOpen ? (isDarkMode ? 'bg-slate-800 text-slate-200 border border-slate-700 rounded-2xl w-14 lg:w-16' : 'bg-white text-slate-900 border border-slate-200 rounded-2xl w-14 lg:w-16') : 'bg-[#0f172a] text-white rounded-full lg:rounded-2xl lg:min-w-[160px] animate-ai-pulse hover:bg-[#1e293b]']">
          <template v-if="!isChatOpen"><span class="font-extrabold text-lg lg:text-xl tracking-tighter shrink-0 text-white">AI</span><span class="hidden lg:inline-block font-bold text-sm ml-1 text-white">어시스턴트</span></template>
          <template v-else><span class="text-lg lg:text-xl font-light">✕</span></template>
        </button>
      </div>
    </main>
  </div>
</template>
