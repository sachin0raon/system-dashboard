package metrics

import (
	"os"
	"path/filepath"
)

// countProcs counts running processes by scanning /proc for numeric directory
// names. Much cheaper than host.Info() which reads several /proc and /etc files
// just to get this one number.
func countProcs() int {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		if len(name) > 0 && name[0] >= '1' && name[0] <= '9' {
			count++
		}
	}
	return count
}

func readFileStr(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// readGlobFirst returns the content of the first file matching the glob pattern.
func readGlobFirst(pattern string) (string, error) {
	matches, err := filepath.Glob(pattern)
	if err != nil || len(matches) == 0 {
		return "", os.ErrNotExist
	}
	return readFileStr(matches[0])
}
