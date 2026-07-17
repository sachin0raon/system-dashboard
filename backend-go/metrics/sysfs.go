package metrics

import (
	"os"
	"path/filepath"
)

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
