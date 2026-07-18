package metrics

// All structs mirror frontend/src/types/metrics.ts exactly.
// JSON tags use snake_case to preserve the existing API contract.

type SystemMetrics struct {
	CPU             CpuInfo       `json:"cpu"`
	Memory          MemoryInfo    `json:"memory"`
	Disk            DiskInfo      `json:"disk"`
	Temperature     TempInfo      `json:"temperature"`
	Network         NetworkInfo   `json:"network"`
	OS              OsInfo        `json:"os"`
	ProcessesCPU    []ProcessInfo `json:"processes_cpu"`
	ProcessesMemory []ProcessInfo `json:"processes_memory"`
	Timestamp       string        `json:"timestamp"`
}

type CpuInfo struct {
	UsagePercent      float64   `json:"usage_percent"`
	PerCorePercent    []float64 `json:"per_core_percent"`
	FrequencyMHz      float64   `json:"frequency_mhz"`
	CoreCount         int       `json:"core_count"`
	ThreadCount       int       `json:"thread_count"`
	CtxSwitchesPerSec float64   `json:"ctx_switches_per_sec"`
	InterruptsPerSec  float64   `json:"interrupts_per_sec"`
}

type MemoryInfo struct {
	TotalBytes     uint64  `json:"total_bytes"`
	UsedBytes      uint64  `json:"used_bytes"`
	AvailableBytes uint64  `json:"available_bytes"`
	Percent        float64 `json:"percent"`
	SwapTotalBytes uint64  `json:"swap_total_bytes"`
	SwapUsedBytes  uint64  `json:"swap_used_bytes"`
	SwapPercent    float64 `json:"swap_percent"`
	CachedBytes    uint64  `json:"cached_bytes"`
	BuffersBytes   uint64  `json:"buffers_bytes"`
	SharedBytes    uint64  `json:"shared_bytes"`
}

type DiskPartition struct {
	Device     string  `json:"device"`
	Mountpoint string  `json:"mountpoint"`
	Fstype     string  `json:"fstype"`
	TotalBytes uint64  `json:"total_bytes"`
	UsedBytes  uint64  `json:"used_bytes"`
	FreeBytes  uint64  `json:"free_bytes"`
	Percent    float64 `json:"percent"`
	ReadOnly   bool    `json:"read_only"`
	DeviceType string  `json:"device_type"`
}

type DiskInfo struct {
	Partitions       []DiskPartition `json:"partitions"`
	ReadBytesPerSec  float64         `json:"read_bytes_per_sec"`
	WriteBytesPerSec float64         `json:"write_bytes_per_sec"`
	ReadCountPerSec  float64         `json:"read_count_per_sec"`
	WriteCountPerSec float64         `json:"write_count_per_sec"`
}

// TempInfo uses pointers for nullable fields so they serialize as JSON null.
type TempInfo struct {
	CPUCelsius     *float64           `json:"cpu_celsius"`
	GPUCelsius     *float64           `json:"gpu_celsius"`
	FanSpeedRPM    *float64           `json:"fan_speed_rpm"`
	Sensors        map[string]float64 `json:"sensors"`
	IsUnderVoltage bool               `json:"is_under_voltage"`
	IsThrottled    bool               `json:"is_throttled"`
	FreqCapped     bool               `json:"freq_capped"`
	SoftTempLimit  bool               `json:"soft_temp_limit"`
}

type NetworkInterface struct {
	Name              string  `json:"name"`
	BytesSentPerSec   float64 `json:"bytes_sent_per_sec"`
	BytesRecvPerSec   float64 `json:"bytes_recv_per_sec"`
	BytesSentTotal    uint64  `json:"bytes_sent_total"`
	BytesRecvTotal    uint64  `json:"bytes_recv_total"`
	PacketsSentPerSec float64 `json:"packets_sent_per_sec"`
	PacketsRecvPerSec float64 `json:"packets_recv_per_sec"`
	ErrorsTotal       uint64  `json:"errors_total"`
	DropsTotal        uint64  `json:"drops_total"`
	SpeedMbps         int     `json:"speed_mbps"`
	IPAddress         *string `json:"ip_address"`
}

type NetworkInfo struct {
	Interfaces []NetworkInterface `json:"interfaces"`
}

type OsInfo struct {
	Hostname      string  `json:"hostname"`
	OsName        string  `json:"os_name"`
	OsVersion     string  `json:"os_version"`
	Kernel        string  `json:"kernel"`
	Architecture  string  `json:"architecture"`
	UptimeSeconds float64 `json:"uptime_seconds"`
	BootTime      string  `json:"boot_time"`
	LoadAvg1      float64 `json:"load_avg_1"`
	LoadAvg5      float64 `json:"load_avg_5"`
	LoadAvg15     float64 `json:"load_avg_15"`
	ProcessCount  int     `json:"process_count"`
	CPUModel      string  `json:"cpu_model"`
}

type ProcessInfo struct {
	PID           int32   `json:"pid"`
	Name          string  `json:"name"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	Username      string  `json:"username"`
	Cmdline       string  `json:"cmdline"`
	CreateTime    float64 `json:"create_time"`
	PPID          int32   `json:"ppid"`
	NumThreads    int32   `json:"num_threads"`
}
