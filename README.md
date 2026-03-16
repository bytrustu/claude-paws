# claude-paws

Claude Code... 터미널 10개 열어두고 기억력으로 버티지 마세요.  
12종 픽셀 동물들. 고양이, 펭귄, 알파카… 나를 대표할 캐릭터를 하나 고르세요.  
지금 어떤 세션이 돌아가고 있는지, 한 화면에서 전부 봅니다. 클릭하면 해당 터미널로 바로 점프.  

https://github.com/user-attachments/assets/eab8be0e-f19c-4390-ad71-a4c7effdbc25



## 설치

```bash
npm install -g claude-paws
```

Node.js 18 이상이 필요해요.

## 사용법

```bash
# 대시보드 시작
paws

# 훅 설치 (npm install 시 자동 실행)
paws setup

# 설치 상태 확인
paws status

# 포트 변경
paws --port 3300

# 브라우저 자동 열기 끄기
paws --no-open
```

브라우저에서 http://localhost:3200 을 열면 돼요.

## 어떻게 동작하나요?

claude-paws는 Claude Code의 `~/.claude/settings.json`에 가벼운 훅을 설치해요. 이 훅이 세션 이벤트를 추적해요.

- `SessionStart` / `SessionEnd` - 세션 시작과 종료
- `UserPromptSubmit` - 사용자가 메시지를 보냈을 때 (세션 "작업 중")
- `Stop` - Claude가 응답을 마쳤을 때 (세션 "대기 중")
- `Notification` - Claude가 주의를 필요로 할 때
- `SubagentStart` / `SubagentStop` - 에이전트 위임 추적

세션 데이터는 `~/.claude/dashboard/active/`에 JSON 파일로 저장돼요. 대시보드 서버가 이 파일을 읽어서 웹 UI로 보여줘요.

**데이터는 외부로 전송되지 않아요.** 모든 것이 `localhost`에서 로컬로 동작해요.

## 업데이트

```bash
npm install -g claude-paws@latest
```

## 삭제

```bash
npm uninstall -g claude-paws
```

훅을 수동으로 제거하려면:

```bash
# 훅 스크립트 삭제
rm ~/.claude/hooks/session-tracker.sh

# 대시보드 데이터 삭제
rm -rf ~/.claude/dashboard/
```

`~/.claude/settings.json`에서 `session-tracker.sh`를 참조하는 훅도 안전하게 제거할 수 있어요.

## 설정

대시보드 상태는 브라우저 localStorage에 저장돼요.
- `claude-dash-layout` - 카드 순서, 크기, 컬럼 수
- `claude-dash-theme` - 라이트/다크 테마
- `claude-paws-global` - 대표 마스코트 선택
- `claude-paws-mascots` - 세션별 마스코트 오버라이드

## 기술 스택

- **Server**: Node.js (의존성 없음)
- **Frontend**: Vanilla HTML/CSS/JS (서버에 내장)
- **Hooks**: Bash + jq
- **Font**: [Pretendard](https://github.com/orioncactus/pretendard)

## 라이선스

MIT
