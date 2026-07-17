package metrics

import (
	"bufio"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
)

// StaticInfo holds data that never changes while the system is running.
// Loaded once at startup; passed by pointer into every Collect() call.
type StaticInfo struct {
	Hostname     string
	OsName       string
	OsVersion    string
	Kernel       string
	Architecture string
	BootTime     time.Time
	BootTimeISO  string
	CPUModel     string
}

// LoadStaticInfo is called once in main() before any goroutines start.
func LoadStaticInfo() *StaticInfo {
	h, _ := os.Hostname()
	kernel, arch := readUname()
	osName, osVersion := readOsRelease()
	cpuModel := readCPUModelFromProc()

	bootTS, _ := host.BootTime()
	bootTime := time.Unix(int64(bootTS), 0).UTC()

	return &StaticInfo{
		Hostname:     h,
		OsName:       osName,
		OsVersion:    osVersion,
		Kernel:       kernel,
		Architecture: arch,
		BootTime:     bootTime,
		BootTimeISO:  bootTime.Format(time.RFC3339),
		CPUModel:     cpuModel,
	}
}

// buildOsInfo is called every tick — only touches cheap runtime values.
func buildOsInfo(s *StaticInfo) OsInfo {
	avg, err := load.Avg()
	if err != nil {
		avg = &load.AvgStat{}
	}

	procs, _ := host.Info()
	procCount := 0
	if procs != nil {
		procCount = int(procs.Procs)
	}

	return OsInfo{
		Hostname:      s.Hostname,
		OsName:        s.OsName,
		OsVersion:     s.OsVersion,
		Kernel:        s.Kernel,
		Architecture:  s.Architecture,
		UptimeSeconds: time.Since(s.BootTime).Seconds(),
		BootTime:      s.BootTimeISO,
		LoadAvg1:      avg.Load1,
		LoadAvg5:      avg.Load5,
		LoadAvg15:     avg.Load15,
		ProcessCount:  procCount,
		CPUModel:      s.CPUModel,
	}
}

// readUname reads kernel version and machine arch from /proc sysfs.
// This avoids syscall.Uname which is Linux-only and not available during
// macOS cross-compilation. Falls back to runtime constants on any error.
func readUname() (kernel, arch string) {
	if data, err := os.ReadFile("/proc/sys/kernel/osrelease"); err == nil {
		kernel = strings.TrimSpace(string(data))
	} else {
		kernel = runtime.GOOS
	}
	// Translate Go arch names to Linux machine names (what uname -m returns).
	switch runtime.GOARCH {
	case "arm64":
		arch = "aarch64"
	case "amd64":
		arch = "x86_64"
	case "arm":
		arch = "armv7l"
	default:
		arch = runtime.GOARCH
	}
	return
}

// readOsRelease parses /etc/os-release exactly like the Python backend.
func readOsRelease() (osName, osVersion string) {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return runtime.GOOS, ""
	}
	defer f.Close()

	fields := make(map[string]string)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if k, v, ok := strings.Cut(line, "="); ok {
			fields[k] = strings.Trim(v, `"`)
		}
	}

	osName = fields["PRETTY_NAME"]
	if osName == "" {
		osName = fields["NAME"]
	}
	if osName == "" {
		osName = runtime.GOOS
	}
	osVersion = fields["VERSION_ID"]
	return
}

// readCPUModelFromProc reads /proc/cpuinfo — no lscpu subprocess.
// On a Pi, looks for "Model" (e.g. "Raspberry Pi 5 Model B Rev 1.0").
// On x86, looks for "model name".
func readCPUModelFromProc() string {
	f, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return runtime.GOARCH
	}
	defer f.Close()

	var modelName, model string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		k, v, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		switch strings.TrimSpace(k) {
		case "model name":
			if modelName == "" {
				modelName = strings.TrimSpace(v)
			}
		case "Model":
			if model == "" {
				model = strings.TrimSpace(v)
			}
		}
	}

	if model != "" {
		return model // Pi-specific: more descriptive
	}
	if modelName != "" {
		return modelName
	}
	return runtime.GOARCH
}
