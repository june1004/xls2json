/**
 * Obsidian 최적화 변환기
 * 마크다운을 Obsidian 토폴로지 형성에 최적화된 형식으로 변환합니다
 */

export interface ObsidianConversionOptions {
  /**
   * 제목을 내부 링크로 변환할지 여부
   */
  convertHeadingsToLinks?: boolean
  /**
   * 자동 태그 생성 여부
   */
  autoGenerateTags?: boolean
  /**
   * 키워드를 자동으로 내부 링크로 변환할지 여부
   */
  autoLinkKeywords?: boolean
  /**
   * frontmatter에 추가할 메타데이터
   */
  metadata?: Record<string, string | string[]>
}

/**
 * 마크다운을 Obsidian 최적화 형식으로 변환
 */
export function convertToObsidianFormat(
  markdown: string,
  options: ObsidianConversionOptions = {}
): string {
  let obsidianMarkdown = markdown

  // 1. Frontmatter 생성
  const frontmatter = generateFrontmatter(markdown, options.metadata || {})
  
  // 2. 제목을 내부 링크로 변환
  if (options.convertHeadingsToLinks !== false) {
    obsidianMarkdown = convertHeadingsToLinks(obsidianMarkdown)
  }

  // 3. 태그 추출 및 추가
  if (options.autoGenerateTags !== false) {
    obsidianMarkdown = addTags(obsidianMarkdown, frontmatter)
  }

  // 4. 키워드를 자동으로 내부 링크로 변환
  if (options.autoLinkKeywords) {
    obsidianMarkdown = autoLinkKeywords(obsidianMarkdown)
  }

  // 5. Frontmatter와 마크다운 결합
  return frontmatter + '\n\n' + obsidianMarkdown
}

/**
 * Frontmatter (YAML) 생성
 */
function generateFrontmatter(
  markdown: string,
  customMetadata: Record<string, string | string[]>
): string {
  const metadata: Record<string, string | string[] | Date> = {
    created: new Date().toISOString(),
    ...customMetadata,
  }

  // 태그가 있으면 추가
  const tags = extractTags(markdown)
  if (tags.length > 0 && !metadata.tags) {
    metadata.tags = tags
  }

  // 제목 추출
  const titleMatch = markdown.match(/^#+\s+(.+)$/m)
  if (titleMatch && !metadata.title) {
    metadata.title = titleMatch[1].trim()
  }

  // YAML 형식으로 변환
  const yamlLines = ['---']
  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      yamlLines.push(`${key}:`)
      value.forEach((item) => {
        yamlLines.push(`  - ${item}`)
      })
    } else if (value instanceof Date) {
      yamlLines.push(`${key}: ${value.toISOString()}`)
    } else {
      yamlLines.push(`${key}: ${value}`)
    }
  }
  yamlLines.push('---')

  return yamlLines.join('\n')
}

/**
 * 제목을 Obsidian 내부 링크로 변환
 * 제목이 여러 번 언급될 때 자동으로 링크 생성
 */
