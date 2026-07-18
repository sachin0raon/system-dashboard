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

	// Remove dead PIDs from both caches.
	alive := make(map[int32]struct{}, len(pids))
	for _, pid := range pids {
		alive[pid] = struct{}{}
	}
	for pid := range s.procs {
		if _, ok := alive[pid]; !ok {
			delete(s.procs, pid)
			delete(s.cached, pid)
		}
	}

	snaps := make([]procSnapshot, 0, len(pids))

	for _, pid := range pids {
		p, ok := s.procs[pid]
		if !ok {
			var err error
			p, err = process.NewProcess(pid)
			if err != nil {
				continue
			}
			s.procs[pid] = p
		}

		// CPUPercent and MemoryPercent are the only fields that change every tick.
		cpuPct, err := p.CPUPercent()
		if err != nil {
			continue
		}
		memPct, err := p.MemoryPercent()
		if err != nil {
			continue
		}

		// NumThreads can change; read it every tick (reads /proc/<pid>/status).
		threads, _ := p.NumThreads()

		// All other fields are constant for the lifetime of a process.
		// Fetch once and cache; skip the /proc reads on subsequent ticks.
		info, cached := s.cached[pid]
		if !cached {
			name, _ := p.Name()
			username, _ := p.Username()
			createTime, _ := p.CreateTime()
			ppid, _ := p.Ppid()

			cmdline := name
			if rawCmd, err := p.CmdlineSlice(); err == nil && len(rawCmd) > 0 {
				full := strings.Join(rawCmd, " ")
				if len(full) > 120 {
					full = full[:120]
				}
				cmdline = full
			}

			info = procCachedInfo{
				name:       name,
				username:   username,
				cmdline:    cmdline,
				createTime: float64(createTime) / 1000.0,
				ppid:       ppid,
			}
			s.cached[pid] = info
		}

		snaps = append(snaps, procSnapshot{
			cpu: cpuPct,
			mem: float64(memPct),
			info: ProcessInfo{
				PID:           pid,
				Name:          info.name,
				CPUPercent:    round1(cpuPct),
				MemoryPercent: round1(float64(memPct)),
				Username:      info.username,
				Cmdline:       info.cmdline,
				CreateTime:    info.createTime,
				PPID:          info.ppid,
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
