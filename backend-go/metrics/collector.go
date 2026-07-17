package metrics

import (
	"encoding/json"
	"sync"
	"time"
)

// Collect runs all six metric collectors in parallel goroutines and assembles
// the result. Tick latency is bounded by the slowest collector (processes),
// not the sum of all collectors as it was in the sequential Python backend.
//
// state must only be accessed by one goroutine at a time; callers must ensure
// Collect() is not called concurrently (the broadcast loop guarantees this).
func Collect(static *StaticInfo, state *State) (SystemMetrics, []byte) {
	var (
		cpuRes  CpuInfo
		memRes  MemoryInfo
		diskRes DiskInfo
		tempRes TempInfo
		netRes  NetworkInfo
		procCPU []ProcessInfo
		procMem []ProcessInfo
	)

	var wg sync.WaitGroup
	wg.Add(6)

	// Each goroutine touches only its own sub-state field — no data race.
	go func() { defer wg.Done(); cpuRes = collectCPU(&state.CPU) }()
	go func() { defer wg.Done(); memRes = collectMemory() }()
	go func() { defer wg.Done(); diskRes = collectDisk(&state.Disk) }()
	go func() { defer wg.Done(); tempRes = collectTemperature() }()
	go func() { defer wg.Done(); netRes = collectNetwork(&state.Net) }()
	go func() {
		defer wg.Done()
		procs := collectProcesses(&state.Proc)
		procCPU = procs["cpu"]
		procMem = procs["memory"]
	}()

	wg.Wait()

	// Ensure slices are never nil so JSON encodes [] not null.
	if procCPU == nil {
		procCPU = []ProcessInfo{}
	}
	if procMem == nil {
		procMem = []ProcessInfo{}
	}

	m := SystemMetrics{
		CPU:             cpuRes,
		Memory:          memRes,
		Disk:            diskRes,
		Temperature:     tempRes,
		Network:         netRes,
		OS:              buildOsInfo(static),
		ProcessesCPU:    procCPU,
		ProcessesMemory: procMem,
		Timestamp:       time.Now().UTC().Format(time.RFC3339),
	}

	data, _ := json.Marshal(m)
	return m, data
}
