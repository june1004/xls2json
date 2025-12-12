'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, Save, BookOpen, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createNotionPage, saveToObsidian, type NotionConfig } from '@/lib/notion-client'

interface SaveOptionsProps {
  markdown: string
  fileName: string
}

export function SaveOptions({ markdown, fileName }: SaveOptionsProps) {
  const [notionApiKey, setNotionApiKey] = useState('')
  const [notionDatabaseId, setNotionDatabaseId] = useState('')
  const [obsidianVaultPath, setObsidianVaultPath] = useState('')
  const [obsidianConvertHeadings, setObsidianConvertHeadings] = useState(true)
  const [obsidianAutoTags, setObsidianAutoTags] = useState(true)
  const [obsidianAutoLink, setObsidianAutoLink] = useState(false)
  const [isNotionSaving, setIsNotionSaving] = useState(false)
  const [notionError, setNotionError] = useState<string | null>(null)
  const [notionSuccess, setNotionSuccess] = useState<string | null>(null)

  const handleSaveToNotion = async () => {
    if (!notionApiKey.trim()) {
      setNotionError('Notion API 키를 입력해주세요')
      return
    }

    if (!notionDatabaseId.trim()) {
      setNotionError('데이터베이스 ID를 입력해주세요')
      return
    }

    setIsNotionSaving(true)
    setNotionError(null)
    setNotionSuccess(null)

    try {
      const config: NotionConfig = {
        apiKey: notionApiKey,
        databaseId: notionDatabaseId || undefined,
      }

      const pageId = await createNotionPage(config, fileName, markdown)
      setNotionSuccess('Notion 페이지가 성공적으로 생성되었습니다!')
      
      // 로컬 스토리지에 API 키 저장 (선택사항)
      if (typeof window !== 'undefined' && notionApiKey) {
        localStorage.setItem('notion_api_key', notionApiKey)
        if (notionDatabaseId) {
          localStorage.setItem('notion_database_id', notionDatabaseId)
        }
      }

      // Notion 페이지로 이동할 수 있는 링크 제공
      setTimeout(() => {
        window.open(`https://notion.so/${pageId.replace(/-/g, '')}`, '_blank')
      }, 1000)
    } catch (error) {
      setNotionError(error instanceof Error ? error.message : 'Notion 저장 중 오류가 발생했습니다')
    } finally {
      setIsNotionSaving(false)
    }
  }

  const handleSaveToObsidian = async () => {
    await saveToObsidian(markdown, fileName, obsidianVaultPath || undefined, {
      convertHeadingsToLinks: obsidianConvertHeadings,
      autoGenerateTags: obsidianAutoTags,
      autoLinkKeywords: obsidianAutoLink,
    })

    if (typeof window !== 'undefined') {
      if (obsidianVaultPath) {
        localStorage.setItem('obsidian_vault_path', obsidianVaultPath)
      }
      localStorage.setItem('obsidian_convert_headings', String(obsidianConvertHeadings))
      localStorage.setItem('obsidian_auto_tags', String(obsidianAutoTags))
      localStorage.setItem('obsidian_auto_link', String(obsidianAutoLink))
    }
  }

  // 로컬 스토리지에서 저장된 값 불러오기
  useEffect(() => {
    const savedApiKey = localStorage.getItem('notion_api_key')
    const savedDatabaseId = localStorage.getItem('notion_database_id')
    const savedVaultPath = localStorage.getItem('obsidian_vault_path')
    const savedConvertHeadings = localStorage.getItem('obsidian_convert_headings')
    const savedAutoTags = localStorage.getItem('obsidian_auto_tags')
    const savedAutoLink = localStorage.getItem('obsidian_auto_link')
    
    if (savedApiKey) setNotionApiKey(savedApiKey)
    if (savedDatabaseId) setNotionDatabaseId(savedDatabaseId)
    if (savedVaultPath) setObsidianVaultPath(savedVaultPath)
    if (savedConvertHeadings !== null) setObsidianConvertHeadings(savedConvertHeadings === 'true')
    if (savedAutoTags !== null) setObsidianAutoTags(savedAutoTags === 'true')
    if (savedAutoLink !== null) setObsidianAutoLink(savedAutoLink === 'true')
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Obsidian 저장 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Obsidian 저장
          </CardTitle>
          <CardDescription>
            마크다운 파일을 Obsidian vault에 저장하고 토폴로지를 자동 생성합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Vault 경로 (선택사항)
            </label>
            <Input
              placeholder="/Users/username/Documents/Obsidian/MyVault"
              value={obsidianVaultPath}
              onChange={(e) => setObsidianVaultPath(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              지정하면 저장 위치 안내를 받을 수 있습니다
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="text-sm font-medium mb-2">토폴로지 생성 옵션</div>
            
            <div className="flex items-start space-x-3">
              <Checkbox
                id="convert-headings"
                checked={obsidianConvertHeadings}
                onCheckedChange={(checked) => setObsidianConvertHeadings(checked === true)}
              />
              <div className="flex-1">
                <label
                  htmlFor="convert-headings"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  제목을 내부 링크로 변환
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  제목이 [[링크]] 형식으로 변환되어 다른 노트와 연결됩니다
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="auto-tags"
                checked={obsidianAutoTags}
                onCheckedChange={(checked) => setObsidianAutoTags(checked === true)}
              />
              <div className="flex-1">
                <label
                  htmlFor="auto-tags"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  태그 자동 생성
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  제목과 키워드에서 #태그를 자동으로 추출합니다
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="auto-link"
                checked={obsidianAutoLink}
                onCheckedChange={(checked) => setObsidianAutoLink(checked === true)}
              />
              <div className="flex-1">
                <label
                  htmlFor="auto-link"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  키워드 자동 링크 (실험적)
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  중요 키워드를 자동으로 [[내부 링크]]로 변환합니다
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSaveToObsidian}
            variant="outline"
            className="w-full"
          >
            <Save className="mr-2 h-4 w-4" />
            Obsidian으로 저장 (토폴로지 생성)
          </Button>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• 파일이 다운로드됩니다</p>
            <p>• Vault 경로를 지정한 경우 해당 위치로 이동하세요</p>
            <p>• 내부 링크와 태그가 자동으로 생성되어 노트 간 연결이 형성됩니다</p>
          </div>
        </CardContent>
      </Card>

      {/* Notion 저장 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ExternalLink className="h-5 w-5" />
            Notion 저장
          </CardTitle>
          <CardDescription>
            마크다운을 Notion 페이지로 생성합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Notion API 키 <span className="text-destructive">*</span>
            </label>
            <Input
              type="password"
              placeholder="secret_..."
              value={notionApiKey}
              onChange={(e) => setNotionApiKey(e.target.value)}
              className="font-mono text-xs"
            />
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="link" size="sm" className="p-0 h-auto text-xs mt-1">
                  API 키 만드는 방법
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Notion API 키 생성 방법</DialogTitle>
                  <DialogDescription>
                    <ol className="list-decimal list-inside space-y-2 mt-4">
                      <li><a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Notion Integrations 페이지</a>로 이동</li>
                      <li>&quot;+ New integration&quot; 클릭</li>
                      <li>이름을 입력하고 생성</li>
                      <li>생성된 &quot;Internal Integration Token&quot;을 복사</li>
                      <li>데이터베이스를 사용하는 경우, 데이터베이스 페이지에서 &quot;...&quot; → &quot;Connections&quot; → Integration 추가</li>
                      <li>데이터베이스 ID는 URL에서 확인: notion.so/workspace/[DATABASE_ID]</li>
                    </ol>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              데이터베이스 ID <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="32자리 데이터베이스 ID"
              value={notionDatabaseId}
              onChange={(e) => setNotionDatabaseId(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Notion 데이터베이스 URL에서 확인할 수 있습니다
            </p>
          </div>
          
          {notionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-xs text-destructive">{notionError}</p>
            </div>
          )}

          {notionSuccess && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <p className="text-xs text-green-600">{notionSuccess}</p>
            </div>
          )}

          <Button
            onClick={handleSaveToNotion}
            disabled={isNotionSaving || !notionApiKey.trim() || !notionDatabaseId.trim()}
            variant="outline"
            className="w-full"
          >
            {isNotionSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Notion에 저장
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

