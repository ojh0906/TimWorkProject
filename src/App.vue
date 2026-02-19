<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDropdown } from './assets/script'
import { useDrawing } from './composables/useDrawing.ts'
import { useChat } from './composables/useChat.ts'
import './assets/dashboard.css'

const {
  metadata, searchQuery, selectedDiscipline, availableDisciplines,
  selectedRegion, availableRegions, // [추가] 영역(Region) 선택 상태 가져오기
  filteredDrawings, sortedDrawingIds, selectedDrawing, currentImage, selectedDrawingId,
  selectDrawing, setRevision, selectedRevision, availableRevisions, availableRevisionsInfo,
  isDarkMode, toggleDarkMode, scale, position, resetZoom, handleWheel, updateScale,
  isCompareMode, compareRevision, compareImage, overlayOpacity, toggleCompareMode, setCompareRevision,
  isColorCoded,
  hoveredDrawingId, handlePolygonHover, calculateLabelPos, formatOverviewVertices, calculateOverviewLabelPos,
  activeOverlays, toggleOverlay, updateOverlayOpacity, availableOverlayDisciplines, renderedOverlays, activeRevisionPatch
} = useDrawing()

const { isChatOpen, chatInput, messages, sendMessage } = useChat()
const { isOpen: isRevisionOpen, toggle: toggleRevision } = useDropdown()

const isCompareDropdownOpen = ref(false)
const toggleCompareDropdown = () => { isCompareDropdownOpen.value = !isCompareDropdownOpen.value }

const isSidebarOpen = ref(false)
const pinsMap = ref({})
const isPinMode = ref(false)
const editingPin = ref(null)

const isToolbarOpen = ref(false)
const toggleToolbar = () => { isToolbarOpen.value = !isToolbarOpen.value }

const isOverlayMenuOpen = ref(false)

const isMarkupMode = ref(false)
const markupsMap = ref({})
const currentLine = ref(null)
const toggleMarkupMode = () => {
  isMarkupMode.value = !isMarkupMode.value
  if (isMarkupMode.value) { isPinMode.value = false }
}
const togglePinMode = () => {
  isPinMode.value = !isPinMode.value
  if (isPinMode.value) { isMarkupMode.value = false; currentLine.value = null }
}
const clearMarkups = () => { if (selectedDrawingId.value) markupsMap.value[selectedDrawingId.value] = [] }

const deleteMarkup = (id) => {
  const drawingId = selectedDrawingId.value;
  if (drawingId && markupsMap.value[drawingId]) {
    markupsMap.value[drawingId] = markupsMap.value[drawingId].filter(m => m.id !== id);
  }
}

onMounted(() => {
  const saved = localStorage.getItem('timwork_pins_storage_final')
  if (saved) { try { pinsMap.value = JSON.parse(saved) } catch (e) { pinsMap.value = {} } }
  const savedMarkups = localStorage.getItem('timwork_markups_storage')
  if (savedMarkups) { try { markupsMap.value = JSON.parse(savedMarkups) } catch (e) { markupsMap.value = {} } }
  window.addEventListener('click', () => { isCompareDropdownOpen.value = false; isOverlayMenuOpen.value = false; })
})

watch([pinsMap, markupsMap], () => {
  localStorage.setItem('timwork_pins_storage_final', JSON.stringify(pinsMap.value))
  localStorage.setItem('timwork_markups_storage', JSON.stringify(markupsMap.value))
}, { deep: true })

const currentDrawingPins = computed(() => {
  if (!selectedDrawingId.value) return [];
  return pinsMap.value[selectedDrawingId.value] || [];
})

const currentDrawingMarkups = computed(() => {
  if (!selectedDrawingId.value) return [];
  return markupsMap.value[selectedDrawingId.value] || [];
})

const imageRef = ref(null)
const naturalSize = reactive({ width: 5000, height: 5000 })
const onImageLoad = (e) => {
  naturalSize.width = e.target.naturalWidth
  naturalSize.height = e.target.naturalHeight
}

const overlaySizes = reactive({});
const onOverlayLoad = (id, e) => {
  overlaySizes[id] = { width: e.target.naturalWidth, height: e.target.naturalHeight };
};

const allOverlaysToRender = computed(() => {
  const list = [];
  if (activeRevisionPatch.value) {
    list.push({ ...activeRevisionPatch.value, opacity: 1, isPatch: true });
  }
  for (const over of renderedOverlays.value) {
    list.push(over);
  }
  return list;
});

const isSplitMode = ref(false)
const splitRatio = ref(0.5)
const isHandleDragging = ref(false)

const formatVertices = (vertices) => {
  if (!vertices || !Array.isArray(vertices)) return ''
  return vertices.map(v => `${v[0]},${v[1]}`).join(' ')
}

const startHandleDrag = (e) => { isHandleDragging.value = true; e.stopPropagation() }
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
  window.addEventListener('mousemove', onHandleMove, { passive: false }); window.addEventListener('mouseup', stopHandleDrag);
  window.addEventListener('touchmove', onHandleMove, { passive: false }); window.addEventListener('touchend', stopHandleDrag);
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onHandleMove); window.removeEventListener('mouseup', stopHandleDrag);
  window.removeEventListener('touchmove', onHandleMove); window.removeEventListener('touchend', stopHandleDrag);
})

const isDragging = ref(false)
const dragStart = reactive({ x: 0, y: 0 })

