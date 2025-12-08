import * as XLSX from 'xlsx'
import JSZip from 'jszip'

export interface SheetInfo {
  name: string
  rowCount: number
  columnCount: number
  previewData?: any[][] // 미리보기용 데이터 (최대 50행, 모든 열)
  fullData?: any[][] // 전체 데이터 (모달용)
  columnTypes?: string[] // 각 열의 데이터 타입
  emptyCellsCount?: number // 빈 셀 개수
  nonEmptyRowsCount?: number // 데이터가 있는 행 개수
}

export interface ExcelData {
  fileName: string
  fileSize: number // 파일 크기 (bytes)
  sheets: SheetInfo[]
  workbook: XLSX.WorkBook
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환합니다
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Excel 파일을 읽고 분석합니다
 * @param file - 업로드된 Excel 파일
 * @returns 파일 정보와 워크북 객체
 */
export async function analyzeExcel(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const sheets: SheetInfo[] = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          
          const rowCount = jsonData.length
          const columnCount = rowCount > 0 
            ? Math.max(...jsonData.map((row: any[]) => Array.isArray(row) ? row.length : 0))
            : 0

          // 미리보기 데이터 (최대 50행, 모든 열)
          const previewRows = Math.min(50, rowCount)
          const previewData: any[][] = []
          
          for (let i = 0; i < previewRows; i++) {
            previewData.push(jsonData[i] ? [...jsonData[i]] : [])
          }

          // 전체 데이터 저장 (모달용)
          const fullData = jsonData.map(row => [...row])

          // 각 열의 데이터 타입 분석
          const columnTypes: string[] = []
          if (columnCount > 0) {
            for (let j = 0; j < columnCount; j++) {
              const columnValues = jsonData
                .map(row => row[j])
                .filter(val => val !== null && val !== undefined && val !== '')
              
              if (columnValues.length === 0) {
                columnTypes.push('empty')
              } else {
                const types = columnValues.map(val => {
                  if (typeof val === 'number') return 'number'
                  if (typeof val === 'boolean') return 'boolean'
                  if (val instanceof Date || !isNaN(Date.parse(val))) return 'date'
                  return 'text'
                })
                
                const uniqueTypes = [...new Set(types)]
                if (uniqueTypes.length === 1) {
                  columnTypes.push(uniqueTypes[0])
                } else {
                  columnTypes.push('mixed')
                }
              }
            }
          }

          // 빈 셀 개수 계산
          let emptyCellsCount = 0
          for (const row of jsonData) {
            for (const cell of row) {
              if (cell === null || cell === undefined || cell === '') {
                emptyCellsCount++
              }
            }
          }

          // 데이터가 있는 행 개수
          const nonEmptyRowsCount = jsonData.filter(row => 
            row.some(cell => cell !== null && cell !== undefined && cell !== '')
          ).length

          return {
            name: sheetName,
            rowCount,
            columnCount,
            previewData,
            fullData,
            columnTypes,
            emptyCellsCount,
            nonEmptyRowsCount,
          }
        })

        resolve({
          fileName: file.name,
          fileSize: file.size,
          sheets,
          workbook,
        })
      } catch (error) {
        reject(new Error('Excel 파일을 읽는 중 오류가 발생했습니다: ' + (error as Error).message))
      }
    }

    reader.onerror = () => {
      reject(new Error('파일을 읽는 중 오류가 발생했습니다'))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * 시트를 CSV 형식으로 변환합니다
 * @param workbook - XLSX 워크북 객체
 * @param sheetName - 변환할 시트 이름
 * @returns CSV 문자열
 */
export function convertSheetToCSV(workbook: XLSX.WorkBook, sheetName: string): string {
  const worksheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_csv(worksheet)
}

/**
 * 시트를 JSON 형식으로 변환합니다
 * @param workbook - XLSX 워크북 객체
 * @param sheetName - 변환할 시트 이름
 * @returns JSON 문자열
 */
export function convertSheetToJSON(workbook: XLSX.WorkBook, sheetName: string): string {
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet)
  return JSON.stringify(jsonData, null, 2)
}

/**
 * 텍스트를 Blob으로 변환하고 다운로드합니다 (폴더 구조 지원)
 * @param content - 다운로드할 내용
 * @param fileName - 파일명 (폴더 경로 포함 가능)
 * @param mimeType - MIME 타입
 */
export function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * ZIP 파일 생성 및 다운로드 (여러 파일을 폴더 구조로 압축)
 * 이 함수는 JSZip 라이브러리를 사용합니다
 */
export async function downloadFilesAsZip(
  files: Array<{ name: string; content: string; mimeType: string }>,
  zipFileName: string
) {
  const zip = new JSZip()

  // 각 파일을 ZIP에 추가
  files.forEach((file) => {
    zip.file(file.name, file.content)
  })

  // ZIP 파일 생성 및 다운로드
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = zipFileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}