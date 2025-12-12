'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExcelConverter } from '@/components/excel-converter'
import { MarkdownConverter } from '@/components/markdown-converter'
import { FileSpreadsheet, FileCode } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">파일 변환 도구</h1>
          <p className="text-muted-foreground">
            다양한 파일 형식을 원하는 형식으로 변환하세요
          </p>
        </div>

        <Tabs defaultValue="excel" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="excel" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel 변환기
            </TabsTrigger>
            <TabsTrigger value="markdown" className="flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              Markdown 변환기
            </TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="mt-6">
            <ExcelConverter />
          </TabsContent>

          <TabsContent value="markdown" className="mt-6">
            <MarkdownConverter />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
