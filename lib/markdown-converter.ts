// 클라이언트 사이드에서만 사용되는 함수들
// 브라우저 API (FileReader, Blob 등)를 사용합니다

/**
 * DOCX 파일을 마크다운으로 변환합니다
 * @param file - 업로드된 DOCX 파일
 * @returns 마크다운 문자열
 */
export async function convertDocxToMarkdown(file: File): Promise<string> {
  // File API는 브라우저에서만 사용 가능
  if (typeof window === 'undefined') {
    throw new Error('이 함수는 브라우저에서만 사용할 수 있습니다')
  }
  return new Promise(async (resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        // 동적 import로 클라이언트 사이드에서만 로드
        const mammoth = (await import('mammoth')).default
        const TurndownService = (await import('turndown')).default
        
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
        })

        const arrayBuffer = e.target?.result as ArrayBuffer
        const result = await mammoth.convertToHtml({ arrayBuffer })
        const html = result.value
        
        // HTML을 마크다운으로 변환
        const markdown = turndownService.turndown(html)
        resolve(markdown)
      } catch (error) {
        reject(new Error('DOCX 파일을 변환하는 중 오류가 발생했습니다: ' + (error as Error).message))
      }
    }

    reader.onerror = () => {
      reject(new Error('파일을 읽는 중 오류가 발생했습니다'))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * ChatGPT/Gemini 대화 형식을 파싱하여 마크다운으로 변환합니다
 */
export function parseChatToMarkdown(text: string): string {
  let markdown = text

  // ChatGPT/Gemini 대화 형식 패턴들
  // 예: "User: ..." 또는 "Assistant: ..."
  // 또는 "사용자: ..." / "어시스턴트: ..."
  
  // 1. 사용자/어시스턴트 역할 구분
  markdown = markdown.replace(/^([가-힣\w\s]+):\s*(.+)$/gim, (match, role, content) => {
    const normalizedRole = role.trim().toLowerCase()
    
    // 역할에 따라 마크다운 형식 변환
    if (normalizedRole.includes('user') || normalizedRole.includes('사용자')) {
      return `**사용자**: ${content.trim()}`
    } else if (normalizedRole.includes('assistant') || normalizedRole.includes('어시스턴트') || normalizedRole.includes('gpt') || normalizedRole.includes('gemini')) {
      return `**어시스턴트**: ${content.trim()}`
    } else if (normalizedRole.includes('system') || normalizedRole.includes('시스템')) {
      return `*[시스템]: ${content.trim()}*`
    }
    
    return `**${role.trim()}**: ${content.trim()}`
  })

  // 2. 코드 블록 자동 감지 (```로 시작하지 않은 코드)
  markdown = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, '```$1\n$2```')
  
  // 3. 여러 줄의 코드 블록 패턴 감지
  const codeBlockPattern = /(?:^|\n)((?:  |\t).{4,})/gm
  markdown = markdown.replace(codeBlockPattern, (match, code) => {
    if (!code.trim()) return match
    // 이미 코드 블록 안에 있지 않은 경우만 변환
    if (!match.includes('```')) {
      return '\n```\n' + code.trimEnd() + '\n```'
    }
    return match
  })

  // 4. URL 자동 링크 변환
  markdown = markdown.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)')

  // 5. 불필요한 빈 줄 제거 (3개 이상 → 2개)
  markdown = markdown.replace(/\n{3,}/g, '\n\n')

  return markdown.trim()
}

/**
 * 텍스트를 마크다운 파일로 다운로드합니다
 * @param content - 마크다운 내용
 * @param fileName - 파일명
 */
export function downloadMarkdown(content: string, fileName: string) {
  // 브라우저에서만 실행 가능
  if (typeof window === 'undefined') {
    throw new Error('이 함수는 브라우저에서만 사용할 수 있습니다')
  }
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.md') ? fileName : `${fileName}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

