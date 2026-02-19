import { ref, computed, onMounted, watch } from 'vue'

interface Revision {
    version: string;
    image: string;
    date?: string;
    description?: string;
    polygon?: any;
    imageTransform?: any;
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
    polygon?: any;
    regions?: {
        [key: string]: {
            polygon?: any;
            revisions?: Revision[];
            imageTransform?: any;
        };
    };
    imageTransform?: any;
}

interface Drawing {
    id: string;
    name: string;
    image: string;
    points?: string;
    position?: any;
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
    const selectedDiscipline = ref<string>('')
    const selectedRegion = ref<string>('') // [추가] 영역 선택 상태

    const isDarkMode = ref(false);
    const isColorCoded = ref(false);
    const isRevisionOverlayVisible = ref(false);
    const isSplitMode = ref(false);
    const splitRatio = ref(0.5);
    const hoveredDrawingId = ref<string | null>(null);
    const pins = ref([]);

    const activeOverlays = ref<Record<string, { active: boolean, opacity: number }>>({});

    watch(selectedDrawingId, () => {
        activeOverlays.value = {};
    });

    watch(selectedDiscipline, (newDisc) => {
        if (activeOverlays.value[newDisc]) {
            activeOverlays.value[newDisc].active = false;
        }
    });

    const toggleOverlay = (disc: string) => {
        if (!activeOverlays.value[disc]) {
            activeOverlays.value[disc] = { active: true, opacity: 0.7 };
        } else {
            activeOverlays.value[disc].active = !activeOverlays.value[disc].active;
        }
    };

    const updateOverlayOpacity = (disc: string, opacity: number) => {
        if (activeOverlays.value[disc]) {
            activeOverlays.value[disc].opacity = opacity;
        }
    };

    const availableOverlayDisciplines = computed(() => {
        const drawing = selectedDrawing.value;
        if (!drawing || !drawing.disciplines) return [];
        return Object.keys(drawing.disciplines).filter(d => d !== selectedDiscipline.value);
    });

    // [추가] 현재 선택된 공종에서 사용 가능한 영역(Region) 목록
    const availableRegions = computed(() => {
        const drawing = selectedDrawing.value;
        if (!drawing || !selectedDiscipline.value) return [];
        const discData = drawing.disciplines?.[selectedDiscipline.value];
        if (!discData || !discData.regions) return [];
        return Object.keys(discData.regions);
    });

    // 배경화면: 영역 선택 시에는 해당 영역의 선택된 리비전 이미지를 메인으로 표시
    const currentImage = computed(() => {
        const drawing = selectedDrawing.value;
        if (!drawing) return null;

        let discData = selectedDiscipline.value ? drawing.disciplines?.[selectedDiscipline.value] : null;

        // [수정] 영역(Region) 선택 시: 해당 영역의 선택된 리비전 이미지를 메인으로 표시하여 도면이 정상 로드되도록 함
        if (selectedRegion.value && discData?.regions?.[selectedRegion.value]) {
            const rData = discData.regions[selectedRegion.value];
            if (selectedRevision.value && selectedRevision.value !== 'Original') {
                const targetRev = rData.revisions?.find(r => r.version === selectedRevision.value);
                if (targetRev?.image) return `/data/drawings/${targetRev.image.normalize('NFC').trim()}`;
            }
            // 영역에서 Original 선택 시 공종 베이스 도면 표시
            return discData.image.normalize('NFC')
                ? `/data/drawings/${discData.image.normalize('NFC').trim()}`
                : `/data/drawings/${drawing.image.normalize('NFC').trim()}`;
        }

        // Region이 없는 일반 도면의 리비전 처리
        if (discData && discData.revisions) {
            const rootRev = discData.revisions.find(r => r.version === selectedRevision.value);
            if (rootRev) return `/data/drawings/${rootRev.image.normalize('NFC').trim()}`;
        }

        // 공종 베이스 이미지. 건축 등 image 없이 revisions만 있으면 도면 기본 이미지로 Original 표시(주민공동시설 건축 4개 파일 등)
        if (discData?.image.normalize('NFC')) return `/data/drawings/${discData.image.normalize('NFC').trim()}`;
        return `/data/drawings/${drawing.image.normalize('NFC').trim()}`;
    });

