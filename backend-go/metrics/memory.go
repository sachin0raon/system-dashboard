package metrics

import "github.com/shirou/gopsutil/v3/mem"

func collectMemory() MemoryInfo {
	vm, err := mem.VirtualMemory()
	if err != nil {
		return MemoryInfo{}
	}
	sw, err := mem.SwapMemory()
	if err != nil {
		sw = &mem.SwapMemoryStat{}
	}

	return MemoryInfo{
		TotalBytes:     vm.Total,
		UsedBytes:      vm.Used,
		AvailableBytes: vm.Available,
		Percent:        vm.UsedPercent,
		SwapTotalBytes: sw.Total,
		SwapUsedBytes:  sw.Used,
		SwapPercent:    sw.UsedPercent,
		CachedBytes:    vm.Cached,
		BuffersBytes:   vm.Buffers,
		SharedBytes:    vm.Shared,
	}
}
