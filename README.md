# 24시 열린의원 급여 계산기

React + TypeScript + Vite + Firebase 기반 클리닉 스케줄/급여 계산기.

GitHub Pages로 배포되며, Firebase Auth(Google 로그인) + Firestore를 사용합니다.

## 개발

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## Firebase 설정

### 1. Firestore 보안 규칙 (필수)

로그인 후 `Missing or insufficient permissions` 오류가 발생하면 규칙이 배포되지 않은 것입니다.

저장소의 `firestore.rules` 내용을 [Firebase Console](https://console.firebase.google.com) → Firestore Database → 규칙 탭에 붙여넣고 **게시(Publish)** 합니다.

또는 Firebase CLI로 배포:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 2. 인증 도메인 등록

[Firebase Console](https://console.firebase.google.com) → Authentication → Settings → Authorized domains 에 배포 도메인을 추가합니다. (예: `swnation.github.io`)

### 3. 로그인 방식

GitHub Pages는 `Cross-Origin-Opener-Policy: same-origin` 헤더를 강제하기 때문에 `signInWithPopup`이 정상 동작하지 않습니다. 본 앱은 배포 환경에서는 자동으로 `signInWithRedirect`로 동작하고, `localhost`에서는 popup으로 동작합니다 (`src/services/firebase.ts`).