    // [수정] 영역 선택 시에는 메인 이미지로 해당 영역 리비전을 이미 표시하므로 패치 오버레이는 사용하지 않음
    const activeRevisionPatch = computed(() => {
        const drawing = selectedDrawing.value;
        if (!drawing || !selectedDiscipline.value) return null;
        let discData = drawing.disciplines[selectedDiscipline.value];
        if (!discData) return null;

        const revName = selectedRevision.value;
        if (revName === 'Original') return null;

        // 영역(Region) 선택 시에는 currentImage가 이미 해당 영역 리비전을 표시하므로 패치 제거 → 도면 중복/오표시 방지
        if (selectedRegion.value && discData.regions?.[selectedRegion.value]) return null;
        return null;
    });

    // [수정] 타 공종 오버레이 시, 패치가 있더라도 무조건 베이스 도면을 먼저 깔고 그 위에 얹음
    const renderedOverlays = computed(() => {
        const drawing = selectedDrawing.value;
        if (!drawing || !drawing.disciplines) return [];

        const result = [];
        const baseVersionMatch = selectedRevision.value.match(/^([a-zA-Z0-9]+?)(?:[A-Z])?$/);
        const baseVersion = baseVersionMatch ? baseVersionMatch[1] : selectedRevision.value;

        for (const [disc, state] of Object.entries(activeOverlays.value)) {
            if (state.active && disc !== selectedDiscipline.value) {
                const discData = drawing.disciplines[disc];
                if (discData) {
                    let hasRootRev = false;

                    // 1. 공종 직속 리비전 매칭 (전체 도면)
                    if (discData.revisions) {
                        let rev = discData.revisions.find(r => r.version.startsWith(baseVersion));
                        if (!rev && discData.revisions.length > 0) rev = discData.revisions[discData.revisions.length - 1];
                        if (rev && rev.image.normalize('NFC')) {
                            result.push({
                                id: `over_${disc}_root`,
                                url: `/data/drawings/${rev.image.normalize('NFC').trim()}`,
                                opacity: state.opacity,
                                transform: rev.imageTransform || discData.imageTransform || null,
                                isPatch: false // 전체 도면
                            });
                            hasRootRev = true;
                        }
                    }

                    // 2. 전체 베이스 도면 (패치가 발견되더라도 베이스는 깔아줌)
                    if (!hasRootRev && discData.image.normalize('NFC')) {
                        result.push({
                            id: `over_${disc}_base`,
                            url: `/data/drawings/${discData.image.normalize('NFC').trim()}`,
                            opacity: state.opacity,
                            transform: discData.imageTransform || null,
                            isPatch: false
                        });
                    }

                    // 3. A/B 구역 조각 패치 얹기
                    if (discData.regions) {
                        for (const [rKey, rData] of Object.entries(discData.regions)) {
                            let rev = rData.revisions?.find(r => r.version.startsWith(baseVersion));
                            if (!rev && rData.revisions && rData.revisions.length > 0) rev = rData.revisions[rData.revisions.length - 1];
                            if (rev && rev.image.normalize('NFC')) {
                                result.push({
                                    id: `over_${disc}_${rKey}`,
                                    url: `/data/drawings/${rev.image.normalize('NFC').trim()}`,
                                    opacity: state.opacity,
                                    transform: rev.imageTransform || rData.imageTransform || null,
                                    isPatch: true
                                });
                            }
                        }
                    }
                }
            }
        }
        return result;
    });

    // [수정] 폴리곤 데이터도 선택된 Region을 우선적으로 바라보도록 변경
    const currentPolygon = computed(() => {
        const drawing = selectedDrawing.value;
        if (!drawing || !drawing.disciplines || !selectedDiscipline.value) return null;

        let discData = drawing.disciplines[selectedDiscipline.value];
        if (!discData) return null;

        const currentRevName = selectedRevision.value;

        if (selectedRegion.value && discData.regions && discData.regions[selectedRegion.value]) {
            const rData = discData.regions[selectedRegion.value];
            if (rData.revisions) {
                const targetRev = rData.revisions.find(r => r.version === currentRevName);
                if (targetRev) {
                    let poly = targetRev.polygon || rData.polygon || null;
                    if (poly) {
                        if (targetRev.imageTransform) return { ...poly, polygonTransform: targetRev.imageTransform };
                        return poly;
                    }
                }
            }
        }

        if (discData.revisions) {
            const rootRev = discData.revisions.find(r => r.version === currentRevName);
            if (rootRev) {
                let poly = rootRev.polygon || discData.polygon || null;
                if (poly && rootRev.imageTransform) return { ...poly, polygonTransform: rootRev.imageTransform };
                return poly;
            }
        }

        return discData.polygon || null;
    });

