# Excel 변환기

Excel 파일을 CSV 또는 JSON 형식으로 변환하는 웹 애플리케이션입니다.

## 주요 기능

1. **Excel 파일 업로드** - `.xlsx`, `.xls`, `.xlsm` 형식 지원
2. **파일 분석** - 시트 개수, 행/열 수 자동 분석
3. **형식 변환** - CSV 또는 JSON 형식으로 변환
4. **시트별 다운로드** - 각 시트를 개별 파일로 다운로드 가능
5. **전체 다운로드** - 모든 시트를 선택한 형식으로 한 번에 다운로드

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 프로덕션 빌드

```bash
npm run build
npm start
```

## 사용 방법

1. **파일 업로드**: "파일 선택" 버튼을 클릭하여 Excel 파일을 선택합니다.
2. **분석 확인**: 업로드된 파일의 시트 정보가 자동으로 표시됩니다.
3. **형식 선택**: CSV 또는 JSON 형식을 선택합니다.
4. **다운로드**: 
   - 전체 다운로드: 모든 시트를 선택한 형식으로 한 번에 다운로드
   - 개별 다운로드: 원하는 시트만 CSV 또는 JSON으로 개별 다운로드

## 기술 스택

- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** 컴포넌트
- **xlsx** (Excel 파일 처리 라이브러리)
- **Lucide React** (아이콘)

## 프로젝트 구조

```
├── app/
│   ├── layout.tsx       # 루트 레이아웃
│   ├── page.tsx         # 메인 페이지
│   └── globals.css      # 전역 스타일
├── components/
│   └── ui/              # UI 컴포넌트
├── lib/
│   ├── excel-converter.ts  # Excel 변환 로직
│   └── utils.ts         # 유틸리티 함수
└── package.json
```

## 라이선스

MIT
