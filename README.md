# claude-paws

https://github.com/user-attachments/assets/eab8be0e-f19c-4390-ad71-a4c7effdbc25

Claude Code 세션, 터미널 10개 열어두고 기억력으로 버티지 마세요.
지금 어떤 세션이 돌아가고 있는지, 한 화면에서 전부 봅니다. 클릭하면 해당 터미널로 바로 점프.

12종 픽셀 동물들. 고양이, 펭귄, 알파카… 나를 대표할 캐릭터를 하나 고르세요.

## 이런 걸 할 수 있어요

- 여러 프로젝트 세션을 한 화면에서 실시간으로 봐요
- 카드에 마우스 올리면 터미널 아이콘이 나타나요. 누르면 바로 그 터미널로 이동
- 필요 없는 세션은 카드 클릭해서 바로 삭제
- 12종 픽셀 마스코트가 대시보드 위를 걸어다녀요. 가끔 말풍선도 띄워요
- 세션 상태가 바뀌면 Toast 알림이 뜨고, 누르면 해당 세션으로 이동
- `D` 누르면 다크 모드, `E` 누르면 편집 모드, `1-5`로 컬럼 수 조절
- 카드를 드래그해서 원하는 대로 배치할 수 있어요
- 카드 클릭하면 트랜스크립트 타임라인을 볼 수 있어요
- 팀 에이전트가 돌고 있으면 구조도 같이 보여줘요
- 세션 끝나면 macOS 알림도 받을 수 있어요

## 설치

```bash
npm install -g claude-paws
```

Node.js 18 이상이면 돼요.

## 사용법

```bash
# 대시보드 시작
paws

# hook 설치 (npm install 하면 자동으로 돼요)
paws setup

# 설치 상태 확인
paws status

# 포트 바꾸기
paws --port 3300

# 브라우저 자동으로 안 열기
paws --no-open
```

http://localhost:3200 으로 접속하면 돼요.

## 어떻게 동작하나요?

설치하면 `~/.claude/settings.json`에 hook이 하나 붙어요. 세션이 시작되거나 끝나거나 응답이 오면 `~/.claude/dashboard/active/`에 JSON으로 기록하고, 대시보드가 그걸 읽어서 보여주는 거예요.

**데이터는 전부 로컬이에요. 외부로 나가는 건 없어요.**

## 업데이트

```bash
npm install -g claude-paws@latest
```

## 삭제

```bash
npm uninstall -g claude-paws
```

hook까지 깔끔하게 지우려면:

```bash
rm ~/.claude/hooks/session-tracker.sh
rm -rf ~/.claude/dashboard/
```

`~/.claude/settings.json`에서 `session-tracker.sh` 관련 항목도 지워주면 끝이에요.

## 기술 스택

- **Server**: Node.js (의존성 없음)
- **Frontend**: Vanilla HTML/CSS/JS (서버에 내장)
- **Hook**: Bash + jq
- **Font**: [Pretendard](https://github.com/orioncactus/pretendard)

## 라이선스

MIT