    const addPin = (drawingX: number, drawingY: number) => {
        const newPin = { id: Date.now(), x: drawingX, y: drawingY, type: 'issue', note: '새로운 이슈 기록' };
        pins.value.push(newPin);
    };

    const handlePolygonClick = (id: string) => { selectDrawing(id); };
    const handlePolygonHover = (id: string | null) => { hoveredDrawingId.value = id; };

    const toggleSplitMode = () => {
        isSplitMode.value = !isSplitMode.value;
        if (isSplitMode.value) {
            isCompareMode.value = true;
            overlayOpacity.value = 1;
        }
    };

    const updateSplitRatio = (val: number) => { splitRatio.value = Math.min(Math.max(val, 0), 1); };

    const scale = ref(1);
    const position = ref({ x: 0, y: 0 });
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

    const calculateLabelPos = (pointsStr: string) => {
        if(!pointsStr) return { x: 0, y: 0 };
        const pairs = pointsStr.split(' ').map(p => p.split(',').map(Number));
        const xSum = pairs.reduce((acc, curr) => acc + curr[0], 0);
        const ySum = pairs.reduce((acc, curr) => acc + curr[1], 0);
        return { x: xSum / pairs.length, y: ySum / pairs.length };
    }

    const formatOverviewVertices = (vertices: number[][]) => {
        if (!vertices || !Array.isArray(vertices)) return '';
        return vertices.map(v => `${v[0]},${v[1]}`).join(' ');
    }

    const calculateOverviewLabelPos = (vertices: number[][]) => {
        if (!vertices || !vertices.length) return { x: 0, y: 0 };
        const xSum = vertices.reduce((acc, curr) => acc + curr[0], 0);
        const ySum = vertices.reduce((acc, curr) => acc + curr[1], 0);
        return { x: xSum / vertices.length, y: ySum / vertices.length };
    }

    const setCompareRevision = (rev: string) => { compareRevision.value = rev; };
    const toggleDarkMode = () => { isDarkMode.value = !isDarkMode.value; };

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

