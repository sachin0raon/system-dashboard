package metrics

import (
	"bufio"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
)

// physicalCoreCount is read from /proc/cpuinfo exactly once.
// Calling cpu.Counts(false) on every tick wasted a full /proc/cpuinfo parse each cycle.
var physicalCoreCount = sync.OnceValue(func() int {
	counts, err := cpu.Counts(false)
	if err != nil || counts <= 0 {
		return runtime.NumCPU()
	}
	return counts
})

func collectCPU(s *cpuState) CpuInfo {
	// Single percpu=true call; derive aggregate from mean.
	// This avoids the double-call bug where two consecutive cpu_percent calls
	// would measure CPU over near-zero elapsed time for the second call.
	perCore, err := cpu.Percent(0, true)
	if err != nil || len(perCore) == 0 {
		perCore = []float64{}
	}

	total := 0.0
	for _, c := range perCore {
		total += c
	}
	if len(perCore) > 0 {
		total /= float64(len(perCore))
	}

	// Context switches and interrupts from /proc/stat (no subprocess needed).
	ctx, intr := readProcStatCounters()
	now := time.Now()

	ctxPerSec, intrPerSec := 0.0, 0.0
	if !s.prevTime.IsZero() {
		dt := now.Sub(s.prevTime).Seconds()
		if dt > 0 {
			ctxPerSec = float64(ctx-s.prevCTX) / dt
			intrPerSec = float64(intr-s.prevINTR) / dt
		}
	}
	s.prevCTX = ctx
	s.prevINTR = intr
	s.prevTime = now

	if ctxPerSec < 0 {
		ctxPerSec = 0
	}
	if intrPerSec < 0 {
		intrPerSec = 0
	}

	return CpuInfo{
		UsagePercent:      total,
		PerCorePercent:    perCore,
		FrequencyMHz:      readCurrentFreqMHz(),
		CoreCount:         physicalCoreCount(),
		ThreadCount:       runtime.NumCPU(),
		CtxSwitchesPerSec: ctxPerSec,
		InterruptsPerSec:  intrPerSec,
	}
}

// readProcStatCounters reads ctxt (context switches) and intr (total interrupts)
// directly from /proc/stat — faster than any psutil call and no subprocess.
func readProcStatCounters() (ctx, intr uint64) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "ctxt "):
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				ctx, _ = strconv.ParseUint(fields[1], 10, 64)
			}
		case strings.HasPrefix(line, "intr "):
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				intr, _ = strconv.ParseUint(fields[1], 10, 64)
			}
		}
	}
	return
}

// readCurrentFreqMHz reads the current scaling frequency from sysfs.
// On a Pi this is more accurate than gopsutil's cpu.Info() which reads
// the nominal max frequency from /proc/cpuinfo.
func readCurrentFreqMHz() float64 {
	data, err := os.ReadFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq")
	if err != nil {
		// Fallback: read from gopsutil
		infos, err := cpu.Info()
		if err == nil && len(infos) > 0 {
			return infos[0].Mhz
		}
		return 0
	}
	khz, err := strconv.ParseFloat(strings.TrimSpace(string(data)), 64)
	if err != nil {
		return 0
	}
	return khz / 1000.0
}
