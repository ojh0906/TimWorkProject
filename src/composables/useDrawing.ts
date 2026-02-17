import { ref, computed, onMounted, watch } from 'vue'

interface Revision {
    version: string;
    image: string;
    date?: string;
    description?: string;
}

interface RevisionInfo {
    version: string;
    date: string;
    description: string;
    isLatest: boolean;
    image: string;
}

interface DisciplineData {
    image?: string;
    revisions?: Revision[];
}

interface Drawing {
    id: string;
    name: string;
    image: string;
    points?: string;
    disciplines?: { [key: string]: DisciplineData | undefined };
    isRecentlyUpdated?: boolean;
}

interface Metadata {
    drawings: Record<string, Drawing>;
    disciplines: { name: string }[];
}

export function useDrawing() {
    const metadata = ref<Metadata | null>(null)
    const selectedDrawingId = ref<string>('00')
    const selectedRevision = ref<string>('')
    const searchQuery = ref<string>('')
    const selectedDiscipline = ref<string>('전체')
    const isDarkMode = ref(false);
    const isColorCoded = ref(true);
    const isSplitMode = ref(false); // 스플릿 뷰 활성화 여부
    const splitRatio = ref(0.5);   // 스플릿 바 위치 (0 ~ 1)
    // const isHandleDragging = ref(false);
    const hoveredDrawingId = ref<string | null>(null);
    const pins = ref([]); // 핀 목록 저장 { id, x, y, type, note }

    const addPin = (drawingX: number, drawingY: number) => {
        const newPin = {
            id: Date.now(),
            x: drawingX,
            y: drawingY,
            type: 'issue', // 기본값: 이슈
            note: '새로운 이슈 기록'
        };
        pins.value.push(newPin);
    };

    const handlePolygonClick = (id: string) => {
        selectDrawing(id);
    };

    // [추가] 마우스 오버 시 ID 저장
    const handlePolygonHover = (id: string | null) => {
        hoveredDrawingId.value = id;
    };

    const toggleSplitMode = () => {
        isSplitMode.value = !isSplitMode.value;
        if (isSplitMode.value) {
            isCompareMode.value = true; // 스플릿 모드 켜면 비교 모드도 함께 활성화
            overlayOpacity.value = 1;   // 스플릿일 때는 투명도가 의미 없으므로 1로 설정
        }
    };

    const updateSplitRatio = (val: number) => {
        splitRatio.value = Math.min(Math.max(val, 0), 1);
    };


    // 확대/축소 및 위치 상태
    const scale = ref(1);
    const position = ref({ x: 0, y: 0 });

    // 비교 모드 관련 상태 관리
    const isCompareMode = ref(false);
    const compareRevision = ref<string>('');
    const overlayOpacity = ref(0.5);

    onMounted(async () => {
        try {
            const res = await fetch('/data/metadata.json')
            metadata.value = await res.json()
        } catch (e) { console.error("로드 실패:", e) }
    })

    const toggleCompareMode = () => {
        isCompareMode.value = !isCompareMode.value;

        if (isCompareMode.value) {
            if (availableRevisions.value.length > 1) {
                const currentIndex = availableRevisions.value.indexOf(selectedRevision.value);
                const targetIndex = currentIndex === 0 ? 1 : 0;
                compareRevision.value = availableRevisions.value[targetIndex];
            } else {
                compareRevision.value = selectedRevision.value || 'Original';
            }
        }
    };

    const setCompareRevision = (rev: string) => {
        compareRevision.value = rev;
    };

    const toggleDarkMode = () => {
        isDarkMode.value = !isDarkMode.value;
    };

    const resetZoom = () => {
        scale.value = 1;
        position.value = { x: 0, y: 0 };
    };

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomSpeed = 0.0015;
        const delta = -e.deltaY * zoomSpeed;
        const nextScale = Math.min(Math.max(scale.value + delta, 0.5), 5);
        scale.value = nextScale;
    };

    const updateScale = (newScale: number) => {
        scale.value = Math.min(Math.max(newScale, 0.5), 5);
    };

    const filteredDrawings = computed(() => {
        const data = metadata.value;
        if (!data || !data.drawings) return {};

        const result: Record<string, Drawing> = {};
        const query = searchQuery.value.toLowerCase();
        const discKey = selectedDiscipline.value;
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();

        for (const [id, drawing] of Object.entries(data.drawings)) {
            const matchesSearch = drawing.name.toLowerCase().includes(query);
            const hasDiscipline = drawing.disciplines && drawing.disciplines[discKey];
            const matchesDiscipline = discKey === '전체' || !!hasDiscipline;

            if (matchesSearch && matchesDiscipline) {
                let isRecent = false;
                if (drawing.disciplines) {
                    const allRevs = Object.values(drawing.disciplines).flatMap(d => d?.revisions || []);
                    isRecent = allRevs.some(r => {
                        if (!r.date) return false;
                        return (now - new Date(r.date).getTime()) < SEVEN_DAYS_MS;
                    });
                }
                result[id] = { ...drawing, isRecentlyUpdated: isRecent };
            }
        }
        return result;
    });

    const sortedDrawingIds = computed(() => Object.keys(filteredDrawings.value).sort())

    const selectedDrawing = computed(() => {
        const data = metadata.value;
        if (!data || !data.drawings) return null;
        return data.drawings[selectedDrawingId.value] || null;
    });

    const availableRevisionsInfo = computed<RevisionInfo[]>(() => {
        const drawing = selectedDrawing.value;
        if (!drawing || !drawing.disciplines) return [];

        const discKey = selectedDiscipline.value;
        let discData = drawing.disciplines[discKey];

        if (discKey === '전체') {
            discData = Object.values(drawing.disciplines).find(d => d && d.revisions && d.revisions.length > 0) || Object.values(drawing.disciplines)[0];
        }

        if (!discData) return [];

        const revs = discData.revisions || [];
        const info = revs.map((r, index) => ({
            version: r.version,
            image: r.image.normalize('NFC'),
            date: r.date || '날짜 미상',
            description: r.description || '수정 내역이 없습니다.',
            isLatest: index === revs.length - 1
        }));

        if (!info.some(r => r.version === 'Original')) {
            info.unshift({
                version: 'Original',
                image: drawing.image.normalize('NFC'),
                date: '최초 등록',
                description: '초기 발행 도면입니다.',
                isLatest: revs.length === 0
            });
        }

        return [...info].reverse();
    });

    const availableRevisions = computed(() => availableRevisionsInfo.value.map(r => r.version));

    // 메인 상위 레이어 도면 이미지 (현재 검토 중인 도면)
    const currentImage = computed(() => {
        const drawing = selectedDrawing.value;
        if (!drawing) return null;

        const info = availableRevisionsInfo.value;
        const currentRev = info.find(r => r.version === selectedRevision.value) || info[0];

        const targetImage = currentRev ? currentRev.image.normalize('NFC') : drawing.image.normalize('NFC');
        return `/data/drawings/${targetImage.trim()}`;
    });

    // 하단 비교 레이어 도면 이미지 (오버레이용)
    const compareImage = computed(() => {
        if (!isCompareMode.value) return null;
        const drawing = selectedDrawing.value;
        if (!drawing) return null;

        const info = availableRevisionsInfo.value;
        const targetRev = info.find(r => r.version === compareRevision.value);

        const targetFileName = targetRev ? targetRev.image.normalize('NFC') : (selectedRevision.value || drawing.image.normalize('NFC'));
        return `/data/drawings/${targetFileName.trim()}`;
    });

    const setRevision = (rev: string) => { selectedRevision.value = rev };

    const selectDrawing = (id: string) => {
        selectedDrawingId.value = id;
        isCompareMode.value = false;
        resetZoom();

        const drawing = metadata.value?.drawings[id];
        if (drawing && drawing.disciplines) {
            let discKey = selectedDiscipline.value;
            if (discKey === '전체') {
                const validDisc = Object.entries(drawing.disciplines).find(([_, d]) => d?.revisions && d.revisions.length > 0);
                discKey = validDisc ? validDisc[0] : Object.keys(drawing.disciplines)[0];
            }
            const revs = drawing.disciplines[discKey]?.revisions || [];
            selectedRevision.value = revs.length > 0 ? revs[revs.length - 1].version : 'Original';
        } else {
            selectedRevision.value = 'Original';
        }
    };

    watch(selectedDiscipline, () => {
        const info = availableRevisionsInfo.value;
        if (info.length > 0) selectedRevision.value = info[0].version;
        isCompareMode.value = false;
        resetZoom();
    });

    return {
        metadata, selectedDrawingId, selectedRevision, searchQuery,
        selectedDiscipline, filteredDrawings, sortedDrawingIds,
        selectedDrawing, currentImage, availableRevisions,
        availableRevisionsInfo, setRevision, selectDrawing,
        isDarkMode, toggleDarkMode, resetZoom,
        scale, position, handleWheel, updateScale,
        isCompareMode, compareRevision, compareImage, isColorCoded, overlayOpacity,
        toggleCompareMode, setCompareRevision,
        isSplitMode, splitRatio, toggleSplitMode, updateSplitRatio,
        hoveredDrawingId, handlePolygonClick, handlePolygonHover,
        pins, addPin
    };
}
