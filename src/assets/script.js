import { ref, onMounted, onUnmounted } from 'vue'

export function useDropdown() {
    const isOpen = ref(false)

    const toggle = () => {
        isOpen.value = !isOpen.value
    }

    const close = () => {
        isOpen.value = false
    }

    const handleOutsideClick = (event) => {
        // dropdown-container 클래스를 가진 요소 외부 클릭 시 닫기
        if (isOpen.value && !event.target.closest('.dropdown-container')) {
            close()
        }
    }

    onMounted(() => {
        window.addEventListener('click', handleOutsideClick)
    })

    onUnmounted(() => {
        window.removeEventListener('click', handleOutsideClick)
    })

    return {
        isOpen,
        toggle,
        close
    }
}
