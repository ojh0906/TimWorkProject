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

    // 확대/축소 및 위치 상태
    const scale = ref(1);
    const position = ref({ x: 0, y: 0 });

    onMounted(async () => {
        try {
            const res = await fetch('/data/metadata.json')
            metadata.value = await res.json()
        } catch (e) { console.error("로드 실패:", e) }
    })

    const toggleDarkMode = () => {
        isDarkMode.value = !isDarkMode.value;
    };

    const resetZoom = () => {
        scale.value = 1;
        position.value = { x: 0, y: 0 };
    };

    // [신규] 마우스 휠 확대/축소 로직
    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomSpeed = 0.0015; // 현장용 정밀 조절을 위한 속도 튜닝
        const delta = -e.deltaY * zoomSpeed;
        const nextScale = Math.min(Math.max(scale.value + delta, 0.5), 5); // 0.5배 ~ 5배 제한
        scale.value = nextScale;
    };

    // [신규] 슬라이더 및 버튼용 배율 업데이트 함수
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
            image: r.image,
            date: r.date || '날짜 미상',
            description: r.description || '수정 내역이 없습니다.',
            isLatest: index === revs.length - 1
        }));

        if (!info.some(r => r.version === 'Original')) {
            info.unshift({
                version: 'Original',
                image: drawing.image,
                date: '최초 등록',
                description: '초기 발행 도면입니다.',
                isLatest: revs.length === 0
            });
        }

        return [...info].reverse();
    });

    const availableRevisions = computed(() => availableRevisionsInfo.value.map(r => r.version));

    const currentImage = computed(() => {
        const drawing = selectedDrawing.value;
        if (!drawing) return null;

        const info = availableRevisionsInfo.value;
        const currentRev = info.find(r => r.version === selectedRevision.value) || info[0];

        const targetImage = currentRev ? currentRev.image : drawing.image;
        return `/data/drawings/${targetImage.trim()}`;
    });

    const setRevision = (rev: string) => { selectedRevision.value = rev };

    const selectDrawing = (id: string) => {
        selectedDrawingId.value = id;
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
        resetZoom();
    });

    return {
        metadata, selectedDrawingId, selectedRevision, searchQuery,
        selectedDiscipline, filteredDrawings, sortedDrawingIds,
        selectedDrawing, currentImage, availableRevisions,
        availableRevisionsInfo, setRevision, selectDrawing,
        isDarkMode, toggleDarkMode, resetZoom,
        scale, position, handleWheel, updateScale // UI 연결을 위한 항목들
    };
}