const handleSelectDrawing = (id) => {
  isSplitMode.value = false;
  splitRatio.value = 0.5;
  selectDrawing(id)
  if (window.innerWidth < 1024) isSidebarOpen.value = false
}

const startDrag = (e) => {
  if (isHandleDragging.value) return;
  const isUI = e.target.closest('button') || e.target.closest('.compare-toolbar-box') || e.target.closest('.dropdown-container') || e.target.closest('.overlay-panel');
  if (isUI) return;
  if (e.type === 'mousedown') { e.preventDefault(); }
  if (e.type === 'touchstart' && isMarkupMode.value) { e.preventDefault(); }

  const container = document.querySelector('.drawing-container')?.getBoundingClientRect();
  if (!container) return;
  const isTouch = e.type === 'touchstart' || e.type === 'touchmove';
  if (isTouch && (!e.touches || !e.touches.length)) return;
  const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
  const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
  const logicX = (clientX - container.left - container.width / 2 - position.value.x) / scale.value;
  const logicY = (clientY - container.top - container.height / 2 - position.value.y) / scale.value;

  if (isMarkupMode.value) {
    if (e.target.closest('g.markup-group')) return;
    currentLine.value = { x1: logicX, y1: logicY, x2: logicX, y2: logicY };
    return;
  }

  if (isPinMode.value && (e.button === 0 || e.type === 'touchstart')) {
    if (e.target.closest('.pin-marker')) return;
    const id = selectedDrawingId.value;
    if (!id) return;
    if (!pinsMap.value[id]) pinsMap.value[id] = [];
    pinsMap.value[id].push({ id: Date.now(), x: logicX, y: logicY, note: `이슈 리포트 #${pinsMap.value[id].length + 1}` });
    return;
  }

  if (scale.value <= 1 && e.type !== 'touchstart') return;

  isDragging.value = true;
  dragStart.x = clientX - position.value.x;
  dragStart.y = clientY - position.value.y;
}

const handlePinInteraction = (pin) => {
  if (isPinMode.value) {
    const id = selectedDrawingId.value;
    if (id && pinsMap.value[id]) {
      pinsMap.value[id] = pinsMap.value[id].filter(p => p.id !== pin.id);
    }
  } else { editingPin.value = { ...pin }; }
}

const savePinEdit = () => {
  const id = selectedDrawingId.value;
  if (id && pinsMap.value[id]) {
    const idx = pinsMap.value[id].findIndex(p => p.id === editingPin.value.id);
    if (idx !== -1) pinsMap.value[id][idx] = { ...editingPin.value };
  }
  editingPin.value = null;
}

const onDrag = (e) => {
  const container = document.querySelector('.drawing-container')?.getBoundingClientRect();
  if (!container) return;
  const isTouch = e.type === 'touchmove';
  if (isTouch && (!e.touches || !e.touches.length)) return;
  const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
  const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;

  if (isMarkupMode.value && currentLine.value) {
    let lx = (clientX - container.left - container.width / 2 - position.value.x) / scale.value;
    let ly = (clientY - container.top - container.height / 2 - position.value.y) / scale.value;

    if (e.shiftKey) {
      const dx = lx - currentLine.value.x1;
      const dy = ly - currentLine.value.y1;
      const angle = Math.atan2(dy, dx);
      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.hypot(dx, dy);
      lx = currentLine.value.x1 + Math.cos(snappedAngle) * dist;
      ly = currentLine.value.y1 + Math.sin(snappedAngle) * dist;
    }

    currentLine.value.x2 = lx;
    currentLine.value.y2 = ly;
    return;
  }

  if (!isDragging.value || isHandleDragging.value) return;
  position.value.x = clientX - dragStart.x;
  position.value.y = clientY - dragStart.y;
}

const stopDrag = () => {
  if (isMarkupMode.value && currentLine.value) {
    const id = selectedDrawingId.value;
    if (id) {
      const dist = Math.hypot(currentLine.value.x2 - currentLine.value.x1, currentLine.value.y2 - currentLine.value.y1);
      if (dist > 5) {
        if (!markupsMap.value[id]) markupsMap.value[id] = [];
        markupsMap.value[id].push({ ...currentLine.value, id: Date.now() });
      }
    }
    currentLine.value = null;
  }
  isDragging.value = false;
}

const onSliderInput = (e) => { updateScale(parseFloat(e.target.value)) }

// 선 그리기 좌표 표시 모드: 'drawing' 도면 좌표(x,y) / 'real' 실세계(m)
const markupCoordMode = ref('drawing')
const PX_TO_M = 0.025

const formatMarkupCoords = (line, mode) => {
  if (!line) return ''
  const { x1, y1, x2, y2 } = line
  if (mode === 'real') {
    const x1m = (x1 * PX_TO_M).toFixed(2)
    const y1m = (y1 * PX_TO_M).toFixed(2)
    const x2m = (x2 * PX_TO_M).toFixed(2)
    const y2m = (y2 * PX_TO_M).toFixed(2)
    return `(${x1m}m, ${y1m}m) → (${x2m}m, ${y2m}m)`
  }
  return `(${Math.round(x1)}, ${Math.round(y1)}) → (${Math.round(x2)}, ${Math.round(y2)})`
}

const cycleMarkupCoordMode = () => {
  markupCoordMode.value = markupCoordMode.value === 'drawing' ? 'real' : 'drawing'
}
</script>

