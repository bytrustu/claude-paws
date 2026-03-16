#!/bin/bash
# Claude Code Session Tracker
# Handles: SessionStart, UserPromptSubmit, Stop, Notification, SessionEnd,
#          SubagentStart, SubagentStop

INPUT=$(cat)

EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"')
SESSION=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // ""')
PROJECT=$(basename "$CWD")
NOW=$(date '+%Y-%m-%d %H:%M:%S')

# Extract session name from transcript
SESSION_NAME=""
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  SESSION_NAME=$(tail -c 102400 "$TRANSCRIPT" 2>/dev/null | grep '"type":"agent-name"' | tail -1 | jq -r '.agentName // ""' 2>/dev/null)
fi

ACTIVE_DIR="$HOME/.claude/dashboard/active"
LOG_FILE="$HOME/.claude/dashboard/activity.jsonl"
SESSION_FILE="$ACTIVE_DIR/$SESSION.json"

mkdir -p "$ACTIVE_DIR"

# --- Atomic write helper ---
# Writes content to a temp file first, then atomically moves it into place.
# This prevents partial/corrupt reads by the dashboard server.
atomic_write() {
  local target="$1"
  local content="$2"
  local tmpfile
  tmpfile=$(mktemp "${target}.XXXXXX") || return 1
  printf '%s\n' "$content" > "$tmpfile" 2>/dev/null
  mv -f "$tmpfile" "$target" 2>/dev/null
}

