import { ref } from 'vue'

// 1. 메시지 객체에 대한 인터페이스 정의
interface Message {
    role: 'user' | 'ai'; // 역할은 'user' 또는 'ai'로 제한
    text: string;
}

export function useChat() {
    const isChatOpen = ref<boolean>(false)
    const chatInput = ref<string>('')

    // 2. Message 인터페이스를 사용하는 ref 정의
    const messages = ref<Message[]>([
        { role: 'ai', text: '안녕하세요! 도면 분석 전문가 AI입니다. 어떤 정보를 도와드릴까요?' }
    ])

    // 3. 매개변수 타입을 string으로 지정 (선택적일 경우 drawingName?: string)
    const sendMessage = (drawingName: string | undefined): void => {
        if (!chatInput.value.trim()) return

        messages.value.push({ role: 'user', text: chatInput.value })
        chatInput.value = ''

        setTimeout(() => {
            messages.value.push({
                role: 'ai',
                text: `${drawingName || '해당'} 도면의 분석 결과입니다.`
            })
        }, 600)
    }

    return {
        isChatOpen,
        chatInput,
        messages,
        sendMessage
    }
}
