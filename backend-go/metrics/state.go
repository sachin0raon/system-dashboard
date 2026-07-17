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
	prev     diskIOSnapshot
	prevTime time.Time
}

type netIOSnapshot struct {
	bytesSent   uint64
	bytesRecv   uint64
	packetsSent uint64
	packetsRecv uint64
}

type netState struct {
	prev     map[string]netIOSnapshot
	prevTime time.Time
}

type procState struct {
	// Reusing the same *process.Process object between ticks lets
	// gopsutil track CPU time deltas internally via CPUPercent().
	cache map[int32]*process.Process
}

func NewState() *State {
	return &State{
		Net:  netState{prev: make(map[string]netIOSnapshot)},
		Proc: procState{cache: make(map[int32]*process.Process)},
	}
}
