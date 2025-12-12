'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Download, Loader2, CheckCircle2, AlertCircle, Copy, Code, Eye, X, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { convertDocxToMarkdown, parseChatToMarkdown, downloadMarkdown } from '@/lib/markdown-converter'
import { downloadFilesAsZip } from '@/lib/excel-converter'
import { Progress } from '@/components/ui/progress'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SaveOptions } from '@/components/save-options'

interface ConvertedFile {
  fileName: string
  markdown: string
  originalFile: File
}

export function MarkdownConverter() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convertedMarkdown, setConvertedMarkdown] = useState<string | null>(null)
  const [sourceFileName, setSourceFileName] = useState<string | null>(null)
  const [chatText, setChatText] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([])
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const MAX_FILES = 10

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const validExtensions = ['.doc', '.docx']
    const invalidFiles = files.filter(
      file => !validExtensions.includes('.' + file.name.split('.').pop()?.toLowerCase())
    )

    if (invalidFiles.length > 0) {
      setError('Word 문서 파일만 업로드 가능합니다 (.doc, .docx)')
      return
    }

    if (files.length > MAX_FILES) {
      setError(`최대 ${MAX_FILES}개까지 선택할 수 있습니다.`)
      return
    }

    // 단일 파일인 경우 기존 방식대로 처리
    if (files.length === 1) {
      const file = files[0]
      setIsLoading(true)
      setError(null)
      setConvertedMarkdown(null)
      setSelectedFiles([])
      setConvertedFiles([])

      try {
        const markdown = await convertDocxToMarkdown(file)
        setConvertedMarkdown(markdown)
        setSourceFileName(file.name.replace(/\.[^/.]+$/, ''))
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
        setConvertedMarkdown(null)
      } finally {
        setIsLoading(false)
      }
    } else {
      // 다중 파일인 경우
      setSelectedFiles(files)
      setConvertedMarkdown(null)
      setSourceFileName(null)
      setConvertedFiles([])
      setError(null)
    }
  }

  const handleBatchConvert = async () => {
    if (selectedFiles.length === 0) return

    setIsLoading(true)
    setError(null)
    setBatchProgress({ current: 0, total: selectedFiles.length })
    const converted: ConvertedFile[] = []
    const errors: string[] = []

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        setBatchProgress({ current: i + 1, total: selectedFiles.length })

        try {
          const markdown = await convertDocxToMarkdown(file)
          converted.push({
            fileName: file.name.replace(/\.[^/.]+$/, ''),
            markdown,
            originalFile: file,
          })
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : '변환 실패'}`)
        }
      }

      setConvertedFiles(converted)
      
      if (errors.length > 0) {
        setError(`일부 파일 변환 실패:\n${errors.join('\n')}`)
      }

      if (converted.length > 0 && converted.length === 1) {
        // 단일 파일만 성공한 경우 기존 방식으로 표시
        setConvertedMarkdown(converted[0].markdown)
        setSourceFileName(converted[0].fileName)
      }
    } catch (err) {
      setError('일괄 변환 중 오류가 발생했습니다: ' + (err as Error).message)
    } finally {
      setIsLoading(false)
      setBatchProgress(null)
    }
  }

  const handleBatchDownload = async () => {
    if (convertedFiles.length === 0) return

    const timestamp = new Date().getTime()
    const folderName = `마크다운변환_${timestamp}`

    const files = convertedFiles.map(file => ({
      name: `${folderName}/${file.fileName}.md`,
      content: file.markdown,
      mimeType: 'text/markdown;charset=utf-8;',
    }))

    await downloadFilesAsZip(files, `마크다운변환_${timestamp}.zip`)
  }

  const removeSelectedFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    if (newFiles.length === 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleChatTextChange = (text: string) => {
    setChatText(text)
    if (text.trim()) {
      try {
        const markdown = parseChatToMarkdown(text)
        setConvertedMarkdown(markdown)
        setSourceFileName(null)
        setError(null)
      } catch (err) {
        setError('텍스트를 변환하는 중 오류가 발생했습니다')
      }
    } else {
      setConvertedMarkdown(null)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setChatText(text)
      if (text.trim()) {
        const markdown = parseChatToMarkdown(text)
        setConvertedMarkdown(markdown)
        setSourceFileName(null)
        setError(null)
      }
    } catch (err) {
      setError('클립보드에서 텍스트를 읽는 중 오류가 발생했습니다')
    }
  }

  const handleDownload = () => {
    if (!convertedMarkdown) return

    const fileName = sourceFileName || `chat_${new Date().getTime()}`
    downloadMarkdown(convertedMarkdown, fileName)
  }

  const handleReset = () => {
    setConvertedMarkdown(null)
    setSourceFileName(null)
    setChatText('')
    setError(null)
    setSelectedFiles([])
    setConvertedFiles([])
    setBatchProgress(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (textareaRef.current) {
      textareaRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Markdown 변환기</h2>
        <p className="text-muted-foreground">
          Word 문서 또는 ChatGPT/Gemini 대화를 Markdown 형식으로 변환하세요
        </p>
      </div>

      {/* 2단 그리드: Word 문서 변환 | 대화 변환 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Word 문서 변환 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              워드문서변환
            </CardTitle>
            <CardDescription>
              Word 문서 파일을 업로드하면 Markdown 형식으로 변환됩니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="doc-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    파일 변환 중...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Word 문서 선택 (최대 {MAX_FILES}개)
                  </>
                )}
              </Button>
              
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    선택된 파일 ({selectedFiles.length}개)
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 flex-shrink-0"
                          onClick={() => removeSelectedFile(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleBatchConvert}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {batchProgress ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        변환 중... ({batchProgress.current}/{batchProgress.total})
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        일괄 변환 시작
                      </>
                    )}
                  </Button>
                  {batchProgress && (
                    <div className="space-y-2">
                      <Progress value={(batchProgress.current / batchProgress.total) * 100} />
                      <div className="text-xs text-muted-foreground text-center">
                        {batchProgress.current} / {batchProgress.total} 파일 변환 중...
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sourceFileName && selectedFiles.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  파일: {sourceFileName}
                </div>
              )}

              {convertedFiles.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-sm font-medium text-green-600">
                    변환 완료 ({convertedFiles.length}개)
                  </div>
                  <Button
                    onClick={handleBatchDownload}
                    className="w-full"
                    variant="default"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    모든 파일 ZIP으로 다운로드
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 대화 변환 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              대화변환
            </CardTitle>
            <CardDescription>
              ChatGPT/Gemini 대화 내용을 복사하여 붙여넣으세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <textarea
                ref={textareaRef}
                placeholder="ChatGPT나 Gemini 대화 내용을 여기에 붙여넣으세요...&#10;&#10;예시:&#10;사용자: 안녕하세요&#10;어시스턴트: 안녕하세요! 무엇을 도와드릴까요?"
                value={chatText}
                onChange={(e) => handleChatTextChange(e.target.value)}
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handlePaste}
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                클립보드에서 붙여넣기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 변환 결과 - 마크다운 소스 & 미리보기 */}
      {convertedMarkdown && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              변환 완료
            </CardTitle>
            <CardDescription>
              마크다운 소스와 렌더링된 결과를 미리볼 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 파일 정보 */}
              <div className="flex items-center justify-between text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <div className="flex gap-4">
                  <div>문자 수: {convertedMarkdown.length.toLocaleString()}자</div>
                  <div>줄 수: {convertedMarkdown.split('\n').length}줄</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownload}
                    size="sm"
                  >
                    <Download className="mr-2 h-3 w-3" />
                    다운로드
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="sm"
                  >
                    새로 변환
                  </Button>
                </div>
              </div>

              {/* 마크다운 소스 & 미리보기 탭 */}
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    마크다운 미리보기
                  </TabsTrigger>
                  <TabsTrigger value="source" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    마크다운 소스
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="preview" className="mt-4">
                  <div className="border rounded-lg p-6 bg-background min-h-[400px] max-h-[600px] overflow-auto">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-6 mb-4 border-b pb-2" {...props} />,
                          h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-5 mb-3 border-b pb-2" {...props} />,
                          h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
                          p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
                          code: ({ node, inline, className, children, ...props }: any) => {
                            if (inline) {
                              return (
                                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                  {children}
                                </code>
                              )
                            }
                            return (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            )
                          },
                          pre: ({ node, children, ...props }: any) => (
                            <pre className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4" {...props}>
                              {children}
                            </pre>
                          ),
                          ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-2" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />,
                          li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                          blockquote: ({ node, ...props }) => (
                            <blockquote className="border-l-4 border-primary pl-4 italic my-4 bg-muted/30 py-2" {...props} />
                          ),
                          a: ({ node, ...props }) => <a className="text-primary hover:underline font-medium" {...props} />,
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-4">
                              <table className="min-w-full border-collapse border border-border" {...props} />
                            </div>
                          ),
                          th: ({ node, ...props }) => <th className="border border-border p-3 bg-muted font-semibold text-left" {...props} />,
                          td: ({ node, ...props }) => <td className="border border-border p-3" {...props} />,
                          hr: ({ node, ...props }) => <hr className="my-6 border-border" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                          em: ({ node, ...props }) => <em className="italic" {...props} />,
                        }}
                      >
                        {convertedMarkdown}
                      </ReactMarkdown>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="source" className="mt-4">
                  <div className="border rounded-lg bg-muted/50">
                    <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                      <span className="text-sm font-medium">마크다운 소스</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(convertedMarkdown)
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        복사
                      </Button>
                    </div>
                    <pre className="p-4 text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-[600px] overflow-y-auto">
                      <code>{convertedMarkdown}</code>
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Obsidian / Notion 저장 옵션 */}
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold mb-3">클라우드 저장</h3>
                <SaveOptions 
                  markdown={convertedMarkdown} 
                  fileName={sourceFileName || `converted_${new Date().getTime()}`} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