        for (const [id, drawing] of Object.entries(data.drawings)) {
            if (drawing.name.toLowerCase().includes(query)) {
                result[id] = drawing;
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

    // 도면에 건축 공종이 없어도 프로젝트에 건축이 있으면 건축을 목록에 포함(주차장 등 도면에서 건축 도면 표시)
    const availableDisciplines = computed(() => {
        const data = metadata.value;
        const drawing = selectedDrawing.value;
        if (!drawing) return [];
        const fromDrawing = drawing.disciplines ? Object.keys(drawing.disciplines) : [];
        const projectDiscs = (data?.disciplines?.map((d: { name: string }) => d.name) ?? []) as string[];
        if (projectDiscs.includes('건축') && !fromDrawing.includes('건축')) {
            return ['건축', ...fromDrawing];
        }
        return fromDrawing;
    });

    // [수정] 선택된 Region에 소속된 리비전만 보여주도록 필터링
    const availableRevisionsInfo = computed<RevisionInfo[]>(() => {
        const drawing = selectedDrawing.value;
        if (!drawing) return [];

        let allRevs: Revision[] = [];
        if (drawing.disciplines && selectedDiscipline.value) {
            const discData = drawing.disciplines[selectedDiscipline.value];
            if (discData) {
                if (selectedRegion.value && discData.regions && discData.regions[selectedRegion.value]) {
                    allRevs = discData.regions[selectedRegion.value].revisions ? [...discData.regions[selectedRegion.value].revisions] : [];
                } else {
                    allRevs = discData.revisions ? [...discData.revisions] : [];
                }
            }
        }

        const info = allRevs.map((r) => ({
            version: r.version,
            image: r.image.normalize('NFC'),
            date: r.date || '날짜 미상',
            description: r.description || '수정 내역이 없습니다.',
            isLatest: false
        }));

        if (!info.some(r => r.version === 'Original')) {
            info.unshift({
                version: 'Original',
                image: drawing.image.normalize('NFC'),
                date: '최초 등록',
                description: '초기 발행 도면입니다.',
                isLatest: false
            });
        }

        if (info.length > 0) info[info.length - 1].isLatest = true;
        return [...info].reverse();
    });

    const availableRevisions = computed(() => availableRevisionsInfo.value.map(r => r.version));

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

    // [수정] 도면 선택 시 Region 정보도 초기화. 건축이 도면에 없어도 프로젝트에 있으면 목록에 포함
    const selectDrawing = (id: string) => {
        selectedDrawingId.value = id;
        isCompareMode.value = false;
        resetZoom();

        const data = metadata.value;
        const drawing = data?.drawings[id];
        if (drawing && (drawing.disciplines || data?.disciplines?.some((d: { name: string }) => d.name === '건축'))) {
            const fromDrawing = drawing.disciplines ? Object.keys(drawing.disciplines) : [];
            const projectDiscs = (data?.disciplines?.map((d: { name: string }) => d.name) ?? []) as string[];
            const availableKeys = projectDiscs.includes('건축') && !fromDrawing.includes('건축')
                ? ['건축', ...fromDrawing]
                : fromDrawing;

            if (availableKeys.length > 0) {
                if (!selectedDiscipline.value || selectedDiscipline.value === '전체' || !availableKeys.includes(selectedDiscipline.value)) {
                    selectedDiscipline.value = availableKeys[0];
                }

                const discData = drawing.disciplines?.[selectedDiscipline.value];

                // Region 초기화 (건축 등 공종 데이터가 없으면 비움)
                if (discData?.regions) {
                    const rKeys = Object.keys(discData.regions);
                    if (rKeys.length > 0) selectedRegion.value = rKeys[0];
                    else selectedRegion.value = '';
                } else {
                    selectedRegion.value = '';
                }

                // Revision 초기화 (해당 Region의 리비전으로, 공종 데이터 없으면 Original)
                let revs: Revision[] = [];
                if (selectedRegion.value && discData?.regions?.[selectedRegion.value]?.revisions) {
                    revs = [...discData.regions[selectedRegion.value].revisions];
                } else if (discData?.revisions) {
                    revs = [...discData.revisions];
                }

                selectedRevision.value = revs.length > 0 ? revs[revs.length - 1].version : 'Original';
            } else {
                selectedDiscipline.value = '';
                selectedRegion.value = '';
                selectedRevision.value = 'Original';
            }
        } else {
            selectedDiscipline.value = '';
            selectedRegion.value = '';
            selectedRevision.value = 'Original';
        }
    };

    // [수정] 중복된 watch(selectedDiscipline) 블록 통합 및 Region 대응
    watch(selectedDiscipline, (newDisc, oldDisc) => {
        if (!newDisc) return;

        const regions = availableRegions.value;
        if (regions.length > 0) {
            // 다른 공종으로 넘어갈 때 같은 Region 이름이 없으면 첫번째 영역 선택
            if (!regions.includes(selectedRegion.value)) {
                selectedRegion.value = regions[0];
            }
        } else {
            selectedRegion.value = '';
        }

        const info = availableRevisionsInfo.value;
        if (info.length > 0) {
            const exists = info.some(r => r.version === selectedRevision.value);
            if (!exists) selectedRevision.value = info[0].version;
        } else {
            selectedRevision.value = 'Original';
        }

        isCompareMode.value = false;
        resetZoom();
    });

    // [추가] 영역(Region) 변경 시 리비전 초기화
    watch(selectedRegion, (newRegion, oldRegion) => {
        if (newRegion === oldRegion) return;
        const info = availableRevisionsInfo.value;
        if (info.length > 0) {
            selectedRevision.value = info[0].version;
        }
        isCompareMode.value = false;
        resetZoom();
    });

    return {
        metadata, selectedDrawingId, selectedRevision, searchQuery,
        selectedDiscipline, availableDisciplines,
        selectedRegion, availableRegions, // [추가] 반환값에 영역 상태 포함
        filteredDrawings, sortedDrawingIds,
        selectedDrawing, currentImage, availableRevisions,
        availableRevisionsInfo, setRevision, selectDrawing,
        isDarkMode, toggleDarkMode, resetZoom,
        scale, position, handleWheel, updateScale,
        isCompareMode, compareRevision, compareImage, isColorCoded, overlayOpacity,
        toggleCompareMode, setCompareRevision,
        isSplitMode, splitRatio, toggleSplitMode, updateSplitRatio,
        hoveredDrawingId, handlePolygonClick, handlePolygonHover,
        pins, addPin, currentPolygon, isRevisionOverlayVisible,
        calculateLabelPos, formatOverviewVertices, calculateOverviewLabelPos,
        activeOverlays, toggleOverlay, updateOverlayOpacity, availableOverlayDisciplines, renderedOverlays, activeRevisionPatch
    };
}
