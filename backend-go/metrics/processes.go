package metrics

import (
	"math"
	"sort"
	"strings"

	"github.com/shirou/gopsutil/v3/process"
)

const processLimit = 10

type procSnapshot struct {
	info ProcessInfo
	cpu  float64
	mem  float64
}

func collectProcesses(s *procState) map[string][]ProcessInfo {
	pids, err := process.Pids()
	if err != nil {
		return map[string][]ProcessInfo{"cpu": {}, "memory": {}}
	}

	// Remove dead PIDs from cache.
	alive := make(map[int32]struct{}, len(pids))
	for _, pid := range pids {
		alive[pid] = struct{}{}
	}
	for pid := range s.cache {
		if _, ok := alive[pid]; !ok {
			delete(s.cache, pid)
		}
	}

	snaps := make([]procSnapshot, 0, len(pids))

	for _, pid := range pids {
		p, ok := s.cache[pid]
		if !ok {
			var err error
			p, err = process.NewProcess(pid)
			if err != nil {
				continue
			}
			s.cache[pid] = p
		}

		// CPUPercent() tracks delta internally across calls on the same object.
		// First call per new process returns 0, which is correct behaviour.
		cpuPct, err := p.CPUPercent()
		if err != nil {
			continue
		}
		memPct, err := p.MemoryPercent()
		if err != nil {
			continue
		}

		name, _ := p.Name()
		username, _ := p.Username()
		createTime, _ := p.CreateTime() // epoch milliseconds
		ppid, _ := p.Ppid()
		threads, _ := p.NumThreads()

		cmdline := name
		if rawCmd, err := p.CmdlineSlice(); err == nil && len(rawCmd) > 0 {
			full := strings.Join(rawCmd, " ")
			if len(full) > 120 {
				full = full[:120]
			}
			cmdline = full
		}

		snaps = append(snaps, procSnapshot{
			cpu: cpuPct,
			mem: float64(memPct),
			info: ProcessInfo{
				PID:           pid,
				Name:          name,
				CPUPercent:    round1(cpuPct),
				MemoryPercent: round1(float64(memPct)),
				Username:      username,
				Cmdline:       cmdline,
				CreateTime:    float64(createTime) / 1000.0, // ms → seconds
				PPID:          ppid,
				NumThreads:    threads,
			},
		})
	}

	// Top by CPU
	sort.Slice(snaps, func(i, j int) bool { return snaps[i].cpu > snaps[j].cpu })
	topCPU := snapToInfoSlice(snaps, processLimit)

	// Top by Memory
	sort.Slice(snaps, func(i, j int) bool { return snaps[i].mem > snaps[j].mem })
	topMem := snapToInfoSlice(snaps, processLimit)

	return map[string][]ProcessInfo{"cpu": topCPU, "memory": topMem}
}

func snapToInfoSlice(snaps []procSnapshot, limit int) []ProcessInfo {
	if limit > len(snaps) {
		limit = len(snaps)
	}
	out := make([]ProcessInfo, limit)
	for i := range out {
		out[i] = snaps[i].info
	}
	return out
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}