<template>
  <div :class="['flex h-screen w-full overflow-hidden font-sans relative transition-colors duration-500 select-none', isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8fafc] text-slate-900']">

    <div style="display: none;">
      <img v-for="item in allOverlaysToRender" :key="'img_'+item.id" :src="item.url" @load="onOverlayLoad(item.id, $event)" />
    </div>

    <div v-if="editingPin" class="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @mousedown.stop>
      <div :class="['w-full max-w-sm p-6 rounded-3xl shadow-2xl transition-all', isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white']">
        <h3 class="text-lg font-bold mb-4 italic text-blue-600">이슈 상세 정보</h3>
        <textarea v-model="editingPin.note" rows="5" :class="['w-full p-4 rounded-2xl border-none outline-none text-sm mb-4 resize-none shadow-inner', isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-50 text-slate-700']"></textarea>
        <div class="flex gap-2">
          <button @click="savePinEdit" class="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all">저장</button>
          <button @click="editingPin = null" class="px-5 py-3 rounded-xl font-bold bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all">취소</button>
        </div>
      </div>
    </div>

    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"></div>
    <aside :class="['fixed lg:relative inset-y-0 left-0 w-[340px] border-r flex flex-col z-40 transition-all duration-300 lg:translate-x-0', isSidebarOpen ? 'translate-x-0' : '-translate-x-full', isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200']">

      <div class="p-8 pb-4 flex justify-between items-center shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">T</div>
          <h1 :class="['text-xl font-extrabold tracking-tight', isDarkMode ? 'text-slate-100' : 'text-slate-800']">TimWork</h1>
        </div>
        <button @click="isSidebarOpen = false" class="lg:hidden p-2 text-slate-400">✕</button>
      </div>

      <div class="px-6 mb-4 shrink-0">
        <div class="relative">
          <input v-model="searchQuery" type="text" placeholder="도면 이름 검색..." :class="['w-full border rounded-xl pl-10 py-2.5 text-xs outline-none font-medium transition-colors', isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-900']" />
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-5 pt-2 custom-scrollbar pb-6">
        <h3 :class="['px-2 text-[11px] font-black uppercase tracking-[0.15em] mb-4', isDarkMode ? 'text-slate-600' : 'text-slate-400']">공간 탐색</h3>
        <div class="space-y-1">
          <div class="relative mb-2">
            <button @click="handleSelectDrawing('00')"
                    :class="['w-full flex items-center gap-3 px-4 py-3.5 rounded-[1.2rem] transition-all border-2 text-left',
                  selectedDrawingId === '00'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-700'
                    : 'border-transparent text-slate-600 hover:bg-slate-100']">
              <div :class="['w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                selectedDrawingId === '00' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200/50 text-slate-500']">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-width="2.5" d="M9 20l-5.447-2.724A2 2 0 013 15.487V6.513a2 2 0 011.553-1.943L9 2l5.447 2.724A2 2 0 0116 6.513v8.974a2 2 0 01-1.553 1.943L9 20zm0 0v-8" />
                </svg>
              </div>
              <span class="text-sm font-extrabold tracking-tight">전체 배치도</span>
            </button>

            <div class="ml-8 border-l-2 border-slate-200 dark:border-slate-700 pt-3 pb-1 flex flex-col gap-1 relative">
              <div v-for="id in sortedDrawingIds.filter(id => id !== '00')" :key="id" class="relative pl-6 pr-2 py-1">
                <div class="absolute left-0 top-1/2 -translate-y-1/2 w-4 border-t-2 border-slate-200 dark:border-slate-700 pointer-events-none"></div>

                <button @click="handleSelectDrawing(id)"
                        :class="['w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left shadow-sm',
                          selectedDrawingId === id
                            ? 'bg-blue-600 text-white shadow-blue-500/30'
                            : 'bg-white text-slate-500 border border-slate-100 hover:border-blue-300 hover:text-slate-800']">
                  <svg xmlns="http://www.w3.org/2000/svg" :class="['h-4 w-4 shrink-0', selectedDrawingId === id ? 'opacity-100' : 'opacity-50']" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4m-5 4V4" />
                  </svg>
                  <span class="text-[13px] font-bold truncate">{{ filteredDrawings[id]?.name }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div :class="['flex flex-col p-6 border-t shrink-0 transition-colors', isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white']">
        <div class="mb-4">
          <span class="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block mb-1.5">현재 도면 정보</span>
          <h4 :class="['text-[15px] font-extrabold leading-tight line-clamp-2', isDarkMode ? 'text-slate-100' : 'text-slate-800']" :title="selectedDrawing?.name">
            {{ selectedDrawing?.name || '도면을 선택하세요' }}
          </h4>
        </div>

        <div v-if="availableDisciplines.length > 0" class="mb-5">
          <div class="flex flex-wrap gap-2">
            <button v-for="disc in availableDisciplines" :key="disc" @click="selectedDiscipline = disc"
                    :class="['px-3.5 py-1.5 text-[12px] font-bold rounded-xl transition-all border',
                             selectedDiscipline === disc
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                              : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300')]">
              {{ disc }}
            </button>
          </div>
        </div>

        <div v-if="availableRegions.length > 0" class="mb-5 border-t pt-4" :class="isDarkMode ? 'border-slate-800/60' : 'border-slate-100'">
          <span class="text-[10px] font-extrabold text-orange-500 uppercase tracking-widest block mb-2">영역 선택</span>
          <div class="flex flex-wrap gap-2">
            <button v-for="region in availableRegions" :key="region" @click="selectedRegion = region"
                    :class="['px-3.5 py-1.5 text-[12px] font-bold rounded-xl transition-all border',
                             selectedRegion === region
                              ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                              : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300')]">
              Region {{ region }}
            </button>
          </div>
        </div>

        <div :class="['flex items-center gap-2.5 pt-4 border-t', isDarkMode ? 'border-slate-800/60 text-slate-400' : 'border-slate-100 text-slate-500']">
          <span :class="['px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wide', isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600']">
            Rev. {{ selectedRevision || '-' }}
          </span>
          <span class="text-[12px] font-medium truncate">
            {{ availableRevisionsInfo.find(r => r.version === selectedRevision)?.date || '날짜 정보 없음' }}
          </span>
        </div>
      </div>
    </aside>

    <main class="flex-1 flex flex-col relative overflow-hidden w-full" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag" @touchmove="onDrag" @touchend="stopDrag">
      <header :class="['h-16 lg:h-20 flex items-center justify-between px-4 lg:px-10 border-b sticky top-0 z-[60] backdrop-blur-md transition-all', isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200/60']">
        <div class="flex items-center gap-3">
          <button @click="isSidebarOpen = true" :class="['lg:hidden p-2 rounded-lg', isDarkMode ? 'text-slate-400' : 'text-slate-600']">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold"><path stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h2 :class="['text-base lg:text-xl font-bold truncate', isDarkMode ? 'text-slate-100' : 'text-slate-800']">{{ selectedDrawing?.name }}</h2>
        </div>

        <div class="dropdown-container relative">
          <button @click.stop="toggleRevision" :class="['flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm active:scale-95', isRevisionOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')]">
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

      <!-- 구버전 도면 검토 시 경고 툴팁: 최신본이 아닐 때만 표시 -->
      <div v-if="selectedDrawingId !== '00' && availableRevisionsInfo.length > 0 && !availableRevisionsInfo.find(r => r.version === selectedRevision)?.isLatest" :class="['flex items-center justify-between gap-4 px-4 lg:px-10 py-3 shrink-0', isDarkMode ? 'bg-amber-500/15 border-b border-amber-500/30' : 'bg-amber-50 border-b border-amber-200']">
        <div class="flex items-center gap-3 min-w-0">
          <span class="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </span>
          <span :class="['text-sm font-bold', isDarkMode ? 'text-amber-200' : 'text-amber-800']">
            현재 구버전({{ selectedRevision }}) 도면을 검토 중입니다.
          </span>
        </div>
        <button @click="setRevision(availableRevisionsInfo.find(r => r.isLatest)?.version || selectedRevision)" :class="['flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95', isDarkMode ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-amber-500 text-white hover:bg-amber-600']">
          최신본 바로가기
        </button>
      </div>

      <div :class="['flex-1 overflow-hidden relative drawing-container shadow-inner transition-colors duration-500', isPinMode ? 'cursor-crosshair' : (isMarkupMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'), isDarkMode ? 'bg-slate-950' : 'bg-[#f1f5f9]']" :style="{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '32px 32px', touchAction: isMarkupMode ? 'none' : undefined }" @wheel="handleWheel" @mousedown="startDrag" @touchstart="startDrag">

        <transition name="fade">
          <div v-if="isCompareMode" @mousedown.stop @touchstart.stop class="compare-toolbar-box absolute top-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-4 px-6 py-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-500/30">
            <div class="flex items-center gap-2 mr-2">
              <button @click.stop="isSplitMode = false" :class="['p-2 rounded-lg transition-all', !isSplitMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700']"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg></button>
              <button @click.stop="isSplitMode = true" :class="['p-2 rounded-lg transition-all', isSplitMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700']"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M8 7l-4 4m0 0l4 4m-4-4h16m-4-4l4 4m0 0l-4 4"></path></svg></button>
            </div>
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>

            <div class="relative min-w-[120px]">
              <span class="block text-[9px] font-bold text-blue-600 uppercase mb-0.5">비교 대상</span>
              <button @click.stop="toggleCompareDropdown" :class="['w-full flex items-center justify-between px-3 py-1.5 rounded-xl border text-sm font-bold transition-all', isCompareDropdownOpen ? 'border-blue-500 bg-blue-50/50' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700']">
                <span>{{ compareRevision }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" :class="['h-4 w-4 text-slate-400 transition-transform', isCompareDropdownOpen ? 'rotate-180' : '']" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <transition name="dropdown-fade">
                <div v-if="isCompareDropdownOpen" class="absolute top-full left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-[100] overflow-hidden">
                  <div class="p-1 max-h-48 overflow-y-auto custom-scrollbar-minimal">
                    <button v-for="rev in availableRevisions" :key="rev" @click.stop="setCompareRevision(rev); isCompareDropdownOpen = false" :class="['w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-all', compareRevision === rev ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300']">
                      {{ rev }}
                    </button>
                  </div>
                </div>
              </transition>
            </div>

            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
            <div class="flex flex-col w-32">
              <div class="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter"><span>{{ isSplitMode ? '스와이프' : '비교 비중' }}</span><span>{{ ((isSplitMode ? splitRatio : overlayOpacity) * 100).toFixed(0) }}%</span></div>
              <input v-if="isSplitMode" type="range" min="0" max="1" step="0.01" v-model="splitRatio" class="w-full accent-blue-600 h-1.5 mt-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              <input v-else type="range" min="0" max="1" step="0.01" v-model="overlayOpacity" class="w-full accent-blue-600 h-1.5 mt-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
            <button @click.stop="isColorCoded = !isColorCoded" :class="['px-3 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap', isColorCoded ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300']">강조 {{ isColorCoded ? '켬' : '끎' }}</button>
          </div>
        </transition>

        <div class="w-full h-full flex items-center justify-center transition-transform duration-75 pointer-events-none" :style="{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }">
          <div class="relative w-full h-full flex items-center justify-center overflow-visible pointer-events-none">
            <img v-if="currentImage" :src="currentImage" @load="onImageLoad" ref="imageRef" draggable="false" class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] block shadow-2xl rounded-lg border border-white/40 object-contain transition-all duration-500 pointer-events-auto select-none"
                 :class="[isCompareMode && !isSplitMode ? (isDarkMode ? 'mix-blend-screen' : 'mix-blend-multiply') : '']"
                 :style="{ opacity: 1, filter: isCompareMode && isColorCoded ? (isDarkMode ? 'invert(1) grayscale(1) sepia(1) hue-rotate(200deg) saturate(3)' : 'grayscale(1) sepia(1) hue-rotate(200deg) saturate(3)') : (isDarkMode ? 'invert(0.9) hue-rotate(180deg) brightness(1.1) contrast(1.2)' : 'none'), clipPath: (isCompareMode && isSplitMode) ? `inset(0 ${(1 - splitRatio) * 100}% 0 0)` : 'none', zIndex: 2 }" />

            <!-- 비교 모드 오버레이: 비교 대상 리비전, 비교 비중(overlayOpacity)으로 투명도 조절 -->
            <img v-if="isCompareMode && !isSplitMode && compareImage" :src="compareImage" draggable="false"
                 class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] block object-contain transition-all duration-300 pointer-events-none select-none"
                 :class="isDarkMode ? 'mix-blend-screen' : 'mix-blend-multiply'"
                 :style="{ opacity: overlayOpacity, filter: isCompareMode && isColorCoded ? (isDarkMode ? 'invert(1) grayscale(1) sepia(1) hue-rotate(200deg) saturate(3)' : 'grayscale(1) sepia(1) hue-rotate(200deg) saturate(3)') : (isDarkMode ? 'invert(0.9) hue-rotate(180deg) brightness(1.1) contrast(1.2)' : 'none'), zIndex: 2.5 }" />

            <!-- 비교 모드 스와이프: 오른쪽 영역에 비교 대상 리비전 표시 (splitRatio 기준 좌/우 분할) -->
            <img v-if="isCompareMode && isSplitMode && compareImage" :src="compareImage" draggable="false"
                 class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] block object-contain transition-all duration-300 pointer-events-none select-none"
                 :style="{ filter: isCompareMode && isColorCoded ? (isDarkMode ? 'invert(1) grayscale(1) sepia(1) hue-rotate(200deg) saturate(3)' : 'grayscale(1) sepia(1) hue-rotate(200deg) saturate(3)') : (isDarkMode ? 'invert(0.9) hue-rotate(180deg) brightness(1.1) contrast(1.2)' : 'none'), clipPath: `inset(0 0 0 ${splitRatio * 100}%)`, zIndex: 2 }" />

            <img v-for="item in allOverlaysToRender.filter(o => !o.isPatch)" :key="'full_'+item.id" :src="item.url" draggable="false"
                 class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] block object-contain transition-all duration-300 pointer-events-none select-none"
                 :class="isDarkMode ? 'mix-blend-screen' : 'mix-blend-multiply'"
                 :style="{ opacity: item.opacity, filter: isDarkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none', zIndex: 3 }" />

            <svg class="absolute inset-0 m-auto pointer-events-none" :style="{ width: '100%', height: '100%', maxWidth: '90%', maxHeight: '90%', zIndex: 4, overflow: 'visible' }" :viewBox="`0 0 ${naturalSize.width} ${naturalSize.height}`" preserveAspectRatio="xMidYMid meet">
              <g v-for="item in allOverlaysToRender.filter(o => o.isPatch)" :key="'patch_'+item.id">
                <g v-if="overlaySizes[item.id] && item.transform"
                   :transform="`translate(${item.transform.x}, ${item.transform.y}) rotate(${item.transform.rotation * 180 / Math.PI}) scale(${item.transform.scale || 1})`">
                  <image :href="item.url"
                         :x="-overlaySizes[item.id].width / 2"
                         :y="-overlaySizes[item.id].height / 2"
                         :width="overlaySizes[item.id].width"
                         :height="overlaySizes[item.id].height"
                         :opacity="item.opacity"
                         :style="{ filter: isDarkMode ? 'invert(0.9) hue-rotate(180deg)' : 'none', mixBlendMode: isDarkMode ? 'screen' : 'multiply' }" />
                </g>
              </g>
            </svg>

            <svg v-if="selectedDrawingId === '00' && metadata?.drawings"
                 class="absolute inset-0 m-auto w-full h-full"
                 :viewBox="`0 0 ${naturalSize.width} ${naturalSize.height}`"
                 preserveAspectRatio="xMidYMid meet"
                 style="z-index: 50; pointer-events: none; max-width: 90%; max-height: 90%;">

              <g v-for="(drawing, id) in metadata.drawings" :key="id" style="pointer-events: none;">
                <template v-if="id !== '00' && drawing.position?.vertices">
                  <polygon
                      :points="formatOverviewVertices(drawing.position.vertices)"
                      :class="['interactive-polygon transition-all duration-300', hoveredDrawingId === id ? 'polygon-active' : 'polygon-guide']"
                      style="pointer-events: auto; cursor: pointer;"
                      @mouseenter="handlePolygonHover(id)"
                      @mouseleave="handlePolygonHover(null)"
                      @click="handleSelectDrawing(id)"
                  />

                  <g v-if="hoveredDrawingId === id" class="pointer-events-none">
                    <rect
                        :x="calculateOverviewLabelPos(drawing.position.vertices).x - 300"
                        :y="calculateOverviewLabelPos(drawing.position.vertices).y - 60"
                        width="600" height="120" rx="30"
                        fill="#1e293b" stroke="#3b82f6" stroke-width="4"
                        class="animate-fade-in shadow-2xl label-glow"
                    />
                    <text
                        :x="calculateOverviewLabelPos(drawing.position.vertices).x"
                        :y="calculateOverviewLabelPos(drawing.position.vertices).y"
                        fill="#eff6ff"
                        font-size="48"
                        font-weight="900"
                        letter-spacing="2"
                        text-anchor="middle"
                        dominant-baseline="middle"
                        class="animate-fade-in"
                    >
                      {{ drawing.name }}
                    </text>
                  </g>
                </template>
              </g>
            </svg>

            <svg class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] w-full h-full pointer-events-none" style="z-index: 35; overflow: visible;">
              <!-- 선 그리기: 점선 + 도면/실세계 좌표 표시 (라벨 클릭 시 좌표 모드 전환) -->
              <g v-for="line in currentDrawingMarkups" :key="line.id" class="markup-group group pointer-events-auto cursor-pointer" @dblclick="deleteMarkup(line.id)">
                <line :x1="`calc(50% + ${line.x1}px)`" :y1="`calc(50% + ${line.y1}px)`" :x2="`calc(50% + ${line.x2}px)`" :y2="`calc(50% + ${line.y2}px)`" stroke="transparent" :stroke-width="12 / scale" />
                <line :x1="`calc(50% + ${line.x1}px)`" :y1="`calc(50% + ${line.y1}px)`" :x2="`calc(50% + ${line.x2}px)`" :y2="`calc(50% + ${line.y2}px)`" stroke="#ef4444" :stroke-width="1.5 / scale" :stroke-dasharray="`${6/scale},${4/scale}`" class="opacity-80 group-hover:opacity-100 group-hover:stroke-red-600 transition-colors" />
                <g :style="{ transform: `translate(calc(50% + ${(line.x1 + line.x2) / 2}px), calc(50% + ${(line.y1 + line.y2) / 2}px)) scale(${1 / scale})` }" @click.stop="cycleMarkupCoordMode" class="cursor-pointer">
                  <rect x="-90" y="-10" width="180" height="20" rx="4" fill="#1e293b" fill-opacity="0.9" stroke="#ef4444" stroke-width="1" class="shadow-sm group-hover:stroke-red-600 transition-colors" />
                  <text x="0" y="1" font-size="9" font-weight="600" fill="#f8fafc" text-anchor="middle" dominant-baseline="middle">{{ formatMarkupCoords(line, markupCoordMode) }}</text>
                </g>
              </g>

              <g v-if="currentLine" class="pointer-events-none">
                <line :x1="`calc(50% + ${currentLine.x1}px)`" :y1="`calc(50% + ${currentLine.y1}px)`" :x2="`calc(50% + ${currentLine.x2}px)`" :y2="`calc(50% + ${currentLine.y2}px)`" stroke="#ef4444" :stroke-width="1.5 / scale" :stroke-dasharray="`${6/scale},${4/scale}`" />
                <circle :cx="`calc(50% + ${currentLine.x1}px)`" :cy="`calc(50% + ${currentLine.y1}px)`" :r="3 / scale" fill="white" stroke="#ef4444" :stroke-width="1.5 / scale" />
                <circle :cx="`calc(50% + ${currentLine.x2}px)`" :cy="`calc(50% + ${currentLine.y2}px)`" :r="3 / scale" fill="white" stroke="#ef4444" :stroke-width="1.5 / scale" />
                <g :style="{ transform: `translate(calc(50% + ${(currentLine.x1 + currentLine.x2) / 2}px), calc(50% + ${(currentLine.y1 + currentLine.y2) / 2}px)) scale(${1 / scale})` }">
                  <rect x="-90" y="-10" width="180" height="20" rx="4" fill="#ef4444" fill-opacity="0.95" class="shadow-md" />
                  <text x="0" y="1" font-size="9" font-weight="600" fill="white" text-anchor="middle" dominant-baseline="middle">{{ formatMarkupCoords(currentLine, markupCoordMode) }}</text>
                </g>
              </g>
            </svg>

            <div class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] pointer-events-none" style="z-index: 40;">
              <div v-for="pin in currentDrawingPins" :key="pin.id" class="pin-marker absolute pointer-events-auto group cursor-pointer" :style="{ left: `calc(50% + ${pin.x}px)`, top: `calc(50% + ${pin.y}px)`, transform: `translate(-50%, -50%) scale(${1/scale})` }" @click.stop="handlePinInteraction(pin)">
                <div class="relative flex items-center justify-center">
                  <div :class="['w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg z-10 transition-all', isPinMode ? 'bg-red-500 scale-125' : 'bg-red-600 group-hover:scale-150']"></div>
                  <div class="absolute w-7 h-7 bg-red-500/20 rounded-full animate-pulse-slow"></div>
                </div>
              </div>
            </div>

            <div v-if="isCompareMode && isSplitMode" class="absolute inset-0 m-auto max-w-[90%] max-h-[90%] pointer-events-none z-[90]">
              <div class="absolute h-full w-0.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]" :style="{ left: `${splitRatio * 100}%` }">
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl border-4 border-white pointer-events-auto cursor-ew-resize" @mousedown.stop="startHandleDrag" @touchstart.stop="startHandleDrag">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M8 7l-4 4m0 0l4 4m-4-4h16m-4-4l4 4m0 0l-4 4" /></svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="absolute top-6 right-6 z-[100] flex flex-col items-end gap-3 shrink-0 overlay-panel">

          <div v-if="selectedDrawingId !== '00'" class="relative flex items-center justify-end">
            <transition name="fade">
              <div v-if="isOverlayMenuOpen && availableOverlayDisciplines.length > 0" @click.stop class="absolute right-[120%] top-0 w-72 p-5 rounded-3xl shadow-2xl border backdrop-blur-xl z-50" :class="isDarkMode ? 'bg-slate-900/95 border-slate-700' : 'bg-white/95 border-slate-200'">
                <div class="flex items-center justify-between mb-4">
                  <h4 class="text-[11px] font-extrabold uppercase tracking-widest text-blue-600">레이어 오버레이</h4>
                  <span class="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">다중 선택</span>
                </div>

                <div class="space-y-3">
                  <div v-for="disc in availableOverlayDisciplines" :key="disc" class="flex flex-col gap-2.5 p-3.5 rounded-xl border transition-all" :class="activeOverlays[disc]?.active ? (isDarkMode ? 'bg-slate-800 border-blue-500/50' : 'bg-blue-50/50 border-blue-200') : (isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-100')">
                    <label class="flex items-center justify-between cursor-pointer w-full">
                      <span class="text-[13px] font-bold transition-colors" :class="activeOverlays[disc]?.active ? 'text-blue-600 dark:text-blue-400' : (isDarkMode ? 'text-slate-400' : 'text-slate-600')">{{ disc }}</span>
                      <div class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" :checked="activeOverlays[disc]?.active" @change="toggleOverlay(disc)" class="sr-only peer" />
                        <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                      </div>
                    </label>

                    <transition name="fade">
                      <div v-if="activeOverlays[disc]?.active" class="flex items-center gap-3 mt-1 pt-2 border-t" :class="isDarkMode ? 'border-slate-700' : 'border-blue-100/50'">
                        <span class="text-[10px] font-bold text-slate-400 w-8">투명도</span>
                        <input type="range" min="0" max="1" step="0.01" :value="activeOverlays[disc].opacity" @input="e => updateOverlayOpacity(disc, parseFloat(e.target.value))" class="flex-1 accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-600" />
                        <span class="text-[10px] font-bold text-slate-500 w-8 text-right">{{ Math.round((activeOverlays[disc]?.opacity || 0) * 100) }}%</span>
                      </div>
                    </transition>
                  </div>
                </div>
              </div>
            </transition>

            <div class="flex items-center gap-3 group">
              <span v-if="!isOverlayMenuOpen" class="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md border border-white/10">레이어 겹쳐보기</span>
              <button @click.stop="isOverlayMenuOpen = !isOverlayMenuOpen" :class="['p-3 rounded-2xl shadow-xl transition-all border shrink-0', isOverlayMenuOpen ? 'bg-blue-600 text-white border-blue-600' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600')]">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </button>
            </div>
          </div>

          <button @click.stop="toggleToolbar"
                  :class="['p-3 rounded-2xl shadow-xl transition-all border z-10',
                  isToolbarOpen ? 'bg-slate-800 text-white border-slate-700' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600')]">
            <svg v-if="!isToolbarOpen" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <transition name="toolbar-fade">
            <div v-show="isToolbarOpen" class="flex flex-col items-end gap-3">
              <div class="flex items-center gap-3 group">
                <span class="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md border border-white/10">테마 변경</span>
                <button @click.stop="toggleDarkMode" class="p-3 rounded-2xl shadow-xl transition-all border shrink-0" :class="isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600'">
                  <svg v-if="!isDarkMode" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707-.707" /></svg>
                </button>
              </div>

              <div class="flex items-center gap-3 group">
                <span class="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md border border-white/10">비교 모드</span>
                <button @click.stop="toggleCompareMode" :class="['p-3 rounded-2xl shadow-xl transition-all border shrink-0', isCompareMode ? 'bg-blue-600 border-blue-600 text-white' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600')]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                </button>
              </div>

              <div class="flex items-center gap-3 group">
                <span class="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md border border-white/10">선 그리기 (점선, 좌표 라벨 클릭: 도면/실세계 전환, Shift: 스냅, 더블클릭: 삭제)</span>
                <button @click.stop="toggleMarkupMode" :class="['p-3 rounded-2xl shadow-xl border transition-all shrink-0', isMarkupMode ? 'bg-blue-600 text-white shadow-lg' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600')]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              </div>

              <div class="flex items-center gap-3 group">
                <span class="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md border border-white/10">이슈 마킹</span>
                <button @click.stop="togglePinMode" :class="['p-3 rounded-2xl shadow-xl border relative transition-all shrink-0', isPinMode ? 'bg-red-600 border-red-600 text-white' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400 hover:text-red-500')]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <span v-if="isPinMode" class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span></span>
                </button>
              </div>

              <div class="flex items-center gap-3 group">
                <span class="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md border border-white/10">비율 초기화</span>
                <button @click.stop="resetZoom" class="w-12 h-12 rounded-full shadow-xl border-2 flex items-center justify-center font-bold shrink-0" :class="isDarkMode ? 'bg-slate-800 border-blue-500/50 text-blue-400' : 'bg-white border-blue-600 text-blue-600'">1:1</button>
              </div>

              <div class="flex items-center gap-3 group">
                <span class="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md border border-white/10">확대/축소</span>
                <div :class="['flex flex-col items-center gap-4 p-3 border rounded-[2rem] shadow-2xl transition-all w-[46px] shrink-0', isDarkMode ? 'bg-slate-800/90 border-slate-700 backdrop-blur-sm' : 'bg-white/90 border-slate-100 backdrop-blur-sm']">
                  <button @click.stop="updateScale(scale - 0.2)" :class="[isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600']">-</button>
                  <div class="relative h-32 w-1.5 flex justify-center py-2" @mousedown.stop @touchstart.stop><input type="range" min="0.5" max="5" step="0.1" :value="scale" @input="onSliderInput" class="appearance-none w-32 h-1 bg-slate-200 rounded-lg absolute rotate-90 top-1/2 -translate-y-1/2 cursor-pointer accent-blue-600" /></div>
                  <button @click.stop="updateScale(scale + 0.2)" :class="[isDarkMode ? 'text-slate-400 hover:text-blue-400' : 'text-slate-400 hover:text-blue-600']">+</button>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <div class="absolute bottom-6 right-6 lg:bottom-10 lg:right-10 flex flex-col items-end z-200">
        <transition name="chat-slide">
          <div v-if="isChatOpen" :class="['mb-5 w-[calc(100vw-3rem)] sm:w-96 h-[500px] lg:h-[600px] rounded-[2.5rem] shadow-2xl border flex flex-col overflow-hidden', isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100']">
            <div class="p-6 bg-slate-900 text-white flex justify-between items-center shadow-lg"><div><h3 class="font-bold text-lg leading-tight text-white">현장 AI 지원</h3><p class="text-[11px] text-slate-400 font-medium italic">분석 중: {{ selectedDrawing?.name }}</p></div><button @click="isChatOpen = false" class="p-2 opacity-60 hover:opacity-100 text-white">✕</button></div>
            <div :class="['flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar flex flex-col', isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50']"><div v-for="(msg, idx) in messages" :key="idx" :class="['max-w-[85%] p-4 rounded-2xl text-[13px] shadow-sm', msg.role === 'ai' ? (isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-200 self-start rounded-tl-none' : 'bg-white border border-slate-100 self-start rounded-tl-none') : 'bg-blue-600 text-white self-end ml-auto rounded-tr-none shadow-blue-200']">{{ msg.text }}</div></div>
            <div :class="['p-6 border-t', isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100']"><form @submit.prevent="sendMessage(selectedDrawing?.name)" class="relative flex items-center"><input v-model="chatInput" type="text" placeholder="도면 분석 질문하기..." :class="['w-full border-none rounded-2xl pl-5 pr-14 py-4 text-sm outline-none font-medium shadow-inner', isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700']" /><button type="submit" class="absolute right-2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></button></form></div>
          </div>
        </transition>
        <button @click="isChatOpen = !isChatOpen" :class="['h-14 w-14 lg:h-16 flex items-center justify-center transition-all duration-500 active:scale-95 group overflow-hidden relative shadow-2xl z-50', isChatOpen ? (isDarkMode ? 'bg-slate-800 text-slate-200 border border-slate-700 rounded-2xl w-14 lg:w-16' : 'bg-white text-slate-900 border border-slate-200 rounded-2xl w-14 lg:w-16') : 'bg-[#0f172a] text-white rounded-full lg:rounded-2xl lg:min-w-[160px] animate-ai-pulse hover:bg-[#1e293b]']"><template v-if="!isChatOpen"><span class="font-extrabold text-lg lg:text-xl tracking-tighter shrink-0 text-white">AI</span><span class="hidden lg:inline-block font-bold text-sm ml-1 text-white uppercase">Assistant</span></template><template v-else><span class="text-lg lg:text-xl font-light">✕</span></template></button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.toolbar-fade-enter-active, .toolbar-fade-leave-active { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.toolbar-fade-enter-from, .toolbar-fade-leave-to { opacity: 0; transform: translateY(-10px) scale(0.95); }
.polygon-guide { fill: rgba(59, 130, 246, 0.05); stroke: rgba(59, 130, 246, 0.6); stroke-width: 6; stroke-dasharray: 20, 10; animation: stroke-glow 3s infinite ease-in-out; }
.polygon-active { fill: rgba(59, 130, 246, 0.25) !important; stroke: #2563eb !important; stroke-width: 10 !important; stroke-dasharray: none !important; filter: drop-shadow(0 0 20px rgba(37, 99, 235, 0.7)); }
@keyframes stroke-glow { 0%, 100% { filter: drop-shadow(0 0 2px rgba(59, 130, 246, 0.3)); stroke-opacity: 0.5; } 50% { filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.8)); stroke-opacity: 1; } }
.label-glow { filter: drop-shadow(0 10px 25px rgba(15, 23, 42, 0.6)); }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
.animate-fade-in { animation: fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
@keyframes pulse-slow { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.6); } }
.interactive-polygon { cursor: pointer; pointer-events: auto; outline: none; }
.dropdown-fade-enter-active, .dropdown-fade-leave-active { transition: all 0.2s ease; }
.dropdown-fade-enter-from, .dropdown-fade-leave-to { opacity: 0; transform: translateY(-5px); }
</style>
