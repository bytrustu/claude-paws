# claude-paws

<div align="center">

<video src="https://github.com/user-attachments/assets/a9f89a6e-d0bd-4e23-9b08-53c397f2b2b9" />

</div>

Claude Code 세션을 한눈에 볼 수 있는 대시보드예요.
지금 어떤 세션이 돌아가고 있는지, 픽셀 마스코트와 함께 실시간으로 확인할 수 있어요.

## 이런 걸 할 수 있어요

- **실시간 세션 모니터링** - 여러 프로젝트의 Claude Code 세션을 한 화면에서 확인해요
- **터미널 바로가기** - 세션 카드에 hover하면 터미널 아이콘이 나타나요. 클릭하면 해당 세션이 실행 중인 터미널 탭으로 바로 전환돼요
- **세션 삭제** - 카드를 클릭하면 세션 상세 모달이 열리고, 필요 없는 세션은 바로 삭제할 수 있어요
- **12종 픽셀 마스코트** - 고양이, 강아지, 토끼, 곰, 펭귄, 호랑이, 사자, 알파카, 여우, 햄스터, 부엉이, 판다
- **걸어다니는 펫** - 마스코트가 대시보드 위를 돌아다니며 말풍선을 띄워요
- **다크 모드** - `D` 키 하나로 전환돼요
- **드래그 & 리사이즈** - 카드 배치를 자유롭게 커스텀할 수 있어요 (localStorage에 저장)
- **팀 에이전트 시각화** - 에이전트 팀이 활성화되면 모달에서 구조를 볼 수 있어요
- **세션 상세 모달** - 카드를 클릭하면 트랜스크립트 타임라인이 나와요
- **macOS 알림** - 세션이 끝나면 알림을 받을 수 있어요
- **키보드 단축키** - `D` 다크 모드, `E` 편집 모드, `1-5` 컬럼 수, `Esc` 모달 닫기
- **캐릭터 선택** - 나를 대표하는 마스코트를 고를 수 있어요

## 설치

```bash
npm install -g claude-paws
```

Node.js 18 이상이 필요해요.

## 사용법

```bash
# 대시보드 시작
claude-paws

# 훅 설치 (npm install 시 자동 실행)
claude-paws setup

# 설치 상태 확인
claude-paws status

# 포트 변경
claude-paws --port 3300

# 브라우저 자동 열기 끄기
claude-paws --no-open
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
