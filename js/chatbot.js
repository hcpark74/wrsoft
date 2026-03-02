import Chatbot from "https://cdn.jsdelivr.net/npm/flowise-embed@1.3.14/dist/web.js"

Chatbot.init({
    chatflowid: "aa3e89a1-00ad-4360-aa41-400d7cefc7a3",
    apiHost: "http://127.0.0.1:3000", // 로컬 개발 환경
    // apiHost: "https://your-flowise-domain.com", // 배포 환경에서는 실제 도메인으로 변경
    theme: {
        button: {
            backgroundColor: "#0066cc",
            right: 20,
            bottom: 20,
            size: 60,
            iconColor: "white",
        },
        chatWindow: {
            welcomeMessage: "안녕하세요! 우리소프트 AI 어시스턴트입니다. 무엇을 도와드릴까요?",
            backgroundColor: "#ffffff",
            height: 600,
            width: 400,
            fontSize: 16,
            poweredByTextColor: "#303235",
            botMessage: {
                backgroundColor: "#f7f8ff",
                textColor: "#303235",
                showAvatar: true,
                avatarSrc: "/images/logo.png", // 회사 로고로 변경 가능
            },
            userMessage: {
                backgroundColor: "#0066cc",
                textColor: "#ffffff",
                showAvatar: true,
            },
            textInput: {
                placeholder: "메시지를 입력하세요...",
                backgroundColor: "#ffffff",
                textColor: "#303235",
                sendButtonColor: "#0066cc",
            }
        }
    }
})
