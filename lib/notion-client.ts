/**
 * Notion API 클라이언트
 * Notion 페이지를 생성하고 업데이트하는 기능 제공
 */

export interface NotionConfig {
  apiKey: string
  databaseId?: string
}

/**
 * Notion에 마크다운 페이지를 생성합니다
 */
export async function createNotionPage(config: NotionConfig, title: string, markdown: string): Promise<string> {
  try {
    if (!config.databaseId) {
      throw new Error('데이터베이스 ID가 필요합니다. Notion에서 데이터베이스를 생성하고 연결해주세요.')
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: {
          database_id: config.databaseId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: title,
                },
              },
            ],
          },
        },
        children: convertMarkdownToNotionBlocks(markdown),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Notion 페이지 생성에 실패했습니다')
    }

    const data = await response.json()
    return data.id
  } catch (error) {
    throw new Error('Notion API 오류: ' + (error as Error).message)
  }
}

/**
 * 마크다운을 Notion 블록 형식으로 변환합니다
 */
function convertMarkdownToNotionBlocks(markdown: string): any[] {
  const lines = markdown.split('\n')
  const blocks: any[] = []
  let currentParagraph: string[] = []
  let currentCodeBlock: string[] = []
  let inCodeBlock = false
  let codeLanguage = ''

  for (const line of lines) {
    // 코드 블록 처리
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // 코드 블록 종료
        if (currentCodeBlock.length > 0) {
          blocks.push({
            type: 'code',
            code: {
              language: codeLanguage,
              rich_text: [
                {
                  type: 'text',
                  text: { content: currentCodeBlock.join('\n') },
                },
              ],
            },
          })
        }
        currentCodeBlock = []
        inCodeBlock = false
        codeLanguage = ''
      } else {
        // 코드 블록 시작
        codeLanguage = line.slice(3).trim() || 'plain text'
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      currentCodeBlock.push(line)
      continue
    }

    // 제목 처리
    if (line.startsWith('# ')) {
      if (currentParagraph.length > 0) {
        blocks.push(createParagraphBlock(currentParagraph.join('\n')))
        currentParagraph = []
      }
      blocks.push({
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: line.slice(2).trim() } }],
        },
      })
      continue
    }
    if (line.startsWith('## ')) {
      if (currentParagraph.length > 0) {
        blocks.push(createParagraphBlock(currentParagraph.join('\n')))
        currentParagraph = []
      }
      blocks.push({
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: line.slice(3).trim() } }],
        },
      })
      continue
    }
    if (line.startsWith('### ')) {
      if (currentParagraph.length > 0) {
        blocks.push(createParagraphBlock(currentParagraph.join('\n')))
        currentParagraph = []
      }
      blocks.push({
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: line.slice(4).trim() } }],
        },
      })
      continue
    }

    // 리스트 처리
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (currentParagraph.length > 0) {
        blocks.push(createParagraphBlock(currentParagraph.join('\n')))
        currentParagraph = []
      }
      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: parseRichText(line.slice(2).trim()),
        },
      })
      continue
    }

    // 빈 줄 처리
    if (line.trim() === '') {
      if (currentParagraph.length > 0) {
        blocks.push(createParagraphBlock(currentParagraph.join('\n')))
        currentParagraph = []
      }
      continue
    }

    currentParagraph.push(line)
  }

  // 남은 문단 처리
  if (currentParagraph.length > 0) {
    blocks.push(createParagraphBlock(currentParagraph.join('\n')))
  }

  return blocks
}

/**
 * 문단 블록 생성
 */
function createParagraphBlock(text: string): any {
  return {
    type: 'paragraph',
    paragraph: {
      rich_text: parseRichText(text),
    },
  }
}

/**
 * 마크다운 텍스트를 Notion rich_text 형식으로 변환
 * 간단한 버전 - **bold**, *italic*, 링크 처리
 */
function parseRichText(text: string): any[] {
  const richText: any[] = []
  let currentText = text
  let index = 0

  // **bold** 처리
  currentText = currentText.replace(/\*\*(.+?)\*\*/g, (match, content) => {
    return `__BOLD_START__${content}__BOLD_END__`
  })

  // *italic* 처리
  currentText = currentText.replace(/\*(.+?)\*/g, (match, content) => {
    return `__ITALIC_START__${content}__ITALIC_END__`
  })

  // 링크 처리 [text](url)
  currentText = currentText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    return `__LINK_START__${text}__LINK_SEP__${url}__LINK_END__`
  })

  // 간단한 구현: 정규식으로 분리하지 않고 전체 텍스트를 하나의 텍스트로 처리
  // 향후 더 복잡한 포맷팅이 필요하면 개선 가능
  richText.push({
    type: 'text',
    text: { content: text },
  })

  return richText.length > 0 ? richText : [{ type: 'text', text: { content: text } }]
}

/**
 * Obsidian vault에 파일 저장 (로컬 다운로드)
 * 토폴로지 생성을 위한 최적화된 형식으로 변환
 */
export async function saveToObsidian(
  markdown: string,
  fileName: string,
  vaultPath?: string,
  options?: {
    convertHeadingsToLinks?: boolean
    autoGenerateTags?: boolean
    autoLinkKeywords?: boolean
  }
) {
  // Obsidian 최적화 변환 적용 (동적 import)
  const { convertToObsidianFormat, generateObsidianFileName } = await import('./obsidian-converter')
  const obsidianMarkdown = convertToObsidianFormat(markdown, {
    convertHeadingsToLinks: options?.convertHeadingsToLinks ?? true,
    autoGenerateTags: options?.autoGenerateTags ?? true,
    autoLinkKeywords: options?.autoLinkKeywords ?? false,
  })

  const safeFileName = generateObsidianFileName(fileName)

  if (vaultPath) {
    // 사용자가 지정한 vault 경로가 있으면 안내 메시지 표시
    const features = []
    if (options?.convertHeadingsToLinks !== false) features.push('내부 링크 자동 생성')
    if (options?.autoGenerateTags !== false) features.push('태그 자동 추출')
    if (options?.autoLinkKeywords) features.push('키워드 자동 링크')
    features.push('Frontmatter 추가')
    features.push('토폴로지 연결 최적화')

    alert(
      `파일을 다음 경로에 저장하세요: ${vaultPath}/${safeFileName}.md\n\n` +
      `브라우저 보안상 직접 저장할 수 없으므로 다운로드된 파일을 해당 위치로 이동해주세요.\n\n` +
      `✅ Obsidian 최적화 기능이 적용되었습니다:\n` +
      features.map(f => `  • ${f}`).join('\n')
    )
  }

  // 기본적으로 다운로드 제공
  const blob = new Blob([obsidianMarkdown], {
    type: 'text/markdown;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFileName}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