function convertHeadingsToLinks(markdown: string): string {
  // 모든 제목 추출 (H1, H2, H3 등)
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: string[] = []
  let match

  while ((match = headingRegex.exec(markdown)) !== null) {
    const headingText = match[2].trim()
    headings.push(headingText)
  }

  // 제목들을 내부 링크로 변환 (이미 링크가 아닌 경우만)
  let convertedMarkdown = markdown
  headings.forEach((heading) => {
    // 제목 자체는 링크로 변환하지 않음 (원본 유지)
    // 제목이 본문에서 언급될 때만 링크로 변환
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const linkPattern = new RegExp(
      `(?<!\\[\\[)(${escapedHeading})(?!\\]\\])`,
      'gi'
    )
    
    // 이미 링크 안에 있거나 코드 블록 안에 있지 않은 경우만 변환
    convertedMarkdown = convertedMarkdown.replace(
      linkPattern,
      (match, p1, offset, string) => {
        // 코드 블록 내부인지 확인
        const beforeMatch = string.substring(0, offset)
        const codeBlockMatches = beforeMatch.match(/```[\s\S]*?```/g)
        const lastCodeBlockEnd = codeBlockMatches
          ? beforeMatch.lastIndexOf('```')
          : -1
        const isInCodeBlock = lastCodeBlockEnd !== -1 &&
          beforeMatch.substring(lastCodeBlockEnd).includes('```')

        // 이미 링크 내부인지 확인
        const isInLink = /\[\[[^\]]*$/.test(beforeMatch)

        if (!isInCodeBlock && !isInLink && match !== heading) {
          return `[[${p1}]]`
        }
        return match
      }
    )
  })

  return convertedMarkdown
}

/**
 * 태그 추출 및 추가
 */
function extractTags(markdown: string): string[] {
  const tags = new Set<string>()
  
  // 기존 태그 추출 (#태그 형식)
  const tagRegex = /#([a-zA-Z가-힣][a-zA-Z0-9가-힣_-]*)/g
  let match
  while ((match = tagRegex.exec(markdown)) !== null) {
    tags.add(match[1])
  }

  // 제목에서 주요 키워드를 태그로 추가
  const headingRegex = /^#{1,3}\s+(.+)$/gm
  while ((match = headingRegex.exec(markdown)) !== null) {
    const heading = match[1].trim()
    // 간단한 키워드 추출 (2-10자 단어)
    const words = heading
      .split(/[\s\-_,.()]+/)
      .filter((word) => word.length >= 2 && word.length <= 10)
    words.forEach((word) => {
      if (word.length > 1 && !/^\d+$/.test(word)) {
        tags.add(word)
      }
    })
  }

  return Array.from(tags).slice(0, 10) // 최대 10개 태그
}

/**
 * 태그를 frontmatter에 추가하고 마크다운에 표시
 */
function addTags(
  markdown: string,
  frontmatter: string
): string {
  // 이미 태그가 있는 경우 그대로 사용
  if (markdown.includes('#') && /#\w+/.test(markdown)) {
    return markdown
  }

  // 태그가 없으면 제목 기반으로 태그 생성
  const tags = extractTags(markdown)
  if (tags.length > 0 && !markdown.includes('#태그')) {
    // 문서 끝에 태그 섹션 추가
    const tagSection = '\n\n---\n\n' + tags.map((tag) => `#${tag}`).join(' ') + '\n'
    return markdown + tagSection
  }

  return markdown
}

/**
 * 키워드를 자동으로 내부 링크로 변환
 * 제목, 강조된 텍스트, 특정 패턴의 키워드를 감지하여 링크 생성
 */
function autoLinkKeywords(markdown: string): string {
  // 제목 추출
  const headings: string[] = []
  const headingRegex = /^#{1,6}\s+(.+)$/gm
  let match
  while ((match = headingRegex.exec(markdown)) !== null) {
    headings.push(match[1].trim())
  }

  // **볼드** 처리된 텍스트도 링크 후보로 고려
  const boldRegex = /\*\*([^*]+)\*\*/g
  const boldTerms: string[] = []
  while ((match = boldRegex.exec(markdown)) !== null) {
    const term = match[1].trim()
    if (term.length > 1 && term.length < 30) {
      boldTerms.push(term)
    }
  }

  // 모든 키워드 수집
  const keywords = [...new Set([...headings, ...boldTerms])]

  // 키워드를 내부 링크로 변환 (중요 키워드만)
  let convertedMarkdown = markdown
  keywords
    .filter((keyword) => keyword.length >= 2 && keyword.length <= 30)
    .slice(0, 20) // 최대 20개 키워드만 처리
    .forEach((keyword) => {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const linkPattern = new RegExp(
        `(?<!\\[\\[|\\*\\*|#|\\/)(\\b${escapedKeyword}\\b)(?!\\]\\]|\\*\\*|#|\\/)`,
        'gi'
      )

      convertedMarkdown = convertedMarkdown.replace(
        linkPattern,
        (match, p1, offset, string) => {
          // 코드 블록, 링크, 제목 내부가 아닌 경우만 변환
          const beforeMatch = string.substring(0, offset)
          const isInCodeBlock = /```[\s\S]*?```/.test(string)
          const isInLink = /\[\[[^\]]*$/.test(beforeMatch) || /\[.*\]\(/.test(beforeMatch)
          const isInHeading = /^#{1,6}\s/.test(string.substring(Math.max(0, offset - 50), offset))
          const isBold = /\*\*/.test(beforeMatch)

          if (!isInCodeBlock && !isInLink && !isInHeading && !isBold) {
            return `[[${p1}]]`
          }
          return match
        }
      )
    })

  return convertedMarkdown
}

/**
 * Obsidian 저장용 파일명 생성 (안전한 형식)
 */
export function generateObsidianFileName(originalName: string): string {
  // Obsidian 파일명 규칙: 특수문자 제거, 공백은 언더스코어로
  return originalName
    .replace(/[<>:"/\\|?*]/g, '') // Windows/파일시스템 금지 문자 제거
    .replace(/\s+/g, '_') // 공백을 언더스코어로
    .replace(/_+/g, '_') // 연속된 언더스코어를 하나로
    .replace(/^_+|_+$/g, '') // 앞뒤 언더스코어 제거
    .substring(0, 100) // 최대 길이 제한
}

