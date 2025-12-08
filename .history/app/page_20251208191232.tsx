'use client'

import { useState, useRef, useMemo } from 'react'
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle, Eye, ChevronLeft, ChevronRight, FileText, Info, Search, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { analyzeExcel, convertSheetToCSV, convertSheetToJSON, downloadFilesAsZip, downloadFile, formatFileSize, type ExcelData } from '@/lib/excel-converter'

const ITEMS_PER_PAGE = 5 // 페이지당 표시할 시트 수
const PREVIEW_ROWS = 10 // 미리보기 표시할 행 수

export default function Home() {
  const [excelData, setExcelData] = useState<ExcelData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>('csv')
  const [currentPage, setCurrentPage] = useState(1)
  const [previewSheetIndex, setPreviewSheetIndex] = useState<number | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'rowCount' | 'columnCount' | 'nonEmptyRowsCount'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Excel 파일 확장자 확인
    const validExtensions = ['.xlsx', '.xls', '.xlsm']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Excel 파일만 업로드 가능합니다 (.xlsx, .xls, .xlsm)')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await analyzeExcel(file)
      setExcelData(data)
      setCurrentPage(1)
      setPreviewSheetIndex(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
      setExcelData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (sheetName: string, format: 'csv' | 'json') => {
    if (!excelData) return

    const baseFileName = excelData.fileName.replace(/\.[^/.]+$/, '')
    const safeSheetName = sheetName.replace(/[^a-zA-Z0-9가-힣]/g, '_')
    const timestamp = new Date().getTime()
    const folderName = `${baseFileName}_변환파일_${timestamp}`
    
    let content: string
    let fileName: string
    let mimeType: string

    if (format === 'csv') {
      content = convertSheetToCSV(excelData.workbook, sheetName)
      fileName = `${folderName}/${baseFileName}_${safeSheetName}.csv`
      mimeType = 'text/csv;charset=utf-8;'
    } else {
      content = convertSheetToJSON(excelData.workbook, sheetName)
      fileName = `${folderName}/${baseFileName}_${safeSheetName}.json`
      mimeType = 'application/json;charset=utf-8;'
    }

    // 단일 파일도 ZIP으로 압축하여 폴더 구조 유지
    await downloadFilesAsZip(
      [{ name: fileName, content, mimeType }],
      `${baseFileName}_${safeSheetName}_${timestamp}.zip`
    )
  }

  const handleDownloadAll = async () => {
    if (!excelData) return

    setDownloadProgress({ current: 0, total: excelData.sheets.length })

    try {
      const baseFileName = excelData.fileName.replace(/\.[^/.]+$/, '')
      const timestamp = new Date().getTime()
      const folderName = `${baseFileName}_변환파일_${timestamp}`

      const files: Array<{ name: string; content: string; mimeType: string }> = []

      for (let i = 0; i < excelData.sheets.length; i++) {
        const sheet = excelData.sheets[i]
        const safeSheetName = sheet.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')
        
        let content: string
        let fileName: string
        let mimeType: string

        if (selectedFormat === 'csv') {
          content = convertSheetToCSV(excelData.workbook, sheet.name)
          fileName = `${folderName}/${baseFileName}_${safeSheetName}.csv`
          mimeType = 'text/csv;charset=utf-8;'
        } else {
          content = convertSheetToJSON(excelData.workbook, sheet.name)
          fileName = `${folderName}/${baseFileName}_${safeSheetName}.json`
          mimeType = 'application/json;charset=utf-8;'
        }

        files.push({ name: fileName, content, mimeType })
        setDownloadProgress({ current: i + 1, total: excelData.sheets.length })
      }

      // 모든 파일을 ZIP으로 압축하여 다운로드
      await downloadFilesAsZip(files, `${baseFileName}_${selectedFormat.toUpperCase()}_${timestamp}.zip`)
      
      setDownloadProgress(null)
    } catch (error) {
      setError('다운로드 중 오류가 발생했습니다: ' + (error as Error).message)
      setDownloadProgress(null)
    }
  }

  const handleReset = () => {
    setExcelData(null)
    setError(null)
    setCurrentPage(1)
    setPreviewSheetIndex(null)
    setDownloadProgress(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 검색 및 정렬 로직
  const filteredAndSortedSheets = useMemo(() => {
    if (!excelData) return []

    // 1. 검색 필터링
    let filtered = excelData.sheets.filter(sheet =>
      sheet.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // 2. 정렬
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'rowCount':
          aValue = a.rowCount
          bValue = b.rowCount
          break
        case 'columnCount':
          aValue = a.columnCount
          bValue = b.columnCount
          break
        case 'nonEmptyRowsCount':
          aValue = a.nonEmptyRowsCount ?? 0
          bValue = b.nonEmptyRowsCount ?? 0
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [excelData, searchQuery, sortBy, sortOrder])

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredAndSortedSheets.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentSheets = filteredAndSortedSheets.slice(startIndex, endIndex)

  // 변환 가능한 시트 개수 (빈 시트가 아닌 것들)
  const convertibleSheetsCount = excelData?.sheets.filter(sheet => sheet.rowCount > 0).length || 0

  // 검색어나 정렬이 변경되면 첫 페이지로 이동
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleSortChange = (value: string) => {
    if (value === sortBy) {
      // 같은 정렬 기준이면 순서만 변경
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // 다른 정렬 기준이면 설정하고 오름차순으로 시작
      setSortBy(value as typeof sortBy)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Excel 변환기</h1>
          <p className="text-muted-foreground">
            Excel 파일을 CSV 또는 JSON 형식으로 변환하세요
          </p>
        </div>

        {/* 파일 업로드 섹션 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Excel 파일 업로드
            </CardTitle>
            <CardDescription>
              변환할 Excel 파일을 선택하세요 (.xlsx, .xls, .xlsm)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
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
                    파일 분석 중...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    파일 선택
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 파일 분석 결과 요약 */}
        {excelData && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  파일 분석 결과 요약
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">파일명</span>
                      <span className="font-medium">{excelData.fileName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">파일 크기</span>
                      <span className="font-medium">{formatFileSize(excelData.fileSize)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">총 시트 개수</span>
                      <span className="font-medium">{excelData.sheets.length}개</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">변환 가능 시트</span>
                      <span className="font-medium text-green-600">{convertibleSheetsCount}개</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground mb-2">시트 목록</div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {excelData.sheets.map((sheet, index) => (
                        <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                          <span className="font-medium">{sheet.name}</span>
                          <span className="text-muted-foreground">
                            {sheet.rowCount}행 × {sheet.columnCount}열
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 변환 옵션 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>변환 형식 선택</CardTitle>
                <CardDescription>
                  변환할 파일 형식을 선택하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={selectedFormat === 'csv' ? 'default' : 'outline'}
                    onClick={() => setSelectedFormat('csv')}
                    className="flex-1"
                  >
                    CSV
                  </Button>
                  <Button
                    variant={selectedFormat === 'json' ? 'default' : 'outline'}
                    onClick={() => setSelectedFormat('json')}
                    className="flex-1"
                  >
                    JSON
                  </Button>
                </div>

                {downloadProgress && (
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>변환 진행 중...</span>
                      <span>{downloadProgress.current} / {downloadProgress.total}</span>
                    </div>
                    <Progress value={(downloadProgress.current / downloadProgress.total) * 100} />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleDownloadAll}
                    className="flex-1"
                    size="lg"
                    disabled={!!downloadProgress}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    전체 시트 {selectedFormat.toUpperCase()}로 다운로드 (ZIP)
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="lg"
                    disabled={!!downloadProgress}
                  >
                    새 파일 선택
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 시트 목록 및 페이지네이션 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>시트 목록</CardTitle>
                <CardDescription>
                  각 시트를 개별적으로 변환하거나 미리보기할 수 있습니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 검색 및 정렬 컨트롤 */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* 검색 입력 */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="시트 이름으로 검색..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    {/* 정렬 선택 */}
                    <div className="flex gap-2">
                      <Select value={sortBy} onValueChange={handleSortChange}>
                        <SelectTrigger className="w-[180px]">
                          <div className="flex items-center gap-2">
                            <ArrowUpDown className="h-4 w-4" />
                            <SelectValue placeholder="정렬 기준" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">시트 이름</SelectItem>
                          <SelectItem value="rowCount">행 수</SelectItem>
                          <SelectItem value="columnCount">열 수</SelectItem>
                          <SelectItem value="nonEmptyRowsCount">데이터 행 수</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        title={sortOrder === 'asc' ? '오름차순 (내림차순으로 변경)' : '내림차순 (오름차순으로 변경)'}
                      >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </Button>
                    </div>
                  </div>

                  {/* 검색 결과 정보 */}
                  {searchQuery && (
                    <div className="text-sm text-muted-foreground">
                      "{searchQuery}" 검색 결과: {filteredAndSortedSheets.length}개 시트
                    </div>
                  )}
                  {/* 시트 목록 */}
                  <div className="space-y-2">
                    {currentSheets.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? '검색 결과가 없습니다.' : '시트가 없습니다.'}
                      </div>
                    ) : (
                      currentSheets.map((sheet) => {
                        // 필터링/정렬된 배열에서 원본 인덱스 찾기
                        const originalSheetIndex = excelData!.sheets.findIndex(s => s.name === sheet.name)
                        const originalSheet = excelData!.sheets[originalSheetIndex]
                        
                        return (
                          <div
                            key={sheet.name}
                            className="flex items-center justify-between p-4 border rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <p className="font-medium">{sheet.name}</p>
                              </div>
                              <p className="text-sm text-muted-foreground ml-7">
                                {sheet.rowCount}행 × {sheet.columnCount}열
                                {sheet.nonEmptyRowsCount !== undefined && (
                                  <span className="ml-2">(데이터: {sheet.nonEmptyRowsCount}행)</span>
                                )}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPreviewSheetIndex(originalSheetIndex)}
                                  >
                                    <Eye className="mr-2 h-3 w-3" />
                                    미리보기
                                  </Button>
                                </DialogTrigger>
                                {originalSheet && (
                                  <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        {originalSheet.name} - 상세 미리보기
                                      </DialogTitle>
                                      <DialogDescription>
                                        시트 데이터의 상세 정보 및 미리보기
                                      </DialogDescription>
                                    </DialogHeader>
                                    
                                    {/* 상세 정보 */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">총 행 수</div>
                                        <div className="text-lg font-semibold">{originalSheet.rowCount.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">총 열 수</div>
                                        <div className="text-lg font-semibold">{originalSheet.columnCount.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">데이터 행 수</div>
                                        <div className="text-lg font-semibold">{originalSheet.nonEmptyRowsCount?.toLocaleString() ?? 0}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-muted-foreground mb-1">빈 셀 수</div>
                                        <div className="text-lg font-semibold">{originalSheet.emptyCellsCount?.toLocaleString() ?? 0}</div>
                                      </div>
                                    </div>

                                    {/* 열 타입 정보 */}
                                    {originalSheet.columnTypes && originalSheet.columnTypes.length > 0 && (
                                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                                        <div className="text-sm font-medium mb-2 flex items-center gap-2">
                                          <Info className="h-4 w-4" />
                                          열별 데이터 타입 정보
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {originalSheet.columnTypes.slice(0, 20).map((type, idx) => (
                                            <div key={idx} className="px-2 py-1 bg-background rounded text-xs">
                                              열 {idx + 1}: <span className="font-semibold text-blue-600 dark:text-blue-400">{type}</span>
                                            </div>
                                          ))}
                                          {originalSheet.columnTypes.length > 20 && (
                                            <div className="px-2 py-1 text-xs text-muted-foreground">
                                              +{originalSheet.columnTypes.length - 20}개 열 더...
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* 데이터 테이블 */}
                                    <div className="flex-1 overflow-auto border rounded-lg">
                                      <Table>
                                        <TableHeader className="sticky top-0 bg-background z-10">
                                          <TableRow>
                                            <TableHead className="w-16 bg-muted/50">#</TableHead>
                                            {originalSheet.previewData?.[0]?.map((_, colIndex) => (
                                              <TableHead key={colIndex} className="whitespace-nowrap bg-muted/50 min-w-[120px]">
                                                열 {colIndex + 1}
                                                {originalSheet.columnTypes?.[colIndex] && (
                                                  <span className="block text-xs font-normal text-muted-foreground mt-1">
                                                    ({originalSheet.columnTypes[colIndex]})
                                                  </span>
                                                )}
                                              </TableHead>
                                            ))}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {originalSheet.previewData?.map((row, rowIndex) => (
                                            <TableRow key={rowIndex}>
                                              <TableCell className="font-medium bg-muted/30 sticky left-0 z-10">
                                                {rowIndex + 1}
                                              </TableCell>
                                              {row.map((cell, colIndex) => (
                                                <TableCell 
                                                  key={colIndex} 
                                                  className="whitespace-pre-wrap break-words max-w-xs"
                                                  title={cell !== null && cell !== undefined ? String(cell) : ''}
                                                >
                                                  <div className="max-h-24 overflow-y-auto">
                                                    {cell !== null && cell !== undefined ? String(cell) : <span className="text-muted-foreground italic">(비어있음)</span>}
                                                  </div>
                                                </TableCell>
                                              ))}
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>

                                    {/* 표시 범위 정보 */}
                                    <div className="text-xs text-muted-foreground mt-4 pt-4 border-t text-center">
                                      {originalSheet.previewData && originalSheet.previewData.length < originalSheet.rowCount && (
                                        <span>
                                          처음 {originalSheet.previewData.length}행만 표시됩니다. 
                                          전체 {originalSheet.rowCount.toLocaleString()}행 중 일부입니다.
                                        </span>
                                      )}
                                      {originalSheet.previewData && originalSheet.previewData.length >= originalSheet.rowCount && (
                                        <span>전체 데이터가 표시되었습니다.</span>
                                      )}
                                    </div>
                                  </DialogContent>
                                )}
                              </Dialog>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(sheet.name, 'csv')}
                                disabled={sheet.rowCount === 0}
                              >
                                <Download className="mr-2 h-3 w-3" />
                                CSV
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(sheet.name, 'json')}
                                disabled={sheet.rowCount === 0}
                              >
                                <Download className="mr-2 h-3 w-3" />
                                JSON
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        페이지 {currentPage} / {totalPages} (총 {filteredAndSortedSheets.length}개 시트{excelData.sheets.length !== filteredAndSortedSheets.length ? ` / 전체 ${excelData.sheets.length}개` : ''})
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          이전
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          다음
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </>
        )}
      </div>
    </div>
  )
}