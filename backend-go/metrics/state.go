package metrics

import (
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

// State holds all inter-tick values needed to compute deltas.
// Only the broadcast loop goroutine ever calls Collect(), so these fields
// are written by exactly one goroutine and need no external mutex.
// Each sub-struct is accessed only by its corresponding collector goroutine,
// making parallel collection race-free.
type State struct {
	CPU  cpuState
	Disk diskState
	Net  netState
	Proc procState
}

type cpuState struct {
	prevCTX  uint64
	prevINTR uint64
	prevTime time.Time
}

type diskIOSnapshot struct {
	readBytes  uint64
	writeBytes uint64
	readCount  uint64
	writeCount uint64
}

type diskState struct {
	prev        diskIOSnapshot
	prevTime    time.Time
	// deviceTypes caches the detected label per device path (NVMe/SD Card/SSD/HDD/USB).
	// The type never changes at runtime so we only read sysfs once per device.
	deviceTypes map[string]string
}

type netIOSnapshot struct {
	bytesSent   uint64
	bytesRecv   uint64
	packetsSent uint64
	packetsRecv uint64
}

type netState struct {
	prev       map[string]netIOSnapshot
	prevTime   time.Time
	// IP addresses are stable; refresh every 60s instead of every tick.
	ipCache    map[string]*string
	ipExpiry   time.Time
	// Link speed never changes at runtime; cache permanently.
	speedCache map[string]int
}

// procCachedInfo holds fields that are constant for the lifetime of a process.
// Fetched once on first encounter; re-read only when the PID is new.
type procCachedInfo struct {
	name       string
	username   string
	cmdline    string
	createTime float64 // unix seconds
	ppid       int32
}

type procState struct {
	// procs reuses the same *process.Process object across ticks so gopsutil
	// can track CPU-time deltas internally via CPUPercent().
	procs map[int32]*process.Process
	// cached holds fields that don't change for a running process.
	cached map[int32]procCachedInfo

	// tickCount and lastResult implement a collection cadence: we run the full
	// /proc scan every procCollectEvery ticks and return cached data in between.
	// This cuts ~450 file reads/tick to ~150 reads/tick on average.
	tickCount  uint8
	lastResult map[string][]ProcessInfo
}

func NewState() *State {
	return &State{
		Disk: diskState{deviceTypes: make(map[string]string)},
		Net: netState{
			prev:       make(map[string]netIOSnapshot),
			ipCache:    make(map[string]*string),
			speedCache: make(map[string]int),
		},
		Proc: procState{
			procs:      make(map[int32]*process.Process),
			cached:     make(map[int32]procCachedInfo),
			lastResult: map[string][]ProcessInfo{"cpu": {}, "memory": {}},
		},
	}
}