# --- Team info collector ---
# Scans ~/.claude/teams/*/config.json and returns a JSON array with team data
collect_team_info() {
  local teams_dir="$HOME/.claude/teams"
  [ -d "$teams_dir" ] || return

  local team_json="[]"
  for config in "$teams_dir"/*/config.json; do
    [ -f "$config" ] || continue
    local entry
    entry=$(jq -c '{name: .name, description: .description, members: [.members[] | {name: .name, role: .agentType, model: .model}]}' "$config" 2>/dev/null) || continue
    team_json=$(echo "$team_json" | jq -c --argjson e "$entry" '. + [$e]') 2>/dev/null
  done

  echo "$team_json"
}

write_new() {
  local teams
  teams=$(collect_team_info)
  local content
  content=$(jq -cn \
    --arg session "$SESSION" \
    --arg project "$PROJECT" \
    --arg cwd "$CWD" \
    --arg status "$1" \
    --arg message "$2" \
    --arg lastResponse "$3" \
    --arg sessionName "$SESSION_NAME" \
    --arg transcript "$TRANSCRIPT" \
    --arg updated "$NOW" \
    --argjson subagents '[]' \
    --argjson teams "${teams:-[]}" \
    '{session:$session,project:$project,cwd:$cwd,status:$status,message:$message,lastResponse:$lastResponse,sessionName:$sessionName,transcript:$transcript,updated:$updated,subagents:$subagents,teams:$teams}')
  atomic_write "$SESSION_FILE" "$content"
}

update_status() {
  # Refresh team info on every status update
  local teams
  teams=$(collect_team_info)
  if [ -f "$SESSION_FILE" ]; then
    local updated
    updated=$(jq -c \
      --arg status "$1" \
      --arg message "$2" \
      --arg updated "$NOW" \
      --arg sessionName "$SESSION_NAME" \
      'if $sessionName != "" then . + {status:$status,message:$message,updated:$updated,sessionName:$sessionName} else . + {status:$status,message:$message,updated:$updated} end' \
      "$SESSION_FILE" 2>/dev/null)
    if [ -n "$updated" ]; then
      atomic_write "$SESSION_FILE" "$updated"
    fi
  else
    write_new "$1" "$2" ""
  fi
}

log_activity() {
  local entry
  entry=$(jq -cn \
    --arg ts "$NOW" \
    --arg event "$1" \
    --arg session "$SESSION" \
    --arg project "$PROJECT" \
    --arg message "$2" \
    '{ts:$ts,event:$event,session:$session,project:$project,message:$message}')

  local tmpfile
  tmpfile=$(mktemp "${LOG_FILE}.XXXXXX") 2>/dev/null
  if [ -n "$tmpfile" ]; then
    printf '%s\n' "$entry" > "$tmpfile"
    cat "$tmpfile" >> "$LOG_FILE" 2>/dev/null
    rm -f "$tmpfile"
  fi

  if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 500 ]; then
    local trimtmp
    trimtmp=$(mktemp "${LOG_FILE}.XXXXXX") 2>/dev/null
    if [ -n "$trimtmp" ]; then
      tail -200 "$LOG_FILE" > "$trimtmp" && mv -f "$trimtmp" "$LOG_FILE"
    fi
  fi
}

notify_macos() {
  osascript -e "display notification \"$2\" with title \"$1\" sound name \"Glass\"" 2>/dev/null &
}

# --- Subagent handlers ---
handle_subagent_start() {
  local agent_name agent_id agent_model
  agent_name=$(echo "$INPUT" | jq -r '.agent_name // "unknown"')
  agent_id=$(echo "$INPUT" | jq -r '.agent_id // "unknown"')
  agent_model=$(echo "$INPUT" | jq -r '.agent_model // ""')

  if [ -f "$SESSION_FILE" ]; then
    local new_agent
    new_agent=$(jq -cn \
      --arg name "$agent_name" \
      --arg id "$agent_id" \
      --arg model "$agent_model" \
      --arg status "running" \
      --arg startedAt "$NOW" \
      '{name:$name,id:$id,model:$model,status:$status,startedAt:$startedAt}')

    local updated
    updated=$(jq -c \
      --argjson agent "$new_agent" \
      --arg updated "$NOW" \
      '.subagents = ((.subagents // []) + [$agent]) | .updated = $updated' \
      "$SESSION_FILE" 2>/dev/null)
    if [ -n "$updated" ]; then
      atomic_write "$SESSION_FILE" "$updated"
    fi
  else
    write_new "working" "Subagent started: $agent_name" ""
  fi

  log_activity "subagent_start" "Agent $agent_name started"
}

handle_subagent_stop() {
  local agent_name agent_id
  agent_name=$(echo "$INPUT" | jq -r '.agent_name // "unknown"')
  agent_id=$(echo "$INPUT" | jq -r '.agent_id // "unknown"')

  if [ -f "$SESSION_FILE" ]; then
    local updated
    updated=$(jq -c \
      --arg id "$agent_id" \
      --arg status "stopped" \
      --arg stoppedAt "$NOW" \
      --arg updated "$NOW" \
      '(.subagents // []) as $subs |
       if ($subs | length) > 0 then
         .subagents = [$subs[] | if .id == $id then . + {status:$status,stoppedAt:$stoppedAt} else . end]
       else . end |
       .updated = $updated' \
      "$SESSION_FILE" 2>/dev/null)
    if [ -n "$updated" ]; then
      atomic_write "$SESSION_FILE" "$updated"
    fi
  fi

  log_activity "subagent_stop" "Agent $agent_name stopped"
}

case "$EVENT" in
  SessionStart)
    write_new "started" "Session started" ""
    # Capture TTY for terminal focus feature
    HOOK_TTY=$(ps -o tty= -p $PPID 2>/dev/null | tr -d ' ')
    if [ -n "$HOOK_TTY" ] && [ "$HOOK_TTY" != "??" ]; then
      HOOK_TTY="/dev/$HOOK_TTY"
      if [ -f "$SESSION_FILE" ]; then
        tty_updated=$(jq -c --arg tty "$HOOK_TTY" '. + {tty:$tty}' "$SESSION_FILE" 2>/dev/null)
        if [ -n "$tty_updated" ]; then
          atomic_write "$SESSION_FILE" "$tty_updated"
        fi
      fi
    fi
    log_activity "start" "Session started"
    ;;

  UserPromptSubmit)
    update_status "working" "Processing..."
    ;;

  Stop)
    MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // ""' | tr '\n' ' ' | cut -c1-200)
    STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

    if [ -f "$SESSION_FILE" ]; then
      local updated
      updated=$(jq -c \
        --arg status "waiting" \
        --arg message "$MSG" \
        --arg lastResponse "$MSG" \
        --arg sessionName "$SESSION_NAME" \
        --arg updated "$NOW" \
        'if $sessionName != "" then . + {status:$status,message:$message,lastResponse:$lastResponse,updated:$updated,sessionName:$sessionName} else . + {status:$status,message:$message,lastResponse:$lastResponse,updated:$updated} end' \
        "$SESSION_FILE" 2>/dev/null)
      if [ -n "$updated" ]; then
        atomic_write "$SESSION_FILE" "$updated"
      fi
    else
      write_new "waiting" "$MSG" "$MSG"
    fi

    log_activity "stop" "$MSG"
    if [ "$STOP_ACTIVE" != "true" ]; then
      notify_macos "Claude [$PROJECT]" "작업 완료 - 입력 대기"
    fi
    ;;

  Notification)
    MSG=$(echo "$INPUT" | jq -r '.message // ""')
    TYPE=$(echo "$INPUT" | jq -r '.notification_type // ""')
    update_status "notification:$TYPE" "$MSG"
    log_activity "notify:$TYPE" "$MSG"
    notify_macos "Claude [$PROJECT]" "$MSG"
    ;;

  SubagentStart)
    handle_subagent_start
    ;;

  SubagentStop)
    handle_subagent_stop
    ;;

  SessionEnd)
    rm -f "$SESSION_FILE"
    log_activity "end" "Session ended"
    ;;
esac

exit 0
