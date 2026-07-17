package logs

import (
	"context"
	"encoding/json"
	"net/http"
	"os/exec"
	"strconv"
	"time"
)

func timeoutContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}

type LogEntry struct {
	Timestamp string  `json:"timestamp"`
	Unit      *string `json:"unit"`
	Message   string  `json:"message"`
	Priority  int     `json:"priority"`
	Hostname  *string `json:"hostname"`
	PID       *int    `json:"pid"`
}

// HandleLogs handles GET /api/logs
// Query params: unit (string), lines (int, default 100), priority (int 0-7)
func HandleLogs() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()

		lines := 100
		if v := q.Get("lines"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n >= 1 && n <= 1000 {
				lines = n
			}
		}

		cmd := []string{"journalctl", "--no-pager", "-o", "json", "-n", strconv.Itoa(lines)}

		if unit := q.Get("unit"); unit != "" {
			cmd = append(cmd, "-u", unit)
		}
		if p := q.Get("priority"); p != "" {
			if n, err := strconv.Atoi(p); err == nil && n >= 0 && n <= 7 {
				cmd = append(cmd, "-p", strconv.Itoa(n))
			}
		}

		out, err := runWithTimeout(cmd, 10*time.Second)
		if err != nil {
			http.Error(w, `{"detail":"journalctl failed or not available"}`, http.StatusServiceUnavailable)
			return
		}

		entries := parseJournalJSON(out)
		writeJSON(w, map[string]any{"entries": entries, "count": len(entries)})
	}
}

// HandleUnits handles GET /api/logs/units
func HandleUnits() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		out, err := runWithTimeout(
			[]string{"journalctl", "--field=_SYSTEMD_UNIT", "--no-pager"},
			5*time.Second,
		)
		if err != nil {
			http.Error(w, `{"detail":"journalctl not available"}`, http.StatusServiceUnavailable)
			return
		}

		seen := make(map[string]struct{})
		var units []string
		for _, b := range splitLines(out) {
			line := string(b)
			if line == "" {
				continue
			}
			if _, dup := seen[line]; !dup {
				seen[line] = struct{}{}
				units = append(units, line)
			}
		}
		sortStrings(units)
		writeJSON(w, map[string]any{"units": units})
	}
}

// parseJournalJSON converts journalctl -o json output (one JSON object per line)
// into a slice of LogEntry.
func parseJournalJSON(raw []byte) []LogEntry {
	lines := splitLines(raw)
	entries := make([]LogEntry, 0, len(lines))

	for _, line := range lines {
		if len(line) == 0 {
			continue
		}
		var obj map[string]json.RawMessage
		if err := json.Unmarshal(line, &obj); err != nil {
			continue
		}

		ts := parseTimestamp(obj["__REALTIME_TIMESTAMP"])
		msg := jsonStr(obj["MESSAGE"])
		unit := jsonStrPtr(obj["_SYSTEMD_UNIT"])
		if unit == nil {
			unit = jsonStrPtr(obj["SYSLOG_IDENTIFIER"])
		}
		priority := jsonInt(obj["PRIORITY"], 6)
		hostname := jsonStrPtr(obj["_HOSTNAME"])
		pid := jsonIntPtr(obj["_PID"])

		entries = append(entries, LogEntry{
			Timestamp: ts,
			Unit:      unit,
			Message:   msg,
			Priority:  priority,
			Hostname:  hostname,
			PID:       pid,
		})
	}
	return entries
}

func parseTimestamp(raw json.RawMessage) string {
	if raw == nil {
		return time.Now().UTC().Format(time.RFC3339)
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return time.Now().UTC().Format(time.RFC3339)
	}
	usec, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return time.Now().UTC().Format(time.RFC3339)
	}
	return time.UnixMicro(usec).UTC().Format(time.RFC3339)
}

func jsonStr(raw json.RawMessage) string {
	if raw == nil {
		return ""
	}
	var s string
	json.Unmarshal(raw, &s)
	return s
}

func jsonStrPtr(raw json.RawMessage) *string {
	if raw == nil {
		return nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil || s == "" {
		return nil
	}
	return &s
}

func jsonInt(raw json.RawMessage, def int) int {
	if raw == nil {
		return def
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		if n, err := strconv.Atoi(s); err == nil {
			return n
		}
	}
	return def
}

func jsonIntPtr(raw json.RawMessage) *int {
	if raw == nil {
		return nil
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &n
}

func runWithTimeout(args []string, timeout time.Duration) ([]byte, error) {
	ctx, cancel := timeoutContext(timeout)
	defer cancel()
	return exec.CommandContext(ctx, args[0], args[1:]...).Output()
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			lines = append(lines, data[start:i])
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}

func sortStrings(s []string) {
	// Simple insertion sort — unit list is small.
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
