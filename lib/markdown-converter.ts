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
        let markdown = turndownService.turndown(html)
        
        // 마크다운 정리 함수 적용
        markdown = cleanMarkdown(markdown)
        
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
 * 마크다운 텍스트를 정리하고 표준 마크다운 문법에 맞게 변환합니다
 * - **로 감싸진 내용은 볼드 처리 (마크다운 문법 유지)
 * - 불필요한 공백 제거
 * - 중복된 마크다운 문법 정리
 * - 표준 마크다운 문법 준수
 */
export function cleanMarkdown(markdown: string): string {
  let cleaned = markdown

  // 코드 블록 내부는 보호하기 위해 임시로 치환
  const codeBlocks: string[] = []
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
    codeBlocks.push(match)
    return placeholder
  })

  // 인라인 코드 내부도 보호
  const inlineCodes: string[] = []
  cleaned = cleaned.replace(/`[^`]+`/g, (match) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`
    inlineCodes.push(match)
    return placeholder
  })

  // 1. 볼드 처리 정리: **텍스트** 형식 정리
  // 먼저 중복된 ** 제거 (예: ****텍스트**** → **텍스트**)
  cleaned = cleaned.replace(/\*{4,}([^*\n]+?)\*{4,}/g, '**$1**')
  cleaned = cleaned.replace(/\*{3}([^*\n]+?)\*{3}/g, '**$1**')
  
  // 공백이 포함된 ** 제거 (예: ** 텍스트 ** → **텍스트**)
  cleaned = cleaned.replace(/\*\*\s+([^*\n]+?)\s+\*\*/g, '**$1**')
  
  // 단일 *로 시작해서 **로 끝나는 경우 정리
  cleaned = cleaned.replace(/\*\s+([^*\n]+?)\s+\*\*/g, '**$1**')
  cleaned = cleaned.replace(/\*\*\s+([^*\n]+?)\s+\*/g, '**$1**')
  
  // **로 감싸진 내용의 앞뒤 공백 제거 (예: ** 텍스트** → **텍스트**)
  cleaned = cleaned.replace(/\*\*\s*([^*\n]+?)\s*\*\*/g, (match, content) => {
    return `**${content.trim()}**`
  })

  // 2. 이탤릭 처리 정리: *텍스트* 또는 _텍스트_ 형식 정리
  // 볼드가 아닌 단일 * 또는 _ 정리 (lookbehind/lookahead 대신 더 안전한 방법 사용)
  // 단일 *로 감싸진 텍스트 (볼드가 아닌 경우)
  cleaned = cleaned.replace(/(^|[^*])\*([^*\n]+?)\*([^*]|$)/g, (match, before, content, after) => {
    // 이미 볼드 처리된 부분이 아닌 경우만 이탤릭으로 처리
    if (before !== '*' && after !== '*') {
      return `${before}*${content.trim()}*${after}`
    }
    return match
  })
  
  // 단일 _로 감싸진 텍스트
  cleaned = cleaned.replace(/(^|[^_])_([^_\n]+?)_([^_]|$)/g, (match, before, content, after) => {
    if (before !== '_' && after !== '_') {
      return `${before}_${content.trim()}_${after}`
    }
    return match
  })

  // 3. 헤더 정리: # 앞뒤 공백 제거
  cleaned = cleaned.replace(/^\s*(#{1,6})\s+(.+?)\s*$/gm, '$1 $2')

  // 4. 리스트 정리: 불필요한 공백 제거
  cleaned = cleaned.replace(/^(\s*[-*+]|\s*\d+\.)\s+/gm, '$1 ')

  // 5. 링크 정리: [텍스트](URL) 형식 정리
  cleaned = cleaned.replace(/\[\s*([^\]]+?)\s*\]\s*\(\s*([^)]+?)\s*\)/g, '[$1]($2)')

  // 6. 이미지 정리: ![alt](url) 형식 정리
  cleaned = cleaned.replace(/!\[\s*([^\]]*?)\s*\]\s*\(\s*([^)]+?)\s*\)/g, '![$1]($2)')

  // 7. 인용구 정리: > 앞뒤 공백 제거
  cleaned = cleaned.replace(/^\s*>\s+/gm, '> ')

  // 8. 수평선 정리: ---, ***, ___ 정리
  cleaned = cleaned.replace(/^(\s*[-*_]{3,})\s*$/gm, '---')

  // 9. 강조 표시 정리: ~~취소선~~ 형식 정리
  cleaned = cleaned.replace(/~~\s*([^~\n]+?)\s*~~/g, '~~$1~~')

  // 10. 불필요한 공백 제거 (줄 끝 공백)
  cleaned = cleaned.replace(/[ \t]+$/gm, '')

  // 11. 빈 줄 정리 (3개 이상 → 2개)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  
  // 12. 코드 블록 앞뒤 빈 줄 정리
  cleaned = cleaned.replace(/\n{2,}```/g, '\n\n```')
  cleaned = cleaned.replace(/```\n{2,}/g, '```\n\n')
  
  // 13. 리스트 항목 사이 일관된 간격 유지
  cleaned = cleaned.replace(/(\n[-*+]\s+[^\n]+)\n{2,}([-*+]\s+)/g, '$1\n$2')
  cleaned = cleaned.replace(/(\n\d+\.\s+[^\n]+)\n{2,}(\d+\.\s+)/g, '$1\n$2')

  // 코드 블록 복원
  codeBlocks.forEach((block, index) => {
    cleaned = cleaned.replace(`__CODE_BLOCK_${index}__`, block)
  })

  // 인라인 코드 복원
  inlineCodes.forEach((code, index) => {
    cleaned = cleaned.replace(`__INLINE_CODE_${index}__`, code)
  })

  return cleaned.trim()
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

  // 5. 마크다운 정리 함수 적용
  markdown = cleanMarkdown(markdown)

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

/**
 * 마크다운을 Word 문서(.docx)로 다운로드합니다
 * @param markdown - 마크다운 내용
 * @param fileName - 파일명
 */
export async function downloadAsWord(markdown: string, fileName: string) {
  if (typeof window === 'undefined') {
    throw new Error('이 함수는 브라우저에서만 사용할 수 있습니다')
  }

  try {
    // 동적 import로 클라이언트 사이드에서만 로드
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
    
    // 마크다운을 파싱하여 Word 문서 구조 생성
    const paragraphs: any[] = []
    const lines = markdown.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()
      
      // 빈 줄 처리
      if (!trimmedLine) {
        paragraphs.push(new Paragraph({ text: '' }))
        continue
      }
      
      // 코드 블록 처리
      if (trimmedLine.startsWith('```')) {
        const language = trimmedLine.replace(/```/, '').trim()
        const codeLines: string[] = []
        i++
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i])
          i++
        }
        const codeText = codeLines.join('\n')
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeText,
                font: 'Courier New',
              }),
            ],
            spacing: { after: 200 },
          })
        )
        continue
      }
      
      // 헤더 처리
      if (trimmedLine.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmedLine.replace(/^#\s+/, ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
          })
        )
      } else if (trimmedLine.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmedLine.replace(/^##\s+/, ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        )
      } else if (trimmedLine.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmedLine.replace(/^###\s+/, ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 150, after: 100 },
          })
        )
      } else if (trimmedLine.startsWith('#### ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmedLine.replace(/^####\s+/, ''),
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 100, after: 50 },
          })
        )
      } else if (trimmedLine.startsWith('##### ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmedLine.replace(/^#####\s+/, ''),
            heading: HeadingLevel.HEADING_5,
            spacing: { before: 100, after: 50 },
          })
        )
      } else if (trimmedLine.startsWith('###### ')) {
        paragraphs.push(
          new Paragraph({
            text: trimmedLine.replace(/^######\s+/, ''),
            heading: HeadingLevel.HEADING_6,
            spacing: { before: 100, after: 50 },
          })
        )
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('+ ')) {
        // 리스트 항목 처리
        const listText = trimmedLine.replace(/^[-*+]\s+/, '')
        const runs = await parseInlineFormatting(listText)
        paragraphs.push(
          new Paragraph({
            children: runs,
            bullet: { level: 0 },
            spacing: { after: 50 },
          })
        )
      } else if (/^\d+\.\s+/.test(trimmedLine)) {
        // 번호 리스트 처리
        const listText = trimmedLine.replace(/^\d+\.\s+/, '')
        const runs = await parseInlineFormatting(listText)
        paragraphs.push(
          new Paragraph({
            children: runs,
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { after: 50 },
          })
        )
      } else {
        // 일반 텍스트 처리 (볼드, 이탤릭 등)
        const runs = await parseInlineFormatting(trimmedLine)
        paragraphs.push(
          new Paragraph({
            children: runs,
            spacing: { after: 100 },
          })
        )
      }
    }
    
    const docx = new Document({
      sections: [
        {
          children: paragraphs,
        },
      ],
    })
    
    const blob = await Packer.toBlob(docx)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    throw new Error('Word 문서 생성 중 오류가 발생했습니다: ' + (error as Error).message)
  }
}

/**
 * 인라인 포맷팅(볼드, 이탤릭 등)을 파싱하여 TextRun 배열로 변환
 */
async function parseInlineFormatting(text: string): Promise<any[]> {
  const { TextRun } = await import('docx')
  const runs: any[] = []
  let currentIndex = 0
  
  // **볼드** 처리
  const boldRegex = /\*\*([^*]+?)\*\*/g
  const italicRegex = /\*([^*]+?)\*/g
  const codeRegex = /`([^`]+?)`/g
  
  // 모든 매치 찾기
  const matches: Array<{ index: number; length: number; type: 'bold' | 'italic' | 'code'; text: string }> = []
  
  let match
  while ((match = boldRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'bold',
      text: match[1],
    })
  }
  
  while ((match = italicRegex.exec(text)) !== null) {
    // 볼드가 아닌 경우만 이탤릭으로 처리
    const isBold = matches.some(m => 
      m.index <= match!.index && match!.index < m.index + m.length
    )
    if (!isBold) {
      matches.push({
        index: match.index,
        length: match[0].length,
        type: 'italic',
        text: match[1],
      })
    }
  }
  
  while ((match = codeRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'code',
      text: match[1],
    })
  }
  
  // 인덱스 순으로 정렬
  matches.sort((a, b) => a.index - b.index)
  
  // 겹치는 부분 제거 및 텍스트 생성
  let lastEnd = 0
  for (const m of matches) {
    if (m.index > lastEnd) {
      // 매치 전의 일반 텍스트
      runs.push(new TextRun(text.substring(lastEnd, m.index)))
    }
    
    // 포맷팅된 텍스트
    if (m.type === 'bold') {
      runs.push(new TextRun({ text: m.text, bold: true }))
    } else if (m.type === 'italic') {
      runs.push(new TextRun({ text: m.text, italics: true }))
    } else if (m.type === 'code') {
      runs.push(new TextRun({ text: m.text, font: 'Courier New' }))
    }
    
    lastEnd = m.index + m.length
  }
  
  // 남은 텍스트
  if (lastEnd < text.length) {
    runs.push(new TextRun(text.substring(lastEnd)))
  }
  
  // 매치가 없으면 전체 텍스트 반환
  if (runs.length === 0) {
    runs.push(new TextRun(text))
  }
  
  return runs
}

/**
 * 마크다운 미리보기를 PDF로 다운로드합니다
 * @param markdown - 마크다운 내용
 * @param fileName - 파일명
 * @param previewElementId - 미리보기 요소의 ID (선택사항)
 */
export async function downloadAsPDF(markdown: string, fileName: string, previewElementId?: string) {
  if (typeof window === 'undefined') {
    throw new Error('이 함수는 브라우저에서만 사용할 수 있습니다')
  }

  try {
    // 동적 import로 클라이언트 사이드에서만 로드
    const jsPDF = (await import('jspdf')).default
    const html2canvas = (await import('html2canvas')).default
    
    // 미리보기 요소 찾기
    let element: HTMLElement | null = null
    
    if (previewElementId) {
      element = document.getElementById(previewElementId)
      // ID로 찾지 못하면 ref로 찾기 시도
      if (!element) {
        // 클래스나 다른 방법으로 찾기
        const elements = document.querySelectorAll('[id*="markdown-preview"], .prose')
        if (elements.length > 0) {
          element = elements[0] as HTMLElement
        }
      }
    }
    
    // 미리보기 요소가 없으면 임시 요소 생성
    if (!element) {
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'absolute'
      tempContainer.style.left = '-9999px'
      tempContainer.style.width = '800px'
      tempContainer.style.padding = '40px'
      tempContainer.style.backgroundColor = '#ffffff'
      tempContainer.style.color = '#000000'
      tempContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif'
      tempContainer.style.fontSize = '14px'
      tempContainer.style.lineHeight = '1.6'
      
      // 마크다운을 간단한 HTML로 변환
      let html = markdown
        .replace(/^# (.*$)/gim, '<h1 style="font-size: 2em; font-weight: bold; margin: 0.67em 0;">$1</h1>')
        .replace(/^## (.*$)/gim, '<h2 style="font-size: 1.5em; font-weight: bold; margin: 0.75em 0;">$1</h2>')
        .replace(/^### (.*$)/gim, '<h3 style="font-size: 1.17em; font-weight: bold; margin: 0.83em 0;">$1</h3>')
        .replace(/^#### (.*$)/gim, '<h4 style="font-size: 1em; font-weight: bold; margin: 1.12em 0;">$1</h4>')
        .replace(/^##### (.*$)/gim, '<h5 style="font-size: 0.83em; font-weight: bold; margin: 1.5em 0;">$1</h5>')
        .replace(/^###### (.*$)/gim, '<h6 style="font-size: 0.67em; font-weight: bold; margin: 1.67em 0;">$1</h6>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/`([^`]+?)`/gim, '<code style="background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>')
        .replace(/```([\s\S]*?)```/gim, '<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto;"><code style="font-family: monospace;">$1</code></pre>')
        .replace(/\n\n/gim, '</p><p style="margin: 1em 0;">')
        .replace(/\n/gim, '<br>')
      
      tempContainer.innerHTML = `<div style="max-width: 100%;">${html}</div>`
      document.body.appendChild(tempContainer)
      element = tempContainer
      
      // 렌더링 대기
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    // 요소를 캔버스로 변환
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
    })
    
    const imgData = canvas.toDataURL('image/png', 1.0)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })
    
    const imgWidth = 210 // A4 너비 (mm)
    const pageHeight = 297 // A4 높이 (mm)
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight
    let position = 0
    
    // 첫 페이지 추가
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    
    // 여러 페이지 처리
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }
    
    // 임시 요소 제거
    if (element && (!previewElementId || element.id !== previewElementId)) {
      document.body.removeChild(element)
    }
    
    // PDF 다운로드
    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
  } catch (error) {
    throw new Error('PDF 생성 중 오류가 발생했습니다: ' + (error as Error).message)
  }
}

