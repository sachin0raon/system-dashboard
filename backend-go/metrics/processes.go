package metrics

import (
	"container/heap"
	"math"
	"strings"

	"github.com/shirou/gopsutil/v3/process"
)

const (
	processLimit     = 10
	procCollectEvery = 3 // full /proc scan every 3 ticks (~6s at 2s interval)
)

type procSnapshot struct {
	info ProcessInfo
	cpu  float64
	mem  float64
}

// collectProcesses returns the top-N processes by CPU and memory.
// Full collection runs every procCollectEvery ticks; cached results are returned
// in between, cutting ~66% of per-tick /proc file reads.
func collectProcesses(s *procState) map[string][]ProcessInfo {
	s.tickCount++
	if s.tickCount%procCollectEvery != 0 {
		return s.lastResult
	}

	pids, err := process.Pids()
	if err != nil {
		return s.lastResult
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
			var nerr error
			p, nerr = process.NewProcess(pid)
			if nerr != nil {
				continue
			}
			s.procs[pid] = p
		}

		cpuPct, err := p.CPUPercent()
		if err != nil {
			continue
		}
		memPct, err := p.MemoryPercent()
		if err != nil {
			continue
		}
		threads, _ := p.NumThreads()

		// Static fields: fetch once per PID lifetime, cache forever.
		info, cached := s.cached[pid]
		if !cached {
			name, _ := p.Name()
			username, _ := p.Username()
			createTime, _ := p.CreateTime()
			ppid, _ := p.Ppid()

			cmdline := name
			if rawCmd, err2 := p.CmdlineSlice(); err2 == nil && len(rawCmd) > 0 {
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

	result := map[string][]ProcessInfo{
		"cpu":    topNSnaps(snaps, processLimit, byCPU),
		"memory": topNSnaps(snaps, processLimit, byMem),
	}
	s.lastResult = result
	return result
}

func byCPU(s procSnapshot) float64 { return s.cpu }
func byMem(s procSnapshot) float64 { return s.mem }

// topNSnaps selects the top n snapshots by key score in O(N log n) using a
// min-heap, avoiding a full O(N log N) sort of all processes.
func topNSnaps(snaps []procSnapshot, n int, key func(procSnapshot) float64) []ProcessInfo {
	h := &procMinHeap{key: key}
	heap.Init(h)

	for i := range snaps {
		v := key(snaps[i])
		if len(h.entries) < n {
			heap.Push(h, procHeapEntry{val: v, idx: i})
		} else if v > h.entries[0].val {
			heap.Pop(h)
			heap.Push(h, procHeapEntry{val: v, idx: i})
		}
	}

	// Pop ascending; fill result slice back-to-front for descending order.
	result := make([]ProcessInfo, len(h.entries))
	for i := len(result) - 1; i >= 0; i-- {
		entry := heap.Pop(h).(procHeapEntry)
		result[i] = snaps[entry.idx].info
	}
	return result
}

type procHeapEntry struct {
	val float64
	idx int
}

type procMinHeap struct {
	entries []procHeapEntry
	key     func(procSnapshot) float64
}

func (h procMinHeap) Len() int            { return len(h.entries) }
func (h procMinHeap) Less(i, j int) bool  { return h.entries[i].val < h.entries[j].val }
func (h procMinHeap) Swap(i, j int)       { h.entries[i], h.entries[j] = h.entries[j], h.entries[i] }
func (h *procMinHeap) Push(x any)         { h.entries = append(h.entries, x.(procHeapEntry)) }
func (h *procMinHeap) Pop() any {
	old := h.entries
	n := len(old)
	x := old[n-1]
	h.entries = old[:n-1]
	return x
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}
